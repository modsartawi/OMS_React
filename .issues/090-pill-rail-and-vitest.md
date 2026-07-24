---
status: done
spec: 083
blocked-by: —
---

# 090 — theRailRendersOnlyTheStatusesThatCarryAValue

## What to build

The document's state stops being thirteen rows of grey text on a tab and becomes a **pill rail**
under the header: `Last action` first as a neutral outline that never takes a severity colour, then
one pill for **every described status that carries a value** — blank and `null` produce **no pill at
all**, not a muted one and not an em dash. Colour comes from a per-status severity map; the label is
always the server's `*Description`. When a description is blank or merely echoes its code, the raw
code renders in **monospace**. The thirteen-row breakdown keeps its home in an **All statuses**
disclosure at the end of the rail, and the **Status tab is removed**. Refresh moves to the very end
of the rail — quiet outlined button, spinner in place, silent on success, toast on failure only
(unchanged behaviour, new location).

This slice is also where the **test runner arrives** (see Boundaries). It is Slice 0 because it
retires the spec's biggest unknown in one cut: that rules derived from five captured payloads hold
against those payloads, with the corpus wired up as real typed fixtures rather than hand-written
objects.

Candidate set — the eight statuses carrying a `*Description` companion, in lifecycle order:
`readyStatus` → `availabilityStatus` → `approvalStatus` → `paymentStatus` → `deliveryStatus` →
`clearStatus` → `acceptanceStatus` → `closeStatus`. `closeStatus` renders under the label
**Cancellation**. `consignmentStatus`, `controlStatus` and `notificationStatus` stay off the rail and
keep their disclosure rows.

The severity map is keyed **`(status, code)`** — `'R'` is "Ready" on `readyStatus` and "Close
Requested" on `closeStatus` **on the same document** (`8000000174`), so a single shared code table
cannot be written without lying on a payload we already hold. It holds only codes observed on live
data:

| Status | Code | Severity |
|---|---|---|
| `readyStatus` | `R` | `ok` |
| `approvalStatus` | `A` | `ok` |
| `deliveryStatus` | `D` | `ok` |
| `closeStatus` | `R` | **`warn`** |

Four rows is the deliverable, not a shortfall — `go` and `bad` are defined and deliberately unused
here. Unmapped code ⇒ `mute` (the UI's ignorance is not the document's problem; amber would cry wolf
on every new server code). The severity → class mapping is **not** re-declared: it comes from 082's
`core/ui/severity.ts`, and pills render through `StatusBadge` where the shape fits.

The file header of `status-severity.ts` carries, verbatim, the paragraph that answers a future reader
reaching for the delete key on it (spec D-4): the map supplies a **colour, never a word**; a missing
entry costs a colour and nothing else; the 406 maps died because a missing entry rendered a raw code
to the operator and because the server already resolved what they resolved. Severity is on no
payload field and cannot be resolved server-side.

Expected rails on the corpus — this table is the fixture assertion:

| Document | Rail |
|---|---|
| `8000000253` | `Last action Delivered` · **Ready** · **Delivery: Delivered** |
| `8000000174` | `Last action Close Requested` · **Ready** · **Cancellation: Close Requested** |
| `2000000551` | `Last action Prescription Ready` · **Ready** · **Approval: Approved** |
| `8000000121` | `Last action Rescheduled` |
| `9000000003` | `` Last action `TRDY` `` (monospace) |

## Spine reach

payload fixtures · pure logic (`status-severity.ts`, `rail.ts`) · component (pill rail + disclosure,
composed by `DocumentDetailsPage`) · i18n · **test (vitest bootstrap)**

## Proof (→ `tdd` red-green cycles)

- [x] `railComposition` — each of the five payloads produces the rail in the table above; pill counts
      are 2·0·2·2·0 beside the anchor, and `lastAction` is present on all five · pure (vitest)
      → `src/features/oms/document/rail.test.ts`
