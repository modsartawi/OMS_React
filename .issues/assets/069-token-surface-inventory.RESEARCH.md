# 069 — Token surface & call-site inventory

Read-only inventory of everything the POS palette swap touches. Counts are occurrences (not files)
across `src/**/*.{ts,tsx,css}`, excluding `src/app/global.css` itself, taken 2026-07-24 on `main`.

---

## 1. Every token declared

All tokens live in one file: **`src/app/global.css`** (147 lines). No other CSS file exists in `src/`.

### `:root` / `.dark` — the 21 semantic tokens

Both blocks declare the *same* 21 names; every value is `oklch(...)`.

| Token | Light (`:root`) | Dark (`.dark`) |
|---|---|---|
| `--background` | `oklch(0.991 0.003 92)` | `oklch(0.224 0.004 84)` |
| `--foreground` | `oklch(0.229 0.006 84)` | `oklch(0.953 0.004 92)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.265 0.004 84)` |
| `--card-foreground` | `oklch(0.229 0.006 84)` | `oklch(0.953 0.004 92)` |
| `--primary` | `oklch(0.229 0.006 84)` | `oklch(0.953 0.004 92)` |
| `--primary-foreground` | `oklch(0.985 0.002 92)` | `oklch(0.224 0.004 84)` |
| `--secondary` | `oklch(0.962 0.005 92)` | `oklch(0.307 0.004 84)` |
| `--secondary-foreground` | `oklch(0.229 0.006 84)` | `oklch(0.953 0.004 92)` |
| `--muted` | `oklch(0.962 0.005 92)` | `oklch(0.307 0.004 84)` |
| `--muted-foreground` | `oklch(0.538 0.009 84)` | `oklch(0.718 0.005 84)` |
| `--accent` | `oklch(0.941 0.006 92)` | `oklch(0.307 0.004 84)` |
| `--accent-foreground` | `oklch(0.229 0.006 84)` | `oklch(0.953 0.004 92)` |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` |
| `--destructive-foreground` | `oklch(0.985 0.002 92)` | `oklch(0.953 0.004 92)` |
| `--border` | `oklch(0.915 0.006 92)` | `oklch(1 0 0 / 10%)` |
| `--input` | `oklch(0.898 0.006 92)` | `oklch(1 0 0 / 16%)` |
| `--ring` | `oklch(0.663 0.129 44)` (terracotta) | `oklch(0.714 0.113 44)` |
| `--sidebar` | `oklch(0.97 0.005 92)` | `oklch(0.191 0.004 84)` |
| `--sidebar-foreground` | `oklch(0.229 0.006 84)` | `oklch(0.953 0.004 92)` |
| `--sidebar-accent` | `oklch(0.927 0.006 92)` | `oklch(0.284 0.004 84)` |
| `--sidebar-active` | `oklch(0.663 0.129 44)` | `oklch(0.714 0.113 44)` |
| `--radius` | `0.625rem` (`:root` only — not themed) | — |

### `@theme inline` — the Tailwind bridge

21 `--color-<name>: var(--<name>)` lines, one per semantic token above, plus three radii:
`--radius-lg: var(--radius)`, `--radius-md: calc(var(--radius) - 2px)`,
`--radius-sm: calc(var(--radius) - 4px)`. This bridge is what makes `bg-card`, `text-muted-foreground`,
`border-border`, `rounded-lg` resolve. **Nothing else in `src/` declares a custom property.**

### `@theme` — the font

`--font-sans: 'Inter', 'Readex Pro', system-ui, sans-serif` (global.css:34), fed by two self-hosted
`@font-face` blocks with unicode-range gating (Latin + Arabic). Untouched by a palette swap.

### Other rules in global.css

- `body { @apply bg-background text-foreground antialiased }` (:120)
- `@layer base { :focus-visible { outline: 2px solid var(--ring) } }` (:126) — **the only
  `var(--…)` read outside the bridge in the whole repo.**
- `.ag-cell, .ag-header-cell, [data-numeric] { font-variant-numeric: tabular-nums }` (:136) — the
  only AG Grid CSS in the app; colour-free.
- `body.blocked-scroll { overflow: hidden }` (:143).

**Consumption mode:** every token is consumed as a **Tailwind utility**. Direct `var(--token)` reads:
exactly **one** (`:focus-visible` above). There is no `style={{ color: 'var(--…)' }}` anywhere.
That is the strongest evidence for "zero call-site churn": remapping values in the two blocks
repaints the app without touching a single `.tsx`.

---

## 2. Frequency of use per token

Utility occurrences across `src/` (e.g. `bg-card`, `border-border/60`, `hover:bg-accent`, `dark:text-muted-foreground`):

| Token | Uses | Read |
|---|---:|---|
| `--muted-foreground` | **358** | The workhorse. Every label, caption, secondary line. Highest-risk single value. |
| `--border` | **218** | Hairlines everywhere; the layout's structure is drawn with it. |
| `--primary` | **126** | Buttons, active nav, emphasis. |
| `--muted` | 75 | Chip/row/empty-state grounds. |
| `--card` | 59 | Panels. |
| `--background` | 46 | Page ground + overlays. |
| `--input` | 45 | Form fields. |
| `--accent` | 34 | Hover grounds. |
| `--foreground` | 26 | Explicit body ink (mostly implicit via `body`). |
| `--primary-foreground` | 15 | Text on primary. |
| `--ring` | 15 | + the one `var()` in `:focus-visible`. |
| `--destructive` | 14 | See §3 — under-used; danger is mostly raw `red-*`. |
| `--sidebar-accent` | 3 | |
| `--sidebar-active` | 3 | |
| `--sidebar-foreground` | 1 | |
| `--sidebar` | 1 | |
| `--card-foreground` | **0** | Dead. |
| `--secondary` | **0** | Dead. |
| `--secondary-foreground` | **0** | Dead. |
| `--accent-foreground` | **0** | Dead. |
| `--destructive-foreground` | **0** | Dead. |
| `--radius` (via `rounded-*`) | `rounded-lg` 112 · `rounded-md` 73 · `rounded-full` 82 · `rounded-xl/2xl` 3 · `rounded-sm` 0 | |

**Findings for 070:**

- Five tokens are **dead** (`--card-foreground`, `--secondary`, `--secondary-foreground`,
  `--accent-foreground`, `--destructive-foreground`) and four more are near-dead (the `--sidebar*`
  set, 8 uses total, all in `AppShell`). These are free to repurpose or retire.
- Three tokens carry the app: `--muted-foreground` (358), `--border` (218), `--primary` (126).
  POS equivalents must be chosen for *these* first; everything else follows.
- `rounded-full` (82) is independent of `--radius`; `rounded-lg`/`md` (185) track it.

---

## 3. Hardcoded colours that bypass the tokens — the real cost

### 3a. Tailwind palette classes in feature code

**249 occurrences across 41 files.** Full hit list at the end of this section. Grouped by intent:

| Family | Occurrences | Classes |
|---|---:|---|
| danger | 87 | `red-*`, `rose-*` |
| warning | 75 | `amber-*`, `orange-*` |
| success | 55 | `emerald-*` |
| info | 15 | `blue-*`, `sky-*` |
| other | 4 | `violet-*` (session kind), `slate-700` (ConditionCard) |
| plain b/w | 13 | `text-white` (7), `bg-black/50` (3, modal scrims), `bg-white` (1, QR ground), `text-white/70` (2) |

**The headline finding:** the app has a *fourth* semantic layer — success / warning / danger / info —
that exists nowhere in `global.css`. It is spelled out in raw palette classes at ~230 sites, and it
will **not** re-tint with the swap. `--destructive` (14 uses) is the only tokenised member and is
out-voted 6:1 by raw `red-*`.

**The dominant idiom** (38 sites) is a tint badge:
`bg-<fam>-500/15 text-<fam>-700 dark:text-<fam>-300`. A second variant used by coupons/import is
`bg-<fam>-100 text-<fam>-800 dark:bg-<fam>-500/15 dark:text-<fam>-300`. 82 of the 249 hits are
`dark:` twins, so the ~249 collapse to roughly **165 distinct semantic decisions**. POS names all four
families (`--success`/`--success-050`, `--danger`/`--danger-050`/`--danger-border`,
`--attention`/`--attention-050`) — mapping the idiom onto tokens once would let 070 fix all of them
with a handful of names, but the sweep itself is real edit work and should be its own ticket.

**Concentration:** the top 10 files hold 147 of 249 hits:

| File | Hits |
|---|---:|
| `src/features/admin/active-sessions/ActiveSessionsPage.tsx` | 21 |
| `src/features/pricing/bonus-buy-inquiry/DetailModal.tsx` | 18 |
| `src/features/pricing/coupons/ImportWorkspace.tsx` | 18 |
| `src/features/admin/authz-admin/RoleDetailPane.tsx` | 17 |
| `src/features/pricing/bonus-buy-download/BonusBuyDownloadPage.tsx` | 14 |
| `src/features/pricing/coupons/CouponDetailPane.tsx` | 13 |
| `src/features/pricing/bonus-buy-inquiry/columns.tsx` | 10 |
| `src/features/pricing/simulation/SimPromoBlocks.tsx` | 10 |
| `src/features/pricing/simulation/promo-kind.ts` | 9 |
| `src/features/admin/authz-admin/BindGrantModal.tsx` | 9 |

Four of these are **status-lookup maps** (`promo-kind.ts`, `ua-admin/helpers.ts`,
`bonus-buy-inquiry/columns.tsx:77-80`, `ActiveSessionsPage.tsx:18-21`) — single small objects mapping
a coded value to a class string. Fixing those four files retires ~49 hits.

### 3b. Literal hex / rgb in TS

| Site | Value | Note |
|---|---|---|
| `src/core/theme/ag-grid-theme.ts:30-38,46-54` | 18 hex | The whole grid theme — see §4. |
| `src/features/oms/deliveries/columns.ts:46` | `#c62828` bg / `#ffffff` fg | Failed-jobs triage cellStyle. |
| `src/features/oms/document/columns.ts:190` | `#c62828` / `#ffffff` | Same treatment, document grid. |
| `src/features/auth/LoginPage.tsx:16` | `#002554` | `BRAND_NAVY` const — see §5. |
| `src/features/auth/LoginPage.tsx:453` | `text-[#FDC801]` | Arbitrary-value class, brand gold. |
| `src/app/HomePage.tsx:14` | `#002554` | `BRAND_NAVY` const. |
| `src/app/HomePage.tsx:35` | `text-[#FDC801]` | Arbitrary-value class, brand gold. |
| `src/assets/Al-Dawaa-Pharmacies-01.svg` | ~40 stops | Logo artwork, `#002554` + gold gradient. |

