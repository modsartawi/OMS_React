/**
 * A loyalty-group door's refusal, in the active locale (oms ticket 630, BackOffice spec 3173). The brief:
 * "every refusal carries `messageEn` + `messageAr` and a stable Loy error code". In `@/core/` because every
 * group door refuses the same way (create, rename, members, bulk), and a feature may never import another.
 *
 * ⚠️ GUESS until BackOffice 3174 ships: the two sentences are read from the refusal envelope's `data`
 * (`{ messageEn, messageAr }`) and the code from `errors[0].errorCode`. Read defensively — a refusal
 * without them falls back to the envelope's `message` (`apiErrorMessage`), so a different spelling
 * still shows the server's own sentence rather than nothing.
 */
import { apiErrorCode, apiErrorData, apiErrorMessage } from '@/core/api'

export interface LoyGroupRefusal {
  code: string | null
  message: string
}

const text = (v: unknown): string => (typeof v === 'string' && v.trim() !== '' ? v : '')

export function loyGroupRefusal(err: unknown, lang: string, fallback: string): LoyGroupRefusal {
  const data = apiErrorData(err)
  const said = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
  const [first, other] = lang.startsWith('ar') ? [said.messageAr, said.messageEn] : [said.messageEn, said.messageAr]
  const message = text(first) || text(other) || apiErrorMessage(err, fallback)
  return { code: apiErrorCode(err), message }
}
