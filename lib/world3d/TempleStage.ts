import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { PilgrimAvatar, type PilgrimCountry } from './PilgrimAvatar'
import { createPilgrimNameplate, createSpeechBubbleSprite } from './NameplateHelper'
import type { PilgrimPresence } from '../network/MultiplayerClient'
import { CollisionWorld, CharacterController, CameraSpringArm, BoxCollider, CylinderCollider } from './collision'
import { PagodaSanctuaryHall } from './sanctuary/PagodaSanctuary'
import { PBRMaterialFactory } from './materials/PBRMaterialFactory'
import { AtmosphereManager, type TimeOfDayMode } from './environment/AtmosphereManager'
import { LightingConfig } from './environment/LightingConfig'
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
import { HallLayout } from './world/HallLayout'
import { TerrainSystem } from './world/TerrainSystem'
import { AvatarCrowd } from './characters/AvatarCrowd'
import { PerformanceProfiler } from './debug/PerformanceProfiler'
import { SeededPRNG } from './utils/SeededPRNG'

export type InteractionTarget = 'incense' | 'merit_box' | 'fortune' | 'meditation' | 'lantern' | 'door' | null

export interface RemotePilgrimInstance {
  id: string
  name: string
  title: string
  country: PilgrimCountry
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
// PROCEDURAL HIGH-RES TEXTURE GENERATORS
// ==========================================
function createRoofTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Ngói âm dương cổ truyền màu đất nung trầm phong hóa (Weathered Terracotta)
  ctx.fillStyle = '#2f1418'
  ctx.fillRect(0, 0, 512, 512)

  for (let y = 0; y < 512; y += 18) {
    ctx.fillStyle = y % 36 === 0 ? '#240e12' : '#3d1b21'
    ctx.fillRect(0, y, 512, 16)

    // Khắc rãnh ngói cong
    ctx.strokeStyle = '#18080a'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    for (let x = 0; x < 512; x += 28) {
      ctx.arc(x + 14, y + 9, 12, 0, Math.PI)
    }
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)
  return texture
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
  public materials!: PBRMaterialFactory
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

  private skyUniforms = {
    topColor: { value: new THREE.Color(0x1d63b8) },
    horizonColor: { value: new THREE.Color(0x8cc4ed) },
    bottomColor: { value: new THREE.Color(0xb2d2ec) }
  }
  private hemiLight!: THREE.HemisphereLight
  private keyLight!: THREE.DirectionalLight
  private rimLight!: THREE.DirectionalLight
  private lanternChamberMats: THREE.MeshStandardMaterial[] = []
  private lanternLights: THREE.PointLight[] = []

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

  // Props & Interactables & Giai đoạn 4: Kiến trúc & Thiên nhiên
  public incenseBurner!: THREE.Group
  public meritBox!: THREE.Group
  public fortuneTable!: THREE.Group
  public buddhaStatue!: THREE.Group
  public lotusPond!: THREE.Group
  public sanctuaryHall!: PagodaSanctuaryHall
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
  private flickerLights: THREE.PointLight[] = []
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
    this.scene.background = new THREE.Color(0x130e17)
    this.scene.fog = new THREE.Fog(0x18131d, 18, 95)

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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = LightingConfig.getPreset('day').exposure.outdoor
    this.container.appendChild(this.renderer.domElement)

