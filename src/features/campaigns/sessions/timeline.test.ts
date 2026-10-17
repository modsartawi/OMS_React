import { describe, expect, it } from 'vitest'
import type { RuleSessionBudgetEvent, RuleSessionCall, RuleSessionMovement, RuleSessionReply } from '@/core/models/rule-session'
import { localMomentKey, momentDay, momentText, sessionTimeline } from './timeline'

const reply = (state: string): RuleSessionReply => ({
  sessionId: 'R101-0042',
  state,
  rulesetVersion: 7,
  cartVersion: 3,
  currency: 'SAR',
  decimals: 2,
  effects: [],
  points: [],
  refusals: [],
  prompts: [],
  messages: [],
  offers: [],
  allocation: [],
  createdCoupons: [],
})
const call = (at: string, verb: string, requestId: string, cartVersion = 3): RuleSessionCall => ({
  verb,
  requestId,
  at,
  cartVersion,
  state: 'paying',
  by: null,
  note: null,
  reply: reply('paying'),
})
const move = (at: string, kind: string, movementId = `m-${at}-${kind}`, expiresAt: string | null = null): RuleSessionMovement => ({
  movementId,
  counterId: 'c-1',
  campaign: 'WKND20',
  budget: 'money-cap',
  kind,
  amount: 22,
  expiresAt,
  at,
})
const event = (at: string, eventId = `e-${at}`): RuleSessionBudgetEvent => ({
  eventId,
  campaign: 'WKND20',
  budget: 'money-cap',
  reason: 'expiredHold',
  desired: 22,
  awarded: 22,
  used: 1010,
  limit: 1000,
  at,
})

const none = { calls: [], movements: [], budgetEvents: [] }

describe('timeline_mergesCallsMovementsAndBudgetEvents', () => {
  it('merges the calls, the budget journal and the budget events into one list, oldest first', () => {
    const out = sessionTimeline({
      calls: [call('2026-10-16T10:03:20', 'close', 'r-2'), call('2026-10-16T10:03:00', 'pay', 'r-1')],
      movements: [move('2026-10-16T10:03:20.400', 'commit'), move('2026-10-16T10:03:00.100', 'hold')],
      budgetEvents: [event('2026-10-16T10:03:21')],
    })
    expect(out.map((e) => `${e.kind}@${e.at}`)).toEqual([
      'call@2026-10-16T10:03:00',
      'movement@2026-10-16T10:03:00.100',
      'call@2026-10-16T10:03:20',
      'movement@2026-10-16T10:03:20.400',
      'budgetEvent@2026-10-16T10:03:21',
    ])
  })

  it('at the same moment the call comes first, then the movements it caused, then the events', () => {
    const at = '2026-10-16T10:05:00'
    const out = sessionTimeline({ calls: [call(at, 'close', 'r-3')], movements: [move(at, 'commit')], budgetEvents: [event(at)] })
    expect(out.map((e) => e.kind)).toEqual(['call', 'movement', 'budgetEvent'])
  })

  it('keeps HQ\'s own order between two entries of one kind at the same moment', () => {
    const at = '2026-10-16T10:05:00'
    const out = sessionTimeline({ ...none, movements: [move(at, 'release', 'm-b'), move(at, 'commit', 'm-a')] })
    expect(out.map((e) => (e.kind === 'movement' ? e.move.movementId : ''))).toEqual(['m-b', 'm-a'])
  })

  it('compares moments as times, not as strings: no seconds, fractions and a space are read alike', () => {
    const out = sessionTimeline({
      ...none,
      calls: [call('2026-10-16T10:00:00.250', 'close', 'r-2'), call('2026-10-16 10:00', 'pay', 'r-1'), call('2026-10-16T09:59:59.9', 'pay', 'r-0')],
    })
    expect(out.map((e) => (e.kind === 'call' ? e.call.requestId : ''))).toEqual(['r-0', 'r-1', 'r-2'])
  })

  it('reads a moment that carries an offset in local time (the drive pins Asia/Riyadh)', () => {
    const out = sessionTimeline({
      ...none,
      calls: [call('2026-10-16T11:00:00', 'close', 'r-3'), call('2026-10-16T07:30:00Z', 'pay', 'r-2'), call('2026-10-16T10:00:00', 'pay', 'r-1')],
    })
    const local = new Date('2026-10-16T07:30:00Z').getHours() === 10
    if (local) expect(out.map((e) => (e.kind === 'call' ? e.call.requestId : ''))).toEqual(['r-1', 'r-2', 'r-3'])
    expect(localMomentKey('2026-10-16T07:30:00Z')).not.toContain('Z')
  })

  it('puts a moment it cannot read last, never first', () => {
    const out = sessionTimeline({ ...none, calls: [call('', 'pay', 'r-x'), call('2026-10-16T10:00:00', 'pay', 'r-1')] })
    expect(out.map((e) => (e.kind === 'call' ? e.call.requestId : ''))).toEqual(['r-1', 'r-x'])
  })

  it('keys each entry by HQ\'s own id where it has one, so a re-read after a cancel keeps the rows', () => {
    const s = { calls: [call('2026-10-16T10:00:00', 'pay', 'r-1')], movements: [move('2026-10-16T10:00:00', 'hold', 'm-1')], budgetEvents: [event('2026-10-16T10:00:01', 'e-1')] }
    expect(sessionTimeline(s).map((e) => e.key)).toEqual(['call-r-1', 'movement-m-1', 'budgetEvent-e-1'])
    // Two calls of one request id (a repeat stored twice) still get keys of their own, and no
    // request id can make one collide with the repeat's.
    const twice = sessionTimeline({
      ...none,
      calls: [call('2026-10-16T10:00:00', 'pay', 'x'), call('2026-10-16T10:00:01', 'pay', 'x'), call('2026-10-16T10:00:02', 'pay', 'x-1')],
    })
    expect(new Set(twice.map((e) => e.key)).size).toBe(3)
  })

  it('reads an absent list as empty', () => {
    expect(sessionTimeline({} as never)).toEqual([])
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
    expect(momentText(null)).toBe('')
  })

  it('reads a never-set stamp (0001-01-01) as absent, never as a date', () => {
    expect(momentText('0001-01-01T00:00:00')).toBe('')
    expect(momentDay('0001-01-01T00:00:00')).toBe('')
  })
})

describe('momentDay', () => {
  it('is the local day a moment falls on', () => {
    expect(momentDay('2026-10-16T23:59:59.999')).toBe('2026-10-16')
    expect(momentDay('nope')).toBe('')
  })
})
