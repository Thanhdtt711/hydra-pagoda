<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiCard from '~/components/ui/UiCard.vue'
import UiSelectableCard from '~/components/ui/UiSelectableCard.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiStatCell from '~/components/ui/UiStatCell.vue'
import UiDataRow from '~/components/ui/UiDataRow.vue'
import UiModal from '~/components/ui/UiModal.vue'
import UiKeycap from '~/components/ui/UiKeycap.vue'

const activeTab = ref('boique')
const tabOptions = [
  { id: 'boique', label: 'Bói Quẻ 6 Môn' },
  { id: 'cuahang', label: 'Cửa Hàng' },
  { id: 'congduc', label: 'Công Đức' },
  { id: 'thedisan', label: 'Thẻ Di Sản' },
  { id: 'hoithien', label: 'Hội Thiền' }
]

const sampleInputValue = ref('addr_test1qrx...')
const showSidePanel = ref(false)

const fortuneMethods = [
  { id: 'method-a', title: 'Xin Nhanh', desc: 'Rút quẻ tức thì (theo Bát Tự mặc định)' },
  { id: 'method-b', title: 'Chọn Câu Hỏi', desc: 'Danh sách 24 câu hỏi mẫu theo chuyên mục' },
  { id: 'method-c', title: 'Khai Bát Tự', desc: 'Tính Can Chi, Ngũ Hành, Cung Phi chi tiết' }
]
const selectedMethod = ref('method-a')
</script>

