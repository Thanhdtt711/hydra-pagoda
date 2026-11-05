<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { zenAudio } from '~/lib/audio/ZenAudio'
import { createClientRequestId, useEconomyStore } from '~/stores/economy'
import { useUserStore, type CountryId } from '~/stores/user'
import { useWalletStore } from '~/stores/wallet'
import { useCardsStore } from '~/stores/cards'

export type DrawerTab =
  | 'fortune'
  | 'shop'
  | 'merit'
  | 'cards'
  | 'meditation'
  | 'soundscape'
  | 'sangha'
  | 'temple_detail'

type DivinationType = 'stick' | 'love' | 'family' | 'wealth' | 'health' | 'star'
type DivinationTier = 'basic' | 'auspicious' | 'golden'

const props = defineProps<{
  modelValue: boolean
  activeTab: DrawerTab
  onlineCount?: number
  remotePilgrims?: Array<{ id: string; name: string; title: string; country: string; action: string }>
  initialFortuneCategory?: DivinationType
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:activeTab', tab: DrawerTab): void
  (e: 'outfitChanged', countryId: CountryId): void
  (e: 'greetPilgrim', id: string): void
  (e: 'sendMantra', text: string): void
}>()

const economy = useEconomyStore()
const user = useUserStore()
const wallet = useWalletStore()
const cards = useCardsStore()

const currentTab = computed({
  get: () => props.activeTab,
  set: (val: DrawerTab) => {
    pendingConfirm.value = null
    emit('update:activeTab', val)
  }
})

watch(() => props.modelValue, (open) => {
  if (open) {
    pendingConfirm.value = null
    void economy.loadCatalog()
  }
})

onMounted(() => {
  void economy.loadCatalog()
})

const TAB_NAV: Array<{ id: DrawerTab; name: string; icon: any; badge: string; subtitle: string }> = [
  { id: 'fortune', name: 'Bói Quẻ 6 Môn', icon: 'sparkles', badge: 'CHIÊM BỐC TÂM LINH', subtitle: 'Xin Xăm · Duyên Tình · Con Cái · Tài Lộc · Sức Khỏe · Dâng Sao' },
  { id: 'shop', name: 'Cửa Hàng', icon: 'lotus', badge: 'PHÁP BẢO & CỔ PHỤC', subtitle: 'Tủ đồ 9 quốc gia · Nhang trầm · Mâm lễ vật cúng dường' },
  { id: 'merit', name: 'Hòm Công Đức', icon: 'coin', badge: 'PHƯỚC ĐỨC TÂM AN', subtitle: 'Cúng dường tự nguyện bằng MC · Bảng vàng công đức' },
  { id: 'cards', name: 'Thẻ Bài Di Sản', icon: 'cards', badge: 'TRIẾT LÝ & KIẾN TRÚC', subtitle: 'Mô hình 3D cổ tự mini · Thuyết minh Audio · Khai quang bằng MC' },
  { id: 'meditation', name: 'Hội Thiền 432Hz', icon: 'meditation', badge: 'CHÁNH NIỆM ĐỊNH TÂM', subtitle: 'Chuông xoay 432Hz · Vòng điều tức Mandala 4-4-6' },
  { id: 'soundscape', name: 'Âm Thanh 3D', icon: 'bell', badge: 'SPATIAL SOUNDSCAPE', subtitle: 'Bộ trộn âm thanh thiền 6 kênh thời gian thực' },
  { id: 'sangha', name: 'Pháp Đàm & Đồng Tu', icon: 'message', badge: 'SANGHA COMMUNITY', subtitle: 'Khẩu ý thanh tịnh · Danh sách hành giả đang online' }
]

const currentMeta = computed(() => {
  return TAB_NAV.find(t => t.id === currentTab.value) || TAB_NAV[0]
})

function closeDrawer() {
  pendingConfirm.value = null
  emit('update:modelValue', false)
}

/* =====================================================================
   XÁC NHẬN TRƯỚC KHI TIÊU MC (CONFIRMATION & IDEMPOTENT REQUEST ID)
===================================================================== */
interface PendingSpendConfirm {
  kind: 'fortune' | 'shop' | 'merit' | 'card'
  title: string
  costMc: number
  requestId: string
  payload: Record<string, any>
}

const pendingConfirm = ref<PendingSpendConfirm | null>(null)

function askConfirmSpend(kind: PendingSpendConfirm['kind'], title: string, costMc: number, payload: Record<string, any>) {
  fortuneNotice.value = null
  shopNotice.value = null
  meritError.value = null
  cardNotice.value = null

  if (!wallet.isConnected) {
    const msg = 'Vui lòng kết nối ví Eternl trước khi tiêu MC!'
    if (kind === 'fortune') fortuneNotice.value = msg
    else if (kind === 'shop') shopNotice.value = msg
    else if (kind === 'merit') meritError.value = msg
    else cardNotice.value = msg
    return
  }

  if (economy.meritCoins < costMc) {
    const msg = `Số dư không đủ (${economy.meritCoins.toLocaleString()} / ${costMc.toLocaleString()} MC). Hãy bấm "Nạp MC"!`
    if (kind === 'fortune') fortuneNotice.value = msg
    else if (kind === 'shop') shopNotice.value = msg
    else if (kind === 'merit') meritError.value = msg
    else cardNotice.value = msg
    return
  }

  pendingConfirm.value = {
    kind,
    title,
    costMc,
    requestId: createClientRequestId(kind),
    payload
  }
}

function cancelConfirmSpend() {
  pendingConfirm.value = null
}

async function executeConfirmedSpend() {
  const c = pendingConfirm.value
  if (!c || economy.isSpending) return
  if (c.kind === 'fortune') {
    await performConfirmedFortune(c)
  } else if (c.kind === 'shop') {
    await performConfirmedShopPurchase(c)
  } else if (c.kind === 'merit') {
    await performConfirmedMeritDonation(c)
  } else if (c.kind === 'card') {
    await performConfirmedCardUnlock(c)
  }
}

/* =====================================================================
   1. PHÂN HỆ BÓI QUẺ 6 MÔN (FORTUNE & DIVINATION - SERVER GENERATED)
===================================================================== */
const fortuneCategory = ref<DivinationType>('stick')
const selectedTier = ref<DivinationTier>('auspicious')
const isRolling = ref(false)
const fortuneResult = ref<any | null>(null)
const fortuneNotice = ref<string | null>(null)
const showFortuneHistory = ref(false)

watch(() => props.initialFortuneCategory, (cat) => {
  if (cat) {
    fortuneCategory.value = cat
    fortuneResult.value = null
    pendingConfirm.value = null
  }
})

const FORTUNE_CATEGORIES: Array<{ id: DivinationType; name: string; icon: string; short: string }> = [
  { id: 'stick', name: 'Xin Xăm Bát Quái', icon: 'cards', short: 'Bổn mạng & Sự nghiệp' },
  { id: 'love', name: 'Tơ Duyên Tương Ngộ', icon: 'sparkles', short: 'Nguyệt Lão chỉ hồng' },
  { id: 'family', name: 'Cầu Tự Con Cái', icon: 'lotus', short: 'Quan Âm Tống Tử' },
  { id: 'wealth', name: 'Chiêu Tài Tấn Bảo', icon: 'coin', short: 'Kinh doanh phát đạt' },
  { id: 'health', name: 'Dược Sư An Khang', icon: 'meditation', short: 'Tiêu tai trừ bệnh' },
  { id: 'star', name: 'Dâng Sao Giải Hạn', icon: 'sun', short: 'Bắc Đẩu Thất Tinh' }
]

const currentFortuneCostMc = computed(() => {
  return economy.fortuneTiers[selectedTier.value]?.costMc ?? (selectedTier.value === 'basic' ? 10 : selectedTier.value === 'auspicious' ? 50 : 100)
})

