---
type: wayfinder-map
status: done
---

# 139 — UA users at scale: the activation counter, paging, and export

## Destination

A `status: ready` spec for the `admin/ua-users` screen covering three of Ayed's asks — a seventh
report card counting people who **completed activation**, real paging past the 50-row wall, and a
CSV export Excel opens cleanly — plus a written **server-contract addendum** naming any
`UaAdminWeb/*` change the client needs. The spec is buildable by `/to-tickets` against the React
app; the addendum is handed to whoever owns SIS.Api. Server implementation is not this map's work.

## Notes

- **Domain:** `CONTEXT.md` — employee identity, seeding, credential state, activation. The
  `/domain-modeling` skill maintains it; the activation predicate this map settles belongs there.
- **Screen today:** `src/features/admin/ua-admin/` — `UaAdminUsersPage.tsx` holds the six-card row
  and a plain HTML table (no AG Grid); `api.ts:17` hardcodes `PAGE = { skip: 0, take: 50 }`.
  Wire shapes in `src/core/models/ua-user.ts`.
- **Server, readable locally:** `C:\Work\DMSCO\BackOffice\Services\SIS.Api\Endpoints\Auth\UaAdminWebEndpoints.cs`
  and `C:\Work\DMSCO\BackOffice\Sartawi.Retail.Data\Modules\Auth\UaLogin\Services\UaAdminService.cs`.
  Both capped reads already accept `skip`/`take` and clamp `take` to `MaxSearchRows`; `totalMatches`
  and `isCapped` are already offset-aware. Research tickets read this source rather than guessing.
- **Standing preferences (settled at charting, do not re-litigate):** "active users" means
  *completed activation*, not live sessions. Paging is **server offset paging**, not load-more.
  Export is **client-side CSV over the full match set**, not a server file. The map designs the
  server contract but builds only the client.
- Rules that bite here: `.claude/rules/i18n-zero-literal.md` (every card label, pager control, and
  CSV header is a `t()` key) and `.claude/rules/api-envelope.md` (paging params go through
  `src/core/api.ts`, never a raw fetch).

## Decisions so far

<!-- one line per resolved ticket -->

- [What the UaAdminWeb contract already gives us](140-uaadminweb-contract-as-built.md) — **paging
  needs no server change**: both endpoints already bind `skip`, `ClampToCap` caps only `take`, every
  path orders deterministically before paging, and `isCapped` already means "beyond *this* page" —
  the whole change is the hardcoded `skip: 0` in `api.ts:17`. Nothing today means *finished
  activating* (`awaitingActivation` = seeded ∧ reachable ∧ **no credential row**); a seventh card is
  ~4 lines across 3 files and its count agrees with its worklist by construction, but the cards
  **already don't sum** (three universes; `mustChange` alone skips the legacy/shared-account
  filters). Estate is **~6,000 identities** and a page costs ~6 DB queries, so a client full export
  of *All people* is **~120 round trips / ~720 queries** — fine on any narrowed card, the fork is
  `all` alone. Every route is grant-gated fail-closed and **no read is audited anywhere**.
  → [research asset](assets/140-uaadminweb-contract-as-built.RESEARCH.md)
- [What counts as a completed activation](141-completed-activation-predicate.md) — the predicate is
  **`legacy-backed ∧ ¬shared ∧ credentialState == 'active'`**: an odometer for *how far the cutover
  got*, so it carries **no `IsActive` clause** (a leaver who activated still counts, overlapping the
  Disabled card) and **no phone clause** (same mutable-state reason; `active` already proves
  reachability). `temporary-must-change` does **not** count and first sign-in is **not** required —
  so it is a *new* predicate, not a negation of `awaitingActivation`, the two don't partition the
  estate, and the row still doesn't sum. Caveat to surface: an admin reset flips someone back, so
  it's monotonic-*except-for-resets*. **Server-only — no client interim exists**: the count can't be
  derived from the six existing numbers (mismatched universes), so the card is blocked on the
  addendum — new `completedActivation` card key + population + `IdentityQuery` case + wire field
  (not the `mustChange`→`mustChangePassword` asymmetry). Until it lands the field is **absent**, and
  [142](142-seventh-card-label-and-placement.md) must hide the card rather than render `0`.
  Vocabulary: **Completed activation** + **Seeded** added to `CONTEXT.md`.