- [x] `perStatusSeverity` — `'R'` resolves `ok` on `readyStatus` and `warn` on `closeStatus` from the
      same `8000000174` payload; an unobserved code resolves `mute` · pure (vitest)
      → `src/features/oms/document/status-severity.test.ts`
- [x] `descriptionEcho` — `9000000003`'s `lastAction` marks as a code (monospace) because its
      description echoes `TRDY`; a real description does not · pure (vitest)
      → `src/features/oms/document/status-severity.test.ts`

Verify the rendered rail by driving `npm run dev` on the five documents plus `npm run typecheck`.

**How it was verified.** `npm test` 17/17 · `npm run typecheck`, `npm run lint` (all three gates) and
`npm run build` green. The rendered rail was driven in the real app by `tools/document-rail-drive.mjs`
— **25/25**, replaying the five captured payloads verbatim onto `SdDocument/Document/{no}` (SIS.Api is
up on :5111 but wants an operator login the tool has no credentials for; the data is the live capture
either way). It asserts each document's rail text against D-3's table, the anchor's neutral outline,
`Ready` `ok` vs `Cancellation` `warn` on the same `R`, `TRDY` in monospace, the absent Status tab, the
thirteen-row disclosure, and Refresh last-in-rail with no success toast. Both themes screenshotted.

## Notes from the build

- **Label collapse.** D-3's table reads `Ready` bare but `Delivery: Delivered`, so `rail.ts` drops the
  label when the description restates it (case-insensitive). That rule is read off the table, not
  written anywhere in 083/079 — worth a spec line if a future status ever resolves to its own label.
- **`tools/document-rail-drive.mjs`** follows this repo's per-ticket drive precedent
  (`grid-theme-drive`, `status-badge-drive`, `bby-inquiry-drive`). **096 should fold it into
  `tools/document-detail-drive.mjs`** rather than ship both.
- **The header's Status summary group went early.** It shared the retired `groups.status` key and its
  four rows are now the rail plus the disclosure, so `statusSummaryRows` and the group are gone here
  rather than in 091; `DocumentHeader.tsx` still owns the Document and Customer groups for 091/092.
- `fields.closeStatus` was relabelled **"Cancellation Status"** so the disclosure row matches D-13's
  rename instead of contradicting the pill beside it.
- `CLAUDE.md`'s "tests are not installed yet" paragraph is replaced by the real posture: `npm test`
  (vitest, pure only), still no RTL, Playwright drives as manual tools.

## Boundaries

**This slice bootstraps vitest** — installs the runner, adds the `test` script, and imports
`.issues/assets/078-document-payloads/*.json` typed as `SdDocumentHeaderModel` as the fixture corpus.
**No React Testing Library** (spec Testing Decisions): the pure modules are where regression is
silent; the components are thin renderers verified by driving the app.

i18n (`document` namespace): new `Last action`, `All statuses`, and the per-status pill labels;
`closeStatus` renamed to **"Cancellation"**. Retires `groups.status` and the Status tab label. The
severity map and `StatusBadge` add **no** `t()` call — labels are children and keys.

New file `features/oms/document/status-severity.ts` — **feature-local, not
`core/constants/oms-codes.ts`**: one screen consumes it, and keeping it out of that file also keeps
it away from that file's standing deletion warning. No endpoint, `actionType` or request-body change.

## Done when

`npm test` runs and the three named tests are green, the Status tab is gone, and each of the five
captured documents renders exactly the rail in the table above in the running app — with Refresh at
the rail's end and the full thirteen rows reachable from the **All statuses** disclosure.

## Blocked by

None — can start immediately. Spec 083's precondition (the 082 design-system build, tickets
[084](084-pos-tokens-both-themes.md)–[089](089-colour-literal-lint-gates.md)) is complete: the
tokens, `core/ui/severity.ts` and `StatusBadge` are all in.