const canAffordFortune = computed(() => wallet.isConnected && economy.meritCoins >= currentFortuneCostMc.value)

function requestRollFortune() {
  const catObj = FORTUNE_CATEGORIES.find(c => c.id === fortuneCategory.value)
  const tierObj = economy.fortuneTiers[selectedTier.value]
  askConfirmSpend(
    'fortune',
    `Gieo quẻ ${catObj?.name || fortuneCategory.value} (${tierObj?.name || selectedTier.value})`,
    currentFortuneCostMc.value,
    { category: fortuneCategory.value, tier: selectedTier.value }
  )
}

async function performConfirmedFortune(c: PendingSpendConfirm) {
  fortuneNotice.value = null
  pendingConfirm.value = null
  isRolling.value = true

  try {
    zenAudio.playFortuneShaking()
    const res = await economy.drawFortune(c.payload.category, c.payload.tier, c.requestId)
    setTimeout(() => {
      fortuneResult.value = {
        ...res.fortune,
        wealth: res.fortune.aspects?.wealth || res.fortune.wealth,
        career: res.fortune.aspects?.career || res.fortune.career,
        love: res.fortune.aspects?.love || res.fortune.love,
        health: res.fortune.aspects?.health || res.fortune.health,
        advice: res.fortune.mindfulAdvice || res.fortune.advice,
        receiptHash: res.receiptHash,
        spentMc: res.spentMc
      }
      isRolling.value = false
      zenAudio.playTempleBell()
    }, 550)
  } catch (e: any) {
    isRolling.value = false
    fortuneNotice.value = e?.data?.statusMessage || e?.data?.message || e?.message || 'Không thể gieo quẻ lúc này.'
  }
}

/* =====================================================================
   2. PHÂN HỆ CỬA HÀNG PHÁP BẢO & TỦ ĐỒ 9 QUỐC GIA (SERVER CATALOG)
===================================================================== */
const shopTab = ref<'attire' | 'offerings'>('attire')
const shopNotice = ref<string | null>(null)
const shopSuccess = ref<string | null>(null)

const attireItems = computed(() => {
  if (economy.attireCatalog.length > 0) return economy.attireCatalog
  return [
    { id: 'vietnam', name: 'Áo Lam Cổ Phục & Nón Lá', subname: 'Áo Tấc lụa lam Hà Đông dệt viền chỉ vàng kim', category: 'attire', countryCode: 'VN', countryId: 'vietnam', priceMc: 0, consumable: false, defaultUnlocked: true, icon: 'sparkles' },
    { id: 'japan', name: 'Samue Thiền Tăng & Nón Kasa', subname: 'Đen chàm Zen tối giản đan nón rơm Kasa', category: 'attire', countryCode: 'JP', countryId: 'japan', priceMc: 500, consumable: false, defaultUnlocked: true, icon: 'sparkles' },
    { id: 'western', name: 'Pháp Phục Nâu Làng Mai', subname: 'Vải thô mộc mạc từng bước chân an lạc', category: 'attire', countryCode: 'LM', countryId: 'western', priceMc: 600, consumable: false, defaultUnlocked: false, icon: 'sparkles' },
    { id: 'thailand', name: 'Y Cà Sa Theravada', subname: 'Saffron vàng nghệ hoàng gia Thái Lan', category: 'attire', countryCode: 'TH', countryId: 'thailand', priceMc: 800, consumable: false, defaultUnlocked: false, icon: 'sparkles' },
    { id: 'korea', name: 'Hanbok Durumagi & Mũ Gat', subname: 'Xám khói thanh tịnh thiền phái Tào Khê', category: 'attire', countryCode: 'KR', countryId: 'korea', priceMc: 1000, consumable: false, defaultUnlocked: false, icon: 'sparkles' },
    { id: 'taiwan', name: 'Áo Tràng Lam Cổ Tự', subname: 'Đại Phật nhân gian thêu hoa sen ngọc', category: 'attire', countryCode: 'TW', countryId: 'taiwan', priceMc: 1200, consumable: false, defaultUnlocked: false, icon: 'sparkles' },
    { id: 'singapore', name: 'Pháp Phục Lụa Singapore', subname: 'Giao thoa thanh lịch thời Đường hiện đại', category: 'attire', countryCode: 'SG', countryId: 'singapore', priceMc: 1500, consumable: false, defaultUnlocked: false, icon: 'sparkles' },
    { id: 'india', name: 'Khăn Quàng Dhoti Bồ Đề', subname: 'Y đỏ phù sa đất Phật Tứ Động Tâm', category: 'attire', countryCode: 'IN', countryId: 'india', priceMc: 1800, consumable: false, defaultUnlocked: false, icon: 'sparkles' },
    { id: 'tibet', name: 'Áo Chuba & Mũ Pandita', subname: 'Vải dạ viền gấm Tây Tạng tuyết sơn', category: 'attire', countryCode: 'TB', countryId: 'tibet', priceMc: 2500, consumable: false, defaultUnlocked: false, icon: 'sparkles' }
  ]
})

const offeringItems = computed(() => {
  if (economy.offeringCatalog.length > 0) return economy.offeringCatalog
  return [
    { id: 'incense_quang', name: 'Trầm Hương Xứ Quảng', subname: 'Tỏa làn khói trầm thơm ngát 30 phút', category: 'offering', countryCode: 'VN', priceMc: 50, consumable: true, defaultUnlocked: false, icon: 'incense' },
    { id: 'lotus_lantern', name: 'Hoa Đăng Cầu An', subname: 'Đèn sen lung linh thắp sáng ước nguyện', category: 'offering', countryCode: 'VN', priceMc: 60, consumable: true, defaultUnlocked: false, icon: 'lotus' },
    { id: 'incense_japan', name: 'Đàn Hương Kyoto', subname: 'Thanh khiết hương trầm chùa cổ Nhật Bản', category: 'offering', countryCode: 'JP', priceMc: 80, consumable: true, defaultUnlocked: false, icon: 'incense' },
    { id: 'oan_cake', name: 'Bánh Oản Hoàng Cung', subname: 'Lễ phẩm trang nghiêm thời Nguyễn', category: 'offering', countryCode: 'VN', priceMc: 100, consumable: true, defaultUnlocked: false, icon: 'cards' },
    { id: 'fruit_basket', name: 'Mâm Ngũ Quả Cúng Dường', subname: 'Hoa quả tươi ngũ sắc kính dâng Tam Bảo', category: 'offering', countryCode: 'VN', priceMc: 120, consumable: true, defaultUnlocked: false, icon: 'lotus' }
  ]
})

function tryOnOutfit(countryId: string) {
  emit('outfitChanged', countryId as CountryId)
  user.setCountry(countryId as CountryId)
  zenAudio.playWoodenFish()
  shopSuccess.value = `Đã khoác trang phục ${countryId.toUpperCase()}!`
}

function requestBuyItem(item: { id: string; name: string; priceMc: number; category: string }) {
  shopSuccess.value = null
  askConfirmSpend('shop', `Thỉnh "${item.name}"`, item.priceMc, { itemId: item.id, itemName: item.name, category: item.category })
}

async function performConfirmedShopPurchase(c: PendingSpendConfirm) {
  shopNotice.value = null
  shopSuccess.value = null
  try {
    const res = await economy.buyShopItem(c.payload.itemId, c.requestId)
    pendingConfirm.value = null
    zenAudio.playCoinDrop()
    zenAudio.playTempleBell()
    if (res.item.category === 'attire' && res.item.countryId) {
      tryOnOutfit(res.item.countryId)
    }
    shopSuccess.value = `Đã thỉnh thành công "${res.item.name}" (-${res.spentMc.toLocaleString()} MC · Mã sổ cái #${res.ledgerId})!`
  } catch (e: any) {
    pendingConfirm.value = null
    shopNotice.value = e?.data?.statusMessage || e?.message || 'Không thể mua vật phẩm.'
  }
}

