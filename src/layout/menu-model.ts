import type { LucideIcon } from 'lucide-react'
import { Activity, ArrowLeftRight, ArrowUpDown, Banknote, Box, Boxes, Calculator, ChartColumn, ClipboardCheck, CloudUpload, CreditCard, FileBarChart, FileCheck2, FilePen, FileSearch, FileSpreadsheet, FileText, Gem, UserCheck, MapPinned, PackageSearch, PackageX, Pill, Radar, ReceiptText, Repeat, Headset, HeartPulse, History, Hourglass, KeyRound, Landmark, LifeBuoy, ListChecks, Receipt, Scale, ScanBarcode, ScanSearch, Search, Send, ShieldCheck, Tags, Ticket, Unlock, UserCog, UserSearch, Wallet, Warehouse } from 'lucide-react'
import type { Permissions, ScreenKey } from '@/core/permissions'
// oms 914 (BackOffice spec 4002): every leaf reads the ONE permissions answer. Each predicate below is named beside its
// area (its feature's or core's `access`/`api` module) so the leaf and that screen's `ScreenGate` read the same one;
// a single-key leaf uses the `key:` shorthand instead. `layout` may import a feature.
import { canBroadcast } from '@/features/admin/broadcast/api'
import { canAdminCoupons, canSupportCoupons } from '@/features/pricing/coupons/api'
import { canOpenBbyMaintain } from '@/core/bonus-buy/access'
import {
  canOpenDeliveryStatistics,
  canOpenDocumentPayments,
  canOpenDocumentSourceUsers,
  canOpenDonorRequests,
  canOpenFailedTransfers,
  canOpenGeography,
  canOpenPickSupport,
} from '@/core/oms/access'
import { canOpenNphies } from '@/core/nphies/access'
import { canOpenDispatchScorecard } from '@/features/oms/dispatch-scorecard/access'
import { canOpenSerialRefusals } from '@/features/oms/serial-refusals/access'
import { canViewBupaOutcomes } from '@/features/oms/bupa-line-outcomes/access'
import { canOpenExpiredApprovalPicks } from '@/features/oms/expired-approval-picks/access'
import { canOpenHeldStockReport } from '@/features/stock/held-stock-report/access'
import { canOpenHoldDailyList } from '@/features/stock/hold-daily-list/access'
import { canOpenStoreStages } from '@/features/stock/store-stages/access'
import { canViewSourcingAdvisor } from '@/core/sourcing-advisor/access'
import { canOpenStockHealth } from '@/features/stock/stock-health/access'
import { canOpenStockConsole } from '@/features/stock/stock-console/access'
import { INSURANCE_RULES_MENU } from './menu-insurance-rules'
import { INSURANCE_MENU } from './menu-insurance'
import { RETURNS_MENU } from './menu-returns'
import { canAuthorRules, canReadAuthoring, canSupportRules, canSwitchEngine } from '@/core/rules/access'
import { canViewPrescriptionSessions } from '@/features/oms/prescription-sessions/access'
// Analytics (spec 766, ticket 767): declared in `./menu-analytics`, where 770–780 add their leaves.
import { ANALYTICS_MENU } from './menu-analytics'
import { canOpenLoyMember } from '@/features/loy/member/api'
import { canViewLoyGroups } from '@/core/loy-groups/api'
import {
  canOpenAcrs,
  canOpenAssignment,
  canOpenAttempts,
  canOpenCollections,
  canOpenDeposits,
  canOpenReady,
} from '@/features/collection/inquiry/api'
import { canOpenSettlement } from '@/features/collection/settlement/api'
import { canOpenRetailInvoice } from '@/features/reports/retail-invoice/api'
import { canOpenIDocInspector } from '@/features/reports/idoc-inspector/api'
import { canOpenSapExport } from '@/features/reports/sap-export-console/access'
import { canOpenDispatchBoard } from '@/core/dispatch/access'
import { canViewServingLists } from '@/core/serving-list/access'
import { canOpenCentralInvoice } from '@/core/central-invoice/api'
import { canCheckGs1, canCheckStock, canSearchMaterials } from '@/core/materials/access'
import { STOCK_CHECK_PATH } from '@/core/materials/stock-cap'
import { canOpenSyncConsole } from '@/features/admin/sync-console/api'
import { canOpenDataSync } from '@/features/admin/data-sync/api'
import { canViewDocTypeConfig } from '@/features/admin/doc-type-config/api'
import { canCurateCopilot } from '@/features/copilot/access'
import { canViewReleaseQueue } from '@/features/admin/release-queue/api'
import { canManageCatalog, canManageStores, canManageTerms, canViewOrders } from '@/core/deliverect/access'
import {
  canManageCatalog as canManageHsCatalog,
  canManageStores as canManageHsStores,
  canViewOrders as canViewHsOrders,
  canManagePromotions as canManageHsPromotions,
} from '@/core/hungerstation/access'
import { canViewHybrisStock } from '@/core/hybris-stock/access'
import { Ban, CalendarX, ClipboardX, FileDiff, Gauge, Layers, ListTree, PackageMinus, Route, ShieldAlert, Trophy, Waypoints } from 'lucide-react'
import { UsersRound } from 'lucide-react'
import { ScrollText } from 'lucide-react'
import { Undo2 } from 'lucide-react'
import { FileCog } from 'lucide-react'
import { Workflow } from 'lucide-react'
import { Radio } from 'lucide-react'
import { DatabaseZap } from 'lucide-react'
import { CloudDownload } from 'lucide-react'
import { BadgePercent, Bike, BookCheck, FlaskConical, Handshake, ListOrdered, Megaphone, ShoppingBag, Store, Truck } from 'lucide-react'
import { CalendarClock, Smartphone } from 'lucide-react'
import { canViewMiniPos } from '@/core/mini-pos/access'
import { FileDown } from 'lucide-react'
import { MY_EXPORTS_OFFER } from '@/core/inquiry-export/api'
import { canOpenMiniPosScorecard } from '@/features/mini-pos/scorecard/access'

