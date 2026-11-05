<template>
  <div class="relative w-screen h-screen overflow-hidden bg-slate-900 font-sans select-none text-slate-100">
    <!-- 3D WebGL Canvas Container -->
    <div ref="canvasContainer" class="w-full h-full cursor-grab active:cursor-grabbing"></div>

    <!-- Top Navigation Bar -->
    <header class="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
      <div class="flex items-center space-x-3 pointer-events-auto bg-slate-800/80 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700 shadow-xl">
        <NuxtLink to="/" class="text-amber-400 hover:text-amber-300 font-bold text-sm flex items-center gap-1.5 transition">
          <span>⛩️</span>
          <span>VẠN CẢNH THIỀN TỰ</span>
        </NuxtLink>
        <span class="text-slate-500">/</span>
        <span class="text-xs font-semibold tracking-wider text-slate-300 uppercase">Avatar Turntable Studio (LOD0 Chibi)</span>
      </div>

      <!-- Quick Camera Views -->
      <div class="flex items-center space-x-1.5 pointer-events-auto bg-slate-800/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-700 shadow-xl text-xs">
        <button
          @click="setCameraPreset('front')"
          :class="cameraPreset === 'front' ? 'bg-amber-500 text-slate-900 font-bold' : 'hover:bg-slate-700 text-slate-300'"
          class="px-2.5 py-1.5 rounded-lg transition"
        >
          Trực diện
        </button>
        <button
          @click="setCameraPreset('threeQuarterLeft')"
          :class="cameraPreset === 'threeQuarterLeft' ? 'bg-amber-500 text-slate-900 font-bold' : 'hover:bg-slate-700 text-slate-300'"
          class="px-2.5 py-1.5 rounded-lg transition"
        >
          3/4 Trái
        </button>
        <button
          @click="setCameraPreset('threeQuarterRight')"
          :class="cameraPreset === 'threeQuarterRight' ? 'bg-amber-500 text-slate-900 font-bold' : 'hover:bg-slate-700 text-slate-300'"
          class="px-2.5 py-1.5 rounded-lg transition"
        >
          3/4 Phải
        </button>
        <button
          @click="setCameraPreset('side')"
          :class="cameraPreset === 'side' ? 'bg-amber-500 text-slate-900 font-bold' : 'hover:bg-slate-700 text-slate-300'"
          class="px-2.5 py-1.5 rounded-lg transition"
        >
          Nghiêng
        </button>
        <button
          @click="setCameraPreset('back')"
          :class="cameraPreset === 'back' ? 'bg-amber-500 text-slate-900 font-bold' : 'hover:bg-slate-700 text-slate-300'"
          class="px-2.5 py-1.5 rounded-lg transition"
        >
          Phía sau
        </button>
        <button
          @click="setCameraPreset('face')"
          :class="cameraPreset === 'face' ? 'bg-amber-500 text-slate-900 font-bold' : 'hover:bg-slate-700 text-slate-300'"
          class="px-2.5 py-1.5 rounded-lg transition"
        >
          Cận mặt
        </button>
        <button
          @click="toggleTurntable"
          :class="autoRotate ? 'bg-emerald-500 text-slate-900 font-bold' : 'hover:bg-slate-700 text-slate-300'"
          class="px-2.5 py-1.5 rounded-lg transition"
        >
          {{ autoRotate ? 'Dừng xoay' : 'Tự xoay' }}
        </button>
      </div>
    </header>

    <!-- Sidebar Control Panel -->
    <aside class="absolute left-4 top-20 bottom-4 w-80 bg-slate-800/85 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl p-4 flex flex-col gap-4 overflow-y-auto">
      <!-- 1. Quốc gia & Cổ phục -->
      <div>
        <h3 class="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>🌏</span>
          <span>1. Quốc Gia & Cổ Phục (9 Nước)</span>
        </h3>
        <div class="grid grid-cols-3 gap-1.5 text-xs">
          <button
            v-for="c in countries"
            :key="c.id"
            @click="selectCountry(c.id)"
            :class="selectedCountry === c.id ? 'bg-amber-500 text-slate-900 font-bold shadow' : 'bg-slate-700/70 hover:bg-slate-700 text-slate-200'"
            class="p-2 rounded-lg text-center flex flex-col items-center gap-1 transition"
          >
            <span class="text-base">{{ c.flag }}</span>
            <span class="truncate w-full">{{ c.name }}</span>
          </button>
        </div>
      </div>

      <!-- 2. Biểu Cảm Khuôn Mặt (4 Biểu Cảm Chibi) -->
      <div>
        <h3 class="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>😊</span>
          <span>2. Biểu Cảm Khuôn Mặt (Atlas)</span>
        </h3>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <button
            v-for="exp in expressions"
            :key="exp.id"
            @click="selectExpression(exp.id)"
            :class="selectedExpression === exp.id ? 'bg-amber-500 text-slate-900 font-bold' : 'bg-slate-700/70 hover:bg-slate-700 text-slate-200'"
            class="py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition"
          >
            <span>{{ exp.icon }}</span>
            <span>{{ exp.name }}</span>
          </button>
        </div>
      </div>

      <!-- 3. Dáng Người (3 Body Shapes) -->
      <div>
        <h3 class="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>🧍</span>
          <span>3. Vóc Dáng (Body Shape)</span>
        </h3>
        <div class="grid grid-cols-3 gap-1.5 text-xs">
          <button
            v-for="s in bodyShapes"
            :key="s.id"
            @click="selectBodyShape(s.id)"
            :class="selectedBodyShape === s.id ? 'bg-amber-500 text-slate-900 font-bold' : 'bg-slate-700/70 hover:bg-slate-700 text-slate-200'"
            class="py-2 rounded-lg text-center transition"
          >
            {{ s.name }}
          </button>
        </div>
      </div>

      <!-- 4. Hoạt Ảnh (Animations) -->
      <div>
        <h3 class="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>🏃</span>
          <span>4. Hoạt Ảnh Hoạt Hình</span>
        </h3>
        <div class="grid grid-cols-2 gap-1.5 text-xs">
          <button
            v-for="a in animations"
            :key="a.id"
            @click="selectAnimation(a.id)"
            :class="selectedAnimation === a.id ? 'bg-amber-500 text-slate-900 font-bold' : 'bg-slate-700/70 hover:bg-slate-700 text-slate-200'"
            class="py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition"
          >
            <span>{{ a.icon }}</span>
            <span>{{ a.name }}</span>
          </button>
        </div>
      </div>

      <!-- 5. Cấp Độ Chi Tiết (LOD Level) -->
      <div>
        <h3 class="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>📊</span>
          <span>5. Cấp Độ Chi Tiết (LOD)</span>
        </h3>
        <div class="grid grid-cols-3 gap-1.5 text-xs">
          <button
            v-for="lod in lodLevels"
            :key="lod.id"
            @click="selectLod(lod.id)"
            :class="selectedLod === lod.id ? 'bg-amber-500 text-slate-900 font-bold' : 'bg-slate-700/70 hover:bg-slate-700 text-slate-200'"
            class="py-2 rounded-lg text-center transition"
          >
            {{ lod.name }}
          </button>
        </div>
      </div>
    </aside>

    <!-- Bottom Info Panel -->
    <footer class="absolute bottom-4 right-4 pointer-events-none bg-slate-800/80 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-700 text-xs flex items-center gap-4 text-slate-300">
      <div>Đầu: <span class="text-amber-400 font-mono">Ellipsoid 0.24m</span></div>
      <div>Tỷ lệ: <span class="text-amber-400 font-mono">3.8 đầu (~1.30m)</span></div>
      <div>Khối: <span class="text-emerald-400 font-mono">Capsule + Lathe + Sphere (Bo tròn 100%)</span></div>
      <div>Vật liệu: <span class="text-sky-400 font-mono">MeshToonMaterial (3-Tone Cel)</span></div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  ProceduralAvatarModel
} from '../../lib/world3d/characters/ProceduralAvatarModel'
import type {
  AvatarExpression,
  AvatarAnimation,
  AvatarBodyShape,
  PilgrimCountry
} from '../../lib/world3d/characters/AvatarModel'
import { AvatarKit } from '../../lib/world3d/characters/AvatarKit'

