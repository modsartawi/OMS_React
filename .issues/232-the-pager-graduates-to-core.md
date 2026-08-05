---
status: open
spec: 231
blocked-by: —
---

# 232 — The pager graduates to core and can page by a real total

## What to build

**Prefactor, done before the Loy Actions tab needs it.** The grid pager is shared UI living inside a
feature, and the Loy member screen is its second consumer. Per
[feature-structure](../.claude/rules/feature-structure.md), logic shared by two features **graduates
up to `@/core/*`** — it never crosses sideways.

Four things are wrong with reusing it as-is, all verified against the code, not assumed:

1. 🚩 **It lives in `features/admin/ua-admin/`.** A `features/loy/*` import of it is a hard
   import-boundary violation that **fails `npm run lint`** — `tools/check-boundaries.mjs` discovers
   features from the tree, so this is caught mechanically with no edit to the linter.
2. 🚩 **`PAGE_SIZE` is hardcoded `50`.** Loy Actions pages **25** (the server's own default), and
   `skipForPage`, `pageCountFromTotalMatches` and `showsPager` all close over the constant.
3. 🚩 **Next is driven by `isCapped`** — documented as *"the envelope's 'more rows exist beyond THIS
   page' flag"*, a Ua-users envelope fact. The Loy actions read returns a **real `recordsCount`**, so
   Next must come from `page < pageCount`. Reusing the capped path against a real total would leave
   Next dead or wrongly live on the last page.
4. 🚩 **The component hardcodes `useTranslation('ua-admin')`** and its `pager.*` keys live in
   `ua-admin.json`, so rendered from Loy it would resolve keys in the wrong namespace.

So: move the component and its pure arithmetic to `@/core/*`, make the page size a parameter, add a
**next-from-total** path beside the existing next-from-capped one, and move the labels to a namespace
both callers can reach. Repoint the single existing consumer.

Both enablement rules must survive — this is an addition, not a replacement:

```ts
// next-from-capped: the caller only knows "there are more" (Ua users' envelope)
// next-from-total:  the caller knows the real count (Loy actions' recordsCount)
type PagerBounds = { page: number; pageSize: number } & (
  | { isCapped: boolean }
  | { totalMatches: number }
)
```

**Ua Users must be observably unchanged** — same 50 a page, same Prev/Next behaviour, same labels.
This ticket adds a capability and moves a file; it changes no screen.

## Spine reach

model/api · **store/logic** (the pure pager arithmetic) · **component** (`core/ui`) · **i18n**
(the `pager.*` keys move to a shared namespace) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `pager` — page size is a parameter: 25 and 50 produce different `skip`, page counts and
      "renders at all" answers from the same match count · **pure**
- [ ] `pager` — Next comes from `isCapped` when that is what the caller knows, and from
      `page < pageCount` when a real total is; an empty result is one page, never zero · **pure**
- [ ] Ua Users unchanged — drive `/admin/ua-users` past page 1 and back: same 50 a page, same
      labels, Next dead on the last page · **flow (drive)** · verify via typecheck + drive

## Boundaries

No new endpoint. **`npm run lint` is part of Done-when here, not an afterthought** — the whole point
is the boundary gate. The `pager.*` keys move out of `ua-admin.json` into a namespace `core/ui` may
use (`common`); that is a **key move, not a rename** — the strings do not change.

## Done when

The pager component and its arithmetic live under `@/core/*`, `npm run lint` and `npm run typecheck`
are green, the pure suite covers both enablement rules at both page sizes, and `/admin/ua-users`
pages exactly as it did before.

## Blocked by

None — can start immediately.
