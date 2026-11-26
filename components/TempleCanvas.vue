<script setup lang="ts">
import { TempleStage, type InteractionTarget } from '~/lib/world3d/TempleStage'
import { zenAudio } from '~/lib/audio/ZenAudio'
import { t, tr, currentLocale, toggleLocale } from '~/lib/ui/copy'
import { useUserStore, type CountryId } from '~/stores/user'
import { useEconomyStore } from '~/stores/economy'
import { useWalletStore } from '~/stores/wallet'
import { useMeditationStore } from '~/stores/meditation'
import { useHauDongStore } from '~/stores/hauDong'
import { useStreakStore } from '~/stores/streak'
import { useDeedsStore } from '~/stores/deeds'
import { useOnboardingStore } from '~/stores/onboarding'
import { useKoiGardenStore } from '~/stores/koiGarden'
import OnboardingGuide from '~/components/OnboardingGuide.vue'
import PhotoModeOverlay from '~/components/PhotoModeOverlay.vue'
import HydraHeadWidget from '~/components/HydraHeadWidget.vue'
import { MapLayout } from '~/lib/world3d/world/MapLayout'
import { useParkourStore } from '~/stores/parkour'
import { MultiplayerClient, type PilgrimPresence, type ZenChatMessage } from '~/lib/network/MultiplayerClient'
import type { DrawerTab } from '~/components/SanctuaryDrawer.vue'
// Tách chunk: hai drawer lớn (SanctuaryDrawer ~3100 dòng) tải song song sau khi canvas 3D khởi động,
// không nằm trong chunk vào trang.
const SanctuaryDrawer = defineAsyncComponent(() => import('~/components/SanctuaryDrawer.vue'))
const AbbotChatDrawer = defineAsyncComponent(() => import('~/components/AbbotChatDrawer.vue'))
const BodhiGamesModal = defineAsyncComponent(() => import('~/components/BodhiGamesModal.vue'))
import type { AbbotNpcEmotion } from '~/lib/world3d/characters/AbbotNpc'
import UiChip from '~/components/ui/UiChip.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiKeycap from '~/components/ui/UiKeycap.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiStatCell from '~/components/ui/UiStatCell.vue'
import ZenIcon from '~/components/ZenIcon.vue'
import { DEV_HINTS, INTERACT_HINT, hintsFor } from '~/lib/ui/controlHints'
import { loadSavedProfile } from '~/lib/boi/ProfileService'
import { getActiveFestival, getFestivalPreview } from '~/lib/festival/festivalCalendar'

const route = useRoute()
const activeFestival = computed(() => {
  const q = route.query.festival
  if (q === 'ram' || q === 'mung_1') return getFestivalPreview(q)
  return getActiveFestival()
})
let hasPlayedFestivalBell = false

watch(activeFestival, (val) => {
  stage?.setFestivalMode(Boolean(val))
})

const user = useUserStore()
const economy = useEconomyStore()
const wallet = useWalletStore()
const hydra = useHydraStore()
const meditation = useMeditationStore()
const hauDong = useHauDongStore()
const parkour = useParkourStore()
const streak = useStreakStore()
const onboarding = useOnboardingStore()
const koiGarden = useKoiGardenStore()
const playerAltitude = ref(0)

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

let rejoinDebounceTimer: ReturnType<typeof setTimeout> | null = null
function scheduleMultiplayerRejoin() {
  if (rejoinDebounceTimer) clearTimeout(rejoinDebounceTimer)
  rejoinDebounceTimer = setTimeout(() => {
    rejoinDebounceTimer = null
    void multiplayer?.rejoin()
  }, 50)
}

function resolveDisplayNameFromProfileAndWallet(): string {
  const sp = loadSavedProfile()
  const fortuneName = sp?.fullName?.trim()
  if (fortuneName) return fortuneName
  if (wallet.displayName) return wallet.displayName
  return 'Hành Giả Tâm An'
}

// Đăng nhập/đăng xuất ví: đổi tên hiển thị theo hồ sơ bói quẻ (nếu đã nhập) hoặc tài khoản ví, rồi join lại.
watch(() => wallet.accountId, async (newAccountId) => {
  const sp = loadSavedProfile()
  const fortuneName = sp?.fullName?.trim() || ''
  if (fortuneName) {
    if (sp?.gender === 'nu') user.setGender('female')
    else if (sp?.gender === 'nam') user.setGender('male')
    if (newAccountId) {
      await wallet.syncFortuneProfileName(fortuneName)
    }
  }
  user.name = resolveDisplayNameFromProfileAndWallet()
  scheduleMultiplayerRejoin()
  parkour.fetchStatus()
  void streak.refreshStatus()
  void useDeedsStore().refreshStatus()
})

// Khi tên người chơi thay đổi (lưu hoặc xóa họ tên quẻ bói), phát sóng lại ngay cho mọi người chơi khác thấy.
watch(() => user.name, (next, prev) => {
  if (next !== prev) {
    scheduleMultiplayerRejoin()
  }
})

// Khi người chơi bấm nút "Nạp MC" từ Cửa Hàng / Bói Quẻ / Hòm Công Đức -> mở ngay modal Ví Cardano (tab Mua MC)
watch(() => economy.topUpModalSignal, () => {
  openWalletModal()
})

const nearTarget = ref<InteractionTarget>(null)
const isNearFortune = ref(false)
const isNearMerit = ref(false)
const isInsideHauDong = ref(false)
const showBodhiGamesModal = ref(false)
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
      palaceColorHex: parseInt((s.colorHex || '#c9a24b').replace('#', ''), 16) || 0xc9a24b,
      stepId: (stepMap[s.stepId] || 'dance') as any,
      stepLabel: `Bước ${s.stepId}/6: ${s.stepName}`,
      stageElapsedSec: s.secInGia || 0,
      sponsorName: s.sponsorName
    }
    zenAudio.syncChauVanAudio(isInsideHauDong.value, s.deityId, s.stepId, s.secInGia || 0)
  } else {
    if (stage.hauDongVisualState) {
      stage.hauDongVisualState.active = false
    }
    // Dù không có session nào đang hoạt động thì khi người chơi đứng trong Nhà Hầu Đồng vẫn phát nhạc Chầu Văn
    if (isInsideHauDong.value) {
      zenAudio.syncChauVanAudio(true, 'quan_lon_de_tam', 4, 0)
    } else {
      zenAudio.stopChauVanAudio()
    }
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
const showAbbotDrawer = ref(false)
const showEmoteWheel = ref(false)
const showDisclaimer = ref(false)
const showPhotoMode = ref(false)
const isAudioMuted = ref(false)

function setPhotoModeActive(next: boolean) {
  showPhotoMode.value = next
  if (next) {
    closeAllDropups()
    showDisplayMenu.value = false
    showMiniMap.value = false
    showHotkeysMenu.value = false
    drawerOpen.value = false
    showAbbotDrawer.value = false
    if (stage) stage.setPhotoMode(true)
  } else {
    if (stage) {
      stage.setPhotoMode(false)
      if (stage.avatar) stage.avatar.root.visible = stage.cameraMode !== 'fpp'
    }
  }
}

function setTimeOfDayDirect(mode: 'day' | 'sunset' | 'night') {
  currentTimeOfDay.value = mode
  if (stage) stage.setTimeOfDay(mode)
}
const showMiniMap = ref(false)
const livePlayerPos = ref({ x: 0, y: 0, z: 10 })
const livePlayerYaw = ref(0)
const isAutoWalking = ref(false)
const activeNavTargetName = ref<string | null>(null)

// Bản đồ tỉ lệ đều 6 px/m, gốc tại (x = -26, z = -40), Bắc (-z) ở trên.
const MAP_X0 = -26
const MAP_Z0 = -40
const MAP_SCALE = 6
const MAP_W = 438
const MAP_H = 424

function toSvgCoords(x: number, z: number): { u: number; v: number } {
  const u = Math.min(MAP_W - 6, Math.max(6, (x - MAP_X0) * MAP_SCALE))
  const v = Math.min(MAP_H - 6, Math.max(6, (z - MAP_Z0) * MAP_SCALE))
  return { u, v }
}

const miniMapPlayerU = computed(() => toSvgCoords(livePlayerPos.value.x, livePlayerPos.value.z).u)
const miniMapPlayerV = computed(() => toSvgCoords(livePlayerPos.value.x, livePlayerPos.value.z).v)

// Hướng nhìn trong cảnh là (-sin yaw, -cos yaw). Trên bản đồ Bắc ở trên nên góc quay SVG là -yaw.
const miniMapPlayerRotDeg = computed(() => (-livePlayerYaw.value * 180) / Math.PI)

function cancelNavigation() {
  if (stage) {
    stage.cancelAutoWalk()
    isAutoWalking.value = false
    activeNavTargetName.value = null
    showToast('Đã dừng bước', '', 'pagoda')
  }
}

function requireWalletForFeature(): boolean {
  if (wallet.isAuthenticated) return true
  if (stage) stage.exitPointerLock()
  closeAllDropups()
  drawerOpen.value = false
  showAbbotDrawer.value = false
  showWalletModal.value = true
  showToast(
    tr('Cần kết nối ví Cardano', 'Cardano Wallet Required'),
    tr('Bạn đang ở chế độ tham quan 3D. Kết nối ví để sử dụng tính năng này.', 'You are in 3D sightseeing mode. Connect your wallet to use this feature.'),
    'pagoda'
  )
  return false
}

function openDrawer(tab: DrawerTab) {
  if (!requireWalletForFeature()) return
  if (stage) {
    stage.exitPointerLock()
    isNearFortune.value = stage.isNearFortune()
    isNearMerit.value = stage.isNearMerit()
  }
  showWalletModal.value = false
  showAbbotDrawer.value = false
  showEmoteWheel.value = false
  showDisclaimer.value = false
  drawerTab.value = tab
  drawerOpen.value = true
}

function closeDrawer() {
  drawerOpen.value = false
}

function openAbbotChat() {
  if (!requireWalletForFeature()) return
  if (stage) {
    stage.exitPointerLock()
    stage.setAbbotEmotion('smile')
  }
  closeAllDropups()
  drawerOpen.value = false
  showWalletModal.value = false
  showEmoteWheel.value = false
  showDisclaimer.value = false
  showAbbotDrawer.value = true
}

function handleAbbotEmotion(emotion: AbbotNpcEmotion) {
  stage?.setAbbotEmotion(emotion)
}

function handleGuideToAbbot() {
  if (!stage) return
  showAbbotDrawer.value = false
  isAutoWalking.value = true
  activeNavTargetName.value = 'Thầy Trụ Trì (Hiên Tiền Điện)'
  stage.walkToAbbot(
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      openAbbotChat()
    },
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
    }
  )
}

function openWalletModal() {
  if (stage) stage.exitPointerLock()
  drawerOpen.value = false
  showAbbotDrawer.value = false
  showEmoteWheel.value = false
  showDisclaimer.value = false
  showWalletModal.value = true
}

// Toast notification banner state
const toastMessage = ref<{ title: string; desc: string; icon: string; hydra?: any } | null>(null)
let toastTimer: any = null

