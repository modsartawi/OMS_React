/**
 * The one permissions answer (oms 914, BackOffice spec 4002, brief `3995-oms-react-permissions-brief.md`).
 *
 * `GET Auth/Permissions` answers every `BackOfficeScreen` grant the signed-in user holds, as seed-spelled keys
 * (`DocumentList:03`, `Attachments:03:NPHIES`), plus five extras. It replaces the ~45 `*\/Access` probes the shell used
 * to fire on every cold load: the menu, the page guards and the buttons all read `has(key)` off this one cached answer.
 *
 * - Read once per page life (`staleTime: Infinity`, `retry: false`), started by `ProtectedLayout` beside `Auth/Me`.
 * - **Fails closed.** Pending, errored or malformed (not an object, `screens` not a string array) grants nothing.
 * - A **403** from any door invalidates it (`invalidatePermissionsOnForbidden`), and a user change resets it
 *   (`dropPermissionsOnUserChange`), so a revoke bites at the next door and a grant never outlives its user.
 * - Show/hide only: every data door still checks its own grant.
 *
 * Revalidation: the server sends `ETag: W/"<version>"` + `Cache-Control: private, no-cache`, so the browser's own
 * `fetch` revalidates with `If-None-Match` and a 304 surfaces as the cached 200 body. Nothing here sends the header.
 */
import { useMemo } from 'react'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { api, onForbidden } from '@/core/api'
import { useSession } from '@/core/session'

/**
 * Every two-field key oms-react reads, in the seed's own spelling (COMMAND codes: 01 create, 02 change, 03 display, 04 delete,
 * 06 execute, 07). A key not listed here does not type-check, so a typo is a compile error, not a hidden leaf.
 * ⚠ `ItemInquiryCustome` is the seed's spelling (no final r).
 */
