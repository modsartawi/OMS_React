/**
 * Ticket 616 — the guard answers on an OMS order (BackOffice 3142/3143, answers through `POST
 * Guards/{checkId}/Answer`). A REFUSE line can only be removed or changed; a WARN is ticked; an
 * OVERRIDE needs the triad — intervention, outcome and, where the rule asks, a reason — and the
 * `INS_GUARD` grant. A line passed by an HQ exception needs nothing. Expected bodies are literals.
 */
import { describe, expect, it } from 'vitest'
import { guardAnswer, guardKey, reasonChoices, type GuardDrafts } from './guard-answer'
import type { GuardReasons, OrderGuards } from './guard-check'

const fired = (ruleId: string, severity: 'REFUSE' | 'OVERRIDE' | 'WARN', over: Record<string, unknown> = {}) => ({
  ruleId,
  version: 3,
  severity,
  en: `${ruleId} fired`,
  ar: `${ruleId} أطلق`,
  codes: { conflict: 'ER', nphies: 'MN-1-1' },
  ...over,
})

const GUARDS: OrderGuards = {
  checkId: 'CHK-1',
  lineHash: 'h-1',
  lines: [
    { line: 20, outcome: 'override', fired: [fired('G-002', 'OVERRIDE'), fired('G-003', 'WARN')], unknowns: [] },
    { line: 30, outcome: 'override', fired: [fired('G-005', 'OVERRIDE')], unknowns: [] },
    { line: 40, outcome: 'exception', fired: [fired('G-004', 'REFUSE', { exceptionId: 'EX-41' })], unknowns: [] },
    { line: 50, outcome: 'pass', fired: [], unknowns: [] },
  ],
}

const code = (c: string, active = true) => ({ code: c, en: c, ar: c, active })
const REASONS: GuardReasons = {
  intervention: [code('M0'), code('P0'), code('MR', false)],
  outcome: [code('1A'), code('1B')],
  reason: [code('03'), code('04'), code('07')],
  accepts: { 'G-002': ['03', '04', '07'] },
  caps: { '04': 1 },
}

const run = (drafts: GuardDrafts, canOverride = true, guards: OrderGuards = GUARDS) =>
  guardAnswer({ guards, reasons: REASONS, drafts, user: 'msartawi', canOverride })

const problems = (drafts: GuardDrafts, canOverride = true) =>
  Object.fromEntries(run(drafts, canOverride).items.map((i) => [i.key, i.problem]))

const FULL: GuardDrafts = {
  '20:G-002': { intervention: 'M0', outcome: '1B', reason: '07', note: '  prescriber called  ' },
  '20:G-003': { ack: true },
  '30:G-005': { intervention: 'P0', outcome: '1A' },
}