const canvasContainer = ref<HTMLDivElement | null>(null)

const countries = [
  { id: 'vietnam' as PilgrimCountry, name: 'Việt Nam', flag: '🇻🇳' },
  { id: 'japan' as PilgrimCountry, name: 'Nhật Bản', flag: '🇯🇵' },
  { id: 'thailand' as PilgrimCountry, name: 'Thái Lan', flag: '🇹🇭' },
  { id: 'korea' as PilgrimCountry, name: 'Hàn Quốc', flag: '🇰🇷' },
  { id: 'taiwan' as PilgrimCountry, name: 'Đài Loan', flag: '🇹🇼' },
  { id: 'singapore' as PilgrimCountry, name: 'Singapore', flag: '🇸🇬' },
  { id: 'india' as PilgrimCountry, name: 'Ấn Độ', flag: '🇮🇳' },
  { id: 'tibet' as PilgrimCountry, name: 'Tây Tạng', flag: '🏔️' },
  { id: 'western' as PilgrimCountry, name: 'Làng Mai', flag: '🌿' }
]

const expressions = [
  { id: 'serene' as AvatarExpression, name: 'Bình thản', icon: '✨' },
  { id: 'smile' as AvatarExpression, name: 'Cười nhẹ', icon: '😄' },
  { id: 'meditating' as AvatarExpression, name: 'Thiền định', icon: '🧘' },
  { id: 'surprised' as AvatarExpression, name: 'Ngạc nhiên', icon: '😲' }
]

