/**
 * The identity breaks' words (BackOffice spec 2579, ticket 465), pinned by
 * `identity-break-helpers.test.ts`.
 *
 * An identity break is evidence that does not add up to one transaction: two `RetailTrx` rows under
 * one store + number (`duplicateKey`), or a legacy log detail, a skip row, an IDoc entry or an IDoc
 * document with no `RetailTrx` behind it (the `orphan…` kinds, spec story 30). Each kind is shown
 * with its plain-English meaning; the door finds them, nothing here does.
 */
import { IDENTITY_BREAK_KINDS, type IdentityBreakKind } from '@/core/models/sap-export'

/** The door pages; the console asks for 50 a page (the contract's default). */
export const IDENTITY_BREAK_PAGE_SIZE = 50

const KNOWN: ReadonlySet<string> = new Set(IDENTITY_BREAK_KINDS)

/**
 * A kind's name and meaning keys (`identityBreaks.kinds.<kind>.name` / `.meaning`), or `null` for a
 * kind this bundle does not know — the raw kind then shows, never a crash.
 */
export function identityBreakKey(kind: string): { name: string; meaning: string } | null {
  if (!KNOWN.has(kind)) return null
  const base = `identityBreaks.kinds.${kind as IdentityBreakKind}`
  return { name: `${base}.name`, meaning: `${base}.meaning` }
}

const REFUSALS = ['BAD_PAGING'] as const

/** An identity-break refusal's own sentence key, or `null` to show the envelope's message. */
export function identityBreakErrorKey(code: string | null | undefined): string | null {
  return code && (REFUSALS as readonly string[]).includes(code) ? `identityBreaks.errors.${code}` : null
}

/** The `GET SapExport/IdentityBreaks` parameters: `code` is required. */
export function identityBreakParams(code: string, page: number): Record<string, unknown> {
  return { code, page: Math.max(1, page), pageSize: IDENTITY_BREAK_PAGE_SIZE }
}