function showToast(title: string, desc = '', icon = 'pagoda', hydra?: any) {
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = { title, desc, icon, hydra }
  toastTimer = setTimeout(() => {
    toastMessage.value = null
  }, 4500)
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
  const sp = loadSavedProfile()
  if (sp?.gender === 'nu') user.setGender('female')
  else if (sp?.gender === 'nam') user.setGender('male')
  user.name = resolveDisplayNameFromProfileAndWallet()
  if (canvasContainer.value) {
    stage = new TempleStage(canvasContainer.value)
    stage.setGraphicsQuality(graphicsQuality.value)
    stage.festivalFireworksSystem.onLaunch = () => zenAudio.playFireworkLaunch()
    stage.festivalFireworksSystem.onBurst = () => zenAudio.playFireworkBurst()
    stage.setFestivalMode(Boolean(activeFestival.value))
    stage.setCountry(user.currentCountry as any)
    stage.setGender(user.gender)
    zenAudio.updatePlayerPosition(stage.playerPos.x, stage.playerPos.z)
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
      zenAudio.updatePlayerPosition(pos[0], pos[2])
      playerAltitude.value = Math.max(0, pos[1])
      livePlayerPos.value = { x: pos[0], y: pos[1], z: pos[2] }
      livePlayerYaw.value = yaw
      checkDeedVisits(pos[0], pos[2])
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
      const idx = remotePilgrimsList.value.findIndex((item) => item.id === p.id)
      const isNewJoin = idx === -1
      if (isNewJoin) {
        remotePilgrimsList.value.push(p)
      } else {
        remotePilgrimsList.value[idx] = p
      }
      onlinePilgrimCount.value = count
      stage?.upsertRemotePilgrim(p)
      if (isNewJoin) {
        zenAudio.playTempleBell()
        showToast(`${p.name} vừa đến`, '', 'lotus')
      }
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
        showToast(`${data.name} chắp tay chào`, '', 'hand-bow')
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

    const hydrateAuthenticatedSession = () => {
      if (!wallet.isAuthenticated) return
      hydra.startPolling()
      if (multiplayer) {
        multiplayer.connect()
        multiplayer.joinProvider = async () => ({
          name: user.name,
          fortuneName: loadSavedProfile()?.fullName?.trim() || null,
          title: user.title,
          country: user.currentCountry,
          gender: user.gender,
          position: stage ? [stage.playerPos.x, stage.playerPos.y, stage.playerPos.z] : [0, 0, 10],
          yaw: stage ? stage.yaw : 0,
          ticket: await wallet.fetchWsTicket()
        })
        void multiplayer.rejoin()
      }
      void economy.loadCatalog()
      void meditation.refreshStatus()
      void parkour.fetchStatus()
      void streak.refreshStatus()
      void useDeedsStore().refreshStatus()
      void koiGarden.refreshAll()
      void hauDong.refreshStatus().then(() => {
        syncHauDongToStage()
      })
    }

    // Chỉ kết nối WebSocket & gọi API khi đã xác thực ví (Wallet Gate).
    if (wallet.isAuthenticated) {
      hydrateAuthenticatedSession()
    }

    watch(
      () => [wallet.isAuthenticated, wallet.address] as const,
      ([authed]) => {
        if (authed) {
          hydrateAuthenticatedSession()
        } else {
          hydra.stopPolling()
          multiplayer?.disconnect()
          drawerOpen.value = false
          showAbbotDrawer.value = false
          showBodhiGamesModal.value = false
          showEmoteWheel.value = false
          closeAllDropups()
        }
      }
    )

    // Chống chồng yêu cầu (mạng chậm > 2s) và tạm dừng khi chưa kết nối ví hoặc tab bị ẩn.
    let hauDongSyncBusy = false
    hauDongSyncTimer = setInterval(async () => {
      if (!wallet.isAuthenticated || hauDongSyncBusy || document.hidden) return
      hauDongSyncBusy = true
      try {
        if (stage) {
          isInsideHauDong.value = stage.isInsideHauDongZone()
        }
        if (isInsideHauDong.value) {
          await hauDong.sendHeartbeat(true, 2)
        } else {
          await hauDong.refreshStatus()
        }
        syncHauDongToStage()
      } catch {
        /* lỗi mạng tạm thời: thử lại ở nhịp kế tiếp */
      } finally {
        hauDongSyncBusy = false
      }
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
  if (wallet.isAuthenticated) {
    hydra.startPolling()
  }
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

  // Hướng dẫn người mới: nhận biết người chơi đã biết di chuyển và mở menu
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    onboarding.notify('move')
  } else if (['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].includes(e.code)) {
    onboarding.notify('menu')
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
    if (showAbbotDrawer.value) {
      showAbbotDrawer.value = false
      return
    }
    if (drawerOpen.value) {
      drawerOpen.value = false
      return
    }
    if (showMiniMap.value) {
      showMiniMap.value = false
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
    if (showBodhiGamesModal.value) {
      closeBodhiGamesModal()
      return
    }
    if (showPhotoMode.value) {
      setPhotoModeActive(false)
      return
    }
  } else if (e.code === 'KeyP') {
    e.preventDefault()
    setPhotoModeActive(!showPhotoMode.value)
  } else if (e.code === 'KeyB') {
    triggerBowAction()
  } else if (e.code === 'KeyG') {
    toggleGender()
  } else if (e.code === 'KeyM') {
    e.preventDefault()
    showMiniMap.value = !showMiniMap.value
    if (showMiniMap.value) showHotkeysMenu.value = false
  } else if (e.code === 'KeyT') {
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
      showToast(isVisible ? 'Hiệu năng: bật' : 'Hiệu năng: tắt', '', 'sparkles')
    }
  } else if (e.code === 'F3') {
    e.preventDefault()
    if (stage) {
      const isDebug = stage.toggleDebugColliders()
      showToast(isDebug ? 'Va chạm: bật' : 'Va chạm: tắt', '', 'sparkles')
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
                          showAbbotDrawer.value ||
                          showDivinationMenu.value || 
                          showMeditationMenu.value || 
                          showHeritageMenu.value || 
                          showHotkeysMenu.value || 
                          showWalletModal.value || 
                          showBodhiGamesModal.value ||
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
    showToast('Sen nở', '', 'lotus')
    multiplayer?.triggerEmote('pray', user.name)
  } else if (action === 'prostrate') {
    if (stage) stage.triggerLocalEmote('bowing')
    zenAudio.playWoodenFish()
    showToast('Đảnh lễ Tam Bảo', '', 'sparkles')
    multiplayer?.triggerEmote('bow', user.name)
  } else if (action === 'incense') {
    zenAudio.playTempleBell()
    showToast('Dâng hương', '', 'incense')
  } else if (action === 'lantern') {
    zenAudio.playTempleBell()
    showToast('Thả hoa đăng', '', 'sunset')
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
    gender === 'male' ? 'Nam hành giả' : 'Nữ hành giả',
    '',
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
  showToast('Chắp tay chào', '', 'hand-bow')
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
    '',
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
  isAutoWalking.value = true
  activeNavTargetName.value = 'Bàn Xin Xăm'
  showToast('Đang tới bàn xăm', '', 'fortune')
  stage.walkToFortuneTable(
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      isNearFortune.value = true
      showToast('Đã đến bàn xăm', '', 'fortune')
    },
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Bị cản, hãy tự bước', '', 'info')
    }
  )
}

function handleGuideToMerit() {
  if (!stage) return
  isAutoWalking.value = true
  activeNavTargetName.value = 'Hòm Công Đức'
  showToast('Đang tới hòm công đức', '', 'coin')
  stage.walkToMeritBox(
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      isNearMerit.value = true
      showToast('Đã đến hòm công đức', '', 'coin')
    },
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Bị cản, hãy tự bước', '', 'info')
    }
  )
}

function handleGuideToHeritageMuseum() {
  if (!stage) return
  drawerOpen.value = false
  isAutoWalking.value = true
  activeNavTargetName.value = 'Bảo Tàng Di Sản Cổ Tự'
  showToast('Đang tới Bảo Tàng Di Sản Cổ Tự', '', 'cards')
  stage.walkToHeritageMuseum(
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Đã tới Bảo Tàng Di Sản Cổ Tự', 'Bấm [E] để mở bộ sưu tập & đúc NFT CIP-68', 'sparkles')
    },
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Bị cản, hãy tự bước', '', 'info')
    }
  )
}

function handleGuideToHauDong() {
  if (!stage) return
  drawerOpen.value = false
  isAutoWalking.value = true
  activeNavTargetName.value = 'Nhà Hầu Đồng'
  showToast('Đang tới Điện Thờ', '', 'pagoda')
  stage.walkToHauDongHall(
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      isInsideHauDong.value = stage?.isInsideHauDongZone() ?? true
      syncHauDongToStage()
      showToast('Đã tới Nhà Hầu Đồng', '', 'sparkles')
    },
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Bị cản, hãy tự bước', '', 'info')
    }
  )
}

function handleGuideToLoveTree() {
  if (!stage) return
  drawerOpen.value = false
  isAutoWalking.value = true
  activeNavTargetName.value = 'Cây Nguyệt Lão'
  showToast('Đang tới Đài Tơ Duyên', '', 'lotus')
  stage.walkToLoveTree(
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Đài Tơ Duyên', '', 'lotus')
    },
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Bị cản, hãy tự bước', '', 'info')
    }
  )
}

// Ba Việc Lành: điểm bước tới (ngoài vùng vật cản) và bán kính tính là "đã tới" quanh tâm mỗi điểm.
const DEED_APPROACH: Record<string, { x: number; z: number }> = {
  lotus_pond: { x: -10.5, z: 8.5 },
  bell_tower: { x: 17.5, z: 8.5 },
  love_tree_shrine: { x: -10.5, z: 15.5 },
  bodhi_tree: { x: -9.0, z: 4.8 },
  banyan_tree: { x: 9.0, z: 4.8 },
  zen_garden: { x: 10.2, z: 15.2 }
}
const DEED_REACH_MARGIN = 3.5

function deedLandmarkOf(mapKey: string) {
  const def = MapLayout.LANDMARKS[mapKey]
  if (!def) return null
  const radius = def.radius ?? (def.footprint.type === 'circle' ? def.footprint.radius : 3)
  return { x: def.center.x, z: def.center.z, reach: radius + DEED_REACH_MARGIN }
}

/** Gọi mỗi lần nhân vật di chuyển: tới gần điểm của một việc lành chưa xong thì báo server. */
function checkDeedVisits(x: number, z: number) {
  const deeds = useDeedsStore()
  const list = deeds.status?.deeds
  if (!list) return
  for (const d of list) {
    if (d.kind !== 'visit' || d.done || !d.landmark || !d.mapKey) continue
    const lm = deedLandmarkOf(d.mapKey)
    if (!lm) continue
    if (Math.hypot(x - lm.x, z - lm.z) <= lm.reach) void deeds.reportVisit(d.landmark)
  }
}

function handleGuideToDeed(landmark: string) {
  if (!stage) return
  if (landmark === 'bodhi_chess') {
    drawerOpen.value = false
    openBodhiGamesFromDropup()
    return
  }
  const target = DEED_APPROACH[landmark]
  if (!target) return
  const fallbackLabel = landmark === 'zen_garden'
    ? tr('Vườn Thiền', 'Zen Garden')
    : landmark === 'lotus_pond'
      ? tr('Hồ Sen', 'Lotus Pond')
      : tr('Điểm việc lành', 'Good Deed Spot')
  const name = useDeedsStore().status?.deeds.find(d => d.landmark === landmark)?.label ?? fallbackLabel
  drawerOpen.value = false
  isAutoWalking.value = true
  activeNavTargetName.value = name
  stage.walkToPoint(
    target,
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      checkDeedVisits(target.x, target.z)
    },
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Bị cản, hãy tự bước', '', 'info')
    }
  )
}

function handleGuideToSanctuary() {
  if (!stage) return
  drawerOpen.value = false
  isAutoWalking.value = true
  activeNavTargetName.value = 'Chánh Điện'
  showToast('Đang vào Chánh Điện', '', 'pagoda')
  stage.walkToSanctuary(
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Chánh Điện', '', 'lotus')
    },
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Bị cản, hãy tự bước', '', 'info')
    }
  )
}

