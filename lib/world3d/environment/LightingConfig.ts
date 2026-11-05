/**
 * LightingConfig:
 * Central Source of Truth for physical lighting, camera exposure, fog,
 * sky parameters, and bloom post-processing across all quality presets and times of day.
 */

export type TimeOfDayMode = 'day' | 'sunset' | 'night'

export interface TimePresetConfig {
  sun: {
    elevation: number
    azimuth: number
    color: number
    intensity: number
  }
  hemi: {
    skyColor: number
    groundColor: number
    intensity: number
  }
  rim: {
    color: number
    intensity: number
  }
  exposure: {
    outdoor: number
    indoor: number
  }
  ibl: {
    intensity: number
  }
  fog: {
    color: number
    near: number
    far: number
  }
  sky: {
    turbidity: number
    rayleigh: number
    mieCoefficient: number
    mieDirectionalG: number
  }
  lanterns: {
    emissiveIntensity: number
    pointLightIntensity: number
  }
}

export class LightingConfig {
  // Bloom Post-Processing Parameters (HDR linear space)
  // High threshold ensures ONLY real light sources (flames, candles, embers, golden halos) bloom.
  public static readonly BLOOM = {
    threshold: 1.75, // Ngăn chặn hoàn toàn việc cháy sáng/chói lóa ban ngày
    strength: 0.12,
    radius: 0.20
  }

  // Atmospheric presets for each time of day
  public static readonly PRESETS: Record<TimeOfDayMode, TimePresetConfig> = {
    day: {
      sun: {
        elevation: 48.0,
        azimuth: 42.0,
        color: 0xfff6ea,
        intensity: 0.72 // Dịu mát thanh thoát, loại bỏ hiện tượng chói mắt
      },
      hemi: {
        skyColor: 0x90c0ea,
        groundColor: 0x484236,
        intensity: 0.28 // Độ tương phản rõ nét giữa nắng và bóng râm
      },
      rim: {
        color: 0x78a4c8,
        intensity: 0.15
      },
      exposure: {
        outdoor: 0.56, // Giảm phơi sáng vừa phải để chi tiết gạch sân, ngói và áo không bị chói
        indoor: 1.15   // Khi bước vào chánh điện thì ấm cúng và sáng rõ
      },
      ibl: {
        intensity: 0.18
      },
      fog: {
        color: 0x6e889c,
        near: 55.0,
        far: 240.0
      },
      sky: {
        turbidity: 2.4,
        rayleigh: 0.85,
        mieCoefficient: 0.002,
        mieDirectionalG: 0.75
      },
      lanterns: {
        emissiveIntensity: 0.02,
        pointLightIntensity: 0.0
      }
    },
    sunset: {
      sun: {
        elevation: 10.0,
        azimuth: 58.0,
        color: 0xff9036,
        intensity: 1.15
      },
      hemi: {
        skyColor: 0xb5572a,
        groundColor: 0x2e1a12,
        intensity: 0.32
      },
      rim: {
        color: 0xffa050,
        intensity: 0.25
      },
      exposure: {
        outdoor: 0.78,
        indoor: 1.15
      },
      ibl: {
        intensity: 0.18
      },
      fog: {
        color: 0x3d1e16,
        near: 45.0,
        far: 190.0
      },
      sky: {
        turbidity: 5.5,
        rayleigh: 2.8,
        mieCoefficient: 0.018,
        mieDirectionalG: 0.84
      },
      lanterns: {
        emissiveIntensity: 0.35,
        pointLightIntensity: 0.30
      }
    },
    night: {
      sun: {
        elevation: 52.0, // Ánh trăng từ trên cao soi sáng khắp khuôn viên
        azimuth: 210.0,
        color: 0xa4caff, // Ánh trăng bạc dịu mát
        intensity: 0.90  // Tăng cường ánh trăng để nhìn rõ từng nhân vật và kiến trúc
      },
      hemi: {
        skyColor: 0x4d75b3, // Vòm trời đêm xanh biếc soi rọi
        groundColor: 0x2c3b52, // Mặt đất đêm nhìn rõ hoa văn gạch đá, không bị tối đen
        intensity: 0.95 // Tăng ambient ban đêm giúp nhìn rõ toàn cảnh
      },
      rim: {
        color: 0x6d9be0,
        intensity: 0.45
      },
      exposure: {
        outdoor: 1.25, // Exposure đêm nâng cao để khung cảnh rõ ràng, thơ mộng
        indoor: 1.35
      },
      ibl: {
        intensity: 0.50 // Phản xạ ánh trăng trên bề mặt vật liệu
      },
      fog: {
        color: 0x18243b, // Sương đêm xanh lam sâu thẳm
        near: 45.0,
        far: 280.0
      },
      sky: {
        turbidity: 1.0,
        rayleigh: 0.05,
        mieCoefficient: 0.001,
        mieDirectionalG: 0.70
      },
      lanterns: {
        emissiveIntensity: 1.5, // Đèn lồng thắp sáng ấm áp nổi bật
        pointLightIntensity: 1.8
      }
    }
  }

  public static getPreset(mode: TimeOfDayMode): TimePresetConfig {
    return this.PRESETS[mode] || this.PRESETS.day
  }
}

