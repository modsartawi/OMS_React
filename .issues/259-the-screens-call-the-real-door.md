---
status: open
spec: 249
blocked-by: 257, 258
---

# 259 — The screens call the real door

## What to build

**The wave-joining event.** Every fixture is swapped for a real call through `@/core/api` to the
`CollectionWeb` door, and the two waves meet for the first time.

⚠ **This is a verification, not a checkbox**, and it is why the ticket exists separately.
[245 §8](245-the-shape-of-a-print-ready-document.md) names it: the fixtures prove **rendering** and can
prove nothing else. They cannot prove the door exists, the grant filter admits the right session, the
cookie marker is present, or that `ar-SA` resolves on net8.0 under IIS rather than degrading to a
silent English `Thursday` on an Arabic form.

**What changes:** seven mocked calls become real ones —
`CollectionWeb/{Access,Collections,Receipt/{id},Acrs,AcrForm/{acrId},Deposits,Attempts}`. Nothing about
the screens or the documents changes shape; the fixtures stay in the repo as test data.

**Refusals, per [245 §7](245-the-shape-of-a-print-ready-document.md) and the `api-envelope` rule:**

| Code | Meaning | UI |
|---|---|---|
| `AcrNotFound` | unknown `acrId` — **reused**, no second code for the same fact | the print route's "this document no longer exists" state |
| `CollectionReceiptNotFound` | **new** — unknown id *or* zero rows (indistinguishable on a lookup over the inquiry) | same |

⚠ **Never a blank A4 sheet** — a blank sheet prints as convincingly as a real one, so a miss must be
unmistakably a miss. Branch on `apiErrorCode`, display with `apiErrorMessage`; never flatten an
`ApiError` into a bare `.message`.

⚠ **Empty is not a miss.** An ACR with no linked collections is a **200 with one page and `rows: []`**
— `Paginate`'s own behaviour. Only an unknown id refuses. Getting this backwards would turn an idle
ACR into an error screen.

**Three things to verify against live data that no fixture could catch:**

1. **Live data is not ordered or complete like the fixture.** `pages` is never empty but `rows` may
   be; `closedAtText`, `notes`, `pharmacistName` and `pharmacistId` are all legitimately `''`.
2. **Page order is the server's** — `OpenedAt` ascending, which decides which shift is `-1` on a
   multi-shift receipt. Confirm a real multi-shift receipt stamps `-1`/`-2` in shift order.
3. **The two culture-formatted strings actually arrived formatted** — `shiftDayName` as an Arabic
   weekday and `hijriText` as an Umm al-Qura date. ⚠ If globalization degraded, the failure is **not a
   crash**: it is `Thursday` quietly appearing on an Arabic form. Look at them.

**And the standing boundary, worth re-reading before this ticket rather than after:** if a string
needed on screen is not on the wire, **the answer is a server change, not a client one**. No
`toFixed`, no `Intl.NumberFormat`, no date formatting, no tafqeet, no page chunking, no deriving the
match mark. The temptation is highest here, when live data reveals a gap and the fixture had papered
over it.

## Spine reach

api · logic (error branching) · component (miss state) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] All four screens load and both documents render **against a live SIS.Api**, with the access
      probe driving the menu · manual, recorded below. ⚠ **Amended:** the two drives were NOT
      repointed at live, and the amendment is a ruling rather than a shortcut — see *As built*.
      They now serve the fixtures **as envelopes over the intercepted route**, so every assertion
      runs *through* the api layer, the query and the outcome branch instead of past them
      · flow (Playwright) *(220/220 + 92/92)*
- [x] A **hand-typed unknown** `acrId` and `collectionReceiptId` each render the "no longer exists"
      state — ⚠ the sheet is **not blank** · flow (Playwright) **and** live, both routes
- [x] An ACR with **no linked collections** renders one page with no rows and totals `0.00` — a
      success, not a refusal · flow (Playwright), asserted as *no `[role=alert]` anywhere*.
      ⚠ **Not reproducible live**: the estate holds one ACR and it has a collection. The wire-level
      proof is what exists, and it is named here rather than implied
- [ ] A **real multi-shift receipt** prints its pages stamped `-1`/`-2` in `OpenedAt` order · manual.
      🚩 **OUTSTANDING, and blocked on DATA, not on code** — the live estate holds two receipts and
      both cover one shift (`0000000001`, `0000000002`, neither suffixed). This is the one line of
      *Done when* that does not hold; the ticket stays open for it
- [x] `shiftDayName` and `hijriText` render **Arabic**, not `Thursday` and not a Gregorian date ·
      manual, recorded below — and both confirmed on live data

## Boundaries

