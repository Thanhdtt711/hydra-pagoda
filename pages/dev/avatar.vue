<template>
  <div class="relative w-screen h-screen overflow-hidden bg-canvas-dark font-sans select-none text-primary">
    <!-- 3D WebGL Canvas Container -->
    <div ref="canvasContainer" class="w-full h-full cursor-grab active:cursor-grabbing"></div>

    <!-- Top Navigation Bar -->
    <header class="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
      <div class="flex items-center space-x-3 pointer-events-auto bg-surface-card px-4 py-2 rounded-md border border-hairline shadow-md">
        <NuxtLink to="/" class="text-gold hover:text-gold/80 font-bold text-sm flex items-center gap-1.5 transition">
          <ZenIcon name="pagoda" :size="16" />
          <span>VẠN CẢNH THIỀN TỰ</span>
        </NuxtLink>
        <span class="text-secondary">/</span>
        <span class="text-xs font-semibold tracking-wider text-secondary uppercase font-numbers">Avatar Turntable Studio (Low-poly 7 đầu)</span>
      </div>

      <!-- Quick Camera Views -->
      <div class="flex items-center space-x-1.5 pointer-events-auto bg-surface-card p-1.5 rounded-md border border-hairline shadow-md text-xs font-numbers">
        <button
          @click="setCameraPreset('front')"
          :class="cameraPreset === 'front' ? 'bg-gold text-canvas-dark font-semibold' : 'hover:bg-surface-elevated text-secondary'"
          class="px-2.5 py-1.5 rounded transition"
        >
          Trực diện
        </button>
        <button
          @click="setCameraPreset('threeQuarterLeft')"
          :class="cameraPreset === 'threeQuarterLeft' ? 'bg-gold text-canvas-dark font-semibold' : 'hover:bg-surface-elevated text-secondary'"
          class="px-2.5 py-1.5 rounded transition"
        >
          3/4 Trái
        </button>
        <button
          @click="setCameraPreset('threeQuarterRight')"
          :class="cameraPreset === 'threeQuarterRight' ? 'bg-gold text-canvas-dark font-semibold' : 'hover:bg-surface-elevated text-secondary'"
          class="px-2.5 py-1.5 rounded transition"
        >
          3/4 Phải
        </button>
        <button
          @click="setCameraPreset('side')"
          :class="cameraPreset === 'side' ? 'bg-gold text-canvas-dark font-semibold' : 'hover:bg-surface-elevated text-secondary'"
          class="px-2.5 py-1.5 rounded transition"
        >
          Nghiêng
        </button>
        <button
          @click="setCameraPreset('back')"
          :class="cameraPreset === 'back' ? 'bg-gold text-canvas-dark font-semibold' : 'hover:bg-surface-elevated text-secondary'"
          class="px-2.5 py-1.5 rounded transition"
        >
          Phía sau
        </button>
        <button
          @click="setCameraPreset('face')"
          :class="cameraPreset === 'face' ? 'bg-gold text-canvas-dark font-semibold' : 'hover:bg-surface-elevated text-secondary'"
          class="px-2.5 py-1.5 rounded transition"
        >
          Cận mặt
        </button>
        <button
          @click="toggleTurntable"
          :class="autoRotate ? 'bg-trading-up text-canvas-dark font-semibold' : 'hover:bg-surface-elevated text-secondary'"
          class="px-2.5 py-1.5 rounded transition"
        >
          {{ autoRotate ? 'Dừng xoay' : 'Tự xoay' }}
        </button>
      </div>
    </header>

    <!-- Sidebar Control Panel -->
    <aside class="absolute left-4 top-20 bottom-4 w-80 bg-surface-card rounded-md border border-hairline shadow-xl p-4 flex flex-col gap-4 overflow-y-auto">
      <!-- 1. Quốc gia & Cổ phục -->
      <div>
        <h3 class="text-xs font-bold text-gold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ZenIcon name="pagoda" :size="14" />
          <span>1. Quốc Gia & Cổ Phục (9 Nước)</span>
        </h3>
        <div class="grid grid-cols-3 gap-1.5 text-xs">
          <button
            v-for="c in countries"
            :key="c.id"
            @click="selectCountry(c.id)"
            :class="selectedCountry === c.id ? 'bg-gold text-canvas-dark font-bold' : 'bg-surface-elevated hover:border-hairline text-secondary border border-transparent'"
            class="p-2 rounded text-center flex flex-col items-center gap-1 transition"
          >
            <span class="text-xs font-bold font-numbers">{{ c.code }}</span>
            <span class="truncate w-full text-xs">{{ c.name }}</span>
          </button>
        </div>
      </div>

      <!-- 2. Dáng Người (3 Body Shapes) -->
      <div>
        <h3 class="text-xs font-bold text-gold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ZenIcon name="users" :size="14" />
          <span>2. Vóc Dáng (Body Shape)</span>
        </h3>
        <div class="grid grid-cols-3 gap-1.5 text-xs">
          <button
            v-for="s in bodyShapes"
            :key="s.id"
            @click="selectBodyShape(s.id)"
            :class="selectedBodyShape === s.id ? 'bg-gold text-canvas-dark font-bold' : 'bg-surface-elevated text-secondary border border-transparent hover:border-hairline'"
            class="py-2 rounded text-center transition"
          >
            {{ s.name }}
          </button>
        </div>
      </div>

      <!-- 3. Hoạt Ảnh (Animations) -->
      <div>
        <h3 class="text-xs font-bold text-gold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ZenIcon name="lotus" :size="14" />
          <span>3. Hoạt Ảnh</span>
        </h3>
        <div class="grid grid-cols-2 gap-1.5 text-xs">
          <button
            v-for="a in animations"
            :key="a.id"
            @click="selectAnimation(a.id)"
            :class="selectedAnimation === a.id ? 'bg-gold text-canvas-dark font-bold' : 'bg-surface-elevated text-secondary border border-transparent hover:border-hairline'"
            class="py-2 px-3 rounded flex items-center justify-center gap-1.5 transition"
          >
            <ZenIcon :name="a.icon as any" :size="13" />
            <span>{{ a.name }}</span>
          </button>
        </div>
      </div>

      <!-- 4. Cấp Độ Chi Tiết (LOD Level) -->
      <div>
        <h3 class="text-xs font-bold text-gold uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <ZenIcon name="sparkles" :size="14" />
          <span>4. Cấp Độ Chi Tiết (LOD)</span>
        </h3>
        <div class="grid grid-cols-3 gap-1.5 text-xs font-numbers">
          <button
            v-for="lod in lodLevels"
            :key="lod.id"
            @click="selectLod(lod.id)"
            :class="selectedLod === lod.id ? 'bg-gold text-canvas-dark font-bold' : 'bg-surface-elevated text-secondary border border-transparent hover:border-hairline'"
            class="py-2 rounded text-center transition"
          >
            {{ lod.name }}
          </button>
        </div>
      </div>
    </aside>

    <!-- Bottom Info Panel -->
    <footer class="absolute bottom-4 right-4 pointer-events-none bg-surface-card px-4 py-2.5 rounded-md border border-hairline text-xs flex items-center gap-4 text-secondary font-numbers">
      <div>Tỷ lệ: <span class="text-gold">7 đầu (~1.75m)</span></div>
      <div>Khối: <span class="text-gold">6 bộ phận rigid, flat shading</span></div>
      <div>Tam giác: <span class="text-primary">{{ triangleInfo }}</span></div>
      <div>Vật liệu: <span class="text-primary">Lambert + vertex color</span></div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { LowPolyAvatarModel } from '../../lib/world3d/characters/LowPolyAvatarModel'
