/**
 * Wire shape of `POST BbyMaintainWeb/Upload` (BackOffice spec 2374, doors 2381 + 2382).
 *
 * Read from the SHIPPED DTOs (`BbyUploadResult`, `BbyUploadBonusBuy`, `BbyUploadRefusal` in
 * `Sartawi.Retail.Data/.../Bby/Services/BbyMaintainModels.cs`), camelCased by SIS.Api. Kept apart
 * from `bonus-buy-maintenance.ts` because its refusal is a different shape: an upload refusal names
 * a file ROW and serial, and carries its texts as `english`/`arabic`.
 */
import type { BbyStatusCode } from './bonus-buy-maintenance'

/** `saved` (written), `valid` (a check-only run that passed, nothing written) or `refused`
 *  (nothing written). */
export type BbyUploadStatus = 'saved' | 'valid' | 'refused'

/** One bonus buy a file created or updated. */
export interface BbyUploadBonusBuy {
  /** The 1-based file row the bonus buy starts on. */
  row: number
  /** SAP's `BBY_SERIAL`. */
  serial: string
  buyGroup: string
  getGroup: string
  /** The `OMS…` number; null on a check-only run's NEW bonus buys (none is minted). */
  bbyNumber: string | null
  /** SAP's status it landed in. A new one is always `1` Planned (spec 2396: no upload
   *  activates), and a re-upload only reaches a Planned one, so an updated one reads `1` too. */
  bbyStatus: BbyStatusCode
}

/** One refusal or warning: its 1-based file row (0 = the whole file), the row's serial, and the
 *  `BBY-` code with its English and Arabic text. */
export interface BbyUploadRefusal {
  row: number
  serial: string
  code: string
  english: string
  arabic: string
}

export interface BbyUploadResult {
  status: BbyUploadStatus
  /** The file's promotion (its `AKTNR`), which need not be the promotion on screen. */
  promoNumber: string
  /** The file's `P…` was unknown, so the upload created it (or, check only, would). */
  promotionCreated: boolean
  created: BbyUploadBonusBuy[]
  updated: BbyUploadBonusBuy[]
  refusals: BbyUploadRefusal[]
  warnings: BbyUploadRefusal[]
}
