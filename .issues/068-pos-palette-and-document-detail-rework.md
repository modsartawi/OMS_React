---
type: wayfinder-map
status: done
---

# 068 — POS palette as the app standard + Document Details rework

## Destination

Two `status: ready` specs, consumable by `/to-tickets`:

1. **The design-system spec** — the `Sartawi.POS/View/Themed/PosTheme.xaml` palette adopted as
   oms-react's standard: full light **and** derived dark value tables mapped onto our existing
   semantic token names, the command-family colour taxonomy, the AG Grid theme mapping, and the
   ruling on what survives of the al-dawaa gold/navy brand surfaces.
2. **The Document Details rework spec** — the reworked screen replicating the approved prototype
   (identity band · status pill rail · 340px summary rail of cards · tabbed work area · contextual
   action bar) against our real `SdDocumentHeaderModel` fields and our 8 commands.

Reached when both specs are `ready` and no decision blocks the build.

**Reached 2026-07-24.** Both specs are published and `ready` for `/to-tickets`:
[082 — The POS design system](082-pos-design-system-spec.md) and
[083 — The Document Details rework](083-document-details-rework-spec.md). 083 consumes 082 and must
not start until it has landed (the rollout ruling below: palette first, then the screen).

## Notes

**Domain:** oms-react back-office (see `CONTEXT.md`). The reference artifact is a **POS/WPF**
prototype from a *different* effort — BackOffice map 665 / ticket 668, "OMS Detail — reworked",
targeting `Sartawi.POS`. This map borrows its look and its palette; it does not touch that codebase.

**Reference prototype:** <https://claude.ai/code/artifact/2683162a-9309-4ca2-868f-8d431e6dbf39>
Local mirror of its markup/tokens: [assets/068-pos-detail-reference.html](assets/068-pos-detail-reference.html).

**Owner rulings already taken (charting session, 2026-07-24)** — these are premises, not open:

- **POS palette wins outright.** The claude.ai warm-neutral system (`src/app/global.css`, issue 464)
  is retired. al-dawaa gold/navy survives at most as logo/brand mark, not as UI colour.
- **Dark mode stays** — a dark twin is derived for the full POS scale.
- **Fidelity: pixel-faithful device, adapted chrome.** Reproduce the header band, pill rail, 340px
  card rail, tab strip, dense table and action bar faithfully — but responsive (not fixed 1024px),
  logical Tailwind utilities per [logical-tailwind](../.claude/rules/logical-tailwind.md), AG Grid
  for the table, and the artifact's annotation / state-matrix sections excluded (they are
  documentation of the POS effort, not screen).
- **Action-bar grammar adopted** — escape-left · family clusters · commit-right, contextual per
  document state, applied to our 8 commands.
- **Token layer: remap values onto existing names.** Keep `--background`/`--primary`/`--muted`/
  `--border`…; swap their *values*; **add** the POS-only tokens (`--ink-3`, `--border-strong`,
  `--divider`, the family colours). Zero call-site churn is the goal.
- **Families map to our command families**, not to nav areas.
- **Rollout: palette first, then the screen.** The screen work must not build against a moving palette.

**Skills:** `/prototype` for every look-and-feel ticket (HTML asset beside the issue, as 059/060 did);
`/grilling` for the taxonomy and action-grammar decisions; `/research` for the AFK inventories.
Standing rules apply to any code the specs later produce — especially zero-literal i18n and logical
Tailwind.

## Decisions so far

<!-- one line per resolved ticket -->

- [The command-family taxonomy](072-command-family-taxonomy.md) — **"close" means cancel**, so no
  command on this screen is a positive outcome and there is no green commit slot: two family colours
  (Fulfilment `#2E7D5B`, Cancellation request `#5D5A93`), a quiet ghost tier (add-note,
  return-document), and a red terminal tier (close filled, force-close outlined). Document-scoped;
  labels renamed to say "cancel". [prototype](assets/072-command-families.html)

