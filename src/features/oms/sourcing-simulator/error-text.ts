/**
 * The screen's own words for the advise door's errors (ticket 962, BackOffice spec 4354 §11; 4281 decision 51). The
 * door's messages are English for developers and nobody is shown one: each code has a title and a sentence of ours in
 * the `sourcing-simulator` namespace, in English and Arabic. Pure.
 *
 * "Try again" is offered where the same cart may well plan on a second press: the reads ran late or failed, the door is
 * busy, or the search itself failed. A refusal of the request (a bad field, no grant, an unserved channel, too many
 * lines) would only be refused again.
 */
import { ADVISE_ERROR_CODES, type AdviseErrorCode } from '@/core/models/sourcing-run'

export interface ErrorText {
  /** The code as the door sent it, shown beside the text; null when none came. */
  code: string | null
  titleKey: string
  bodyKey: string
  retry: boolean
}

const RETRY: ReadonlySet<AdviseErrorCode> = new Set(['ADVISE-429', 'ADVISE-500', 'ADVISE-503', 'ADVISE-504', 'ADVISE-511', 'ADVISE-512', 'ADVISE-513'])

const isDoorCode = (code: string): code is AdviseErrorCode => (ADVISE_ERROR_CODES as readonly string[]).includes(code)

/** `bareDenial`: a 403 with no code, the grant filter's refusal (`isBareDenial` in `@/core/api`). */
export function errorText(code: string | null, bareDenial: boolean): ErrorText {
  if (code && isDoorCode(code)) return { code, titleKey: `errors.${code}.title`, bodyKey: `errors.${code}.body`, retry: RETRY.has(code) }
  if (!code && bareDenial) return { code: null, titleKey: 'errors.denied.title', bodyKey: 'errors.denied.body', retry: false }
  return { code: code || null, titleKey: 'errors.unknown.title', bodyKey: 'errors.unknown.body', retry: true }
}
