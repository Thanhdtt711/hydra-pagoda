import * as THREE from 'three'
import { CollisionWorld, CylinderCollider } from '../collision'
import { LowPolyBuilder, type ColoredPart } from '../style/LowPolyBuilder'
import { FlatMaterialFactory } from '../style/FlatMaterialFactory'

/**
 * BodhiChessTableProp (Bàn Cờ Đá Dưới Bóng Bồ Đề):
 * - Đặt dưới tán Cây Bồ Đề Cổ Thụ (x = -7.4, z = 9.2).
 * - Gồm bàn đá tròn chạm khắc, bàn cờ gỗ sơn mài với quân cờ & đá cuội Ô Ăn Quan,
 *   cùng 2 đôn đá ngồi đối diện nhau.
 * - Điểm nhấn thu hút người chơi: vòng sáng vàng dưới đất nhấp nhô và viên ngọc vàng nổi xoay.
 */
export class BodhiChessTableProp {
  public root = new THREE.Group()
  public readonly centerPos = new THREE.Vector3(9.0, 0.0, 12.5)
  public readonly interactPos = new THREE.Vector3(9.0, 0.6, 12.5)

  private ringMesh!: THREE.Mesh
  private ringMat!: THREE.MeshBasicMaterial

  constructor(collisionWorld?: CollisionWorld) {
    this.root.name = 'BodhiChessTableProp'
    this.buildTable()
    this.buildHighlight()

    if (collisionWorld) {
      this.registerColliders(collisionWorld)
    }
  }

  private buildHighlight(): void {
    const cx = this.centerPos.x
    const cz = this.centerPos.z

    // Vòng sáng vàng trên mặt đất bao quanh cả bàn và 2 đôn
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xe3b84f,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    this.ringMesh = new THREE.Mesh(new THREE.RingGeometry(1.75, 2.0, 40), this.ringMat)
    this.ringMesh.rotation.x = -Math.PI / 2
    this.ringMesh.position.set(cx, 0.04, cz)
    this.root.add(this.ringMesh)
  }

  /** Nhấp nhô vòng sáng */
  public update(elapsed: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.4)
    this.ringMat.opacity = 0.35 + pulse * 0.4
    const s = 1 + pulse * 0.06
    this.ringMesh.scale.set(s, s, 1)
  }

  private buildTable(): void {
    const parts: ColoredPart[] = []
    const cx = this.centerPos.x
    const cz = this.centerPos.z

    const stoneDark = 0x7c756b
    const stoneLight = 0xa39b8e
    const goldColor = 0xc9a24b
    const woodBoard = 0x5c371d
    const redPiece = 0xb8372b
    const inkPiece = 0x1d1916
    const pebbleColor = 0xd9cdb8
    const matCrimson = 0x6b2019

    // Thảm chiếu tròn sơn mài đỏ son viền vàng thếp lót dưới chân bàn và 2 đôn đá
    parts.push({
      geometry: LowPolyBuilder.cylinder(1.68, 1.72, 0.024, 20),
      color: goldColor,
      position: [cx, 0.012, cz]
    })
    parts.push({
      geometry: LowPolyBuilder.cylinder(1.58, 1.60, 0.03, 20),
      color: matCrimson,
      position: [cx, 0.018, cz]
    })

    // Đế trụ đá & thân trụ bàn
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.45, 0.56, 0.16, 8),
      color: stoneDark,
      position: [cx, 0.08, cz]
    })
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.24, 0.30, 0.54, 8),
      color: stoneDark,
      position: [cx, 0.43, cz]
    })

    // Mặt bàn đá tròn + viền vàng thếp
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.76, 0.72, 0.10, 12),
      color: stoneLight,
      position: [cx, 0.74, cz]
    })
    parts.push({
      geometry: LowPolyBuilder.cylinder(0.78, 0.78, 0.025, 12),
      color: goldColor,
      position: [cx, 0.79, cz]
    })

    // Bàn cờ gỗ sơn mài đặt trên mặt bàn
    parts.push({
      geometry: LowPolyBuilder.box(0.68, 0.035, 0.78),
      color: woodBoard,
      position: [cx, 0.815, cz]
    })

    // Các quân cờ đỏ / đen & sỏi Ô Ăn Quan tượng trưng trên mặt bàn
    const redCoords: Array<[number, number]> = [
      [-0.22, 0.28],
      [0.0, 0.28],
      [0.22, 0.28],
      [-0.12, 0.15],
      [0.14, 0.18]
    ]
    for (const [ox, oz] of redCoords) {
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.035, 0.035, 0.022, 8),
        color: redPiece,
        position: [cx + ox, 0.844, cz + oz]
      })
    }

    const inkCoords: Array<[number, number]> = [
      [-0.22, -0.28],
      [0.0, -0.28],
      [0.22, -0.28],
      [-0.14, -0.16],
      [0.12, -0.18]
    ]
    for (const [ox, oz] of inkCoords) {
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.035, 0.035, 0.022, 8),
        color: inkPiece,
        position: [cx + ox, 0.844, cz + oz]
      })
    }

    // Vài viên sỏi trắng bên mép bàn
    for (const [ox, oz] of [
      [-0.45, 0.05],
      [-0.48, -0.04],
      [0.46, 0.04]
    ] as Array<[number, number]>) {
      parts.push({
        geometry: LowPolyBuilder.sphere(0.028, 0),
        color: pebbleColor,
        position: [cx + ox, 0.82, cz + oz]
      })
    }

    // 2 đôn đá ngồi hai bên bàn cờ
    for (const sz of [-1.05, 1.05]) {
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.24, 0.28, 0.42, 8),
        color: stoneDark,
        position: [cx, 0.21, cz + sz]
      })
      parts.push({
        geometry: LowPolyBuilder.cylinder(0.27, 0.26, 0.06, 8),
        color: stoneLight,
        position: [cx, 0.44, cz + sz]
      })
    }

    const merged = LowPolyBuilder.mergeColored(parts)
    const mesh = new THREE.Mesh(merged, FlatMaterialFactory.getInstance().vertexColor())
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.root.add(mesh)
  }

  private registerColliders(world: CollisionWorld): void {
    world.add(
      new CylinderCollider(
        'bodhi_chess_table',
        new THREE.Vector3(this.centerPos.x, 0.55, this.centerPos.z),
        0.82,
        1.1,
        false
      )
    )
  }

  public dispose(): void {
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
      }
    })
    this.ringMat.dispose()
  }
}