const bodyShapes = [
  { id: 'regular' as AvatarBodyShape, name: 'Cân đối' },
  { id: 'tall' as AvatarBodyShape, name: 'Cao thanh' },
  { id: 'chubby' as AvatarBodyShape, name: 'Mũm mĩm' }
]

const animations = [
  { id: 'idle' as AvatarAnimation, name: 'Đứng thở', icon: '🍃' },
  { id: 'walk' as AvatarAnimation, name: 'Đi bộ', icon: '🚶' },
  { id: 'bow' as AvatarAnimation, name: 'Cúi lạy', icon: '🙏' },
  { id: 'meditate' as AvatarAnimation, name: 'Tọa thiền', icon: '🧘' },
  { id: 'wave' as AvatarAnimation, name: 'Vẫy tay', icon: '👋' }
]

const lodLevels = [
  { id: 0, name: 'LOD0 (Gần)' },
  { id: 1, name: 'LOD1 (Trung)' },
  { id: 2, name: 'LOD2 (Xa)' }
]

const selectedCountry = ref<PilgrimCountry>('vietnam')
const selectedExpression = ref<AvatarExpression>('serene')
const selectedBodyShape = ref<AvatarBodyShape>('regular')
const selectedAnimation = ref<AvatarAnimation>('idle')
const selectedLod = ref<number>(0)
const cameraPreset = ref<'front' | 'threeQuarterLeft' | 'threeQuarterRight' | 'side' | 'back' | 'face' | 'full' | 'bust'>('front')
const autoRotate = ref(false)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationFrameId: number

let avatarModel: ProceduralAvatarModel
let lod1Mesh: THREE.Mesh | null = null
let lod2Mesh: THREE.Mesh | null = null
const clock = new THREE.Clock()

