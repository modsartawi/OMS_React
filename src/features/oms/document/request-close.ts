/**
 * Request cancellation's reason (BackOffice spec 3461, door 3462; oms-react 855). The reasons are one list
 * the business maintains on the server (`SdDocumentReason` group `CNCL`); the dialog reads the active ones
 * in the server's order and the request records the picked one by code.
 *
 * - **Shown in the user's language**: `nameAr` under Arabic, `nameEn` otherwise; a missing name falls back
 *   to the other one.
 * - **Posted as code + English name**: `reasonCode` is the record, `note` is the English name whatever
 *   language was shown — carriers and partners read the note, and the server never rewrites it. A reason
 *   with no English name posts its Arabic one, and one with neither its code: the note is never blank.
 * - **Never sent without a reason**: commit needs THIS open's read finished, a non-empty list, and a pick
 *   it holds. While a re-read runs the last open's list is not shown at all (it may hold a retired reason).
 *
 * Pure, and `t` stays with the caller: this module answers in `document` namespace KEYS.
 */

import type { CancellationReasonModel } from '@/core/models/sd-document'
import { localizedName } from '@/core/util/localized-name'
import type { UpdateHeaderExtras } from './actions'

/**
 * The reasons read's query key. Exported so the page can invalidate it when the server refuses a reason
 * as retired (`SDD-02235`).
 */
export const CANCELLATION_REASONS_KEY = ['oms', 'cancellation-reasons'] as const

/** A reason's name in the UI language, trimmed. */
export function cancellationReasonName(reason: CancellationReasonModel, lang: string): string {
  return localizedName(reason, lang).trim()
}

/**
 * The request's note and extras for a picked reason: the code, and the ENGLISH name as the note — else the
 * Arabic name, else the code, so the note is never blank.
 */
export function requestCloseUpdate(reason: CancellationReasonModel): { note: string; extras: UpdateHeaderExtras } {
  const note = localizedName(reason, 'en').trim() || reason.code
  return { note, extras: { reasonCode: reason.code } }
}

/** The reasons read as the dialog holds it (TanStack Query's `status`, `isFetching` and `data`). */
export interface RequestCloseInput {
  status: 'pending' | 'error' | 'success'
  /** A read is running — on a reopen, the cached list or failure is the LAST open's, not this one's. */
  fetching: boolean
  reasons: readonly CancellationReasonModel[] | undefined
  pickedCode: string
}

/**
 * What the dialog shows: `loading` until THIS open's read has finished (a cached list or failure from the
 * last open is never shown while the re-read runs), `failed` for a failed read, `empty` for a read that
 * found no active reason, `ready` with the list otherwise.
 */
export type RequestCloseView = 'loading' | 'failed' | 'empty' | 'ready'

/**
 * The dialog's view, whether it can commit, and the reason it would send. Only a `ready` list commits,
 * and a pick it does not hold is no pick.
 */
export function requestCloseCommit({ status, fetching, reasons, pickedCode }: RequestCloseInput): {
  view: RequestCloseView
  canCommit: boolean
  picked: CancellationReasonModel | null
} {
  const view: RequestCloseView =
    fetching || status === 'pending'
      ? 'loading'
      : status === 'error'
        ? 'failed'
        : (reasons ?? []).length === 0
          ? 'empty'
          : 'ready'
  const picked = view === 'ready' && pickedCode ? ((reasons ?? []).find((r) => r.code === pickedCode) ?? null) : null
  return { view, canCommit: picked !== null, picked }
}

/**
 * The request door's reason refusal (3462) → its `document` namespace key. The server words `SDD-02235` in
 * English only, so this client words it by code (Mark returned back's precedent). `null` for any other code:
 * show the server's sentence.
 */
const REQUEST_CLOSE_REFUSALS: Readonly<Record<string, string>> = {
  'SDD-02235': 'requestClose.refused.unknownReason',
}

export function requestCloseRefusalKeyOf(code: string | null | undefined): string | null {
  return (code && REQUEST_CLOSE_REFUSALS[code]) || null
}