- **Depends on the entire backend wave** —
  [1089](file:///C:/Work/DMSCO/BackOffice/.issues/1089-a-collection-receipt-has-an-identity-on-the-wire.md),
  [1090](file:///C:/Work/DMSCO/BackOffice/.issues/1090-a-browser-reaches-the-four-collection-inquiries.md),
  [1091](file:///C:/Work/DMSCO/BackOffice/.issues/1091-the-receipt-door-stamps-a-multi-shift-receipt-as-a-set.md),
  [1092](file:///C:/Work/DMSCO/BackOffice/.issues/1092-the-acr-builder-speaks-the-signed-off-form.md),
  [1093](file:///C:/Work/DMSCO/BackOffice/.issues/1093-the-acr-door-hands-over-pages.md). It cannot
  start until they are deployed somewhere reachable.
- Needs a **live SIS.Api** and a session holding the four grants. ⚠ Until 1090 lands, every route
  answers a browser **403** — a deliberate 403 rather than a 401, so a missed cookie marker breaks one
  screen instead of logging the whole tab out. A 403 here means the marker is missing, not that the
  grant is.
- New envelope code to handle: `CollectionReceiptNotFound`. `AcrNotFound` already exists server-side.
- The fixtures **stay** in the repo as test data — they are test-pinned transcriptions of the fidelity
  inventory and remain the drives' input.

## Done when

All four screens and both documents run against the real door with the real grants; misses show the
refusal state and never a blank sheet; an empty ACR is a success; a real multi-shift receipt stamps in
shift order; both culture-formatted strings arrive in Arabic; the drives are green against live.

## Blocked by

- [257](257-a-row-opens-its-document.md) — the whole client surface must exist before it is joined.
- [258](258-the-export-writes-a-summable-file.md) — likewise.
- The backend wave, in `C:\Work\DMSCO\BackOffice\.issues\` (1089–1093).

## As built

**The wave joined on 2026-08-08**, against SIS.Api on `:5111` with the frontend's `/api` proxy and a
real cookie session — the open question below, answered by the user running both halves locally.

`print-outcome.ts` · `print-outcome.test.ts` (16 pure) · `collectionApi.receipt`/`.acrForm` ·
`PrintPending` + `PrintFailure` beside `PrintMiss`. The two document contracts **graduated to
`@/core/models/collection`**: they became wire types here, and `api-envelope` puts wire models there.
The fixtures kept their scenarios and lost their `find*Fixture` lookups.

**🚩 The decision worth arguing with: `miss` and `failure` are different states.** The ticket asked
for a refusal state and the fixture era had exactly one — "this document no longer exists". That
sentence is a claim about the DOCUMENT. Saying it because SIS.Api was restarting tells an accountant
their receipt was reversed and sends them looking for a reversal that never happened. So the branch is
on the **envelope code and nothing else**: each route owns exactly one (`CollectionReceiptNotFound` /
`AcrNotFound`), and the drive asserts the ACR route refuses to read the *receipt's* code as its own
stale link. Everything else — a 403 from a missing cookie marker, a 500, an unreachable host — draws
`PrintFailure`, which says the fetch failed and that **nothing is known about whether it exists**.

**⚠ The drives were NOT repointed at live, deliberately.** The Proof line asked for it; running them
that way would have deleted most of their value. Their assertions are about FIDELITY — that `-412.50`
paints with the minus on the left, that a 3-digit `005` minor cell is not clipped, that 47 rows break
22/22/3, that an empty pharmacist draws a fill-line and not a `0`. **The live estate contains none of
those cases**, so a live drive would assert them vacuously and go green while proving nothing. The
fixtures instead moved onto the wire, which is a strictly better drive than the one that existed, and
the live proof is the walk recorded below. Both fixture sets are loaded **from the app's own modules
through the dev server** rather than transcribed into the tools — a second copy of a 47-row ACR would
drift silently, since both copies would stay internally consistent.

**Hardened beyond the ticket, and found by a drive rather than by reasoning:** `printOutcome` reaches
`data.pages.length`, and a body without `pages` threw — the screens drive's catch-all empty envelope
produced exactly that, and a throw on a print route renders the router's error boundary. The type
could not help, because the type is a claim *about the server*. Now `Array.isArray`, and pinned.

### What live data showed that no fixture could

1. **`shiftDayName` and `hijriText` arrived Arabic — the check that fails silently, and it passed.**
   Receipt `…SPYMR1` stamps **الجمعة** for `2026-07-31` and `…QB5` stamps **الأحد** for `2026-08-02`;
   both are the correct weekday, and being *different* is what rules out a constant. The ACR stamps
   **الموافق: 19/02/1448** for `02/08/2026` — a real Umm al-Qura date, not the plausible-looking
   Gregorian one a degraded globalization stack would have printed. net8.0/IIS resolves `ar-SA`.
2. **A still-OPEN ACR really does carry `closedAtText: ''`** — تاريخ التحصيل prints blank on live data,
   with no invented dash. The fixture predicted it; the estate confirmed it.
3. 🚩 **الحالة prints `OPEN`, an English machine token, on an Arabic paper form — and that is
   CORRECT.** `AcrFormBuilder` does `Status = report.Acr.Status ?? ""`, the same property the WPF
   binds, so both sheets print `OPEN`. **The fixture is the thing that was wrong**: it says `مفتوح` /
   `مغلق`, prettier than anything the server has ever sent. Left unchanged rather than quietly
   corrected — it is a 247-signed-off artifact, and the drive asserts on it. ⚠ **[260](260-both-documents-print-on-real-paper.md)
   must not read this as a defect at the side-by-side**: the WPF original will say `OPEN` too.
4. 🚩 **THE FINDING OF THIS TICKET: every name on both documents prints as a bare id.** اسم المحصل,
   اسم الصيدلي and the ACR's اسم الصيدلي column all read `14419`. The client is faithful — the id is
   what arrives on the wire — and the standing boundary applies without argument: **a string missing
   on the wire is a server change, never a client one.** No `toFixed` of names.

   The cause is a **stale master**, and it was confirmed against the dev database rather than
   reasoned about. Every projection resolves through the OLD `Staff` table:

   ```sql
   COALESCE((SELECT TOP 1 st.Name1 FROM Staff st WHERE st.StaffID = <operatorId>), <operatorId>)
   ```

   `SELECT * FROM Staff WHERE StaffID = '14419'` returns **no row at all**, so the `COALESCE` falls to
   its second arm and the id echoes. The operators now live in **`UaEmployee`** — `EmployeeId` →
   `DisplayName`, **4161 rows, all 4161 named**, and `EmployeeId = '14419'` is `Mohamed Sartawi`,
   `IsActive = 1`. ⚠ It is in the **same `POS_Server` database** (`UaEmployee JOIN Staff` runs and
   matches 4157 of 4161), so this is a lookup swap, not a cross-database problem.

   **Six call sites, all in `Sartawi.Retail.Data` — a BackOffice change this repo may read and must
   not make:**

   | File | What it feeds |
   |---|---|
   | `Pos/Services/PosCollectionInquiryService.cs` — `CollectorName` | Cash Collections grid **and the receipt's اسم المحصل** |
   | `Pos/Services/PosCollectionInquiryService.cs` — `CloserName` | **the receipt's اسم الصيدلي block** |
   | `Pos/Services/Acr/AcrInquiryService.cs` — `CollectorName` (×2) | ACRs grid **and the ACR form header** |
   | `Pos/Services/Acr/AcrInquiryService.cs` — `CloserName` | **the ACR form's اسم الصيدلي column** |
   | `Pos/Services/Deposit/DepositInquiryService.cs` — `CollectorName` (×2) | Deposits grid + balances |
   | `Pos/Services/PosCollectionAttemptInquiryService.cs` — `CollectorName` | Collection Attempts grid |

   ⚠ **And it is three arms, not a swap** — the thing a find-and-replace would get wrong. **3030**
   `Staff` ids are absent from `UaEmployee`, and **2858 of them carry a real name there**, so dropping
   `Staff` would blank 2858 historical operators: one silent defect traded for a larger one, on
   *records*, where it would be least noticed. `UaEmployee` first, `Staff` second, the id last.

   Filed as **BackOffice 1095** — *A collector has a name again, on paper and in every grid* — drafted
   in full (eight exact call sites, the measured counts, the two rulings, six Proof lines) and handed
   over rather than written into that repo, which this one may read and must not edit.

   ⚠ **This reaches [260](260-both-documents-print-on-real-paper.md)**: the WPF original will print the
   SAME id on the same line, because it binds the same projection. It is a wave defect, not a web one,
   260 must not be failed for it — and printing before 1095 lands means printing twice.
5. **`Attempts` answered 200, not the refusal its day-one note predicts** — this session is ADMIN. The
   note stands for everyone else until an admin binds `CollectionAttempts` in Authz Admin.

### Still open

The **multi-shift receipt** stamp. It is the only unticked Proof line and the only clause of *Done
when* that does not hold. It needs a receipt covering two shifts to exist; ⚠ do not close this ticket
by reasoning about the code, because the ordering contract (`OpenedAt` ascending deciding which shift
is `-1`) is precisely the thing the fixture asserts and cannot prove.

## Open questions

- ~~**Where does the frontend point at a deployed SIS.Api carrying the new door?**~~ Answered: the
  backend wave running locally on `:5111` behind the dev proxy, with a browser cookie session holding
  the four grants. Recorded because the next person to run a live check needs the same two halves up.
