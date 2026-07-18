# Applying Refactor Findings

Refactoring happens here — at review time, after the tdd loop has everything GREEN (or, until the
runner lands, after `typecheck` is clean and the behavior is confirmed in the running app) — never
mid-loop (`tdd` skill, "Rules of the loop"). When a Standards finding is accepted, apply it with the
tests (or the app-drive) as the safety net: refactor in small steps, run `npm run typecheck` and the
affected suite after each.

Candidates to look for beyond the smell baseline:

- **Duplication** → extract a shared function or `core/ui` component / `core/util` helper
- **Fat components** → lift logic into the feature's store or a pure module (keep tests on the public
  surface — never re-point a test at a new internal helper)
- **Shallow modules** → combine or deepen (small public surface, deep implementation)
- **Feature envy** → move logic to where the data lives (component → store; ad-hoc fetch → `api.ts`)
- **Primitive obsession** → introduce a model type in `core/models/`
- **Literal creep** → any user-visible string that slipped in without a `t()` key is a Standards fix, not a nicety
- **Existing code** the new code reveals as problematic — flag it; widening the refactor beyond the
  diff is the user's call
