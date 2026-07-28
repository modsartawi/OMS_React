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
  // PROTOTYPE — throwaway (wayfinder ticket 135). Top-level, OUTSIDE
  // ProtectedLayout on purpose: the call-center console renders its own
  // full-viewport layout with no app chrome (map 126 note 13), and hosting it
  // inside AppShell would hide exactly the thing being judged.
  {
    path: '/prototype/callcenter-console',
    lazy: async () => ({
      Component: (await import('@/features/callcenter/__prototype__/ConsolePrototypePage')).default,
    }),
  },
  // PROTOTYPE — throwaway (wayfinder ticket 138). Same reasoning: it mounts
  // 135's console whole, with only the guidance region swapped per variant.
  {
    path: '/prototype/near-miss-guidance',
    lazy: async () => ({
      Component: (await import('@/features/callcenter/__prototype__/guidance/GuidancePrototypePage')).default,
    }),
  },
  // PROTOTYPE — throwaway (wayfinder ticket 175, reaching 176 + 155). Same
  // reasoning again: 135's furniture whole, with the HEADER-CAPTURE region
  // swapped per variant — the opening gate, fulfilment mode, the store pick,
  // the slot, source + reference, and the payment type that is drawn nowhere.
  {
    path: '/prototype/callcenter-header',
    lazy: async () => ({
      Component: (await import('@/features/callcenter/__prototype__/header/HeaderPrototypePage')).default,
    }),
  },
  // PROTOTYPE — throwaway (wayfinder ticket 176, drawing 155 + 156). Unlike the
  // three above it mounts the REAL ConsoleShell rather than a host that looks
  // like it: the subject is what the SHIPPED console does when `deliveryType`
  // flips, which a hand-drawn host would answer by construction (177's lesson).
  {
    path: '/prototype/callcenter-fulfilment',
    lazy: async () => ({
      Component: (await import('@/features/callcenter/console/__prototype__/FulfilmentPrototypePage')).default,
    }),
  },
  // The call-center console (ticket 162). Under the SAME auth guard as every
  // other screen — session, theme and the 401 path are unchanged — but OUTSIDE
  // AppShell: the console renders its own full-viewport three-column layout
  // (map 126 note 13), and hosting it inside the nav chrome would leave it
  // ~1100px of a 1440px desktop and two competing top bars.
  {
    path: '/callcenter',
    element: <ProtectedLayout chromeless />,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('@/features/callcenter/console/CallCenterConsolePage')).default,
        }),
      },
    ],
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
        path: 'admin/broadcast',
        lazy: async () => ({
          Component: (await import('@/features/admin/broadcast/BroadcastComposePage')).default,
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
        path: 'pricing/bonus-buy-inquiry',
        lazy: async () => ({
          Component: (await import('@/features/pricing/bonus-buy-inquiry/BonusBuyInquiryPage')).default,
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
