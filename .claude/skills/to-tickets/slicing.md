# Slicing heuristics (React/OMS)

How to cut a spec into tracer-bullet tickets in *this* codebase. Read while drafting Step 3.

## Name the spine first

The **spine** is the thinnest end-to-end path that makes the feature *real* — the vertical run from
data to pixels. For an OMS screen it is almost always:

```
model/api ─→ store/logic ─→ component/route ─→ i18n keys ─→ (test / app-drive)
```

- **model/api** — a type in `core/models/` and a function in the feature's `api.ts` over `core/api.ts`.
- **store/logic** — a zustand store or pure module (filter builder, reducer, formatter) holding the
  decision. This is where testable logic concentrates — keep it out of the component.
- **component/route** — the `.tsx` and its entry in `app/router.tsx` (route arrays per module).
- **i18n keys** — the namespace JSON under `locales/en/`. Part of the spine, not an afterthought:
  a screen with raw literals is not done (`.claude/rules/i18n-zero-literal`).

Every slice cuts a narrow path through *all* of these for one capability — never "build all the APIs,
then all the components" (that's horizontal, the `tdd` anti-pattern).

## Pick Slice 0 by risk × spine-coverage

Slice 0 is the tracer bullet: the smallest slice that both **exercises the whole spine end to end**
and **retires the biggest unknown**. If the risk is a new endpoint's envelope shape, Slice 0 fetches
one row and renders one field — proving the api → model → render path — before any filter panel,
grid, or export is built. Later slices thicken it (more columns, more filters, actions) against a
spine already known to work.

## Sizing

One slice = one fresh context window. Signs a slice is too big: it touches three feature folders,
its Proof lists more than ~3 tests, or you can't state its Done-when in one sentence. Too small:
it's a horizontal step (an api function with nothing rendering it) — merge it up into the capability
it serves.

## What earns its own ticket

- A **new route/screen** — its own slice (often several: skeleton → data → interactions).
- A **new API endpoint dependency** — folded into the first slice that renders its data, not a
  ticket on its own (there's nothing to demo without the render).
- **Cross-cutting infra** the feature is the first to need — the vitest/RTL bootstrap, a new shared
  `core/ui` primitive, an i18n namespace — pull **forward** as an early slice that later ones block on.
- **RTL/logical-utility retrofit** or a **theme pass** — usually its own effort, not smuggled into a
  behavior slice; call it out under Boundaries if a slice unavoidably touches it.

## Expand–contract (the wide-refactor exception)

Renaming a widely-used model field or reshaping a shared prop breaks many call sites at once — no
single slice stays green. Sequence it expand → migrate (batches per feature folder) → contract, each
batch keeping `npm run typecheck` green because the old form still exists. See the SKILL's wide-refactor
paragraph.