- [Naming and placing the seventh card](142-seventh-card-label-and-placement.md) — the card is
  **"Activation done"**, key `cards.completedActivation`, and **"Disabled" doesn't move**: the
  collision is the *word*, so the fix is never spending it — "Activated" would sit one card from
  "Disabled" as its apparent complement, whereas keeping the noun *activation* makes the pair read as
  two ends of one journey. The domain term stays **Completed activation** in `CONTEXT.md` and as the
  wire field; only the on-screen label is shortened. Renaming Disabled is declined — it is the same
  word as the status pill, the Status column, and the Disable/Re-enable actions. It sits at
  **position 5, next to Awaiting activation** (population → blockers → the activation pair →
  admin-reset detour → account state), and carries **no tone**: on this row colour means *there is
  work here*, and this is the one card whose rows need nothing done — the asymmetry with its accented
  neighbour is deliberate and must be said in the spec. Layout: the row **stops being a fixed
  six-slot grid** — `grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]` rather than `md:grid-cols-7`,
  because [141](141-completed-activation-predicate.md) hides the card while the field is absent, so
  it must look right at **both 6 and 7 cards**. **Nothing for the addendum.**
- [The pager: page size, controls, and what a page change disturbs](143-pager-shape.md) — **a fixed
  50-row page walked with prev/next + "Page N of M" in a grid footer**, rendered only when
  `totalMatches > 50`. No size chooser: `MaxSearchRows` clamps `take` *down*, so the only selectable
  range is 25/50, and raising it is the same one lever [144](144-export-scope-and-cost.md) may want.
  No numbered pages: `all` is 120 pages of ellipsis logic nobody navigates deliberately. `isCapped`
  stops being displayed and becomes the **next-button flag**. The page becomes a **field of `Query`**,
  so a new search or card switch resets to page 1 *by construction* and each page is its own cache
  entry. **Selection survives paging** (`UserDetailPane` fetches by id, never reads the row) — the
  do-nothing implementation, which settles the detail-pane fog; a mutation likewise **holds the
  page**, with one guard: an empty page above page 1 clamps to `ceil(totalMatches/50)`. Accepted and
  recorded, not engineered around: a membership change shifts rows up by one, so a person can slide
  between pages during a methodical walk. `placeholderData: keepPreviousData` + dim-and-disable on
  `isFetching`, so the spinner means *first load* again. **The cap note retires** —
  `grid.capped` deleted, `search.hint`/`grid.emptyHint` reworded, and the latent bug fixed:
  `matchCount` must read `totalMatches`, not `rows.length`. **No server change; nothing for the
  addendum.**
- [How much the export exports, and what that costs](144-export-scope-and-cost.md) — **everything is
  exportable, including `all`, but past 500 rows you have to mean it.** One always-enabled button
  over the *current query's* full match set (walked from `skip: 0`, ignoring the page you're on);
  above `totalMatches > 500` a confirm names the cost, below it the file just downloads. The ceiling
  protects **the user's expectation, not the browser or the server** — under ~4 s a click feels like
  it worked, past that it feels like it hung; `phoneGap` (~400) deliberately lands just under, so in
  practice only `all` triggers the dialog. **The `MaxSearchRows` lever is declined and recorded as
  declined**: it's a shared const (raising it deletes the interactive-search guard and breaks 143's
  fixed page), the saving is HTTP not DB (~3–4×, not 10×), and walking at 50 makes export *literally
  the pager's own call in a loop* — zero new contract surface. Progress is a cancellable sonner
  toast, no blocking modal, and the walk never touches the mounted query's cache. The governing rule
  both ways: **cancel or any `ApiError` ⇒ no file at all** — a partial CSV is indistinguishable from
  a complete one in Excel, and this file's use is spotting who's *missing*. Errors surface through
  `apiErrorMessage`; 401 stays `handle401`'s. Plus: terminate on `isCapped` with a 200-page runaway
  guard, dedupe by `employeeId` (a 45-second walk can be shifted by a concurrent SAP insert).
  **No server change; the addendum gains only a deferred note** — if it's ever too slow, add a
  *separate* export cap, don't raise `MaxSearchRows`.