- [069 — Token surface & call-site inventory](069-token-surface-inventory.md) — zero call-site churn
  holds (all 21 tokens are Tailwind-utility-only, one `var()` read in the whole repo); the real cost
  is 249 raw palette occurrences in 41 files expressing an untokenised severity layer, plus AG Grid's
  hand-mirrored hex copy and two brand surfaces. `--muted-foreground`/`--border`/`--primary` carry the
  app (358/218/126); nine tokens are dead or near-dead and free to rehome.

- [070 — The POS token remap (light)](070-pos-token-remap-light.md) — the full light table, 21 tokens
  → **43**, all **hex** (byte-verifiable against PosTheme, one notation with `ag-grid-theme.ts`).
  `--primary` ← POS `--accent` `#2F63A6` (not `--key`, which is the *same value* as our 358-use
  `--muted-foreground`); `--ring` joins it and the terracotta is retired; `--input` ← `--border-strong`;
  dead `--secondary` revived as POS `--key`; sidebar **derived light** (dark band rejected — it would
  compete with 073's identity header). **No `--info` token** — primary *is* the blue, so 077 inherits
  four severity families, not five. Zero `.tsx` edits.
  [prototype](assets/070-pos-token-remap.PROTOTYPE.html)

- [071 — The derived dark twin](071-pos-token-dark-twin.md) — the rule is **"keep our proven dark
  lightness ladder, borrow only POS's temperature"**: every neutral holds the L of the dark theme we ship
  today and rotates H 84° → 250° (page `#1C1B19`→`#121C27`, card `#262523`→`#1C2631`). Chromatics can't
  follow — they lift to L .66–.76 holding hue, so **in dark every filled chromatic control is a light
  tonal fill with dark ink** (white measures 2.2:1 on them); families keep their fill rather than flipping
  to outline, because 072 spends fill as its weight axis. `-050`/`-800` are roles, not lightness levels —
  they swap sides, zero call-site churn. Border/divider/input ΔL copied exactly from light; dark separates
  surfaces at least as well as light in every pair. One finding back to 070: the **light `--attention`
  fill fails AA under every ink**, so it is pill/border/icon only.
  [prototype](assets/071-pos-dark-twin.PROTOTYPE.html)

- [073 — The reworked layout, filled with our real fields](073-detail-layout-with-our-data.md) — the
  reference device rebuilt on real `SdDocumentHeaderModel` paths. Owner removed the **Status tab** (four
  tabs: Items · Header Conditions · Log · Jobs), so the seven unpromoted statuses move to an **All
  statuses** disclosure on the rail. Six pills, all with `*Description` companions — the three
  companion-less statuses are disqualified, not mapped (406 precedent), and `closeStatus` is relabelled
  **Cancellation**. **Five** rail cards, Driver & tracking is the fifth (collapses with Prescription;
  Customer / Fulfilment / Payment always render — money and booleans render at zero, blank text rows are
  omitted). `#0B7C8C` named **`--prescription`** + `-050`/`-800`, a *marker* never a control. **The note
  textarea is retired** — captured at commit in each command's dialog, which deletes the `pendingNote`
  workaround. Stock column dropped, Rx/OTC renderer built but gated on a live document, zebra deferred
  to 074. Back in the identity band, Refresh at the end of the pill rail. **The payload was synthetic —
  SIS.Api was down — so nothing coded was guessed.**
  [prototype](assets/073-detail-layout.PROTOTYPE.html)

- [078 — Capture live document payloads](078-live-document-payload-capture.md) — five real payloads
  filed; they **invalidate 073's pill rail**, not its layout. Across five documents the six-status rail
  renders 2·0·2·2·0 pills, and `availabilityStatus` + `paymentStatus` are populated on **none** of them,
  while the two 073 demoted carry the state (`lastAction` 5/5, `consignmentStatus` 4/5). **Rx/OTC has no
  source at all** — `referenceErxLine` is empty on the one real e-Rx document and `itemCategory` is
  `"STND"` — so the tag is removed, not deferred. The real payment instrument lives on a header-level
  condition (`cardType`/`paymentMethod`), not in coded `paymentType`. Composition + the Payment row
  handed to 079. Also: negative discounts exist, slot text contradicts the schedule pair,
  `shippingAddress` can be `null`, the e-Rx card is two rows on live data, and no express document
  exists (`IsDeliveryExpress` vs our `isExpressDelivery` is unverified).
  [payloads](assets/078-document-payloads/)

- [079 — Status value → severity mapping for the pill rail](079-status-severity-mapping.md) — `'R'` is
  "Ready" on `readyStatus` and "Close Requested" on `closeStatus` **on the same document**, so severity
  is **per-status, never global**. The fixed six is dropped: a pill renders for **every described status
  that carries a value**, blank produces no pill at all, and the candidate set widens back to all eight
  with a companion — selection stops doing work once emptiness filters the rail. **`lastAction` becomes
  the rail's anchor** (always first, neutral outline, never coloured, monospace when its companion echoes
  the code), which guarantees the rail is never empty. The table holds **four observed codes** —
  `readyStatus R`/`approvalStatus A`/`deliveryStatus D` → `ok`, `closeStatus R` → **`warn`** — leaving
  **`go` and `bad` defined but unowned**, `bad` reserved for an *executed* cancellation. Unmapped ⇒
  `mute`; safe where 406's maps weren't because **the map supplies a colour, never a word**. Lives at
  `features/oms/document/status-severity.ts`, not `core/`. `consignmentStatus` stays off the rail —
  4/4 its letter echoes `lastAction`'s outcome, so it is a duplicate, not a missing label. Payment card
  reads the header condition's `cardType`/`paymentMethod` (**not** keyed on `DFEE`), falling back to
  coded `paymentType`.