function handleGuideToParkour() {
  if (!stage) return
  drawerOpen.value = false
  isAutoWalking.value = true
  activeNavTargetName.value = 'Leo Núi Parkour'
  showToast('Đang tới cổng leo núi', '', 'pagoda')
  stage.walkToParkourGate(
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Cổng leo núi', '', 'sparkles')
    },
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Bị cản, hãy tự bước', '', 'info')
    }
  )
}

function handleGuideToTamQuan() {
  if (!stage) return
  drawerOpen.value = false
  isAutoWalking.value = true
  activeNavTargetName.value = 'Cổng Tam Quan'
  showToast('Đang ra Tam Quan', '', 'pagoda')
  stage.walkToTamQuanGate(
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Cổng Tam Quan', '', 'pagoda')
    },
    () => {
      isAutoWalking.value = false
      activeNavTargetName.value = null
      showToast('Bị cản, hãy tự bước', '', 'info')
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
      showToast(`+${res.creditedMc} MC`, '', 'coin')
    }
  } catch (e: any) {
    showToast('Đợi giá thứ 5', '', 'info')
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
    !showAbbotDrawer.value &&
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

const FORTUNE_MENU_ITEMS = computed(() => [
  { id: 'stick', index: '01', name: tr('Xin Xăm Bát Quái', 'Eight-Trigram Fortune Sticks'), short: tr('Bổn mạng & Sự nghiệp', 'Destiny & Career') },
  { id: 'love', index: '02', name: tr('Tơ Duyên Tương Ngộ', 'Red Thread Matchmaking'), short: tr('Nguyệt Lão chỉ hồng', 'Matchmaker Red Thread') },
  { id: 'family', index: '03', name: tr('Cầu Tự Con Cái', 'Family & Offspring Blessing'), short: tr('Quan Âm Tống Tử', 'Guanyin Family Blessing') },
  { id: 'wealth', index: '04', name: tr('Chiêu Tài Tấn Bảo', 'Wealth & Prosperity'), short: tr('Kinh doanh phát đạt', 'Business & Fortune') },
  { id: 'health', index: '05', name: tr('Dược Sư An Khang', 'Medicine Buddha Peace'), short: tr('Tiêu tai trừ bệnh', 'Health & Well-being') },
  { id: 'star', index: '06', name: tr('Dâng Sao Giải Hạn', 'Nine-Star Harmony'), short: tr('Bắc Đẩu Thất Tinh', 'Annual Star Alignment') }
])

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

function closeBodhiGamesModal() {
  showBodhiGamesModal.value = false
  stage?.standUpFromBodhiChess()
}

function openBodhiGamesFromDropup() {
  closeAllDropups()
  if (!stage || nearTarget.value === 'bodhi_chess') {
    if (stage) {
      stage.sitAtBodhiChess()
      stage.exitPointerLock()
    }
    showBodhiGamesModal.value = true
    return
  }
  showToast(tr('Đang bước tới Bàn Cờ Bồ Đề...', 'Walking to Bodhi Chess Table...'), '', 'pagoda')
  stage.walkToBodhiChess(() => {
    if (stage) stage.exitPointerLock()
    showBodhiGamesModal.value = true
  })
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

// Trạng thái dâng hương thành tâm (cúi đầu 2 giây & lời vàng Pháp Cú)
const isIncenseBowing = ref(false)
const currentScriptureVerse = ref<string | null>(null)
const incenseRewardMc = ref<number>(0)
const incenseHydraProof = ref<any>(null)
let scriptureTimeout: ReturnType<typeof setTimeout> | null = null

async function handleIncenseOffering() {
  if (isIncenseBowing.value) return
  isIncenseBowing.value = true

  const loc = stage?.currentIncenseLocation || 'hall'

  // Xoay nhân vật hướng về phía án thờ / tượng Phật khi dâng hương
  if (stage) {
    if (loc === 'hall') {
      stage.faceTowards({ x: 0, z: -19.0 })
    } else {
      stage.faceTowards({ x: 0, z: 5.0 })
    }
    // Hoạt ảnh cúi đầu thành kính giữ yên đúng 2.0 giây (tổng 3.0s, hold 2.0s)
    stage.triggerLocalEmote('bowing', 3.0, 2.0)
  }

  // Tiếng chuông chùa ngân nga
  zenAudio.playTempleBell()

  try {
    const res = await $fetch<{
      success: boolean
      firstToday: boolean
      rewardMc: number
      newBalance?: number
      verse: string
      message?: string
      hydra?: any
    }>('/api/mc/incense/offer', {
      method: 'POST',
      body: { location: loc }
    })

    if (res && res.verse) {
      onboarding.notify('incense')
      currentScriptureVerse.value = res.verse
      incenseRewardMc.value = res.rewardMc || 0
      incenseHydraProof.value = res.hydra || null
      if (scriptureTimeout) clearTimeout(scriptureTimeout)
      scriptureTimeout = setTimeout(() => {
        currentScriptureVerse.value = null
        incenseRewardMc.value = 0
        incenseHydraProof.value = null
      }, 7000)
    }

    if (res.firstToday && res.rewardMc > 0) {
      if (typeof res.newBalance === 'number') {
        economy.syncBalanceFromServer(res.newBalance)
      } else {
        economy.meritCoins += res.rewardMc
      }
      showToast(
        '+15 MC',
        res.verse,
        'sparkles',
        res.hydra
      )
    } else {
      showToast(
        'Dâng hương',
        res.verse,
        'incense',
        res.hydra
      )
    }
  } catch {
    zenAudio.playWoodenFish()
    showToast(
      'Dâng hương',
      '',
      'incense'
    )
  } finally {
    setTimeout(() => {
      isIncenseBowing.value = false
    }, 3200)
  }
}

async function handleParkourStart() {
  if (!wallet.isConnected) {
    showToast('Kết nối ví để leo núi', '', 'wallet')
    openWalletModal()
    return
  }
  if (parkour.isClimbing) {
    showToast('Đang leo núi', '', 'pagoda')
    return
  }
  if (!parkour.canClaimFreeToday && economy.meritCoins < 5) {
    showToast('Cần 5 MC', '', 'wallet')
    return
  }
  const res = await parkour.startChallenge()
  if (res) {
    zenAudio.playMindfulnessBell()
    if (res.isFree) {
      showToast('Lượt miễn phí, lên đỉnh', '', 'sparkles')
    } else {
      zenAudio.playCoinDrop()
      showToast('-5 MC, lên đỉnh', '', 'sparkles')
    }
  } else if (parkour.noticeMessage) {
    showToast('Thông Báo', parkour.noticeMessage, 'wallet')
  }
}

async function handleParkourSummit() {
  if (!parkour.isClimbing) {
    showToast('Bắt đầu ở hòm chân núi', '', 'pagoda')
    return
  }
  const res = await parkour.completeSummit()
  if (res) {
    zenAudio.playTempleBell()
    zenAudio.playCoinDrop()
    const recordText = res.isNewRecord ? ' (KỶ LỤC MỚI!)' : ''
    showToast(
      `+${res.rewardMc} MC`,
      `${res.timeTakenSec.toFixed(1)}s${recordText}`,
      'sparkles',
      res.hydra
    )
  } else if (parkour.noticeMessage) {
    showToast('Chưa Đạt Yêu Cầu', parkour.noticeMessage, 'wallet')
  }
}

let isReleasingLantern = false
async function handleLanternAction() {
  const qty = economy.getItemQuantity('lotus_lantern')
  if (qty < 1) {
    openDrawer('shop')
    return
  }
  if (drawerOpen.value) {
    closeDrawer()
  }
  if (isReleasingLantern) return
  isReleasingLantern = true
  try {
    const res = await economy.releaseLantern()
    if (!res) return
    stage?.releaseFloatingLantern()
    zenAudio.playTempleBell()
    showToast('Thả hoa đăng', `Còn ${res.remaining} trong túi`, 'sunset')
    multiplayer?.triggerEmote('pray', user.name)
  } finally {
    isReleasingLantern = false
  }
}

let lastBellRingAt = 0
function handleRingBell() {
  const now = performance.now()
  if (now - lastBellRingAt < 1800) return
  lastBellRingAt = now
  stage?.ringGreatBell()
  setTimeout(() => {
    zenAudio.playTempleBell()
  }, 320)
  void useDeedsStore().reportVisit('bell_tower')
  showToast(
    tr('Thỉnh Đại Hồng Chung', 'Ring the Great Bell'),
    tr('Tiếng chuông ngân vang thanh tịnh', 'Resonant bell brings clarity and peace'),
    'bell'
  )
  multiplayer?.triggerEmote('bow', user.name)
}

function handleRightClickAction(target: InteractionTarget) {
  // Cho phép mở/đóng cửa Chánh Điện để tham quan 3D kể cả khi chưa kết nối ví.
  if (target === 'door') {
    const isOpen = stage?.toggleSanctuaryDoor()
    zenAudio.playWoodenFish()
    showToast(isOpen ? 'Mở cửa' : 'Đóng cửa', '', 'pagoda')
    return
  }
  if (!wallet.isAuthenticated) {
    if (target) requireWalletForFeature()
    return
  }
  if (target === 'incense') {
    void handleIncenseOffering()
  } else if (target === 'merit_box' || target === 'merit_stele') {
    openDrawer('merit')
  } else if (target === 'fortune') {
    openDrawer('fortune')
  } else if (target === 'meditation') {
    openDrawer('meditation')
  } else if (target === 'hau_dong') {
    openDrawer('hau_dong')
  } else if (target === 'heritage_museum') {
    openDrawer('cards')
  } else if (target === 'abbot') {
    openAbbotChat()
  } else if (target === 'love_tree') {
    openDrawer('love_couple')
  } else if (target === 'zen_garden') {
    openDrawer('garden')
  } else if (target === 'bodhi_chess') {
    if (stage) {
      stage.sitAtBodhiChess()
      stage.exitPointerLock()
    }
    showBodhiGamesModal.value = true
  } else if (target === 'bell_tower') {
    handleRingBell()
  } else if (target === 'lantern') {
    void handleLanternAction()
  } else if (target === 'parkour_start') {
    void handleParkourStart()
  } else if (target === 'parkour_summit') {
    void handleParkourSummit()
  } else if (target === 'door') {
    const isOpen = stage?.toggleSanctuaryDoor()
    zenAudio.playWoodenFish()
    showToast(isOpen ? 'Mở cửa' : 'Đóng cửa', '', 'pagoda')
  } else if (stage && stage.isNearDoor()) {
    const isOpen = stage.toggleSanctuaryDoor()
    zenAudio.playWoodenFish()
    showToast(isOpen ? 'Mở cửa' : 'Đóng cửa', '', 'pagoda')
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
  if (target === 'door') return tr('Mở / Đóng Cửa Bức Bàn', 'Open / Close Sanctuary Doors')
  if (!wallet.isAuthenticated && target) {
    return tr('Kết nối ví Cardano để tương tác', 'Connect Cardano Wallet to Interact')
  }
  if (target === 'incense') {
    return stage?.currentIncenseLocation === 'hall'
      ? tr('Dâng Hương Tam Bảo (Chánh Điện)', 'Offer Incense at Main Altar')
      : tr('Dâng Hương Đại Đỉnh (Sân Chùa)', 'Offer Incense at Courtyard Burner')
  }
  if (target === 'merit_box') return tr('Mở Hòm Công Đức (ADA / Cúng Dường)', 'Open Merit Box (ADA / Donate)')
  if (target === 'merit_stele') return tr('Xem Bia Công Đức On-Chain (Sổ Cái & Hydra L2)', 'Inspect On-Chain Merit Stele (Ledger & Hydra L2)')
  if (target === 'fortune') return tr('Rút Quẻ Xăm Linh Tự', 'Draw Sacred Fortune Stick')
  if (target === 'love_tree') return tr('Thỉnh Quẻ Tơ Duyên (Nguyệt Lão Thắt Chỉ Hồng)', 'Consult Red Thread Love Altar')
  if (target === 'zen_garden') return tr('Chăm Sóc Vườn Thiền (Trồng Cây & Tưới Nước)', 'Tend Zen Garden (Plant & Water)')
  if (target === 'bodhi_chess') return tr('Chơi Cờ Dưới Bóng Bồ Đề (Ô Ăn Quan / Cờ Tướng)', 'Play Board Games Under Bodhi Tree')
  if (target === 'bell_tower') return tr('Thỉnh Đại Hồng Chung (Gõ Chuông)', 'Ring the Great Bell')
  if (target === 'meditation') return tr('Tọa Thiền Tĩnh Tâm', 'Sit in Mindful Meditation')
  if (target === 'abbot') return tr('Thưa chuyện với Thầy Trụ Trì', 'Speak with the Abbot')
  if (target === 'hau_dong') return tr('Mở Đàn & Thỉnh Lộc Nhà Hầu Đồng (Tứ Phủ)', 'Enter Four Palaces Ritual Shrine')
  if (target === 'heritage_museum') return tr('Mở Bảo Tàng Di Sản Cổ Tự (Sưu Tầm & Đúc NFT CIP-68)', 'Open Heritage Museum (Collect & Mint CIP-68 NFT)')
  if (target === 'lantern') {
    const qty = economy.getItemQuantity('lotus_lantern')
    return qty > 0
      ? tr(`Thả Hoa Đăng Cầu An (Có ${qty})`, `Release Peace Lantern (${qty} owned)`)
      : tr('Thỉnh Hoa Đăng Cầu An (Cửa Hàng)', 'Get Peace Lantern (Shop)')
  }
  if (target === 'door') return tr('Mở / Đóng Cửa Bức Bàn', 'Open / Close Sanctuary Doors')
  if (target === 'parkour_start') {
    return parkour.canClaimFreeToday
      ? tr('Đăng Ký Leo Núi (Lượt Miễn Phí)', 'Start Mountain Climb (Free Daily)')
      : tr('Thử Thách Leo Núi (5 MC / Lượt)', 'Mountain Climb Challenge (5 MC)')
  }
  if (target === 'parkour_summit') return tr('Rung Đại Hồng Chung & Mở Rương Báu (+100 MC)', 'Ring Great Bell & Claim Chest (+100 MC)')
  return tr('Tương Tác', 'Interact')
}

function toggleAudio() {
  isAudioMuted.value = zenAudio.toggleMute()
  if (!isAudioMuted.value && activeFestival.value && !hasPlayedFestivalBell) {
    hasPlayedFestivalBell = true
    zenAudio.playFestivalBell(activeFestival.value.id)
  }
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
const graphicsQuality = ref<'low' | 'medium' | 'high' | 'ultra'>('low')

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
  showToast(`Đồ họa: ${graphicsQuality.value}`, '', 'sparkles')
}

// Loading Screen trang trọng (Giai đoạn 5)
const isSceneLoading = ref(true)
// Người mới: mở hướng dẫn ngay sau khi màn hình tải xong
watch(isSceneLoading, (loading) => {
  if (!loading) onboarding.startIfNew()
})
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
        zenAudio.startTempleBgm()
      }, 450)
    } else {
      loadingProgress.value = p
    }
  }, 110)
}
</script>

