# HITL — ticket 270 (the door searches, and triages)

Decisions taken unattended, in the order they came up. Each one is also written at the
line of code it affects; this file is the index, and the list 274 settles against a
live SIS.Api.

---

## Q: spec 267 D8 has no door that can enumerate the wrong-money lane. Invent one, or build the lane from `FleetRow.hasOrphan`?

**Decision taken:** invented **`GET Settlement/Worklist`** → `{ orphans[], uncollected[], ageingThresholdDays }`, logged here for 274.
**Why:** `Settlement/Repair` is keyed by a `settlementConsumptionId`, and D8's aggregated `FleetRow` carries only a boolean — a lane built from it could say *"0331 has an orphan somewhere"* and could not offer the Repair the ticket requires on every row.
**Revisit if:** the server would rather answer the lanes on the fleet row (it would have to un-aggregate them, which D8's own comment forbids: *"one AGGREGATED row per store — never a projection of entries"*).

## Q: how does an entry number become a branch? D8 has no lookup door.

**Decision taken:** invented **`GET Settlement/Ledger`** (entryNumber / storeId / entryKind / status / limit) → `SettlementLedgerRow[]`, which is `Entry` + `storeName` + `currencyKey`.
**Why:** it serves both halves of the ticket at once — *"find entry 143, whichever branch it is on"* is the flat cross-estate ledger's whole job, and the search box's entry lookup is the same query with one criterion. Two doors would have been two shapes for one question.
**Revisit if:** 274 finds the estate ledger already exists under another name, or the account door will take an `entryNumber`.

## Q: four fields the door needs that D8's `FleetRow` does not carry.

**Decision taken:** added `city`, `assignment`, `ageingCount` and `currencyKey`, each documented on the type.
**Why:** the search resolves *code, name, **city**, entry number* (D2) and three of the four were on the row; the scope has to rank and count client-side (below); the ageing threshold is **the server's** and the ticket forbids inventing one here, so the server must send the count; and D10 requires the branch's own precision, which is why 269 added the same field to the account.
**Revisit if:** the server would rather scope server-side — see the next entry, which is the one that would have to change with it.

## Q: `Settlement/Fleet` takes a `scope`. Send the control's value, or always `all` and scope on the client?

**Decision taken:** **always `scope=all`**, and the three states are applied in `scope.ts` over the answer.
**Why:** the carve-out. Wrong money and cash waiting are *always* estate-wide (D2) and the search must **rank** rather than refuse — so a scoped fetch would need a second, estate-wide fetch beside it, or it would quietly drop the 1255 unassigned branches from the lanes. It also makes the carve-out unit-testable, which the ticket's Proof asks for by name. The estate is 1394 rows of eleven scalars; the browser ranks it without noticing.
**Revisit if:** the estate grows an order of magnitude, or the door's `scope` turns out to do something the client cannot (e.g. row-level authorisation, which would make the whole design wrong anyway — the scope is *"never a permission"*).

## Q: is `ageDays` on the two lanes the server's or the client's?

**Decision taken:** the **server's**, on both row types.
**Why:** the grace period an orphan has to outlive is the server's rule and the clock is the server's. A pure module that read `Date.now()` would also be a module whose tests changed answer overnight.
**Revisit if:** 274 finds only timestamps on the wire; then the projection derives it in one place and the tests inject a clock.

## Q: the worklist's refresh shape — the ticket's own open question (poll, manual, on-focus)?

**Decision taken:** **manual**, a Refresh button beside the lanes, plus a 60-second `staleTime` so navigating to a branch and back is not a re-fetch.
**Why:** the lanes change when a till closes a shift — hours apart, not seconds — and a triage list that moved rows under a reader's cursor mid-decision would be worse than a stale count. Recorded in the ticket, as it asked.
**Revisit if:** driving it with a real estate shows the numbers going stale inside one sitting.

## Q: does Repair require a reason?

**Decision taken:** **yes** — a required free-text reason, ≤200, the same limit the posted entry's reason takes (D4).
**Why:** `Settlement/Repair`'s body carries `reason` (D8), and 272's audit pane renders it in the branch's column of time. *"Repaired, no reason given"* is a row someone reads months later who was not here.
**Revisit if:** accountants repairing a sweep of orphans find the box is friction; the fallback is a default sentence, never a blank.

## Q: does typing an entry number navigate as you type?

**Decision taken:** no — branch ranking is live as you type (client-side, free), the **entry lookup runs on submit**.
**Why:** typing `143` would otherwise issue lookups for `1`, `14` and `143`, and an entry lookup *navigates* — so a keystroke-triggered one moves the screen out from under someone still typing.
**Revisit if:** never, unless the box grows a debounce for other reasons.

## Q: `1001` is both a real branch code and a real entry number. Which does Enter mean?

**Decision taken:** **an exact branch code wins**; a bare number with no exact code match is looked up as an entry (`resolveSubmit`). A leading zero is always a code (`0142` ≠ entry 142).
**Why:** found by `/code-review`, and pinned by a test against the estate fixture: 493 of the fixture's store codes are also live entry numbers. The failure mode is the worst this box can produce — an accountant types their own branch's code and lands on a *different* branch's account, plausibly and silently.
**Revisit if:** the estate's codes stop being zero-padded four-digit strings.

## Q: what does a search hit / a worklist row / the back link do with the rest of the URL?

**Decision taken:** one module, `addresses.ts`, owns the grammar: **every link keeps the scope and drops the view** (`q`, `view`, `store`, the ledger's own filter).
**Why:** also `/code-review`'s. A hand-written `?store=0142` replaces the whole query string, so an accountant who widened to the estate, opened a branch and came back would find the ageing count had fallen 140 → 47 with nothing on screen to explain it.
**Revisit if:** a second thing belongs to the reader rather than to the view — it goes in `KEPT`, in one place.

## Q: the ledger's filter — component state or URL?

**Decision taken:** **URL** (`entryNumber`, `branch`, `kind`, `status`), with only the unsubmitted draft in component state. `branch`, not `store`, because `?store=` already means *open this account*.
**Why:** 269's ruling — the URL is the only home — applied to the one view that had drifted from it: pressing Back out of an account re-mounted the ledger with the typed entry number lost and re-issued the broad estate-wide query.
**Revisit if:** the filter grows a field that is genuinely not worth an address.

## Q: what does the estate headline show, given D2 calls it a report figure?

**Decision taken:** **per currency, two magnitudes, never netted** — on both the door and the ledger — with the sentence saying nobody owes it and no till can consume it.
**Why:** the estate is KSA **and** Bahrain, so one number across currencies is wrong in both (D10); and an estate-wide net would invite exactly the settle-it-in-one-act reading 269's account headline already says out loud it does not support.
**Revisit if:** finance asks for a single figure — it would need a currency and a rate, neither of which is on this contract.

## Q: what happens to the door when the worklist door fails?

**Decision taken:** the error banner **replaces** the lanes; it never renders beside the *"nothing needs a human"* sentence.
**Why:** `/code-review`'s third finding. A screen may say it does not know; it may not say there is nothing wrong because it could not ask.
**Revisit if:** never.

---

## Q: the ageing lane's *way through* shows a different set than the count it advertises.

**Decision taken:** the link says **what it does** — *"Browse open entries"* — and the count says **what it counted** (*"…counted for the branches you have scoped"*). No `ageing` criterion was invented on the ledger door.
**Why:** `/standards-review`'s spec axis found the mismatch: the count is scoped and past the server's threshold, while the ledger can only filter on what D8's criteria carry. Inventing an `ageing=true` predicate would be this screen inventing the threshold rule the ticket forbids in as many words (*"No ageing threshold logic invented here"*).
**Revisit if:** 274 finds the ledger door will take an ageing predicate — then the link seeds it and the two figures agree.

## Q: does an entry-number search land on the branch, or on the entry?

**Decision taken:** **on the entry** — `?store=0142&entry=143`, and 269's grid opens on that row (falling back to its first displayed row, which is what an unknown or stale entry number gets).
**Why:** spec 267 story 3 asks for the entry (*"lands me on the right entry whichever branch it is on"*), and the account's grid selects its own first row — which after a sort is not the entry the accountant was quoted. The ledger's rows and the wrong-money lane carry their entry number too, so all three doors into the account name what they sent the reader for.
**Revisit if:** never; the fallback covers a pasted address naming an entry the branch does not hold.

---

## Still open for 274 (the joining ticket)

- 🚩 **Does `Settlement/Fleet` answer EVERY branch, or only branches with settlement activity?** The screen assumes every branch. Two things rest on it: *"no staff row"* is inferred as *no row came back as mine* (`scope.ts`), so an accountant whose branches are all quiet would be silently treated as unseeded; and search ranks over fleet rows, so a quiet branch would be unfindable — which would make the scope refuse a branch, the one thing D2 says it must never do. Raised by `/standards-review`'s spec axis.

- Every route string and param casing on the three doors this ticket added (`Settlement/Fleet`, `Settlement/Worklist`, `Settlement/Ledger`) and on `Settlement/Repair`.
- The four added `FleetRow` fields, and `SettlementLedgerRow`'s two.
- Whether `scope` stays a client-side concern (see above).
- 269's own list: `currencyKey` / `storeName` on the account, the absent `consumedByName`, and the `limit` param.
