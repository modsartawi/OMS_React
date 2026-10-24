---
status: done
spec: C:\Work\DMSCO\BackOffice-2994\.issues\2994-prescription-session-spec.md
blocked-by: 544 (live: BackOffice 3015 on branch spec2994)
---

# 545 — HQ lists open prescription sessions across stores, filters them, and opens the owed list

## What to build

The HQ prescription-session screen's first tab (BackOffice spec 2994 "The HQ list", stories 68–73; hand-off in
`C:\Work\DMSCO\BackOffice-2994\.issues\3015-the-hq-list-and-close-without-invoice.md` `## Comments` — "What was built",
"Judgement calls", "Deferred / hand-off"). Endpoints:
`C:\Work\DMSCO\BackOffice-2994\Services\SIS.Api\Endpoints\PrescriptionSessions\PrescriptionSessionWebEndpoints.cs`;
models `...\Modules\PrescriptionSessions\Models\PrescriptionSessionHqModels.cs`; codes
`...\Constants\PrescriptionSessionHqConstants.cs`.

- **New feature** `features/oms/prescription-sessions` at `/oms/prescription-sessions`, scaffolded with `/new-feature`
  (route, menu leaf in the OMS group, namespace `prescription-sessions` EN + AR registered in `core/i18n.ts`). One page
  with tabs **Open** (this ticket), **To open** (546) and **Ended** (547); the tab lives in the URL.
