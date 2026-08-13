---
status: open
spec: 267
blocked-by: 269
---

# 272 — One button corrects an entry, and the audit reads as one column of time

## What to build

Two surfaces on 269's account, both about a mistake already made.

### The correction — one button whose meaning the entry decides

The rule is the server's; the **interaction** is this ticket's, and the answer is that the screen
**never offers both acts**:

| entry state | the one button |
|---|---|
| untouched (`OPEN`, remaining == amount) | **Cancel this entry** |
| partly consumed | **Write off the remaining 400.000**, with the reason it cannot be cancelled beside it |

A menu offering both is a menu on which someone eventually cancels a consumed entry.

Three things ship with it, all load-bearing:

1. **The journal stays on screen, unchanged, under the act.** What a write-off does *not* touch — a
   receipt already in a collector's hands is never retro-voided — is more convincing shown than
   asserted.
2. **"Changing the amount is not offered at all"** is said out loud beside the button, because its
   absence is otherwise indistinguishable from an oversight.
3. 🔑 **The cancel must handle losing the race.** The server's `remaining == amount` predicate sits
   **inside its UPDATE**, so a till that consumed a millisecond earlier wins. Come back with *"a till
   consumed part of this — here is the new remaining. Write off the rest instead?"* and the write-off
   in reach. **Never an error toast**: a refusal arrives as a 200 with `accepted: false` and a true
   remaining, and rendering it as a failure teaches the accountant to distrust a screen that is
   working correctly.

### The audit pane — the authz pane's shape, none of its storage

A projection of the entry and its consumptions into **one column of time**: posting, consumption,
void, repair and correction rendered as the same kind of fact.

- ⚠ **Store nothing in the authz audit table and read nothing from it.** Its timestamps are UTC,
  every settlement timestamp is local, and mixing them puts a three-hour lie beside a branch
  manager's own row in the same list. Borrow the layout only.
- **"From where"** renders the **store code** for a consumption (*which branch spent this* is a real
  audit question) and the **poster's name** for a posting. There is no address, no IP, and no
  `PostedFrom` field to bind — a browser IP on an internal app names a desk, not a person, and the
  person is already on the row.
- Reversals appear as **restorations**, consistent with 269.

## Spine reach

A mis-posted entry can be withdrawn or written off, and every act against a branch can be read in
order.

## Proof

- [ ] An untouched entry offers **only** Cancel; a partly-consumed one offers **only** the write-off,
      with its reason stated.
- [ ] Unit test on the correction decision — which single button, from status and remaining, across
      all four statuses.
- [ ] 🔑 A cancel that loses the race renders the *"a till consumed part of this"* recovery with the
      **new remaining**, and the write-off completes from there. (Force it: cancel an entry whose
      fixture/stub returns `accepted: false`.)
- [ ] A `CANCELLED` and a `CLOSED_OUT` entry offer **no** correction button at all.
- [ ] The journal is visible **during** the correction, and unchanged after a write-off.
- [ ] The audit pane orders posting, consumption, void and repair by their own local timestamps, and
      renders the store code for consumptions and the poster's name for postings.
- [ ] `typecheck` + `lint` green.

## Boundaries

- **No amend.** The amount is immutable; the screen states it and offers nothing.
- **No repair here** — the orphan repair lives on 270's wrong-money lane, where it is found.
- **No new audit storage.** The two tables are the audit.
- **No cross-kind variance**, per 269's third rule.

## Done when

Every entry state shows exactly one correction affordance or none, a lost race recovers into the
write-off instead of erroring, and the audit pane reads as one ordered column of local-time facts.

## Blocked by

[269](269-a-branchs-account-is-the-destination.md).

## Open questions

None.