// Data-driven menu: adding a module = appending here, no layout code changes.
// labelKey is an i18n key (zero-literal rule).
export interface ShellMenuItem {
  labelKey: string
  icon?: LucideIcon
  routerLink?: string
  /**
   * Keeps the leaf highlighted + group expanded while a drill-down under this prefix is open.
   *
   * A LIST when one leaf owns several sibling subtrees (ticket 332): Deliveries owns
   * `/oms/deliveries`, `/oms/document` and `/oms/delivery`, and a bare `/oms` would also
   * claim the central-invoice screen beside it — two lit leaves on one page.
   */
  activePrefix?: string | readonly string[]
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
   * Optional permission-aware show/hide gate (issue 429; one answer since oms 914, BackOffice spec 4002).
   * ABSENT (and no `key`) = always visible; nearly every leaf is gated, and a new ungated one needs a reason.
   * Present = the shell hides this item until the ONE permissions answer (`@/core/permissions`) is in and this
   * predicate says yes; pending or failed hides it (fail-closed, no flash-then-hide). Show/hide only — the server
   * grant stays authoritative, and the screen's own `ScreenGate` reads the SAME predicate.
   */
  requires?: (p: Permissions) => boolean
  /** The shorthand for a leaf behind exactly one key: `key: 'X:03'` ≡ `requires: (p) => p.has('X:03')`. */
  key?: ScreenKey
  /**
   * NOT a permission: a leaf whose page is offered only while a door answers (886: "My schedules" hides while the
   * personal-schedules switch is off). Asked once per page life, and only after the leaf's own grant says yes, so a
   * reader without the grant never fires it. Absent = offered; pending or failed = hidden.
   */
  offered?: MenuOffer
}

