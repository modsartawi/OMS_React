import {
  HUNGERSTATION_ERRORS,
  HUNGERSTATION_LINES_TAKE,
  HUNGERSTATION_LOGS_TAKE,
  HUNGERSTATION_MATERIAL_HISTORY_CAP,
  HUNGERSTATION_SYNC_HISTORY_DAYS,
  type HungerStationPushStatus,
  type HungerStationSyncLine,
  type HungerStationSyncLinesQuery,
  type LocalDateTime,
} from '@/core/models/hungerstation'
import { skipForPage } from '@/core/ui/pager'
import { formatMoney3 } from '@/core/util/number-format'
import { syncPath } from './sync'

// A HungerStation store's pushes, a push's lines and a material's history (ticket 554; contract
// § Stock sync, `GET …/Sync/{storeCode}/Logs`, `…/Logs/{logId}/Lines` and `…/Lines?material=`): the
// doors' paths and queries, how a line and a push read, and the notices that stand in for an empty
// table. Pure: no React, no `t`, no `@/core/api`.

/** `GET …/Sync/{storeCode}/Logs?take=` — the store's pushes, newest first, 15 days back. */
export const logsPath = (storeCode: string) => `${syncPath(storeCode)}/Logs`

/** `GET …/Sync/{storeCode}/Logs/{logId}/Lines?material=&skip=&take=` — one push's lines. */
export const syncLinesPath = (storeCode: string, logId: string) => `${logsPath(storeCode)}/${encodeURIComponent(logId)}/Lines`

/** `GET …/Sync/{storeCode}/Lines?material=` — one material's history at the store. */
export const materialLinesPath = (storeCode: string) => `${syncPath(storeCode)}/Lines`

/**
 * The drawer asks the Logs door for its most, 500: the 15 days a store keeps can hold more pushes
 * than the door's default 50 (a delta every half hour is ~720), and the drawer should reach as far
 * back as the door lets it.
 */
export const LOGS_TAKE = HUNGERSTATION_LOGS_TAKE.max

/** The drawer reads the Lines door's default page. */
export const LINES_TAKE = HUNGERSTATION_LINES_TAKE.default

/** The number a cell or sentence shows, grouped as figures are drawn across the app. */
export const figure = (n: number) => n.toLocaleString('en-US')

/** The push-lines filter: a material number (exact match) and a 1-based page. */
export interface LinesFilter {
  material: string
  page: number
}

export function linesQuery(filter: LinesFilter): HungerStationSyncLinesQuery {
  return { material: filter.material.trim() || null, skip: skipForPage(filter.page, LINES_TAKE), take: LINES_TAKE }
}

export interface LineReading {
  /** `null` when the push did not send it. */
  active: 'active' | 'inactive' | null
  quantity: string | null
  maximumSalesQuantity: string | null
  /** The price at 3 decimals with its currency, one machine value — `null` when not sent. */
  price: string | null
}

/**
 * How a line reads: each value the push sent, formatted; each `null` (not sent by that push) stays
 * `null` and renders blank — never a zero. A zero that WAS sent stays zero.
 */
export function readLine(line: Pick<HungerStationSyncLine, 'active' | 'quantity' | 'maximumSalesQuantity' | 'price' | 'currencyKey'>): LineReading {
  return {
    active: line.active == null ? null : line.active ? 'active' : 'inactive',
    quantity: line.quantity == null ? null : figure(line.quantity),
    maximumSalesQuantity: line.maximumSalesQuantity == null ? null : figure(line.maximumSalesQuantity),
    price: line.price == null ? null : `${formatMoney3(line.price)} ${line.currencyKey}`.trim(),
  }
}

/**
 * How a push reads. A push with no end yet is still running — never a failure. Otherwise `S` is
 * success and anything else failed: a status the contract does not name is never shown as success.
 * A material-history line carries no end time, so it reads by its status.
 */
export function pushReading(push: { status: HungerStationPushStatus; endTime?: LocalDateTime | null }): 'success' | 'failed' | 'running' {
  if (push.endTime === null) return 'running'
  return push.status === 'S' ? 'success' : 'failed'
}

/** The words that stand in for an empty lines table: a filtered read matched none, or the push sent none. */
export function linesNotice(p: { total: number; filtered: boolean }): 'noMatch' | 'noneSent' | null {
  if (p.total > 0) return null
  return p.filtered ? 'noMatch' : 'noneSent'
}

/**
 * The refusals the drawers read in their own words: DHS-00015 — the push is gone, or older than
 * the 15 days kept (never an empty table that reads as "nothing was sent"); DHS-00007 — the code
 * has no store and no logs (a removed store with logs is still answered).
 */
export function historyRefusal(code: string | null): 'expired' | 'unknownStore' | null {
  if (code === HUNGERSTATION_ERRORS.noSuchPush) return 'expired'
  if (code === HUNGERSTATION_ERRORS.notOnboarded) return 'unknownStore'
  return null
}

const DAYS = String(HUNGERSTATION_SYNC_HISTORY_DAYS)

/** The 15-day wording: push detail is kept this many days. */
export function expiredNotice(): { key: 'lines.expired'; days: string } {
  return { key: 'lines.expired', days: DAYS }
}

/** The material history's cap notice, when the door answered its most lines (older ones exist). */
export function cappedNotice(lines: readonly unknown[]): { key: 'material.capped'; max: string; days: string } | null {
  return lines.length >= HUNGERSTATION_MATERIAL_HISTORY_CAP
    ? { key: 'material.capped', max: figure(HUNGERSTATION_MATERIAL_HISTORY_CAP), days: DAYS }
    : null
}

/** A drawer the page holds open: a store's logs, or its material history. */
export interface SheetTarget {
  kind: 'logs' | 'material'
  storeCode: string
}

const SHEET_PARAM = { logs: 'logs', material: 'history' } as const

/**
 * The drawer the URL asks for: `?logs=<store>` or `?history=<store>`. A store code is enough — the
 * store need not be on the list (a removed store's history stays readable from wherever its code
 * is known, e.g. a link from the orders monitor). A blank code opens nothing.
 */
export function sheetFromParams(params: URLSearchParams): SheetTarget | null {
  for (const kind of ['logs', 'material'] as const) {
    const code = params.get(SHEET_PARAM[kind])?.trim()
    if (code) return { kind, storeCode: code }
  }
  return null
}

/** The URL with one drawer written (or, for `null`, none) — every other param kept. */
export function withSheet(params: URLSearchParams, sheet: SheetTarget | null): URLSearchParams {
  const out = new URLSearchParams(params)
  out.delete(SHEET_PARAM.logs)
  out.delete(SHEET_PARAM.material)
  if (sheet) out.set(SHEET_PARAM[sheet.kind], sheet.storeCode)
  return out
}
