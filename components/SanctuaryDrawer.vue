<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { zenAudio } from '~/lib/audio/ZenAudio'
import {
  getPresetQuestions,
  getTopicLabel,
  matchTopicFromQuestion,
  resolveMonId
} from '~/lib/boi/ContentRepository'
import { generateFortune } from '~/lib/boi/FortuneEngine'
import {
  appendLocalFortuneHistory,
  applyFortuneDailyEffect,
  getRemainingFreeDraws,
  loadActiveDailyEffect,
  loadLocalFortuneHistory,
  markDailyFreeUsed,
  resolveActiveDebuff,
  type ActiveDailyFortuneState,
  type FortuneHistoryItem
} from '~/lib/boi/GameplayService'
import {
  BIRTH_HOUR_OPTIONS,
  clearSavedProfile,
  deletePartnerContact,
  loadPartnerContacts,
  loadSavedProfile,
  previewProfileMetaphysics,
  savePartnerContact,
  saveProfile,
  validatePersonProfile,
  type ProfileValidationResult
} from '~/lib/boi/ProfileService'
import { renderFortuneShareCardPng } from '~/lib/boi/ShareCardRenderer'
import type { GenderType, InputMode, MucQue, PersonProfile, SavedFortuneProfile } from '~/lib/boi/types'
import { createClientRequestId, useEconomyStore } from '~/stores/economy'
import { useUserStore, type CountryId } from '~/stores/user'
import { useWalletStore } from '~/stores/wallet'
import { useCardsStore } from '~/stores/cards'
import { useMeditationStore } from '~/stores/meditation'
import UiButton from '~/components/ui/UiButton.vue'
import UiCard from '~/components/ui/UiCard.vue'
import UiSelectableCard from '~/components/ui/UiSelectableCard.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiInput from '~/components/ui/UiInput.vue'
import ZenIcon from '~/components/ZenIcon.vue'
import HauDongPanel from '~/components/HauDongPanel.vue'
import { useHauDongStore } from '~/stores/hauDong'

export type DrawerTab =
  | 'fortune'
  | 'shop'
  | 'merit'
  | 'hau_dong'
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
  isNearFortune?: boolean
  isNearMerit?: boolean
  isInsideHauDong?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:activeTab', tab: DrawerTab): void
  (e: 'outfitChanged', countryId: CountryId): void
  (e: 'genderChanged', gender: 'female' | 'male'): void
  (e: 'greetPilgrim', id: string): void
  (e: 'sendMantra', text: string): void
  (e: 'guideToFortune'): void
  (e: 'guideToMerit'): void
  (e: 'guideToHauDong'): void
  (e: 'triggerBow'): void
}>()

const economy = useEconomyStore()
const user = useUserStore()
const wallet = useWalletStore()
const cards = useCardsStore()
const hauDong = useHauDongStore()

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
    if (currentTab.value === 'meditation') {
      void meditation.refreshStatus()
      void economy.loadMeditationStatus().catch(() => undefined)
    } else if (currentTab.value === 'hau_dong') {
      void hauDong.refreshStatus()
    }
  }
})

watch(currentTab, (tab) => {
  if (tab === 'meditation') {
    void meditation.refreshStatus()
    void economy.loadMeditationStatus().catch(() => undefined)
  } else if (tab === 'merit') {
    void economy.loadCatalog()
  } else if (tab === 'hau_dong') {
    void hauDong.refreshStatus()
  }
})

onMounted(() => {
  void economy.loadCatalog()
})

const TAB_NAV: Array<{ id: DrawerTab; label: string; name: string; badge: string; subtitle: string }> = [
  { id: 'fortune', label: 'Bói Quẻ', name: 'Bói Quẻ 6 Môn Cầu An', badge: 'Chiêm bốc tâm linh', subtitle: 'Gieo quẻ 6 môn, luận giải theo chủ đề và hướng dẫn chánh niệm' },
  { id: 'hau_dong', label: 'Hầu Đồng', name: 'Điện Thờ Tứ Phủ & Trần Triều', badge: 'Di sản UNESCO', subtitle: 'Nghi lễ Hầu Đồng 5 Giá (8 phút/buổi), Thỉnh Lộc MC và Mở Đàn Đặc Cách' },
  { id: 'shop', label: 'Cửa Hàng', name: 'Cửa Hàng Pháp Bảo & Cổ Phục', badge: 'Pháp bảo & Cổ phục', subtitle: 'Trang phục hành hương 9 quốc gia, nhang trầm và lễ phẩm cúng dường' },
  { id: 'merit', label: 'Công Đức', name: 'Hòm Công Đức Tam Bảo', badge: 'Phước đức tâm an', subtitle: 'Cúng dường tự nguyện bằng MC và lưu danh Bảng vàng công đức' },
  { id: 'cards', label: 'Thẻ Bài', name: 'Thẻ Bài Di Sản Cổ Tự', badge: 'Triết lý & Kiến trúc', subtitle: 'Bộ sưu tập cổ tự 3D, thuyết minh âm thanh và khai quang bằng MC' },
  { id: 'meditation', label: 'Thiền', name: 'Hội Thiền Định Tâm 432Hz', badge: 'Chánh niệm định tâm', subtitle: 'Chuông xoay 432Hz và vòng điều hòa hơi thở 4-4-6' },
  { id: 'soundscape', label: 'Âm Cảnh', name: 'Bộ Trộn Âm Cảnh Không Gian', badge: 'Âm cảnh thiền tự', subtitle: 'Tùy chỉnh 6 kênh âm thanh thiên nhiên và pháp khí thời gian thực' },
  { id: 'sangha', label: 'Đồng Tu', name: 'Pháp Đàm & Đồng Tu Hiện Diện', badge: 'Cộng đồng đồng tu', subtitle: 'Gửi lời nguyện chánh niệm và kết nối cùng hành giả đang trực tuyến' }
]

const currentMeta = computed(() => {
  return TAB_NAV.find(t => t.id === currentTab.value) || TAB_NAV[0]!
})

function closeDrawer() {
  pendingConfirm.value = null
  emit('update:modelValue', false)
}

