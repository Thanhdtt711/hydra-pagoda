import * as THREE from 'three'
import { CollisionWorld, BoxCollider } from '../collision'
import { MapLayout } from '../world/MapLayout'
import { LowPolyBuilder } from '../style/LowPolyBuilder'
import { SlotBatch } from '../style/SlotBatch'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { Palette, type TimeOfDayMode } from '../style/Palette'
import { SeededPRNG } from '../utils/SeededPRNG'
import { PondMesher, mixHex } from './PondMesher'

/**
 * LotusPond (Hồ Sen Bát Nhã, bản chi tiết):
 * - Mặt nước dùng shader riêng: tint nông/sâu theo bán kính, sóng lăn tăn, phản chiếu trời kiểu Fresnel,
 *   vệt nắng, lấp lánh, gợn sóng quanh từng con cá, tự đổi màu theo ngày / hoàng hôn / đêm.
 * - Đáy hồ sẫm màu có sỏi; bờ hồ là đá tự nhiên lởm chởm, rêu phủ; vài tảng đá lớn.
 * - Cầu đá vòm bậc thang bắc dọc trục Z, mỗi nấc <= 0.15 m, khớp collider đi bộ.
 * - Sen thật hơn: lá tròn khuyết nhát gợn mép, lá dựng trên cuống, bông sen 3 lớp cánh + đài + nhị,
 *   nụ sen, cánh hoa rụng trôi trên nước, lau sậy ven hồ. Tất cả gộp thành 1 mesh vertex-color.
 * - Cá koi bơi vòng (không cắt qua cầu), hoa đăng hình sen nổi bập bềnh, KHÔNG dùng PointLight.
 */

const BRIDGE_WIDTH = 3.2
const BRIDGE_SEGMENTS = 12
// Mặt sân chùa (ground_courtyard) có mặt trên y = 0.14, nên mặt nước phải cao hơn mới nhìn thấy được.
const WATER_Y = 0.22
const BED_Y = 0.152
const KOI_COUNT = 5
const MAX_RELEASED_LANTERNS = 12
const LANTERN_BRIDGE_CLEARANCE = BRIDGE_WIDTH * 0.5 + 0.55

interface ReleasedLantern {
  group: THREE.Group
  vx: number
  vz: number
  age: number
}

const WATER_VERTEX = /* glsl */ `
varying vec3 vWorldPos;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const WATER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uCenter;
uniform float uRadius;
uniform float uOpacity;
uniform vec2 uKoi[${KOI_COUNT}];
varying vec3 vWorldPos;
#include <fog_pars_fragment>

void main() {
  vec2 p = vWorldPos.xz;
  float d = clamp(length(p - uCenter.xz) / uRadius, 0.0, 1.0);

  // Độ dốc mặt nước = tổng đạo hàm của 4 sóng sin theo các hướng khác nhau
  vec2 slope = vec2(0.0);
  vec2 d1 = vec2(0.82, 0.57);   slope += d1 * cos(dot(p, d1) * 3.1  + uTime * 0.70) * 0.018 * 3.1;
  vec2 d2 = vec2(-0.54, 0.84);  slope += d2 * cos(dot(p, d2) * 4.7  + uTime * 0.95) * 0.012 * 4.7;
  vec2 d3 = vec2(0.21, -0.98);  slope += d3 * cos(dot(p, d3) * 7.3  + uTime * 1.30) * 0.007 * 7.3;
  vec2 d4 = vec2(-0.93, -0.36); slope += d4 * cos(dot(p, d4) * 11.0 + uTime * 1.70) * 0.004 * 11.0;

  // Gợn sóng tròn quanh từng con cá
  for (int i = 0; i < ${KOI_COUNT}; i++) {
    vec2 q = p - uKoi[i];
    float r = length(q);
    float ring = sin(r * 20.0 - uTime * 4.5) * exp(-r * 3.2);
    slope += q / (r + 0.001) * ring * 0.08;
  }

  vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 V = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);

  // Nước sâu ở giữa, nông ở mép
  float depthT = 1.0 - smoothstep(0.0, 1.0, d);
  vec3 col = mix(uShallow, uDeep, depthT * 0.8);

  // Vệt sáng loang dưới đáy (caustics nhẹ)
  float caustic = sin(p.x * 5.0 + sin(p.y * 3.0 + uTime * 0.6) * 1.5 + uTime * 0.4)
                * sin(p.y * 4.5 + sin(p.x * 3.5 - uTime * 0.5) * 1.5);
  col += uShallow * smoothstep(0.55, 1.0, caustic) * 0.10;

  // Phản chiếu bầu trời theo Fresnel
  col = mix(col, uSky, fres * 0.6 + 0.08);

  // Vệt nắng và lấp lánh
  vec3 R = reflect(-V, n);
  float spec = pow(max(dot(R, normalize(uSunDir)), 0.0), 160.0);
  col += uSunColor * spec * 1.4;
  float tw = smoothstep(0.992, 1.0, sin(p.x * 17.0 + uTime * 1.7) * sin(p.y * 15.0 - uTime * 1.3));
  col += uSunColor * tw * 0.28;

  // Mép hồ sáng hơn (nước nông)
  float rim = smoothstep(0.9, 1.0, d);
  col = mix(col, uShallow * 1.15 + 0.05, rim * 0.55);

  float alpha = mix(uOpacity * 0.72, uOpacity, depthT);
  alpha = clamp(alpha + fres * 0.18, 0.0, 1.0);

  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`

