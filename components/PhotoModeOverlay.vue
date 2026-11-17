<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiKeycap from '~/components/ui/UiKeycap.vue'
import ZenIcon from '~/components/ZenIcon.vue'
import { tr } from '~/lib/ui/copy'
import type { TempleStage } from '~/lib/world3d/TempleStage'

export type PhotoFilterId = 'none' | 'warm' | 'cool' | 'mono'
export type PhotoFrameId = 'none' | 'lacquer' | 'cinema'

interface Props {
  stage: TempleStage | null
  timeOfDay: 'day' | 'sunset' | 'night'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'change-time', mode: 'day' | 'sunset' | 'night'): void
  (e: 'captured', filename: string): void
}>()

const STORAGE_KEY = 'van_canh_photo_prefs_v1'

const filterId = ref<PhotoFilterId>('none')
const frameId = ref<PhotoFrameId>('lacquer')
const fov = ref<number>(48)
const showWaterMark = ref<boolean>(true)
const showCharacter = ref<boolean>(true)
const flashActive = ref<boolean>(false)

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (['none', 'warm', 'cool', 'mono'].includes(parsed.filterId)) filterId.value = parsed.filterId
      if (['none', 'lacquer', 'cinema'].includes(parsed.frameId)) frameId.value = parsed.frameId
      if (typeof parsed.fov === 'number' && parsed.fov >= 28 && parsed.fov <= 75) fov.value = parsed.fov
      if (typeof parsed.showWaterMark === 'boolean') showWaterMark.value = parsed.showWaterMark
    }
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage
  }
  syncStageState()
})

function savePrefs() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        filterId: filterId.value,
        frameId: frameId.value,
        fov: fov.value,
        showWaterMark: showWaterMark.value
      })
    )
  } catch {
    // Bỏ qua lỗi lưu trữ
  }
}

function syncStageState() {
  if (!props.stage) return
  props.stage.setPhotoMode(true, fov.value)
  if (props.stage.avatar) {
    props.stage.avatar.root.visible = showCharacter.value && props.stage.cameraMode !== 'fpp'
  }
}

watch([filterId, frameId, fov, showWaterMark], () => {
  savePrefs()
  syncStageState()
})

watch(showCharacter, () => {
  syncStageState()
})

function cssFilterString(id: PhotoFilterId): string {
  switch (id) {
    case 'warm':
      return 'sepia(0.28) saturate(1.25) contrast(1.06) brightness(1.02)'
    case 'cool':
      return 'saturate(0.88) hue-rotate(12deg) contrast(1.08) brightness(0.98)'
    case 'mono':
      return 'grayscale(0.92) contrast(1.18) brightness(0.98)'
    default:
      return 'none'
  }
}

