/**
 * Procedural Zen & Ritual Audio Synthesizer via Web Audio API.
 * High-fidelity Buddhist bell, wooden fish (mõ), singing bowl (chuông xoay),
 * and coins falling into the merit box without requiring external mp3 assets.
 * Extended with 6-Channel Procedural Spatial Soundscape Mixer (GDD Section 9).
 */

export type AmbientChannel = 'rain' | 'stream' | 'singingBowl' | 'windChimes' | 'woodenFish' | 'chanting'

export class ZenAudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private isMuted: boolean = false

  // Ambient Channels
  private ambientGains: Record<AmbientChannel, GainNode | null> = {
    rain: null,
    stream: null,
    singingBowl: null,
    windChimes: null,
    woodenFish: null,
    chanting: null
  }
  private ambientVolumes: Record<AmbientChannel, number> = {
    rain: 0,
    stream: 0,
    singingBowl: 0.25,
    windChimes: 0,
    woodenFish: 0,
    chanting: 0
  }
  private isAmbientRunning = false
  private timerIds: any[] = []

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AudioCtx()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime)
      this.masterGain.connect(this.ctx.destination)
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  public setMasterVolume(vol: number) {
    this.initContext()
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), this.ctx.currentTime)
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted
    this.setMasterVolume(this.isMuted ? 0 : 0.7)
    return this.isMuted
  }

  public getChannelVolumes(): Record<AmbientChannel, number> {
    return { ...this.ambientVolumes }
  }

  public setChannelVolume(channel: AmbientChannel, vol: number) {
    this.initContext()
    this.ambientVolumes[channel] = Math.max(0, Math.min(1, vol))
    if (!this.isAmbientRunning) {
      this.startAmbientGenerators()
    }
    const gainNode = this.ambientGains[channel]
    if (gainNode && this.ctx) {
      gainNode.gain.setTargetAtTime(this.isMuted ? 0 : this.ambientVolumes[channel] * 0.45, this.ctx.currentTime, 0.1)
    }
  }

  /**
   * Khởi tạo các bộ phát âm thanh không gian đa kênh bằng thuật toán toán học (Procedural Audio)
   */
  public startAmbientGenerators() {
    this.initContext()
    if (!this.ctx || !this.masterGain || this.isAmbientRunning) return
    this.isAmbientRunning = true

    // 1. Channel Rain (Mưa rào mái ngói) - White noise filtered
    const bufferSize = this.ctx.sampleRate * 2
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1
    }
    const whiteNoise = this.ctx.createBufferSource()
    whiteNoise.buffer = noiseBuffer
    whiteNoise.loop = true

    const rainFilter = this.ctx.createBiquadFilter()
    rainFilter.type = 'lowpass'
    rainFilter.frequency.value = 1200

    const rainGain = this.ctx.createGain()
    rainGain.gain.setValueAtTime(this.ambientVolumes.rain * 0.35, this.ctx.currentTime)
    whiteNoise.connect(rainFilter)
    rainFilter.connect(rainGain)
    rainGain.connect(this.masterGain)
    whiteNoise.start()
    this.ambientGains.rain = rainGain

    // 2. Channel Singing Bowl 432Hz Drone (Chuông xoay Tây Tạng)
    const bowlDrone = this.ctx.createOscillator()
    bowlDrone.type = 'sine'
    bowlDrone.frequency.setValueAtTime(432, this.ctx.currentTime)

    const bowlDrone2 = this.ctx.createOscillator()
    bowlDrone2.type = 'sine'
    bowlDrone2.frequency.setValueAtTime(216, this.ctx.currentTime) // octave below

    const bowlGain = this.ctx.createGain()
    bowlGain.gain.setValueAtTime(this.ambientVolumes.singingBowl * 0.25, this.ctx.currentTime)
    bowlDrone.connect(bowlGain)
    bowlDrone2.connect(bowlGain)
    bowlGain.connect(this.masterGain)
    bowlDrone.start()
    bowlDrone2.start()
    this.ambientGains.singingBowl = bowlGain

    // 3. Channel Chanting (Vocal Om frequency ~136.1Hz)
    const chantOsc = this.ctx.createOscillator()
    chantOsc.type = 'sawtooth'
    chantOsc.frequency.setValueAtTime(136.1, this.ctx.currentTime)

    const chantFilter = this.ctx.createBiquadFilter()
    chantFilter.type = 'bandpass'
    chantFilter.frequency.value = 350
    chantFilter.Q.value = 5.0

    const chantGain = this.ctx.createGain()
    chantGain.gain.setValueAtTime(this.ambientVolumes.chanting * 0.2, this.ctx.currentTime)
    chantOsc.connect(chantFilter)
    chantFilter.connect(chantGain)
    chantGain.connect(this.masterGain)
    chantOsc.start()
    this.ambientGains.chanting = chantGain

    // 4. Channel Stream (Tiếng suối & gáo trúc)
    const streamGain = this.ctx.createGain()
    streamGain.gain.setValueAtTime(this.ambientVolumes.stream * 0.3, this.ctx.currentTime)
    whiteNoise.connect(streamGain)
    streamGain.connect(this.masterGain)
    this.ambientGains.stream = streamGain

    // Periodic triggers for Wind Chimes & Wooden Fish
    const chimeTimer = setInterval(() => {
      if (this.ambientVolumes.windChimes > 0.05 && !this.isMuted) {
        this.playGentleWindChime()
      }
    }, 2800)
    this.timerIds.push(chimeTimer)

    const woodTimer = setInterval(() => {
      if (this.ambientVolumes.woodenFish > 0.05 && !this.isMuted) {
        this.playWoodenFish()
      }
    }, 1500)
    this.timerIds.push(woodTimer)
  }

  private playGentleWindChime() {
    if (!this.ctx || !this.masterGain) return
    const t = this.ctx.currentTime
    const notes = [1046.5, 1174.66, 1318.51, 1567.98, 1760.0]
    const freq = notes[Math.floor(Math.random() * notes.length)]
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(this.ambientVolumes.windChimes * 0.25, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8)
    osc.connect(g)
    g.connect(this.masterGain)
    osc.start(t)
    osc.stop(t + 3.0)
  }

  /**
   * Đại Hồng Chung / Chuông Chùa
   */
  public playTempleBell() {
    this.initContext()
    if (!this.ctx || !this.masterGain || this.isMuted) return

    const t = this.ctx.currentTime
    const fundamental = 110 // A2

    const harmonics = [
      { freq: fundamental * 1.0, gain: 0.8, decay: 6.5 },
      { freq: fundamental * 2.02, gain: 0.5, decay: 5.0 },
      { freq: fundamental * 2.98, gain: 0.35, decay: 4.2 },
      { freq: fundamental * 4.15, gain: 0.2, decay: 3.0 },
      { freq: fundamental * 5.4, gain: 0.1, decay: 2.2 }
    ]

    harmonics.forEach(h => {
      if (!this.ctx || !this.masterGain) return
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(h.freq, t)

      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(h.gain * 0.4, t + 0.04)
      g.gain.exponentialRampToValueAtTime(0.0001, t + h.decay)

      osc.connect(g)
      g.connect(this.masterGain)

      osc.start(t)
      osc.stop(t + h.decay + 0.1)
    })
  }

  /**
   * Chuông Xoay Tây Tạng (Tibetan Singing Bowl - 432Hz)
   */
  public playSingingBowl() {
    this.initContext()
    if (!this.ctx || !this.masterGain || this.isMuted) return

    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const lfo = this.ctx.createOscillator()
    const lfoGain = this.ctx.createGain()
    const g = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(432, t)

    lfo.frequency.setValueAtTime(3.5, t)
    lfoGain.gain.setValueAtTime(2.5, t)
    lfo.connect(osc.frequency)

    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.5)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 7.0)

    osc.connect(g)
    g.connect(this.masterGain)

    lfo.start(t)
    osc.start(t)
    osc.stop(t + 7.2)
    lfo.stop(t + 7.2)
  }

  /**
   * Tiếng Mõ Gỗ (Wooden Fish)
   */
  public playWoodenFish() {
    this.initContext()
    if (!this.ctx || !this.masterGain || this.isMuted) return

    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const filter = this.ctx.createBiquadFilter()
    const g = this.ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(380, t)
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.08)

    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(280, t)
    filter.Q.setValueAtTime(4.0, t)

    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.6, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)

    osc.connect(filter)
    filter.connect(g)
    g.connect(this.masterGain)

    osc.start(t)
    osc.stop(t + 0.25)
  }

  /**
   * Tiếng Tiền Xu Rơi Vào Hòm Công Đức (Coin Drop)
   */
  public playCoinDrop() {
    this.initContext()
    if (!this.ctx || !this.masterGain || this.isMuted) return

    const t = this.ctx.currentTime
    const freqs = [1850, 2400, 3100]

    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      const startT = t + idx * 0.07

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, startT)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, startT + 0.08)

      g.gain.setValueAtTime(0.0001, startT)
      g.gain.linearRampToValueAtTime(0.25, startT + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, startT + 0.18)

      osc.connect(g)
      g.connect(this.masterGain)

      osc.start(startT)
      osc.stop(startT + 0.2)
    })
  }

  /**
   * Tiếng Lắc Ống Xăm Gỗ (Fortune Sticks Shaking)
   */
  public playFortuneShaking() {
    this.initContext()
    if (!this.ctx || !this.masterGain || this.isMuted) return

    const t = this.ctx.currentTime
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      const offset = t + i * 0.09 + Math.random() * 0.02

      osc.type = 'square'
      osc.frequency.setValueAtTime(450 + Math.random() * 200, offset)

      g.gain.setValueAtTime(0.0001, offset)
      g.gain.linearRampToValueAtTime(0.15, offset + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, offset + 0.05)

      osc.connect(g)
      g.connect(this.masterGain)

      osc.start(offset)
      osc.stop(offset + 0.06)
    }
  }

  /**
   * Alias cho tiếng lắc ống xăm tre (tương thích với SanctuaryDrawer)
   */
  public playBambooShake() {
    this.playFortuneShaking()
  }
}

export const zenAudio = new ZenAudioEngine()
