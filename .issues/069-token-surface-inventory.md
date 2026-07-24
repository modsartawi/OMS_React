---
type: wayfinder-ticket
wayfinder: research
map: 068
status: done
blocked-by: —
---

# 069 — Token surface & call-site inventory

## Question

What exactly does swapping the palette touch? Produce the inventory that lets ticket 070 remap
values with confidence that "zero call-site churn" is actually true.

Cover:

1. **Every token declared** in `src/app/global.css` — the `:root` set, the `.dark` set, the
   `@theme inline` bridge (`--color-*`, `--radius-*`), and `@theme`'s `--font-sans`. Note which
   are consumed as Tailwind utilities (`bg-card`, `text-muted-foreground`, `border-border`…)
   versus read directly as `var(--…)`.
2. **Frequency of use per token** across `src/` — which semantic names carry the app, which are
   near-dead. A token used twice can be repurposed; one used 300 times cannot.
3. **Hardcoded colours that bypass the tokens** — literal hex, `oklch(...)`, and Tailwind palette
   classes (`amber-500/15`, `text-amber-700`, `bg-red-50`, …) in feature code. These will NOT
   re-tint for free and are the real cost of the swap. `DocumentDetailsPage.tsx:293` is one known
   instance; find them all.
4. **The AG Grid theme surface** — how the grid is themed today (theme class, CSS custom properties,
   `themeQuartz` params, any overrides), so 074 knows what it is remapping.
5. **The al-dawaa brand surfaces** — the gold/navy usages in `src/core/ui/BrandMark.tsx`,
   `src/features/auth/LoginPage.tsx`, `src/app/HomePage.tsx`, `src/locales/en/common.json` and
   `src/assets/Al-Dawaa-Pharmacies-01.svg`. Where the brand colour is structural vs decorative.
6. **The gap list** — POS tokens with no home in our vocabulary (`--ink-3`, `--border-strong`,
   `--divider`, `--panel-2`, `--key`, `--attention`, `--on-sub`, the five `--fam-*`), and our tokens
   with no POS counterpart (`--sidebar*`, `--input`, `--ring`, `--secondary`).

Output a markdown asset beside this issue (`069-token-surface-inventory.RESEARCH.md`) with the
frequency table, the hardcoded-colour hit list (file:line), and the gap list. Read only — no edits.

## Answer

Full inventory: [assets/069-token-surface-inventory.RESEARCH.md](assets/069-token-surface-inventory.RESEARCH.md).
Taken 2026-07-24 on `main`. Read-only; no source file was touched.

**"Zero call-site churn" is true for the token layer, and false for severity colour.**

1. **Token surface is small and clean.** All 21 semantic tokens + `--radius` + `--font-sans` live in
   one file, `src/app/global.css` (147 lines); there is no other CSS file in `src/`. Every token is
   consumed as a **Tailwind utility** through the `@theme inline` bridge — direct `var(--…)` reads:
   exactly **one**, `:focus-visible { outline: 2px solid var(--ring) }` (global.css:126). No
   `style={{ color: 'var(--…)' }}` anywhere. So 070 can swap both value blocks with **zero `.tsx`
   edits**.
2. **Three tokens carry the app** — `--muted-foreground` **358** uses, `--border` **218**,
   `--primary` **126**. Then `--muted` 75, `--card` 59, `--background` 46, `--input` 45, `--accent` 34,
   `--foreground` 26, `--primary-foreground` 15, `--ring` 15, `--destructive` 14.
3. **Nine tokens are free.** Dead (0 uses): `--card-foreground`, `--secondary`,
   `--secondary-foreground`, `--accent-foreground`, `--destructive-foreground`. Near-dead: the four
   `--sidebar*` (8 uses total, all `AppShell`). Available to rehome POS names such as `--key`/`--on`.
   `--radius` is consumed only via `rounded-lg` (112) / `rounded-md` (73); `rounded-full` (82) is
   independent of it.
4. **The real cost of the swap is a fourth semantic layer that has no tokens** — success / warning /
   danger / info, written as **249 raw Tailwind palette occurrences across 41 files** (danger 87,
   warning 75, success 55, info 15, misc 4, plain b/w 13). 82 are `dark:` twins, so ≈165 distinct
   decisions. Two badge idioms dominate (`bg-X-500/15 text-X-700 dark:text-X-300`, 38 sites; and a
   `bg-X-100 text-X-800 dark:…` variant). Concentration is favourable: four small status-lookup maps
   hold ~49 hits. This became new ticket
   [077 — The severity colour layer and the raw-palette sweep](077-severity-colour-layer.md).
5. **AG Grid gets nothing for free.** `src/core/theme/ag-grid-theme.ts` is a hand-mirrored **hex copy**
   of the token values (the file says so: "AG params don't resolve CSS vars in all paths") — 9 colour
   params × 2 modes on `themeQuartz.withParams(...)`, consumed by 6 grids. Mode switching via
   `data-ag-theme-mode` (index.html:18 pre-paint, `layout/theme.ts:20-22` on toggle) is unaffected by
   a value swap. Only grid CSS in the app is the colour-free `tabular-nums` rule (global.css:136).
   Two `cellStyle` overrides bypass the theme entirely (`#c62828` at `deliveries/columns.ts:46` and
   `document/columns.ts:190`).
6. **Brand is exactly two UI surfaces** — the login Editorial-Split panel (`LoginPage.tsx:16,442-443,453`)
   and the home hero (`HomePage.tsx:14,26,35`), each an inline `#002554` ground + a `text-[#FDC801]`
   kicker + paired `text-white`/`text-white/70`. `BrandMark.tsx` is **colour-agnostic by construction**
   (it crops the gold glyph out of the SVG onto a transparent ground) and survives any palette
   unchanged; `common.json`'s brand copy carries no colour. The only two arbitrary-value colour
   classes (`-[#…]`) in the whole app are the two brand-gold kickers. `bg-white` at `LoginPage.tsx:680`
   is the QR quiet zone — structural, not brand.
7. **Vocabulary gaps.** POS-only with no home: `--ink-3` (a **third** ink tier — today anything dimmer
   than `muted-foreground` is done with `/60` opacity), `--panel-2` (a **second** panel tier),
   `--border-strong`, `--divider`, `--on-sub`, `--key`/`--key-press`, the disabled trio, the three
   severity families with their `-050` tints, the five `--fam-*`. **Name collision to watch:** POS
   `--accent` is the steel-blue *primary action*, ours is a hover ground — 070 must not carry the name
   across literally. Ours with no POS answer: `--ring` (POS has no focus token — the terracotta must
   become something in the steel-blue family), `--input`, the `--sidebar*` set (a till has no nav rail
   — derive, don't copy), `--radius`, and the five dead tokens. POS also declares **no dark values at
   all** (071's whole job) and **no info hue**. The reference's `--page*` tokens are the artifact's
   documentation chrome, not the device — excluded per the map's fidelity ruling.
