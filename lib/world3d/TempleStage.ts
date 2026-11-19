import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { PilgrimAvatar, type AvatarGender, type PilgrimCountry } from './PilgrimAvatar'
import { createPilgrimNameplate, createSpeechBubbleSprite } from './NameplateHelper'
import { createPlaqueTexture } from './utils/PlaqueTexture'
import type { PilgrimPresence } from '../network/MultiplayerClient'
import { CollisionWorld, CharacterController, CameraSpringArm, BoxCollider, CylinderCollider, GridPathfinder } from './collision'
import { PagodaSanctuaryHall } from './sanctuary/PagodaSanctuary'
import { HauDongSanctuary, type HauDongVisualState } from './sanctuary/HauDongSanctuary'
import { AtmosphereManager } from './environment/AtmosphereManager'
import { Palette } from './style/Palette'
import { SlotBatch } from './style/SlotBatch'
import { LowPolyBuilder } from './style/LowPolyBuilder'
import { PostProcessingManager, type GraphicsQuality } from './postprocessing/PostProcessingManager'
import { LotusPond } from './nature/LotusPond'
import { BellTower } from './architecture/BellTower'
import { TamQuanGate } from './architecture/TamQuanGate'
import { WindGrass } from './nature/WindGrass'
import { WindSystem } from './nature/WindSystem'
import { TreeSystem } from './nature/TreeSystem'
import { DistantMountains } from './nature/DistantMountains'
import { MountainParkourSystem } from './nature/MountainParkourSystem'
import { PetalParticleSystem } from './nature/PetalParticleSystem'
import { FestivalFireworksSystem } from './nature/FestivalFireworksSystem'
import { LoveTreeProp } from './nature/LoveTreeProp'
import { ZenGardenProp } from './nature/ZenGardenProp'
import { BodhiChessTableProp } from './nature/BodhiChessTableProp'
import { BodhiMonkNpc } from './characters/BodhiMonkNpc'
import { MapLayout } from './world/MapLayout'
import { HallLayout, type MeditationSlot } from './world/HallLayout'
import { TerrainSystem } from './world/TerrainSystem'
import { AvatarCrowd } from './characters/AvatarCrowd'
import { AbbotNpc, type AbbotNpcEmotion } from './characters/AbbotNpc'
import { PerformanceProfiler } from './debug/PerformanceProfiler'
import { SeededPRNG } from './utils/SeededPRNG'

export type InteractionTarget = 'incense' | 'merit_box' | 'fortune' | 'meditation' | 'lantern' | 'door' | 'hau_dong' | 'parkour_start' | 'parkour_summit' | 'love_tree' | 'abbot' | 'zen_garden' | 'bell_tower' | 'bodhi_chess' | null

export interface RemotePilgrimInstance {
  id: string
  name: string
  title: string
  country: PilgrimCountry
  gender: AvatarGender
  avatar: PilgrimAvatar
  nameplate: THREE.Sprite
  speechBubble: THREE.Sprite | null
  bubbleTimer: any
  currentPos: THREE.Vector3
  targetPos: THREE.Vector3
  currentYaw: number
  targetYaw: number
  action: 'standing' | 'walking' | 'bowing' | 'meditating'
}

// ==========================================
// 3D SIGNBOARD & BILLBOARD TEXT HELPERS
// ==========================================
function createStationPlaqueMesh(text: string, width = 1.25, height = 0.32): THREE.Mesh {
  const aspect = width / Math.max(0.1, height)
  const baseH = 256
  const baseW = Math.round(baseH * aspect)
  const texture = createPlaqueTexture({
    text,
    background: '#1a0f0a',
    border: '#d9a441',
    textColor: '#f6cf74',
    width: baseW,
    height: baseH,
    resolutionScale: 2,
    maxAnisotropy: 16
  })

  const geom = new THREE.PlaneGeometry(width, height)
  const mat = new THREE.MeshBasicMaterial({ map: texture })
  return new THREE.Mesh(geom, mat)
}

// ==========================================
// MASTER THREE.JS PAGODA STAGE (HYDRA-GRAVEYARD ARCHITECTURE)
// ==========================================
export class TempleStage {
  public scene: THREE.Scene
  public camera: THREE.PerspectiveCamera
  public renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private container: HTMLElement

  // Minecraft-Style Camera & Mouse Controls (Pointer Lock, 360° Look, F5 Viewpoints)
  public yaw = 0 // Góc quay ngang (Yaw)
  public pitch = 0.1 // Góc ngước lên/nhìn xuống (Pitch)
  public targetYaw = 0
  public targetPitch = 0.1
  public distance = 4.2 // Khoảng cách tới nhân vật ở chế độ TPP (m)
  public isPointerLocked = false
  public cameraMode: 'fpp' | 'tpp_back' = 'tpp_back'
  public onCameraModeChange?: (mode: 'fpp' | 'tpp_back') => void

  private isMouseDown = false
  private lastMouseX = 0
  private lastMouseY = 0

  // Chuột phải: nhấn = tương tác (nếu không kéo), kéo = chỉ xoay camera
  private rightPending = false
  private rightDownX = 0
  private rightDownY = 0
  private rightDragDist = 0
  private static readonly RIGHT_CLICK_DRAG_PX = 4
  /** Gọi khi pointer lock bật/tắt (để HUD hiện gợi ý "Nhấp vào cảnh để tiếp tục"). */
  public onPointerLockStateChange?: (locked: boolean) => void

  // Minecraft Movement & Physics (WASD, Jump with Gravity, Sneak, Sprint)
  public verticalVelocity = 0
  public gravity = -22.0
  public jumpStrength = 7.2
  public isGrounded = true
  public groundY = 0
  public isSneaking = false
  public isSprinting = false
  private lastWPressTime = 0
  private baseFov = 54
  private targetFov = 54
  // Vector tạm tái sử dụng mỗi khung hình (tránh cấp phát + GC trong vòng lặp render).
  private readonly scratchMoveDir = new THREE.Vector3()
  private readonly scratchZeroDir = new THREE.Vector3()
  private readonly scratchFocus = new THREE.Vector3()
  private readonly scratchBackward = new THREE.Vector3()

  // Time of Day System & Giai đoạn 3: Atmosphere, PBR Materials & Post-Processing
  public timeOfDay: 'day' | 'sunset' | 'night' = 'day'
  public atmosphere!: AtmosphereManager
  public postProcessing!: PostProcessingManager
  public profiler!: PerformanceProfiler
  public avatarCrowd!: AvatarCrowd
  public benchmarkBots: {
    id: string
    name: string
    title: string
    country: PilgrimCountry
    action: 'standing' | 'walking' | 'meditating'
    centerPos: THREE.Vector3
    radius: number
    speed: number
    angle: number
    currentPos: THREE.Vector3
  }[] = []

  private static readonly PROX_INCENSE = new THREE.Vector3(
    MapLayout.LANDMARKS.INCENSE_BURNER.center.x,
    MapLayout.LANDMARKS.INCENSE_BURNER.center.y,
    MapLayout.LANDMARKS.INCENSE_BURNER.center.z
  )
  private static readonly PROX_HALL_INCENSE = new THREE.Vector3(0, 1.35, -15.9)
  private static readonly PROX_MERIT = new THREE.Vector3(
    MapLayout.LANDMARKS.MERIT_BOX.center.x,
    MapLayout.LANDMARKS.MERIT_BOX.center.y,
    MapLayout.LANDMARKS.MERIT_BOX.center.z
  )
  private static readonly PROX_FORTUNE = new THREE.Vector3(
    MapLayout.LANDMARKS.FORTUNE_TABLE.center.x,
    MapLayout.LANDMARKS.FORTUNE_TABLE.center.y,
    MapLayout.LANDMARKS.FORTUNE_TABLE.center.z
  )
  private static readonly PROX_BUDDHA = new THREE.Vector3(
    MapLayout.LANDMARKS.BUDDHA_STATUE.center.x,
    MapLayout.LANDMARKS.BUDDHA_STATUE.center.y,
    MapLayout.LANDMARKS.BUDDHA_STATUE.center.z
  )
  private static readonly PROX_POND = new THREE.Vector3(
    MapLayout.LANDMARKS.LOTUS_POND.center.x,
    MapLayout.LANDMARKS.LOTUS_POND.center.y,
    MapLayout.LANDMARKS.LOTUS_POND.center.z
  )
  private static readonly PROX_BELL_TOWER = new THREE.Vector3(
    MapLayout.LANDMARKS.BELL_TOWER.center.x,
    MapLayout.LANDMARKS.BELL_TOWER.center.y,
    MapLayout.LANDMARKS.BELL_TOWER.center.z
  )
  private static readonly PROX_DOOR = new THREE.Vector3(0, 1.35, 0.5)
  private static readonly PROX_ABBOT = new THREE.Vector3(
    HallLayout.ABBOT_SPOT.x,
    HallLayout.ABBOT_SPOT.y,
    HallLayout.ABBOT_SPOT.z
  )

  private hemiLight!: THREE.HemisphereLight
  private keyLight!: THREE.DirectionalLight
  private rimLight!: THREE.DirectionalLight

  // Player Body (Camera-relative walking)
  public player: THREE.Group
  public avatar!: PilgrimAvatar
  public playerPos = new THREE.Vector3(
    MapLayout.getSpawnPoint(0).position.x,
    MapLayout.getSpawnPoint(0).position.y,
    MapLayout.getSpawnPoint(0).position.z
  )
  private playerFacingAngle = 0
  private moveSpeed = 4.8
  private keysPressed: Record<string, boolean> = {}

  // Tọa thiền & dẫn đường: nhân vật tự đi tới vị trí đích (khóa phím di chuyển khi đang tự đi / đang ngồi)
  private autoWalk: {
    waypoints: Array<{ x: number; z: number }>
    index: number
    speed: number
    startDelay: number
    /** Góc xoay nhân vật khi tới đích (null = giữ hướng đang đi). */
    finalYaw: number | null
    /** Kẹt quá lâu thì dịch thẳng tới đích (đi vào đệm) thay vì bỏ cuộc. */
    snapOnStuck: boolean
    /** Hành động khi đến nơi: ngồi thiền ('meditate') hoặc đứng trang nghiêm ('stand') */
    actionOnArrive?: 'meditate' | 'stand'
    onArrive: () => void
    onAbort: () => void
    stuckTimer: number
    bestDist: number
  } | null = null
  public isSeated = false
  public isPhotoMode = false
  public photoFov: number | null = null

  public get isInputLocked(): boolean {
    return this.isSeated || this.autoWalk !== null || this.isPhotoMode
  }

  public setPhotoMode(active: boolean, fov: number | null = null) {
    this.isPhotoMode = active
    this.photoFov = active ? fov : null
    if (active) {
      this.exitPointerLock()
    }
  }

  public renderImmediateFrame(): HTMLCanvasElement {
    if (this.postProcessing) {
      this.postProcessing.render(0)
    } else {
      this.composer.render(0)
    }
    return this.renderer.domElement
  }

  // Props & Interactables & Giai đoạn 4: Kiến trúc & Thiên nhiên
  public incenseBurner!: THREE.Group
  public meritBox!: THREE.Group
  public fortuneTable!: THREE.Group
  public buddhaStatue!: THREE.Group
  public lotusPond!: THREE.Group
  public sanctuaryHall!: PagodaSanctuaryHall
  public abbotNpc!: AbbotNpc
  public hauDongSanctuary!: HauDongSanctuary
  public hauDongVisualState: HauDongVisualState | null = null
  public lotusPondInstance!: LotusPond
  public bellTowerInstance!: BellTower
  public tamQuanGateInstance!: TamQuanGate
  public windGrassInstance!: WindGrass
  public windSystem = WindSystem.getInstance()
  public treeSystem!: TreeSystem
  public terrainSystem!: TerrainSystem
  public distantMountains!: DistantMountains
  public mountainParkourInstance!: MountainParkourSystem
  public petalParticleSystem!: PetalParticleSystem
  public festivalFireworksSystem!: FestivalFireworksSystem
  private fireflyPoints: THREE.Points | null = null
  private fireflyBasePositions: Float32Array | null = null
  private fireflyMat: THREE.PointsMaterial | null = null
  public loveTreeInstance!: LoveTreeProp
  public zenGardenInstance!: ZenGardenProp
  public bodhiChessTableInstance!: BodhiChessTableProp
  public bodhiMonkInstance!: BodhiMonkNpc
  private mandalaHalo!: THREE.Mesh

  // Giai đoạn 1: Dedicated Collision System & Character Controller & Camera Spring Arm
  public collisionWorld!: CollisionWorld
  public characterController!: CharacterController
  public cameraSpringArm!: CameraSpringArm
  private pathfinder = new GridPathfinder()
  public isDebugColliders = false
  private debugColliderGroup: THREE.Group | null = null

  // Lighting & Animations
  private clock = new THREE.Clock()
  private animFrameId: number | null = null

  public onNearTarget: ((target: InteractionTarget) => void) | null = null
  public onRightClick: ((target: InteractionTarget) => void) | null = null
  private currentNearTarget: InteractionTarget = null

  // Multiplayer Sangha Hub (Phase 2 MMO Synchronization)
  public remotePilgrims = new Map<string, RemotePilgrimInstance>()
  public onLocalMove?: (pos: [number, number, number], yaw: number, isMoving: boolean) => void
  private localSpeechBubble: THREE.Sprite | null = null
  private localBubbleTimer: any = null

  constructor(container: HTMLElement) {
    this.container = container

    // 1. Scene & Linear Atmosphere Fog (Chuẩn hydra-graveyard: tiền cảnh 0-20m trong vắt, hậu cảnh 20-95m tan vào sương mù)
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xdce8e0)
    this.scene.fog = new THREE.Fog(0xdce8e0, 60, 260)