Only **2** arbitrary-value colour classes (`-[#…]`) exist in the whole app, both brand gold.

### 3c. Full hit list (file:line — classes)

```
src/app/HomePage.tsx:25  text-white
src/app/HomePage.tsx:44  text-white/70
src/core/services/confirm.tsx:73  text-amber-500
src/core/ui/Button.tsx:18  bg-red-700 text-white bg-red-800 bg-red-700
src/core/ui/ErrorBanner.tsx:29  border-red-800/25 bg-red-700/5 text-red-900
src/core/ui/ErrorBanner.tsx:30  dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200
src/core/ui/Modal.tsx:75  bg-black/50
src/features/admin/active-sessions/ActiveSessionsPage.tsx:18  bg-sky-500/15 text-sky-700 dark:text-sky-300
src/features/admin/active-sessions/ActiveSessionsPage.tsx:19  bg-violet-500/15 text-violet-700 dark:text-violet-300
src/features/admin/active-sessions/ActiveSessionsPage.tsx:20  bg-amber-500/15 text-amber-700 dark:text-amber-300
src/features/admin/active-sessions/ActiveSessionsPage.tsx:21  bg-emerald-500/15 text-emerald-700 dark:text-emerald-300
src/features/admin/active-sessions/ActiveSessionsPage.tsx:298  border-red-600/40 text-red-700 bg-red-600/10 dark:text-red-400
src/features/admin/active-sessions/ActiveSessionsPage.tsx:423  text-amber-700 dark:text-amber-300
src/features/admin/active-sessions/ActiveSessionsPage.tsx:427  bg-amber-500
src/features/admin/active-sessions/ActiveSessionsPage.tsx:441  text-red-700 dark:text-red-400
src/features/admin/authz-admin/AssignRoleModal.tsx:115  bg-amber-500/15 text-amber-700 dark:text-amber-300
src/features/admin/authz-admin/BindGrantModal.tsx:94  border-red-800/25 bg-red-700/5 text-red-900 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200
src/features/admin/authz-admin/BindGrantModal.tsx:144  bg-red-500/15 text-red-700 dark:text-red-300
src/features/admin/authz-admin/DeleteBlockedModal.tsx:62  text-red-600
src/features/admin/authz-admin/EditRoleModal.tsx:92  border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200
src/features/admin/authz-admin/NewRoleModal.tsx:96  text-red-600
src/features/admin/authz-admin/NewRoleModal.tsx:110  text-red-600
src/features/admin/authz-admin/NewRoleModal.tsx:111  text-red-600
src/features/admin/authz-admin/RoleDetailPane.tsx:217  bg-amber-500/15 text-amber-700 dark:text-amber-300
src/features/admin/authz-admin/RoleDetailPane.tsx:243  border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200
src/features/admin/authz-admin/RoleDetailPane.tsx:298  bg-red-500/15 text-red-600
src/features/admin/authz-admin/RoleDetailPane.tsx:331  bg-red-500/15 text-red-700 dark:text-red-300
src/features/admin/authz-admin/RoleDetailPane.tsx:346  text-red-700 bg-red-500/15 dark:text-red-300
src/features/admin/authz-admin/RoleDetailPane.tsx:411  bg-red-500/15 text-red-600
src/features/admin/authz-admin/RolesWorkspace.tsx:100  text-amber-600 dark:text-amber-400
src/features/admin/authz-admin/RolesWorkspace.tsx:149  bg-amber-500/15 text-amber-700 dark:text-amber-300
src/features/admin/authz-admin/UserDetailPane.tsx:139  bg-amber-500/15 text-amber-700 dark:text-amber-300
src/features/admin/authz-admin/UserDetailPane.tsx:148  bg-red-500/15 text-red-600
src/features/admin/authz-admin/UserDetailPane.tsx:210  bg-red-500/15 text-red-700 dark:text-red-300
src/features/admin/authz-admin/UsersWorkspace.tsx:150  text-amber-600 dark:text-amber-400
src/features/admin/broadcast/BroadcastComposePage.tsx:207  border-amber-500/40 bg-amber-500/10
src/features/admin/broadcast/BroadcastComposePage.tsx:208  text-amber-500
src/features/admin/ua-admin/helpers.ts:47  bg-emerald-500/15 text-emerald-700 dark:text-emerald-300
src/features/admin/ua-admin/helpers.ts:48  bg-amber-500/15 text-amber-700 dark:text-amber-300
src/features/admin/ua-admin/helpers.ts:49  bg-red-500/15 text-red-700 dark:text-red-300
src/features/admin/ua-admin/UaAdminUsersPage.tsx:19  text-red-600 dark:text-red-400
src/features/admin/ua-admin/UaAdminUsersPage.tsx:20  text-amber-600 dark:text-amber-400
src/features/admin/ua-admin/UserDetailPane.tsx:229  text-red-700 dark:text-red-400
src/features/auth/LoginPage.tsx:442  text-white
src/features/auth/LoginPage.tsx:461  text-white/70
src/features/auth/LoginPage.tsx:680  bg-white
src/features/oms/deliveries/ViewManager.tsx:108  bg-black/50
src/features/oms/document/ChangeStoreDialog.tsx:190  text-red-900 dark:text-red-300
src/features/oms/document/DocumentDetailsPage.tsx:293  bg-amber-500/15 text-amber-700 dark:text-amber-400
src/features/pricing/bonus-buy-download/BonusBuyDownloadPage.tsx:235  text-amber-700 dark:text-amber-300
src/features/pricing/bonus-buy-download/BonusBuyDownloadPage.tsx:370  text-emerald-700 dark:text-emerald-400
src/features/pricing/bonus-buy-download/BonusBuyDownloadPage.tsx:372  text-red-700 dark:text-red-400
src/features/pricing/bonus-buy-download/BonusBuyDownloadPage.tsx:377  text-emerald-700 dark:text-emerald-400
src/features/pricing/bonus-buy-download/BonusBuyDownloadPage.tsx:379  text-red-700 dark:text-red-400
src/features/pricing/bonus-buy-download/BonusBuyDownloadPage.tsx:413  text-emerald-700 dark:text-emerald-400
src/features/pricing/bonus-buy-download/BonusBuyDownloadPage.tsx:415  text-red-700 dark:text-red-400
src/features/pricing/bonus-buy-inquiry/BonusBuyInquiryPage.tsx:176  border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200
src/features/pricing/bonus-buy-inquiry/columns.tsx:77  bg-emerald-500/15 text-emerald-700 dark:text-emerald-300
src/features/pricing/bonus-buy-inquiry/columns.tsx:79  bg-amber-500/15 text-amber-700 dark:text-amber-300
src/features/pricing/bonus-buy-inquiry/columns.tsx:80  bg-rose-500/15 text-rose-700 dark:text-rose-300
src/features/pricing/bonus-buy-inquiry/columns.tsx:111  bg-emerald-500
src/features/pricing/bonus-buy-inquiry/DetailModal.tsx:43  bg-emerald-500/15 text-emerald-700 dark:text-emerald-300
src/features/pricing/bonus-buy-inquiry/DetailModal.tsx:45  bg-amber-500/15 text-amber-700 dark:text-amber-300
src/features/pricing/bonus-buy-inquiry/DetailModal.tsx:46  bg-rose-500/15 text-rose-700 dark:text-rose-300
src/features/pricing/bonus-buy-inquiry/DetailModal.tsx:50  bg-emerald-500/15 text-emerald-700 dark:text-emerald-300
src/features/pricing/bonus-buy-inquiry/DetailModal.tsx:561  bg-sky-500/15 text-sky-700 dark:text-sky-300
src/features/pricing/bonus-buy-inquiry/DetailModal.tsx:689  bg-rose-500/15 text-rose-600 dark:text-rose-300
src/features/pricing/bonus-buy-inquiry/GroupingMembersModal.tsx:225  bg-rose-500/15 text-rose-600 dark:text-rose-300
src/features/pricing/coupons/CouponDetailPane.tsx:109  bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300
src/features/pricing/coupons/CouponDetailPane.tsx:110  bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300
src/features/pricing/coupons/CouponDetailPane.tsx:214  text-emerald-600 dark:text-emerald-400
src/features/pricing/coupons/CouponDetailPane.tsx:216  text-red-600 dark:text-red-400
src/features/pricing/coupons/CouponDetailPane.tsx:305  text-red-600
src/features/pricing/coupons/ImportWorkspace.tsx:200  text-red-700 dark:text-red-400
src/features/pricing/coupons/ImportWorkspace.tsx:286  bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300
src/features/pricing/coupons/ImportWorkspace.tsx:287  bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300
src/features/pricing/coupons/ImportWorkspace.tsx:288  bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300
src/features/pricing/coupons/ImportWorkspace.tsx:289  bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300
src/features/pricing/simulation/BoolCell.tsx:23  text-emerald-600 dark:text-emerald-400
src/features/pricing/simulation/BoolCell.tsx:25  text-red-500
src/features/pricing/simulation/ConditionCard.tsx:20  bg-emerald-600 text-white
src/features/pricing/simulation/ConditionCard.tsx:21  bg-slate-700 text-white
src/features/pricing/simulation/ConditionCard.tsx:22  bg-orange-600 text-white
src/features/pricing/simulation/promo-kind.ts:10  bg-emerald-500/15 text-emerald-700 dark:text-emerald-400
src/features/pricing/simulation/promo-kind.ts:12  bg-amber-500/15 text-amber-700 dark:text-amber-400
src/features/pricing/simulation/promo-kind.ts:13  bg-blue-500/15 text-blue-700 dark:text-blue-400
src/features/pricing/simulation/SimItemDetail.tsx:33  text-emerald-600 dark:text-emerald-400
src/features/pricing/simulation/SimItemDetail.tsx:86  border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200
src/features/pricing/simulation/SimMissedPromotions.tsx:175  bg-amber-500/70
src/features/pricing/simulation/SimPromoBlocks.tsx:121  text-emerald-600 dark:text-emerald-400
src/features/pricing/simulation/SimPromoBlocks.tsx:179  border-emerald-600/40 bg-emerald-500/10
src/features/pricing/simulation/SimPromoBlocks.tsx:190  text-emerald-700 dark:text-emerald-400
src/features/pricing/simulation/SimPromoBlocks.tsx:225  text-emerald-700 dark:text-emerald-400
src/features/pricing/simulation/SimPromoBlocks.tsx:231  text-emerald-700 dark:text-emerald-400
src/features/pricing/simulation/SimResultsGrid.tsx:130  text-emerald-600 dark:text-emerald-400
src/features/pricing/simulation/SimResultsGrid.tsx:196  text-emerald-600 dark:text-emerald-400
src/features/pricing/simulation/SimResultsGrid.tsx:244  bg-red-500 bg-amber-500 bg-emerald-500
src/features/pricing/simulation/SimulationPage.tsx:214  text-red-600 dark:text-red-400
src/features/pricing/simulation/SimulationPage.tsx:220  text-blue-600 dark:text-blue-400
src/features/pricing/simulation/SimulationPage.tsx:311  border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200
src/layout/notifications/NotificationBell.tsx:91  text-white
src/layout/notifications/NotificationPanel.tsx:42  bg-amber-500/20 text-amber-700 dark:text-amber-300
src/layout/AppShell.tsx:232  bg-black/50
```

