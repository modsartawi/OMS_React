---
status: done
spec: 590
blocked-by: 597
---

# 603 — The call-center console runs on the shared controls

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Migrate** the `callcenter (console only)` screens onto the shared controls (spec 590 §Shared controls). This is a
pure restyle: nothing about behaviour, arrangement, copy or density changes.

- **Fields** (text, number, date, search, select, textarea) move onto `Input` / `Select` /
  `Textarea`. A label, hint or error beside a field becomes `Field`. Any local `INPUT`-style
  constant in the area is replaced by the shared control, and the constant is deleted once the
  area no longer uses it.
- **Buttons:**
  - Icon-only buttons become `IconButton`.
  - Chips, toggles and tab bars become `Chip`.
  - Outlined look-alikes and buttons that carry a variant's colours become `Button`.
  - Text-style buttons that navigate take the link look.
- **Restyled in place:** one-offs, row or tile pickers, grid-cell actions and non-navigating text
  buttons are rewritten to tokens and the new radius, and listed in the ratchet's allowlist with a
  one-line reason.
- **Checkboxes and radios** stay native with `accent-color: var(--primary)`.
- **Untouched:** anything under `__prototype__`, and the printed facsimiles' ink.

The `callcenter/__prototype__` folder (78 controls) is **not** swept.

583's inventory (`assets/583-control-inventory/`) lists every occurrence by file and bucket. Re-run
its script before and after, and paste both counts in the ticket.

## Spine reach

component/route (callcenter (console only)) · test

## Proof (→ `tdd` red-green cycles)

- [x] `dmsco-theme-drive` gains the heaviest callcenter (console only) screen(s): light, dark and RTL screenshots; every field labelled, every icon button named, role tokens resolved · flow (Playwright)
- [x] the area's existing drives stay green unchanged (colour checks are by role after 593) · flow (Playwright)
- [x] the lint ratchet shows `callcenter (console only)` at its allowlist (documented one-offs and pickers only) · lint gate

React Testing Library is still not installed (spec 083), so shared controls are proven through the
drive; verify via typecheck + drive.

## Boundaries

- **No new i18n keys,** except an accessible name an icon button was missing (add it in the
  feature's own namespace).
- **All rules stand:** logical Tailwind, bidi isolation, zero literals.
- **A restyle only.** If a screen seems to need a behaviour change, stop and write it under
  Open questions.
- **Runs AFK** (`/afk-loop`) once 597's pattern note exists.

## Done when

Every callcenter (console only) feature is at its allowlist, its drives are green, and the theme drive covers its heaviest screen.

## Blocked by

[597](597-the-campaign-workspace-runs-on-the-shared-controls.md)

## Comments

**2026-10-26 — built (branch `impl/590-603`).**

**Counts.**

| | ratchet (`check-controls`) | 583 inventory: buttons | fields | total |
|---|---:|---:|---:|---:|
| before (integration tip `67fe1c5f`) | 69 | 52 | 21 | 73 |
| after | 20 (= the allowlist) | 21 | 3 | 24 |

The 583 "after" row is what spec 590 keeps: the 2 `LocationCardView` checkboxes and the sign-up
language radio (native, `accent-primary`), the 20 allowlisted buttons, and ConsoleCard's *Back to
portal* `<Link>` (583's "link styled as button": it navigates and is not on the ratchet; it now
wears `buttonClass(outlined | link)` so it matches *Sign out* beside it). `AddressForm`'s `FIELD`
constant is deleted; the area had no other local control constant. `callcenter/__prototype__` and
`console/__prototype__` were not touched.

**What moved.** Every text/number/select/textarea field onto `Input` / `Select` / `Textarea`; `Field`
where the label already sat above (address label, street/building/phones, Short Address, source,
reference, note, location-link mobile — its refusal now `Field`'s `error`, hook on an inner span).
Icon buttons onto `IconButton` (line void, find, remove caller, refresh, banner and outcome dismiss,
search clear, item expand, coupon remove, address edit/delete). Look-alikes onto `Button` (Place
order, New order, Resume, Start fresh, Abandon, Unlink ×2, Attach ×2, sign-up Send/Confirm/Cancel,
Sign up, the retries, section close as `text`).

**Allowlist (20, in `tools/control-baseline.txt`):** 9 pickers (city/district options, address row,
fulfilment, payment, slot window, store row, sentence word, ledger field), 4 `aria-expanded`
disclosures (linked-request chip, *N unavailable*, reward arm, offer card header — 597 Q2), 3
non-navigating text buttons (city *Change*, *Search the other N*, scope *Show all*), 2
attention-toned one-offs (open-requests offer, *Add anyway*), the qualifying-product row *Add*, and
the slot day tabs.

**Proof.**
- Theme drive, screen `callcenter-console` (light/dark/RTL; the console with no caller, the sign-up
  after a miss, the address book ▸ edit form): 138/138. Red first: before the sweep, light failed
  23 of 46 (36–38px fields, `--background` ground on the label select, non-square icon buttons,
  non-pill buttons).
- Area drives (stubbed, port 5603): `callcenter-drive` 532/532, `callcenter-shell-drive` 123/123,
  `callcenter-callerbar-drive` 156/156, `callcenter-sentence-drive` 97/97.
  `callcenter-guidance-drive` 152/155 and `callcenter-location-drive` 361/363: the same checks fail
  on a clean checkout of the tip `67fe1c5f` (guidance: "two offers sharing one blank offerId still
  draw two cards" and "never on Bby/*" ×2; location: the two RTL CCL-00006 status-poll checks), so
  they come from before this ticket. Recorded, not fixed.
- `npm run lint` 5/5 (ratchet `callcenter/console 20`, a 20-line allowlist), `typecheck` clean,
  `npm test` 6728/6728.

**Pattern snags (for 606 and the owner).**
- Comboboxes with their own trailing control (city/district *Change*, item search ✕) stay
  `type="text"` with the hand search icon: `type="search"` would add the browser's own clear button
  beside theirs and clear the box on Esc.
- The slot day tabs are two lines (weekday over date); a 28px `Chip variant="tab"` cannot hold them,
  so they are restyled in place on the Chip's on/off tokens.
- Size moves from the shared heights: *Place order* / *New order* ~40px → 28px, the busy strip's
  Retry ~20px → 28px, every console field 32–38px → 28px.
- The `AddressForm` hand labels (city, district) go `font-semibold` → `font-medium`, matching the
  `Field` labels beside them. The banner ✕ is a ghost `IconButton`; it keeps its tone only on the
  glyph.