/* =====================================================================
   XÁC NHẬN TRƯỚC KHI TIÊU MC
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
const fortuneMode = ref<InputMode>('quick')
const selectedQuestionId = ref<string>('xx_q1')
const customQuestionText = ref<string>('')
const isRolling = ref(false)
const fortuneResult = ref<any | null>(null)
const fortuneNotice = ref<string | null>(null)
const showFortuneHistory = ref(false)

// Hồ sơ Bát Tự cá nhân
const savedProfile = ref<SavedFortuneProfile | null>(null)
const isEditingProfile = ref<boolean>(false)
const profileStatusMsg = ref<string | null>(null)

// Thanh toán và lượt chiêm bái
const fortunePaymentMode = ref<'free_daily' | 'offering_item' | 'mc'>('free_daily')
const selectedOfferingItemId = ref<string>('incense_quang')
const activeDailyEffect = ref<ActiveDailyFortuneState | null>(null)
const localFortuneHistory = ref<FortuneHistoryItem[]>([])
const shareCardDataUrl = ref<string | null>(null)
const hideBirthDateInShare = ref(false)
const shareCardTitle = ref<string>('')
const shareCopyStatus = ref<string | null>(null)
const remediationNotice = ref<string | null>(null)

const profileForm = ref<PersonProfile>({
  fullName: '',
  birthDate: '',
  birthHour: '',
  gender: '' as any
})

const partnerForm = ref<PersonProfile>({
  fullName: '',
  birthDate: '',
  birthHour: '',
  gender: '' as any
})

const profileFieldErrors = ref<ProfileValidationResult['fieldErrors']>({})
const partnerFieldErrors = ref<ProfileValidationResult['fieldErrors']>({})
const partnerContacts = ref<PersonProfile[]>([])

const profilePreview = computed(() => {
  if (!profileForm.value.fullName?.trim() || !profileForm.value.birthDate?.trim() || !profileForm.value.gender) {
    return null
  }
  const check = validatePersonProfile(profileForm.value)
  if (!check.valid || !check.sanitized) return null
  return previewProfileMetaphysics(check.sanitized)
})

const partnerPreview = computed(() => {
  if (!partnerForm.value.fullName?.trim() || !partnerForm.value.birthDate?.trim() || !partnerForm.value.gender) {
    return null
  }
  const check = validatePersonProfile(partnerForm.value)
  if (!check.valid || !check.sanitized) return null
  return previewProfileMetaphysics(check.sanitized)
})

function syncProfileFormsFromSaved(sp: SavedFortuneProfile | null) {
  if (sp) {
    profileForm.value = {
      fullName: sp.fullName,
      birthDate: sp.birthDate,
      birthHour: sp.birthHour || '',
      gender: sp.gender
    }
    if (sp.partner) {
      partnerForm.value = {
        fullName: sp.partner.fullName,
        birthDate: sp.partner.birthDate,
        birthHour: sp.partner.birthHour || '',
        gender: sp.partner.gender
      }
    }
    isEditingProfile.value = false
  } else {
    isEditingProfile.value = true
  }
}

onMounted(() => {
  const sp = loadSavedProfile()
  savedProfile.value = sp
  syncProfileFormsFromSaved(sp)
  partnerContacts.value = loadPartnerContacts()
  activeDailyEffect.value = loadActiveDailyEffect()
  localFortuneHistory.value = loadLocalFortuneHistory()
})

function handleSaveProfile() {
  profileStatusMsg.value = null
  fortuneNotice.value = null
  profileFieldErrors.value = {}

  const check = validatePersonProfile(profileForm.value)
  if (!check.valid || !check.sanitized) {
    profileFieldErrors.value = check.fieldErrors
    fortuneNotice.value = check.error || 'Vui lòng kiểm tra lại thông tin hồ sơ.'
    return
  }

  let partnerToSave: PersonProfile | null = null
  if (fortuneCategory.value === 'love' && partnerForm.value.fullName.trim()) {
    const pCheck = validatePersonProfile(partnerForm.value)
    if (!pCheck.valid || !pCheck.sanitized) {
      partnerFieldErrors.value = pCheck.fieldErrors
      fortuneNotice.value = `Hồ sơ người thương: ${pCheck.error}`
      return
    }
    partnerToSave = pCheck.sanitized
    partnerContacts.value = savePartnerContact(pCheck.sanitized)
  }

  const saved = saveProfile(check.sanitized, partnerToSave)
  savedProfile.value = saved
  isEditingProfile.value = false
  profileStatusMsg.value = 'Hồ sơ Bát Tự đã xác nhận thành công! Đã mở khóa các môn thỉnh quẻ.'
  zenAudio.playTempleBell()
}

function handleDeleteProfile() {
  clearSavedProfile()
  savedProfile.value = null
  profileForm.value = { fullName: '', birthDate: '', birthHour: '', gender: '' as any }
  partnerForm.value = { fullName: '', birthDate: '', birthHour: '', gender: '' as any }
  profileFieldErrors.value = {}
  partnerFieldErrors.value = {}
  isEditingProfile.value = true
  fortuneResult.value = null
  profileStatusMsg.value = 'Đã xóa toàn bộ hồ sơ cá nhân.'
}

function handleSelectPartnerFromContact(contact: PersonProfile) {
  partnerForm.value = {
    fullName: contact.fullName,
    birthDate: contact.birthDate,
    birthHour: contact.birthHour || '',
    gender: contact.gender
  }
  partnerFieldErrors.value = {}
}

function handleDeletePartnerFromContact(fullName: string, birthDate: string) {
  partnerContacts.value = deletePartnerContact(fullName, birthDate)
}

const currentPresetQuestions = computed(() => {
  return getPresetQuestions(fortuneCategory.value)
})

watch(fortuneCategory, (cat) => {
  const list = getPresetQuestions(cat)
  if (list.length > 0) {
    selectedQuestionId.value = list[0]!.id
  }
})

watch(() => props.initialFortuneCategory, (cat) => {
  if (cat) {
    fortuneCategory.value = cat
    fortuneResult.value = null
    pendingConfirm.value = null
  }
})

const detectedCustomTopicLabel = computed(() => {
  const mon = resolveMonId(fortuneCategory.value)
  const tag = matchTopicFromQuestion(customQuestionText.value, mon)
  return getTopicLabel(tag)
})

const FORTUNE_CATEGORIES: Array<{ id: DivinationType; name: string; short: string }> = [
  { id: 'stick', name: 'Xin Xăm Bát Quái', short: 'Bổn mạng & Sự nghiệp' },
  { id: 'love', name: 'Tơ Duyên Tương Ngộ', short: 'Nguyệt Lão chỉ hồng' },
  { id: 'family', name: 'Cầu Tự Con Cái', short: 'Quan Âm Tống Tử' },
  { id: 'wealth', name: 'Chiêu Tài Tấn Bảo', short: 'Kinh doanh phát đạt' },
  { id: 'health', name: 'Dược Sư An Khang', short: 'Tiêu tai trừ bệnh' },
  { id: 'star', name: 'Dâng Sao Giải Hạn', short: 'Bắc Đẩu Thất Tinh' }
]

const INPUT_MODES: ReadonlyArray<{ id: InputMode; code: string; label: string; desc: string }> = [
  { id: 'quick', code: 'A', label: 'Xin Nhanh', desc: 'Rút quẻ tức thì theo Bát Tự đã xác nhận' },
  { id: 'preset', code: 'B', label: 'Chọn Câu Hỏi', desc: 'Danh sách câu hỏi chiêm bốc theo từng môn' },
  { id: 'custom', code: 'D', label: 'Câu Hỏi Tự Do', desc: 'Nhập câu hỏi để dò từ khóa quy về chủ đề' }
]

const selectedFortuneCategoryObj = computed(() => {
  return FORTUNE_CATEGORIES.find(c => c.id === fortuneCategory.value) || FORTUNE_CATEGORIES[0]!
})

const selectedFortuneModeObj = computed(() => {
  return INPUT_MODES.find(m => m.id === fortuneMode.value) || INPUT_MODES[0]!
})

function getMucBadgeStyle(muc?: MucQue | string): string {
  switch (muc) {
    case 'dai_cat':
    case 'cat':
      return 'border-[var(--trading-up,#0ecb81)] bg-[rgba(14,203,129,0.15)] text-[var(--trading-up,#0ecb81)]'
    case 'binh':
      return 'border-[var(--hairline-on-dark,#2b3139)] bg-[var(--surface-elevated-dark,#2b3139)] text-[var(--text-secondary,#929aa5)]'
    case 'hung':
    case 'dai_hung':
      return 'border-[var(--trading-down,#f6465d)] bg-[rgba(246,70,93,0.15)] text-[var(--trading-down,#f6465d)]'
    default:
      return 'border-[var(--primary,#fcd535)] bg-[rgba(252,213,53,0.15)] text-[var(--primary,#fcd535)]'
  }
}

function getMucIconName(muc?: MucQue | string): string {
  switch (muc) {
    case 'dai_cat':
    case 'cat':
      return 'circle-check'
    case 'binh':
      return 'info'
    case 'hung':
      return 'triangle-alert'
    case 'dai_hung':
      return 'circle-alert'
    default:
      return 'circle-check'
  }
}

// Gộp lại thành 1 giá: 50 MC (theo chỉ đạo của user)
const currentFortuneCostMc = computed(() => 50)

const freeDrawsTrigger = ref(0)

const remainingFreeDrawsForCurrentSubject = computed(() => {
  void freeDrawsTrigger.value
  const localRem = getRemainingFreeDraws(fortuneCategory.value)
  if (wallet.isConnected) {
    const serverUsed = Number(economy.dailyFreeUsedByCategory?.[fortuneCategory.value] || 0)
    const serverRem = Math.max(0, 1 - serverUsed)
    return Math.min(localRem, serverRem)
  }
  return localRem
})

const offeringItems = computed(() => {
  if (economy.offeringCatalog.length > 0) return economy.offeringCatalog
  return [
    { id: 'incense_quang', name: 'Trầm Hương Xứ Quảng', priceMc: 50 },
    { id: 'lotus_lantern', name: 'Hoa Đăng Cầu An', priceMc: 60 },
    { id: 'incense_japan', name: 'Đàn Hương Kyoto', priceMc: 80 },
    { id: 'oan_cake', name: 'Bánh Oản Hoàng Cung', priceMc: 100 },
    { id: 'fruit_basket', name: 'Mâm Ngũ Quả Cúng Dường', priceMc: 120 }
  ]
})

const ownedOfferingItems = computed(() => {
  return offeringItems.value.filter(i => economy.getItemQuantity(i.id) > 0)
})

watch(fortuneCategory, () => {
  if (remainingFreeDrawsForCurrentSubject.value > 0) {
    fortunePaymentMode.value = 'free_daily'
  } else if (ownedOfferingItems.value.length > 0) {
    fortunePaymentMode.value = 'offering_item'
    selectedOfferingItemId.value = ownedOfferingItems.value[0]!.id
  } else {
    fortunePaymentMode.value = 'mc'
  }
})

const canAffordFortune = computed(() => {
  if (fortunePaymentMode.value === 'free_daily') {
    return remainingFreeDrawsForCurrentSubject.value > 0
  }
  if (fortunePaymentMode.value === 'offering_item') {
    return wallet.isConnected && economy.getItemQuantity(selectedOfferingItemId.value) > 0
  }
  return wallet.isConnected && economy.meritCoins >= currentFortuneCostMc.value
})

const mergedFortuneHistory = computed(() => {
  const seen = new Set<string>()
  const out: Array<Record<string, any>> = []
  for (const h of economy.fortuneHistory) {
    const key = String(h.requestId || h.id || Math.random())
    if (!seen.has(key)) {
      seen.add(key)
      out.push(h)
    }
  }
  for (const lh of localFortuneHistory.value) {
    const key = String(lh.requestId || lh.id)
    if (!seen.has(key)) {
      seen.add(key)
      out.push(lh)
    }
  }
  return out.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 30)
})

function finalizeFortuneDisplay(rawFortune: any, receiptHash: string, spentMc: number, paymentMode: 'free_daily' | 'offering_item' | 'mc', offeringItemId?: string | null) {
  const enriched = {
    ...rawFortune,
    wealth: rawFortune.aspects?.wealth || rawFortune.wealth,
    career: rawFortune.aspects?.career || rawFortune.career,
    love: rawFortune.aspects?.love || rawFortune.love,
    health: rawFortune.aspects?.health || rawFortune.health,
    advice: rawFortune.mindfulAdvice || rawFortune.advice,
    receiptHash,
    spentMc,
    paymentMode,
    offeringItemId: offeringItemId || null
  }
  fortuneResult.value = enriched
  remediationNotice.value = null
  const updatedEffect = applyFortuneDailyEffect(enriched)
  if (updatedEffect) {
    activeDailyEffect.value = updatedEffect
  }
  localFortuneHistory.value = appendLocalFortuneHistory({
    id: `f_${Date.now()}`,
    requestId: `req_${receiptHash}`,
    category: fortuneCategory.value,
    tier: selectedTier.value,
    costMc: spentMc,
    paymentMode,
    offeringItemId: offeringItemId || null,
    receiptHash,
    createdAt: Date.now(),
    fortune: enriched
  })
}

async function executeDirectFortuneRoll(payload: {
  category: DivinationType
  tier: DivinationTier
  mode: InputMode
  questionId: string
  customQuestion: string
  profile: PersonProfile | null
  partnerProfile: PersonProfile | null
  paymentMode: 'free_daily' | 'offering_item'
  offeringItemId?: string
}) {
  fortuneNotice.value = null
  pendingConfirm.value = null
  isRolling.value = true

  try {
    zenAudio.playFortuneShaking()

    if (payload.paymentMode === 'free_daily' && !wallet.isConnected) {
      const recentBlockIds = mergedFortuneHistory.value
        .slice(0, 3)
        .flatMap((h: any) => h.fortune?.selectedBlockIds || [])
      const generated = generateFortune({
        category: payload.category,
        mode: payload.mode,
        questionId: payload.questionId,
        customQuestion: payload.customQuestion,
        profile: payload.profile,
        partnerProfile: payload.partnerProfile,
        recentBlockIds
      })

      markDailyFreeUsed(payload.category)
      freeDrawsTrigger.value++

      setTimeout(() => {
        finalizeFortuneDisplay(generated, `local_${Date.now().toString(36)}`, 0, 'free_daily', null)
        isRolling.value = false
        zenAudio.playTempleBell()
      }, 550)
      return
    }

    const res = await economy.drawFortune(payload.category, payload.tier, createClientRequestId('fortune'), {
      mode: payload.mode,
      questionId: payload.questionId,
      customQuestion: payload.customQuestion,
      profile: payload.profile,
      partnerProfile: payload.partnerProfile,
      paymentMode: payload.paymentMode,
      offeringItemId: payload.offeringItemId
    })

    if (payload.paymentMode === 'free_daily') {
      markDailyFreeUsed(payload.category)
      freeDrawsTrigger.value++
    }

    setTimeout(() => {
      finalizeFortuneDisplay(res.fortune, res.receiptHash, res.spentMc, payload.paymentMode, payload.offeringItemId || null)
      isRolling.value = false
      zenAudio.playTempleBell()
    }, 550)
  } catch (e: any) {
    isRolling.value = false
    fortuneNotice.value = e?.data?.statusMessage || e?.data?.message || e?.message || 'Không thể gieo quẻ lúc này.'
  }
}

function requestRollFortune() {
  fortuneNotice.value = null

  if (props.isNearFortune === false) {
    fortuneNotice.value = 'Đạo hữu cần bước lại gần Bàn Xin Xăm & Pháp Bảo ngoài sân Chùa để thành tâm thỉnh quẻ.'
    emit('guideToFortune')
    return
  }

  if (!savedProfile.value || isEditingProfile.value) {
    fortuneNotice.value = 'Vui lòng hoàn tất xác nhận hồ sơ Bát Tự trước khi thỉnh quẻ.'
    isEditingProfile.value = true
    return
  }

  const activeProfile = savedProfile.value
  let activePartner: PersonProfile | null = null

  if (fortuneCategory.value === 'love') {
    if (!partnerForm.value.fullName?.trim() || !partnerForm.value.birthDate?.trim() || !partnerForm.value.gender) {
      fortuneNotice.value = 'Môn Tơ Duyên yêu cầu nhập đầy đủ thông tin Người thương (Họ tên, Ngày sinh, Giới tính).'
      return
    }
    const pCheck = validatePersonProfile(partnerForm.value)
    if (!pCheck.valid || !pCheck.sanitized) {
      partnerFieldErrors.value = pCheck.fieldErrors
      fortuneNotice.value = `Hồ sơ người thương: ${pCheck.error}`
      return
    }
    activePartner = pCheck.sanitized
    partnerContacts.value = savePartnerContact(pCheck.sanitized)
  }

  if (fortuneMode.value === 'custom' && customQuestionText.value.trim().length < 3) {
    fortuneNotice.value = 'Vui lòng nhập câu hỏi của bạn (tối thiểu 3 ký tự) hoặc chuyển sang chế độ Xin Nhanh.'
    return
  }

  if (fortunePaymentMode.value === 'free_daily') {
    if (remainingFreeDrawsForCurrentSubject.value <= 0) {
      fortuneNotice.value = 'Bạn đã dùng hết 1 lượt miễn phí hôm nay cho môn này. Hãy chọn Lễ Phẩm hoặc MC Coin!'
      return
    }
    void executeDirectFortuneRoll({
      category: fortuneCategory.value,
      tier: selectedTier.value,
      mode: fortuneMode.value,
      questionId: selectedQuestionId.value,
      customQuestion: customQuestionText.value.trim(),
      profile: activeProfile,
      partnerProfile: activePartner,
      paymentMode: 'free_daily'
    })
    return
  }

  if (fortunePaymentMode.value === 'offering_item') {
    if (!wallet.isConnected) {
      fortuneNotice.value = 'Vui lòng kết nối ví Eternl để sử dụng lễ phẩm trong túi đồ!'
      return
    }
    if (economy.getItemQuantity(selectedOfferingItemId.value) <= 0) {
      fortuneNotice.value = 'Bạn chưa có lễ phẩm này trong túi đồ. Hãy thỉnh tại Cửa Hàng hoặc chọn dùng MC!'
      return
    }
    void executeDirectFortuneRoll({
      category: fortuneCategory.value,
      tier: selectedTier.value,
      mode: fortuneMode.value,
      questionId: selectedQuestionId.value,
      customQuestion: customQuestionText.value.trim(),
      profile: activeProfile,
      partnerProfile: activePartner,
      paymentMode: 'offering_item',
      offeringItemId: selectedOfferingItemId.value
    })
    return
  }

  const catObj = FORTUNE_CATEGORIES.find(c => c.id === fortuneCategory.value)
  askConfirmSpend(
    'fortune',
    `Gieo quẻ ${catObj?.name || fortuneCategory.value} (Thêm lượt hôm nay)`,
    currentFortuneCostMc.value,
    {
      category: fortuneCategory.value,
      tier: 'auspicious',
      mode: fortuneMode.value,
      questionId: selectedQuestionId.value,
      customQuestion: customQuestionText.value.trim(),
      profile: activeProfile,
      partnerProfile: activePartner
    }
  )
}

async function performConfirmedFortune(c: PendingSpendConfirm) {
  fortuneNotice.value = null
  pendingConfirm.value = null
  isRolling.value = true

  try {
    zenAudio.playFortuneShaking()
    const res = await economy.drawFortune(c.payload.category, c.payload.tier, c.requestId, {
      mode: c.payload.mode,
      questionId: c.payload.questionId,
      customQuestion: c.payload.customQuestion,
      profile: c.payload.profile,
      partnerProfile: c.payload.partnerProfile,
      paymentMode: 'mc'
    })
    setTimeout(() => {
      finalizeFortuneDisplay(res.fortune, res.receiptHash, res.spentMc, 'mc', null)
      isRolling.value = false
      zenAudio.playTempleBell()
    }, 550)
  } catch (e: any) {
    isRolling.value = false
    fortuneNotice.value = e?.data?.statusMessage || e?.data?.message || e?.message || 'Không thể gieo quẻ lúc này.'
  }
}

async function openShareCardModal(fortune: any) {
  try {
    shareCardTitle.value = fortune.title || 'Quẻ Cát Tường'
    shareCopyStatus.value = null
    shareCardDataUrl.value = await renderFortuneShareCardPng(fortune, {
      userName: user.name,
      appName: 'Vạn Cảnh Thiền Tự',
      receiptHash: fortune.receiptHash,
      hideExactBirthDate: hideBirthDateInShare.value,
      profile: savedProfile.value,
      partnerProfile: partnerForm.value?.fullName ? partnerForm.value : undefined
    })
  } catch (e: any) {
    fortuneNotice.value = 'Không thể xuất ảnh chia sẻ: ' + (e?.message || 'Lỗi canvas')
  }
}

watch(hideBirthDateInShare, async () => {
  if (fortuneResult.value && shareCardDataUrl.value) {
    await openShareCardModal(fortuneResult.value)
  }
})

function downloadShareCardPng() {
  if (!shareCardDataUrl.value) return
  const a = document.createElement('a')
  a.href = shareCardDataUrl.value
  a.download = `VanCanhThienTu_${shareCardTitle.value.replace(/\s+/g, '_')}_${Date.now()}.png`
  a.click()
}

async function copyShareCardImage() {
  if (!shareCardDataUrl.value) return
  try {
    const res = await fetch(shareCardDataUrl.value)
    const blob = await res.blob()
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ])
    shareCopyStatus.value = 'Đã sao chép ảnh vào bộ nhớ tạm (Clipboard)!'
  } catch {
    shareCopyStatus.value = 'Trình duyệt không hỗ trợ sao chép ảnh. Hãy bấm "Tải ảnh về máy"!'
  }
}

function handleCompleteRemediationQuest() {
  const updated = resolveActiveDebuff()
  if (updated) {
    activeDailyEffect.value = updated
    remediationNotice.value = 'Đã hoàn thành pháp hóa giải! Tâm trí bạn đã lấy lại sự cân bằng và an lạc.'
    zenAudio.playTempleBell()
  }
}

/* =====================================================================
   2. CỬA HÀNG PHÁP BẢO
===================================================================== */
const shopTab = ref<'attire' | 'offerings'>('attire')
const shopNotice = ref<string | null>(null)
const shopSuccess = ref<string | null>(null)