interface KoiVariant {
  base: number
  head: number
  fin: number
  patches: Array<{ color: number; z: number; sx: number; sz: number; x?: number }>
}

const KOI_VARIANTS: KoiVariant[] = [
  {
    base: 0xfff4e6,
    head: 0xe03a1e,
    fin: 0xffd7b8,
    patches: [
      { color: 0xe03a1e, z: 0.12, sx: 0.07, sz: 0.16 },
      { color: 0xe03a1e, z: -0.12, sx: 0.06, sz: 0.12, x: 0.02 }
    ]
  },
  {
    base: 0xf2b630,
    head: 0xf6c852,
    fin: 0xffd37a,
    patches: [{ color: 0xff8a2b, z: 0.0, sx: 0.07, sz: 0.2 }]
  },
  {
    base: 0xff7a2f,
    head: 0xffa05c,
    fin: 0xffb27a,
    patches: [
      { color: 0x2b2b2b, z: 0.06, sx: 0.06, sz: 0.12 },
      { color: 0xfff4e6, z: -0.16, sx: 0.06, sz: 0.1 }
    ]
  }
]

interface KoiFish {
  group: THREE.Group
  tail: THREE.Mesh
  cx: number
  cz: number
  rx: number
  rz: number
  speed: number
  phase: number
  scale: number
}

export class LotusPond {
  public root: THREE.Group = new THREE.Group()
  public floatingLanterns: THREE.Group[] = []
  public pondCenter = new THREE.Vector3(
    MapLayout.LANDMARKS.LOTUS_POND.center.x,
    MapLayout.LANDMARKS.LOTUS_POND.center.y,
    MapLayout.LANDMARKS.LOTUS_POND.center.z
  )
  public pondRadius = MapLayout.LANDMARKS.LOTUS_POND.radius || 6.5

  private waterMesh!: THREE.Mesh
  private waterMat!: THREE.ShaderMaterial
  private plantsGroup!: THREE.Group
  private plantMat!: THREE.MeshLambertMaterial
  private koi: KoiFish[] = []
  private appliedMode: TimeOfDayMode | null = null
  private lanternPetalGeo!: THREE.BufferGeometry
  private lanternShadeGeo!: THREE.BufferGeometry
  private lanternFlameGeo!: THREE.BufferGeometry
  private lanternGlow!: THREE.Material
  private lanternFlameMat!: THREE.Material
  private released: ReleasedLantern[] = []
  private feedTimer = 0
  private feedTargetX = -3.2
  private feedTargetZ = 0.0

