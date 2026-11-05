<script setup lang="ts">
import { TempleStage, type InteractionTarget } from '~/lib/world3d/TempleStage'
import { zenAudio } from '~/lib/audio/ZenAudio'
import { useUserStore, type CountryId } from '~/stores/user'
import { useEconomyStore } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'
import { MultiplayerClient, type PilgrimPresence, type ZenChatMessage } from '~/lib/network/MultiplayerClient'
import SanctuaryDrawer, { type DrawerTab } from '~/components/SanctuaryDrawer.vue'

const user = useUserStore()
const economy = useEconomyStore()
const wallet = useWalletStore()

const canvasContainer = ref<HTMLElement | null>(null)
let stage: TempleStage | null = null
let multiplayer: MultiplayerClient | null = null

// Đăng nhập/đăng xuất ví: đổi tên hiển thị theo tài khoản và join lại để server gắn danh tính đã xác thực.
watch(() => wallet.accountId, () => {
  if (wallet.displayName) user.name = wallet.displayName
  void multiplayer?.rejoin()
})

// Khi người chơi bấm nút "Nạp MC" từ Cửa Hàng / Bói Quẻ / Hòm Công Đức -> mở ngay modal Ví Cardano (tab Mua MC)
watch(() => economy.topUpModalSignal, () => {
  if (stage) stage.exitPointerLock()
  showWalletModal.value = true
})

const nearTarget = ref<InteractionTarget>(null)
const currentTimeOfDay = ref<'day' | 'sunset' | 'night'>('day')

// Multiplayer state
const remotePilgrimsList = ref<PilgrimPresence[]>([])
const onlinePilgrimCount = ref(1)
const chatMessages = ref<ZenChatMessage[]>([])
const isMeditating = ref(false)

// Right-Side Modal Drawer (like hydra-graveyard)
const drawerOpen = ref(false)
const drawerTab = ref<DrawerTab>('fortune')

function openDrawer(tab: DrawerTab) {
  if (stage) stage.exitPointerLock()
  drawerTab.value = tab
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
}

// Emote Wheel & Wallet Modals
const showWalletModal = ref(false)
const showEmoteWheel = ref(false)
const showDisclaimer = ref(false)
const isAudioMuted = ref(false)

// Toast notification banner state
const toastMessage = ref<{ title: string; desc: string; icon: string } | null>(null)
let toastTimer: any = null

function showToast(title: string, desc: string, icon = 'pagoda') {
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = { title, desc, icon }
  toastTimer = setTimeout(() => {
    toastMessage.value = null
  }, 4000)
}

const countries: { id: CountryId; name: string; code: string }[] = [
  { id: 'vietnam', name: 'Việt Nam', code: 'VN' },
  { id: 'japan', name: 'Nhật Bản', code: 'JP' },
  { id: 'thailand', name: 'Thái Lan', code: 'TH' },
  { id: 'korea', name: 'Hàn Quốc', code: 'KR' },
  { id: 'taiwan', name: 'Đài Loan', code: 'TW' },
  { id: 'singapore', name: 'Singapore', code: 'SG' },
  { id: 'india', name: 'Ấn Độ', code: 'IN' },
  { id: 'tibet', name: 'Tây Tạng', code: 'TB' },
  { id: 'western', name: 'Làng Mai', code: 'LM' }
]

onMounted(() => {
  if (canvasContainer.value) {
    stage = new TempleStage(canvasContainer.value)
    stage.onNearTarget = (target) => {
      nearTarget.value = target
    }
    stage.onRightClick = (target) => {
      handleRightClickAction(target)
    }
    stage.onCameraModeChange = (mode) => {
      user.setCameraMode(mode)
    }

    // Khởi tạo Realtime Sangha Hub WebSocket Client
    multiplayer = new MultiplayerClient()

    stage.onLocalMove = (pos, yaw, isMoving) => {
      multiplayer?.streamMove(pos, yaw, isMoving)
    }

    multiplayer.onSnapshot = (pilgrims, count) => {
      remotePilgrimsList.value = pilgrims
      onlinePilgrimCount.value = count
      for (const p of pilgrims) {
        stage?.upsertRemotePilgrim(p)
      }
    }

    multiplayer.onPilgrimJoin = (p, count) => {
      remotePilgrimsList.value.push(p)
      onlinePilgrimCount.value = count
      stage?.upsertRemotePilgrim(p)
      zenAudio.playTempleBell()
      showToast('Đồng tu tham gia', `${p.name} vừa đến chiêm bái chùa`, 'lotus')
    }

    multiplayer.onPilgrimMove = (data) => {
      stage?.upsertRemotePilgrim({
        id: data.id,
        name: '',
        title: '',
        country: '',
        position: data.position,
        yaw: data.yaw,
        action: data.action as any,
        updatedAt: Date.now()
      })
    }

    multiplayer.onPilgrimEmote = (data) => {
      stage?.triggerRemoteEmote(data.id, data.action)
      if (data.action === 'bow') {
        zenAudio.playWoodenFish()
        showToast('Chào hỏi', `${data.name} vừa chắp tay cúi chào`, 'hand-bow')
      }
    }

    multiplayer.onPilgrimChat = (msg) => {
      chatMessages.value.push(msg)
      stage?.showSpeechBubble(msg.id === multiplayer?.pilgrimId ? 'local' : msg.id, msg.text)
      zenAudio.playWoodenFish()
    }

    multiplayer.onPilgrimLeave = (id, count) => {
      remotePilgrimsList.value = remotePilgrimsList.value.filter((p) => p.id !== id)
      onlinePilgrimCount.value = count
      stage?.removeRemotePilgrim(id)
    }

    multiplayer.connect()
    // Dữ liệu join luôn lấy mới: có phiên ví thì kèm vé WS một lần để server gắn danh tính đã xác thực.
    multiplayer.joinProvider = async () => ({
      name: user.name,
      title: user.title,
      country: user.currentCountry,
      position: [0, 0, 10],
      yaw: 0,
      ticket: await wallet.fetchWsTicket()
    })
    void multiplayer.rejoin()

    // Tự kết nối lại ví nếu phiên còn hạn và ví vẫn bật cùng tài khoản, đồng thời tải danh mục MC từ server.
    void economy.loadCatalog()
    void wallet.restore()

    const route = useRoute()
    const botCount = parseInt(route.query.bots as string) || 0
    if (botCount > 0) {
      stage.spawnDebugBots(botCount)
    }

    if (typeof window !== 'undefined') {
      ;(window as any).__STAGE__ = stage
    }

    window.addEventListener('keydown', onGlobalKeyDown)
    window.addEventListener('keyup', onGlobalKeyUp)

    // Kích hoạt thanh tiến độ & thông điệp chánh niệm (Giai đoạn 5)
    simulateLoading()
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    ;(window as any).__STAGE__ = null
  }
  window.removeEventListener('keydown', onGlobalKeyDown)
  window.removeEventListener('keyup', onGlobalKeyUp)
  if (multiplayer) {
    multiplayer.disconnect()
    multiplayer = null
  }
  if (stage) {
    stage.destroy()
    stage = null
  }
})

