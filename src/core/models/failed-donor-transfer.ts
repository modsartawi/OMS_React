// Wire shape for GET SdDocumentWeb/FailedDonorTransfers (spec 430 D5, ticket 434) — BackOffice ask
// BO-4, NOT built yet. The rows are 2371's `FailedDonorTransferRow` as the WPF Failed donor
// transfers screen reads it (`Sartawi.Retail.Data/Modules/Pick/Services/Models/
// DonorTransferInquiryModels.cs`), in the camelCase ASP.NET Core emits. Nothing is invented beyond
// that class.

/**
 * One line of HQ inventory's queue: a donor transfer job that failed or is still retrying, or a
 * CANCELLED request whose transfer posted all the same (reverse by hand).
 *
 * On a reverse-by-hand line whose request has no job left, the job fields are empty: `outboxId`
 * `''` and both times the .NET unset `DateTime` (`0001-01-01T00:00:00`).
 */
export interface FailedDonorTransferRow {
  requestNo: string
  deliveryNo: string
  donorStore: string
  orderStore: string
  /** The donor request's state: FULFILLED, TRANSFERRED or CANCELLED. */
  requestState: string
  /** The SAP PO DRS reported for the transfer, once its goods issue posted. */
  transferStoNo: string | null
  /** The outbox (DRTR) row the re-run door takes; `''` when the request has no job left. */
  outboxId: string | null
  /** The outbox row's status — the WPF constants are `F` failed, `P` retrying, `C` completed. */
  outboxStatus: string | null
  attemptCount: number
  lastAttemptTime: string
  retryDeadline: string
  /** DRS's last message (or the fault) as the handler recorded it. Free text. */
  errorMessage: string | null
  /** A CANCELLED request whose transfer posted: HQ reverses the STO in DRS by hand. */
  reverseByHand: boolean
}
