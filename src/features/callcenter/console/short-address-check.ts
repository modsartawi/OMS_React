/**
 * The address form's **Check** of a typed Short Address (579, the web seat's half of
 * BackOffice 3078; route BackOffice 3074, spec 3072 "Check a typed Short Address").
 *
 * Pure: the route's answer (or its failure) in, the one inline state out. The form draws what
 * this says and nothing else.
 *
 * 🚩 **Read only, and never a gate.** Nothing from SPL's answer is written anywhere, and no
 * state here feeds `addressFormIsSendable`: an UNKNOWN or an outage never stops a save.
 *
 * 🚩 **An outage is never "unknown".** Only the server's own `UNKNOWN` reads *Not known to
 * SPL*; `UNAVAILABLE`, a fault of the call (server, network, unknown), an outcome outside the
 * three, or a `FOUND` with no non-blank part all read *SPL is unavailable, not checked* — the
 * spec's whole point is that a warning always means a real disagreement.
 *
 * 🚩 **A refusal is not an outage** (`api-envelope`). A business refusal other than
 * `CCL-00014` (and an `auth` one, whose 401 `handle401` has already taken) carries the
 * server's own message and code to the form; `CCL-00014` is the field's own error.
 */
import { apiErrorCode, apiErrorKind, apiErrorMessage } from '@/core/api'
import {
  NATIONAL_ADDRESS_CCL,
  type SessionCapabilities,
  type ShortAddressCheck,
  type ShortAddressParts,
} from '@/core/models/callcenter'
import type { SdDistrictModel } from '@/core/models/lookups'
import { formatParts } from '@/core/util/bidi'
import { SHORT_ADDRESS_PATTERN } from './address-capture'

/** Hidden, never disabled, while the session says SPL is not configured (absent ⇒ hidden). */
export function showsCheck(capabilities: Pick<SessionCapabilities, 'canCheckShortAddress'>): boolean {
  return capabilities.canCheckShortAddress === true
}

/** `?language=` in the console's own language: `A` under Arabic, `E` otherwise. */
export function checkLanguage(language: string): 'A' | 'E' {
  return language.toLowerCase().startsWith('ar') ? 'A' : 'E'
}

/** The code as the wire carries it — the form's own normalisation (trim, upper-case). */
export function checkCode(code: string): string {
  return code.trim().toUpperCase()
}

/** A blank box or one the offline format check already refuses spends no call: the field
 *  already says what is wrong with it. */
export function isCheckable(code: string): boolean {
  return SHORT_ADDRESS_PATTERN.test(checkCode(code))
}

export type CheckResult =
  | { outcome: 'found'; parts: ShortAddressParts }
  | { outcome: 'unknown' }
  | { outcome: 'unavailable' }
  | { outcome: 'malformed' }
  /** The server's words (`null` when it gave none — the form falls back to its own) and code. */
  | { outcome: 'refused'; message: string | null; code: string | null }

/** What a call is asked for: the answer belongs to this pair and to nothing else. */
export interface CheckKey {
  code: string
  language: 'A' | 'E'
}

const FAULTS = new Set(['server', 'network', 'unknown'])

const hasAnyPart = (parts: ShortAddressParts) =>
  Object.values(parts).some((part) => typeof part === 'string' && part.trim() !== '')

/** One call's answer, or its failure, read. Exactly one of the two is non-null in use. */
export function checkResult(answer: ShortAddressCheck | null, error: unknown): CheckResult {
  if (error !== null && error !== undefined) {
    const code = apiErrorCode(error)
    if (code === NATIONAL_ADDRESS_CCL.shortAddressMalformed) return { outcome: 'malformed' }
    const kind = apiErrorKind(error)
    // Not an ApiError at all, or a fault of the call: SPL was not asked, so nothing is known.
    if (kind === null || FAULTS.has(kind)) return { outcome: 'unavailable' }
    return { outcome: 'refused', message: apiErrorMessage(error, '').trim() || null, code }
  }
  if (answer?.outcome === 'FOUND' && answer.parts && hasAnyPart(answer.parts))
    return { outcome: 'found', parts: answer.parts }
  if (answer?.outcome === 'UNKNOWN') return { outcome: 'unknown' }
  return { outcome: 'unavailable' }
}

