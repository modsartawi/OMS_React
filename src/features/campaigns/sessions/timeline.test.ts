import { describe, expect, it } from 'vitest'
import type { RuleSessionBudgetMove, RuleSessionCall, RuleSessionJournalMove, RuleSessionRefusal } from '@/core/models/rule-campaign'
import { localMomentKey, momentText, sessionTimeline } from './timeline'

const call = (at: string, moment: string, requestId: string, cartVersion: number, ok = true): RuleSessionCall => ({
  at,
  moment,
  requestId,
  cartVersion,
  reply: `${moment} answered`,
  ok,
})
const budget = (at: string, kind: RuleSessionBudgetMove['kind'], requestId: string | null = null): RuleSessionBudgetMove => ({
  at,
  requestId,
  campaignCode: 'WKND20',
  budget: 'Discount money',
  limit: 'money',
  amount: 40,
  kind,
})
const journal = (at: string, kind: RuleSessionJournalMove['kind']): RuleSessionJournalMove => ({
  at,
  requestId: null,
  campaignCode: 'WKND20',
  kind,
  code: 'WKND20',
  points: null,
})
const refusal = (at: string): RuleSessionRefusal => ({
  at,
  requestId: 'r-2',
  campaignCode: 'PTS-50OFF',
  code: 'RULE_COUPON_SECOND',
  reason: { en: 'Only one coupon per sale.', ar: 'قسيمة واحدة فقط لكل عملية بيع.' },
})

const none = { calls: [], holds: [], budgets: [], journal: [], refusals: [] }

describe('sessionTimeline_ordersCallsAndMovements_byLocalTime', () => {
  it('merges calls, holds, budget and journal movements and refusals into one list, oldest first', () => {
    const out = sessionTimeline({
      calls: [call('2026-10-16T10:05:00', 'close', 'r-3', 3), call('2026-10-16T10:00:00', 'subtotal', 'r-1', 1)],
      holds: [budget('2026-10-16T10:02:30', 'held', 'r-2')],
      budgets: [budget('2026-10-16T10:05:01', 'committed', 'r-3')],
      journal: [journal('2026-10-16T10:05:02', 'couponRedeemed')],
      refusals: [refusal('2026-10-16T10:01:00')],
    })
    expect(out.map((e) => `${e.kind}@${e.at}`)).toEqual([
      'call@2026-10-16T10:00:00',
      'refusal@2026-10-16T10:01:00',
      'hold@2026-10-16T10:02:30',
      'call@2026-10-16T10:05:00',
      'budget@2026-10-16T10:05:01',
      'journal@2026-10-16T10:05:02',
    ])
  })

  it('compares moments as times, not as strings: no seconds, fractions and a space are read alike', () => {
    const out = sessionTimeline({
      ...none,
      calls: [call('2026-10-16T10:00:00.250', 'pay', 'r-2', 2), call('2026-10-16 10:00', 'subtotal', 'r-1', 1), call('2026-10-16T09:59:59.9', 'attach', 'r-0', 0)],
    })
    expect(out.map((e) => (e.kind === 'call' ? e.call.requestId : ''))).toEqual(['r-0', 'r-1', 'r-2'])
  })

  it('at the same moment the call comes first, then its refusal, then the movements it caused', () => {
    const at = '2026-10-16T10:05:00'
    const out = sessionTimeline({
      calls: [call(at, 'close', 'r-3', 3)],
      holds: [budget(at, 'released')],
      budgets: [budget(at, 'committed')],
      journal: [journal(at, 'pointsEarned')],
      refusals: [refusal(at)],
    })
    expect(out.map((e) => e.kind)).toEqual(['call', 'refusal', 'hold', 'budget', 'journal'])
  })

  it('keeps HQ\'s own order between two entries of one kind at the same moment', () => {
    const at = '2026-10-16T10:05:00'
    const out = sessionTimeline({ ...none, journal: [journal(at, 'couponRedeemed'), journal(at, 'pointsEarned'), journal(at, 'couponCreated')] })
    expect(out.map((e) => (e.kind === 'journal' ? e.move.kind : ''))).toEqual(['couponRedeemed', 'pointsEarned', 'couponCreated'])
  })

  it('reads a moment that carries an offset in local time (the drive pins Asia/Riyadh)', () => {
    // 07:30Z is 10:30 in Riyadh: after a 10:00 local call, before an 11:00 one.
    const out = sessionTimeline({
      ...none,
      calls: [call('2026-10-16T11:00:00', 'close', 'r-3', 3), call('2026-10-16T07:30:00Z', 'pay', 'r-2', 2), call('2026-10-16T10:00:00', 'subtotal', 'r-1', 1)],
    })
    const local = new Date('2026-10-16T07:30:00Z').getHours() === 10
    if (local) expect(out.map((e) => (e.kind === 'call' ? e.call.requestId : ''))).toEqual(['r-1', 'r-2', 'r-3'])
    expect(localMomentKey('2026-10-16T07:30:00Z')).not.toContain('Z')
  })

  it('puts a moment it cannot read last, never first', () => {
    const out = sessionTimeline({ ...none, calls: [call('', 'pay', 'r-x', 9), call('2026-10-16T10:00:00', 'subtotal', 'r-1', 1)] })
    expect(out.map((e) => (e.kind === 'call' ? e.call.requestId : ''))).toEqual(['r-1', 'r-x'])
  })

  it('gives every entry a key of its own, stable across reads', () => {
    const s = { ...none, holds: [budget('2026-10-16T10:00:00', 'held'), budget('2026-10-16T10:00:00', 'held')] }
    const a = sessionTimeline(s).map((e) => e.key)
    expect(new Set(a).size).toBe(2)
    expect(sessionTimeline(s).map((e) => e.key)).toEqual(a)
  })
})

describe('momentText', () => {
  it('shows a local moment to the second, with no T and no Z', () => {
    expect(momentText('2026-10-16T10:05:07')).toBe('2026-10-16 10:05:07')
    expect(momentText('2026-10-16T10:05')).toBe('2026-10-16 10:05:00')
    expect(momentText('2026-10-16T10:05:07.123')).toBe('2026-10-16 10:05:07')
  })

  it('shows what it cannot read as it came, and nothing for nothing', () => {
    expect(momentText('yesterday')).toBe('yesterday')
    expect(momentText('')).toBe('')
  })
})
