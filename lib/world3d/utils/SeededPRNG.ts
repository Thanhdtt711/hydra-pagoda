/**
 * Seeded Pseudo-Random Number Generator (Mulberry32)
 * Ensures deterministic procedural generation across all clients and sessions.
 */
export class SeededPRNG {
  private state: number

  constructor(seed = 123456789) {
    this.state = seed >>> 0
    if (this.state === 0) this.state = 1
  }

  /**
   * Returns a pseudo-random float in [0, 1)
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /**
   * Returns a pseudo-random float in [min, max)
   */
  public range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /**
   * Returns a pseudo-random integer in [min, max]
   */
  public rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  /**
   * Selects a random element from an array
   */
  public choice<T>(array: T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array')
    return array[Math.floor(this.next() * array.length)]
  }

  /**
   * Reset seed state
   */
  public setSeed(seed: number) {
    this.state = seed >>> 0
    if (this.state === 0) this.state = 1
  }
}

