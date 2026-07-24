---
type: wayfinder-ticket
wayfinder: grilling
map: 068
status: done
blocked-by: 078
---

# 079 — Status value → severity mapping for the pill rail

## Question

073 picked the **six** statuses promoted to pills — Ready · Availability · Approval · Payment ·
Delivery · Cancellation — and everything around the mapping is now settled except the mapping itself:

- 072 fixed the severity palette at **five**: `ok` · `go` · `warn` · `bad` · `mute`. Inventing a sixth
  is out.
- 070 gave all five full token tiers (`-050` ground, `-border`, `-800` ink), so the rail is a lookup,
  not a design.
- 071 gave every tier a dark twin, so the mapping is chosen **once** and serves both themes.

What remains is a table: for each of the six statuses, **which coded values map to which severity**.

Settle:

- **The table itself** — six statuses × their coded value sets → one of five severities.
- **The default.** 073's interim rule is *unknown code ⇒ `mute`*, blank ⇒ `mute` with an em dash. Keep
  it, or does an unrecognised code deserve `warn` (it is, after all, a state the UI does not understand)?
- **Whether severity is per-status or global.** Does `deliveryStatus: 'DLV'` (delivered) get `ok` while
  `paymentStatus: 'PND'` gets `warn` — i.e. each status has its own opinion of what "good" means — or
  is there one shared code→severity map across all six? A per-status table is more honest and more
  rows; a shared map is smaller and will lie somewhere.
- **Where the table lives.** `src/core/constants/oms-codes.ts` carries a standing warning: an earlier
  version held Screen 1 code maps that **never once fired on live data** and were deleted under 406.
  This map is different — it maps to *severity*, which no server field carries, so it cannot be
  resolved server-side. Say that explicitly in the file, or the next reader deletes it for the same
  reason.
- **`bad` needs an owner.** 072 minted it for "a cancelled order" — confirm which status and which
  value actually produces it. If no coded value ever maps to `bad`, the severity is dead and should be
  said so rather than left waiting.

## Blocked on

**078** — the coded value sets are unknown while SIS.Api is down. Any table written before the capture
is invention, which is exactly what 073 refused to do.

## Comments

**From [078 — Capture live document payloads](078-live-document-payload-capture.md) (in progress,
2026-07-24):** the first two live payloads widen this ticket. It no longer owns only the value →
severity mapping; **it owns whether the six-status rail survives contact with real data.**

On `8000000253` (a delivered ecommerce delivery) only `readyStatus` and `deliveryStatus` carry a value.
On `9000000003` (a delivery return) **all six are `""` or `null`, and so is `overallStatus`.** 073 chose
its six against a synthetic payload where all six were populated; the rail as specified renders two
pills on one real document and none at all on the other.

So this ticket must also settle:

- **Does an empty rail render?** A rail of six em-dashes is worse than no rail. Options: variable-length
  (only populated statuses become pills), a fixed six with explicit "not set" mutes, or a different six.
- **Is `lastAction` promoted after all?** It is the one status populated on *both* documents
  (`DDLR` → "Delivered", `TRDY` → "TRDY"). 073 demoted it as history rather than lifecycle. On this
  evidence it may be the most reliable signal the payload carries — and the Log tab it was deferred to
  is one click away, not zero.
- **`statusHistory` is not the fallback.** `["T","T","R","D"]` on one document, `[null, null]` on the
  other. Whatever it is, it is not a progress narrative we can render.
- **"Has a `*Description` companion" is a weaker test than 073 assumed.** `lastActionDescription`
  returns `"TRDY"` and `documentTypeDescription` returns `"ORRT"` — the companion exists and echoes the
  code. Any status promoted on the strength of having a companion needs the companion checked for
  *content*, not just presence.

None of this is answerable on two documents, both of which are in a terminal state. The e-Rx, express
and cancelled captures 078 still owes are what show whether these statuses populate mid-flight and go
quiet at the end, or simply are not maintained on this estate at all.

**From [078 — Capture live document payloads](078-live-document-payload-capture.md) (done, five
payloads):** the earlier comment stands and hardens. Across five real documents the six-status rail
renders **2, 0, 2, 2 and 0 pills**, and two of the six are **never populated on any of them**:

- `availabilityStatus` — `null` on all five. Promoted by 073 as "the single most common cause of the
  unhappy path"; the field behind it does not exist in practice.
- `paymentStatus` — `""` on all five.

The two 073 demoted are the two that carry the state: **`lastAction` populated 5/5** (resolving 4/5 —
`TRDY` echoes its code) and **`consignmentStatus` populated 4/5** with values `D`·`C`·`R`·`S` that look
like a real lifecycle — though it still has no `*Description` companion, which is why 073 disqualified
it. That trade (a populated code with no label vs. a labelled field that is always empty) is the
central question this ticket now answers.

Values in hand for the mapping: `readyStatus` `R` "Ready" · `deliveryStatus` `D` "Delivered" ·
`closeStatus` `R` "Close Requested" · `approvalStatus` `A` "Approved" · `overallStatus` `C` ·
`consignmentStatus` `D`·`C`·`R`·`S` · `controlStatus` `S` · `lastAction`
`DDLR`·`TRDY`·`DRCL`·`XRDY`·`DRSC`. Still one observed value each for most — enough to see the shape,
not enough to write a closed map. Say which are covered and which default.

**`bad` has an owner after all:** `closeStatus: 'R'` → "Close Requested" on `8000000174`. Whether a
*requested* cancellation is `bad` or `warn` — with `bad` reserved for one that has been *executed* — is
yours to decide; 072 minted `bad` for "a cancelled order", and a request is not yet one.

**One more thing landed here from 078:** the Payment card's "Payment type" row. Coded `paymentType` is
`C` on all five documents — useless — but two captures carry a **header-level condition**
(`condDocumentLine: 0`) with `cardType: "Visa"`, `paymentMethod: "ApplePay"` and a payment
`referenceNumber`. That is the real instrument, resolved server-side, needing no map. Decide whether
the card reads the header condition first and falls back to raw `paymentType`.

## Answer

Settled with the owner 2026-07-24, against the five payloads filed by
[078](assets/078-document-payloads/). This ticket was widened twice by 078 and ends up owning three
things: the rail's **composition**, its **severity mapping**, and the Payment card's **instrument row**.

### 0 · The finding that decides the shape of everything below

**`'R'` means two opposite things on the same document.** On `8000000174`, `readyStatus: 'R'` is
"Ready" and `closeStatus: 'R'` is "Close Requested". One is a milestone reached, the other is an
outstanding request to abandon the order.

So the severity map is **per-status, never global**. That was listed as an open question; it is now
evidence, not preference. A single shared code→severity table cannot be written without lying on a
document we already hold.

### 1 · Composition — the rail renders what is set

**The fixed six is dropped.** 073 chose six statuses against a synthetic payload where all six were
populated; on five real documents that rail renders **2, 0, 2, 2 and 0** pills, and two of the six
(`availabilityStatus`, `paymentStatus`) are populated on **none** of them.

The rule replacing it:

> A pill renders for **every described status that carries a value**. Blank and `null` produce no
> pill at all — not a muted one, not an em dash.

The candidate set is all **eight** statuses with a `*Description` companion, in lifecycle order:

`readyStatus` → `availabilityStatus` → `approvalStatus` → `paymentStatus` → `deliveryStatus` →
`clearStatus` → `acceptanceStatus` → `closeStatus`

073's six were a subset of these; the two it excluded (`clearStatus`, `acceptanceStatus`) rejoin, not
because they matter more than 073 judged but because **selection is no longer doing any work** —
emptiness filters the rail, so an unused status costs nothing and a status that starts populating
appears on its own without a code change. `availabilityStatus` and `paymentStatus` stay in the set for
the same reason: they are not wrong, they are unused on this estate, and the rail now says so by
omission.

**`closeStatus` still renders under the label "Cancellation"** — 073's relabel, copy-only, unchanged.

What the rule produces on the five captures:

| Document | Rail |
|---|---|
| `8000000253` | `Last action Delivered` · **Ready** · **Delivery: Delivered** |
| `8000000174` | `Last action Close Requested` · **Ready** · **Cancellation: Close Requested** |
| `2000000551` | `Last action Prescription Ready` · **Ready** · **Approval: Approved** |
| `8000000121` | `Last action Rescheduled` |
| `9000000003` | `` Last action `TRDY` `` |

### 2 · `lastAction` is the rail's anchor, and it is not a pill

`lastAction` is populated **5/5** — the only field on the payload that answers "what happened to this
document" on every capture. 073 demoted it to the Log tab as history rather than lifecycle. That
reading is upheld; its **placement** is not.

- It renders **first on the rail, always**, labelled *Last action*.
- It is a **neutral outline** — `--border-strong` hairline, `--ink-2` text, no ground, no dot. It never
  takes a severity colour, on any value. It reports; it does not judge.
- That visual difference is the whole point: history and lifecycle sit on one line without one being
  mistaken for the other.
- It **guarantees the rail is never empty** — the two documents with zero lifecycle statuses still get
  a line that says something true.

**When the companion echoes the code, say so.** `lastActionDescription` returns `"TRDY"` on
`9000000003` — the companion exists and is worthless there (1 of 5). Rule: when
`lastActionDescription` is blank **or equal to `lastAction`**, render the raw code in **monospace**,
exactly as 073's `overallStatus` lozenge does. Monospace is the screen's established signal for *this
is a code, not a word*. The same test applies to any status pill whose companion echoes its code.

### 3 · The severity table

Five severities from 072 — `ok` (green, `--success`) · `go` (blue, `--primary`) · `warn` (amber,
`--attention`) · `bad` (red, `--danger`) · `mute` (grey). Their meanings, fixed here so the table is
derivable rather than memorised:

| Severity | Means |
|---|---|
| `ok` | this stage is **complete and went well** |
| `go` | this stage is **actively in motion** |
| `warn` | this stage **needs a human** |
| `bad` | this stage **ended badly**, terminally |
| `mute` | **not recognised** — the code is real, its meaning is not ours to assert |

The table, containing **only codes observed on live data**:

| Status | Code | Description | Severity | Why |
|---|---|---|---|---|
| `readyStatus` | `R` | Ready | **`ok`** | The document is prepared. Milestone reached. |
| `approvalStatus` | `A` | Approved | **`ok`** | Cleared. |
| `deliveryStatus` | `D` | Delivered | **`ok`** | The happy terminal state. |
| `closeStatus` | `R` | Close Requested | **`warn`** | An outstanding request a human must action. Not `bad` — see below. |
| `availabilityStatus` | — | — | — | No value observed on any document. |
| `paymentStatus` | — | — | — | No value observed on any document. |
| `clearStatus` | — | — | — | No value observed on any document. |
| `acceptanceStatus` | — | — | — | No value observed on any document. |

**Four rows. That is the honest extent of what five documents support**, and writing a fifth would be
the invention 073 refused and 406 punished.

**`go` and `bad` are both unowned on the rail today** — every observed value is `ok` except one `warn`.
Neither is dead: 072 minted `bad` for a cancelled order and 073 already spends `--danger` on the
failed-jobs tab count; `go` is the in-motion colour a mid-flight `deliveryStatus` will take the moment
one is captured. They are **defined and unused**, which is a different thing from wrong, and the table
says so rather than filling them to look complete.

**`bad` awaits an *executed* cancellation.** A requested close is an outstanding decision, not a
finished one — amber. `bad` is reserved for a cancellation that has actually gone through. No captured
document shows one.

### 4 · The default, and why this map is safe where 406's were not

**Unmapped code ⇒ `mute`.** 073's interim rule stands, and `warn` was considered and rejected: an
unrecognised code is the *UI's* ignorance, not the *document's* problem, and defaulting to amber makes
the rail cry wolf every time the server adds a code.

073's other half — *blank ⇒ mute with an em dash* — is **retired**. Under §1 a blank status produces no
pill, so there is nothing to mute.

The reason this table does not repeat the 406 mistake, stated plainly because the next reader will
reach for the delete key:

