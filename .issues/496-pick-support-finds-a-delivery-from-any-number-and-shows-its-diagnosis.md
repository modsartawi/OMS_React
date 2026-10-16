---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2691-oms-react-pick-support-brief.md
blocked-by: — (live: BackOffice 2687–2690, probe flags 2731)
---

# 496 — Pick support finds a delivery from any number and shows its diagnosis

## What to build

**Slice 0 of Pick support** (BackOffice spec 2685, ADR 0085, brief 2691). HQ support types any
number a store sent and reads what is wrong with the delivery, in the server's words. **The brief
is the contract; read it whole before starting.** Its "rules the page lives by" are decided, so
don't re-derive them: shapes are codes and every sentence comes from the server, one fix per shape,
the server re-checks, `UNKNOWN` means escalate, and times are local wall-clock with a floor stamp
shown as "—".

- **Model** `core/models/pick-support.ts`, field for field from the brief:
  - `PickSupportResolution` (with `deliveries[]` and `serials[]`);
  - `PickSupportCensus` (the type only; 498 uses it);
  - `PickSupportDiagnosis` (with `storeHistory`, `documents` as the existing pick document model if
    oms-react has one, `donorRequests`, `shapes`, `timeline` and `copy`);
  - `PickSupportFixRequest` and `PickSupportFixResult` (the types only; 497 uses them).

  The closed lists (shapes, verdicts, actions, key kinds, holds, timeline sources) are string unions
  plus `string`, so an unlisted value still parses; an unlisted verdict or hold renders as UNKNOWN.
- **Probe**: two **optional** flags on `OmsAccessResult`, `canOpenPickSupport` and
  `canFixPickSupport` (BackOffice 2731). Add them to `OMS_SCREEN_FLAGS`, plus the one predicates
  `canOpenPickSupport` and `canFixPickSupport` in `@/core/oms/access`. Absent means denied.
- **Shared panel in core.** Document Details (499) renders the same panel, and a feature can't
  import another feature (`feature-structure`). So the doors' calls and the diagnosis panel live in
  `src/core/pick-support/` (precedent: `core/attachments`), and the page lives in
  `features/oms/pick-support/`. Namespace `pick-support`, EN **and** AR, registered in
  `core/i18n.ts`.
- **Route** `/oms/pick-support`, with a page guard and a menu leaf in the OMS group on
  `canOpenPickSupport`.
- **Search** (the default tab): one input; Enter calls `GET PickSupport/Resolve?key=`. The key is
  held in URL state (`?key=`).
  - One delivery and no serials → its diagnosis (`GET PickSupport/Delivery/{no}`) under the box.
  - Several → a pick list (delivery, order, current store, close status, `matchedBy` chips, a stuck
    marker when `shapes` is non-empty). A row opens that diagnosis.
  - Serial holds → a holds table with each hold's server explanation (EN beside AR). `STUCK` links
    to its delivery; `UNKNOWN` reads as escalate.
  - `matched: false` → the server's `messageEn` / `messageAr` (HTTP 200, not an error).
- **Diagnosis panel**, sections 1–7 of the brief, with the fix button **not** drawn yet (497):
  1. verdict card per shape (code, explanation EN/AR side by side, fix sentence, per-request and
     per-document action tags); `HEALTHY` quiet; `UNKNOWN — escalate` with the copy button made
     prominent;
  2. `refusalText` in monospace;
  3. store history;
  4. documents → lines → units tree;
  5. donor requests with their transfer ("started" when the STO is set and the posted time is at
     the floor);
  6. the timeline, in the server's order, with a filter by `source` and a text box over `key`;
     reconstructed rows italic, tagged and with a tooltip;
  7. a split Copy button for `copy.text` / `copy.json`, verbatim, at every verdict.
- **Errors** through `apiErrorMessage`, showing `errorCode` beside the message (`PICK-00002`,
  `PICK-00003`). A 403 shows "You do not have access to Pick support". A 401 is `core/api`'s.

## Spine reach

model/api (`core/models`, `core/pick-support`) · logic (verdict → card state, floor stamp, timeline filter) · route + menu + page + shared panel · i18n EN/AR · test

## Proof (→ `tdd` red-green cycles)

