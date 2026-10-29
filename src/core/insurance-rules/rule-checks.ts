/**
 * The editor's own checks (ticket 659, from the owner's walk 2026-10-29), drawn as the author types, before HQ's
 * Validate: a code in the wrong box, and a rule name another rule of the draft already has. HQ's reader takes any text
 * as a code and any name, so these are the client's; a misplaced code holds the save, a repeated name only warns.
 */
import type { GuardRule } from './model'

type GuardCodes = { conflict?: string | null; nphies?: string | null }

/** NPHIES `adjudication-reason` codes: the current `CV-4-8` shape and the earlier `N-DC-067`. */
const NPHIES = /^([A-Z]{2}-\d{1,2}-\d{1,2}|N-DC-\d{3})$/i
/** A DUR conflict code (NCPDP 439-E4 and the reject codes in use): two letters or digits, `ER`, `TD`, `83`. */
const CONFLICT = /^[A-Z0-9]{2}$/i

export type CodeProblem =
  /** A NPHIES code typed in the conflict box: it holds the save (the payer would never see it). */
  | 'nphiesInConflict'
  /** A conflict code typed in the NPHIES box: it holds the save. */
  | 'conflictInNphies'
  /** Neither shape: a warning, since a payer may use a code this list does not know. */
  | 'conflictShape'
  | 'nphiesShape'

export interface CodeCheck {
  field: 'conflict' | 'nphies'
  problem: CodeProblem
  /** True for a problem that holds the save. */
  blocks: boolean
}

export function checkCodes(codes: GuardCodes | null | undefined): CodeCheck[] {
  const out: CodeCheck[] = []
  const conflict = (codes?.conflict ?? '').trim()
  const nphies = (codes?.nphies ?? '').trim()
  if (conflict) {
    if (NPHIES.test(conflict)) out.push({ field: 'conflict', problem: 'nphiesInConflict', blocks: true })
    else if (!CONFLICT.test(conflict)) out.push({ field: 'conflict', problem: 'conflictShape', blocks: false })
  }
  if (nphies) {
    if (CONFLICT.test(nphies)) out.push({ field: 'nphies', problem: 'conflictInNphies', blocks: true })
    else if (!NPHIES.test(nphies)) out.push({ field: 'nphies', problem: 'nphiesShape', blocks: false })
  }
  return out
}

/** Whether any effect of the rule has a code that holds the save. */
export const codesHoldSave = (rule: Pick<GuardRule, 'then'>): boolean => rule.then.some((e) => checkCodes(e.codes).some((c) => c.blocks))

const sameName = (a: string, b: string): boolean => a.trim() !== '' && a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

/** The other rules of the draft whose English or Arabic name is this rule's (trimmed, any case), per language. */
export function sameNamedRules(rule: Pick<GuardRule, 'id' | 'name'>, rules: readonly Pick<GuardRule, 'id' | 'name'>[]): { en: string[]; ar: string[] } {
  const others = rules.filter((r) => r.id !== rule.id)
  return {
    en: others.filter((r) => sameName(r.name.en, rule.name.en)).map((r) => r.id),
    ar: others.filter((r) => sameName(r.name.ar, rule.name.ar)).map((r) => r.id),
  }
}
