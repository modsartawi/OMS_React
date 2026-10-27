---
status: done
spec: 590
blocked-by: 591
---

# 593 — Drives check colours by role, not by hex

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

The 38 drives that probe a colour stop pinning hex values, so a palette change no longer breaks
them.

- **A pinned-literal assertion is deleted.** The contrast gate owns token values.
- **A role assertion is rewritten to compare against the token:** for example,
  `getPropertyValue('--danger')` read from the document. Typical roles are the danger ink, the
  gold cursor and the attention chip.
- **Nothing else changes.**

Start from a grep of the drives for `rgb(`, hex literals and `getComputedStyle`. List each drive
and what was done to it in the ticket.

## Spine reach

test (tools drives)

## Proof (→ `tdd` red-green cycles)

- [x] every touched drive green against stubs after 591's tables · flow (Playwright)
- [x] no drive under tools/ asserts a literal colour value (grep in the ticket) · check

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **Drives only.** No change under `src/`.

## Done when

Every drive that probed a colour passes on the DMSCO tables, and none pins a hex.

## Blocked by

[591](591-the-app-wears-the-dmsco-palette-in-light-and-dark.md)

## Comments

### 2026-10-26 — built (branch `impl/590-593`)

**The idiom.** A drive never holds a colour value. It resolves the token the element plays on
the live page and compares the two:

```js
// foundation-drive.mjs: tok(page, name, theme?)
probe.style.color = `var(${name})`; getComputedStyle(probe).color
```