const attireItems = computed(() => {
  if (economy.attireCatalog.length > 0) return economy.attireCatalog
  return [
    { id: 'vietnam', name: 'Áo Lam Cổ Phục & Nón Lá', subname: 'Áo Tấc lụa lam Hà Đông dệt viền chỉ vàng kim', category: 'attire', countryCode: 'VN', countryId: 'vietnam', priceMc: 0, consumable: false, defaultUnlocked: true },
    { id: 'japan', name: 'Samue Thiền Tăng & Nón Kasa', subname: 'Đen chàm Zen tối giản đan nón rơm Kasa', category: 'attire', countryCode: 'JP', countryId: 'japan', priceMc: 500, consumable: false, defaultUnlocked: true },
    { id: 'western', name: 'Pháp Phục Nâu Làng Mai', subname: 'Vải thô mộc mạc từng bước chân an lạc', category: 'attire', countryCode: 'LM', countryId: 'western', priceMc: 600, consumable: false, defaultUnlocked: false },
    { id: 'thailand', name: 'Y Cà Sa Theravada', subname: 'Saffron vàng nghệ hoàng gia Thái Lan', category: 'attire', countryCode: 'TH', countryId: 'thailand', priceMc: 800, consumable: false, defaultUnlocked: false },
    { id: 'korea', name: 'Hanbok Durumagi & Mũ Gat', subname: 'Xám khói thanh tịnh thiền phái Tào Khê', category: 'attire', countryCode: 'KR', countryId: 'korea', priceMc: 1000, consumable: false, defaultUnlocked: false },
    { id: 'taiwan', name: 'Áo Tràng Lam Cổ Tự', subname: 'Đại Phật nhân gian thêu hoa sen ngọc', category: 'attire', countryCode: 'TW', countryId: 'taiwan', priceMc: 1200, consumable: false, defaultUnlocked: false },
    { id: 'singapore', name: 'Pháp Phục Lụa Singapore', subname: 'Giao thoa thanh lịch thời Đường hiện đại', category: 'attire', countryCode: 'SG', countryId: 'singapore', priceMc: 1500, consumable: false, defaultUnlocked: false },
    { id: 'india', name: 'Khăn Quàng Dhoti Bồ Đề', subname: 'Y đỏ phù sa đất Phật Tứ Động Tâm', category: 'attire', countryCode: 'IN', countryId: 'india', priceMc: 1800, consumable: false, defaultUnlocked: false },
    { id: 'tibet', name: 'Áo Chuba & Mũ Pandita', subname: 'Vải dạ viền gấm Tây Tạng tuyết sơn', category: 'attire', countryCode: 'TB', countryId: 'tibet', priceMc: 2500, consumable: false, defaultUnlocked: false }
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
    shopSuccess.value = `Đã thỉnh thành công "${res.item.name}" (-${res.spentMc.toLocaleString()} MC)!`
  } catch (e: any) {
    pendingConfirm.value = null
    shopNotice.value = e?.data?.statusMessage || e?.message || 'Không thể mua vật phẩm.'
  }
}

/* =====================================================================
   3. HÒM CÔNG ĐỨC
==================================================================== */
const meritAmount = ref<number>(100)
const customMeritInput = ref<string>('100')
const meritPrayer = ref<string>('Nguyện cầu gia đạo bình an, thân tâm thường lạc')
const meritBlessing = ref<string | null>(null)
const meritError = ref<string | null>(null)

function selectMeritPreset(amt: number) {
  meritAmount.value = amt
  customMeritInput.value = String(amt)
}

function onCustomMeritInput() {
  const n = Math.floor(Number(customMeritInput.value))
  meritAmount.value = Number.isFinite(n) && n > 0 ? n : 0
}

function requestDonateMerit() {
  meritBlessing.value = null
  meritError.value = null

  if (props.isNearMerit === false) {
    meritError.value = 'Đạo hữu cần bước lại gần Hòm Công Đức Tam Bảo ngoài sân Chùa để phát tâm cúng dường.'
    emit('guideToMerit')
    return
  }

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
  } catch (e: any) {
    pendingConfirm.value = null
    meritError.value = e?.data?.statusMessage || e?.message || 'Không thể thực hiện công đức.'
  }
}

const top10Donors = computed(() => {
  return (economy.leaderboard || []).slice(0, 10)
})

function formatDonorName(entry: { displayName?: string; address?: string }): string {
  if (entry.displayName && entry.displayName.trim()) return entry.displayName
  if (entry.address) {
    if (entry.address.length <= 16) return entry.address
    return `${entry.address.slice(0, 8)}...${entry.address.slice(-6)}`
  }
  return 'Ẩn danh đồng tu'
}

/* =====================================================================
   4. THẺ BÀI DI SẢN 3D
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
    cardSuccess.value = `Đã khai quang "${res.item.name}" (-${res.spentMc.toLocaleString()} MC)!`
  } catch (e: any) {
    pendingConfirm.value = null
    cardNotice.value = e?.data?.statusMessage || e?.message || 'Không thể mở khóa thẻ di sản.'
  }
}

/* =====================================================================
   5. HỘI THIỀN 432HZ
===================================================================== */
const meditation = useMeditationStore()

const breathingPhase = computed(() => {
  if (!meditation.isSeated) return null
  const elapsed = Math.max(0, meditation.totalSec - meditation.remainingSec)
  const cycle = elapsed % 14
  if (cycle < 4) {
    return { name: 'Hít Vào', count: 4 - cycle, hint: 'Hít sâu chánh niệm' }
  } else if (cycle < 8) {
    return { name: 'Giữ Hơi', count: 8 - cycle, hint: 'Định tâm tĩnh lặng' }
  } else {
    return { name: 'Thở Ra', count: 14 - cycle, hint: 'Thả lỏng buông thư' }
  }
})

function handleStartMeditation() {
  void meditation.begin()
}

function handleStopEarly() {
  void meditation.stopEarly()
}

/* =====================================================================
   6. BỘ TRỘN ÂM THANH
===================================================================== */
const faderRain = ref(30)
const faderStream = ref(40)
const faderBowl = ref(70)

/* =====================================================================
   7. PHÁP ĐÀM & ĐỒNG TU
===================================================================== */
const MANTRAS = [
  'Nam Mô A Di Đà Phật',
  'Thân tâm an lạc, vạn sự cát tường',
  'Nguyện cầu quốc thái dân an',
  'Mỗi bước chân nở một đóa sen vàng',
  'Thở vào tâm tĩnh lặng, thở ra miệng mỉm cười'
]

const customChatText = ref('')

function sendCustomChatMessage() {
  const text = customChatText.value.trim()
  if (!text) return
  emit('sendMantra', text)
  zenAudio.playWoodenFish()
  customChatText.value = ''
}

function sendMantraMessage(text: string) {
  emit('sendMantra', text)
  zenAudio.playWoodenFish()
}
</script>

