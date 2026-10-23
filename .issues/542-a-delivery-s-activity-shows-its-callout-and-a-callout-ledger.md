---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2952-competed-delivery-callout-spec.md
blocked-by: — (live: BackOffice 2964)
---

# 542 — A delivery's Activity shows its callout, and a Callout sub-tab holds the ledger

## What to build

**The callout timeline** for BackOffice spec 2952. Brief: the spec's `## Comments` → "oms-react hand-off", point 2;
decision `C:\Work\DMSCO\BackOffice\.issues\2950-the-oms-react-dispatch-visibility-screens.md` `## Answer` point 2
(timeline = variant A + C); prototype `C:\Work\DMSCO\BackOffice\.scratch\proto\2950-dispatch-visibility-screens\index.html`.

- **Model** `core/models/delivery-callout.ts` from BackOffice `DispatchBoardModels.cs`:
  `DeliveryCalloutHistory { asOf, deliveryNumber, callouts[] }`, each callout a `DispatchCallout` (541's shape;
  share it) plus `events[] { kind, party, staff, register, eventAt, detail, bidId }`. No callout → an empty list.
- **Door** `GET SdDocumentWeb/Delivery/{deliveryNo}/Callout`, on the existing Delivery details gate (`GatedByDetail`).
  No new screen, no new grant.
- **Moments in `ActivitySpine`:** a new callout moment kind beside the donor moments (`core/oms/donor-moments.ts`
  pattern), merged into `core/oms/timeline-feed.ts` by time:
  - callout-level `kind`s: `Opened`, `Take`, `Pass`, `Withdraw`, `Unanswered` (the fallback), `LockReleased`
    (detail = reason + note), `FallbackFailed`;
  - bid-level `kind`s: `Delivered`, `Shown`, `BidOpened` (the till opened the sheet; `Opened` is the callout opening),
    `Dismissed`, and the fallback store's `FallbackDelivered|Shown|Opened|Dismissed`;
  - awarded-elsewhere / passed / expired / withdrawn / lock-released stay **distinct**; an expired bid shows its
    `ignoreReason` (`NotReached`, `ReachedNotShownNobodySignedIn`, `ReachedNotShownOldBuild`, `ShownNotOpened`,
    `OpenedNotAnswered`);
  - a "now" line while the callout is open;
  - a delivery that was **not competed** (`NOT_OPENED`) shows one moment with its reason (`NoGps`, `NoCandidates`,
    `OneCandidate`, `StockLeftFewerThanTwo`, …).
- **Callout sub-tab** under Activity (only when the delivery has a callout): the one-row-per-bid ledger (store, km,
  ATP at offer, tills online / signed in, the four moments, answer + staff + register, outcome) and the raw event
  log in order, for disputes.

## Spine reach

model · api · logic (event → moment mapping, ledger rows) · Activity spine + sub-tab · i18n EN + AR · test

## Proof (→ `tdd` red-green cycles)

- [x] moment mapping: every `kind` above gives its moment; `Opened` vs `BidOpened` are told apart; lost /
      passed / expired / withdrawn / lock-released give distinct moments; an unknown `kind` still renders; a
      `NOT_OPENED` callout gives one moment with its reason (vitest)
- [x] feed merge: callout and donor moments interleave by time with the existing feed (vitest)
- [x] drive script, LTR and RTL, against a stub serving the door for a taken, a fell-back, a released and a
      not-competed delivery, and an empty list: the spine, the sub-tab shown only with a callout, the ledger, the log
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

- Door: BackOffice 2964 (built and merged on `pricing2`); stubbed until deployed with the owner's SQL
  (`Modules/Sd/Sql/056`, `Modules/Callouts/Sql/001`).
- Read only. Release lock lives on the board (541) and on Delivery details' actions (below).

## Done when

The Proof boxes are ticked: on the running app (stubbed), a competed delivery's Activity tells its callout story and
the Callout sub-tab holds the bid ledger and the raw log.

## Blocked by

— (live: BackOffice 2964 deployed)

## Open questions

