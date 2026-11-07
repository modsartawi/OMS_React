// Wire shape for GET SdDocumentWeb/Access (BackOffice 750; grants seeded by 749).
// The OMS area moved behind a cookie-only `SdDocumentWeb/*` door in ticket 125 — before
// that every OMS endpoint was open to any authenticated session, including the write
// doors (UpdateDocument, RescheduleDelivery, …). Field casing is the camelCase
// ASP.NET Core emits.

/**
 * The two OMS screen-open grants, as booleans. The client never sends or compares a
 * grant string — these are the only place the names appear client-side, and only as
 * documentation:
 *
 * - `canOpenList`   ← `BackOfficeScreen[DocumentList,03]`   — Delivery Documents list.
 * - `canOpenDetail` ← `BackOfficeScreen[DocumentDetails,03]` — Document Details, the
 *   deep-linkable screen that carries the update/reschedule write doors.
 *
 * Two grants, not one: the list is a read and the detail screen writes, so a session
 * may hold the first without the second (ticket 125, OQ2).
 *
 * - `canMarkDelivered` ← `BackOfficeScreen[OmsMarkDelivered,06]` — Mark delivered on
 *   Document Details (BackOffice spec 2417, ticket 2421). Reported on its own: the
 *   command is drawn only when it is `true` AND the session can open Document Details.
 *   Optional because an older SIS.Api does not send it, and absent must read as denied.
 *
 * - `canMarkReturnedBack` ← `BackOfficeScreen[OmsReturnBack,06]` — Mark returned back on
 *   Document Details (BackOffice spec 3433, ticket 3436; oms-react 838). Its own grant,
 *   independent of `canMarkDelivered` both ways. Optional for the same reason: absent is denied.
 */
export interface OmsAccessResult {
  canOpenList: boolean
  canOpenDetail: boolean
  canMarkDelivered?: boolean
  canMarkReturnedBack?: boolean
  // ── The OMS screens of spec 430 (D2, ticket 431) — BackOffice ask BO-1, not built yet ──
  // All optional: a server that has not learned a flag omits it, and an absent flag reads
  // as denied through `omsGrants` (`@/core/oms/access`), so the leaves stay hidden until then.
  /** `BackOfficeScreen[DonorRequestInquiry,03]` — new grant. */
  canOpenDonorRequests?: boolean
  /** `DocumentPaymentInquiry,03`. */
  canOpenDocumentPayments?: boolean
  /** `FailedDonorTransfers,03`. */
  canOpenFailedTransfers?: boolean
  /** `FailedDonorTransfers,06` — the re-run. */
  canReRunFailedTransfer?: boolean
  /** `SdCityInquiry,03` OR `SdDistrictInquiry,03`. */
  canOpenGeography?: boolean
  /** `SdCityImport,03`. */
  canImportCities?: boolean
  /** `SdDistrictImport,03`. */
  canImportDistricts?: boolean
  /** `DocumentSourceUsersInquiry,03`. */
  canOpenDocumentSourceUsers?: boolean
  /** `DocumentSourceUsersImport,03`. */
  canImportDocumentSourceUsers?: boolean
  // ── Pick support (BackOffice brief 2691; reported since BackOffice 2731) — optional for the
  // same reason: an older SIS.Api omits them, and an absent flag reads as denied.
  /** `BackOfficeScreen[PickSupport,03]` — the route, search, census and diagnosis. */
  canOpenPickSupport?: boolean
  /** `BackOfficeScreen[PickSupport,06]` — the fix. Hide the button without it. */
  canFixPickSupport?: boolean
  /**
   * `BackOfficeScreen[PickSupportSerial,03]` — Pick support returns serials (BackOffice 2874, client
   * ticket 540). ADVISORY: it words the search hint and the "restricted" note only. Whether a serial
   * is drawn is the server's per-unit `serialWithheld`, never this flag.
   */
  canSeePickSupportSerial?: boolean
  // ── Document Details' write doors (BackOffice 2763, client ticket 521). `canOpenDetail` only
  // READS since 2763; the writes need a second grant on top of it. Optional for the same reason:
  // an older SIS.Api omits them, and an absent flag reads as denied.
  /**
   * `BackOfficeScreen[DocumentDetails,02]` — `UpdateDocument`, `UpdateDelivery`,
   * `RescheduleDocument`, `RescheduleDelivery`: every bar command but the return and Mark
   * delivered, and the list's acts.
   */
  canChangeDetail?: boolean
  /** `BackOfficeScreen[OmsCreateReturn,01]` — `CreateReturn`. Neither grant implies the other. */
  canCreateReturn?: boolean
  // ── Guards on an insured order (BackOffice spec 3126, 3142/3143; client ticket 616). GUESSED flag
  // names — the brief names the grants but no probe; 618 reconciles. Absent reads as denied.
  /** `INS_GUARD` — answer an OVERRIDE (`@/core/insurance-rules/order-guards`). */
  canOverrideGuard?: boolean
  /** The release grant — release an order held for a guard check. */
  canReleaseGuardHold?: boolean
  // ── Local fulfillment returns (BackOffice spec 3369 D14, probe door 3376; client spec 759, ticket
  // 760). Spellings transcribed from 3369's wire, corrected by 765. Optional: absent reads as denied.
  /**
   * `BackOfficeScreen[LocalFulfillmentReturn,03]` — draws Return Document on an `LF` delivery, the LF
   * return panel and the needing-action filter. The bonded `canCreateReturn` neither implies nor is
   * implied by it.
   */
  canCreateLocalFulfillmentReturn?: boolean
  /** `BackOfficeScreen[LocalFulfillmentReturn,04]` — force refund. Counts ONLY beside 03. */
  canForceLocalFulfillmentReturnRefund?: boolean
  // ── The insurance-view grant (BackOffice spec 3389, door 3390; client tickets 786–789). GUESSED
  // flag name and grant code — 3390 names "a new insurance-view grant" but neither the code nor a
  // probe flag; the live-door ticket reconciles. Optional: absent reads as denied
  // (`canViewInsurance`, `@/core/oms/insurance-grant`).
  /**
   * GUESS `BackOfficeScreen[OmsInsuranceView,03]` — health data: Document Details' Insurance section,
   * the delivery strip's link to it, the list's patient / member ID columns and their export.
   */
  canViewInsurance?: boolean
}