export const SCREEN_KEYS = [
  // Store sync console (ActionSync)
  'ActionSyncConsole:03',
  'ActionSyncConsole:06',
  'StoreOnboard:06',
  'SyncObjectEnrol:06',
  'ReceiptReplay:06',
  'SyncStoreScript:06',
  // Store database (BackOffice spec 4016 D9; keys from StoreDatabaseGrants.cs, pricing2 fa2759e8f)
  'StoreDatabaseView:03',
  'StoreDatabaseAct:06',
  'StoreDatabaseRestore:06',
  // Analytics
  'Analytics:02',
  'Analytics:03',
  'Analytics:06',
  'Analytics:07',
  // Administration
  'AuthzAdmin:03',
  'UaUsers:03',
  'UaSessions:03',
  'NotificationBroadcast:01',
  'PosReleaseQueue:03',
  'PosReleaseQueue:06',
  'DataSyncConsole:03',
  'DataSyncConsole:06',
  'SdDocTypeConfig:06',
  // Call center
  'CallCenter:03',
  // OMS
  'DocumentList:03',
  'DocumentDetails:02',
  'DocumentDetails:03',
  'OmsMarkDelivered:06',
  'OmsReturnBack:06',
  'FailedDonorTransfers:03',
  'FailedDonorTransfers:06',
  'DonorRequestInquiry:03',
  'DocumentPaymentInquiry:03',
  'SdCityInquiry:03',
  'SdDistrictInquiry:03',
  'SdCityImport:03',
  'SdDistrictImport:03',
  'DocumentSourceUsersInquiry:03',
  'DocumentSourceUsersImport:03',
  'PickSupport:03',
  'PickSupport:06',
  'PickSupportSerial:03',
  'OmsCreateReturn:01',
  'LocalFulfillmentReturn:03',
  'LocalFulfillmentReturn:04',
  'OmsInsuranceView:03',
  'CentralInvoice:03',
  'DispatchBoard:03',
  'DispatchBoard:06',
  'DispatchScorecard:03',
  'ServingList:03',
  'ServingList:06',
  'SourcingAdvisor:01',
  'StoreStage:02',
  'StoreStage:03',
  'StoreCountClose:02',
  'StockHealth:03',
  // Stock console (BackOffice spec 4157 / 4158): `BackOfficeScreen[StockConsole, 03]`, role STOCK_CONSOLE_VIEWER.
  'StockConsole:03',
  'BupaLineOutcomes:03',
  'ExpiredApprovalPick:03',
  'HeldStockReport:03',
  'HoldDailyList:03',
  'SerialRefusal:03',
  'PrescriptionSessionHq:03',
  'PrescriptionSessionWriteOff:06',
  // Copilot
  'Copilot:01',
  'Copilot:06',
  // Pricing
  'CouponsAdmin:03',
  'CouponsSupport:03',
  'BbyInquiry:03',
  'BbyMaintain:03',
  'BbyMaintain:04',
  'BbyDownload:03',
  'PosSimulation:03',
  'PricingCache:03',
  // Insurance rules + IDF
  'IdfPriority:03',
  'IdfPriority:06',
  'IdfPriority:07',
  'InsurancePatientBlock:03',
  'InsuranceReferenceEdition:03',
  'InsuranceGuardException:03',
  'InsurerSettings:03',
  'InsuranceRulePlayground:01',
  'InsuranceRuleInspection:03',
  'InsuranceRuleHits:03',
  'InsuranceRuleAuthoring:03',
  // BackOffice owner ruling 2026-11-18: approve a guard draft you submitted or last edited.
  'InsuranceRuleSelfApproval:06',
  'InsurancePayerMonth:03',
  // Insurance pattern cases (BackOffice spec 4050; oms 922-924), the CONTROLLER InsurancePattern as BackOffice 4053/4055
  // seed it: 03 view (the list and a case), 02 mark, 06 reveal, 01 manage (settings, reveal log); InsurancePatientBlock:02
  // is 3965's own Change on the blocked-patient list (924's block needs it beside 06).
  'InsurancePattern:03',
  'InsurancePattern:02',
  'InsurancePattern:06',
  'InsurancePattern:01',
  'InsurancePatientBlock:02',
  // Nphies
  'Nphies:03',
  'NphiesReleaseApproval:03',
  'NphiesUndispense:03',
  // Loyalty
  'LoyaltyGroup:02',
  'LoyaltyGroup:03',
  'LoyMember:02',
  'LoyMember:03',
  'LoyMember:04',
  // Materials
  'ItemInquiryCustome:03',
  'MaterialStockInquiry:03',
  'Gs1SerialInquiry:03',
  // Collections
  'CollectionInquiry:03',
  'AcrInquiry:03',
  'DepositInquiry:03',
  'CollectionAttempts:03',
  'CollectionAssignment:03',
  'SettlementAccount:03',
  'SettlementSupervision:03',
  'CollectionReady:03',
  // Rule engine (campaigns)
  'RuleAuthoring:02',
  'RuleAuthoring:06',
  'RuleSupport:03',
  'RuleEngineSwitch:02',
  // Reports
  'RetailInvoice:03',
  'IDocInspector:03',
  'SapExportConsole:03',
  // Channels
  'DeliverectStores:03',
  'DeliverectCatalog:03',
  'DeliverectOrders:03',
  'DeliverectTerms:03',
  'DeliverectPlatformAdd:03',
  'HungerStationStores:03',
  'HungerStationCatalog:03',
  'HungerStationOrders:03',
  'HungerStationPromotions:03',
  'HybrisStock:03',
  'HybrisStock:06',
  // Mini POS (BackOffice spec 4032, ticket 4043; role OMS_MINIPOS_ADMIN): 03 reads, 06 writes and the printed code
  'MiniPosAdmin:03',
  'MiniPosAdmin:06',
  // Mini POS scorecard (BackOffice 4075; role OMS_MINIPOS_SCORECARD, and the lead's OMS_MINIPOS_ADMIN): the report
  'MiniPosScorecard:03',
  // Price command center (BackOffice spec 3495/4127; PriceWatchGrants.cs): 03 view, 06 manage (decisions, matching)
  'PriceWatch:03',
  'PriceWatch:06',
] as const

