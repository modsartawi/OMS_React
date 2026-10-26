---
status: done
spec: 590
blocked-by: 597
---

# 605 — The remaining areas run on the shared controls

From spec [590](590-the-back-office-wears-the-dmsco-theme-spec.md) (map 580).

## What to build

**Migrate** the `deliverect, hungerstation, materials, loy and auth` screens onto the shared controls (spec 590 §Shared controls). This is a
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

`auth` here means the StoreSwitcher and session chrome. **The login page is out of scope**, except one build fix carried by this ticket: the short-window scroll (776px minimum height in a 744px window, 584).

583's inventory (`assets/583-control-inventory/`) lists every occurrence by file and bucket. Re-run
its script before and after, and paste both counts in the ticket.

## Spine reach

component/route (deliverect, hungerstation, materials, loy and auth) · test

## Proof (→ `tdd` red-green cycles)

- [x] `dmsco-theme-drive` gains the heaviest deliverect, hungerstation, materials, loy and auth screen(s): light, dark and RTL screenshots; every field labelled, every icon button named, role tokens resolved · flow (Playwright)
- [x] the area's existing drives stay green unchanged (colour checks are by role after 593) · flow (Playwright)
- [x] the lint ratchet shows `deliverect, hungerstation, materials, loy and auth` at its allowlist (documented one-offs and pickers only) · lint gate

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

Every deliverect, hungerstation, materials, loy and auth feature is at its allowlist, its drives are green, and the theme drive covers its heaviest screen.

## Blocked by

[597](597-the-campaign-workspace-runs-on-the-shared-controls.md)

## Comments

**2026-10-27 — built (branch `impl/590-605`).**

**Which features this ticket took.** On the integration tip `31b6169f`, every feature with a nonzero ratchet count that 597–604 do not own: `auth`, `deliverect/{catalog,orders,stores,terms}`, `hungerstation/{materials,orders,stores}`, `loy/member` and `materials/{detail,gs1-check,search,stock-check}`. Those are exactly the five areas the title names, so nothing else was left over. `auth` is the session chrome only: StoreSwitcher and ProtectedLayout. LoginPage gets only the short-window fix.

**Counts.**

| feature | ratchet before | ratchet after (= allowlist) | 583 before (btn + field) | 583 after |
|---|---:|---:|---:|---:|
| auth | 24 | 22 (all LoginPage, out of scope) | 24 | 22 |
| deliverect/catalog | 5 | 0 | 7 | 2 |
| deliverect/orders | 8 | 0 | 8 | 0 |
| deliverect/stores | 12 | 1 | 13 | 2 |
| deliverect/terms | 6 | 0 | 7 | 1 |
| hungerstation/materials | 3 | 0 | 5 | 2 |
| hungerstation/orders | 8 | 0 | 8 | 0 |
| hungerstation/stores | 10 | 1 | 10 | 1 |
| loy/member | 26 | 2 | 26 | 2 |
| materials/detail | 1 | 0 | 3 | 2 |
| materials/gs1-check | 2 | 1 | 2 | 1 |
| materials/search | 6 | 2 | 7 | 3 |
| materials/stock-check | 6 | 1 | 9 | 4 |
| **total** | **117** | **30** | **129** | **42** |

The 583 "after" column is the allowlist plus what spec 590 keeps native: 8 checkboxes, 1 radio and 2 file inputs. It also includes materials/detail's "Back" `<Link>`, a link styled as a button: it navigates, so it is not on the ratchet and is left as it was. Plain links are left out of both columns.

Local constants deleted:
- `FIELD` / `INPUT`: every deliverect file that had them (CatalogDialogs, CatalogPage, OrdersPage, MaterialHistoryDrawer, PushLines, StatusDialogs, StoreDialogs, StoresPage, TermsDialogs) and every hungerstation file that had them (MaterialsPage, OrdersPage, MaterialHistoryDrawer, PushLines, StoreDialogs, StoresPage).
- `CHIP`: deliverect CatalogPage and OrdersPage, hungerstation OrdersPage.
- materials: `FIELD` / `INPUT` in MaterialSearchPage and StockCheckPage, `INPUT` in Gs1CheckPage.
- loy: `BAR_BUTTON` (MemberLookupPage), and the whole of `loy/member/profile-controls.ts` (`PRIMARY_BUTTON`, `QUIET_BUTTON`, `removalFieldClass`).

**Where the buckets went.**
- **Fields** moved onto `Input` / `Select` / `Textarea`.
- **Label-above blocks became `Field`.** This covers every filter bar, every dialog field and the loy profile, mobile, case-reference, retyped-id and block-reason fields. Each loy Field keeps its id (`loy-profile-*`, `loy-mobile-new`, `loy-block-reason`, …) so the drives' `#id` selectors still hold.
- **Error and hint lines that sat under a control are now the Field's `error` / `hint`.** Their drive hooks moved to inner spans: `data-status-delay-invalid`, `data-account-fallback`, `data-chain-fallback` and terms' `data-field-problem` (its `Problem` span). Each `role="alert"` stayed on its span.
- **Close buttons became `IconButton`:** both rails' order drawer and raw drawer. The stock check's chosen-store remove became `IconButton danger compact`.
- **`aria-pressed` filters and segmented toggles became `Chip`:** catalog states, both rails' outcome chips, deliverect platform chips, both raw drawers' Formatted / As received, and material search's tri-state Any / Yes / No. The tri-state's bordered segment became `inline-flex gap-1`, per 597.
- **Underline tab bars became `Chip variant="tab"`** inside their existing tablists: the loy member tabs and the material detail tabs. Each `border-b` was kept, with `py-2`.
- **Look-alikes became `Button`:**
  - loy: Search (`primary`); Change / New lookup, Discard, Remove email / mobile, Block / Unblock and Recent searches (`outlined`); Save and Change mobile (`primary`); every ErrorBanner Retry / Reload (`danger-outlined`); the lookup's Cancel (`text`).
  - ProtectedLayout's bootstrap Retry (`primary`).
