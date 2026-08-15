import type { LucideIcon } from 'lucide-react'
import { Activity, Banknote, Box, Calculator, ClipboardCheck, Download, FileBarChart, FileCheck2, FileSpreadsheet, FileText, Gem, Headset, HeartPulse, History, KeyRound, Landmark, LifeBuoy, ListChecks, Receipt, Scale, Search, Send, ShieldCheck, Tags, Ticket, UserCog, UserSearch, Wallet } from 'lucide-react'
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
// The Loy probe stays with its feature (ticket 234): `features/loy/member` is its
// only consumer today — the leaf below and that screen's own guard — which is the
// `uaAdminApi` / `sessionMonitorApi` shape, not the two-feature one that pushed
// the OMS and Nphies probes into `@/core/`. `layout` may import a feature.
import { canOpenLoyMember, LOY_ACCESS_KEY, loyAccessApi } from '@/features/loy/member/api'
// The Collections probe moved to `@/core/` at ticket 268, for the OMS/Nphies reason
// rather than the Loy one: `features/collection/settlement` is now a SECOND consumer
// beside `features/collection/inquiry`, and a feature may not import another
// feature's api. Only the shared half moved — each screen's own predicate still
// travels with the screen, which is why the imports below come from three places
// and should stay that way.
import { COLLECTION_ACCESS_KEY, collectionAccessApi } from '@/core/collection/api'
import {
  canOpenAcrs,
  canOpenAssignment,
  canOpenAttempts,
  canOpenCollections,
  canOpenDeposits,
} from '@/features/collection/inquiry/api'
import { canOpenSettlement } from '@/features/collection/settlement/api'
// The Retail Invoice probe stays with its feature for the Loy/Collections reason
// (ticket 263): `features/reports/retail-invoice` is its only consumer — the leaf
// below and that screen's own gate. `layout` may import a feature.
import { canOpenRetailInvoice, RETAIL_INVOICE_ACCESS_KEY, retailInvoiceApi } from '@/features/reports/retail-invoice/api'
import type { CollectionAccessResult } from '@/core/models/collection'