// Chế độ Chuột: Giữ ALT để hiện con trỏ tự do (Cách 1)
const isAltHeld = ref(false)

function onGlobalKeyDown(e: KeyboardEvent) {
  // If user is typing in an input, do not trigger MMO hotkeys
  const activeEl = document.activeElement
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
    return
  }

  // CÁCH 1: GIỮ PHÍM ALT ĐỂ THOÁT POINTER LOCK VÀ HIỆN CON TRỎ CHUỘT
  if (e.key === 'Alt') {
    e.preventDefault()
    isAltHeld.value = true
    if (stage) stage.exitPointerLock()
    return
  }

  // CÁCH 3: PHÍM TẮT SỐ 1, 2, 3 TRỰC TIẾP + TỰ ĐỘNG NHẢ CHUỘT THAO TÁC UI
  if (e.code === 'Digit1' || e.code === 'Numpad1') {
    if (stage) stage.exitPointerLock()
    toggleDivinationMenu()
    return
  } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
    if (stage) stage.exitPointerLock()
    toggleMeditationMenu()
    return
  } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
    if (stage) stage.exitPointerLock()
    toggleHeritageMenu()
    return
  }

  if (e.key === 'Escape') {
    closeAllDropups()
    if (showCountryMenu.value) {
      showCountryMenu.value = false
      return
    }
    if (showHotkeysMenu.value) {
      showHotkeysMenu.value = false
      return
    }
    if (drawerOpen.value) {
      drawerOpen.value = false
      return
    }
    if (showEmoteWheel.value) {
      showEmoteWheel.value = false
      return
    }
    if (showWalletModal.value) {
      showWalletModal.value = false
      return
    }
  } else if (e.code === 'KeyB') {
    triggerBowAction()
  } else if (e.code === 'KeyM') {
    toggleMeditationPose()
  } else if (e.code === 'KeyC') {
    if (stage) stage.exitPointerLock()
    openDrawer('sangha')
  } else if (e.code === 'KeyX') {
    if (stage) stage.exitPointerLock()
    showEmoteWheel.value = !showEmoteWheel.value
  } else if (e.code === 'F2') {
    e.preventDefault()
    if (stage) {
      const isVisible = stage.toggleStatsOverlay()
      showToast('Hiệu Năng [F2]', isVisible ? 'Đã BẬT bảng thống kê chi tiết' : 'Đã TẮT bảng thống kê', 'sparkles')
    }
  } else if (e.code === 'F3') {
    e.preventDefault()
    if (stage) {
      const isDebug = stage.toggleDebugColliders()
      showToast('Debug Colliders [F3]', isDebug ? 'Đã BẬT lưới khung dây va chạm vật lý' : 'Đã TẮT lưới khung dây va chạm', 'sparkles')
    }
  } else if (e.code === 'F4') {
    e.preventDefault()
    cycleGraphicsQuality()
  }
}

function onGlobalKeyUp(e: KeyboardEvent) {
  // CÁCH 1: THẢ PHÍM ALT -> NẾU KHÔNG CÓ MODAL NÀO ĐANG MỞ THÌ TỰ ĐỘNG KHÓA LẠI
  if (e.key === 'Alt') {
    e.preventDefault()
    isAltHeld.value = false
    const isAnyMenuOpen = drawerOpen.value || 
                          showDivinationMenu.value || 
                          showMeditationMenu.value || 
                          showHeritageMenu.value || 
                          showCountryMenu.value || 
                          showHotkeysMenu.value || 
                          showWalletModal.value || 
                          showEmoteWheel.value || 
                          showDisclaimer.value
    if (!isAnyMenuOpen && stage) {
      stage.requestPointerLock()
    }
  }
}

function handleSelectEmote(action: 'bow' | 'pray' | 'prostrate' | 'meditate' | 'incense' | 'lantern') {
  if (action === 'bow') {
    triggerBowAction()
  } else if (action === 'meditate') {
    toggleMeditationPose()
  } else if (action === 'pray') {
    zenAudio.playTempleBell()
    showToast('Niệm Phật Sen Nở', 'Đóa sen vàng nở rộ dưới từng bước chân an lạc', 'lotus')
    multiplayer?.triggerEmote('pray', user.name)
  } else if (action === 'prostrate') {
    if (stage) stage.triggerLocalEmote('bowing')
    zenAudio.playWoodenFish()
    showToast('Đảnh Lễ Tam Bảo', 'Ngũ thể đầu địa, thành kính quy y Phật - Pháp - Tăng', 'sparkles')
    multiplayer?.triggerEmote('bow', user.name)
  } else if (action === 'incense') {
    zenAudio.playTempleBell()
    showToast('Dâng Hương Trầm', 'Tâm hương một nén kính dâng Tam Bảo', 'incense')
  } else if (action === 'lantern') {
    zenAudio.playTempleBell()
    showToast('Thả Hoa Đăng', 'Hoa đăng lung linh trôi theo dòng nước mang ước nguyện thiện lành', 'sunset')
  }
}

function handleShopOutfitChanged(cId: CountryId) {
  if (stage) {
    stage.setCountry(cId as any)
  }
}

function triggerBowAction() {
  if (stage) {
    stage.triggerLocalEmote('bowing')
  }
  multiplayer?.triggerEmote('bow', user.name)
  zenAudio.playWoodenFish()
  showToast('Chắp tay chào', 'Bạn đã thành kính chắp tay cúi chào đại chúng', 'hand-bow')
}

