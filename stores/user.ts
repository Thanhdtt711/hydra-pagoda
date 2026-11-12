import { defineStore } from 'pinia'

export type CountryId =
  | 'vietnam'
  | 'japan'
  | 'thailand'
  | 'korea'
  | 'taiwan'
  | 'singapore'
  | 'india'
  | 'tibet'
  | 'western'

export type CameraMode = 'fpp' | 'tpp_back'
export type UserGender = 'female' | 'male'

const GENDER_STORAGE_KEY = 'van_canh_user_gender'

function loadInitialGender(): UserGender {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(GENDER_STORAGE_KEY)
      if (saved === 'male' || saved === 'female') return saved
    } catch {
      // ignore storage errors
    }
  }
  return 'female'
}

export interface UserState {
  name: string
  title: string
  currentCountry: CountryId
  gender: UserGender
  selectedOutfit: string
  unlockedOutfits: string[]
  totalMinutesMeditated: number
  cameraMode: CameraMode
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    name: 'Hành Giả Tâm An',
    title: 'Sơ Tâm Nhập Đạo',
    currentCountry: 'vietnam',
    gender: loadInitialGender(),
    selectedOutfit: 'ao_lam',
    unlockedOutfits: ['ao_lam', 'samue', 'phap_phuc_trang', 'temple_stay_grey'],
    totalMinutesMeditated: 0,
    cameraMode: 'tpp_back'
  }),

  actions: {
    setCountry(country: CountryId) {
      this.currentCountry = country
    },
    setGender(gender: UserGender) {
      this.gender = gender
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(GENDER_STORAGE_KEY, gender)
        } catch {
          // ignore storage errors
        }
      }
    },
    toggleGender() {
      this.setGender(this.gender === 'female' ? 'male' : 'female')
    },
    setOutfit(outfitId: string) {
      if (this.unlockedOutfits.includes(outfitId)) {
        this.selectedOutfit = outfitId
      }
    },
    cycleCamera() {
      this.cameraMode = this.cameraMode === 'fpp' ? 'tpp_back' : 'fpp'
    },
    toggleCamera() {
      this.cycleCamera()
    },
    setCameraMode(mode: CameraMode) {
      this.cameraMode = mode
    },
    /** Chỉ cộng số phút. Chuỗi ngày tu do server giữ (stores/streak.ts), không tính ở client. */
    recordMeditation(minutes: number) {
      this.totalMinutesMeditated += minutes
    }
  }
})