<template>
  <div class="min-h-screen bg-canvas-dark text-primary font-sans p-5 sm:p-10 select-text">
    <div class="max-w-[1040px] mx-auto space-y-9">
      <!-- Header -->
      <header class="pb-6 border-b border-hairline">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs uppercase tracking-wider text-secondary font-semibold">Hệ Thống Thiết Kế</span>
          <UiBadge variant="warning">BINANCE SPEC DARK</UiBadge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-white mb-2">Vạn Cảnh Thiền Tự — Thư Viện UI Primitives</h1>
        <p class="text-sm text-secondary leading-normal max-w-3xl">
          Hệ thiết kế tài chính kỷ luật Binance Dark. Inter cho chữ chạy, IBM Plex Sans cho số liệu (tabular-nums), một accent vàng #fcd535 duy nhất, không biểu tượng cảm xúc, không gradient trang trí, không hiệu ứng kính mờ.
        </p>
      </header>

      <!-- Section: Typography & Numbers -->
      <section class="space-y-4">
        <h2 class="text-base font-bold text-white tracking-wide">1. Kiểu Chữ &amp; Số Liệu (Typography &amp; Tabular Numbers)</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UiCard variant="card-dark" padding="md">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-secondary mb-3">Font Chữ Chạy: Inter (>= 12px)</h3>
            <div class="space-y-3">
              <div>
                <span class="text-xs text-secondary block">H1 / 24px Bold</span>
                <span class="text-2xl font-bold text-primary">Chiêm Bốc Tâm Linh 6 Môn</span>
              </div>
              <div>
                <span class="text-xs text-secondary block">H2 / 18px Bold</span>
                <span class="text-lg font-bold text-primary">Bói Quẻ Cầu An Bát Quái</span>
              </div>
              <div>
                <span class="text-xs text-secondary block">Body / 14px Regular</span>
                <p class="text-sm text-secondary leading-normal">
                  Khai tâm niệm Phật, mỗi ngày một quẻ cát tường định hướng công việc và gia đạo bình an.
                </p>
              </div>
              <div>
                <span class="text-xs text-secondary block">Label / 12px Regular (Cỡ nhỏ nhất)</span>
                <p class="text-xs text-secondary">Nhất quán theo PRNG seed ngày — Không thay đổi logic.</p>
              </div>
            </div>
          </UiCard>

          <UiCard variant="card-dark" padding="md">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-secondary mb-3">Số Liệu: IBM Plex Sans (tabular-nums)</h3>
            <div class="space-y-4">
              <div class="flex items-center justify-between py-2 border-b border-hairline">
                <span class="text-sm text-secondary">Số dư MC Coin:</span>
                <span class="text-lg font-semibold font-numbers text-gold">1.250 MC</span>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-hairline">
                <span class="text-sm text-secondary">Tỷ lệ quy đổi Cardano:</span>
                <span class="text-sm font-semibold font-numbers text-primary">1 ADA = 1.000 MC</span>
              </div>
              <div class="flex items-center justify-between py-2 border-b border-hairline">
                <span class="text-sm text-secondary">Lượt chiêm bái hôm nay:</span>
                <span class="text-sm font-semibold font-numbers text-up">1 / 1 (Miễn phí)</span>
              </div>
              <div class="flex items-center justify-between py-2">
                <span class="text-sm text-secondary">Thời gian khóa công đức:</span>
                <span class="text-sm font-semibold font-numbers text-secondary">14:00:25 UTC</span>
              </div>
            </div>
          </UiCard>
        </div>
      </section>

      <!-- Section: Buttons -->
      <section class="space-y-4">
        <h2 class="text-base font-bold text-white tracking-wide">2. Nút Bấm (UiButton) — Tối Đa 1–2 Nút Vàng #fcd535 Mỗi Màn</h2>
        <UiCard variant="card-dark" padding="md">
          <div class="space-y-6">
            <div>
              <span class="text-xs font-semibold uppercase tracking-wider text-secondary block mb-2">Các biến thể chính (40px chuẩn)</span>
              <div class="flex flex-wrap items-center gap-3">
                <UiButton variant="primary">Hành Động Chính (Vàng)</UiButton>
                <UiButton variant="secondary">Hành Động Phụ (Tối)</UiButton>
                <UiButton variant="ghost">Nút Ghost</UiButton>
                <UiButton variant="link">Nút Dạng Link</UiButton>
              </div>
            </div>

            <div>
              <span class="text-xs font-semibold uppercase tracking-wider text-secondary block mb-2">Trạng thái (Disabled, Loading, Kích thước nhỏ 28px)</span>
              <div class="flex flex-wrap items-center gap-3">
                <UiButton variant="primary" disabled>Nút Vàng Khóa (#3a3a1f)</UiButton>
                <UiButton variant="secondary" disabled>Nút Phụ Khóa</UiButton>
                <UiButton variant="primary" loading>Đang Xử Lý</UiButton>
                <UiButton variant="primary" size="sm">Nạp MC</UiButton>
                <UiButton variant="secondary" size="sm">Cài Đặt</UiButton>
                <UiButton variant="primary" pill>Dạng Viên Thuốc</UiButton>
              </div>
            </div>
          </div>
        </UiCard>
      </section>

      <!-- Section: Tabs -->
      <section class="space-y-4">
        <h2 class="text-base font-bold text-white tracking-wide">3. Thanh Điều Hướng Tab (UiTabs) — Gạch Chân Vàng 2px</h2>
        <UiCard variant="card-dark" padding="md">
          <div class="space-y-6">
            <div>
              <span class="text-xs font-semibold uppercase tracking-wider text-secondary block mb-3">Kiểu 1: Gạch chân (Horizontal) — Thanh cuộn ngang phẳng</span>
              <UiTabs v-model="activeTab" :items="tabOptions" layout="horizontal" />
            </div>

            <div class="pt-4 border-t border-hairline">
              <span class="text-xs font-semibold uppercase tracking-wider text-secondary block mb-3">Kiểu 2: Phân đoạn (Segmented)</span>
              <UiTabs v-model="activeTab" :items="tabOptions" layout="segmented" />
            </div>
          </div>
        </UiCard>
      </section>

      <!-- Section: Selectable Cards -->
      <section class="space-y-4">
        <h2 class="text-base font-bold text-white tracking-wide">4. Thẻ Chọn (UiSelectableCard) — Viền Vàng + Tick SVG Khi Chọn</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <UiSelectableCard
            v-for="method in fortuneMethods"
            :key="method.id"
            :selected="selectedMethod === method.id"
            @select="selectedMethod = method.id"
          >
            <div class="space-y-1">
              <div class="font-semibold text-sm text-primary">{{ method.title }}</div>
              <div class="text-xs text-secondary leading-normal">{{ method.desc }}</div>
            </div>
          </UiSelectableCard>
        </div>
      </section>

      <!-- Section: Inputs -->
      <section class="space-y-4">
        <h2 class="text-base font-bold text-white tracking-wide">5. Ô Nhập Liệu (UiInput) — Chiều Cao 40px, Focus Viền Vàng</h2>
        <UiCard variant="card-dark" padding="md">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UiInput v-model="sampleInputValue" placeholder="Nhập địa chỉ ví hoặc từ khóa..." />
            <UiInput placeholder="Ô nhập bị khóa (Disabled)" disabled />
            <UiInput placeholder="Ô nhập có lỗi" error="Số MC không đủ để chiêm nghiệm" />
          </div>
        </UiCard>
      </section>

      <!-- Section: Badges & Chips -->
      <section class="space-y-4">
        <h2 class="text-base font-bold text-white tracking-wide">6. Huy Hiệu &amp; Thẻ Tài Nguyên (UiBadge, UiChip, UiStatCell)</h2>
        <UiCard variant="card-dark" padding="md">
          <div class="space-y-4">
            <div>
              <span class="text-xs font-semibold uppercase tracking-wider text-secondary block mb-2">Huy Hiệu Trạng Thái (UiBadge)</span>
              <div class="flex flex-wrap items-center gap-2">
                <UiBadge variant="neutral">NEUTRAL</UiBadge>
                <UiBadge variant="warning" dot>TESTNET (PREPROD)</UiBadge>
                <UiBadge variant="success" dot>ĐÃ KẾT NỐI</UiBadge>
                <UiBadge variant="danger" dot>MẤT KẾT NỐI</UiBadge>
                <UiBadge variant="info">CIP-30 VERIFIED</UiBadge>
              </div>
            </div>

            <div class="pt-3 border-t border-hairline">
              <span class="text-xs font-semibold uppercase tracking-wider text-secondary block mb-2">Thẻ HUD (UiChip) &amp; Phím Tắt (UiKeycap)</span>
              <div class="flex flex-wrap items-center gap-3">
                <UiChip value="3" label="Ngày Tu" />
                <UiChip value="0 MC" label="Hành Trang" dot-color="warning" />
                <UiChip value="1" label="Đồng Tu" dot-color="success" />
                <div class="flex items-center gap-1.5 text-xs text-secondary">
                  <span>Phím tắt:</span>
                  <UiKeycap>1</UiKeycap>
                  <span>Bói Quẻ</span>
                  <UiKeycap>F4</UiKeycap>
                  <span>Đồ Họa</span>
                </div>
              </div>
            </div>

            <div class="pt-3 border-t border-hairline">
              <span class="text-xs font-semibold uppercase tracking-wider text-secondary block mb-2">Ô Thống Kê 2 Dòng (UiStatCell)</span>
              <div class="flex flex-wrap items-center gap-8">
                <UiStatCell label="Lượt Hôm Nay" value="1/1" variant="success" />
                <UiStatCell label="Số Dư Off-Chain" value="0" unit="MC" highlight>
                  <template #action>
                    <UiButton variant="primary" size="sm" class="ml-2">+ Nạp</UiButton>
                  </template>
                </UiStatCell>
                <UiStatCell label="Trạng Thái Mạng" value="PREPROD" variant="gold" />
              </div>
            </div>
          </div>
        </UiCard>
      </section>

      <!-- Section: Markets Row Format -->
      <section class="space-y-4">
        <h2 class="text-base font-bold text-white tracking-wide">7. Dòng Dữ Liệu Kiểu Thị Trường (UiDataRow) — Phẳng, Viền Mảnh</h2>
        <UiCard variant="card-dark" padding="none">
          <UiDataRow
            title="Xin Xăm Bát Quái"
            subtitle="Bổn mạng &amp; Sự nghiệp trong năm"
            value="Miễn phí"
            subvalue="Còn 1 lượt"
            clickable
          >
            <template #trailing>
              <UiButton variant="secondary" size="sm">Chọn</UiButton>
            </template>
          </UiDataRow>
          <UiDataRow
            title="Tơ Duyên Tương Ngộ"
            subtitle="Nguyệt Lão chỉ hồng lương duyên"
            value="50 MC"
            subvalue="Off-chain"
            clickable
          >
            <template #trailing>
              <UiButton variant="secondary" size="sm">Chọn</UiButton>
            </template>
          </UiDataRow>
          <UiDataRow
            title="Dược Sư An Khang"
            subtitle="Tiêu tai trừ bệnh, thân tâm an lạc"
            value="50 MC"
            subvalue="Off-chain"
            clickable
          >
            <template #trailing>
              <UiButton variant="secondary" size="sm">Chọn</UiButton>
            </template>
          </UiDataRow>
        </UiCard>
      </section>

      <!-- Section: Right-side Drawer Panel Trigger -->
      <section class="space-y-4">
        <h2 class="text-base font-bold text-white tracking-wide">8. Panel Đóng/Mở Bên Phải (UiModal Side Drawer)</h2>
        <div>
          <UiButton variant="primary" @click="showSidePanel = true">Mở Thử Nghiệm Panel Bên Phải</UiButton>
        </div>
      </section>

      <!-- Side Drawer Demo -->
      <UiModal
        v-if="showSidePanel"
        title="Bói Quẻ 6 Môn Cầu An"
        subtitle="Chọn môn bói phù hợp với sở nguyện hôm nay"
        @close="showSidePanel = false"
      >
        <p class="text-sm text-secondary leading-normal">
          Mỗi ngày đạo tràng trợ duyên 1 lượt gieo quẻ miễn phí theo Seed ngày.
        </p>
        <UiCard variant="elevated-dark" padding="sm">
          <div class="text-xs text-secondary">Trạng thái: Đã sẵn sàng gieo quẻ</div>
        </UiCard>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UiButton variant="ghost" @click="showSidePanel = false">Đóng</UiButton>
            <UiButton variant="primary" @click="showSidePanel = false">Bắt Đầu</UiButton>
          </div>
        </template>
      </UiModal>
    </div>
  </div>
</template>