/** A data door the shell asks, after the grant, whether a leaf's page is offered at all (see `offered`). */
export interface MenuOffer {
  queryKey: readonly unknown[]
  queryFn: () => Promise<boolean>
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
        // The list and the document it drills into (two routes) — not the whole `/oms`
        // prefix, which would co-highlight the central-invoice leaf below.
        activePrefix: ['/oms/deliveries', '/oms/document', '/oms/delivery'],
        // Same predicate as BOTH OMS page guards (ticket 125).
        // Gated on the LIST grant: the leaf opens the list, and a session that holds
        // the detail grant but not the list one has no business in the nav here.
        // It FAILS CLOSED — see `@/core/oms/access`.
        key: 'DocumentList:03',
      },
      {
        // Bupa line outcomes (oms 899, BackOffice spec 3888) — beside Delivery documents, as the brief places it.
        // Its own grant, `BupaLineOutcomes:03`, read off the one permissions answer; the leaf and the page's gate
        // share the one predicate. 🚩 FAILS CLOSED.
        labelKey: 'bupa-line-outcomes:menu.bupaLineOutcomes',
        icon: FileDiff,
        routerLink: '/oms/bupa-line-outcomes',
        activePrefix: '/oms/bupa-line-outcomes',
        requires: canViewBupaOutcomes,
      },
      {
        // The Order / ERX list (ticket 786, BackOffice 3391): behind the same OMS LIST grant as the
        // delivery list, on the same key. A row opens Document details, which
        // lights the Deliveries leaf (its `activePrefix` owns `/oms/document`).
        labelKey: 'orders:menu.orders',
        icon: ListChecks,
        routerLink: '/oms/orders',
        activePrefix: ['/oms/orders'],
        key: 'DocumentList:03',
      },
      {
        // Central invoicing's bulk screen (ticket 332, BackOffice spec 2094). Its OWN grant
        // (`BackOfficeScreen[CentralInvoice,03]`), not the OMS one: opening deliveries is no
        // claim on bypassing the pick gate, so an OMS user without it sees a one-leaf group.
        //
        // 🚩 FAILS CLOSED — see `@/core/central-invoice/api`. The same key the delivery page's
        // action and the screen's gate read, so a 403 from the POST (which overwrites that
        // entry) drops this leaf too.
        labelKey: 'central-invoice:menu.raise',
        icon: ReceiptText,
        routerLink: '/oms/central-invoice',
        activePrefix: '/oms/central-invoice',
        requires: canOpenCentralInvoice,
      },
      {
        // The raised central invoices (ticket 333) — the same grant and the SAME key
        // as the raise leaf above, so one 403 drops both.
        labelKey: 'central-invoice:menu.list',
        icon: ListChecks,
        routerLink: '/oms/central-invoices',
        activePrefix: '/oms/central-invoices',
        requires: canOpenCentralInvoice,
      },
      // ── Spec 430's five OMS screens, in its D18 order: Donor requests, Failed donor
      // transfers, Document payments, Cities & districts, Document source users. Each reads
      // ITS OWN key off the one permissions answer; an absent key hides the leaf. 🚩 FAILS CLOSED.
      {
        // Donor requests (ticket 431) — `DonorRequestInquiry,03`.
        labelKey: 'donor-requests:menu.donorRequests',
        icon: ArrowLeftRight,
        routerLink: '/oms/donor-requests',
        activePrefix: '/oms/donor-requests',
        requires: canOpenDonorRequests,
      },
      {
        // Failed donor transfers (ticket 434) — `FailedDonorTransfers,03`, second in D18's order.
        // The re-run's own flag (06) is the screen's to read, not the leaf's.
        labelKey: 'failed-donor-transfers:menu.failedDonorTransfers',
        icon: PackageX,
        routerLink: '/oms/failed-donor-transfers',
        activePrefix: '/oms/failed-donor-transfers',
        requires: canOpenFailedTransfers,
      },
      {
        // Document payments (ticket 433) — `DocumentPaymentInquiry,03`. 🚩 Its rows carry customer
        // phones and names, so an absent flag hides it like any other.
        labelKey: 'document-payments:menu.documentPayments',
        icon: CreditCard,
        routerLink: '/oms/document-payments',
        activePrefix: '/oms/document-payments',
        requires: canOpenDocumentPayments,
      },
      {
        // Cities & districts (ticket 436) — `SdCityInquiry,03` OR `SdDistrictInquiry,03`, fourth in
        // D18's order. The import flags (437) are the screen's to read, not the leaf's.
        labelKey: 'geography:menu.geography',
        icon: MapPinned,
        routerLink: '/oms/geography',
        activePrefix: '/oms/geography',
        requires: canOpenGeography,
      },
      {
        // My exports (BackOffice spec 4314, ticket 4318): the caller's export jobs, the same page as the Collections
        // group's leaf, under `/oms/` so this group stays lit. After Cities & districts (D18's
        // inquiry run stays whole; Delivery statistics stays last). For a reader of the two OMS screens that export a
        // month (Delivery list, Document payments — 4324/4325), and only while the feature is on and the session
        // may export something (`offered`).
        labelKey: 'inquiry-export:menu.myExports',
        icon: FileDown,
        routerLink: '/oms/exports',
        activePrefix: '/oms/exports',
        requires: (p) => p.has('DocumentList:03') || canOpenDocumentPayments(p),
        offered: MY_EXPORTS_OFFER,
      },
      {
        // Document source users (ticket 438) — `DocumentSourceUsersInquiry,03`, last in D18's order.
        // The import flag is the screen's to read, not the leaf's.
        labelKey: 'document-source-users:menu.documentSourceUsers',
        icon: UserCheck,
        routerLink: '/oms/document-source-users',
        activePrefix: '/oms/document-source-users',
        requires: canOpenDocumentSourceUsers,
      },
      {
        // HQ prescription sessions (tickets 545-548, BackOffice spec 2994) — `BackOfficeScreen[PrescriptionSessionHq]`
        // (`PrescriptionSessionHq:03`, oms 852, BackOffice 3459). 🚩 FAILS CLOSED. The page
        // still names its doors' bare 403 itself for a deep link.
        labelKey: 'prescription-sessions:menu.prescriptionSessions',
        icon: Pill,
        routerLink: '/oms/prescription-sessions',
        activePrefix: '/oms/prescription-sessions',
        requires: canViewPrescriptionSessions,
      },
      {
        // The Dispatch board (ticket 541, BackOffice spec 2952) — `BackOfficeScreen[DispatchBoard, Display]`
        // (`DispatchBoard:03`). The SAME predicate as the board's own `ScreenGate`, so the two never disagree.
        // 🚩 FAILS CLOSED: a pending, errored or malformed permissions answer hides the leaf. Before Pick support, which 496 keeps just before Delivery statistics.
        labelKey: 'dispatch-board:menu.dispatchBoard',
        icon: Radar,
        routerLink: '/oms/dispatch-board',
        activePrefix: '/oms/dispatch-board',
        requires: canOpenDispatchBoard,
      },
      {
        // Serving lists (ticket 567, BackOffice spec 3042) — `ServingList:03`. The SAME predicate as the screen's
        // own `ScreenGate`. 🚩 FAILS CLOSED: a pending, errored or malformed permissions answer hides the leaf.
        // Beside the Dispatch board.
        labelKey: 'serving-lists:menu.servingLists',
        icon: ListTree,
        routerLink: '/oms/serving-lists',
        activePrefix: '/oms/serving-lists',
        requires: canViewServingLists,
      },
      {
        // Road distance (Shadow) (ticket 859, BackOffice spec 3460 / door 3470): the board's Shadow report, on the
        // board's OWN key, call and predicate (no new grant), failing closed. Its longer prefix wins the rail on its
        // own page (`markedLeaf`). After Serving lists, so Serving lists keeps its place beside the board.
        labelKey: 'dispatch-board:menu.roadShadow',
        icon: Waypoints,
        routerLink: '/oms/dispatch-board/road-shadow',
        activePrefix: '/oms/dispatch-board/road-shadow',
        requires: canOpenDispatchBoard,
      },
      {
        // Dispatch scorecard (ticket 543, BackOffice spec 2952) — its own grant,
        // `BackOfficeScreen[DispatchScorecard, 03]`, on its own key; the leaf and the page's gate
        // share the one predicate and fail closed (ruling 2950 point 5). After the board and before
        // Pick support, so Pick support and Delivery statistics keep the last two places their tests pin.
        labelKey: 'dispatch-scorecard:menu.dispatchScorecard',
        icon: Trophy,
        routerLink: '/oms/dispatch-scorecard',
        activePrefix: '/oms/dispatch-scorecard',
        requires: canOpenDispatchScorecard,
      },
      {
        // Closes after a take (ticket 758, spec 3326): the scorecard's report of every close after a take, on
        // the SAME predicate (no new grant). Its longer prefix wins the rail on its own page
        // (`markedLeaf`). Right after the scorecard; Serial refusals follows it.
        labelKey: 'dispatch-scorecard:menu.closesAfterTake',
        icon: ClipboardX,
        routerLink: '/oms/dispatch-scorecard/closes',
        activePrefix: '/oms/dispatch-scorecard/closes',
        requires: canOpenDispatchScorecard,
      },
      {
        // Serial refusals (ticket 573, BackOffice 3065) — its own grant, `BackOfficeScreen[SerialRefusal, 03]`, on its own
        // key; the leaf and the page's gate share the one predicate and fail closed. After the scorecard and before
        // Pick support, so Pick support and Delivery statistics keep the last two places their tests pin.
        labelKey: 'serial-refusals:menu.serialRefusals',
        icon: ShieldAlert,
        routerLink: '/oms/serial-refusals',
        activePrefix: '/oms/serial-refusals',
        requires: canOpenSerialRefusals,
      },
      {
        // Expired approval picks (BackOffice ticket 3874, spec 3849) — the insurance team's weekly report of approval picks
        // that expired with no sale, per store and pharmacist. Its own grant, `BackOfficeScreen[ExpiredApprovalPick, 03]`
        // (role INSURANCE_EXPIRED_PICK_VIEWER), on its own key; the leaf and the page's gate share the one predicate and
        // fail closed. Right after Serial refusals, before Pick support.
        labelKey: 'expired-approval-picks:menu.expiredApprovalPicks',
        icon: CalendarX,
        routerLink: '/oms/expired-approval-picks',
        activePrefix: '/oms/expired-approval-picks',
        requires: canOpenExpiredApprovalPicks,
      },
      {
        // Sourcing advisor (ticket 738, spec 734 D21) — its own grant, `BackOfficeScreen[SourcingAdvisor, 01]`,
        // on its own predicate in `@/core/` (Delivery details' "Why this store?" link reads it too); fails closed.
        // Before Pick support, so Pick support and Delivery statistics keep the last two places their tests pin.
        labelKey: 'sourcing-advisor:menu.sourcingAdvisor',
        icon: Route,
        routerLink: '/oms/sourcing-advisor',
        activePrefix: '/oms/sourcing-advisor',
        requires: canViewSourcingAdvisor,
      },
      {
        // Pick support (ticket 496, BackOffice brief 2691) — `PickSupport:03`, placed before Delivery statistics
        // (which 484 keeps last). The fix's own key (`PickSupport:06`) is the screen's to read, not the leaf's.
        labelKey: 'pick-support:menu.pickSupport',
        icon: ScanSearch,
        routerLink: '/oms/pick-support',
        activePrefix: '/oms/pick-support',
        requires: canOpenPickSupport,
      },
      {
        // Delivery statistics (ticket 484, BackOffice brief 2641) — the door checks the OMS LIST
        // grant, so the leaf reads `DocumentList:03`. Last, after D18's five.
        labelKey: 'delivery-statistics:menu.deliveryStatistics',
        icon: ChartColumn,
        routerLink: '/oms/delivery-statistics',
        activePrefix: '/oms/delivery-statistics',
        requires: canOpenDeliveryStatistics,
      },
    ],
  },
  {
    // Stock (owner, 2026-11-20): its own top-level group right after OMS, because stock is a subject of its own (batch
    // stock, held stock, ATP, accuracy), not a part of orders. `/stock/*` is the area's URL prefix and `features/stock/`
    // its folder; the old `/oms/...`, `/materials/stock` and `/hybris-stock/...` addresses redirect (router STOCK_MOVES).
    // Every leaf keeps its own grant and its own namespace; only the group label and the Hybris leaf labels are new.
    labelKey: 'stock-health:menu.stock',
    icon: Warehouse,
    items: [
      {
        // Stock health (oms 912, BackOffice specs 4011/4013): whether batch stock is in good shape, one tile per signal.
        // `BackOfficeScreen[StockHealth, 03]` (role STOCK_HEALTH_VIEWER). First, as the page a reader opens first.
        labelKey: 'stock-health:menu.stockHealth',
        icon: HeartPulse,
        routerLink: '/stock/health',
        activePrefix: '/stock/health',
        requires: canOpenStockHealth,
      },
      {
        // Stock console (oms 940, BackOffice spec 4157): every store's stock, held and reserved, searched down to the batch.
        // `BackOfficeScreen[StockConsole, 03]` (role STOCK_CONSOLE_VIEWER). Read-only; one leaf for the whole console.
        labelKey: 'stock-console:menu.stockConsole',
        icon: Boxes,
        routerLink: '/stock/console',
        activePrefix: '/stock/console',
        requires: canOpenStockConsole,
      },
      {
        // Store stages (BackOffice ticket 3899, spec 3849 phase 2): each store's stage at Stock Visibility; a named
        // permission moves it. `BackOfficeScreen[StoreStage, 03]` to see, `02` to move.
        labelKey: 'store-stages:menu.storeStages',
        icon: Layers,
        routerLink: '/stock/store-stages',
        activePrefix: '/stock/store-stages',
        requires: canOpenStoreStages,
      },
      {
        // Stock check (BackOffice spec 2544, ticket 453): ATP per material across stores. The same constant that
        // "check stock for selected" on Materials search links to.
        labelKey: 'materials-search:menu.stockCheck',
        icon: PackageSearch,
        routerLink: STOCK_CHECK_PATH,
        activePrefix: STOCK_CHECK_PATH,
        requires: canCheckStock,
      },
      {
        // Take refusals (BackOffice ticket 3873, spec 3849), read before a store's stage is moved. The three held-stock
        // reports share `BackOfficeScreen[HeldStockReport, 03]` (role HELD_STOCK_REPORT_VIEWER).
        labelKey: 'held-stock-report:menu.refusals',
        icon: Ban,
        routerLink: '/stock/refusals',
        activePrefix: '/stock/refusals',
        requires: canOpenHeldStockReport,
      },
      {
        // Held stock impact (BackOffice ticket 3873): what held would take off the channels' figure. Same grant.
        labelKey: 'held-stock-report:menu.held',
        icon: PackageMinus,
        routerLink: '/stock/held',
        activePrefix: '/stock/held',
        requires: canOpenHeldStockReport,
      },
      {
        // Till-side gate figures (BackOffice ticket 3900, spec 3849 A): per store over 14 days. Same grant.
        labelKey: 'held-stock-report:menu.gates',
        icon: Gauge,
        routerLink: '/stock/gates',
        activePrefix: '/stock/gates',
        requires: canOpenHeldStockReport,
      },
      {
        // Holds that should have ended (BackOffice ticket 3872, spec 3849): HQ's daily list.
        // `BackOfficeScreen[HoldDailyList, 03]` (role HOLD_DAILY_LIST_VIEWER).
        labelKey: 'hold-daily-list:menu.holdDailyList',
        icon: Hourglass,
        routerLink: '/stock/stale-holds',
        activePrefix: '/stock/stale-holds',
        requires: canOpenHoldDailyList,
      },
      {
        // Hybris stock (BackOffice spec 3447, tickets 847-849): OMS sending ATP to the website's hot folder, last in the
        // group. Its three leaves name Hybris themselves, since the group label no longer does.
        labelKey: 'hybris-stock-stores:menu.hybrisStores',
        icon: Store,
        routerLink: '/stock/hybris/stores',
        activePrefix: '/stock/hybris/stores',
        requires: canViewHybrisStock,
      },
      {
        labelKey: 'hybris-stock-stores:menu.hybrisMaterials',
        icon: PackageSearch,
        routerLink: '/stock/hybris/materials',
        activePrefix: '/stock/hybris/materials',
        requires: canViewHybrisStock,
      },
      {
        labelKey: 'hybris-stock-stores:menu.hybrisPushes',
        icon: ScrollText,
        routerLink: '/stock/hybris/pushes',
        activePrefix: '/stock/hybris/pushes',
        requires: canViewHybrisStock,
      },
    ],
  },
  {
    // Mini POS (oms 915, BackOffice spec 4032): `/mini-pos/*` is a new URL prefix and a new nav group, right after Stock
    // (the tail's order is pinned by the channel groups' tests) — the operations lead's assignments, pharmacies and item
    // lists. Leaf labels live in `mini-pos-assignments` (the area's first namespace). Every leaf on `MiniPosAdmin:03`
    // (role OMS_MINIPOS_ADMIN); the changes inside on `MiniPosAdmin:06`.
    labelKey: 'mini-pos-assignments:menu.group',
    icon: Smartphone,
    items: [
      {
        labelKey: 'mini-pos-assignments:menu.assignments',
        icon: CalendarClock,
        routerLink: '/mini-pos/assignments',
        activePrefix: '/mini-pos/assignments',
        requires: canViewMiniPos,
      },
      {
        labelKey: 'mini-pos-assignments:menu.stores',
        icon: Store,
        routerLink: '/mini-pos/stores',
        activePrefix: '/mini-pos/stores',
        requires: canViewMiniPos,
      },
      {
        labelKey: 'mini-pos-assignments:menu.items',
        icon: ListChecks,
        routerLink: '/mini-pos/items',
        activePrefix: '/mini-pos/items',
        requires: canViewMiniPos,
      },
      {
        // The scorecard (oms 918, BackOffice 4075): its own report grant, `MiniPosScorecard:03` - the panel's role and the
        // lead's both carry it; `MiniPosAdmin:03` alone does not.
        labelKey: 'mini-pos-assignments:menu.scorecard',
        icon: Gauge,
        routerLink: '/mini-pos/scorecard',
        activePrefix: '/mini-pos/scorecard',
        requires: canOpenMiniPosScorecard,
      },
    ],
  },
  // Returns (BackOffice spec 4212, ticket 4224): `/returns/*`, after Mini POS and before Administration — not last, where
  // the channel and insurance groups' tests pin the tail by position. Declared in `./menu-returns`, where the parked rule
  // returns page adds its leaf without touching this file.
  RETURNS_MENU,
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
        // Same key as UaAdminUsersPage's own guard.
        key: 'UaUsers:03',
      },
      {
        labelKey: 'authz-admin:menu.authz',
        icon: KeyRound,
        routerLink: '/admin/authz',
        activePrefix: '/admin/authz',
        // Same key as AuthzAdminPage's own guard.
        key: 'AuthzAdmin:03',
      },
      {
        labelKey: 'active-sessions:menu.sessions',
        icon: Activity,
        routerLink: '/admin/sessions',
        activePrefix: '/admin/sessions',
        // Same key as ActiveSessionsPage's own guard.
        // Gated by its OWN grant, separate from Ua Users (spec 006).
        key: 'UaSessions:03',
      },
      {
        // Send Broadcast (spec 031). Gated on the NotificationBroadcast grant (038) via the SAME
        // `canBroadcast` the page's own guard uses: `NotificationBroadcast:01` AND
        // `extras.notificationCenterOn`, so the leaf hides where the notification center is off. 🚩 FAILS CLOSED.
        labelKey: 'broadcast:menu.sendBroadcast',
        icon: Send,
        routerLink: '/admin/broadcast',
        activePrefix: '/admin/broadcast',
        requires: canBroadcast,
      },
      {
        // The store sync console (spec 444, ticket 445) — LAST in the Admin group, on its own
        // grant (`ActionSyncConsole:03`). The SAME predicate as the console's own gate, so the two
        // can never disagree.
        //
        // 🚩 FAILS CLOSED — see `features/admin/sync-console/access`. The screen controls the
        // whole fleet's sync, so a pending, errored or malformed permissions answer hides the leaf.
        labelKey: 'sync-console:menu.syncConsole',
        icon: ArrowUpDown,
        routerLink: '/admin/sync',
        activePrefix: '/admin/sync',
        requires: canOpenSyncConsole,
      },
      {
        // Release download queue (ticket 791, BackOffice spec 3396) — `PosReleaseQueue:03`, the SAME predicate as
        // the page's gate. 🚩 Fails closed: a pending, errored or malformed permissions answer hides the leaf.
        labelKey: 'release-queue:menu.releaseQueue',
        icon: CloudDownload,
        routerLink: '/admin/release-queue',
        activePrefix: '/admin/release-queue',
        requires: canViewReleaseQueue,
      },
      {
        // Copilot rules (ticket 790, BackOffice 3395) — the copilot's house rules, for curators: `canCurateCopilot`
        // (`Copilot:01` and `Copilot:06`), the SAME predicate as the page's gate. 🚩 Fails closed: an absent key or
        // a failed answer hides the leaf.
        labelKey: 'copilot:menu.rules',
        icon: ScrollText,
        routerLink: '/copilot/rules',
        activePrefix: '/copilot/rules',
        requires: canCurateCopilot,
      },
      {
        // Data sync (spec 558, ticket 559) — DataSync's campaigns and profiles, on `DataSyncConsole:03`
        // (`DataSync.View`). The SAME predicate as the page's own gate. 🚩 FAILS CLOSED: a pending, errored or
        // malformed permissions answer hides the leaf. A granted user sees it even where the DataSync service is
        // not deployed; the page's own health banner says so (BackOffice brief 3995, "The Data sync exception").
        labelKey: 'data-sync:menu.dataSync',
        icon: DatabaseZap,
        routerLink: '/admin/data-sync',
        activePrefix: '/admin/data-sync',
        requires: canOpenDataSync,
      },
      {
        // Delivery types (BackOffice spec 3148, ticket 3154) — delivery document types, read on the existing OMS access:
        // the SAME View predicate as Document types. Placed BEFORE Document sources (which 3156 pins
        // just before Action types) so 3155's, 3152's and 3149's pinned order holds. 🚩 Fails closed.
        labelKey: 'doc-type-config:menu.deliveryTypes',
        icon: Truck,
        routerLink: '/admin/delivery-types',
        activePrefix: '/admin/delivery-types',
        requires: canViewDocTypeConfig,
      },
      {
        // Document sources (BackOffice spec 3148, ticket 3156) — read on the existing OMS access: the SAME View
        // predicate as Document types (editing and copying add `SdDocTypeConfig:06`). Placed BEFORE
        // Action types so 3155's, 3152's and 3149's pinned order holds. 🚩 Fails closed.
        labelKey: 'doc-type-config:menu.documentSources',
        icon: Radio,
        routerLink: '/admin/document-sources',
        activePrefix: '/admin/document-sources',
        requires: canViewDocTypeConfig,
      },
      {
        // Action types (BackOffice spec 3148, ticket 3155) — per document category, read on the existing OMS access:
        // the SAME View predicate as Document types (editing adds `SdDocTypeConfig:06`). Placed
        // BEFORE Config changes so 3152's and 3149's pinned order holds. 🚩 Fails closed.
        labelKey: 'doc-type-config:menu.actionTypes',
        icon: Workflow,
        routerLink: '/admin/action-types',
        activePrefix: '/admin/action-types',
        requires: canViewDocTypeConfig,
      },
      {
        // Config changes (BackOffice spec 3148, ticket 3152) — the document configuration's change log, read on the
        // existing OMS access: the SAME View predicate as Document types. Placed BEFORE that leaf
        // so 3149's pinned order (Document types, then the engine switch, last) holds. 🚩 Fails closed.
        labelKey: 'doc-type-config:menu.configChanges',
        icon: History,
        routerLink: '/admin/config-changes',
        activePrefix: '/admin/config-changes',
        requires: canViewDocTypeConfig,
      },
      {
        // Document types (BackOffice spec 3148, ticket 3149) — the OMS document configuration, read on the existing
        // OMS access (`canViewDocTypeConfig` = `DocumentList:03`), the SAME predicate as the pages' own gate.
        // Editing adds `SdDocTypeConfig:06` (`canEditDocTypeConfig`). 🚩 Fails closed.
        labelKey: 'doc-type-config:menu.documentTypes',
        icon: FileCog,
        routerLink: '/admin/doc-types',
        activePrefix: '/admin/doc-types',
        requires: canViewDocTypeConfig,
      },
      {
        // The store engine switch (BackOffice spec 2737, ticket 517) — at the END of the Admin group, on
        // `RuleEngineSwitch:02` (oms 852). 🚩 FAILS CLOSED.
        labelKey: 'engine-switch:menu.engineSwitch',
        icon: Repeat,
        routerLink: '/admin/engine-switch',
        activePrefix: '/admin/engine-switch',
        requires: canSwitchEngine,
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
        // this leaf mints real OMS orders, so a pending or errored permissions
        // answer hides it rather than revealing it.
        key: 'CallCenter:03',
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
        // permissions answer hides it rather than revealing it.
        requires: canOpenLoyMember,
      },
      {
        // Loyalty groups (BackOffice spec 3173, oms ticket 629). HQ-only. Its own key — `LoyaltyGroup:03` — read
        // by the page's gate too. 🚩 FAILS CLOSED: a pending, errored or malformed permissions answer hides the leaf.
        labelKey: 'loy-groups:menu.groups',
        icon: UsersRound,
        routerLink: '/loy/groups',
        activePrefix: '/loy/groups',
        requires: canViewLoyGroups,
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
        // Both leaves read the ONE key — §1 gives the whole area a single grant.
        // FAILS CLOSED — see `@/core/nphies/api`. What is behind these leaves
        // talks to the national exchange, so a pending or errored answer hides
        // them rather than revealing them (ticket 211's Boundaries).
        requires: canOpenNphies,
      },
      {
        labelKey: 'eligibility:menu.newCheck',
        icon: ClipboardCheck,
        routerLink: '/nphies/eligibility/new',
        // No `activePrefix`: its own exact route. The list leaf above owns the
        // eligibility subtree now that there is more than one screen under it.
        requires: canOpenNphies,
      },
      {
        // The area's second feature (ticket 214) — the list an agent watches an
        // authorization on. Its own namespace, and the SAME
        // one key: §1 gives the whole area a single grant.
        labelKey: 'authorizations:menu.authorizations',
        icon: FileCheck2,
        routerLink: '/nphies/authorizations',
        // Its own subtree, so 216's detail keeps this leaf lit and not the
        // eligibility one.
        activePrefix: '/nphies/authorizations',
        requires: canOpenNphies,
      },
      {
        // Release approval number (ticket 751, BackOffice spec 3342). Shown on the
        // Nphies grant alone, deliberately: an agent without the release grant can
        // still look an authorization up and read its release history (story 12).
        // The release grant only shows the button inside the page.
        labelKey: 'approval-release:menu.release',
        icon: Unlock,
        routerLink: '/nphies/approval-release',
        requires: canOpenNphies,
      },
      {
        // Undispense (ticket 898, BackOffice spec 3208 Q7). The list reads under the Nphies grant,
        // so the leaf shows on it alone; `canUndispense` only shows Retry and the manual act.
        labelKey: 'undispense:menu.undispense',
        icon: Undo2,
        routerLink: '/nphies/undispense',
        requires: canOpenNphies,
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
        requires: canOpenCollections,
      },
      {
        labelKey: 'collection:menu.acrs',
        icon: FileSpreadsheet,
        routerLink: '/collection/acrs',
        activePrefix: '/collection/acrs',
        requires: canOpenAcrs,
      },
      {
        labelKey: 'collection:menu.deposits',
        icon: Landmark,
        routerLink: '/collection/deposits',
        activePrefix: '/collection/deposits',
        requires: canOpenDeposits,
      },
      {
        labelKey: 'collection:menu.attempts',
        icon: History,
        routerLink: '/collection/attempts',
        activePrefix: '/collection/attempts',
        requires: canOpenAttempts,
      },
      {
        // Ready for collection (ticket 317, BackOffice 1994) — what still waits for a
        // collector. A read, so it sits with the four reads above; its key is
        // `CollectionReady:03` and nothing else — its own grant, bundled into the
        // accountant roles and the collector supervisor's (1995) on its own.
        labelKey: 'collection:menu.ready',
        icon: Hourglass,
        routerLink: '/collection/ready',
        activePrefix: '/collection/ready',
        requires: canOpenReady,
      },
      {
        // The area's one WRITE screen (BackOffice 1169) — who serves each branch,
        // which is what the four grids above filter by.
        //
        // 🚩 Its key is `CollectionAssignment:03` and nothing else. The grant
        // behind it is genuinely new rather than a WPF ControllerID reused, and
        // it binds NOBODY on day one: the item stays hidden for everyone until an
        // administrator assigns COLLECTION_ASSIGNMENT in Authz Admin. A ragged
        // group is the honest answer, exactly as for the four reads.
        labelKey: 'collection:menu.assignment',
        icon: ClipboardCheck,
        routerLink: '/collection/assignment',
        activePrefix: '/collection/assignment',
        requires: canOpenAssignment,
      },
      {
        // My exports (BackOffice spec 4314, ticket 4318): the caller's export jobs — a month of an inquiry asked for
        // with Export month…. For a reader of the four eCollection inquiries, and only while the feature is on and
        // the session may export something (`offered`). The OMS group links the same page at `/oms/exports`.
        labelKey: 'inquiry-export:menu.myExports',
        icon: FileDown,
        routerLink: '/collection/exports',
        activePrefix: '/collection/exports',
        requires: (p) => canOpenCollections(p) || canOpenAcrs(p) || canOpenDeposits(p) || canOpenAttempts(p),
        offered: MY_EXPORTS_OFFER,
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
        requires: canOpenSettlement,
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
        // ONE grant (988 D16), so a pending, errored or malformed permissions
        // answer hides it rather than revealing it.
        //
        // 🚩 And it only HIDES. `Search`/`Download` re-check the grant and refuse
        // with a bare 403 carrying no body — that filter is the boundary, which
        // is why the Page carries its own in-page backstop too.
        requires: canOpenRetailInvoice,
      },
      {
        // The IDoc Inspector (spec 1386, ticket 296). Same group, same URL
        // prefix, and a SEPARATE grant — a consultant who can print a receipt
        // has no claim on every IDoc the SAP rail ever generated, so this leaf
        // gets its own key rather than riding the invoices one.
        //
        // 🚩 FAILS CLOSED: a pending, errored or malformed permissions answer
        // hides the leaf.
        labelKey: 'reports:menu.idocInspector',
        icon: FileSearch,
        routerLink: '/reports/idoc-inspector',
        activePrefix: '/reports/idoc-inspector',
        requires: canOpenIDocInspector,
      },
      {
        // The SAP export console (BackOffice spec 2579, ticket 461) — after the IDoc inspector,
        // whose transactions it links into, on its OWN grant (`SapExportConsole:03`).
        // The SAME predicate as the console's own gate, so the two can never disagree.
        //
        // 🚩 FAILS CLOSED — see `features/reports/sap-export-console/access`: a pending, errored or
        // malformed permissions answer hides the leaf.
        labelKey: 'sap-export-console:menu.sapExport',
        icon: CloudUpload,
        routerLink: '/reports/sap-export',
        activePrefix: '/reports/sap-export',
        requires: canOpenSapExport,
      },
    ],
  },
  // Analytics (spec 766, ticket 767): `/analytics/*` is a new URL prefix and nav group, beside Reports. Not appended
  // last: the Campaigns, Deliverect, HungerStation and Insurance rules tests pin the groups from Pricing on by position.
  ANALYTICS_MENU,
  {
    labelKey: 'simulation:menu.pricing',
    icon: Tags,
    items: [
      {
        labelKey: 'simulation:menu.simulation',
        icon: Calculator,
        routerLink: '/pricing/simulation',
        activePrefix: '/pricing/simulation',
        // Same key as SimulationPage's own guard.
        // Gated by its OWN grant (POS_SIMULATION_ADMIN), spec 503 / BackOffice 509.
        key: 'PosSimulation:03',
      },
      // Bonus Buy Download is hidden from the menu for now (owner, 2026-10-09): not being worked on.
      // The route and page stay; restore the entry (gated by BackOfficeScreen[BbyDownload,03]) to bring it back.
      {
        labelKey: 'bonus-buy-inquiry:menu.bbyInquiry',
        icon: Search,
        routerLink: '/pricing/bonus-buy-inquiry',
        activePrefix: '/pricing/bonus-buy-inquiry',
        // Gated by its OWN screen grant (`BbyInquiry:03`), the same key as BonusBuyInquiryPage's own
        // guard. The list endpoint's 403 ACCESS_DENIED stays the real boundary (spec 061 / contract 057 §4).
        key: 'BbyInquiry:03',
      },
      {
        labelKey: 'bonus-buy-maintenance:menu.bonusBuyMaintenance',
        icon: FilePen,
        routerLink: '/pricing/bonus-buy-maintenance',
        activePrefix: '/pricing/bonus-buy-maintenance',
        // The same predicate as the screen's own gate. Gated by its OWN grant, `BbyMaintain:03`
        // (spec 2374), and it FAILS CLOSED: this screen writes every till's offers.
        requires: canOpenBbyMaintain,
      },
      {
        labelKey: 'bonus-buy-bulk-change:menu.bonusBuyBulkChange',
        icon: ListChecks,
        routerLink: '/pricing/bonus-buy-bulk-change',
        activePrefix: '/pricing/bonus-buy-bulk-change',
        // Beside Bonus Buy Maintenance, on the SAME grant (BackOffice spec 4190 story 47): nobody new gains the power
        // to change bonus buys. The screen's own gate reads this predicate too. FAILS CLOSED.
        requires: canOpenBbyMaintain,
      },
      {
        labelKey: 'coupons:menu.coupons',
        icon: Ticket,
        routerLink: '/pricing/coupons',
        activePrefix: '/pricing/coupons',
        // Same predicate as CouponsAdminPage's own guard. The Templates + Import
        // workspaces are admin-only, so the leaf shows on `canAdminCoupons`
        // (`CouponsAdmin:03`).
        requires: canAdminCoupons,
      },
      {
        labelKey: 'coupons:menu.couponSupport',
        icon: LifeBuoy,
        routerLink: '/pricing/coupon-support',
        activePrefix: '/pricing/coupon-support',
        // Shares the Coupons predicates with the Admin leaf + both pages (issue 429).
        // Support screen shows on `canSupportCoupons` = `CouponsSupport:03` OR
        // `CouponsAdmin:03` — so a support-only agent sees this leaf but NOT the
        // admin Coupons leaf above (ticket 523).
        requires: canSupportCoupons,
      },
    ],
  },
  {
    // Its own top-level group, after Pricing and before Materials (BackOffice spec 2737, ticket 501):
    // `/campaigns/*` is a new URL prefix and a new nav group, the rule engine's campaigns — Pricing's
    // bonus-buy screens are the OTHER engine and stay where they are. Every leaf label lives in
    // `campaigns`, the area's own namespace (named for the area since 535 retired the campaign list); Priority (513), Simulator (514), Sessions (518),
    // Coupon finder and Customers (519), Campaign upload (530) and Campaign uploads (532) each append their leaf with the
    // page it opens.
    //
    // Every leaf reads the rule engine's keys (oms 852, BackOffice 3459) for its family: the authoring screens on
    // author OR approver (`RuleAuthoring:02` / `:06`), Campaign upload on author alone, support's three on
    // `RuleSupport:03`. The group drops when no leaf is visible. 🚩 FAILS CLOSED; each page still names its doors' bare 403.
    labelKey: 'campaigns:menu.group',
    icon: Megaphone,
    items: [
      {
        // The Promotions list (ticket 534; it read "Campaigns" before BackOffice brief 2848) owns
        // `/campaigns/*` — a promotion's page and a campaign's workspace (`/campaigns/:id/…`) light it.
        // A later static leaf (`/campaigns/priority`) wins its own address by being more specific.
        labelKey: 'campaigns:menu.promotions',
        icon: Megaphone,
        routerLink: '/campaigns',
        requires: canReadAuthoring,
      },
      {
        // The evaluation order (ticket 513): more specific than the list's `/campaigns`, so it
        // lights itself, not Campaigns.
        labelKey: 'campaigns:menu.priority',
        icon: ListOrdered,
        routerLink: '/campaigns/priority',
        requires: canReadAuthoring,
      },
      {
        // The rule engine's dry run (ticket 514); not Pricing's bonus-buy Simulation.
        labelKey: 'campaigns:menu.simulator',
        icon: FlaskConical,
        routerLink: '/campaigns/simulator',
        requires: canReadAuthoring,
      },
      {
        // Support's view of the customer sessions (ticket 518); a session
        // (`/campaigns/sessions/:saleId`) lights it too.
        labelKey: 'campaigns:menu.sessions',
        icon: Receipt,
        routerLink: '/campaigns/sessions',
        requires: canSupportRules,
      },
      {
        // Support finds a coupon code across every campaign (ticket 519).
        labelKey: 'campaigns:menu.couponFinder',
        icon: Ticket,
        routerLink: '/campaigns/coupon-finder',
        requires: canSupportRules,
      },
      {
        // Support reads a member's wallet, balance and budgets used (ticket 519) — the rule
        // engine's view only; Loyalty's member screen keeps the record.
        labelKey: 'campaigns:menu.customers',
        icon: UserSearch,
        routerLink: '/campaigns/customers',
        requires: canSupportRules,
      },
      {
        // One workbook for one promotion, read all or none (ticket 530) — the author's act, so author alone.
        labelKey: 'campaigns:menu.upload',
        icon: FileSpreadsheet,
        routerLink: '/campaigns/upload',
        requires: canAuthorRules,
      },
      {
        // The approver's list of every promotion's upload (ticket 532); an opened upload
        // (`/campaigns/uploads/:promotionCode`) lights it too. Every authoring reader sees it.
        labelKey: 'campaigns:menu.uploads',
        icon: ClipboardCheck,
        routerLink: '/campaigns/uploads',
        requires: canReadAuthoring,
      },
    ],
  },
  {
    // Its own top-level group, after Pricing (BackOffice spec 2544, ticket 451): `/materials/*` is
    // a new URL prefix and a new nav group, which is exactly when a new area folder appears. All
    // three leaf labels live in `materials-search` (the area's first namespace); 453 and 454
    // re-point their leaf's page, never these keys.
    labelKey: 'materials-search:menu.materials',
    icon: Pill,
    items: [
      {
        labelKey: 'materials-search:menu.search',
        icon: PackageSearch,
        routerLink: '/materials',
        // The whole subtree, so a material's own page (`/materials/:no`, ticket 452) keeps this
        // leaf lit. The stock and GS1 leaves claim their own longer prefixes, and the rail marks
        // the most specific leaf (`markedLeaf`), so they win on their own pages.
        activePrefix: '/materials',
        requires: canSearchMaterials,
      },
      {
        labelKey: 'materials-search:menu.gs1Check',
        icon: ScanBarcode,
        routerLink: '/materials/gs1',
        activePrefix: '/materials/gs1',
        requires: canCheckGs1,
      },
    ],
  },
  {
    // Its own top-level group, LAST, after Materials (BackOffice spec 2615, ticket 477): `/deliverect/*`
    // is a new URL prefix and a new nav group. All four leaf labels live in `deliverect-stores` (the
    // area's first namespace); 478 (orders), 479 (catalog) and 482 (terms) each append their leaf,
    // on `canViewOrders` / `canManageCatalog` / `canManageTerms`, with the page it opens.
    labelKey: 'deliverect-stores:menu.deliverect',
    icon: Truck,
    items: [
      {
        labelKey: 'deliverect-stores:menu.stores',
        icon: Store,
        routerLink: '/deliverect/stores',
        activePrefix: '/deliverect/stores',
        requires: canManageStores,
      },
      {
        labelKey: 'deliverect-stores:menu.orders',
        icon: ShoppingBag,
        routerLink: '/deliverect/orders',
        activePrefix: '/deliverect/orders',
        requires: canViewOrders,
      },
      {
        labelKey: 'deliverect-stores:menu.catalog',
        icon: BookCheck,
        routerLink: '/deliverect/catalog',
        activePrefix: '/deliverect/catalog',
        requires: canManageCatalog,
      },
      {
        labelKey: 'deliverect-stores:menu.terms',
        icon: Handshake,
        routerLink: '/deliverect/terms',
        activePrefix: '/deliverect/terms',
        requires: canManageTerms,
      },
    ],
  },
  {
    // Its own top-level group, LAST, right after Deliverect (BackOffice spec 3028, ticket 551):
    // `/hungerstation/*` is a new URL prefix and a new nav group — the DIRECT HungerStation rail,
    // not HungerStation through Deliverect. All leaf labels live in `hungerstation-stores` (the
    // area's first namespace). 551 shipped every leaf, one per key; Materials (555) and Orders
    // (556) now route to their own pages.
    labelKey: 'hungerstation-stores:menu.hungerstation',
    icon: Bike,
    items: [
      {
        labelKey: 'hungerstation-stores:menu.stores',
        icon: Store,
        routerLink: '/hungerstation/stores',
        activePrefix: '/hungerstation/stores',
        requires: canManageHsStores,
      },
      {
        labelKey: 'hungerstation-stores:menu.materials',
        icon: PackageSearch,
        routerLink: '/hungerstation/materials',
        activePrefix: '/hungerstation/materials',
        requires: canManageHsCatalog,
      },
      {
        labelKey: 'hungerstation-stores:menu.orders',
        icon: ShoppingBag,
        routerLink: '/hungerstation/orders',
        activePrefix: '/hungerstation/orders',
        requires: canViewHsOrders,
      },
      {
        // HungerStation promotions (BackOffice spec 3201, ticket 665) — made here, SENT to HungerStation.
        labelKey: 'hungerstation-stores:menu.promotions',
        icon: BadgePercent,
        routerLink: '/hungerstation/promotions',
        activePrefix: '/hungerstation/promotions',
        requires: canManageHsPromotions,
      },
    ],
  },
  // Insurance rules (BackOffice spec 3126, oms 607), LAST: declared in `./menu-insurance-rules`, where 608–617
  // add their leaves without touching this file.
  INSURANCE_RULES_MENU,
  // Insurance (BackOffice spec 4050, oms 922), LAST, beside Insurance rules: declared in `./menu-insurance`, where 924
  // adds its leaves without touching this file.
  INSURANCE_MENU,
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
  return matchLength(item, pathname) >= 0
}

