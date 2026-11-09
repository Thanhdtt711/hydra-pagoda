<script setup lang="ts">
import { TempleStage, type InteractionTarget } from '~/lib/world3d/TempleStage'
import { zenAudio } from '~/lib/audio/ZenAudio'
import { useUserStore, type CountryId } from '~/stores/user'
import { useEconomyStore } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'
import { useMeditationStore } from '~/stores/meditation'
import { useHauDongStore } from '~/stores/hauDong'
import { MultiplayerClient, type PilgrimPresence, type ZenChatMessage } from '~/lib/network/MultiplayerClient'
import SanctuaryDrawer, { type DrawerTab } from '~/components/SanctuaryDrawer.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiKeycap from '~/components/ui/UiKeycap.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiStatCell from '~/components/ui/UiStatCell.vue'
import ZenIcon from '~/components/ZenIcon.vue'
import { DEV_HINTS, INTERACT_HINT, hintsFor } from '~/lib/ui/controlHints'

const user = useUserStore()
const economy = useEconomyStore()
const wallet = useWalletStore()
const hydra = useHydraStore()
const meditation = useMeditationStore()
const hauDong = useHauDongStore()

// Gợi ý phím dùng chung (lib/ui/controlHints.ts)
const loadingHints = hintsFor('loading')
const pillHints = hintsFor('pill')
const cheatHints = hintsFor('cheat')
const interactHint = INTERACT_HINT
const devHints = DEV_HINTS
const showDevHints = ref(false)

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
  openWalletModal()
})

const nearTarget = ref<InteractionTarget>(null)
const isNearFortune = ref(false)
const isNearMerit = ref(false)
const isInsideHauDong = ref(false)
const currentTimeOfDay = ref<'day' | 'sunset' | 'night'>('day')
let hauDongSyncTimer: ReturnType<typeof setInterval> | null = null

function syncHauDongToStage() {
  if (!stage) return
  const s = hauDong.activeSession
  if (s) {
    const deityMap: Record<string, string> = {
      quan_lon_de_tam: 'quan_de_tam',
      chau_doi_thuong_ngan: 'chau_doi',
      ong_hoang_muoi: 'ong_hoang_muoi',
      co_doi_thuong_ngan: 'co_doi',
      cau_be_hoang_tu: 'cau_be',
      duc_ong_tran_trieu: 'duc_ong_tran_trieu',
      ong_hoang_bay: 'ong_hoang_bay'
    }
    const stepMap: Record<number, string> = {
      1: 'costume',
      2: 'incense',
      3: 'descent',
      4: 'dance',
      5: 'blessing',
      6: 'ascent'
    }
    stage.hauDongVisualState = {
      active: true,
      stageIndex: Math.max(0, (s.giaIndex || 1) - 1),
      totalStages: 5,
      deityId: (deityMap[s.deityId] || 'quan_de_tam') as any,
      deityName: s.deityName,
      palaceName: s.palace,
      palaceColorHex: parseInt((s.colorHex || '#fcd535').replace('#', ''), 16) || 0xfcd535,
      stepId: (stepMap[s.stepId] || 'dance') as any,
      stepLabel: `Bước ${s.stepId}/6: ${s.stepName}`,
      stageElapsedSec: s.secInGia || 0,
      sponsorName: s.sponsorName
    }
    zenAudio.syncChauVanAudio(isInsideHauDong.value, s.deityId, s.stepId)
  } else {
    if (stage.hauDongVisualState) {
      stage.hauDongVisualState.active = false
    }
    zenAudio.stopChauVanAudio()
  }
}

// Multiplayer state
const remotePilgrimsList = ref<PilgrimPresence[]>([])
const onlinePilgrimCount = ref(1)
const chatMessages = ref<ZenChatMessage[]>([])
const isMeditating = ref(false)

// Right-Side Modal Drawer (like hydra-graveyard)
const drawerOpen = ref(false)
const drawerTab = ref<DrawerTab>('fortune')

// Emote Wheel & Wallet Modals
const showWalletModal = ref(false)
const showEmoteWheel = ref(false)
const showDisclaimer = ref(false)
const isAudioMuted = ref(false)

function openDrawer(tab: DrawerTab) {
  if (stage) {
    stage.exitPointerLock()
    isNearFortune.value = stage.isNearFortune()
    isNearMerit.value = stage.isNearMerit()
  }
  showWalletModal.value = false
  showEmoteWheel.value = false
  showDisclaimer.value = false
  drawerTab.value = tab
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
}

