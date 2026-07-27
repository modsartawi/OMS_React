---
type: wayfinder-ticket
wayfinder: research
map: 139
status: done
blocked-by: —
---

# 140 — What the UaAdminWeb contract already gives us

## Question

Before deciding anything, establish what the server does **today**, from source rather than from the
client's assumptions. Read `UaAdminWebEndpoints.cs` and `UaAdminService.cs` (paths in the map's
Notes) plus whatever backs `reports.GetCardPageAsync` / `GetReportCountsAsync`, and answer:

1. **The card catalogue.** What card keys does `GetCardPageAsync` accept, and what is each one's
   predicate in terms of `isSeeded`, `credentialState`, `isActive`, `lastLoginAt`? In particular:
   how is `awaitingActivation` defined, and is there already anything that means *finished*
   activating?
2. **The counts read.** How is each field of `UaReportCountsResult` computed — one query or six?
   What would adding a seventh field cost, and is the count computed from the same predicate as the
   matching card's worklist (i.e. would a new card and a new count stay in agreement)?
3. **Paging, precisely.** `MaxSearchRows` — what is it, and does it clamp `take` only, or `skip`
   too? Is `totalMatches` the exact unfiltered-by-page total on both the search and card paths? Is
   it a separate `COUNT` query or derived? Does anything break or slow at a large `skip`?
4. **The ceiling.** Is `MaxSearchRows` a defensive clamp or load-bearing (payload size, a downstream
   limit, an SAP/HANA constraint)? What is the realistic `allPeople` magnitude in production — the
   number that decides whether "export the full match set from the client" is 3 requests or 400?
5. **Gating.** Which grant do the `UaAdminWeb/*` reads sit behind (`UaUsersGrantEndpointFilter`),
   and is any read audited today? Needed by the export-governance ticket.

Record the findings as a linked asset under `.issues/assets/`, quoting the deciding lines with file
and line references. This is a read-only investigation — change nothing in the BackOffice tree.

## Answer

Resolved 2026-07-27 by reading the BackOffice source. Full findings, with file and line references
for every claim: [UaAdminWeb, as built](assets/140-uaadminweb-contract-as-built.RESEARCH.md).

**1 — The card catalogue.** Six codes in `UaReportCards.All`, each dispatched onto a composable
`IQueryable` population in `UaReportPopulations`. The base every rollout card narrows is `Seeded` =
`IsActive` ∧ backed by a real legacy `[User_]` row ∧ not a shared/service account. On top of it:
`phoneGap` = `Seeded ∧ HasPhoneGap`; `awaitingActivation` = `Seeded ∧ ¬HasPhoneGap ∧ no credential
row exists`. Outside it: `all` = the raw identity table (disabled included), `disabled` = `!IsActive`,
`notSeeded` = legacy rows with no identity (counted per legacy ROW, so padding duplicates count
twice, matching the script it replaces).

**Nothing today means "finished activating."** The nearest thing is `awaitingActivation`, whose third
clause is the *absence* of a credential row.

Two structural facts that constrain [141](141-completed-activation-predicate.md):

- **The complement must be written as a negation, not a lookalike.** `AwaitingActivation` builds its
  reachable half as `.Where(Not(HasPhoneGap))` through an `Expression.Not` helper, because the
  hand-run script it replaces had the blocked and ready rules written out twice and they "drifted
  apart under editing until the population stopped summing."
- **The cards already do not sum, deliberately** — three different universes. And `mustChange` is
  the odd one out: it applies only `IsActive`, with no legacy join and no shared-account exclusion,
  so a service account holding a temp password lands on that card and no other. Pre-existing, not
  ours to fix, but it means a seventh card will not reconcile arithmetically either — the predicate
  decision should name its universe rather than imply an arithmetic that never existed.

**2 — The counts read.** `GetReportCountsAsync` loops `UaReportCards.All` and issues one `COUNT` per
card — six queries, no identity materialized, sequential because the shared NHibernate session is
not thread-safe (so no fan-out optimisation is available). Crucially, **the count and the worklist
run the same composed query**, so a new card's number and its list agree by construction. A seventh
field costs one more `COUNT` and roughly four lines across three files.

**3 — Paging. This is the finding that reshapes the map: it needs no server change at all.** Both
endpoints already bind `[FromQuery] int? skip`; `ClampToCap` floors `skip` at zero and clamps only
`take`, so deep offsets are already legal; every path orders deterministically before paging
(`OrderBy(EmployeeId)`, and the trimmed id on `notSeeded`), so offset paging is *correct*, not merely
available; `totalMatches` is an exact separate `COUNT`; and `isCapped` is already offset-aware —
`LeavesRowsBeyond` explicitly means "rows exist beyond this page", so it will not mislabel the last
page of a walk. **The whole change is replacing the hardcoded `skip: 0` in `api.ts:17`.** Paging does
not belong in the contract addendum.

**4 — The ceiling and the export bill.** `MaxSearchRows = 50` is a **product clamp, not a technical
limit** — its own doc says it exists to push the admin to sharpen a broad term. What it guards is
real though: an unindexed triple `LIKE '%term%'` scan. Production magnitude is **~6,000 identities**
(stated twice in source). Each page costs ~6 DB queries (page + `COUNT` + three batched cross-table
reads). **So a client-side full export of the All-people card is ~120 sequential round trips and
~720 DB queries**; a narrowed card is trivial (`phoneGap` at its documented ~400 people is 8
requests). The full-set CSV is comfortable everywhere *except* `all` — which is precisely the fork
[144](144-export-scope-and-cost.md) has to rule on. If it wants relief, raising the `take` clamp for
an export path is a one-const change with nothing technical behind it.

**5 — Gating and audit.** Every route is double-filtered: cookie + `X-Web-Client` CSRF, then
`UaUsersGrantEndpointFilter` re-evaluating `BackOfficeScreen[CONTROLLER='UaUsers', COMMAND='03']`
fail-closed. `Access` is cookie-only by design (it reports the grant). **No read is audited anywhere
on this surface** — "read-only, so unaudited" appears on all four reads, and the audit tab refuses to
audit itself. All audit rows are keyed to a single target employee, so there is no existing shape for
recording a bulk read. Precedent worth knowing for
[146](146-export-gate-and-audit.md): the service's own header calls this "the single all-or-nothing
UaUsers screen grant", and that breadth already prompted a narrow explicit barrier
(`IUaProtectedTargetPolicy`, a *required* constructor arg so a missing registration fails loudly).
The house style is a targeted barrier, not widened trust.

**Also settles a fog patch.** The map's "cost of `totalMatches` at depth" is answered: the count is
exact and re-run per page, `skip` is uncapped, and the real cost is the `LIKE` scan, which recurs per
page regardless of depth. No approximate-total or cursor variant is needed; the residual cost
question is just the export bill, which 144 already owns.