const sameKey = (a: CheckKey | null, b: CheckKey) => a !== null && a.code === b.code && a.language === b.language

/**
 * Whether **Check** can be pressed now. Not on a blank or already-malformed box, and not while
 * the call for this very code (in this language) is in flight. A call for an *older* code does
 * not hold it: the agent edited the box, and that older answer is dropped by its key.
 */
export function checkPressable(input: { code: string; language: 'A' | 'E'; pending: CheckKey | null }): boolean {
  return isCheckable(input.code) && !sameKey(input.pending, { code: checkCode(input.code), language: input.language })
}

export interface CheckViewInput {
  /** What the box holds now. */
  code: string
  /** The language a press would ask in now. */
  language: 'A' | 'E'
  /** The last answered check, keyed by the code and language it was asked for. */
  checked: (CheckKey & { result: CheckResult }) | null
  /** The key of the call in flight, if any. */
  pending: CheckKey | null
  /** The form's city as the form shows it — the warning's second name. */
  formCity: string
  /** Every name the form's city goes by (English and Arabic, from the district list), so an
   *  Arabic answer is not a mismatch against an English master-data name. */
  formCityNames: string[]
}

export type CheckView =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | {
      kind: 'found'
      line: string
      /** The line opens with the building number, a machine value: isolate it whole with `Ltr`
       *  (bidi, "a pair led by a machine value"); otherwise it is free text, a `<bdi>`. */
      ledByNumber: boolean
      additionalNumber: string | null
      cityWarning: { spl: string; form: string } | null
    }
  | { kind: 'unknown' }
  | { kind: 'unavailable' }
  | { kind: 'malformed' }
  | { kind: 'refused'; message: string | null; code: string | null }

const text = (value: string | null | undefined) => (value ?? '').trim()
/** Spec 3072's comparison: by name, trimmed, case-insensitive. */
const sameName = (a: string, b: string) => text(a).toLowerCase() === text(b).toLowerCase()

/**
 * The inline state for the box as it stands. An answer about another code says nothing — the
 * agent edited the box after checking, so it no longer answers what is there.
 */
export function checkView(input: CheckViewInput): CheckView {
  const key: CheckKey = { code: checkCode(input.code), language: input.language }
  if (sameKey(input.pending, key)) return { kind: 'checking' }
  const checked = input.checked
  if (checked === null || !sameKey(checked, key)) return { kind: 'idle' }
  const result = checked.result
  if (result.outcome === 'refused') return { kind: 'refused', message: result.message, code: result.code }
  if (result.outcome !== 'found') return { kind: result.outcome }

  const { parts } = result
  // The parts in reading order, one line, blanks dropped; the separator is the pair's ` · `.
  const line = formatParts([parts.buildingNumber, parts.street, parts.district, parts.city, parts.postCode])
  const splCity = text(parts.city)
  const names = input.formCityNames.map(text).filter((name) => name !== '')
  const cityWarning =
    splCity !== '' && names.length > 0 && !names.some((name) => sameName(name, splCity))
      ? { spl: splCity, form: text(input.formCity) || names[0] }
      : null
  return {
    kind: 'found',
    line,
    ledByNumber: text(parts.buildingNumber) !== '',
    additionalNumber: text(parts.additionalNumber) || null,
    cityWarning,
  }
}

/**
 * Every name the form's city goes by: the form's own `cityName` (the district list's English
 * name, or its Arabic one) plus both names the district list carries for its `cityCode`.
 * SPL answers in the console's language, so an Arabic answer is compared with the Arabic name.
 */
export function cityNamesOf(
  districts: readonly Pick<SdDistrictModel, 'cityCode' | 'cityNameEn' | 'cityNameAr'>[] | undefined,
  cityCode: string,
  cityName: string,
): string[] {
  const names = [cityName]
  if (cityCode !== '')
    for (const row of districts ?? [])
      if (row.cityCode === cityCode) names.push(row.cityNameEn, row.cityNameAr)
  return [...new Set(names.map(text).filter((name) => name !== ''))]
}