import type {
  AvatarAnimation,
  AvatarBodyShape,
  PilgrimCountry
} from '../../lib/world3d/characters/AvatarModel'
import { AvatarKit } from '../../lib/world3d/characters/AvatarKit'
import { LowPolyBuilder } from '../../lib/world3d/style/LowPolyBuilder'

const canvasContainer = ref<HTMLDivElement | null>(null)

const countries = [
  { id: 'vietnam' as PilgrimCountry, name: 'Việt Nam', code: 'VN' },
  { id: 'japan' as PilgrimCountry, name: 'Nhật Bản', code: 'JP' },
  { id: 'thailand' as PilgrimCountry, name: 'Thái Lan', code: 'TH' },
  { id: 'korea' as PilgrimCountry, name: 'Hàn Quốc', code: 'KR' },
  { id: 'taiwan' as PilgrimCountry, name: 'Đài Loan', code: 'TW' },
  { id: 'singapore' as PilgrimCountry, name: 'Singapore', code: 'SG' },
  { id: 'india' as PilgrimCountry, name: 'Ấn Độ', code: 'IN' },
  { id: 'tibet' as PilgrimCountry, name: 'Tây Tạng', code: 'TB' },
  { id: 'western' as PilgrimCountry, name: 'Làng Mai', code: 'WM' }
]