- BackOffice 2951 also puts **Release lock on Delivery details** (shown only on a locked delivery, same
  `DispatchBoard` Execute grant, same `POST DispatchBoard/ReleaseLock`). Default: build it here as a Delivery
  details action reusing 541's release dialog, once 541 has landed; overrulable into its own ticket.

## Comments

### Built (2026-10-23)

- **Model** `core/models/delivery-callout.ts`: `DeliveryCalloutHistory`, `DeliveryCalloutRecord extends DispatchCallout`
  (541's shape, imported, not re-declared) `+ events[]`, `DispatchCalloutEvent`, the event-kind / ignore-reason /
  not-opened-reason lists. **The event's time field is `at`** (BackOffice `DispatchCalloutEvent.At`), not `eventAt`
  as this ticket's brief wrote; the event also carries `eventId`.
- **Door** `documentApi.getCallout` → `GET SdDocumentWeb/Delivery/{deliveryNo}/Callout`, read on delivery-category
  documents only (as the donor read), a failure is one inline line in the spine.
- **Logic** `core/oms/callout-moments.ts` (pure): event → moment (`Take`/`Pass` read by their answer: `took`,
  `awardedElsewhere`, `passed`, `answeredLate`; `Opened` vs `BidOpened`; `Unanswered` → `fellBack`; the fallback
  card's four; `LockReleased` split into reason + note; `FallbackFailed`; an unknown kind → `other`, shown as itself),
  one `bidExpired` moment per EXPIRED bid with its `ignoreReason`, one `notCompeted` moment for a `NOT_OPENED`
  callout; `onCallout`, `lockedCallout`, `calloutsOf`, `calloutLog`. `timeline-feed.ts` merges them by time (tie
  order Log → donor → callout → job) and gives the spine an `onCallout` list.
- **UI** `ActivitySpine` draws the callout rows and an "On callout · m:ss left · waiting on n stores" line above Now
  (541's `countdownLeft`, 1 s clock). Activity / Callout sub-tabs appear only with a callout; the Callout view
  (`CalloutPanel.tsx`) takes the full width: header + lock / release, the ledger (541's `bidRow`, `outcomeView`,
  `atpView` — no copy), the raw event log in server order. EN + AR (`document` namespace, `callout.*`, AR plurals in
  all six forms).
- **Release lock on Delivery details** (the open question's default, built): a *Callout* cluster on the command bar
  with *Release lock…*, drawn only when a callout locks the delivery now AND the board's probe says
  `canReleaseLock`; it opens 541's `ReleaseLockDialog`, and on success toasts and reloads the delivery + its callout.
- **Proof:** vitest `core/oms/callout-moments.test.ts` 16 tests (moment mapping + the feed merge with Log, jobs and
  donor moments); `npm test` 5844 green; typecheck + lint green. `tools/delivery-callout-drive.mjs` **72/72** LTR +
  RTL (port 5202), **all stubbed** — taken, fell back, released, not competed, open, empty list, a failing read,
  Release lock with and without Execute. Existing drives re-run green on 5202: document-donor 18/18, document-spine
  92/92, document-actions 67/67, oms-viewer 31/31, dispatch-board 101/101, document-composer 70/70, mark-delivered
  40/40 (its "reloads the delivery" counter now counts the delivery's own read only — the donor read had already
  broken it). document-rtl 52/53: its one failure (header `font-mono` isolates not inert) is in `DocumentHeader`,
  which this ticket does not touch.

### Decisions (overrulable)

- **Release lock is built here**, not a ticket of its own (the open question's default).
- The Callout view **replaces** the spine and widens to the full row (the facts column drops below it): the ledger
  has ten columns and would not fit the spine's 400 px.
- At one instant a bid that closed unanswered sits **above** the Take that closed it (it is later in the callout's
  story); a moment with an unknown answer reads "R047 answered" with the raw answer.
- The board's probe is asked only once a lock is on screen (the menu leaf asks it anyway on every page).
- A Take award is the award moment: no second "awarded" row (the prototype's separate ★ row is the same instant).
- The RTL pass is direction only (the app's `lng` stays `en`), as in the repo's other RTL drives.
