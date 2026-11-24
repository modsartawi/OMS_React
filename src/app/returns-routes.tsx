import { Navigate, type RouteObject } from 'react-router'

/**
 * The Returns area's routes (BackOffice spec 4212, ticket 4224). ONE entry in `app/router.tsx` mounts this layout at
 * `/returns`; every leaf of the area lives HERE, so the parked rule returns page adds its leaf to this file.
 *
 * A pathless layout (no component: react-router renders an `<Outlet>`), so the children are plain leaves.
 */
export const returnsRoute: RouteObject = {
  path: 'returns',
  children: [
    // `/returns` opens the first leaf.
    { index: true, element: <Navigate to="parked" replace /> },

    // 4224 · Parked returns — the list (`?store=&partner=&status=&age=&view=&transaction=&page=`) and its detail drawer.
    {
      path: 'parked',
      lazy: async () => ({ Component: (await import('@/features/returns/parked-returns/ParkedReturnsPage')).default }),
    },
  ],
}
