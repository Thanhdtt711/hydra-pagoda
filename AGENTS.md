# AGENTS.md

This file provides guidance to AI coding assistants (Antigravity, Codex, etc.) when working with code in this repository.

---

## 1. Project Context

**Hydra Pagoda** (Vạn Cảnh Chùa / Vạn Cảnh Thiền Tự) is a 3D WebGL Virtual Sacred Pilgrimage & Zen Sanctuary on the **Cardano Blockchain** & **Hydra L2 Head**.

- **Core Vision:** A digital temple experience combining 3D cultural heritage preservation, mindfulness meditation, folk divination, and transparent Web3 micro-donations.
- **Key Modules:**
  - **3D Sanctuary World (`lib/world3d/`):** Three.js WebGL Đại Hùng Bảo Điện (40x30m), 500 meditation mats (`HallLayout.ts`), Shakyamuni Buddha statue, Tam Bảo altar, Tam Quan gate, Bodhi tree, realistic weather/atmosphere, and avatar navigation.
  - **Cardano Wallet Auth (`server/utils/wallet/auth.ts`, `stores/wallet.ts`):** CIP-30 wallet connection (Lace, Eternl, Vespr, Nami) + CIP-8 cryptographic signature verification generating JWT session tokens.
  - **In-Game Economy (`stores/economy.ts`, `server/utils/wallet/mcService.ts`):** Merit Coins (MC) off-chain ledger, Merit Box donations (Hòm Công Đức), and Sanctuary Shop (incense, lotus flowers, sky lanterns).
  - **Bói Quẻ 6 Môn Cầu An (`lib/boi/`):** Xin Xăm Bát Quái, Bát Tự Hà Lạc, Quẻ Dịch, Mai Hoa Dịch Số, Chiêm Tinh Tơ Duyên. Features daily free draws, deterministic daily seeds, and daily buff/debuff effects.
  - **Hội Thiền 432Hz (Meditate-to-Earn):** 432Hz Tibetan singing bowls, 4-4-6 Mandala breathing pacing, auto-walk to nearest meditation mat facing the Buddha statue, and server-verified MC rewards (daily cap 200 MC/account).
  - **Thẻ Bài Di Sản Cổ Tự (`stores/cards.ts`):** 3D heritage cards with bilingual audio lore, wisdom scriptures, Gacha pack monetization, and future Cardano CIP-68 NFT minting.
  - **Blockchain & Hydra L2 Notary:** L1 ADA deposits with Blockfrost/Koios indexer + Hydra Head L2 WebSocket client for micro-transactions with instant settlement and zero gas fees.

---

## 2. Tech Stack

- **Frontend:** **Nuxt 3** (SPA mode, `ssr: false`), **Vue 3** Composition API (`<script setup lang="ts">`), **TypeScript** (strict mode).
- **Styling:** **Tailwind CSS v4** (`@tailwindcss/vite`), **Binance Dark** design tokens (`DESIGN.md`).
- **3D Graphics:** **Three.js** (`three`), custom postprocessing, hybrid TPP/FPP camera rig, procedural materials.
- **Audio Engine:** Web Audio API procedural synthesis + ambient soundscapes (`lib/audio/ZenAudio.ts`).
- **State Management:** **Pinia** (`cards.ts`, `economy.ts`, `hydra.ts`, `user.ts`, `wallet.ts`).
- **Database & Backend:** **SQLite** via Node.js native `node:sqlite` (`DatabaseSync`), WAL mode, foreign keys, transaction wrappers (`server/utils/wallet/db.ts`).
- **Blockchain SDKs:** `@hydra-sdk/cardano-wasm`, `@hydra-sdk/core`, `@noble/curves`, `@noble/hashes`, `@scure/base`, `cbor2`.

---

## 3. Development Commands

```bash
# Development server (starts on http://localhost:3012)
npm run dev

# Production build (Nuxt 3 client + Nitro node-server)
npm run build

# Preview production build
npm run preview

# Static site generation
npm run generate

# UI Primitives & Design System Verification (0 fonts < 12px, 0 banned symbols)
node scripts/verify-ui-primitives.mjs

# Wallet & Hydra L2 Test Suites
npm run wallet:test:auth       # Test CIP-8 wallet login & JWT session
npm run wallet:test:deposit    # Test ADA -> MC deposit
npm run wallet:test:spend      # Test MC shop & fortune spending
npm run wallet:test:hydra      # Test Hydra L2 Head integration (11/11 tests)
npm run wallet:reconcile       # Verify mc_ledger balance vs accounts.mc_balance

# Fortune Engine Test Suite
npm run boi:test               # Test fortune generation, topics, and daily seeds

# Hydra Head Mock / Local Node
npm run hydra:mock             # Start mock hydra-node WebSocket server (ws://127.0.0.1:4001)
npm run hydra:prepare          # Prepare Hydra Head dev credentials
npm run hydra:up               # Start local Docker Hydra Head
npm run hydra:down             # Stop local Docker Hydra Head
```

---

## 4. Architecture & Data Flow

