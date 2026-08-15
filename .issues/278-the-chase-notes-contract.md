---
type: wayfinder-ticket
wayfinder: grilling
map: 275
status: done
blocked-by: —
---

# 278 — The chase note's contract

## Question

The map rules a chase record in scope, **minimally**: who chased, when, free text; no statuses, no
assignment, no due dates. This ticket settles its shape — it is the only part of the map that needs
a **new table and a write door**, so it is deliberately isolated: if BackOffice declines or delays,
the two read-only lanes still ship.

**The decision that shapes everything else: what is a note attached to?**

- **Per entry.** Precise — the note sits with the money it is about, and follows the entry into the
  branch account (269). But one phone call covers every open entry a branch has, so an accountant
  ringing 0331 about four shortages types the same sentence four times, or types it once and the
  other three rows still read *never chased*.
- **Per branch.** Matches the act — one call, one note, and every row for that branch shows it. But
  a branch with a shortage from March and one from last week gets one undifferentiated history, and
  "we agreed they'd pay entry 143 on Sunday" has nowhere precise to live.
- **Per branch, optionally naming entries.** A note belongs to the branch and carries an optional
  set of entry ids it was about. More faithful, more contract.

Then:

1. **Does cash waiting share the mechanism?** A chase about an uncollected receipt is a call to the
   **collector**, not the branch manager — different person, different failure. Same table with a
   subject discriminator, or a second thing entirely?
2. **What does a row show when there is no note?** *Never chased* is a real and useful state, and
   the lane probably sorts on it (never-chased and oldest first). Confirm it is rendered as a named
   state and not an empty cell — 269's rule 1, which returns a tagged union precisely so a formatter
   is handed a *case* and cannot render a blank.
3. **Is it editable or strictly append-only?** Append-only was the ruling; confirm what that means
   for a typo, and whether a note can be superseded. ⚠️ Note that every other settlement act carries
   a `reason` the branch reads verbatim — this is the first free text on this screen that is
   **internal**, read by accountants and not by a branch. Say so explicitly, or someone will
   eventually put it in front of a store manager.
4. **The clock, again.** Settlement timestamps are local wall clock; `UaAdminAudit.Timestamp` is
   UTC. 272 already hit this. Whichever this table uses, it must match the timestamps it renders
   beside.

## Output

A contract to add to the hand-off draft — table shape, read projection (how a note reaches a lane
row without an N+1), and the one write door. Plus the ruling on whether the lanes degrade gracefully
when the door is absent, since [281](281-the-open-settlements-view.md) has to draw both states.

## Answer

**A note belongs to a *branch* and optionally *names* what it was about — the third option, and the
extra field is one column, not a contract.** Resolved AFK, 2026-08-15.

### Why per-branch-naming-a-subject, and not the two simpler ones

Per-entry loses to arithmetic: four open shortages on branch 0331 is **one phone call**, and a model
where that call is four notes or one note plus three rows reading *never chased* is a model that
lies about what happened. Per-branch alone loses to the sentence that matters — *"they agreed to pay
entry 143 on Sunday"* has to land somewhere, and if the only place is prose then the lane can never
tell an entry that was discussed from one that was merely on the call.

The optional subject costs **one discriminator and one id**. That is not "more contract" in any
sense that matters: the write door takes two more fields and the read is unchanged, because a note
is fetched **by branch** either way.

### The table

```
PosSettlementChase
  ChaseId            varchar(26)   PK, ULID   -- sorts by mint time, this repo's idiom
  StoreId            varchar(26)   NOT NULL
  Subject            varchar(16)   NOT NULL   -- BRANCH | ENTRY | RECEIPT
  SubjectId          varchar(26)   NOT NULL   -- SettlementEntryId | SettlementDocumentId | ''
  EntryNumber        int           NOT NULL   -- the quotable handle, 0 when Subject = BRANCH
  Note               varchar(400)  NOT NULL
  ChasedByStaffId    varchar(26)   NOT NULL
  ChasedByName       varchar(100)  NOT NULL
  ChasedAt           datetime2     NOT NULL

  IX_SettlementChase_Store_ChasedAt (StoreId, ChasedAt DESC)
```

`EntryNumber` is **denormalised on purpose** — it is what the lane renders and what the accountant
quotes, and carrying it here means the read never joins the entry table to draw a note.
`ChasedByName` likewise, following `PostedByName` / `PreparedByName`: a name resolved at write time
cannot go stale against a staff master that changes underneath the history.