---

## 4. The AG Grid theme surface

One file: **`src/core/theme/ag-grid-theme.ts`** (65 lines). No `.ag-theme-*` class, no legacy CSS
import, no per-grid `withParams` override anywhere else.

- Built from `themeQuartz.withParams(light, 'light').withParams(dark, 'dark')` — the v33+ Theming API.
- **Shared params** (`denseSharedParams`): `spacing: 4`, `fontSize: 12`, `headerFontSize: 12`,
  `headerFontWeight: 600`, `wrapperBorderRadius: 10`, `fontFamily: "'Inter','Readex Pro',system-ui,sans-serif"`.
- **9 colour params per mode** — the entire surface 074 remaps:

| Param | light | dark |
|---|---|---|
| `backgroundColor` | `#ffffff` | `#262521` |
| `foregroundColor` | `#26241f` | `#eeede7` |
| `headerBackgroundColor` | `#f5f4ef` | `#21201c` |
| `headerTextColor` | `#57544c` | `#a8a598` |
| `oddRowBackgroundColor` | `#ffffff` (= zebra off) | `#262521` (= zebra off) |
| `rowHoverColor` | `#f3f2ec` | `#2c2b26` |
| `selectedRowBackgroundColor` | `#d9775726` | `#d977572e` |
| `accentColor` | `#c96442` (terracotta) | `#e08d70` |
| `borderColor` | `#e8e6df` | `#393731` |
| `browserColorScheme` | `'light'` | `'dark'` |

