import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { POST_STYLE } from '../style/Palette'

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra'

/**
 * Vignette nhẹ (tối dần ở rìa khung hình) – chạy trong không gian tuyến tính trước OutputPass.
 */
export const VignetteShader = {
  name: 'VignetteShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    darkness: { value: POST_STYLE.vignette.darkness },
    offset: { value: POST_STYLE.vignette.offset }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float darkness;
    uniform float offset;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 p = (vUv - 0.5) * vec2(1.0, 0.85);
      float d = length(p) * 1.4142;
      float v = smoothstep(offset, 0.35, d);
      c.rgb *= mix(1.0 - darkness, 1.0, v);
      gl_FragColor = c;
    }
  `
}

/**
 * PostProcessingManager (Low-poly Minimalist):
 * RenderPass (MSAA 4x) → UnrealBloomPass (chỉ nguồn sáng) → Vignette nhẹ → OutputPass.
 * Không SMAA (đã có MSAA), không SSAO/GTAO, không outline.
 */
export class PostProcessingManager {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  public composer: EffectComposer

  private renderPass: RenderPass
  private bloomPass: UnrealBloomPass
  private vignettePass: ShaderPass
  private outputPass: OutputPass

  public quality: GraphicsQuality = 'high'
  private width = 1280
  private height = 720

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.width = width
    this.height = height

    // MSAA phần cứng (WebGL2) trên render target HDR
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: 4
    })
    this.composer = new EffectComposer(this.renderer, renderTarget)

    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)

    // Bloom nhẹ, ngưỡng cao: chỉ đèn lồng / nến / hoa đăng (emissive > 1) phát quầng
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      POST_STYLE.bloom.strength,
      POST_STYLE.bloom.radius,
      POST_STYLE.bloom.threshold
    )
    this.composer.addPass(this.bloomPass)

    this.vignettePass = new ShaderPass(VignetteShader)
    this.composer.addPass(this.vignettePass)

    this.outputPass = new OutputPass()
    this.composer.addPass(this.outputPass)

    this.setQuality('high')
  }

  private applyBloomParams() {
    this.bloomPass.strength = POST_STYLE.bloom.strength
    this.bloomPass.threshold = POST_STYLE.bloom.threshold
    this.bloomPass.radius = POST_STYLE.bloom.radius
  }

  public setQuality(quality: GraphicsQuality) {
    this.quality = quality
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

    if (quality === 'low') {
      this.renderer.setPixelRatio(1.0)
      this.bloomPass.enabled = false
      this.vignettePass.enabled = true
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.25))
      this.bloomPass.enabled = true
      this.applyBloomParams()
      this.vignettePass.enabled = true
    } else if (quality === 'high') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.5))
      this.bloomPass.enabled = true
      this.applyBloomParams()
      this.vignettePass.enabled = true
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 2.0))
      this.bloomPass.enabled = true
      this.applyBloomParams()
      this.vignettePass.enabled = true
    }

    // pixelRatio đổi → đồng bộ lại kích thước composer
    this.setSize(this.width, this.height)
  }

  public setSize(width: number, height: number) {
    this.width = width
    this.height = height
    this.composer.setPixelRatio(this.renderer.getPixelRatio())
    this.composer.setSize(width, height)
    this.bloomPass.setSize(width, height)
  }

  public render(delta: number) {
    this.composer.render(delta)
  }

  public dispose() {
    this.composer.dispose()
    this.renderPass.dispose()
    this.bloomPass.dispose()
    this.vignettePass.dispose()
    this.outputPass.dispose()
  }
}