<template>
  <div class="relative w-screen h-screen overflow-hidden select-none bg-[#100e0c]">
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
        <h2 class="text-[24px] font-bold tracking-tight text-[var(--text-primary)] mb-2">{{ t('title.appName') }}</h2>
        <p class="text-[13px] text-[var(--text-secondary)] mb-8">{{ t('desc.appTagline') }}</p>

        <!-- Progress Bar -->
        <div class="w-72 sm:w-96 h-2 bg-[var(--bg-2)] rounded-full overflow-hidden mb-3 border border-[var(--border-subtle)]">
          <div
            class="h-full bg-[var(--gold-primary)] transition-all duration-200 ease-out rounded-full"
            :style="{ width: `${loadingProgress}%` }"
          ></div>
        </div>
        <div class="text-[13px] text-[var(--text-secondary)] mb-8">
          {{ tr('Đang tải cảnh giới thiền môn...', 'Loading 3D Zen Sanctuary...') }} <span class="ui-font-mono font-semibold text-[var(--text-primary)]">{{ loadingProgress }}%</span>
        </div>

        <!-- Zen Quote -->
        <div class="max-w-md px-6 py-4 rounded-[2px] bg-[var(--bg-1)] border border-[var(--border-subtle)] text-[14px] italic text-[var(--text-primary)] leading-relaxed mb-8">
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

    <!-- Top Navigation HUD (Flat 56px Bar, Solid #100e0c, Hairline #26221d) -->
    <div v-show="!showPhotoMode">
    <header class="hud-top-bar">
      <!-- Left: Temple Wordmark, Version & Realm, Country Selector -->
      <div class="hud-top-bar__left hud-hide-sm">
        <div class="hud-brand">
          <div class="hud-brand__title-row">
            <span class="hud-brand__title">{{ tr('VẠN CẢNH THIỀN TỰ', 'HYDRA PAGODA') }}</span>
            <UiBadge variant="neutral">v0.3.0 // CIP-30</UiBadge>
          </div>
          <div class="hud-brand__user-row">
            <span class="hud-brand__user-name">{{ user.name }}</span>
            <span class="hud-divider">·</span>
            <span class="hud-brand__user-title">{{ user.title }}</span>
          </div>
        </div>

        <!-- Country Indicator (Non-clickable label per Binance Spec) -->
        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-elevated border border-hairline text-secondary select-none" :title="tr('Quốc gia hiện tại (Nhấn phím 1-9 để chuyển)', 'Current country (Press 1-9 to switch)')">
          <span class="hud-status-dot hud-status-dot--success" aria-hidden="true" />
          <span class="font-numbers font-bold text-xs text-secondary">{{ currentCountryObj.code }}</span>
          <span class="hidden sm:inline font-semibold text-xs text-primary">{{ currentCountryObj.name }}</span>
        </div>

        <!-- Gender Switch Button (Nam / Nữ Hành Giả) -->
        <button
          type="button"
          @click="toggleGender"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-elevated hover:bg-[#332d26] border border-hairline hover:border-gold text-xs font-semibold text-white transition cursor-pointer ui-focus-ring"
          :title="tr('Đổi giới tính nhân vật Nam / Nữ (Phím tắt: G)', 'Switch Male / Female character (Hotkey: G)')"
        >
          <span class="text-primary font-bold">{{ user.gender === 'male' ? tr('Nam', 'Male') : tr('Nữ', 'Female') }}</span>
          <span class="hidden md:inline text-secondary">{{ tr('Hành Giả', 'Pilgrim') }}</span>
        </button>
      </div>

      <!-- Right: Stats & Utilities -->
      <div class="hud-top-bar__right">
        <!-- Chỉ hiện Ngày Tu & Số dư MC khi đã đăng nhập ví (Wallet Gate: ẩn hoàn toàn MC khi chưa kết nối) -->
        <template v-if="wallet.isAuthenticated">
          <UiStatCell
            :label="tr('Ngày Tu', 'Streak')"
            :value="streak.status?.currentStreak ?? 0"
            size="sm"
            class="hud-stat-cell hud-hide-sm"
          />

          <div class="hud-v-divider" />

          <!-- Merit Coins Stat + Top-up -->
          <UiStatCell
            :label="tr('Hành Trang', 'Balance')"
            :value="economy.meritCoins.toLocaleString()"
            unit="MC"
            highlight
            size="sm"
            class="hud-stat-cell"
          >
            <template #action>
              <UiButton variant="primary" size="sm" class="ml-2 hud-topup" @click="openWalletModal()">
                {{ tr('+ Nạp', '+ Top Up') }}
              </UiButton>
            </template>
          </UiStatCell>

          <div class="hud-v-divider" />
        </template>

        <!-- Cardano Wallet Status Button -->
        <UiButton
          v-if="!wallet.isAuthenticated"
          variant="primary"
          size="sm"
          @click="openWalletModal()"
        >
          {{ tr('Kết nối ví', 'Connect Wallet') }}
        </UiButton>
        <button
          v-else
          type="button"
          @click="openWalletModal()"
          class="hud-wallet-btn ui-focus-ring"
          :title="wallet.isIframeMode ? tr('Đồng bộ ví từ HydraOne Header', 'Sync wallet from HydraOne Header') : tr('Kết nối ví Cardano (Eternl)', 'Connect Cardano Wallet (Eternl)')"
        >
          <span
            class="hud-status-dot hud-status-dot--success"
            aria-hidden="true"
          />
          <ZenIcon name="wallet" :size="20" class="hud-show-sm" :label="tr('Ví Cardano', 'Cardano Wallet')" />
          <span class="text-sm font-semibold hud-hide-sm" :class="!wallet.isIframeMode ? 'font-numbers' : ''">
            {{ wallet.isIframeMode ? 'HydraOne' : wallet.shortAddress }}
          </span>
          <UiBadge v-if="wallet.isTestnet && !wallet.isIframeMode" variant="warning" class="hud-hide-sm">TESTNET</UiBadge>
        </button>

          <UiBadge
            v-if="activeFestival"
            variant="gold"
            dot
            class="hud-hide-sm"
            :title="activeFestival.name"
          >
            {{ activeFestival.badgeLabel }}
          </UiBadge>

        <div class="hud-v-divider" />

        <!-- Display & Camera Settings Dropdown ("Hiển thị") -->
        <div class="relative">
          <button
            type="button"
            @click="showDisplayMenu = !showDisplayMenu"
            class="hud-icon-btn hud-display-btn ui-focus-ring"
            :class="{ 'is-active': showDisplayMenu }"
            :title="tr('Thời gian, Đồ họa, Góc nhìn & Ngôn ngữ', 'Time, Graphics, Camera & Language')"
          >
            <ZenIcon name="sun" :size="20" class="hud-show-sm" :label="tr('Hiển thị', 'Display')" />
            <span class="text-xs font-semibold hud-hide-sm">{{ tr('Hiển thị', 'Display') }}</span>
            <ZenIcon name="chevron-down" :size="14" class="transition-transform hud-hide-sm" :class="showDisplayMenu ? 'rotate-180' : ''" />
          </button>

          <div
            v-if="showDisplayMenu"
            class="hud-popover hud-popover--display"
          >
            <div class="hud-popover__header">
              <span class="text-xs font-semibold text-secondary">{{ tr('Cài đặt hiển thị & Góc nhìn', 'Display, Camera & Language') }}</span>
            </div>
            <div class="hud-popover__list">
              <button
                type="button"
                @click="cycleTimeOfDay"
                class="hud-popover__item hud-popover__item--row ui-focus-ring"
              >
                <div>
                  <div class="text-sm font-semibold">{{ tr('Thời gian', 'Time of Day') }}</div>
                  <div class="text-xs text-secondary">
                    {{ currentTimeOfDay === 'day' ? tr('Ban ngày', 'Daylight') : currentTimeOfDay === 'sunset' ? tr('Hoàng hôn', 'Sunset') : tr('Ban đêm', 'Night') }}
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
                  <div class="text-sm font-semibold">{{ tr('Đồ họa', 'Graphics') }}</div>
                  <div class="text-xs text-secondary font-numbers">
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
                  <div class="text-sm font-semibold">{{ tr('Góc nhìn', 'Camera View') }}</div>
                  <div class="text-xs text-secondary">
                    {{ user.cameraMode === 'fpp' ? tr('Góc nhìn thứ nhất (FPP)', 'First-Person (FPP)') : tr('Góc nhìn thứ ba (TPP)', 'Third-Person (TPP)') }}
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
                  <div class="text-sm font-semibold">{{ tr('Nhân vật', 'Character') }}</div>
                  <div class="text-xs text-secondary">
                    {{ user.gender === 'male' ? tr('Nam Hành Giả (Tóc ngắn)', 'Male Pilgrim (Short hair)') : tr('Nữ Hành Giả (Tóc dài)', 'Female Pilgrim (Long hair)') }}
                  </div>
                </div>
                <UiKeycap>G</UiKeycap>
              </button>

              <button
                type="button"
                @click="toggleLocale()"
                class="hud-popover__item hud-popover__item--row ui-focus-ring"
              >
                <div>
                  <div class="text-sm font-semibold">{{ tr('Ngôn ngữ', 'Language') }}</div>
                  <div class="text-xs text-secondary">
                    {{ currentLocale === 'vi' ? 'Tiếng Việt (Chủ đạo)' : 'English' }}
                  </div>
                </div>
                <UiKeycap>{{ currentLocale.toUpperCase() }}</UiKeycap>
              </button>
              <button
                type="button"
                @click="setPhotoModeActive(true)"
                class="hud-popover__item hud-popover__item--row ui-focus-ring"
              >
                <div>
                  <div class="text-sm font-semibold">{{ tr('Chế độ ảnh', 'Photo Mode') }}</div>
                  <div class="text-xs text-secondary">{{ tr('Ẩn HUD & chụp ảnh PNG', 'Hide HUD & capture PNG') }}</div>
                </div>
                <UiKeycap>P</UiKeycap>
              </button>
              <button
                type="button"
                @click="onboarding.restart()"
                class="hud-popover__item hud-popover__item--row ui-focus-ring"
              >
                <div>
                  <div class="text-sm font-semibold">{{ tr('Hướng dẫn', 'Tutorial') }}</div>
                  <div class="text-xs text-secondary">{{ tr('Xem lại 5 phút đầu', 'Replay the first 5 minutes') }}</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Audio Mute / Unmute Button (Icon-Only Whitelisted Item #7) -->
        <button
          type="button"
          @click="toggleAudio"
          :aria-label="tr('Bật hoặc tắt âm thanh thiền tự', 'Mute or unmute sanctuary audio')"
          :title="tr('Bật hoặc tắt âm thanh thiền tự', 'Mute or unmute sanctuary audio')"
          class="hud-icon-btn ui-focus-ring"
        >
          <ZenIcon :name="isAudioMuted ? 'volume-x' : 'volume-2'" :size="18" />
        </button>

        <!-- Online Pilgrims Chip -->
        <button
          type="button"
          @click="openDrawer('sangha')"
          class="hud-sangha-btn ui-focus-ring"
          :title="tr('Danh sách đồng tu đang trực tuyến & Pháp đàm', 'Online pilgrims & Dharma talk')"
        >
          <span class="hud-status-dot hud-status-dot--success" aria-hidden="true" />
          <span class="font-numbers text-sm font-bold">{{ onlinePilgrimCount }}</span>
          <span class="text-xs text-secondary hud-hide-sm">{{ tr('Đồng Tu', 'Pilgrims') }}</span>
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

    <!-- Right-Click Action Toast Pill (Luôn ghim ở mép dưới màn hình để không che tầm nhìn của người chơi) -->
    <div
      v-if="nearTarget"
      class="pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-20 z-20 transition-all duration-150 transform scale-100 flex flex-wrap items-center justify-center gap-2"
    >
      <button
        type="button"
        class="bg-surface-card border border-gold px-4 py-2 rounded-md shadow-2xl flex items-center gap-2.5 cursor-pointer hover:bg-surface-elevated transition"
        @click="handleAction"
      >
        <template v-for="(k, ki) in interactHint.keys" :key="k">
          <span v-if="ki > 0" class="text-secondary text-xs">{{ interactHint.sep }}</span>
          <UiKeycap>{{ k }}</UiKeycap>
        </template>
        <span class="text-white text-sm font-semibold">{{ getInteractionPrompt(nearTarget) }}</span>
      </button>

      <UiButton
        v-if="nearTarget === 'lantern'"
        variant="secondary-light"
        size="sm"
        @click="openDrawer('garden')"
      >
        {{ tr('Cho cá ăn', 'Feed Koi') }}
      </UiButton>
      <UiButton
        v-else-if="nearTarget === 'zen_garden'"
        variant="secondary-light"
        size="sm"
        @click="openDrawer('garden')"
      >
        {{ tr('Trồng cây', 'Plant') }}
      </UiButton>
    </div>

    <!-- Banner Lời Vàng Pháp Cú (Hiện trang nghiêm khi Dâng Hương Tam Bảo) -->
    <Transition name="fade">
      <div
        v-if="currentScriptureVerse"
        class="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-md w-[92%] px-5 py-3.5 rounded-lg bg-surface-card/95 border border-[var(--primary,#c9a24b)] shadow-[0_8px_32px_rgba(0,0,0,0.85)] text-center space-y-1.5 transition-all duration-300"
      >
        <div class="flex items-center justify-center gap-2 text-xs font-bold text-primary">
          <ZenIcon name="sparkles" class="w-3.5 h-3.5" />
          <span>{{ tr('Lời Vàng Pháp Cú', 'Golden Dharma Verse') }}</span>
          <ZenIcon name="sparkles" class="w-3.5 h-3.5" />
        </div>
        <p class="text-white text-sm font-medium italic leading-relaxed">
          "{{ currentScriptureVerse }}"
        </p>
        <div class="text-xs text-secondary">
          {{ tr('Lòng thành dâng Phật • Nguyện thân tâm an lạc', 'Sincere offering to the Buddha • May body and mind be at peace') }}
        </div>
        <div v-if="incenseRewardMc > 0 || incenseHydraProof" class="pt-1.5 flex flex-wrap items-center justify-center gap-2 border-t border-hairline/60">
          <UiBadge v-if="incenseRewardMc > 0" variant="warning" class="font-numbers font-bold">
            +{{ incenseRewardMc }} {{ tr('MC Lộc Phật', 'MC Blessing') }}
          </UiBadge>
          <HydraBadge v-if="incenseHydraProof" :proof="incenseHydraProof" />
        </div>
      </div>
    </Transition>

    <!-- Chip nhắc lấy lại điều khiển khi mất pointer lock -->
    <div
      v-if="showResumeChip"
      role="status"
      class="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-20 px-3.5 py-2 rounded-md bg-surface-card border border-hairline shadow-2xl text-xs text-secondary"
    >
      {{ hasEverLocked ? tr('Nhấp vào cảnh để tiếp tục điều khiển', 'Click on the scene to resume control') : tr('Nhấp vào cảnh để bắt đầu điều khiển', 'Click on the scene to start moving') }}
    </div>

    <!-- ========================================================================= -->
    <!-- BẢNG HUD DỰ LỄ HẦU ĐỒNG (HIỆN TỰ ĐỘNG KHI BƯỚC VÀO NHÀ HẦU ĐỒNG TỨ PHỦ)   -->
    <!-- ========================================================================= -->
    <div
      v-if="isInsideHauDong && hauDong.activeSession"
      class="pointer-events-auto absolute top-16 left-4 z-20 w-80 p-3 rounded-md bg-surface-card border border-[var(--primary,#c9a24b)] shadow-2xl space-y-2"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-[var(--trading-up,#0ecb81)] animate-pulse" />
          <span class="text-xs font-bold text-primary font-numbers">
            {{ tr('ĐIỆN TỨ PHỦ · GIÁ', 'FOUR PALACES · STAGE') }} {{ hauDong.activeSession.giaIndex }}/5
          </span>
        </div>
        <span class="text-xs font-numbers text-secondary">
          {{ tr('Còn', 'Left') }} {{ hauDong.activeSession.stepRemainingSec }}s
        </span>
      </div>

      <div>
        <div class="text-sm font-bold text-white leading-tight">
          {{ hauDong.activeSession.deityName }}
        </div>
        <div class="text-xs text-secondary mt-0.5">
          {{ tr('Bước', 'Step') }} <span class="font-numbers">{{ hauDong.activeSession.stepId }}/6</span>:
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
          {{ hauDong.isBowing ? t('btn.bowDone') : t('btn.bow') }}
          <span v-if="!hauDong.isBowing" class="font-numbers text-gold ml-1">{{ t('toast.mcGain', { mc: 5 }) }}</span>
        </UiButton>
        <UiButton
          v-if="hauDong.activeSession.stepId === 5 || hauDong.activeSession.stepId === 6"
          variant="primary"
          size="sm"
          class="flex-1 justify-center"
          :disabled="hauDong.submitting || Boolean(hauDong.myAttendance?.hasClaimedThisGia)"
          @click="handleQuickClaimHauDong"
        >
          {{ hauDong.myAttendance?.hasClaimedThisGia ? t('btn.claimed') : t('btn.claimLoc') }}
        </UiButton>
        <UiButton
          v-else
          variant="secondary"
          size="sm"
          class="flex-1 justify-center"
          @click="openDrawer('hau_dong')"
        >
          {{ t('btn.details') }}
        </UiButton>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- BẢNG HUD LEO NÚI PARKOUR "ĐƯỜNG LÊN ĐỈNH PHÙ VÂN" (KHI ĐANG TRONG THỬ THÁCH) -->
    <!-- ========================================================================= -->
    <div
      v-if="parkour.isClimbing"
      class="pointer-events-auto absolute top-16 left-4 z-20 w-80 p-3 rounded-md bg-surface-card border border-[var(--primary,#c9a24b)] shadow-2xl space-y-2.5"
    >
      <div class="flex items-center justify-between gap-2 border-b border-hairline pb-2">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-[var(--primary,#c9a24b)] animate-ping" />
          <span class="text-xs font-bold text-primary font-numbers">
            {{ tr('ĐƯỜNG LÊN ĐỈNH PHÙ VÂN', 'SACRED PEAK CLIMB') }}
          </span>
        </div>
        <span class="text-xs font-numbers text-secondary">
          {{ tr('Lượt', 'Run') }} {{ parkour.attemptsToday }}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="bg-surface-elevated/70 p-2 rounded border border-hairline">
          <div class="text-secondary text-xs">{{ tr('Thời gian leo', 'Climb time') }}</div>
          <div class="text-sm font-bold text-white font-numbers">
            {{ parkour.elapsedSec.toFixed(1) }}s
          </div>
        </div>
        <div class="bg-surface-elevated/70 p-2 rounded border border-hairline">
          <div class="text-secondary text-xs">{{ tr('Độ cao', 'Altitude') }}</div>
          <div class="text-sm font-bold text-primary font-numbers">
            {{ playerAltitude.toFixed(1) }}m / 70.0m
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs text-secondary px-0.5">
        <span>{{ tr('Kỷ lục tốt nhất:', 'Best record:') }}</span>
        <span class="font-numbers text-white font-medium">
          {{ parkour.bestTimeSec ? `${parkour.bestTimeSec.toFixed(1)}s` : tr('Chưa có', 'None') }}
        </span>
      </div>

      <div class="flex items-center gap-1.5 pt-1">
        <UiButton
          variant="secondary"
          size="sm"
          class="w-full justify-center text-xs"
          @click="parkour.stopTimer(); showToast('Đã dừng thử thách', '', 'pagoda')"
        >
          {{ tr('Hủy / Xuống Núi', 'Cancel / Descend') }}
        </UiButton>
      </div>
    </div>

    <!-- Bottom Controls: Hotkeys Popover (Left) & 3 Drop-up Menus (Right) -->
    <div class="hud-bottom absolute bottom-3 inset-x-3 flex items-center justify-between gap-3 pointer-events-none z-20">
      <!-- Left: Compact Hotkey Pill + ALT Indicator -->
      <div class="relative pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          @click="showHotkeysMenu = !showHotkeysMenu"
          class="hud-hide-sm min-h-[40px] px-3.5 py-2 rounded-md bg-surface-card text-xs text-secondary hover:text-white border border-hairline hover:border-hairline flex items-center gap-2 transition cursor-pointer shadow-lg"
          :title="tr('Nhấp để xem bảng phím tắt điều khiển', 'Click to view control hotkeys')"
        >
          <UiKeycap v-for="h in pillHints" :key="h.id">{{ h.keys[0] }}</UiKeycap>
          <span class="text-xs font-medium hidden sm:inline">{{ tr('Phím tắt', 'Hotkeys') }}</span>
        </button>

        <!-- Live ALT Mouse Cursor Indicator -->
        <div
          class="hud-hide-sm min-h-[40px] px-3.5 py-2 rounded-md bg-surface-card text-xs border flex items-center gap-2 transition select-none shadow-md"
          :class="isAltHeld ? 'border-gold text-white bg-surface-elevated' : 'text-secondary border-hairline'"
          :title="t('desc.altHint')"
        >
          <UiKeycap>ALT</UiKeycap>
          <span class="text-xs font-medium hidden sm:inline">
            {{ isAltHeld ? tr('Đang hiện con trỏ chuột', 'Cursor visible') : tr('Giữ ALT để hiện chuột', 'Hold ALT for cursor') }}
          </span>
        </div>

        <!-- Cục Mini Map (Widget Radar thu nhỏ trên thanh HUD) -->
        <button
          type="button"
          @click="showMiniMap = !showMiniMap; if (showMiniMap) showHotkeysMenu = false"
          class="min-h-[40px] px-2.5 py-1.5 rounded-md bg-surface-card text-xs border flex items-center gap-2 transition cursor-pointer select-none shadow-md group"
          :class="showMiniMap ? 'border-primary text-white bg-surface-elevated ring-1 ring-primary/40' : 'text-secondary border-hairline hover:text-white hover:border-primary/60'"
          :title="tr('Nhấp hoặc bấm phím M để mở Sơ đồ Chùa', 'Click or press M to open Sanctuary Map')"
        >
          <!-- Radar tròn thu nhỏ trực tiếp trên cục HUD -->
          <div class="relative w-6 h-6 rounded-full bg-canvas-dark border border-primary/60 overflow-hidden flex items-center justify-center">
            <svg viewBox="0 0 24 24" class="w-full h-full">
              <!-- Vòng tròn radar -->
              <circle cx="12" cy="12" r="10" fill="none" stroke="#332d26" stroke-width="1" />
              <line x1="12" y1="2" x2="12" y2="22" stroke="#332d26" stroke-width="0.8" opacity="0.6" />
              <line x1="2" y1="12" x2="22" y2="12" stroke="#332d26" stroke-width="0.8" opacity="0.6" />
              <!-- Chấm vị trí & Mũi tên la bàn theo hướng nhìn -->
              <circle cx="12" cy="12" r="2.2" fill="#c9a24b" />
              <g :transform="'translate(12,12) rotate(' + miniMapPlayerRotDeg + ')'">
                <path d="M 0 -8 L 2.2 -3 L -2.2 -3 Z" fill="#c9a24b" />
              </g>
            </svg>
          </div>
          <span class="text-xs font-medium hidden sm:inline">{{ tr('Bản đồ', 'Map') }}</span>
          <UiKeycap>M</UiKeycap>
        </button>

        <!-- Mini Map Popover Modal (Hiện bé bé ngay trên Cục Mini Map) -->
        <div
          v-if="showMiniMap"
          class="absolute bottom-14 left-0 sm:left-24 w-88 sm:w-[420px] max-h-[calc(100dvh-6rem)] overflow-y-auto p-3.5 rounded-lg bg-surface-card border border-hairline shadow-2xl z-50 flex flex-col gap-2.5 pointer-events-auto"
        >
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-hairline pb-2">
            <div class="flex items-center gap-2">
              <ZenIcon name="pagoda" :size="16" class="text-primary" />
              <span class="text-xs font-bold text-white whitespace-nowrap">{{ tr('Sơ Đồ Thiền Tự', 'Sanctuary Map') }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="hidden sm:inline text-xs font-numbers text-secondary whitespace-nowrap">
                X: {{ livePlayerPos.x.toFixed(1) }} · Z: {{ livePlayerPos.z.toFixed(1) }} · {{ tr('Cao:', 'Alt:') }} {{ livePlayerPos.y.toFixed(1) }}m
              </span>
              <button
                type="button"
                :aria-label="tr('Đóng bản đồ', 'Close map')"
                @click="showMiniMap = false"
                class="w-[40px] h-[40px] shrink-0 -my-1.5 rounded flex items-center justify-center text-secondary hover:text-white hover:bg-surface-elevated cursor-pointer"
              >
                <ZenIcon name="x" :size="14" />
              </button>
            </div>
          </div>

          <!-- Thanh trạng thái Dẫn đường tự động nếu đang auto-walk -->
          <div v-if="isAutoWalking" class="flex items-center justify-between p-2 rounded bg-surface-elevated border border-primary/40 text-xs">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span class="text-white">{{ tr('Đang tự bước tới:', 'Auto-walking to:') }} <strong>{{ activeNavTargetName }}</strong></span>
            </div>
            <UiButton variant="secondary" size="sm" class="text-xs h-[40px]! px-2" @click="cancelNavigation">
              {{ tr('Dừng bước', 'Stop') }}
            </UiButton>
          </div>

          <!-- Bản đồ SVG 2D, tỉ lệ đều 6 px/m, Bắc ở trên (tọa độ lấy từ MapLayout.LANDMARKS) -->
          <div class="relative w-full rounded-md bg-canvas-dark border border-hairline overflow-hidden select-none">
            <svg viewBox="-120 0 558 424" class="block w-full h-auto font-sans" role="img" :aria-label="tr('Sơ đồ Thiền Tự, hướng Bắc ở trên', 'Sanctuary Map, North up')">
              <!-- Mặt bằng: sân gạch, ngự đạo, đường sang Nhà Hầu Đồng, đường sang Bảo Tàng Di Sản, đường vòng lên núi -->
              <rect x="36" y="261" width="240" height="126" fill="#1a1714" stroke="#332d26" />
              <rect x="144" y="261" width="24" height="126" fill="#26221d" />
              <rect x="156" y="266" width="210" height="8" fill="#26221d" />
              <rect x="362" y="243" width="8" height="27" fill="#26221d" />
              <rect x="-58" y="266" width="102" height="8" fill="#26221d" />
              <rect x="-58" y="237" width="8" height="33" fill="#26221d" />
              <polyline points="48,270 48,120 96,72 156,51" fill="none" stroke="#332d26" stroke-width="6" stroke-dasharray="10,8" stroke-linejoin="round" />

              <!-- Bảo Tàng Di Sản Cổ Tự (Tây — đối xứng Nhà Hầu Đồng) -->
              <g class="cursor-pointer" @click="handleGuideToHeritageMuseum(); showMiniMap = false">
                <rect x="-108" y="129" width="108" height="108" fill="#1f1c18" stroke="#0ecb81" stroke-width="1.6" />
                <text x="-54" y="178" font-size="16" font-weight="700" fill="#0ecb81" text-anchor="middle">{{ tr('Bảo Tàng', 'Museum') }}</text>
                <text x="-54" y="198" font-size="14" font-weight="600" fill="#c9a24b" text-anchor="middle">CIP-68 NFT</text>
              </g>

              <!-- Hồ Sen -->
              <circle cx="51" cy="321" r="39" fill="#17242a" stroke="#5f7f86" />
              <text x="51" y="327" font-size="17" fill="#a89c88" text-anchor="middle">{{ tr('Hồ Sen', 'Lotus Pond') }}</text>

              <!-- Lầu Chuông -->
              <rect x="240" y="300" width="43" height="43" fill="#26221d" stroke="#6b6252" />
              <text x="276" y="362" font-size="17" fill="#a89c88" text-anchor="middle">{{ tr('Lầu Chuông', 'Bell Tower') }}</text>

              <!-- Đại Hùng Bảo Điện -->
              <g class="cursor-pointer" @click="handleGuideToSanctuary(); showMiniMap = false">
                <rect x="60" y="105" width="192" height="156" fill="#1a1714" stroke="#332d26" />
                <rect x="72" y="117" width="168" height="132" fill="#26221d" stroke="#c9a24b" stroke-width="1.4" />
                <circle cx="156" cy="132" r="6" fill="#c9a24b" />
                <text x="156" y="196" font-size="17" font-weight="700" fill="#c9a24b" text-anchor="middle">{{ tr('Chánh Điện', 'Main Hall') }}</text>
              </g>

              <!-- Nhà Hầu Đồng (Đông) -->
              <g class="cursor-pointer" @click="handleGuideToHauDong(); showMiniMap = false">
                <rect x="300" y="123" width="132" height="120" fill="#26221d" stroke="#a89c88" />
                <text x="366" y="189" font-size="17" font-weight="700" fill="#f6ecd8" text-anchor="middle">{{ tr('Hầu Đồng', 'Four Palaces') }}</text>
              </g>

              <!-- Bàn Xin Xăm và Hòm Công Đức -->
              <g class="cursor-pointer" @click="handleGuideToFortune(); showMiniMap = false">
                <rect x="120" y="294" width="12" height="10" fill="#c9a24b" />
                <text x="132" y="288" font-size="17" fill="#f6ecd8" text-anchor="end">{{ tr('Xin Xăm', 'Fortune') }}</text>
              </g>
              <g class="cursor-pointer" @click="handleGuideToMerit(); showMiniMap = false">
                <rect x="180" y="294" width="12" height="10" fill="#c9a24b" />
                <text x="180" y="288" font-size="17" fill="#f6ecd8" text-anchor="start">{{ tr('Công Đức', 'Merit Box') }}</text>
              </g>

              <!-- Cây Nguyệt Lão -->
              <g class="cursor-pointer" @click="handleGuideToLoveTree(); showMiniMap = false">
                <circle cx="93" cy="345" r="8" fill="#26221d" stroke="#b8372b" stroke-width="2" />
                <text x="108" y="366" font-size="17" fill="#f6ecd8">{{ tr('Nguyệt Lão', 'Love Tree') }}</text>
              </g>

              <!-- Cổng Tam Quan (Nam) -->
              <g class="cursor-pointer" @click="handleGuideToTamQuan(); showMiniMap = false">
                <rect x="114" y="376" width="84" height="21" fill="#26221d" stroke="#a89c88" />
                <text x="156" y="418" font-size="17" fill="#f6ecd8" text-anchor="middle">{{ tr('Cổng Tam Quan', 'Tam Quan Gate') }}</text>
              </g>

              <!-- Đường lên núi Parkour (Bắc, sau chùa) -->
              <g class="cursor-pointer" @click="handleGuideToParkour(); showMiniMap = false">
                <rect x="148" y="34" width="16" height="10" fill="#26221d" stroke="#c9a24b" />
                <text x="156" y="26" font-size="17" font-weight="700" fill="#c9a24b" text-anchor="middle">{{ tr('Leo núi Parkour', 'Mountain Climb') }}</text>
              </g>

              <!-- La bàn: hướng Bắc -->
              <g transform="translate(404,34)">
                <path d="M 0 -14 L 7 6 L 0 2 L -7 6 Z" fill="#c9a24b" />
                <text y="26" font-size="17" fill="#a89c88" text-anchor="middle">{{ tr('Bắc', 'N') }}</text>
              </g>

              <!-- Đồng tu online khác -->
              <g v-for="rp in remotePilgrimsList" :key="rp.id" :transform="'translate(' + toSvgCoords(rp.position[0], rp.position[2]).u + ',' + toSvgCoords(rp.position[0], rp.position[2]).v + ')'">
                <circle r="5" fill="#f6ecd8" stroke="#100e0c" stroke-width="1.2" />
                <title>{{ rp.name }}</title>
              </g>

              <!-- Vị trí người chơi, mũi tên chỉ hướng nhìn -->
              <g :transform="'translate(' + miniMapPlayerU + ',' + miniMapPlayerV + ')'">
                <circle r="12" fill="none" stroke="#c9a24b" stroke-width="1.4" opacity="0.5" />
                <circle r="6" fill="#c9a24b" stroke="#100e0c" stroke-width="2" />
                <path :transform="'rotate(' + miniMapPlayerRotDeg + ')'" d="M 0 -19 L 5.5 -8 L -5.5 -8 Z" fill="#c9a24b" />
              </g>
            </svg>
            <div class="absolute bottom-1 right-2 text-xs font-numbers text-secondary pointer-events-none">
              {{ tr('Đồng tu:', 'Pilgrims:') }} {{ onlinePilgrimCount }}
            </div>
          </div>

          <!-- Nút Dẫn đường nhanh đến các địa danh -->
          <div class="space-y-1.5">
            <span class="text-xs text-secondary font-medium">{{ tr('Bấm để tự động bước tới:', 'Click to walk automatically to:') }}</span>
            <div class="grid grid-cols-3 gap-1.5 text-xs font-numbers">
              <UiButton variant="secondary" size="sm" class="justify-center text-xs h-[40px]! px-1.5 whitespace-normal leading-tight text-center" @click="handleGuideToSanctuary(); showMiniMap = false">
                {{ tr('Chánh Điện', 'Main Hall') }}
              </UiButton>
              <UiButton variant="secondary" size="sm" class="justify-center text-xs h-[40px]! px-1.5 whitespace-normal leading-tight text-center" @click="handleGuideToFortune(); showMiniMap = false">
                {{ tr('Bàn Xin Xăm', 'Fortune Desk') }}
              </UiButton>
              <UiButton variant="secondary" size="sm" class="justify-center text-xs h-[40px]! px-1.5 whitespace-normal leading-tight text-center" @click="handleGuideToMerit(); showMiniMap = false">
                {{ tr('Hòm Công Đức', 'Merit Box') }}
              </UiButton>
              <UiButton variant="secondary" size="sm" class="justify-center text-xs h-[40px]! px-1.5 whitespace-normal leading-tight text-center" @click="handleGuideToLoveTree(); showMiniMap = false">
                {{ tr('Cây Nguyệt Lão', 'Love Tree') }}
              </UiButton>
              <UiButton variant="secondary" size="sm" class="justify-center text-xs h-[40px]! px-1.5 whitespace-normal leading-tight text-center" @click="handleGuideToHauDong(); showMiniMap = false">
                {{ tr('Nhà Hầu Đồng', 'Four Palaces') }}
              </UiButton>
              <UiButton variant="secondary" size="sm" class="justify-center text-xs h-[40px]! px-1.5 whitespace-normal leading-tight text-center" @click="handleGuideToHeritageMuseum(); showMiniMap = false">
                {{ tr('Bảo Tàng Di Sản', 'Heritage Museum') }}
              </UiButton>
              <UiButton variant="secondary" size="sm" class="justify-center text-xs h-[40px]! px-1.5 whitespace-normal leading-tight text-center" @click="handleGuideToParkour(); showMiniMap = false">
                {{ tr('Leo Núi Parkour', 'Mountain Climb') }}
              </UiButton>
            </div>
          </div>
        </div>

        <!-- Full Hotkey Cheat Sheet Popover -->
        <div
          v-if="showHotkeysMenu"
          class="absolute bottom-14 left-0 w-96 p-4 rounded-md bg-surface-card border border-hairline shadow-2xl z-50 flex flex-col gap-3"
        >
          <div class="flex items-center justify-between border-b border-hairline pb-2.5">
            <span class="text-sm font-bold text-white">{{ tr('Phím tắt điều khiển & Chuột', 'Keyboard & Mouse Controls') }}</span>
            <button
              type="button"
              :aria-label="tr('Đóng bảng phím tắt', 'Close hotkeys')"
              @click="showHotkeysMenu = false"
              class="w-[40px] h-[40px] shrink-0 -my-1 rounded flex items-center justify-center text-secondary hover:text-white hover:bg-surface-elevated cursor-pointer"
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
              class="flex items-center justify-between min-h-[40px] text-xs text-secondary hover:text-white cursor-pointer ui-focus-ring"
            >
              <span class="font-semibold">{{ tr('Nhà phát triển', 'Developer') }}</span>
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

      <!-- Right: 3 Cụm Drop-up Island (chỉ mở khi đã kết nối ví; chưa kết nối hiện chip tham quan 3D) -->
      <div v-if="!wallet.isAuthenticated" class="pointer-events-auto select-none flex items-center gap-2.5 bg-[#1a1714] border border-[#332d26] rounded-[2px] px-3 py-2 shadow-2xl">
        <span class="text-xs text-[#f0e6d2]">
          {{ tr('Chế độ tham quan 3D · Kết nối ví để dùng tính năng', '3D Sightseeing Mode · Connect wallet for features') }}
        </span>
        <UiButton variant="primary" size="sm" @click="openWalletModal()">
          {{ tr('Kết nối ví', 'Connect Wallet') }}
        </UiButton>
      </div>
      <div v-else class="hud-dock flex items-center gap-2 pointer-events-auto select-none">
        <!-- Cụm 1: Bói Quẻ & Cầu An (Popup Phím 1) -->
        <div class="relative">
          <div
            v-if="showDivinationMenu"
            class="hud-popover hud-popover--bottom w-80 p-2"
          >
            <div class="px-3 py-2 border-b border-hairline mb-1 flex items-center justify-between">
              <span class="text-xs font-semibold text-secondary">{{ tr('Bói Quẻ 6 Môn Cầu An', '6 Sacred Divination Topics') }}</span>
              <UiKeycap>{{ tr('Phím 1', 'Key 1') }}</UiKeycap>
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
            :title="tr('Bấm phím [1] hoặc nhấp chuột để mở Bói Quẻ 6 Môn', 'Press [1] or click to open Divination')"
            @click="toggleDivinationMenu"
          >
            <span class="hud-dock__label">{{ tr('Bói Quẻ & Cầu An', 'Divination') }}</span>
            <UiKeycap class="hud-keycap-gold hud-hide-sm">1</UiKeycap>
            <ZenIcon name="chevron-up" :size="16" class="transition-transform hud-hide-sm" :class="showDivinationMenu ? 'rotate-180' : ''" />
          </UiButton>
        </div>

        <!-- Cụm 2: Thiền & Công Đức (Secondary Drop-up - Hotkey [2]) -->
        <div class="relative">
          <div
            v-if="showMeditationMenu"
            class="absolute bottom-14 right-0 w-[320px] p-3 rounded-md bg-surface-card border border-hairline shadow-2xl z-50 flex flex-col gap-1"
          >
            <div class="px-3 pb-2.5 mb-1 border-b border-hairline flex items-center justify-between">
              <span class="text-sm font-bold text-white">{{ tr('Hành Trì & Phước Đức', 'Mindfulness & Merit') }}</span>
              <UiKeycap>{{ tr('Phím 2', 'Key 2') }}</UiKeycap>
            </div>
            <button
              type="button"
              @click="openDrawerFromDropup('merit')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">01</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">{{ tr('Hòm Công Đức Tam Bảo', 'Sanctuary Merit Box') }}</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">{{ tr('Tâm Duyên, Sen Vàng, Cardano ADA', 'Micro-donations & Cardano ADA') }}</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('meditation')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">02</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">{{ tr('Hội Thiền 432Hz', '432Hz Meditation Hall') }}</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">{{ tr('Chuông xoay & Điều tức chánh niệm', 'Singing bowls & 4-4-6 breathing') }}</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('sangha')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">03</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">{{ tr('Pháp Đàm & Đồng Tu', 'Dharma Talk & Sangha') }}</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">{{ tr('Lời nguyện chánh niệm', 'Mindful wishes') }} (<span class="font-numbers">{{ onlinePilgrimCount }}</span> {{ tr('đang online', 'online') }})</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('streak')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">04</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">{{ t('title.streak') }}</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">{{ t('desc.streakIntro') }}</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('garden')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-primary pt-0.5 w-6 shrink-0">05</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">{{ tr('Đàn Cá Koi & Vườn Thiền', 'Sanctuary Koi & Zen Garden') }}</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">{{ tr('Cho cá ăn, đặt tên & trồng cây sen, trúc, bồ đề', 'Feed & name Koi, plant lotus, bamboo & bodhi') }}</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('hau_dong')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer border-t border-hairline mt-1 pt-2.5"
            >
              <span class="font-numbers text-xs font-semibold text-primary pt-0.5 w-6 shrink-0">06</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-primary leading-snug whitespace-nowrap">{{ tr('Nhà Hầu Đồng (Điện Tứ Phủ)', 'Four Palaces Ritual Shrine') }}</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">{{ tr('Hầu đồng 5 Giá (8p), Thỉnh Lộc MC & Mở Đàn', '5-Stage Ritual (8m), Blessings & Sponsorship') }}</div>
              </div>
            </button>
            <button
              type="button"
              @click="openAbbotChat()"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer border-t border-hairline mt-1 pt-2.5"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">07</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">{{ tr('Thầy Trụ Trì (Hiên Tiền Điện)', 'Temple Abbot (Front Veranda)') }}</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">{{ tr('Hỏi đáp Phật pháp, Nghi lễ & Văn hóa chùa', 'Buddhist wisdom, etiquette & temple lore') }}</div>
              </div>
            </button>
            <button
              type="button"
              @click="openBodhiGamesFromDropup()"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer border-t border-hairline mt-1 pt-2.5"
            >
              <span class="font-numbers text-xs font-semibold text-primary pt-0.5 w-6 shrink-0">08</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">{{ tr('Kỳ Đài Dưới Bóng Bồ Đề', 'Bodhi Tree Board Games') }}</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">{{ tr('Chơi Ô Ăn Quan & Cờ Tướng cùng Sư Thầy', 'Play O An Quan & Xiangqi under the Bodhi tree') }}</div>
              </div>
            </button>
          </div>

          <button
            type="button"
            @click="toggleMeditationMenu"
            class="min-h-[40px] px-3.5 rounded-md bg-surface-card border text-sm font-medium flex items-center gap-2 transition cursor-pointer"
            :class="showMeditationMenu ? 'border-gold bg-surface-elevated text-white' : 'border-hairline text-white hover:border-hairline hover:bg-surface-elevated'"
            :title="tr('Bấm phím [2] hoặc nhấp chuột để mở Thiền & Công Đức', 'Press [2] or click to open Meditation & Merit')"
          >
            <span class="hud-dock__label">{{ tr('Thiền & Công Đức', 'Meditation & Merit') }}</span>
            <UiKeycap class="hud-hide-sm">2</UiKeycap>
            <ZenIcon name="chevron-up" :size="16" class="text-secondary transition-transform hud-hide-sm" :class="showMeditationMenu ? 'rotate-180' : ''" />
          </button>
        </div>

        <!-- Cụm 3: Di Sản & Cửa Hàng (Secondary Drop-up - Hotkey [3]) -->
        <div class="relative">
          <div
            v-if="showHeritageMenu"
            class="absolute bottom-14 right-0 w-[320px] p-3 rounded-md bg-surface-card border border-hairline shadow-2xl z-50 flex flex-col gap-1"
          >
            <div class="px-3 pb-2.5 mb-1 border-b border-hairline flex items-center justify-between">
              <span class="text-sm font-bold text-white">{{ tr('Di Sản & Bảo Vật', 'Heritage & Treasures') }}</span>
              <UiKeycap>{{ tr('Phím 3', 'Key 3') }}</UiKeycap>
            </div>
            <button
              type="button"
              @click="openDrawerFromDropup('shop')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">01</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">{{ tr('Cửa Hàng Pháp Bảo', 'Sanctuary Shop') }}</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">{{ tr('Cổ phục 9 nước, nhang trầm, lễ vật', '9-country attire, incense & offerings') }}</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('cards')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">02</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">{{ tr('Thẻ Bài Di Sản 3D', '3D Heritage Cards') }}</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">{{ tr('10 cổ tự mini, âm cảnh, NFT CIP-68', 'Sacred temples, audio lore & CIP-68 NFT') }}</div>
              </div>
            </button>
            <button
              type="button"
              @click="openDrawerFromDropup('soundscape')"
              class="w-full min-h-[50px] px-3 py-2 rounded-md flex items-start gap-3 text-left hover:bg-surface-elevated transition cursor-pointer"
            >
              <span class="font-numbers text-xs font-semibold text-secondary pt-0.5 w-6 shrink-0">03</span>
              <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold text-white leading-snug whitespace-nowrap">{{ tr('Bộ Trộn Âm Thanh 3D', '3D Soundscape Mixer') }}</div>
                <div class="text-xs text-secondary leading-snug mt-0.5">{{ tr('6 kênh âm cảnh không gian thời gian thực', '6 real-time spatial audio channels') }}</div>
              </div>
            </button>
            <button
              type="button"
              @click="showDisclaimer = true; closeAllDropups()"
              class="w-full min-h-[40px] px-3 py-2 rounded-md text-xs font-medium text-secondary hover:bg-surface-elevated hover:text-white transition cursor-pointer text-left border-t border-hairline mt-1"
            >
              {{ t('btn.legal') }}
            </button>
          </div>

          <button
            type="button"
            @click="toggleHeritageMenu"
            class="min-h-[40px] px-3.5 rounded-md bg-surface-card border text-sm font-medium flex items-center gap-2 transition cursor-pointer"
            :class="showHeritageMenu ? 'border-gold bg-surface-elevated text-white' : 'border-hairline text-white hover:border-hairline hover:bg-surface-elevated'"
            :title="tr('Bấm phím [3] hoặc nhấp chuột để mở Di Sản & Cửa Hàng', 'Press [3] or click to open Heritage & Shop')"
          >
            <span class="hud-dock__label">{{ tr('Di Sản & Cửa Hàng', 'Heritage & Shop') }}</span>
            <UiKeycap class="hud-hide-sm">3</UiKeycap>
            <ZenIcon name="chevron-up" :size="16" class="text-secondary transition-transform hud-hide-sm" :class="showHeritageMenu ? 'rotate-180' : ''" />
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
          <div class="space-y-1 flex-1">
            <div class="text-sm font-bold text-white leading-snug">{{ toastMessage.title }}</div>
            <div v-if="toastMessage.desc" class="text-xs text-secondary leading-snug mt-0.5">{{ toastMessage.desc }}</div>
            <div v-if="toastMessage.hydra" class="pt-1">
              <HydraBadge :proof="toastMessage.hydra" compact />
            </div>
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
      @guide-to-deed="handleGuideToDeed"
      @guide-to-hau-dong="handleGuideToHauDong"
      @trigger-bow="triggerBowAction"
      @update:active-tab="(t) => drawerTab = t"
    />

    <AbbotChatDrawer
      v-model="showAbbotDrawer"
      :is-near-abbot="nearTarget === 'abbot'"
      @emotion="handleAbbotEmotion"
      @walk-to-abbot="handleGuideToAbbot"
    />

    <!-- Overlays & Modals for specific operations -->
    <HydraHeadWidget
      v-if="wallet.isAuthenticated && !drawerOpen && !showAbbotDrawer && !showBodhiGamesModal && !showPhotoMode && !showDivinationMenu && !showMeditationMenu && !showHeritageMenu && !showDisplayMenu"
    />
    <BodhiGamesModal v-if="wallet.isAuthenticated && showBodhiGamesModal" :open="showBodhiGamesModal" @close="closeBodhiGamesModal" />
    <WalletConnectModal v-if="showWalletModal" @close="showWalletModal = false" />
    <EmoteWheel v-if="wallet.isAuthenticated && showEmoteWheel" @close="showEmoteWheel = false" @select-emote="handleSelectEmote" />
    <DisclaimerBanner v-if="showDisclaimer" @close="showDisclaimer = false" />
    <OnboardingGuide v-if="wallet.isAuthenticated" />
    </div>

    <PhotoModeOverlay
      v-if="showPhotoMode"
      :stage="stage"
      :time-of-day="currentTimeOfDay"
      @close="setPhotoModeActive(false)"
      @change-time="setTimeOfDayDirect"
      @captured="() => showToast('Đã lưu ảnh PNG', '', 'camera')"
    />
  </div>
</template>

<style scoped>
.hud-top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  background-color: var(--canvas-dark, #100e0c);
  border-bottom: 1px solid var(--hairline-on-dark, #26221d);
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
  color: #f5eddc;
  letter-spacing: 0.02em;
  line-height: var(--leading-tight, 1.25);
  white-space: nowrap;
}

.hud-brand__user-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs, 12px);
  color: var(--text-secondary, #a89c88);
  line-height: var(--leading-tight, 1.25);
}

.hud-brand__user-name {
  color: var(--text-primary, #ede4d3);
  font-weight: 500;
}

.hud-divider {
  color: var(--text-disabled, #968b79);
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
  background-color: var(--primary, #c9a24b);
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
  background-color: var(--hairline-on-dark, #26221d);
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
  background-color: var(--surface-card-dark, #1a1714);
  border: 1px solid var(--hairline-on-dark, #26221d);
  color: var(--text-primary, #ede4d3);
  cursor: pointer;
  transition: background-color var(--transition-fast, 120ms ease), border-color var(--transition-fast, 120ms ease);
}

.hud-wallet-btn:hover {
  background-color: var(--surface-elevated-dark, #26221d);
  border-color: var(--hairline-on-dark-hover, #4a4237);
}

.hud-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-sm, 4px);
  background-color: var(--surface-card-dark, #1a1714);
  border: 1px solid var(--hairline-on-dark, #26221d);
  color: var(--text-secondary, #a89c88);
  cursor: pointer;
  transition: background-color var(--transition-fast, 120ms ease), color var(--transition-fast, 120ms ease);
}

.hud-icon-btn:hover {
  background-color: var(--surface-elevated-dark, #26221d);
  color: var(--text-primary, #ede4d3);
}

.hud-icon-btn.is-active {
  border-color: var(--primary, #c9a24b);
  color: var(--text-primary, #ede4d3);
}

.hud-sangha-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border-radius: var(--radius-sm, 4px);
  background-color: var(--surface-elevated-dark, #26221d);
  border: 1px solid var(--hairline-on-dark, #26221d);
  color: var(--text-primary, #ede4d3);
  cursor: pointer;
  transition: background-color var(--transition-fast, 120ms ease);
}

.hud-sangha-btn:hover {
  background-color: var(--surface-elevated-dark-hover, #332d26);
}

/* Popovers */
.hud-popover {
  position: absolute;
  top: 44px;
  border-radius: var(--radius-md, 6px);
  background-color: var(--surface-card-dark, #1a1714);
  border: 1px solid var(--hairline-on-dark, #26221d);
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
  border-bottom: 1px solid var(--hairline-on-dark, #26221d);
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
  color: var(--text-primary, #ede4d3);
  cursor: pointer;
  transition: background-color var(--transition-fast, 120ms ease);
}

.hud-popover__item:hover {
  background-color: var(--surface-elevated-dark, #26221d);
}

.hud-popover__item.is-selected {
  background-color: var(--surface-elevated-dark, #26221d);
  border-color: var(--primary, #c9a24b);
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
  border-bottom: 1px solid var(--hairline-on-dark, #26221d);
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
  background-color: var(--surface-elevated-dark, #26221d);
}

.hud-trigger-gold {
  gap: 8px;
  font-weight: 700;
}

.hud-show-sm {
  display: none;
}

/* Màn nhỏ và máy tính bảng (dưới 1024px): bỏ các mục chỉ cần cho bàn phím, đủ vùng bấm 40px, dock chiếm một hàng riêng. */
@media (max-width: 1023px) {
  .hud-hide-sm {
    display: none !important;
  }

  .hud-show-sm {
    display: inline-block;
  }

  .hud-top-bar {
    padding: 0 8px;
  }

  .hud-top-bar__right {
    margin-left: auto;
    gap: 6px;
    min-width: 0;
  }

  .hud-v-divider {
    display: none;
  }

  .hud-wallet-btn,
  .hud-icon-btn,
  .hud-sangha-btn,
  .hud-topup {
    min-height: 40px;
    min-width: 40px;
    justify-content: center;
  }

  .hud-wallet-btn {
    padding: 0 8px;
  }

  .hud-bottom {
    flex-wrap: wrap;
    justify-content: flex-start;
    row-gap: 8px;
  }

  .hud-dock {
    position: relative;
    width: 100%;
    gap: 6px;
  }

  /* Các popup bám theo cả dock thay vì từng nút, để không tràn khỏi mép màn hình. */
  .hud-dock > .relative {
    position: static;
    flex: 1 1 0;
    min-width: 0;
  }

  .hud-dock > .relative > button,
  .hud-dock > .relative > .hud-trigger-gold {
    width: 100%;
    min-height: 44px;
    height: auto;
    padding: 4px 6px;
    justify-content: center;
    white-space: normal;
    text-align: center;
    line-height: 1.2;
  }

  .hud-dock__label {
    font-size: 12px;
    white-space: normal;
  }

  .hud-dock > .relative > div[class*='absolute'] {
    left: 0;
    right: 0;
    width: auto;
    max-width: none;
  }

  .hud-dock > .relative > .hud-popover--bottom {
    left: 0;
    right: 0;
    width: auto;
  }
}

.hud-keycap-gold {
  background-color: rgba(0, 0, 0, 0.15) !important;
  color: #1a1714 !important;
  border-color: rgba(0, 0, 0, 0.2) !important;
}

/* Helpers */
.font-numbers {
  font-family: var(--font-numbers, 'IBM Plex Sans', sans-serif);
  font-variant-numeric: tabular-nums;
}

.text-primary-text {
  color: var(--text-primary, #ede4d3);
}

.text-secondary {
  color: var(--text-secondary, #a89c88);
}

.text-primary {
  color: var(--primary, #c9a24b);
}

.bg-surface-elevated {
  background-color: var(--surface-elevated-dark, #26221d);
}

.border-hairline {
  border-color: var(--hairline-on-dark, #26221d);
}
</style>