### 1. Cash waiting shares the mechanism — same table, `Subject = RECEIPT`

The ticket is right that it is a **different call to a different person**: the collector who has not
been, not the manager who has not paid. But that difference is *who to ring* — `ServedBy` on the row
already carries it (per [277](277-the-cash-waiting-doors-shape.md)) — and it is not a difference in
what a chase **is**: someone rang, on this date, and said this. A second table would double the
write door, the grant, the read projection and the degradation path to distinguish one column's
value. The lanes stay visibly separate; the record does not.

⚠️ Note the asymmetry `Subject` buys: a RECEIPT note names a `SettlementDocumentId` that head office
**has no row for** (277: the document table is store-side until collection). That is fine — the id
is carried as a label, never joined. Do not let a later ticket add a foreign key here.

### 2. No note is a **named state**, and there are three of them, not two

The wire is a **tri-state**, and this is the ruling [281](281-the-open-settlements-view.md) was
blocked on:

| wire | means | the lane draws |
|---|---|---|
| field **absent** | the chase door is not built / not deployed | **no Last-chased column at all** |
| `lastChase: null` | the door answered, and nobody has chased this branch | *Never chased* — a named case |
| `lastChase: {…}` | the newest note | *"Fri — Sartawi: promised Sunday"* |

🚩 **Absent and `null` must never collapse into one another.** Rendering *never chased* against every
row of an estate because the door is missing is a false statement about 1394 branches, made
confidently — the same class of error as 270's *"nothing needs a human"* drawn over a failed door.
This is 269's rule 1 applied one layer up: the formatter is handed a **case**, and there is no case
that renders blank.

The lane sorts oldest-first regardless (276), so *never chased* is **not** a sort key — see 281.

### 3. Strictly append-only, and the text is INTERNAL

No edit, no delete, no supersede, no `IsActive`. A typo is corrected by **adding a note**, which is
what a person does in a paper day-book and what an accountant reading a history expects to see. The
door has exactly one verb.

⚠️ **Written into the contract in as many words, because it is the first free text on this screen a
branch never reads:** every other free text here — an entry's `reason`, a cancellation's, a
correction's — is quoted back to the branch verbatim and is worded for that. `Note` is an
accountant's own memo. The client says so at the point of entry (the field's own hint, not a
tooltip) and the contract says so above the column, so that the day someone proposes surfacing
settlement history on a store-facing screen, the decision is visible rather than assumed.

### 4. The clock — local wall clock, `DateTime.Now`

`ChasedAt` matches every timestamp it is rendered beside (`PostedAt`, `ConsumedAt`, `PreparedAt` —
all `DateTime.Now`, per `no-utc-time`), **not** `UaAdminAudit.Timestamp`'s UTC. 272 already paid for
this once. A note stamped in UTC would render three hours before the call that produced it, on the
same row as the entry it is about.

### The read projection — one call, no N+1

The **newest note per branch** rides on the lane rows themselves:

```sql
OUTER APPLY (SELECT TOP 1 h.Note, h.ChasedByName, h.ChasedAt, h.EntryNumber
               FROM PosSettlementChase h WITH (NOLOCK)
              WHERE h.StoreId = e.StoreId
              ORDER BY h.ChasedAt DESC) ch
```

One seek per row on `IX_SettlementChase_Store_ChasedAt`, on a page already capped — not a query per
row from the client, and not a second round trip whose answer can arrive out of step with the rows it
labels. **Latest only**; the full history is the branch account's business (see the map's fog).

### The write door

```
POST Settlement/Chase  { storeId, subject, subjectId, entryNumber, note }
  →  { accepted, chase }   -- 200 with accepted:false on refusal, this screen's idiom
```

Refusals: unknown branch, blank note, note over 400 characters, unrecognised `subject`. Nothing else
— no money moves, so there is no guard to lose. Grant: **the settlement screen grant**
(`SettlementAccountScreen`), not a new one. A second grant would mean an accountant who can post an
entry against a branch cannot record that they rang it, which is not a boundary anyone wants.

### 🔑 Graceful degradation — the lanes ship without any of this

The two read lanes ([277](277-the-cash-waiting-doors-shape.md),
[280](280-the-ageing-read-door.md)) carry `lastChase` as an **optional** field. If BackOffice
declines or defers the table, the doors simply do not send it, the column does not draw, and nothing
else on the screen changes — no placeholder, no disabled button, no *"coming soon"*. That is what the
tri-state above buys, and it is the reason this ticket was isolated in the first place.
