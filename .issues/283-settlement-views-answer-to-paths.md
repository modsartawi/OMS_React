---
status: done
spec: 282
blocked-by: —
---

# 283 — The settlement views answer to paths, and yesterday's links still land

## What to build

The settlement screen's four views stop being query parameters and become **addresses**:

| view | path |
|---|---|
| Overview — the door: search, triage, scope | `/collection/settlement` |
| Open settlements (empty shell in this slice) | `/collection/settlement/open` |
| Ledger | `/collection/settlement/ledger` |
| Bulk upload, and a batch's withdrawal | `/collection/settlement/upload` |

`SettlementPage`'s four-way body becomes **routed children** rather than a chain of ternaries over
the search params. Each child keeps holding its own query, so a view that is not rendered still
issues no call.

**The dividing rule this slice implements** (spec 282 D3): a path segment names *which screen*; a
parameter names *what that screen is looking at*. So:

- `?scope=` still rides every link — `addresses.ts`'s `KEPT` list is unchanged;
- `?store=` and `?entry=` stay parameters on the **Overview** path (a branch account is where you
  *land* from a hit, a row or a phone call — not a nav destination), so every 269-era address keeps
  working untouched;
- `?batch=` stays a parameter, now on the upload path;
- the ledger's six criteria stay parameters, still owned by `ledger.ts`;
- **`VIEW_PARAM` is deleted**, and with it `readBatchView`'s both-halves-required rule, which only
  existed because `view=` was the discriminator.

**And every legacy address redirects, permanently.** At the Overview path, before anything renders:

```
?view=ledger          → /collection/settlement/ledger          (other params carried through)
?view=batch&batch=…   → /collection/settlement/upload?batch=…
```

`replace`, so Back does not bounce. No sunset: nothing is simplified by removing it later, and what
it protects is an accountant reading *page not found* off a link they pasted into an incident. Leave
it commented as a compatibility shim with its date and reason, so a later reader does not mistake it
for live grammar.

⚠️ The nav is **not** touched in this slice — `Settlement Account` stays one leaf pointing at the
Overview. The three new paths are reachable by address and by redirect only until
[284](284-settlement-account-expands-into-four-screens.md) lands.

## Spine reach

route (`app/router.tsx` — three child routes + the redirect) · logic (`addresses.ts`, `ledger.ts`'s
view predicate) · component (`SettlementPage` body → routed children) · test (pure)

## Proof (→ `tdd` red-green cycles)

- [x] `addresses: every link keeps the scope and drops what led here, now across paths` — the four
      builders return path+search, `?scope=` survives each, everything else is dropped · **pure**
      (`addresses.test.ts`, *the four screens are addresses*)
- [x] `addresses: every legacy view address redirects to its path` — table-driven over
      `?view=ledger`, `?view=ledger&store=&batch=`, `?view=batch&batch=`, and the hand-edited
      half-addresses (`?view=batch` with no batch, `?batch=` with no view) · **pure** — 13 rows,
      plus a case proving no redirect ever lands on an address that redirects again
- [x] Drive `tools/settlement-drive.mjs`: each of the four paths renders its own view, a legacy
      `?view=ledger` lands on `/ledger` with its criteria intact, and `?store=0142` still opens the
      branch account · **flow (Playwright)** — **199/199 PASS**; the new section also drives
      `/upload?batch=`, the truncated `?view=batch`, and Back-after-redirect not bouncing

**Also run:** `npm run typecheck` clean · `npm test` 1845/1845 · `npm run lint` (boundaries,
contrast, colour literals) clean · `npm run build` green.

**Two decisions taken unattended** (`.afk/HITL-283.md`): `/upload` with no batch draws 273's upload
dialog and the door's button navigates there rather than holding it in `useState` — the path had to
draw *something* before 284 points a leaf at it, and no new copy was allowed; and a truncated
`?view=batch` with no id stays on the door, exactly where it landed before, rather than handing a
half-pasted withdrawal link a form for posting a month of entries.

## Boundaries

No API change, no new endpoint. No new i18n keys (labels arrive with the menu in 284). Deletes an
exported constant (`VIEW_PARAM`) and changes `addresses.ts`'s return type from a search string to
path+search — every caller in the feature moves with it, in this ticket.

## Done when

The four paths each render their own view; `npm test` is green including the redirect table; and a
`?view=ledger` address pasted into the address bar lands on `/collection/settlement/ledger` with its
filters intact.

## Blocked by

None — can start immediately.
