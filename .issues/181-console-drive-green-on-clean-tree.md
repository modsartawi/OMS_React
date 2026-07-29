---
status: done
spec: 180
blocked-by: —
---

# 181 — theConsoleDriveIsGreenOnACleanTree

## What to build

`tools/callcenter-drive.mjs` fails on a **clean tree** — verified by stashing, so it is not
somebody's uncommitted work. It stops at `[data-cc-search-add="200145"]`: the search row renders, its
*Add* does not, because `ItemSearchPanel` draws the button only when `add.onAdd` is passed and the
page passes it only while `canAddItem` holds. That is [175](175-nothing-enters-an-unaddressed-order.md)'s
opening gate meeting a drive written before it.

The drive is the acceptance surface every later ticket in this spec extends, so it goes green first.
**The gate is right and the drive is wrong** — the fix is in the drive's own setup (attach a caller
and choose a store before it expects to add), never a relaxation of `canAddItem`.

While in here, confirm the same predicate has not stranded any other assertion in the file: the gate
also makes the guidance strip's *Add* absent, and the drive was written before that too.

## Spine reach

test only (drive) — no model, no api, no component, no i18n

## Proof (→ `tdd` red-green cycles)

- [x] `callcenter-drive.mjs` — the whole file green from a cold start on a clean tree · flow (Playwright)
      — **461/461**, run against the committed fixtures (every `.issues/assets/136-cc-contract/*.json`
      restored to `HEAD` for the run, so no uncommitted recapture was in the picture) and again
      against the working tree's. No page errors either way.
- [x] `callcenter-guidance-drive.mjs` — re-run, confirming the sibling drive did not acquire the same
      staleness · flow (Playwright) — **107/107** on the committed fixtures. It has NOT acquired the
      `canAddItem` staleness: its cards never depended on the gate. See the finding below for the one
      failure it shows against the *uncommitted* fixture 03.

## What the drive was doing wrong

Three boxes put an item in the basket off the bare opening state — 31 (the Arabic search and its add),
32 (the below-availability acceptance) and 177/858 (the acceptance the server swallows). Fixture 01
opens with the gate SHUT (`canAddItem: false`, no caller, `plantSource: seededAtOpen`), so
`ItemSearchPanel` drew no *Add* and the drive sat on a locator that would never appear.

The repair is in the drive's own setup, in two halves:

1. **The stub now holds the rule** — `gated(state)` recomputes `canAddItem` / `canPriceCheck` /
   `canApplyCoupon` from `open && customer != null && plantSource != 'seededAtOpen'` wherever the stub
   moves the caller or the plant (attach, `SetAddress`/`SetStore`, remove), and drops `NO_CUSTOMER` /
   `STORE_NOT_CHOSEN` from `submitBlockers` with them. Fixture 01 and fixture 02 are the two ends of
   that rule; the stub's own intermediate states now agree with both instead of leaving the fixture's
   `false` standing over a settled order.
2. **The three boxes open the gate the way an agent does** — a new `openTheGate(page)` helper attaches
   the caller and picks the address that derives the store, off `openTheBook`'s own path. Box 31 takes
   its two opening-state claims (the search box stands, the caret is in the phone field) *before* the
   gate, as it must.

`canAddItem` was not touched, and neither was any production file.

## Two other assertions the same sweep found stranded

Both stale for the same reason — the drive predates the tickets that changed the header — and both now
assert what the current spec says rather than what it said:

- *"the store chip is settled"* (box 1–3) — 175 puts `STORE_NOT_CHOSEN` in the opening state's
  `submitBlockers`, so the seeded plant is **drawn but needing attention**. That is the point of the
  gate, and the drive was asserting its absence.
- *"the chip row is the four the header captures"* (box 23) — the row is seven now: 176 put
  `fulfilment` first and `payment` after the reference, 159 put `coupon` last. Re-stated as the
  **order** of the row rather than a count, which is the claim worth keeping.

## Findings (no production change was needed)

- 🚩 **The uncommitted recapture of fixture 03 costs the guidance strip its cards.** With the working
  tree's `03-near-miss-buy-side.json` (spec 180's recapture, `prereq.kind` `material` → **`coupon`**),
  `callcenter-guidance-drive.mjs` fails one box — *"two offers sharing one blank offerId still draw two
  cards"*, 0 of 2. On the committed fixture it is 107/107. The strip draws nothing for a coupon-kind
  prerequisite, which is a near-miss the agent genuinely cannot act on by adding an item — but *nothing
  at all* is not obviously the right answer either. That is [189](189-coupon-names-itself-and-comes-off.md)'s
  ground, not this ticket's, and it is recorded here rather than fixed.
- The repo was being edited by a concurrent session under `src/features/callcenter/console/` while this
  ran (ticket 187's address capture). The green runs above are drive-only changes; `npm run typecheck`
  and `npm run build` are green as of the final run.

## Boundaries

No server dependency. No new i18n keys. No production code change expected — if one turns out to be
needed, that is a finding worth recording rather than a silent fix.

## Done when

`node tools/callcenter-drive.mjs` reports every assertion passed, with no page errors, on a tree with
no uncommitted changes.

## Blocked by

None — can start immediately.
