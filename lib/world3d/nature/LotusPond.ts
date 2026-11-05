import * as THREE from 'three'
import type { PBRMaterialFactory } from '../materials/PBRMaterialFactory'
import { CollisionWorld, BoxCollider, CylinderCollider } from '../collision'
import { MapLayout } from '../world/MapLayout'

/**
 * Animated Lotus Pond Water Shader:
 * Realtime dual-layer wave ripples, deep jade aquatic absorption, Fresnel reflection, and caustics.
 */
export class LotusPond {
  public root: THREE.Group = new THREE.Group()
  private materials: PBRMaterialFactory
  private waterMesh: THREE.Mesh
  private waterMaterial: THREE.ShaderMaterial
  public floatingLanterns: THREE.Group[] = []
  public pondCenter = new THREE.Vector3(
    MapLayout.LANDMARKS.LOTUS_POND.center.x,
    MapLayout.LANDMARKS.LOTUS_POND.center.y,
    MapLayout.LANDMARKS.LOTUS_POND.center.z
  )
  public pondRadius = MapLayout.LANDMARKS.LOTUS_POND.radius || 6.5

  constructor(materials: PBRMaterialFactory, collision: CollisionWorld) {
    this.materials = materials
    this.root.position.copy(this.pondCenter)

    // 1. Hồ sen hình ô van / tròn tự nhiên với bờ đá hoa cương
    this.buildBasinAndCurb(collision)

    // 2. Mặt nước động sóng nước lăn tăn
    const { mesh, mat } = this.createAnimatedWaterSurface()
    this.waterMesh = mesh
    this.waterMaterial = mat
    this.root.add(this.waterMesh)

    // 3. Cầu đá vòm cong bắc ngang hồ sen (Đi lại được, có va chạm)
    this.buildArchedStoneBridge(collision)

    // 4. Hoa sen hồng nở rộ & Lá sen nổi bập bềnh
    this.buildLotusPlants()

    // 5. Đèn hoa đăng cầu an thả trôi trên mặt nước
    this.buildFloatingLanterns()
  }

