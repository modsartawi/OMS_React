/**
 * A payer's quirk named once (ticket 704; BackOffice spec 3271 D7, D11, door 3294): (payer, wrong URL → canonical URL).
 * HQ applies an approved alias when matching codings and UCUM units; the kept bundle itself is never rewritten. Pure.
 */
export type AliasState = 'proposed' | 'approved'
export const ALIAS_STATES: readonly AliasState[] = ['proposed', 'approved']

export interface AliasRow {
  id: string
  /** The insurer's SAP customer id, as `GET InsuranceRules/Insurers` names it. */
  payer: string
  wrongUrl: string
  canonicalUrl: string
  state: AliasState
  proposedBy: string | null
  /** Local moment. */
  proposedAt: string | null
  approvedBy: string | null
  /** Local moment. */
  approvedAt: string | null
}

export interface AliasForm {
  payer: string
  wrongUrl: string
  canonicalUrl: string
}

export type AliasProblem = 'payerMissing' | 'wrongMissing' | 'canonicalMissing' | 'sameUrl'
export const ALIAS_PROBLEMS: readonly AliasProblem[] = ['payerMissing', 'wrongMissing', 'canonicalMissing', 'sameUrl']

/** FHIR URLs are compared exactly, so a pair differing only in case is a real alias (a case slip is a quirk too). */
export function aliasProblems(form: AliasForm): AliasProblem[] {
  const wrong = form.wrongUrl.trim()
  const canonical = form.canonicalUrl.trim()
  const out: AliasProblem[] = []
  if (!form.payer.trim()) out.push('payerMissing')
  if (!wrong) out.push('wrongMissing')
  if (!canonical) out.push('canonicalMissing')
  if (wrong && wrong === canonical) out.push('sameUrl')
  return out
}

export function aliasBody(form: AliasForm): AliasForm {
  return { payer: form.payer.trim(), wrongUrl: form.wrongUrl.trim(), canonicalUrl: form.canonicalUrl.trim() }
}

/**
 * What this user is offered on a row. The client only hides the action: HQ still decides, and a reader without the
 * grant meets its bare 403 in words (no grant probe exists in this area, the approval.ts precedent).
 */
export type ApproveStanding = 'may' | 'ownProposal' | 'none'

export function approveStanding(alias: Pick<AliasRow, 'state' | 'proposedBy'>, userId: string | null): ApproveStanding {
  if (alias.state !== 'proposed') return 'none'
  if (!userId || !alias.proposedBy) return 'ownProposal'
  return userId.toLowerCase() === alias.proposedBy.toLowerCase() ? 'ownProposal' : 'may'
}
