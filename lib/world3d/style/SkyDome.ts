import * as THREE from 'three'
import type { TimePalette } from './Palette'

/**
 * SkyDome:
 * Vòm trời gradient phẳng (đỉnh → chân trời → sương mù), đĩa mặt trời/trăng phẳng và sao (ban đêm).
 * Không texture, không tính tán xạ vật lý. Vòm luôn đi theo camera, vẽ trước mọi vật thể.
 */
export class SkyDome {
    public readonly mesh: THREE.Mesh
    private readonly material: THREE.ShaderMaterial

    constructor(scene: THREE.Scene, radius = 450) {
        this.material = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            depthTest: false,
            fog: false,
            toneMapped: false,
            uniforms: {
                uTop: { value: new THREE.Color() },
                uBottom: { value: new THREE.Color() },
                uHorizon: { value: new THREE.Color() },
                uFog: { value: new THREE.Color() },
                uDisk: { value: new THREE.Color() },
                uSunDir: { value: new THREE.Vector3(0, 1, 0) },
                uDiskCos: { value: 0.9993 },
                uStars: { value: 0 }
            },
            vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform vec3 uHorizon;
        uniform vec3 uFog;
        uniform vec3 uDisk;
        uniform vec3 uSunDir;
        uniform float uDiskCos;
        uniform float uStars;
        varying vec3 vDir;

        float hash13(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.zyx + 31.32);
          return fract((p.x + p.y) * p.z);
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;

          // Gradient: bottom (gần chân trời) -> top (thiên đỉnh)
          float t = smoothstep(0.0, 0.85, h);
          vec3 col = mix(uBottom, uTop, t);

          // Dải chân trời mờ ảo tan vào màu sương mù
          float band = 1.0 - smoothstep(0.0, 0.28, abs(h));
          col = mix(col, uHorizon, band * 0.75);
          // Dưới chân trời: trùng màu sương để núi xa/địa hình hòa vào
          col = mix(col, uFog, smoothstep(0.0, -0.12, h));

          // Sao (rất thưa, chỉ ban đêm)
          if (uStars > 0.001 && h > 0.04) {
            float s = hash13(floor(d * 220.0));
            float star = step(0.9965, s) * smoothstep(0.04, 0.35, h);
            col += vec3(star) * uStars;
          }

          // Quầng sáng + đĩa mặt trời / trăng phẳng
          float c = dot(d, uSunDir);
          float glow = pow(max(c, 0.0), 18.0) * 0.28 + pow(max(c, 0.0), 3.0) * 0.06;
          col += uDisk * glow;
          float disk = smoothstep(uDiskCos, uDiskCos + 0.00035, c);
          col = mix(col, uDisk, disk);

          gl_FragColor = vec4(col, 1.0);
        }
      `
        })

        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), this.material)
        this.mesh.frustumCulled = false
        this.mesh.renderOrder = -1000
        this.mesh.name = 'SkyDome'
        scene.add(this.mesh)
    }

    /** Áp bảng màu của một thời điểm trong ngày. sunDir là vector đơn vị hướng tới mặt trời/trăng. */
    public setPalette(pal: TimePalette, sunDir: THREE.Vector3, mode: 'day' | 'sunset' | 'night') {
        const u = this.material.uniforms
        u.uTop.value.setHex(pal.sky.top)
        u.uBottom.value.setHex(pal.sky.bottom)
        u.uHorizon.value.setHex(pal.sky.horizon)
        u.uFog.value.setHex(pal.fog.color)
        u.uDisk.value.setHex(pal.sun.disk)
        u.uSunDir.value.copy(sunDir)
        u.uStars.value = pal.stars
        // Hoàng hôn: mặt trời to hơn; đêm: trăng tròn rõ
        u.uDiskCos.value = mode === 'sunset' ? 0.9975 : mode === 'night' ? 0.9988 : 0.9993
    }

    /** Giữ vòm trời luôn tâm tại camera để không bao giờ chạm biên. */
    public update(cameraPos: THREE.Vector3) {
        this.mesh.position.copy(cameraPos)
    }

    public dispose() {
        this.mesh.parent?.remove(this.mesh)
        this.mesh.geometry.dispose()
        this.material.dispose()
    }
}
