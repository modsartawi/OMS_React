---
type: spec
status: ready
---

# 441 — The BBY Inquiry reads and searches the real bonus buy status

Grilled 2026-10-08 (`/grill-with-docs`). Follows BackOffice 2384 (done), which moved the server's
`Bby/List` to SAP's codes. The glossary's **Active / current** entry was rewritten in the same
session; **BBY status** is the code set this spec renders.

## Problem Statement

A pricing user opening the BBY Inquiry cannot trust the Status they see. The server now uses SAP's
codes (**blank** = Activated, `1` = Planned, `2` = Deactivated, OMS's `3` = Tested), but the screen
still labels the retired `A`/`I`/`D`/`X` reading. So:

- an **Activated** bonus buy (blank code) shows **no status badge at all**;
- a **Planned**, **Tested** or **Deactivated** one shows its raw digit on a grey badge;
- the Details modal has the same fault, and so does the Simulation screen that opens it.

The search does not let the user ask by status either. The only lever is "Active only", which mixes
two questions (is it Activated? is it valid today?) and cannot answer "which bonus buys are Planned or
Tested, waiting to go live?" or "what was Deactivated during last month?".

## Solution

The inquiry reads **BBY status** the way Bonus Buy Maintenance already does: Activated, Planned,
Tested, Deactivated, and an honest *Unknown* for anything else. It reads the same in the grid, the
pinned identity cell and the Details modal.

The search toolbar replaces "Active only" with two independent criteria:

- **Status**: a multi-select of Activated · Planned · Tested · Deactivated. Choosing none means every
  status. Defaults to **Activated**.
- **Valid today**: a checkbox, default **on**.

The default view is unchanged: Activated + valid today, i.e. the **active** bonus buys. Status is
filtered **on the server**, because the list stops at 1,000 rows and a browser-side filter could hide
matches that were never loaded.

## User Stories

1. As a pricing user, I want an Activated bonus buy to show an **Activated** badge, so that a live offer is never shown with no status.
2. As a pricing user, I want a Planned bonus buy to read **Planned**, so that I know it is still being authored and does not price at the tills.
3. As a pricing user, I want a Tested bonus buy to read **Tested**, so that I can see it has been priced by a tester and is ready to go live.
4. As a pricing user, I want a Deactivated bonus buy to read **Deactivated**, so that I know it was switched off on purpose.
5. As a pricing user, I want a status code the screen does not recognise to read **Unknown** with its raw code beside it, so that a new or corrupt code is visible rather than hidden or guessed into a known one.
6. As a pricing user, I want a row whose status field is missing to read **Unknown**, never Activated, so that a wire change can never paint every bonus buy as live.
7. As a pricing user, I want each status to carry a distinct colour (Activated green, Planned amber, Tested "ready", Deactivated and Unknown neutral) with its label always beside it, so that I can scan the grid quickly without relying on colour alone.
8. As a pricing user, I want the Details modal to badge status exactly as the grid does, so that the two never disagree about one bonus buy.
9. As a call-centre or pricing user on the Simulation screen, I want the Details modal I open there to show the same corrected status, so that the fix reaches every place the modal is used.
10. As a pricing user, I want the screen to open on Activated bonus buys valid today, so that my default view is still "what is live right now".
11. As a pricing user, I want to choose several statuses at once (e.g. Planned + Tested), so that I can list everything not yet live in one search.
12. As a pricing user, I want to clear every status to mean "all statuses", so that I do not have to tick all four.
13. As a pricing user, I want to turn off **Valid today**, so that I can see Activated bonus buys whose window has ended or not yet started.
14. As a pricing user, I want **Valid today** and **Status** to combine (e.g. Planned + valid today), so that I can find authored offers whose dates are already running but which nobody has activated.
15. As a pricing user, I want a BBY-number search to find the bonus buy whatever its status and dates, so that a keyed lookup always answers "what is this number?".
16. As a pricing user, I want the Status and Valid-today controls to read as overridden (disabled) while a BBY number is entered, so that I am not misled into thinking they still narrow the result.
17. As a pricing user, I want a date range to replace **Valid today** with "valid during this range" while keeping my Status choice, so that "Planned bonus buys valid next week" works.
18. As a pricing user, I want the Valid-today checkbox to read as overridden (disabled) while either date is filled, so that the screen says honestly which date rule applies.
19. As a pricing user, I want the "Filtered" chip to appear whenever my search differs from the default (Activated + valid today), so that I always know I am not looking at the live view.
20. As a pricing user, I want **Reset** (and dismissing the chip) to return me to Activated + valid today, so that I can get back to the live view in one click.
21. As a pricing user, I want the "refine your search" cap banner to stay correct with the status filter on, so that a status search over many bonus buys still tells me when results were cut off.
22. As a pricing user, I want the grid's own Status column filter to list the readable labels, so that I filter by "Planned", not by `1`.
23. As a pricing user, I want the "valid today" marker in the pinned cell to keep meaning Activated **and** valid today, so that the marker and the default view agree.
24. As an Arabic-locale user, I want the status labels and the new controls translated and mirrored, so that the screen works the same under RTL.

## Implementation Decisions

**Status reading graduates to core.** Bonus Buy Maintenance's pure status reading (code → one of
`activated | planned | tested | deactivated | unknown`, and status → severity) moves from the
maintenance feature up to the shared bonus-buy core, since a second feature now needs it (the
"features never import features" rule). Maintenance then imports it from core. The rules stay as
Maintenance has them:

- blank means a **present** empty or space-padded string → Activated;
- `1` → Planned, `2` → Deactivated, `3` → Tested;
- `null`/missing or any other code → Unknown.

Severities stay too: Activated `ok`, Planned `warn`, Tested `go`, Deactivated and Unknown neutral.

**The inquiry's status badge reads through it.** The core bonus-buy status badge (used by the grid's
Status column, the pinned identity cell and the Details modal) takes the status reading instead of
the retired `A`/`I`/`D`/`X` severity map. It always renders, including for blank, which is
Activated. The inquiry's `status` code labels (`A/I/D/X`) are deleted, and the labels are keyed by
reading (Activated / Planned / Tested / Deactivated / Unknown). Unknown shows the raw code beside its
label (a machine value, isolated with `Ltr`). Whichever namespace Maintenance's status labels live in
is reused rather than duplicated, if the core modal can reach it; otherwise the keys move to a shared
namespace.

**The model comment is corrected.** The inquiry row's `bbyStatus` describes SAP's codes, and its
`isActive` describes the blank-status gate (BackOffice 2384).

**Search criteria change shape.** The toolbar criteria become:

```ts
interface BbyListCriteria {
  bbyNumber: string
  validFrom: string   // yyyyMMdd or ''
  validTo: string     // yyyyMMdd or ''
  statuses: BbyStatusWord[]   // [] = every status; default ['activated']
  validToday: boolean         // default true
}
type BbyStatusWord = 'activated' | 'planned' | 'tested' | 'deactivated'
```

The pure params builder keeps owning the override rules:

- **number present** → send `bbyNumber` (plus `activeOnly=false`, and any dates given, which still AND as before). Status and valid-today are not sent (amended 2026-10-08 by ticket 443: the grilling's decision 3 dropped only status and valid today).
- **either date present** → send `validFrom`/`validTo` and `status`. Valid-today is not sent.
- **otherwise** → send `status` (when non-empty) and `validToday`.
- `activeOnly` is always sent as `false` by the new screen. The server keeps the param for older callers.
- `status` is a list of **words**, not codes: a blank code cannot be sent, because the query
  builder drops empty strings. It travels as a **repeated key** (`status=planned&status=tested`), the
  way `@/core/api`'s query builder sends every array, which ASP.NET binds as a collection
  (amended 2026-10-08 by ticket 443; the grilling had said a comma list).

**Server contract (BackOffice ask, BO-1, filed 2026-10-09 as BackOffice 2506).** `GET Bby/List` gains:

- `status` — repeated, each one of `activated|planned|tested|deactivated` (any case; bind as `string[]`). The server maps the
  words to codes (`activated` → blank, matching blank-or-whitespace as SAP pads). Blank/absent means
  all statuses. An unknown word returns 400 with the envelope code `INVALID_STATUS`, like 2384's
  `INVALID_SOURCE`.
- `validToday` — boolean, default `false`. When true it applies `ValidFrom ≤ @today ≤ ValidTo` with
  the same server-local `@today` as `isActive`.

`activeOnly` keeps today's meaning (blank status + valid today) and its default `true`, so the
WPF and any other caller are unaffected. `isActive` on each row is unchanged. The 1,000-row cap and
`capReached` apply after all filters.

**UI handling of the new code.** A 400 `INVALID_STATUS` is a client bug, not user input. It surfaces
through `apiErrorMessage` like the existing date-bounds error; no special branch.

**Toolbar.** The Status multi-select sits between the number field and the date range, as compact
toggle chips (four, each with its label) rather than a dropdown, so the selection is visible at a
glance. "Valid today" replaces the "Active only" checkbox in place, with the same overridden/disabled
treatment and a tooltip naming why. The "Filtered" chip compares the applied criteria with the
default (`statuses = ['activated']`, `validToday = true`, no number, no dates).

**Grid Status column filter.** It filters on the reading's label, not the raw code.

**CSV export stays raw.** Export keeps raw values by this screen's standing rule (dates `yyyyMMdd`,
codes as stored), so an Activated row exports a blank status cell. Changing that is out of scope.

