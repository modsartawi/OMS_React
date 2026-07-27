# UaAdminWeb, as built — the read contract behind `admin/ua-users`

Research asset for wayfinder ticket [140](../140-uaadminweb-contract-as-built.md), map
[139](../139-ua-users-scale-and-export.md). Read-only investigation of the BackOffice tree on
2026-07-27; nothing was changed there.

Sources (absolute, since they live outside this repo):

| Short name | Path |
|---|---|
| `UaAdminWebEndpoints.cs` | `C:\Work\DMSCO\BackOffice\Services\SIS.Api\Endpoints\Auth\UaAdminWebEndpoints.cs` |
| `UaAdminService.cs` | `C:\Work\DMSCO\BackOffice\Sartawi.Retail.Data\Modules\Auth\UaLogin\Services\UaAdminService.cs` |
| `UaReportCards.cs` | `…\Modules\Auth\UaLogin\Constants\UaReportCards.cs` |
| `UaReportPopulations.cs` | `…\Modules\Auth\UaLogin\Repositories\UaReportPopulations.cs` |
| `UaReportStore.cs` | `…\Modules\Auth\UaLogin\Repositories\UaReportStore.cs` |
| `NhUaEmployeeStore.cs` | `…\Modules\Auth\UaLogin\Repositories\NhUaEmployeeStore.cs` |

---

## 1. The card catalogue, as predicates

Six stable codes in `UaReportCards.All` (`UaReportCards.cs:37`), dispatched by
`UaReportStore.IdentityQuery` (`UaReportStore.cs:79`) onto populations stated once as composable
`IQueryable` filters in `UaReportPopulations.cs`.

The base population every rollout card narrows — **`Seeded`** (`UaReportPopulations.cs:67`):

```csharp
employees.Where(e => e.IsActive
    && legacyUsers.Any(u => u.UserID.Trim().ToUpper() == e.EmployeeId.ToUpper())
    && !SharedAccountsUpper.Contains(e.EmployeeId.Trim().ToUpper()));
```

Active, backed by a real legacy `[User_]` person, not a service/group account. The active-only
clause is deliberate and documented (`:60-66`): "a deactivated person cannot sign in at all, so they
are not a cutover blocker … They have their own card."

| Card key | Population | Source |
|---|---|---|
| `all` | `source.Employees` — **the whole identity table**, disabled included, no legacy join, no shared-account exclusion | `UaReportStore.cs:84` |
| `notSeeded` | legacy `[User_]` rows with non-blank id, not shared, with **no** identity row | `UaReportPopulations.cs:125` |
| `phoneGap` | `Seeded` ∧ `HasPhoneGap` (trimmed-empty phone, or a `00000` placeholder prefix) | `:74` |
| `awaitingActivation` | `Seeded` ∧ `¬HasPhoneGap` ∧ **no credential row exists** | `:86` |
| `mustChange` | `e.IsActive` ∧ a credential row with `MustChangePassword` | `:98` |
| `disabled` | `!e.IsActive` | `:105` |

**Nothing today means "finished activating."** The nearest neighbour is `awaitingActivation`, whose
third clause is the absence of a credential row.

### Two structural facts 141 and 142 need

**(a) The complement is a one-line negation, and the codebase insists it be written that way.**
`AwaitingActivation` builds its reachable half as `.Where(Not(HasPhoneGap))` — negating the single
`HasPhoneGap` expression via an `Expression.Not` helper (`:135`) rather than restating it inverted.
The reason is recorded at `:82-84`: the blocked and ready rules, once written out twice in the
hand-run script, "drifted apart under editing until the population stopped summing." Any
"completed activation" rule must be built the same way — by negating
`AwaitingActivation`'s credential clause — not by hand-writing a lookalike.

**(b) The cards already do not sum, by design.** Three different universes are in play: `all` is the
raw table; `phoneGap` / `awaitingActivation` are active-and-real-people-only; `disabled` is the
table's inactive half; and `mustChange` is its own thing again — note it applies **only**
`e.IsActive`, with *no* legacy-`[User_]` join and *no* shared-account exclusion, unlike every other
rollout card. So a shared/service account holding a temp password is counted by `mustChange` and by
nothing else.

That asymmetry is pre-existing and is not this map's to fix, but it sets the expectation for
[141](../141-completed-activation-predicate.md): a seventh card **will not** reconcile arithmetically
with its neighbours either, and the decision should say plainly which universe it lives in rather
than implying an arithmetic that was never there.

---

## 2. The counts read

`UaAdminService.GetReportCountsAsync` (`:176`) is a plain sequential loop:

```csharp
foreach (var card in UaReportCards.All)
    counts.Set(card, await reports.CountCardAsync(card));
```

- **One `COUNT` query per card**, six in total, no identity materialized. Sequential on purpose —
  they share one NHibernate session, "which is not thread-safe" (`:172-174`), so a fan-out is not
  available as an optimisation.
- **Count and worklist run the same composed query.** `UaReportStore`'s class doc (`:19-22`) states
  it outright: "a card's number and its worklist cannot disagree about who is on it." (Still two
  round trips, so a concurrent SAP sync insert can move the total by one — an accepted off-by-one.)

**Cost of a seventh field:** one more `COUNT`, and structurally about four lines across three files —
a const in `UaReportCards` (plus its slot in `All`), a `case` in `UaReportStore.IdentityQuery`, a
population method in `UaReportPopulations`, and the `UaReportCountsResult.Set` mapping. Because the
count and page share the query, the new card and the new number stay in agreement **by
construction** — no separate reconciliation risk.

---

## 3. Paging — the finding that reshapes the map