const bodyShapes = [
  { id: 'regular' as AvatarBodyShape, name: 'Cân đối' },
  { id: 'tall' as AvatarBodyShape, name: 'Cao thanh' },
  { id: 'chubby' as AvatarBodyShape, name: 'Mũm mĩm' }
]

const animations = [
  { id: 'idle' as AvatarAnimation, name: 'Đứng thở', icon: 'sparkles' },
  { id: 'walk' as AvatarAnimation, name: 'Đi bộ', icon: 'user' },
  { id: 'bow' as AvatarAnimation, name: 'Cúi lạy', icon: 'pagoda' },
  { id: 'meditate' as AvatarAnimation, name: 'Tọa thiền', icon: 'lotus' },
  { id: 'pray' as AvatarAnimation, name: 'Chắp tay', icon: 'lotus' },
  { id: 'wave' as AvatarAnimation, name: 'Vẫy tay', icon: 'sparkles' }
]

const lodLevels = [
  { id: 0, name: 'LOD0 (Gần)' },
  { id: 1, name: 'LOD1 (Trung)' },
  { id: 2, name: 'LOD2 (Xa)' }
]

const selectedCountry = ref<PilgrimCountry>('vietnam')
const selectedBodyShape = ref<AvatarBodyShape>('regular')
const selectedAnimation = ref<AvatarAnimation>('idle')
const selectedLod = ref<number>(0)
const cameraPreset = ref<'front' | 'threeQuarterLeft' | 'threeQuarterRight' | 'side' | 'back' | 'face' | 'full' | 'bust'>('front')
const autoRotate = ref(false)
const triangleInfo = ref('-')

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationFrameId: number

let avatarModel: LowPolyAvatarModel
let lod1Mesh: THREE.Mesh | null = null
let lod2Mesh: THREE.Mesh | null = null
const clock = new THREE.Clock()

onMounted(() => {
  if (!canvasContainer.value) return

  // 1. Scene & Camera
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0b0e11)

  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight
  camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
  camera.position.set(0, 1.2, 4.6)

  // 2. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.NoToneMapping
  canvasContainer.value.appendChild(renderer.domElement)

  // 3. OrbitControls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 0.9, 0)
  controls.autoRotate = autoRotate.value
  controls.autoRotateSpeed = 2.0
  controls.minDistance = 1.0
  controls.maxDistance = 10.0
  controls.maxPolarAngle = Math.PI / 2 + 0.05

  // 4. Studio Lighting matching Temple Atmosphere
  const keyLight = new THREE.DirectionalLight(0xfff6ea, 1.4)
  keyLight.position.set(2.5, 4.0, 3.0)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.width = 1024
  keyLight.shadow.mapSize.height = 1024
  keyLight.shadow.bias = -0.001
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x90c0ea, 0.6)
  fillLight.position.set(-3.0, 2.0, -1.0)
  scene.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0xfcd535, 0.8)
  rimLight.position.set(0, 2.5, -3.0)
  scene.add(rimLight)

  const hemiLight = new THREE.HemisphereLight(0xe8f0fe, 0x1e2329, 0.75)
  scene.add(hemiLight)

  // 5. Circular Granite Dais / Turntable Platform
  const daisGeo = new THREE.CylinderGeometry(0.9, 0.95, 0.08, 36)
  const daisMat = new THREE.MeshStandardMaterial({
    color: 0x1e2329,
    roughness: 0.6,
    metalness: 0.1
  })
  const dais = new THREE.Mesh(daisGeo, daisMat)
  dais.position.y = -0.04
  dais.receiveShadow = true
  scene.add(dais)

  const ringGeo = new THREE.TorusGeometry(0.92, 0.012, 8, 36)
  ringGeo.rotateX(Math.PI / 2)
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0xfcd535 }))
  ring.position.y = 0.001
  scene.add(ring)

  // 6. Spawn low-poly avatar (LOD0)
  avatarModel = new LowPolyAvatarModel(selectedCountry.value)
  scene.add(avatarModel.root)

  // 7. Create LOD1 and LOD2 models for inspection
  const kit = AvatarKit.getInstance()
  lod1Mesh = new THREE.Mesh(kit.getLod1Geometry(selectedCountry.value), kit.material)
  lod1Mesh.visible = false
  scene.add(lod1Mesh)

  lod2Mesh = new THREE.Mesh(kit.getLod2Geometry(selectedCountry.value), kit.material)
  lod2Mesh.visible = false
  scene.add(lod2Mesh)
  updateTriangleInfo()

  // Expose on window for automated headless test scripts
  ;(window as any).__TURNTABLE_STUDIO__ = {
    avatarModel,
    setCountry: selectCountry,
    setBodyShape: selectBodyShape,
    setAnimation: selectAnimation,
    setLod: selectLod,
    setCameraPreset
  }

  // Animation Loop
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate)
    const delta = clock.getDelta()

    controls.update()
    if (avatarModel && avatarModel.root.visible) {
      avatarModel.update(delta, selectedAnimation.value === 'walk', 4.8)
    }

    renderer.render(scene, camera)
  }
  animate()

  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (renderer) renderer.dispose()
  if (avatarModel) avatarModel.dispose()
})

