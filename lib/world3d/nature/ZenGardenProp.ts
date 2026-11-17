import * as THREE from 'three'
import { LowPolyBuilder } from '../style/LowPolyBuilder'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'
import { MapLayout } from '../world/MapLayout'
import { createPlaqueTexture } from '../utils/PlaqueTexture'

/**
 * ZenGardenProp (Vườn Thiền Bát Nhã 6 Ô Đất — Mục 14):
 * - Đặt tại khu sân thoáng phía Đông Nam (`x = 10.2, z = 18.8`), đối xứng với Đài Tơ Duyên qua trục ngự đạo,
 *   tách biệt hoàn toàn khỏi Hồ Sen Bát Nhã và Lầu Chuông.
 * - Khuôn viên rộng 6.6m × 4.6m: nền cát sỏi Karesansui trắng ngà, đá bước dạo, bồn nước đá Tsukubai ống trúc,
 *   hàng rào gỗ thiền viện và 6 bồn đá bát giác cỡ lớn (bán kính 0.72m) xếp 2 hàng × 3 cột thoáng đãng.
 */
export class ZenGardenProp {
  public root: THREE.Group = new THREE.Group()
  public interactPos = new THREE.Vector3(
    MapLayout.LANDMARKS.ZEN_GARDEN?.center.x ?? 10.2,
    MapLayout.LANDMARKS.ZEN_GARDEN?.center.y ?? 0.14,
    MapLayout.LANDMARKS.ZEN_GARDEN?.center.z ?? 18.8
  )
  public proximityRadius = 4.8
  private plotPlantGroups: THREE.Group[] = []

  constructor() {
    this.root.name = 'ZenGardenProp'
    this.root.position.copy(this.interactPos)
    this.buildGardenBed()
  }