/* =====================================================================
   3. PHÂN HỆ HÒM CÔNG ĐỨC (MERIT DONATION - SERVER LEDGER)
===================================================================== */
const meritAmount = ref<number>(100)
const customMeritInput = ref<string>('100')
const meritPrayer = ref<string>('Nguyện cầu gia đạo bình an, thân tâm thường lạc')
const meritBlessing = ref<string | null>(null)
const meritError = ref<string | null>(null)
const lastMeritReceipt = ref<{ receiptHash: string; rewardItemName: string | null; amountMc: number } | null>(null)

function selectMeritPreset(amt: number) {
  meritAmount.value = amt
  customMeritInput.value = String(amt)
}

function onCustomMeritInput() {
  const n = Math.floor(Number(customMeritInput.value))
  meritAmount.value = Number.isFinite(n) && n > 0 ? n : 0
}

const canAffordMerit = computed(() =>
  wallet.isConnected &&
  Number.isSafeInteger(meritAmount.value) &&
  meritAmount.value >= economy.meritConfig.minMc &&
  economy.meritCoins >= meritAmount.value
)

function requestDonateMerit() {
  meritBlessing.value = null
  meritError.value = null
  const amt = Math.floor(Number(customMeritInput.value))
  if (!Number.isSafeInteger(amt) || amt < economy.meritConfig.minMc) {
    meritError.value = `Mức công đức tối thiểu là ${economy.meritConfig.minMc} MC (số nguyên).`
    return
  }
  meritAmount.value = amt
  askConfirmSpend('merit', `Cúng dường Hòm Công Đức`, amt, { amountMc: amt, prayer: meritPrayer.value })
}

async function performConfirmedMeritDonation(c: PendingSpendConfirm) {
  meritError.value = null
  try {
    const res = await economy.donateMerit(c.payload.amountMc, c.payload.prayer, c.requestId)
    pendingConfirm.value = null
    zenAudio.playCoinDrop()
    zenAudio.playTempleBell()
    meritBlessing.value = res.donation.blessing
    lastMeritReceipt.value = {
      receiptHash: res.donation.receiptHash,
      rewardItemName: res.donation.rewardItemName,
      amountMc: res.spentMc
    }
  } catch (e: any) {
    pendingConfirm.value = null
    meritError.value = e?.data?.statusMessage || e?.message || 'Không thể thực hiện công đức.'
  }
}

/* =====================================================================
   4. PHÂN HỆ THẺ BÀI DI SẢN 3D (HERITAGE CARDS UNLOCK)
===================================================================== */
const cardNotice = ref<string | null>(null)
const cardSuccess = ref<string | null>(null)

function getCardPriceMc(cardId: string): number {
  return economy.getItemPriceMc(cardId, 1500)
}

function requestUnlockCard(card: { id: string; title: string }) {
  cardNotice.value = null
  cardSuccess.value = null
  const priceMc = getCardPriceMc(card.id)
  askConfirmSpend('card', `Khai quang thẻ di sản "${card.title}"`, priceMc, { itemId: card.id })
}

async function performConfirmedCardUnlock(c: PendingSpendConfirm) {
  cardNotice.value = null
  cardSuccess.value = null
  try {
    const res = await economy.buyShopItem(c.payload.itemId, c.requestId)
    pendingConfirm.value = null
    cards.unlockCard(c.payload.itemId)
    zenAudio.playCoinDrop()
    zenAudio.playTempleBell()
    cardSuccess.value = `Đã khai quang "${res.item.name}" (-${res.spentMc.toLocaleString()} MC · Sổ cái #${res.ledgerId})!`
  } catch (e: any) {
    pendingConfirm.value = null
    cardNotice.value = e?.data?.statusMessage || e?.message || 'Không thể mở khóa thẻ di sản.'
  }
}

/* =====================================================================
   5. PHÂN HỆ HỘI THIỀN 432HZ (MEDITATION TIMER & MANDALA 4-4-6)
===================================================================== */
const meditationMinutes = ref<number>(5)
const isMeditating = ref(false)
const breathePhase = ref<'HÍT VÀO' | 'GIỮ HƠI' | 'THỞ RA'>('HÍT VÀO')
const breatheSeconds = ref(4)

function toggleMeditationSession() {
  isMeditating.value = !isMeditating.value
  if (isMeditating.value) {
    zenAudio.playSingingBowl()
    user.setMeditationStreak(user.streakDays + 1)
  }
}

/* =====================================================================
   6. BỘ TRỘN ÂM THANH 3D (SOUNDSCAPE 6-CHANNEL SPATIAL MIXER)
===================================================================== */
const faderRain = ref(30)
const faderStream = ref(40)
const faderBowl = ref(70)
const faderWindchime = ref(45)
const faderFish = ref(20)
const faderChant = ref(15)

function applySoundscapePreset(kind: string) {
  if (kind === 'rain') { faderRain.value = 85; faderStream.value = 20; faderBowl.value = 30; faderWindchime.value = 60; faderFish.value = 10; faderChant.value = 0 }
  else if (kind === 'bamboo') { faderRain.value = 10; faderStream.value = 90; faderBowl.value = 50; faderWindchime.value = 75; faderFish.value = 40; faderChant.value = 0 }
  else if (kind === 'chant') { faderRain.value = 0; faderStream.value = 10; faderBowl.value = 80; faderWindchime.value = 20; faderFish.value = 60; faderChant.value = 85 }
  else { faderRain.value = 15; faderStream.value = 30; faderBowl.value = 90; faderWindchime.value = 40; faderFish.value = 15; faderChant.value = 10 }
  zenAudio.playSingingBowl()
}

/* =====================================================================
   7. PHÁP ĐÀM & ĐỒNG TU ONLINE (SANGHA CHAT)
===================================================================== */
const MANTRAS = [
  'Nam Mô A Di Đà Phật',
  'Thân tâm an lạc, vạn sự cát tường',
  'Nguyện cầu quốc thái dân an',
  'Mỗi bước chân nở một đóa sen vàng',
  'Thở vào tâm tĩnh lặng, thở ra miệng mỉm cười',
  'Tâm bình thế giới bình'
]

function sendMantraMessage(text: string) {
  emit('sendMantra', text)
  zenAudio.playWoodenFish()
}
</script>

