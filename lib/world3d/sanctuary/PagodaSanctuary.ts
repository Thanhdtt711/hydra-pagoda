import * as THREE from 'three'
import { CollisionWorld, BoxCollider, CylinderCollider } from '../collision'
import { HallLayout, type MeditationSlot, type SanctuaryDoor } from '../world/HallLayout'
import { SacredBuddhaStatue } from './SacredBuddhaStatue'
import type { PBRMaterialFactory } from '../materials/PBRMaterialFactory'

/**
 * Procedural texture helpers for Sanctuary Hall
 */
function createInteriorWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#24130c'
  ctx.fillRect(0, 0, 512, 512)

  // Subtle wood planks
  for (let y = 0; y < 512; y += 32) {
    ctx.fillStyle = y % 64 === 0 ? '#1e0f09' : '#2b160e'
    ctx.fillRect(0, y, 512, 30)

    // Wood grain fibers
    ctx.strokeStyle = '#150a06'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x < 512; x += 16) {
      const offset = (Math.sin(x * 0.05 + y * 0.1) * 3)
      ctx.moveTo(x, y + offset)
      ctx.lineTo(x + 14, y + 28 + offset)
    }
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(8, 6)
  return tex
}

function createMeditationMatTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  // Natural woven rush / cói bồ đoàn thiền định
  ctx.fillStyle = '#c8a86b'
  ctx.fillRect(0, 0, 256, 256)

  // Concentric woven spiral rings
  ctx.strokeStyle = '#9d7c43'
  ctx.lineWidth = 3
  for (let r = 10; r < 120; r += 8) {
    ctx.beginPath()
    ctx.arc(128, 128, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // Border stitch
  ctx.strokeStyle = '#7c2818'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(128, 128, 122, 0, Math.PI * 2)
  ctx.stroke()

  return new THREE.CanvasTexture(canvas)
}

function createPlaqueTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#6b1116'
  ctx.fillRect(0, 0, 512, 128)

  ctx.strokeStyle = '#d4af37'
  ctx.lineWidth = 6
  ctx.strokeRect(8, 8, 496, 112)

  ctx.font = 'bold 36px "Cinzel", "Times New Roman", serif'
  ctx.fillStyle = '#ffd700'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ĐẠI HÙNG BẢO ĐIỆN', 256, 64)

  return new THREE.CanvasTexture(canvas)
}

/**
 * Sinh hình học mái cong đầu đao truyền thống Việt Nam (Curved Hip Pagoda Roof)
 */
