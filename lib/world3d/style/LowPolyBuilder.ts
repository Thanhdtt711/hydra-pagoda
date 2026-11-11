import * as THREE from 'three'
import { SeededPRNG } from '../utils/SeededPRNG'

/**
 * LowPolyBuilder:
 * Tiện ích dựng hình khối low-poly phẳng, "nướng" màu vào vertex color và gộp thành 1 geometry.
 * Mọi geometry trả về đều non-indexed + có normal phẳng (mỗi mặt một normal).
 */

export interface PartTransform {
    position?: [number, number, number]
    rotation?: [number, number, number]
    scale?: [number, number, number]
}

export interface ColoredPart {
    geometry: THREE.BufferGeometry
    color: THREE.ColorRepresentation
    transform?: PartTransform
    position?: [number, number, number]
    rotation?: [number, number, number]
    scale?: [number, number, number]
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()

export class LowPolyBuilder {
    // ---------- Hình khối cơ bản (đã flat) ----------

    public static box(w: number, h: number, d: number): THREE.BufferGeometry {
        return LowPolyBuilder.flat(new THREE.BoxGeometry(w, h, d))
    }

    /** Hình trụ/nón cụt ít cạnh. radialSegments mặc định 6 để ra khối "facet". */
    public static cylinder(rTop: number, rBottom: number, h: number, radialSegments = 6): THREE.BufferGeometry {
        return LowPolyBuilder.flat(new THREE.CylinderGeometry(rTop, rBottom, h, radialSegments, 1))
    }

    public static cone(r: number, h: number, radialSegments = 6): THREE.BufferGeometry {
        return LowPolyBuilder.flat(new THREE.ConeGeometry(r, h, radialSegments, 1))
    }

    /** Cầu facet: icosahedron detail 0 (20 mặt) hoặc 1 (80 mặt). */
    public static sphere(r: number, detail = 1): THREE.BufferGeometry {
        return LowPolyBuilder.flat(new THREE.IcosahedronGeometry(r, detail))
    }

    /** Khối bát diện (8 mặt) – dùng cho ngọc bội, lửa nến, kim hoa. */
    public static octahedron(r: number, detail = 0): THREE.BufferGeometry {
        return LowPolyBuilder.flat(new THREE.OctahedronGeometry(r, detail))
    }

    /** Lăng trụ tam giác (mái dốc): trục dọc theo Z, đỉnh nóc hướng +Y. */
    public static prism(w: number, h: number, d: number): THREE.BufferGeometry {
        const hw = w / 2
        const hd = d / 2
        const pos = new Float32Array([
            // mặt trước (z=+hd)
            -hw, 0, hd, hw, 0, hd, 0, h, hd,
            // mặt sau (z=-hd)
            hw, 0, -hd, -hw, 0, -hd, 0, h, -hd,
            // mái trái
            -hw, 0, -hd, -hw, 0, hd, 0, h, hd,
            -hw, 0, -hd, 0, h, hd, 0, h, -hd,
            // mái phải
            hw, 0, hd, hw, 0, -hd, 0, h, -hd,
            hw, 0, hd, 0, h, -hd, 0, h, hd,
            // đáy
            -hw, 0, -hd, hw, 0, -hd, hw, 0, hd,
            -hw, 0, -hd, hw, 0, hd, -hw, 0, hd
        ])
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
        g.computeVertexNormals()
        return g
    }

