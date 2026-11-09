import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { PilgrimAvatar, type AvatarGender, type PilgrimCountry } from './PilgrimAvatar'
import { createPilgrimNameplate, createSpeechBubbleSprite } from './NameplateHelper'
import type { PilgrimPresence } from '../network/MultiplayerClient'
import { CollisionWorld, CharacterController, CameraSpringArm, BoxCollider, CylinderCollider } from './collision'
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
import { PetalParticleSystem } from './nature/PetalParticleSystem'
import { MapLayout } from './world/MapLayout'
import { HallLayout, type MeditationSlot } from './world/HallLayout'
import { TerrainSystem } from './world/TerrainSystem'
import { AvatarCrowd } from './characters/AvatarCrowd'
import { PerformanceProfiler } from './debug/PerformanceProfiler'
import { SeededPRNG } from './utils/SeededPRNG'

export type InteractionTarget = 'incense' | 'merit_box' | 'fortune' | 'meditation' | 'lantern' | 'door' | 'hau_dong' | null

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
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 144
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#1e1610' // Gỗ mun/sơn then trầm cổ truyền
    ctx.fillRect(0, 0, 512, 144)

    ctx.strokeStyle = '#fcd535'
    ctx.lineWidth = 8
    ctx.strokeRect(6, 6, 500, 132)
    ctx.lineWidth = 2
    ctx.strokeRect(16, 16, 480, 112)

    ctx.fillStyle = '#fcd535'
    ctx.font = 'bold 50px "Noto Serif", "Times New Roman", serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
    ctx.shadowBlur = 6
    ctx.fillText(text, 256, 74)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const geom = new THREE.PlaneGeometry(width, height)
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.4,
    metalness: 0.2
  })
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
  private static readonly PROX_DOOR = new THREE.Vector3(0, 1.35, 0.5)

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

  public get isInputLocked(): boolean {
    return this.isSeated || this.autoWalk !== null
  }

  // Props & Interactables & Giai đoạn 4: Kiến trúc & Thiên nhiên
  public incenseBurner!: THREE.Group
  public meritBox!: THREE.Group
  public fortuneTable!: THREE.Group
  public buddhaStatue!: THREE.Group
  public lotusPond!: THREE.Group
  public sanctuaryHall!: PagodaSanctuaryHall
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
  public petalParticleSystem!: PetalParticleSystem
  private mandalaHalo!: THREE.Mesh

  // Giai đoạn 1: Dedicated Collision System & Character Controller & Camera Spring Arm
  public collisionWorld!: CollisionWorld
  public characterController!: CharacterController
  public cameraSpringArm!: CameraSpringArm
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
    if (mode === 'fpp') this.distance = 0.5
    else this.distance = 4.2
    if (this.onCameraModeChange) {
      this.onCameraModeChange(this.cameraMode)
    }
  }

  private rotateCamera(dx: number, dy: number) {
    // Độ nhạy chuột mượt mà kiểu Minecraft
    const sens = 0.0022
    this.targetYaw -= dx * sens
    // Pitch: Đẩy chuột lên nhìn trời (-85°), Kéo chuột xuống nhìn đất (+85°)
    this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * sens, -1.48, 1.48)
  }

  public toggleStatsOverlay(): boolean {
    if (this.profiler) {
      return this.profiler.toggle()
    }
    return false
  }

  private onKeyDown = (e: KeyboardEvent) => {
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

    this.keysPressed[e.key.toLowerCase()] = true
  }

  private onKeyUp = (e: KeyboardEvent) => {
    // Nhả phím Shift: Dừng chạy nhanh
    if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this.isSprinting = false
    }
    // Nhả phím Z: Dừng đi chậm
    if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
      this.isSneaking = false
    }
    this.keysPressed[e.key.toLowerCase()] = false
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

    // Hàng đèn đá bát giác (Tōrō) theo MapLayout; buồng đèn là vật liệu phát sáng
    const baseY = 0.14
    MapLayout.LANTERN_COORDINATES.forEach(([x, z]) => {
      b.cylinder('stone', 0.42, 0.52, 0.25, 8, x, baseY + 0.12, z)
      b.cylinder('stone', 0.18, 0.22, 1.2, 8, x, baseY + 0.8, z)
      b.cylinder('stone', 0.55, 0.38, 0.2, 8, x, baseY + 1.48, z)
      b.addEmissive('lantern', LowPolyBuilder.cylinder(0.3, 0.3, 0.42, 6), { position: [x, baseY + 1.78, z] })
      b.cone('roofDark', 0.68, 0.35, 6, x, baseY + 2.15, z)
      b.sphere('gold', 0.08, 0, x, baseY + 2.38, z)
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
  }

  private buildDetailedIncenseAltar() {
    this.incenseBurner = new THREE.Group()
    const pos = MapLayout.LANDMARKS.INCENSE_BURNER.center
    this.incenseBurner.position.set(pos.x, pos.y, pos.z)

    // Lư hương low-poly: thân bát giác, miệng vàng, tro (cao hơn mặt vàng 3cm để không Z-fighting), 3 nén hương và đốm than phát sáng
    const b = new SlotBatch()
    b.cylinder('woodDark', 1.3, 0.95, 1.5, 8, 0, 0.9, 0)
    b.cylinder('gold', 1.38, 1.38, 0.12, 8, 0, 1.62, 0)
    b.cylinder('stone', 0.6, 0.8, 0.3, 8, 0, 0.15, 0)
    b.cylinder('stone', 1.1, 1.1, 0.05, 8, 0, 1.685, 0)
    for (let i = -1; i <= 1; i++) {
      b.cylinder('roofDark', 0.025, 0.025, 1.0, 5, i * 0.18, 2.1, 0)
      b.addEmissive('lantern', LowPolyBuilder.sphere(0.05, 0), { position: [i * 0.18, 2.6, 0] })
    }
    this.incenseBurner.add(b.build({ name: 'incense_burner' }))
    this.scene.add(this.incenseBurner)
  }

  private buildMeritAndFortuneStations() {
    // Hòm công đức (tọa độ từ MapLayout): thân gỗ tối, viền và khe tiền vàng
    this.meritBox = new THREE.Group()
    const meritPos = MapLayout.LANDMARKS.MERIT_BOX.center
    this.meritBox.position.set(meritPos.x, meritPos.y, meritPos.z)
    const m = new SlotBatch()
    m.box('woodDark', 1.5, 1.2, 1.05, 0, 0.6, 0)
    m.box('gold', 1.56, 0.08, 1.11, 0, 1.24, 0)
    m.box('gold', 0.5, 0.06, 0.04, 0, 1.0, 0.54)
    m.box('roofDark', 1.6, 0.08, 1.15, 0, 0.04, 0)
    this.meritBox.add(m.build({ name: 'merit_box' }))

    // Bảng tên 3D gắn mặt trước hòm công đức
    const meritPlaque = createStationPlaqueMesh('HÒM CÔNG ĐỨC', 1.2, 0.3)
    meritPlaque.position.set(0, 0.65, 0.54)
    this.meritBox.add(meritPlaque)

    this.scene.add(this.meritBox)

    // Bàn xóc quẻ (tọa độ từ MapLayout): mặt bàn gỗ, ống thẻ vàng, vài thẻ xăm
    this.fortuneTable = new THREE.Group()
    const fortunePos = MapLayout.LANDMARKS.FORTUNE_TABLE.center
    this.fortuneTable.position.set(fortunePos.x, fortunePos.y, fortunePos.z)
    const f = new SlotBatch()
    f.box('woodDark', 1.6, 1.15, 1.05, 0, 0.58, 0)
    f.box('wood', 1.7, 0.08, 1.15, 0, 1.19, 0)
    f.cylinder('gold', 0.26, 0.26, 0.7, 6, 0, 1.58, 0)
    for (let i = -1; i <= 1; i++) {
      f.box('wall', 0.04, 0.5, 0.02, i * 0.07, 2.1, 0)
    }
    this.fortuneTable.add(f.build({ name: 'fortune_table' }))

    // Bảng tên 3D gắn mặt trước bàn xem quẻ
    const fortunePlaque = createStationPlaqueMesh('BÀN XEM QUẺ', 1.25, 0.3)
    fortunePlaque.position.set(0, 0.65, 0.54)
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
    const isW = !inputLocked && (this.keysPressed['w'] || this.keysPressed['arrowup'])
    const isS = !inputLocked && (this.keysPressed['s'] || this.keysPressed['arrowdown'])
    const isA = !inputLocked && (this.keysPressed['a'] || this.keysPressed['arrowleft'])
    const isD = !inputLocked && (this.keysPressed['d'] || this.keysPressed['arrowright'])

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

    // Dynamic FOV (Góc nhìn nở rộng khi chạy nhanh như Minecraft Sprint FOV effect)
    this.targetFov = this.isSprinting && isMoving && !inputLocked ? 63 : 52
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, Math.min(delta * 9.0, 1.0))
    this.camera.updateProjectionMatrix()

    // 3. Di chuyển vật lý với Capsule Character Controller & Wall Sliding (Giai đoạn 1)
    if (isMoving) {
      const len = Math.hypot(moveX, moveZ)
      const nx = moveX / len
      const nz = moveZ / len
      const moveDir = new THREE.Vector3(nx, 0, nz)

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
      this.characterController.update(delta, new THREE.Vector3(), 0)

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
    const focusPoint = new THREE.Vector3(this.playerPos.x, targetY, this.playerPos.z)

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
      const backwardDir = new THREE.Vector3(-fwdX * cp, sp, -fwdZ * cp).normalize()
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

  private checkProximity() {
    let nearest: InteractionTarget = null
    const distIncense = this.playerPos.distanceTo(TempleStage.PROX_INCENSE)
    const distMerit = this.playerPos.distanceTo(TempleStage.PROX_MERIT)
    const distFortune = this.playerPos.distanceTo(TempleStage.PROX_FORTUNE)
    // Ban thờ Tam Bảo & Phật Thích Ca bên trong Chánh điện tại (0, 1.35, -13.5)
    const distBuddha = this.playerPos.distanceTo(TempleStage.PROX_BUDDHA)
    const distPond = this.playerPos.distanceTo(TempleStage.PROX_POND)
    const distDoor = this.playerPos.distanceTo(TempleStage.PROX_DOOR)
    const distHauDong = this.hauDongSanctuary
      ? Math.min(
          this.playerPos.distanceTo(this.hauDongSanctuary.centerWorldPos),
          this.playerPos.distanceTo(this.hauDongSanctuary.meritBoxWorldPos)
        )
      : Infinity

    if (distIncense < 2.6) nearest = 'incense'
    else if (distMerit < 2.4) nearest = 'merit_box'
    else if (distFortune < 2.4) nearest = 'fortune'
    else if (distHauDong < 5.2) nearest = 'hau_dong'
    else if (distDoor < 3.2 && (this.sanctuaryHall ? this.sanctuaryHall.doorAngle < 0.4 : false)) nearest = 'door'
    else if (distBuddha < 4.8) nearest = 'meditation'
    else if (distPond < 8.8) nearest = 'lantern'

    if (nearest !== this.currentNearTarget) {
      this.currentNearTarget = nearest
      if (this.onNearTarget) this.onNearTarget(nearest)
    }
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

    return {
      dx: dx / dist,
      dz: dz / dist,
      speed: this.autoWalk.speed
    }
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

    const path = HallLayout.computeWalkPath(this.playerPos.x, this.playerPos.z, slot.x, slot.z)
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
    const waypoints: Array<{ x: number; z: number }> = []

    if (this.playerPos.z > 4.0) {
      waypoints.push({ x: 0, z: 3.5 }) // Thềm Chánh Điện
      waypoints.push({ x: 0, z: 0.5 }) // Cửa chính
      waypoints.push(insideSpot) // Trong lòng điện
    } else if (this.playerPos.z > 0.6) {
      waypoints.push({ x: 0, z: 0.5 })
      waypoints.push(insideSpot)
    } else {
      waypoints.push(insideSpot)
    }

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

  /**
   * Dẫn đường nhân vật bước lại gần Bàn Xin Xăm & Pháp Bảo ngoài sân
   */
  public walkToFortuneTable(onArrive?: () => void, onAbort?: () => void) {
    this.cancelAutoWalk()
    this.standUpFromMeditation()

    const target = { x: -5.0, z: 11.4 }
    const waypoints: Array<{ x: number; z: number }> = []

    if (this.playerPos.z < 0.5 && Math.abs(this.playerPos.x) < 16.0) {
      // Đang trong Chánh Điện: mở cửa nếu đóng và đi ra sân
      if (this.sanctuaryHall && this.sanctuaryHall.doorAngle < 0.4) {
        this.sanctuaryHall.toggleDoor()
      }
      waypoints.push({ x: 0, z: -2.5 })
      waypoints.push({ x: 0, z: 0.5 })
      waypoints.push({ x: 0, z: 3.5 })
      waypoints.push({ x: -5.0, z: 6.5 })
      waypoints.push(target)
    } else {
      waypoints.push(target)
    }

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
    const waypoints: Array<{ x: number; z: number }> = []

    if (this.playerPos.z < 0.5 && Math.abs(this.playerPos.x) < 16.0) {
      // Đang trong Chánh Điện: mở cửa nếu đóng và đi ra sân
      if (this.sanctuaryHall && this.sanctuaryHall.doorAngle < 0.4) {
        this.sanctuaryHall.toggleDoor()
      }
      waypoints.push({ x: 0, z: -2.5 })
      waypoints.push({ x: 0, z: 0.5 })
      waypoints.push({ x: 0, z: 3.5 })
      waypoints.push({ x: 5.0, z: 6.5 })
      waypoints.push(target)
    } else {
      waypoints.push(target)
    }

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
    const waypoints: Array<{ x: number; z: number }> = []

    if (this.playerPos.z < 0.5 && this.playerPos.x < 17.0) {
      if (this.sanctuaryHall && this.sanctuaryHall.doorAngle < 0.4) {
        this.sanctuaryHall.toggleDoor()
      }
      waypoints.push({ x: 0, z: 0.5 })
      waypoints.push({ x: 0, z: 4.5 })
    }
    if (this.playerPos.x < 26.0 || this.playerPos.z > 2.5) {
      waypoints.push({ x: 20.0, z: 4.5 })
      waypoints.push({ x: 35.0, z: 3.5 })
      waypoints.push({ x: 35.0, z: -1.5 })
    }
    waypoints.push(target)

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

      const nameplate = createPilgrimNameplate(name, title, country)
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
      if (data.country && data.country.trim() !== '') {
        const nextCountry = data.country.split(':')[0] as PilgrimCountry
        if (remote.country !== nextCountry) {
          remote.country = nextCountry
          remote.avatar.setCountryStyle(remote.country)
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
      }
      if (data.title && data.title.trim() !== '' && remote.title !== data.title) {
        remote.title = data.title
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

  public triggerLocalEmote(action: 'standing' | 'walking' | 'bowing' | 'meditating') {
    if (this.avatar) {
      this.avatar.setAction(action)
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