function createCurvedHipRoofGeometry(
  baseW: number,
  baseD: number,
  height: number,
  ridgeW: number,
  ridgeD: number,
  eaveLift: number
): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const segments = 8

  // Helper tạo 1 diện mái cong tứ giác
  const addRoofFace = (
    bottomLeft: [number, number],
    bottomRight: [number, number],
    topLeft: [number, number],
    topRight: [number, number],
    isEastWest: boolean
  ) => {
    const startIndex = positions.length / 3

    for (let row = 0; row <= segments; row++) {
      const t = row / segments // 0 (eave) -> 1 (ridge)
      const yNorm = Math.pow(t, 1.35)
      const baseHeightAtRow = yNorm * height

      for (let col = 0; col <= segments; col++) {
        const s = (col / segments) * 2.0 - 1.0 // -1 -> +1

        // Nội suy tọa độ mặt bằng (X, Z)
        const leftX = THREE.MathUtils.lerp(bottomLeft[0], topLeft[0], t)
        const leftZ = THREE.MathUtils.lerp(bottomLeft[1], topLeft[1], t)
        const rightX = THREE.MathUtils.lerp(bottomRight[0], topRight[0], t)
        const rightZ = THREE.MathUtils.lerp(bottomRight[1], topRight[1], t)

        const uCol = (s + 1.0) * 0.5
        const vx = THREE.MathUtils.lerp(leftX, rightX, uCol)
        const vz = THREE.MathUtils.lerp(leftZ, rightZ, uCol)

        // Độ vểnh cong đầu đao ở 4 góc mái (t = 0, s = +-1)
        const cornerFactor = Math.pow(Math.abs(s), 2.2) * Math.pow(1.0 - t, 1.8)
        const vy = baseHeightAtRow + cornerFactor * eaveLift

        positions.push(vx, vy, vz)
        uvs.push(uCol * (isEastWest ? 4 : 8), t * 4)
        normals.push(0, 1, 0) // Sẽ tính lại sau
      }
    }

    // Kết nối lưới tứ giác thành tam giác
    const colsCount = segments + 1
    for (let r = 0; r < segments; r++) {
      for (let c = 0; c < segments; c++) {
        const i0 = startIndex + r * colsCount + c
        const i1 = i0 + 1
        const i2 = startIndex + (r + 1) * colsCount + c
        const i3 = i2 + 1

        indices.push(i0, i2, i1)
        indices.push(i1, i2, i3)
      }
    }
  }

  // 1. Mái Nam (Mặt tiền)
  addRoofFace(
    [-baseW * 0.5, baseD * 0.5],
    [baseW * 0.5, baseD * 0.5],
    [-ridgeW * 0.5, ridgeD * 0.5],
    [ridgeW * 0.5, ridgeD * 0.5],
    false
  )

  // 2. Mái Bắc (Hậu điện)
  addRoofFace(
    [baseW * 0.5, -baseD * 0.5],
    [-baseW * 0.5, -baseD * 0.5],
    [ridgeW * 0.5, -ridgeD * 0.5],
    [-ridgeW * 0.5, -ridgeD * 0.5],
    false
  )

  // 3. Mái Tây (Hông trái)
  addRoofFace(
    [-baseW * 0.5, -baseD * 0.5],
    [-baseW * 0.5, baseD * 0.5],
    [-ridgeW * 0.5, -ridgeD * 0.5],
    [-ridgeW * 0.5, ridgeD * 0.5],
    true
  )

  // 4. Mái Đông (Hông phải)
  addRoofFace(
    [baseW * 0.5, baseD * 0.5],
    [baseW * 0.5, -baseD * 0.5],
    [ridgeW * 0.5, -ridgeD * 0.5],
    [ridgeW * 0.5, -ridgeD * 0.5],
    true
  )

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()

  return geo
}

export interface SanctuaryDoorInstance {
  data: SanctuaryDoor
  pivotLeft: THREE.Group
  pivotRight: THREE.Group
  collider: BoxCollider
  isOpen: boolean
  currentAngle: number
}

/**
 * PagodaSanctuaryHall:
 * Đại Hùng Bảo Điện quy mô lớn 40m x 30m (1.200 m² sàn thông thủy).
 * Chứa đúng 500 chỗ ngồi thiền định bồ đoàn (InstancedMesh 1 draw call).
 * 3 cửa chính mặt Nam + 2 cửa phụ hông. Mái tầng cong đầu đao.
 * Tôn tượng Phật Thích Ca Mâu Ni mạ vàng uy nghiêm trung tâm.
 */
export class PagodaSanctuaryHall {
  public group: THREE.Group
  public buddhaStatue: SacredBuddhaStatue
  private materialsFactory: PBRMaterialFactory | null = null

  // Hệ thống cửa bức bàn tương tác
  public doors: Map<string, SanctuaryDoorInstance> = new Map()
  public doorAngle = 0 // Tương thích API cũ
  public doorTargetAngle = 0
  public isDoorManual = false

  // Điểm sáng nội thất (tối đa 4 PointLight không shadow)
  public interiorLights: THREE.PointLight[] = []
  public interiorFactor = 0

  // 500 Đệm thiền InstancedMesh
  public meditationMatsMesh: THREE.InstancedMesh

  public get buddhaGroup(): THREE.Group {
    return this.buddhaStatue.root
  }

  public get mandalaHalo(): THREE.Mesh {
    return this.buddhaStatue.haloMesh
  }