    /** Mái chóp 4 mặt (hình chóp cụt) – dùng cho mái đình/tháp. */
    public static pyramid(wBottom: number, wTop: number, h: number, dBottom = wBottom, dTop = wTop): THREE.BufferGeometry {
        const g = new THREE.CylinderGeometry(1, 1, h, 4, 1)
        g.rotateY(Math.PI / 4)
        const pos = g.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i)
            const top = y > 0
            pos.setX(i, pos.getX(i) * (top ? wTop : wBottom) / Math.SQRT2)
            pos.setZ(i, pos.getZ(i) * (top ? dTop : dBottom) / Math.SQRT2)
        }
        pos.needsUpdate = true
        return LowPolyBuilder.flat(g)
    }

    // ---------- Biến đổi ----------

    /** Chuyển sang non-indexed, bỏ uv, tính normal phẳng. */
    public static flat(geo: THREE.BufferGeometry): THREE.BufferGeometry {
        const g = geo.index ? geo.toNonIndexed() : geo
        if (g !== geo) geo.dispose()
        g.deleteAttribute('uv')
        g.deleteAttribute('normal')
        g.computeVertexNormals()
        return g
    }

    /** Làm lệch ngẫu nhiên (có seed) các đỉnh để khối trông "đá/đồi" tự nhiên. Dựa theo vị trí để các đỉnh trùng vẫn khít. */
    public static jitter(geo: THREE.BufferGeometry, amount: number, seed = 1): THREE.BufferGeometry {
        const pos = geo.attributes.position as THREE.BufferAttribute
        const cache = new Map<string, [number, number, number]>()
        const rng = new SeededPRNG(seed)
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i)
            const y = pos.getY(i)
            const z = pos.getZ(i)
            const key = `${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}`
            let off = cache.get(key)
            if (!off) {
                off = [(rng.next() - 0.5) * 2 * amount, (rng.next() - 0.5) * 2 * amount, (rng.next() - 0.5) * 2 * amount]
                cache.set(key, off)
            }
            pos.setXYZ(i, x + off[0], y + off[1], z + off[2])
        }
        pos.needsUpdate = true
        geo.computeVertexNormals()
        return geo
    }

    /** Gắn vertex color đồng nhất cho một geometry. */
    public static paint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
        _c.set(color)
        const count = geo.attributes.position.count
        const arr = new Float32Array(count * 3)
        for (let i = 0; i < count; i++) {
            arr[i * 3] = _c.r
            arr[i * 3 + 1] = _c.g
            arr[i * 3 + 2] = _c.b
        }
        geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
        return geo
    }

    /** Đặt ra phía trên mặt phẳng y=0 (đáy nằm trên y=0). */
    public static grounded(geo: THREE.BufferGeometry): THREE.BufferGeometry {
        geo.computeBoundingBox()
        const minY = geo.boundingBox!.min.y
        geo.translate(0, -minY, 0)
        return geo
    }

    // ---------- Gộp ----------

    /**
     * Gộp nhiều phần có màu riêng thành 1 BufferGeometry duy nhất (position, normal, color).
     * Dùng cùng FlatMaterialFactory.vertexColor().
     */
    public static bake(parts: ColoredPart[], disposeSource = true): THREE.BufferGeometry {
        return LowPolyBuilder.mergeColored(parts, disposeSource)
    }

    public static mergeColored(parts: ColoredPart[], disposeSource = true): THREE.BufferGeometry {
        const prepared: THREE.BufferGeometry[] = []
        let total = 0

        for (const part of parts) {
            let g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone()
            const pos = part.transform?.position ?? part.position
            const rot = part.transform?.rotation ?? part.rotation
            const scl = part.transform?.scale ?? part.scale
            if (pos || rot || scl) {
                _p.set(...(pos ?? [0, 0, 0]))
                _e.set(...(rot ?? [0, 0, 0]))
                _q.setFromEuler(_e)
                _s.set(...(scl ?? [1, 1, 1]))
                _m.compose(_p, _q, _s)
                g.applyMatrix4(_m)
            }
            g.deleteAttribute('uv')
            g.deleteAttribute('color')
            g.computeVertexNormals()
            LowPolyBuilder.paint(g, part.color)
            total += g.attributes.position.count
            prepared.push(g)
            if (disposeSource) part.geometry.dispose()
        }

        const position = new Float32Array(total * 3)
        const normal = new Float32Array(total * 3)
        const color = new Float32Array(total * 3)
        let off = 0
        for (const g of prepared) {
            position.set(g.attributes.position.array as Float32Array, off * 3)
            normal.set(g.attributes.normal.array as Float32Array, off * 3)
            color.set(g.attributes.color.array as Float32Array, off * 3)
            off += g.attributes.position.count
            g.dispose()
        }

        const out = new THREE.BufferGeometry()
        out.setAttribute('position', new THREE.BufferAttribute(position, 3))
        out.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
        out.setAttribute('color', new THREE.BufferAttribute(color, 3))
        out.computeBoundingSphere()
        out.computeBoundingBox()
        return out
    }

    public static triangleCount(geo: THREE.BufferGeometry): number {
        return geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3
    }
}