<template>
  <aside
    v-if="modelValue"
    class="vercel-anim-right absolute top-14 md:top-16 right-4 bottom-4 z-40 flex w-[440px] lg:w-[460px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[12px] border border-[#2b3139] bg-[#181a20]/98 backdrop-blur-2xl shadow-2xl max-md:fixed max-md:top-auto max-md:right-0 max-md:bottom-0 max-md:left-0 max-md:z-50 max-md:max-h-[82dvh] max-md:w-full max-md:max-w-none max-md:rounded-b-none max-md:rounded-t-[20px] select-none"
  >
    <!-- 1. HEADER -->
    <div class="shrink-0 z-20 flex flex-col border-b border-[#2b3139] bg-[#1e2329]/95 px-4 pt-3.5 pb-2.5">
      <div class="hidden w-full items-center justify-center pb-2 max-md:flex cursor-grab">
        <div class="h-1 w-10 rounded-full bg-white/20" />
      </div>

      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="mono-eyebrow text-[#FCD535] text-[10px] tracking-wider font-bold">{{ currentMeta.badge }}</div>
          <h2 class="text-sm font-bold tracking-tight text-white mt-0.5 truncate flex items-center gap-2 font-display">
            <ZenIcon :name="currentMeta.icon" :size="15" class="text-[#FCD535]" />
            <span>{{ currentMeta.name }}</span>
          </h2>
          <p class="truncate text-[11px] text-[#929aa5] mt-0.5">{{ currentMeta.subtitle }}</p>
        </div>

        <div class="flex shrink-0 items-center gap-1.5">
          <!-- Balance Pill + Quick TopUp -->
          <button
            type="button"
            class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] border border-[#2b3139] bg-[#0b0e11]/60 hover:border-[#FCD535]/50 px-2.5 py-1 font-mono text-[11px] font-bold text-[#FCD535] transition cursor-pointer"
            title="Số dư MC trên server (bấm để nạp thêm MC)"
            @click="economy.openTopUpModal()"
          >
            <ZenIcon name="coin" :size="12" class="text-[#FCD535]" />
            <span class="tabular-nums">{{ economy.meritCoins.toLocaleString() }} MC</span>
            <span class="px-1 py-px rounded bg-[#FCD535]/20 text-[9px] text-[#FCD535]">+Nạp</span>
          </button>

          <!-- Close Button -->
          <button
            type="button"
            class="w-7 h-7 rounded-[6px] border border-[#2b3139] bg-[#1e2329] hover:bg-[#2b3139] flex items-center justify-center text-[#929aa5] hover:text-white transition cursor-pointer"
            aria-label="Close"
            @click="closeDrawer"
          >
            <ZenIcon name="close" :size="13" />
          </button>
        </div>
      </div>

      <!-- Binance Tab Pills: Fixed 2-Row Matrix -->
      <div class="mt-2.5 grid grid-cols-4 gap-1 select-none">
        <button
          type="button"
          @click="currentTab = 'fortune'"
          class="col-span-2 h-7 px-2 rounded-[4px] border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
          :class="currentTab === 'fortune' ? 'border-[#FCD535] bg-[#FCD535]/15 text-[#FCD535] font-bold shadow-sm' : 'border-[#2b3139] bg-[#0b0e11]/60 text-[#929aa5] hover:text-white hover:bg-[#2b3139]'"
        >
          <ZenIcon name="sparkles" :size="12" class="text-[#FCD535]" />
          <span>Bói Quẻ 6 Môn</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'shop'"
          class="h-7 px-1.5 rounded-[4px] border text-[10.5px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer truncate"
          :class="currentTab === 'shop' ? 'border-pink-400 bg-pink-500/15 text-pink-300 font-bold shadow-sm' : 'border-[#2b3139] bg-[#0b0e11]/60 text-[#929aa5] hover:text-white hover:bg-[#2b3139]'"
        >
          <ZenIcon name="lotus" :size="11" class="text-pink-300 shrink-0" />
          <span class="truncate">Cửa Hàng</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'merit'"
          class="h-7 px-1.5 rounded-[4px] border text-[10.5px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer truncate"
          :class="currentTab === 'merit' ? 'border-[#FCD535] bg-[#FCD535]/15 text-[#FCD535] font-bold shadow-sm' : 'border-[#2b3139] bg-[#0b0e11]/60 text-[#929aa5] hover:text-white hover:bg-[#2b3139]'"
        >
          <ZenIcon name="coin" :size="11" class="text-[#FCD535] shrink-0" />
          <span class="truncate">Công Đức</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'cards'"
          class="h-7 px-1.5 rounded-[4px] border text-[10.5px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer truncate"
          :class="currentTab === 'cards' ? 'border-[#3b82f6] bg-[#3b82f6]/15 text-[#3b82f6] font-bold shadow-sm' : 'border-[#2b3139] bg-[#0b0e11]/60 text-[#929aa5] hover:text-white hover:bg-[#2b3139]'"
        >
          <ZenIcon name="cards" :size="11" class="text-[#3b82f6] shrink-0" />
          <span class="truncate">Thẻ Di Sản</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'meditation'"
          class="h-7 px-1.5 rounded-[4px] border text-[10.5px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer truncate"
          :class="currentTab === 'meditation' ? 'border-[#0ecb81] bg-[#0ecb81]/15 text-[#0ecb81] font-bold shadow-sm' : 'border-[#2b3139] bg-[#0b0e11]/60 text-[#929aa5] hover:text-white hover:bg-[#2b3139]'"
        >
          <ZenIcon name="meditation" :size="11" class="text-[#0ecb81] shrink-0" />
          <span class="truncate">Hội Thiền</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'soundscape'"
          class="h-7 px-1.5 rounded-[4px] border text-[10.5px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer truncate"
          :class="currentTab === 'soundscape' ? 'border-[#FCD535] bg-[#FCD535]/15 text-[#FCD535] font-bold shadow-sm' : 'border-[#2b3139] bg-[#0b0e11]/60 text-[#929aa5] hover:text-white hover:bg-[#2b3139]'"
        >
          <ZenIcon name="bell" :size="11" class="text-[#FCD535] shrink-0" />
          <span class="truncate">Âm Thanh</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'sangha'"
          class="h-7 px-1.5 rounded-[4px] border text-[10.5px] font-semibold flex items-center justify-center gap-1 transition cursor-pointer truncate"
          :class="currentTab === 'sangha' ? 'border-[#3b82f6] bg-[#3b82f6]/15 text-[#3b82f6] font-bold shadow-sm' : 'border-[#2b3139] bg-[#0b0e11]/60 text-[#929aa5] hover:text-white hover:bg-[#2b3139]'"
        >
          <ZenIcon name="message" :size="11" class="text-[#3b82f6] shrink-0" />
          <span class="truncate">Đồng Tu</span>
        </button>
      </div>
    </div>

    <!-- HỘP XÁC NHẬN TRƯỚC KHI TIÊU MC (DÙNG CHUNG CHO MỌI DỊCH VỤ) -->
    <div
      v-if="pendingConfirm"
      class="shrink-0 mx-4 mt-3 p-3 rounded-[8px] border border-[#FCD535]/60 bg-[#1e2329] shadow-xl flex flex-col gap-2 z-30"
    >
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="text-[10px] font-mono text-[#FCD535] uppercase font-bold">Xác Nhận Tiêu MC Coin</div>
          <div class="text-xs font-bold text-white mt-0.5">{{ pendingConfirm.title }}</div>
        </div>
        <span class="px-2 py-0.5 rounded bg-[#FCD535]/20 text-[#FCD535] font-mono text-xs font-bold">
          -{{ pendingConfirm.costMc.toLocaleString() }} MC
        </span>
      </div>
      <div class="text-[11px] text-[#929aa5] flex items-center justify-between font-mono">
        <span>Số dư sau khi tiêu:</span>
        <span class="text-white font-bold">{{ Math.max(0, economy.meritCoins - pendingConfirm.costMc).toLocaleString() }} MC</span>
      </div>
      <div class="flex items-center gap-2 pt-1">
        <button
          type="button"
          :disabled="economy.isSpending"
          @click="executeConfirmedSpend"
          class="bn-btn-primary flex-1 py-1.5 rounded-[6px] text-xs font-bold justify-center cursor-pointer disabled:opacity-50"
        >
          {{ economy.isSpending ? 'Đang xử lý...' : `Xác nhận (-${pendingConfirm.costMc.toLocaleString()} MC)` }}
        </button>
        <button
          type="button"
          :disabled="economy.isSpending"
          @click="cancelConfirmSpend"
          class="bn-btn-secondary px-3 py-1.5 rounded-[6px] text-xs font-semibold cursor-pointer"
        >
          Hủy
        </button>
      </div>
    </div>

    <!-- 2. SCROLLABLE CONTENT BODY -->
    <div class="gy-scroll flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-[#eaecef]">
      <!-- ==================== TAB 1: BÓI QUẺ 6 MÔN ==================== -->
      <div v-if="currentTab === 'fortune'" class="flex flex-col gap-3.5">
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="c in FORTUNE_CATEGORIES"
            :key="c.id"
            type="button"
            @click="fortuneCategory = c.id; fortuneResult = null; pendingConfirm = null"
            class="flex flex-col items-center justify-center p-2.5 rounded-[6px] border text-center transition-all cursor-pointer"
            :class="fortuneCategory === c.id ? 'border-[#FCD535] bg-[#FCD535]/15 text-[#FCD535] font-bold shadow-md' : 'border-[#2b3139] bg-[#1e2329]/60 text-[#929aa5] hover:text-white hover:bg-[#2b3139]'"
          >
            <ZenIcon :name="c.icon as any" :size="15" class="mb-1" />
            <span class="text-[11px] leading-tight">{{ c.name }}</span>
          </button>
        </div>

        <!-- Tier & MC Pricing Box (Server-configured) -->
        <div class="rounded-[8px] border border-[#2b3139] bg-[#1e2329] p-3 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white font-display">Cấp Bậc Chiêm Nghiệm (MC)</span>
            <span class="text-[10px] font-mono text-[#707a8a]">Sinh kết quả tại Server</span>
          </div>

          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="tierKey in (['basic', 'auspicious', 'golden'] as const)"
              :key="tierKey"
              type="button"
              @click="selectedTier = tierKey; pendingConfirm = null"
              class="p-2.5 rounded-[6px] border text-left transition cursor-pointer"
              :class="selectedTier === tierKey ? 'border-[#FCD535] bg-[#FCD535]/15 text-[#FCD535] font-semibold' : 'border-[#2b3139] bg-[#0b0e11]/40 text-[#929aa5] hover:border-[#474d57]'"
            >
              <div class="text-[9px] uppercase font-mono text-[#707a8a]">{{ economy.fortuneTiers[tierKey]?.badge }}</div>
              <div class="text-xs font-bold font-mono mt-0.5 text-white">{{ economy.fortuneTiers[tierKey]?.costMc }} MC</div>
            </button>
          </div>
        </div>

        <!-- Primary Action Button + Nạp MC fallback when insufficient -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            :disabled="isRolling || !canAffordFortune"
            @click="requestRollFortune"
            class="bn-btn-primary flex-1 py-2.5 rounded-[6px] text-xs font-bold tracking-tight justify-center shadow-lg cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <ZenIcon name="sparkles" :size="13" class="text-[#181a20]" />
            <span>{{ isRolling ? 'Đang Lắc Ống Xăm Trầm...' : `Gieo Quẻ Chiêm Bái (${currentFortuneCostMc} MC)` }}</span>
          </button>

          <button
            v-if="!canAffordFortune"
            type="button"
            @click="economy.openTopUpModal()"
            class="px-3 py-2.5 rounded-[6px] border border-[#FCD535] bg-[#FCD535]/15 hover:bg-[#FCD535]/25 text-[#FCD535] font-mono text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            + Nạp MC
          </button>
        </div>

        <p v-if="!wallet.isConnected" class="text-[11px] text-[#929aa5] text-center">
          Chưa kết nối ví Eternl. Bấm <button type="button" class="text-[#FCD535] underline font-semibold cursor-pointer" @click="economy.openTopUpModal()">Kết nối / Nạp MC</button> để gieo quẻ.
        </p>
        <p v-else-if="economy.meritCoins < currentFortuneCostMc" class="text-[11px] text-[#FCD535] text-center">
          Số dư hiện tại ({{ economy.meritCoins.toLocaleString() }} MC) chưa đủ {{ currentFortuneCostMc }} MC. Bấm <strong>+ Nạp MC</strong> để nạp thêm.
        </p>

        <p v-if="fortuneNotice" class="text-xs text-[#f6465d] text-center font-mono">{{ fortuneNotice }}</p>

        <!-- Fortune Result Presentation -->
        <div v-if="fortuneResult" class="rounded-[8px] border border-[#2b3139] bg-[#1e2329] p-4 shadow-xl flex flex-col gap-3">
          <div class="flex items-center justify-between border-b border-[#2b3139] pb-2.5">
            <div>
              <div class="text-xs text-[#FCD535] font-bold tracking-tight">{{ fortuneResult.title }}</div>
              <div class="text-[10px] text-[#0ecb81] font-mono uppercase mt-0.5 font-semibold">{{ fortuneResult.score }}</div>
            </div>
            <span class="px-2 py-0.5 rounded-[3px] border border-[#f6465d]/40 bg-[#f6465d]/10 text-[#f6465d] font-mono text-[9px] font-bold tracking-widest uppercase">
              {{ fortuneResult.sealText }}
            </span>
          </div>

          <div class="p-3 rounded-[6px] bg-[#0b0e11] border border-[#2b3139] font-sans text-xs leading-relaxed text-[#eaecef] whitespace-pre-line text-center">
            {{ fortuneResult.poem }}
          </div>

          <div class="grid grid-cols-2 gap-2 text-[11px]">
            <div class="p-2.5 rounded-[6px] bg-[#0b0e11]/60 border border-[#2b3139]">
              <div class="flex items-center gap-1.5 text-[#FCD535] font-bold">
                <ZenIcon name="coin" :size="12" />
                <span>Tiền Tài</span>
              </div>
              <p class="text-[#929aa5] text-[10.5px] mt-1 leading-snug">{{ fortuneResult.wealth }}</p>
            </div>
            <div class="p-2.5 rounded-[6px] bg-[#0b0e11]/60 border border-[#2b3139]">
              <div class="flex items-center gap-1.5 text-pink-300 font-bold">
                <ZenIcon name="lotus" :size="12" />
                <span>Duyên Tình</span>
              </div>
              <p class="text-[#929aa5] text-[10.5px] mt-1 leading-snug">{{ fortuneResult.love }}</p>
            </div>
            <div class="p-2.5 rounded-[6px] bg-[#0b0e11]/60 border border-[#2b3139]">
              <div class="flex items-center gap-1.5 text-[#0ecb81] font-bold">
                <ZenIcon name="meditation" :size="12" />
                <span>Sức Khỏe</span>
              </div>
              <p class="text-[#929aa5] text-[10.5px] mt-1 leading-snug">{{ fortuneResult.health }}</p>
            </div>
            <div class="p-2.5 rounded-[6px] bg-[#0b0e11]/60 border border-[#2b3139]">
              <div class="flex items-center gap-1.5 text-[#3b82f6] font-bold">
                <ZenIcon name="cards" :size="12" />
                <span>Sự Nghiệp</span>
              </div>
              <p class="text-[#929aa5] text-[10.5px] mt-1 leading-snug">{{ fortuneResult.career }}</p>
            </div>
          </div>

          <div class="p-3 rounded-[6px] bg-[#0b0e11]/40 border border-[#2b3139] text-xs text-[#eaecef] leading-relaxed">
            <span class="text-[#FCD535] font-semibold">Lời khuyên chánh niệm:</span> {{ fortuneResult.advice }}
          </div>

          <div class="flex items-center justify-between text-[10px] font-mono text-[#707a8a] pt-2 border-t border-[#2b3139]">
            <span>MÃ BIÊN NHẬN SERVER:</span>
            <span class="text-[#0ecb81] font-semibold">{{ fortuneResult.receiptHash }}</span>
          </div>
        </div>

        <!-- Lịch sử quẻ đã gieo trên server -->
        <div v-if="economy.fortuneHistory.length > 0" class="rounded-[8px] border border-[#2b3139] bg-[#1e2329]/70 p-3">
          <button
            type="button"
            class="w-full flex items-center justify-between text-xs font-bold text-[#eaecef] cursor-pointer"
            @click="showFortuneHistory = !showFortuneHistory"
          >
            <span>Lịch Sử Quẻ Đã Gieo ({{ economy.fortuneHistory.length }})</span>
            <span class="text-[10px] font-mono text-[#FCD535]">{{ showFortuneHistory ? 'Thu gọn ▴' : 'Xem ▾' }}</span>
          </button>
          <div v-if="showFortuneHistory" class="mt-2.5 space-y-1.5 max-h-44 overflow-y-auto pr-1">
            <div
              v-for="h in economy.fortuneHistory.slice(0, 10)"
              :key="h.requestId"
              class="p-2 rounded bg-[#0b0e11]/70 border border-[#2b3139] flex items-center justify-between gap-2 text-[11px] cursor-pointer hover:border-[#FCD535]/40"
              @click="fortuneResult = { ...h.fortune, wealth: h.fortune.aspects?.wealth, career: h.fortune.aspects?.career, love: h.fortune.aspects?.love, health: h.fortune.aspects?.health, advice: h.fortune.mindfulAdvice, receiptHash: h.receiptHash }"
            >
              <div class="min-w-0">
                <div class="text-white font-semibold truncate">{{ h.fortune?.title }}</div>
                <div class="text-[10px] text-[#707a8a] font-mono">{{ h.fortune?.score }} · {{ h.receiptHash }}</div>
              </div>
              <span class="font-mono text-[10px] text-[#FCD535] shrink-0">-{{ h.costMc }} MC</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== TAB 2: CỬA HÀNG PHÁP BẢO & CỔ PHỤC ==================== -->
      <div v-else-if="currentTab === 'shop'" class="flex flex-col gap-3">
        <div class="flex gap-1.5 p-1 rounded-[8px] bg-[#0b0e11] border border-[#2b3139]">
          <button
            type="button"
            @click="shopTab = 'attire'; pendingConfirm = null"
            class="flex-1 py-1.5 rounded-[6px] text-xs font-semibold transition cursor-pointer text-center"
            :class="shopTab === 'attire' ? 'bg-[#FCD535] text-[#181a20] shadow-sm' : 'text-[#929aa5] hover:text-white'"
          >Cổ Phục 9 Quốc Gia</button>
          <button
            type="button"
            @click="shopTab = 'offerings'; pendingConfirm = null"
            class="flex-1 py-1.5 rounded-[6px] text-xs font-semibold transition cursor-pointer text-center"
            :class="shopTab === 'offerings' ? 'bg-[#FCD535] text-[#181a20] shadow-sm' : 'text-[#929aa5] hover:text-white'"
          >Lễ Vật &amp; Nhang Trầm</button>
        </div>

        <p v-if="shopSuccess" class="p-2 rounded-[6px] bg-[#0ecb81]/10 border border-[#0ecb81]/30 text-xs text-[#0ecb81] text-center font-mono">
          {{ shopSuccess }}
        </p>
        <p v-if="shopNotice" class="p-2 rounded-[6px] bg-[#f6465d]/10 border border-[#f6465d]/30 text-xs text-[#f6465d] text-center font-mono">
          {{ shopNotice }}
        </p>

        <!-- Attire List -->
        <div v-if="shopTab === 'attire'" class="flex flex-col gap-2">
          <div
            v-for="item in attireItems"
            :key="item.id"
            class="p-3 rounded-[8px] border border-[#2b3139] bg-[#1e2329] flex items-center justify-between gap-3 hover:border-[#474d57] transition"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-[9px] px-1.5 py-0.5 rounded-[3px] bg-black/60 text-[#FCD535] font-bold border border-white/5">{{ item.countryCode }}</span>
                <span class="text-xs font-bold text-white truncate">{{ item.name }}</span>
                <span
                  v-if="economy.isUnlocked(item.id)"
                  class="font-mono text-[9px] px-1.5 py-0.2 rounded bg-[#0ecb81]/15 text-[#0ecb81] border border-[#0ecb81]/30 font-bold"
                >ĐÃ SỞ HỮU</span>
              </div>
              <p class="text-[11px] text-[#929aa5] truncate mt-0.5">{{ item.subname }}</p>
              <div class="text-[10px] font-mono text-[#FCD535] mt-1 font-semibold">
                {{ item.priceMc === 0 ? 'MẶC ĐỊNH SƠ TÂM (0 MC)' : `Giá: ${item.priceMc.toLocaleString()} MC` }}
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                @click="tryOnOutfit(item.id)"
                class="bn-btn-secondary px-2.5 py-1 text-[11px] font-medium cursor-pointer"
              >
                {{ economy.isUnlocked(item.id) ? 'Mặc ngay' : 'Mặc thử' }}
              </button>
              <template v-if="!economy.isUnlocked(item.id)">
                <button
                  type="button"
                  :disabled="!wallet.isConnected || economy.meritCoins < item.priceMc"
                  @click="requestBuyItem(item)"
                  class="bn-btn-primary px-2.5 py-1 text-[11px] font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  Thỉnh ({{ item.priceMc.toLocaleString() }} MC)
                </button>
                <button
                  v-if="!wallet.isConnected || economy.meritCoins < item.priceMc"
                  type="button"
                  @click="economy.openTopUpModal()"
                  class="px-2 py-1 rounded-[4px] border border-[#FCD535]/60 bg-[#FCD535]/15 text-[#FCD535] font-mono text-[10px] font-bold cursor-pointer"
                >
                  Nạp MC
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- Offerings List -->
        <div v-else class="flex flex-col gap-2">
          <div
            v-for="off in offeringItems"
            :key="off.id"
            class="p-3 rounded-[8px] border border-[#2b3139] bg-[#1e2329] flex items-center justify-between gap-3"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-white">{{ off.name }}</span>
                <span
                  v-if="economy.getItemQuantity(off.id) > 0"
                  class="font-mono text-[9px] px-1.5 py-0.2 rounded bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 font-bold"
                >Đang có: {{ economy.getItemQuantity(off.id) }}</span>
              </div>
              <p class="text-[11px] text-[#929aa5] mt-0.5">{{ off.subname }}</p>
              <div class="text-[10px] font-mono text-[#FCD535] mt-1 font-semibold">Giá: {{ off.priceMc.toLocaleString() }} MC</div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                :disabled="!wallet.isConnected || economy.meritCoins < off.priceMc"
                @click="requestBuyItem(off)"
                class="bn-btn-primary px-3 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Dâng Lễ ({{ off.priceMc }} MC)
              </button>
              <button
                v-if="!wallet.isConnected || economy.meritCoins < off.priceMc"
                type="button"
                @click="economy.openTopUpModal()"
                class="px-2 py-1.5 rounded-[4px] border border-[#FCD535]/60 bg-[#FCD535]/15 text-[#FCD535] font-mono text-[10px] font-bold cursor-pointer"
              >
                Nạp MC
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== TAB 3: HÒM CÔNG ĐỨC ==================== -->
      <div v-else-if="currentTab === 'merit'" class="flex flex-col gap-3.5">
        <div class="p-3.5 rounded-[8px] border border-[#2b3139] bg-[#1e2329] text-center">
          <ZenIcon name="coin" :size="24" class="text-[#FCD535] mx-auto mb-1.5" />
          <h3 class="text-sm font-bold text-white font-display">Phát Tâm Cúng Dường Tam Bảo</h3>
          <p class="text-[11px] text-[#929aa5] mt-1 leading-relaxed">
            Hòm công đức là hoàn toàn tự nguyện. Mọi đóng góp bằng MC được ghi vào sổ cái &amp; bảng vàng công đức. Cúng dường từ <strong>500 MC</strong> được tặng lễ phẩm tri ân <strong>Hoa Đăng Cầu An</strong>.
          </p>
          <div class="mt-2 pt-2 border-t border-[#2b3139] flex items-center justify-between text-[11px] font-mono">
            <span class="text-[#707a8a]">TỔNG CÔNG ĐỨC TOÀN CHÙA:</span>
            <span class="text-[#FCD535] font-bold">{{ economy.globalMeritTotal.toLocaleString() }} MC</span>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-xs font-semibold text-[#eaecef]">Chọn Mức Công Đức Gợi Ý (MC):</span>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="amt in economy.meritConfig.suggestedAmountsMc"
              :key="amt"
              type="button"
              @click="selectMeritPreset(amt)"
              class="py-2 rounded-[6px] border font-mono text-xs font-bold transition cursor-pointer"
              :class="meritAmount === amt ? 'border-[#FCD535] bg-[#FCD535]/20 text-[#FCD535]' : 'border-[#2b3139] bg-[#0b0e11]/50 text-[#929aa5] hover:border-[#474d57]'"
            >
              {{ amt.toLocaleString() }} MC
            </button>
          </div>
        </div>

        <!-- Custom MC Input & Prayer -->
        <div class="grid grid-cols-1 gap-2.5">
          <div>
            <label class="text-[11px] text-[#929aa5] font-semibold block mb-1">Số MC tùy chọn (nguyên, tối thiểu {{ economy.meritConfig.minMc }} MC):</label>
            <input
              v-model="customMeritInput"
              type="number"
              min="10"
              step="10"
              @input="onCustomMeritInput"
              class="w-full rounded-[6px] border border-[#2b3139] bg-[#0b0e11] px-3 py-1.5 text-xs font-mono text-white focus:border-[#FCD535] focus:outline-none"
            />
          </div>
          <div>
            <label class="text-[11px] text-[#929aa5] font-semibold block mb-1">Lời nguyện cầu / Hồi hướng:</label>
            <input
              v-model="meritPrayer"
              type="text"
              maxlength="240"
              class="w-full rounded-[6px] border border-[#2b3139] bg-[#0b0e11] px-3 py-1.5 text-xs text-white focus:border-[#FCD535] focus:outline-none"
              placeholder="Nhập lời cầu nguyện hồi hướng..."
            />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            :disabled="!canAffordMerit"
            @click="requestDonateMerit"
            class="bn-btn-primary flex-1 py-2.5 rounded-[6px] font-bold text-xs justify-center shadow-lg cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <ZenIcon name="coin" :size="13" class="text-[#181a20]" />
            <span>Hồi Hướng Công Đức ({{ meritAmount.toLocaleString() }} MC)</span>
          </button>

          <button
            v-if="!canAffordMerit"
            type="button"
            @click="economy.openTopUpModal()"
            class="px-3 py-2.5 rounded-[6px] border border-[#FCD535] bg-[#FCD535]/15 hover:bg-[#FCD535]/25 text-[#FCD535] font-mono text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            + Nạp MC
          </button>
        </div>

        <p v-if="meritError" class="p-2 rounded-[6px] bg-[#f6465d]/10 border border-[#f6465d]/30 text-xs text-[#f6465d] text-center font-mono">
          {{ meritError }}
        </p>

        <div v-if="meritBlessing" class="p-3 rounded-[6px] bg-[#0ecb81]/10 border border-[#0ecb81]/30 text-xs text-[#0ecb81] space-y-1.5">
          <p class="text-center leading-relaxed italic font-medium">{{ meritBlessing }}</p>
          <div v-if="lastMeritReceipt" class="pt-1.5 border-t border-[#0ecb81]/20 flex items-center justify-between font-mono text-[10px]">
            <span>Biên nhận: {{ lastMeritReceipt.receiptHash }}</span>
            <span v-if="lastMeritReceipt.rewardItemName" class="text-[#FCD535] font-bold">🎁 Tặng: {{ lastMeritReceipt.rewardItemName }}</span>
          </div>
        </div>

        <!-- Bảng Vàng Công Đức -->
        <div v-if="economy.leaderboard.length > 0" class="rounded-[8px] border border-[#2b3139] bg-[#1e2329]/80 p-3 space-y-2">
          <div class="text-xs font-bold text-[#FCD535] flex items-center justify-between">
            <span>Bảng Vàng Công Đức</span>
            <span class="text-[10px] font-mono text-[#707a8a]">{{ economy.globalDonationCount }} lượt cúng dường</span>
          </div>
          <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            <div
              v-for="(entry, idx) in economy.leaderboard"
              :key="entry.address"
              class="px-2.5 py-1.5 rounded bg-[#0b0e11]/70 border border-[#2b3139] flex items-center justify-between text-xs"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-mono text-[10px] font-bold text-[#FCD535]">#{{ idx + 1 }}</span>
                <span class="font-semibold text-white truncate">{{ entry.displayName }}</span>
              </div>
              <span class="font-mono text-xs font-bold text-[#0ecb81] shrink-0">{{ entry.totalMc.toLocaleString() }} MC</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== TAB 4: THẺ BÀI DI SẢN ==================== -->
      <div v-else-if="currentTab === 'cards'" class="flex flex-col gap-3">
        <div class="text-xs text-[#929aa5]">Bộ sưu tập Thẻ bài Cổ Tự Di Sản &amp; Triết lý Á Đông (Khai quang vĩnh viễn bằng MC):</div>

        <p v-if="cardSuccess" class="p-2 rounded-[6px] bg-[#0ecb81]/10 border border-[#0ecb81]/30 text-xs text-[#0ecb81] text-center font-mono">
          {{ cardSuccess }}
        </p>
        <p v-if="cardNotice" class="p-2 rounded-[6px] bg-[#f6465d]/10 border border-[#f6465d]/30 text-xs text-[#f6465d] text-center font-mono">
          {{ cardNotice }}
        </p>

        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="c in cards.allCards"
            :key="c.id"
            class="p-2.5 rounded-[8px] border border-[#2b3139] bg-[#1e2329] flex flex-col gap-1.5 hover:border-[#474d57] transition"
          >
            <div class="flex items-center justify-between">
              <span
                :class="c.rarity === 'legendary' ? 'text-[#FCD535] bg-[#FCD535]/15 border-[#FCD535]/30' : c.rarity === 'epic' ? 'text-purple-300 bg-purple-500/15 border-purple-500/30' : 'text-[#3b82f6] bg-[#3b82f6]/15 border-[#3b82f6]/30'"
                class="text-[9px] font-mono px-1.5 py-0.2 rounded-[3px] font-bold border uppercase"
              >{{ c.rarity }}</span>
              <span class="text-[10px] font-mono text-[#707a8a]">{{ c.country }}</span>
            </div>
            <div class="text-xs font-bold text-white truncate">{{ c.title }}</div>
            <p class="text-[10px] text-[#929aa5] line-clamp-2 leading-snug">{{ c.meaning }}</p>

            <div v-if="economy.isUnlocked(c.id)" class="mt-auto pt-1 flex items-center justify-between">
              <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0ecb81]/15 text-[#0ecb81] font-bold">ĐÃ KHAI QUANG</span>
              <button
                type="button"
                @click="zenAudio.playSingingBowl()"
                class="bn-btn-secondary px-2 py-1 text-[10px] font-medium cursor-pointer"
              >
                Nghe Audio
              </button>
            </div>
            <div v-else class="mt-auto pt-1 flex items-center gap-1">
              <button
                type="button"
                :disabled="!wallet.isConnected || economy.meritCoins < getCardPriceMc(c.id)"
                @click="requestUnlockCard(c)"
                class="bn-btn-primary flex-1 py-1 text-[10px] font-bold justify-center cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Khai Quang ({{ getCardPriceMc(c.id).toLocaleString() }} MC)
              </button>
              <button
                v-if="!wallet.isConnected || economy.meritCoins < getCardPriceMc(c.id)"
                type="button"
                @click="economy.openTopUpModal()"
                class="px-1.5 py-1 rounded border border-[#FCD535]/60 bg-[#FCD535]/15 text-[#FCD535] font-mono text-[9px] font-bold cursor-pointer"
              >
                Nạp
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== TAB 5: HỘI THIỀN 432HZ ==================== -->
      <div v-else-if="currentTab === 'meditation'" class="flex flex-col items-center gap-4 py-2">
        <div class="text-center">
          <h3 class="text-sm font-bold text-white font-display">Thiền Định Chánh Niệm 432Hz</h3>
          <p class="text-xs text-[#929aa5] mt-0.5">Vòng điều hòa hơi thở Mandala 4-4-6</p>
        </div>

        <div class="relative w-36 h-36 rounded-full border border-[#0ecb81]/40 flex flex-col items-center justify-center bg-[#0ecb81]/5 shadow-[0_0_30px_rgba(14,203,129,0.15)]">
          <div class="text-[10px] font-mono tracking-widest text-[#0ecb81] uppercase font-bold">{{ breathePhase }}</div>
          <div class="text-2xl font-bold font-mono text-white mt-1 tabular-nums">{{ breatheSeconds }}s</div>
        </div>

        <div class="flex items-center gap-2">
          <button
            v-for="m in [3, 5, 15, 30]"
            :key="m"
            type="button"
            @click="meditationMinutes = m"
            class="px-3 py-1 rounded-[6px] border font-mono text-xs font-semibold transition cursor-pointer"
            :class="meditationMinutes === m ? 'border-[#0ecb81] bg-[#0ecb81]/20 text-[#0ecb81]' : 'border-[#2b3139] bg-[#0b0e11] text-[#929aa5]'"
          >
            {{ m }} Phút
          </button>
        </div>

        <button
          type="button"
          @click="toggleMeditationSession"
          class="bn-btn-primary w-full py-2.5 rounded-[6px] font-bold text-xs justify-center shadow-lg cursor-pointer"
        >
          <ZenIcon name="meditation" :size="13" class="text-[#181a20]" />
          <span>{{ isMeditating ? 'Kết Thúc Khóa Thiền' : 'Bắt Đầu Tọa Thiền' }}</span>
        </button>
      </div>

      <!-- ==================== TAB 6: ÂM THANH 3D ==================== -->
      <div v-else-if="currentTab === 'soundscape'" class="flex flex-col gap-3.5">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-white">Presets Mẫu:</span>
          <div class="flex gap-1">
            <button @click="applySoundscapePreset('rain')" class="bn-tab-pill text-[10px] py-0.5 px-2.5">Mưa Đêm</button>
            <button @click="applySoundscapePreset('bamboo')" class="bn-tab-pill text-[10px] py-0.5 px-2.5">Trúc Lâm</button>
            <button @click="applySoundscapePreset('chant')" class="bn-tab-pill text-[10px] py-0.5 px-2.5">Tụng Kinh</button>
            <button @click="applySoundscapePreset('bowl')" class="bn-tab-pill text-[10px] py-0.5 px-2.5">Chuông 432Hz</button>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-[#eaecef]">
              <ZenIcon name="sunset" :size="13" class="text-[#FCD535]" />
              <span>Mưa Rào Mái Ngói</span>
            </div>
            <input type="range" v-model="faderRain" min="0" max="100" class="w-36 accent-[#FCD535]" />
          </div>
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-[#eaecef]">
              <ZenIcon name="lotus" :size="13" class="text-pink-300" />
              <span>Suối Reo &amp; Gáo Trúc</span>
            </div>
            <input type="range" v-model="faderStream" min="0" max="100" class="w-36 accent-[#FCD535]" />
          </div>
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-[#eaecef]">
              <ZenIcon name="bell" :size="13" class="text-[#FCD535]" />
              <span>Chuông Xoay 432Hz</span>
            </div>
            <input type="range" v-model="faderBowl" min="0" max="100" class="w-36 accent-[#FCD535]" />
          </div>
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-[#eaecef]">
              <ZenIcon name="sparkles" :size="13" class="text-[#FCD535]" />
              <span>Phong Linh Gió Thoảng</span>
            </div>
            <input type="range" v-model="faderWindchime" min="0" max="100" class="w-36 accent-[#FCD535]" />
          </div>
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-[#eaecef]">
              <ZenIcon name="pagoda" :size="13" class="text-[#FCD535]" />
              <span>Mõ Gỗ Định Tâm</span>
            </div>
            <input type="range" v-model="faderFish" min="0" max="100" class="w-36 accent-[#FCD535]" />
          </div>
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-[#eaecef]">
              <ZenIcon name="cards" :size="13" class="text-[#3b82f6]" />
              <span>Tụng Niệm Phạn / Pali</span>
            </div>
            <input type="range" v-model="faderChant" min="0" max="100" class="w-36 accent-[#FCD535]" />
          </div>
        </div>
      </div>

      <!-- ==================== TAB 7: PHÁP ĐÀM & ĐỒNG TU ==================== -->
      <div v-else-if="currentTab === 'sangha'" class="flex flex-col gap-3">
        <div>
          <span class="text-xs font-semibold text-[#eaecef]">Lời Nguyện Chánh Niệm:</span>
          <div class="flex flex-wrap gap-1.5 mt-2">
            <button
              v-for="m in MANTRAS"
              :key="m"
              type="button"
              @click="sendMantraMessage(m)"
              class="px-2.5 py-1.5 rounded-[6px] border border-[#2b3139] bg-[#1e2329] text-[11px] text-[#eaecef] hover:border-[#FCD535] hover:text-[#FCD535] transition text-left cursor-pointer"
            >
              {{ m }}
            </button>
          </div>
        </div>

        <div class="border-t border-[#2b3139] pt-2">
          <span class="text-xs font-semibold text-[#eaecef]">Đồng Tu Đang Hiện Diện ({{ onlineCount || 1 }}):</span>
          <div class="flex flex-col gap-1.5 mt-2">
            <div class="p-2.5 rounded-[6px] bg-[#1e2329] border border-[#2b3139] flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-[#0ecb81]"></span>
                <span class="font-bold text-white">{{ user.name }} (Bạn)</span>
                <span class="text-[10px] text-[#FCD535] font-mono">/ {{ user.title }}</span>
              </div>
              <span class="text-[10px] text-[#707a8a] font-mono">Sân Chánh Điện</span>
            </div>

            <div
              v-for="p in remotePilgrims"
              :key="p.id"
              class="p-2.5 rounded-[6px] bg-[#1e2329] border border-[#2b3139] flex items-center justify-between text-xs"
            >
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-[#0ecb81] animate-pulse"></span>
                <span class="font-bold text-white">{{ p.name }}</span>
                <span class="text-[10px] text-[#707a8a] font-mono">({{ p.country }})</span>
              </div>
              <button
                type="button"
                @click="$emit('greetPilgrim', p.id)"
                class="bn-btn-secondary px-2 py-0.5 text-[10px] text-[#FCD535] border-[#FCD535]/30 hover:bg-[#FCD535]/10"
              >
                Chào
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Chân trang cảnh báo thân thiện -->
      <div class="mt-auto pt-2 border-t border-[#2b3139]/60 text-[10px] text-[#707a8a] leading-snug text-center">
        MC là điểm trong game (off-chain), không phải tiền mã hóa và không đổi ngược ra ADA. Hòm công đức là tự nguyện.
      </div>
    </div>
  </aside>
</template>