  public registerColliders(collisionWorld: CollisionWorld) {
    if (collisionWorld.has('hall_terrace_floor')) return
    // Đăng ký sàn bệ nền & bậc thang chuẩn hóa (mỗi bậc <= 0.17m)
    collisionWorld.add(
      new BoxCollider(
        'hall_terrace_floor',
        new THREE.Vector3(0, 0.675, HallLayout.BOUNDS.center.z),
        new THREE.Vector3(45.5, 1.35, 35.5),
        false,
        true,
        1.35
      )
    )

    const stepsCount = 8
    const stairWidth = 14.0
    const stairTotalDepth = 3.2
    const stepH = 1.35 / stepsCount
    const stepD = stairTotalDepth / stepsCount
    const centerZ = HallLayout.BOUNDS.center.z

    for (let i = 0; i < stepsCount; i++) {
      const floorY = (i + 1) * stepH
      const relZ = 18.0 + (stepsCount - 1 - i + 0.5) * stepD
      collisionWorld.add(
        new BoxCollider(
          `hall_front_step_${i}`,
          new THREE.Vector3(0, floorY * 0.5, centerZ + relZ),
          new THREE.Vector3(stairWidth, floorY, stepD + 0.04),
          false,
          true,
          floorY
        )
      )
    }
  }

  constructor(materialsFactory?: PBRMaterialFactory, collisionWorld?: CollisionWorld) {
    this.group = new THREE.Group()
    this.group.name = 'PagodaSanctuaryHall'
    this.materialsFactory = materialsFactory || null

    const center = HallLayout.BOUNDS.center
    this.group.position.set(center.x, 0, center.z)

    // Khởi tạo tượng Phật trung tâm
    this.buddhaStatue = new SacredBuddhaStatue(this.materialsFactory as any)

    // 1. Bệ nền đài tam cấp & thềm đá 46x36m
    this.buildGrandTerraceAndSteps(collisionWorld)

    // 2. Sàn gỗ thông thủy 40x30m
    this.buildInteriorFloor(collisionWorld)

    // 3. Hệ cột cái & cột quân gỗ lim
    this.buildTimberColonnade(collisionWorld)

    // 4. Tường bao & 5 Cửa bức bàn
    this.buildWallsAndDoors(collisionWorld)

    // 5. Mái tầng chồng diêm cong đao vút góc
    this.buildCurvedRoofs()

    // 6. Ban thờ Tam Bảo & Tôn tượng Phật
    this.buildSacredAltar(collisionWorld)

    // 7. 500 Đệm thiền bồ đoàn InstancedMesh
    this.meditationMatsMesh = this.build500MeditationMats()

    // 8. Ánh sáng nội thất trang nghiêm (≤ 4 PointLights không bóng)
    this.setupInteriorLighting()
  }