- **Model** in `core/models/prescription-session.ts` (544's file) — `PrescriptionSessionHqList { rows[], total, stalled,
  aboutToLapse, owed, isTruncated }` and the row: `sessionId, displayId, sourceKind, sourceKey, beneficiaryId,
  beneficiaryName, holdingStore, otherStore, otherStoreReason (DONOR|TRANSFER|null), state, route, orderNo, step,
  createdAt, ageDays, idleSince, idleDays, isStalled, isAboutToLapse, isOwed, lapsesAtEndOf, dispensedAt,
  invoiceOwedAt, openItems[], hasOpenItem`. `step` is 544's `PrescriptionSessionStep`.
- **Doors** `GET PrescriptionSessionWeb/Sessions?store&state&owner&source&minAgeDays&maxAgeDays&flag` and
  `GET PrescriptionSessionWeb/Sessions/Owed?store` (the saved "owed" filter: DISPENSED, not invoiced). Both
  `BackOfficeScreen[PrescriptionSessionHq, 03]`, cookie.
- **Grid** (spreads `OMS_GRID_BASE_COL_DEF`): display id, source + source key, beneficiary, holding store and the other
  store with its reason (donor / transfer), state, route, order no, the step label + owner (+ parked), age, idle days,
  lapses at end of, dispensed at, invoice owed at, open items. Rows come oldest idle first; keep the server's order as
  the default sort.
- **Filters in the URL:** store (matches the holding store OR the other store — say so in the field's hint), state,
  owner, source, age from / to. Three **flag chips** — Stalled, About to lapse, Owed — each with its count from the
  answer; a chip sets `flag`. An **Owed** saved view calls `Sessions/Owed` (store filter only).
- `isTruncated` → a notice that only the oldest-idle 2,000 of `total` are shown (counts are never truncated).
- **Refusals:** a bare 403 (`isBareDenial`) → a named "you don't hold the prescription-session list grant" page (no
  probe route exists); `PSES-00223` (bad filter) → the envelope message beside the filters.
- Codes (state, owner, route, source, other-store reason, open item kind, flags) read through 544's core words; add
  the HQ-only ones (other-store reason, open item kinds, flags) there too or in this namespace as fits.

## Spine reach

model · api · logic (filter ↔ query, flag chips, row view) · route + page + grid · menu · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [x] filter ↔ URL ↔ query: every filter round-trips; empty values drop; a flag chip sets `flag`; the Owed view
      sends only `store` to `Sessions/Owed` (vitest, pure)
- [x] row view: other store + reason, parked step, lapse day only when about to lapse, open items; flag counts read
      from the answer, not counted from the rows (vitest, pure)
- [x] drive script, LTR and RTL, against a stub: the list, each chip, the Owed view, a truncated answer, a bare 403,
      a `PSES-00223` refusal
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- New namespace `prescription-sessions`; new route + menu leaf, **no access probe** (none was built — the leaf shows
  to everyone and the page names the bare 403, as the campaign upload leaves do).
- Doors: BackOffice 3015 on `spec2994`, not merged / deployed — stubbed until 549. Seed
  `Modules/Authorizations/Sql/Seed-PrescriptionSessionHq-Authorization.sql` on OMS-HQ; nobody is bound yet.
- Read only here; the write-off is 548.
- Times local wall-clock, shown as is. Bidi per rule (beneficiary name `<bdi>`, ids / stores / numbers `Ltr`).

## Done when

The Proof boxes are ticked: on the running app (stubbed), HQ opens `/oms/prescription-sessions`, filters the open
sessions, uses the three flag chips and the Owed view, and a session without the grant sees the named denial.

## Blocked by

- [544](544-an-order-s-or-delivery-s-detail-shows-its-prescription-sessions-read-only.md) (core model + code words)

## Open questions

- Area: placed under `oms` (`/oms/prescription-sessions`), not a new area — the brief said "new HQ area", but the rule
  mints an area folder only with a new nav group / URL prefix. Overrulable.

## Comments

**2026-10-24 — built (stubbed; live walk is 549).** Area `oms` as settled for the build.

What was built:
- Scaffolded with `/new-feature`: `src/features/oms/prescription-sessions/` at `/oms/prescription-sessions`, route in
  `app/router.tsx`, an ungated `Pill` leaf in the OMS group (`layout/menu-model.ts`, before Dispatch board), namespace
  `prescription-sessions` EN + AR registered in `core/i18n.ts`.
- Model: `PrescriptionSessionHqRow` + `PrescriptionSessionHqList` appended to `core/models/prescription-session.ts`
  (`step` is 544's `PrescriptionSessionStep`).
- Core words (544's `core/prescription-session/words.ts` + `prescription-session` EN/AR): `otherStoreReasonWord`,
  `openItemWord`, `flagWord` and their closed lists (`PRESCRIPTION_OTHER_STORE_REASONS`, `PRESCRIPTION_OPEN_ITEMS`,
  `PRESCRIPTION_HQ_FLAGS` + `PrescriptionHqFlag`) — in core because 547/548 say them too.
- `tab.ts` — the tab in the URL (`tab=toOpen|ended`; Open is the default and writes no key).
- `open-filter.ts` — `OpenFilter` ↔ URL (`view=owed`, `store`, `state`, `owner`, `source`, `minAge`, `maxAge`, `flag`)
  ↔ `openRequest` (`Sessions` with `minAgeDays`/`maxAgeDays`, or `Sessions/Owed` with `store` only); `withFlag`.
- `open-row.ts` — `openRow` (state/source/route words, other store + reason, 544's `stepLine`, lapse day only while
  about to lapse, open items, the row's flags, `rowAction` on DISPENSED) and `flagChips` (counts from the answer).
- `api.ts` (`prescriptionSessionsApi.open`), `columns.tsx`, `OpenTab.tsx`, `Denied.tsx`, `PrescriptionSessionsPage.tsx`.

Judgement calls (overrulable):
- The filter bar is a draft promoted by Search (a half-typed store never fires a call); chips and the All/Owed switch
  write the address at once. Back / a pasted link resets the draft (`useUrlQuery.changedFromOutside`).
- Unknown codes or non-integer ages in a pasted address read as "no filter", so they never reach the door; a REVERSED
  age range is not checked client-side — the server's `PSES-00223` message is shown beside the filters instead.
- The state filter offers the open states only (DRAFT…DISPENSED); ended states are 547's tab.
- In the Owed view the other filters are hidden and the chips stay visible as counts but are disabled (that door takes
  no `flag`). Switching to Owed keeps the store; switching back keeps it too.
- Switching tabs starts the new tab from `tab=…` alone: one tab's filters never leak into another's address.
- The bare 403 replaces the whole tab's content with the named denial (no grid, no filters); other failures keep the
  usual `ErrorBanner`.
- Other store is one column: the store (`Ltr`) + its reason badge; it sorts by store. No default sort: server order
  (oldest idle first) stands until a header is pressed. `idleSince` / `createdAt` are not columns (age and idle days are).
- The status bar counts `total` (the answer's matched count), not the rows drawn; the truncation notice says
  "oldest-idle N of TOTAL" with N = the rows returned.

Proof:
- vitest: `open-filter.test.ts` 13, `tab.test.ts` 3, `open-row.test.ts` 13, `core/prescription-session/hq-words.test.ts`
  9 = 38 new; full suite 5947/5947.
- Drive `tools/prescription-sessions-hq-drive.mjs` (`npx vite --port 5204 --strictPort`, then `DRIVE_PORT=5204 node
  tools/prescription-sessions-hq-drive.mjs`): **112/112** (LTR + RTL) — the leaf, the tabs, the list, each chip set +
  cleared, the filters round-trip (bar → address → wire, pasted address → bar + wire), Reset, the Owed view, a
  truncated answer, a bare 403, `PSES-00223`, the To open / Ended placeholders. Stubbed doors.
- `npm run typecheck`, `npm run lint` (4 gates) green.

Seams left for parallel tickets (each touches its own file; the page needs no edit):
- **546** — `ToOpenTab.tsx` (replace the placeholder body; own the `toOpen.*` keys in `prescription-sessions` EN/AR);
  add `toOpen()` to `prescriptionSessionsApi` in `api.ts`; its URL params must keep `tab=toOpen` (`tabParams` in `tab.ts`).
  Reuse `Denied.tsx` for the bare 403.
- **547** — `EndedTab.tsx` likewise (`ended.*` keys, `tab=ended`), `ended()` in `api.ts`; add the ended row model beside
  545's in `core/models/prescription-session.ts`; after-close lines via 544's `AfterCloseText`.
- **548** — `OpenRowAction.tsx`: the slot rendered in the Open grid's hidden `actions` column for rows with
  `view.rowAction` (DISPENSED). Build the write-off there, flip `OPEN_ROW_ACTION_ENABLED`, add `writeOff()` to `api.ts`
  and invalidate `['prescription-sessions', 'open']` after it.

### Review fixes (2026-10-24, branch `impl/review-fixes`)

- **Owed → All open** (`withView` in `open-filter.ts`, tested): the bar's draft follows the filter the view applies, so
  the State/Owner/Source/Age the Owed view dropped no longer sit hidden in the bar to come back on the next Search.
- **Search** asks once: a changed filter is a new query key (fetches by itself); only an unchanged one `refetch()`es.
  Same fix in `ToOpenTab` (546) and `EndedTab` (547).
- **Owed view chips** show no count (they are disabled there).
- **`OPEN_ROW_ACTION_ENABLED`** and its `hide` removed from `columns.tsx`; `api.ts`'s model imports merged.
- **State options vs. the doors (finding 5)** — read in BackOffice-2994 `PrescriptionSessionService.Hq.cs`:
  `ListHqAsync` accepts exactly `HqOpenStates` = Draft…Dispensed (8 states) and refuses any other with
  `PSES-00223` ("not an open state; ended sessions are read by date range"); `ListHqEndedAsync` accepts exactly
  `PrescriptionSessionStates.Final` = Closed, Abandoned, WrittenOff, else `PSES-00223` ("not an end state").
  **INVOICED is in neither by design** — the code comment says an Invoiced session closes in the same act, so no list
  holds one. The client already offered exactly those lists (it was not a bug); `OPEN_STATES` / `ENDED_STATES` are now
  explicit literals mirroring the server arrays (not slices of the word list), and both tests pin that INVOICED is
  excluded and reads as no filter from a URL.
- Proof: vitest green; drives re-run on :5221 — hq 122/122 (new: one request per Search, Owed→All bar reset, no
  Owed chip counts), base 52/52.