function openWalletModal() {
  if (stage) stage.exitPointerLock()
  drawerOpen.value = false
  showEmoteWheel.value = false
  showDisclaimer.value = false
  showWalletModal.value = true
}

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
    stage.setCountry(user.currentCountry as any)
    stage.setGender(user.gender)
    stage.onNearTarget = (target) => {
      nearTarget.value = target
    }
    stage.onRightClick = (target) => {
      handleRightClickAction(target)
    }
    stage.onCameraModeChange = (mode) => {
      user.setCameraMode(mode)
    }
    stage.onPointerLockStateChange = (locked) => {
      isPointerLocked.value = locked
      if (locked) hasEverLocked.value = true
    }

    // Khởi tạo Realtime Sangha Hub WebSocket Client
    multiplayer = new MultiplayerClient()

    stage.onLocalMove = (pos, yaw, isMoving) => {
      multiplayer?.streamMove(pos, yaw, isMoving)
      if (stage) {
        isNearFortune.value = stage.isNearFortune()
        isNearMerit.value = stage.isNearMerit()
        const insideHd = stage.isInsideHauDongZone()
        if (insideHd !== isInsideHauDong.value) {
          isInsideHauDong.value = insideHd
          syncHauDongToStage()
        }
      }
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
      gender: user.gender,
      position: stage ? [stage.playerPos.x, stage.playerPos.y, stage.playerPos.z] : [0, 0, 10],
      yaw: stage ? stage.yaw : 0,
      ticket: await wallet.fetchWsTicket()
    })
    void multiplayer.rejoin()

    // Tự kết nối lại ví nếu phiên còn hạn và ví vẫn bật cùng tài khoản, đồng thời tải danh mục MC từ server.
    void economy.loadCatalog()
    void wallet.restore()
    void meditation.refreshStatus()
    void hauDong.refreshStatus().then(() => {
      syncHauDongToStage()
    })

    hauDongSyncTimer = setInterval(async () => {
      if (stage) {
        isInsideHauDong.value = stage.isInsideHauDongZone()
      }
      if (isInsideHauDong.value) {
        await hauDong.sendHeartbeat(true, 2)
      } else {
        await hauDong.refreshStatus()
      }
      syncHauDongToStage()
    }, 2000)

    meditation.attachStage({
      isInsideSanctuary: () => stage?.isInsideSanctuary() ?? false,
      getPlayerXZ: () => stage?.getPlayerXZ() ?? { x: 0, z: 0 },
      walkToSlot: (slot, onArrive, onAbort) => {
        stage?.walkToMeditationSlot(slot, onArrive, onAbort)
      },
      guideToEntrance: (onArrive, onAbort) => {
        stage?.guidePlayerToSanctuaryEntrance(onArrive, onAbort)
      },
      standUp: () => {
        stage?.standUpFromMeditation()
      },
      cancelWalk: () => {
        stage?.cancelAutoWalk()
      }
    })

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

onMounted(() => {
  hydra.startPolling()
})

