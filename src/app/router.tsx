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
  // PROTOTYPE — throwaway (wayfinder ticket 159: the coupon and the loyalty
  // signup, the two settled features 135 and 138 never drew). Mounts the REAL
  // ConsoleShell for 176's reason. ⚠ Every v1.10 field it renders is a stub —
  // no server carries `header.coupons` yet.
  {
    path: '/prototype/callcenter-coupon',
    lazy: async () => ({
      Component: (await import('@/features/callcenter/console/__prototype__/CouponSignupPrototypePage')).default,
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
  // The two collection documents' print routes (spec 249, tickets 251 and 252).
  // Top-level and OUTSIDE the AppShell subtree below on purpose: a print page's
  // entire body IS the document (241), so there is no nav, no shell and nothing
  // hidden behind `@media print` to keep off the paper. `chromeless` keeps the
  // session guard — the chrome is what differs, never the auth.
  {
    path: '/collection/receipt/:collectionReceiptId',
    element: <ProtectedLayout chromeless />,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('@/features/collection/inquiry/ReceiptPrintPage')).default,
        }),
      },
    ],
  },
  {
    path: '/collection/acr/:acrId',
    element: <ProtectedLayout chromeless />,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('@/features/collection/inquiry/AcrPrintPage')).default,
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
      // The Nphies area (spec 209, tickets 211 + 212 + 213 + 214). More routes
      // join these under the same `/nphies/*` prefix as the wave lands; the check
      // form is slice 0 because its endpoint is the one that already ships.
      {
        // The list an agent lands on (212) — last 7 days, and the window is a
        // removable chip rather than a silent truncation.
        path: 'nphies/eligibility',
        lazy: async () => ({
          Component: (await import('@/features/nphies/eligibility/EligibilityListPage')).default,
        }),
      },
      {
        path: 'nphies/eligibility/new',
        lazy: async () => ({
          Component: (await import('@/features/nphies/eligibility/EligibilityCheckPage')).default,
        }),
      },
      {
        // One response as its own page (213) — a ROUTE, not a modal, so it
        // survives a refresh and can be linked to. It follows the static `new`
        // above; react-router ranks a static segment over a dynamic one either
        // way, so `/nphies/eligibility/new` can never be read as an id.
        path: 'nphies/eligibility/:id',
        lazy: async () => ({
          Component: (await import('@/features/nphies/eligibility/EligibilityDetailPage')).default,
        }),
      },
      {
        // The authorizations list (214) — the screen an agent lives on between
        // raising a request and its verdict. A SIBLING of the eligibility list
        // rather than a child of it: it is the other half of the area, not a
        // drill-down, and 216's detail joins it at `/nphies/authorizations/:id`.
        path: 'nphies/authorizations',
        lazy: async () => ({
          Component: (await import('@/features/nphies/authorizations/AuthorizationListPage'))
            .default,
        }),
      },
      {
        // The authorization form (217) — the effort's core, and a **session**
        // rather than a form: it opens a real engine transaction on mount and
        // abandons it on the way out. Addressed by the eligibility it is raised
        // from and the coverage that was chosen (`?from=&coverage=`, 213's seam),
        // so it can be reached days after the check. Static, so it precedes the
        // dynamic `:id` below — react-router ranks it first either way.
        path: 'nphies/authorizations/new',
        lazy: async () => ({
          Component: (await import('@/features/nphies/authorizations/AuthorizationFormPage'))
            .default,
        }),
      },
      {
        // One authorization as its own page (216) — a ROUTE, not a modal, so it
        // survives a refresh and can be linked to, and it is opened from the
        // list's own Open column. It is where the payer's per-line reasons and
        // the attachments as submitted live, which is why there is no separate
        // rejection view anywhere in this area.
        path: 'nphies/authorizations/:id',
        lazy: async () => ({
          Component: (await import('@/features/nphies/authorizations/AuthorizationDetailPage'))
            .default,
        }),
      },
      // The Loyalty area (spec 231, ticket 233) — two routes, ONE component and
      // two states of it: the centred field, and a resolved member with the
      // field collapsed into a bar (227, variant B).
      //
      // 🚩 The URL holds the LoyId, never what was typed, so a refresh re-reads
      // by key and does not replay the resolution cascade — that runs on submit
      // only. There is no menu item yet: the screen is reachable by URL alone
      // until 234 adds the nav item WITH its access probe, so it never exists in
      // the nav ungated.
      {
        path: 'loy/members',
        lazy: async () => ({
          Component: (await import('@/features/loy/member/MemberLookupPage')).default,
        }),
      },
      {
        path: 'loy/members/:loyId',
        lazy: async () => ({
          Component: (await import('@/features/loy/member/MemberLookupPage')).default,
        }),
      },
      // The Collections area (spec 249, ticket 253) — a new top-level area at
      // `/collection/*`, one feature behind ONE `CollectionWeb/Access` probe.
      // Four routes now; the two document routes
      // (`/collection/receipt/:collectionReceiptId`, `/collection/acr/:acrId`)
      // join under this same prefix with 251 and 252 — but OUTSIDE this
      // ProtectedLayout subtree, because a print page's entire body is the
      // document and the app chrome would print with it.
      //
      // 🚩 Each Page carries its OWN in-page guard on the SAME probe key the nav
      // leaf reads. The nav merely hides; a hand-typed URL is refused by the
      // screen's backstop here and, once the door lands, by the endpoint's grant
      // filter — which is the real boundary.
      {
        path: 'collection/collections',
        lazy: async () => ({
          Component: (await import('@/features/collection/inquiry/CashCollectionsPage')).default,
        }),
      },
      {
        path: 'collection/acrs',
        lazy: async () => ({
          Component: (await import('@/features/collection/inquiry/AcrsPage')).default,
        }),
      },
      {
        path: 'collection/deposits',
        lazy: async () => ({
          Component: (await import('@/features/collection/inquiry/DepositsPage')).default,
        }),
      },
      {
        path: 'collection/attempts',
        lazy: async () => ({
          Component: (await import('@/features/collection/inquiry/CollectionAttemptsPage')).default,
        }),
      },
      // The area's one WRITE screen (BackOffice 1169): who serves each branch.
      // Behind its OWN grant — reading a collection list never implies rewriting
      // the master data those lists filter by — and, like the four above, behind
      // its own in-page backstop on the same probe key the nav leaf reads.
      {
        path: 'collection/assignment',
        lazy: async () => ({
          Component: (await import('@/features/collection/inquiry/CollectionAssignmentPage')).default,
        }),
      },
      // The accountant's settlement account (spec 267, ticket 268) — the area's
      // SIXTH route and its SECOND feature. Not a new area: same nav group, same
      // `/collection/*` prefix, same one `CollectionWeb/Access` probe, a further
      // grant on it (D1). Its own feature folder because it is its own screen with
      // its own doors — which is what pushed the shared probe up into
      // `@/core/collection/api`, a feature being unable to import a feature.
      //
      // 🔑 **FOUR screens under one prefix since ticket 283**, and the parent is the
      // gate plus the shared chrome. A path segment names *which* screen; a parameter
      // names what that screen is looking at (spec 282 D3) — which is why `?store=`
      // and `?entry=` are NOT routes: a branch's account is where you land from a
      // hit, a row or a phone call, not a nav destination. Every 269-era address
      // therefore still works, untouched.
      //
      // The children are lazy in their own right, so the ledger's grid is not in the
      // chunk a reader downloads to look at the door — and an unmatched child is not
      // mounted, so it issues no call (254's rule, kept).
      //
      // ⚠️ The pre-283 `?view=` addresses are redirected by `SettlementPage` rather
      // than by a route: the shim reads a parameter, and a route matches a path.
      {
        path: 'collection/settlement',
        lazy: async () => ({
          Component: (await import('@/features/collection/settlement/SettlementPage')).default,
        }),
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('@/features/collection/settlement/SettlementOverview'))
                .default,
            }),
          },
          {
            // The ageing lane (spec 282). An empty shell until 285 draws it — the
            // address exists first so the nav (284) points at a screen rather than
            // at a 404, and so the lane is built once rather than addressed twice.
            path: 'open',
            lazy: async () => ({
              Component: (await import('@/features/collection/settlement/OpenSettlements')).default,
            }),
          },
          {
            path: 'ledger',
            lazy: async () => ({
              Component: (await import('@/features/collection/settlement/LedgerView')).default,
            }),
          },
          {
            // The month's audit, uploaded — and with `?batch=`, that batch's
            // withdrawal. One screen, because *"finance sent the wrong file"* is
            // answered where the file was sent from.
            path: 'upload',
            lazy: async () => ({
              Component: (await import('@/features/collection/settlement/UploadView')).default,
            }),
          },
        ],
      },
      // The Reports area (spec 261, ticket 263) — a new top-level area at
      // `/reports/*`, one feature behind ONE `RetailInvoice/Access` probe. The
      // area is the point as much as the screen is: the render rail was designed
      // reusable (1042 D1), so the folder that will hold the second report screen
      // is worth creating with the first.
      //
      // 🚩 The Page carries its OWN in-page guard on the SAME probe key the nav
      // leaf reads. The nav merely hides; a hand-typed URL is refused by the
      // screen's backstop here and by the endpoint's grant filter — a bare 403
      // with no body at all, which is the real boundary.
      {
        path: 'reports/invoice',
        lazy: async () => ({
          Component: (await import('@/features/reports/retail-invoice/RetailInvoicePage')).default,
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