  /**
   * 1. Bệ nền đài tam cấp đá hoa cương 46m x 36m (y = 1.35)
   */
  private buildGrandTerraceAndSteps(collision?: CollisionWorld) {
    const stoneMat = this.materialsFactory
      ? this.materialsFactory.createGraniteStepMaterial()
      : new THREE.MeshStandardMaterial({ color: 0x383a42, roughness: 0.88 })

    // Bệ nền chính 46m x 36m x 1.35m
    const baseGeo = new THREE.BoxGeometry(46.0, 1.35, 36.0)
    const baseMesh = new THREE.Mesh(baseGeo, stoneMat)
    baseMesh.position.set(0, 0.675, 0)
    baseMesh.receiveShadow = true
    baseMesh.castShadow = true
    this.group.add(baseMesh)

    // Bậc tam cấp chính mặt Nam đón 500 hành giả vào điện (8 bậc chuẩn hóa <= 0.17m mỗi bậc)
    const stepsCount = 8
    const stairWidth = 14.0
    const stairTotalDepth = 3.2
    const stepH = 1.35 / stepsCount
    const stepD = stairTotalDepth / stepsCount

    for (let i = 0; i < stepsCount; i++) {
      const y = (i + 0.5) * stepH
      const z = 18.0 + (stepsCount - 1 - i + 0.5) * stepD

      const step = new THREE.Mesh(new THREE.BoxGeometry(stairWidth, stepH, stepD + 0.02), stoneMat)
      step.position.set(0, y, z)
      step.receiveShadow = true
      this.group.add(step)
    }

    if (collision) {
      // Đăng ký sàn bệ nền là sàn đi lại được (isFloor: true, floorY: 1.35)
      collision.add(
        new BoxCollider(
          'hall_terrace_floor',
          new THREE.Vector3(0, 0.675, HallLayout.BOUNDS.center.z),
          new THREE.Vector3(45.5, 1.35, 35.5),
          false,
          true,
          1.35
        )
      )

      // 8 Bậc thang tam cấp chuẩn hóa cho collider (bước lên nhẹ nhàng không cần nhảy)
      const centerZ = HallLayout.BOUNDS.center.z
      for (let i = 0; i < stepsCount; i++) {
        const floorY = (i + 1) * stepH
        const relZ = 18.0 + (stepsCount - 1 - i + 0.5) * stepD
        collision.add(
          new BoxCollider(
            `hall_front_step_${i}`,
            new THREE.Vector3(0, floorY * 0.5, centerZ + relZ),
            new THREE.Vector3(stairWidth, floorY, stepD + 0.04),
            false,
            true,
            floorY
          )
        )
      }
    }
  }

