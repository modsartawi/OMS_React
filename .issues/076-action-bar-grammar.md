---
type: wayfinder-ticket
wayfinder: grilling
map: 068
status: done
blocked-by: 072, 073
---

# 076 — The action-bar grammar for our eight commands

## Question

The prototype's grammar is fixed: **escape bottom-left · family clusters in the middle · the state's
promoted "next step" as a large commit button bottom-right**, with rarely-touched actions folded into
a `More ▾` overflow, and the whole cluster suppressed in view-only. It is designed for ~30 POS
commands; we have eight. Apply it.

Settle:

- **The escape.** The prototype's bottom-left escape is "✕ Close" — *dismiss the screen*. Ours is a
  back-link to `/oms/deliveries`, and confusingly our `close` command means **close the document**,
  a real mutation. Those two must not look alike. Decide the escape's identity and make sure a
  destructive `close`/`force-close` can never be mistaken for "leave this page".
- **The promoted commit, per state.** The heart of this ticket: for each document state, which single
  command is the promoted next step? Drive it off the real gates already in the code — the
  `documentCategory` / `deliveryType` / `status` fields and the `returnEnabled` BB gate — and produce
  a state → commit table. States where **no** command is promoted (nothing obvious comes next) must
  be allowed; the prototype's view-only state proves the bar can be near-empty.
- **Clusters from 072.** Which families appear as clusters, in what order, and whether a
  single-command family still gets a cluster label.
- **The overflow.** With eight commands, does `More ▾` earn its place at all? If the bar fits in one
  row without it, adding it is borrowed complexity.
- **Disabled vs hidden.** The legacy POS screen *hides* invalid commands; our `CommandPanel` today
  disables during `commandBusy`. Decide the rule for each: state-invalid (hide?) vs transiently-busy
  (disable). Hiding is what the prototype does and it is the more scannable choice — but a command
  that vanishes is a command an operator can't discover.
- **The note field.** 073 places it; this ticket decides its *behaviour* in the new grammar — which
  commands consume it, whether it's always visible or revealed by the commands that need it, and how
  `pendingNote` (captured when Change Store opens) survives the rearrangement.
- **The dialogs.** Reschedule / Change Store / Request Close open modals. Confirm the bar just
  triggers them unchanged — this map does not touch command behaviour.

Record the state → commit table and the cluster layout in this ticket. Deliverable is the decision;
the prototype in 073 renders it.

## Answer

Approved by the owner, 2026-07-24, via `/grilling` against the code and 078's five live payloads.

### The finding that reshaped the ticket

**There are no state gates in the code to drive a table off.** The ticket's instruction — derive the
promoted commit from "the real gates already in the code (`documentCategory` / `deliveryType` /
`status` / `returnEnabled`)" — assumed gates that do not exist. `CommandPanel.tsx:22-26` says so as a
deliberate stance:

> the gating is deliberately thin — busy, note-presence (Add Note) and the BB check (Return
> Document). There is **no status-based gating**: the server decides what is legal for a document and
> says so in its `400` message. Second-guessing that here would mean re-implementing its rules in the
> client and drifting from them.

Checked field by field:

- **`documentCategory`** picks the `actionType` and the mutation endpoint (`actions.ts:100`). It never
  decides whether a command is *offered*.
- **`deliveryType`** gates nothing anywhere in the feature. It was named in the question in error.
- **`status`** is read only by the pill rail (079). No command consults it.
- **`returnEnabled`** is the one real gate, and it is not a state gate — it is a document-*type* gate
  (`deliveryDocumentType === 'BB'`, `DocumentDetailsPage.tsx:274`).
- **`!hasNote`** is the other, and 073 killed its input when it retired the textarea.

Inventing the missing matrix would be re-implementing server rules in the client — precisely what the
code refuses, and what this map lists as out of scope ("any change to document command **behaviour**").
Sourcing the real matrix from the WPF `DocumentDetailsController` was offered and **rejected**: it
would block this ticket behind new research for a table the screen does not need.

### The ruling: evidence-only gating

The bar is contextual **only where the live data proves a contradiction**, and static everywhere else.
The server remains the authority on legality.

### State → commit table

| Document state | Evidence | Promoted | Demoted |
|---|---|---|---|
| `closeStatus === 'R'` — a cancellation request is open | `8000000174` (1/5 live docs) | **Withdraw Request** | **Request Cancellation** → disabled + reason |
| every other state | `2000000551`, `8000000121`, `8000000253`, `9000000003` (4/5) | **— none —** | — |

Plus one standing non-state gate, unchanged from today:

| Gate | Field | Effect |
|---|---|---|
| BeyondBorder only | `deliveryDocumentType !== 'BB'` | **Return Document** → disabled + reason |

**Promotion needs no new visual axis.** In the one gated state, disabling Request Cancellation leaves
Withdraw Request as the only enabled member of its cluster — that *is* the promotion. Nothing grows,
changes colour, or moves. The two commands are literal inverses, so offering both as equally takeable
is incoherent no matter what the server would accept; this is the one place the client can say
something true without guessing.

Four of five live documents promote nothing, which the ticket explicitly allows and the reference
device's view-only state already proves the bar can survive.

### The grammar, settled

**1 · The escape slot stays empty.** Back remains the chevron in 073's identity band; the bar is
*clusters · terminal-end* only. A page is not a modal — there is nothing to escape from in the bar,
and navigation must stay put whether or not any command is available. This also settles the ticket's
safety requirement structurally rather than by warning: Back sits **top-start**, Cancel Order sits
**bottom-end** — maximum physical separation between "leave this page" and "destroy this order".
073's "do not ship both" is honoured — the band chevron is the only Back.