onUnmounted(() => {
  hydra.stopPolling()
  meditation.detachStage()
  zenAudio.stopChauVanAudio()
  if (hauDongSyncTimer) {
    clearInterval(hauDongSyncTimer)
    hauDongSyncTimer = null
  }
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

// Trạng thái pointer lock: dùng cho chip "Nhấp vào cảnh để tiếp tục điều khiển"
const isPointerLocked = ref(false)
const hasEverLocked = ref(false)

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
  } else if (e.code === 'KeyG') {
    toggleGender()
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
  void multiplayer?.rejoin()
}

function handleGenderSelect(gender: 'female' | 'male') {
  user.setGender(gender)
  if (stage) {
    stage.setGender(gender)
  }
  void multiplayer?.rejoin()
  zenAudio.playWoodenFish()
  showToast(
    'Nhân vật Hành Giả [G]',
    gender === 'male' ? 'Đã chọn Nam Hành Giả (tóc ngắn gọn gàng)' : 'Đã chọn Nữ Hành Giả (tóc dài truyền thống)',
    'sparkles'
  )
}

function toggleGender() {
  handleGenderSelect(user.gender === 'female' ? 'male' : 'female')
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

function handleGuideToFortune() {
  if (!stage) return
  showToast('Dẫn đường', 'Đang bước tới Bàn Xin Xăm & Pháp Bảo...', 'fortune')
  stage.walkToFortuneTable(
    () => {
      isNearFortune.value = true
      showToast('Đã đến Bàn Xin Xăm', 'Bạn đã đến bàn gieo quẻ. Hãy thỉnh quẻ cầu an.', 'fortune')
    },
    () => {
      showToast('Chưa thể tự bước', 'Đường đi bị cản trở, xin tự di chuyển lại gần bàn xem quẻ.', 'info')
    }
  )
}

function handleGuideToMerit() {
  if (!stage) return
  showToast('Dẫn đường', 'Đang bước tới Hòm Công Đức Tam Bảo...', 'coin')
  stage.walkToMeritBox(
    () => {
      isNearMerit.value = true
      showToast('Đã đến Hòm Công Đức', 'Bạn đã đến trước hòm công đức. Hãy phát tâm cúng dường.', 'coin')
    },
    () => {
      showToast('Chưa thể tự bước', 'Đường đi bị cản trở, xin tự di chuyển lại gần hòm công đức.', 'info')
    }
  )
}

function handleGuideToHauDong() {
  if (!stage) return
  drawerOpen.value = false
  showToast('Dẫn đường', 'Đang bước sang Điện Thờ Tứ Phủ (Nhà Hầu Đồng phía Đông)...', 'pagoda')
  stage.walkToHauDongHall(
    () => {
      isInsideHauDong.value = stage?.isInsideHauDongZone() ?? true
      syncHauDongToStage()
      showToast('Đã tới Nhà Hầu Đồng', 'Bạn đã vào khu vực Chiếu Hầu Tứ Phủ. Đợi Bước 5 mỗi giá để thỉnh lộc MC!', 'sparkles')
    },
    () => {
      showToast('Chưa thể tự bước', 'Đường đi bị cản trở, xin tự di chuyển sang phía Đông sân chùa.', 'info')
    }
  )
}

async function handleQuickClaimHauDong() {
  if (!wallet.isConnected) {
    openWalletModal()
    return
  }
  try {
    const res = await hauDong.claimBlessing()
    if (res) {
      zenAudio.playCoinDrop()
      showToast('Thỉnh Lộc Tứ Phủ', `Đã nhận +${res.creditedMc} MC (${res.blessingTitle})`, 'coin')
    }
  } catch (e: any) {
    showToast('Chưa thể thỉnh lộc', e?.data?.message || 'Xin đợi tới Bước 5 (Ban Lộc) của giá đồng', 'info')
  }
}

function toggleCamera() {
  if (stage) {
    stage.cycleCameraMode()
  } else {
    user.cycleCamera()
  }
}

// Hotkeys Modal & Display Menu
const showHotkeysMenu = ref(false)
const showDisplayMenu = ref(false)

// Drop-up Menus (Phương án 2: 3 Cụm Drop-up triệt tiêu 100% trượt ngang)
const showDivinationMenu = ref(false)
const showMeditationMenu = ref(false)
const showHeritageMenu = ref(false)

// Chip nhắc nhấp vào cảnh để lấy lại điều khiển khi pointer lock bị mất
const showResumeChip = computed(
  () =>
    !isSceneLoading.value &&
    !isPointerLocked.value &&
    !isAltHeld.value &&
    !drawerOpen.value &&
    !showEmoteWheel.value &&
    !showWalletModal.value &&
    !showDisclaimer.value &&
    !showHotkeysMenu.value &&
    !showDisplayMenu.value &&
    !showDivinationMenu.value &&
    !showMeditationMenu.value &&
    !showHeritageMenu.value
)
const selectedFortuneCategory = ref<any>('stick')

const FORTUNE_MENU_ITEMS = [
  { id: 'stick', index: '01', name: 'Xin Xăm Bát Quái', short: 'Bổn mạng & Sự nghiệp' },
  { id: 'love', index: '02', name: 'Tơ Duyên Tương Ngộ', short: 'Nguyệt Lão chỉ hồng' },
  { id: 'family', index: '03', name: 'Cầu Tự Con Cái', short: 'Quan Âm Tống Tử' },
  { id: 'wealth', index: '04', name: 'Chiêu Tài Tấn Bảo', short: 'Kinh doanh phát đạt' },
  { id: 'health', index: '05', name: 'Dược Sư An Khang', short: 'Tiêu tai trừ bệnh' },
  { id: 'star', index: '06', name: 'Dâng Sao Giải Hạn', short: 'Bắc Đẩu Thất Tinh' }
]

function closeAllDropups() {
  showDivinationMenu.value = false
  showMeditationMenu.value = false
  showHeritageMenu.value = false
  showDisplayMenu.value = false
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
  zenAudio.playTempleBell()
  if (stage) {
    stage.setCountry(cId as any)
  }
}

// Chuột phải vào không gian trống chỉ phát mõ tối đa 1 lần/giây để không bị spam
const IDLE_WOODEN_FISH_COOLDOWN_MS = 1000
let lastIdleWoodenFishAt = 0

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
  } else if (target === 'hau_dong') {
    openDrawer('hau_dong')
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
    const nowTs = performance.now()
    if (nowTs - lastIdleWoodenFishAt >= IDLE_WOODEN_FISH_COOLDOWN_MS) {
      lastIdleWoodenFishAt = nowTs
      zenAudio.playWoodenFish()
    }
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
  if (target === 'hau_dong') return 'Mở Đàn & Thỉnh Lộc Nhà Hầu Đồng (Tứ Phủ)'
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
        class="fixed inset-0 z-50 bg-[var(--bg-0)] flex flex-col items-center justify-center p-6 text-center select-none"
      >
        <!-- Title & Subtitle -->
        <h2 class="ui-font-serif text-[24px] font-bold tracking-tight text-[var(--text-primary)] mb-2">Vạn Cảnh Thiền Tự</h2>
        <p class="text-[13px] text-[var(--text-secondary)] mb-8">Không gian 3D Thiền Tự & Chiêm Bốc Tâm Linh</p>

        <!-- Progress Bar -->
        <div class="w-72 sm:w-96 h-2 bg-[var(--bg-2)] rounded-full overflow-hidden mb-3 border border-[var(--border-subtle)]">
          <div
            class="h-full bg-[var(--gold-primary)] transition-all duration-200 ease-out rounded-full"
            :style="{ width: `${loadingProgress}%` }"
          ></div>
        </div>
        <div class="text-[13px] text-[var(--text-secondary)] mb-8">
          Đang tải cảnh giới thiền môn... <span class="ui-font-mono font-semibold text-[var(--text-primary)]">{{ loadingProgress }}%</span>
        </div>

        <!-- Zen Quote -->
        <div class="max-w-md px-6 py-4 rounded-[12px] bg-[var(--bg-1)] border border-[var(--border-subtle)] text-[14px] italic text-[var(--text-primary)] leading-relaxed mb-8">
          "{{ currentZenQuote }}"
        </div>

        <!-- Controls Cheat Sheet -->
        <div class="flex flex-wrap items-center justify-center gap-4 text-[13px] text-[var(--text-secondary)]">
          <span v-for="h in loadingHints" :key="h.id" class="flex items-center gap-1.5">
            <template v-for="(k, ki) in h.keys" :key="k"><span v-if="ki > 0">{{ h.sep }}</span><UiKeycap>{{ k }}</UiKeycap></template>
            {{ h.label }}
          </span>
        </div>
      </div>
    </transition>

    <!-- Top Navigation HUD (Flat 56px Bar, Solid #0b0e11, Hairline #2b3139) -->
    <header class="hud-top-bar">
      <!-- Left: Temple Wordmark, Version & Realm, Country Selector -->
      <div class="hud-top-bar__left">
        <div class="hud-brand">
          <div class="hud-brand__title-row">
            <span class="hud-brand__title">VẠN CẢNH THIỀN TỰ</span>
            <UiBadge variant="neutral">v0.3.0 // CIP-30</UiBadge>
          </div>
          <div class="hud-brand__user-row">
            <span class="hud-brand__user-name">{{ user.name }}</span>
            <span class="hud-divider">·</span>
            <span class="hud-brand__user-title">{{ user.title }}</span>
          </div>
        </div>

        <!-- Country Indicator (Non-clickable label per Binance Spec) -->
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-elevated border border-hairline text-secondary select-none" title="Quốc gia hiện tại (Nhấn phím 1-9 để chuyển)">
          <span class="hud-status-dot hud-status-dot--success" aria-hidden="true" />
          <span class="font-numbers font-bold text-xs text-secondary">{{ currentCountryObj.code }}</span>
          <span class="hidden sm:inline font-semibold text-xs text-primary">{{ currentCountryObj.name }}</span>
        </div>

        <!-- Gender Switch Button (Nam / Nữ Hành Giả) -->
        <button
          type="button"
          @click="toggleGender"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-elevated hover:bg-[#363c45] border border-hairline hover:border-gold text-xs font-semibold text-white transition cursor-pointer ui-focus-ring"
          title="Đổi giới tính nhân vật Nam / Nữ (Phím tắt: G)"
        >
          <span class="text-primary font-bold">{{ user.gender === 'male' ? 'Nam' : 'Nữ' }}</span>
          <span class="hidden md:inline text-secondary">Hành Giả</span>
        </button>
      </div>

      <!-- Right: Stats & Utilities -->
      <div class="hud-top-bar__right">
        <!-- Daily Streak Stat -->
        <UiStatCell
          label="Ngày Tu"
          :value="user.streakDays"
          size="sm"
          class="hud-stat-cell"
        />

        <div class="hud-v-divider" />

        <!-- Merit Coins Stat + Top-up -->
        <UiStatCell
          label="Hành Trang"
          :value="economy.meritCoins.toLocaleString()"
          unit="MC"
          highlight
          size="sm"
          class="hud-stat-cell"
        >
          <template #action>
            <UiButton variant="primary" size="sm" class="ml-2" @click="openWalletModal()">
              + Nạp
            </UiButton>
          </template>
        </UiStatCell>

        <div class="hud-v-divider" />

        <!-- Cardano Wallet Status Button -->
        <button
          type="button"
          @click="openWalletModal()"
          class="hud-wallet-btn ui-focus-ring"
          title="Kết nối ví Cardano (Eternl)"
        >
          <span
            class="hud-status-dot"
            :class="wallet.isConnected ? 'hud-status-dot--success' : 'hud-status-dot--warning'"
            aria-hidden="true"
          />
          <span class="text-sm font-semibold" :class="wallet.isConnected ? 'font-numbers' : ''">
            {{ wallet.isConnected ? wallet.shortAddress : 'Ví Cardano' }}
          </span>
          <UiBadge v-if="wallet.isTestnet" variant="warning">TESTNET</UiBadge>
          </button>
          
          <!-- Chỉ báo chế độ sổ cái: Hydra L2 hay SQLite -->
          <span class="hud-ledger-wrap" :title="hydra.modeDescription">
            <span
              class="hud-ledger-mode ui-focus-ring"
              tabindex="0"
              role="status"
              :aria-label="`Chế độ sổ cái: ${hydra.modeLabel}. ${hydra.modeDescription}`"
              data-testid="hud-ledger-mode"
            >
              <UiBadge :variant="!hydra.loaded ? 'neutral' : hydra.isL2Active ? 'success' : 'neutral'" dot>
                {{ hydra.loaded ? hydra.modeLabel : '…' }}
              </UiBadge>
            </span>
          </span>

        <div class="hud-v-divider" />

        <!-- Display & Camera Settings Dropdown ("Hiển thị") -->
        <div class="relative">
          <button
            type="button"
            @click="showDisplayMenu = !showDisplayMenu"
            class="hud-icon-btn hud-display-btn ui-focus-ring"
            :class="{ 'is-active': showDisplayMenu }"
            title="Tùy chỉnh Thời gian, Đồ họa (F4) và Góc nhìn (V / F5)"
          >
            <span class="text-xs font-semibold">Hiển thị</span>
            <ZenIcon name="chevron-down" :size="14" class="transition-transform" :class="showDisplayMenu ? 'rotate-180' : ''" />
          </button>

          <div
            v-if="showDisplayMenu"
            class="hud-popover hud-popover--display"
          >
            <div class="hud-popover__header">
              <span class="text-xs font-semibold text-secondary uppercase tracking-wider">Cài đặt hiển thị &amp; Góc nhìn</span>
            </div>
            <div class="hud-popover__list">
              <button
                type="button"
                @click="cycleTimeOfDay"
                class="hud-popover__item hud-popover__item--row ui-focus-ring"
              >
                <div>
                  <div class="text-sm font-semibold">Thời gian</div>
                  <div class="text-xs text-secondary">
                    {{ currentTimeOfDay === 'day' ? 'Ban ngày' : currentTimeOfDay === 'sunset' ? 'Hoàng hôn' : 'Ban đêm' }}
                  </div>
                </div>
                <UiKeycap>{{ currentTimeOfDay.toUpperCase() }}</UiKeycap>
              </button>

              <button
                type="button"
                @click="cycleGraphicsQuality"
                class="hud-popover__item hud-popover__item--row ui-focus-ring"
              >
                <div>
                  <div class="text-sm font-semibold">Đồ họa</div>
                  <div class="text-xs text-secondary uppercase font-numbers">
                    {{ graphicsQuality }}
                  </div>
                </div>
                <UiKeycap>F4</UiKeycap>
              </button>

              <button
                type="button"
                @click="toggleCamera"
                class="hud-popover__item hud-popover__item--row ui-focus-ring"
              >
                <div>
                  <div class="text-sm font-semibold">Góc nhìn</div>
                  <div class="text-xs text-secondary">
                    {{ user.cameraMode === 'fpp' ? 'Góc nhìn thứ nhất (FPP)' : 'Góc nhìn thứ ba (TPP)' }}
                  </div>
                </div>
                <UiKeycap>V / F5</UiKeycap>
              </button>

              <button
                type="button"
                @click="toggleGender"
                class="hud-popover__item hud-popover__item--row ui-focus-ring"
              >
                <div>
                  <div class="text-sm font-semibold">Nhân vật</div>
                  <div class="text-xs text-secondary">
                    {{ user.gender === 'male' ? 'Nam Hành Giả (Tóc ngắn)' : 'Nữ Hành Giả (Tóc dài)' }}
                  </div>
                </div>
                <UiKeycap>G</UiKeycap>
              </button>
            </div>
          </div>
        </div>

        <!-- Audio Mute / Unmute Button (Icon-Only Whitelisted Item #7) -->
        <button
          type="button"
          @click="toggleAudio"
          aria-label="Bật hoặc tắt âm thanh thiền tự"
          title="Bật hoặc tắt âm thanh thiền tự"
          class="hud-icon-btn ui-focus-ring"
        >
          <ZenIcon :name="isAudioMuted ? 'volume-x' : 'volume-2'" :size="18" />
        </button>

        <!-- Online Pilgrims Chip -->
        <button
          type="button"
          @click="openDrawer('sangha')"
          class="hud-sangha-btn ui-focus-ring"
          title="Danh sách đồng tu đang trực tuyến &amp; Pháp đàm"
        >
          <span class="hud-status-dot hud-status-dot--success" aria-hidden="true" />
          <span class="font-numbers text-sm font-bold">{{ onlinePilgrimCount }}</span>
          <span class="text-xs text-secondary">Đồng Tu</span>
        </button>
      </div>
    </header>

    <!-- Minecraft Crosshair Dấu Thập (+) ở chính giữa màn hình (CHỈ HIỆN Ở GÓC NHÌN THỨ NHẤT - FPP) -->
    <div v-if="user.cameraMode === 'fpp'" class="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
      <div class="relative w-4 h-4 flex items-center justify-center">
        <div class="absolute w-3.5 h-[1.5px] bg-white/85 shadow-[0_0_1px_rgba(0,0,0,0.9)]"></div>
        <div class="absolute h-3.5 w-[1.5px] bg-white/85 shadow-[0_0_1px_rgba(0,0,0,0.9)]"></div>
        <div v-if="nearTarget" class="w-1.5 h-1.5 bg-[var(--gold-primary)] rounded-full animate-ping"></div>
      </div>
    </div>

    <!-- Right-Click Action Toast Pill -->
    <div
      v-if="nearTarget"
      :class="user.cameraMode === 'fpp' ? 'top-[54%]' : 'bottom-20'"
      class="pointer-events-none absolute left-1/2 -translate-x-1/2 z-20 transition-all duration-150 transform scale-100"
    >
      <div class="bg-surface-card border border-gold px-4 py-2 rounded-md shadow-2xl flex items-center gap-2.5">
        <template v-for="(k, ki) in interactHint.keys" :key="k">
          <span v-if="ki > 0" class="text-secondary text-xs">{{ interactHint.sep }}</span>
          <UiKeycap>{{ k }}</UiKeycap>
        </template>
        <span class="text-white text-sm font-semibold">{{ getInteractionPrompt(nearTarget) }}</span>
      </div>
    </div>

    <!-- Chip nhắc lấy lại điều khiển khi mất pointer lock -->
    <div
      v-if="showResumeChip"
      role="status"
      class="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-20 px-3.5 py-2 rounded-md bg-surface-card border border-hairline shadow-lg text-xs text-secondary"
    >
      {{ hasEverLocked ? 'Nhấp vào cảnh để tiếp tục điều khiển' : 'Nhấp vào cảnh để bắt đầu điều khiển' }}
    </div>

    <!-- ========================================================================= -->
    <!-- BẢNG HUD DỰ LỄ HẦU ĐỒNG (HIỆN TỰ ĐỘNG KHI BƯỚC VÀO NHÀ HẦU ĐỒNG TỨ PHỦ)   -->
    <!-- ========================================================================= -->
    <div
      v-if="isInsideHauDong && hauDong.activeSession"
      class="pointer-events-auto absolute top-16 left-4 z-20 w-80 p-3 rounded-md bg-surface-card border border-[var(--primary,#fcd535)] shadow-2xl space-y-2"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-[var(--trading-up,#0ecb81)] animate-pulse" />
          <span class="text-xs font-bold uppercase tracking-wider text-primary font-numbers">
            ĐIỆN TỨ PHỦ · GIÁ {{ hauDong.activeSession.giaIndex }}/5
          </span>
        </div>
        <span class="text-xs font-numbers text-secondary">
          Còn {{ hauDong.activeSession.stepRemainingSec }}s
        </span>
      </div>

      <div>
        <div class="text-sm font-bold text-white leading-tight">
          {{ hauDong.activeSession.deityName }}
        </div>
        <div class="text-xs text-secondary mt-0.5">
          Bước <span class="font-numbers">{{ hauDong.activeSession.stepId }}/6</span>:
          <strong class="text-white">{{ hauDong.activeSession.stepName }}</strong>
        </div>
      </div>

      <div class="flex items-center gap-1.5 pt-1">
        <UiButton
          variant="secondary"
          size="sm"
          class="flex-1 justify-center"
          @click="hauDong.isBowing = true; triggerBowAction()"
        >
          {{ hauDong.isBowing ? 'Đã Khánh Hỷ' : 'Chắp Tay (+5 MC)' }}
        </UiButton>
        <UiButton
          v-if="hauDong.activeSession.stepId === 5 || hauDong.activeSession.stepId === 6"
          variant="primary"
          size="sm"
          class="flex-1 justify-center"
          :disabled="hauDong.submitting || Boolean(hauDong.myAttendance?.hasClaimedThisGia)"
          @click="handleQuickClaimHauDong"
        >
          {{ hauDong.myAttendance?.hasClaimedThisGia ? 'Đã Nhận Lộc' : 'Thỉnh Lộc (+MC)' }}
        </UiButton>
        <UiButton
          v-else
          variant="secondary"
          size="sm"
          class="flex-1 justify-center"
          @click="openDrawer('hau_dong')"
        >
          Mở Đàn / Chi Tiết
        </UiButton>
      </div>
    </div>

    <!-- Bottom Controls: Hotkeys Popover (Left) & 3 Drop-up Menus (Right) -->
    <div class="absolute bottom-3 inset-x-3 flex items-center justify-between gap-3 pointer-events-none z-20">
      <!-- Left: Compact Hotkey Pill + ALT Indicator -->
      <div class="relative pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          @click="showHotkeysMenu = !showHotkeysMenu"
          class="min-h-[40px] px-3.5 py-2 rounded-md bg-surface-card text-xs text-secondary hover:text-white border border-hairline hover:border-hairline flex items-center gap-2 transition cursor-pointer shadow-lg"
          title="Nhấp để xem bảng phím tắt điều khiển"
        >
          <UiKeycap v-for="h in pillHints" :key="h.id">{{ h.keys[0] }}</UiKeycap>
          <span class="text-xs font-medium hidden sm:inline">Phím tắt</span>
        </button>

        <!-- Live ALT Mouse Cursor Indicator -->
        <div
          class="min-h-[40px] px-3.5 py-2 rounded-md bg-surface-card text-xs border flex items-center gap-2 transition select-none shadow-md"
          :class="isAltHeld ? 'border-gold text-white bg-surface-elevated' : 'text-secondary border-hairline'"
          title="Giữ phím ALT để hiện con trỏ chuột tự do bấm vào các nút"
        >
          <UiKeycap>ALT</UiKeycap>
          <span class="text-xs font-medium hidden sm:inline">
            {{ isAltHeld ? 'Đang hiện con trỏ chuột' : 'Giữ ALT để hiện chuột' }}
          </span>
        </div>

        <!-- Full Hotkey Cheat Sheet Popover -->
        <div
          v-if="showHotkeysMenu"
          class="absolute bottom-14 left-0 w-96 p-4 rounded-md bg-surface-card border border-hairline shadow-2xl z-50 flex flex-col gap-3"
        >
          <div class="flex items-center justify-between border-b border-hairline pb-2.5">
            <span class="text-sm font-bold text-white">Phím tắt điều khiển & Chuột</span>
            <button
              type="button"
              aria-label="Đóng bảng phím tắt"
              @click="showHotkeysMenu = false"
              class="w-8 h-8 rounded flex items-center justify-center text-secondary hover:text-white hover:bg-surface-elevated cursor-pointer"
            >
              <ZenIcon name="x" :size="16" />
            </button>
          </div>
          <div class="grid grid-cols-2 gap-2.5 text-xs font-numbers">
            <div v-for="h in cheatHints" :key="h.id" class="flex items-center gap-2">
              <template v-for="(k, ki) in h.keys" :key="k"><span v-if="ki > 0" class="text-secondary">{{ h.sep }}</span><UiKeycap>{{ k }}</UiKeycap></template>
              <span class="text-secondary">{{ h.label }}</span>
            </div>
          </div>
          <!-- Nhóm nhà phát triển (ẩn mặc định) -->
          <div class="border-t border-hairline pt-2.5 flex flex-col gap-2.5">
            <button
              type="button"
              @click="showDevHints = !showDevHints"
              :aria-expanded="showDevHints"
              class="flex items-center justify-between text-xs text-secondary hover:text-white cursor-pointer ui-focus-ring"
            >
              <span class="font-semibold">Nhà phát triển</span>
              <ZenIcon name="chevron-down" :size="14" class="transition-transform" :class="showDevHints ? 'rotate-180' : ''" />
            </button>
            <div v-if="showDevHints" class="grid grid-cols-2 gap-2.5 text-xs font-numbers">
              <div v-for="h in devHints" :key="h.id" class="flex items-center gap-2">
                <template v-for="(k, ki) in h.keys" :key="k"><span v-if="ki > 0" class="text-secondary">{{ h.sep }}</span><UiKeycap>{{ k }}</UiKeycap></template>
                <span class="text-secondary">{{ h.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: 3 Cụm Drop-up Island -->
      <div class="flex items-center gap-2 pointer-events-auto select-none">
        <!-- Cụm 1: Bói Quẻ & Cầu An (Popup Phím 1) -->
        <div class="relative">
          <div
            v-if="showDivinationMenu"
            class="hud-popover hud-popover--bottom w-80 p-2"
          >
            <div class="px-3 py-2 border-b border-hairline mb-1 flex items-center justify-between">
              <span class="text-xs font-semibold text-secondary uppercase tracking-wider">Bói Quẻ 6 Môn Cầu An</span>
              <UiKeycap>Phím 1</UiKeycap>
            </div>
            <div class="flex flex-col">
              <button
                v-for="cat in FORTUNE_MENU_ITEMS"
                :key="cat.id"
                type="button"
                @click="openFortuneCategory(cat.id)"
                class="hud-markets-row ui-focus-ring"
              >
                <span class="font-numbers text-xs font-semibold text-secondary w-6 shrink-0 pt-0.5">
                  {{ cat.index }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold text-primary-text leading-tight">
                    {{ cat.name }}
                  </div>
                  <div class="text-xs text-secondary leading-normal mt-0.5">
                    {{ cat.short }}
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Trigger Button (Hotkey [1] - Single Gold Primary Action on HUD) -->
          <UiButton
            variant="primary"
            class="hud-trigger-gold"
            :class="{ 'ring-2 ring-primary/50': showDivinationMenu }"
            title="Bấm phím [1] hoặc nhấp chuột để mở Bói Quẻ 6 Môn"
            @click="toggleDivinationMenu"
          >
            <span>Bói Quẻ &amp; Cầu An</span>
            <UiKeycap class="hud-keycap-gold">1</UiKeycap>
            <ZenIcon name="chevron-up" :size="16" class="transition-transform" :class="showDivinationMenu ? 'rotate-180' : ''" />
          </UiButton>
        </div>

        <!-- Cụm 2: Thiền & Công Đức (Secondary Drop-up - Hotkey [2]) -->
        <div class="relative">
          <div
            v-if="showMeditationMenu"
            class="absolute bottom-14 right-0 w-[320px] p-3 rounded-md bg-surface-card border border-hairline shadow-2xl z-50 flex flex-col gap-1"
          >
            <div class="px-3 pb-2.5 mb-1 border-b border-hairline flex items-center justify-between">
              <span class="text-sm font-bold text-white">Hành Trì & Phước Đức</span>
              <UiKeycap>Phím 2</UiKeycap>
            </div>
            <button
              type="button"
              @click="openDrawerFromDropup('merit')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">01</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">Hòm Công Đức Tam Bảo</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">Tâm Duyên, Sen Vàng, Cardano ADA</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('meditation')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">02</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">Hội Thiền 432Hz</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">Chuông xoay & Điều tức chánh niệm</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('sangha')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">03</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">Pháp Đàm & Đồng Tu</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">Lời nguyện chánh niệm (<span class="font-numbers">{{ onlinePilgrimCount }}</span> đang online)</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('hau_dong')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer border-t border-hairline mt-1 pt-2.5"
            >
              <span class="font-numbers text-xs font-semibold text-primary pt-0.5 w-6 shrink-0">04</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-primary leading-snug whitespace-nowrap">Nhà Hầu Đồng (Điện Tứ Phủ)</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">Hầu đồng 5 Giá (8p), Thỉnh Lộc MC &amp; Mở Đàn</div>
              </div>
            </button>
          </div>

          <button
            type="button"
            @click="toggleMeditationMenu"
            class="min-h-[40px] px-3.5 rounded-md bg-surface-card border text-sm font-medium flex items-center gap-2 transition cursor-pointer"
            :class="showMeditationMenu ? 'border-gold bg-surface-elevated text-white' : 'border-hairline text-white hover:border-hairline hover:bg-surface-elevated'"
            title="Bấm phím [2] hoặc nhấp chuột để mở Thiền & Công Đức"
          >
            <span>Thiền & Công Đức</span>
            <UiKeycap>2</UiKeycap>
            <ZenIcon name="chevron-up" :size="16" class="text-secondary transition-transform" :class="showMeditationMenu ? 'rotate-180' : ''" />
          </button>
        </div>

        <!-- Cụm 3: Di Sản & Cửa Hàng (Secondary Drop-up - Hotkey [3]) -->
        <div class="relative">
          <div
            v-if="showHeritageMenu"
            class="absolute bottom-14 right-0 w-[320px] p-3 rounded-md bg-surface-card border border-hairline shadow-2xl z-50 flex flex-col gap-1"
          >
            <div class="px-3 pb-2.5 mb-1 border-b border-hairline flex items-center justify-between">
              <span class="text-sm font-bold text-white">Di Sản & Bảo Vật</span>
              <UiKeycap>Phím 3</UiKeycap>
            </div>
            <button
              type="button"
              @click="openDrawerFromDropup('shop')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">01</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">Cửa Hàng Pháp Bảo</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">Cổ phục 9 nước, nhang trầm, lễ vật</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('cards')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">02</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">Thẻ Bài Di Sản 3D</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">10 cổ tự mini, âm cảnh, NFT CIP-68</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('soundscape')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">03</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">Bộ Trộn Âm Thanh 3D</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">6 kênh âm cảnh không gian thời gian thực</div>
              </div>
            </button>
            <button
              type="button"
              @click="showDisclaimer = true; closeAllDropups()"
              class="w-full min-h-[40px] px-3 py-2 rounded-md text-xs font-medium text-secondary hover:bg-surface-elevated hover:text-white transition cursor-pointer text-left border-t border-hairline mt-1"
            >
              Quy chuẩn trải nghiệm & Pháp lý
            </button>
          </div>

          <button
            type="button"
            @click="toggleHeritageMenu"
            class="min-h-[40px] px-3.5 rounded-md bg-surface-card border text-sm font-medium flex items-center gap-2 transition cursor-pointer"
            :class="showHeritageMenu ? 'border-gold bg-surface-elevated text-white' : 'border-hairline text-white hover:border-hairline hover:bg-surface-elevated'"
            title="Bấm phím [3] hoặc nhấp chuột để mở Di Sản & Cửa Hàng"
          >
            <span>Di Sản & Cửa Hàng</span>
            <UiKeycap>3</UiKeycap>
            <ZenIcon name="chevron-up" :size="16" class="text-secondary transition-transform" :class="showHeritageMenu ? 'rotate-180' : ''" />
          </button>
        </div>
      </div>
    </div>

    <!-- Toast Notification Banner (Whitelisted status icon #5) -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-2 opacity-0"
    >
      <div v-if="toastMessage" class="fixed top-20 right-3 z-50 pointer-events-none">
        <div class="bg-surface-card border border-hairline px-4 py-3 rounded-md shadow-2xl flex items-start gap-3 max-w-sm">
          <ZenIcon name="circle-check" :size="20" class="text-trading-up shrink-0 mt-0.5" />
          <div>
            <div class="text-sm font-bold text-white leading-snug">{{ toastMessage.title }}</div>
            <div class="text-xs text-secondary leading-snug mt-0.5">{{ toastMessage.desc }}</div>
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
      :is-near-fortune="isNearFortune"
      :is-near-merit="isNearMerit"
      :is-inside-hau-dong="isInsideHauDong"
      @outfit-changed="handleShopOutfitChanged"
      @gender-changed="handleGenderSelect"
      @greet-pilgrim="handleBowToPilgrim"
      @send-mantra="handleSendChat"
      @guide-to-fortune="handleGuideToFortune"
      @guide-to-merit="handleGuideToMerit"
      @guide-to-hau-dong="handleGuideToHauDong"
      @trigger-bow="triggerBowAction"
      @update:active-tab="(t) => drawerTab = t"
    />

    <!-- Overlays & Modals for specific operations -->
    <WalletConnectModal v-if="showWalletModal" @close="showWalletModal = false" />
    <EmoteWheel v-if="showEmoteWheel" @close="showEmoteWheel = false" @select-emote="handleSelectEmote" />
    <DisclaimerBanner v-if="showDisclaimer" @close="showDisclaimer = false" />
  </div>
</template>

<style scoped>
.hud-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background-color: var(--canvas-dark, #0b0e11);
  border-bottom: 1px solid var(--hairline-on-dark, #2b3139);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 30;
  font-family: var(--font-sans, 'Inter', sans-serif);
}

.hud-top-bar__left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.hud-brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hud-brand__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hud-brand__title {
  font-size: var(--text-sm, 14px);
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.02em;
  line-height: var(--leading-tight, 1.25);
  white-space: nowrap;
}

.hud-brand__user-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs, 12px);
  color: var(--text-secondary, #929aa5);
  line-height: var(--leading-tight, 1.25);
}

.hud-brand__user-name {
  color: var(--text-primary, #eaecef);
  font-weight: 500;
}

.hud-divider {
  color: var(--text-disabled, #707a8a);
}

.hud-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  flex-shrink: 0;
}

.hud-status-dot--success {
  background-color: var(--trading-up, #0ecb81);
}

.hud-status-dot--warning {
  background-color: var(--primary, #fcd535);
}

.hud-top-bar__right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.hud-v-divider {
  width: 1px;
  height: 20px;
  background-color: var(--hairline-on-dark, #2b3139);
  flex-shrink: 0;
}

.hud-stat-cell {
  padding: 0 4px;
}

.hud-ledger-wrap {
  display: inline-flex;
  align-items: center;
}

.hud-ledger-mode {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  cursor: help;
}

.hud-wallet-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border-radius: var(--radius-sm, 4px);
  background-color: var(--surface-card-dark, #1e2329);
  border: 1px solid var(--hairline-on-dark, #2b3139);
  color: var(--text-primary, #eaecef);
  cursor: pointer;
  transition: background-color var(--transition-fast, 120ms ease), border-color var(--transition-fast, 120ms ease);
}

.hud-wallet-btn:hover {
  background-color: var(--surface-elevated-dark, #2b3139);
  border-color: var(--hairline-on-dark-hover, #474d57);
}

.hud-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-sm, 4px);
  background-color: var(--surface-card-dark, #1e2329);
  border: 1px solid var(--hairline-on-dark, #2b3139);
  color: var(--text-secondary, #929aa5);
  cursor: pointer;
  transition: background-color var(--transition-fast, 120ms ease), color var(--transition-fast, 120ms ease);
}

.hud-icon-btn:hover {
  background-color: var(--surface-elevated-dark, #2b3139);
  color: var(--text-primary, #eaecef);
}

.hud-icon-btn.is-active {
  border-color: var(--primary, #fcd535);
  color: var(--text-primary, #eaecef);
}

.hud-sangha-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-sm, 4px);
  background-color: var(--surface-elevated-dark, #2b3139);
  border: 1px solid var(--hairline-on-dark, #2b3139);
  color: var(--text-primary, #eaecef);
  cursor: pointer;
  transition: background-color var(--transition-fast, 120ms ease);
}

.hud-sangha-btn:hover {
  background-color: var(--surface-elevated-dark-hover, #333b44);
}

/* Popovers */
.hud-popover {
  position: absolute;
  top: 44px;
  border-radius: var(--radius-md, 6px);
  background-color: var(--surface-card-dark, #1e2329);
  border: 1px solid var(--hairline-on-dark, #2b3139);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.5);
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.hud-popover--display {
  right: 0;
  width: 260px;
  padding: 8px;
}

.hud-popover--bottom {
  top: auto;
  bottom: 50px;
  right: 0;
}

.hud-popover__header {
  padding: 6px 8px 8px;
  border-bottom: 1px solid var(--hairline-on-dark, #2b3139);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hud-popover__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hud-popover__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--radius-sm, 4px);
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-primary, #eaecef);
  cursor: pointer;
  transition: background-color var(--transition-fast, 120ms ease);
}

.hud-popover__item:hover {
  background-color: var(--surface-elevated-dark, #2b3139);
}

.hud-popover__item.is-selected {
  background-color: var(--surface-elevated-dark, #2b3139);
  border-color: var(--primary, #fcd535);
}

.hud-popover__item--row {
  width: 100%;
  text-align: left;
}

/* Markets Row Popup Phím 1 */
.hud-markets-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--hairline-on-dark, #2b3139);
  background: transparent;
  border-left: none;
  border-right: none;
  border-top: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background-color var(--transition-fast, 120ms ease);
}

.hud-markets-row:last-child {
  border-bottom: none;
}

.hud-markets-row:hover {
  background-color: var(--surface-elevated-dark, #2b3139);
}

.hud-trigger-gold {
  gap: 8px;
  font-weight: 700;
}

.hud-keycap-gold {
  background-color: rgba(0, 0, 0, 0.15) !important;
  color: #181a20 !important;
  border-color: rgba(0, 0, 0, 0.2) !important;
}

/* Helpers */
.font-numbers {
  font-family: var(--font-numbers, 'IBM Plex Sans', sans-serif);
  font-variant-numeric: tabular-nums;
}

.text-primary-text {
  color: var(--text-primary, #eaecef);
}

.text-secondary {
  color: var(--text-secondary, #929aa5);
}

.text-primary {
  color: var(--primary, #fcd535);
}

.bg-surface-elevated {
  background-color: var(--surface-elevated-dark, #2b3139);
}

.border-hairline {
  border-color: var(--hairline-on-dark, #2b3139);
}
</style>

