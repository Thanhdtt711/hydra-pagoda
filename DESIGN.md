# Hydra Pagoda — Binance Dark Design System

## 1. Overview & Philosophy
Hydra Pagoda presentation layer is redesigned following the **Binance Dark** design language:
- **Canvas:** Deep near-black canvas (`#0b0e11`).
- **Surfaces:** Card surface (`#1e2329`), elevated dropdowns/flyouts (`#2b3139`), hairlines (`#2b3139`).
- **Single Accent:** Binance Yellow (`#fcd535`, active `#f0b90b`, disabled `#3a3a1f`, text on yellow `#181a20`).
- **Trading Semantics:** Green (`#0ecb81`) and Red (`#f6465d`) strictly reserved for numbers and market delta/growth indicators. Never used as general card fills.
- **Pure Dark Mode:** Unified dark theme. No light theme variants, zero glassmorphism/backdrop blur, zero colored glows or neon shadows.
- **Drawer Paradigm:** All modals, panels, and tool windows slide smoothly from the right side (`max-w-[440px]`, full viewport height, non-dimming backdrop), ensuring the 3D sanctuary canvas remains visible and interactive.

---

## 2. Color Palette & Tokens

| Token | Hex Value | Semantic Role |
| :--- | :--- | :--- |
| `canvas-dark` | `#0b0e11` | Root canvas / viewport background |
| `surface-card` | `#1e2329` | Card surfaces, drawers, popovers |
| `surface-elevated`| `#2b3139` | Hover states, table headers, elevated cards |
| `hairline` | `#2b3139` | Structural 1px borders & dividers |
| `gold` / `primary` | `#fcd535` | Primary CTA, key highlights, active borders |
| `gold-active` | `#f0b90b` | Pressed/active CTA state |
| `gold-disabled` | `#3a3a1f` | Disabled CTA background (muted olive-yellow) |
| `on-primary` | `#181a20` | Dark typography on primary yellow buttons |
| `text-primary` | `#eaecef` | Primary text |
| `text-secondary` | `#848e9c` | Secondary / helper / muted labels |
| `trading-up` | `#0ecb81` | Tabular profit/gain, successful transactions |
| `trading-down` | `#f6465d` | Tabular loss/deduction, error borders |

---

## 3. Typography & Numbers
- **Body & Headings:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, sans-serif.
- **Numbers / Metrics:** `IBM Plex Sans`, `ui-monospace`, monospace with `font-variant-numeric: tabular-nums lining-nums`. Class: `font-numbers`.
- **Minimum Font Size:** No typography smaller than `12px` (Strictly enforced by test suite: no `text-[10px]`, `text-[11px]`, or sub-12px CSS).
- **Icons:** Standardized on `ZenIcon` SVG whitelist. Unicode emojis and dingbats (`⛩️`, `✓`, `✕`, etc.) are eliminated.

---

## 4. Right-Sliding Drawer Panels
- All dialogs (`UiModal`, `SanctuaryDrawer`, `WalletConnectModal`, `ZenChatDrawer`, `FortuneModal`, `MeditationModal`, `MeritBoxModal`, `SoundscapeMixer`, `CardCollectionModal`, `SanctuaryShop`, `DisclaimerBanner`, `EmoteWheel`) share the unified right drawer architecture.
- **Geometry:** `w-full sm:w-[380px] lg:w-[420px] max-w-[440px]`, full viewport height (`h-full top-0 right-0`).
- **Backdrop:** Transparent or subtle non-dimming overlay so pilgrims can see and interact with the 3D temple canvas simultaneously.
- **Focus & Keyboard:** Escape key dismisses open panel, restores focus to trigger element. Only one right drawer panel open at a time.

---

## 5. UI Primitives Inventory (`components/ui/*`)

1. **`UiButton.vue`:**
   - `variant="primary"`: Binance Yellow (`#fcd535`), text `#181a20`, hover `#f0b90b`, disabled `#3a3a1f`.
   - `variant="secondary"`: Dark surface (`#2b3139`), text `#eaecef`, hairline border.
   - `variant="ghost"`: Transparent background, hover `#2b3139`.
   - `variant="danger"`: Red `#f6465d` text/border.
   - `size="sm"` (28px), `size="md"` (40px), `size="lg"` (48px).
2. **`UiCard.vue`:**
   - Surface `#1e2329`, hairline `#2b3139`, radius `6px` / `8px`.
3. **`UiSelectableCard.vue`:**
   - Interactive selection card with yellow active border and check indicator.
4. **`UiBadge.vue`:**
   - Compact status pills (`gold`, `trading-up`, `trading-down`, `info`, `neutral`).
5. **`UiChip.vue`:**
   - Filter chips and toggles with tabular counts and indicator dots.
6. **`UiInput.vue`:**
   - 40px height, `#1e2329` surface, yellow focus ring (`#fcd535`), red error state.
7. **`UiKeycap.vue`:**
   - Flat dark keyboard shortcut indicator with `font-numbers`.
8. **`UiStatCell.vue`:**
   - Key-value metric displays with tabular numbers and semantic coloration.
9. **`UiTabs.vue`:**
   - Underline (2px yellow active line) and Segmented tab variants.
10. **`UiModal.vue`:**
    - Standardized right-sliding drawer panel container.
11. **`ZenIcon.vue`:**
    - Clean inline SVG vector icons.

---

## 6. Verification & Quality Gates
- **Primitive Rules Enforcement:** `node scripts/verify-ui-primitives.mjs` scans all components and pages for 0 banned symbols and 0 fonts < 12px.
- **Build Verification:** `npm run build` compiles client and nitro server with code 0.
- **Hydra L2 Test Suite:** `npm run wallet:test:hydra` tests simulated and real head transactions.