function toggleMeditationPose() {
  isMeditating.value = !isMeditating.value
  const action = isMeditating.value ? 'meditating' : 'standing'
  if (stage) {
    stage.triggerLocalEmote(action)
  }
  multiplayer?.triggerEmote(isMeditating.value ? 'meditate' : ('standing' as any), user.name)
  zenAudio.playTempleBell()
  showToast(
    isMeditating.value ? 'Tọa thiền kiết già' : 'Xả thiền',
    isMeditating.value ? 'Thân tâm bất động, hơi thở tự nhiên' : 'Hồi phục thân tướng trang nghiêm',
    'meditation'
  )
}

function handleSendChat(text: string) {
  multiplayer?.sendChat(user.name, text)
}

function handleBowToPilgrim(id: string) {
  triggerBowAction()
}

function toggleCamera() {
  if (stage) {
    stage.cycleCameraMode()
  } else {
    user.cycleCamera()
  }
}

// Country Selector Popover & Hotkeys Modal
const showCountryMenu = ref(false)
const showHotkeysMenu = ref(false)

// Drop-up Menus (Phương án 2: 3 Cụm Drop-up triệt tiêu 100% trượt ngang)
const showDivinationMenu = ref(false)
const showMeditationMenu = ref(false)
const showHeritageMenu = ref(false)
const selectedFortuneCategory = ref<any>('stick')

const FORTUNE_MENU_ITEMS = [
  { id: 'stick', name: 'Xin Xăm Bát Quái', short: 'Bổn mạng & Sự nghiệp', icon: 'cards' },
  { id: 'love', name: 'Tơ Duyên Tương Ngộ', short: 'Nguyệt Lão chỉ hồng', icon: 'sparkles' },
  { id: 'family', name: 'Cầu Tự Con Cái', short: 'Quan Âm Tống Tử', icon: 'lotus' },
  { id: 'wealth', name: 'Chiêu Tài Tấn Bảo', short: 'Kinh doanh phát đạt', icon: 'coin' },
  { id: 'health', name: 'Dược Sư An Khang', short: 'Tiêu tai trừ bệnh', icon: 'meditation' },
  { id: 'star', name: 'Dâng Sao Giải Hạn', short: 'Bắc Đẩu Thất Tinh', icon: 'sun' }
]

function closeAllDropups() {
  showDivinationMenu.value = false
  showMeditationMenu.value = false
  showHeritageMenu.value = false
}

function toggleDivinationMenu() {
  const next = !showDivinationMenu.value
  closeAllDropups()
  showDivinationMenu.value = next
}

function toggleMeditationMenu() {
  const next = !showMeditationMenu.value
  closeAllDropups()
  showMeditationMenu.value = next
}

function toggleHeritageMenu() {
  const next = !showHeritageMenu.value
  closeAllDropups()
  showHeritageMenu.value = next
}

function openFortuneCategory(catId: string) {
  selectedFortuneCategory.value = catId
  closeAllDropups()
  openDrawer('fortune')
}

function openDrawerFromDropup(tab: DrawerTab) {
  closeAllDropups()
  openDrawer(tab)
}

const currentCountryObj = computed(() => {
  return countries.find(c => c.id === user.currentCountry) || countries[0]
})

function handleCountrySelect(cId: CountryId) {
  user.setCountry(cId)
  showCountryMenu.value = false
  zenAudio.playTempleBell()
  if (stage) {
    stage.setCountry(cId as any)
  }
}

function handleRightClickAction(target: InteractionTarget) {
  if (target === 'incense') {
    zenAudio.playTempleBell()
    zenAudio.playWoodenFish()
    showToast('Dâng Hương Tam Bảo', 'Bạn đã thành kính dâng 3 nén hương trầm lên Tam Bảo. Nguyện thân tâm an lạc!', 'incense')
  } else if (target === 'merit_box') {
    openDrawer('merit')
  } else if (target === 'fortune') {
    openDrawer('fortune')
  } else if (target === 'meditation') {
    openDrawer('meditation')
  } else if (target === 'lantern') {
    openDrawer('shop')
  } else if (target === 'door') {
    const isOpen = stage?.toggleSanctuaryDoor()
    zenAudio.playWoodenFish()
    showToast(isOpen ? 'Mở Cửa Chánh Điện' : 'Đóng Cửa Chánh Điện', 'Cửa bức bàn gỗ lim truyền thống', 'pagoda')
  } else if (stage && stage.isNearDoor()) {
    const isOpen = stage.toggleSanctuaryDoor()
    zenAudio.playWoodenFish()
    showToast(isOpen ? 'Mở Cửa Chánh Điện' : 'Đóng Cửa Chánh Điện', 'Cửa bức bàn gỗ lim truyền thống', 'pagoda')
  } else {
    // Chuột phải vào không gian trống: Niệm Phật / chắp tay gõ mõ
    zenAudio.playWoodenFish()
  }
}

function handleAction() {
  handleRightClickAction(nearTarget.value)
}

function getInteractionPrompt(target: InteractionTarget): string {
  if (target === 'incense') return 'Dâng Hương Trầm Tam Bảo'
  if (target === 'merit_box') return 'Mở Hòm Công Đức (ADA / Cúng Dường)'
  if (target === 'fortune') return 'Rút Quẻ Xăm Linh Tự'
  if (target === 'meditation') return 'Tọa Thiền Tĩnh Tâm'
  if (target === 'lantern') return 'Thả Hoa Đăng Cầu An'
  if (target === 'door') return 'Mở / Đóng Cửa Bức Bàn'
  return 'Tương Tác'
}

function toggleAudio() {
  isAudioMuted.value = zenAudio.toggleMute()
}

function cycleTimeOfDay() {
  if (currentTimeOfDay.value === 'day') {
    currentTimeOfDay.value = 'sunset'
  } else if (currentTimeOfDay.value === 'sunset') {
    currentTimeOfDay.value = 'night'
  } else {
    currentTimeOfDay.value = 'day'
  }
  if (stage) {
    stage.setTimeOfDay(currentTimeOfDay.value)
  }
}

// Cấu hình chất lượng đồ họa (Giai đoạn 3)
const graphicsQuality = ref<'low' | 'medium' | 'high' | 'ultra'>('high')

function cycleGraphicsQuality() {
  if (graphicsQuality.value === 'high') {
    graphicsQuality.value = 'ultra'
  } else if (graphicsQuality.value === 'ultra') {
    graphicsQuality.value = 'low'
  } else if (graphicsQuality.value === 'low') {
    graphicsQuality.value = 'medium'
  } else {
    graphicsQuality.value = 'high'
  }
  if (stage) {
    stage.setGraphicsQuality(graphicsQuality.value)
  }
  showToast('Chất lượng đồ họa [F4]', `Cấu hình: ${graphicsQuality.value.toUpperCase()}`, 'sparkles')
}