describe('guardAnswer', () => {
  it('guardAnswer_requiresTriadForOverride', () => {
    // Nothing answered: each OVERRIDE wants its intervention first, the WARN its tick.
    expect(problems({})).toEqual({
      '20:G-002': 'interventionMissing',
      '20:G-003': 'ackMissing',
      '30:G-005': 'interventionMissing',
      '40:G-004': null,
    })
    // An intervention alone, then without the reason the rule asks for: still not sendable.
    expect(problems({ ...FULL, '20:G-002': { intervention: 'M0' } })['20:G-002']).toBe('outcomeMissing')
    expect(problems({ ...FULL, '20:G-002': { intervention: 'M0', outcome: '1B' } })['20:G-002']).toBe('reasonMissing')
    expect(run({ ...FULL, '20:G-002': { intervention: 'M0', outcome: '1B' } }).ready).toBe(false)
    // An inactive code is no answer.
    expect(problems({ ...FULL, '20:G-002': { intervention: 'MR', outcome: '1B', reason: '07' } })['20:G-002']).toBe('interventionMissing')
    // A reason the rule does not accept is no answer either.
    expect(problems({ ...FULL, '20:G-002': { intervention: 'M0', outcome: '1B', reason: '05' } })['20:G-002']).toBe('reasonMissing')

    // The whole triad (G-005 asks no reason, so two of three are its triad): the body, exactly.
    const form = run(FULL)
    expect(form.ready).toBe(true)
    expect(form.open).toBe(0)
    expect(form.body).toEqual({
      lineHash: 'h-1',
      user: 'msartawi',
      answers: [
        { line: 20, ruleId: 'G-002', intervention: 'M0', outcome: '1B', reason: '07', note: 'prescriber called' },
        { line: 20, ruleId: 'G-003', ack: true },
        { line: 30, ruleId: 'G-005', intervention: 'P0', outcome: '1A' },
      ],
    })
  })

  it('an OVERRIDE without INS_GUARD can only be removed or changed', () => {
    const form = run(FULL, false)
    expect(form.ready).toBe(false)
    expect(form.body).toBeNull()
    expect(Object.fromEntries(form.items.map((i) => [i.key, i.problem]))).toEqual({
      '20:G-002': 'noGrant',
      '20:G-003': null,
      '30:G-005': 'noGrant',
      '40:G-004': null,
    })
  })

  it('a REFUSE line blocks the answer until it is removed or changed; an exception line needs nothing', () => {
    const refused: OrderGuards = { ...GUARDS, lines: [{ line: 10, outcome: 'refuse', fired: [fired('G-001', 'REFUSE')], unknowns: [] }, ...GUARDS.lines] }
    const form = run(FULL, true, refused)
    expect(form.items.map((i) => [i.key, i.need, i.problem])).toEqual([
      ['10:G-001', 'refuse', 'remove'],
      ['20:G-002', 'override', null],
      ['20:G-003', 'warn', null],
      ['30:G-005', 'override', null],
      ['40:G-004', 'exception', null],
    ])
    expect(form.open).toBe(1)
    expect(form.ready).toBe(false)
  })

  it('a capped reason is refused past its cap, and greyed for the next line once used', () => {
    const twoAsking: OrderGuards = {
      ...GUARDS,
      lines: [
        { line: 20, outcome: 'override', fired: [fired('G-002', 'OVERRIDE')], unknowns: [] },
        { line: 21, outcome: 'override', fired: [fired('G-002', 'OVERRIDE')], unknowns: [] },
      ],
    }
    const drafts: GuardDrafts = {
      '20:G-002': { intervention: 'M0', outcome: '1B', reason: '04' },
      '21:G-002': { intervention: 'M0', outcome: '1B', reason: '04' },
    }
    const form = guardAnswer({ guards: twoAsking, reasons: REASONS, drafts, user: 'u', canOverride: true })
    expect(form.items.map((i) => i.problem)).toEqual([null, 'reasonCapped'])
    expect(reasonChoices(REASONS, 'G-002', { '20:G-002': drafts['20:G-002'] }, guardKey(21, 'G-002'))).toEqual([
      { code: '03', en: '03', ar: '03', disabled: false },
      { code: '04', en: '04', ar: '04', disabled: true },
      { code: '07', en: '07', ar: '07', disabled: false },
    ])
    // The line that holds the capped reason may keep it.
    expect(reasonChoices(REASONS, 'G-002', drafts, guardKey(20, 'G-002')).find((c) => c.code === '04')?.disabled).toBe(false)
  })
})

describe('guardAnswer — a suggestion applied (review 3126 P2, stories 6 and 35)', () => {
  const SUGGESTED: OrderGuards = {
    checkId: 'CHK-2',
    lineHash: 'h-2',
    lines: [
      { line: 10, outcome: 'refuse', fired: [fired('G-009', 'REFUSE', { suggestion: { maxQuantity: 2 } })], unknowns: [] },
      { line: 20, outcome: 'override', fired: [fired('G-002', 'OVERRIDE', { suggestion: { maxDaysSupply: 30 } })], unknowns: [] },
    ],
  }
  it('guardAnswer_appliedSuggestion_isAChangeAnswer', () => {
    const f = run({ '10:G-009': { apply: true }, '20:G-002': { apply: true } }, false, SUGGESTED)
    expect(f.items.map((i) => [i.key, i.problem])).toEqual([
      ['10:G-009', null],
      ['20:G-002', null],
    ])
    expect(f.ready).toBe(true)
    expect(f.body).toEqual({
      lineHash: 'h-2',
      user: 'msartawi',
      answers: [
        { line: 10, ruleId: 'G-009', change: { maxQuantity: 2 } },
        { line: 20, ruleId: 'G-002', change: { maxDaysSupply: 30 } },
      ],
    })
  })
  it('a rule with no suggestion ignores apply', () => {
    expect(run({ '20:G-002': { apply: true } }).items.find((i) => i.key === '20:G-002')?.problem).toBe('interventionMissing')
  })
})