```
User Action (3D Canvas / SanctuaryDrawer)
   │
   ▼
Pinia Store (`stores/economy.ts`, `stores/wallet.ts`, `stores/cards.ts`)
   │
   ▼
Nitro API Routes (`server/api/mc/*`, `server/api/auth/*`, `server/api/shop/*`)
   │
   ├──> SQLite Ledger (`mc_ledger`, `accounts`, `fortune_records`, `sessions`)
   │
   └──> Hydra Head L2 Client (`server/utils/hydra/hydraClient.ts` Notary Mode)
           │
           ▼
        Hydra Snapshot Confirmation (`hydra_status = 'snapshot_confirmed'`)
```

- **`lib/world3d/`** — Three.js rendering pipeline (`TempleStage.ts`), Sanctuary layout & 500 meditation spots (`HallLayout.ts`), avatars, atmospheric lighting, and post-processing.
- **`lib/boi/`** — Deterministic fortune engine (`FortuneEngine.ts`), content repository (`ContentRepository.ts`), metaphysics calculations (`MetaphysicsService.ts`), and gameplay state (`GameplayService.ts`).
- **`lib/audio/`** — Synthesized bell sounds, singing bowls, and ambient soundscapes (`ZenAudio.ts`).
- **`server/utils/wallet/`** — Ledger operations (`mcService.ts`), database migrations (`db.ts`), wallet auth & COSE verification (`auth.ts`, `cose.ts`), Blockfrost/Koios cached client (`blockfrost.ts`), order processing (`orders.ts`).
- **`server/utils/hydra/`** — Hydra L2 client (`hydraClient.ts`), L2 transaction builder (`l2TxBuilder.ts`), session ephemeral keys (`sessionKey.ts`).
- **`components/ui/`** — Standardized Binance Dark primitives (`UiButton`, `UiCard`, `UiSelectableCard`, `UiTabs`, `UiModal`, `UiBadge`, `ZenIcon`).

---

## 5. Design System: Binance Dark (`DESIGN.md`)

All UI elements must strictly adhere to the Binance Dark design language:

- **Colors:**
  - Root Canvas: `#0b0e11`
  - Card Surfaces: `#1e2329`
  - Elevated Surfaces / Hovers: `#2b3139`
  - Hairline Borders: `#2b3139`
  - Primary Accent: Binance Yellow (`#fcd535`, active `#f0b90b`, disabled `#3a3a1f`, text on yellow `#181a20`)
  - Semantic Trading Colors: Green (`#0ecb81`) and Red (`#f6465d`) are **strictly reserved for tabular numbers, transaction gains/losses, and status indicators**. Never use them as background card fills.
- **Typography:**
  - Minimum font size: **`12px` (`text-xs`)**. Fonts smaller than 12px (e.g. `text-[10px]`, `text-[11px]`) are prohibited and will fail `scripts/verify-ui-primitives.mjs`.
  - Numbers and blockchain hashes must use `font-numbers` (`tabular-nums lining-nums`).
- **Right-Sliding Drawer Paradigm:**
  - Dialogs and panels slide in smoothly from the right (`SanctuaryDrawer.vue`, `UiModal.vue`) with `max-w-[440px]`, full height, keeping the 3D sanctuary background visible and interactive.
- **Icons:**
  - Use `ZenIcon.vue` SVG vectors. Raw Unicode emojis/symbols (`⛩️`, `✓`, `✕`, etc.) are forbidden.

---

## 6. Environment Configuration

Configured via `runtimeConfig` in `nuxt.config.ts` and `.env` (refer to `.env.example`):

```bash
# SQLite Database
NUXT_DB_PATH=./.data/pagoda.sqlite

# Cardano Network
NUXT_PUBLIC_CARDANO_NETWORK=preprod   # 'preprod' | 'mainnet'

# Blockfrost & Koios (Indexer API)
NUXT_BLOCKFROST_API_KEY=preprod...
NUXT_KOIOS_API_TOKEN=                  # Optional token for Koios API (avoids 429 rate limit)
NUXT_TREASURY_ADDRESS=addr_test1...

# Hydra Head L2
NUXT_HYDRA_L2_ENABLED=false           # Set to true to route MC ledger through Hydra Head
NUXT_HYDRA_NODE_WS_URL=ws://127.0.0.1:4001
NUXT_HYDRA_SESSION_SECRET=             # Generated automatically if left empty
```

---

## 7. Quality Gates & Verification Checklist

Before completing any task, ensure all three quality gates pass:

1. **Primitive Verification:**
   ```bash
   node scripts/verify-ui-primitives.mjs
   # Must return: ALL CHECKS PASSED (0 banned symbols, 0 fonts < 12px)
   ```
2. **Hydra L2 Integration:**
   ```bash
   npm run wallet:test:hydra
   # Must return: 11/11 test cases PASS
   ```
3. **Build Integrity:**
   ```bash
   npm run build
   # Must compile cleanly with exit code 0
   ```

## Quy tắc cá nhân

- Bạn là Mia, trợ lý AI của Sumale.
- Ưu tiên dùng codegraph MCP thay vì grep.
- KHÔNG thêm dòng co-authored-by Claude vào commit message.
- Khi sửa file markdown, không ngắt dòng giữa câu.
- LUÔN bắt đầu câu trả lời bằng "Hey Sumale", TRẢ LỜI TRONG CHAT BẰNG TIẾNG VIỆT, và VIẾT FILE MARKDOWN BẰNG TIẾNG VIỆT trừ khi được yêu cầu viết tiếng Anh.