// Loading Screen trang trọng (Giai đoạn 5)
const isSceneLoading = ref(true)
const loadingProgress = ref(15)
const zenQuotes = [
  'Hơi thở vào, tâm tĩnh lặng. Hơi thở ra, miệng mỉm cười. — Thiền sư Thích Nhất Hạnh',
  'Tâm an vạn sự an. Tâm bình thế giới bình.',
  'Bồ đề vốn không cây, gương sáng cũng chẳng đài. — Lục Tổ Huệ Năng',
  'Mỗi bước chân đi trên mặt đất là mỗi bước đi vào cõi tịnh độ.',
  'Hoa sen nở trong bùn nhơ mà không nhuốm mùi bùn trần gian.'
]
const currentZenQuote = ref(zenQuotes[0])

function simulateLoading() {
  const quoteIdx = Math.floor(Math.random() * zenQuotes.length)
  currentZenQuote.value = zenQuotes[quoteIdx]

  let p = 15
  const interval = setInterval(() => {
    p += Math.floor(Math.random() * 20) + 12
    if (p >= 100) {
      p = 100
      loadingProgress.value = 100
      clearInterval(interval)
      setTimeout(() => {
        isSceneLoading.value = false
      }, 450)
    } else {
      loadingProgress.value = p
    }
  }, 110)
}
</script>

