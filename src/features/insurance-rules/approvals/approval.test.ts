/**
 * Ticket 611 — the approval panel by role (doors 3139 + 3140): an author asks for approval only once a back-test
 * of the CURRENT revision has finished and HQ's checks show no error; an approver approves or sends back, never
 * their own submission. A shadow rule is promoted after 14 local days, or sooner with a reason.
 */
import { describe, expect, it } from 'vitest'
import type { GuardBacktest } from '@/core/insurance-rules/backtest'
import { actionsFor, daysInShadow, promoteGate, PROMOTE_AFTER_DAYS, type DraftApproval } from './approval'

const approval = (o: Partial<DraftApproval> = {}): DraftApproval => ({
  revision: 12,
  state: 'draft',
  submittedBy: null,
  submittedAt: null,
  note: null,
  sentBack: null,
  backtestId: 'BT-41',
  viewer: { author: true, approver: false },
  ...o,
})
const bt = (o: Partial<Pick<GuardBacktest, 'status' | 'revision'>> = {}) => ({ status: 'done' as GuardBacktest['status'], revision: 12, ...o })
const pass = { errors: 0, warnings: 0, blocked: false }

describe('actionsFor_roleStateAndBacktest', () => {
  it('an author on a draft with a current back-test and clean checks may ask for approval', () => {
    expect(actionsFor({ approval: approval(), userId: 'nalharbi', backtest: bt(), checks: pass })).toEqual([{ kind: 'submit', enabled: true, why: null }])
  })

  it('a warning never blocks', () => {
    expect(actionsFor({ approval: approval(), userId: 'a', backtest: bt(), checks: { errors: 0, warnings: 2, blocked: false } })[0].enabled).toBe(true)
  })

  it.each([
    ['no back-test', null, 'noBacktest'],
    ['a running back-test', bt({ status: 'running' }), 'backtestRunning'],
    ['a queued back-test', bt({ status: 'queued' }), 'backtestRunning'],
    ['a failed back-test', bt({ status: 'failed' }), 'backtestFailed'],
    ['a back-test of an older revision', bt({ revision: 11 }), 'backtestStale'],
  ] as const)('submit is disabled with %s', (_, backtest, why) => {
    expect(actionsFor({ approval: approval(), userId: 'a', backtest, checks: pass })).toEqual([{ kind: 'submit', enabled: false, why }])
  })

  it('submit waits for the checks, and errors block it', () => {
    expect(actionsFor({ approval: approval(), userId: 'a', backtest: bt(), checks: null })[0]).toEqual({ kind: 'submit', enabled: false, why: 'checking' })
    expect(actionsFor({ approval: approval(), userId: 'a', backtest: bt(), checks: { errors: 1, warnings: 0, blocked: true } })[0]).toEqual({ kind: 'submit', enabled: false, why: 'checks' })
  })

  it('the back-test reason comes before the checks', () => {
    expect(actionsFor({ approval: approval(), userId: 'a', backtest: null, checks: { errors: 3, warnings: 0, blocked: true } })[0].why).toBe('noBacktest')
  })

  it('an approver of a waiting draft approves or sends back', () => {
    const waiting = approval({ state: 'waiting', submittedBy: 'nalharbi', viewer: { author: false, approver: true } })
    expect(actionsFor({ approval: waiting, userId: 'falotaibi', backtest: bt(), checks: pass })).toEqual([
      { kind: 'approve', enabled: true, why: null },
      { kind: 'sendBack', enabled: true, why: null },
    ])
  })

  it('never their own submission (user ids compared without case)', () => {
    const waiting = approval({ state: 'waiting', submittedBy: 'NAlharbi', viewer: { author: true, approver: true } })
    expect(actionsFor({ approval: waiting, userId: 'nalharbi', backtest: bt(), checks: pass })).toEqual([
      { kind: 'approve', enabled: false, why: 'ownSubmission' },
      { kind: 'sendBack', enabled: false, why: 'ownSubmission' },
    ])
  })

  it('an author waits on a waiting draft; an approver has nothing to do on a draft; nobody else acts', () => {
    expect(actionsFor({ approval: approval({ state: 'waiting', submittedBy: 'a' }), userId: 'a', backtest: bt(), checks: pass })).toEqual([])
    expect(actionsFor({ approval: approval({ viewer: { author: false, approver: true } }), userId: 'b', backtest: bt(), checks: pass })).toEqual([])
    expect(actionsFor({ approval: approval({ viewer: { author: false, approver: false } }), userId: 'c', backtest: bt(), checks: pass })).toEqual([])
  })
})

describe('promoteGate_14DaysOrReason', () => {
  const shadow = (since: string | null) => ({ state: 'shadow' as const, shadowSince: since })
  // Local wall-clock: the same day late at night and just after midnight.
  const at = (y: number, m: number, d: number, h = 10, min = 0) => new Date(y, m - 1, d, h, min)

  it('counts whole LOCAL days from the shadow day', () => {
    expect(daysInShadow('2026-10-15', at(2026, 10, 15, 23, 59))).toBe(0)
    expect(daysInShadow('2026-10-15', at(2026, 10, 16, 0, 1))).toBe(1)
    expect(daysInShadow('2026-10-15', at(2026, 10, 29))).toBe(14)
    expect(daysInShadow('2026-10-15T08:30:00', at(2026, 10, 27))).toBe(12)
    expect(daysInShadow(null, at(2026, 10, 27))).toBeNull()
  })

  it('14 days in shadow: an approver promotes with no reason', () => {
    expect(PROMOTE_AFTER_DAYS).toBe(14)
    expect(promoteGate({ rule: shadow('2026-10-15'), now: at(2026, 10, 29), approver: true, skipReason: '' })).toEqual({ can: true, days: 14, needsReason: false, why: null })
  })

  it('under 14 days: a reason is needed, and a blank one is none', () => {
    expect(promoteGate({ rule: shadow('2026-10-15'), now: at(2026, 10, 28, 23, 59), approver: true, skipReason: '   ' })).toEqual({ can: false, days: 13, needsReason: true, why: 'reason' })
    expect(promoteGate({ rule: shadow('2026-10-15'), now: at(2026, 10, 27), approver: true, skipReason: 'Payer asked for it live' })).toEqual({ can: true, days: 12, needsReason: true, why: null })
  })

  it('an unknown shadow day reads as under 14 days', () => {
    expect(promoteGate({ rule: shadow(null), now: at(2026, 10, 27), approver: true, skipReason: '' })).toEqual({ can: false, days: null, needsReason: true, why: 'reason' })
  })

  it('only an approver, only a shadow rule', () => {
    expect(promoteGate({ rule: shadow('2026-09-01'), now: at(2026, 10, 27), approver: false, skipReason: '' })).toEqual({ can: false, days: 56, needsReason: false, why: 'notApprover' })
    expect(promoteGate({ rule: { state: 'live', shadowSince: null }, now: at(2026, 10, 27), approver: true, skipReason: 'x' })).toEqual({ can: false, days: null, needsReason: false, why: 'notShadow' })
  })
})