- **Values are hex on purpose** — the file's own comment: "AG params don't resolve CSS vars in all
  paths; keep them in sync with global.css". So the grid is a **hand-mirrored copy** of the token
  values, not a consumer of them. 074 must remap it explicitly; it gets nothing for free.
- **Mode switching:** `document.documentElement.dataset.agThemeMode` is set pre-paint in
  `index.html:18` and flipped in the same paint as the `.dark` class by `src/layout/theme.ts:20-22`.
  Unaffected by a value swap.
- **Other grid CSS:** only `global.css:136` (`tabular-nums`). Colour-free.
- **Consumers:** 6 grids import `omsGridTheme` — `deliveries/DeliveriesPage`,
  `document/ChangeStoreDialog` (×2), `document/DetailGrid`, `bonus-buy-inquiry/BonusBuyInquiryPage`,
  `simulation/SimBonusBuyPanel`. Plus `OMS_GRID_ROW_HEIGHT` (28) / `OMS_GRID_HEADER_HEIGHT` (30).
- **Two cellStyle overrides bypass the theme entirely:** `deliveries/columns.ts:46` and
  `document/columns.ts:190`, both `{ backgroundColor: '#c62828', color: '#ffffff', fontWeight: '700' }`
  for the failed-jobs triage cell. These are §3b hex, inside the grid.

