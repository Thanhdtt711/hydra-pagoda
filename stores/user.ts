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

export interface UserState {
  name: string
  title: string
  currentCountry: CountryId
  selectedOutfit: string
  unlockedOutfits: string[]
  streakDays: number
  totalMinutesMeditated: number
  lastMeditatedDate: string | null
  cameraMode: CameraMode
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    name: 'Hành Giả Tâm An',
    title: 'Sơ Tâm Nhập Đạo',
    currentCountry: 'vietnam',
    selectedOutfit: 'ao_lam',
    unlockedOutfits: ['ao_lam', 'samue', 'phap_phuc_trang', 'temple_stay_grey'],
    streakDays: 3,
    totalMinutesMeditated: 45,
    lastMeditatedDate: null,
    cameraMode: 'tpp_back'
  }),

  actions: {
    setCountry(country: CountryId) {
      this.currentCountry = country
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
    recordMeditation(minutes: number) {
      this.totalMinutesMeditated += minutes
      const today = new Date().toISOString().split('T')[0]
      if (this.lastMeditatedDate !== today) {
        this.streakDays += 1
        this.lastMeditatedDate = today
      }
    }
  }
})