<template>
  <div class="relative w-screen h-screen overflow-hidden select-none bg-[#0b0e11]">
    <!-- 3D Three.js WebGL Canvas Host -->
    <div ref="canvasContainer" class="w-full h-full cursor-grab active:cursor-grabbing canvas-wrapper" style="position: absolute; inset: 0; width: 100vw; height: 100vh;"></div>

    <!-- Zen Loading Screen Overlay (Giai đoạn 5) -->
    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-500 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isSceneLoading"
        class="fixed inset-0 z-50 bg-[#0b0e11] flex flex-col items-center justify-center p-6 text-center select-none"
      >
        <!-- Golden Pagoda Emote with Gentle Pulse -->
        <div class="relative mb-6">
          <div class="w-20 h-20 rounded-2xl bg-[#FCD535]/10 border border-[#FCD535]/30 flex items-center justify-center text-[#FCD535] shadow-[0_0_30px_rgba(252,213,53,0.15)] animate-pulse">
            <ZenIcon name="pagoda" :size="40" />
          </div>
        </div>

        <!-- Title & Subtitle -->
        <h2 class="text-xl font-bold tracking-tight text-white mb-1.5 font-display">VẠN CẢNH THIỀN TỰ</h2>
        <p class="text-xs text-[#FCD535] font-mono tracking-widest uppercase mb-6">Hydra Pagoda // Thế Giới 3D Tâm Linh Web3</p>

        <!-- Progress Bar -->
        <div class="w-72 sm:w-96 h-1.5 bg-[#1e2329] rounded-full overflow-hidden mb-3 border border-white/5">
          <div
            class="h-full bg-gradient-to-r from-[#F0B90B] to-[#FCD535] transition-all duration-200 ease-out rounded-full shadow-[0_0_12px_rgba(252,213,53,0.5)]"
            :style="{ width: `${loadingProgress}%` }"
          ></div>
        </div>
        <div class="text-[11px] font-mono text-[#848e9c] mb-8">
          Đang tải cảnh giới thiền môn... {{ loadingProgress }}%
        </div>

        <!-- Zen Quote -->
        <div class="max-w-md px-6 py-3 rounded-lg bg-[#181a20]/80 border border-[#2b3139]/50 text-xs italic text-[#eaecef] mb-8 shadow-inner">
          "{{ currentZenQuote }}"
        </div>

        <!-- Controls Cheat Sheet -->
        <div class="flex flex-wrap items-center justify-center gap-4 text-[11px] text-[#848e9c]">
          <span class="flex items-center gap-1.5"><kbd class="px-1.5 py-0.5 rounded bg-black/60 text-[#eaecef] font-mono border border-white/10">WASD</kbd> Di chuyển</span>
          <span class="flex items-center gap-1.5"><kbd class="px-1.5 py-0.5 rounded bg-black/60 text-[#eaecef] font-mono border border-white/10">Chuột</kbd> Xoay góc nhìn</span>
          <span class="flex items-center gap-1.5"><kbd class="px-1.5 py-0.5 rounded bg-black/60 text-[#eaecef] font-mono border border-white/10">Space</kbd> Nhảy</span>
          <span class="flex items-center gap-1.5"><kbd class="px-1.5 py-0.5 rounded bg-black/60 text-[#eaecef] font-mono border border-white/10">F4</kbd> Đồ họa</span>
          <span class="flex items-center gap-1.5"><kbd class="px-1.5 py-0.5 rounded bg-black/60 text-[#eaecef] font-mono border border-white/10">F5</kbd> Đổi Camera</span>
          <span class="flex items-center gap-1.5"><kbd class="px-1.5 py-0.5 rounded bg-black/60 text-[#eaecef] font-mono border border-white/10">Chuột Phải</kbd> Tương tác</span>
        </div>
      </div>
    </transition>

    <!-- Top Navigation HUD: Binance Web3 Aesthetic (DESIGN-binance.md) -->
    <header class="absolute top-3 inset-x-3 flex items-center justify-between gap-3 pointer-events-none z-20">
      <!-- Left: Wordmark & Dropdown Popover (Phương Án 1) -->
      <div class="flex items-center gap-2 pointer-events-auto">
        <!-- Wordmark Card -->
        <div class="bn-panel flex items-center gap-2.5 rounded-[8px] px-3.5 py-2 shrink-0">
          <div class="w-7 h-7 rounded-[6px] bg-[#FCD535]/10 border border-[#FCD535]/30 flex items-center justify-center text-[#FCD535]">
            <ZenIcon name="pagoda" :size="15" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xs font-bold tracking-tight text-white font-display">VẠN CẢNH THIỀN TỰ</h1>
              <span class="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-[3px] bg-[#FCD535]/15 text-[#FCD535] font-semibold border border-[#FCD535]/30">v0.3.0 // CIP-30</span>
            </div>
            <div class="text-[10px] text-[#929aa5] font-mono flex items-center gap-1.5 mt-0.5">
              <span class="text-[#eaecef] font-medium">{{ user.name }}</span>
              <span class="text-[#474d57]">/</span>
              <span class="text-[#FCD535] font-medium">{{ user.title }}</span>
            </div>
          </div>
        </div>

        <!-- Country Selector Dropdown Popover Button (Phương án 1) -->
        <div class="relative">
          <button
            @click="showCountryMenu = !showCountryMenu"
            class="bn-btn-secondary h-[42px] px-3 rounded-[8px] text-xs font-semibold flex items-center gap-2 transition shadow-sm"
            :class="showCountryMenu ? 'border-[#FCD535] text-[#FCD535] bg-[#2b3139]' : 'hover:border-[#474d57]'"
            title="Đổi quốc gia và khí quyển cổ tự"
          >
            <span class="w-2 h-2 rounded-full bg-[#FCD535] animate-pulse"></span>
            <span class="font-bold text-white">{{ currentCountryObj.code }}</span>
            <span class="text-[#eaecef] hidden sm:inline">{{ currentCountryObj.name }}</span>
            <span class="text-[10px] text-[#929aa5] transition-transform" :class="showCountryMenu ? 'rotate-180' : ''">▾</span>
          </button>

          <!-- Dropdown Popover Menu (9 Countries) -->
          <div
            v-if="showCountryMenu"
            class="absolute top-12 left-0 w-64 p-1.5 rounded-[8px] bg-[#1e2329]/98 border border-[#2b3139] shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-0.5"
          >
            <div class="px-2.5 py-1 text-[10px] font-mono text-[#707a8a] uppercase font-bold tracking-wider border-b border-[#2b3139] mb-1 flex items-center justify-between">
              <span>CỔ TỰ / KHÍ QUYỂN (9 NƯỚC)</span>
              <span>[1-9]</span>
            </div>
            <button
              v-for="c in countries"
              :key="c.id"
              @click="handleCountrySelect(c.id)"
              class="w-full px-2.5 py-2 rounded-[6px] text-xs flex items-center justify-between transition cursor-pointer text-left"
              :class="user.currentCountry === c.id ? 'bg-[#2b3139] text-[#FCD535] font-semibold border border-[#FCD535]/30' : 'text-[#eaecef] hover:bg-[#2b3139]/70 hover:text-white'"
            >
              <div class="flex items-center gap-2.5">
                <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/50 text-[#929aa5] border border-white/5">{{ c.code }}</span>
                <span>{{ c.name }}</span>
              </div>
              <span v-if="user.currentCountry === c.id" class="text-xs text-[#FCD535] font-bold">✓</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Center: 100% Free & Open Sky (No intrusive bar) -->

      <!-- Right: Binance Web3 Utility & Currency Cluster -->
      <div class="flex items-center gap-2 pointer-events-auto shrink-0">
        <!-- Daily Streak -->
        <div class="bn-panel px-2.5 py-1.5 rounded-[6px] flex items-center gap-1.5 text-xs font-mono" title="Chuỗi ngày tu tập chánh niệm (Daily Streak)">
          <ZenIcon name="sparkles" :size="12" class="text-[#FCD535]" />
          <span class="text-white font-bold">{{ user.streakDays }}</span>
          <span class="text-[#929aa5] text-[9px] uppercase tracking-wider">NGÀY TU</span>
        </div>

        <!-- Balance Strip (Tabular Binance Digits) -->
        <div class="bn-panel px-3 py-1.5 rounded-[6px] flex items-center gap-3 text-xs font-mono tabular-nums">
          <div class="flex items-center gap-1.5 text-[#FCD535] font-bold cursor-pointer hover:opacity-80 transition" @click="showWalletModal = true" title="MC coin (bấm để nạp MC bằng ADA)">
            <ZenIcon name="coin" :size="13" class="text-[#FCD535]" />
            <span>{{ economy.meritCoins.toLocaleString() }}</span>
            <span class="text-[9px] text-[#929aa5]">MC</span>
            <span class="ml-0.5 px-1 py-px rounded bg-[#FCD535]/20 text-[#FCD535] text-[9px] font-bold">+</span>
          </div>
          <template v-if="wallet.isConnected">
            <div class="w-px h-3 bg-[#2b3139]"></div>
            <div class="flex items-center gap-1.5 text-[#3b82f6] font-bold cursor-pointer hover:opacity-80 transition" @click="showWalletModal = true" title="Số dư ADA trong ví Cardano">
              <ZenIcon name="cardano" :size="13" class="text-[#3b82f6]" />
              <span>{{ wallet.adaBalance }}</span>
            </div>
          </template>
        </div>

        <!-- Cardano Wallet CIP-30 -->
        <button
          @click="showWalletModal = true"
          class="bn-btn-secondary h-8 text-[#3b82f6] border-[#3b82f6]/30 hover:border-[#3b82f6]"
          title="Kết nối ví Cardano CIP-30 (Eternl)"
        >
          <ZenIcon name="cardano" :size="13" />
          <span class="font-mono text-[11px] font-semibold">
            {{ wallet.isConnected ? wallet.shortAddress : 'VÍ CARDANO' }}
          </span>
          <span v-if="wallet.isTestnet" class="font-mono text-[8px] px-1 py-px rounded-[3px] bg-[#FCD535]/15 text-[#FCD535] font-bold">TESTNET</span>
        </button>

        <!-- Time of Day Switcher -->
        <button
          @click="cycleTimeOfDay"
          class="bn-btn-secondary h-8"
          title="Chuyển thời gian: Ban Ngày / Hoàng Hôn / Ban Đêm"
        >
          <ZenIcon :name="currentTimeOfDay === 'day' ? 'sun' : currentTimeOfDay === 'sunset' ? 'sunset' : 'moon'" :size="13" class="text-[#FCD535]" />
          <span class="font-mono text-[10px] uppercase tracking-wider">
            {{ currentTimeOfDay === 'day' ? 'Day' : currentTimeOfDay === 'sunset' ? 'Sunset' : 'Night' }}
          </span>
        </button>

        <!-- Graphics Quality Switcher (Low / Medium / High / Ultra - Hotkey F4) -->
        <button
          @click="cycleGraphicsQuality"
          class="bn-btn-secondary h-8"
          :class="graphicsQuality === 'ultra' ? 'text-[#FCD535] border-[#FCD535]/40' : ''"
          title="Phím F4: Đổi cấu hình đồ họa (Low / Medium / High / Ultra)"
        >
          <ZenIcon name="sparkles" :size="12" class="text-[#FCD535]" />
          <span class="font-mono text-[10px] uppercase tracking-wider font-bold">
            {{ graphicsQuality.toUpperCase() }} [F4]
          </span>
        </button>

        <!-- Camera Perspective Toggle (F5 Hotkey) -->
        <button
          @click="toggleCamera"
          class="bn-btn-secondary h-8"
          title="Phím F5: Đổi góc nhìn Minecraft (FPP / TPP)"
        >
          <ZenIcon name="camera" :size="13" />
          <span class="font-mono text-[10px] uppercase tracking-wider">
            {{ user.cameraMode === 'fpp' ? 'FPP [F5]' : 'TPP [F5]' }}
          </span>
        </button>

        <!-- Online Pilgrims -> Opens Sangha Tab in Drawer -->
        <button
          @click="openDrawer('sangha')"
          class="bn-btn-secondary h-8 text-[#0ecb81] border-[#0ecb81]/30 hover:border-[#0ecb81]"
          title="Danh sách đồng tu online & Pháp đàm"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-[#0ecb81] animate-pulse"></span>
          <span class="font-mono text-[11px] font-semibold tracking-tight">
            {{ onlinePilgrimCount }} ĐỒNG TU
          </span>
        </button>
      </div>
    </header>

    <!-- Minecraft Crosshair Dấu Thập (+) ở chính giữa màn hình (CHỈ HIỆN Ở GÓC NHÌN THỨ NHẤT - FPP) -->
    <div v-if="user.cameraMode === 'fpp'" class="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
      <div class="relative w-4 h-4 flex items-center justify-center">
        <!-- Đường ngang -->
        <div class="absolute w-3.5 h-[1.5px] bg-white/85 shadow-[0_0_1px_rgba(0,0,0,0.9)]"></div>
        <!-- Đường dọc -->
        <div class="absolute h-3.5 w-[1.5px] bg-white/85 shadow-[0_0_1px_rgba(0,0,0,0.9)]"></div>
        <!-- Điểm sáng vàng tâm ngắm khi vào vùng tương tác -->
        <div v-if="nearTarget" class="w-1.5 h-1.5 bg-[#FCD535] rounded-full animate-ping"></div>
      </div>
    </div>

    <!-- Right-Click Action Toast Pill (Binance Yellow Accent) -->
    <div 
      v-if="nearTarget"
      :class="user.cameraMode === 'fpp' ? 'top-[54%]' : 'bottom-20'"
      class="pointer-events-none absolute left-1/2 -translate-x-1/2 z-20 transition-all duration-150 transform scale-100"
    >
      <div class="bn-panel border border-[#FCD535]/40 px-3.5 py-1.5 rounded-[6px] shadow-2xl flex items-center gap-2 backdrop-blur-md">
        <span class="bg-[#FCD535] text-[#181a20] font-mono font-bold text-[10px] px-1.5 py-0.5 rounded-[3px] tracking-tight">CHUỘT PHẢI</span>
        <ZenIcon :name="nearTarget === 'incense' ? 'incense' : nearTarget === 'merit_box' ? 'coin' : nearTarget === 'meditation' ? 'meditation' : nearTarget === 'lantern' ? 'lotus' : nearTarget === 'door' ? 'pagoda' : 'cards'" :size="13" class="text-[#FCD535]" />
        <span class="text-white text-xs font-semibold tracking-tight">{{ getInteractionPrompt(nearTarget) }}</span>
      </div>
    </div>

    <!-- Bottom Controls: Hotkeys Popover (Left) & Unified Action Island (Right) - Phương án 1 -->
    <div class="absolute bottom-3 inset-x-3 flex items-center justify-between gap-3 pointer-events-none z-20">
      <!-- Left: Compact Hotkey Pill with Popover Cheat Sheet + ALT Indicator -->
      <div class="relative pointer-events-auto flex items-center gap-2">
        <button
          @click="showHotkeysMenu = !showHotkeysMenu"
          class="bn-panel px-3 py-1.5 rounded-[6px] text-[11px] text-[#929aa5] hover:text-white border border-[#2b3139] hover:border-[#474d57] flex items-center gap-2 transition cursor-pointer shadow-lg"
          title="Nhấp để xem bảng phím tắt điều khiển"
        >
          <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/50 text-white border border-white/5">WASD</span>
          <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FCD535] text-[#181a20]">R-CLICK</span>
          <span class="text-[10px] text-[#707a8a] hidden sm:inline">Phím tắt [?]</span>
        </button>

        <!-- Live ALT Mouse Cursor Indicator (Cách 1) -->
        <div 
          class="bn-panel px-2.5 py-1.5 rounded-[6px] text-[11px] font-mono flex items-center gap-1.5 transition select-none shadow-md"
          :class="isAltHeld ? 'border-[#FCD535] text-[#FCD535] bg-[#FCD535]/15' : 'text-[#929aa5] border-[#2b3139]'"
          title="Giữ phím ALT để hiện con trỏ chuột tự do click vào các nút"
        >
          <span 
            class="font-bold px-1.5 py-0.5 rounded text-[10px] transition-all"
            :class="isAltHeld ? 'bg-[#FCD535] text-[#181a20] font-black scale-105' : 'bg-black/60 text-[#eaecef] border border-white/10'"
          >ALT</span>
          <span class="text-[10px] font-medium hidden sm:inline">
            {{ isAltHeld ? 'ĐANG HIỆN CHUỘT' : 'Giữ ALT: Hiện chuột' }}
          </span>
        </div>

        <!-- Full Hotkey Cheat Sheet Popover -->
        <div
          v-if="showHotkeysMenu"
          class="absolute bottom-11 left-0 w-80 p-3 rounded-[8px] bg-[#1e2329]/98 border border-[#2b3139] shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-2"
        >
          <div class="flex items-center justify-between border-b border-[#2b3139] pb-1.5">
            <span class="text-[10px] font-mono text-[#FCD535] uppercase font-bold tracking-wider">PHÍM TẮT ĐIỀU KHIỂN & CHUỘT</span>
            <button @click="showHotkeysMenu = false" class="text-xs text-[#707a8a] hover:text-white cursor-pointer">✕</button>
          </div>
          <div class="grid grid-cols-2 gap-1.5 text-[11px]">
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FCD535] text-[#181a20] font-bold">ALT</span> <span class="text-[#FCD535]">Hiện con trỏ chuột</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">1, 2, 3</span> <span class="text-[#eaecef]">Mở 3 cụm menu</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">W A S D</span> <span class="text-[#929aa5]">Di chuyển</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FCD535] text-[#181a20] font-bold">R-CLICK</span> <span class="text-[#FCD535]">Tương tác</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">SPACE</span> <span class="text-[#929aa5]">Nhảy</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">SHIFT / 2xW</span> <span class="text-[#929aa5]">Chạy nhanh</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">Z</span> <span class="text-[#929aa5]">Đi chậm (Rón rén)</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">F5</span> <span class="text-[#929aa5]">Góc nhìn</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">B</span> <span class="text-[#929aa5]">Chào</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">M</span> <span class="text-[#929aa5]">Tọa thiền</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">C</span> <span class="text-[#929aa5]">Pháp đàm</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-white">X</span> <span class="text-[#929aa5]">Cử chỉ [X]</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-[#0ecb81] font-bold">F3</span> <span class="text-[#0ecb81]">Debug Colliders</span></div>
            <div class="flex items-center gap-1.5"><span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/50 text-[#FCD535] font-bold">F4</span> <span class="text-[#FCD535]">Đồ họa (Low-Ultra)</span></div>
          </div>
        </div>
      </div>

      <!-- Right: 3 Cụm Drop-up Island (Phương Án 2: Triệt tiêu 100% trượt ngang) -->
      <div class="flex items-center gap-2 pointer-events-auto select-none">
        <!-- Cụm 1: Bói Quẻ & Cầu An (Primary Gold Button with Drop-up) -->
        <div class="relative">
          <!-- Drop-up Popover (Appears upward from the button) -->
          <div
            v-if="showDivinationMenu"
            class="absolute bottom-11 right-0 w-64 p-1.5 rounded-[8px] bg-[#1e2329]/98 border border-[#2b3139] shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-1"
          >
            <div class="px-2.5 py-1 text-[10px] font-mono text-[#FCD535] uppercase font-bold tracking-wider border-b border-[#2b3139] flex items-center justify-between">
              <span>BÓI QUẺ 6 MÔN CẦU AN</span>
              <span class="text-[#707a8a] text-[9px]">[Phím 1]</span>
            </div>
            <button
              v-for="cat in FORTUNE_MENU_ITEMS"
              :key="cat.id"
              @click="openFortuneCategory(cat.id)"
              class="w-full px-2.5 py-1.5 rounded-[6px] text-xs flex items-center justify-between text-[#eaecef] hover:bg-[#2b3139] hover:text-[#FCD535] transition cursor-pointer text-left"
            >
              <div class="flex items-center gap-2">
                <ZenIcon :name="cat.icon" :size="13" class="text-[#FCD535]" />
                <span class="font-medium">{{ cat.name }}</span>
              </div>
              <span class="text-[10px] text-[#707a8a] font-mono">{{ cat.short }}</span>
            </button>
          </div>

          <!-- Trigger Button (Hotkey [1]) -->
          <button
            @click="toggleDivinationMenu"
            class="bn-btn-primary h-8 px-3 rounded-[6px] font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
            :class="showDivinationMenu ? 'ring-2 ring-[#FCD535]/50' : ''"
            title="Bấm phím [1] hoặc nhấp chuột để mở Bói Quẻ 6 Môn"
          >
            <ZenIcon name="sparkles" :size="13" class="text-[#181a20]" />
            <span>Bói Quẻ & Cầu An</span>
            <span class="font-mono text-[9px] px-1 py-0.2 rounded bg-black/20 text-[#181a20] font-extrabold">[1]</span>
            <span class="text-[10px] transition-transform" :class="showDivinationMenu ? 'rotate-180' : ''">▴</span>
          </button>
        </div>

        <!-- Cụm 2: Thiền & Công Đức (Secondary Drop-up - Hotkey [2]) -->
        <div class="relative">
          <div
            v-if="showMeditationMenu"
            class="absolute bottom-11 right-0 w-60 p-1.5 rounded-[8px] bg-[#1e2329]/98 border border-[#2b3139] shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-1"
          >
            <div class="px-2.5 py-1 text-[10px] font-mono text-[#0ecb81] uppercase font-bold tracking-wider border-b border-[#2b3139] flex items-center justify-between">
              <span>HÀNH TRÌ & PHƯỚC ĐỨC</span>
              <span class="text-[#707a8a] text-[9px]">[Phím 2]</span>
            </div>
            <button
              @click="openDrawerFromDropup('merit')"
              class="w-full px-2.5 py-2 rounded-[6px] text-xs flex items-center gap-2 text-[#eaecef] hover:bg-[#2b3139] hover:text-[#FCD535] transition cursor-pointer text-left"
            >
              <ZenIcon name="coin" :size="13" class="text-[#FCD535]" />
              <div>
                <div class="font-medium">Hòm Công Đức Tam Bảo</div>
                <div class="text-[10px] text-[#707a8a]">Tâm Duyên · Sen Vàng · Cardano ADA</div>
              </div>
            </button>
            <button
              @click="openDrawerFromDropup('meditation')"
              class="w-full px-2.5 py-2 rounded-[6px] text-xs flex items-center gap-2 text-[#eaecef] hover:bg-[#2b3139] hover:text-[#0ecb81] transition cursor-pointer text-left"
            >
              <ZenIcon name="meditation" :size="13" class="text-[#0ecb81]" />
              <div>
                <div class="font-medium">Hội Thiền 432Hz</div>
                <div class="text-[10px] text-[#707a8a]">Chuông xoay · Điều tức Mandala 4-4-6</div>
              </div>
            </button>
            <button
              @click="openDrawerFromDropup('sangha')"
              class="w-full px-2.5 py-2 rounded-[6px] text-xs flex items-center gap-2 text-[#eaecef] hover:bg-[#2b3139] hover:text-[#3b82f6] transition cursor-pointer text-left"
            >
              <ZenIcon name="message" :size="13" class="text-[#3b82f6]" />
              <div>
                <div class="font-medium">Pháp Đàm & Đồng Tu</div>
                <div class="text-[10px] text-[#707a8a]">Lời nguyện chánh niệm · {{ onlinePilgrimCount }} online</div>
              </div>
            </button>
          </div>

          <button
            @click="toggleMeditationMenu"
            class="bn-btn-secondary h-8 px-2.5 rounded-[6px] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            :class="showMeditationMenu ? 'border-[#0ecb81] text-[#0ecb81] bg-[#2b3139]' : ''"
            title="Bấm phím [2] hoặc nhấp chuột để mở Thiền & Công Đức"
          >
            <ZenIcon name="meditation" :size="13" class="text-[#0ecb81]" />
            <span>Thiền & Công Đức</span>
            <span class="font-mono text-[9px] px-1 py-0.2 rounded bg-white/10 text-[#0ecb81] font-bold">[2]</span>
            <span class="text-[10px] transition-transform" :class="showMeditationMenu ? 'rotate-180' : ''">▴</span>
          </button>
        </div>

        <!-- Cụm 3: Di Sản & Cửa Hàng (Secondary Drop-up - Hotkey [3]) -->
        <div class="relative">
          <div
            v-if="showHeritageMenu"
            class="absolute bottom-11 right-0 w-60 p-1.5 rounded-[8px] bg-[#1e2329]/98 border border-[#2b3139] shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-1"
          >
            <div class="px-2.5 py-1 text-[10px] font-mono text-[#3b82f6] uppercase font-bold tracking-wider border-b border-[#2b3139] flex items-center justify-between">
              <span>DI SẢN & BẢO VẬT</span>
              <span class="text-[#707a8a] text-[9px]">[Phím 3]</span>
            </div>
            <button
              @click="openDrawerFromDropup('shop')"
              class="w-full px-2.5 py-2 rounded-[6px] text-xs flex items-center gap-2 text-[#eaecef] hover:bg-[#2b3139] hover:text-pink-300 transition cursor-pointer text-left"
            >
              <ZenIcon name="lotus" :size="13" class="text-pink-300" />
              <div>
                <div class="font-medium">Cửa Hàng Pháp Bảo</div>
                <div class="text-[10px] text-[#707a8a]">Cổ phục 9 nước · Nhang trầm · Lễ vật</div>
              </div>
            </button>
            <button
              @click="openDrawerFromDropup('cards')"
              class="w-full px-2.5 py-2 rounded-[6px] text-xs flex items-center gap-2 text-[#eaecef] hover:bg-[#2b3139] hover:text-[#3b82f6] transition cursor-pointer text-left"
            >
              <ZenIcon name="cards" :size="13" class="text-[#3b82f6]" />
              <div>
                <div class="font-medium">Thẻ Bài Di Sản 3D</div>
                <div class="text-[10px] text-[#707a8a]">10 Cổ tự mini · Audio · NFT CIP-68</div>
              </div>
            </button>
            <button
              @click="openDrawerFromDropup('soundscape')"
              class="w-full px-2.5 py-2 rounded-[6px] text-xs flex items-center gap-2 text-[#eaecef] hover:bg-[#2b3139] hover:text-[#FCD535] transition cursor-pointer text-left"
            >
              <ZenIcon name="bell" :size="13" class="text-[#FCD535]" />
              <div>
                <div class="font-medium">Bộ Trộn Âm Thanh 3D</div>
                <div class="text-[10px] text-[#707a8a]">6 Kênh âm cảnh không gian thời gian thực</div>
              </div>
            </button>
            <button
              @click="showDisclaimer = true; closeAllDropups()"
              class="w-full px-2.5 py-1.5 rounded-[6px] text-[11px] flex items-center gap-2 text-[#707a8a] hover:bg-[#2b3139] hover:text-white transition cursor-pointer text-left border-t border-[#2b3139]/60 mt-0.5"
            >
              <ZenIcon name="shield" :size="12" />
              <span>Quy Chuẩn Trải Nghiệm & Pháp Lý</span>
            </button>
          </div>

          <button
            @click="toggleHeritageMenu"
            class="bn-btn-secondary h-8 px-2.5 rounded-[6px] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            :class="showHeritageMenu ? 'border-[#3b82f6] text-[#3b82f6] bg-[#2b3139]' : ''"
            title="Bấm phím [3] hoặc nhấp chuột để mở Di Sản & Cửa Hàng"
          >
            <ZenIcon name="cards" :size="13" class="text-[#3b82f6]" />
            <span>Di Sản & Cửa Hàng</span>
            <span class="font-mono text-[9px] px-1 py-0.2 rounded bg-white/10 text-[#3b82f6] font-bold">[3]</span>
            <span class="text-[10px] transition-transform" :class="showHeritageMenu ? 'rotate-180' : ''">▴</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Toast Notification Banner (Binance Styling) -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-2 opacity-0"
    >
      <div v-if="toastMessage" class="fixed top-16 right-3 z-50 pointer-events-none">
        <div class="bn-panel border border-[#FCD535]/30 px-3.5 py-2 rounded-[6px] shadow-2xl flex items-center gap-2.5 backdrop-blur-md">
          <div class="w-6 h-6 rounded-[4px] bg-[#FCD535]/15 flex items-center justify-center text-[#FCD535] shrink-0">
            <ZenIcon :name="toastMessage.icon as any" :size="13" />
          </div>
          <div>
            <div class="text-xs font-bold text-white tracking-tight">{{ toastMessage.title }}</div>
            <div class="text-[11px] text-[#929aa5] leading-tight">{{ toastMessage.desc }}</div>
          </div>
        </div>
      </div>
    </transition>

    <!-- ========================================================================= -->
    <!-- UNIFIED RIGHT-SIDE MODAL DRAWER (Matches the user's "MD" red box layout)  -->
    <!-- ========================================================================= -->
    <SanctuaryDrawer 
      v-model="drawerOpen" 
      :active-tab="drawerTab"
      :online-count="onlinePilgrimCount"
      :remote-pilgrims="remotePilgrimsList"
      :initial-fortune-category="selectedFortuneCategory"
      @outfit-changed="handleShopOutfitChanged"
      @greet-pilgrim="handleBowToPilgrim"
      @send-mantra="handleSendChat"
      @update:active-tab="(t) => drawerTab = t"
    />

    <!-- Overlays & Modals for specific operations -->
    <WalletConnectModal v-if="showWalletModal" @close="showWalletModal = false" />
    <EmoteWheel v-if="showEmoteWheel" @close="showEmoteWheel = false" @select-emote="handleSelectEmote" />
    <DisclaimerBanner v-if="showDisclaimer" @close="showDisclaimer = false" />
  </div>
</template>

