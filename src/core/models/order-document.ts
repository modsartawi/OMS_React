import type { OrderGuardState } from '@/core/insurance-rules/guard-check'
import type { LocalDate } from '@/core/util/date-window'

// Wire shape for `GET SdDocumentWeb/OrderDocumentList` (BackOffice spec 3389, door 3391): the
// Order / ERX list's search. Cookie-only, behind the OMS LIST grant (`canOpenList`). Not built
// yet: oms-react builds against stubs, so THIS file is the client's statement of the contract,
// camelCase as System.Text.Json's web defaults emit it. A live call that disagrees corrects
// BackOffice 3391 first, then this file (the 765 drift pattern).
//
// It lives in `core/models` because two client tickets read it: the list (786) and the delivery
// page's money strip (789), which finds its order's money source / patient / insurer here under
// the list grant — the insurance read (`./order-insurance`) needs the insurance-view grant, and
// 789's strip must show money WITHOUT that grant.

export type { LocalDate }

/** Whose money an insurance order stands on (`SdDocumentInsurance.MoneySource`, spec 2129 / 2112). */
export type MoneySource = 'CHANNEL' | 'ENGINE'

/** The two document categories the search lists: an order and an ERX prescription. Never `D` or `Q`. */
export type OrderDocumentCategory = 'O' | 'X'

/**
 * The criteria of 3391, as the client holds them. Every field is nullable: `null` / blank is no
 * filter (`buildQuery` in `@/core/api` drops `null`/`undefined`/`''`). The QUERY PARAMETER names
 * are PascalCase, as `DeliveryDocumentList`'s are (`OrderNo`, `DocumentNo`, `Approval`,
 * `DocumentSource`, `PatientId`, `Mobile`, `MemberId`, `StoreCode`, `DocumentType`, `Status`,
 * `HasDelivery`, `MoneySource`, `FromDate`, `ToDate`, `Limit`) — the feature's `api.ts` maps them.
 *
 * The date is a resolved local-date pair here: the list's query bar keeps it RELATIVE ("Last 3
 * days") and resolves it only when the search runs, as the delivery list does.
 */
export interface OrderSearchCriteria {
  /** Find one (identifier — ignores the date). */
  orderNo: string | null
  /** Find one (identifier — ignores the date). */
  documentNo: string | null
  /**
   * Find one (identifier — ignores the date). Matches the header `ApprovalNumber`, `ApprovalId`,
   * `ReferenceErx` and the insurance `AuthorizationId` alike.
   */
  approval: string | null
  /**
   * Find one (identifier — ignores the date). Matches the header `PatientId`, the customer's
   * `NationalIdNumber` and the insurance `IdentityNumber`. Health data: the server may refuse or
   * ignore it without the insurance-view grant — the client offers it only with that grant.
   */
  patientId: string | null
  /** Find one (identifier — ignores the date). The customer's mobile. */
  mobile: string | null
  /** Find one (identifier — ignores the date). The Bupa member card. Same grant note as `patientId`. */
  memberId: string | null
  /** Narrow: the channel — `DocumentSource` (ERX, call centre, e-commerce …). */
  documentSource: string | null
  storeCode: string | null
  /** Narrow: the document type code (`BUPA`, `CLCN`, …). */
  documentType: string | null
  /** Narrow: the order's status (coded). The value set is the server's; see 3391. */
  status: string | null
  /** Narrow: `true` = has a delivery, `false` = no delivery yet, `null` = either. */
  hasDelivery: boolean | null
  moneySource: MoneySource | null
  /** On the order's entry time, local time, `yyyy-MM-dd`. Sent only when both ends are set. */
  fromDate: LocalDate | null
  toDate: LocalDate | null
  limit: number | null
}

/**
 * The identifier criteria. Any one of them in the search makes the search ignore the date (3391's
 * date rule); without one, a range is required — default the last 3 days, at most 31.
 */
export const ORDER_IDENTIFIER_FIELDS = ['orderNo', 'documentNo', 'approval', 'patientId', 'mobile', 'memberId'] as const satisfies readonly (keyof OrderSearchCriteria)[]

/** 3391's date rule, stated once for the client's mirror of it. */
export const ORDER_SEARCH_DATE_RULE = { defaultDays: 3, maxDays: 31 } as const

/** The server's default row limit (3391); the cap is the delivery list's. */
export const ORDER_SEARCH_DEFAULT_LIMIT = 500

/** One row of the Order / ERX list (3391 Row; spec 3389 user story 22). */
export interface OrderDocumentRow {
  orderNo: string
  documentNo: string
  documentCategory: OrderDocumentCategory
  documentType: string // coded
  documentTypeDescription: string
  documentSource: string // coded — the channel
  documentSourceDescription: string
  storeCode: string
  customerName: string
  /** The customer's mobile. */
  customerPhone: string
  /** Local time, no offset (no-utc-time rule). */
  entryTime: string
  /** The order's status (coded) and its description. */
  status: string
  statusDescription: string
  /** The close status (coded), as the delivery list carries it: `R` close requested, `C`/`X` closed. */
  closeStatus: string
  netTotal: number
  amountDue: number
  /**
   * The order's currency (the store's), for money in its decimals (`formatMoneyIn`). Optional
   * because 3391 does not name it yet — absent reads as the 2-decimal default. Client ask.
   */
  currency?: string | null
  /** The latest delivery of the order, or `null` before it has one ("No delivery yet"). */
  deliveryNo: string | null
  /** Where the order's guard check stands (the existing `StampGuardStatesAsync`); absent = none. */
  guardState?: OrderGuardState
  /**
   * Whether the order is an insurance order — its insurance record exists (glossary), not its
   * document type. Client ask: 3391 implies it by filling the three fields below; an explicit flag
   * keeps "not insurance" apart from "insurance, money unknown".
   */
  isInsuranceOrder: boolean
  /** For an insurance order: whose money stands. `null` otherwise. */
  moneySource: MoneySource | null
  /** For an insurance order: the patient's total on the current money. `null` otherwise. */
  patientTotal: number | null
  /** For an insurance order: the insurer's total on the current money. `null` otherwise. */
  insurerTotal: number | null
  /**
   * Health identifiers, ONLY for a caller holding the insurance-view grant: the server omits them
   * otherwise (absent, not `""`). The export leaves them out without the grant whatever the row
   * carries (786).
   */
  patientId?: string | null
  memberId?: string | null
}
