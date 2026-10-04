# HITL — ticket 403 (AFK, 2026-10-03/04)

## Q: "On a tie, the Log row comes first" — first in the newest-first list, or first in time?
**Decision taken:** First in the newest-first output: a Log row and a job with the same `entryTime` draw the Log row ABOVE the job (`feed()` in `@/core/oms/timeline-feed`).
**Why:** The ticket's Proof names the test literally ("feed merges Log and jobs newest first with the Log row first on a tie") and D6 says the same; the ticket is the seam agreement.
**Revisit if:** The owner meant chronological order (the cause before the job it queued). The 371 prototype sorted oldest-first with logs first and then reversed, so its D captures draw the JOB above the Log row (e.g. "LastMile — create order 05:30" above "Rescheduled 05:30"). Flipping it is one line in `newestFirst()` plus the tie test.

## Q: Which rows are struck as "earlier pass"?
**Decision taken:** A lifecycle row (Created/Ready/Out/Delivered) that is not its step's milestone AND has a Rewind (`DRBK`/`DRSC`/`DCHC`) after it. A non-milestone lifecycle row with no rewind after it is a plain event: Delivered on a delivery cancelled after delivery (`X`), or a `DRDY` followed by a `DTXC`.
**Why:** D5 says "an earlier pass superseded by a rewind". The prototype struck every non-latest lifecycle row, which would strike a real delivery under `X` (raised by /code-review) and a plain Ready → transfer (raised by the spec review).
**Revisit if:** The owner wants every repeated pass struck, rewind or not.

## Q: A step that is reached but has no Log row: where does it go in the spine?
**Decision taken:** It is still drawn as a milestone with no time and no who · when, directly above the milestone of the step before it (the first step goes to the very bottom). Before the Log loads, the past is the reached steps alone, untimed.
**Why:** "A reached step with no matching row shows no time" — but it is still reached, and dropping it would make the spine disagree with the header's badge. Its place in time is unknown; the order steps are reached in is the only honest order.
**Revisit if:** The owner prefers untimed steps grouped at the bottom, or hidden.

## Q: Where does the spine go while the summary rail and tabs still exist (until 404)?
**Decision taken:** From 1280px (`xl`) the spine is the start column (`minmax(340px,400px)`), and the end column holds today's summary rail + tabs unchanged. Below 1280px the spine stacks above them. At 1280–1600px the items grid is narrow (≈500px) and scrolls; `document-items-drive` now runs at 1920 because AG Grid virtualises the out-of-view columns it reads.
**Why:** D4 puts the spine on the start side, and the ticket says items, conditions and the facts "stay where they are until 404"; 404 replaces the end side with one facts column.
**Revisit if:** 404 does not follow soon: then narrow the rail or stack it above the tabs in the interim.

## Q: What time does a failed-job banner show?
**Decision taken:** `lastAttemptTime` (when it last failed), falling back to `entryTime`. The feed row for the same job sits at its `entryTime` (D6).
**Why:** "the handler, failed, the attempts and the time" — the failure's time is the one that matters on a banner; the prototype's banner used `lastAttemptTime` too.
**Revisit if:** The owner wants the banner to read the job's creation time.

## Q: The Retry "room" on the banner.
**Decision taken:** A structural, empty grid cell at the banner's inline end (`data-retry-slot`), taking no width and drawing nothing.
**Why:** The runner and the ticket: "The failed-job banner leaves ROOM for a button and renders none." 410 drops its button into the slot without restructuring the banner; an empty reserved gap would look like a rendering fault.
**Revisit if:** The owner wants visible space held for Retry now.

## Q: Keys beyond the Boundaries list.
**Decision taken:** Added `spine.ariaLabel`/`future`/`past` (aria labels), `spine.loading`, `spine.was` ("was <old value>"), `jobs.retryingNoNext`, `jobs.state.*` (the job event rows), and pluralised `jobs.failed_one/_other` on `{{count}}` (the ticket wrote `{{attempts}}`). The load-failure keys `log.failed`/`jobs.failed` became `log.loadFailed`/`jobs.loadFailed`, because the ticket assigns `jobs.failed` to the banner sentence. Retired: `log.empty`, `jobs.empty`, `tabs.log`, `tabs.jobs`, `tabs.failedCount_*`, and the fifteen Log/Jobs grid column keys.
**Why:** Zero-literal needs a key for every visible string; `spine.was` keeps the old value the retired Log tab's Action Old Data column showed (raised by /code-review), so no Log fact is lost. "1 attempts" needs a plural.
**Revisit if:** The owner does not want the old value in the spine (drop `Detail`'s third span and the key).

## Q: A Log row's action data and old value: machine or free text?
**Decision taken:** Free text, `<bdi>` (dir auto). They hold slot words, driver names and store codes alike.
**Why:** The bidi rule isolates free text with `<bdi>`; a value with no strong letter (a time range, an amount) resolves LTR under dir auto, so it does not reverse.
**Revisit if:** A capture shows an action type whose data is always a machine value that reads wrong under RTL; then pick `Ltr` per action type.

## Note: what the reviews raised and was left alone
- The retrying job shows twice: its quiet line above the future steps and its own event row in the past. Both 371 captures do the same.
- A failed job is both a banner and an event row in the past, as in the prototype.
- "next hh:mm" on a retrying job has no date, as the ticket's copy says; a next attempt tomorrow reads like today.
- `Deferred<T>` moved from the page into `ActivitySpine.tsx`, which consumes it; the page imports it.
- `timeline-feed.ts` lives in `@/core` with only the document feature reading it, because the ticket puts `feed()` with the core timeline it extends.
- The glossary's **Reached** says avoid "passed"; the helper is `rewoundAfter`. "Earlier pass" is the spec's own copy.
- `document-rtl-drive` stays at 52/53: the same pre-existing Plex Mono "inert inline box" check recorded at 401/402.
- `foundation-drive` stays at its 1294/1302 baseline (topbar search box and bell count, not this slice).
