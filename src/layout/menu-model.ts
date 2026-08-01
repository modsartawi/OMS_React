import type { LucideIcon } from 'lucide-react'
import { Activity, Box, Calculator, ClipboardCheck, Download, FileText, Headset, HeartPulse, KeyRound, LifeBuoy, Search, Send, ShieldCheck, Tags, Ticket, UserCog } from 'lucide-react'
import { uaAdminApi } from '@/features/admin/ua-admin/api'
import { authzAdminApi } from '@/features/admin/authz-admin/api'
import { sessionMonitorApi } from '@/features/admin/active-sessions/api'
import { broadcastApi } from '@/features/admin/broadcast/api'
import { CALLCENTER_ACCESS_KEY, callCenterApi } from '@/features/callcenter/console/api'
import { simulationApi } from '@/features/pricing/simulation/api'
import { bonusBuyDownloadApi } from '@/features/pricing/bonus-buy-download/api'
import { couponsApi } from '@/features/pricing/coupons/api'
// The bonus-buy grant probe lives in `@/core/` (ticket 118): the Simulation screen is a
// second consumer, and a feature may not import another feature's api.
import { BBY_ACCESS_KEY, bonusBuyAccessApi } from '@/core/bonus-buy/api'
// The OMS probe likewise lives in `@/core/` (ticket 125): both OMS pages guard on it,
// and a feature may not import another feature's api.
import { OMS_ACCESS_KEY, omsAccessApi } from '@/core/oms/api'
// The Nphies probe, same reason and one step further (ticket 211): contract 209 §1
// gives the whole area ONE grant, so the leaf and every screen in both
// `features/nphies/*` features share this single probe.
import { NPHIES_ACCESS_KEY, nphiesAccessApi } from '@/core/nphies/api'

// Data-driven menu: adding a module = appending here, no layout code changes.
// labelKey is an i18n key (zero-literal rule).
export interface ShellMenuItem {
  labelKey: string
  icon?: LucideIcon
  routerLink?: string
  /** Keeps the leaf highlighted + group expanded while a drill-down under this prefix is open. */
  activePrefix?: string
  items?: ShellMenuItem[]
  /**
   * Optional permission-aware show/hide gate (issue 429, web-platform foundation).
   * ABSENT = always visible. Since ticket 125 gated the OMS leaf, every leaf in
   * `MENU` carries a probe — an ungated one is now the exception, not the rule, and
   * a new one needs a reason. Present = the shell hides this
   * item until the probe confirms access. This is show/hide hygiene only — the
   * server grant stays authoritative (a deep-link still hits the screen's own
   * in-page denied backstop). Build a probe with `accessProbe(...)`.
   */
  access?: AccessProbe
}

/**
 * A per-item access probe: the module's OWN screen-access call, keyed so the
 * shell's probe and the screen's own route-guard share one react-query cache
 * entry (one network call, not two). The shell reads `visible(data)` only once
 * the probe has resolved successfully; pending OR error => hidden (fail-closed,
 * and no flash-then-hide). Adding a gated module = append an item with a probe;
 * no layout code changes.
 */
export interface AccessProbe {
  /** react-query key — MUST equal the screen guard's key so the call dedupes. */
  key: readonly unknown[]
  /** the module's screen-access call, verbatim; its raw result is cached & shared. */
  run: () => Promise<unknown>
  /** derive show/hide from the raw result; fail-closed edges handled by the shell. */
  visible: (data: unknown) => boolean
}

/**
 * Typed builder for {@link AccessProbe} — keeps `run` and `visible` in sync on
 * the module's own result type without leaking a generic onto `ShellMenuItem`.
 */
export function accessProbe<T>(p: {
  key: readonly unknown[]
  run: () => Promise<T>
  visible: (data: T) => boolean
}): AccessProbe {
  return p as AccessProbe
}

