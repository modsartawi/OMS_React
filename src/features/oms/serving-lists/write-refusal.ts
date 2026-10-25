/**
 * What a serving-list write's failure reads as in its dialog (oms ticket 570, BackOffice spec 3042). The door's
 * message is ONE `"English / Arabic"` string; the screen shows its own words by code and keeps that text as the
 * fallback. Pure: no React, no `t` — the dialog turns `labelKey` into words.
 */
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { SERVING_LIST_ERRORS as E } from '@/core/models/serving-list'

const REFUSAL_LABEL: Record<string, string> = {
  [E.UnknownList]: 'writes.refusal.unknownList',
  [E.NotMember]: 'writes.refusal.notMember',
  [E.NameRequired]: 'writes.refusal.nameRequired',
  [E.NameTooLong]: 'writes.refusal.nameTooLong',
  [E.AlreadyInState]: 'writes.refusal.alreadyInState',
}

/** The refusals that mean the screen is behind the server: the dialog refetches Lists / Members / Changes. */
const STALE = new Set<string>([E.UnknownList, E.NotMember, E.AlreadyInState])

export type WriteRefusal =
  /** A bare 403: the Execute grant is not held (the probe said otherwise, or it was revoked since). */
  | { kind: 'notGranted' }
  /** An envelope refusal: its code and server text, this side's words for a known code, and whether to refetch. */
  | { kind: 'refused'; code: string; labelKey: string | null; message: string; stale: boolean }
  /** Anything without a code: the taxonomy's network / server line, or a crash (`''` — the dialog words it). */
  | { kind: 'failed'; message: string }

export function writeRefusal(err: unknown): WriteRefusal {
  if (isBareDenial(err)) return { kind: 'notGranted' }
  const message = apiErrorMessage(err, '')
  const code = apiErrorCode(err)
  if (code) return { kind: 'refused', code, labelKey: REFUSAL_LABEL[code] ?? null, message, stale: STALE.has(code) }
  return { kind: 'failed', message }
}

/** The label keys the map can produce — for the i18n test. */
export const WRITE_REFUSAL_KEYS: readonly string[] = Object.values(REFUSAL_LABEL)