**Offset paging already works end to end. The client is the only thing not using it.**

- **The endpoints already bind it.** `SearchEmployees` and `GetCardWorklist` both take
  `[FromQuery] int? skip` and `[FromQuery] int? take`, defaulting to `0` and `MaxSearchRows`
  (`UaAdminWebEndpoints.cs:83-88`, `:104-110`).
- **`skip` is not capped.** `ClampToCap` (`UaAdminService.cs:283`) is
  `(skip < 0 ? 0 : skip, Math.Max(0, Math.Min(take, MaxSearchRows)))` — it floors `skip` at zero and
  clamps `take` *down* only, never up ("a caller asking for zero rows means it — a count-only
  probe"). Arbitrarily deep offsets are already legal.
- **Ordering is deterministic and stable on every path** — which is what makes offset paging
  *correct* rather than merely available. `OrderBy(e => e.EmployeeId)` on both the search
  (`NhUaEmployeeStore.cs:39`) and the identity-backed cards (`UaReportStore.cs:69`); the
  `notSeeded` card orders by the **trimmed** id before paging, then synthesizes rows
  (`UaReportStore.cs:53-58`), so at most `take` rows are ever materialized. No risk of a row
  appearing twice or being skipped across pages.
- **`isCapped` is already offset-aware.** `LeavesRowsBeyond(total, cappedSkip, rowsOnPage)`
  (`UaAdminService.cs:293`) means rows exist *beyond this page* — with a doc comment explicitly
  warning it must **not** be read as "more exist than are shown", so it will not flag the last page
  of a paged walk as truncated. It is usable as-is as a "has next page" signal.
- **`totalMatches` is exact**, and is a **separate `COUNT` query re-run on every page** — the search
  path calls `CountMatchesAsync` alongside the page (`UaAdminService.cs:103`), the card path calls
  `CountCardAsync` (`:209`). Neither is cached.

**Conclusion: paging requires no server change.** The client changes `PAGE = { skip: 0, take: 50 }`
in `src/features/admin/ua-admin/api.ts:17` into a caller-supplied offset. This does **not** need to
appear in the contract addendum at all.

---

## 4. The ceiling, and what a full export actually costs

`MaxSearchRows = 50` (`UaAdminService.cs:69`). Its doc comment is unusually explicit about what kind
of limit it is:

> Not a default a caller may argue past: ~6,000 identities behind one search box means a broad term
> must stay cheap and must push the admin to sharpen it — the screen says "first 50 of N — refine to
> narrow".

So it is a **deliberate product clamp**, not a payload/downstream/HANA constraint. What it guards is
real, though: the search predicate is an unindexed triple `LIKE '%term%'` scan across id, phone and
display name (`NhUaEmployeeStore.cs:69-72`), with the comment "a LIKE '%x%' scans regardless — there
is no index to forfeit here." Raising the const is a one-line change that forfeits the guard.

**Magnitude: ~6,000 identities**, stated twice (`UaAdminService.cs:66`, `UaReportPopulations.cs:16`).

**Per-page query cost.** Each page of either read is roughly **six DB queries**: the page query, the
separate `COUNT`, and three batched cross-table reads in `ToGridRows` — credentials, TOTP enrollment,
last-login (`UaAdminService.cs:329-333`, batched by id list: "50 rows cost four queries, not 200").

**So the number [144](../144-export-scope-and-cost.md) needs:** exporting the **All people** card at
50 rows a page is **~120 sequential HTTP round trips and ~720 DB queries**. Exporting a narrowed
card is proportionally trivial — `phoneGap` at a documented "400 people" (`UaAdminService.cs:196`) is
8 requests. The full-set client CSV is comfortable on any *narrowed* query and is a genuine problem
only on `all`.

The obvious lever if that is too slow: `take` is clamped, but the clamp is a single const with no
technical dependency behind it — raising it for a dedicated export path is cheap, and is the kind of
thing that belongs in the contract addendum if 144 wants it.

---

## 5. Gating and audit

**Gate.** Every `UaAdminWeb/*` route is double-filtered (`UaAdminWebEndpoints.cs:18-31`):

1. `ApiKeyEndpointFilter` in its cookie branch — validates the `sis_session` cookie and the
   `X-Web-Client` CSRF header, and fills the UserId claim strictly from the session row.
2. `UaUsersGrantEndpointFilter` — re-evaluates the screen grant
   `BackOfficeScreen[CONTROLLER='UaUsers', COMMAND='03']` server-side, **fail-closed**.

`UaAdminWeb/Access` is the one exception: cookie-gated but not grant-gated, because it exists to
report whether the grant holds.

**Audit.** **No read is audited, anywhere on this surface.** The phrase "Read-only, so unaudited"
appears on search, employee status, report counts, and the card worklist
(`UaAdminService.cs:80, 116, 174, 199`). The audit-history read declines to audit itself on purpose:
"the log would fill with rows about looking at it" (`:245`). The write doors all audit via
`IUaAdminAuditStore`, keyed to a single target employee — there is no existing shape for recording a
bulk read.

**One relevant precedent for [146](../146-export-gate-and-audit.md):** the grant is described in the
service's own header as "the single all-or-nothing UaUsers screen grant", and that all-or-nothing-ness
already worried someone enough to add a separate barrier — `IUaProtectedTargetPolicy` (issue 746,
`UaAdminService.cs:35-41`), which stops a grant holder resetting ADMIN's password. It is a
**required** constructor argument precisely so a forgotten DI registration fails loudly rather than
silently disarming the barrier. That is the house style for "this grant is broader than it looks":
add a narrow explicit barrier rather than widen trust.