**i18n.** New keys in the `bonus-buy-inquiry` namespace for the Status control, the four chip labels
(or reused status labels), "Valid today" + its hint + overridden tooltip. The old `search.activeOnly*`
keys are removed. `en` and `ar` both get them (`ar` per the existing locale).

## Testing Decisions

- A good test pins **external behaviour**: what a code reads as, what query a set of criteria sends.
  It does not test how the badge is built.
- **Pure, vitest (node):**
  - The core status reading: every code (blank, space-padded, `1`/`2`/`3`, `null`, unknown) → reading
    and severity. Maintenance's existing overview tests keep passing against the moved module, which
    proves the move changed nothing.
  - The inquiry params builder (the existing seam): default criteria; several statuses; empty
    statuses; valid-today off; number overrides both; dates replace valid-today and keep status;
    `activeOnly` always false.
  - The "is filtered" comparison, if it is pulled out as a pure function next to the builder.
- **Drive (Playwright, manual-run):** extend `tools/bby-inquiry-drive.mjs` with stubbed `Bby/List`
  envelopes carrying blank/`1`/`2`/`3`/unknown codes:
  - every reading badges and labels correctly in the grid, pinned cell and Details modal;
  - the toolbar sends the right query for each override case;
  - the chip and Reset behave;
  - under `ar`, the controls mirror.

  The drive's existing raw-CSV check moves from `A` to a blank cell. The Simulation-side modal is
  covered by the shared badge; `tools/sim-bby-gate-drive.mjs` is re-run as a regression.
- No RTL test (spec 083's ruling stands): the components are thin renderers over the two pure seams.
- **BackOffice (BO-1)**, in that repo's Data.Tests (`BbyInquiry`): status words → codes, including
  blank and padded blank; `validToday` alone; `status` + `validToday`; `INVALID_STATUS`; `activeOnly`
  unchanged.
- Live proof waits on BO-1 shipping and a reachable SIS.Api; until then every drive is **stubbed**.

## Out of Scope

- The **Source** (SAP / OMS) filter. `Bby/List` already takes `source=` (BackOffice 2384); adding it
  to the toolbar is a separate follow-up.
- Showing the OMS **promotion name** the server now returns.
- Readable status in the CSV export.
- Any change to who can change a status. The inquiry stays read-only; Maintenance owns transitions.
- The engine's heavier "will it fire now" (condition-level dates, approval, time window, loyalty).

## Further Notes

- Ticket shape: (1) the shared status reading + badge/labels, with no server change; it ships first
  and fixes the wrong badges on its own. (2) The toolbar split + params, blocked by BO-1, built on
  stubs meanwhile.
- When ticket (1) lands, remove the ⚠️ note under **BBY status** in `CONTEXT.md` that says the inquiry
  still badges the old codes.
- BO-1 is filed as **BackOffice 2506** (2026-10-09), a ticket following 2384; the live walk of ticket (2) waits on it.
