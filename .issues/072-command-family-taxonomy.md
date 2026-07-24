---
type: wayfinder-ticket
wayfinder: grilling
map: 068
status: done
blocked-by: —
---

# 072 — The command-family taxonomy

## Question

The POS theme colours buttons by **function family** — `--fam-sales`, `--fam-insurance`,
`--fam-loyalty`, `--fam-fulfil`, `--fam-admin` — and the prototype's action bar clusters buttons by
that family. The owner ruled families map to *our command families*, not to nav areas. So: what are
our families, and which command belongs to which?

Our eight document commands (`src/features/oms/document/actions.ts` — `CommandKind`):
`add-note` · `close` · `force-close` · `cancel-close-request` · `change-store` · `reschedule` ·
`request-close` · `return-document`.

Settle:

- **The family list.** Five POS families exist; we may need fewer, or differently-named ones. A
  back-office has no "sales" family (no selling happens here) and arguably no "loyalty". Candidates:
  fulfilment (reschedule, change-store), order lifecycle / close (request-close, close, force-close,
  cancel-close-request), annotation (add-note), reverse-flow (return-document). Name them in
  `CONTEXT.md` vocabulary — this is domain language, so `/domain-modeling` applies.
- **The assignment.** Every command to exactly one family. A command that plausibly sits in two is
  a signal the families are wrong.
- **The colour per family** — drawn from the POS `--fam-*` set, or a stated reason for a value not
  in it. Note `--fam-insurance` is already spoken for by the prototype's e-Rx / prescription card
  accent, so reusing it for an unrelated family would collide.
- **The quiet tier.** The prototype renders "Stock & docs" as `ghost` (outlined, no family colour)
  because those actions are frequent but low-stakes. Which of ours, if any, are quiet rather than
  coloured — and is `add-note` quiet or its own family?
- **Reach beyond this screen.** Deliveries, Sim (Clear Cache) and BBY have actions too. Does the
  taxonomy claim them now, or is it document-scoped with a stated extension path? Deciding it is
  document-only is a fine answer — say so explicitly so 070's family tokens aren't over-designed.

The answer is a table (family · colour token · commands · rationale) recorded in this ticket, and any
new vocabulary added to `CONTEXT.md`.

## Answer

Approved by the owner, 2026-07-24, against
[assets/072-command-families.html](assets/072-command-families.html) (rev 2).

### The correction that reshaped the answer

**"Close" means cancel.** `request-close` opens `RequestCloseDialog`, which picks from
`CANCEL_REASONS` ("Customer requested cancellation", "Item out of stock", …); the dialog hint reads
*"Pick a cancellation reason."* So all four close-commands are cancellation commands.

The consequence is structural, not cosmetic: **none of our eight commands is a positive outcome.**
A till has "Customer Received ✓" because the till completes the happy path; this back office only
touches the unhappy one — orders complete in the field, never from this screen. There is therefore
**no green commit slot to colour**, and `--success` earns no button on this screen at all (it appears
only in the status rail). The end of our action bar is terminal, and it is red.

Rev 1 of the prototype got this wrong and painted Close Order green with a check mark. The same
confusion is live in the code today: `CommandPanel.tsx:34` pairs `close` with a `CheckCircle2` icon.
**That icon is a defect the build must fix.**

### The taxonomy

| Family | Token | Value | Commands | Rationale |
|---|---|---|---|---|
| **Fulfilment** | `--fam-fulfilment` | `#2E7D5B` (POS `--fam-fulfil`) | `reschedule`, `change-store` | Changes **when** or **where** the order is served without touching whether it lives. Fully reversible. The only family whose members keep the order alive. |
| **Cancellation request** | `--fam-cancel-request` | `#5D5A93` (POS `--fam-admin`) | `request-close`, `cancel-close-request` | The round-trip *about* cancelling — raising the ask and withdrawing it. Neither cancels anything itself and each undoes the other, so it is a reversible pair. Indigo, not red: **asking is not doing.** |
| **Quiet** | *none* — `ghost` | outlined, `--ink-2` on `--border-strong` | `add-note`, `return-document` | Frequent and low-consequence. A note appends to the audit log and changes no state; Return Document posts nothing at all today. Colour here would spend attention on the two commands that need none. |
| **Terminal end** | `--danger` filled + `--danger` outlined | `#C23B41`, text `--danger-800 #8E2A2F` | `close`, `force-close` | **Not a family — a tier.** The two commands that end the order, pinned to the far edge and larger. Both destructive, so both red; the override is separated by **weight** (outlined, not filled) rather than by a second, louder red. Two filled reds read as equal alternatives and were rejected. |

Every command lands in exactly one place; nothing sits in two.

### The rulings

1. **Colour carries function, not stakes.** Stakes are carried by the *tiers* the grammar already
   provides (escape at the start, quiet in the clusters, terminal at the end). A stakes-coloured bar
   is three reds shouting at once, and — worse — a button's colour would change between visits as
   document state moves. A token that shifts meaning per row is not a design system.
2. **`return-document` is quiet, not a "reverse-flow" family.** It posts nothing today. The obvious
   third colour would be POS teal `--fam-insurance` `#0B7C8C`, but that teal is the prescription /
   e-Rx accent on this same screen and would collide. If Return Document grows real behaviour it
   graduates to a family *then*, with the collision in view.
3. **`force-close` is a tier member, not a Cancellation-request member.** It belongs beside
   `close`, so the end of the bar means exactly one thing: this order stops here.
4. **Document-scoped, with one stated extension rule.** Deliveries, BBY Inquiry and Sim (Clear Cache)
   inherit the *grammar* — escape at the start, quiet tier, terminal end — but **no family colour**,
   because none of their actions form a family. A new family colour is minted only when a screen has
   **two or more commands sharing a purpose**. This is what stops 070 over-designing the token set.

### Labels — renaming accepted into this effort

"Close Order" reads as *complete* to anyone not told otherwise. The accepted label set:

| `CommandKind` | today | becomes |
|---|---|---|
| `close` | Close Order | **Cancel Order** |
| `force-close` | Force Close | **Force Cancel** |
| `request-close` | Request Close | **Request Cancellation** |
| `cancel-close-request` | Cancel Close Request | **Withdraw Request** |

This is **copy only** — `src/locales/en/document.json` `actions.*`. The `CommandKind` identifiers,
the `actionType` codes and the endpoints are untouched; renaming them would be command *behaviour*,
which map 068 rules out of scope. Field labels that carry the same confusion (`closeStatus` →
"Close Status") are **073's**, not this ticket's — see the note left there.

### What this hands to 070

Three token additions, all POS values under our names:

- `--fam-fulfilment: #2E7D5B`
- `--fam-cancel-request: #5D5A93`
- `--danger-800: #8E2A2F` (the outlined override's text)

And three **not** ported: `--fam-sales`, `--fam-loyalty`, `--fam-admin` — a back office sells
nothing, runs no loyalty tier, and "admin" names a nav area rather than a command family.
`--fam-insurance`'s *value* survives only as the prescription accent, under a name 073 gives it.

Separately, the status pill rail needs a **fifth severity** the POS reference never used — `bad`
(`--danger` / `--danger-050` / `--danger-border`), for a cancelled order. POS has four (ok / go /
warn / mute) because a till has no cancelled state; we do.
