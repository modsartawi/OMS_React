---
status: open
spec: 082
blocked-by: 084, 086
---

# 088 — noScreenSpellsARawPaletteClass

## What to build

One mechanical pass across the whole app that replaces every raw Tailwind palette class with a token,
so the status layer stops being a fourth semantic layer nobody declared.

**One pass, not per-area** — spec 082 D-13, reaffirmed by the owner while slicing. Per-area
follow-ups were rejected because the app would carry steel-blue neutrals against warm badges until
the last area landed, and the substitution table would be re-read four times. Most of the diff is
**deletion**, which is what makes a single pass reviewable.

**Measured against the current tree, not the spec's estimate:** 236 palette occurrences across 35
files, and **82 `dark:` twins — every one of which is deleted rather than translated.**

### The substitution table

| Shape | Today | Becomes |
|---|---|---|
| Tint badge | `bg-<f>-500/15 text-<f>-700 dark:text-<f>-300` · `bg-<f>-100 text-<f>-800 dark:…` | `<StatusBadge sev>` (ticket 086) or `bg-<f>-050 text-<f>-800` |
| Bare ink | `text-<f>-600 dark:text-<f>-400` | `text-<f>-800` |
| Callout / banner | `border-<f>-500/30 bg-<f>-500/5 text-<f>-800 dark:…` | `border-<f>-border bg-<f>-050 text-<f>-800` |
| Filled chip / button | `bg-<f>-700 text-white` | `bg-<f> text-primary-foreground` |
| Bare fill — dot, bar, meter | `bg-<f>-500` | `bg-<f>` |

Every one is a **single string valid in both themes** — that follows from 084's R4 (`-050` and `-800`
are roles that swap lightness), which is why no `dark:` variant survives. Contrast is already
verified: bare ink worst case 5.96:1, bare fill as non-text graphic worst case 3.43:1, tint badge
5.91–8.50.

Families are four: `success` · `attention` · `danger` · and **`primary` serving as the informational
fourth**. There is no `--info` token — POS declares no info hue and `--primary` is now steel blue, so
an info token would be a second blue three shades from the first. The 15 raw `blue`/`sky` sites sweep
into `--primary`'s four tiers.

### Hue is reserved for severity — eleven sites go neutral

Eleven sites spend hue as an **identity distinguisher** with no severity meaning. A POS session is
not "success"; a fixed-amount promo does not "need a human". All eleven become
`bg-muted text-muted-foreground`.

Safe at every one: all three maps already render a text label beside the chip, so colour was never
the only channel.

**Consequence the build must not miss: because every key resolves to the same string, all three maps
become dead code and are deleted**, their call sites taking a constant.

| Map | Call sites |
|---|---|
| `admin/active-sessions/ActiveSessionsPage.tsx:17` `CHANNEL_TONE` | `:410` |
| `pricing/simulation/promo-kind.ts:9` `KIND_CLASS` | `SimMissedPromotions:54` · `SimPromoBlocks:83` · `SimResultsGrid:267` |
| `pricing/simulation/ConditionCard.tsx:19` `BADGE_TONE` | `:60` |

Deleting `KIND_CLASS` also removes its half-tokenised outlier (`percent: 'bg-primary/15 text-primary'`)
with no separate decision.

### The filled-chromatic trap — the grep that matters is `text-white`

Any *filled* chromatic with white ink breaks on 084's dark values, where white measures 2.2:1. The
inventory's two badge idioms are both **tint** idioms and are structurally safe; the danger hides in
**already-tokenised** code:

- `core/ui/Button.tsx:18` — the `danger` variant is `bg-red-700 text-white hover:bg-red-800`, which
  never adopted `--destructive` despite sitting in `core/ui`. Becomes
  `bg-danger text-primary-foreground hover:bg-danger-800` — the hover **darkens** rather than
  lightening, matching D-2's note that `hover:bg-primary/85` was the wrong direction on blue.
- `layout/notifications/NotificationBell.tsx:91` — `bg-ring text-white`. It never spelled a palette
  class, so it is **invisible to a `bg-red-` grep**, yet it inherits the exact failure the moment
  `--ring` becomes `--primary`. Becomes `text-primary-foreground`.
- `pricing/simulation/ConditionCard.tsx:20-22` — three filled white-ink sites that **evaporate**:
  they are categorical and go neutral above.

### Explicitly outside the sweep

Palette-adjacent values that are not severity and must not be tokenised:

- **`bg-black/50` ×3** — modal scrims (`core/ui/Modal.tsx`, `oms/deliveries/ViewManager.tsx`,
  `layout/AppShell.tsx`). A scrim is black in both themes by intent.
- **`bg-white` ×1** — `auth/LoginPage.tsx`, the QR code's quiet zone. It must stay white to scan.
- **The four brand-panel `text-white` sites** — ticket 087 owns those.

## Spine reach

~35 files across `core/ui`, `layout/`, and the `oms` / `admin` / `pricing` areas · three lookup
modules deleted · drive. No API, no new i18n key.

## Proof (→ `tdd` red-green cycles)

- [ ] `npm run lint` and `npm run build` stay green through the pass · compiler
- [ ] Drive at least one screen per area in **both themes** — Deliveries, a Document, Sim results,
      BBY Inquiry, ua-admin, Active Sessions, Coupons/Import — and confirm every badge, callout, dot
      and filled chip reads correctly with no theme-specific string · flow (`npm run dev`)
- [ ] `categoricalChipsStillCarryTheirMeaningWithoutHue` — on each of the three neutralised maps'
      screens, confirm the text label beside the chip says what the colour used to · flow
- [ ] `theDangerButtonAndTheUnreadBadgeAreReadableInDark` — the two filled traps carry dark ink on
      their lifted fills · flow

Verify via `typecheck` + drive; this ticket does not bootstrap the vitest runner.

## Boundaries

No API, no nav change, no new i18n key. Three modules are **deleted**, not edited — a reviewer
should expect the diff to be mostly removal. The eleven categorical sites are a **deliberate loss of
information channel**, accepted because every one of them already renders a label.

## Done when

`grep -rE "\b(bg|text|border|from|to|via)-(red|rose|amber|orange|emerald|green|blue|sky|violet|slate)-" src/`
returns **zero hits**, `CHANNEL_TONE` / `KIND_CLASS` / `BADGE_TONE` no longer exist, and every area's
screens read correctly in both themes.

## Blocked by

- [084](084-pos-tokens-both-themes.md) — the family tiers and their `@theme inline` bridge lines must
  exist, or none of the substituted classes compile.
- [086](086-status-badge-takes-a-severity.md) — `StatusBadge` must exist before the ~44 badge sites
  can convert to it rather than to a fourth hand-written string.