// Data-driven menu: adding a module = appending here, no layout code changes.
// labelKey is an i18n key (zero-literal rule).
export interface ShellMenuItem {
  labelKey: string
  icon?: LucideIcon
  routerLink?: string
  /** Keeps the leaf highlighted + group expanded while a drill-down under this prefix is open. */
  activePrefix?: string
  /**
   * Match the path EXACTLY — no prefix match (ticket 284, spec 282 D2).
   *
   * 🚩 Only a leaf whose path is a **prefix of its own siblings'** needs this, and
   * today that is exactly one: the settlement Overview at `/collection/settlement`,
   * sitting above `/open`, `/ledger` and `/upload`. Without it that leaf claims all
   * four screens, so two leaves highlight at once — permanently, on three of the
   * four. `activePrefix` is the opposite request (claim MORE than my own path) and
   * the two are never both wanted; `exact` wins if someone sets both, and matches
   * this item's own `routerLink`.
   */
  exact?: boolean
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

/**
 * The Collections area's leaves share ONE probe on ONE key (244 §10, and a fifth
 * grant on it since ticket 268): the menu needs every boolean at once, and a probe
 * each would be a round trip each to draw one group. Spelling the key and the call
 * once here rather than five times removes four chances to typo the very constant
 * `@/core/collection/api` exports to stop the nav and a screen splitting the cache
 * entry.
 *
 * Each leaf still passes its OWN predicate, so a session granted only Deposits
 * gets a RAGGED group — one item, rather than three that would bounce it.
 *
 * 🚩 FAILS CLOSED — see `features/collection/inquiry/api`. A pending, errored or
 * malformed probe hides the leaf; the `Bby/Access` unknown ⇒ shown precedent
 * does not transfer to the chain's cash. 🚩 And it only HIDES: the endpoint's
 * grant filter is the real boundary, which is why each Page carries its own
 * in-page backstop too.
 */
const collectionProbe = (visible: (r: CollectionAccessResult) => boolean): AccessProbe =>
  accessProbe({ key: COLLECTION_ACCESS_KEY, run: () => collectionAccessApi.access(), visible })

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
    // Its own top-level group (spec 231 §1, ticket 234): `/loy/*` is a new URL
    // prefix and a new nav group, which is exactly the condition under which
    // feature-structure says a new area folder appears. Same shape as the
    // call-centre group above.
    labelKey: 'loy:menu.loyalty',
    icon: Gem,
    items: [
      {
        labelKey: 'loy:menu.members',
        icon: UserSearch,
        routerLink: '/loy/members',
        // The whole subtree: a resolved member lives at `/loy/members/:loyId`,
        // and the leaf stays lit while the agent stands on one.
        activePrefix: '/loy/members',
        // The SAME key + call + predicate as MemberLookupPage's own guard → one
        // network call, and a nav and a screen that can never disagree.
        // 🚩 FAILS CLOSED — see `features/loy/member/api`. What is behind this
        // leaf is a customer-PII lookup, so a pending, errored or malformed
        // probe hides it rather than revealing it (224: the bonus-buy
        // unknown ⇒ shown precedent explicitly does not transfer here).
        access: accessProbe({
          key: LOY_ACCESS_KEY,
          run: () => loyAccessApi.access(),
          visible: canOpenLoyMember,
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
        // The area's landing screen (ticket 212) — the list, first, because that
        // is what an agent opens on. It carries the area prefix so the detail
        // routes joining later (213, 216) keep it highlighted.
        labelKey: 'eligibility:menu.list',
        icon: ListChecks,
        routerLink: '/nphies/eligibility',
        // Its own subtree, NOT the whole area: the authorizations leaf (214) is a
        // sibling under `/nphies`, and an area-wide prefix here would leave the
        // eligibility leaf lit while an agent stands on the authorizations list.
        // The eligibility DETAIL routes (213, `/nphies/eligibility/:id`) are what
        // this prefix is for.
        activePrefix: '/nphies/eligibility',
        // Both leaves share the ONE probe on the ONE key — §1 gives the whole
        // area a single grant, so a gated area costs one network call.
        // FAILS CLOSED — see `@/core/nphies/api`. What is behind these leaves
        // talks to the national exchange, so a pending or errored probe hides
        // them rather than revealing them (ticket 211's Boundaries).
        access: accessProbe({
          key: NPHIES_ACCESS_KEY,
          run: () => nphiesAccessApi.access(),
          visible: (r) => r.canOpenNphies === true,
        }),
      },
      {
        labelKey: 'eligibility:menu.newCheck',
        icon: ClipboardCheck,
        routerLink: '/nphies/eligibility/new',
        // No `activePrefix`: its own exact route. The list leaf above owns the
        // eligibility subtree now that there is more than one screen under it.
        access: accessProbe({
          key: NPHIES_ACCESS_KEY,
          run: () => nphiesAccessApi.access(),
          visible: (r) => r.canOpenNphies === true,
        }),
      },
      {
        // The area's second feature (ticket 214) — the list an agent watches an
        // authorization on. Its own namespace, and the SAME one probe on the SAME
        // one key: §1 gives the whole area a single grant.
        labelKey: 'authorizations:menu.authorizations',
        icon: FileCheck2,
        routerLink: '/nphies/authorizations',
        // Its own subtree, so 216's detail keeps this leaf lit and not the
        // eligibility one.
        activePrefix: '/nphies/authorizations',
        access: accessProbe({
          key: NPHIES_ACCESS_KEY,
          run: () => nphiesAccessApi.access(),
          visible: (r) => r.canOpenNphies === true,
        }),
      },
    ],
  },
  {
    // Its own top-level group (spec 249, ticket 253): `/collection/*` is a new
    // URL prefix and a new nav group, which is exactly when a new area folder
    // appears. NOT under OMS — this is a finance surface (collection supervisor,
    // accountant), and four items would have made the OMS group five items of
    // two unrelated kinds. Same shape as the call-centre and Loyalty groups.
    labelKey: 'collection:menu.collections',
    icon: Wallet,
    items: [
      {
        labelKey: 'collection:menu.cashCollections',
        icon: Banknote,
        routerLink: '/collection/collections',
        activePrefix: '/collection/collections',
        access: collectionProbe(canOpenCollections),
      },
      {
        labelKey: 'collection:menu.acrs',
        icon: FileSpreadsheet,
        routerLink: '/collection/acrs',
        activePrefix: '/collection/acrs',
        access: collectionProbe(canOpenAcrs),
      },
      {
        labelKey: 'collection:menu.deposits',
        icon: Landmark,
        routerLink: '/collection/deposits',
        activePrefix: '/collection/deposits',
        access: collectionProbe(canOpenDeposits),
      },
      {
        labelKey: 'collection:menu.attempts',
        icon: History,
        routerLink: '/collection/attempts',
        activePrefix: '/collection/attempts',
        access: collectionProbe(canOpenAttempts),
      },
      {
        // The area's one WRITE screen (BackOffice 1169) — who serves each branch,
        // which is what the four grids above filter by.
        //
        // 🚩 Its probe reads `canOpenAssignment` and nothing else. The grant
        // behind it is genuinely new rather than a WPF ControllerID reused, and
        // it binds NOBODY on day one: the item stays hidden for everyone until an
        // administrator assigns COLLECTION_ASSIGNMENT in Authz Admin. A ragged
        // group is the honest answer, exactly as for the four reads.
        labelKey: 'collection:menu.assignment',
        icon: ClipboardCheck,
        routerLink: '/collection/assignment',
        activePrefix: '/collection/assignment',
        access: collectionProbe(canOpenAssignment),
      },
      {
        // The accountant's settlement account (spec 267 D1, ticket 268) — and since
        // ticket 284 a NODE with four children rather than a leaf.
        //
        // ⚠️ 268 ruled this "a further leaf in this group rather than a group of its
        // own, because neither a new nav group nor a new URL prefix appears." That
        // ruling is overturned here, and the rule behind it is not: ticket 283 gave
        // the screen's four views four PATHS under `/collection/settlement/*`, so a
        // URL prefix now DOES appear — and the same rule that made it a leaf makes
        // it a node. It is still not a nav GROUP of its own: the header above stays
        // `collection`'s, and this node sits inside it as the fifth item.
        //
        // 🚩 It shares the ONE key with the leaves above, so the settlement grant
        // costs no extra round trip — and it reads `canOpenSettlement`, the same
        // predicate all four screens' shared gate reads. The gate stays on the NODE
        // rather than being copied onto each child: one grant opens all four views,
        // and `filterMenu` already drops a node the session cannot open along with
        // everything under it.
        //
        // ⚠️ The server does not answer that flag yet (BackOffice spec 1173; ticket
        // 274 joins the waves), so this node is currently hidden for every session.
        // That is the fail-closed rule working, not a bug: a grant that does not
        // exist is a grant nobody holds.
        labelKey: 'settlement:menu.settlement',
        icon: Scale,
        // Both a label and a destination: clicking the node's own row goes to the
        // Overview, so a row that looks clickable is clickable.
        routerLink: '/collection/settlement',
        // 🚩 The whole subtree, so the Collections group above stays expanded on all
        // four screens. The node's own row is never drawn from `isActive` — it takes
        // its emphasis from having an active child, so the group says "you are
        // somewhere in here" rather than competing with the leaf that says where.
        activePrefix: '/collection/settlement',
        access: collectionProbe(canOpenSettlement),
        items: [
          {
            // 🚩 The ONE leaf that sets `exact`. Its path is a prefix of the three
            // below it, so without it the Overview reads as selected while the
            // accountant is standing on the ledger.
            labelKey: 'settlement:menu.overview',
            routerLink: '/collection/settlement',
            exact: true,
          },
          { labelKey: 'settlement:menu.open', routerLink: '/collection/settlement/open' },
          { labelKey: 'settlement:menu.ledger', routerLink: '/collection/settlement/ledger' },
          { labelKey: 'settlement:menu.upload', routerLink: '/collection/settlement/upload' },
        ],
      },
    ],
  },
  {
    // Its own top-level group (spec 261, ticket 263): `/reports/*` is a new URL
    // prefix and a new nav group, which is exactly when a new area folder appears
    // — and it is the worked example `feature-structure` itself gives. NOT under
    // `oms/` (an invoice receipt is a store/finance artefact, not a delivery
    // document) and not under `pricing/` (nothing here prices anything). Same
    // shape as the call-centre, Loyalty and Collections groups.
    labelKey: 'reports:menu.reports',
    icon: FileBarChart,
    items: [
      {
        labelKey: 'reports:menu.invoices',
        icon: Receipt,
        routerLink: '/reports/invoice',
        activePrefix: '/reports/invoice',
        // The SAME key + call + predicate as the screen's own gate → one network
        // call, and a nav and a screen that can never disagree.
        //
        // 🚩 FAILS CLOSED — see `features/reports/retail-invoice/api`. What is
        // behind this leaf reaches every retail transaction in the estate behind
        // ONE grant (988 D16), so a pending, errored or malformed probe hides it
        // rather than revealing it. The `Bby/Access` unknown ⇒ shown precedent
        // does not transfer: that door was unbuilt, this one is live.
        //
        // 🚩 And it only HIDES. `Search`/`Download` re-check the grant and refuse
        // with a bare 403 carrying no body — that filter is the boundary, which
        // is why the Page carries its own in-page backstop too.
        access: accessProbe({
          key: RETAIL_INVOICE_ACCESS_KEY,
          run: () => retailInvoiceApi.access(),
          visible: canOpenRetailInvoice,
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

/**
 * URL match: exact, or startsWith(prefix + '/'); query/hash already stripped by caller.
 *
 * 🚩 `exact` (ticket 284) turns the prefix half off, for a leaf whose path is a prefix
 * of its siblings'. It reads `routerLink` and ignores `activePrefix` — the two fields
 * are opposite requests (*claim more than my path* / *claim only my path*), so an item
 * carrying both gets the narrow answer rather than a prefix compared exactly, which
 * would highlight it on a path it does not link to.
 *
 * ⚠️ A trailing slash is stripped first. `/collection/settlement/` is the same screen
 * as `/collection/settlement` to the router and to `isOverviewPath`, and a nav that
 * highlighted nothing on an address the reader can type is a worse answer than the
 * one character it disagrees about.
 */
export function isActive(item: ShellMenuItem, pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (item.exact) return !!item.routerLink && path === item.routerLink
  const target = item.activePrefix ?? item.routerLink
  if (!target) return false
  return path === target || path.startsWith(target + '/')
}