> **The map never supplies a word.** The pill's label always comes from the server's `*Description`
> companion. This map supplies only a **colour**. A missing entry therefore costs a colour and nothing
> else — the pill still renders, still reads correctly, still says the right thing, just in grey.
>
> The 406 maps were deleted because a missing entry rendered a **raw code to the operator**, and
> because the server already resolved what they were resolving. Severity is not on the payload; no
> server field carries it; it cannot be resolved server-side. Different failure mode, different
> justification.

That paragraph goes in the file header, not just in this ticket.

**Where it lives:** `src/features/oms/document/status-severity.ts` — **feature-local, not
`core/constants/oms-codes.ts`**. The pill rail exists on one screen; a presentation lookup used by one
feature does not graduate to `core/` ([feature-structure](../.claude/rules/feature-structure.md) —
shared code moves up when a *second* consumer appears, not in anticipation of one). Keeping it out of
`oms-codes.ts` also keeps it away from that file's standing deletion warning, which it does not deserve
and would eventually attract.

### 5 · `consignmentStatus` stays off the rail — for a better reason than 073 gave

073 disqualified it for having no `*Description` companion. It is populated **4/5**, which made that
look like squeamishness. Lined up against `lastAction` it looks like something else:

| Document | `lastAction` | `consignmentStatus` |
|---|---|---|
| `8000000253` | `DDLR` Delivered | `D` |
| `8000000174` | `DRCL` Close Requested | `C` |
| `2000000551` | `XRDY` Prescription Ready | `R` |
| `8000000121` | `DRSC` Rescheduled | `S` |
| `9000000003` | `TRDY` *(raw)* | `null` |

Four for four, the letter tracks the outcome of the last action. If that holds, `consignmentStatus` is
not *an unlabelled field we are refusing to label* — it is **an unlabelled echo of a field that is
labelled and already on the rail**, and promoting it would put the same fact on screen twice, once in
words and once in a letter.

**Four pairs is a hypothesis, not a proof**, and it is recorded as one. It does not need to be true for
the ruling to hold — 073's original reason is sufficient — but it is the reason worth writing down,
because it explains why the field is populated *and* worthless to us rather than merely awkward.
`controlStatus` (`S`, 1/5) and `notificationStatus` (blank 5/5) are unchanged: no companion, no promotion.

All three keep their rows in the **All statuses (13)** disclosure, where an em dash is correct because
the disclosure's job is completeness.

### 6 · The Payment card's instrument row

073's Payment card reads coded `paymentType`. It is `"C"` on all five documents — one value, no
description companion, no map worth writing.

The captures found the real instrument elsewhere: `8000000174` and `8000000121` carry a **header-level
condition** (`condDocumentLine: 0`) with `cardType: "Visa"`, `paymentMethod: "ApplePay"` and
`referenceNumber: "ref_892347873643"`. Server-resolved, human-readable, no map needed.

**The row reads the condition first and falls back to `paymentType`:**

1. The **first condition with a non-blank `cardType` or `paymentMethod`** → render
   `paymentMethod · cardType` (`"ApplePay · Visa"`).
2. Otherwise the raw `paymentType`.
3. Text row, so [073's row rule] omits it when both are blank.

**Do not key on `condType`.** On both captures the payment fields ride on the **`DFEE` (Delivery Fees)**
condition, which is plainly incidental — the instrument has nothing to do with delivery fees, and a
lookup keyed on `DFEE` would break the first time it moves. Scan for the *fields*, not the type.

`referenceNumber` (the payment reference) is **not** added to the card. It is a support-desk lookup key,
not something an operator reads at a glance, and it is already visible on the Header Conditions tab.

### 7 · What this changes in 073, and what it does not

**Changed:** the rail's contents and its emptiness behaviour (§1), `lastAction`'s placement (§2), and
the Payment card's instrument row (§6).

**Untouched:** the layout, the identity band, the five rail cards and their emptiness rules, the four
tabs, the retirement of the note textarea, `--prescription`, the chrome placement, and the items table.
None of them depended on which statuses are populated.
[073's prototype](assets/073-detail-layout.PROTOTYPE.html) is still the approved device; its pill rail
is the one region now superseded, and the spec takes this ticket's rail over the prototype's.
