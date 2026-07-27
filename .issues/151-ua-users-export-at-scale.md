---
status: done
spec: 147
blocked-by: 150
---

# 151 — exportingEverybodyWarnsFirstAndCancelsWithNoPartialFile

## What to build

Everything is exportable — including *All people* — **but past 500 rows you have to mean it.**

Above `totalMatches > 500`, a confirm names the row count and the rough wait before anything starts;
at or below, the file just downloads as it does today. The ceiling protects **the user's
expectation, not the browser and not the server**: under about four seconds a click feels like it
worked, past that it feels like it hung, and walking ~6,000 identities takes roughly 45 seconds.
`phoneGap` (~400 rows) lands just under deliberately, so in practice only *All people* raises the
dialog.

While a long walk runs, progress shows in a **cancellable toast** — not a blocking modal. The screen
stays usable, and the walk **never writes to the mounted query's cache**: exporting must not double
as a navigation event.

**The governing rule, in both directions: cancel or any `ApiError` ⇒ no file at all.** Not a partial
file, not a file with a warning — nothing. A truncated CSV is indistinguishable from a complete one
once it is open in Excel, and this file's entire use is spotting who is *missing*. Errors surface
through `apiErrorMessage`; 401 remains `handle401`'s business and is not caught here.

Two more properties the walk owes at this scale:

- **Terminate on `isCapped`**, with a **200-page runaway guard** so a contract change can never spin
  forever.
- **Dedupe by `employeeId`** — a 45-second walk can be shifted mid-flight by a concurrent SAP insert,
  which slides rows across page boundaries and would otherwise duplicate someone.

**Do not describe the confirm as a control anywhere** — not in copy, not in a comment. It is a
wait-time device: dismissible, and absent on every narrowed card. If it starts being cited as what
governs bulk extraction, the governance is fictional (ticket [146](146-export-gate-and-audit.md)).

## Spine reach

logic (the walk's guards, cancellation, dedupe — pure, behind a `fetchPage` callback) · component
(confirm dialog + progress toast) · i18n (`ua-admin`: confirm title/body/actions, progress and
outcome toasts) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `theWalkStopsAndDedupes` — driven in-memory with a fake page fetcher: walks from 0 in steps of
      50, stops when `isCapped` goes false, the 200-page guard fires against a fetcher that never
      stops, and an `employeeId` appearing on two pages lands once · pure ·
      `src/features/admin/ua-admin/export.test.ts`
- [x] `cancelOrErrorYieldsNoRows` — cancelling mid-walk and a page that throws both make the walk
      **refuse to return a result** rather than return what it had; asserted at the walk's edge, not
      as "no file was written" · pure · same file (plus `theConfirmIsAWaitTimeDevice` over
      `needsConfirm` / `estimateWalkSeconds`) — 298 tests green
- [x] `exportingEverybodyAsksFirst` — drive: Export on *All people* raises a confirm naming the row
      count; dismissing it does nothing at all; confirming shows a progress toast that can be
      cancelled, after which no file has downloaded · flow (Playwright, extends
      `tools/ua-users-scale-drive.mjs` — sections 11/12, plus 13 letting the walk finish to prove
      6,000 identities land exactly once) — **70/70**, with `typecheck` / `lint` / `build` green

## What it took

- `export.ts` gained the guards around the existing walk: `isCancelled` polled **before and after**
  every page (the page in flight when Cancel is clicked must not be able to complete the walk), an
  `employeeId` `Set` for the dedupe, `onProgress` for the toast, `needsConfirm` +
  `estimateWalkSeconds` as pure functions so the threshold is one testable fact rather than a `>` on
  a screen, and two named errors — `ExportCancelledError` and `ExportRunawayError`. The walk
  **throws** on both, which is the no-partial-file rule expressed where it can be tested.
- 🚩 Review caught a real hole: the confirm read `list.data?.totalMatches ?? 0`, so an export fired
  before the first read settled (or after a failed one) saw **0 matches**, skipped the dialog, and
  walked 6,000 people with no progress and no Cancel — the exact outcome the ticket forbids. The
  count is now required: the button is dead until `list.data` lands, and `exportCsv` returns early.
- The runaway guard got its own error type because `apiErrorMessage` would render it as a generic
  "unexpected" — "the walk never ended" is different news for an administrator than "the server
  refused", so it carries `export.runawayDetail`.
- The progress toast is one sonner id re-fired per page (120 pages updating one toast, not 120
  toasts), `duration: Infinity`, with the cancel affordance flipping a **ref** — the running walk
  polls it between pages and must see the click without waiting for a render.
- `exporting` is now taken **before** the confirm rather than after: the dialog is awaited, and a
  button that stayed live through it could open a second dialog and start a second walk.
- Copy check: nothing in the dialog, the keys or the comments frames the confirm as a control — it
  is written up as a wait-time device throughout, per ticket 146.

## Boundaries

No new endpoint. Confirm-dialog pattern follows the simulator's Clear-cache button (spec 022) rather
than inventing a second one. Sonner for the progress toast, as everywhere else.

## Done when

Exporting *All people* warns first, shows cancellable progress, and produces a file containing every
identity exactly once — while cancelling it, or a mid-walk server error, produces **no file at all**
plus a message saying what happened.

## Blocked by

[150](150-ua-users-csv-export.md) — the guards harden a walk and a writer that must already exist.
