# HITL — ticket 294 (submitting names what comes back)

## Q: Story 41 wants *3 lines · 1 fee*, but one i18n key cannot pluralise two independent counts. How is the fee half carried?
**Decision taken:** `submitGate` gained an optional third parameter (`feeCount`, defaulting to `0`)
and the ok-outcome gained an optional `fees: { key: 'returnDocument.gate.summaryFees', params }`.
The component joins the two with the same ` · ` glyph `PickupAddressPanel` already joins the address
summary with.
**Why:** two keys is the only way `1 line · 1 fee` and `3 lines · 2 fees` both read correctly; the
default keeps every 291/292 call site and its tests unchanged; the separator lives at the call site
because the pure module renders nothing and knows no glyph.
**Revisit if:** a third count joins the summary, at which point the outcome should carry a list of
segments rather than a `key` plus one `fees`.

## Q: Where do the §2 request/response types live — the feature's pure module or `core/models`?
**Decision taken:** `core/models/sd-document.ts`, under one provenance block naming BackOffice spec
1283 §2. `ReturnReason` moved there with them and is **re-exported** from `return-order.ts`, so every
existing `import type { ReturnReason } from './return-order'` still reads.
**Why:** `.claude/rules/api-envelope.md` says model types live in `src/core/models/`, and the §2
transcription is one block with one owner — splitting it across two files is how half of it drifts.
**Revisit if:** a second feature ever posts a return, which would make the placement load-bearing
rather than conventional.

## Q: `PickupAddress` and `CreateReturnAddress` are the same eleven fields. Keep both?
**Decision taken:** `PickupAddress` is now a type ALIAS of `CreateReturnAddress`.
**Why:** the spec says the draft IS the wire shape "so the request builder hands it over without
reshaping it" — an alias makes that true by construction rather than by a test that notices later.
**Revisit if:** the draft ever needs a field the wire does not carry (a *not yet chosen* marker, say).

## Q: A double-click could fire two posts before React re-renders the disabled button. Enough to rely on `create.isPending`?
**Decision taken:** No — added a `useRef` in-flight latch alongside the `isPending` disable.
**Why:** `isPending` only disables on the NEXT render; a ref flips synchronously. The cost of being
wrong here is a customer refunded twice, and the guard is three lines.
**Revisit if:** never — but note the server's `requestId` is the real guarantee; this is the client
half of it.

## Q: Should the dialog close on Escape / backdrop while the request is in flight?
**Decision taken:** No. Cancel is disabled and `onClose` is intercepted while `isPending`.
**Why:** story 51 says the dialog is held open while the request is in flight; a return being
created behind a screen that says nothing about it is the worst version of the same problem the
idempotency key exists for.
**Revisit if:** a request can hang long enough that the operator has no way out — then it needs a
timeout, not an escape hatch.

## Q: What does a refusal that carries no `errorCode` render?
**Decision taken:** The sentence alone — the code line is omitted rather than shown blank or as a
placeholder. And the screen matches on **no** code at all, as the ticket requires.
**Why:** a labelled empty code reads as a code that IS empty; 1283 §8 calls the values build detail,
so there is nothing here to branch on.
**Revisit if:** the door starts refusing without a message either, which would leave only the
fallback sentence — at which point the fallback needs to say what to do next.

## Q: The drive cleared toasts by removing their DOM nodes, which broke sonner.
**Decision taken:** Wait for toasts to EXPIRE (`settleToasts`) instead of removing them.
**Why:** sonner owns those nodes; ripping them out fails the drive for a reason the app does not
have. It also makes the refusal assertion the real one — the banner has to survive a toast that
genuinely went away.
**Revisit if:** the wait dominates the drive's runtime (it is ~10s once, for the error toast).

## Q: Chromium logs the deliberate `400` refusal as a console error, failing the drive's *no page errors* check.
**Decision taken:** Filtered `Failed to load resource … 400/403` out of the collector, with the
reason written at the filter.
**Why:** that line is the drive's own fixture answering as designed. Uncaught exceptions and React
errors still land in the collector unfiltered.
**Revisit if:** a real 400 regression ever needs to be caught by this check — it would have to be
caught by an assertion instead.

## Not picked up here (recorded, not fixed)
The three correctness findings 293 carried forward are still open and still belong to 291/292/290's
code, not to this diff: `pickAll` resetting an edited quantity, the code-only district fallback
leaving `cityCode` blank, and `documentCategory !== 'D'` mislabelling capture `9000000003`. ⚠ The
second one now has a **payload** consequence this ticket makes concrete — a district chosen through
that fallback posts `districtCode` with `cityCode: ''` — so it is worth triaging before 295.

## Q: /code-review found `crypto.randomUUID()` throws outside a SECURE context (this app is served over plain http from IIS). Fix here?
**Decision taken:** Yes — a blocker in this ticket's own code, fixed. New `core/util/request-id.ts`
(`mintRequestId`) prefers `randomUUID`, falls back to `crypto.getRandomValues` (which is NOT
secure-context-restricted) formatted as an RFC 4122 v4, and to `Math.random` only if there is no web
crypto at all. Three unit cases cover the three paths.
**Why:** without it the dialog throws as it opens on every real deployment, and no key is ever
minted — the drives cannot catch it because localhost IS a secure context. The repo already
sidesteps `randomUUID` twice, but those two only need a React key; an idempotency key needs entropy.
**Revisit if:** the app is ever served over https, at which point the fallback is dead code that
still costs nothing.

## Q: /code-review re-raised two findings in landed 291/292 code that now change what POSTS. Fix them at the frontier?
**Decision taken:** No — recorded, not fixed. (1) `pickAll` resetting an edited quantity is
**asserted by 291's own drive** ("each at its own remaining quantity"), so changing it means flipping
a landed slice's proof. (2) The code-only district fallback pairing a district with a stale city is
292's design space — the honest fix is either silently rewriting the city under the operator or
drawing the two identical options 292 removed on purpose.
**Why:** both are UX rulings a previous slice took deliberately, and re-cutting them from the last
ticket in the wave is how two sessions disagree. Neither is a defect in this diff.
**Revisit if:** ⚠ **295, before the first live call.** Finding (2) now has a payload consequence — a
`districtCode` posted with `cityCode: ''` is a collection the courier cannot route — so it should be
triaged there rather than carried further.
