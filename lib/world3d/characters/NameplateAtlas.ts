import * as THREE from 'three'

interface SlotData {
  id: string
  slotIndex: number
  u: number
  v: number
  uSpan: number
  vSpan: number
  inUse: boolean
}

/**
 * NameplateAtlas (Bảng Tên Đám Đông Gộp 1 Draw Call Toàn Cục):
 * Consolidates up to 512 player nameplates into a single 2048x2048 canvas atlas
 * and renders all active nameplates in EXACTLY 1 draw call via InstancedMesh with GPU billboarding.
 */
export class NameplateAtlas {
  public mesh: THREE.InstancedMesh
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
  private material: THREE.ShaderMaterial
  private geometry: THREE.PlaneGeometry

  private readonly maxSlots = 512
  private readonly atlasCols = 8
  private readonly atlasRows = 64
  private readonly slotWidth = 256
  private readonly slotHeight = 32

  private slots: SlotData[] = []
  private idToSlot = new Map<string, SlotData>()
  private uvAttr: THREE.InstancedBufferAttribute
  private dummy = new THREE.Object3D()

  constructor() {
    // 1. Khởi tạo Canvas Atlas 2048x2048
    this.canvas = document.createElement('canvas')
    this.canvas.width = 2048
    this.canvas.height = 2048
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.clearRect(0, 0, 2048, 2048)

    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.generateMipmaps = false
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.colorSpace = THREE.SRGBColorSpace

    // 2. Geometry và GPU Spherical Billboarding Shader
    this.geometry = new THREE.PlaneGeometry(1.6, 0.22)

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: this.texture }
      },
      vertexShader: `
        attribute vec4 aUvSpan; // x: u0, y: v0, z: uSpan, w: vSpan
        varying vec2 vUv;

        void main() {
          // Tính toán UV góc của slot trong Atlas
          vUv = aUvSpan.xy + uv * aUvSpan.zw;

          // GPU Camera-Facing Spherical Billboarding:
          // Trích xuất vị trí instance từ instanceMatrix và hướng mặt phẳng trực diện về camera
          vec4 worldPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec4 mvPosition = viewMatrix * worldPos;
          mvPosition.xy += position.xy;

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uAtlas;
        varying vec2 vUv;

        void main() {
          vec4 color = texture2D(uAtlas, vUv);
          if (color.a < 0.05) discard;
          gl_FragColor = color;
        }
      `,
      transparent: true,
      depthWrite: false
    })

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.maxSlots)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    // Khởi tạo thuộc tính UV của từng slot
    const uvArray = new Float32Array(this.maxSlots * 4)
    const uSpan = 1.0 / this.atlasCols
    const vSpan = 1.0 / this.atlasRows

    for (let i = 0; i < this.maxSlots; i++) {
      const col = i % this.atlasCols
      const row = Math.floor(i / this.atlasCols)
      const u = col * uSpan
      // Canvas Y lộn ngược so với WebGL V
      const v = 1.0 - (row + 1) * vSpan

      this.slots.push({
        id: '',
        slotIndex: i,
        u,
        v,
        uSpan,
        vSpan,
        inUse: false
      })

      uvArray[i * 4 + 0] = u
      uvArray[i * 4 + 1] = v
      uvArray[i * 4 + 2] = uSpan
      uvArray[i * 4 + 3] = vSpan

      // Đưa instance ra khỏi tầm nhìn ban đầu
      this.dummy.position.set(0, -500, 0)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }

    this.uvAttr = new THREE.InstancedBufferAttribute(uvArray, 4)
    this.geometry.setAttribute('aUvSpan', this.uvAttr)
    this.mesh.instanceMatrix.needsUpdate = true
  }

  /**
   * Đăng ký hoặc cập nhật bảng tên người chơi vào Atlas
   */
  public register(id: string, name: string, title = 'Hành Giả', country = 'vietnam'): number {
    let slot = this.idToSlot.get(id)
    if (!slot) {
      slot = this.slots.find((s) => !s.inUse)
      if (!slot) {
        // Tái sử dụng slot đầu tiên nếu quá tải 512
        slot = this.slots[0]
      }
      slot.inUse = true
      slot.id = id
      this.idToSlot.set(id, slot)
    }

    this.renderNameToAtlas(slot.slotIndex, name, title, country)
    return slot.slotIndex
  }

  /**
   * Cập nhật vị trí của bảng tên theo tọa độ đầu avatar
   */
  public updatePosition(id: string, x: number, y: number, z: number, visible = true) {
    const slot = this.idToSlot.get(id)
    if (!slot) return

    if (!visible) {
      this.dummy.position.set(0, -500, 0)
    } else {
      this.dummy.position.set(x, y + 1.70, z)
    }
    this.dummy.updateMatrix()
    this.mesh.setMatrixAt(slot.slotIndex, this.dummy.matrix)
    this.mesh.instanceMatrix.needsUpdate = true
  }

  /**
   * Vẽ text và badge vào đúng ô của slot trên Canvas Atlas 2048x2048
   */
  private renderNameToAtlas(slotIndex: number, name: string, title: string, country: string) {
    const col = slotIndex % this.atlasCols
    const row = Math.floor(slotIndex / this.atlasCols)
    const px = col * this.slotWidth
    const py = row * this.slotHeight

    const ctx = this.ctx
    // Xóa nền ô cũ
    ctx.clearRect(px, py, this.slotWidth, this.slotHeight)

    // Khung bo góc tối giản mờ nhẹ
    ctx.fillStyle = 'rgba(10, 14, 20, 0.72)'
    ctx.beginPath()
    ctx.roundRect(px + 4, py + 2, this.slotWidth - 8, this.slotHeight - 4, 6)
    ctx.fill()

    // Viền vàng kim mỏng
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Quốc kỳ / Huy hiệu chữ viết tắt
    const badgeColor = country === 'vietnam' ? '#d63031' : country === 'japan' ? '#e17055' : '#0984e3'
    ctx.fillStyle = badgeColor
    ctx.beginPath()
    ctx.arc(px + 18, py + 16, 7, 0, Math.PI * 2)
    ctx.fill()

    // Tên người chơi
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const cleanName = name.length > 14 ? name.substring(0, 12) + '..' : name
    ctx.fillText(cleanName, px + 30, py + 16)

    // Danh hiệu
    ctx.fillStyle = '#f1c40f'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(title, px + this.slotWidth - 14, py + 16)

    this.texture.needsUpdate = true
  }

  public unregister(id: string) {
    const slot = this.idToSlot.get(id)
    if (slot) {
      slot.inUse = false
      slot.id = ''
      this.idToSlot.delete(id)
      this.dummy.position.set(0, -500, 0)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(slot.slotIndex, this.dummy.matrix)
      this.mesh.instanceMatrix.needsUpdate = true
    }
  }

  public clear() {
    for (const slot of this.slots) {
      slot.inUse = false
      slot.id = ''
    }
    this.idToSlot.clear()
    for (let i = 0; i < this.maxSlots; i++) {
      this.dummy.position.set(0, -500, 0)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
    }
    this.mesh.instanceMatrix.needsUpdate = true
  }

  public dispose() {
    this.geometry.dispose()
    this.material.dispose()
    this.texture.dispose()
  }
}