---

## 5. The al-dawaa brand surfaces

| Surface | File:line | Colour | Structural or decorative |
|---|---|---|---|
| Logo artwork | `src/assets/Al-Dawaa-Pharmacies-01.svg` | navy `#002554` (`.st0`), gold gradient `#DCB207→#FDC801→#B28F0E` | **Structural** — it's the mark. Untouchable. |
| `BrandMark` | `src/core/ui/BrandMark.tsx` | none of its own | **Structural, colour-free.** It crops the gold glyph out of the SVG via `background-size: 217% 217%` / `background-position: 46.4% 24.1%` on a transparent ground, expressly so it sits on any surface. Survives any palette. 4 call sites: `AppShell.tsx:210` (sidebar, size default), `HomePage.tsx:28,33` (watermark 360 + header 44), `LoginPage.tsx:446,451,470`. |
| Login brand panel | `LoginPage.tsx:16,442-443` | `BRAND_NAVY = '#002554'` as inline `backgroundColor` on the Editorial-Split panel | **Decorative** — a full-bleed navy ground. This is the single largest non-token colour area in the app. |
| Login kicker | `LoginPage.tsx:453` | `text-[#FDC801]` on "al-dawaa" | Decorative. |
| Login `text-white` / `text-white/70` | `LoginPage.tsx:442,461` | white | Structural *given* the navy ground — they pair. If the navy goes, these must go with it. |
| Login QR ground | `LoginPage.tsx:680` | `bg-white` | **Structural** — QR codes need a white quiet zone regardless of theme. Not brand. |
| Home hero | `HomePage.tsx:14,26` | `BRAND_NAVY` inline `backgroundColor` on a `rounded-2xl` banner | Decorative. Second-largest navy area. |
| Home kicker | `HomePage.tsx:35` | `text-[#FDC801]` | Decorative. |
| Home hero text | `HomePage.tsx:25,44` | `text-white`, `text-white/70` | Structural given the navy ground. |
| Brand copy | `src/locales/en/common.json:2-4` | `brand: "al-dawaa BackOffice"`, `brandKicker: "al-dawaa"`, `brandName: "BackOffice"` | Text only, no colour. Unaffected. |