- [074 — AG Grid theme mapping](074-ag-grid-theme-mapping.md) — **`var()` works on AG Grid v36**: the
  serializer returns string param values verbatim and derives every colour in CSS `color-mix`, so the
  theme can read `--card`/`--primary` directly and the two hand-mirrored hex blocks **collapse into
  one** — deleting the 20 mirrored values 069 counted and making the grid re-tint for any future
  palette move. `data-ag-theme-mode` keeps one passenger, `browserColorScheme`. Seventeen params (ten
  remapped, seven added), all verified present in 36.0.1; one departure from 070's suggestion —
  `rowHoverColor` reads `--card-2`, not `--background`, which would read as a hole in light and invert
  in dark. Of 073's three pushed treatments, **two need no work**: `tabular-nums` already ships on
  `.ag-right-aligned-cell` (which `type:'numericColumn'` sets), and the totals footer is expressible
  via `pinnedRow*` params. **Zebra stays off** — `rowBorder` on `--divider` already carries row rhythm,
  and zebra-on costs a token that doesn't exist because `--card-2` is spent on hover. The **one** CSS
  escape is the selected-row accent bar: `.ag-row-selected::after` with `inset-inline-start` (`::before`
  is AG's own overlay). The two `#c62828` become `var(--danger)` with ink flipped to
  `--primary-foreground` — white measures 2.2:1 on the dark fill.
  [research](assets/074-ag-grid-theme-mapping.RESEARCH.md)

- [075 — What survives of al-dawaa gold & navy](075-brand-surfaces-reconciliation.md) — one rule:
  **gold and navy are the mark's colours, not the app's** — neither hex may appear outside the SVG, so
  every per-surface answer is a consequence and no standing "exception" is left to erode. The login
  Editorial Split keeps its composition and swaps only its ground, to a **theme-invariant**
  `--brand-panel` `#202A34` + `--brand-panel-foreground` `#FFFFFF` — the only pair declared outside the
  `.dark` block, which is what enforces the rule. It sits at the navy's own darkness (L .280 vs .245) so
  the composition survives, and answers 071 with **ΔL +.058** against the dark page — a *raised slab*,
  between two separations 071 already shipped. Same hex as dark `--sidebar-accent`, deliberately **not**
  aliased. The home hero is **post-auth = tool**, so it loses the brand ground entirely (`--card`,
  hierarchy from type not colour) and drops its gold watermark. Gold is **not reachable**: `--attention`
  `#B4791F` stands, 070/071 stay closed, and deleting the two `text-[#FDC801]` kickers leaves the app
  with **zero** hardcoded colour hexes in `.tsx` — sharpening 077's grep. `BrandMark`/SVG untouched; one
  dead key found, `auth.json`'s `subtitle: "OMS Portal"` (retired product name).

- [081 — The rail cards' field rules against live data](081-rail-card-field-rules.md) — the four
  loose ends closed, and **two of them need no new code**: the `0001-01-01` sentinel test already ships
  as private `isBlankDate` in `core/util/date-format.ts` (export it), and `shippingAddress` is *already*
  typed `| null`, so `tsc` enforces 073's fallback chain. Stated once for the whole rail: **text is empty
  when `null` OR `''`** — live data emits both for the same field. **The e-Rx card stands as 073 drew
  it** — owner declined `approvalId` (a system identifier, not operator-readable); its five-field
  collapse is effectively `approvalNumber || patientId`, which is correct, and the card is simply **two
  rows** on today's data. **The slot and schedule rows collapse into one "Delivery window"**: the pair
  when non-sentinel and From **<** To, else the slot text, else omitted — so the live contradiction
  (`"8am - 12 am"` vs `20:00–22:00`) and the zero-length window never render. Null address is **silent**
  (no missing-address marker — the null document is a *pickup*, where no address is correct); the card
  shows name/mobile/loyalty only, and a blank-string address object takes the same path. Discount test
  becomes **`!== 0`** with the **sign rendered** (`-1.500`), matching the API and the Header Conditions
  tab one tab away.

- [076 — The action-bar grammar for our eight commands](076-action-bar-grammar.md) — the state → commit
  table the ticket asked for **has one row**: the gates it told us to drive off don't exist. There is no
  status-based gating in the code *by design* (`CommandPanel.tsx:22-26`), `deliveryType` gates nothing,
  and `documentCategory` only picks the endpoint — so the ruling is **evidence-only gating**: contextual
  solely where live data proves a contradiction (`closeStatus === 'R'` disables Request Cancellation,
  which promotes Withdraw Request by leaving it the cluster's only enabled member — **no new visual
  axis**), static on the other 4/5 documents. The **promoted-commit slot is permanently empty**: the
  terminal pair is a *tier, not a commit*, never enlarged, because 072 already proved no command here is
  a positive outcome — so 073's large Cancel Order is the one thing the build must not copy. **Nothing is
  ever hidden** (state-invalid → disabled + reason; busy → disabled, no reason) — hiding is the scope
  boundary, since a hidden command can't be invoked. **No `More ▾`** (built for ~30 commands, we have 8;
  clusters wrap instead). Escape slot **stays empty** — Back stays the band chevron, which puts "leave"
  top-start and "destroy" bottom-end structurally. Clusters confirmed as 073 drew them; all three hold
  exactly two commands, so the single-command-label case never arises. **View-only has no trigger** —
  no permission gating exists on this screen, and minting one would be behaviour. Build deletes
  `pendingNote`, the `!hasNote` gate, and the `CheckCircle2` on `close`.

- [080 — RTL mirroring of the reworked layout](080-rtl-mirroring-of-the-reworked-layout.md) —
  **logical-tailwind paid out**: eleven mirroring mechanisms verified rather than assumed, and **five of
  the eight faults are one-line fixes byte-identical under LTR**. `box-shadow` offsets are physical with
  no logical form, so 073's selected-row bar does *not* mirror — **074's `::after` +
  `inset-inline-start` was already correct**. Bidi is far smaller than feared and **the culprit is the
  space, not the punctuation**: a value breaks only if it has a space and begins/ends with a digit, so
  `ERX-77120934`/`1180-4471`/`240.70` are safe and the list is **six fields** — including the totals
  footer, newly found. Wrap a whole value, never a fragment (fragment-wrapping *created* a fault). The
  transferable trap: `‹` (U+2039) is **`Bidi_Mirrored`** and flips itself, hiding the fault and
  double-mirroring the naive fix — **icons that must mirror ship as SVG and flip explicitly**.
  `enableRtl` is a grid option not a theme param ⇒ one derived value beside the theme; today's lone call
  site reads a `dir` **nothing ever sets**. Owner ruled: identity band **mirrors** (customer goes left),
  action bar **mirrors incl. cluster order**, `↗`→`↖`, and scope is **fixes + bidi now, no `dir` switch**.
  Arabic *metrics* stay out of scope with the copy.
  [prototype](assets/080-rtl-mirroring.PROTOTYPE.html)

- [077 — The severity colour layer and the raw-palette sweep](077-severity-colour-layer.md) — the raw
  palette is **two layers, not one**: eleven sites spend hue as an *identity* distinguisher, and three
  of them sit inside the very maps 069 nominated as the sweep's core, so **only two of its "four
  status-lookup maps" are severity**. Owner: **hue is reserved for severity** — all eleven go
  `bg-muted text-muted-foreground`, which makes `CHANNEL_TONE`/`KIND_CLASS`/`BADGE_TONE` **dead, not
  swept**. One idiom, **`bg-<fam>-050 text-<fam>-800` with no `dark:` at all** — derived from 071's
  role-swap, so the **82 `dark:` twins collapse to zero** and the sweep is mostly deletion; four other
  shapes (bare ink `text-<fam>-800`, callout, filled, dot) get the same one-string treatment, all
  contrast-verified (worst 5.96 AA / 3.43 non-text). 074's filled-white-ink trap is **two** sites, and
  one is **invisible to grep** — `NotificationBell` is `bg-ring text-white`, already tokenised — so
  **the grep that matters is `text-white`, not `bg-red-`**. `ua-admin/helpers.ts` already spelled
  079's `ok/warn/bad`, so it **graduates to `core/ui/StatusBadge` + `severity.ts`**; maps become value
  → severity, never value → class string. Sweep is **one pass across 41 files** in the design-system
  spec, with scrims/QR/brand `text-white` explicitly excluded and three grep gates — the third leaving
  **no colour literal anywhere outside `global.css` and the logo SVG**.

## Not yet specified

- **Per-screen fallout of the swap.** 069 measured the mechanical part (the raw-palette severity
  sweep is now ticket 077). What remains fog is the *aesthetic* fallout: neutrals that re-tint for
  free but read wrong on a cool-blue ground — a warm emphasis that goes invisible, a hairline that
  disappears. Both tables are now approved (070 light, 071 dark), so this is visible only once they are
  **applied** — build fallout, not a decision the map still owes.

## Out of scope

- The POS/WPF side of the rework (BackOffice map 665 / ticket 668). Different repo, different effort;
  this map only consumes its palette and its layout.
- Any change to document command **behaviour** — endpoints, the actionType matrix, the Change Store
  or Reschedule flows. This effort is arrangement and colour only.
- Arabic translation content (the RTL *layout* question is fog above; the copy is not this effort).
- **Sourcing the true command-legality matrix** from the WPF `DocumentDetailsController` or the server.
  Offered and rejected while resolving
  [076 — The action-bar grammar](076-action-bar-grammar.md): the client deliberately does not gate on
  status, and reproducing the server's rules here is command *behaviour*, already out of scope above.
  A real matrix would need its own effort, with the drift risk in view.
