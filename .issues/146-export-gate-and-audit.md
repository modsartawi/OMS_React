---
type: wayfinder-ticket
wayfinder: grilling
map: 139
status: done
blocked-by: —
---

# 146 — Should bulk export be gated, and should it leave a trace

## Question

Paging one screen of users at a time and downloading the entire staff roster — names, employee IDs,
mobile numbers, email addresses — are different acts, even though the second is built out of the
first. This ticket decides whether the product treats them differently.

- **Is the existing `UaAdminWeb` screen grant enough** to authorise a full-roster download, or does
  export want its own permission so that "can administer users" and "can extract the directory"
  can be granted separately? The authz screen (`features/admin/authz-admin`) is where a new grant
  would surface.
- **Does an export get audited?** `UaAuditEntry` records administrative actions against a target
  employee; a bulk read has no single target. If it should be recorded, that is a server-side
  addendum item (the client cannot audit itself credibly) — and 140 reports whether reads are
  audited today.
- If the answer to both is no, **say so explicitly and why**, so the decision is a decision rather
  than an omission someone finds later.

Independent of the pager and CSV shape — it can be worked at any time, and its answer feeds the
contract addendum rather than the client spec.

## Answer

**No separate grant, and no audit row — and both refusals rest on the same fact: the server cannot
tell an export from ordinary paging, because [144](144-export-scope-and-cost.md) made the export
*literally the pager's own call in a loop*.** Neither is an omission; each is a decision with a
named condition that would reverse it.

### The export is authorised by the screen grant it already rode in on

The gate is one screen-open grant — `UaUsersView` = `BackOfficeScreen[CONTROLLER='UaUsers',
COMMAND='03' (Display)]`, evaluated server-side per request by `UaUsersScreenGate` /
`UaUsersGrantEndpointFilter`, fail-closed (`Sartawi.Retail.Data/Modules/Auth/WebAuth/Services/UaUsersScreenGate.cs`;
seed `Modules/Authorizations/Sql/Seed-UaUsers-Screen-Authorization.sql`). A second grant — a new
COMMAND value on the same CONTROLLER, seeded and bound like the first — is *mechanically* cheap.
It is declined on three grounds:

1. **It would be unenforceable, i.e. a lie.** There is no export endpoint to hang a filter on. The
   export calls `UaAdminWeb/Employees` and `UaAdminWeb/ReportCards/{card}` — the same two routes the
   grid already calls, with a moving `skip`. A gate could therefore only live in the client, deciding
   whether to *render the button*, while the underlying capability stays fully open to anyone holding
   the screen. Hide-the-button is show/hide hygiene everywhere else in this codebase precisely
   *because* the server re-checks; here there would be nothing behind it. A control that stops only
   the people who weren't going to do it anyway is worse than no control: it gets recorded as
   mitigation.
2. **It would invert least privilege.** The same `UaUsersView` grant already carries `SetPassword`,
   `Deactivate`, `Reactivate`, `ClearTotp`, and `Sessions/Revoke`. Someone trusted to set another
   employee's password and revoke their sessions is not someone from whom the phone-number column
   needs withholding. Carving out a sub-grant for the *least* dangerous act on the screen — a read of
   fields the screen already prints, 50 at a time, to the same eyes — puts the fence in the wrong
   place while the gates stand open.
3. **The separation the ticket asks for already exists, one level up.** "Can administer users" is
   not ambient: it is the standalone `UA_USERS_ADMIN` single-role, deliberately assigned, holding
   this grant *and nothing else* (per the seed's own comment). The lever for "this person shouldn't
   be able to extract the directory" is therefore already available and already the right one —
   don't give them the screen. Adding a grant to withhold from a role you chose to create and assign
   is answering a role-design question with a permission.

**Client instruction for the spec:** the export button carries **no permission check of its own**.
It renders whenever the screen renders — i.e. behind the existing `UaAdminWeb/Access` probe that
already guards the route and the menu item. No `canExport`, no new probe field, nothing new in
`features/admin/authz-admin`.

### Nothing records that an export happened

`UaAuditEntry` is a single-target log (`Action` + `Actor` + a polymorphic `TargetId` — employee id
on the people doors, session id on `RevokeSession`), and [140](140-uaadminweb-contract-as-built.md)
established that **no read is audited anywhere** on this surface. A bulk read fits badly and, more
to the point, cannot be recorded honestly from here:

- **The client cannot audit itself.** A "starting an export" POST is self-declared. Anyone who
  wanted the roster without the row simply calls the paging endpoints directly — which is not a
  hypothetical bypass but the *documented* IT-scripting path (`UaAdminEndpoints`, the x-api-key
  twin). An audit trail that the motivated skip and the incurious populate answers the wrong
  question, and reads as coverage.
- **Auditing the underlying reads instead is a different, larger change** — it would write a row per
  page for every ordinary search on a shared service, and those rows would carry no employee id, so
  they would surface on no one's audit tab. Volume without a reader.

So: **not audited, deliberately.** Recorded here so the next person finds a decision, not a gap.

### The one hinge, and the note it leaves for the addendum

Both answers turn on the same thing — *the server does not know an export occurred*. If either
answer must change, the change is the same single move, and it is not a client change: **a
server-side export endpoint** that takes the query, streams the full match set in one call, audits
it (a new `Action`, actor from the cookie session, `TargetId` = the scope code — the column is
already polymorphic), and can then carry its own COMMAND grant that actually enforces. That endpoint
would replace [144](144-export-scope-and-cost.md)'s client walk wholesale, so it is a re-decision of
144, not an addition to it.

**Addendum gains one deferred note, no required change:** *the CSV export rides the `UaUsersView`
screen grant and is not audited; if either must change, add a server export endpoint that streams +
audits + carries its own grant — do not add a client-side `canExport` flag, which would enforce
nothing.* (This is the second deferred note on the same endpoint, alongside 144's "add a separate
export cap, don't raise `MaxSearchRows`" — both say: the next move on export is server-side.)

### Guard against a later misreading

144's confirm dialog above 500 rows is **not** a control and must not be described as one in the
spec. It is an expectation-setting device about *wait time*, it is dismissible, and it never fires
on the narrowed cards. If it starts being cited as the thing that governs bulk extraction, the
governance is fictional.
