---
type: wayfinder-ticket
wayfinder: grilling
map: 068
status: done
blocked-by: 070, 071, 075
---

# 077 — The severity colour layer and the raw-palette sweep

## Question

[069](069-token-surface-inventory.md) found that the app carries a **fourth semantic layer that has
no tokens at all**: success / warning / danger / info, spelled out in ~230 raw Tailwind palette
occurrences across 41 files (`emerald` 55 · `amber`/`orange` 75 · `red`/`rose` 87 · `blue`/`sky` 15).
`--destructive` exists but is out-voted 6:1 by raw `red-*`. None of it re-tints when 070/071 land, so
the swap ships an app whose neutrals are cool steel-blue and whose status badges are still the old
warm palette.

PosTheme names three of the four (`--success`/`--success-050`, `--danger`/`--danger-050`/
`--danger-border`, `--attention`/`--attention-050`) and has **no info colour** — its nearest hue,
`--fam-sales #2F63A6`, is the primary action colour and would collide.

Settle:

- **The family list.** Three (POS's) or four (adding info)? Our 15 `blue`/`sky` sites are
  informational badges (`promo-kind.ts`, `ImportWorkspace`, `SimulationPage`, `DetailModal`). Either
  name a fourth family with a hue that can't be confused with `--accent`, or rule those sites down to
  neutral.
- **The tiers per family.** 069 found two badge idioms in use:
  `bg-<fam>-500/15 text-<fam>-700 dark:text-<fam>-300` (38 sites) and
  `bg-<fam>-100 text-<fam>-800 dark:bg-<fam>-500/15 dark:text-<fam>-300` (coupons/import). POS offers
  base + `-050` tint + (danger only) a border. Decide the tier set — ground, ink, border — so one
  idiom replaces both, and name the Tailwind utilities it produces via `@theme inline`.
- **`--destructive`'s fate.** Keep it as the alias for `--danger`, or retire it in favour of the new
  name? It has 14 live call sites, so retiring it is a rename, not a deletion.
- **`--attention` vs al-dawaa gold.** Already flagged in [075](075-brand-surfaces-reconciliation.md) —
  whichever way that ruling goes, this ticket's warning value must not fight it.
- **The sweep policy.** ~165 distinct decisions behind the 249 occurrences. Concentration helps: four
  small status-lookup maps (`features/pricing/simulation/promo-kind.ts`,
  `features/admin/ua-admin/helpers.ts`, `features/pricing/bonus-buy-inquiry/columns.tsx:77-80`,
  `features/admin/active-sessions/ActiveSessionsPage.tsx:18-21`) hold ~49 of them. Decide whether the
  sweep is one mechanical pass in the design-system spec or a per-area follow-up, and whether a shared
  badge helper in `core/ui` replaces the hand-written class strings.
- **The two grid cellStyle hexes** (`oms/deliveries/columns.ts:46`,
  `oms/document/columns.ts:190`, both `#c62828`) — they belong to danger but live inside AG Grid, so
  coordinate the answer with [074](074-ag-grid-theme-mapping.md).

Full evidence — per-family counts, the two idioms, the concentration table and the complete
`file:line` hit list — is in
[assets/069-token-surface-inventory.RESEARCH.md](assets/069-token-surface-inventory.RESEARCH.md) §3.

Record the token table (family · tier · light value · dark value) and the sweep policy in this
ticket. The values must be derived by 071's stated rule, not chosen freehand.

## Comments

**From [070 — The POS token remap (light)](070-pos-token-remap-light.md) (done):** the token table is
settled, so this ticket inherits names and light values rather than inventing them —
`--success` / `--attention` / `--danger`, each with a `-050` ground, a `-border` and an `-800` ink,
plus `--destructive: var(--danger)` kept as a compatibility alias for its 14 existing call sites.

**Four families, not five: there is no `--info` token.** POS declares no info hue, and `--primary` is
now steel blue `#2F63A6` — an info token would be a second blue three shades from the first. The
**15 raw `blue/sky-*` sites sweep into `--primary` / `--primary-050` / `--primary-border`
`#C6D6EC` / `--primary-800`**, which carries the same four tiers precisely so it can serve as the
fourth family.

Only the **dark** values remain open here, and 071 derives those.

**From [073 — The reworked layout, filled with our real fields](073-detail-layout-with-our-data.md)
(done):** one token family joins the set, and it is **not** a severity.

`--prescription` `#0B7C8C` (POS `--fam-insurance`, the value 070 reserved but deliberately left
unnamed) with `--prescription-050` `#E3F0F2` and `--prescription-800` `#085C68`. Same three-tier shape
as 070's severity families, so 071's dark rule (*`-050`/`-800` are roles, not lightness levels — they
swap sides*) applies to it unchanged.

It marks the e-Rx card accent bar, the "View prescription" link, and the ground of the `Rx` item tag.
**It is a marker, never a control** — no button, no pill, no focus ring is ever this teal, and it must
not be swept into the severity layer as a fifth family. The raw-palette sweep should treat any
teal/cyan hit on prescription-adjacent UI as a candidate for it, and every other teal hit as a mistake.

**From [079 — Status value → severity mapping for the pill rail](079-status-severity-mapping.md)
(done):** the rail is now the severity layer's *smallest* consumer, not its largest — worth knowing
before this ticket sizes the sweep.

On five live documents the pill rail spends exactly **two** of the four severity families: `ok`
(`readyStatus R`, `approvalStatus A`, `deliveryStatus D`) and `warn` (`closeStatus R`). **`go` and
`bad` are defined but unowned on the rail.** That is not an argument to drop either — `bad` is already
spent by 073's failed-jobs tab count, and the ~87 raw `red`/`rose` sites this ticket sweeps are its
real constituency. It does mean the rail cannot be used as the worked example that proves the four
tiers; the sweep's own sites must carry that.

One naming note that has to hold across both: 079 fixed the severities' *meanings* so its table is
derivable rather than memorised — `ok` = complete and went well · `go` = actively in motion · `warn` =
needs a human · `bad` = ended badly, terminally · `mute` = not recognised. If this ticket's sweep
re-reads any of those words differently at its ~165 sites, one of the two is wrong.

**From [074 — AG Grid theme mapping](074-ag-grid-theme-mapping.md) (done):** this ticket's last bullet
— the two `cellStyle` hexes — is answered in value, and the answer carries a trap worth inheriting
rather than rediscovering.

Both `deliveries/columns.ts:46` and `document/columns.ts:190` become `var(--danger)`. But **the ink
cannot stay `#ffffff`.** 071's rule R2 lifts every chromatic to L .66–.76 in dark and records the
consequence explicitly: in dark, a filled chromatic control is a *light tonal fill with dark ink*, and
white measures **2.2:1** on it. So `color` becomes **`--primary-foreground`** (`#FFFFFF` light /
`#121C27` dark). The comment at `deliveries/columns.ts:42` documents a light-mode-only contrast check
and must be **rewritten with the pair, not deleted**.

**That trap generalises to the whole sweep.** Any of the ~230 raw-palette sites that is a *filled*
chromatic with white ink — `bg-red-600 text-white`, `bg-emerald-600 text-white` — has the same latent
failure the moment it moves onto 071's dark values. 069's two badge idioms are both *tint* idioms
(`bg-<fam>-500/15` and `bg-<fam>-100`), which are safe; the filled ones are the ones to count
separately. Worth a pass over the hit list for `text-white` adjacency before sizing the sweep.

These are inline styles, so `var()` resolves against `:root`/`.dark` in `global.css` and works
regardless of how the AG theme itself is written. **074 established the values; the substitution is
this ticket's.**

## Answer

The ticket arrived with four of its six bullets already answered by its own comment chain — the
family list (four, the fourth is `--primary`), the tiers, `--destructive`'s fate (alias kept),
`--attention` vs gold (075 closed it), and the two grid hexes (074 gave the values). What was
actually open was the **idiom**, the **sweep**, and one thing the ticket did not anticipate.

### 1. The finding: the raw palette is two layers, not one

069 counted ~230 palette occurrences as "a fourth semantic layer — success / warning / danger /
info". It isn't one layer. Eleven of those sites spend hue as an **identity distinguisher** with no
severity meaning at all, and three of them sit inside the very lookup maps 069 nominated as the
sweep's efficient core:

| Map | Keys | What hue means there |
|---|---|---|
| `admin/active-sessions/ActiveSessionsPage.tsx:18-21` `CHANNEL_TONE` | web · mobile · backoffice · pos | which channel |
| `pricing/simulation/promo-kind.ts:10-13` `KIND_CLASS` | free · percent · fixed · setprice | which promo kind |
| `pricing/simulation/ConditionCard.tsx:20-22` `BADGE_TONE` | promotion · manual · header | where the condition came from |

A POS session is not "success"; a fixed-amount promo is not "needs a human". Sweeping these into the
severity families would make 079's vocabulary lie at eleven sites, and 069's concentration table is
wrong in the same place: of its "four small status-lookup maps holding ~49 hits", **only two are
severity** (`ua-admin/helpers.ts:47-49` and `bonus-buy-inquiry/columns.tsx:77-80`).

**Ruling (owner): hue is reserved exclusively for severity. All eleven categorical sites go
neutral** — `bg-muted text-muted-foreground`. Safe at every one of them: all three maps already
render a text label beside the chip (`ActiveSessionsPage` comments it explicitly, `ConditionCard`
renders `badgeLabel`, `promo-kind` ships `KIND_GLYPH` as well), so colour was never the only channel.

Consequence worth the build knowing: **all three maps become dead, not swept.** Every key resolves to
the same class string, so `CHANNEL_TONE`, `KIND_CLASS` and `BADGE_TONE` are deleted and their call
sites take a constant. That also removes `promo-kind.ts`'s half-tokenised outlier
(`percent: 'bg-primary/15 text-primary'`) without a separate decision.

### 2. The one idiom — and the `dark:` collapse

069 found two badge idioms. Both reduce to **one class string with no `dark:` variant at all**:

```
bg-<fam>-050 text-<fam>-800
```

This is derived, not chosen. 071 ruled that `-050`/`-800` are **roles, not lightness levels — they
swap sides** in dark, which is precisely what makes one string correct in both themes. **The 82
`dark:` twins in the hit list collapse to zero**, so the sweep is mostly deletion; the ~249
occurrences and the ~165 decisions converge.

Four shapes exist in the hit list beyond the badge. The full substitution table:

| Shape | Sites | Today | Becomes |
|---|---:|---|---|
| Tint badge | ~44 | `bg-<f>-500/15 text-<f>-700 dark:text-<f>-300` · `bg-<f>-100 text-<f>-800 dark:…` | `bg-<f>-050 text-<f>-800` |
| Bare ink | ~35 | `text-<f>-600 dark:text-<f>-400` | `text-<f>-800` |
| Callout / banner | ~10 | `border-<f>-500/30 bg-<f>-500/5 text-<f>-800 dark:…` | `border-<f>-border bg-<f>-050 text-<f>-800` |
| Filled chip / button | 2 (see §3) | `bg-<f>-700 text-white` | `bg-<f> text-primary-foreground` |
| Bare fill — dot, bar, meter | 6 | `bg-<f>-500` | `bg-<f>` |

Every one of these is a single string valid in both themes. Contrast verified against 070's light and
071's dark values:

- **Bare ink** `-800` on `--card` / `--background` / `--muted`, all four families, both themes:
  worst case **5.96:1** (`--attention-800` on light `--muted`), best 11.48. AA clears everywhere, so
  the same token that inks a `-050` badge also inks bare text on a card.
- **Bare fill** as a non-text graphic (3:1): worst case **3.43:1** (light `--attention` on
  `--background`), everything else 4.2–7.8. Clears. Note this is the one legal use of a light
  `--attention` fill — 071's prohibition is on *ink over* an attention fill, and a dot carries none.
- **Tint badge** is 071's own table (5.91–8.50).

Bridge cost in `global.css`: **sixteen** new `@theme inline` lines — `--color-<fam>-050`,
`--color-<fam>-border`, `--color-<fam>-800`, `--color-<fam>` for `success` · `attention` · `danger`,
plus the three `-050`/`-border`/`-800` for `primary` (`--color-primary` already exists). Without them
`bg-success-050` does not compile; the tokens landing in `:root` is not enough.

### 3. The filled-chromatic trap is two sites, and one of them is invisible to grep

074 handed forward a general warning: any *filled* chromatic with white ink breaks on 071's dark
values (white measures 2.2:1). Counted against the hit list, it is **five sites, and three evaporate**
— `ConditionCard.tsx:20-22` are all categorical and go neutral by §1. What remains:

- `core/ui/Button.tsx:18` — the `danger` variant is `bg-red-700 text-white hover:bg-red-800`, which
  never adopted `--destructive` despite sitting in `core/ui`. Becomes
  `bg-danger text-primary-foreground hover:bg-danger-800`, and the hover **darkens** rather than
  lightening, matching 070's note that `hover:bg-primary/85` was the wrong direction on blue.
- `layout/notifications/NotificationBell.tsx:91` — **not in 069's hit list at all**, because it is
  `bg-ring text-white`: already tokenised, and 070 moved `--ring` onto `--primary`. It inherits the
  exact 2.2:1 failure without ever having spelled a palette class. Becomes `text-primary-foreground`.

The generalisation therefore lands differently than 074 expected: the danger isn't in the raw-palette
sites (069's two idioms are both *tint* idioms, structurally safe), it is in **already-tokenised**
`text-white` next to a chromatic ground. `text-white` has 7 occurrences; 4 are the brand panels 075
already owns, 3 are these. **The grep that matters is `text-white`, not `bg-red-`.**

### 4. `core/ui/StatusBadge` — the helper already exists, in the wrong place

`admin/ua-admin/helpers.ts:46-51` exports `TONE_CLASS` keyed `ok | warn | bad | muted` — 079's
vocabulary, minus a letter, arrived at independently. Two features already share the shape, so under
the feature-structure rule it **graduates up to `core/`** rather than being copied a third time.

- **`src/core/ui/severity.ts`** — `type Severity = 'ok' | 'go' | 'warn' | 'bad' | 'mute'` (079's
  spelling; `ua-admin`'s `muted` is renamed to `mute`, and `go` joins even though 079 left it
  unowned) plus the severity → class-string map for each shape.
- **`src/core/ui/StatusBadge.tsx`** — `<StatusBadge sev="warn">{label}</StatusBadge>`, holding the
  badge idiom in one place and retiring ~44 hand-written strings. Label is a child, never a key: the
  component adds no `t()` call and so needs no namespace, keeping zero-literal a caller concern.

Feature-side maps become **value → severity**, never value → class string. `ua-admin/helpers.ts` and
`bonus-buy-inquiry/columns.tsx` `STATUS_TONE` both convert directly.

**Name collision to resolve in the build:** `bonus-buy-inquiry/columns.tsx:83` already declares a
local `StatusBadge` taking `code` + `label`. It becomes a thin wrapper — `code → Severity`, then the
core component — not a rename of the import.

`mute` maps to `bg-muted text-muted-foreground`, which is also where §1's eleven categorical sites
land, so neutral has exactly one spelling in the app.

### 5. Sweep policy — one mechanical pass

**Ruling (owner): the design-system spec carries the substitution table above, and the sweep is one
build ticket across all 41 files.** Per-area follow-ups were rejected: the app would carry steel-blue
neutrals against warm badges until the last area landed, and the table would be re-read four times.
The `dark:` collapse makes most of the diff deletion, which is what makes a single pass reviewable.

**Explicitly outside the sweep** (palette classes that are not severity and must not be tokenised):

- `bg-black/50` ×3 — modal scrims (`core/ui/Modal.tsx:75`, `oms/deliveries/ViewManager.tsx:108`,
  `layout/AppShell.tsx:232`). A scrim is black in both themes by intent.
- `bg-white` ×1 — `auth/LoginPage.tsx:680`, the QR code ground. Must stay white to scan.
- `text-white` / `text-white/70` ×4 on the brand panels — 075 owns these as
  `--brand-panel-foreground`.

**Grep gate for the build ticket** — three greps that must all come back empty over `src/`:

1. `\b(bg|text|border|from|to|via)-(red|rose|amber|orange|emerald|green|blue|sky|violet|slate)-` —
   zero hits. (`slate-700` and `violet-500` are the two "other" entries 069 logged; both are
   categorical and die in §1.)
2. `text-white` — only the four brand-panel sites survive, and only until 075's `--brand-panel`
   work lands, after which it is zero.
3. `-\[#` — already zero once 075 deletes the two gold kickers; 075 noted this sharpens the gate,
   and it does: **after this sweep the app contains no colour literal of any kind outside
   `global.css` and the logo SVG.**

That third gate is the real deliverable. The severity layer wasn't untokenised by oversight — it was
untokenised because there was nowhere to put it. There is now, and the gate is what stops it
re-forming.