- [x] `verdictView`: STUCK yields one card per shape; HEALTHY a quiet state; UNKNOWN, an unlisted verdict and STUCK with no shapes all read as escalate, with no fix slot (vitest)
- [x] `readStamp`: `0001-01-01T00:00:00` and any year ≤ 1900 read as "—"; a real stamp is shown as sent, never converted (vitest)
- [x] `transferView`: an STO with a floor posted time reads "started"; no STO reads none; both set read posted (vitest)
- [x] `filterTimeline`: the source filter and key text narrow the list and keep the server's order; reconstructed is carried through (vitest)
- [x] `resolveView`: one delivery and no serials opens the diagnosis; several give a list; serials give the holds table; `matched:false` gives the server sentence (vitest)
- [x] `canOpenPickSupport` / `canFixPickSupport`: only an explicit `true` grants (vitest, `access.test.ts`)
- [x] `tools/pick-support-drive.mjs`, run LTR and RTL against a stub that emits **exactly** the brief's JSON (all three verdicts, an order with two deliveries, a serial with a PUT_BACK_BASKET and a STUCK hold, a reconstructed timeline row, a `PICK-00002` envelope, a 403). It checks:
  - the leaf is hidden with no flag;
  - `?key=` survives a reload;
  - Copy puts `copy.text` on the clipboard byte for byte.
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Two new doors, `Resolve` and `Delivery`, stubbed until 500.
- Business codes: `PICK-00002` and `PICK-00003`. The 403 has no body.
- New namespace `pick-support`, and a new shared folder `core/pick-support`.
- No feature flag: the probe flag gates the leaf, and the doors are the boundary.
- No domain wording on the client. Chip labels, section headings, "Unknown — escalate", the
  reconstructed tooltip and the 403 sentence are UI words. Every explanation, fix sentence or hold
  text is the server's.

## Done when

The vitest helpers and the drive are green, and `/oms/pick-support?key=8006777365` renders the
stubbed STUCK diagnosis with every section.

## Blocked by

None — can start immediately (live doors: BackOffice 2687–2690; probe flags: BackOffice 2731).

## Comments

**Done 2026-10-16 (AFK).** Built to the brief, which was checked field for field against the shipped
`PickSupportModels.cs`, `PickDocumentModel.cs` and `DonorRequestModels.cs`.

- **Layout:**
  - `core/models/pick-support.ts` holds every wire type. `PickDocumentModel` is new. The diagnosis's donor request is `PickSupportDonorRequest`, which extends `DonorRequestModel` without widening it and opens its `state`.
  - `core/pick-support/` holds the door calls (`api.ts`), the pure helpers (`diagnosis.ts`, `failure.ts`), and the panel: `DiagnosisPanel`, `DeliveryDiagnosis` (the loader 499 reuses), `CopyDiagnosis` and `bits`.
  - `features/oms/pick-support/` holds `PickSupportPage.tsx` and `resolve-view.ts`.
  - There is no feature `api.ts`, because the doors are in core by the wave layout (HITL).
- **Probe:** `canOpenPickSupport` / `canFixPickSupport` were added to `OMS_SCREEN_FLAGS`, with one predicate each. The menu leaf sits in the OMS group just before Delivery statistics, which 484 keeps last.
- **How a row opens its diagnosis:** a pick-list row, or a STUCK hold, writes `?delivery={no}` beside `?key=`, and the diagnosis is drawn under the list. A `?delivery=` the key did not resolve to draws nothing. Pressing Enter on the same key re-reads both the lookup and the diagnosis.
- **Proof:**
  - vitest covers `verdictView`, `readStamp`, `transferView`, `filterTimeline`, `timelineSources`, `holdView`, `resolveView`, `openable`, the search URL state, `pickSupportFailure`, the access predicates and the menu leaf. The full suite passes, 5201 tests.
  - `tools/pick-support-drive.mjs` passes 106/106, run LTR and RTL against the brief's JSON. The copy checks prove the exact string handed to `clipboard.writeText` (byte for byte) and the OS readback with line ends normalised, because Windows turns LF into CRLF.
  - typecheck, lint (all four gates) and build are green.
- **Decisions:** see `.afk/HITL-496.md`, which is not committed.
- **Outstanding, not this ticket's:**
  - the live doors (ticket 500);
  - a human eyeballing the server's AR beside the EN;
  - a `/domain-modeling` pass on Pick support vocabulary. CONTEXT.md's "Verdict" means something else.
