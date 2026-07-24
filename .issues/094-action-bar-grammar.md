---
status: open
spec: 083
blocked-by: 092
---

# 094 — theActionBarReadsAsThreeClustersAndATerminalTier

## What to build

The flat row of eight buttons with a textarea attached becomes a bar with a **grammar**: three
labelled clusters in order of increasing consequence — which is also reading order — with the
destructive pair pinned at the end as a **tier, not a commit**.

| Order | Cluster | Label | Commands | Treatment |
|---|---|---|---|---|
| 1 | Fulfilment | shown | Reschedule · Change Store | `--fam-fulfilment` |
| 2 | Cancellation request | shown | Request Cancellation · Withdraw Request | `--fam-cancel-request` |
| 3 | Notes & docs | shown | Add Note… · Return Document | ghost |
| — | *terminal tier* | **none** | Force Cancel · Cancel Order | `--danger` outlined · `--danger` filled |

Every cluster holds exactly two commands, so the single-command-label case never arises. The terminal
tier is deliberately **unlabelled** — a label would make it read as a fourth family rather than as the
edge of the bar.

**The promoted-commit slot is permanently empty.** The terminal pair is the same button height as the
cluster buttons, distinguished by colour and position alone, and is **never enlarged**. No command on
this screen is a positive outcome, so there is no next step to promote; enlarging Cancel Order would
put a destructive mutation in the Save/Submit position. **073's prototype draws the reference's large
commit button with `Cancel Order` in it — that is the one thing this build must not copy.**

**The escape slot stays empty too.** Back is the band chevron (091); a page is not a modal. The safety
requirement is settled structurally rather than by warning: Back top-start, Cancel Order bottom-end,
as far apart as the page allows.

**Gating is evidence-only.** There are no state gates in the code to drive a promotion table off, by
design: `documentCategory` picks the endpoint and never decides whether a command is *offered*,
`deliveryType` gates nothing, and `status` is read only by the rail. Inventing the missing matrix
would re-implement server rules in the client. The server remains the authority on legality and says
so in its `400`. So: contextual **only** where live data proves a contradiction, static everywhere
else.

| Gate | Condition | Effect |
|---|---|---|
| Cancellation request open | `closeStatus === 'R'` (1/5 live docs) | **Request Cancellation** disabled + reason. Its inverse, **Withdraw Request**, is thereby the cluster's only enabled member — *that is the promotion*. Nothing grows, moves or changes colour. |
| BeyondBorder only | `deliveryDocumentType !== 'BB'` | **Return Document** disabled + reason. Unchanged from today. |

**Nothing is ever hidden.** A state-invalid or type-invalid command is **disabled with a reason** on
hover and focus; a transiently busy one (`commandBusy`) is **disabled with no reason** — the spinner
already reports it. A command that vanishes is a command an operator cannot discover, and a bar whose
contents shift between visits cannot be learned. Hiding is also this spec's scope boundary: a hidden
command cannot be invoked at all, which is behaviour. **No `More ▾`** — designed for ~30 POS commands;
at eight it hides a quarter of the bar to save nothing. Below the width where three clusters fit, the
cluster group **wraps** and the terminal pair stays pinned to the end.

**The note moves into the dialogs, and `pendingNote` dies.** The standing textarea is removed; every
command that posts a note captures it **inside its own confirm dialog**, exactly as
`RequestCloseDialog` already does for the cancellation reason. `Add Note…` becomes a dialog-opening
command, **always enabled**, whose dialog's confirm is disabled until the text is non-empty —
preserving today's real rule (an empty note is meaningless in an append-only log) at the place that
can now enforce it. Concretely, this slice deletes:

- **`pendingNote`** — it exists solely because Change Store had to snapshot the standing textarea when
  the picker opened. With no textarea there is nothing to snapshot, and the ambiguity goes with it.
  The note typed in the Change Store dialog is the note that posts.
- **The `!hasNote` gate** on `add-note` — its input is gone; the rule moves into the dialog.
- **The `CheckCircle2` icon on `close`** — a green check mark on Cancel Order is the exact confusion
  this grammar exists to remove.

**View-only is recorded as having no trigger, not as unbuilt** — there is no permission gating
anywhere in `features/oms/document/` and Deliveries carries no `accessProbe`, so minting one to
satisfy a borrowed grammar would be behaviour.

## Spine reach

component (rebuilt command bar + Add Note dialog) · page state (`pendingNote` deleted) · i18n ·
app-drive

## Proof (→ `tdd` red-green cycles)

- [ ] `commandGating` — from a captured payload, `closeStatus === 'R'` disables Request Cancellation
      with its reason and leaves Withdraw Request enabled; `deliveryDocumentType !== 'BB'` disables
      Return Document with its reason; busy disables everything **with no reason** · pure (vitest)

Verify by driving `npm run dev`: the three clusters read in consequence order, the terminal pair sits
at the end at the same height as every other button, Add Note…'s confirm stays disabled until text is
typed, and the note typed in the Change Store dialog is the one that posts. Plus `npm run typecheck`.

## Boundaries

**Endpoints, `actionType` codes and request bodies are untouched** — only *where the text is typed*
moves. i18n: the three cluster labels, the two disabled reasons, the Add Note dialog's title/label/
placeholder, and 072's cancel wording (Cancel Order · Force Cancel · Request Cancellation · Withdraw
Request) are new or renamed keys; `command.note` and `command.notePlaceholder` retire with the
textarea.

## Done when

The action bar renders as three labelled clusters plus an unlabelled terminal pair on every captured
document; no command is ever hidden; every disabled command except a busy one explains itself;
`pendingNote` and the standing textarea are gone from `DocumentDetailsPage`; and Cancel Order no
longer wears a check mark.

## Blocked by

[092](092-summary-rail-cards.md) — the bar lands last of the regions, once the page's layout is
settled, because it is the only region whose change deletes state elsewhere in the page.