**2 · The promoted-commit slot is permanently empty on this screen.** The terminal pair is pinned at
the end as a **tier, not a commit** — same button height as the cluster buttons, distinguished by
colour and position alone, never enlarged. This is the truthful reading of 072's central finding: no
command here is a positive outcome, so there is no next step to promote. Enlarging Cancel Order would
put a destructive mutation in the Save/Submit position and teach muscle memory that cancelling is
what one does on this screen. 073's prototype drew the reference's large commit button; **that is the
one thing the build must not copy.**

**3 · Nothing on this bar is ever hidden.** One rule for the whole bar:

| Cause | Treatment |
|---|---|
| state-invalid / type-invalid | **disabled + a reason** on hover and focus |
| transiently busy (`commandBusy`) | **disabled, no reason** — the spinner already reports it |

The legacy POS screen hides invalid commands and the reference prototype follows it; we do not. A
command that vanishes is a command an operator cannot discover, and a bar whose contents shift between
visits cannot be learned. Hiding is also the boundary case for this map's scope line — a hidden
command cannot be invoked at all, which is behaviour; a disabled one is arrangement. 073 already
rendered Return Document as `inert` rather than absent, arriving at this independently.

**4 · No `More ▾`.** The overflow was designed for the reference's ~30 POS commands. At eight it
would hide a quarter of the bar behind a click to save nothing, and it contradicts rule 3. Below the
width where all three clusters fit, the **cluster group wraps** to a second line and the terminal
pair stays pinned to the end. Every command is visible at every width.

**5 · The clusters, confirmed as 073 rendered them** — 072's taxonomy laid out unchanged:

| Order | Cluster | Label | Commands | Treatment |
|---|---|---|---|---|
| 1 | Fulfilment | shown | Reschedule · Change Store | `--fam-fulfilment` `#2E7D5B` |
| 2 | Cancellation request | shown | Request Cancellation · Withdraw Request | `--fam-cancel-request` `#5D5A93` |
| 3 | Notes & docs | shown | Add Note… · Return Document | ghost |
| — | *terminal tier* | **none** | Force Cancel · Cancel Order | `--danger` outlined · `--danger` filled |

Every cluster holds exactly two commands, so the ticket's single-command-label edge case never
arises and needs no rule. The order runs least- to most-destructive, start to end, which is also the
reading order. The terminal tier is deliberately unlabelled — a label would make it read as a fourth
family rather than as the edge of the bar.

**6 · The note.** 073's ruling stands and this ticket closes out its consequences: the bar carries
**no text input**, and every command that needs a note captures it inside its own confirm dialog, as
`RequestCloseDialog` already does for the cancellation reason. `Add Note…` is a dialog-opening
command, not an instant post; it **always renders enabled**, and its dialog's confirm is disabled
until the text is non-empty — preserving today's real rule (an empty note is meaningless in an
append-only log) at the place that can now enforce it.

**7 · The dialogs are untouched.** Reschedule, Change Store and Request Close open their existing
modals unchanged. The bar only triggers them. Confirmed as the ticket asked.

### View-only: inapplicable, not specified

The reference suppresses the whole cluster group in a view-only state. **We have no such state** —
there is no permission gating anywhere in `features/oms/document/`, and Deliveries carries no
`accessProbe` (`layout/menu-model.ts`), so the screen is reachable only by users who may act on it.
Minting a permission gate to satisfy a borrowed grammar would be behaviour, and is out of scope. The
suppression rule is recorded as **having no trigger**, not as unbuilt.

### What the build must change

Beyond rendering the above:

- **Delete `pendingNote`** (`DocumentDetailsPage.tsx:104`, `:268`) — it exists solely because Change
  Store had to snapshot the standing textarea when the picker opened. With no textarea, it has nothing
  to snapshot.
- **Delete the `!hasNote` gate** (`CommandPanel.tsx:59`) — its input is gone; the rule moves into the
  Add Note dialog.
- **Fix the `CheckCircle2` icon on `close`** (`CommandPanel.tsx:34`) — 072 already flagged it as a
  defect; a check mark on Cancel Order is the exact confusion this whole grammar exists to remove.
- **Add reason strings** for the two disabled causes (cancellation-request-already-open, BB-only) to
  `src/locales/en/document.json` — new user-visible copy, so zero-literal applies.

## Comments

**From [073 — The reworked layout, filled with our real fields](073-detail-layout-with-our-data.md)
(done):** three things land on this ticket.

1. **The escape-start slot is empty on this screen.** 073 put Back as a chevron at the start of the
   identity band, where navigation stays put whether or not any command is available. 072's grammar is
   *escape-start · clusters · terminal-end*, but a page is not a modal — there is nothing to escape
   from in the bar. Either confirm the slot stays empty, or claim it back and remove the band chevron;
   do not ship both.
2. **`Add Note…` now opens a dialog.** 073 retired the standing note textarea: the note is captured at
   the moment of commit, inside each command's own confirm dialog, exactly as `RequestCloseDialog`
   already does for the cancellation reason. So the bar carries **no text input** and `add-note` is a
   dialog-opening command like `request-close`, not an instant post. This also deletes
   `DocumentDetailsPage`'s `pendingNote` state, which exists solely because Change Store had to
   snapshot the note as it read when the picker opened.
3. **The clusters 073 rendered**, for you to confirm or re-cut: *Fulfilment* (Reschedule · Change
   Store), *Cancellation request* (Request Cancellation · Withdraw Request), *Notes & docs* (Add Note…
   · Return Document, both ghost), with the terminal pair pinned at the end — Force Cancel outlined,
   Cancel Order filled. That is 072's taxonomy laid out; the **contextual disclosure** (which cluster
   appears in which document state) is still entirely yours.
