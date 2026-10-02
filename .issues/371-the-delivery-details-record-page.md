---
type: wayfinder-ticket
wayfinder: prototype
map: 358
status: done
blocked-by: 362, 369, 370
---

# 371 — The Delivery details record page

## Question

Arrange the Delivery details record page on the new tokens:

- **The header:** identity, state and key facts.
- **The timeline**
  ([How a delivery's state maps to timeline steps](369-how-a-deliverys-state-maps-to-timeline-steps.md)).
- **Items.**
- **An activity feed** that merges Log and Jobs.
- **Actions.** Per [Retry job: drop it or ask BackOffice](370-retry-job-drop-it-or-ask-backoffice.md),
  this page ships **without a Retry button**. A failed job is a banner per job (handler, attempts,
  last error). A failing `P` row reads "retrying automatically". Leave room for one grant-gated
  Retry per job, with a confirm, to land later.

The page also **takes a one-shot `open` intent** in router state
(`'reschedule' | 'request-close' | 'add-note'`) from the list's inspector and R/C/N. The dialog
opens once, after the header loads, through the page's own command gate. A disabled command shows
its reason instead. Per [What the inspector shows](367-what-the-inspector-shows-for-a-selected-delivery.md).

What carries over from the shipped Document Details rework (spec
[083](083-document-details-rework-spec.md)), and what is replaced?

The owner reacts live in both modes.

**From [362](362-ops-console-colours-density-and-grid-look.md):** today's identity band is a dark
`--brand-panel` slab, and it now meets the dark navy rail at a corner. 082 rejected exactly that
pairing, so the new header must not be a dark slab. See
[document-navy-light.png](assets/362-shots/document-navy-light.png).

## Prototype (2026-10-02)

Branch `prototype/371-delivery-details` (`fb1416b` + `bf0754d` for variant D, on top of 362's `da08890`, never merges),
worktree `C:\Playground\oms-react-371`. Run `npx vite --port 5371` there and open
`/oms/delivery/8000000300?variant=A`. The ← → arrows switch the variant, and ↑ ↓ switch the
delivery. The panel at bottom-start arrives as the inspector's R/C/N would. The header's moon icon
switches between light and dark.

- **A · Far as drawn.** Commands sit in the header, with Add note, Return, Force cancel and
  Cancel order in **More ▾**. A full-width stepper, then main-column sections, then a sticky
  Activity column with the composer.
- **B · 083 carried forward.** A light band with a navy leading edge and the stepper in the
  band. 083's command grammar stays (nothing hidden), with the summary rail and tabs for Items,
  Conditions and Activity. Notes stay in 083 D-11's dialog.
- **C · Activity spine.** The timeline and the feed form one vertical spine: milestones,
  superseded passes struck through, amber rewinds, a "Now" composer and future steps. Facts sit
  beside it, and the 083 grammar sits in a sticky bottom bar.

**Shared across all three:**

- The light header (never a dark slab) carries a due/paid tag.
- Each **failed job gets its own banner** (handler, attempts, last error), with a dashed
  reserved Retry slot.
- A failing `P` row reads "retrying automatically".
- The one-shot `open` intent goes through the real `commandBar` gate.

**Data:** five stub cases. Three are the 078 live captures (a rewind, a cancellation request,
pick-in-store delivered), and two are synthesized (out for delivery with two failed jobs, and
cancelled after out). The real dialogs open, but nothing posts.

**Checked by `tools/proto-371-shots.mjs`,** 14/14 with no page errors:

- C on a delivery that already has a request is **refused with its reason**, and no dialog opens.
- A reload does not re-fire the intent.
- R opens Reschedule.
- N focuses the composer (A and C) or opens the note dialog (B).
- Ctrl+Enter posts.

The captures are in [371-shots/](assets/371-shots/).

**Found while building:**

- **Live capture `8000000121` carries a from = to schedule (23:56–23:56)** while its slot reads
  8pm–10pm. The timeline's "expected" window must reuse 083 D-7's `deliveryWindow()`, never the
  raw schedule fields.
- **Known capture noise:** the items grid keeps AG Grid's auto-height floor, so a one-line grid
  shows empty space.

## Answer

**The owner picked C's spine with B's command bar, kept the notes composer, and chose newest
first** (2026-10-02). That combination is variant **D** on the prototype branch (`bf0754d`), and the
decisive captures are `D-*.png` in [371-shots/](assets/371-shots/). It passes the same intent checks
as the others: 19/19 across all four variants, with no page errors.

### The page, top to bottom

1. **The header** is a light card on `--card`, **never a dark slab** (362's handover is closed).
   - **Line one:** Back chevron (Esc), then the Delivery no. in Plex Mono 600, then the
     **now-step badge**, then the **due/paid tag** (369), then the tags: Dawaa Now as a gold fill
     with navy ink, e-Rx, and the Overall code. **All statuses** sits at the end, with the
     thirteen statuses plus provenance in its disclosure (083 D-3's disclosure kept).
   - **Then the sub-ids:** order no., type, delivery doc, placed, store and document no., with IDs
     in mono.
   - The 083 identity band's customer block is **dropped**, because the Customer facts sit beside
     the spine.
2. **The command bar is B's, which means 083 D-10 unchanged**, now under the header. It has three
   labelled clusters (Fulfilment · Cancellation request · Notes & docs) and the unlabelled
   terminal pair (Force cancel · Cancel order) pinned to the end.
   - **Nothing is hidden and there is no More ▾.** Far's More menu is rejected, so no operator
     acceptance is needed.
   - Evidence-only gating stays, with the disabled reason shown on hover and focus.
   - The keys from 365 show on the buttons: R, C, N.
3. **Two columns:** the **spine** on the start side (about 340–420 px) and the **facts** on the end
   side.
   - **The spine** is the timeline and the activity feed as **one vertical list, newest first.**
     From the top:
     - the **failed-job banners**;
     - the **unreached steps**, furthest first, with the next one carrying its window as an
       *expectation*;
     - the **Now line** with the **note composer**;
     - then the past, newest first.
   - **How the past draws:**
     - A Log row that reached a step is a **milestone node**. It is the latest matching row, per
       369 §4.
     - An earlier pass that a rewind superseded is **struck through** and reads "earlier pass".
       Only lifecycle steps (Created, Ready, Out, Delivered) can be superseded. A cancellation
       request that was then carried out is an ordinary event, not a struck pass.
     - A rewind row (`DRBK`/`DRSC`/`DCHC`) is an **amber node**. That is 369 §3's marker, and the
       spine *is* the "full path in the feed".
     - Jobs and notes are small event rows.
     - *Cancellation requested* is **indigo**, per 368's amendment to 369 (the prototype drew
       amber, and the build must not). *Cancelled* is red.
   - **The facts column:** Customer · Prescription · Fulfilment · Driver & tracking · Payment, as
     dense label/value blocks built by `railCards` (083 D-5/D-6's emptiness rules kept). Under
     them sits **Items**, the items grid with deleted lines struck through and the pinned totals
     footer. Under that is **Pricing conditions**, folded into a disclosure with its count.
     **The 083 tabs and the 340 px summary rail are gone.**
4. **Failed jobs:** **one banner per `F` job**, with a two-line shape. Line one has the handler,
   "failed", the attempts and the time. Line two has the last error. **There is no Retry button**
   (370). The banner's end keeps room for **one grant-gated Retry per job** behind a confirm. A
   failing **`P` row** gets a quiet line: "failing, retrying automatically · attempt n · next
   hh:mm" plus its error. No button, ever.

### Notes: the composer replaces Add note's dialog only

- **Add note posts from the composer at the Now line.** This **amends 083 D-11 for Add note
  only**. Every other note-carrying command (Cancel order, Force cancel, Request cancellation)
  still captures its note **inside its own dialog**, so `pendingNote`'s ambiguity does not come
  back.
- **Keys, per 365:**
  - **N** focuses the composer.
  - **Ctrl+Enter** posts. An empty composer cannot post, which keeps D-11's rule.
  - Esc back is **refused while the composer holds unsent text**.
- The command bar's **Add note…** button also focuses the composer rather than opening a dialog.

### The one-shot `open` intent (367 §3), proven in the prototype

- It is consumed **once, after the header loads, through `commandBar`'s own gate**.
- **`reschedule` and `request-close`** open their real dialogs. **`add-note`** focuses the
  composer.
- **A refused intent** opens no dialog. The disabled button gets an attention ring, its reason
  shows as a tooltip, and a warn toast repeats it. For example, C on `8000000174` gives "A
  cancellation request is already open for this document".
- The router state is **replaced away on consumption**, so a reload or Back never re-fires it.
  This was checked on every variant.

### Defaults taken (owner did not rule; overturn by reopening)

- **A cancelled delivery keeps 083 D-10's evidence-only gating.** Every command stays enabled, the
  server's `400` stays the authority, and the due tag still shows `Due n` while `amountDue > 0`.
  Adding a state gate would re-implement server rules, which 083 refused.
- **Conditions are folded** (from choosing C), not a peer section.

### Build notes for the spec

- **The step expectation reuses 083 D-7's `deliveryWindow()`, never the raw schedule fields.**
  Live capture `8000000121` has `deliveryScheduleFromTime === ToTime` (23:56–23:56) while its slot
  reads "8pm - 10 pm".
- **No "now" tag on a milestone.** After a rewind, the current milestone is an *old* row at the
  bottom of a newest-first spine, far from the Now line. The header's now-step badge and the Now
  line carry "where it is now".
- **Feed ordering rule** (Far's risk): Log `entryTime` and outbox `entryTime` merged on one key.
  On a tie the Log row comes first. No server change is needed.
- **The pure derivations** (`timeline()` per 369, `feed()`, `dueTag()`) are the prototype's
  `__prototype__/derive.ts`. The timeline moves up to `@/core`, shared with the inspector per 367.
- **The items grid sizes to its rows.** AG Grid's auto-height floor is a capture artefact to fix at
  build, not a layout ruling.
- **Bidi:** the spine's "who · when" meta and the expectation window carry digits at their ends,
  so they go to [The foundation in Arabic/RTL](378-the-foundation-in-arabic-rtl.md) with the rest.