  private buildGardenBed() {
    const mats = FlatMaterialFactory.getInstance()
    const stoneMat = mats.get('stone')
    const woodMat = mats.get('woodDark')
    const woodLightMat = mats.get('wood')
    const goldMat = mats.get('gold')
    const leafMat = mats.get('leaf')
    const waterMat = mats.get('water')
    const soilMat = new THREE.MeshLambertMaterial({ color: 0x3b2818, flatShading: true })
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xd8d2c5, flatShading: true })

    // 1. Nền đá viền khu vườn rộng 6.6m × 4.6m
    const W = 6.6
    const D = 4.6
    const borderH = 0.16
    const rimThickness = 0.22

    const northRim = new THREE.Mesh(LowPolyBuilder.box(W, borderH, rimThickness), stoneMat)
    northRim.position.set(0, borderH * 0.5, -D * 0.5 + rimThickness * 0.5)
    this.root.add(northRim)

    const southRimLeft = new THREE.Mesh(LowPolyBuilder.box(2.2, borderH, rimThickness), stoneMat)
    southRimLeft.position.set(-W * 0.5 + 1.1, borderH * 0.5, D * 0.5 - rimThickness * 0.5)
    this.root.add(southRimLeft)

    const southRimRight = new THREE.Mesh(LowPolyBuilder.box(2.2, borderH, rimThickness), stoneMat)
    southRimRight.position.set(W * 0.5 - 1.1, borderH * 0.5, D * 0.5 - rimThickness * 0.5)
    this.root.add(southRimRight)

    const westRim = new THREE.Mesh(LowPolyBuilder.box(rimThickness, borderH, D), stoneMat)
    westRim.position.set(-W * 0.5 + rimThickness * 0.5, borderH * 0.5, 0)
    this.root.add(westRim)

    const eastRim = new THREE.Mesh(LowPolyBuilder.box(rimThickness, borderH, D), stoneMat)
    eastRim.position.set(W * 0.5 - rimThickness * 0.5, borderH * 0.5, 0)
    this.root.add(eastRim)

    // Thảm cát trắng Karesansui bên trong + vân cát gợn sóng quanh đá tảng
    const sandBed = new THREE.Mesh(LowPolyBuilder.box(W - rimThickness * 2, 0.06, D - rimThickness * 2), sandMat)
    sandBed.position.set(0, 0.03, 0)
    sandBed.receiveShadow = true
    this.root.add(sandBed)

    // Vân cát Karesansui cào vòng tròn quanh 6 bồn cây
    const ringGeo = new THREE.RingGeometry(0.84, 0.89, 16)
    const ringOuterGeo = new THREE.RingGeometry(0.95, 0.99, 16)
    for (let i = 0; i < 6; i++) {
      const col = i % 3
      const row = Math.floor(i / 3)
      const px = (col - 1) * 1.95
      const pz = (row - 0.5) * 1.85 - 0.15
      for (const rg of [ringGeo, ringOuterGeo]) {
        const ring = new THREE.Mesh(rg, stoneMat)
        ring.rotation.x = -Math.PI * 0.5
        ring.position.set(px, 0.065, pz)
        this.root.add(ring)
      }
    }

    // Đèn đá lùn thiền viện (Yukimi-dōrō) ở góc Tây-Bắc vườn
    const lx = -2.65
    const lz = -1.70
    for (let k = 0; k < 3; k++) {
      const ang = (k * Math.PI * 2) / 3
      const leg = new THREE.Mesh(LowPolyBuilder.box(0.08, 0.24, 0.08), stoneMat)
      leg.position.set(lx + Math.cos(ang) * 0.14, 0.16, lz + Math.sin(ang) * 0.14)
      this.root.add(leg)
    }
    const lanBase = new THREE.Mesh(LowPolyBuilder.cylinder(0.24, 0.20, 0.08, 6), stoneMat)
    lanBase.position.set(lx, 0.30, lz)
    this.root.add(lanBase)
    const lanGlow = new THREE.Mesh(LowPolyBuilder.cylinder(0.14, 0.14, 0.22, 6), mats.emissive('lantern'))
    lanGlow.position.set(lx, 0.44, lz)
    this.root.add(lanGlow)
    const lanRoof = new THREE.Mesh(LowPolyBuilder.cone(0.36, 0.18, 6), stoneMat)
    lanRoof.position.set(lx, 0.62, lz)
    this.root.add(lanRoof)
    const lanFinial = new THREE.Mesh(LowPolyBuilder.sphere(0.05, 0), goldMat)
    lanFinial.position.set(lx, 0.74, lz)
    this.root.add(lanFinial)

    // Đá bước dạo ở lối giữa
    const stepStoneGeo = LowPolyBuilder.cylinder(0.32, 0.35, 0.08, 7)
    for (const [sx, sz] of [
      [0, 1.85],
      [0, 0.95],
      [0, 0.0],
      [0, -0.95]
    ] as const) {
      const st = new THREE.Mesh(stepStoneGeo, stoneMat)
      st.position.set(sx, 0.05, sz)
      this.root.add(st)
    }

    // 2. Cổng bảng gỗ "Vườn Thiền" ở góc Tây-Nam lối vào
    for (const px of [-2.85, -1.95]) {
      const post = new THREE.Mesh(LowPolyBuilder.cylinder(0.055, 0.06, 1.35, 6), woodMat)
      post.position.set(px, 0.68, D * 0.5 - 0.1)
      this.root.add(post)
    }
    const signBoard = new THREE.Mesh(LowPolyBuilder.box(1.15, 0.34, 0.08), woodMat)
    signBoard.position.set(-2.4, 1.18, D * 0.5 - 0.1)
    this.root.add(signBoard)

    const gardenPlaqueTex = createPlaqueTexture({
      text: 'VƯỜN THIỀN',
      background: '#1a0f0a',
      border: '#d9a441',
      textColor: '#f6cf74',
      width: 860,
      height: 256
    })
    const gardenPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.3),
      new THREE.MeshBasicMaterial({ map: gardenPlaqueTex })
    )
    gardenPlaque.position.set(-2.4, 1.18, D * 0.5 - 0.056)
    this.root.add(gardenPlaque)

    const signRoof = new THREE.Mesh(LowPolyBuilder.box(1.28, 0.06, 0.18), goldMat)
    signRoof.position.set(-2.4, 1.38, D * 0.5 - 0.1)
    this.root.add(signRoof)

    // 3. Bồn nước đá Tsukubai & ống trúc ở góc Đông-Nam để tưới cây
    const basinOuter = new THREE.Mesh(LowPolyBuilder.cylinder(0.42, 0.36, 0.46, 8), stoneMat)
    basinOuter.position.set(2.55, 0.25, D * 0.5 - 0.45)
    this.root.add(basinOuter)

    const basinWater = new THREE.Mesh(LowPolyBuilder.cylinder(0.32, 0.32, 0.04, 8), waterMat)
    basinWater.position.set(2.55, 0.47, D * 0.5 - 0.45)
    this.root.add(basinWater)

    const bambooPipe = new THREE.Mesh(LowPolyBuilder.cylinder(0.035, 0.04, 0.72, 6), leafMat)
    bambooPipe.position.set(2.85, 0.44, D * 0.5 - 0.45)
    this.root.add(bambooPipe)

    const bambooSpout = new THREE.Mesh(LowPolyBuilder.cylinder(0.025, 0.025, 0.38, 6), woodLightMat)
    bambooSpout.rotation.z = Math.PI * 0.38
    bambooSpout.position.set(2.7, 0.62, D * 0.5 - 0.45)
    this.root.add(bambooSpout)

    // 4. 6 bồn đá bát giác cỡ lớn (2 hàng × 3 cột, đường kính ~1.44m mỗi bồn)
    const planterOuterGeo = LowPolyBuilder.cylinder(0.72, 0.78, 0.3, 8)
    const planterRimGeo = LowPolyBuilder.cylinder(0.76, 0.76, 0.05, 8)
    const soilGeo = LowPolyBuilder.cylinder(0.64, 0.64, 0.06, 8)

    for (let i = 0; i < 6; i++) {
      const col = i % 3
      const row = Math.floor(i / 3)
      const px = (col - 1) * 1.95
      const pz = (row - 0.5) * 1.85 - 0.15

      const planter = new THREE.Mesh(planterOuterGeo, stoneMat)
      planter.position.set(px, 0.19, pz)
      planter.castShadow = true
      planter.receiveShadow = true
      this.root.add(planter)

      const planterRim = new THREE.Mesh(planterRimGeo, goldMat)
      planterRim.position.set(px, 0.35, pz)
      this.root.add(planterRim)

      const soil = new THREE.Mesh(soilGeo, soilMat)
      soil.position.set(px, 0.36, pz)
      this.root.add(soil)

      const plantGroup = new THREE.Group()
      plantGroup.position.set(px, 0.39, pz)
      this.root.add(plantGroup)
      this.plotPlantGroups.push(plantGroup)
    }
  }

  public syncPlots(plots: Array<{ plotIndex: number; seedId: string | null; stage: number }>) {
    for (let i = 0; i < this.plotPlantGroups.length; i++) {
      const g = this.plotPlantGroups[i]!
      while (g.children.length > 0) {
        const child = g.children[0] as THREE.Mesh
        if (child.geometry) child.geometry.dispose()
        g.remove(child)
      }

      const info = plots.find(p => p.plotIndex === i)
      if (!info || !info.seedId || info.stage <= 0) continue

      this.buildPlantForStage(g, info.seedId, info.stage)
    }
  }

  private buildPlantForStage(target: THREE.Group, seedId: string, stage: number) {
    const mats = FlatMaterialFactory.getInstance()
    const foliageMat = mats.get('leaf')
    const lightFoliageMat = mats.get('grass')
    const woodMat = mats.get('trunk')
    const goldMat = mats.emissive('gold')
    const lotusMat = new THREE.MeshLambertMaterial({ color: 0xf08fb0, flatShading: true })

    // Stage 1: Chồi mầm xanh rõ nét trên mặt đất
    if (stage === 1) {
      const sprout = new THREE.Mesh(LowPolyBuilder.cone(0.14, 0.36, 6), lightFoliageMat)
      sprout.position.y = 0.18
      target.add(sprout)
      return
    }

    if (seedId === 'seed_bamboo') {
      const culmCount = stage >= 3 ? 4 : 2
      const h = stage === 2 ? 0.85 : stage === 3 ? 1.45 : 2.05
      for (let c = 0; c < culmCount; c++) {
        const angle = (c / culmCount) * Math.PI * 2
        const cx = Math.cos(angle) * 0.16
        const cz = Math.sin(angle) * 0.16
        const stem = new THREE.Mesh(LowPolyBuilder.cylinder(0.05, 0.06, h, 6), foliageMat)
        stem.position.set(cx, h * 0.5, cz)
        target.add(stem)

        const leafCrown = new THREE.Mesh(
          LowPolyBuilder.sphere(stage >= 4 ? 0.34 : 0.24, 1),
          stage >= 4 ? goldMat : lightFoliageMat
        )
        leafCrown.position.set(cx, h, cz)
        target.add(leafCrown)
      }
      return
    }

    if (seedId === 'seed_bodhi') {
      const trunkH = stage === 2 ? 0.55 : stage === 3 ? 0.92 : 1.28
      const trunk = new THREE.Mesh(LowPolyBuilder.cylinder(0.08, 0.13, trunkH, 6), woodMat)
      trunk.position.y = trunkH * 0.5
      target.add(trunk)

      const canopyR = stage === 2 ? 0.34 : stage === 3 ? 0.52 : 0.68
      const canopy = new THREE.Mesh(LowPolyBuilder.sphere(canopyR, 1), foliageMat)
      canopy.position.y = trunkH + canopyR * 0.65
      target.add(canopy)

      if (stage >= 4) {
        const halo = new THREE.Mesh(LowPolyBuilder.sphere(0.22, 1), goldMat)
        halo.position.y = trunkH + canopyR * 1.35
        target.add(halo)
      }
      return
    }

    // Mặc định: seed_lotus (Sen Hồng)
    const pad = new THREE.Mesh(LowPolyBuilder.cylinder(0.42, 0.42, 0.04, 10), foliageMat)
    pad.position.y = 0.05
    target.add(pad)

    const stemH = stage === 2 ? 0.48 : stage === 3 ? 0.72 : 0.96
    const stem = new THREE.Mesh(LowPolyBuilder.cylinder(0.04, 0.045, stemH, 6), lightFoliageMat)
    stem.position.y = stemH * 0.5
    target.add(stem)

    if (stage >= 4) {
      const bloom = new THREE.Mesh(LowPolyBuilder.sphere(0.18, 1), lotusMat)
      bloom.position.y = stemH + 0.08
      target.add(bloom)
      const aura = new THREE.Mesh(LowPolyBuilder.cylinder(0.46, 0.46, 0.02, 12), goldMat)
      aura.position.y = 0.02
      target.add(aura)
    }

    const budR = stage === 2 ? 0.15 : stage === 3 ? 0.24 : 0.34
    const bloom = new THREE.Mesh(LowPolyBuilder.cone(budR, budR * 1.4, 8), lotusMat)
    bloom.position.y = stemH + budR * 0.5
    target.add(bloom)

    if (stage >= 4) {
      const pistil = new THREE.Mesh(LowPolyBuilder.sphere(0.12, 1), goldMat)
      pistil.position.y = stemH + budR * 0.9
      target.add(pistil)
    }
  }
}
