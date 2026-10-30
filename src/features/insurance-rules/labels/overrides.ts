/**
 * Curated labels and the curation worklist, pure (BackOffice spec 3271 L12, L13, door 3297; oms ticket 707). A member
 * writes an Arabic or corrected English label for a code, someone who is not its author approves it, and it becomes a
 * new label version. Nothing here ever suggests the words: a label is a person's, never a machine translation.
 *
 * 🚩 Every shape is a guess until 711 reconciles it with the door as built.
 */
import { authorshipOf } from '@/core/insurance-rules/approval'
import type { LabelText } from './labels'

/** Why a code is on the worklist. A reason this list does not know is shown as sent. */
export const WORKLIST_REASONS = ['lacksArabic', 'unlabelled'] as const

/** A row of `GET InsuranceRules/Labels/Worklist`, ranked by the door and shown in the order it was sent. */
export interface WorklistRow {
  system: string
  code: string
  reason: string
  /** Times the census saw the code. */
  frequency: number
  /** The label the code has today, if any. */
  current?: LabelText | null
}

export type OverrideState = 'proposed' | 'approved'

/** A row of `GET InsuranceRules/Labels/Overrides`, and the reply of a propose or an approve. */
export interface LabelOverride {
  id: string
  system: string
  code: string
  en: string | null
  ar: string | null
  state: OverrideState
  /** The label the code has today, for the approver to compare. */
  current?: LabelText | null
  proposedBy: string | null
  /** Local moment. */
  proposedAt: string | null
  approvedBy: string | null
  /** Local moment. */
  approvedAt: string | null
}

export interface OverrideForm {
  system: string
  code: string
  en: string
  ar: string
}

export interface OverrideBody {
  system: string
  code: string
  en: string | null
  ar: string | null
}

export const OVERRIDE_PROBLEMS = ['systemMissing', 'codeMissing', 'labelMissing'] as const
export type OverrideProblem = (typeof OVERRIDE_PROBLEMS)[number]

export function overrideProblems(form: OverrideForm): OverrideProblem[] {
  const out: OverrideProblem[] = []
  if (!form.system.trim()) out.push('systemMissing')
  if (!form.code.trim()) out.push('codeMissing')
  if (!form.en.trim() && !form.ar.trim()) out.push('labelMissing')
  return out
}

/** A language left empty is null: the override leaves that language's label as it is. */
export function overrideBody(form: OverrideForm): OverrideBody {
  return { system: form.system.trim(), code: form.code.trim(), en: form.en.trim() || null, ar: form.ar.trim() || null }
}

/** What this user is offered on a proposal. The client only hides the action: HQ still decides. */
export type ApproveStanding = 'may' | 'ownProposal' | 'none'

export function approveStanding(override: Pick<LabelOverride, 'state' | 'proposedBy'>, userId: string | null): ApproveStanding {
  if (override.state !== 'proposed') return 'none'
  return authorshipOf(userId, override.proposedBy) === 'other' ? 'may' : 'ownProposal'
}

/** The proposal waiting on this code, if one is. A code is named by its system and its code together. */
export function pendingFor(overrides: readonly LabelOverride[], system: string, code: string): LabelOverride | undefined {
  return overrides.find((o) => o.state === 'proposed' && o.system === system && o.code === code)
}