**Reading for 075:** the brand colour has exactly **two** UI footprints — the login panel and the home
hero — plus the logo file itself. `BrandMark` is already colour-agnostic by construction, so the map's
ruling ("gold/navy survives at most as logo/brand mark") costs two edits (`LoginPage`, `HomePage`) and
their four paired `text-white*` classes. Nothing else in the app is navy or gold.

---

## 6. The gap list

### POS tokens with no home in our vocabulary

Taken from `.issues/assets/068-pos-detail-reference.html` `:root` (36 declared names). Our column is
the closest existing semantic name, or "—" if genuinely new.

| POS token | Value | Nearest ours | Note |
|---|---|---|---|
| `--accent` | `#2F63A6` | `--primary` | **Name collision.** POS `--accent` is the steel-blue *primary action*; ours is a hover ground. 070 must not carry the name across literally. |
| `--accent-700` | `#27538C` | — | Pressed/hover state of primary. New. |
| `--accent-050` | `#E9EFF7` | `--accent` (ours) | Tint ground — maps onto our hover `--accent`. |
| `--key` | `#586674` | — | Keyboard/secondary button face. New. |
| `--key-press` | `#495562` | — | New. |
| `--disabled` | `#E8EDF2` | — | New (we express disabled with opacity today). |
| `--disabled-ink` | `#A6B0BA` | — | New. |
| `--disabled-border` | `#D7DEE6` | — | New. |
| `--surface` | `#F4F7FA` | `--background` | Direct. |
| `--panel` | `#FFFFFF` | `--card` | Direct. |
| `--panel-2` | `#FAFBFC` | — | **New — a second panel tier.** We have one card level; POS has two. |
| `--border` | `#E3E9F0` | `--border` | Direct. |
| `--border-strong` | `#CBD6E2` | — | New. |
| `--divider` | `#EDF1F5` | — | New (lighter than border). |
| `--ink` | `#19232E` | `--foreground` | Direct. |
| `--ink-2` | `#586674` | `--muted-foreground` | Direct — and this is the 358-use token. |
| `--ink-3` | `#8593A1` | — | **New — a third ink tier.** Our biggest vocabulary gap; today anything dimmer than `muted-foreground` is done with `/60` opacity. |
| `--on` | `#FFFFFF` | `--primary-foreground` | Direct. |
| `--on-sub` | `rgba(255,255,255,.8)` | — | New (today: `text-white/70`, 2 sites). |
| `--success` / `--success-050` | `#1E874B` / `#E7F3EC` | — | **New — no success token exists.** 55 raw `emerald-*` sites. |
| `--danger` / `--danger-050` / `--danger-border` | `#C23B41` / `#FBECEC` / `#E7BFC1` | `--destructive` (base only) | 87 raw `red/rose-*` sites; tint + border tiers are new. |
| `--attention` / `--attention-050` | `#B4791F` / `#F8F0DE` | — | **New — no warning token exists.** 75 raw `amber-*` sites. |
| `--fam-sales` | `#2F63A6` | — | New — command-family colour (ticket 072). |
| `--fam-insurance` | `#0B7C8C` | — | New. |
| `--fam-loyalty` | `#B4791F` | — | New (= `--attention`). |
| `--fam-fulfil` | `#2E7D5B` | — | New. |
| `--fam-admin` | `#5D5A93` | — | New. |
| `--page`, `--page-ink`, `--page-ink-2`, `--page-card`, `--page-border` | `#eef1f5` … | — | **Artifact chrome only** — the documentation page wrapping the device mock, not the device. Excluded per the map's fidelity ruling. |

