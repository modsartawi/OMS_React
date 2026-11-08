/**
 * Request cancellation's reason (BackOffice spec 3461, door 3462; oms-react 855). The reasons are one list
 * the business maintains on the server (`SdDocumentReason` group `CNCL`); the dialog reads the active ones
 * in the server's order and the request records the picked one by code.
 *
 * - **Shown in the user's language**: `nameAr` under Arabic, `nameEn` otherwise; a missing name falls back
 *   to the other one.
 * - **Posted as code + English name**: `reasonCode` is the record, `note` is the English name whatever
 *   language was shown — carriers and partners read the note, and the server never rewrites it.
 * - **Never sent without a reason**: commit needs the list loaded and a pick it holds.
 *
 * Pure, and `t` stays with the caller: this module answers in `document` namespace KEYS.
 */

import type { CancellationReasonModel } from '@/core/models/sd-document'
import type { UpdateHeaderExtras } from './actions'

/** A reason's name in the UI language. */
export function cancellationReasonName(reason: CancellationReasonModel, lang: string): string {
  const en = (reason.nameEn ?? '').trim()
  const ar = (reason.nameAr ?? '').trim()
  return (lang ?? '').startsWith('ar') ? ar || en : en || ar
}

/** The request's note and extras for a picked reason: the code, and the ENGLISH name as the note. */
export function requestCloseUpdate(reason: CancellationReasonModel): { note: string; extras: UpdateHeaderExtras } {
  return { note: reason.nameEn, extras: { reasonCode: reason.code } }
}

/** The reasons read as the dialog holds it (TanStack Query's `status` and `data`). */
export interface RequestCloseInput {
  status: 'pending' | 'error' | 'success'
  reasons: readonly CancellationReasonModel[] | undefined
  pickedCode: string
}

/**
 * Whether the dialog can commit, the reason it would send, and whether the list failed to load (the dialog
 * then says so inline). A pick the loaded list does not hold is no pick.
 */
export function requestCloseCommit({ status, reasons, pickedCode }: RequestCloseInput): {
  canCommit: boolean
  picked: CancellationReasonModel | null
  loadFailed: boolean
} {
  const picked =
    status === 'success' && pickedCode ? ((reasons ?? []).find((r) => r.code === pickedCode) ?? null) : null
  return { canCommit: picked !== null, picked, loadFailed: status === 'error' }
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