  /**
   * 2. Sàn gỗ thông thủy 40m x 30m trong lòng điện
   */
  private buildInteriorFloor(collision?: CollisionWorld) {
    const woodTex = createInteriorWoodTexture()
    const floorMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.55,
      metalness: 0.08
    })

    const floorGeo = new THREE.BoxGeometry(40.0, 0.1, 30.0)
    const floorMesh = new THREE.Mesh(floorGeo, floorMat)
    floorMesh.position.set(0, 1.35, 0)
    floorMesh.receiveShadow = true
    this.group.add(floorMesh)
  }

  /**
   * 3. Hệ cột cái & cột quân gỗ lim
   */
  private buildTimberColonnade(collision?: CollisionWorld) {
    const colMat = this.materialsFactory
      ? this.materialsFactory.createIronwoodMaterial()
      : new THREE.MeshStandardMaterial({ color: 0x22130e, roughness: 0.72 })

    // Các hàng cột chính bố trí chuẩn bước cột 8m (không nằm trong 500 đệm ngồi)
    const colXList = [-19.2, -11.5, 11.5, 19.2]
    const colZList = [-14.0, -6.0, 2.0, 10.0, 14.0]

    let colIdx = 0
    for (const cx of colXList) {
      for (const cz of colZList) {
        // Cột gỗ lim tròn (đường kính 0.75m, cao 9.5m)
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 9.5, 16), colMat)
        col.position.set(cx, 1.35 + 4.75, cz)
        col.castShadow = true
        col.receiveShadow = true
        this.group.add(col)

        if (collision) {
          collision.add(
            new CylinderCollider(
              `hall_col_${colIdx++}`,
              new THREE.Vector3(cx, 1.35 + 4.75, HallLayout.BOUNDS.center.z + cz),
              0.42,
              9.5,
              false
            )
          )
        }
      }
    }
  }

  /**
   * 4. Tường bao quanh & 5 Cửa bức bàn
   */
  private buildWallsAndDoors(collision?: CollisionWorld) {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2a140f,
      roughness: 0.82,
      metalness: 0.05
    })
    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x5a1818, // Sơn son son đỏ truyền thống
      roughness: 0.48,
      metalness: 0.12
    })

    const wallH = 6.2
    const wallY = 1.35 + wallH * 0.5
    const zOffset = HallLayout.BOUNDS.center.z

    // Tường Hậu (Bắc, Z = -15m trong hệ tọa độ group)
    const wallNorth = new THREE.Mesh(new THREE.BoxGeometry(40.0, wallH, 0.6), wallMat)
    wallNorth.position.set(0, wallY, -15.0)
    wallNorth.castShadow = true
    this.group.add(wallNorth)

    if (collision) {
      collision.add(
        new BoxCollider('hall_wall_north', new THREE.Vector3(0, wallY, zOffset - 15.0), new THREE.Vector3(40.0, wallH, 0.6), false)
      )
    }

    // Tường Tây (X = -20m) & Tường Đông (X = +20m) chừa cửa phụ
    for (const isWest of [true, false]) {
      const wx = isWest ? -20.0 : 20.0
      const sideName = isWest ? 'west' : 'east'

      // Đoạn tường trước cửa phụ (z = 0 -> 15m)
      const wallFront = new THREE.Mesh(new THREE.BoxGeometry(0.6, wallH, 13.5), wallMat)
      wallFront.position.set(wx, wallY, 7.5)
      this.group.add(wallFront)

      // Đoạn tường sau cửa phụ (z = -15 -> -2.5m)
      const wallBack = new THREE.Mesh(new THREE.BoxGeometry(0.6, wallH, 12.5), wallMat)
      wallBack.position.set(wx, wallY, -8.5)
      this.group.add(wallBack)

      if (collision) {
        collision.add(new BoxCollider(`hall_wall_${sideName}_front`, new THREE.Vector3(wx, wallY, zOffset + 7.5), new THREE.Vector3(0.6, wallH, 13.5), false))
        collision.add(new BoxCollider(`hall_wall_${sideName}_back`, new THREE.Vector3(wx, wallY, zOffset - 8.5), new THREE.Vector3(0.6, wallH, 12.5), false))
      }
    }

    // Tường Mặt Tiền (Nam, Z = +15m) chừa 3 cửa chính
    // Đoạn vách bìa Tây (X: -20 đến -8.5)
    const wFrontL = new THREE.Mesh(new THREE.BoxGeometry(11.5, wallH, 0.6), wallMat)
    wFrontL.position.set(-14.25, wallY, 15.0)
    this.group.add(wFrontL)

    // Đoạn vách giữa Tây (X: -4.5 đến -2.2)
    const wFrontML = new THREE.Mesh(new THREE.BoxGeometry(2.3, wallH, 0.6), wallMat)
    wFrontML.position.set(-3.35, wallY, 15.0)
    this.group.add(wFrontML)

    // Đoạn vách giữa Đông (X: 2.2 đến 4.5)
    const wFrontMR = new THREE.Mesh(new THREE.BoxGeometry(2.3, wallH, 0.6), wallMat)
    wFrontMR.position.set(3.35, wallY, 15.0)
    this.group.add(wFrontMR)

    // Đoạn vách bìa Đông (X: 8.5 đến 20)
    const wFrontR = new THREE.Mesh(new THREE.BoxGeometry(11.5, wallH, 0.6), wallMat)
    wFrontR.position.set(14.25, wallY, 15.0)
    this.group.add(wFrontR)

    if (collision) {
      collision.add(new BoxCollider('hall_wall_front_l', new THREE.Vector3(-14.25, wallY, zOffset + 15.0), new THREE.Vector3(11.5, wallH, 0.6), false))
      collision.add(new BoxCollider('hall_wall_front_ml', new THREE.Vector3(-3.35, wallY, zOffset + 15.0), new THREE.Vector3(2.3, wallH, 0.6), false))
      collision.add(new BoxCollider('hall_wall_front_mr', new THREE.Vector3(3.35, wallY, zOffset + 15.0), new THREE.Vector3(2.3, wallH, 0.6), false))
      collision.add(new BoxCollider('hall_wall_front_r', new THREE.Vector3(14.25, wallY, zOffset + 15.0), new THREE.Vector3(11.5, wallH, 0.6), false))
    }

    // Xây dựng 5 Cửa Bức Bàn (3 mặt tiền + 2 hông)
    const doorList = HallLayout.DOORS
    for (const d of doorList) {
      const pivotL = new THREE.Group()
      const pivotR = new THREE.Group()

      const halfW = d.width * 0.5
      const leafW = halfW * 0.98

      // Cánh cửa bức bàn trái
      const leafL = new THREE.Mesh(new THREE.BoxGeometry(leafW, d.height, 0.12), doorMat)
      leafL.position.set(leafW * 0.5, d.height * 0.5, 0)
      leafL.castShadow = true
      pivotL.add(leafL)

      // Cánh cửa bức bàn phải
      const leafR = new THREE.Mesh(new THREE.BoxGeometry(leafW, d.height, 0.12), doorMat)
      leafR.position.set(-leafW * 0.5, d.height * 0.5, 0)
      leafR.castShadow = true
      pivotR.add(leafR)

      // Đặt pivot tại 2 bên mép khuôn cửa
      if (d.isMain) {
        pivotL.position.set(d.position.x - halfW, 1.35, 15.0)
        pivotR.position.set(d.position.x + halfW, 1.35, 15.0)
      } else {
        // Cửa hông quay 90 độ
        pivotL.rotation.y = Math.PI * 0.5
        pivotR.rotation.y = Math.PI * 0.5
        pivotL.position.set(d.position.x, 1.35, -d.position.z - halfW)
        pivotR.position.set(d.position.x, 1.35, -d.position.z + halfW)
      }

      this.group.add(pivotL)
      this.group.add(pivotR)

      // Collider động cho cửa
      const doorCollider = new BoxCollider(
        `door_collider_${d.id}`,
        new THREE.Vector3(d.position.x, 1.35 + d.height * 0.5, d.position.z),
        new THREE.Vector3(d.width, d.height, 0.4),
        false
      )
      if (collision) {
        collision.add(doorCollider)
      }

      this.doors.set(d.id, {
        data: d,
        pivotLeft: pivotL,
        pivotRight: pivotR,
        collider: doorCollider,
        isOpen: false,
        currentAngle: 0
      })
    }

    // Biển đại tự "ĐẠI HÙNG BẢO ĐIỆN" treo chính giữa mặt tiền
    const plaqueTex = createPlaqueTexture()
    const plaqueMat = new THREE.MeshBasicMaterial({ map: plaqueTex })
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), plaqueMat)
    plaque.position.set(0, 1.35 + 5.2, 15.35)
    this.group.add(plaque)
  }

  /**
   * 5. Mái tầng chồng diêm cong đao vút góc (Double-tier Curved Hip Pagoda Roof)
   */
  private buildCurvedRoofs() {
    const tileMat = this.materialsFactory
      ? this.materialsFactory.createYinYangRoofMaterial()
      : new THREE.MeshStandardMaterial({ color: 0x42181d, roughness: 0.75 })

    // Tầng mái 1 (Mái hạ hiên xòe rộng 48m x 38m, cao 4.2m)
    const lowerRoofGeo = createCurvedHipRoofGeometry(
      48.0, 38.0, 4.2, 34.0, 24.0, 1.8
    )
    const lowerRoof = new THREE.Mesh(lowerRoofGeo, tileMat)
    lowerRoof.position.set(0, 1.35 + 5.8, 0)
    lowerRoof.castShadow = true
    lowerRoof.receiveShadow = true
    this.group.add(lowerRoof)

    // Cổ diêm / Cổ các ngăn giữa 2 tầng mái (34m x 24m x 1.8m)
    const neckMat = new THREE.MeshStandardMaterial({ color: 0x22130e, roughness: 0.7 })
    const neck = new THREE.Mesh(new THREE.BoxGeometry(32.0, 1.8, 22.0), neckMat)
    neck.position.set(0, 1.35 + 8.8, 0)
    neck.castShadow = true
    this.group.add(neck)

    // Tầng mái 2 (Mái thượng vút cao 36m x 26m, cao 5.5m, đầu đao cong 2.4m)
    const upperRoofGeo = createCurvedHipRoofGeometry(
      36.0, 26.0, 5.5, 20.0, 1.0, 2.4
    )
    const upperRoof = new THREE.Mesh(upperRoofGeo, tileMat)
    upperRoof.position.set(0, 1.35 + 9.8, 0)
    upperRoof.castShadow = true
    upperRoof.receiveShadow = true
    this.group.add(upperRoof)

    // Bờ nóc & Hạt minh châu / Bình cam lồ mạ vàng trên đỉnh nóc điện
    const finialMat = this.materialsFactory
      ? this.materialsFactory.createSacredGoldLeafMaterial()
      : new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.85, roughness: 0.25 })

    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.45, 1.6, 12), finialMat)
    finial.position.set(0, 1.35 + 15.8, 0)
    finial.castShadow = true
    this.group.add(finial)
  }

  /**
   * 6. Ban thờ Tam Bảo & Tôn tượng Phật Thích Ca Mâu Ni
   */
  private buildSacredAltar(collision?: CollisionWorld) {
    const altarMat = new THREE.MeshStandardMaterial({
      color: 0x421116, // Sơn then đỏ son
      roughness: 0.35,
      metalness: 0.18
    })

    // Bàn thờ Tam Bảo 3 tầng (Rộng 12m, Sâu 4.5m)
    const altarGroup = new THREE.Group()
    altarGroup.position.set(0, 1.35, -10.5)

    const altar1 = new THREE.Mesh(new THREE.BoxGeometry(12.0, 0.9, 4.2), altarMat)
    altar1.position.set(0, 0.45, 0)
    altar1.castShadow = true
    altarGroup.add(altar1)

    const altar2 = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.8, 3.8), altarMat)
    altar2.position.set(0, 1.3, -0.2)
    altar2.castShadow = true
    altarGroup.add(altar2)

    // Gắn tôn tượng Phật Thích Ca Mâu Ni 3D GLB lên đài sen tầng cao nhất
    this.buddhaStatue.root.position.set(0, 1.7, -0.2)
    altarGroup.add(this.buddhaStatue.root)

    this.group.add(altarGroup)

    if (collision) {
      collision.add(
        new BoxCollider(
          'hall_altar_collider',
          new THREE.Vector3(0, 1.35 + 1.2, HallLayout.BOUNDS.center.z - 10.5),
          new THREE.Vector3(12.2, 2.4, 4.4),
          false
        )
      )
    }
  }

  /**
   * 7. 500 Đệm thiền bồ đoàn InstancedMesh (1 Draw Call duy nhất)
   */
  private build500MeditationMats(): THREE.InstancedMesh {
    const slots = HallLayout.getMeditationSlots()
    const count = slots.length

    // Đệm cói bồ đoàn tròn dẹt (Đường kính 0.85m, dày 0.08m)
    const matGeo = new THREE.CylinderGeometry(0.42, 0.44, 0.08, 16)
    const matTex = createMeditationMatTexture()
    const matMaterial = new THREE.MeshStandardMaterial({
      map: matTex,
      roughness: 0.85,
      metalness: 0.05
    })

    const instancedMats = new THREE.InstancedMesh(matGeo, matMaterial, count)
    instancedMats.receiveShadow = true
    instancedMats.castShadow = false

    const dummy = new THREE.Object3D()
    const center = HallLayout.BOUNDS.center

    for (let i = 0; i < count; i++) {
      const s = slots[i]
      // Chuyển từ tọa độ thế giới sang tọa độ local của group
      dummy.position.set(s.x - center.x, 1.35 + 0.04, s.z - center.z)
      dummy.rotation.set(0, s.yaw, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()

      instancedMats.setMatrixAt(i, dummy.matrix)
    }

    instancedMats.instanceMatrix.needsUpdate = true
    this.group.add(instancedMats)
    return instancedMats
  }

  /**
   * 8. Ánh sáng nội thất trang nghiêm (≤ 4 PointLights không bóng)
   */
  private setupInteriorLighting() {
    // 1. Ánh quang minh Phật điện (Ấm áp, trang nghiêm)
    const buddhaLight = new THREE.PointLight(0xffb040, 1.1, 18, 1.6)
    buddhaLight.position.set(0, 1.35 + 5.5, -9.5)
    buddhaLight.castShadow = false
    this.group.add(buddhaLight)
    this.interiorLights.push(buddhaLight)

    // 2. Đèn lồng sảnh Tây
    const westLight = new THREE.PointLight(0xff9838, 0.65, 16, 1.8)
    westLight.position.set(-10.0, 1.35 + 4.5, 0)
    westLight.castShadow = false
    this.group.add(westLight)
    this.interiorLights.push(westLight)

    // 3. Đèn lồng sảnh Đông
    const eastLight = new THREE.PointLight(0xff9838, 0.65, 16, 1.8)
    eastLight.position.set(10.0, 1.35 + 4.5, 0)
    eastLight.castShadow = false
    this.group.add(eastLight)
    this.interiorLights.push(eastLight)
  }

  /**
   * Đóng/mở cửa tương tác
   */
  public toggleDoor(doorId = 'door_main_center'): boolean {
    const door = this.doors.get(doorId)
    if (!door) return false
    this.isDoorManual = true
    door.isOpen = !door.isOpen
    // Đảo cờ va chạm
    door.collider.enabled = !door.isOpen
    return door.isOpen
  }

  /**
   * Kiểm tra tự động mở cửa khi người chơi đến gần
   */
  public checkDoorProximity(playerPos: THREE.Vector3) {
    if (this.isDoorManual) return

    for (const [id, door] of this.doors.entries()) {
      const dist = Math.hypot(playerPos.x - door.data.position.x, playerPos.z - door.data.position.z)
      const shouldOpen = dist < (door.data.isMain ? 4.5 : 3.0)
      if (door.isOpen !== shouldOpen) {
        door.isOpen = shouldOpen
        door.collider.enabled = !shouldOpen
      }
    }
  }

  /**
   * Kiểm tra người chơi có đang ở trong lòng Chánh Điện không (AABB 40x30m)
   */
  public isInside(playerPos: THREE.Vector3): boolean {
    const b = HallLayout.BOUNDS.interior
    return (
      playerPos.x >= b.minX &&
      playerPos.x <= b.maxX &&
      playerPos.z >= b.minZ &&
      playerPos.z <= b.maxZ &&
      playerPos.y >= 1.2
    )
  }

  /**
   * Cập nhật animation xoay cánh cửa & exposure transition
   */
  public update(delta: number, arg2?: number | THREE.Vector3, arg3?: THREE.Vector3) {
    const playerPos = arg3 instanceof THREE.Vector3 ? arg3 : (arg2 instanceof THREE.Vector3 ? arg2 : undefined)
    if (playerPos) {
      this.checkDoorProximity(playerPos)

      // Chuyển đổi exposure mượt mà khi bước vào/ra điện
      const targetFactor = this.isInside(playerPos) ? 1.0 : 0.0
      this.interiorFactor = THREE.MathUtils.lerp(this.interiorFactor, targetFactor, delta * 3.5)
    }

    // Animation mở cánh cửa mượt mà
    for (const door of this.doors.values()) {
      const target = door.isOpen ? 1.42 : 0.0 // Mở 81 độ vào trong
      door.currentAngle = THREE.MathUtils.lerp(door.currentAngle, target, delta * 6.0)

      door.pivotLeft.rotation.y = -door.currentAngle
      door.pivotRight.rotation.y = door.currentAngle
    }
  }

  public dispose() {
    if (this.buddhaStatue) {
      this.buddhaStatue.dispose()
    }
    this.group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        if (m.material) {
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose())
          else m.material.dispose()
        }
      }
    })
    this.doors.clear()
    this.interiorLights = []
  }
}