    // Giai đoạn 3: PBR Materials Factory & Cinematic Post-Processing Pipeline
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy()
    this.materials = new PBRMaterialFactory(maxAniso)
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
      ;(window as any).__TEMPLE_STAGE__ = this
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
  }

  private onMouseMove = (e: MouseEvent) => {
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
      if (this.onRightClick) {
        this.onRightClick(this.currentNearTarget)
      }
    }
  }

  private onMouseUp = () => {
    this.isMouseDown = false
  }

  private onContextMenu = (e: MouseEvent) => {
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
    canvas.addEventListener('contextmenu', this.onContextMenu)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  public requestPointerLock() {
    try {
      const canvas = this.renderer.domElement
      if (canvas && !this.isPointerLocked) {
        canvas.requestPointerLock()
      }
    } catch (_) {}
  }

  public exitPointerLock() {
    try {
      if (document.exitPointerLock && document.pointerLockElement) {
        document.exitPointerLock()
      }
    } catch (_) {}
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

    // Phím Space: Nhảy Minecraft qua Character Controller (khi đang chạm đất/sàn)
    if (e.code === 'Space' || e.key === ' ') {
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

    // Ánh hào quang Phật điện dịu nhẹ, ấm áp, trang nghiêm
    const altarLight = new THREE.PointLight(0xff9f1a, 0.75, 11, 1.8)
    altarLight.position.set(0, 4.8, -7.5)
    this.scene.add(altarLight)
  }

  private buildGroundWithLanternLightPools() {
    // 1. Hệ thống địa hình đồi núi & mở rộng ~400x400m (TerrainSystem 36 chunks)
    this.terrainSystem = new TerrainSystem(this.materials)
    this.scene.add(this.terrainSystem.root)

    // 2. Sân lát đá cổ gọt vuông vát cạnh (PBR Flagstone Pavement with Normal, Roughness, AO maps)
    const courtyardGeo = new THREE.BoxGeometry(46, 0.22, 50)
    const courtyardMat = this.materials ? this.materials.createStonePavementMaterial() : new THREE.MeshStandardMaterial({ roughness: 0.72 })
    const courtyard = new THREE.Mesh(courtyardGeo, courtyardMat)
    courtyard.position.set(0, 0.08, 3)
    courtyard.receiveShadow = true
    this.scene.add(courtyard)

    // Bó vỉa đá xám viền quanh sân (PBR Granite)
    const curbMat = this.materials ? this.materials.createGraniteStepMaterial() : new THREE.MeshStandardMaterial({ color: 0x32353b, roughness: 0.85 })
    const curbNorth = new THREE.Mesh(new THREE.BoxGeometry(46.4, 0.3, 0.4), curbMat)
    curbNorth.position.set(0, 0.15, -22)
    this.scene.add(curbNorth)

    const curbSouth = new THREE.Mesh(new THREE.BoxGeometry(46.4, 0.3, 0.4), curbMat)
    curbSouth.position.set(0, 0.15, 28)
    this.scene.add(curbSouth)

    // 3. Ngự đạo lát đá xanh dẫn vào Chánh điện
    const pathGeo = new THREE.BoxGeometry(5.6, 0.12, 32)
    const pathMat = this.materials ? this.materials.createGraniteStepMaterial() : new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.6 })
    const path = new THREE.Mesh(pathGeo, pathMat)
    path.position.set(0, 0.24, 7)
    path.receiveShadow = true
    this.scene.add(path)

    // 4. Hàng Đèn Đá Cổ Tự (Tōrō / Đèn Đá Á Đông chạm khắc từ MapLayout)
    const lanternCoords = MapLayout.LANTERN_COORDINATES

    const stoneLanternMat = new THREE.MeshStandardMaterial({ color: 0x484b50, roughness: 0.85 })
    const woodRoofMat = new THREE.MeshStandardMaterial({ color: 0x2d1810, roughness: 0.7 })

    lanternCoords.forEach(([x, z]) => {
      const lantern = new THREE.Group()
      lantern.position.set(x, 0.2, z)

      // Đế đá bát giác
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.25, 8), stoneLanternMat)
      base.position.y = 0.12
      base.castShadow = true
      lantern.add(base)

      // Thân trụ đá
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.2, 8), stoneLanternMat)
      col.position.y = 0.8
      col.castShadow = true
      lantern.add(col)

      // Bệ đỡ buồng lửa (Chūdai)
      const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.38, 0.2, 8), stoneLanternMat)
      platform.position.y = 1.48
      lantern.add(platform)

      // Buồng đèn đá phát sáng (Hibukuro) - Êm ái, thanh tịnh, ban ngày là đá giấy dó tự nhiên
      const chamberMat = new THREE.MeshStandardMaterial({
        color: 0xe8d0a9,
        emissive: 0xd35400,
        emissiveIntensity: LightingConfig.getPreset('day').lanterns.emissiveIntensity,
        roughness: 0.75
      })
      this.lanternChamberMats.push(chamberMat)

      const lightChamber = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.42, 6),
        chamberMat
      )
      lightChamber.position.y = 1.78
      lantern.add(lightChamber)

      // Mái nón che mưa đá 6 cạnh
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.35, 6), woodRoofMat)
      cap.position.y = 2.15
      cap.castShadow = true
      lantern.add(cap)

      // Đỉnh chóp ngọc
      const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), stoneLanternMat)
      jewel.position.y = 2.38
      lantern.add(jewel)

      this.scene.add(lantern)

      // Nguồn sáng ấm điểm xuyết cho sân chùa (Vừa phải, không chói chang)
      const pLight = new THREE.PointLight(0xffbe55, 0.25, 6.0, 1.8)
      pLight.position.set(x, 2.0, z)
      this.scene.add(pLight)
      this.flickerLights.push(pLight)
      this.lanternLights.push(pLight)
    })
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

    // 1. Mặt sân chùa lát đá (Walkable Ground)
    this.collisionWorld.add(
      new BoxCollider('ground_courtyard', new THREE.Vector3(0, 0.04, 3), new THREE.Vector3(48, 0.2, 52), true)
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
    // Khởi tạo Đại Hùng Bảo Điện 40x30m (1.200 m² sàn thông thủy, 500 đệm thiền, mái cong đầu đao)
    this.sanctuaryHall = new PagodaSanctuaryHall(this.materials, this.collisionWorld)
    this.scene.add(this.sanctuaryHall.group)
    this.buddhaStatue = this.sanctuaryHall.buddhaGroup
    this.mandalaHalo = this.sanctuaryHall.mandalaHalo
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
    this.bellTowerInstance = new BellTower(this.materials, this.collisionWorld)
    this.scene.add(this.bellTowerInstance.root)

    // 2. Hồ Sen Sống Động, Mặt Nước Shader & Cầu Đá Vòm Cong (Giai đoạn 4)
    this.lotusPondInstance = new LotusPond(this.materials, this.collisionWorld)
    this.lotusPond = this.lotusPondInstance.root
    this.scene.add(this.lotusPondInstance.root)

    // Đưa đèn hoa đăng nổi hồ sen vào danh sách chớp nháy vi mô
    this.lotusPondInstance.floatingLanterns.forEach((lantern) => {
      lantern.traverse((child) => {
        if ((child as THREE.PointLight).isPointLight) {
          this.flickerLights.push(child as THREE.PointLight)
        }
      })
    })

    // 3. Cổng Tam Quan Cổ Kính 3 lối đi (Trung/Giả/Không Quan - Giai đoạn 4)
    this.tamQuanGateInstance = new TamQuanGate(this.materials, this.collisionWorld)
    this.scene.add(this.tamQuanGateInstance.root)

    // 4. Thảm Cỏ Tự Nhiên Lay Động Gió (Instanced Wind Grass - Giai đoạn 4)
    this.windGrassInstance = new WindGrass()
    this.scene.add(this.windGrassInstance.mesh)
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

    const urn = new THREE.Mesh(
      new THREE.CylinderGeometry(1.3, 0.95, 1.5, 24),
      this.materials ? this.materials.createAntiqueBronzeMaterial() : new THREE.MeshStandardMaterial({ color: 0x4a3c2c, roughness: 0.35, metalness: 0.82 })
    )
    urn.position.y = 0.9
    urn.castShadow = true
    this.incenseBurner.add(urn)

    // Than hồng & 3 nén hương
    const ash = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 24),
      new THREE.MeshStandardMaterial({ color: 0x2f3542, emissive: 0xff3838, emissiveIntensity: 0.4 })
    )
    ash.rotation.x = -Math.PI / 2
    ash.position.y = 1.66
    this.incenseBurner.add(ash)

    for (let i = -1; i <= 1; i++) {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x922b21 })
      )
      stick.position.set(i * 0.18, 2.1, 0)
      this.incenseBurner.add(stick)

      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3838 })
      )
      ember.position.set(i * 0.18, 2.6, 0)
      this.incenseBurner.add(ember)
    }

    this.scene.add(this.incenseBurner)
  }

  private buildMeritAndFortuneStations() {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d1c14, roughness: 0.45, metalness: 0.15 })
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.85, roughness: 0.2 })

    // Hòm công đức (Tọa độ từ MapLayout)
    this.meritBox = new THREE.Group()
    const meritPos = MapLayout.LANDMARKS.MERIT_BOX.center
    this.meritBox.position.set(meritPos.x, meritPos.y, meritPos.z)
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.05), woodMat)
    box.position.y = 0.6
    box.castShadow = true
    this.meritBox.add(box)
    const border = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.08, 1.07), goldMat)
    border.position.y = 1.22
    this.meritBox.add(border)
    this.scene.add(this.meritBox)

    // Bàn xóc quẻ (Tọa độ từ MapLayout)
    this.fortuneTable = new THREE.Group()
    const fortunePos = MapLayout.LANDMARKS.FORTUNE_TABLE.center
    this.fortuneTable.position.set(fortunePos.x, fortunePos.y, fortunePos.z)
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.15, 1.05), woodMat)
    table.position.y = 0.58
    table.castShadow = true
    this.fortuneTable.add(table)
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.7, 16), goldMat)
    tube.position.set(0, 1.45, 0)
    this.fortuneTable.add(tube)
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
    this.applyCountryAtmosphere(countryId)
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

    const cfg = LightingConfig.getPreset(mode)
    this.lanternChamberMats.forEach((m) => {
      m.emissiveIntensity = cfg.lanterns.emissiveIntensity
    })
    this.lanternLights.forEach((l) => {
      l.intensity = cfg.lanterns.pointLightIntensity
    })
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

    const isW = this.keysPressed['w'] || this.keysPressed['arrowup']
    const isS = this.keysPressed['s'] || this.keysPressed['arrowdown']
    const isA = this.keysPressed['a'] || this.keysPressed['arrowleft']
    const isD = this.keysPressed['d'] || this.keysPressed['arrowright']

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

    const isMoving = moveX !== 0 || moveZ !== 0
    const isMovingForward = isW && !isS

    // Tốc độ di chuyển chuẩn Minecraft: Sneak (chậm) | Walk (bình thường) | Sprint (chạy nhanh)
    let currentSpeed = 4.8
    if (this.isSneaking) {
      currentSpeed = 2.1
    } else if (this.isSprinting && isMovingForward) {
      currentSpeed = 7.4
    } else {
      this.isSprinting = false
    }

    // Dynamic FOV (Góc nhìn nở rộng khi chạy nhanh như Minecraft Sprint FOV effect)
    this.targetFov = this.isSprinting && isMoving ? 63 : 52
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov, Math.min(delta * 9.0, 1.0))
    this.camera.updateProjectionMatrix()

    // 3. Di chuyển vật lý với Capsule Character Controller & Wall Sliding (Giai đoạn 1)
    if (isMoving) {
      const len = Math.hypot(moveX, moveZ)
      const nx = moveX / len
      const nz = moveZ / len
      const moveDir = new THREE.Vector3(nx, 0, nz)

      this.characterController.isSneaking = this.isSneaking
      this.characterController.isSprinting = this.isSprinting
      this.characterController.update(delta, moveDir, currentSpeed)

      // Xoay nhân vật hướng về phía đang bước đi (ở TPP)
      const targetFacing = Math.atan2(nx, nz)
      let diff = targetFacing - this.playerFacingAngle
      while (diff < -Math.PI) diff += Math.PI * 2
      while (diff > Math.PI) diff -= Math.PI * 2
      this.playerFacingAngle += diff * Math.min(delta * 16, 1.0)
      this.player.rotation.y = this.playerFacingAngle
    } else {
      this.characterController.isSneaking = this.isSneaking
      this.characterController.isSprinting = this.isSprinting
      this.characterController.update(delta, new THREE.Vector3(), 0)

      if (this.cameraMode === 'fpp') {
        // Ở góc nhìn thứ nhất FPP, cơ thể luôn hướng theo Yaw của Camera
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

    const eyeHeight = this.isSneaking ? 0.95 : 1.20
    const targetY = this.playerPos.y + (this.isSneaking ? 0.75 : 0.95)
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

    if (distIncense < 2.6) nearest = 'incense'
    else if (distMerit < 2.4) nearest = 'merit_box'
    else if (distFortune < 2.4) nearest = 'fortune'
    else if (distDoor < 3.2 && (this.sanctuaryHall ? this.sanctuaryHall.doorAngle < 0.4 : false)) nearest = 'door'
    else if (distBuddha < 4.8) nearest = 'meditation'
    else if (distPond < 8.8) nearest = 'lantern'

    if (nearest !== this.currentNearTarget) {
      this.currentNearTarget = nearest
      if (this.onNearTarget) this.onNearTarget(nearest)
    }
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

  private updateVFX(delta: number, elapsed: number) {
    // Cập nhật Chánh điện rỗng: Cửa bức bàn, hào quang, nến, khói hương nội thất, ánh sáng chuyển tiếp (Giai đoạn 2)
    if (this.sanctuaryHall) {
      this.sanctuaryHall.update(delta, elapsed, this.playerPos)

      // Chuyển cảnh ánh sáng mượt (Smooth interior exposure & illumination transition)
      const interiorF = this.sanctuaryHall.interiorFactor
      const cfg = LightingConfig.getPreset(this.timeOfDay)

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

    // Đèn lồng sân chùa: ban ngày tắt hẳn (0.0), hoàng hôn/đêm thắp nến ấm áp
    const cfg = LightingConfig.getPreset(this.timeOfDay)
    const pIntensity = cfg.lanterns.pointLightIntensity
    if (pIntensity > 0) {
      this.flickerLights.forEach((light, i) => {
        light.intensity = pIntensity + Math.sin(elapsed * 5.0 + i * 2.1) * 0.04
      })
    } else {
      this.flickerLights.forEach((light) => {
        light.intensity = 0.0
      })
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
      const country = (data.country && data.country.trim() !== '' ? data.country : 'vietnam') as PilgrimCountry
      const name = data.name && data.name.trim() !== '' ? data.name : `Đồng tu ${data.id.slice(0, 6)}`
      const title = data.title && data.title.trim() !== '' ? data.title : 'Hành Giả'

      const avatar = new PilgrimAvatar()
      avatar.setCountryStyle(country)

      const nameplate = createPilgrimNameplate(name, title, country)
      nameplate.position.set(0, 1.70, 0)
      avatar.root.add(nameplate)

      avatar.root.position.set(data.position[0], data.position[1], data.position[2])
      avatar.root.rotation.y = data.yaw || 0
      this.scene.add(avatar.root)

      remote = {
        id: data.id,
        name,
        title,
        country,
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
      if (data.country && data.country.trim() !== '' && remote.country !== data.country) {
        remote.country = data.country as PilgrimCountry
        remote.avatar.setCountryStyle(remote.country)
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
        ;(remote.speechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
        remote.speechBubble.material?.dispose()
        remote.speechBubble = null
      }
      if (remote.nameplate) {
        remote.avatar.root.remove(remote.nameplate)
        ;(remote.nameplate.material as THREE.SpriteMaterial)?.map?.dispose()
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
        ;(this.localSpeechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
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
          ;(this.localSpeechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
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
          ;(remote.speechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
          remote.speechBubble.material?.dispose()
          remote.speechBubble = null
        }
        const bubble = createSpeechBubbleSprite(text)
        bubble.position.set(0, 2.05, 0)
        remote.avatar.root.add(bubble)
        remote.speechBubble = bubble
        remote.bubbleTimer = setTimeout(() => {
          if (remote.speechBubble) {
            remote.avatar.root.remove(remote.speechBubble)
            ;(remote.speechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
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
    console.assert(slots.length >= 500, `[Phase 6 Assert] HallLayout meditation slots >= 500, got ${slots.length}`)

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
      const shouldMeditate = count >= 500 ? i < 500 : i < Math.floor(count * 0.5)
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
    if (this.materials) {
      const aniso = quality === 'ultra' ? 16 : quality === 'high' ? 8 : quality === 'medium' ? 4 : 2
      this.materials.setMaxAnisotropy(aniso)
    }
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
      canvas.removeEventListener('contextmenu', this.onContextMenu)
      canvas.removeEventListener('wheel', this.onWheel)
    }
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)

    // 2. Dọn dẹp local speech bubble & avatar
    if (this.localBubbleTimer) clearTimeout(this.localBubbleTimer)
    if (this.localSpeechBubble) {
      this.player.remove(this.localSpeechBubble)
      ;(this.localSpeechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
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
        ;(remote.speechBubble.material as THREE.SpriteMaterial)?.map?.dispose()
        remote.speechBubble.material?.dispose()
      }
      if (remote.nameplate) {
        remote.avatar.root.remove(remote.nameplate)
        ;(remote.nameplate.material as THREE.SpriteMaterial)?.map?.dispose()
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
    if (this.materials) {
      this.materials.dispose()
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
