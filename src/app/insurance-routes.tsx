import { Navigate, type RouteObject } from 'react-router'

/**
 * The Insurance area's routes (BackOffice spec 4050; oms 922 lays them out). ONE entry in `app/router.tsx` mounts this
 * layout at `/insurance`; every leaf of the area lives HERE, so a later slice adds its leaf to this file and never
 * touches the router.
 *
 * A pathless layout (no component: react-router renders an `<Outlet>`), so the children are plain leaves. 924's static
 * leaves (`patterns/settings`, `patterns/reveals`) sit beside `patterns/:caseId`; react-router ranks a static segment
 * above the param, so neither is ever read as a case id.
 *
 * ⚠️ To keep parallel slices merge-clean: add your leaf under YOUR ticket's slot comment only (the blank lines between
 * slots keep the hunks apart). Delete nothing that is not yours.
 */
export const insuranceRoute: RouteObject = {
  path: 'insurance',
  children: [
    // `/insurance` opens the first leaf.
    { index: true, element: <Navigate to="patterns" replace /> },

    // 922 · Pattern cases — the list (`?store=&from=&to=&signal=&status=&severity=&page=`), and one case's screen.
    {
      path: 'patterns',
      lazy: async () => ({ Component: (await import('@/features/insurance/patterns/PatternCasesPage')).default }),
    },
    {
      path: 'patterns/:caseId',
      lazy: async () => ({ Component: (await import('@/features/insurance/patterns/PatternCasePage')).default }),
    },

    // 923 · the reveal is a dialog on the case screen: no route of its own.

    // 924 · Pattern settings (`patterns/settings`, the manager's)

    // 924 · Reveal log (`patterns/reveals`, the manager's)
  ],
}
