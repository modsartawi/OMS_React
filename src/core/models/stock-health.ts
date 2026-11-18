/**
 * The Stock health page (oms 912, BackOffice spec 4011 / door 4012) — wire shapes mirrored field for field, camelCase, from
 * BackOffice `Sartawi.Retail.Data\Modules\Stock_v2\Health\StockHealthModels.cs` and the brief
 * (`C:\Work\DMSCO\BackOffice\.issues\assets\4011-oms-react-stock-health-brief.md`). A shape change goes there first, then here.
 *
 * - `GET StockHealth` → `{ readAt, signals[] }`, behind `BackOfficeScreen[StockHealth, 03]` (role `STOCK_HEALTH_VIEWER`).
 *
 * The server judges; the page draws. Signals arrive in the spec's order (S1..S10) and their count is NOT fixed: S8
 * (`drsQueue`) appears only once BackOffice 3993 ships, and a later signal may join.
 *
 * ⚠️ Times are the estate's local wall-clock, `"yyyy-MM-ddTHH:mm:ss"` with no offset; they stay strings and are never
 * shifted. A figure that is a time is a string in that same format.
 */

/**
 * The keys 4012 sends (S1..S7), the one 3993 adds (S8), and the two 4014 adds (S9 `batchBookVsSap`, S10 `negativeStock`;
 * BackOffice spec 4013, oms 913). A key this list does not name still draws, in English.
 */
export const STOCK_HEALTH_KEYS = [
  'feeds',
  'batchWorker',
  'hourlyCount',
  'salePush',
  'takeDoor',
  'holdSeamTills',
  'storeStages',
  'drsQueue',
  'batchBookVsSap',
  'negativeStock',
] as const
export type StockHealthKey = (typeof STOCK_HEALTH_KEYS)[number]

export const STOCK_HEALTH_VERDICTS = ['good', 'watch', 'bad', 'noAnswer'] as const
/** `null` = a figure-only signal with nothing to judge. */
export type StockHealthVerdict = (typeof STOCK_HEALTH_VERDICTS)[number]

export interface StockHealthFigure {
  /** English; the Arabic label is keyed by the signal's key + this label. */
  label: string
  value: string | number | null
}

export interface StockHealthSignal {
  key: string
  verdict: string | null
  /** One plain English line. */
  reason: string
  figures: StockHealthFigure[]
  /** When this signal's source was read; null on `noAnswer`. */
  readAt: string | null
  /** An existing oms-react route (`oms/store-stages`), or null. */
  link: string | null
}

export interface StockHealth {
  readAt: string
  signals: StockHealthSignal[]
}
