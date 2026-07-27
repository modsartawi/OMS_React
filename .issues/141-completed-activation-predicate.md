---
type: wayfinder-ticket
wayfinder: grilling
map: 139
status: done
blocked-by: 140
---

# 141 — What counts as a completed activation

## Question

Ayed wants a counter for people who **did** their activation. Pin the predicate down to something a
`WHERE` clause can express, and decide where it is computed.

- Is "activated" `isSeeded && credentialState == 'active'`? Does a person who was seeded, activated,
  and has since been **disabled** still count — the number is either "how far has the rollout got"
  (yes, they activated) or "how many people can work today" (no). Which question is Ayed asking?
- Does signing in at least once (`lastLoginAt != null`) belong in it, or is a live credential
  enough? These diverge for anyone who set a password and never came back.
- Is it exactly the complement of `awaitingActivation` within the seeded population, or do the two
  leave a gap (e.g. `temporary-must-change`)? A card that doesn't reconcile with its neighbours will
  be read as a bug the first time someone adds the columns up.
- **Where does it come from?** Given 140's findings: a new `UaReportCountsResult` field plus a new
  card key in `GetCardPageAsync` (server addendum), or is there a client-only interim — e.g. reading
  the worklist's `totalMatches` for an existing card — good enough to ship before the server moves?
  Say plainly which, because it decides whether the card can ship without the backend.

Resolution records the predicate in the map's vocabulary and, if it is a new term, adds it to
`CONTEXT.md` via `/domain-modeling`.

## Answer

### The predicate

**Completed activation** — card key `completedActivation`:

```
legacy-backed  ∧  ¬shared-account  ∧  credentialState == 'active'
```

Written against the existing sources, that is:

```csharp
employees.Where(e =>
    legacyUsers.Any(u => u.UserID.Trim().ToUpper() == e.EmployeeId.ToUpper())
    && !SharedAccountsUpper.Contains(e.EmployeeId.Trim().ToUpper())
    && credentials.Any(c => c.UserId == e.EmployeeId && !c.MustChangePassword));
```

**No `IsActive` clause and no phone clause.** Three of the four forks were the human's call; the
fourth (phone) follows from them.

**1. Universe — everyone who ever finished, leavers included.** The counter answers *how far has the
cutover got*, not *how many can work today*. A person who activated in May and was disabled in July
is still counted in July: finished work does not un-finish when someone leaves. This deliberately
**drops the `IsActive` clause**, so `completedActivation` does **not** live in the `Seeded`
population its neighbour `awaitingActivation` uses — it is its own universe, and it **overlaps the
`disabled` card**.

**2. `temporary-must-change` does not count — `active` only.** Only a settled, self-chosen credential
is a completed activation; a row an admin just reset is someone who has *not yet* done it. This is a
**new predicate, not a negation** of `AwaitingActivation`'s credential clause, so the house rule from
`UaReportPopulations.cs:135` (build the complement with `Expression.Not`, never restate it inverted)
**does not apply here** — there is nothing to negate, and pretending otherwise would produce the
wrong rule. The two cards therefore **do not partition** the reachable population.

**3. First sign-in is not in it.** A live credential is enough. Whether someone has since come back
to work is adoption, a different question; `lastLoginAt` stays visible per-person as a grid column
and is not folded into the count.

**4. The phone-gap clause is dropped — derived, not chosen.** `HasPhoneGap` is *current mutable
state* exactly as `IsActive` is: a phone later edited to a placeholder would retroactively un-count
someone who had already finished, which is the precise thing decision 1 ruled out. And it is
redundant — `credentialState == 'active'` is itself proof the person was reachable enough to complete
the flow. The two stable identity clauses (legacy-backed, not a shared account) are kept: they define
*who is in scope for the cutover at all*, and a service account must never count.

### Two caveats to state on the screen's terms, not hide

- **It does not reconcile with its neighbours, and neither do the existing six.** Per
  [140](assets/140-uaadminweb-contract-as-built.RESEARCH.md) §1(b) the cards already span three
  universes by design; this is a fourth. `awaitingActivation + completedActivation` is *not* the
  reachable population — the `temporary-must-change` people sit on neither card (they are on
  `mustChange`, itself a third universe with no legacy/shared filters). Do not present the row as
  arithmetic that adds up; it never did.
- **"Never goes down" is the intent, not a guarantee.** Decisions 1 and 4 remove the two clauses that
  could un-count someone, but decision 2 leaves one path that still can: an **admin password reset**
  flips a person from `active` back to `temporary-must-change` and the number falls by one. That is
  arguably correct — a reset person must genuinely re-do the activation step — but the counter is
  *monotonic-except-for-resets*, and anyone reading it as an odometer should be told that once.

### Where it is computed — server, and the card cannot ship without it

**There is no client-only interim. The seventh card is blocked on the server addendum.**

The count cannot be derived by arithmetic over the six numbers the client already has: no existing
card or worklist total expresses "legacy-backed ∧ ¬shared" as a population, the six live in
mismatched universes, and `all` is the raw identity table with no joins at all. Reading an existing
card's `totalMatches` gives the wrong set, not an approximation of the right one.

**Contract addendum — the client needs this, and it is small.** Per 140 §2 it is ~4 lines across 3
files plus one extra `COUNT` on `GetReportCountsAsync`'s sequential loop:

| Where | Change |
|---|---|
| `UaReportCards.cs` | new const `CompletedActivation = "completedActivation"`, plus its slot in `All` |
| `UaReportPopulations.cs` | new population method for the predicate above (its **own** universe — do not build it off `Seeded`) |
| `UaReportStore.cs` (`IdentityQuery`) | new `case` — this is what gives the card its worklist for free |
| `UaReportCountsResult` | new field `completedActivation` |

Wire field name: **`completedActivation`**, matching the card key. Do **not** repeat the existing
`mustChange` → `mustChangePassword` asymmetry noted in `src/core/models/ua-user.ts:49`.

Because count and worklist run the same composed query (140 §2), the new number and the card's
drill-through agree **by construction**.

**Consequence for [142](142-seventh-card-label-and-placement.md):** until the server field lands the
client will receive `UaReportCountsResult` **without** `completedActivation`. The card must treat an
absent field as *absent* — hide the card, or show it unpopulated — and must never render `0`, which
would read as "nobody has activated" rather than "the server does not answer this yet".

### Vocabulary

**Completed activation** and **Seeded** added to `CONTEXT.md`.