function capturePhoto() {
  if (!props.stage) return
  const srcCanvas = props.stage.renderImmediateFrame()
  const w = srcCanvas.width || 1920
  const h = srcCanvas.height || 1080

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return

  // 1. Vẽ khung hình WebGL kèm bộ lọc màu
  ctx.save()
  const filterCss = cssFilterString(filterId.value)
  if (filterCss !== 'none' && 'filter' in ctx) {
    ctx.filter = filterCss
  }
  ctx.drawImage(srcCanvas, 0, 0, w, h)
  ctx.restore()

  // Fallback phủ màu nếu trình duyệt không hỗ trợ ctx.filter
  if (filterId.value === 'warm') {
    ctx.fillStyle = 'rgba(201, 162, 75, 0.08)'
    ctx.fillRect(0, 0, w, h)
  } else if (filterId.value === 'cool') {
    ctx.fillStyle = 'rgba(30, 70, 110, 0.08)'
    ctx.fillRect(0, 0, w, h)
  }

  // 2. Vẽ khung ảnh (Frame)
  if (frameId.value === 'cinema') {
    const barH = Math.round(h * 0.09)
    ctx.fillStyle = '#100e0c'
    ctx.fillRect(0, 0, w, barH)
    ctx.fillRect(0, h - barH, w, barH)
    ctx.strokeStyle = '#c9a24b'
    ctx.lineWidth = Math.max(1, Math.round(h * 0.002))
    ctx.beginPath()
    ctx.moveTo(0, barH)
    ctx.lineTo(w, barH)
    ctx.moveTo(0, h - barH)
    ctx.lineTo(w, h - barH)
    ctx.stroke()
  } else if (frameId.value === 'lacquer') {
    const pad = Math.round(Math.min(w, h) * 0.024)
    ctx.strokeStyle = '#100e0c'
    ctx.lineWidth = pad * 2
    ctx.strokeRect(0, 0, w, h)

    ctx.strokeStyle = '#c9a24b'
    ctx.lineWidth = Math.max(2, Math.round(pad * 0.16))
    ctx.strokeRect(pad, pad, w - pad * 2, h - pad * 2)

    const inner = pad + Math.max(4, Math.round(pad * 0.32))
    ctx.strokeStyle = 'rgba(201, 162, 75, 0.45)'
    ctx.lineWidth = 1
    ctx.strokeRect(inner, inner, w - inner * 2, h - inner * 2)
  }

  // 3. Dấu ấn chùa (Watermark)
  if (showWaterMark.value) {
    const marginX = Math.round(w * 0.035)
    const marginY = frameId.value === 'cinema' ? Math.round(h * 0.045) : Math.round(h * 0.045)
    const fontSize = Math.max(14, Math.round(h * 0.022))

    ctx.save()
    ctx.font = `bold ${fontSize}px "Be Vietnam Pro", sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = 'rgba(16, 14, 12, 0.72)'
    ctx.fillText(tr('Vạn Cảnh Thiền Tự · Hydra Pagoda', 'Van Canh Sanctuary · Hydra Pagoda'), w - marginX + 1, h - marginY + 1)
    ctx.fillStyle = '#c9a24b'
    ctx.fillText(tr('Vạn Cảnh Thiền Tự · Hydra Pagoda', 'Van Canh Sanctuary · Hydra Pagoda'), w - marginX, h - marginY)
    ctx.restore()
  }

  // Hiệu ứng chớp màn trập nhẹ
  flashActive.value = true
  setTimeout(() => {
    flashActive.value = false
  }, 180)

  const filename = `van-canh-pagoda-${Date.now()}.png`
  const dataUrl = out.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  emit('captured', filename)
}
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-40 select-none">
    <!-- Lớp phủ xem trước bộ lọc trên màn hình -->
    <div
      v-if="filterId !== 'none'"
      class="fixed inset-0 pointer-events-none"
      :style="{ backdropFilter: cssFilterString(filterId), WebkitBackdropFilter: cssFilterString(filterId) }"
    />

    <!-- Khung sơn mài xem trước -->
    <div
      v-if="frameId === 'lacquer'"
      class="fixed inset-3 pointer-events-none border-2 border-[#c9a24b] rounded-[2px]"
    >
      <div class="absolute inset-1 border border-[#c9a24b]/40 rounded-[2px]" />
    </div>

    <!-- Khung điện ảnh xem trước -->
    <template v-if="frameId === 'cinema'">
      <div class="fixed top-0 left-0 right-0 h-[8vh] bg-[#100e0c] border-b border-[#c9a24b] pointer-events-none" />
      <div class="fixed bottom-0 left-0 right-0 h-[8vh] bg-[#100e0c] border-t border-[#c9a24b] pointer-events-none" />
    </template>

    <!-- Dấu ấn xem trước -->
    <div
      v-if="showWaterMark"
      class="fixed right-6 bottom-24 pointer-events-none text-xs font-bold text-[#c9a24b] bg-[#100e0c]/75 px-2.5 py-1 rounded-[2px] border border-[#332d26]"
    >
      {{ tr('Vạn Cảnh Thiền Tự · Hydra Pagoda', 'Van Canh Sanctuary · Hydra Pagoda') }}
    </div>

    <!-- Chớp màn trập khi chụp -->
    <div
      v-if="flashActive"
      class="fixed inset-0 bg-[#f6ecd8]/60 pointer-events-none transition-opacity duration-150"
    />

    <!-- Thanh điều khiển máy ảnh gọn ở đáy màn hình -->
    <aside
      role="region"
      :aria-label="tr('Chế độ chụp ảnh', 'Photo mode controls')"
      class="pointer-events-auto fixed left-1/2 -translate-x-1/2 bottom-5 w-[94%] max-w-2xl bg-[#1a1714] border border-[#332d26] rounded-[2px] shadow-2xl px-4 py-3 space-y-2.5 text-white"
    >
      <div class="flex items-center justify-between gap-2 border-b border-[#332d26] pb-2">
        <div class="flex items-center gap-2">
          <ZenIcon name="camera" :size="18" class="text-[#c9a24b]" />
          <h3 class="text-sm font-bold text-white m-0">{{ tr('Chế Độ Ảnh', 'Photo Mode') }}</h3>
          <span class="text-xs text-[#a89c88]">
            {{ tr('Kéo chuột xoay góc máy · Lăn chuột thu phóng', 'Drag mouse to orbit · Scroll to zoom') }}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <UiKeycap>P</UiKeycap>
          <UiButton variant="ghost" size="sm" @click="emit('close')">
            {{ tr('Thoát', 'Exit') }}
          </UiButton>
        </div>
      </div>

      <!-- Hàng chọn Bộ lọc, Khung viền, Thời gian -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div class="bg-[#100e0c] border border-[#332d26] rounded-[2px] p-2 space-y-1">
          <div class="text-[#a89c88] font-medium">{{ tr('Màu sắc', 'Color Filter') }}</div>
          <div class="grid grid-cols-2 gap-1">
            <button
              v-for="opt in ([
                { id: 'none', vi: 'Nguyên bản', en: 'Original' },
                { id: 'warm', vi: 'Hoàng kim', en: 'Warm Gold' },
                { id: 'cool', vi: 'Thanh tịnh', en: 'Cool Zen' },
                { id: 'mono', vi: 'Thủy mặc', en: 'Monochrome' }
              ] as const)"
              :key="opt.id"
              type="button"
              class="px-2 py-1 rounded-[2px] border text-xs font-medium cursor-pointer transition"
              :class="filterId === opt.id
                ? 'border-[#c9a24b] bg-[#26221d] text-[#c9a24b]'
                : 'border-[#332d26] bg-[#1a1714] text-[#ede4d3] hover:bg-[#26221d]'"
              @click="filterId = opt.id"
            >
              {{ tr(opt.vi, opt.en) }}
            </button>
          </div>
        </div>

        <div class="bg-[#100e0c] border border-[#332d26] rounded-[2px] p-2 space-y-1">
          <div class="text-[#a89c88] font-medium">{{ tr('Khung viền', 'Frame Style') }}</div>
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="opt in ([
                { id: 'none', vi: 'Tắt', en: 'None' },
                { id: 'lacquer', vi: 'Sơn mài', en: 'Lacquer' },
                { id: 'cinema', vi: 'Điện ảnh', en: 'Cinema' }
              ] as const)"
              :key="opt.id"
              type="button"
              class="px-2 py-1 rounded-[2px] border text-xs font-medium cursor-pointer transition"
              :class="frameId === opt.id
                ? 'border-[#c9a24b] bg-[#26221d] text-[#c9a24b]'
                : 'border-[#332d26] bg-[#1a1714] text-[#ede4d3] hover:bg-[#26221d]'"
              @click="frameId = opt.id"
            >
              {{ tr(opt.vi, opt.en) }}
            </button>
          </div>
          <div class="flex items-center justify-between pt-1">
            <label class="flex items-center gap-1.5 text-xs text-[#ede4d3] cursor-pointer">
              <input v-model="showWaterMark" type="checkbox" class="accent-[#c9a24b]" />
              <span>{{ tr('Dấu ấn chùa', 'Watermark') }}</span>
            </label>
            <label class="flex items-center gap-1.5 text-xs text-[#ede4d3] cursor-pointer">
              <input v-model="showCharacter" type="checkbox" class="accent-[#c9a24b]" />
              <span>{{ tr('Nhân vật', 'Character') }}</span>
            </label>
          </div>
        </div>

        <div class="bg-[#100e0c] border border-[#332d26] rounded-[2px] p-2 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[#a89c88] font-medium">{{ tr('Thời khắc', 'Time of Day') }}</span>
            <span class="font-numbers text-xs text-[#c9a24b]">FOV {{ fov }}°</span>
          </div>
          <div class="grid grid-cols-3 gap-1">
            <button
              v-for="tm in ([
                { id: 'day', vi: 'Ngày', en: 'Day' },
                { id: 'sunset', vi: 'Chiều', en: 'Sunset' },
                { id: 'night', vi: 'Đêm', en: 'Night' }
              ] as const)"
              :key="tm.id"
              type="button"
              class="px-2 py-1 rounded-[2px] border text-xs font-medium cursor-pointer transition"
              :class="props.timeOfDay === tm.id
                ? 'border-[#c9a24b] bg-[#26221d] text-[#c9a24b]'
                : 'border-[#332d26] bg-[#1a1714] text-[#ede4d3] hover:bg-[#26221d]'"
              @click="emit('change-time', tm.id)"
            >
              {{ tr(tm.vi, tm.en) }}
            </button>
          </div>
          <input
            v-model.number="fov"
            type="range"
            min="28"
            max="75"
            step="1"
            :aria-label="tr('Tiêu cự ống kính', 'Camera field of view')"
            class="w-full accent-[#c9a24b] cursor-pointer"
          />
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-0.5">
        <UiButton variant="primary" size="sm" @click="capturePhoto">
          {{ tr('Chụp ảnh PNG', 'Capture PNG') }}
        </UiButton>
      </div>
    </aside>
  </div>
</template>