`theme` flips `.dark` for the read and puts it back. That is how "paper resolves the light
table" is asked without a hex. A claim that two things share an ink compares the two elements
(the voucher line against its box's border). A claim that a value differs between themes
compares the two reads. The contrast gate (`tools/check-contrast.mjs` `EXPECTED`) is the only
place a value is pinned.

**Red / green.** Red is the drive at `e17760f3` (591's tables) on Vite :5293, stubbed. Green is
the rewritten drive on the merged integration tip (`0e9dbf36`, with 592's rail pill and 594).

| Drive | Colour probe | Red at 591 (colour) | What was done | Green |
|---|---|---|---|---|
| foundation-drive | `PALETTE_B` (ground/card/ring), `NAVY`, `GOLD`, `WHITE`, `RAIL_MUTED`, `BACKDROP`, badge `#FDC801`/`#002554` | **red**: page ground, rail, focus rings, print ground, rail marker, flyout/tree ink, menu/drawer/flyout navy, scrim | All literals deleted. Each check reads `tok()`: `--background`, `--card`, `--ring`, `--gold` (the rail ring), `--rail-gradient-to` (the flat ground under 592's gradient), `--backdrop`, `--gold`/`--gold-foreground` (badge). The retired gold `::before` marker became 592's pill (`--rail-pill` ground, `--rail-active` icon, no bar, pixel-checked), and so did the leaf checks in screens §41 | every colour check green. 1450/1558 overall. The 108 left are not colour (see below) |
| palette-drive | `EXPECT` table of 20 palette-B values | **red** (stub harness): 8 tokens off-value. Unstubbed it dies at `Auth/Login` (needs a live SIS.Api) | Table deleted. Each token must resolve to a colour of its own; dark must swap the ground; `--brand-panel` must be identical in both themes | 31/31 (stub harness*) |
| collection-print-drive | `rgb(192,0,0)` voucher line, dark/print `rgb(10,17,29)`/`#e6ebf2`/`rgb(242,244,248)`/`#0f1b2d`, ACR `rgb(176,0,32)` | **red**: the printed-dark check (paper `--background` is now `#f4f4f4`) | Voucher line equals its box's border ink. Dark screen differs from a light-mode read of the same route, and dark print equals that light read. ACR shortfall is red-dominant and unlike a plain figure (facsimile ink stays the form's: spec 590 Out of Scope) | colour checks green; 154/156 (2 date-cell fails pre-exist) |
| deliveries-list-drive | token probes (`--attention`, `--gold`, `--cursor`, `--primary-050`, family dots) | crashed at l.675 at 591 (`[data-inspector-toggle]` missing), not colour | none: already role reads | 362/362 at the tip `1f715cd3` (595 fixed the crash), every token read green |
| document-header-drive | token probes (`--gold`, `--attention-800`) | crashes waiting for `[data-now-step]`, not colour | none: already role reads | n/a (pre-existing crash) |
| document-actions, document-items, document-spine, document-donor, donor-requests, document-facts, status-badge, bby-inquiry, grid-theme, sim-rtl, sim-density, callcenter-drive | token probes / element-vs-element | green on colour (bby-inquiry 2 menu-leaf fails, grid-theme 4 "ag-grid-community module not found" fails: not colour) | none | as red |
| document-cards, loy-member, ua-users-scale, sync-console-store, bby-maintenance, deliverect-orders, deliverect-stores, hungerstation-orders, sim-strip, document-rtl | relative (contrast ratio, A≠B, tone-vs-untoned) | green on colour (ua-users 4 count/label fails, sync-console crash at `[data-replay-json]`, deliverect-stores crash at `noMatch` notice, bby-maintenance "Max value unavailable", document-rtl 1 isolate fail: none colour) | none | as red |
| callcenter-callerbar, -guidance, -sentence, -shell, delivery-statistics, document-detail, guidance-138, materials-gs1, nphies-authorization-session, pick-support, profit-center, sim-process | `getComputedStyle` for font, direction, geometry or opacity only (`#` in materials is a GS1 string; nphies paints a canvas test image) | no colour probe (guidance 3 Bby fails, guidance-138 crash, sim-process 3 radius fails: not colour) | none | as red |
| callcenter-location-drive (new from main in the tip) | none | n/a | none | n/a |

\* palette-drive needs a live SIS.Api (`Auth/Login` via `page.request`). The proof ran a scratch
copy with a `page.route` stub and a faked login body (red: the original file, green: the
rewrite). The stub was never written into tools/.

**Foundation's 108 non-colour fails** (recorded, not fixed):
- radius/shape from 591's `--radius: 1rem` (Button "6px control", card/Modal/dialog/toast
  recipes 8/10px, the bell tag 4px, textarea 6px): 594/595's area.
- The granted-group set (the rail and drawer show Administration and Campaigns too).
- The top bar's controls (palette field).
- Drawer navigation focus.
- `/campaigns/priority` and `/admin/sync` crash in the ErrorBoundary. Their "pill sits on this
  leaf" fail follows from the crash.
- Header clipping on two statistics grids.
- One bidi check ("the time's count").

The tree-header check fails on its group count only; its inks (white, `--rail-muted`) match.

**Closing grep** (tip of `impl/590-593`, excluding the gate scripts and the theme drive):

```
$ grep -nE "rgba?\([0-9]|'#[0-9a-fA-F]{3,8}'|\"#[0-9a-fA-F]{3,8}\"|oklch\(|hsl\(" tools/*.mjs \
    | grep -vE "^tools/(check-contrast|check-palette|dmsco-theme-drive)"
tools/document-actions-drive.mjs:365:  … b.ground === 'rgba(0, 0, 0, 0)'          ← "no ground" sentinel
tools/document-actions-drive.mjs:376:  … forceCancel.ground === 'rgba(0, 0, 0, 0)' ← "no ground" sentinel
tools/foundation-drive.mjs:2015:   … 'rgba(0, 0, 0, 0) 0px 0px 0px 0px'        ← "no shadow layer" sentinel
tools/nphies-authorization-session-drive.mjs:1795-1800 '#ff0000' …         ← paints a canvas test image, asserts nothing
tools/palette-drive.mjs:183,184,196  'rgba(0, 0, 0, 0)'                       ← "uncompiled / unresolved" sentinel
```

No drive asserts a palette value. Transparent is the absence of a colour, not a role, so those
sentinels stay. `check-contrast.mjs` holds the values by design. `dmsco-theme-drive.mjs` is
592/594/595's and already reads tokens.

**Open:**
- palette-drive still needs a live SIS.Api to run at all. Stubbing it is a one-block change if
  wanted.
- A pre-existing crash (`[data-now-step]`) stops document-header before its token-read colour
  checks. Those checks are unproven on the DMSCO tables until the crash is fixed.