- [What is in the file, and whether Excel opens it right](145-csv-shape-and-excel-fidelity.md) —
  **the file is the wire row unpacked, not the grid screenshotted**: 13 columns, one per
  `UaEmployeeGridRow` field plus the derived Status, with the `ChannelPill` split back into *Codes
  via* + *Reachable* and the seeded/enabled/TOTP facts kept even though Status's precedence chain
  hides them. Every classification is **the label, through the same `t()` key the screen uses** —
  never the raw code — so the file reconciles against the screen by construction; the accepted price
  is that **the export is localised**, headers included. Excel fidelity is three guards in the
  writer: `="…"` formula-text on `employeeId`/`phone` (quoting does *not* save a leading zero), a
  `'` prefix on free text starting `= + - @`, and **BOM + `sep=,` + CRLF** — the `sep=` line because
  Excel's double-click path uses the OS list separator (`;` in Arabic locales), at the cost of a junk
  first row in non-Excel tools. `lastLoginAt` is `formatStamp`'s `YYYY-MM-DD HH:mm` with **no
  `new Date()`**, and `null` is an **empty cell, not "Never"** — a word would make the column text
  and kill sorting. Filename `ua-users-{scope}-{YYYY-MM-DD}.csv` off the card **code** (labels don't
  survive sanitising), date only. Lands as a pure `csv.ts` the vitest suite can cover; the screen and
  the file share `deriveStatus`/`hasDestination`/`credentialKey`/`formatStamp` rather than
  re-deriving. **No server change; nothing for the addendum.**

- [Should bulk export be gated, and should it leave a trace](146-export-gate-and-audit.md) — **no to
  both, on one shared reason**: [144](144-export-scope-and-cost.md) made the export *the pager's own
  call in a loop*, so the server cannot tell an export from ordinary paging. A second grant (a new
  COMMAND on `CONTROLLER='UaUsers'`) would therefore have **no endpoint to enforce at** — client-side
  only, i.e. hide-the-button with nothing behind it — and would **invert least privilege**, fencing
  the mildest act on a screen whose one grant already carries SetPassword / Deactivate / ClearTotp /
  RevokeSession. The separation asked for **already exists one level up**: `UaUsersView` lives on the
  standalone, deliberately-assigned `UA_USERS_ADMIN` role — the lever is *don't grant the screen*.
  Likewise **unaudited**: the client cannot audit itself credibly (the x-api-key `UaAdminEndpoints`
  twin is a documented un-instrumented path), and auditing the underlying reads would write
  targetless rows on no one's audit tab. **Spec:** the export button has **no permission check of its
  own** — it renders whenever the screen does, behind the existing `UaAdminWeb/Access` probe; nothing
  new in `authz-admin`. Both answers share one hinge, so **addendum gains a second deferred note**:
  if gating or auditing is ever required, add a *server* export endpoint (streams + audits + its own
  grant) — which re-decides 144 — never a client `canExport` flag. Guard recorded: 144's >500 confirm
  is a wait-time device, **not** a control, and must not be written up as one.

## Not yet specified

<!-- empty — the way to the destination is clear. -->

## Out of scope

- Implementing the SIS.Api changes. This map produces the contract addendum; the C# lands elsewhere.
- The 50-row cap on any screen other than `admin/ua-users`.
- Replacing the plain HTML table with AG Grid. Paging is added to the table that exists.
- **Paging the audit tab.** [143](143-pager-shape.md) deliberately left `audit()` on its own local
  `{ skip: 0, take: 50 }`, so after the people-list pager lands it is the only capped read still
  walled on this screen. That is a *fourth* ask, not one of the three the destination names, and a
  per-person history 50 entries deep is a different (and unevidenced) case from a 6,000-row roster —
  so it is ruled out rather than carried. Returns as its own effort if anyone hits the wall.
  (The sessions list is another screen and was already out.)