  private buildBasinAndCurb(collision: CollisionWorld) {
    const graniteMat = this.materials.createGraniteStepMaterial()
    const r = this.pondRadius

    // Lòng hồ trũng sâu 1.2m
    const basinGeo = new THREE.CylinderGeometry(r, r - 0.7, 1.4, 32, 1, true)
    const basinMat = new THREE.MeshStandardMaterial({
      color: 0x18241e,
      roughness: 0.9,
      side: THREE.BackSide
    })
    const basin = new THREE.Mesh(basinGeo, basinMat)
    basin.position.y = -0.6
    this.root.add(basin)

    // Đáy bùn lắng hồ sen
    const bottomGeo = new THREE.CircleGeometry(r - 0.7, 32)
    const bottomMat = new THREE.MeshStandardMaterial({ color: 0x0f1813, roughness: 0.95 })
    const bottom = new THREE.Mesh(bottomGeo, bottomMat)
    bottom.rotation.x = -Math.PI / 2
    bottom.position.y = -1.28
    this.root.add(bottom)

    // Thành bờ đá hoa cương bo quanh hồ (Curb ring) - Gộp thành 8 nhóm collider vòng
    const segments = 24
    const curbDist = r + 0.1
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const nextAngle = ((i + 1) / segments) * Math.PI * 2
      const midAngle = (angle + nextAngle) * 0.5

      const cx = Math.cos(midAngle) * curbDist
      const cz = Math.sin(midAngle) * curbDist

      // Không đặt bờ đá chặn ngay lối vào 2 đầu cầu
      if (Math.abs(cx) < 2.0 && Math.abs(cz) > r - 1.2) continue

      const curbBlock = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.45, 0.55),
        graniteMat
      )
      curbBlock.position.set(cx, 0.15, cz)
      curbBlock.rotation.y = -midAngle
      curbBlock.castShadow = true
      curbBlock.receiveShadow = true
      this.root.add(curbBlock)
    }

    // Gộp Collider bảo vệ thành hồ thành 8 cung (giảm 66% số lượng collider so với 24 box riêng rẽ)
    const curbArcCount = 8
    for (let i = 0; i < curbArcCount; i++) {
      const angle = (i / curbArcCount) * Math.PI * 2
      // Chừa 2 cung ở đầu cầu Bắc (angle ~ -PI/2) và Nam (angle ~ PI/2)
      if (Math.abs(Math.sin(angle)) > 0.85) continue

      const arcX = Math.cos(angle) * curbDist
      const arcZ = Math.sin(angle) * curbDist
      collision.add(
        new BoxCollider(
          `pond_curb_grouped_${i}`,
          new THREE.Vector3(this.pondCenter.x + arcX, 0.25, this.pondCenter.z + arcZ),
          new THREE.Vector3(3.2, 0.65, 3.2),
          false
        )
      )
    }
  }

  private createAnimatedWaterSurface(): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial } {
    const geo = new THREE.CircleGeometry(this.pondRadius - 0.08, 48)

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        waterColor: { value: new THREE.Color(0x0a2e2b) }, // Xanh ngọc bích thiền tự
        shallowColor: { value: new THREE.Color(0x19574f) },
        sunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() }
      },
      vertexShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;

        void main() {
          vUv = uv;
          vec3 pos = position;
          // Sóng gợn lăn tăn nhẹ nhàng
          float wave1 = sin(pos.x * 2.5 + time * 1.8) * cos(pos.y * 2.5 + time * 1.5) * 0.028;
          float wave2 = sin(pos.x * 5.0 - time * 2.2 + pos.y * 3.0) * 0.015;
          pos.z += wave1 + wave2;

          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vWorldPosition = worldPos.xyz;
          vNormal = normalize(mat3(modelMatrix) * vec3(
            -cos(pos.x * 2.5 + time * 1.8) * 0.07,
            -sin(pos.y * 2.5 + time * 1.5) * 0.07,
            1.0
          ));
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 waterColor;
        uniform vec3 shallowColor;
        uniform vec3 sunDirection;
        uniform float time;
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec3 vNormal;

        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          vec3 norm = normalize(vNormal);

          // Fresnel reflectance: nhìn vuông góc trong xanh, nhìn nghiêng phản chiếu bầu trời
          float fresnel = pow(1.0 - max(dot(viewDir, norm), 0.0), 3.5);
          fresnel = clamp(fresnel, 0.15, 0.85);

          // Specular ánh mặt trời / trăng lấp lánh trên gợn sóng
          vec3 halfVec = normalize(viewDir + sunDirection);
          float spec = pow(max(dot(norm, halfVec), 0.0), 64.0) * 0.65;

          // Màu nước sâu chuyển tiếp
          float distToCenter = length(vUv - 0.5) * 2.0;
          vec3 waterBase = mix(shallowColor, waterColor, smoothstep(0.2, 0.9, distToCenter));
          vec3 skyReflect = vec3(0.65, 0.78, 0.92); // Phản chiếu bầu trời

          vec3 finalColor = mix(waterBase, skyReflect, fresnel) + vec3(spec);
          gl_FragColor = vec4(finalColor, 0.88);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    })

    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = -0.06
    return { mesh, mat }
  }

  private buildArchedStoneBridge(collision: CollisionWorld) {
    const bridgeGroup = new THREE.Group()
    const graniteMat = this.materials.createGraniteStepMaterial()

    // 1. Vòm cầu chính bắc dọc trục Z xuyên qua hồ sen
    const bridgeLen = this.pondRadius * 2.0 // 13.0m
    const bridgeWidth = 3.2
    const archSteps = 20

    // Dựng mặt cầu vòm bậc thang thoải
    for (let i = 0; i < archSteps; i++) {
      const t = (i / (archSteps - 1)) * 2.0 - 1.0 // [-1, 1]
      const z = t * (bridgeLen * 0.5)
      // Đường cong parabol đỉnh cao 1.15m ở giữa
      const y = Math.max(0.08, (1.0 - t * t) * 1.15)

      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(bridgeWidth, 0.18, (bridgeLen / archSteps) + 0.08),
        graniteMat
      )
      plank.position.set(0, y, z)
      plank.castShadow = true
      plank.receiveShadow = true
      bridgeGroup.add(plank)

      // Khối gờ lan can cầu 2 bên
      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.3), graniteMat)
      postL.position.set(-bridgeWidth * 0.5 + 0.15, y + 0.35, z)
      postL.castShadow = true
      bridgeGroup.add(postL)

      const postR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.75, 0.3), graniteMat)
      postR.position.set(bridgeWidth * 0.5 - 0.15, y + 0.35, z)
      postR.castShadow = true
      bridgeGroup.add(postR)

      // Đỉnh trụ chạm búp sen đá ở một số nhịp chính
      if (i % 4 === 0) {
        const lotusBudGeo = new THREE.SphereGeometry(0.12, 8, 8)
        lotusBudGeo.scale(1.0, 1.6, 1.0)
        const budL = new THREE.Mesh(lotusBudGeo, graniteMat)
        budL.position.set(-bridgeWidth * 0.5 + 0.15, y + 0.8, z)
        bridgeGroup.add(budL)

        const budR = new THREE.Mesh(lotusBudGeo, graniteMat)
        budR.position.set(bridgeWidth * 0.5 - 0.15, y + 0.8, z)
        bridgeGroup.add(budR)
      }
    }

    // Tay vịn lan can đá chạy dọc cầu
    const railGeo = new THREE.BoxGeometry(0.18, 0.12, bridgeLen + 0.4)
    const railL = new THREE.Mesh(railGeo, graniteMat)
    railL.position.set(-bridgeWidth * 0.5 + 0.15, 1.0, 0)
    bridgeGroup.add(railL)

    const railR = new THREE.Mesh(railGeo, graniteMat)
    railR.position.set(bridgeWidth * 0.5 - 0.15, 1.0, 0)
    bridgeGroup.add(railR)

    this.root.add(bridgeGroup)

    // Đăng ký Collider cho mặt cầu: 12 phân đoạn giật cấp nhẹ (mỗi nấc <= 0.15m) để đi bộ mượt mà
    const segCount = 12
    const segDepth = bridgeLen / segCount
    for (let s = 0; s < segCount; s++) {
      const t = ((s + 0.5) / segCount) * 2.0 - 1.0 // [-1, 1]
      const relZ = t * (bridgeLen * 0.5)
      const floorY = Math.max(0.12, (1.0 - t * t) * 1.15)

      collision.add(
        new BoxCollider(
          `bridge_step_${s}`,
          new THREE.Vector3(this.pondCenter.x, floorY * 0.5, this.pondCenter.z + relZ),
          new THREE.Vector3(bridgeWidth, floorY, segDepth + 0.06),
          false,
          true,
          floorY
        )
      )
    }

    // Lan can chắn 2 bên cầu (Tránh té rơi khỏi cầu)
    collision.add(
      new BoxCollider(
        'bridge_rail_left',
        new THREE.Vector3(this.pondCenter.x - bridgeWidth * 0.5, 1.2, this.pondCenter.z),
        new THREE.Vector3(0.4, 1.6, bridgeLen),
        false
      )
    )
    collision.add(
      new BoxCollider(
        'bridge_rail_right',
        new THREE.Vector3(this.pondCenter.x + bridgeWidth * 0.5, 1.2, this.pondCenter.z),
        new THREE.Vector3(0.4, 1.6, bridgeLen),
        false
      )
    )
  }

  private buildLotusPlants() {
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x226b3a,
      roughness: 0.72,
      side: THREE.DoubleSide
    })

    const petalMat = new THREE.MeshStandardMaterial({
      color: 0xf49ac2,
      emissive: 0x9e3868,
      emissiveIntensity: 0.15,
      roughness: 0.55
    })

    const stamenMat = new THREE.MeshStandardMaterial({
      color: 0xfad02c,
      roughness: 0.4
    })

    // Rải 32 cụm hoa & lá sen tự nhiên quanh hồ
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2 + Math.sin(i * 1.7) * 0.4
      const dist = 3.2 + Math.sin(i * 2.3) * 3.8
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist

      // Không mọc đâm vào giữa lòng cầu
      if (Math.abs(x) < 2.0) continue

      const lotusGroup = new THREE.Group()
      lotusGroup.position.set(x, -0.04, z)

      // 1. Lá sen tròn dập dềnh
      const leafRadius = 0.55 + Math.random() * 0.45
      const leafGeo = new THREE.CircleGeometry(leafRadius, 16)
      const leaf = new THREE.Mesh(leafGeo, leafMat)
      leaf.rotation.x = -Math.PI / 2
      leaf.rotation.z = Math.random() * Math.PI * 2
      leaf.position.y = (Math.random() - 0.5) * 0.02
      lotusGroup.add(leaf)

      // 2. Hoa sen vươn lên đón nắng (chỉ 1 nửa số cụm có hoa)
      if (i % 2 === 0) {
        const flowerGroup = new THREE.Group()
        flowerGroup.position.set(0.15, 0.22, 0.1)

        // Nhụy vàng bát giác
        const stamen = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.08, 8), stamenMat)
        flowerGroup.add(stamen)

        // 8 cánh hoa sen nở bung
        for (let p = 0; p < 8; p++) {
          const pAngle = (p / 8) * Math.PI * 2
          const petalGeo = new THREE.ConeGeometry(0.09, 0.28, 5)
          petalGeo.rotateX(Math.PI / 3.5)
          const petal = new THREE.Mesh(petalGeo, petalMat)
          petal.position.set(Math.cos(pAngle) * 0.09, 0.04, Math.sin(pAngle) * 0.09)
          petal.rotation.y = -pAngle
          flowerGroup.add(petal)
        }
        lotusGroup.add(flowerGroup)
      }

      this.root.add(lotusGroup)
    }
  }

  private buildFloatingLanterns() {
    const woodLanternMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.8 })
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xffe8c2,
      emissive: 0xff9900,
      emissiveIntensity: 0.45,
      roughness: 0.6
    })

    // 6 đèn hoa đăng trôi trên mặt nước
    const lanternSpots = [
      [-4.5, -2.5],
      [-5.8, 3.2],
      [-2.8, 4.5],
      [-6.5, -4.0],
      [4.2, -3.2],
      [5.5, 2.8]
    ]

    lanternSpots.forEach(([lx, lz], i) => {
      const lantern = new THREE.Group()
      lantern.position.set(lx, -0.02, lz)

      // Đế gỗ nổi
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.38), woodLanternMat)
      lantern.add(base)

      // Thân đèn hoa đăng giấy bồi tứ giác
      const shade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.28), paperMat)
      shade.position.y = 0.18
      lantern.add(shade)

      // Nến ấm áp bên trong
      const candleLight = new THREE.PointLight(0xff9922, 0.35, 4.0, 1.8)
      candleLight.position.y = 0.2
      lantern.add(candleLight)

      this.root.add(lantern)
      this.floatingLanterns.push(lantern)
    })
  }

  public updateSunDirection(dir: THREE.Vector3) {
    if (this.waterMaterial && this.waterMaterial.uniforms.sunDirection) {
      this.waterMaterial.uniforms.sunDirection.value.copy(dir).normalize()
    }
  }

  public update(delta: number, elapsed: number) {
    if (this.waterMaterial) {
      this.waterMaterial.uniforms.time.value = elapsed
    }

    // Đèn hoa đăng dập dềnh bập bềnh theo nhịp sóng nước
    this.floatingLanterns.forEach((lantern, i) => {
      lantern.position.y = -0.02 + Math.sin(elapsed * 1.8 + i * 1.5) * 0.025
      lantern.rotation.y += delta * 0.08
    })
  }
}