  constructor(collision: CollisionWorld) {
    this.root.name = 'LotusPond'
    this.root.position.copy(this.pondCenter)

    // Vật liệu vertex-color hai mặt dùng cho lá, cánh hoa, cá, hoa đăng (hình mỏng nhìn được cả hai phía).
    this.plantMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })

    this.buildWater()
    this.root.add(this.buildBedAndRocks())
    this.root.add(this.buildBridge())
    this.plantsGroup = this.buildPlants()
    this.root.add(this.plantsGroup)
    this.buildKoi()
    this.buildFloatingLanterns()
    this.registerColliders(collision)
    this.applyPalette(FlatMaterialFactory.getInstance().currentMode)
  }

  private bridgeLen(): number {
    return this.pondRadius * 2.0
  }

  /** Độ cao mặt cầu theo phân đoạn s (parabol đỉnh 1.15 m, tối thiểu 0.28 m để nổi trên mặt nước). */
  private segmentFloorY(s: number): number {
    const t = ((s + 0.5) / BRIDGE_SEGMENTS) * 2.0 - 1.0
    return Math.max(0.28, (1.0 - t * t) * 1.15)
  }

  // ---------------------------------------------------------------- Nước

  private buildWater() {
    const geo = new THREE.CircleGeometry(this.pondRadius - 0.05, 64)
    geo.rotateX(-Math.PI / 2)

    const koiUniform = Array.from({ length: KOI_COUNT }, () => new THREE.Vector2(999, 999))
    this.waterMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib['fog'],
        {
          uTime: { value: 0 },
          uShallow: { value: new THREE.Color(0x7fc6c4) },
          uDeep: { value: new THREE.Color(0x2f7f86) },
          uSky: { value: new THREE.Color(0xdce8e0) },
          uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
          uSunColor: { value: new THREE.Color(0xfff4de) },
          uCenter: { value: this.pondCenter.clone() },
          uRadius: { value: this.pondRadius },
          uOpacity: { value: 0.78 },
          uKoi: { value: koiUniform }
        }
      ]),
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: true
    })

    this.waterMesh = new THREE.Mesh(geo, this.waterMat)
    this.waterMesh.name = 'pond_water'
    this.waterMesh.position.y = WATER_Y
    this.waterMesh.renderOrder = 1
    this.root.add(this.waterMesh)
  }

  /** Đổi màu nước theo thời điểm trong ngày (không tạo lại shader). */
  private applyPalette(mode: TimeOfDayMode) {
    this.appliedMode = mode
    const pal = Palette.get(mode)
    const u = this.waterMat.uniforms
    u.uShallow!.value.setHex(pal.slots.water)
    u.uDeep!.value.setHex(pal.slots.water).multiplyScalar(0.4).lerp(new THREE.Color(0x0f3a40), 0.35)
    u.uSky!.value.setHex(pal.sky.horizon).lerp(new THREE.Color(pal.sky.top), 0.4)
    u.uSunColor!.value.setHex(pal.sun.color)
  }

  // ---------------------------------------------------------------- Đáy hồ, bờ đá

  private buildBedAndRocks(): THREE.Group {
    const r = this.pondRadius
    const rng = new SeededPRNG(20261107)
    const rnd = () => rng.next()
    const m = new PondMesher()

    // Đáy hồ sẫm màu, sâu dần về tâm
    m.setTransform([0, BED_Y, 0])
    m.disc(r - 0.02, 40, new THREE.Color(0x24474a), new THREE.Color(0x58705f))

    // Sỏi dưới đáy
    const pebble = LowPolyBuilder.sphere(1, 0)
    const pebbleColors = [0x8a8a7c, 0x6f7068, 0x9c8f78, 0x77806f]
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2
      const dist = Math.sqrt(rnd()) * (r - 0.9)
      const s = 0.1 + rnd() * 0.16
      m.setTransform([Math.cos(a) * dist, BED_Y + s * 0.2, Math.sin(a) * dist], [0, rnd() * 6, 0], [s * 1.3, s * 0.55, s])
      m.addGeo(pebble, pebbleColors[Math.floor(rnd() * pebbleColors.length)]!, 0.06, rnd)
    }
    pebble.dispose()

    // Đá bờ hồ tự nhiên (chừa lối vào hai đầu cầu và khu vực Cây Nguyệt Lão / Bàn Tơ Duyên ở x=+7.0, z=+3.1..+4.5)
    const rockVariants = [1, 2, 3].map(seed => LowPolyBuilder.jitter(LowPolyBuilder.sphere(1, 1), 0.16, seed * 17))
    const mossBall = LowPolyBuilder.sphere(1, 0)
    const stoneColors = [0xb9b3a6, 0xa7a196, 0xc4bfb2, 0x9a9488]
    const nearExcludedZone = (x: number, z: number) =>
      (Math.abs(x) < 2.4 && Math.abs(z) > r - 1.7) ||
      Math.hypot(x - 6.6, z - 3.1) < 3.4 ||
      Math.hypot(x - 6.8, z - 4.5) < 3.2

    const rocks = 44
    for (let i = 0; i < rocks; i++) {
      const ang = (i / rocks) * Math.PI * 2 + (rnd() - 0.5) * 0.08
      const dist = r + 0.05 + rnd() * 0.45
      const cx = Math.cos(ang) * dist
      const cz = Math.sin(ang) * dist
      if (nearExcludedZone(cx, cz)) continue
      const sx = 0.55 + rnd() * 0.5
      const sy = 0.26 + rnd() * 0.26
      const sz = 0.45 + rnd() * 0.4
      m.setTransform([cx, 0.14 + sy * 0.55, cz], [0, rnd() * 6.28, 0], [sx, sy, sz])
      m.addGeo(rockVariants[i % rockVariants.length]!, stoneColors[Math.floor(rnd() * stoneColors.length)]!, 0.07, rnd)
      if (rnd() < 0.55) {
        m.setTransform(
          [cx + (rnd() - 0.5) * 0.2, 0.14 + sy * 1.0, cz + (rnd() - 0.5) * 0.2],
          [0, rnd() * 6.28, 0],
          [sx * 0.7, sy * 0.35, sz * 0.7]
        )
        m.addGeo(mossBall, rnd() < 0.5 ? 0x5f8f4a : 0x4f7d44, 0.1, rnd)
      }
    }

    // Vài tảng đá lớn ven hồ
    const boulderAngles = [1.05, 2.2, 3.7, 4.3, 5.35]
    boulderAngles.forEach((ang, i) => {
      const dist = r + 0.55 + rnd() * 0.25
      const cx = Math.cos(ang) * dist
      const cz = Math.sin(ang) * dist
      if (nearExcludedZone(cx, cz)) return
      const sx = 0.85 + rnd() * 0.5
      const sy = 0.55 + rnd() * 0.3
      const sz = 0.75 + rnd() * 0.4
      m.setTransform([cx, 0.14 + sy * 0.6, cz], [0, rnd() * 6.28, 0], [sx, sy, sz])
      m.addGeo(rockVariants[i % rockVariants.length]!, stoneColors[i % stoneColors.length]!, 0.08, rnd)
      m.setTransform([cx, 0.14 + sy * 1.15, cz], [0, rnd() * 6.28, 0], [sx * 0.65, sy * 0.3, sz * 0.65])
      m.addGeo(mossBall, 0x5f8f4a, 0.1, rnd)
    })

    rockVariants.forEach(g => g.dispose())
    mossBall.dispose()

    const mesh = new THREE.Mesh(m.build(), FlatMaterialFactory.getInstance().vertexColor())
    mesh.name = 'pond_bed_rocks'
    mesh.castShadow = true
    mesh.receiveShadow = true
    const group = new THREE.Group()
    group.add(mesh)
    return group
  }

  // ---------------------------------------------------------------- Cầu đá

  private buildBridge(): THREE.Group {
    const b = new SlotBatch()
    const bridgeLen = this.bridgeLen()
    const segDepth = bridgeLen / BRIDGE_SEGMENTS
    const edgeX = BRIDGE_WIDTH * 0.5 - 0.15
    for (let s = 0; s < BRIDGE_SEGMENTS; s++) {
      const floorY = this.segmentFloorY(s)
      const z = ((s + 0.5) / BRIDGE_SEGMENTS) * bridgeLen - bridgeLen * 0.5
      b.box('stone', BRIDGE_WIDTH, floorY, segDepth + 0.02, 0, floorY * 0.5, z)

      // Gờ lan can hai bên
      for (const sx of [-1, 1]) {
        b.box('stone', 0.3, 0.5, segDepth + 0.02, sx * edgeX, floorY + 0.25, z)
      }
      // Trụ lan can có búp sen vàng ở mỗi nhịp chẵn
      if (s % 2 === 0) {
        for (const sx of [-1, 1]) {
          b.box('stone', 0.4, 0.4, 0.4, sx * edgeX, floorY + 0.7, z)
          b.cone('gold', 0.13, 0.34, 5, sx * edgeX, floorY + 1.07, z)
        }
      }
    }
    return b.build({ name: 'pond_bridge', castShadow: true, receiveShadow: true })
  }

  // ---------------------------------------------------------------- Thực vật

  private buildPlants(): THREE.Group {
    const r = this.pondRadius
    const rng = new SeededPRNG(20261106)
    const rnd = () => rng.next()
    const m = new PondMesher()

    const stemBase = new THREE.Color(0x3f6b3a)
    const stemTop = new THREE.Color(0x6f9a4a)
    const placed: Array<[number, number, number]> = []
    const pick = (clearance: number): [number, number] | null => {
      for (let attempt = 0; attempt < 60; attempt++) {
        const ang = rnd() * Math.PI * 2
        const dist = Math.sqrt(rnd()) * (r - 1.0)
        const x = Math.cos(ang) * dist
        const z = Math.sin(ang) * dist
        if (Math.abs(x) < 2.4) continue
        if (placed.some(([px, pz, pr]) => Math.hypot(px - x, pz - z) < pr + clearance)) continue
        placed.push([x, z, clearance])
        return [x, z]
      }
      return null
    }

    // 1. Bông sen và nụ sen trên cuống cao
    const kinds: Array<'pink' | 'white' | 'bud'> = [
      'pink', 'pink', 'pink', 'pink', 'pink', 'pink', 'pink', 'pink',
      'white', 'white', 'white', 'bud', 'bud', 'bud', 'bud'
    ]
    for (const kind of kinds) {
      const spot = pick(0.75)
      if (!spot) continue
      const h = kind === 'bud' ? 0.55 + rnd() * 0.5 : 0.45 + rnd() * 0.55
      const bend: [number, number] = [(rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3]
      m.resetTransform()
      const top = m.stem(spot[0], spot[1], WATER_Y - 0.05, WATER_Y + h, 0.028, 0.02, bend, stemBase, stemTop)
      m.flower(top[0], top[1], top[2], 0.9 + rnd() * 0.4, kind, rnd)
    }

    // 2. Lá sen dựng trên cuống (lá úp như chiếc ô)
    for (let i = 0; i < 9; i++) {
      const spot = pick(0.6)
      if (!spot) continue
      const h = 0.45 + rnd() * 0.6
      const bend: [number, number] = [(rnd() - 0.5) * 0.35, (rnd() - 0.5) * 0.35]
      m.resetTransform()
      const top = m.stem(spot[0], spot[1], WATER_Y - 0.05, WATER_Y + h, 0.03, 0.022, bend, stemBase, stemTop)
      m.setTransform([top[0], top[1], top[2]], [(rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4], 1, 'XYZ')
      m.leaf(0.45 + rnd() * 0.3, 0.3 + rnd() * 0.15, mixHex(0x2f6a3c, 0x3f7d45, rnd()), mixHex(0x5f9e52, 0x7dbb62, rnd()), rnd)
    }

    // 3. Lá sen nổi trên mặt nước
    const leafPairs: Array<[number, number]> = [
      [0x3f7d45, 0x6fae5a],
      [0x468a4b, 0x7dbb62],
      [0x35703f, 0x5f9e52],
      [0x4c8f4a, 0x8cc566]
    ]
    for (let i = 0; i < 46; i++) {
      const spot = pick(0.32)
      if (!spot) continue
      const radius = 0.35 + rnd() * 0.45
      const pair = leafPairs[Math.floor(rnd() * leafPairs.length)]!
      const edge = mixHex(pair[1], 0xa8c864, rnd() < 0.2 ? 0.5 : 0)
      m.setTransform([spot[0], WATER_Y + 0.015, spot[1]], [(rnd() - 0.5) * 0.06, 0, (rnd() - 0.5) * 0.06], 1, 'XYZ')
      m.leaf(radius, 0.04 + rnd() * 0.1, new THREE.Color(pair[0]), edge, rnd)
    }

    // 4. Cánh hoa rụng trôi trên mặt nước
    const petalBase = new THREE.Color(0xfff0f2)
    const petalTip = new THREE.Color(0xf08fb0)
    for (let i = 0; i < 20; i++) {
      const ang = rnd() * Math.PI * 2
      const dist = Math.sqrt(rnd()) * (r - 0.8)
      const x = Math.cos(ang) * dist
      const z = Math.sin(ang) * dist
      if (Math.abs(x) < 1.9) continue
      m.setTransform([x, WATER_Y + 0.012, z], [Math.PI / 2 + (rnd() - 0.5) * 0.15, rnd() * 6.28, 0], 1, 'YXZ')
      m.petal(0.15 + rnd() * 0.06, 0.08 + rnd() * 0.03, -0.25, petalBase, petalTip)
    }

    // 5. Lau sậy ven hồ (lá dài + bông đuôi chồn nâu)
    const reedAngles = [0.35, 1.2, 2.0, 2.75, 3.9, 4.6, 5.5]
    const blade0 = new THREE.Color(0x3d6b35)
    const blade1 = new THREE.Color(0x8fb35a)
    const brown0 = new THREE.Color(0x5a3a1c)
    const brown1 = new THREE.Color(0x7a5230)
    reedAngles.forEach(ang => {
      const dist = r - 0.55
      const cx = Math.cos(ang) * dist
      const cz = Math.sin(ang) * dist
      if (Math.abs(cx) < 2.4 && Math.abs(cz) > r - 1.9) return
      for (let k = 0; k < 6; k++) {
        const ox = (rnd() - 0.5) * 0.5
        const oz = (rnd() - 0.5) * 0.5
        m.setTransform([cx + ox, WATER_Y - 0.02, cz + oz], [0.1 + rnd() * 0.3, rnd() * 6.28, 0], 1, 'YXZ')
        m.petal(1.0 + rnd() * 0.7, 0.07, 0.18 + rnd() * 0.12, blade0, blade1)
      }
      for (let k = 0; k < 2; k++) {
        const ox = (rnd() - 0.5) * 0.4
        const oz = (rnd() - 0.5) * 0.4
        const h = 1.2 + rnd() * 0.5
        const lean: [number, number] = [(rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.25]
        m.resetTransform()
        const top = m.stem(cx + ox, cz + oz, WATER_Y - 0.03, WATER_Y + h, 0.016, 0.012, lean, blade0, blade1)
        m.stem(top[0], top[2], top[1] - 0.3, top[1] - 0.04, 0.034, 0.03, [0, 0], brown0, brown1, 6)
        m.tri(
          [top[0] - 0.012, top[1] - 0.04, top[2]],
          [top[0] + 0.012, top[1] - 0.04, top[2]],
          [top[0], top[1] + 0.14, top[2]],
          brown1,
          brown1,
          blade1
        )
      }
    })

    const mesh = new THREE.Mesh(m.build(), this.plantMat)
    mesh.name = 'pond_lotus'
    mesh.castShadow = false
    mesh.receiveShadow = true
    const group = new THREE.Group()
    group.add(mesh)
    return group
  }

  // ---------------------------------------------------------------- Cá koi

  private buildKoi() {
    const bodies = KOI_VARIANTS.map(v => this.makeKoiBody(v))
    const tails = KOI_VARIANTS.map(v => this.makeKoiTail(v))

    for (let i = 0; i < KOI_COUNT; i++) {
      const variant = i % KOI_VARIANTS.length
      const side = i % 2 === 0 ? -1 : 1
      const group = new THREE.Group()
      group.name = `koi_${i}`
      group.add(new THREE.Mesh(bodies[variant]!, this.plantMat))
      const tail = new THREE.Mesh(tails[variant]!, this.plantMat)
      tail.position.z = -0.38
      group.add(tail)
      this.root.add(group)

      this.koi.push({
        group,
        tail,
        cx: side * 3.7,
        cz: [-1.2, 0.2, 1.3, -0.4, 0.9][i]!,
        rx: 0.8 + (i % 3) * 0.12,
        rz: 1.5 + (i % 3) * 0.2,
        speed: (0.28 + i * 0.045) * (i % 3 === 1 ? -1 : 1),
        phase: i * 1.9,
        scale: 1.0
      })
    }
  }

  private makeKoiBody(v: KoiVariant): THREE.BufferGeometry {
    const m = new PondMesher()
    const unit = LowPolyBuilder.sphere(1, 1)
    const small = LowPolyBuilder.sphere(1, 0)
    m.setTransform([0, 0, 0], [0, 0, 0], [0.1, 0.06, 0.4])
    m.addGeo(unit, v.base, 0.03)
    m.setTransform([0, 0, 0.3], [0, 0, 0], [0.075, 0.05, 0.14])
    m.addGeo(small, v.head, 0.03)
    for (const p of v.patches) {
      m.setTransform([p.x ?? 0, 0.04, p.z], [0, 0, 0], [p.sx, 0.035, p.sz])
      m.addGeo(small, p.color, 0.03)
    }
    unit.dispose()
    small.dispose()

    m.resetTransform()
    const fin = new THREE.Color(v.fin)
    // Vây lưng
    m.tri([0, 0.05, 0.12], [0, 0.05, -0.12], [0, 0.14, -0.14], fin)
    // Vây ngực hai bên
    m.tri([0.08, -0.01, 0.14], [0.21, -0.02, 0.02], [0.09, -0.02, 0.04], fin)
    m.tri([-0.08, -0.01, 0.14], [-0.21, -0.02, 0.02], [-0.09, -0.02, 0.04], fin)
    return m.build()
  }

  private makeKoiTail(v: KoiVariant): THREE.BufferGeometry {
    const m = new PondMesher()
    const root = new THREE.Color(v.fin)
    const tip = new THREE.Color(0xffffff).lerp(root, 0.3)
    m.tri([0, 0, 0], [-0.02, 0, -0.3], [-0.15, 0, -0.22], root, tip, tip)
    m.tri([0, 0, 0], [0.02, 0, -0.3], [0.15, 0, -0.22], root, tip, tip)
    m.tri([0, 0, 0], [-0.03, 0, -0.26], [0.03, 0, -0.26], root, tip, tip)
    return m.build()
  }

  // ---------------------------------------------------------------- Hoa đăng

  private buildFloatingLanterns() {
    const mats = FlatMaterialFactory.getInstance()
    this.lanternGlow = mats.emissive('lantern')
    this.lanternFlameMat = mats.emissive('gold')

    // Đế hình hoa sen: hai vòng cánh hồng nhạt
    const pm = new PondMesher()
    const pink0 = new THREE.Color(0xfff0f2)
    const pink1 = new THREE.Color(0xf08fb0)
    for (let i = 0; i < 8; i++) {
      pm.setTransform([0, 0.02, 0], [1.1, (i / 8) * Math.PI * 2, 0], 1, 'YXZ')
      pm.petal(0.3, 0.2, 0.2, pink0, pink1)
    }
    for (let i = 0; i < 6; i++) {
      pm.setTransform([0, 0.05, 0], [0.55, ((i + 0.5) / 6) * Math.PI * 2, 0], 1, 'YXZ')
      pm.petal(0.26, 0.17, 0.05, pink0, mixHex(0xf08fb0, 0xffffff, 0.35))
    }
    this.lanternPetalGeo = pm.build()
    this.lanternShadeGeo = LowPolyBuilder.cylinder(0.09, 0.12, 0.2, 8)
    this.lanternFlameGeo = LowPolyBuilder.cone(0.035, 0.1, 5)

    const spots = [
      [-4.5, -2.5],
      [-5.8, 3.2],
      [-2.8, 4.5],
      [-3.5, -4.0],
      [4.2, -3.2],
      [5.0, 2.8]
    ]

    spots.forEach(([lx, lz]) => {
      const lantern = this.makeLantern()
      lantern.position.set(lx!, WATER_Y + 0.02, lz!)
      this.root.add(lantern)
      this.floatingLanterns.push(lantern)
    })
  }

  private makeLantern(): THREE.Group {
    const lantern = new THREE.Group()
    lantern.add(new THREE.Mesh(this.lanternPetalGeo, this.plantMat))

    const shade = new THREE.Mesh(this.lanternShadeGeo, this.lanternGlow)
    shade.position.y = 0.14
    lantern.add(shade)

    const flame = new THREE.Mesh(this.lanternFlameGeo, this.lanternFlameMat)
    flame.position.y = 0.29
    lantern.add(flame)
    return lantern
  }

  /**
   * Thả một hoa đăng mới từ phía người chơi đứng (tọa độ thế giới), trôi chậm trên mặt nước.
   * Giữ tối đa MAX_RELEASED_LANTERNS chiếc; chiếc cũ nhất tự tan khi vượt giới hạn.
   */
  public releaseLantern(fromWorld: THREE.Vector3) {
    const r = this.pondRadius
    const relX = fromWorld.x - this.pondCenter.x
    const relZ = fromWorld.z - this.pondCenter.z
    let x: number
    let z: number
    let vx: number
    let vz: number

    if (Math.abs(relX) < LANTERN_BRIDGE_CLEARANCE + 0.6 && Math.abs(relZ) < r - 0.6) {
      // Đứng trên hoặc sát cầu: thả ngay bên cạnh cầu để thấy rõ lập tức
      const sideSign = Math.abs(relX) < 0.15 ? (this.released.length % 2 === 0 ? 1 : -1) : relX >= 0 ? 1 : -1
      x = sideSign * (LANTERN_BRIDGE_CLEARANCE + 0.15)
      z = THREE.MathUtils.clamp(relZ, -(r - 1.4), r - 1.4)
      vx = sideSign * (0.16 + Math.random() * 0.06)
      vz = (Math.random() - 0.5) * 0.12
    } else {
      // Đứng quanh bờ hồ: thả ở mép nước gần người chơi và trôi dần vào trong hồ
      const len = Math.hypot(relX, relZ) || 1
      const dx = relX / len
      const dz = relZ / len
      const rim = Math.min(r - 0.9, Math.max(2.2, len - 0.6))
      x = dx * rim
      z = dz * rim
      if (Math.abs(x) < LANTERN_BRIDGE_CLEARANCE) x = (x >= 0 ? 1 : -1) * LANTERN_BRIDGE_CLEARANCE
      const side = Math.random() < 0.5 ? -1 : 1
      const speed = 0.14 + Math.random() * 0.08
      vx = (-dx * 0.6 + -dz * 0.4 * side) * speed
      vz = (-dz * 0.6 + dx * 0.4 * side) * speed
    }

    const lantern = this.makeLantern()
    lantern.position.set(x, WATER_Y + 0.02, z)
    lantern.scale.setScalar(0.55)
    this.root.add(lantern)
    this.floatingLanterns.push(lantern)
    this.released.push({ group: lantern, vx, vz, age: 0 })

    while (this.released.length > MAX_RELEASED_LANTERNS) {
      const old = this.released.shift()!
      this.root.remove(old.group)
      const idx = this.floatingLanterns.indexOf(old.group)
      if (idx >= 0) this.floatingLanterns.splice(idx, 1)
    }
  }

  private updateReleasedLanterns(delta: number) {
    const limit = this.pondRadius - 0.9
    for (const item of this.released) {
      item.age += delta
      const g = item.group
      // Hiện dần từ cỡ trung bình lên đủ cỡ
      g.scale.setScalar(Math.min(1, 0.55 + item.age * 1.5))
      g.position.x += item.vx * delta
      g.position.z += item.vz * delta

      // Dội lại khi chạm mép hồ
      const d = Math.hypot(g.position.x, g.position.z)
      if (d > limit) {
        const nx = g.position.x / d
        const nz = g.position.z / d
        const dot = item.vx * nx + item.vz * nz
        if (dot > 0) {
          item.vx -= 2 * dot * nx
          item.vz -= 2 * dot * nz
        }
      }
      // Không trôi vào dải cầu
      if (Math.abs(g.position.x) < LANTERN_BRIDGE_CLEARANCE) {
        const sign = g.position.x >= 0 ? 1 : -1
        g.position.x = sign * LANTERN_BRIDGE_CLEARANCE
        item.vx = Math.abs(item.vx) * sign
      }
    }
  }

  // ---------------------------------------------------------------- Va chạm

  private registerColliders(collision: CollisionWorld) {
    const r = this.pondRadius
    const curbDist = r + 0.1

    // Bờ hồ gộp thành 8 cung, chừa hai cung ở đầu cầu Bắc và Nam
    const arcCount = 8
    for (let i = 0; i < arcCount; i++) {
      const angle = (i / arcCount) * Math.PI * 2
      if (Math.abs(Math.sin(angle)) > 0.85) continue
      collision.add(
        new BoxCollider(
          `pond_curb_grouped_${i}`,
          new THREE.Vector3(
            this.pondCenter.x + Math.cos(angle) * curbDist,
            0.25,
            this.pondCenter.z + Math.sin(angle) * curbDist
          ),
          new THREE.Vector3(3.2, 0.65, 3.2),
          false
        )
      )
    }

    // Mặt cầu: 12 phân đoạn giật cấp nhẹ để đi bộ mượt
    const bridgeLen = this.bridgeLen()
    const segDepth = bridgeLen / BRIDGE_SEGMENTS
    for (let s = 0; s < BRIDGE_SEGMENTS; s++) {
      const floorY = this.segmentFloorY(s)
      const relZ = ((s + 0.5) / BRIDGE_SEGMENTS) * bridgeLen - bridgeLen * 0.5
      collision.add(
        new BoxCollider(
          `bridge_step_${s}`,
          new THREE.Vector3(this.pondCenter.x, floorY * 0.5, this.pondCenter.z + relZ),
          new THREE.Vector3(BRIDGE_WIDTH, floorY, segDepth + 0.06),
          false,
          true,
          floorY
        )
      )
    }

    // Lan can chắn hai bên cầu
    for (const [id, sx] of [
      ['bridge_rail_left', -1],
      ['bridge_rail_right', 1]
    ] as const) {
      collision.add(
        new BoxCollider(
          id,
          new THREE.Vector3(this.pondCenter.x + sx * BRIDGE_WIDTH * 0.5, 1.2, this.pondCenter.z),
          new THREE.Vector3(0.4, 1.6, bridgeLen),
          false
        )
      )
    }
  }

  // ---------------------------------------------------------------- Cập nhật

  /** Hướng mặt trời (vector đơn vị hướng về phía mặt trời) để tính vệt nắng trên mặt nước. */
  public updateSunDirection(dir: THREE.Vector3) {
    ;(this.waterMat.uniforms.uSunDir!.value as THREE.Vector3).copy(dir).normalize()
  }

  /** Cập nhật kích thước đàn cá Koi theo cấp độ (level 1..5). */
  public setKoiLevels(levels: number[]) {
    this.koi.forEach((k, i) => {
      const lvl = Math.max(1, Math.min(5, Number(levels[i] ?? 1)))
      k.scale = 1.0 + (lvl - 1) * 0.16
      k.group.scale.setScalar(k.scale)
    })
  }

  /** Kích hoạt hiệu ứng đàn cá Koi quẫy đuôi tụ lại gần bờ khi người chơi cho ăn (6 giây). */
  public triggerKoiFeed(fromWorld?: THREE.Vector3) {
    this.feedTimer = 6.0
    if (fromWorld) {
      const relX = fromWorld.x - this.pondCenter.x
      const relZ = fromWorld.z - this.pondCenter.z
      const sideSign = relX >= 0 ? 1 : -1
      this.feedTargetX = sideSign * Math.max(LANTERN_BRIDGE_CLEARANCE + 0.7, Math.min(this.pondRadius - 1.4, Math.abs(relX) * 0.65))
      this.feedTargetZ = THREE.MathUtils.clamp(relZ * 0.65, -2.5, 2.5)
    }
  }

  private updateKoi(delta: number, elapsed: number) {
    if (this.feedTimer > 0) {
      this.feedTimer = Math.max(0, this.feedTimer - delta)
    }
    const feedBlend = this.feedTimer > 0 ? Math.min(1, this.feedTimer * 0.5) * 0.55 : 0
    const gaps = this.waterMat.uniforms.uKoi!.value as THREE.Vector2[]
    this.koi.forEach((k, i) => {
      const speedMul = this.feedTimer > 0 ? 1.85 : 1.0
      const th = k.phase + elapsed * k.speed * speedMul
      const baseX = k.cx + k.rx * Math.cos(th)
      const baseZ = k.cz + k.rz * Math.sin(th)
      const targetSideX = (k.cx >= 0 ? 1 : -1) * Math.abs(this.feedTargetX)
      const x = THREE.MathUtils.lerp(baseX, targetSideX + Math.cos(th * 1.5 + i) * 0.45, feedBlend)
      const z = THREE.MathUtils.lerp(baseZ, this.feedTargetZ + Math.sin(th * 1.5 + i) * 0.45, feedBlend)
      const dir = k.speed >= 0 ? 1 : -1
      const tx = -k.rx * Math.sin(th) * dir
      const tz = k.rz * Math.cos(th) * dir
      k.group.position.set(x, WATER_Y - 0.045, z)
      k.group.rotation.y = Math.atan2(tx, tz)
      k.tail.rotation.y = Math.sin(elapsed * (this.feedTimer > 0 ? 11 : 6) + k.phase * 3) * 0.45
      gaps[i]!.set(this.pondCenter.x + x, this.pondCenter.z + z)
    })
  }

  public update(delta: number, elapsed: number) {
    const mode = FlatMaterialFactory.getInstance().currentMode
    if (mode !== this.appliedMode) this.applyPalette(mode)

    this.waterMat.uniforms.uTime!.value = elapsed
    this.updateKoi(delta, elapsed)
    this.updateReleasedLanterns(delta)

    // Hoa đăng bập bềnh theo nhịp nước
    this.floatingLanterns.forEach((lantern, i) => {
      lantern.position.y = WATER_Y + 0.02 + Math.sin(elapsed * 1.8 + i * 1.5) * 0.02
      lantern.rotation.y += delta * 0.08
      lantern.rotation.z = Math.sin(elapsed * 1.3 + i) * 0.03
    })
    // Cụm sen đung đưa rất nhẹ
    this.plantsGroup.rotation.y = Math.sin(elapsed * 0.3) * 0.006
  }

  public dispose() {
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh
      if (m.isMesh && m.geometry) m.geometry.dispose()
    })
    // Vật liệu Flat dùng chung FlatMaterialFactory nên không dispose ở đây; chỉ dispose vật liệu riêng của hồ
    this.waterMat.dispose()
    this.plantMat.dispose()
    this.lanternPetalGeo?.dispose()
    this.lanternShadeGeo?.dispose()
    this.lanternFlameGeo?.dispose()
  }
}