Also absent from POS entirely: **no info/blue-neutral severity** (our 15 `blue/sky-*` sites have no POS
home — `--fam-sales` is the same hue and would confuse), and **no dark values at all** (POS is
light-only; the dark twin is 071's whole job).

### Our tokens with no POS counterpart

| Ours | Uses | Disposition |
|---|---:|---|
| `--sidebar` | 1 | POS is a device shell, no nav rail. Keep — our own chrome; derive from `--panel`/`--surface`. |
| `--sidebar-foreground` | 1 | Keep, derive from `--ink`. |
| `--sidebar-accent` | 3 | Keep, derive from `--accent-050`. |
| `--sidebar-active` | 3 | Keep — currently terracotta; becomes `--accent` (steel blue). |
| `--input` | 45 | No POS field token (`--border-strong` is the nearest read). 070 must pick. |
| `--ring` | 15 + the `:focus-visible` rule | No POS focus token. Terracotta must become something in the steel-blue family. Highest-visibility single decision after the three workhorses. |
| `--secondary` / `--secondary-foreground` | 0 / 0 | Dead — could take `--key` / `--on`, or be retired. |
| `--card-foreground`, `--accent-foreground`, `--destructive-foreground` | 0 each | Dead. Retire or leave inert. |
| `--radius` (0.625rem) | 185 via `rounded-lg/md` | POS declares no radius token; the reference uses fixed px (`wrapperBorderRadius: 10` in our grid is the nearest peer). Keep ours. |
| `--font-sans` | global | Unaffected — POS is a WPF prototype, no web font contract. |

---

## Summary for 070

1. **"Zero call-site churn" holds for the 21 semantic tokens.** They are consumed purely as Tailwind
   utilities; exactly one `var()` read exists (`:focus-visible`). Swapping the two value blocks
   repaints the app with no `.tsx` edits.
2. **It does not hold for severity colour.** ~230 raw palette occurrences across 41 files express a
   success/warning/danger/info layer that has no tokens. This is the real cost of the swap and needs
   its own remediation ticket, sequenced after 070/071 name the tokens.
3. **Three tokens carry the app** — `--muted-foreground` (358), `--border` (218), `--primary` (126).
4. **Nine tokens are dead or near-dead** — free to repurpose for POS names that need a home
   (`--secondary` → `--key`, etc.).
5. **AG Grid is a hand-mirrored hex copy**, 9 colour params × 2 modes, plus two `#c62828` cellStyle
   overrides. Nothing re-tints for free.
6. **Brand is two surfaces** (login panel, home hero) plus a colour-agnostic `BrandMark`.
7. **The vocabulary gaps that matter**: a third ink tier (`--ink-3`), a second panel tier
   (`--panel-2`), `--border-strong`/`--divider`, the three severity families with their `-050` tints,
   the five `--fam-*`, and the disabled trio.