onMounted(() => {
  if (!canvasContainer.value) return

  // 1. Scene & Camera
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a2130)

  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight
  camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
  camera.position.set(0, 0.95, 2.8)

  // 2. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  canvasContainer.value.appendChild(renderer.domElement)

  // 3. OrbitControls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 0.65, 0)
  controls.autoRotate = autoRotate.value
  controls.autoRotateSpeed = 2.0
  controls.minDistance = 0.6
  controls.maxDistance = 6.0
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

  const rimLight = new THREE.DirectionalLight(0xffbe0b, 0.8)
  rimLight.position.set(0, 2.5, -3.0)
  scene.add(rimLight)

  const hemiLight = new THREE.HemisphereLight(0xe8f0fe, 0x2d3748, 0.75)
  scene.add(hemiLight)

  // 5. Circular Granite Dais / Turntable Platform
  const daisGeo = new THREE.CylinderGeometry(0.9, 0.95, 0.08, 36)
  const daisMat = new THREE.MeshStandardMaterial({
    color: 0x2b3547,
    roughness: 0.6,
    metalness: 0.1
  })
  const dais = new THREE.Mesh(daisGeo, daisMat)
  dais.position.y = -0.04
  dais.receiveShadow = true
  scene.add(dais)

  const ringGeo = new THREE.TorusGeometry(0.92, 0.012, 8, 36)
  ringGeo.rotateX(Math.PI / 2)
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0xd4af37 }))
  ring.position.y = 0.001
  scene.add(ring)

  // 6. Spawn Procedural Chibi Avatar (LOD0)
  avatarModel = new ProceduralAvatarModel(selectedCountry.value)
  scene.add(avatarModel.root)

  // 7. Create LOD1 and LOD2 models for inspection
  const kit = AvatarKit.getInstance()
  lod1Mesh = new THREE.Mesh(kit.lod1Geometry, kit.lod1Material)
  lod1Mesh.visible = false
  scene.add(lod1Mesh)

  lod2Mesh = new THREE.Mesh(kit.lod2Geometry, kit.lod2Material)
  lod2Mesh.visible = false
  scene.add(lod2Mesh)

  // Expose on window for automated headless test scripts
  ;(window as any).__TURNTABLE_STUDIO__ = {
    avatarModel,
    setCountry: selectCountry,
    setExpression: selectExpression,
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

function selectCountry(cId: PilgrimCountry) {
  selectedCountry.value = cId
  if (avatarModel) avatarModel.setCountry(cId)
}

function selectExpression(exp: AvatarExpression) {
  selectedExpression.value = exp
  if (avatarModel) avatarModel.setExpression(exp)
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
}

function toggleTurntable() {
  autoRotate.value = !autoRotate.value
  if (controls) controls.autoRotate = autoRotate.value
}

function setCameraPreset(preset: 'front' | 'threeQuarterLeft' | 'threeQuarterRight' | 'side' | 'back' | 'face' | 'full' | 'bust') {
  cameraPreset.value = preset
  if (!controls || !camera) return

  if (preset === 'front' || preset === 'full') {
    camera.position.set(0, 0.78, 2.5)
    controls.target.set(0, 0.65, 0)
  } else if (preset === 'threeQuarterLeft') {
    camera.position.set(-1.6, 0.85, 2.0)
    controls.target.set(0, 0.65, 0)
  } else if (preset === 'threeQuarterRight') {
    camera.position.set(1.6, 0.85, 2.0)
    controls.target.set(0, 0.65, 0)
  } else if (preset === 'side') {
    camera.position.set(2.4, 0.85, 0.1)
    controls.target.set(0, 0.65, 0)
  } else if (preset === 'back') {
    camera.position.set(0, 0.85, -2.5)
    controls.target.set(0, 0.65, 0)
  } else if (preset === 'bust') {
    camera.position.set(0, 0.86, 1.45)
    controls.target.set(0, 0.72, 0)
  } else if (preset === 'face') {
    camera.position.set(0, 0.98, 0.95)
    controls.target.set(0, 0.92, 0)
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
  background: rgba(148, 163, 184, 0.3);
  border-radius: 9999px;
}
</style>