/**
 * A key oms-react reads: one of the two-field `SCREEN_KEYS`, or a three-field Attachments key whose third field is a
 * category derived from `screens`, never hard-coded.
 */
export type ScreenKey = (typeof SCREEN_KEYS)[number] | `Attachments:03:${string}` | `Attachments:04:${string}`

/** The facts beside the grants that are not `BackOfficeScreen` keys. */
export interface PermissionsExtras {
  /** `FileServerSettings.IsConfigured` on this host — the Attachments screen needs it. */
  fileServerReady: boolean
  /** `NotificationCenter:Enabled` — the broadcast composer needs it. */
  notificationCenterOn: boolean
  /**
   * `CommandCenter:Home` (oms 946, BackOffice spec 4165) — the Retail Command Center's pages and read routes are mapped
   * only then. ⚠ proposed: BO 4176 does not carry this extra yet (follow-up on the ticket); a missing flag is off.
   */
  commandCenterOn: boolean
  /** `NphiesWebContract.Version` ("1.3" today). */
  nphiesContractVersion: string
  /** `S_ROLE_MAINT ACTVT=02`. */
  canManageRoles: boolean
  /** `S_USER_MAINT ACTVT=02`. */
  canManageUsers: boolean
}

/** `GET Auth/Permissions`' `data`, after `parsePermissionsAnswer` accepted it. */
export interface PermissionsAnswer {
  screens: string[]
  extras: PermissionsExtras
  /** 32 hex chars, the hash of screens + extras (also the weak ETag). */
  version: string
}

/** What every reader holds: `has(key)`, the extras, and whether the answer is in. */
export interface Permissions {
  /** Exact `Set` lookup over `screens`. False while pending, on error and on a malformed answer. */
  has(key: ScreenKey): boolean
  /** The raw keys held (empty unless answered) — for the three-field Attachments keys, derived not hard-coded. */
  readonly screens: readonly string[]
  readonly extras: PermissionsExtras
  /** The answer is in, or failed (a failure is settled: it must not hang the menu). */
  readonly settled: boolean
  /** The call errored or answered a shape nobody agreed to: everything is denied. */
  readonly failed: boolean
}

/** The one query key; a 403 and a user change act on it. */
export const PERMISSIONS_KEY = ['auth', 'permissions'] as const

const NO_EXTRAS: PermissionsExtras = Object.freeze({
  fileServerReady: false,
  notificationCenterOn: false,
  commandCenterOn: false,
  nphiesContractVersion: '',
  canManageRoles: false,
  canManageUsers: false,
})

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * The answer, or null when it is not the agreed shape (not an object, `screens` not a string array, no `extras`
 * object). An extra that is not an explicit `true` (or, for the version, a string) reads as denied.
 */
export function parsePermissionsAnswer(raw: unknown): PermissionsAnswer | null {
  if (!isRecord(raw)) return null
  const { screens, extras, version } = raw
  if (!Array.isArray(screens) || !screens.every((s) => typeof s === 'string')) return null
  if (!isRecord(extras)) return null
  return {
    screens: screens as string[],
    extras: {
      fileServerReady: extras.fileServerReady === true,
      notificationCenterOn: extras.notificationCenterOn === true,
      commandCenterOn: extras.commandCenterOn === true,
      nphiesContractVersion: typeof extras.nphiesContractVersion === 'string' ? extras.nphiesContractVersion : '',
      canManageRoles: extras.canManageRoles === true,
      canManageUsers: extras.canManageUsers === true,
    },
    version: typeof version === 'string' ? version : '',
  }
}

