import { Navigate, type RouteObject } from 'react-router'

/**
 * The insurance-rules area's routes (BackOffice spec 3126; oms 607 lays them out). ONE entry in
 * `app/router.tsx` mounts this layout at `/insurance-rules`; every leaf of the area lives HERE, so a later
 * slice adds its leaf to this file and never touches the router.
 *
 * A pathless layout (no component: react-router renders an `<Outlet>`), so the children are plain leaves.
 * Static leaves sit beside a `:param` one; react-router ranks a static segment above the param.
 *
 * ⚠️ To keep parallel slices merge-clean: add your leaf under YOUR ticket's slot comment only (the blank
 * lines between slots keep the hunks apart). Delete nothing that is not yours.
 */
export const insuranceRulesRoute: RouteObject = {
  path: 'insurance-rules',
  children: [
    // `/insurance-rules` opens the first leaf.
    { index: true, element: <Navigate to="guards" replace /> },

    // 607 · Guards — the list by folder, and one rule read as sentences.
    {
      path: 'guards',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/guards/GuardsPage')).default }),
    },
    {
      path: 'guards/:ruleId',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/guards/GuardPage')).default }),
    },

    // 608 · the guard editor (e.g. `guards/:ruleId/edit`)

    // 609 · templates (e.g. `templates`)

    // 610 · lists, fields, patient and policy lists (e.g. `lists`, `fields`)
    {
      path: 'lists',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/lists/ListsPage')).default }),
    },
    {
      path: 'fields',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/fields/FieldsPage')).default }),
    },

    // 611 · approval and versions (e.g. `approvals`, `guards/:ruleId/versions`)

    // 612 · simulator and back-test (e.g. `simulator`, `backtests/:id`)

    // 613 · editions (e.g. `editions`, `editions/:id`)

    // 614 · review and exceptions (e.g. `review`, `exceptions`)

    // 615 · metrics, flags, rejections (e.g. `metrics`)

    // 617 · insurer settings, category and coverage rules (e.g. `insurers`, `categories`, `coverage`)
  ],
}
