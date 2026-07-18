import { createBrowserRouter, Navigate } from 'react-router'
import { setNavigator } from '@/core/nav'
import ProtectedLayout from '@/features/auth/ProtectedLayout'

// Library/data mode (baseline §1): plain route arrays; each future module
// contributes its own subtree here. Lazy chunks: login + each screen.
export const router = createBrowserRouter([
  {
    path: '/login',
    lazy: async () => ({ Component: (await import('@/features/auth/LoginPage')).default }),
  },
  {
    path: '/',
    Component: ProtectedLayout,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('@/app/HomePage')).default }) },
      {
        path: 'oms/deliveries',
        lazy: async () => ({ Component: (await import('@/features/oms/deliveries/DeliveriesPage')).default }),
      },
      // Screen 2 — two routes, one component. `openedAs` is fixed by the ROUTE
      // and picks the load/refresh endpoint; it is NOT interchangeable with the
      // payload's `documentCategory`, which picks the mutation endpoint (D-17 /
      // D-19). A delivery-return loads via Delivery/{no} but mutates via
      // UpdateDocument, so deriving either from the other 404s or mis-posts.
      {
        path: 'oms/document/:documentNo',
        lazy: async () => {
          const { default: Page } = await import('@/features/oms/document/DocumentDetailsPage')
          return { Component: () => <Page openedAs="document" /> }
        },
      },
      {
        path: 'oms/delivery/:deliveryNo',
        lazy: async () => {
          const { default: Page } = await import('@/features/oms/document/DocumentDetailsPage')
          return { Component: () => <Page openedAs="delivery" /> }
        },
      },
      {
        path: 'admin/ua-users',
        lazy: async () => ({
          Component: (await import('@/features/admin/ua-admin/UaAdminUsersPage')).default,
        }),
      },
      {
        path: 'admin/authz',
        lazy: async () => ({
          Component: (await import('@/features/admin/authz-admin/AuthzAdminPage')).default,
        }),
      },
      {
        path: 'admin/sessions',
        lazy: async () => ({
          Component: (await import('@/features/admin/active-sessions/ActiveSessionsPage')).default,
        }),
      },
      {
        path: 'pricing/simulation',
        lazy: async () => ({
          Component: (await import('@/features/pricing/simulation/SimulationPage')).default,
        }),
      },
      {
        path: 'pricing/bonus-buy-download',
        lazy: async () => ({
          Component: (await import('@/features/pricing/bonus-buy-download/BonusBuyDownloadPage')).default,
        }),
      },
      {
        path: 'pricing/coupons',
        lazy: async () => ({
          Component: (await import('@/features/pricing/coupons/CouponsAdminPage')).default,
        }),
      },
      {
        path: 'pricing/coupon-support',
        lazy: async () => ({
          Component: (await import('@/features/pricing/coupons/CouponSupportPage')).default,
        }),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

setNavigator((to) => {
  void router.navigate(to)
})
