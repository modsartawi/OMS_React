import { HYBRIS_STOCK_ERRORS as E, type HybrisStockPushRow } from '@/core/models/hybris-stock'
import { formatFigure as figure } from '@/core/util/number-format'

// Push now from the stores page (spec 3447 stories 34–38; ticket 850): a store's full now, or chosen
// materials across chosen stores. Pure: no React, no `t` — answers keys in `hybris-stock-stores`.

/**
 * The refusals push now reads in its own words (`pushNow.refusal.<kind>` + `…Hint`), each beside the
 * server's sentence and code:
 * - `busy` — 409 `HybrisStockPushBusy`: a push of this store is already running. **Not an error**:
 *   nothing was pushed or recorded; try again shortly;
 * - `notMarked` — HYS-00009: the store is not (or no longer) a Hybris stock store;
 * - `railOff` — HYS-00010: the rail is switched off, so nothing can be pushed;
 * - `sinkFailed` — 502 HYS-00011: the file could not be written; the push IS recorded as failed (it
 *   shows in the push log);
 * - `unknownMaterial` — HYS-00004 (materials push only): a chosen material is not on the list.
 */
export const PUSH_NOW_REFUSALS = ['busy', 'notMarked', 'railOff', 'sinkFailed', 'unknownMaterial'] as const
export type PushNowRefusal = (typeof PUSH_NOW_REFUSALS)[number]

const BY_CODE: Record<string, PushNowRefusal> = {
  [E.pushBusy]: 'busy',
  [E.storeNotMarked]: 'notMarked',
  [E.railOff]: 'railOff',
  [E.sinkFailed]: 'sinkFailed',
  [E.unknownMaterial]: 'unknownMaterial',
}

export function pushNowRefusal(code: string | null): PushNowRefusal | null {
  return (code !== null && BY_CODE[code]) || null
}

/** The codes push now shows in its own words — so the dialog does not show them twice. */
export const PUSH_NOW_CODES = Object.keys(BY_CODE)

/** Busy is a wait, not a failure: it is drawn neutral, and a send that met it recorded nothing. */
export const isErrorState = (kind: PushNowRefusal | null): boolean => kind !== null && kind !== 'busy'

/** A refusal after which the store list holds something new (the push was recorded, or the store changed). */
export const refreshesList = (kind: PushNowRefusal | null): boolean => kind === 'notMarked' || kind === 'sinkFailed'

/** The line a finished push reads: rows sent and its status (`pushNow.result.<status>`). */
export function pushResult(push: Pick<HybrisStockPushRow, 'rows' | 'status'>): { key: string; rows: string; ok: boolean } {
  const status = push.status === 'S' || push.status === 'E' || push.status === 'R' ? push.status : 'other'
  return { key: `pushNow.result.${status}`, rows: figure(push.rows), ok: push.status !== 'E' }
}

/** Material numbers as pasted: split on space, comma, semicolon or line break; repeats collapsed, order kept. */
export function parseMaterials(text: string): { numbers: string[]; invalid: string[] } {
  const numbers: string[] = []
  const invalid: string[] = []
  for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
    if (!/^\d{1,18}$/.test(token)) invalid.includes(token) || invalid.push(token)
    else if (!numbers.includes(token)) numbers.push(token)
  }
  return { numbers, invalid }
}
