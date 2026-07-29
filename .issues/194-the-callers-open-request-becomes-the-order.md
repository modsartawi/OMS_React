---
status: done
spec: 193
blocked-by: —
---

# 194 — theCallersOpenRequestBecomesThisOrder

## What to build

The rail volunteers that the caller has open requests; a picker shows them with their lines; picking
one links it. ⚠ **Nothing of this exists on the client today** — no picker, no chip, no model — and
the server half ([880](C:\Work\DMSCO\BackOffice\.issues\880-cc-linked-sales-request.md)) is being
built alongside, so this ticket is a build against a contract, not a wiring of a drawn surface.

**The count is drawn, the modal is not.** Attaching a caller fires the scoped read; if they have open
requests the rail carries a count and a *view* control. Silent when there are none — a plain order
gains no furniture. It does not auto-open: the agent is mid-greeting and a picker over the basket
takes the call away from them.

**The picker shows each request's lines** — item, description, quantity — plus the reason **in words**
and the pharmacist's note. It shows them because the console needs them anyway to copy them, so the
agent sees exactly what is about to land. 🚩 **It is not `DocumentDetailsPage` and must not become
it**: that page has no view-only mode (WPF used `ViewOnly = true`; the react port has no equivalent),
so reusing it would put change-store / reschedule / close-request under an agent's hand mid-call — and
`features/callcenter → features/oms` is a boundary violation besides. A link out to
`/oms/document/<no>` in a new tab is the escape hatch for the rare deep dig, and is the only thing
this console says about that screen.

**One press, one act.** `linkRequest` carries one `requestId` and comes back with the whole
`SessionState` plus a per-line report. The console must **not** loop `addItem` — N ids for one agent
action is §4 law 3 broken by design, and the guardrail outcomes belong to the server's own copy.

**The linked card** replaces the count: request number, reason in words, the store it came from, the
pharmacist's note, and *unlink*. Money appears nowhere on it — the request is unpriced, and the basket
is where the order's money lives.

**The skipped-line report is the interesting half.** Lines the server refused or found below ATP were
**not** added. They are listed with the server's own reason, and a below-ATP row offers the ordinary
*add anyway* the console already has. 🚩 A below-ATP line must not arrive already added: `HasBelowAtp`
is a fraud signal and the ledger's own comment is that a client-set boolean cannot prove the agent saw
the number.

**Copy is silent about the reason except for TMRA**, where pickup and paid-online arrive with the
store. The chips will say so themselves — `fulfilment` and `payment` already draw from the projection,
so this ticket adds no second voice for them.

## Spine reach

api (`customerRequests`, `linkRequest`) · logic (`linked-request.ts` — the card, the offer predicate,
the skipped report) · component (`RequestPicker`, the rail block, the linked card) · i18n
(`callcenter.request.*`) · test

## Proof (→ `tdd` red-green cycles)

- [x] `linked-request.ts` — `requestOffer(state)`: the count block draws only with an attached caller,
      at least one open request, and an **empty basket**; the reason renders as its description and
      **never** as the code (a fixture carrying `TMRA` with no description must render neither, not
      fall back to the code) · pure
- [x] `skippedReport(response)` — refused and below-ATP are **different rows**: below-ATP carries
      `requested`/`available` and an add-anyway handle, refused carries the server's code and no
      handle. A response with an empty `copied[]` still reports the link as **made** · pure
- [x] `linkedCard(state)` — holds no figure formatted as money at all, asserted in the narrow form
      (over a fixture whose note contains a currency word), since the broad form fails on server text
      nobody may edit · pure
- [x] `tools/linked-request-drive.mjs` — attach a caller with two open requests, the rail counts them,
      the picker lists both with lines, picking a TMRA request lands store + pickup + online + the
      copied lines, and the mandatory source reference fills itself. On the **wire**: exactly one
      `LinkRequest` with one `requestId`, **zero** `AddItem` calls, and no `customerId` on the
      requests read · flow (Playwright)

## Boundaries

**Server:** BackOffice [880](C:\Work\DMSCO\BackOffice\.issues\880-cc-linked-sales-request.md) —
`CallCenterWeb/CustomerRequests`, `LinkRequest`, contract v1.11 `header.linkedRequest` +
`capabilities.canLinkRequest`. ⚠ Neither route exists yet; stub to 880's documented shape and say so
in the drive's own header, as 186 did for the stock hop.
**Boundary rule:** no import of `@/features/oms/*`. If the details view is ever genuinely wanted
inside the console, it graduates to `@/core` — it does not cross sideways.
**i18n:** all new keys under `callcenter.request.*`.