    // 2. Camera Setup (Wide FOV for immersive feel)
    const width = container.clientWidth || window.innerWidth || 1280
    const height = container.clientHeight || window.innerHeight || 720
    const aspect = width / height
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000)

    // 3. Renderer with PCFSoftShadowMap & Filmic ToneMapping Calibrated
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.toneMappingExposure = Palette.get('day').exposure.outdoor
    this.container.appendChild(this.renderer.domElement)

    // Hậu kỳ nhẹ: bloom ngưỡng cao + vignette
    this.postProcessing = new PostProcessingManager(this.renderer, this.scene, this.camera, width, height)
    this.composer = this.postProcessing.composer

    // 5. Construct 3D Temple Environment
    this.player = new THREE.Group()

    // Bầu trời vật lý Preetham, PMREM Environment IBL và Cascaded Sun Shadow (Giai đoạn 3)
    this.atmosphere = new AtmosphereManager(this.scene, this.renderer)
    this.keyLight = this.atmosphere.keyLight
    this.hemiLight = this.atmosphere.hemiLight
    this.rimLight = this.atmosphere.rimLight

    this.buildSkyAndDistantMountains()
    this.buildCinematicLighting()
    this.buildGroundWithLanternLightPools()
    this.buildPlayerCharacter()

    // Hệ Thống Đám Đông 500 Người Tối Ưu Hóa (Phase 2 AvatarCrowd)
    this.avatarCrowd = new AvatarCrowd(this.scene)

    // Khởi tạo Hạ tầng Va chạm & Character Controller (Giai đoạn 1 & 4)
    this.initCollisionWorld()

    this.buildPagodaSanctuary()
    this.buildSacredBuddha()
    this.buildBellPavilionAndPond()
    this.buildVegetationAndParticles()
    this.buildMountainParkour()
    this.buildLoveTree()
    this.buildDetailedIncenseAltar()
    this.buildMeritAndFortuneStations()

    // Khởi tạo mặc định: BAN NGÀY (TRỜI SÁNG TRONG XANH)
    this.setTimeOfDay('day')

    // Khởi tạo HUD Thống Kê Hiệu Năng [F2]
    this.profiler = new PerformanceProfiler(this.renderer, this.container)
    if (typeof window !== 'undefined') {
      ; (window as any).__TEMPLE_STAGE__ = this
    }

    // Kiểm tra chế độ Benchmark Bot giả lập: ?bots=N
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const bots = params.get('bots')
      if (bots) {
        const count = parseInt(bots, 10)
        if (!isNaN(count) && count > 0) {
          this.spawnDebugBots(count)
        }
      }
    }

    // 6. Bind Mouse, Keyboard & Pointer Lock Events
    this.bindControls()

    // 7. Start Render Loop
    this.animate()
  }

  private onCanvasClick = () => {
    this.requestPointerLock()
  }

  private onPointerLockChange = () => {
    const canvas = this.renderer.domElement
    this.isPointerLocked = document.pointerLockElement === canvas
    this.onPointerLockStateChange?.(this.isPointerLocked)
  }

  private onMouseMove = (e: MouseEvent) => {
    if (this.rightPending) {
      if (this.isPointerLocked) {
        // Khi khóa con trỏ, clientX/Y không đổi nên cộng dồn movement
        this.rightDragDist += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0)
      } else {
        const byPosition = Math.abs(e.clientX - this.rightDownX) + Math.abs(e.clientY - this.rightDownY)
        this.rightDragDist = Math.max(this.rightDragDist, byPosition)
      }
    }
    if (this.isPointerLocked) {
      // Tránh giật chuột khi browser vừa lock
      if (Math.abs(e.movementX) < 250 && Math.abs(e.movementY) < 250) {
        this.rotateCamera(e.movementX, e.movementY)
      }
    } else if (this.isMouseDown || (e.buttons & 1) === 1 || (e.buttons & 2) === 2) {
      const dx = e.movementX || (e.clientX - this.lastMouseX)
      const dy = e.movementY || (e.clientY - this.lastMouseY)
      if (Math.abs(dx) < 250 && Math.abs(dy) < 250) {
        this.rotateCamera(dx, dy)
      }
      this.lastMouseX = e.clientX
      this.lastMouseY = e.clientY
    }
  }

  private onMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    // Nếu click vào nút bấm HUD hoặc modal tương tác thì không can thiệp
    if (target && (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('aside') ||
      target.closest('header') ||
      target.closest('.bn-panel') ||
      target.closest('.glass-panel') ||
      target.closest('.pointer-events-auto')
    )) {
      return
    }

    this.isMouseDown = true
    this.lastMouseX = e.clientX
    this.lastMouseY = e.clientY

    // Chuột phải (button === 2)
    if (e.button === 2) {
      e.preventDefault()
      // Chưa tương tác ngay: chờ nhả chuột, nếu kéo >= RIGHT_CLICK_DRAG_PX thì chỉ là xoay camera
      this.rightPending = true
      this.rightDownX = e.clientX
      this.rightDownY = e.clientY
      this.rightDragDist = 0
    }
  }

  private onMouseUp = (e?: Event) => {
    this.isMouseDown = false
    if (!this.rightPending) return
    const isMouse = typeof MouseEvent !== 'undefined' && e instanceof MouseEvent
    // Mất focus cửa sổ (blur): huỷ, không kích hoạt tương tác
    if (!isMouse) {
      this.rightPending = false
      return
    }
    // Nhả nút khác (trái/giữa): giữ nguyên trạng thái chờ của chuột phải
    if ((e as MouseEvent).button !== 2) return
    this.rightPending = false
    if (this.rightDragDist < TempleStage.RIGHT_CLICK_DRAG_PX && this.onRightClick) {
      this.onRightClick(this.currentNearTarget)
    }
  }

  /**
   * Chặn menu chuột phải của trình duyệt trên toàn bộ trang 3D.
   * Gắn ở window (capture) để cả các lớp HUD nằm trên canvas cũng không bật menu gốc.
   * Chỉ chừa lại ô nhập liệu (input / textarea) để người dùng còn dán / sao chép.
   */
  private onContextMenu = (e: MouseEvent) => {
    const t = e.target as HTMLElement | null
    if (t && t.closest('input, textarea, [contenteditable="true"]')) return
    e.preventDefault()
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (this.cameraMode !== 'fpp') {
      this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * 0.005, 1.5, 9.0)
    }
  }

  // ==========================================
  // CONTROLS & CAMERA BINDINGS (MINECRAFT-STYLE MOUSE LOOK & RIGHT CLICK)
  // ==========================================
  private bindControls() {
    window.addEventListener('resize', this.onResize)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.resetMovementKeys)
    document.addEventListener('visibilitychange', this.resetMovementKeys)

    const canvas = this.renderer.domElement
    canvas.addEventListener('click', this.onCanvasClick)
    document.addEventListener('pointerlockchange', this.onPointerLockChange)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('contextmenu', this.onContextMenu, true)
    window.addEventListener('blur', this.onMouseUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  public requestPointerLock() {
    try {
      const canvas = this.renderer.domElement
      if (canvas && !this.isPointerLocked) {
        canvas.requestPointerLock()
      }
    } catch (_) { }
  }

  public exitPointerLock() {
    try {
      if (document.exitPointerLock && document.pointerLockElement) {
        document.exitPointerLock()
      }
    } catch (_) { }
  }

  public cycleCameraMode() {
    if (this.cameraMode === 'fpp') {
      this.cameraMode = 'tpp_back'
      this.distance = 4.2
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch, -0.68, 1.45)
      this.pitch = THREE.MathUtils.clamp(this.pitch, -0.68, 1.45)
    } else {
      this.cameraMode = 'fpp'
      this.distance = 0.5
    }
    if (this.onCameraModeChange) {
      this.onCameraModeChange(this.cameraMode)
    }
  }

  public setCameraMode(mode: 'fpp' | 'tpp_back') {
    this.cameraMode = mode
    if (mode === 'fpp') {
      this.distance = 0.5
    } else {
      this.distance = 4.2
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch, -0.68, 1.45)
      this.pitch = THREE.MathUtils.clamp(this.pitch, -0.68, 1.45)
    }
    if (this.onCameraModeChange) {
      this.onCameraModeChange(this.cameraMode)
    }
  }

  private rotateCamera(dx: number, dy: number) {
    // Độ nhạy chuột mượt mà kiểu Minecraft
    const sens = 0.0022
    this.targetYaw -= dx * sens
    // Pitch: Đẩy chuột lên nhìn trời, Kéo chuột xuống nhìn đất
    // FPP: Nhìn ngửa lên trời thoải mái (-85° ~ -1.48 rad)
    // TPP: Giới hạn ngửa (-39° ~ -0.68 rad) để camera sau lưng không bị cắm xuống sàn đất
    const minPitch = this.cameraMode === 'fpp' ? -1.48 : -0.68
    const maxPitch = 1.45
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * sens, minPitch, maxPitch)
  }

  public toggleStatsOverlay(): boolean {
    if (this.profiler) {
      return this.profiler.toggle()
    }
    return false
  }

  private onKeyDown = (e: KeyboardEvent) => {
    // Đang gõ chữ (ô nhập, bộ gõ Unikey/IME đang soạn): không điều khiển nhân vật
    const kt = e.target as HTMLElement | null
    const typingNow = !!kt && !!kt.closest('input, textarea, select, [contenteditable="true"]')
    if (e.isComposing || e.keyCode === 229 || e.key === 'Process' || typingNow) {
      this.resetMovementKeys()
      return
    }

    // Phím F2: Bật/Tắt HUD Thống kê Hiệu năng
    if (e.code === 'F2') {
      e.preventDefault()
      this.toggleStatsOverlay()
      return
    }

    // Phím F3: Bật/Tắt hiển thị Debug Collider Wireframe (Giai đoạn 1)
    if (e.code === 'F3') {
      e.preventDefault()
      this.toggleDebugColliders()
      return
    }

    // Ngăn chặn các phím tắt trình duyệt (Ctrl+S, Ctrl+A, Ctrl+D...) khi đang điều khiển game
    if (e.ctrlKey && ['s', 'a', 'd', 'w'].includes(e.key.toLowerCase())) {
      e.preventDefault()
    }

    // Phím F5: Đổi góc nhìn Minecraft (FPP -> TPP Sau lưng)
    if (e.code === 'F5' || e.key === 'F5') {
      e.preventDefault()
      this.cycleCameraMode()
      return
    }

    // Phím V: đổi góc nhìn (thay thế F5 vì trình duyệt có thể chiếm F5 / làm mới trang)
    if (e.code === 'KeyV' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tv = e.target as HTMLElement | null
      const typingV = !!tv && !!tv.closest('input, textarea, [contenteditable="true"]')
      if (!typingV) {
        e.preventDefault()
        this.cycleCameraMode()
        return
      }
    }
    // Phím E: tương tác thay thế chuột phải (touchpad laptop / chuột không có nút phải / bị hệ thống chặn).
    if (e.code === 'KeyE' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = e.target as HTMLElement | null
      const typing = !!t && !!t.closest('input, textarea, [contenteditable="true"]')
      if (!typing && this.onRightClick && !this.isInputLocked) {
        e.preventDefault()
        this.onRightClick(this.currentNearTarget)
        return
      }
    }

    // Phím Space: Nhảy Minecraft qua Character Controller (khi đang chạm đất/sàn). Khóa khi tự đi bộ / đang tọa thiền.
    if ((e.code === 'Space' || e.key === ' ') && !this.isInputLocked) {
      this.characterController.jump()
    }

    // Phím Shift: Chạy nhanh (Sprint) - Chuẩn game PC, không xung đột trình duyệt
    if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.isSprinting = true
    }

    // Phím Z: Đi chậm / Rón rén (Sneak)
    if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
      this.isSneaking = true
    }

    // Nhấp đúp W để chạy nhanh (Double-tap W to Sprint)
    if (e.code === 'KeyW' || e.key.toLowerCase() === 'w') {
      const now = performance.now()
      if (now - this.lastWPressTime < 280) {
        this.isSprinting = true
      }
      this.lastWPressTime = now
    }

    this.keysPressed[e.code] = true
  }

  private onKeyUp = (e: KeyboardEvent) => {
    // Nhả phím Shift: Dừng chạy nhanh
    if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.isSprinting = false
    }
    // Nhả phím Z: Dừng đi chậm
    if (e.code === 'KeyZ') {
      this.isSneaking = false
    }
    // Luôn nhả phím theo mã phím vật lý để bộ gõ (Unikey/IME) không làm kẹt phím
    this.keysPressed[e.code] = false
  }

  /** Xóa toàn bộ trạng thái phím di chuyển (mất focus, đổi tab, bộ gõ chen ngang) */
  private resetMovementKeys = () => {
    this.keysPressed = {}
    this.isSprinting = false
    this.isSneaking = false
  }

  // ==========================================
  // SKY & CINEMATIC LIGHTING (GIAI ĐOẠN 3: PHYSICAL SKY & FOLLOWERS)
  // ==========================================
  private buildSkyAndDistantMountains() {
    // Dãy núi thiêng xa xăm mờ ảo liên tục với sương mù aerial perspective (Phase 5)
    this.distantMountains = new DistantMountains()
    this.scene.add(this.distantMountains.root)
  }

  private buildCinematicLighting() {
    // Ánh sáng chính (KeyLight, HemiLight, RimLight) đã được quản lý tập trung bởi AtmosphereManager
  }

  private buildGroundWithLanternLightPools() {
    // 1. Địa hình đồi núi phẳng màu ~400x400m (TerrainSystem, vertex color theo palette)
    this.terrainSystem = new TerrainSystem()
    this.scene.add(this.terrainSystem.root)

    // 2. Sân chùa, bó vỉa, ngự đạo và đèn đá: gộp theo slot màu, không PointLight
    const b = new SlotBatch()

    // Sân lát phẳng liền khối bao phủ cả Đại Hùng Bảo Điện và Nhà Hầu Đồng phía Đông (x = -23..+49, z = -22..+28, mặt trên y = 0.14)
    b.box('ground', 72, 0.20, 50, 13, 0.04, 3)
    b.box('stone', 72.4, 0.3, 0.4, 13, 0.15, -22)
    b.box('stone', 72.4, 0.3, 0.4, 13, 0.15, 28)
    b.box('stone', 5.6, 0.08, 32, 0, 0.12, 7)

    // Nâng cấp Trục Ngự Đạo: bó vỉa đá, đường ron đá phiến và 1 thảm đá hoa sen trung tâm
    b.box('roofDark', 0.24, 0.11, 32, -2.85, 0.13, 7)
    b.box('roofDark', 0.24, 0.11, 32, 2.85, 0.13, 7)
    for (let pz = -7.5; pz <= 21.5; pz += 2.4) {
      b.box('roofDark', 5.4, 0.02, 0.06, 0, 0.155, pz)
    }
    b.cylinder('roofDark', 1.15, 1.15, 0.022, 16, 0, 0.156, 16.0)
    b.cylinder('stone', 0.96, 0.96, 0.026, 16, 0, 0.158, 16.0)
    b.cylinder('gold', 0.38, 0.38, 0.03, 8, 0, 0.160, 16.0)

    // Hàng đèn đá cổ tự bát giác theo MapLayout; buồng đèn có 6 trụ đá bao quanh lõi phát sáng + mái chùa 2 tầng
    const baseY = 0.14
    MapLayout.LANTERN_COORDINATES.forEach(([x, z]) => {
      // 1. Bệ đá tam cấp bát giác & cổ thắt chạm sen
      b.cylinder('stone', 0.44, 0.54, 0.14, 8, x, baseY + 0.07, z)
      b.cylinder('stone', 0.34, 0.42, 0.12, 8, x, baseY + 0.20, z)
      b.cylinder('roofDark', 0.23, 0.28, 0.06, 8, x, baseY + 0.29, z)

      // 2. Trụ đèn bát giác có gờ chỉ giữa thân & đầu cột loe
      b.cylinder('stone', 0.16, 0.19, 0.48, 8, x, baseY + 0.56, z)
      b.cylinder('stone', 0.22, 0.22, 0.07, 8, x, baseY + 0.83, z)
      b.cylinder('stone', 0.17, 0.16, 0.48, 8, x, baseY + 1.10, z)

      // 3. Đài sen đỡ buồng đèn (2 tầng loe)
      b.cylinder('stone', 0.36, 0.21, 0.11, 8, x, baseY + 1.39, z)
      b.cylinder('stone', 0.46, 0.36, 0.10, 6, x, baseY + 1.50, z)

      // 4. Lõi buồng đèn phát sáng + 6 trụ đá góc & khung cửa sổ đèn
      b.addEmissive('lantern', LowPolyBuilder.cylinder(0.24, 0.24, 0.40, 6), { position: [x, baseY + 1.75, z] })
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI) / 3
        const mx = x + Math.cos(ang) * 0.27
        const mz = z + Math.sin(ang) * 0.27
        b.box('stone', 0.055, 0.42, 0.055, mx, baseY + 1.75, mz, 0, -ang, 0)
      }
      b.cylinder('stone', 0.36, 0.33, 0.06, 6, x, baseY + 1.98, z)

      // 5. Mái đèn kiểu mái chùa 2 tầng + 6 đầu đao góc mái + búp sen đồng trên đỉnh
      b.cone('roofDark', 0.66, 0.26, 6, x, baseY + 2.13, z)
      b.cone('roofDark', 0.42, 0.18, 6, x, baseY + 2.27, z)
      for (let k = 0; k < 6; k++) {
        const ang = (k * Math.PI) / 3
        const ex = x + Math.cos(ang) * 0.58
        const ez = z + Math.sin(ang) * 0.58
        b.box('roofDark', 0.12, 0.04, 0.06, ex, baseY + 2.04, ez, 0, -ang, 0.28)
      }
      b.cylinder('gold', 0.06, 0.09, 0.06, 8, x, baseY + 2.38, z)
      b.sphere('gold', 0.075, 0, x, baseY + 2.46, z)
    })

    const props = b.build({ name: 'courtyard' })
    this.scene.add(props)
  }


  // ==========================================
  // GIAI ĐOẠN 1: HỆ THỐNG VA CHẠM & CHARACTER CONTROLLER
  // ==========================================
  private initCollisionWorld() {
    this.collisionWorld = new CollisionWorld()
    this.collisionWorld.terrainProvider = this.terrainSystem
    this.characterController = new CharacterController(this.collisionWorld)
    this.characterController.position.copy(this.playerPos)
    this.cameraSpringArm = new CameraSpringArm(this.collisionWorld)

    // 1. Mặt sân chùa lát đá liền khối (Walkable Ground x = -24..+50, mặt trên y = 0.14) & Ngự đạo trung tâm (mặt trên y = 0.16)
    this.collisionWorld.add(
      new BoxCollider('ground_courtyard', new THREE.Vector3(13, 0.04, 3), new THREE.Vector3(74, 0.2, 52), true, true, 0.14)
    )
    this.collisionWorld.add(
      new BoxCollider('ground_royal_path', new THREE.Vector3(0, 0.08, 7), new THREE.Vector3(5.6, 0.16, 32), true, true, 0.16)
    )

    // 5. 8 Hàng Đèn Đá Tōrō
    // 5. 8 Hàng Đèn Đá Tōrō từ MapLayout
    MapLayout.LANTERN_COORDINATES.forEach(([x, z], i) => {
      this.collisionWorld.add(
        new CylinderCollider(`lantern_${i}`, new THREE.Vector3(x, 1.2, z), 0.46, 2.4, false)
      )
    })

    // 6. Vật phẩm tương tác & Ban thờ từ MapLayout (Single Source of Truth)
    const incensePos = MapLayout.LANDMARKS.INCENSE_BURNER.center
    this.collisionWorld.add(
      new CylinderCollider(
        'incense_burner',
        new THREE.Vector3(incensePos.x, incensePos.y + 0.7, incensePos.z),
        0.95,
        1.4,
        false
      )
    )

    const meritPos = MapLayout.LANDMARKS.MERIT_BOX.center
    this.collisionWorld.add(
      new BoxCollider(
        'merit_box',
        new THREE.Vector3(meritPos.x, meritPos.y + 0.6, meritPos.z),
        new THREE.Vector3(1.5, 1.2, 1.1),
        false
      )
    )

    const fortunePos = MapLayout.LANDMARKS.FORTUNE_TABLE.center
    this.collisionWorld.add(
      new BoxCollider(
        'fortune_table',
        new THREE.Vector3(fortunePos.x, fortunePos.y + 0.55, fortunePos.z),
        new THREE.Vector3(1.6, 1.1, 1.1),
        false
      )
    )

    // 7. Ranh giới khép kín bảo vệ thế giới & chân núi (Vành đai 48 hộp bao quanh r = 115m)
    const boundaryCount = 48
    const boundaryRadius = MapLayout.WALKABLE_BOUNDARY.maxRadius
    for (let b = 0; b < boundaryCount; b++) {
      const angle = (b / boundaryCount) * Math.PI * 2
      const bx = Math.cos(angle) * boundaryRadius
      const bz = Math.sin(angle) * boundaryRadius
      this.collisionWorld.add(
        new BoxCollider(
          `world_boundary_wall_${b}`,
          new THREE.Vector3(bx, 10.0, bz),
          new THREE.Vector3(24.0, 24.0, 24.0),
          false
        )
      )
    }
  }

  public toggleDebugColliders(): boolean {
    this.isDebugColliders = !this.isDebugColliders
    if (this.isDebugColliders) {
      if (!this.debugColliderGroup) {
        this.debugColliderGroup = this.collisionWorld.createDebugGroup()
      }
      this.scene.add(this.debugColliderGroup)
    } else {
      if (this.debugColliderGroup) {
        this.scene.remove(this.debugColliderGroup)
        this.debugColliderGroup = null
      }
    }
    return this.isDebugColliders
  }

  private buildPagodaSanctuary() {
    // Khởi tạo Chánh Điện low-poly 28x22m (616 m² sàn, ~256 đệm thiền, mái hai tầng đầu đao)
    this.sanctuaryHall = new PagodaSanctuaryHall(this.collisionWorld)
    this.scene.add(this.sanctuaryHall.group)
    this.buddhaStatue = this.sanctuaryHall.buddhaGroup
    this.mandalaHalo = this.sanctuaryHall.mandalaHalo

    // NPC Thầy Trụ Trì đứng ngoài Hiên Tiền Điện (Phương án 2)
    this.abbotNpc = new AbbotNpc(this.collisionWorld, HallLayout.ABBOT_SPOT)
    this.scene.add(this.abbotNpc.root)

    // Khởi tạo Nhà Hầu Đồng (Điện Thờ Tứ Phủ & Trần Triều) ở phía Đông (bên phải) Đại Hùng Bảo Điện
    this.hauDongSanctuary = new HauDongSanctuary(this.collisionWorld)
    this.scene.add(this.hauDongSanctuary.group)
  }

  private buildSacredBuddha() {
    // Tôn tượng Phật Thích Ca Mâu Ni mạ vàng đã được tạo dựng trang nghiêm trong PagodaSanctuaryHall
    if (this.sanctuaryHall) {
      this.buddhaStatue = this.sanctuaryHall.buddhaGroup
      this.mandalaHalo = this.sanctuaryHall.mandalaHalo
    }
  }

  private buildBellPavilionAndPond() {
    // 1. Lầu Chuông Cổ Tự & Đại Hồng Chung Đồng Cổ (Giai đoạn 4)
    this.bellTowerInstance = new BellTower(this.collisionWorld)
    this.scene.add(this.bellTowerInstance.root)

    // 2. Hồ Sen Sống Động, Mặt Nước Shader & Cầu Đá Vòm Cong (Giai đoạn 4)
    this.lotusPondInstance = new LotusPond(this.collisionWorld)
    this.lotusPond = this.lotusPondInstance.root
    this.scene.add(this.lotusPondInstance.root)

    // 3. Cổng Tam Quan Cổ Kính 3 lối đi (Trung/Giả/Không Quan - Giai đoạn 4)
    this.tamQuanGateInstance = new TamQuanGate(this.collisionWorld)
    this.scene.add(this.tamQuanGateInstance.root)

    // 4. Thảm Cỏ Tự Nhiên Lay Động Gió (Instanced Wind Grass - Giai đoạn 4)
    this.windGrassInstance = new WindGrass()
    this.scene.add(this.windGrassInstance.root)
  }

  private buildVegetationAndParticles() {
    // 1. Hệ Thống Cây Cối 6 Loài Instanced & Lay Động Gió (Phase 5 TreeSystem)
    this.treeSystem = new TreeSystem(this.scene, this.windSystem)
    this.treeSystem.registerColliders(this.collisionWorld)

    // 2. Hệ Thống Hạt Tự Nhiên GPU (Cánh hoa Bồ Đề, Đom đóm thiền, Khói trầm)
    this.petalParticleSystem = new PetalParticleSystem(this.windSystem)
    this.scene.add(this.petalParticleSystem.root)

    // Đom đóm ban đêm & Tia nắng xiên buổi sáng/hoàng hôn (Mục 8)
    this.buildAtmosphereAccents()

    // 3. Pháo hoa chào mừng ngoài Cổng Tam Quan (chỉ bật vào ngày lễ)
    this.festivalFireworksSystem = new FestivalFireworksSystem()
    this.scene.add(this.festivalFireworksSystem.root)
  }

  private buildMountainParkour() {
    // Hệ thống Parkour Leo Núi "Đường Lên Đỉnh Phù Vân" phía sau Chùa
    this.mountainParkourInstance = new MountainParkourSystem(this.collisionWorld)
    this.scene.add(this.mountainParkourInstance.root)
  }

  private buildLoveTree() {
    // Cây Nguyệt Lão & Án Thư Gieo Quẻ Tơ Duyên bên bờ Hồ Sen Bát Nhã
    this.loveTreeInstance = new LoveTreeProp(this.collisionWorld)
    this.scene.add(this.loveTreeInstance.root)

    // Vườn Thiền Cá Nhân 6 Ô Đất (Mục 14)
    this.zenGardenInstance = new ZenGardenProp()
    this.scene.add(this.zenGardenInstance.root)

    // Bàn Cờ Đá Dưới Bóng Bồ Đề (Ô Ăn Quan & Cờ Tướng)
    this.bodhiChessTableInstance = new BodhiChessTableProp(this.collisionWorld)
    this.scene.add(this.bodhiChessTableInstance.root)

    // Sư Thầy ngồi đối cờ ở đôn đá đối diện người chơi
    this.bodhiMonkInstance = new BodhiMonkNpc(
      this.bodhiChessTableInstance.centerPos.x,
      this.bodhiChessTableInstance.centerPos.z
    )
    this.scene.add(this.bodhiMonkInstance.root)
  }

  private buildDetailedIncenseAltar() {
    this.incenseBurner = new THREE.Group()
    const pos = MapLayout.LANDMARKS.INCENSE_BURNER.center
    this.incenseBurner.position.set(pos.x, pos.y, pos.z)

    // Đại Đỉnh Hương Đồng Cổ sân chùa: Bệ đá tam cấp chạm cánh sen, 3 chân quỳ nghê, thân đỉnh gờ nổi & tai mây uốn lượn
    const b = new SlotBatch()
    // 1. Bệ đá xanh tam cấp chạm cánh sen
    b.cylinder('stone', 1.92, 2.04, 0.16, 16, 0, 0.08, 0)
    b.cylinder('stone', 1.62, 1.72, 0.14, 16, 0, 0.23, 0)
    b.cylinder('roofDark', 1.38, 1.44, 0.05, 16, 0, 0.32, 0)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12
      b.box('stone', 0.22, 0.09, 0.12, Math.sin(a) * 1.48, 0.27, Math.cos(a) * 1.48, 0.25, a, 0)
    }

    // 2. 3 chân quỳ nghê đúc đồng (đế chân tròn + khớp gối phình + bắp chân cong)
    for (const angle of [0, 2.0944, 4.1888]) {
      const sinA = Math.sin(angle)
      const cosA = Math.cos(angle)
      // Đế chân đồng chạm đất
      b.cylinder('gold', 0.19, 0.24, 0.12, 10, sinA * 0.90, 0.40, cosA * 0.90)
      // Ống chân dưới
      b.cylinder('gold', 0.15, 0.18, 0.24, 10, sinA * 0.87, 0.56, cosA * 0.87, 0.14 * cosA, 0, -0.14 * sinA)
      // Khớp gối nghê đúc nổi
      b.sphere('gold', 0.19, 1, sinA * 0.84, 0.72, cosA * 0.84)
      // Bắp chân nối vào đáy đỉnh
      b.cylinder('gold', 0.20, 0.16, 0.22, 10, sinA * 0.80, 0.84, cosA * 0.80, -0.18 * cosA, 0, 0.18 * sinA)
    }

    // 3. Thân Đỉnh Đồng 24 cạnh mượt + đai đồng cổ + núm chạm nổi
    b.cylinder('gold', 1.14, 0.78, 0.32, 24, 0, 0.94, 0) // Đáy đỉnh thuôn
    b.cylinder('gold', 1.32, 1.14, 0.40, 24, 0, 1.30, 0) // Bụng đỉnh phình tròn
    b.cylinder('roofDark', 1.35, 1.35, 0.055, 24, 0, 1.32, 0) // Đai chỉ âm giữa bụng đỉnh
    b.cylinder('gold', 1.08, 1.32, 0.18, 24, 0, 1.59, 0) // Vai đỉnh thu vào cổ
    b.cylinder('roofDark', 1.06, 1.06, 0.08, 24, 0, 1.71, 0) // Cổ thắt sẫm màu tạo khối
    b.cylinder('gold', 1.36, 1.08, 0.11, 24, 0, 1.80, 0) // Miệng loe vành đồng đúc nổi
    b.cylinder('gold', 1.38, 1.38, 0.045, 24, 0, 1.86, 0) // Gờ môi miệng đỉnh

    // 4 hạt đồng nổi (mặt hổ phù cách điệu) quanh bụng đỉnh
    for (const a of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
      b.cylinder('gold', 0.13, 0.15, 0.06, 8, Math.sin(a) * 1.29, 1.32, Math.cos(a) * 1.29, Math.PI / 2, 0, -a)
    }

    // 4. Hai tai mây / quai rồng uốn lượn nhiều đốt hai bên đỉnh
    for (const side of [-1, 1]) {
      b.box('gold', 0.16, 0.14, 0.22, side * 1.22, 1.56, 0, 0, 0, side * 0.25)
      b.box('gold', 0.14, 0.34, 0.20, side * 1.36, 1.78, 0, 0, 0, -side * 0.18)
      b.box('gold', 0.16, 0.24, 0.18, side * 1.32, 2.04, 0, 0, 0, side * 0.22)
      b.sphere('gold', 0.10, 1, side * 1.26, 2.18, 0) // Đầu mây cuộn trên đỉnh quai
      b.box('gold', 0.18, 0.09, 0.16, side * 1.24, 1.84, 0) // Thanh giằng nối quai vào vành miệng
    }

    // 5. Tro hương mịn hơi lõm trong lòng đỉnh
    b.cylinder('stone', 1.04, 1.04, 0.035, 24, 0, 1.83, 0)

    // 6. Chùm nhang trầm (nén đại ở giữa + 8 nén xung quanh cắm nghiêng tự nhiên, có chân tăm đỏ & đầu lửa hồng)
    b.cylinder('roofDark', 0.016, 0.016, 0.18, 6, 0, 1.92, 0) // Chân tăm
    b.cylinder('woodDark', 0.022, 0.022, 0.96, 6, 0, 2.48, 0)
    b.addEmissive('lantern', LowPolyBuilder.sphere(0.042, 0), { position: [0, 2.97, 0] })

    const sideSticks: Array<[number, number, number, number, number]> = [
      [-0.22, 0.04, 0.95, 0.04, 0.08],
      [0.22, -0.04, 0.98, -0.03, -0.07],
      [0.04, -0.22, 0.92, -0.07, 0.03],
      [-0.04, 0.22, 0.96, 0.07, -0.03],
      [-0.14, -0.15, 0.84, -0.05, 0.06],
      [0.15, 0.14, 0.86, 0.05, -0.06],
      [-0.16, 0.15, 0.82, 0.06, 0.05],
      [0.14, -0.16, 0.85, -0.06, -0.05]
    ]
    for (const [sx, sz, sh, rx, rz] of sideSticks) {
      const tipY = 1.84 + sh
      b.cylinder('woodDark', 0.016, 0.016, sh, 5, sx, 1.84 + sh / 2, sz, rx, 0, rz)
      b.addEmissive('lantern', LowPolyBuilder.sphere(0.032, 0), {
        position: [sx - Math.sin(rz) * sh * 0.45, tipY, sz + Math.sin(rx) * sh * 0.45]
      })
    }

    this.incenseBurner.add(b.build({ name: 'incense_burner' }))
    this.scene.add(this.incenseBurner)
  }

  private buildMeritAndFortuneStations() {
    // 1. Hòm công đức gỗ lim chạm đồng (bệ chân giật cấp, 4 trụ góc, pano nổi, nắp hộp 2 tầng, khe tiền thật & khóa đồng)
    this.meritBox = new THREE.Group()
    const meritPos = MapLayout.LANDMARKS.MERIT_BOX.center
    this.meritBox.position.set(meritPos.x, meritPos.y, meritPos.z)
    const m = new SlotBatch()
    // Đế đá & bệ gỗ giật cấp
    m.box('stone', 1.66, 0.07, 1.18, 0, 0.035, 0)
    m.box('woodDark', 1.56, 0.09, 1.10, 0, 0.115, 0)
    // Thân hòm gỗ sẫm & 4 trụ góc nổi
    m.box('wood', 1.42, 0.96, 0.96, 0, 0.64, 0)
    for (const cx of [-0.71, 0.71]) {
      for (const cz of [-0.48, 0.48]) {
        m.box('woodDark', 0.11, 1.00, 0.11, cx, 0.65, cz)
        // Ke đồng bọc góc dưới & góc trên
        m.box('gold', 0.13, 0.08, 0.13, cx, 0.20, cz)
        m.box('gold', 0.13, 0.08, 0.13, cx, 1.10, cz)
      }
    }
    // Thanh ngang khung mặt trước & ổ khóa đồng phía trên bảng tên
    m.box('woodDark', 1.46, 0.08, 1.02, 0, 1.12, 0)
    m.box('gold', 0.16, 0.14, 0.04, 0, 0.96, 0.50) // Mặt khóa đồng
    m.box('roofDark', 0.05, 0.08, 0.05, 0, 0.93, 0.52) // Ổ khóa treo
    // Nắp hòm 2 tầng giật cấp + khe bỏ tiền công đức viền đồng ở mặt trên
    m.box('woodDark', 1.58, 0.07, 1.12, 0, 1.19, 0)
    m.box('wood', 1.38, 0.05, 0.92, 0, 1.25, 0)
    m.box('gold', 0.52, 0.03, 0.12, 0, 1.285, 0) // Viền đồng khe tiền
    m.box('roofDark', 0.44, 0.035, 0.045, 0, 1.292, 0) // Khe thả tiền sẫm màu
    this.meritBox.add(m.build({ name: 'merit_box' }))

    // Bảng tên 3D gắn gọn vào pano mặt trước hòm công đức
    const meritPlaque = createStationPlaqueMesh('HÒM CÔNG ĐỨC', 1.14, 0.28)
    meritPlaque.position.set(0, 0.56, 0.495)
    this.meritBox.add(meritPlaque)

    this.scene.add(this.meritBox)

    // 2. Án thư Xem Quẻ (chân tủ chạm đứng, khung pano nổi, mặt bàn 2 tầng, khăn gấm viền vàng, ống xăm đốt tre, keo âm dương, sách Kinh Dịch)
    this.fortuneTable = new THREE.Group()
    const fortunePos = MapLayout.LANDMARKS.FORTUNE_TABLE.center
    this.fortuneTable.position.set(fortunePos.x, fortunePos.y, fortunePos.z)
    const f = new SlotBatch()
    // Bệ đá & 4 chân trụ góc chạm đứng
    f.box('stone', 1.72, 0.06, 1.16, 0, 0.03, 0)
    for (const cx of [-0.74, 0.74]) {
      for (const cz of [-0.47, 0.47]) {
        f.box('woodDark', 0.12, 1.08, 0.12, cx, 0.60, cz)
        f.box('gold', 0.14, 0.06, 0.14, cx, 0.10, cz)
      }
    }
    // Thân tủ án thư giật vào trong tạo chiều sâu + yếm bàn
    f.box('wood', 1.46, 0.86, 0.90, 0, 0.66, 0)
    f.box('woodDark', 1.54, 0.10, 0.98, 0, 0.20, 0) // Xà đế dưới
    f.box('woodDark', 1.54, 0.10, 0.98, 0, 1.07, 0) // Yếm trên dưới mặt bàn
    // Mặt bàn 2 tầng nhô ra kiểu án thư cổ
    f.box('woodDark', 1.74, 0.06, 1.18, 0, 1.15, 0)
    f.box('wood', 1.66, 0.04, 1.10, 0, 1.20, 0)
    // Khăn gấm đỏ viền vàng trải giữa mặt bàn
    f.box('gold', 0.94, 0.014, 0.94, 0, 1.225, 0)
    f.box('roofDark', 0.86, 0.018, 0.86, 0, 1.230, 0)

    // Ống thẻ xăm bằng tre 3 đốt có đai đồng cổ truyền
    f.cylinder('gold', 0.19, 0.23, 0.06, 14, 0, 1.27, 0) // Đế đồng
    f.cylinder('woodDark', 0.17, 0.18, 0.15, 14, 0, 1.375, 0) // Đốt 1
    f.cylinder('gold', 0.185, 0.185, 0.025, 14, 0, 1.46, 0) // Vòng đốt đồng
    f.cylinder('wood', 0.165, 0.17, 0.16, 14, 0, 1.55, 0) // Đốt 2
    f.cylinder('gold', 0.18, 0.18, 0.025, 14, 0, 1.64, 0) // Vòng đốt đồng
    f.cylinder('woodDark', 0.17, 0.165, 0.14, 14, 0, 1.72, 0) // Đốt 3
    f.cylinder('gold', 0.195, 0.17, 0.05, 14, 0, 1.81, 0) // Miệng ống bọc đai đồng

    // Bó thẻ tre sơn son vươn xòe tự nhiên từ miệng ống
    const stickAngles: Array<[number, number, number, number, number]> = [
      [0, 0, 0.50, 0, 0],
      [-0.06, 0.02, 0.47, 0.03, 0.14],
      [0.06, -0.02, 0.47, -0.03, -0.14],
      [-0.02, 0.06, 0.45, -0.14, 0.02],
      [0.02, -0.06, 0.45, 0.14, -0.02],
      [-0.05, -0.05, 0.44, 0.10, 0.11],
      [0.05, 0.05, 0.44, -0.10, -0.11]
    ]
    for (const [sx, sz, sh, rx, rz] of stickAngles) {
      f.box('wall', 0.024, sh, 0.014, sx, 1.82 + sh * 0.45, sz, rx, 0, rz)
      f.box('roofDark', 0.026, 0.08, 0.016, sx - Math.sin(rz) * sh * 0.45, 1.82 + sh * 0.88, sz + Math.sin(rx) * sh * 0.45, rx, 0, rz)
    }

    // Cặp quẻ âm dương (keo) bằng gỗ sơn son thếp vàng
    f.cylinder('roofDark', 0.075, 0.075, 0.028, 8, -0.44, 1.255, 0.16, 0, 0.4, 0)
    f.cylinder('gold', 0.075, 0.075, 0.028, 8, -0.32, 1.255, 0.24, 0, -0.5, 0)

    // Sách Bói Quẻ Kinh Dịch cổ (bìa gấm đỏ + xấp giấy ngà + gáy chỉ vàng)
    f.box('roofDark', 0.30, 0.042, 0.40, 0.44, 1.255, 0.10, 0, 0.18, 0)
    f.box('wall', 0.26, 0.034, 0.36, 0.45, 1.26, 0.10, 0, 0.18, 0)
    f.box('gold', 0.03, 0.045, 0.40, 0.30, 1.258, 0.125, 0, 0.18, 0)

    this.fortuneTable.add(f.build({ name: 'fortune_table' }))

    // Bảng tên 3D gắn gọn vào pano mặt trước bàn xem quẻ
    const fortunePlaque = createStationPlaqueMesh('BÀN XEM QUẺ', 1.20, 0.29)
    fortunePlaque.position.set(0, 0.64, 0.465)
    this.fortuneTable.add(fortunePlaque)

    this.scene.add(this.fortuneTable)
  }

  private buildPlayerCharacter() {
    // Khởi tạo Nhân vật Hành Giả Cổ Tự chi tiết (Áo Tràng Lam, Tràng Hạt 108 hạt, Đóa Sen Vàng, Nón Truyền Thống)
    this.avatar = new PilgrimAvatar()
    this.player.clear()
    this.player.add(this.avatar.root)

    this.player.position.copy(this.playerPos)
    this.scene.add(this.player)
  }

  public setCountry(countryId: PilgrimCountry) {
    if (this.avatar) {
      this.avatar.setCountryStyle(countryId)
    }
    if (this.treeSystem) {
      this.treeSystem.setCountry(countryId)
    }
    this.petalParticleSystem?.setCountry(countryId)
    this.applyCountryAtmosphere(countryId)
  }

  public setGender(gender: AvatarGender) {
    if (this.avatar) {
      this.avatar.setGender(gender)
    }
  }

  /**
   * Đồng bộ Khí quyển & Bầu trời theo 9 Thánh Địa Cổ Tự (GDD Section 2 & 5)
   */
  public applyCountryAtmosphere(countryId: PilgrimCountry) {
    // AtmosphereManager quản lý tập trung Preetham Physical Sky và Lighting
    if (this.atmosphere) return
  }

  /**
   * Chuyển đổi Thời Gian Trong Ngày (Ban Ngày / Hoàng Hôn / Ban Đêm) - Giai đoạn 3 Atmosphere
   */
  public setTimeOfDay(mode: 'day' | 'sunset' | 'night') {
    this.timeOfDay = mode
    if (this.atmosphere) {
      this.atmosphere.setTimeOfDay(mode)
    }
    // Tô lại màu đỉnh địa hình + núi xa theo bảng màu mới (không tạo lại geometry)
    this.terrainSystem?.setPalette(mode)
    this.distantMountains?.setPalette(mode)
    this.treeSystem?.setPalette(mode)
    this.windGrassInstance?.setPalette(mode)
    this.petalParticleSystem?.setPalette(mode)

  }

  /** Bật/tắt ánh sáng ấm và pháo hoa chào mừng ngày lễ âm lịch (Mùng 1, Rằm). */
  public setFestivalMode(enabled: boolean) {
    this.atmosphere?.setFestivalMode(enabled)
    this.festivalFireworksSystem?.setEnabled(enabled)
  }

  /** Thả một hoa đăng cầu an xuống Hồ Sen từ hướng người chơi đang đứng. */
  public releaseFloatingLantern() {
    this.lotusPondInstance?.releaseLantern(this.playerPos)
    this.triggerLocalEmote('bowing')
  }

  /** Đồng bộ kích thước 5 cá Koi theo cấp độ chăm sóc. */
  public syncKoiLevels(levels: number[]) {
    this.lotusPondInstance?.setKoiLevels(levels)
  }

  /** Kích hoạt hiệu ứng cá Koi quẫy đuôi tụ lại khi được cho ăn. */
  public triggerKoiFeed() {
    this.lotusPondInstance?.triggerKoiFeed(this.playerPos)
    this.triggerLocalEmote('bowing')
  }

  /** Đồng bộ 6 ô đất Vườn Thiền trong thế giới 3D. */
  public syncZenGarden(plots: Array<{ plotIndex: number; seedId: string | null; stage: number }>) {
    this.zenGardenInstance?.syncPlots(plots)
  }

  /** Gõ Đại Hồng Chung tại Lầu Chuông (vung chày, rung chuông, sóng âm). */
  public ringGreatBell() {
    this.bellTowerInstance?.ringBell()
    this.triggerLocalEmote('bowing', 2.4, 1.2)
  }

  public setOutfitColor(hexColor: number) {
    if (this.avatar) {
      this.avatar.setRobeColor(hexColor)
    }
  }

  // ==========================================
  // MINECRAFT-STYLE MOVEMENT & CAMERA PHYSICS
  // ==========================================
  private updatePlayerAndCamera(delta: number) {
    // 1. Damping góc quay Yaw & Pitch (Chuẩn Minecraft mượt mà, phản hồi lập tức)
    this.yaw = THREE.MathUtils.lerp(this.yaw, this.targetYaw, Math.min(delta * 22, 1.0))
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.targetPitch, Math.min(delta * 22, 1.0))

    // 2. Tính toán Vector Hướng Nhìn Camera trên mặt phẳng ngang XZ
    const fwdX = -Math.sin(this.yaw)
    const fwdZ = -Math.cos(this.yaw)
    const rightX = Math.cos(this.yaw)
    const rightZ = -Math.sin(this.yaw)

    let moveX = 0
    let moveZ = 0

    // Đang tự đi bộ tới bồ đoàn hoặc đang tọa thiền: bỏ qua phím di chuyển của người chơi
    const inputLocked = this.isInputLocked
    const isW = !inputLocked && (this.keysPressed['KeyW'] || this.keysPressed['ArrowUp'])
    const isS = !inputLocked && (this.keysPressed['KeyS'] || this.keysPressed['ArrowDown'])
    const isA = !inputLocked && (this.keysPressed['KeyA'] || this.keysPressed['ArrowLeft'])
    const isD = !inputLocked && (this.keysPressed['KeyD'] || this.keysPressed['ArrowRight'])

    if (isW) {
      moveX += fwdX
      moveZ += fwdZ
    }
    if (isS) {
      // Trong Minecraft, đi lùi chậm hơn ~18% so với đi tiến
      moveX -= fwdX * 0.82
      moveZ -= fwdZ * 0.82
    }
    if (isA) {
      moveX -= rightX
      moveZ -= rightZ
    }
    if (isD) {
      moveX += rightX
      moveZ += rightZ
    }

    // Tự đi bộ (tọa thiền): lấy hướng bước tới waypoint hiện tại thay cho phím điều khiển
    let autoWalkSpeed = 0
    if (this.autoWalk) {
      const step = this.stepAutoWalk(delta)
      if (step) {
        moveX = step.dx
        moveZ = step.dz
        autoWalkSpeed = step.speed
      }
    }

    const isMoving = moveX !== 0 || moveZ !== 0
    const isMovingForward = isW && !isS

    // Tốc độ di chuyển chuẩn Minecraft: Sneak (chậm) | Walk (bình thường) | Sprint (chạy nhanh)
    const sneaking = this.isSneaking && !inputLocked
    let currentSpeed = 4.8
    if (autoWalkSpeed > 0) {
      currentSpeed = autoWalkSpeed
    } else if (sneaking) {
      currentSpeed = 2.1
    } else if (this.isSprinting && isMovingForward) {
      currentSpeed = 7.4
    } else if (!inputLocked) {
      this.isSprinting = false
    }

    // Dynamic FOV (Góc nhìn nở rộng khi chạy nhanh như Minecraft Sprint FOV effect, hoặc FOV tùy chỉnh trong Photo Mode)
    this.targetFov = this.photoFov !== null
      ? this.photoFov
      : (this.isSprinting && isMoving && !inputLocked ? 63 : 52)
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, Math.min(delta * 9.0, 1.0))
    this.camera.updateProjectionMatrix()

    // 3. Di chuyển vật lý với Capsule Character Controller & Wall Sliding (Giai đoạn 1)
    if (isMoving) {
      const len = Math.hypot(moveX, moveZ)
      const nx = moveX / len
      const nz = moveZ / len
      const moveDir = this.scratchMoveDir.set(nx, 0, nz)

      this.characterController.isSneaking = sneaking
      this.characterController.isSprinting = this.isSprinting && !inputLocked
      this.characterController.update(delta, moveDir, currentSpeed)

      // Xoay nhân vật hướng về phía đang bước đi (ở TPP)
      const targetFacing = Math.atan2(nx, nz)
      let diff = targetFacing - this.playerFacingAngle
      while (diff < -Math.PI) diff += Math.PI * 2
      while (diff > Math.PI) diff -= Math.PI * 2
      this.playerFacingAngle += diff * Math.min(delta * 16, 1.0)
      this.player.rotation.y = this.playerFacingAngle
    } else {
      this.characterController.isSneaking = sneaking
      this.characterController.isSprinting = this.isSprinting && !inputLocked
      this.characterController.update(delta, this.scratchZeroDir.set(0, 0, 0), 0)

      if (this.cameraMode === 'fpp' && !this.isSeated) {
        this.player.rotation.y = this.yaw
      }
    }

    // Đồng bộ vị trí & trạng thái từ Character Controller (Không còn clamp cứng)
    this.playerPos.copy(this.characterController.position)
    this.isGrounded = this.characterController.isGrounded
    this.player.position.copy(this.playerPos)

    // Cập nhật hoạt ảnh Avatar (bước đi, hoa sen nở "Bộ bộ sinh liên")
    if (this.avatar) {
      this.avatar.root.scale.y = this.isSneaking ? 0.88 : 1.0
      this.avatar.update(delta, isMoving, currentSpeed, this.playerPos)
    }

    // Truyền dữ liệu tọa độ của người chơi local sang Multiplayer Sangha Hub
    if (this.onLocalMove) {
      this.onLocalMove([this.playerPos.x, this.playerPos.y, this.playerPos.z], this.yaw, isMoving)
    }

    // 4. Định vị Camera Minecraft & Tích hợp Camera Spring Arm chống xuyên tường (FPP / TPP - F5)
    const cp = Math.cos(this.pitch)
    const sp = Math.sin(this.pitch)

    const eyeHeight = this.isSneaking ? 1.2 : 1.55
    const targetY = this.playerPos.y + (this.isSneaking ? 0.95 : 1.15)
    const focusPoint = this.scratchFocus.set(this.playerPos.x, targetY, this.playerPos.z)

    if (this.cameraMode === 'fpp') {
      // 👁️ GÓC NHÌN THỨ NHẤT (FPP)
      if (this.avatar) this.avatar.root.visible = false
      const eyeY = this.playerPos.y + eyeHeight
      this.camera.position.set(this.playerPos.x, eyeY, this.playerPos.z)
      this.camera.lookAt(
        this.playerPos.x + fwdX * cp,
        eyeY - sp,
        this.playerPos.z + fwdZ * cp
      )
    } else {
      // 👤 GÓC NHÌN THỨ BA SAU LƯNG (TPP) - CAMERA SPRING ARM CHỐNG XUYÊN TƯỜNG
      if (this.avatar) this.avatar.root.visible = true
      const backwardDir = this.scratchBackward.set(-fwdX * cp, sp, -fwdZ * cp).normalize()
      const safeCamPos = this.cameraSpringArm.computePosition(
        focusPoint,
        backwardDir,
        this.distance,
        delta
      )
      this.camera.position.copy(safeCamPos)
      this.camera.lookAt(focusPoint)
    }
  }

  public get currentIncenseLocation(): 'hall' | 'courtyard' {
    const distHall = this.playerPos.distanceTo(TempleStage.PROX_HALL_INCENSE)
    return distHall < 3.2 ? 'hall' : 'courtyard'
  }

  private checkProximity() {
    let nearest: InteractionTarget = null
    const distIncenseCourtyard = this.playerPos.distanceTo(TempleStage.PROX_INCENSE)
    const distIncenseHall = this.playerPos.distanceTo(TempleStage.PROX_HALL_INCENSE)
    const distMerit = this.playerPos.distanceTo(TempleStage.PROX_MERIT)
    const distFortune = this.playerPos.distanceTo(TempleStage.PROX_FORTUNE)
    // Ban thờ Tam Bảo & Phật Thích Ca bên trong Chánh điện tại (0, 1.35, -13.5)
    const distBuddha = this.playerPos.distanceTo(TempleStage.PROX_BUDDHA)
    const distPond = this.playerPos.distanceTo(TempleStage.PROX_POND)
    const distDoor = this.playerPos.distanceTo(TempleStage.PROX_DOOR)
    const distAbbot = this.playerPos.distanceTo(TempleStage.PROX_ABBOT)
    const distHauDong = this.hauDongSanctuary
      ? Math.min(
          this.playerPos.distanceTo(this.hauDongSanctuary.centerWorldPos),
          this.playerPos.distanceTo(this.hauDongSanctuary.meritBoxWorldPos)
        )
      : Infinity
    const distParkourStart = this.mountainParkourInstance
      ? this.playerPos.distanceTo(this.mountainParkourInstance.startChestPos)
      : Infinity
    const distParkourSummit = this.mountainParkourInstance
      ? this.playerPos.distanceTo(this.mountainParkourInstance.summitPos)
      : Infinity
    const distLoveTree = this.loveTreeInstance
      ? this.playerPos.distanceTo(this.loveTreeInstance.interactPos)
      : Infinity
    const distZenGarden = this.zenGardenInstance
      ? this.playerPos.distanceTo(this.zenGardenInstance.interactPos)
      : Infinity
    const distBodhiChess = this.bodhiChessTableInstance
      ? this.playerPos.distanceTo(this.bodhiChessTableInstance.interactPos)
      : Infinity
    const distBellTower = Math.hypot(
      this.playerPos.x - TempleStage.PROX_BELL_TOWER.x,
      this.playerPos.z - TempleStage.PROX_BELL_TOWER.z
    )

    if (distIncenseCourtyard < 2.6 || distIncenseHall < 3.2) nearest = 'incense'
    else if (distMerit < 2.4) nearest = 'merit_box'
    else if (distFortune < 2.4) nearest = 'fortune'
    else if (distLoveTree < 2.8) nearest = 'love_tree'
    else if (distBodhiChess < 2.6) nearest = 'bodhi_chess'
    else if (distZenGarden < 4.8) nearest = 'zen_garden'
    else if (distBellTower < 4.8) nearest = 'bell_tower'
    else if (distParkourStart < 3.0) nearest = 'parkour_start'
    else if (distParkourSummit < 3.8) nearest = 'parkour_summit'
    else if (distHauDong < 5.2) nearest = 'hau_dong'
    else if (distAbbot < HallLayout.ABBOT_SPOT.interactionRadius) nearest = 'abbot'
    else if (distDoor < 3.2 && (this.sanctuaryHall ? this.sanctuaryHall.doorAngle < 0.4 : false)) nearest = 'door'
    else if (distBuddha < 4.8 || this.isInsideSanctuary()) nearest = 'meditation'
    else if (distPond < 8.8) nearest = 'lantern'

    if (nearest !== this.currentNearTarget) {
      this.currentNearTarget = nearest
      if (this.onNearTarget) this.onNearTarget(nearest)
    }
  }

  public isNearParkourStart(maxDist = 3.2): boolean {
    if (!this.mountainParkourInstance) return false
    return this.playerPos.distanceTo(this.mountainParkourInstance.startChestPos) < maxDist
  }

  public isNearParkourSummit(maxDist = 4.0): boolean {
    if (!this.mountainParkourInstance) return false
    return this.playerPos.distanceTo(this.mountainParkourInstance.summitPos) < maxDist
  }

  public isInsideHauDongZone(): boolean {
    if (!this.hauDongSanctuary) return false
    const dx = this.playerPos.x - this.hauDongSanctuary.centerWorldPos.x
    const dz = this.playerPos.z - this.hauDongSanctuary.centerWorldPos.z
    return Math.hypot(dx, dz) <= this.hauDongSanctuary.proximityRadius
  }

  /**
   * Đóng/mở cửa bức bàn Chánh điện thủ công
   */
  public toggleSanctuaryDoor(): boolean {
    if (this.sanctuaryHall) {
      return this.sanctuaryHall.toggleDoor()
    }
    return false
  }

  /**
   * Kiểm tra người chơi có đang đứng gần cửa Chánh điện không
   */
  public isNearDoor(maxDist = 3.8): boolean {
    return this.playerPos.distanceTo(TempleStage.PROX_DOOR) < maxDist
  }

  public isInsideSanctuary(margin = 0): boolean {
    return HallLayout.isInsideSanctuary(this.playerPos.x, this.playerPos.z, margin)
  }

  public isNearFortune(maxDist = 3.2): boolean {
    return this.playerPos.distanceTo(TempleStage.PROX_FORTUNE) < maxDist
  }

  public isNearMerit(maxDist = 3.2): boolean {
    return this.playerPos.distanceTo(TempleStage.PROX_MERIT) < maxDist
  }

  public getPlayerXZ(): { x: number; z: number } {
    return { x: this.playerPos.x, z: this.playerPos.z }
  }

  /**
   * Tính bước đi tiếp theo trong lộ trình tự động (autoWalk)
   */
  private stepAutoWalk(delta: number): { dx: number; dz: number; speed: number } | null {
    if (!this.autoWalk) return null

    if (this.autoWalk.startDelay > 0) {
      this.autoWalk.startDelay -= delta
      return null
    }

    const { waypoints, index } = this.autoWalk
    if (index >= waypoints.length) {
      this.finishAutoWalk()
      return null
    }

    const target = waypoints[index]
    const dx = target.x - this.playerPos.x
    const dz = target.z - this.playerPos.z
    const dist = Math.hypot(dx, dz)

    const isLastWaypoint = index === waypoints.length - 1
    const reachThreshold = isLastWaypoint ? 0.22 : 0.45

    if (dist <= reachThreshold) {
      if (isLastWaypoint) {
        this.finishAutoWalk()
        return null
      } else {
        this.autoWalk.index++
        this.autoWalk.stuckTimer = 0
        this.autoWalk.bestDist = Infinity
        return this.stepAutoWalk(delta)
      }
    }

    // Kiểm tra kẹt vật lý
    if (dist < this.autoWalk.bestDist - 0.05) {
      this.autoWalk.bestDist = dist
      this.autoWalk.stuckTimer = 0
    } else {
      this.autoWalk.stuckTimer += delta
    }

    // Quá 2.8s không tiến thêm được
    if (this.autoWalk.stuckTimer > 2.8) {
      if (this.autoWalk.snapOnStuck) {
        const finalWp = waypoints[waypoints.length - 1]
        this.characterController.position.x = finalWp.x
        this.characterController.position.z = finalWp.z
        this.playerPos.x = finalWp.x
        this.playerPos.z = finalWp.z
        this.player.position.copy(this.playerPos)
        this.finishAutoWalk()
        return null
      } else {
        const onAbort = this.autoWalk.onAbort
        this.autoWalk = null
        if (this.avatar && !this.isSeated) {
          this.avatar.setAction('standing')
        }
        if (onAbort) onAbort()
        return null
      }
    }

    // Đang đi bộ tới điểm
    if (this.avatar && this.avatar.action !== 'walking') {
      this.avatar.setAction('walking')
    }

    let dirX = dx / dist
    let dirZ = dz / dist

    // Né vật cản cục bộ (Local Steering): nếu bị khựng > 0.22s, thử bẻ lái nhẹ trái/phải để trượt qua cạnh vật thể
    if (this.autoWalk.stuckTimer > 0.22 && this.collisionWorld) {
      const probeDist = 0.75
      const angles = [0.61, -0.61, 1.22, -1.22] // ±35°, ±70°
      for (const ang of angles) {
        const cosA = Math.cos(ang)
        const sinA = Math.sin(ang)
        const sx = dirX * cosA - dirZ * sinA
        const sz = dirX * sinA + dirZ * cosA
        if (this.pathfinder.isPointWalkable(this.playerPos.x + sx * probeDist, this.playerPos.z + sz * probeDist)) {
          dirX = sx
          dirZ = sz
          break
        }
      }
    }

    return {
      dx: dirX,
      dz: dirZ,
      speed: this.autoWalk.speed
    }
  }

  /**
   * Tạo lộ trình tránh tường & vật cản bằng GridPathfinder (A* + làm mượt).
   * Tự động mở cửa Chánh Điện nếu điểm đầu hoặc lộ trình đi qua cửa chính.
   */
  private buildSafeWaypoints(target: { x: number; z: number }): Array<{ x: number; z: number }> {
    const waypoints = this.collisionWorld
      ? this.pathfinder.findPath(this.collisionWorld, this.playerPos.x, this.playerPos.z, target.x, target.z)
      : [target]

    const startsInside = this.playerPos.z < 0.5 && Math.abs(this.playerPos.x) < 16.0
    const crossesDoor = waypoints.some((wp) => Math.abs(wp.x) < 5.0 && wp.z >= -1.8 && wp.z <= 4.0)
    if ((startsInside || crossesDoor) && this.sanctuaryHall && this.sanctuaryHall.doorAngle < 0.4) {
      this.sanctuaryHall.toggleDoor()
    }

    return waypoints
  }

  /**
   * Hoàn thành lộ trình tự đi
   */
  private finishAutoWalk() {
    if (!this.autoWalk) return
    const { finalYaw, onArrive, waypoints, actionOnArrive } = this.autoWalk
    const lastWp = waypoints[waypoints.length - 1]

    if (lastWp) {
      this.characterController.position.x = lastWp.x
      this.characterController.position.z = lastWp.z
      this.playerPos.x = lastWp.x
      this.playerPos.z = lastWp.z
      this.player.position.copy(this.playerPos)
    }

    if (finalYaw !== null) {
      this.playerFacingAngle = finalYaw
      this.player.rotation.y = finalYaw
      if (this.cameraMode === 'fpp') {
        this.yaw = finalYaw
        this.targetYaw = finalYaw
      }
    }

    this.autoWalk = null
    if (actionOnArrive === 'meditate') {
      this.isSeated = true
      if (this.avatar) {
        this.avatar.setAction('meditating')
      }
    } else {
      this.isSeated = false
      if (this.avatar) {
        this.avatar.setAction('standing')
      }
    }

    if (onArrive) {
      onArrive()
    }
  }

  /**
   * Tự động bước tới bồ đoàn thiền, xoay mặt đúng về tượng Phật và ngồi thiền
   */
  public walkToMeditationSlot(slot: MeditationSlot, onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.isSeated = false

    const path = this.buildSafeWaypoints({ x: slot.x, z: slot.z })
    this.autoWalk = {
      waypoints: path,
      index: 0,
      speed: 2.6,
      startDelay: 0.05,
      finalYaw: slot.yaw,
      snapOnStuck: true,
      actionOnArrive: 'meditate',
      onArrive: () => {
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }

  /**
   * Dẫn đường nhân vật từ bên ngoài bước vào Chánh Điện (mở cửa nếu đóng)
   */
  public guidePlayerToSanctuaryEntrance(onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.isSeated = false

    // Mở cửa nếu cửa đang đóng
    if (this.sanctuaryHall && this.sanctuaryHall.doorAngle < 0.4) {
      this.sanctuaryHall.toggleDoor()
    }

    const insideSpot = { x: 0, z: -2.5 }
    const waypoints = this.buildSafeWaypoints(insideSpot)

    const finalYaw = HallLayout.getYawToAltar(insideSpot.x, insideSpot.z)
    this.autoWalk = {
      waypoints,
      index: 0,
      speed: 3.4,
      startDelay: 0.05,
      finalYaw,
      snapOnStuck: false,
      actionOnArrive: 'stand',
      onArrive: () => {
        if (this.avatar) {
          this.avatar.setAction('standing')
        }
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (this.avatar) {
          this.avatar.setAction('standing')
        }
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }

  /** Đồng bộ biểu cảm 3D của Thầy Trụ Trì theo JSON trả về từ hội thoại. */
  public setAbbotEmotion(emotion: AbbotNpcEmotion) {
    this.abbotNpc?.setEmotion(emotion)
  }

  /** Dẫn đường nhân vật bước lên Hiên Tiền Điện tới gặp Thầy Trụ Trì (Phương án 2). */
  public walkToAbbot(onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.standUpFromMeditation()

    const spot = HallLayout.ABBOT_SPOT
    const standPos = { x: spot.x - 1.15, z: spot.z + 0.55 }
    const waypoints = this.buildSafeWaypoints(standPos)

    const finalYaw = Math.atan2(spot.x - standPos.x, spot.z - standPos.z)
    this.autoWalk = {
      waypoints,
      index: 0,
      speed: 3.6,
      startDelay: 0.05,
      finalYaw,
      snapOnStuck: false,
      actionOnArrive: 'stand',
      onArrive: () => {
        if (this.avatar) this.avatar.setAction('standing')
        this.abbotNpc?.setEmotion('smile')
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }


  /**
   * Dẫn đường nhân vật bước lại gần Bàn Xin Xăm & Pháp Bảo ngoài sân
   */
  public walkToFortuneTable(onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.standUpFromMeditation()

    const target = { x: -5.0, z: 11.4 }
    const waypoints = this.buildSafeWaypoints(target)

    this.autoWalk = {
      waypoints,
      index: 0,
      speed: 3.6,
      startDelay: 0.05,
      finalYaw: Math.PI, // Quay mặt về phía Bàn Xem Quẻ (hướng Bắc)
      snapOnStuck: false,
      actionOnArrive: 'stand',
      onArrive: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }


  /**
   * Dẫn đường nhân vật bước lại gần Hòm Công Đức Tam Bảo ngoài sân
   */
  public walkToMeritBox(onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.standUpFromMeditation()

    const target = { x: 5.0, z: 11.4 }
    const waypoints = this.buildSafeWaypoints(target)

    this.autoWalk = {
      waypoints,
      index: 0,
      speed: 3.6,
      startDelay: 0.05,
      finalYaw: Math.PI, // Quay mặt về phía Hòm Công Đức (hướng Bắc)
      snapOnStuck: false,
      actionOnArrive: 'stand',
      onArrive: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }


  /**
   * Dẫn đường nhân vật di chuyển sang Nhà Hầu Đồng (Điện Thờ Tứ Phủ & Trần Triều ở phía Đông)
   */
  public walkToHauDongHall(onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.standUpFromMeditation()

    const target = { x: 35.0, z: -6.2 }
    const waypoints = this.buildSafeWaypoints(target)

    this.autoWalk = {
      waypoints,
      index: 0,
      speed: 4.2,
      startDelay: 0.05,
      finalYaw: Math.PI,
      snapOnStuck: true,
      actionOnArrive: 'stand',
      onArrive: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }


  /**
   * Dẫn đường tới Đài Tơ Duyên Nguyệt Lão (Bên bờ Hồ Sen Bát Nhã & Cầu Kiều)
   */
  public walkToLoveTree(onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.standUpFromMeditation()

    const target = { x: -10.5, z: 15.5 }
    const waypoints = this.buildSafeWaypoints(target)

    this.autoWalk = {
      waypoints,
      index: 0,
      speed: 4.2,
      startDelay: 0.05,
      finalYaw: 0,
      snapOnStuck: true,
      actionOnArrive: 'stand',
      onArrive: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }


  /**
   * Ngồi xuống đôn đá ở Bàn Cờ Đá Dưới Bóng Bồ Đề
   */
  public sitAtBodhiChess() {
    this.cancelAutoWalk()
    const tablePos = this.bodhiChessTableInstance?.centerPos ?? new THREE.Vector3(-7.4, 0.0, 9.2)
    // Chọn đôn gần người chơi hơn (phía Nam z + 1.05 hoặc phía Bắc z - 1.05)
    const southZ = tablePos.z + 1.05
    const northZ = tablePos.z - 1.05
    const useSouth = Math.abs(this.playerPos.z - southZ) <= Math.abs(this.playerPos.z - northZ)
    const stoolZ = useSouth ? southZ : northZ
    const stoolYaw = useSouth ? Math.PI : 0

    this.playerPos.set(tablePos.x, 0.34, stoolZ)
    this.characterController.position.copy(this.playerPos)
    this.playerFacingAngle = stoolYaw
    this.player.position.copy(this.playerPos)
    this.player.rotation.y = stoolYaw
    this.isSeated = true
    if (this.avatar) {
      this.avatar.setAction('meditating')
    }
  }

  /**
   * Đứng dậy khỏi đôn đá ở Bàn Cờ Bồ Đề
   */
  public standUpFromBodhiChess() {
    if (!this.isSeated) return
    const tablePos = this.bodhiChessTableInstance?.centerPos ?? new THREE.Vector3(-7.4, 0.0, 9.2)
    const useSouth = this.playerPos.z >= tablePos.z
    this.playerPos.set(tablePos.x, 0.0, useSouth ? tablePos.z + 1.55 : tablePos.z - 1.55)
    this.characterController.position.copy(this.playerPos)
    this.player.position.copy(this.playerPos)
    this.standUpFromMeditation()
  }

  /**
   * Dẫn đường tới Bàn Cờ Đá Dưới Bóng Bồ Đề và ngồi xuống đôn đá
   */
  public walkToBodhiChess(onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.standUpFromMeditation()

    const target = { x: -7.4, z: 10.65 }
    const waypoints = this.buildSafeWaypoints(target)

    this.autoWalk = {
      waypoints,
      index: 0,
      speed: 4.2,
      startDelay: 0.05,
      finalYaw: Math.PI,
      snapOnStuck: true,
      actionOnArrive: 'stand',
      onArrive: () => {
        this.sitAtBodhiChess()
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }

  /**
   * Dẫn đường tới một điểm bất kỳ ngoài sân (dùng cho Ba Việc Lành). Nếu đang trong Chánh Điện thì mở cửa
   * và đi ra qua cửa chính trước.
   */
  public walkToPoint(target: { x: number; z: number }, onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.standUpFromMeditation()

    const waypoints = this.buildSafeWaypoints(target)

    this.autoWalk = {
      waypoints,
      index: 0,
      speed: 4.2,
      startDelay: 0.05,
      finalYaw: null,
      snapOnStuck: true,
      actionOnArrive: 'stand',
      onArrive: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }


  /**
   * Dẫn đường ra Cổng Tam Quan
   */
  public walkToTamQuanGate(onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.standUpFromMeditation()

    const target = { x: 0, z: 21.0 }
    const waypoints = this.buildSafeWaypoints(target)

    this.autoWalk = {
      waypoints,
      index: 0,
      speed: 4.2,
      startDelay: 0.05,
      finalYaw: 0,
      snapOnStuck: true,
      actionOnArrive: 'stand',
      onArrive: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }


  /**
   * Dẫn đường vào Đại Hùng Bảo Điện (trước Kim Thân Phật Tổ)
   */
  public walkToSanctuary(onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.standUpFromMeditation()

    if (this.sanctuaryHall && this.sanctuaryHall.doorAngle < 0.4) {
      this.sanctuaryHall.toggleDoor()
    }

    const target = { x: 0, z: -14.0 }
    const waypoints = this.buildSafeWaypoints(target)

    this.autoWalk = {
      waypoints,
      index: 0,
      speed: 4.0,
      startDelay: 0.05,
      finalYaw: Math.PI,
      snapOnStuck: true,
      actionOnArrive: 'stand',
      onArrive: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }


  /**
   * Dẫn đường tới Cổng Leo Núi Parkour (phía sau Chánh Điện)
   */
  public walkToParkourGate(onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.standUpFromMeditation()

    const target = { x: 0, z: -31.5 }
    const waypoints = this.buildSafeWaypoints(target)

    this.autoWalk = {
      waypoints,
      index: 0,
      speed: 4.2,
      startDelay: 0.05,
      finalYaw: Math.PI,
      snapOnStuck: true,
      actionOnArrive: 'stand',
      onArrive: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onArrive) onArrive()
      },
      onAbort: () => {
        if (this.avatar) this.avatar.setAction('standing')
        if (onAbort) onAbort()
      },
      stuckTimer: 0,
      bestDist: Infinity
    }
  }


  /**
   * Trả về true nếu nhân vật đang trong trạng thái tự động bước đi (auto-walk)
   */
  public get isAutoWalking(): boolean {
    return this.autoWalk !== null
  }

  /**
   * Xả thiền: đứng dậy, cho phép người chơi di chuyển tự do trở lại
   */
  public standUpFromMeditation() {
    this.autoWalk = null
    this.isSeated = false
    if (this.avatar) {
      this.avatar.setAction('standing')
    }
  }

  /**
   * Hủy bỏ quá trình tự đi bộ
   */
  public cancelAutoWalk() {
    if (this.autoWalk) {
      const abortCb = this.autoWalk.onAbort
      this.autoWalk = null
      if (this.avatar && !this.isSeated) {
        this.avatar.setAction('standing')
      }
      if (abortCb) abortCb()
    }
  }

  private updateVFX(delta: number, elapsed: number) {
    // Cập nhật Chánh điện rỗng: Cửa bức bàn, hào quang, nến, khói hương nội thất, ánh sáng chuyển tiếp (Giai đoạn 2)
    if (this.sanctuaryHall) {
      this.sanctuaryHall.update(delta, elapsed, this.playerPos)

      // Chuyển cảnh ánh sáng mượt (Smooth interior exposure & illumination transition)
      const interiorF = this.sanctuaryHall.interiorFactor
      const cfg = Palette.get(this.timeOfDay)

      // Nội suy mượt mà độ phơi sáng giữa ngoài trời và trong chánh điện
      const targetExposure = THREE.MathUtils.lerp(cfg.exposure.outdoor, cfg.exposure.indoor, interiorF)
      this.renderer.toneMappingExposure = THREE.MathUtils.lerp(this.renderer.toneMappingExposure, targetExposure, Math.min(delta * 4.0, 1.0))

      if (this.keyLight && this.hemiLight) {
        this.keyLight.intensity = THREE.MathUtils.lerp(cfg.sun.intensity, cfg.sun.intensity * 0.25, interiorF)
        this.hemiLight.intensity = THREE.MathUtils.lerp(cfg.hemi.intensity, cfg.hemi.intensity * 0.65, interiorF)
      }
    }

    if (this.mandalaHalo) {
      this.mandalaHalo.rotation.z += delta * 0.15
    }

    if (this.hauDongSanctuary) {
      this.hauDongSanctuary.update(delta, elapsed, this.hauDongVisualState)
    }
    if (this.abbotNpc) {
      this.abbotNpc.update(delta, elapsed, this.playerPos)
    }
    if (this.bodhiChessTableInstance) {
      this.bodhiChessTableInstance.update(elapsed)
    }
    if (this.bodhiMonkInstance && this.bodhiChessTableInstance) {
      const tc = this.bodhiChessTableInstance.centerPos
      const seatedHere =
        this.isSeated && Math.hypot(this.playerPos.x - tc.x, this.playerPos.z - tc.z) < 1.6
      this.bodhiMonkInstance.update(delta, this.playerPos, seatedHere)
    }

    // Cập nhật Hồ sen sống động, Cầu đá vòm cong & Hướng mặt trời shader (Giai đoạn 4 & Phase 6)
    if (this.lotusPondInstance) {
      this.lotusPondInstance.update(delta, elapsed)
      if (this.atmosphere) {
        this.lotusPondInstance.updateSunDirection(this.atmosphere.sunVector)
      }
    }

    // Cập nhật Lầu chuông & Đại hồng chung đung đưa (Giai đoạn 4)
    if (this.bellTowerInstance) {
      this.bellTowerInstance.swingBell(delta, elapsed)
    }

    // Cập nhật Thảm cỏ tự nhiên lay động gió (Giai đoạn 4)
    if (this.windGrassInstance) {
      this.windGrassInstance.update(delta, elapsed)
    }

    // Cập nhật Hệ Thống Cây Cối & Hạt Tự Nhiên GPU (Phase 5)
    if (this.treeSystem) {
      this.treeSystem.update(delta)
    }
    if (this.petalParticleSystem) {
      this.petalParticleSystem.update(delta)
    }
    if (this.festivalFireworksSystem) {
      this.festivalFireworksSystem.update(delta)
    }
    if (this.loveTreeInstance) {
      this.loveTreeInstance.update(elapsed)
    }

    // Cập nhật đom đóm bay quanh Hồ Sen & Vườn Thiền (chỉ hiện rõ lúc hoàng hôn / ban đêm)
    if (this.fireflyPoints && this.fireflyBasePositions && this.fireflyMat) {
      const targetOp = this.timeOfDay === 'night' ? 0.88 : this.timeOfDay === 'sunset' ? 0.42 : 0.0
      this.fireflyMat.opacity = THREE.MathUtils.lerp(this.fireflyMat.opacity, targetOp, delta * 2.5)
      this.fireflyPoints.visible = this.fireflyMat.opacity > 0.02
      if (this.fireflyPoints.visible) {
        const posAttr = this.fireflyPoints.geometry.getAttribute('position') as THREE.BufferAttribute
        const count = posAttr.count
        for (let i = 0; i < count; i++) {
          const bx = this.fireflyBasePositions[i * 3]!
          const by = this.fireflyBasePositions[i * 3 + 1]!
          const bz = this.fireflyBasePositions[i * 3 + 2]!
          posAttr.setXYZ(
            i,
            bx + Math.sin(elapsed * 0.9 + i * 1.7) * 0.65,
            by + Math.sin(elapsed * 1.3 + i * 2.3) * 0.35,
            bz + Math.cos(elapsed * 0.8 + i * 1.1) * 0.65
          )
        }
        posAttr.needsUpdate = true
      }
    }

  }

  private buildAtmosphereAccents() {
    // 1. 48 Đom đóm ánh vàng bay quanh Hồ Sen, Cây Nguyệt Lão và Vườn Thiền
    const count = 48
    const positions = new Float32Array(count * 3)
    const basePositions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const isGarden = i % 2 === 1
      const cx = isGarden ? 10.2 : -12.0
      const cz = isGarden ? 18.8 : 17.0
      const ang = (i * 2.399) % (Math.PI * 2)
      const rad = 1.5 + ((i * 7) % 10) * 0.45
      const x = cx + Math.cos(ang) * rad
      const y = 0.8 + ((i * 13) % 10) * 0.24
      const z = cz + Math.sin(ang) * rad
      positions[i * 3] = basePositions[i * 3] = x
      positions[i * 3 + 1] = basePositions[i * 3 + 1] = y
      positions[i * 3 + 2] = basePositions[i * 3 + 2] = z
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.fireflyMat = new THREE.PointsMaterial({
      color: 0xffe484,
      size: 0.18,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    this.fireflyPoints = new THREE.Points(geo, this.fireflyMat)
    this.fireflyPoints.visible = false
    this.fireflyBasePositions = basePositions
    this.scene.add(this.fireflyPoints)
  }

  /**
   * Cập nhật danh sách đồng tu online (Realtime MMO Interpolation & Partial Update)
   */
  public upsertRemotePilgrim(data: PilgrimPresence) {
    let remote = this.remotePilgrims.get(data.id)
    if (!remote) {
      const rawCountry = data.country && data.country.trim() !== '' ? data.country.split(':')[0] : 'vietnam'
      const country = rawCountry as PilgrimCountry
      const gender: AvatarGender =
        data.gender === 'male' || (data.country && data.country.endsWith(':male')) ? 'male' : 'female'
      const name = data.name && data.name.trim() !== '' ? data.name : `Đồng tu ${data.id.slice(0, 6)}`
      const title = data.title && data.title.trim() !== '' ? data.title : 'Hành Giả'

      const avatar = new PilgrimAvatar(country, gender)

      const nameplate = createPilgrimNameplate(name, title, country, {
        variant: data.verified ? 'verified' : 'pilgrim'
      })
      nameplate.position.set(0, 2.05, 0)
      avatar.root.add(nameplate)

      avatar.root.position.set(data.position[0], data.position[1], data.position[2])
      avatar.root.rotation.y = data.yaw || 0
      this.scene.add(avatar.root)

      remote = {
        id: data.id,
        name,
        title,
        country,
        gender,
        avatar,
        nameplate,
        speechBubble: null,
        bubbleTimer: null,
        currentPos: new THREE.Vector3(data.position[0], data.position[1], data.position[2]),
        targetPos: new THREE.Vector3(data.position[0], data.position[1], data.position[2]),
        currentYaw: data.yaw || 0,
        targetYaw: data.yaw || 0,
        action: data.action || 'standing'
      }
      this.remotePilgrims.set(data.id, remote)
    } else {
      remote.targetPos.set(data.position[0], data.position[1], data.position[2])
      remote.targetYaw = data.yaw
      if (data.action && remote.action !== data.action) {
        remote.action = data.action
        remote.avatar.setAction(data.action)
      }
      let nameplateDirty = false
      if (data.country && data.country.trim() !== '') {
        const nextCountry = data.country.split(':')[0] as PilgrimCountry
        if (remote.country !== nextCountry) {
          remote.country = nextCountry
          remote.avatar.setCountryStyle(remote.country)
          nameplateDirty = true
        }
      }
      if (data.gender || (data.country && data.country.includes(':'))) {
        const nextGender: AvatarGender =
          data.gender === 'male' || (data.country && data.country.endsWith(':male')) ? 'male' : 'female'
        if (remote.gender !== nextGender) {
          remote.gender = nextGender
          remote.avatar.setGender(remote.gender)
        }
      }
      if (data.name && data.name.trim() !== '' && remote.name !== data.name) {
        remote.name = data.name
        nameplateDirty = true
      }
      if (data.title && data.title.trim() !== '' && remote.title !== data.title) {
        remote.title = data.title
        nameplateDirty = true
      }
      if (nameplateDirty) {
        if (remote.nameplate) {
          remote.avatar.root.remove(remote.nameplate)
          ;(remote.nameplate.material as THREE.SpriteMaterial)?.map?.dispose()
          remote.nameplate.material?.dispose()
        }
        const nextPlate = createPilgrimNameplate(remote.name, remote.title, remote.country, {
          variant: data.verified ? 'verified' : 'pilgrim'
        })
        nextPlate.position.set(0, 2.05, 0)
        remote.avatar.root.add(nextPlate)
        remote.nameplate = nextPlate
      }
    }
  }

  public removeRemotePilgrim(id: string) {
    const remote = this.remotePilgrims.get(id)
    if (remote) {
      if (remote.bubbleTimer) clearTimeout(remote.bubbleTimer)
      if (remote.speechBubble) {
        remote.avatar.root.remove(remote.speechBubble)
          ; (remote.speechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
        remote.speechBubble.material?.dispose()
        remote.speechBubble = null
      }
      if (remote.nameplate) {
        remote.avatar.root.remove(remote.nameplate)
          ; (remote.nameplate.material as THREE.SpriteMaterial)?.map?.dispose()
        remote.nameplate.material?.dispose()
      }
      remote.avatar.dispose()
      this.scene.remove(remote.avatar.root)
      this.remotePilgrims.delete(id)
    }
  }

  public triggerRemoteEmote(id: string, action: string) {
    if (this.avatarCrowd) {
      this.avatarCrowd.triggerEmote(id, action)
    }
    const remote = this.remotePilgrims.get(id)
    if (remote) {
      remote.avatar.setAction(action)
    }
  }

  public setPlayerFacingAngle(angle: number) {
    this.playerFacingAngle = angle
    this.player.rotation.y = angle
    if (this.avatar) {
      this.avatar.root.rotation.set(0, 0, 0)
    }
  }

  public faceTowards(targetPos: { x: number; z: number }, updateCamera = false) {
    const dx = targetPos.x - this.playerPos.x
    const dz = targetPos.z - this.playerPos.z
    const angle = Math.atan2(dx, dz)
    this.playerFacingAngle = angle
    this.player.rotation.y = angle
    if (this.avatar) {
      this.avatar.root.rotation.set(0, 0, 0)
    }
    if (updateCamera || this.cameraMode === 'fpp') {
      this.yaw = angle
      this.targetYaw = angle
    }
  }

  public triggerLocalEmote(
    action: 'standing' | 'walking' | 'bowing' | 'meditating',
    duration = 1.8,
    holdDuration = 0.5
  ) {
    if (this.avatar) {
      this.avatar.setAction(action, duration, holdDuration)
    }
  }

  public showSpeechBubble(id: string, text: string) {
    if (id === 'local') {
      if (this.localBubbleTimer) clearTimeout(this.localBubbleTimer)
      if (this.localSpeechBubble) {
        this.player.remove(this.localSpeechBubble)
          ; (this.localSpeechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
        this.localSpeechBubble.material?.dispose()
        this.localSpeechBubble = null
      }
      const bubble = createSpeechBubbleSprite(text)
      bubble.position.set(0, 2.45, 0)
      this.player.add(bubble)
      this.localSpeechBubble = bubble
      this.localBubbleTimer = setTimeout(() => {
        if (this.localSpeechBubble) {
          this.player.remove(this.localSpeechBubble)
            ; (this.localSpeechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
          this.localSpeechBubble.material?.dispose()
          this.localSpeechBubble = null
        }
      }, 6500)
    } else {
      const remote = this.remotePilgrims.get(id)
      if (remote) {
        if (remote.bubbleTimer) clearTimeout(remote.bubbleTimer)
        if (remote.speechBubble) {
          remote.avatar.root.remove(remote.speechBubble)
            ; (remote.speechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
          remote.speechBubble.material?.dispose()
          remote.speechBubble = null
        }
        const bubble = createSpeechBubbleSprite(text)
        bubble.position.set(0, 2.35, 0)
        remote.avatar.root.add(bubble)
        remote.speechBubble = bubble
        remote.bubbleTimer = setTimeout(() => {
          if (remote.speechBubble) {
            remote.avatar.root.remove(remote.speechBubble)
              ; (remote.speechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
            remote.speechBubble.material?.dispose()
            remote.speechBubble = null
          }
        }, 6500)
      }
    }
  }

  public spawnDebugBots(count: number) {
    if (this.avatarCrowd) {
      for (const bot of this.benchmarkBots) {
        this.avatarCrowd.removePilgrim(bot.id)
      }
    }
    this.benchmarkBots = []

    const prng = new SeededPRNG(42)
    const countries: PilgrimCountry[] = [
      'vietnam', 'japan', 'thailand', 'korea', 'taiwan', 'singapore', 'india', 'tibet', 'western'
    ]

    // Nguồn dữ liệu chân lý 500 ô bồ đoàn từ HallLayout
    const slots = HallLayout.getMeditationSlots()
    console.assert(
      slots.length >= HallLayout.MIN_SLOTS,
      `[Phase 6 Assert] HallLayout meditation slots >= ${HallLayout.MIN_SLOTS}, got ${slots.length}`
    )

    for (let i = 0; i < count; i++) {
      const id = `bot_${i}`
      const country = prng.choice(countries)
      const name = `Đồng tu #${i + 1}`
      const title = i % 5 === 0 ? 'Thượng Tọa' : i % 3 === 0 ? 'Thiền Sinh' : 'Hành Giả'

      let initialPos: THREE.Vector3
      let action: 'standing' | 'walking' | 'meditating'
      let yaw = 0
      let radius = 0
      let speed = 0
      const centerPos = new THREE.Vector3()

      // 500 bot đầu tiên ngồi thiền đúng các ô bồ đoàn trong Chánh Điện từ HallLayout
      const shouldMeditate = count >= slots.length ? i < slots.length : i < Math.floor(count * 0.5)
      if (shouldMeditate && i < slots.length) {
        const slot = slots[i]
        initialPos = new THREE.Vector3(slot.x, 1.35, slot.z)
        action = 'meditating'
        yaw = slot.yaw
      } else {
        // Courtyard wanderers: x in [-16, 16], z in [2, 22]
        const cx = prng.range(-14, 14)
        const cz = prng.range(3, 21)
        centerPos.set(cx, 0, cz)
        radius = prng.range(2.0, 5.5)
        speed = prng.range(0.8, 1.6)
        const angle = prng.range(0, Math.PI * 2)
        initialPos = new THREE.Vector3(
          cx + Math.cos(angle) * radius,
          0,
          cz + Math.sin(angle) * radius
        )
        action = 'walking'
        yaw = angle
      }

      this.benchmarkBots.push({
        id,
        name,
        title,
        country,
        action,
        centerPos,
        radius,
        speed,
        angle: prng.range(0, Math.PI * 2),
        currentPos: initialPos.clone()
      })

      if (this.avatarCrowd) {
        this.avatarCrowd.upsertPilgrim({
          id,
          name,
          title,
          country,
          position: [initialPos.x, initialPos.y, initialPos.z],
          yaw,
          action
        })
      }
    }
  }

  private updateBenchmarkBots(delta: number) {
    if (this.benchmarkBots.length === 0 || !this.avatarCrowd) return

    for (const bot of this.benchmarkBots) {
      if (bot.action === 'walking') {
        bot.angle += bot.speed * delta
        const nextX = bot.centerPos.x + Math.cos(bot.angle) * bot.radius
        const nextZ = bot.centerPos.z + Math.sin(bot.angle) * bot.radius
        const dx = nextX - bot.currentPos.x
        const dz = nextZ - bot.currentPos.z
        const yaw = Math.atan2(dx, dz)
        bot.currentPos.set(nextX, 0, nextZ)

        this.avatarCrowd.upsertPilgrim({
          id: bot.id,
          position: [nextX, 0, nextZ],
          yaw,
          action: 'walking'
        })
      }
    }
  }

  private updateRemotePilgrims(delta: number) {
    for (const remote of this.remotePilgrims.values()) {
      // Smooth position & yaw interpolation
      remote.currentPos.lerp(remote.targetPos, delta * 12)
      remote.currentYaw = THREE.MathUtils.lerp(remote.currentYaw, remote.targetYaw, delta * 12)
      remote.avatar.root.position.copy(remote.currentPos)
      remote.avatar.root.rotation.y = remote.currentYaw

      const dist = remote.currentPos.distanceTo(remote.targetPos)
      const isRemoteMoving = dist > 0.05
      remote.avatar.update(delta, isRemoteMoving, 4.0, remote.currentPos)
    }
  }

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate)

    const tStart = performance.now()
    const delta = Math.min(this.clock.getDelta(), 0.1)
    const elapsed = this.clock.getElapsedTime()

    // Cập nhật hệ thống gió toàn cục dùng chung cho cỏ và cảnh quan (Phase 1)
    this.windSystem.update(delta)

    // Cập nhật bóng đổ mặt trời bám theo người chơi (Cascaded Follower Shadow - Giai đoạn 3)
    if (this.atmosphere) {
      this.atmosphere.updateShadowFollower(this.playerPos)
      this.atmosphere.updateSky(this.camera.position)
    }

    this.updatePlayerAndCamera(delta)
    this.updateRemotePilgrims(delta)
    this.updateBenchmarkBots(delta)
    if (this.avatarCrowd) {
      this.avatarCrowd.update(delta, this.camera, this.playerPos)
    }
    this.checkProximity()
    this.updateVFX(delta, elapsed)

    // Cập nhật Terrain chunk culling theo camera (Phase 6)
    if (this.terrainSystem) {
      this.terrainSystem.update(this.camera.position)
    }

    // Render qua pipeline hậu kỳ điện ảnh (MSAA + Bloom + SMAA + ACES Tone Mapping)
    this.renderer.info.autoReset = false
    this.renderer.info.reset()

    if (this.postProcessing) {
      this.postProcessing.render(delta)
    } else {
      this.composer.render(delta)
    }

    const cpuTimeMs = performance.now() - tStart
    if (this.profiler) {
      const crowdStats = this.avatarCrowd ? this.avatarCrowd.getStats() : undefined
      this.profiler.update(cpuTimeMs, {
        bots: this.benchmarkBots.length,
        lod0: crowdStats?.lod0 ?? 0,
        lod1: crowdStats?.lod1 ?? 0,
        lod2: crowdStats?.lod2 ?? 0,
        lod3: crowdStats?.lod3 ?? 0
      })
    }
  }

  private onResize = () => {
    if (!this.container) return
    const w = this.container.clientWidth || window.innerWidth || 1280
    const h = this.container.clientHeight || window.innerHeight || 720
    if (h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    if (this.postProcessing) {
      this.postProcessing.setSize(w, h)
    } else {
      this.composer.setSize(w, h)
    }
  }

  /**
   * Thiết lập chất lượng đồ họa (Low / Medium / High / Ultra)
   */
  public setGraphicsQuality(quality: GraphicsQuality) {
    if (this.postProcessing) {
      this.postProcessing.setQuality(quality)
    }
    this.atmosphere?.setShadowQuality(quality)
  }

  public destroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId)

    // 1. Gỡ bỏ toàn bộ event listeners
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.resetMovementKeys)
    document.removeEventListener('visibilitychange', this.resetMovementKeys)

    const canvas = this.renderer.domElement
    if (canvas) {
      canvas.removeEventListener('click', this.onCanvasClick)
      canvas.removeEventListener('wheel', this.onWheel)
    }
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('contextmenu', this.onContextMenu, true)
    window.removeEventListener('blur', this.onMouseUp)

    // 2. Dọn dẹp local speech bubble & avatar
    if (this.localBubbleTimer) clearTimeout(this.localBubbleTimer)
    if (this.localSpeechBubble) {
      this.player.remove(this.localSpeechBubble)
        ; (this.localSpeechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
      this.localSpeechBubble.material?.dispose()
      this.localSpeechBubble = null
    }
    if (this.avatar) {
      this.avatar.dispose()
    }

    // 3. Dọn dẹp remote pilgrims
    for (const remote of this.remotePilgrims.values()) {
      if (remote.bubbleTimer) clearTimeout(remote.bubbleTimer)
      if (remote.speechBubble) {
        remote.avatar.root.remove(remote.speechBubble)
          ; (remote.speechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
        remote.speechBubble.material?.dispose()
      }
      if (remote.nameplate) {
        remote.avatar.root.remove(remote.nameplate)
          ; (remote.nameplate.material as THREE.SpriteMaterial)?.map?.dispose()
        remote.nameplate.material?.dispose()
      }
      remote.avatar.dispose()
      this.scene.remove(remote.avatar.root)
    }
    this.remotePilgrims.clear()

    // 4. Dọn dẹp AvatarCrowd & benchmark bots
    if (this.avatarCrowd) {
      this.avatarCrowd.dispose()
    }
    this.benchmarkBots = []

    // 5. Dọn dẹp Profiler HUD
    if (this.profiler) {
      this.profiler.dispose()
    }

    // 6. Dọn dẹp tài nguyên Giai đoạn 3 & 4
    if (this.atmosphere) {
      this.atmosphere.dispose()
    }
    if (this.postProcessing) {
      this.postProcessing.dispose()
    }
    if (this.windGrassInstance) {
      this.windGrassInstance.dispose()
    }
    if (this.treeSystem) {
      this.treeSystem.dispose()
    }
    if (this.distantMountains) {
      this.distantMountains.dispose()
    }
    if (this.petalParticleSystem) {
      this.petalParticleSystem.dispose()
    }
    if (this.festivalFireworksSystem) {
      this.festivalFireworksSystem.dispose()
    }
    if (this.mountainParkourInstance) {
      this.scene.remove(this.mountainParkourInstance.root)
      this.mountainParkourInstance.dispose()
    }
    if (this.loveTreeInstance) {
      this.scene.remove(this.loveTreeInstance.root)
    }
    if (this.zenGardenInstance) {
      this.scene.remove(this.zenGardenInstance.root)
    }
    if (this.terrainSystem) {
      this.terrainSystem.dispose()
    }
    if (this.sanctuaryHall) {
      this.sanctuaryHall.dispose()
    }

    // 7. Giải phóng toàn bộ Scene Geometry & Materials
    this.scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose())
          } else {
            mesh.material.dispose()
          }
        }
      }
    })

    this.renderer.dispose()
    this.composer.dispose()
    if (this.container && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}
