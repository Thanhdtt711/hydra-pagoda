import * as THREE from 'three'

export interface ProfilerLODBreakdown {
  bots?: number
  lod0?: number
  lod1?: number
  lod2?: number
  lod3?: number
}

export class PerformanceProfiler {
  private renderer: THREE.WebGLRenderer
  private container: HTMLElement
  private overlayEl: HTMLDivElement | null = null
  private visible = false

  // Metrics
  private frameCount = 0
  private lastTime = performance.now()
  private fps = 60
  private frameTimeMs = 16.6
  private cpuTimeMs = 0

  constructor(renderer: THREE.WebGLRenderer, container: HTMLElement) {
    this.renderer = renderer
    this.container = container
    this.createDOM()
  }

  private createDOM() {
    if (typeof document === 'undefined') return

    const el = document.createElement('div')
    el.id = '__3D_PERF_PROFILER__'
    el.style.position = 'absolute'
    el.style.top = '14px'
    el.style.left = '14px'
    el.style.zIndex = '9999'
    el.style.pointerEvents = 'none'
    el.style.backgroundColor = 'rgba(10, 14, 20, 0.88)'
    el.style.border = '1px solid rgba(255, 215, 64, 0.35)'
    el.style.borderRadius = '8px'
    el.style.padding = '10px 14px'
    el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    el.style.fontSize = '11px'
    el.style.lineHeight = '1.5'
    el.style.color = '#e2e8f0'
    el.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.65)'
    el.style.backdropFilter = 'blur(10px)'
    el.style.display = 'none'
    el.style.userSelect = 'none'

    this.container.appendChild(el)
    this.overlayEl = el
  }

  public toggle(): boolean {
    this.visible = !this.visible
    if (this.overlayEl) {
      this.overlayEl.style.display = this.visible ? 'block' : 'none'
    }
    return this.visible
  }

  public isVisible(): boolean {
    return this.visible
  }

  public update(cpuTimeMs: number, breakdown?: ProfilerLODBreakdown) {
    this.cpuTimeMs = cpuTimeMs
    this.frameCount++

    const now = performance.now()
    const elapsed = now - this.lastTime

    // Refresh FPS counter every 250ms
    if (elapsed >= 250) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed)
      this.frameTimeMs = parseFloat((elapsed / this.frameCount).toFixed(1))
      this.frameCount = 0
      this.lastTime = now

      if (this.visible && this.overlayEl) {
        this.renderStats(breakdown)
      }
    }
  }

  private renderStats(breakdown?: ProfilerLODBreakdown) {
    if (!this.overlayEl) return

    const info = this.renderer.info
    const render = info.render
    const mem = info.memory

    const fpsColor = this.fps >= 55 ? '#4ade80' : this.fps >= 30 ? '#facc15' : '#f87171'
    const cpuColor = this.cpuTimeMs <= 8 ? '#4ade80' : this.cpuTimeMs <= 14 ? '#facc15' : '#f87171'

    let botLine = ''
    if (breakdown && breakdown.bots !== undefined && breakdown.bots > 0) {
      botLine = `
        <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.15); color: #38bdf8;">
          Bots: <b>${breakdown.bots}</b>
          ${breakdown.lod0 !== undefined ? `| LOD0: <b>${breakdown.lod0}</b>` : ''}
          ${breakdown.lod1 !== undefined ? `| LOD1: <b>${breakdown.lod1}</b>` : ''}
          ${breakdown.lod2 !== undefined ? `| LOD2: <b>${breakdown.lod2}</b>` : ''}
          ${breakdown.lod3 !== undefined ? `| Culled: <b>${breakdown.lod3}</b>` : ''}
        </div>
      `
    }

    this.overlayEl.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 4px;">
        <span style="font-weight: 700; color: #fbbf24; letter-spacing: 0.05em;">VẠN CẢNH THIỀN TỰ</span>
        <span style="font-size: 9px; padding: 1px 6px; border-radius: 4px; background: rgba(251,191,36,0.15); color: #fbbf24;">F2 PROFILER</span>
      </div>
      <div style="display: grid; grid-template-columns: auto auto; gap: 4px 14px;">
        <span>FPS / Frame:</span>
        <span style="text-align: right; font-weight: 600; color: ${fpsColor};">${this.fps} FPS <span style="font-weight: 400; color: #94a3b8;">(${this.frameTimeMs} ms)</span></span>
        <span>CPU JS / Frame:</span>
        <span style="text-align: right; font-weight: 600; color: ${cpuColor};">${this.cpuTimeMs.toFixed(2)} ms</span>
        <span>Draw Calls:</span>
        <span style="text-align: right; font-weight: 600; color: ${render.calls > 300 ? '#f87171' : '#38bdf8'};">${render.calls}</span>
        <span>Triangles:</span>
        <span style="text-align: right; font-weight: 600; color: #cbd5e1;">${render.triangles.toLocaleString()}</span>
        <span>Points / Lines:</span>
        <span style="text-align: right; color: #94a3b8;">${render.points.toLocaleString()} / ${render.lines.toLocaleString()}</span>
        <span>Geometries:</span>
        <span style="text-align: right; color: #cbd5e1;">${mem.geometries}</span>
        <span>Textures:</span>
        <span style="text-align: right; color: #cbd5e1;">${mem.textures}</span>
      </div>
      ${botLine}
    `
  }

  public dispose() {
    if (this.overlayEl && this.overlayEl.parentElement) {
      this.overlayEl.parentElement.removeChild(this.overlayEl)
      this.overlayEl = null
    }
  }
}