## Done when

In the running app, attaching a caller with an open request shows the count; opening the picker shows
that request's lines and its reason in words; linking a TMRA request leaves the order collecting at the
request's store, paid online, with the request's items in the basket and the source reference filled —
and the wire shows one `LinkRequest` and no `AddItem`.

## Blocked by

None on the client. Server 880 is being built alongside; the stub is the contract.

## Open questions

- ~~Does the count block belong beside the caller card or under it?~~ **Under it** (decided while
  drawing). The rail is 260px and the card already carries six fields; a second column would have
  cost 135's compact layout the one property it is for. Under also says the true thing about
  ownership — a request belongs to the CALLER, arrives with them and leaves with them (880 §6).

## As built

**Proof:** 32 pure cases (`linked-request.test.ts`, 783 suite-wide) + `linked-request-drive.mjs`
**61/61** against the WIRED `/callcenter` with only the wire stubbed. Typecheck, lint and build green.

**The offer is the server's predicate, not a second copy of it.** `requestOffer` reads
`canLinkRequest` and inspects the basket **only** where that capability is absent (a pre-v1.11
server) — so *linkable ⇔ empty basket* has exactly one home, the server's. The count is also silent
once `header.linkedRequest` is set, because the card replaces it: one order converts at most one
request.

**The reason renders as its description or as NOTHING.** There is no `?? reason` fallback anywhere —
a `?? ` here would quietly re-invent the thing 880 §3 removed, and `TMRA` is asserted absent from the
picker's whole text.

**The skipped row is classified on what it can SAY**, not on the code's spelling: two readable
figures **and** a real shortfall (`requested > available`) — `belowAtpAsk`'s own rule, because *add
anyway* leads to that very sheet. Review caught the lossy half of the first cut: the code was being
dropped on below-ATP rows, so a refusal that happened to ship stock figures would have been drawn as
an offer with the server's own reason erased. The code now rides on **every** row, and the shortfall
clause is what keeps the offer honest.

**A landed add prunes its row** (`reportWithout`) — on ANY add of that item, not only the report's
own handle. The row's claim is *this did not land*; over a basket that now holds the line it would be
the console arguing with the receipt. The last row takes the banner with it.

**Where things ended up.** The count and the card are in the rail under the caller card; the picker
is a `Modal` (`RequestPicker`); the report is the console's third **in-the-flow banner**, beside
`RebindBanner` and `SwallowedBanner` — deliberately not inside the picker, because *add anyway* opens
the below-availability `<dialog>` and two open dialogs are two truths on one screen. `ConsoleBanner`
lost its tone-derived dismiss selector in the process: three banners over two tones means the tone
cannot pick a drive's handle.

**Deliberately not built here.** *Unlink* on the card (195 — it is a full undo that asks first, not a
control to bolt on), and the `REQUEST_ALREADY_CONVERTED` refusal (195). The picker's shut-gate
wording is a **guard, not the normal path**: the count block never offers a picker onto a shut gate,
so it covers only the door shutting under an open picker (an add in a second tab) — the two
unreachable reasons (`NO_CUSTOMER`, `ORDER_CLOSED`) were cut from the i18n rather than left as
plausible dead copy.

**Refused rows keep the console's own wording** (`request.report.refused.*` + an `unknown` that claims
nothing), the same posture `submitBlockers` takes: a raw server code is not a thing to read to a
caller, and an invented sentence for an unknown code would claim to know why.

**No re-read on the picker's open** (`staleTime: 60_000`, one read per caller). 195 rules that the
console must not pre-check the request — narrowing the window invites a reader to believe it was
closed — and the guard is the submit refusal.

`CONTEXT.md` gained three entries: **Sales request** (and why it is not a *request close*), **Linked
request**, **Skipped line**.

⚠ **BackOffice 880 is UNBUILT.** Both routes and the whole of contract v1.11
(`header.linkedRequest`, `capabilities.canLinkRequest`, `plantSource: fromLinkedRequest`) are stubbed
in the drive to 880's documented shape, said in the drive's own header. Against today's server the
read 404s and the rail is simply silent — the same silence a caller with no requests gets.
