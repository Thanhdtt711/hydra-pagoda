import * as THREE from 'three'

/**
 * RoofBuilder:
 * Mái đình/chùa 4 mái (hip roof) kiểu low-poly: đầu đao 4 góc vểnh lên, giữa mỗi cạnh võng xuống.
 * Chỉ 12 tam giác cho 4 mái + 2 tam giác nắp nóc + dải diềm mái. Non-indexed, normal phẳng.
 * Hệ tọa độ: tâm mái tại (0, 0, 0); y = 0 là cao độ giữa cạnh hiên; mặt trước ở +z.
 */

export interface HipRoofOptions {
    /** Kích thước mặt bằng hiên mái (rộng theo X, sâu theo Z). */
    eaveW: number
    eaveD: number
    /** Chiều cao từ hiên (giữa cạnh) lên tới nóc. */
    height: number
    /** Kích thước hình chữ nhật nóc (ridgeD nhỏ = nóc dài, ridgeD lớn = mái chóp). */
    ridgeW: number
    ridgeD: number
    /** Độ vểnh của 4 góc đầu đao so với giữa cạnh hiên. */
    lift: number
    /** Bề dày diềm mái buông xuống từ hiên. */
    fascia?: number
    /** Có đậy nắp nóc không (tầng dưới đặt dưới tầng trên thì để false). */
    capTop?: boolean
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _n = new THREE.Vector3()
const _ref = new THREE.Vector3()

export function createCurvedHipRoof(o: HipRoofOptions): THREE.BufferGeometry {
    const ew = o.eaveW / 2
    const ed = o.eaveD / 2
    const rw = o.ridgeW / 2
    const rd = Math.max(o.ridgeD, 0.2) / 2
    const h = o.height
    const lift = o.lift
    const fascia = o.fascia ?? 0.3
    const capTop = o.capTop ?? true

    type V = [number, number, number]
    // Góc hiên (vểnh) + giữa cạnh (võng)
    const c0: V = [-ew, lift, ed]
    const c1: V = [ew, lift, ed]
    const c2: V = [ew, lift, -ed]
    const c3: V = [-ew, lift, -ed]
    const mf: V = [0, 0, ed]
    const mr: V = [ew, 0, 0]
    const mb: V = [0, 0, -ed]
    const ml: V = [-ew, 0, 0]
    // Nóc
    const r0: V = [-rw, h, rd]
    const r1: V = [rw, h, rd]
    const r2: V = [rw, h, -rd]
    const r3: V = [-rw, h, -rd]

    const positions: number[] = []
    // Điểm tham chiếu nằm dưới mái: pháp tuyến hướng ra xa điểm này là hướng ngoài/hướng lên.
    _ref.set(0, -h, 0)

    const tri = (p: V, q: V, r: V) => {
        _a.set(...p)
        _b.set(...q)
        _c.set(...r)
        _n.copy(_b).sub(_a).cross(_c.clone().sub(_a))
        const centroid = new THREE.Vector3().add(_a).add(_b).add(_c).multiplyScalar(1 / 3).sub(_ref)
        if (_n.dot(centroid) < 0) {
            positions.push(...p, ...r, ...q)
        } else {
            positions.push(...p, ...q, ...r)
        }
    }

    // 4 mái
    tri(c0, mf, r0)
    tri(mf, r1, r0)
    tri(mf, c1, r1)

    tri(c1, mr, r1)
    tri(mr, r2, r1)
    tri(mr, c2, r2)

    tri(c2, mb, r2)
    tri(mb, r3, r2)
    tri(mb, c3, r3)

    tri(c3, ml, r3)
    tri(ml, r0, r3)
    tri(ml, c0, r0)

    if (capTop) {
        tri(r0, r1, r2)
        tri(r0, r2, r3)
    }

    // Diềm mái: dải đứng dọc vòng hiên (8 đoạn)
    if (fascia > 0) {
        const loop: V[] = [c0, mf, c1, mr, c2, mb, c3, ml]
        for (let i = 0; i < loop.length; i++) {
            const p = loop[i]
            const q = loop[(i + 1) % loop.length]
            const p2: V = [p[0], p[1] - fascia, p[2]]
            const q2: V = [q[0], q[1] - fascia, q[2]]
            // Mặt ngoài: hướng pháp tuyến ra xa trục đứng
            const mx = (p[0] + q[0]) / 2
            const mz = (p[2] + q[2]) / 2
            const ex = q[0] - p[0]
            const ez = q[2] - p[2]
            // normal của (p,q,q2) = e × (0,-1,0) = (-ez, 0, ex)
            const nx = -ez
            const nz = ex
            const outward = nx * mx + nz * mz
            if (outward >= 0) {
                positions.push(...p, ...q, ...q2, ...p, ...q2, ...p2)
            } else {
                positions.push(...p, ...q2, ...q, ...p, ...p2, ...q2)
            }
        }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
    geo.computeBoundingBox()
    return geo
}
