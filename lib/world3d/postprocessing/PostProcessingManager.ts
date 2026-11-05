import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { LightingConfig } from '../environment/LightingConfig'

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra'

/**
 * Custom Cinematic Tone & Color Grading Shader:
 * Warm Asian temple tone mapping, subtle filmic vignette, contrast enhancement, and organic micro-grain.
 */
export const CinematicToneShader = {
  name: 'CinematicToneShader',
  uniforms: {
    tDiffuse: { value: null },
    vignetteIntensity: { value: 0.32 },
    warmth: { value: 0.08 },
    contrast: { value: 1.06 },
    time: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetteIntensity;
    uniform float warmth;
    uniform float contrast;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec3 c = color.rgb;

      // 1. Multiplicative warmth grading: bảo toàn màu đen tuyền tuyệt đối (không bị đục sương trắng)
      c *= vec3(1.0 + warmth * 0.25, 1.0 + warmth * 0.08, 1.0 - warmth * 0.15);

      // 2. Contrast tinh tế cho cổ tự trầm mặc
      c = (c - 0.5) * contrast + 0.5;

      // 3. Subtle Vignette góc màn hình
      vec2 uv = vUv * (1.0 - vUv.yx);
      float vig = uv.x * uv.y * 15.0;
      vig = clamp(pow(vig, vignetteIntensity), 0.0, 1.0);
      c *= vig;

      // 4. Micro Film Grain hữu cơ
      float grain = (fract(sin(dot(vUv + time * 0.01, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.015;
      c += grain;

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), color.a);
    }
  `
}

/**
 * PostProcessingManager:
 * Manages RenderPass, UnrealBloomPass, SMAAPass, and OutputPass
 * with synchronized, consistent brightness across Medium, High, and Ultra.
 */
export class PostProcessingManager {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  public composer: EffectComposer

  private renderPass: RenderPass
  private bloomPass: UnrealBloomPass
  private smaaPass: SMAAPass
  private outputPass: OutputPass

  public quality: GraphicsQuality = 'high'
  private width = 1280
  private height = 720

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, width: number, height: number) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.width = width
    this.height = height

    // WebGL2 Hardware MSAA Multisampled RenderTarget
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: 4
    })
    this.composer = new EffectComposer(this.renderer, renderTarget)

    // 1. Base Scene Pass
    this.renderPass = new RenderPass(this.scene, this.camera)
    this.composer.addPass(this.renderPass)

    // 2. Controlled Bloom Pass (High threshold ensures ONLY genuine light sources bloom, never the environment)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      LightingConfig.BLOOM.strength,
      LightingConfig.BLOOM.radius,
      LightingConfig.BLOOM.threshold
    )
    this.composer.addPass(this.bloomPass)

    // 3. Subpixel Morphological Antialiasing (SMAA)
    this.smaaPass = new SMAAPass()
    this.smaaPass.setSize(width, height)
    this.composer.addPass(this.smaaPass)

    // 4. Output Pass (Chuẩn ACES Filmic Tone Mapping & sRGB Color Space)
    this.outputPass = new OutputPass()
    this.composer.addPass(this.outputPass)

    // Apply default High preset
    this.setQuality('high')
  }

  public setQuality(quality: GraphicsQuality) {
    this.quality = quality
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

    if (quality === 'low') {
      this.renderer.setPixelRatio(1.0)
      this.bloomPass.enabled = false
      this.smaaPass.enabled = false
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(1.25)
      this.bloomPass.enabled = true
      this.bloomPass.strength = LightingConfig.BLOOM.strength
      this.bloomPass.threshold = LightingConfig.BLOOM.threshold
      this.bloomPass.radius = LightingConfig.BLOOM.radius
      this.smaaPass.enabled = false
    } else if (quality === 'high') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.5))
      this.bloomPass.enabled = true
      this.bloomPass.strength = LightingConfig.BLOOM.strength
      this.bloomPass.threshold = LightingConfig.BLOOM.threshold
      this.bloomPass.radius = LightingConfig.BLOOM.radius
      this.smaaPass.enabled = true
    } else if (quality === 'ultra') {
      this.renderer.setPixelRatio(Math.min(dpr, 2.0))
      this.bloomPass.enabled = true
      this.bloomPass.strength = LightingConfig.BLOOM.strength
      this.bloomPass.threshold = LightingConfig.BLOOM.threshold
      this.bloomPass.radius = LightingConfig.BLOOM.radius
      this.smaaPass.enabled = true
    }
  }

  public setSize(width: number, height: number) {
    this.width = width
    this.height = height
    this.composer.setSize(width, height)
    this.bloomPass.setSize(width, height)
    this.smaaPass.setSize(width, height)
  }

  public render(delta: number) {
    this.composer.render(delta)
  }

  public dispose() {
    this.composer.dispose()
    this.renderPass.dispose()
    this.bloomPass.dispose()
    this.smaaPass.dispose()
    this.outputPass.dispose()
  }
}
