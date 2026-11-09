import { HYBRIS_STOCK_ERRORS as E, MATERIAL_NUMBER, PUSH_LIMITS, type HybrisStockPushNowResult } from '@/core/models/hybris-stock'
import { pastedCodes } from '@/core/util/code-list'
import { formatFigure as figure } from '@/core/util/number-format'

// Push now from the stores page (spec 3447 stories 34–38; ticket 850): a store's full now, or chosen
// materials across chosen stores. Pure: no React, no `t` — answers keys in `hybris-stock-stores`.

/**
 * The refusals push now reads in its own words (`pushNow.refusal.<kind>` + `…Hint`), each beside the
 * server's sentence and code (the contract's "Push now" refusals):
 * - `busy` — 409 HYS-00030: a chosen store is being pushed (the scheduler, another push now, a split
 *   push still sending its parts). **Not an error**: nothing was pushed or recorded; try again shortly;
 * - `notMarked` — 409 HYS-00031: a chosen store is not (or no longer) a marked Hybris stock store;
 * - `railOff` — 409 HYS-00034: the rail is switched off, nothing recorded;
 * - `materialNotEnabled` — 400 HYS-00032 (materials push): a chosen material is not an ENABLED
 *   Hybris stock material — the whole push is refused, the server's message names up to ten;
 * - `selection` — 400 HYS-00033 (materials push): no store / no material, or over 200 / 1,000.
 *
 * A failed upload is NOT a refusal: the door answers 200 with `status: "E"` (the push is in the log).
 */
export const PUSH_NOW_REFUSALS = ['busy', 'notMarked', 'railOff', 'materialNotEnabled', 'selection'] as const
export type PushNowRefusal = (typeof PUSH_NOW_REFUSALS)[number]

const BY_CODE: Record<string, PushNowRefusal> = {
  [E.pushBusy]: 'busy',
  [E.pushStoreNotMarked]: 'notMarked',
  [E.railOff]: 'railOff',
  [E.materialNotEnabled]: 'materialNotEnabled',
  [E.pushSelectionInvalid]: 'selection',
}

export function pushNowRefusal(code: string | null): PushNowRefusal | null {
  return (code !== null && BY_CODE[code]) || null
}

/** The codes push now shows in its own words — so the dialog does not show them twice. */
export const PUSH_NOW_CODES = Object.keys(BY_CODE)

/** Busy is a wait, not a failure: it is drawn neutral, and a send that met it recorded nothing. */
export const isErrorState = (kind: PushNowRefusal | null): boolean => kind !== null && kind !== 'busy'

/** A refusal after which the store list holds something new: a store was unmarked meanwhile. */
export const refreshesList = (kind: PushNowRefusal | null): boolean => kind === 'notMarked'

/** The line a push-now answer reads: rows sent and its status letter (`pushNow.result.<status>`). */
export function pushResult(push: Pick<HybrisStockPushNowResult, 'rowsSent' | 'status'>): { key: string; rows: string; ok: boolean; status: 'S' | 'E' | 'R' | 'other' } {
  const status = push.status === 'S' || push.status === 'E' || push.status === 'R' ? push.status : 'other'
  return { key: `pushNow.result.${status}`, rows: figure(push.rowsSent), ok: push.status !== 'E', status }
}

/** Material numbers as pasted, read by the core paste rule (`pastedCodes`: repeats collapsed, order kept),
 *  then split into the numbers the contract's shape allows and the ones it does not. */
export function parseMaterials(text: string): { numbers: string[]; invalid: string[] } {
  const codes = pastedCodes(text)
  return { numbers: codes.filter((c) => MATERIAL_NUMBER.test(c)), invalid: codes.filter((c) => !MATERIAL_NUMBER.test(c)) }
}

export type MaterialsPushBlock = 'noStore' | 'noMaterial' | 'invalid' | 'tooManyStores' | 'tooManyMaterials'

/** Why the materials push cannot be sent yet (`pushMaterials.block.<kind>`), or `null` — the door's
 *  HYS-00033 limits (200 stores, 1,000 materials) are checked before it is asked. */
export function materialsPushBlock(stores: number, parsed: { numbers: string[]; invalid: string[] }): MaterialsPushBlock | null {
  if (stores === 0) return 'noStore'
  if (parsed.invalid.length > 0) return 'invalid'
  if (parsed.numbers.length === 0) return 'noMaterial'
  if (stores > PUSH_LIMITS.stores) return 'tooManyStores'
  if (parsed.numbers.length > PUSH_LIMITS.materials) return 'tooManyMaterials'
  return null
}
