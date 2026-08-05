# HITL log — ticket 232 (the pager graduates to core)

## Q: Where under `@/core/*` do the pager component and its arithmetic land?

**Decision taken:** `src/core/ui/GridPager.tsx` + `src/core/ui/pager.ts` (+ `pager.test.ts`).
**Why:** `core/ui/` already holds the repo's shared presentational primitives (`ErrorBanner`,
`StatusBadge`, `Modal`), and the pager is one; `core/nphies/ListPager.tsx` is domain-scoped and is
not this pager's home.
**Revisit if:** a later ticket wants one pager component to serve both footers — then `ListPager`
and `GridPager` merge and the home is decided again.

## Q: `PAGE_SIZE = 50` was exported from the moved module. Where does Ua Users' own size live now?

**Decision taken:** a new one-constant `src/features/admin/ua-admin/page-size.ts`. The arithmetic
moved to core and takes `pageSize` as a parameter; the *value* 50 stayed with the screen that
chose it. The old `features/admin/ua-admin/pager.ts` is deleted.
**Why:** the ticket's complaint is that the constant was baked into the arithmetic, not that
Ua Users may not have a page size. A core module must not carry one caller's number, and
`api.ts` / `export.ts` / `export.test.ts` all still need it.
**Revisit if:** a third consumer wants 50 too — then it is a default in core, not a feature constant.

## Q: How does the component pick between next-from-capped and next-from-total?

**Decision taken:** `isCapped` is an optional prop; omitting it selects the total-driven path.
`totalMatches` stays required, because the "Page N of M" readout needs it either way.
**Why:** the arithmetic keeps the ticket's honest `PagerBounds` union; the component's props are the
thin surface over it, and an omitted flag is the clearest way for a caller to say "I hold a real
count". A required discriminant would have been ceremony on a two-caller component.
**Revisit if:** a caller ever holds `isCapped` and no total — then the readout needs its own input
and the props become a real union.

## Q: The `pager.*` keys move to which namespace?

**Decision taken:** `common`, exactly as the ticket's Boundaries section specifies. Key move, not a
rename — the four strings are byte-identical.
**Why:** `core/ui` cannot read a feature namespace, and `common` is the namespace every caller has.
**Revisit if:** never, within this wave.

## Note — two pre-existing drive failures, not caused by this ticket

`node tools/ua-users-scale-drive.mjs` reports 83/85. Both failures assert the report card reads
**"Activation done"**; `ua-admin.json` has said **"Authenticator active"** since before this change,
and the only edit this ticket made to that file was deleting the `pager` block. Every pager
assertion in the drive passes (50 a page, "Page 1 of 120", Prev dead on page 1, Next dead on the
last page, the walk stepping in 50s). Left alone deliberately — fixing an unrelated stale drive
expectation is not this ticket's scope.