/**
 * How specific `item`'s claim on `pathname` is under {@link isActive}'s rule: the
 * length of the longest address it matches through, or -1 when it does not match.
 * The top bar's crumb (ticket 386) uses it to pick the most specific of two items
 * claiming one address.
 */
export function matchLength(item: ShellMenuItem, pathname: string): number {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (item.exact) return item.routerLink && path === item.routerLink ? item.routerLink.length : -1
  const target = item.activePrefix ?? item.routerLink
  if (!target) return -1
  const targets = typeof target === 'string' ? [target] : target
  return Math.max(-1, ...targets.filter((t) => path === t || path.startsWith(t + '/')).map((t) => t.length))
}

/**
 * The one leaf the rail marks on `pathname` (ticket 391): of every leaf in `menu` that
 * {@link isActive} says claims it, the most specific under {@link matchLength}, or null.
 *
 * 🚩 Two leaves can claim one address: the eligibility list owns `/nphies/eligibility/*`
 * through its prefix, and New check is `/nphies/eligibility/new` inside it. Marking by
 * `isActive` alone drew the gold marker on both. This is the crumb's own rule, so the
 * crumb and the marker name the same leaf. Only leaves compete — a sub-group header is
 * never marked (see `SubGroupLink`).
 *
 * ⚠️ The rail passes the full `MENU`, as the crumb does, not the granted slice. That is
 * sound while two leaves that compete for an address share one predicate (the two
 * eligibility leaves do); a more specific leaf gated differently would win while hidden.
 * The rail compares the answer by identity, which holds because `useVisibleMenu` passes
 * leaves through unchanged (it copies only groups).
 */
export function markedLeaf(menu: ShellMenuItem[], pathname: string): ShellMenuItem | null {
  let best: ShellMenuItem | null = null
  let bestScore = -1
  let bestDepth = -1
  for (const { item, depth } of leavesOf(menu, 0)) {
    const score = matchLength(item, pathname)
    // On a tie the deeper leaf wins, exactly as in `deriveCrumb`.
    if (score >= 0 && (score > bestScore || (score === bestScore && depth > bestDepth)))
      [best, bestScore, bestDepth] = [item, score, depth]
  }
  return best
}

const leavesOf = (items: ShellMenuItem[], depth: number): { item: ShellMenuItem; depth: number }[] =>
  items.flatMap((item) => (item.items ? leavesOf(item.items, depth + 1) : [{ item, depth }]))
