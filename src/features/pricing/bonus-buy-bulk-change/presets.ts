/**
 * The bulk change's shared presets (BackOffice spec 4190 stories 35–39; oms 960). Pure.
 *
 * A preset holds operations (4193's shape), never bonus-buy numbers. Picking one starts the form from
 * them, and the form stays editable (story 39). Saving stores what the form names, through the same
 * `toOperations` the preview sends, so a preset never holds something Preview would not send.
 */
import type { BbyBulkOperations } from '@/core/models/bonus-buy-bulk'
import type { BbyRefusal } from '@/core/models/bonus-buy-maintenance'
import type { BbyBulkPreset, BbyBulkPresetOutcome, BbyBulkPresetSaveRequest } from '@/core/models/bonus-buy-bulk-preset'
import { EMPTY_FORM, fromOperations, hasOperations, toOperations, type BulkForm, type FormProblem } from './operations'

/** A preset's operations, whether the server hands them back as an object or as the column's JSON text. */
export function readPresetOperations(raw: BbyBulkPreset['operations']): BbyBulkOperations | null {
  if (raw == null) return null
  if (typeof raw !== 'string') return raw
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as BbyBulkOperations) : null
  } catch {
    return null
  }
}

/** The form a preset starts: unreadable operations start an all-Leave form. */
export function presetForm(preset: Pick<BbyBulkPreset, 'operations'>): BulkForm {
  const operations = readPresetOperations(preset.operations)
  return operations ? fromOperations(operations) : EMPTY_FORM
}

/** What saving the form as a preset stores (and the fields that cannot be stored as typed). */
export function presetOperations(form: BulkForm): { operations: BbyBulkOperations; problems: FormProblem[] } {
  return toOperations(form)
}

/**
 * Picking a preset: the form starts from it — wholly, so a field the preset leaves goes back to Leave —
 * and nothing else on the page moves (the promotion filter, the selection).
 */
export function pickPreset<S extends { form: BulkForm }>(state: S, preset: Pick<BbyBulkPreset, 'operations'>): S {
  return { ...state, form: presetForm(preset) }
}

/** The operations in one comparable spelling: the form's own field order, through the form. */
const canonical = (form: BulkForm) => JSON.stringify(toOperations(form).operations)

/** The preset the form still says exactly (its chip is lit), or null — an edited or empty form matches none. */
export function matchingPreset(presets: readonly BbyBulkPreset[], form: BulkForm): string | null {
  // A field with a problem is left out of the operations, so the rest could still match: it must not.
  if (toOperations(form).problems.length > 0) return null
  const mine = canonical(form)
  if (mine === '{}') return null
  return presets.find((p) => canonical(presetForm(p)) === mine)?.id ?? null
}

/** Why the form cannot be saved as a preset yet: no name, a field that cannot be sent, or nothing to hold. */
export type PresetSaveProblem = 'name' | 'form' | 'nothing'

/**
 * The Save request: `editing` null creates (Save as preset…); a preset edits it at the version it was
 * loaded at (rename, or store the current form in it). The name is trimmed; uniqueness is the server's.
 */
export function presetSaveRequest(
  form: BulkForm,
  name: string,
  editing: Pick<BbyBulkPreset, 'id' | 'version'> | null,
): { request: BbyBulkPresetSaveRequest } | { problem: PresetSaveProblem } {
  const trimmed = name.trim()
  if (!trimmed) return { problem: 'name' }
  const { operations, problems } = presetOperations(form)
  if (problems.length > 0) return { problem: 'form' }
  if (!hasOperations(operations)) return { problem: 'nothing' }
  return { request: { id: editing?.id ?? null, name: trimmed, operations, version: editing?.version ?? null } }
}

/**
 * The rename request: a new name and the preset's stored operations exactly as they are — never
 * re-derived through the form, which could reshape them or refuse them locally. Unreadable operations
 * cannot be sent back, so they are `nothing` to rename.
 */
export function presetRenameRequest(
  preset: Pick<BbyBulkPreset, 'id' | 'version' | 'operations'>,
  name: string,
): { request: BbyBulkPresetSaveRequest } | { problem: PresetSaveProblem } {
  const trimmed = name.trim()
  if (!trimmed) return { problem: 'name' }
  const operations = readPresetOperations(preset.operations)
  if (!operations || !hasOperations(operations)) return { problem: 'nothing' }
  return { request: { id: preset.id, name: trimmed, operations, version: preset.version } }
}

/**
 * A Save or Delete answer, read for the dialog. Refusals (a duplicate name, a stale edit) are shown as the
 * server words them, in English and Arabic — no code is matched here. A refusal with no words, a preset
 * someone else deleted, or a status this client does not know gets the screen's own line (`fallback`).
 */
export type PresetOutcomeReading =
  | { ok: true; preset: BbyBulkPreset | null }
  | { ok: false; refusals: BbyRefusal[]; fallback: 'refused' | 'notFound' | 'unknown' | null }

export function readPresetOutcome(outcome: BbyBulkPresetOutcome): PresetOutcomeReading {
  const refusals = outcome.refusals ?? []
  switch (outcome.status) {
    case 'saved':
    case 'deleted':
      return { ok: true, preset: outcome.preset ?? null }
    case 'refused':
      return { ok: false, refusals, fallback: refusals.length > 0 ? null : 'refused' }
    case 'notFound':
      return { ok: false, refusals, fallback: refusals.length > 0 ? null : 'notFound' }
    default:
      return { ok: false, refusals, fallback: 'unknown' }
  }
}
