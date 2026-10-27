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

    // 608 · the guard editor — a new rule, and one rule of the draft.
    {
      path: 'guards/new',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/guards/GuardEditorPage')).default }),
    },
    {
      path: 'guards/:ruleId/edit',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/guards/GuardEditorPage')).default }),
    },

    // 609 · templates (e.g. `templates`)
    {
      path: 'templates',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/templates/TemplatesPage')).default }),
    },

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
    {
      path: 'approvals',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/approvals/ApprovalsPage')).default }),
    },

    // 612 · simulator and back-test (e.g. `simulator`, `backtests/:id`)
    {
      path: 'simulator',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/simulator/SimulatorPage')).default }),
    },

    // 613 · editions (e.g. `editions`, `editions/:id`)
    {
      path: 'editions',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/editions/EditionsPage')).default }),
    },
    {
      path: 'editions/:list/:id',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/editions/EditionPage')).default }),
    },

    // 614 · review and exceptions (e.g. `review`, `exceptions`)
    {
      path: 'review',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/review/ReviewPage')).default }),
    },
    {
      path: 'exceptions',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/review/ExceptionsPage')).default }),
    },

    // 615 · metrics, flags, rejections (e.g. `metrics`)
    {
      path: 'metrics',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/metrics/MetricsPage')).default }),
    },

    // 617 · insurer settings, category and coverage rules (e.g. `insurers`, `categories`, `coverage`)
    {
      path: 'insurers',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/coverage/InsurersPage')).default }),
    },
    {
      path: 'categories',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/coverage/CategoriesPage')).default }),
    },
    {
      path: 'coverage',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/coverage/CoveragePage')).default }),
    },

    // ── IDF priority (BackOffice spec 3157; oms 619–627) — every IDF leaf lives under `idf/*`, because
    // `/insurance-rules/exceptions` is 614's guard exceptions. One feature folder: `features/insurance-rules/idf/`.

    // 619 · IDF masters — the list (`idf` opens it).
    { path: 'idf', element: <Navigate to="masters" replace /> },
    {
      path: 'idf/masters',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/idf/MastersPage')).default }),
    },

    // 620 · IDF store lists (e.g. `idf/store-lists`)

    // 621 · create / edit a master (opens from the list; a route only if it is a page, e.g. `idf/masters/new`)

    // 622 · a master's page with its upload (e.g. `idf/masters/:masterId`)

    // 623 · versions and restore (on 622's page; a route only if it is its own)

    // 624 · IDF exceptions (e.g. `idf/exceptions`)
    {
      path: 'idf/exceptions',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/idf/ExceptionsPage')).default }),
    },

    // 625 · IDF lookup (e.g. `idf/lookup`)

    // 626 · IDF events (e.g. `idf/events`)
    {
      path: 'idf/events',
      lazy: async () => ({ Component: (await import('@/features/insurance-rules/idf/EventsPage')).default }),
    },

    // 627 · swap report (a tab of 626's page; a route only if it is its own)
  ],
}