- **Label-beside layouts kept (597 Q1):** material search's Take select keeps its inline label.

**Allowlist (8 besides the login's 22):**
- Grid-cell actions: both rails' sync log "Open lines", loy invoice Resend, the gs1 row expand.
- Disclosures, restyled in place (597 Q2):
  - The material search filter-picker trigger, now `h-7 rounded-full` on the Chip tokens.
  - loy's "More member details".
- The filter picker's Clear: a non-navigating text button.
- The stock check's store-finder match: a row picker.

`rounded` became `rounded-md` and `border-border/60` became `border-border` where they applied.

**The login's short window (584).** At 1568×744 the page scrolled by 168px: the card's 776px minimum, plus 80px of padding, plus the 56px greeting. Two changes fix it:
- The card's minimum is now `min(776px, 100dvh − 5.5rem)`.
- Below 912px tall (at lg) the page's block padding is `py-4`.

Measured with a scratch Playwright probe:

| window | before | after |
|---|---|---|
| 1568×744 | scrolls (912 / 744) | fits (744 / 744) |
| 1280×744 | scrolls (912 / 744) | fits (744 / 744) |
| 1440×900 | scrolls (912 / 900) | fits (card 776) |
| 1920×1080 | fits | fits (card 776) |
| 1568×698 | scrolls | still 32px over |

The 698 case is the content's own 642px; see Open questions. The theme drive's `remaining-auth` screen pins "no page scroll" at 1568×744.

**Proof.**
- **Theme drive, block "605", 330/330** (light, dark and RTL). Its four screens:
  - `remaining-delivery-rails`: Deliverect orders and stores filters, HungerStation orders and stores filters, the outcome Chips off and then pressed, the platform Chips.
  - `remaining-materials`: the stock check's Textarea, search and set Selects, plus a chosen store's remove IconButton; material search's box, Take, tri-state Chip and a filter picker's query Input.
  - `remaining-loy`: the member tab Chips, the 10 profile Fields, the command Buttons and the block dialog's reason Select.
  - `remaining-auth`: the top bar's store-switcher Select, and the login fit at 744px.
- **Red first,** with the block run on a scratch worktree of the tip `1ba9c126` (no stash), light only: 41/110. It failed on 32–36px fields with the `border/60` edge on `--background`, transparent chips with no pill, underline tabs, an unlabelled picker query, the store switcher on `--background`, and the login at 912 > 744.
- **Area drives** (stubbed, port 5605), all green and unedited:

  | drive | result |
  |---|---|
  | deliverect-catalog | 90/90 |
  | deliverect-stores | 230/230 |
  | deliverect-terms | 80/80 |
  | hungerstation-materials | 69/69 |
  | hungerstation-orders | 117/117 |
  | hungerstation-stores | 304/304 |
  | loy-invoices | 29/29 |
  | loy-jump | 27/27 |
  | loy-member-admin | 170/170 |
  | loy-member | 184/184 |
  | materials-detail | 67/67 |
  | materials-gs1 | 59/59 |
  | materials-stock | 47/47 |

Two drives are not fully green, and neither failure traces to this sweep:
  - **materials-search 73/74.** The one fail is "1: the Materials group comes right after the Pricing group", the Admin-menu order. The same check fails on a scratch checkout of the tip `1ba9c126`. Pre-existing: recorded, not fixed. (The first run also failed "4: the pickers agree"; it passed on the retry.)
  - **deliverect-orders.** The first full run was 90/91, failing only "2–5: one Platforms read". This sweep changed no query on that page. Four retries, made while sibling agents' drives loaded the machine, each timed out on a different 5-second wait. The tip checkout timed out too, at the same DLV-00007 refusal wait as one of those retries. Load-related, so it was not made green here. Worth one quiet re-run before 606.
- **Gates:** `npm run typecheck` is clean; `npm run lint` passes all 5 gates ("none above the baseline"); `npm test` passed 424 files / 6728 tests.

**Snags / visible changes.**
- **Size moves to the shared 28px / 12px:**
  - Both rails' filter fields were 36px.
  - Their dialog fields, and the loy profile and command fields, were 32px.
  - The gs1 scan box was 40px.
  - The loy lookup box and Search were 36px.
  - The loy command buttons were 32px / 14px.

  The `h-9` / `h-8` overrides on the Buttons beside them were removed so the rows still line up.
- **Loy's field labels** were 10px bold uppercase (`tracking-wider`). As `Field` labels they are 12px medium in muted ink, the shared label look (603 accepted the same weight move). The "changed" badge still sits inside the profile label. The drives fold case, so nothing pinned the uppercase.
- **Two Field children kept their place.** The terms validFrom's conflict note and the server refusal (`InlineRefusal`) stay as children inside the Field, so they now render above its error line. The add-platform key's problem line now comes after its hint (Field order: hint, then error).
- **A local `Field` clashed with the core one.** The gs1 card's read-only `Field` was renamed `ReadField`.
- **The filter picker's query box** had only a placeholder. It takes `aria-label` from the same key (no new keys).

**Open questions.**
1. **Login at 1568×698** still scrolls 32px: the sign-in column's own content is 642px tall (logo 140 + form). Making it fit would mean shrinking the design's scale or hiding the decorative greeting on very short windows. That is a design change, so it was left out. Is 744 the target?
2. **Loy's uppercase micro-labels** (10px bold) became the shared Field label. Keep that, or should loy keep its uppercase field captions?