<template>
  <div v-if="modelValue" class="sanctuary-modal-backdrop" @click.self="closeDrawer">
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="currentMeta.name"
      class="sanctuary-modal"
    >
      <!-- 1. HEADER (Right Drawer Top) -->
      <header class="sanctuary-header">
        <!-- Top Bar: Status Badge (Left) & MC Chip + Close (Right) -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 shrink-0">
            <UiBadge variant="neutral" class="font-numbers text-xs leading-none">CIP-30 VERIFIED</UiBadge>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <!-- MC Balance Pill -->
            <button
              type="button"
              class="sanctuary-mc-chip ui-focus-ring"
              title="Số dư Merit Coin trong game (Bấm để nạp)"
              @click="economy.openTopUpModal()"
            >
              <ZenIcon name="coin" :size="13" class="text-gold shrink-0" />
              <span class="font-numbers text-xs font-bold text-gold">{{ economy.meritCoins.toLocaleString() }} MC</span>
              <span class="text-xs font-semibold px-1.5 py-0.5 rounded bg-surface-elevated text-white border border-hairline">
                + Nạp
              </span>
            </button>

            <!-- Close Button (Whitelisted Lucide X) -->
            <button
              type="button"
              class="sanctuary-close-btn ui-focus-ring"
              aria-label="Đóng cửa sổ"
              @click="closeDrawer"
            >
              <ZenIcon name="x" :size="18" />
            </button>
          </div>
        </div>

        <!-- Title Block (Full Width: Eyebrow, Name, Subtitle) -->
        <div class="mt-2">
          <div class="text-xs font-bold uppercase tracking-wider text-secondary">
            {{ currentMeta.badge }}
          </div>
          <h2 class="text-base sm:text-lg font-bold text-white leading-snug mt-0.5">
            {{ currentMeta.name }}
          </h2>
          <p class="text-xs text-secondary mt-0.5 leading-normal">
            {{ currentMeta.subtitle }}
          </p>
        </div>

        <!-- Level-1 Navigation: Single-Row Scrollable Tabs (2px Gold Underline) -->
        <div class="mt-2.5">
          <UiTabs
            v-model="currentTab"
            :items="TAB_NAV"
            layout="horizontal"
            aria-label="Điều hướng phân hệ thiền tự"
          />
        </div>
      </header>

      <!-- HỘP XÁC NHẬN TRƯỚC KHI TIÊU MC -->
      <div
        v-if="pendingConfirm"
        class="shrink-0 mx-5 mt-4 p-4 rounded-lg border-2 border-primary bg-surface-elevated shadow-xl flex flex-col gap-3 z-30"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-secondary">Xác nhận tiêu MC Coin</div>
            <div class="text-sm font-bold text-white mt-0.5">{{ pendingConfirm.title }}</div>
          </div>
          <UiBadge variant="warning">
            <span class="font-numbers">-{{ pendingConfirm.costMc.toLocaleString() }} MC</span>
          </UiBadge>
        </div>
        <div class="text-xs text-secondary flex items-center justify-between">
          <span>Số dư còn lại sau khi xác nhận:</span>
          <span class="font-numbers text-white font-bold">{{ Math.max(0, economy.meritCoins - pendingConfirm.costMc).toLocaleString() }} MC</span>
        </div>
        <div class="flex items-center gap-2.5 pt-1">
          <UiButton
            variant="primary"
            size="md"
            block
            :loading="economy.isSpending"
            @click="executeConfirmedSpend"
          >
            {{ economy.isSpending ? 'Đang xử lý...' : `Xác nhận (-${pendingConfirm.costMc.toLocaleString()} MC)` }}
          </UiButton>
          <UiButton
            variant="secondary"
            size="md"
            :disabled="economy.isSpending"
            @click="cancelConfirmSpend"
          >
            Hủy
          </UiButton>
        </div>
      </div>

      <!-- 2. SCROLLABLE CONTENT BODY (Binance 8/4 Layout) -->
      <div class="sanctuary-body">
        <!-- ==================== TAB 1: BÓI QUẺ 6 MÔN (8/4 GRID) ==================== -->
        <div v-if="currentTab === 'fortune'" class="space-y-5">
          <!-- Cảnh Báo Vị Trí: Cần Đến Bàn Xem Quẻ -->
          <div
            v-if="props.isNearFortune === false"
            class="p-3.5 rounded-lg border border-primary/50 bg-[rgba(252,213,53,0.08)] flex flex-col gap-2 text-left"
          >
            <div class="flex items-center gap-2 text-xs font-bold text-primary">
              <ZenIcon name="triangle-alert" :size="16" class="text-primary shrink-0" />
              <span>Chưa đến Bàn Xem Quẻ</span>
            </div>
            <p class="text-xs text-secondary leading-relaxed">
              Đạo hữu cần bước lại gần <span class="text-white font-semibold">Bàn Xin Xăm &amp; Pháp Bảo</span> ngoài sân Chùa để thành tâm thỉnh quẻ.
            </p>
            <UiButton
              variant="primary"
              size="sm"
              block
              class="mt-1"
              @click="emit('guideToFortune')"
            >
              Dẫn đường đến Bàn Xem Quẻ
            </UiButton>
          </div>

          <!-- Banner Buff / Debuff Trong Ngày -->
          <div
            v-if="activeDailyEffect"
            class="p-4 rounded-lg border flex flex-col gap-2"
            :class="
              activeDailyEffect.effect.type === 'buff'
                ? 'border-[var(--trading-up,#0ecb81)]/45 bg-[rgba(14,203,129,0.1)]'
                : 'border-[var(--primary,#fcd535)]/50 bg-[rgba(252,213,53,0.1)]'
            "
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-sm font-bold text-white">
                <ZenIcon
                  :name="activeDailyEffect.effect.type === 'buff' ? 'circle-check' : 'triangle-alert'"
                  :size="16"
                  :class="activeDailyEffect.effect.type === 'buff' ? 'text-up' : 'text-primary'"
                />
                <span>{{ activeDailyEffect.effect.name }}</span>
              </div>
              <UiBadge :variant="activeDailyEffect.effect.type === 'buff' ? 'success' : 'warning'">
                Tâm An {{ (activeDailyEffect.effect.statModifier?.karmaBonusPct ?? 0) >= 0 ? `+${activeDailyEffect.effect.statModifier?.karmaBonusPct ?? 0}%` : `${activeDailyEffect.effect.statModifier?.karmaBonusPct ?? 0}%` }}
              </UiBadge>
            </div>
            <p class="text-xs text-secondary leading-normal">{{ activeDailyEffect.effect.description }}</p>
          </div>

          <!-- ==================== BƯỚC 1: KHAI HỒ SƠ TẬP TRUNG (BẮT BUỘC) ==================== -->
          <div v-if="!savedProfile || isEditingProfile" class="rounded-lg border border-hairline bg-surface-card p-5 space-y-4">
            <div class="flex items-center justify-between border-b border-hairline pb-3">
              <div>
                <h3 class="text-sm font-bold text-white uppercase tracking-wider">
                  {{ savedProfile ? 'Chỉnh Sửa Hồ Sơ Bát Tự' : 'Bước 1: Khai Hồ Sơ Bát Tự' }}
                </h3>
                <p class="text-xs text-secondary mt-1">
                  Người chơi bắt buộc hoàn thiện hồ sơ chuẩn xác để mở khóa gieo quẻ 6 môn.
                </p>
              </div>
              <UiBadge variant="warning">Bắt buộc</UiBadge>
            </div>

            <!-- Form các trường theo thứ tự cố định -->
            <div class="space-y-3.5">
              <!-- 1. Họ và tên -->
              <div class="space-y-1">
                <label class="text-xs font-semibold text-white block">
                  Họ và tên <span class="text-danger">*</span>
                </label>
                <UiInput
                  v-model="profileForm.fullName"
                  placeholder="Nhập họ và tên đầy đủ (ví dụ: Nguyễn Văn An)"
                  @input="profileFieldErrors.fullName = undefined"
                />
                <p v-if="profileFieldErrors.fullName" class="text-xs text-danger mt-1">
                  {{ profileFieldErrors.fullName }}
                </p>
              </div>

              <!-- 2. Ngày tháng năm sinh (Dương lịch) -->
              <div class="space-y-1">
                <label class="text-xs font-semibold text-white block">
                  Ngày tháng năm sinh (Dương lịch) <span class="text-danger">*</span>
                </label>
                <UiInput
                  v-model="profileForm.birthDate"
                  type="date"
                  min="1900-01-01"
                  max="2026-12-31"
                  @change="profileFieldErrors.birthDate = undefined"
                />
                <p v-if="profileFieldErrors.birthDate" class="text-xs text-danger mt-1">
                  {{ profileFieldErrors.birthDate }}
                </p>
              </div>

              <!-- 3. Giờ sinh (12 canh giờ) -->
              <div class="space-y-1">
                <label class="text-xs font-semibold text-white block">
                  Giờ sinh (Tùy chọn)
                </label>
                <select
                  v-model="profileForm.birthHour"
                  class="w-full h-10 px-3 rounded-md bg-surface-elevated border border-hairline text-xs text-white focus:border-primary outline-none"
                >
                  <option v-for="opt in BIRTH_HOUR_OPTIONS" :key="opt.id" :value="opt.id">
                    {{ opt.label }} {{ opt.timeRange ? `(${opt.timeRange})` : '' }}
                  </option>
                </select>
                <p class="text-xs text-secondary">
                  Nếu không rõ giờ sinh, hệ thống sẽ để trống Can Chi giờ và không tự phán đoán.
                </p>
              </div>

              <!-- 4. Giới tính -->
              <div class="space-y-1.5">
                <label class="text-xs font-semibold text-white block">
                  Giới tính <span class="text-danger">*</span>
                </label>
                <div class="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    class="h-10 px-4 rounded-md border text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                    :class="profileForm.gender === 'nam'
                      ? 'border-primary bg-[rgba(252,213,53,0.12)] text-white'
                      : 'border-hairline bg-surface-elevated text-secondary hover:text-white'"
                    @click="profileForm.gender = 'nam'; profileFieldErrors.gender = undefined"
                  >
                    <span class="w-2 h-2 rounded-full" :class="profileForm.gender === 'nam' ? 'bg-primary' : 'bg-secondary'" />
                    <span>Nam mệnh</span>
                  </button>

                  <button
                    type="button"
                    class="h-10 px-4 rounded-md border text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                    :class="profileForm.gender === 'nu'
                      ? 'border-primary bg-[rgba(252,213,53,0.12)] text-white'
                      : 'border-hairline bg-surface-elevated text-secondary hover:text-white'"
                    @click="profileForm.gender = 'nu'; profileFieldErrors.gender = undefined"
                  >
                    <span class="w-2 h-2 rounded-full" :class="profileForm.gender === 'nu' ? 'bg-primary' : 'bg-secondary'" />
                    <span>Nữ mệnh</span>
                  </button>
                </div>
                <p class="text-xs text-secondary mt-1">
                  Dùng để tính Cung Phi Bát Trạch và Sao chiếu mệnh theo cách truyền thống.
                </p>
                <p v-if="profileFieldErrors.gender" class="text-xs text-danger mt-1">
                  {{ profileFieldErrors.gender }}
                </p>
              </div>

              <!-- 5. Tuổi tự tính (Chỉ đọc) -->
              <div v-if="profilePreview" class="p-3 rounded-md bg-surface-elevated border border-hairline flex items-center justify-between text-xs">
                <span class="text-secondary font-medium">Độ tuổi tự tính:</span>
                <span class="font-numbers font-bold text-white">
                  Tuổi dương: {{ profilePreview.tuoiDuong }} · Tuổi mụ: {{ profilePreview.tuoiMu }}
                </span>
              </div>
            </div>

            <!-- THẺ XEM TRƯỚC HỒ SƠ TỰ ĐỘNG TÍNH TOÁN -->
            <div v-if="profilePreview" class="p-4 rounded-lg bg-surface-elevated border border-primary/40 space-y-2.5">
              <div class="flex items-center justify-between border-b border-hairline pb-2">
                <span class="text-xs font-bold uppercase tracking-wider text-primary">Thẻ Xem Trước Dữ Liệu Tự Tính</span>
                <span class="text-xs text-secondary">Đối chiếu trước khi lưu</span>
              </div>

              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="p-2 rounded bg-surface-card border border-hairline">
                  <div class="text-secondary">Âm lịch & Can Chi:</div>
                  <div class="font-bold text-white mt-0.5">{{ profilePreview.lunarDateStr }}</div>
                </div>
                <div class="p-2 rounded bg-surface-card border border-hairline">
                  <div class="text-secondary">Bản mệnh (Nạp âm):</div>
                  <div class="font-bold text-white mt-0.5">{{ profilePreview.napAmName }} ({{ profilePreview.nguHanhMenh }})</div>
                </div>
                <div class="p-2 rounded bg-surface-card border border-hairline">
                  <div class="text-secondary">Cung phi Bát Trạch:</div>
                  <div class="font-bold text-white mt-0.5">{{ profilePreview.cungPhi }} ({{ profilePreview.cungPhiHanh }}) · {{ profilePreview.cungPhiGroup }}</div>
                </div>
                <div class="p-2 rounded bg-surface-card border border-hairline">
                  <div class="text-secondary">Sao niên vận:</div>
                  <div class="font-bold text-white mt-0.5">{{ profilePreview.saoChieuMenh.name }} ({{ profilePreview.saoChieuMenh.element }})</div>
                </div>
                <div v-if="profilePreview.canChiGio" class="col-span-2 p-2 rounded bg-surface-card border border-hairline">
                  <div class="text-secondary">Can Chi Giờ sinh:</div>
                  <div class="font-bold text-white mt-0.5">{{ profilePreview.birthHourLabel }}</div>
                </div>
              </div>
            </div>

            <!-- Nút bấm hành động duy nhất -->
            <div class="pt-2 space-y-2">
              <UiButton variant="primary" size="lg" block @click="handleSaveProfile">
                Xác Nhận Hồ Sơ
              </UiButton>
              <UiButton v-if="savedProfile" variant="ghost" size="sm" block @click="isEditingProfile = false">
                Hủy bỏ & Quay lại
              </UiButton>
            </div>

            <p class="text-xs text-secondary text-center leading-normal pt-1 border-t border-hairline">
              Dữ liệu được lưu trữ an toàn trên thiết bị của bạn (cục bộ), không đưa on-chain và chỉ sử dụng cho mục đích tính quẻ.
            </p>
          </div>

          <!-- ==================== BƯỚC 2: CHỌN MÔN & THỈNH QUẺ (ĐÃ MỞ KHÓA) ==================== -->
          <div v-else class="flex flex-col gap-5">
            <!-- THANH TÓM TẮT HỒ SƠ -->
            <div class="p-3.5 rounded-lg bg-surface-elevated border border-hairline flex flex-col gap-2">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <UiBadge variant="success">Hồ sơ đã xác nhận</UiBadge>
                  <span class="text-sm font-bold text-white">{{ savedProfile.fullName }}</span>
                </div>
                <div class="flex items-center gap-3 text-xs">
                  <button type="button" class="text-primary hover:underline cursor-pointer font-semibold" @click="isEditingProfile = true">
                    Chỉnh sửa
                  </button>
                  <button type="button" class="text-secondary hover:text-danger cursor-pointer" @click="handleDeleteProfile">
                    Xóa hồ sơ
                  </button>
                </div>
              </div>
              <div class="text-xs text-secondary leading-relaxed">
                Sinh ngày <strong class="text-white font-numbers">{{ savedProfile.birthDate }}</strong> ({{ savedProfile.gender === 'nu' ? 'Nữ mệnh' : 'Nam mệnh' }})
                <span v-if="previewProfileMetaphysics(savedProfile)">
                  · Năm <strong class="text-white">{{ previewProfileMetaphysics(savedProfile)?.canChiNam }}</strong>
                  · Bản mệnh <strong class="text-white">{{ previewProfileMetaphysics(savedProfile)?.napAmName }}</strong>
                  · Cung phi <strong class="text-white">{{ previewProfileMetaphysics(savedProfile)?.cungPhi }}</strong> ({{ previewProfileMetaphysics(savedProfile)?.tuoiMu }} tuổi mụ)
                </span>
              </div>
            </div>

            <!-- PHẦN 1: MÔN BÓI, PHƯƠNG THỨC, SUB-FORM, KẾT QUẢ, LỊCH SỬ -->
            <div class="flex flex-col gap-5 min-w-0">
              <!-- MỤC 1: CHỌN MÔN CẦU AN (Lưới 2 cột, không icon trang trí) -->
              <section class="space-y-2.5">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-bold text-white">1. Chọn môn cầu an</h3>
                  <span class="text-xs text-secondary">6 môn truyền thống</span>
                </div>

                <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Chọn môn cầu an">
                  <UiSelectableCard
                    v-for="c in FORTUNE_CATEGORIES"
                    :key="c.id"
                    :selected="fortuneCategory === c.id"
                    :title="c.name"
                    :description="c.short"
                    @select="fortuneCategory = c.id; fortuneResult = null; pendingConfirm = null"
                  />
                </div>
              </section>

              <!-- MỤC 2: PHƯƠNG THỨC THỈNH QUẺ (Radio Cards) -->
              <section class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-sm font-bold text-white">2. Phương thức thỉnh quẻ</h3>
                  <span class="text-xs text-secondary">Nhất quán theo ngày</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Phương thức thỉnh quẻ">
                  <UiSelectableCard
                    v-for="m in INPUT_MODES"
                    :key="m.id"
                    :selected="fortuneMode === m.id"
                    :title="m.label"
                    :description="m.desc"
                    @select="fortuneMode = m.id; fortuneResult = null; pendingConfirm = null; fortuneNotice = null"
                  />
                </div>

                <!-- Chế độ Chọn câu hỏi có sẵn -->
                <div v-if="fortuneMode === 'preset'" class="p-3.5 rounded-md bg-surface-card border border-hairline space-y-2.5">
                  <label class="text-xs font-semibold text-secondary block">
                    Chọn câu hỏi chiêm bốc ({{ currentPresetQuestions.length }} chủ đề):
                  </label>
                  <div class="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1" role="radiogroup">
                    <UiSelectableCard
                      v-for="q in currentPresetQuestions"
                      :key="q.id"
                      :selected="selectedQuestionId === q.id"
                      :title="q.text"
                      @select="selectedQuestionId = q.id; fortuneResult = null"
                    />
                  </div>
                </div>

                <!-- Chế độ Tự Đặt Câu Hỏi -->
                <div v-else-if="fortuneMode === 'custom'" class="pt-3 border-t border-hairline space-y-2">
                  <label class="text-xs font-semibold text-secondary block">
                    Nhập câu hỏi tâm niệm (hệ thống tự động dò từ khóa):
                  </label>
                  <UiInput v-model="customQuestionText" placeholder="Ví dụ: Tháng này mở cửa hàng có thuận lợi không?" />
                  <div class="flex items-center justify-between text-xs text-secondary">
                    <span>Chủ đề tự động khớp:</span>
                    <span class="font-semibold text-white">{{ detectedCustomTopicLabel }}</span>
                  </div>
                </div>

                <!-- MÔN TƠ DUYÊN TƯƠNG NGỘ: HỒ SƠ NGƯỜI THƯƠNG -->
                <div v-if="fortuneCategory === 'love'" class="p-4 rounded-lg bg-surface-elevated border border-hairline space-y-3 mt-3">
                  <div class="flex items-center justify-between border-b border-hairline pb-2">
                    <span class="text-xs font-bold uppercase tracking-wider text-primary">Hồ Sơ Người Thương (Bắt buộc cho Tơ Duyên)</span>
                    <span class="text-xs text-secondary">Đối sánh 2 mệnh</span>
                  </div>

                  <!-- Danh bạ người thương đã lưu (tối đa 5) -->
                  <div v-if="partnerContacts.length > 0" class="space-y-1.5">
                    <label class="text-xs text-secondary block">Chọn nhanh từ danh bạ:</label>
                    <div class="flex flex-wrap gap-1.5">
                      <div
                        v-for="ct in partnerContacts"
                        :key="ct.fullName + ct.birthDate"
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-card border border-hairline text-xs"
                      >
                        <button type="button" class="text-white hover:text-primary cursor-pointer font-medium" @click="handleSelectPartnerFromContact(ct)">
                          {{ ct.fullName }} ({{ ct.gender === 'nu' ? 'Nữ' : 'Nam' }})
                        </button>
                        <button type="button" class="text-secondary hover:text-danger cursor-pointer ml-1 inline-flex items-center" title="Xóa khỏi danh bạ" @click="handleDeletePartnerFromContact(ct.fullName, ct.birthDate)">
                          <ZenIcon name="close" size="xs" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Form thông tin người thương -->
                  <div class="space-y-2.5">
                    <div>
                      <label class="text-xs font-semibold text-white block mb-1">Họ và tên người thương *</label>
                      <UiInput v-model="partnerForm.fullName" placeholder="Ví dụ: Trần Thị Mai" @input="partnerFieldErrors.fullName = undefined" />
                      <p v-if="partnerFieldErrors.fullName" class="text-xs text-danger mt-1">{{ partnerFieldErrors.fullName }}</p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label class="text-xs font-semibold text-white block mb-1">Ngày sinh dương lịch *</label>
                        <UiInput v-model="partnerForm.birthDate" type="date" @change="partnerFieldErrors.birthDate = undefined" />
                        <p v-if="partnerFieldErrors.birthDate" class="text-xs text-danger mt-1">{{ partnerFieldErrors.birthDate }}</p>
                      </div>

                      <div>
                        <label class="text-xs font-semibold text-white block mb-1">Giới tính *</label>
                        <div class="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            class="h-10 px-2 rounded border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                            :class="partnerForm.gender === 'nam' ? 'border-primary bg-[rgba(252,213,53,0.12)] text-white' : 'border-hairline bg-surface-card text-secondary'"
                            @click="partnerForm.gender = 'nam'; partnerFieldErrors.gender = undefined"
                          >
                            <span>Nam</span>
                          </button>
                          <button
                            type="button"
                            class="h-10 px-2 rounded border text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                            :class="partnerForm.gender === 'nu' ? 'border-primary bg-[rgba(252,213,53,0.12)] text-white' : 'border-hairline bg-surface-card text-secondary'"
                            @click="partnerForm.gender = 'nu'; partnerFieldErrors.gender = undefined"
                          >
                            <span>Nữ</span>
                          </button>
                        </div>
                        <p v-if="partnerFieldErrors.gender" class="text-xs text-danger mt-1">{{ partnerFieldErrors.gender }}</p>
                      </div>
                    </div>

                    <!-- Thẻ xem trước Người Thương -->
                    <div v-if="partnerPreview" class="p-2.5 rounded bg-surface-card border border-hairline text-xs space-y-1">
                      <div class="text-secondary font-medium">Bát Tự người thương:</div>
                      <div class="text-white">
                        Năm <strong>{{ partnerPreview.canChiNam }}</strong> · Mệnh <strong>{{ partnerPreview.napAmName }}</strong> ({{ partnerPreview.nguHanhMenh }}) · Cung <strong>{{ partnerPreview.cungPhi }}</strong> ({{ partnerPreview.cungPhiHanh }})
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <!-- MÀN KẾT QUẢ QUẺ -->
              <div v-if="fortuneResult" class="rounded-lg border border-hairline bg-surface-card p-5 space-y-4">
                <div class="flex items-start justify-between gap-3 border-b border-hairline pb-4">
                  <div class="min-w-0">
                    <div class="text-xs font-medium text-secondary">
                      {{ fortuneResult.monName || 'Bói Quẻ Cầu An' }} · {{ fortuneResult.matchedTagLabel || 'Tổng Quan' }}
                    </div>
                    <h4 class="text-xl font-bold text-white mt-1 leading-snug">
                      {{ fortuneResult.title }}
                    </h4>
            <HydraBadge
              v-if="economy.lastFortuneHydra && economy.lastFortuneHydra.receiptHash === fortuneResult.receiptHash"
              :proof="economy.lastFortuneHydra"
              class="mt-2"
            />
                  </div>
                  <div
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-bold shrink-0"
                    :class="getMucBadgeStyle(fortuneResult.muc)"
                  >
                    <ZenIcon :name="getMucIconName(fortuneResult.muc)" :size="16" />
                    <span>{{ fortuneResult.mucLabel || fortuneResult.score }}</span>
                  </div>
                </div>

                <!-- KHỐI 1: Câu Sấm / Thơ -->
                <div class="p-4 rounded-lg bg-surface-elevated border border-hairline text-sm leading-relaxed text-white text-center italic whitespace-pre-line">
                  {{ fortuneResult.blocks?.tho?.text || fortuneResult.poem }}
                </div>

                <!-- KHỐI 2: Luận giải -->
                <div class="p-4 rounded-lg bg-surface-elevated border border-hairline space-y-1">
                  <h5 class="text-sm font-bold text-white">Luận giải chủ đề</h5>
                  <p class="text-sm text-secondary leading-normal">
                    {{ fortuneResult.blocks?.luangiai?.text || fortuneResult.meaning }}
                  </p>
                </div>

                <!-- 4 Phương diện -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div class="p-3 rounded-md bg-surface-elevated border border-hairline">
                    <div class="text-sm font-bold text-white">Tiền tài &amp; Lộc pháp</div>
                    <p class="text-xs text-secondary mt-1 leading-normal">{{ fortuneResult.wealth }}</p>
                  </div>
                  <div class="p-3 rounded-md bg-surface-elevated border border-hairline">
                    <div class="text-sm font-bold text-white">Duyên tình &amp; Gia đạo</div>
                    <p class="text-xs text-secondary mt-1 leading-normal">{{ fortuneResult.love }}</p>
                  </div>
                  <div class="p-3 rounded-md bg-surface-elevated border border-hairline">
                    <div class="text-sm font-bold text-white">Sức khỏe &amp; Thân tâm</div>
                    <p class="text-xs text-secondary mt-1 leading-normal">{{ fortuneResult.health }}</p>
                  </div>
                  <div class="p-3 rounded-md bg-surface-elevated border border-hairline">
                    <div class="text-sm font-bold text-white">Sự nghiệp &amp; Công danh</div>
                    <p class="text-xs text-secondary mt-1 leading-normal">{{ fortuneResult.career }}</p>
                  </div>
                </div>

                <!-- KHỐI 3: Lời khuyên chánh niệm -->
                <div class="p-4 rounded-lg bg-surface-elevated border border-hairline space-y-1">
                  <h5 class="text-sm font-bold text-white">Lời khuyên chánh niệm</h5>
                  <p class="text-sm text-secondary leading-normal">
                    {{ fortuneResult.blocks?.loikhuyen?.text || fortuneResult.advice }}
                  </p>
                </div>

                <!-- KHỐI 4: Pháp Hóa Giải (Khi Hung / Đại Hung) -->
                <div
                  v-if="fortuneResult.blocks?.hoagiai?.text || fortuneResult.remediationText"
                  class="p-4 rounded-lg bg-[rgba(246,70,93,0.1)] border border-[rgba(246,70,93,0.3)] space-y-2"
                >
                  <div class="flex items-center justify-between gap-2">
                    <h5 class="text-sm font-bold text-danger">Pháp hóa giải vận hạn</h5>
                    <UiButton variant="secondary" size="sm" @click="currentTab = 'meditation'">Tọa thiền hóa giải</UiButton>
                  </div>
                  <p class="text-xs text-secondary leading-normal">
                    {{ fortuneResult.blocks?.hoagiai?.text || fortuneResult.remediationText }}
                  </p>
                </div>

                <!-- Nút thao tác sau khi có quẻ -->
                <div class="pt-2 flex flex-wrap items-center gap-2">
                  <UiButton variant="secondary" size="md" class="flex-1" @click="openShareCardModal(fortuneResult)">
                    Lưu / Chia sẻ ảnh quẻ (PNG)
                  </UiButton>
                  <UiButton variant="ghost" size="md" @click="fortuneResult = null">
                    Xin lại quẻ khác
                  </UiButton>
                </div>
              </div>

              <!-- Xem trước ảnh PNG -->
              <div v-if="shareCardDataUrl" class="rounded-lg border border-hairline bg-surface-card p-4 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-bold text-white">Thẻ ảnh kết quả quẻ (PNG)</span>
                  <button type="button" class="text-secondary hover:text-white" @click="shareCardDataUrl = null">
                    <ZenIcon name="x" :size="16" />
                  </button>
                </div>
                <div class="flex justify-center p-2 bg-surface-elevated rounded">
                  <img :src="shareCardDataUrl" alt="Thẻ ảnh kết quả quẻ" class="max-w-full h-auto rounded max-h-72" />
                </div>
                <div class="flex items-center gap-2 pt-1">
                  <label class="flex items-center gap-2 text-xs text-secondary cursor-pointer select-none">
                    <input type="checkbox" v-model="hideBirthDateInShare" class="rounded border-hairline accent-gold cursor-pointer" />
                    <span>Ẩn ngày sinh chi tiết khi xuất ảnh (chỉ hiển thị năm âm lịch &amp; can chi)</span>
                  </label>
                </div>
                <div class="flex items-center gap-2">
                  <UiButton variant="primary" size="sm" class="flex-1" @click="downloadShareCardPng">Tải ảnh PNG</UiButton>
                  <UiButton variant="secondary" size="sm" @click="copyShareCardImage">Sao chép ảnh</UiButton>
                </div>
                <p v-if="shareCopyStatus" class="text-xs text-up text-center">{{ shareCopyStatus }}</p>
              </div>

              <!-- Lịch sử quẻ đã gieo -->
              <div v-if="mergedFortuneHistory.length > 0" class="rounded-md border border-hairline bg-surface-card overflow-hidden">
                <button
                  type="button"
                  class="w-full p-3 flex items-center justify-between text-xs font-bold text-white hover:bg-surface-elevated transition-colors cursor-pointer"
                  @click="showFortuneHistory = !showFortuneHistory"
                >
                  <span>Lịch sử quẻ đã gieo (<span class="font-numbers">{{ mergedFortuneHistory.length }}</span>/30)</span>
                  <ZenIcon :name="showFortuneHistory ? 'chevron-up' : 'chevron-down'" :size="14" class="text-secondary" />
                </button>
                <div v-if="showFortuneHistory" class="p-3 pt-0 space-y-1.5 max-h-52 overflow-y-auto pr-1 border-t border-hairline">
                  <div
                    v-for="h in mergedFortuneHistory"
                    :key="h.requestId"
                    class="p-2.5 rounded bg-surface-elevated border border-hairline flex items-center justify-between gap-3 text-xs cursor-pointer hover:border-gold"
                    @click="fortuneResult = { ...h.fortune, wealth: h.fortune.aspects?.wealth || h.fortune.wealth, career: h.fortune.aspects?.career || h.fortune.career, love: h.fortune.aspects?.love || h.fortune.love, health: h.fortune.aspects?.health || h.fortune.health, advice: h.fortune.mindfulAdvice || h.fortune.advice, receiptHash: h.receiptHash }"
                  >
                    <div class="min-w-0">
                      <div class="text-white font-semibold truncate">{{ h.fortune?.title }}</div>
                      <div class="text-xs text-secondary mt-0.5">
                        {{ h.fortune?.mucLabel || h.fortune?.score }} · <span class="font-numbers">{{ h.receiptHash }}</span>
                      </div>
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                      <span class="font-numbers text-xs text-secondary">
                        {{ h.paymentMode === 'free_daily' ? '0 MC' : h.paymentMode === 'offering_item' ? 'Lễ phẩm' : `-${h.costMc} MC` }}
                      </span>
                      <HydraBadge v-if="h.hydra" :proof="h.hydra" compact />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- PHẦN 2: TỔNG KẾT & NÚT HÀNH ĐỘNG CHUẨN SÀN BINANCE -->
            <div class="flex flex-col gap-4">
              <div class="rounded-md border border-hairline bg-surface-card p-4 space-y-3.5">
                <div class="flex items-center justify-between border-b border-hairline pb-2.5">
                  <span class="text-xs font-bold uppercase tracking-wider text-secondary">Thông Tin Chiêm Bái</span>
                  <UiBadge :variant="remainingFreeDrawsForCurrentSubject > 0 ? 'success' : 'neutral'" dot>
                    {{ remainingFreeDrawsForCurrentSubject > 0 ? 'Miễn phí hôm nay' : 'Đã dùng miễn phí' }}
                  </UiBadge>
                </div>

                <!-- Tóm tắt môn & phương thức -->
                <div class="space-y-1.5 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="text-secondary">Môn bói:</span>
                    <span class="font-semibold text-white">{{ selectedFortuneCategoryObj.name }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-secondary">Phương thức:</span>
                    <span class="font-semibold text-white">{{ selectedFortuneModeObj.label }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-secondary">Seed ngày:</span>
                    <span class="font-numbers text-secondary">Nhất quán theo ngày</span>
                  </div>
                </div>

                <!-- Chọn hình thức thanh toán (Binance style radio row items) -->
                <div class="pt-3 border-t border-hairline space-y-2">
                  <span class="text-xs font-bold text-secondary uppercase tracking-wider block">Hình thức thanh toán</span>
                  <div class="grid grid-cols-1 gap-1.5" role="radiogroup">
                    <!-- Lượt miễn phí -->
                    <button
                      type="button"
                      @click="fortunePaymentMode = 'free_daily'; pendingConfirm = null; fortuneNotice = null"
                      class="p-2.5 rounded-md border text-left transition flex items-center justify-between text-xs cursor-pointer"
                      :class="fortunePaymentMode === 'free_daily' ? 'border-gold bg-surface-elevated text-white font-semibold' : 'border-hairline bg-surface-card hover:bg-surface-elevated text-secondary hover:text-white'"
                    >
                      <div class="flex items-center gap-2.5">
                        <span
                          class="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0"
                          :class="fortunePaymentMode === 'free_daily' ? 'border-gold bg-gold' : 'border-secondary/60 bg-transparent'"
                        >
                          <span v-if="fortunePaymentMode === 'free_daily'" class="w-1.5 h-1.5 rounded-full bg-canvas-dark"></span>
                        </span>
                        <span :class="fortunePaymentMode === 'free_daily' ? 'text-white' : 'text-primary'">Lượt miễn phí</span>
                      </div>
                      <span class="font-numbers text-xs" :class="fortunePaymentMode === 'free_daily' ? 'text-gold' : 'text-secondary'">0 MC</span>
                    </button>

                    <!-- Dùng lễ phẩm -->
                    <button
                      type="button"
                      @click="fortunePaymentMode = 'offering_item'; pendingConfirm = null; fortuneNotice = null"
                      class="p-2.5 rounded-md border text-left transition flex items-center justify-between text-xs cursor-pointer"
                      :class="fortunePaymentMode === 'offering_item' ? 'border-gold bg-surface-elevated text-white font-semibold' : 'border-hairline bg-surface-card hover:bg-surface-elevated text-secondary hover:text-white'"
                    >
                      <div class="flex items-center gap-2.5">
                        <span
                          class="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0"
                          :class="fortunePaymentMode === 'offering_item' ? 'border-gold bg-gold' : 'border-secondary/60 bg-transparent'"
                        >
                          <span v-if="fortunePaymentMode === 'offering_item'" class="w-1.5 h-1.5 rounded-full bg-canvas-dark"></span>
                        </span>
                        <span :class="fortunePaymentMode === 'offering_item' ? 'text-white' : 'text-primary'">Dùng lễ phẩm</span>
                      </div>
                      <span class="text-xs" :class="fortunePaymentMode === 'offering_item' ? 'text-gold' : 'text-secondary'">{{ ownedOfferingItems.length }} có sẵn</span>
                    </button>

                    <!-- Thêm lượt MC -->
                    <button
                      type="button"
                      @click="fortunePaymentMode = 'mc'; pendingConfirm = null; fortuneNotice = null"
                      class="p-2.5 rounded-md border text-left transition flex items-center justify-between text-xs cursor-pointer"
                      :class="fortunePaymentMode === 'mc' ? 'border-gold bg-surface-elevated text-white font-semibold' : 'border-hairline bg-surface-card hover:bg-surface-elevated text-secondary hover:text-white'"
                    >
                      <div class="flex items-center gap-2.5">
                        <span
                          class="w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0"
                          :class="fortunePaymentMode === 'mc' ? 'border-gold bg-gold' : 'border-secondary/60 bg-transparent'"
                        >
                          <span v-if="fortunePaymentMode === 'mc'" class="w-1.5 h-1.5 rounded-full bg-canvas-dark"></span>
                        </span>
                        <span :class="fortunePaymentMode === 'mc' ? 'text-white' : 'text-primary'">Thêm lượt MC</span>
                      </div>
                      <span class="font-numbers text-xs font-bold text-gold">50 MC</span>
                    </button>
                  </div>
                </div>

                <!-- Chọn lễ phẩm nếu đang chọn mode offering_item -->
                <div v-if="fortunePaymentMode === 'offering_item'" class="pt-2 border-t border-hairline space-y-1.5">
                  <span class="text-xs text-secondary block">Chọn lễ phẩm:</span>
                  <select
                    v-model="selectedOfferingItemId"
                    class="w-full h-9 px-2.5 rounded-md bg-surface-elevated border border-hairline text-xs text-white focus:border-primary outline-none"
                  >
                    <option v-for="off in offeringItems" :key="off.id" :value="off.id">
                      {{ off.name }} (Có: {{ economy.getItemQuantity(off.id) }})
                    </option>
                  </select>
                </div>

                <!-- Cảnh báo lỗi / nạp tiền -->
                <div
                  v-if="fortunePaymentMode !== 'free_daily' && !wallet.isConnected"
                  class="p-2.5 rounded-md bg-[rgba(252,213,53,0.1)] border border-[rgba(252,213,53,0.3)] text-xs text-white space-y-1.5"
                >
                  <span>Cần kết nối ví Eternl để dùng lễ phẩm hoặc tiêu MC.</span>
                  <UiButton variant="secondary" size="sm" block @click="economy.openTopUpModal()">Kết nối ví</UiButton>
                </div>
                <div
                  v-else-if="fortunePaymentMode === 'mc' && wallet.isConnected && economy.meritCoins < currentFortuneCostMc"
                  class="p-2.5 rounded-md bg-[rgba(252,213,53,0.1)] border border-[rgba(252,213,53,0.3)] text-xs text-white space-y-1.5"
                >
                  <span>Số dư không đủ (<strong class="font-numbers">{{ economy.meritCoins.toLocaleString() }} MC</strong> / <strong class="font-numbers">{{ currentFortuneCostMc }} MC</strong>).</span>
                  <UiButton variant="secondary" size="sm" block @click="economy.openTopUpModal()">+ Nạp thêm MC</UiButton>
                </div>

                <div
                  v-if="fortuneNotice"
                  class="p-2.5 rounded-md bg-[rgba(246,70,93,0.1)] border border-[rgba(246,70,93,0.3)] text-xs text-danger flex items-center gap-2"
                >
                  <ZenIcon name="circle-alert" :size="14" class="shrink-0" />
                  <span>{{ fortuneNotice }}</span>
                </div>

                <!-- 1 NÚT VÀNG CHÍNH DUY NHẤT -->
                <div class="pt-1">
                  <UiButton
                    variant="primary"
                    size="lg"
                    block
                    :loading="isRolling"
                    :disabled="isRolling || !canAffordFortune"
                    @click="requestRollFortune"
                  >
                    {{
                      isRolling
                        ? 'Đang lắc ống xăm...'
                        : fortunePaymentMode === 'free_daily'
                          ? 'Gieo Quẻ Miễn Phí (0 MC)'
                          : fortunePaymentMode === 'offering_item'
                            ? 'Dâng Lễ Phẩm Thỉnh Quẻ'
                            : `Gieo Quẻ Chiêm Nghiệm (${currentFortuneCostMc} MC)`
                    }}
                  </UiButton>
                </div>

                <p class="text-xs text-secondary text-center leading-normal">
                  MC là điểm trong game (off-chain), không phải tiền mã hóa và không đổi ngược ra ADA. Hòm công đức là tự nguyện.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- ==================== TAB 2: CỬA HÀNG PHÁP BẢO ==================== -->
        <div v-else-if="currentTab === 'shop'" class="space-y-4">
          <!-- Sub-navigation tabs: Binance underline style -->
          <div class="flex items-center gap-6 border-b border-hairline px-1">
            <button
              type="button"
              class="relative pb-2.5 text-xs font-semibold cursor-pointer transition-colors"
              :class="shopTab === 'attire' ? 'text-white' : 'text-secondary hover:text-white'"
              @click="shopTab = 'attire'"
            >
              Cổ Phục 9 Quốc Gia
              <span
                v-if="shopTab === 'attire'"
                class="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full"
              />
            </button>
            <button
              type="button"
              class="relative pb-2.5 text-xs font-semibold cursor-pointer transition-colors"
              :class="shopTab === 'offerings' ? 'text-white' : 'text-secondary hover:text-white'"
              @click="shopTab = 'offerings'"
            >
              Lễ Vật &amp; Nhang Trầm
              <span
                v-if="shopTab === 'offerings'"
                class="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full"
              />
            </button>
          </div>

          <!-- Alert notifications -->
          <div
            v-if="shopSuccess"
            class="p-3 rounded-md bg-[rgba(14,203,129,0.12)] border border-[rgba(14,203,129,0.3)] text-xs text-[var(--trading-up,#0ecb81)] flex items-center gap-2"
          >
            <ZenIcon name="circle-check" :size="16" class="shrink-0" />
            <span>{{ shopSuccess }}</span>
          <HydraBadge v-if="economy.lastShopHydra" :proof="economy.lastShopHydra" class="ml-auto shrink-0" />
          </div>
          <div
            v-if="shopNotice"
            class="p-3 rounded-md bg-[rgba(246,70,93,0.12)] border border-[rgba(246,70,93,0.3)] text-xs text-[var(--trading-down,#f6465d)] flex items-center gap-2"
          >
            <ZenIcon name="circle-alert" :size="16" class="shrink-0" />
            <span>{{ shopNotice }}</span>
          </div>

          <!-- Chọn Giới Tính Nhân Vật (Nam / Nữ Hành Giả) -->
          <div v-if="shopTab === 'attire'" class="p-3.5 rounded-lg border border-hairline bg-surface-card space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-secondary">Giới tính nhân vật</span>
              <span class="text-xs text-secondary">Đồng bộ Multiplayer</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <UiSelectableCard
                :selected="user.gender === 'female'"
                @click="emit('genderChanged', 'female')"
              >
                <div class="text-xs font-bold text-white">Nữ Hành Giả</div>
                <div class="text-xs text-secondary mt-0.5">Tóc dài truyền thống</div>
              </UiSelectableCard>
              <UiSelectableCard
                :selected="user.gender === 'male'"
                @click="emit('genderChanged', 'male')"
              >
                <div class="text-xs font-bold text-white">Nam Hành Giả</div>
                <div class="text-xs text-secondary mt-0.5">Tóc ngắn gọn gàng</div>
              </UiSelectableCard>
            </div>
          </div>

          <!-- Lưới sản phẩm -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <template v-if="shopTab === 'attire'">
              <div
                v-for="item in attireItems"
                :key="item.id"
                class="p-4 rounded-lg border border-hairline bg-surface-card flex flex-col justify-between gap-3 transition-colors hover:border-[var(--surface-elevated-dark,#2b3139)]"
              >
                <div>
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-numbers font-semibold text-secondary px-2 py-0.5 rounded bg-surface-elevated border border-hairline">{{ item.countryCode }}</span>
                    <span class="font-numbers text-xs font-bold text-white">{{ item.priceMc === 0 ? 'Mặc định' : `${item.priceMc.toLocaleString()} MC` }}</span>
                  </div>
                  <h4 class="text-sm font-bold text-white mt-2 leading-snug">{{ item.name }}</h4>
                  <p class="text-xs text-secondary mt-1 leading-normal line-clamp-2">{{ item.subname }}</p>
                </div>
                <UiButton
                  v-if="user.currentCountry === item.countryId"
                  variant="secondary"
                  size="sm"
                  block
                  disabled
                >
                  Đang mặc
                </UiButton>
                <UiButton
                  v-else-if="economy.isItemUnlocked(item.id) || item.defaultUnlocked"
                  variant="secondary"
                  size="sm"
                  block
                  @click="tryOnOutfit(item.countryId)"
                >
                  Mặc thử
                </UiButton>
                <UiButton
                  v-else
                  variant="primary"
                  size="sm"
                  block
                  @click="requestBuyItem(item)"
                >
                  Thỉnh (-{{ item.priceMc.toLocaleString() }} MC)
                </UiButton>
              </div>
            </template>
            <template v-else>
              <div
                v-for="off in offeringItems"
                :key="off.id"
                class="p-4 rounded-lg border border-hairline bg-surface-card flex flex-col justify-between gap-3 transition-colors hover:border-[var(--surface-elevated-dark,#2b3139)]"
              >
                <div>
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-medium text-secondary">Lễ vật</span>
                    <span class="font-numbers text-xs font-bold text-white">{{ off.priceMc.toLocaleString() }} MC</span>
                  </div>
                  <h4 class="text-sm font-bold text-white mt-2 leading-snug">{{ off.name }}</h4>
                  <p class="text-xs text-secondary mt-1">Đang có trong túi: <strong class="font-numbers text-white font-semibold">{{ economy.getItemQuantity(off.id) }}</strong></p>
                </div>
                <UiButton
                  variant="primary"
                  size="sm"
                  block
                  @click="requestBuyItem({ id: off.id, name: off.name, priceMc: off.priceMc, category: 'offering' })"
                >
                  Thỉnh (-{{ off.priceMc.toLocaleString() }} MC)
                </UiButton>
              </div>
            </template>
          </div>
        </div>

        <!-- ==================== TAB 3: HÒM CÔNG ĐỨC ==================== -->
        <div v-else-if="currentTab === 'merit'" class="max-w-xl mx-auto space-y-4">
          <!-- Cảnh Báo Vị Trí: Cần Đến Hòm Công Đức -->
          <div
            v-if="props.isNearMerit === false"
            class="p-3.5 rounded-lg border border-primary/50 bg-[rgba(252,213,53,0.08)] flex flex-col gap-2 text-left"
          >
            <div class="flex items-center gap-2 text-xs font-bold text-primary">
              <ZenIcon name="triangle-alert" :size="16" class="text-primary shrink-0" />
              <span>Chưa đến Hòm Công Đức</span>
            </div>
            <p class="text-xs text-secondary leading-relaxed">
              Đạo hữu cần bước lại gần <span class="text-white font-semibold">Hòm Công Đức Tam Bảo</span> ngoài sân Chùa để phát tâm cúng dường.
            </p>
            <UiButton
              variant="primary"
              size="sm"
              block
              class="mt-1"
              @click="emit('guideToMerit')"
            >
              Dẫn đường đến Hòm Công Đức
            </UiButton>
          </div>

          <!-- Balance indicator row -->
          <div class="p-3 rounded-lg border border-hairline bg-surface-card flex items-center justify-between text-xs">
            <span class="text-secondary font-medium">Số dư hiện tại</span>
            <span class="font-numbers text-sm font-bold text-white">{{ economy.meritCoins.toLocaleString() }} MC</span>
          </div>

          <div class="rounded-lg border border-hairline bg-surface-card p-5 space-y-4">
            <div>
              <h3 class="text-base font-bold text-white">Cúng dường Tam Bảo tự nguyện</h3>
              <p class="text-xs text-secondary leading-normal mt-1">
                Toàn bộ công đức được ghi nhận vào sổ vàng và phân bổ tự động vào quỹ hương trầm và duy tu chùa.
              </p>
            </div>

            <div class="space-y-2">
              <label class="text-xs font-semibold text-secondary block">Chọn mức công đức nhanh:</label>
              <div class="grid grid-cols-5 gap-2">
                <button
                  v-for="amt in [50, 100, 200, 500, 1000]"
                  :key="amt"
                  type="button"
                  class="py-2 rounded-md border text-xs font-numbers font-semibold cursor-pointer transition-colors text-center"
                  :class="meritAmount === amt ? 'border-primary bg-surface-elevated text-white' : 'border-hairline bg-surface-elevated/40 text-secondary hover:text-white'"
                  @click="selectMeritPreset(amt)"
                >
                  {{ amt }} MC
                </button>
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-secondary block">Hoặc nhập số MC cúng dường:</label>
              <UiInput v-model="customMeritInput" type="number" min="10" placeholder="100" @change="onCustomMeritInput" />
            </div>

            <div class="space-y-1.5">
              <label class="text-xs font-semibold text-secondary block">Lời nguyện cầu:</label>
              <UiInput v-model="meritPrayer" placeholder="Nguyện cầu gia đạo bình an, thân tâm thường lạc" />
            </div>

            <!-- Blessing / Error notices -->
            <div
              v-if="meritBlessing"
              class="p-3 rounded-md bg-[rgba(14,203,129,0.12)] border border-[rgba(14,203,129,0.3)] text-xs text-[var(--trading-up,#0ecb81)] flex items-start gap-2 leading-relaxed"
            >
              <ZenIcon name="circle-check" :size="16" class="shrink-0 mt-0.5" />
              <span>{{ meritBlessing }}</span>
          <HydraBadge v-if="economy.lastMeritHydra" :proof="economy.lastMeritHydra" class="ml-auto shrink-0" />
            </div>
            <div
              v-if="meritError"
              class="p-3 rounded-md bg-[rgba(246,70,93,0.12)] border border-[rgba(246,70,93,0.3)] text-xs text-[var(--trading-down,#f6465d)] flex items-center gap-2"
            >
              <ZenIcon name="circle-alert" :size="16" class="shrink-0" />
              <span>{{ meritError }}</span>
            </div>

            <!-- 1 Primary Yellow CTA Button -->
            <UiButton variant="primary" size="lg" block @click="requestDonateMerit">
              Cúng dường ({{ meritAmount.toLocaleString() }} MC)
            </UiButton>

            <div class="text-xs text-secondary text-center leading-normal mt-2">
              MC là điểm trong game (off-chain), không phải tiền mã hóa và không đổi ngược ra ADA. Hòm công đức là tự nguyện.
            </div>
          </div>

          <!-- Tổng số tiền công đức toàn tự viện -->
          <div class="rounded-lg border border-hairline bg-surface-card p-5 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <ZenIcon name="pagoda" class="w-4 h-4 text-primary" />
                <h4 class="text-sm font-bold text-white">Tổng Số Tiền Công Đức Tam Bảo</h4>
              </div>
              <span class="text-xs text-secondary">Toàn tự viện</span>
            </div>

            <div class="p-4 rounded-lg border border-hairline bg-surface-elevated flex items-center justify-between">
              <div class="space-y-0.5">
                <div class="text-xs text-secondary font-medium">Tổng tiền công đức thực tế</div>
                <div class="text-xl font-numbers font-bold text-primary flex items-center gap-1.5 mt-0.5">
                  <ZenIcon name="coin" class="w-5 h-5 text-primary shrink-0" />
                  <span>{{ Number(economy.globalMeritTotal || 0).toLocaleString() }} MC</span>
                </div>
                <div class="text-xs font-numbers text-secondary">
                  quy đổi ≈ {{ (Number(economy.globalMeritTotal || 0) / 1000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 }) }} ADA
                </div>
              </div>
              <div class="text-right space-y-0.5">
                <div class="text-xs text-secondary font-medium">Lượt hỷ cúng thực tế</div>
                <div class="text-sm font-numbers font-bold text-white">
                  {{ Number(economy.globalDonationCount || 0).toLocaleString() }} lượt
                </div>
                <div class="text-xs text-[var(--trading-up,#0ecb81)] font-medium">
                  Sổ cái xác thực
                </div>
              </div>
            </div>

            <p class="text-xs text-secondary leading-relaxed">
              Mọi khoản công đức đều được lưu danh trên sổ cái bạch ngọc và phân bổ minh bạch cho hoạt động duy tu, thắp đèn hoa đăng và trợ duyên đại chúng.
            </p>
          </div>

          <!-- Bảng vàng Top 10 người công đức nhiều nhất -->
          <div class="rounded-lg border border-hairline bg-surface-card p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <ZenIcon name="lotus" class="w-4 h-4 text-primary" />
                <h4 class="text-sm font-bold text-white">Bảng Vàng Công Đức (Top 10)</h4>
              </div>
              <span class="text-xs text-secondary">
                {{ top10Donors.length }}/10 vị đồng tu
              </span>
            </div>

            <!-- Danh sách Top 10 -->
            <div v-if="top10Donors.length > 0" class="space-y-2">
              <div
                v-for="(donor, idx) in top10Donors"
                :key="donor.address || idx"
                class="p-3 rounded-lg border border-hairline bg-surface-elevated flex items-center justify-between gap-3 transition-colors hover:border-hairline-bright"
              >
                <!-- Cột trái: Hạng & Tên/Pháp danh -->
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="w-6 h-6 rounded-md flex items-center justify-center font-numbers text-xs font-bold shrink-0 border"
                    :class="[
                      idx === 0
                        ? 'border-primary bg-[rgba(252,213,53,0.12)] text-primary'
                        : idx === 1
                          ? 'border-slate-400/60 bg-slate-500/15 text-slate-200'
                          : idx === 2
                            ? 'border-amber-600/60 bg-amber-600/15 text-amber-400'
                            : 'border-hairline bg-surface-card text-secondary'
                    ]"
                  >
                    {{ idx + 1 }}
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs font-semibold text-white truncate">
                      {{ formatDonorName(donor) }}
                    </div>
                    <div class="text-xs font-numbers text-secondary truncate mt-0.5">
                      {{ donor.donationCount ? `${donor.donationCount} lượt cúng dường` : 'Đồng tu hộ trì' }}
                    </div>
                  </div>
                </div>

                <!-- Cột phải: Số MC đã cúng dường -->
                <div class="text-right shrink-0">
                  <div class="text-xs font-numbers font-bold text-primary">
                    +{{ Number(donor.totalMc || 0).toLocaleString() }} MC
                  </div>
                  <div class="text-xs text-secondary mt-0.5">
                    Hồi hướng công đức
                  </div>
                </div>
              </div>
            </div>

            <!-- Trạng thái trống khi chưa có người cúng dường -->
            <div
              v-else
              class="py-8 text-center rounded-lg border border-hairline bg-surface-elevated/50 space-y-2"
            >
              <ZenIcon name="lotus" class="w-8 h-8 text-secondary/60 mx-auto" />
              <div class="text-xs font-semibold text-white">Chưa có dữ liệu Bảng Vàng</div>
              <p class="text-xs text-secondary max-w-xs mx-auto leading-relaxed">
                Hãy là người đầu tiên phát tâm cúng dường Tam Bảo để lưu danh bảng vàng công đức toàn chùa.
              </p>
            </div>
          </div>
        </div>

        <!-- ==================== TAB 4: THẺ DI SẢN 3D ==================== -->
        <div v-else-if="currentTab === 'cards'" class="space-y-4">
          <div
            v-if="cardSuccess"
            class="p-3 rounded-md bg-[rgba(14,203,129,0.12)] border border-[rgba(14,203,129,0.3)] text-xs text-[var(--trading-up,#0ecb81)] flex items-center gap-2"
          >
            <ZenIcon name="circle-check" :size="16" class="shrink-0" />
            <span>{{ cardSuccess }}</span>
          <HydraBadge v-if="economy.lastShopHydra" :proof="economy.lastShopHydra" class="ml-auto shrink-0" />
          </div>
          <div
            v-if="cardNotice"
            class="p-3 rounded-md bg-[rgba(246,70,93,0.12)] border border-[rgba(246,70,93,0.3)] text-xs text-[var(--trading-down,#f6465d)] flex items-center gap-2"
          >
            <ZenIcon name="circle-alert" :size="16" class="shrink-0" />
            <span>{{ cardNotice }}</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="card in cards.allCards"
              :key="card.id"
              class="p-4 rounded-lg border border-hairline bg-surface-card flex flex-col justify-between gap-3 transition-colors hover:border-[var(--surface-elevated-dark,#2b3139)]"
            >
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-secondary">{{ card.country }}</span>
                  <UiBadge :variant="cards.isUnlocked(card.id) ? 'success' : 'neutral'">
                    {{ cards.isUnlocked(card.id) ? 'Đã khai quang' : 'Chưa mở' }}
                  </UiBadge>
                </div>
                <h4 class="text-sm font-bold text-white mt-2 leading-snug">{{ card.title }}</h4>
                <p class="text-xs text-secondary mt-1 leading-relaxed line-clamp-3">{{ card.description }}</p>
              </div>
              <UiButton
                v-if="!cards.isUnlocked(card.id)"
                variant="primary"
                size="sm"
                block
                @click="requestUnlockCard(card)"
              >
                Khai quang (-{{ getCardPriceMc(card.id).toLocaleString() }} MC)
              </UiButton>
              <UiButton
                v-else
                variant="secondary"
                size="sm"
                block
                disabled
              >
                Đã sở hữu
              </UiButton>
            </div>
          </div>
        </div>

        <!-- ==================== TAB 5: HỘI THIỀN 432HZ ==================== -->
        <div v-else-if="currentTab === 'meditation'" class="max-w-lg mx-auto space-y-4 text-center">
          <div class="rounded-lg border border-hairline bg-surface-card p-5 space-y-4">
            <div>
              <h3 class="text-base font-bold text-white">Tọa Thiền Định Tâm Chuông Xoay 432Hz</h3>
              <p class="text-xs text-secondary leading-relaxed mt-1">
                Chuông xoay Tây Tạng ngân vang giúp thả lỏng tâm trí, nhịp thở 4-4-6 đưa thân tâm về trạng thái chánh niệm hiện tiền.
              </p>
            </div>

            <!-- Thống kê trạng thái: Chỗ trống, Thưởng hôm nay, Chuỗi ngày -->
            <div class="grid grid-cols-3 gap-2 text-left">
              <div class="rounded-lg border border-hairline bg-surface-elevated p-2.5">
                <div class="text-xs text-secondary font-medium">Bồ đoàn trống</div>
                <div class="text-sm font-numbers font-bold text-white mt-0.5">
                  {{ meditation.availableSlots }}/{{ meditation.totalSlots }}
                </div>
              </div>
              <div class="rounded-lg border border-hairline bg-surface-elevated p-2.5">
                <div class="text-xs text-secondary font-medium">Hôm nay</div>
                <div class="text-sm font-numbers font-bold text-primary mt-0.5">
                  {{ economy.meditation.dailyEarnedMc }}/{{ economy.meditation.dailyCapMc }} MC
                </div>
              </div>
              <div class="rounded-lg border border-hairline bg-surface-elevated p-2.5">
                <div class="text-xs text-secondary font-medium">Chuỗi tu tập</div>
                <div class="text-sm font-numbers font-bold text-white mt-0.5">
                  {{ user.streakDays }} ngày
                </div>
              </div>
            </div>

            <!-- Cảnh báo khi người chơi đang ở ngoài Chánh Điện -->
            <div
              v-if="!meditation.isInsideSanctuary && meditation.phase === 'idle'"
              class="rounded-lg border border-hairline bg-surface-elevated p-3.5 text-left space-y-2"
            >
              <div class="flex items-center gap-2 text-primary text-xs font-semibold">
                <ZenIcon name="pagoda" class="w-4 h-4 text-primary shrink-0" />
                <span>Bạn đang ở bên ngoài Chánh Điện</span>
              </div>
              <p class="text-xs text-secondary leading-relaxed">
                Vui lòng bước vào bên trong Đại Hùng Bảo Điện để tìm bồ đoàn và bắt đầu thời khóa tọa thiền định tâm kiếm MC.
              </p>
              <UiButton
                variant="primary"
                size="sm"
                block
                @click="meditation.guideToHall"
              >
                Dẫn đường vào Chánh Điện
              </UiButton>
            </div>

            <!-- Cảnh báo khi Chánh Điện hết chỗ ngồi -->
            <div
              v-else-if="meditation.availableSlots === 0 && meditation.phase === 'idle'"
              class="rounded-lg border border-sell/40 bg-surface-elevated p-3.5 text-left space-y-1.5"
            >
              <div class="flex items-center gap-2 text-sell text-xs font-semibold">
                <ZenIcon name="triangle-alert" class="w-4 h-4 text-sell shrink-0" />
                <span>Chánh Điện đã kín toàn bộ bồ đoàn</span>
              </div>
              <p class="text-xs text-secondary leading-relaxed">
                Hiện tại toàn bộ {{ meditation.totalSlots }} bồ đoàn đều đã có đồng tu tĩnh tọa. Kính mong đạo hữu hoan hỷ chờ các đồng tu xả thiền hoặc quay lại sau.
              </p>
            </div>

            <!-- Thông báo từ hệ thống thiền -->
            <div
              v-if="meditation.notice"
              class="rounded-lg border border-hairline bg-surface-elevated p-3 text-left space-y-1.5"
            >
              <div class="flex items-center justify-between text-xs font-bold">
                <div class="flex items-center gap-2">
                  <ZenIcon
                    :name="meditation.notice.kind === 'error' ? 'circle-alert' : meditation.notice.kind === 'warning' ? 'triangle-alert' : 'circle-check'"
                    class="w-4 h-4 shrink-0"
                    :class="meditation.notice.kind === 'error' ? 'text-sell' : meditation.notice.kind === 'warning' ? 'text-primary' : 'text-buy'"
                  />
                  <span :class="meditation.notice.kind === 'error' ? 'text-sell' : meditation.notice.kind === 'warning' ? 'text-primary' : 'text-buy'">
                    {{ meditation.notice.title }}
                  </span>
                </div>
                <button
                  type="button"
                  class="text-xs text-secondary hover:text-white p-0.5"
                  @click="meditation.clearNotice"
                >
                  <ZenIcon name="close" class="w-3.5 h-3.5" />
                </button>
              </div>
              <p class="text-xs text-secondary leading-relaxed">
                {{ meditation.notice.message }}
              </p>
              <UiButton
                v-if="meditation.notice.action === 'guide_to_hall'"
                variant="primary"
                size="sm"
                block
                class="mt-1.5"
                @click="meditation.guideToHall"
              >
                Dẫn đường vào Chánh Điện
              </UiButton>
            </div>

            <!-- Lựa chọn gói thời lượng khi sẵn sàng -->
            <div v-if="meditation.phase === 'idle'" class="space-y-2 text-left">
              <div class="text-xs font-semibold text-secondary uppercase tracking-wider">
                Chọn thời lượng tọa thiền
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="plan in economy.meditation.plans"
                  :key="plan.durationMin"
                  type="button"
                  class="rounded-lg border p-3 text-left transition-all"
                  :class="meditation.selectedDurationMin === plan.durationMin
                    ? 'border-primary bg-[rgba(252,213,53,0.08)]'
                    : 'border-hairline bg-surface-elevated hover:border-hairline-bright'"
                  @click="meditation.setDuration(plan.durationMin)"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-bold text-white">{{ plan.durationMin }} Phút</span>
                    <span class="text-xs font-numbers font-semibold text-primary">+{{ plan.rewardMc }} MC</span>
                  </div>
                  <div class="text-xs text-secondary mt-1">
                    {{ plan.durationMin >= 15 ? 'Chánh niệm sâu sắc' : 'Định tâm thư giãn' }}
                  </div>
                </button>
              </div>
            </div>

            <!-- Visualizer breathing ring -->
            <div
              class="relative w-36 h-36 mx-auto my-3 flex flex-col items-center justify-center rounded-full border-2 transition-all duration-700"
              :class="meditation.isSeated
                ? 'border-primary bg-[rgba(252,213,53,0.06)] shadow-[0_0_24px_rgba(252,213,53,0.15)] animate-pulse'
                : meditation.phase === 'walking' || meditation.phase === 'finding'
                  ? 'border-primary/60 bg-surface-elevated'
                  : 'border-hairline bg-surface-elevated'"
            >
              <template v-if="meditation.isSeated && breathingPhase">
                <span class="text-xs uppercase tracking-wider text-primary font-semibold">
                  {{ breathingPhase.name }} ({{ breathingPhase.count }}s)
                </span>
                <span class="text-lg font-bold font-numbers text-white mt-0.5">
                  {{ meditation.remainingLabel }}
                </span>
                <span class="text-xs font-numbers text-secondary mt-0.5">
                  +{{ meditation.expectedRewardMc }} MC
                </span>
              </template>
              <template v-else-if="meditation.phase === 'walking'">
                <span class="text-xs uppercase tracking-wider text-primary font-semibold">
                  Đang Đến Đệm
                </span>
                <span class="text-sm font-bold text-white mt-1">
                  Bồ Đoàn #{{ (meditation.slotId ?? 0) + 1 }}
                </span>
                <span class="text-xs text-secondary mt-0.5">Khoan thai bước...</span>
              </template>
              <template v-else-if="meditation.phase === 'guiding'">
                <span class="text-xs uppercase tracking-wider text-primary font-semibold">
                  Dẫn Đường
                </span>
                <span class="text-sm font-bold text-white mt-1">Vào Chánh Điện</span>
                <span class="text-xs text-secondary mt-0.5">Đang di chuyển...</span>
              </template>
              <template v-else>
                <span class="text-xs uppercase tracking-wider text-secondary font-semibold">
                  Sẵn Sàng
                </span>
                <span class="text-sm font-bold text-white mt-1">Tĩnh Lặng</span>
                <span class="text-xs font-numbers text-secondary mt-0.5">4-4-6</span>
              </template>
            </div>

            <!-- Thanh tiến độ thời khóa khi đang ngồi -->
            <div v-if="meditation.isSeated" class="space-y-1.5 text-left">
              <div class="flex items-center justify-between text-xs text-secondary">
                <span>Tiến độ thời khóa</span>
                <span class="font-numbers">{{ Math.round(meditation.progressPct) }}%</span>
              </div>
              <div class="w-full h-1.5 rounded-full bg-surface-elevated overflow-hidden">
                <div
                  class="h-full bg-primary transition-all duration-300"
                  :style="{ width: `${meditation.progressPct}%` }"
                />
              </div>
            </div>

            <!-- Nút thao tác chính -->
            <div class="pt-1">
              <UiButton
                v-if="meditation.phase === 'idle'"
                variant="primary"
                size="lg"
                block
                :disabled="meditation.availableSlots === 0"
                @click="handleStartMeditation"
              >
                Bắt Đầu Tọa Thiền
              </UiButton>
              <UiButton
                v-else-if="meditation.phase === 'walking' || meditation.phase === 'seated'"
                variant="secondary"
                size="lg"
                block
                @click="handleStopEarly"
              >
                Xả Thiền Sớm
              </UiButton>
              <UiButton
                v-else-if="meditation.phase === 'guiding'"
                variant="secondary"
                size="md"
                block
                @click="meditation.phase = 'idle'"
              >
                Hủy Dẫn Đường
              </UiButton>
            </div>
          </div>
        </div>

        <!-- ==================== TAB 6: ÂM THANH 3D ==================== -->
        <div v-else-if="currentTab === 'soundscape'" class="max-w-lg mx-auto space-y-4">
          <div class="rounded-lg border border-hairline bg-surface-card p-5 space-y-5">
            <div>
              <h3 class="text-base font-bold text-white">Bộ Trộn Âm Cảnh Không Gian 3D</h3>
              <p class="text-xs text-secondary leading-relaxed mt-1">
                Điều chỉnh âm lượng từng nguồn thanh tịnh để tìm lại sự bình yên trong tâm trí.
              </p>
            </div>

            <div class="space-y-4">
              <div class="space-y-1.5">
                <div class="flex justify-between text-xs">
                  <span class="text-body font-medium">Tiếng mưa rơi mái chùa</span>
                  <span class="font-numbers font-bold text-white">{{ faderRain }}%</span>
                </div>
                <input
                  v-model="faderRain"
                  type="range"
                  min="0"
                  max="100"
                  class="w-full accent-primary h-1.5 rounded-lg bg-surface-elevated cursor-pointer"
                />
              </div>

              <div class="space-y-1.5">
                <div class="flex justify-between text-xs">
                  <span class="text-body font-medium">Suối reo róc rách</span>
                  <span class="font-numbers font-bold text-white">{{ faderStream }}%</span>
                </div>
                <input
                  v-model="faderStream"
                  type="range"
                  min="0"
                  max="100"
                  class="w-full accent-primary h-1.5 rounded-lg bg-surface-elevated cursor-pointer"
                />
              </div>

              <div class="space-y-1.5">
                <div class="flex justify-between text-xs">
                  <span class="text-body font-medium">Chuông xoay 432Hz</span>
                  <span class="font-numbers font-bold text-white">{{ faderBowl }}%</span>
                </div>
                <input
                  v-model="faderBowl"
                  type="range"
                  min="0"
                  max="100"
                  class="w-full accent-primary h-1.5 rounded-lg bg-surface-elevated cursor-pointer"
                />
              </div>
            </div>

            <div class="pt-2 border-t border-hairline flex justify-end">
              <button
                type="button"
                class="text-xs text-secondary hover:text-white transition cursor-pointer"
                @click="faderRain = 30; faderStream = 40; faderBowl = 70"
              >
                Đặt lại mặc định
              </button>
            </div>
          </div>
        </div>

        <!-- ==================== TAB 7: ĐỒNG TU ==================== -->
        <div v-else-if="currentTab === 'sangha'" class="space-y-4">
          <div class="rounded-lg border border-hairline bg-surface-card p-4 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-secondary">Hình tướng Hành Giả của bạn</span>
              <span class="text-xs text-secondary">Phím tắt: G</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <UiSelectableCard
                :selected="user.gender === 'female'"
                @click="emit('genderChanged', 'female')"
              >
                <div class="text-xs font-bold text-white">Nữ Hành Giả</div>
                <div class="text-xs text-secondary mt-0.5">Tóc dài truyền thống</div>
              </UiSelectableCard>
              <UiSelectableCard
                :selected="user.gender === 'male'"
                @click="emit('genderChanged', 'male')"
              >
                <div class="text-xs font-bold text-white">Nam Hành Giả</div>
                <div class="text-xs text-secondary mt-0.5">Tóc ngắn gọn gàng</div>
              </UiSelectableCard>
            </div>
          </div>

          <div class="rounded-lg border border-hairline bg-surface-card p-5 space-y-4">
            <div>
              <h3 class="text-sm font-bold text-white">Pháp Đàm & Lời Nguyện Chánh Niệm</h3>
              <p class="text-xs text-secondary leading-relaxed mt-1">
                Gõ tin nhắn chia sẻ hoặc chọn câu niệm Phật để lan tỏa năng lượng bình an cùng các đồng tu đang hiện diện.
              </p>
            </div>

            <!-- Ô Nhập Text Chat Tự Do -->
            <div class="space-y-1.5 pt-1">
              <label class="text-xs font-semibold text-secondary block">Nhắn gửi lời pháp đàm:</label>
              <div class="flex items-center gap-2">
                <UiInput
                  v-model="customChatText"
                  placeholder="Nhập lời nguyện hoặc chia sẻ cùng đồng tu..."
                  class="flex-1"
                  @keydown.enter.prevent="sendCustomChatMessage"
                />
                <UiButton
                  variant="primary"
                  size="md"
                  :disabled="!customChatText.trim()"
                  @click="sendCustomChatMessage"
                >
                  Gửi
                </UiButton>
              </div>
            </div>

            <!-- Danh sách câu kệ mẫu chọn nhanh -->
            <div class="space-y-2 pt-2 border-t border-hairline">
              <span class="text-xs font-semibold text-secondary block">Hoặc chọn nhanh câu niệm / kệ thiền:</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  v-for="m in MANTRAS"
                  :key="m"
                  type="button"
                  class="px-3.5 py-2.5 rounded-md border border-hairline bg-surface-elevated hover:border-primary text-xs text-body hover:text-white transition cursor-pointer text-left flex items-center justify-between group"
                  @click="sendMantraMessage(m)"
                >
                  <span class="leading-normal">{{ m }}</span>
                  <span class="text-xs font-semibold text-secondary group-hover:text-primary shrink-0 ml-2">Gửi</span>
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[var(--trading-up,#0ecb81)]" />
              <h4 class="text-xs font-semibold text-secondary uppercase tracking-wider">
                Đồng tu cùng tu tập ({{ remotePilgrims?.length || 0 }})
              </h4>
            </div>

            <div v-if="remotePilgrims && remotePilgrims.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div
                v-for="p in remotePilgrims"
                :key="p.id"
                class="p-3.5 rounded-lg border border-hairline bg-surface-card flex items-center justify-between gap-3"
              >
                <div>
                  <div class="text-sm font-semibold text-white">{{ p.name }}</div>
                  <div class="text-xs text-secondary mt-0.5">{{ p.title }}</div>
                </div>
                <UiButton variant="secondary" size="sm" @click="$emit('greetPilgrim', p.id)">
                  Chắp tay chào
                </UiButton>
              </div>
            </div>
            <div v-else class="p-6 rounded-lg border border-hairline bg-surface-card text-center text-xs text-secondary">
              Hiện bạn đang tịnh tu một mình nơi chánh điện.
            </div>
          </div>
        </div>

        <!-- =============================================================== -->
        <!-- TAB: NHÀ HẦU ĐỒNG (ĐIỆN THỜ TỨ PHỦ & TRẦN TRIỀU)                -->
        <!-- =============================================================== -->
        <div v-else-if="currentTab === 'hau_dong'">
          <HauDongPanel
            :is-inside-hau-dong="isInsideHauDong"
            @guide-to-hau-dong="$emit('guideToHauDong')"
            @trigger-bow="$emit('triggerBow')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sanctuary-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  justify-content: flex-end;
  background-color: transparent;
  pointer-events: auto;
}

.sanctuary-modal {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
  height: 100vh;
  height: 100dvh;
  background-color: var(--canvas-dark, #0b0e11);
  border-left: 1px solid var(--hairline-on-dark, #2b3139);
  border-top: none;
  border-right: none;
  border-bottom: none;
  border-radius: 0;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.75);
  color: var(--text-primary, #eaecef);
  overflow: hidden;
  outline: none;
  font-family: var(--font-sans, 'Inter', sans-serif);
  animation: binance-slide-in-right 180ms cubic-bezier(0.2, 0, 0, 1) both;
}

@media (max-width: 640px) {
  .sanctuary-modal {
    max-width: 100vw;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sanctuary-modal {
    animation: none !important;
  }
}

.sanctuary-header {
  flex-shrink: 0;
  padding: 14px 16px 0;
  background-color: var(--surface-card-dark, #1e2329);
  border-bottom: 1px solid var(--hairline-on-dark, #2b3139);
}

.sanctuary-mc-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px;
  border-radius: var(--radius-sm, 4px);
  background-color: var(--surface-elevated-dark, #2b3139);
  border: 1px solid var(--hairline-on-dark, #2b3139);
  cursor: pointer;
  transition: background-color var(--transition-fast, 120ms ease);
}

.sanctuary-mc-chip:hover {
  background-color: var(--surface-elevated-dark-hover, #333b44);
}

.sanctuary-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm, 4px);
  background-color: var(--surface-elevated-dark, #2b3139);
  border: 1px solid var(--hairline-on-dark, #2b3139);
  color: var(--text-secondary, #929aa5);
  cursor: pointer;
  transition: background-color var(--transition-fast, 120ms ease), color var(--transition-fast, 120ms ease);
}

.sanctuary-close-btn:hover {
  background-color: var(--surface-elevated-dark-hover, #333b44);
  color: #ffffff;
}

.sanctuary-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

@media (max-width: 768px) {
  .sanctuary-modal-backdrop {
    padding: 0;
  }
  .sanctuary-modal {
    max-width: none;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    border: none;
  }
}

/* Helpers */
.font-numbers {
  font-family: var(--font-numbers, 'IBM Plex Sans', sans-serif);
  font-variant-numeric: tabular-nums;
}

.text-gold {
  color: var(--primary, #fcd535);
}

.text-primary {
  color: var(--primary, #fcd535);
}

.text-up {
  color: var(--trading-up, #0ecb81);
}

.text-danger {
  color: var(--trading-down, #f6465d);
}

.text-secondary {
  color: var(--text-secondary, #929aa5);
}

.text-ink {
  color: var(--ink-light, #181a20);
}

.bg-surface-card {
  background-color: var(--surface-card-dark, #1e2329);
}

.bg-surface-elevated {
  background-color: var(--surface-elevated-dark, #2b3139);
}

.border-hairline {
  border-color: var(--hairline-on-dark, #2b3139);
}
</style>