export const permissionsApi = {
  /** `GET Auth/Permissions` — cookie-authenticated, not grant-gated. A malformed answer throws: fail closed. */
  async get(): Promise<PermissionsAnswer> {
    const parsed = parsePermissionsAnswer(await api.get<unknown>('Auth/Permissions'))
    if (!parsed) throw new Error('Auth/Permissions answered a shape nobody agreed to')
    return parsed
  },
}

/** The one set of options: the shell and every reader share the cache entry. */
export function permissionsQuery() {
  return {
    queryKey: PERMISSIONS_KEY,
    queryFn: () => permissionsApi.get(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The slice of a react-query result `permissionsFromQuery` reads. */
export interface PermissionsQueryState {
  isPending: boolean
  isError: boolean
  data: PermissionsAnswer | null | undefined
}

/**
 * The pure half of `usePermissions`. Only a settled, non-errored, well-formed answer grants anything; an errored
 * query keeps no grants even if it still holds an older answer.
 */
export function permissionsFromQuery(state: PermissionsQueryState): Permissions {
  const answer = !state.isPending && !state.isError ? (state.data ?? null) : null
  return permissionsOf(answer, { settled: !state.isPending, failed: state.isError || (!state.isPending && !answer) })
}

/** A `Permissions` over a given answer (null = nothing granted). Tests build fakes with it. */
export function permissionsOf(
  answer: Pick<PermissionsAnswer, 'screens'> & Partial<Pick<PermissionsAnswer, 'extras'>> | null,
  state: { settled: boolean; failed: boolean } = { settled: true, failed: answer === null },
): Permissions {
  const screens = answer?.screens ?? []
  const held = new Set(screens)
  return {
    has: (key) => held.has(key),
    screens,
    extras: answer ? { ...NO_EXTRAS, ...answer.extras } : NO_EXTRAS,
    settled: state.settled,
    failed: state.failed,
  }
}

/** The hook every gate, leaf and button reads. */
export function usePermissions(): Permissions {
  const { isPending, isError, data } = useQuery(permissionsQuery())
  // One object per answer, not per render, so a reader may list it in a hook's dependencies.
  return useMemo(() => permissionsFromQuery({ isPending, isError, data }), [isPending, isError, data])
}

/**
 * Any 403 from `@/core/api` invalidates the answer, so the menu and the buttons catch up with a revoke at the next door.
 * `Auth/Permissions` itself is never grant-gated, so this cannot loop. Returns the unsubscribe.
 */
export function invalidatePermissionsOnForbidden(client: QueryClient): () => void {
  return onForbidden(() => {
    void client.invalidateQueries({ queryKey: PERMISSIONS_KEY, exact: true })
  })
}

/**
 * 🚩 Privacy: the answer lives for the page, so a user change (sign-in on another's tab, sign-out) resets it — no data,
 * fails closed — and the next reader asks afresh. Returns the unsubscribe.
 *
 * One exception keeps a cold load at ONE call: the answer is fetched in parallel with `Auth/Me`, so `Auth/Me` landing
 * moves the session from no user to the user. That step keeps an answer that succeeded or is still in flight (it was
 * asked with the same cookie `Auth/Me` just answered for) and drops only a failed one (the 401 of a signed-out page,
 * so a sign-in fetches the real answer). At a sign-in nothing is in flight: the query lives in the protected shell,
 * which `/login` does not mount. Staging 2026-11-18 showed two calls, at 736 and 776 ms, before this.
 */
export function dropPermissionsOnUserChange(client: QueryClient): () => void {
  return useSession.subscribe((now, before) => {
    if (now.userId === before.userId) return
    const firstUserOfThePage = before.userId === null && now.userId !== null
    if (firstUserOfThePage && client.getQueryState(PERMISSIONS_KEY)?.status !== 'error') return
    void client.resetQueries({ queryKey: PERMISSIONS_KEY, exact: true })
  })
}