export const MENU: ShellMenuItem[] = [
  {
    labelKey: 'deliveries:menu.oms',
    icon: Box,
    items: [
      {
        labelKey: 'deliveries:menu.deliveries',
        icon: FileText,
        routerLink: '/oms/deliveries',
        activePrefix: '/oms',
        // Same key + call as BOTH OMS page guards → one shared probe (ticket 125).
        // Gated on the LIST grant: the leaf opens the list, and a session that holds
        // the detail grant but not the list one has no business in the nav here.
        // This probe FAILS CLOSED — see `@/core/oms/api`.
        access: accessProbe({
          key: OMS_ACCESS_KEY,
          run: () => omsAccessApi.access(),
          visible: (r) => r.canOpenList === true,
        }),
      },
    ],
  },
  {
    labelKey: 'ua-admin:menu.admin',
    icon: ShieldCheck,
    items: [
      {
        labelKey: 'ua-admin:menu.users',
        icon: UserCog,
        routerLink: '/admin/ua-users',
        // Own route as the active prefix so the sibling Authorization Admin leaf
        // (also under /admin) doesn't co-highlight.
        activePrefix: '/admin/ua-users',
        // Same key + call as UaAdminUsersPage's own guard → one shared probe.
        access: accessProbe({
          key: ['ua-admin', 'access'],
          run: () => uaAdminApi.access(),
          visible: (r) => r.canOpen === true,
        }),
      },
      {
        labelKey: 'authz-admin:menu.authz',
        icon: KeyRound,
        routerLink: '/admin/authz',
        activePrefix: '/admin/authz',
        // Same key + call as AuthzAdminPage's own guard → one shared probe.
        access: accessProbe({
          key: ['authz-admin', 'access'],
          run: () => authzAdminApi.access(),
          visible: (r) => r.screenAllowed === true,
        }),
      },
      {
        labelKey: 'active-sessions:menu.sessions',
        icon: Activity,
        routerLink: '/admin/sessions',
        activePrefix: '/admin/sessions',
        // Same key + call as ActiveSessionsPage's own guard → one shared probe.
        // Gated by its OWN grant, separate from Ua Users (spec 006).
        access: accessProbe({
          key: ['active-sessions', 'access'],
          run: () => sessionMonitorApi.access(),
          visible: (r) => r.canOpen === true,
        }),
      },
      {
        // Send Broadcast (spec 031). Soft-gated on the NotificationBroadcast grant
        // (038) via the SAME ['broadcast','access'] probe the page's own guard uses
        // → one shared call. ⚠️ GET Notifications/Access doesn't exist server-side
        // yet: the probe maps a 404 to allowed=true (unknown → shown) so the nav
        // degrades gracefully; the server Create stays authoritative (NC_FORBIDDEN).
        labelKey: 'broadcast:menu.sendBroadcast',
        icon: Send,
        routerLink: '/admin/broadcast',
        activePrefix: '/admin/broadcast',
        access: accessProbe({
          key: ['broadcast', 'access'],
          run: () => broadcastApi.access(),
          visible: (r) => r.allowed === true,
        }),
      },
    ],
  },
  {
    // Its own top-level group (134 §7): `features/callcenter/` is neither `oms/`
    // nor `admin/`, and a new area folder appears exactly when a new nav group
    // does. The leaf carries the SAME exported key the route guard uses, which
    // is the one-call invariant.
    labelKey: 'callcenter:menu.callCenter',
    icon: Headset,
    items: [
      {
        labelKey: 'callcenter:menu.console',
        icon: Headset,
        routerLink: '/callcenter',
        activePrefix: '/callcenter',
        // FAILS CLOSED — see `features/callcenter/console/api`. What is behind
        // this leaf mints real OMS orders, so a pending or errored probe hides
        // it rather than revealing it.
        access: accessProbe({
          key: CALLCENTER_ACCESS_KEY,
          run: () => callCenterApi.access(),
          visible: (r) => r.canOpenConsole === true,
        }),
      },
    ],
  },
  {
    // Its own top-level group (spec 209 §1, ticket 211): `features/nphies/` is a
    // new area, and a new area folder appears exactly when a new nav group and
    // URL prefix do. Follows the call-centre group above as the precedent.
    labelKey: 'eligibility:menu.nphies',
    icon: HeartPulse,
    items: [
      {
        labelKey: 'eligibility:menu.newCheck',
        icon: ClipboardCheck,
        routerLink: '/nphies/eligibility/new',
        // The whole area, so the list and detail routes that join later keep this
        // leaf highlighted rather than each needing their own.
        activePrefix: '/nphies',
        // FAILS CLOSED — see `@/core/nphies/api`. What is behind this leaf talks
        // to the national exchange, so a pending or errored probe hides it rather
        // than revealing it (ticket 211's Boundaries, in as many words).
        access: accessProbe({
          key: NPHIES_ACCESS_KEY,
          run: () => nphiesAccessApi.access(),
          visible: (r) => r.canOpenNphies === true,
        }),
      },
    ],
  },
  {
    labelKey: 'simulation:menu.pricing',
    icon: Tags,
    items: [
      {
        labelKey: 'simulation:menu.simulation',
        icon: Calculator,
        routerLink: '/pricing/simulation',
        activePrefix: '/pricing/simulation',
        // Same key + call as SimulationPage's own guard → one shared probe.
        // Gated by its OWN grant (POS_SIMULATION_ADMIN), spec 503 / BackOffice 509.
        access: accessProbe({
          key: ['simulation', 'access'],
          run: () => simulationApi.access(),
          visible: (r) => r.canOpen === true,
        }),
      },
      {
        labelKey: 'bonus-buy-download:menu.bonusBuyDownload',
        icon: Download,
        routerLink: '/pricing/bonus-buy-download',
        activePrefix: '/pricing/bonus-buy-download',
        // Same key + call as BonusBuyDownloadPage's own guard → one shared probe.
        // Gated by its OWN screen grant (BackOfficeScreen[BbyDownload,03]), BackOffice 515.
        access: accessProbe({
          key: ['bonus-buy-download', 'access'],
          run: () => bonusBuyDownloadApi.access(),
          visible: (r) => r.screenAllowed === true,
        }),
      },
      {
        labelKey: 'bonus-buy-inquiry:menu.bbyInquiry',
        icon: Search,
        routerLink: '/pricing/bonus-buy-inquiry',
        activePrefix: '/pricing/bonus-buy-inquiry',
        // Same key + call as BonusBuyInquiryPage's own guard → one shared probe.
        // Gated by its OWN screen grant (BackOfficeScreen[BbyInquiry]). ⚠️ GET Bby/Access
        // doesn't exist server-side yet: the probe maps 404/network to screenAllowed=true
        // (fail-open) so this read-only inquiry degrades gracefully; the list endpoint's
        // 403 ACCESS_DENIED stays the real boundary (spec 061 / contract 057 §4).
        access: accessProbe({
          key: BBY_ACCESS_KEY,
          run: () => bonusBuyAccessApi.access(),
          visible: (r) => r.screenAllowed === true,
        }),
      },
      {
        labelKey: 'coupons:menu.coupons',
        icon: Ticket,
        routerLink: '/pricing/coupons',
        activePrefix: '/pricing/coupons',
        // Same key + call as CouponsAdminPage's own guard → one shared probe.
        // The Templates + Import workspaces are admin-only, so the leaf shows on
        // CanAdmin (ticket 521 widens to CanAdmin || CanSupport with Inquiry).
        access: accessProbe({
          key: ['coupons', 'access'],
          run: () => couponsApi.access(),
          visible: (r) => r.canAdmin === true,
        }),
      },
      {
        labelKey: 'coupons:menu.couponSupport',
        icon: LifeBuoy,
        routerLink: '/pricing/coupon-support',
        activePrefix: '/pricing/coupon-support',
        // Shares the ONE ['coupons','access'] probe with the Admin leaf + both pages
        // (issue 429). Support screen shows on CanSupport, which the server sets =
        // support OR admin — so a support-only agent sees this leaf but NOT the
        // admin Coupons leaf above (ticket 523).
        access: accessProbe({
          key: ['coupons', 'access'],
          run: () => couponsApi.access(),
          visible: (r) => r.canSupport === true,
        }),
      },
    ],
  },
]

/** URL match: exact, or startsWith(prefix + '/'); query/hash already stripped by caller. */
export function isActive(item: ShellMenuItem, pathname: string): boolean {
  const target = item.activePrefix ?? item.routerLink
  if (!target) return false
  return pathname === target || pathname.startsWith(target + '/')
}
