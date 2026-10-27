// HQ guard exceptions (BackOffice 3135; oms ticket 614) — the pure part: the validity window and the issue
// form's checks and body. No React, no `t`.
//
// "Valid until (at most 90 days)" is read in LOCAL calendar days: today is day 0, today + 90 the last day
// allowed, and today itself is allowed (the exception is valid through the end of that day). 🚩 Guess,
// recorded on the ticket for 618: the brief does not say whether "until" is inclusive.

import { addDays, windowDays, type LocalDate } from '@/core/util/date-window'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

/** The longest an exception may run, in local days from today. */
export const EXCEPTION_MAX_DAYS = 90

/** The last day an exception issued today may run until. */
export function exceptionMaxUntil(today: LocalDate): LocalDate {
  return addDays(today, EXCEPTION_MAX_DAYS)
}

export type ValidUntilProblem = 'missing' | 'invalid' | 'past' | 'tooLong'

/** Why `until` may not be sent, or null when it may. */
export function exceptionValidUntilProblem(until: string, today: LocalDate): ValidUntilProblem | null {
  const value = until.trim()
  if (!value) return 'missing'
  const date = fromIsoDate(value)
  if (!date || toIsoDate(date) !== value) return 'invalid'
  const days = windowDays(today, value)
  if (days === null) return 'invalid'
  if (days < 1) return 'past'
  if (value > exceptionMaxUntil(today)) return 'tooLong'
  return null
}

/** What an exception covers: one item, every item of that item's kind, or an item list (by id). */
export type ExceptionScopeKind = 'item' | 'sameKind' | 'list'
export const EXCEPTION_SCOPE_KINDS: readonly ExceptionScopeKind[] = ['item', 'sameKind', 'list']

/**
 * The wire scope, ONE key set (`scope: { item|sameKind|list }` in the brief). 🚩 Guess: `item` and `sameKind`
 * carry an item code (same kind = that item's kind), `list` a list id of the guard ruleset.
 */
export type ExceptionScope = { item: string } | { sameKind: string } | { list: string }

export function scopeOf(scope: ExceptionScope): { kind: ExceptionScopeKind; value: string } {
  if ('item' in scope) return { kind: 'item', value: scope.item }
  if ('sameKind' in scope) return { kind: 'sameKind', value: scope.sameKind }
  return { kind: 'list', value: scope.list }
}

/** The issue form as typed. `ruleId` empty = every guard. */
export interface ExceptionForm {
  patientKey: string
  ruleId: string
  scopeKind: ExceptionScopeKind
  scopeValue: string
  validUntil: string
  reason: string
  note: string
}

export const EMPTY_EXCEPTION_FORM: ExceptionForm = {
  patientKey: '',
  ruleId: '',
  scopeKind: 'item',
  scopeValue: '',
  validUntil: '',
  reason: '',
  note: '',
}

export type ExceptionField = 'patientKey' | 'scopeValue' | 'validUntil' | 'reason'
export type ExceptionFormProblems = Partial<Record<ExceptionField, string>>

/** The fields still wrong, each with its problem word (`missing`, `tooLong`, …); empty when it may be sent. */
export function exceptionFormProblems(form: ExceptionForm, today: LocalDate): ExceptionFormProblems {
  const out: ExceptionFormProblems = {}
  if (!form.patientKey.trim()) out.patientKey = 'missing'
  if (!form.scopeValue.trim()) out.scopeValue = 'missing'
  const until = exceptionValidUntilProblem(form.validUntil, today)
  if (until) out.validUntil = until
  if (!form.reason) out.reason = 'missing'
  return out
}

/** `POST InsuranceRules/Exceptions` body. */
export interface IssueExceptionBody {
  patientKey: string
  ruleId: string | null
  scope: ExceptionScope
  validUntil: LocalDate
  reason: string
  note: string
}

export function exceptionBody(form: ExceptionForm): IssueExceptionBody {
  const value = form.scopeValue.trim()
  const scope: ExceptionScope =
    form.scopeKind === 'item' ? { item: value } : form.scopeKind === 'sameKind' ? { sameKind: value } : { list: value }
  return {
    patientKey: form.patientKey.trim(),
    ruleId: form.ruleId || null,
    scope,
    validUntil: form.validUntil.trim(),
    reason: form.reason,
    note: form.note.trim(),
  }
}

/** An exception's standing on `today`: revoked wins, then expired (the day after `validUntil`). */
export type ExceptionStatus = 'active' | 'expired' | 'revoked'

export function exceptionStatus(e: { validUntil: LocalDate; revokedAt: string | null }, today: LocalDate): ExceptionStatus {
  if (e.revokedAt) return 'revoked'
  return e.validUntil < today ? 'expired' : 'active'
}