function onResize() {
  if (!canvasContainer.value || !renderer || !camera) return
  const w = canvasContainer.value.clientWidth
  const h = canvasContainer.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

function updateTriangleInfo() {
  const mesh = selectedLod.value === 1 ? lod1Mesh : selectedLod.value === 2 ? lod2Mesh : null
  if (mesh) {
    triangleInfo.value = String(LowPolyBuilder.triangleCount(mesh.geometry))
  } else {
    triangleInfo.value = 'LOD0 (6 mesh)'
  }
}

function selectCountry(cId: PilgrimCountry) {
  selectedCountry.value = cId
  if (avatarModel) avatarModel.setCountry(cId)
  const kit = AvatarKit.getInstance()
  if (lod1Mesh) lod1Mesh.geometry = kit.getLod1Geometry(cId)
  if (lod2Mesh) lod2Mesh.geometry = kit.getLod2Geometry(cId)
  updateTriangleInfo()
}

function selectBodyShape(shape: AvatarBodyShape) {
  selectedBodyShape.value = shape
  if (avatarModel) avatarModel.setBodyShape(shape)
}

function selectAnimation(anim: AvatarAnimation) {
  selectedAnimation.value = anim
  if (avatarModel) avatarModel.play(anim)
}

function selectLod(level: number) {
  selectedLod.value = level
  if (avatarModel) avatarModel.root.visible = level === 0
  if (lod1Mesh) lod1Mesh.visible = level === 1
  if (lod2Mesh) lod2Mesh.visible = level === 2
  updateTriangleInfo()
}

function toggleTurntable() {
  autoRotate.value = !autoRotate.value
  if (controls) controls.autoRotate = autoRotate.value
}

function setCameraPreset(preset: 'front' | 'threeQuarterLeft' | 'threeQuarterRight' | 'side' | 'back' | 'face' | 'full' | 'bust') {
  cameraPreset.value = preset
  if (!controls || !camera) return

  if (preset === 'front' || preset === 'full') {
    camera.position.set(0, 1.2, 4.6)
    controls.target.set(0, 0.9, 0)
  } else if (preset === 'threeQuarterLeft') {
    camera.position.set(-3.0, 1.4, 3.6)
    controls.target.set(0, 0.9, 0)
  } else if (preset === 'threeQuarterRight') {
    camera.position.set(3.0, 1.4, 3.6)
    controls.target.set(0, 0.9, 0)
  } else if (preset === 'side') {
    camera.position.set(4.4, 1.2, 0.1)
    controls.target.set(0, 0.9, 0)
  } else if (preset === 'back') {
    camera.position.set(0, 1.3, -4.6)
    controls.target.set(0, 0.9, 0)
  } else if (preset === 'bust') {
    camera.position.set(0, 1.45, 2.2)
    controls.target.set(0, 1.35, 0)
  } else if (preset === 'face') {
    camera.position.set(0, 1.62, 1.3)
    controls.target.set(0, 1.6, 0)
  }
  controls.update()
}
</script>

<style scoped>
/* Subtle custom scrollbar */
aside::-webkit-scrollbar {
  width: 4px;
}
aside::-webkit-scrollbar-track {
  background: transparent;
}
aside::-webkit-scrollbar-thumb {
  background: var(--hairline-on-dark, #2b3139);
  border-radius: 9999px;
}
</style>
