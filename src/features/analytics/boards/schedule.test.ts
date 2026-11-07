import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { cadenceSummary, readRun, readSchedule, RECIPIENT_CAP, recipientBar, recipientFilter, refusedRecipients, isGone, scheduleBody } from './schedule'

// A `t` that shows the key and what it was given, so the test sees exactly what reaches the sentence.
const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}${JSON.stringify(opts)}` : key)
const iso = (s: string) => `⁨${s}⁩`

describe('cadenceSummary: each cadence reads as its sentence, its time and days isolated', () => {
  it('daily names the Riyadh time, isolated once', () => {
    expect(cadenceSummary({ cadence: { kind: 'daily' }, time: '07:00' }, t)).toBe(`schedule.cadence.summary.daily${JSON.stringify({ time: iso('07:00') })}`)
  })

  it('weekly names the days in week order (Sunday first), joined into one isolated value', () => {
    const said = cadenceSummary({ cadence: { kind: 'weekly', days: [4, 0, 2] }, time: '06:30' }, t)
    expect(said).toBe(`schedule.cadence.summary.weekly${JSON.stringify({ days: iso('schedule.day.0schedule.daysJoinschedule.day.2schedule.daysJoinschedule.day.4'), time: iso('06:30') })}`)
  })

  it('a day picked twice is named once', () => {
    expect(cadenceSummary({ cadence: { kind: 'weekly', days: [1, 1] }, time: '08:00' }, t)).toContain(iso('schedule.day.1'))
  })

  it('monthly names its day of the month and the time, each isolated', () => {
    expect(cadenceSummary({ cadence: { kind: 'monthly', day: 15 }, time: '09:00' }, t)).toBe(`schedule.cadence.summary.monthly${JSON.stringify({ day: iso('15'), time: iso('09:00') })}`)
  })

  it('weekly with no day chosen says it never runs', () => {
    expect(cadenceSummary({ cadence: { kind: 'weekly', days: [] }, time: '07:00' }, t)).toBe('schedule.cadence.summary.noDays')
  })
})

const user = (id: string, more: { email?: string; canRun?: boolean; inAudience?: boolean } = {}) => ({ id, name: id, employeeId: '', email: `${id}@al-dawaa.com.sa`, canRun: true, ...more })
const shared = (users: string[] = []) => ({ tier: 'shared' as const, owner: 'aalharbi', audience: { everyone: false as const, roles: [], users: users.map((id) => ({ id, name: id, employeeId: '' })) } })

describe('recipientBar: why a candidate cannot receive the report, or null', () => {
  it('a user in the audience (by the server’s word) with the run grant and a company address may receive it', () => {
    expect(recipientBar(user('nalharbi', { inAudience: true }), shared())).toBeNull()
  })

  it('a user the audience names may receive it without the server’s flag', () => {
    expect(recipientBar(user('nalharbi'), shared(['NAlharbi']))).toBeNull()
  })

  it('outside the audience is barred, and so is an unflagged one when the audience names no role', () => {
    expect(recipientBar(user('kalotaibi', { inAudience: false }), shared())).toBe('audience')
    expect(recipientBar(user('kalotaibi'), shared())).toBe('audience')
  })

  it('a report shared with everyone, or certified, reaches every analytics user', () => {
    expect(recipientBar(user('kalotaibi'), { tier: 'shared', owner: 'aalharbi', audience: { everyone: true } })).toBeNull()
    expect(recipientBar(user('kalotaibi'), { tier: 'shared', owner: 'aalharbi' })).toBeNull()
    expect(recipientBar(user('kalotaibi'), { tier: 'certified', owner: 'aalharbi' })).toBeNull()
  })

  it('a Personal report reaches its owner alone', () => {
    const personal = { tier: 'personal' as const, owner: 'aalharbi' }
    expect(recipientBar(user('AAlharbi'), personal)).toBeNull()
    expect(recipientBar(user('nalharbi', { inAudience: true }), personal)).toBe('audience')
  })

  it('without the run grant is barred; a grant the server did not say is the save’s to check', () => {
    expect(recipientBar(user('sqahtani', { inAudience: true, canRun: false }), shared())).toBe('runGrant')
    expect(recipientBar({ id: 'sqahtani', name: '', employeeId: '', email: 'sqahtani@al-dawaa.com.sa', inAudience: true }, shared())).toBeNull()
  })

  it('only a company address: another domain, a subdomain, a look-alike or none is barred; an unsent one is the save’s to check', () => {
    for (const email of ['s@gmail.com', 's@mail.al-dawaa.com.sa', 's@al-dawaa.com.sa.evil.io', '@al-dawaa.com.sa', '']) {
      expect(recipientBar(user('s', { inAudience: true, email }), shared())).toBe('address')
    }
    expect(recipientBar({ id: 's', name: '', employeeId: '', canRun: true, inAudience: true }, shared())).toBeNull()
    expect(recipientBar(user('s', { inAudience: true, email: ' S.Q@Al-Dawaa.com.sa ' }), shared())).toBeNull()
  })
})

describe('recipientFilter: the candidates the editor offers', () => {
  const candidates = [user('a', { inAudience: true }), user('b', { inAudience: false }), user('c', { inAudience: true, canRun: false }), user('d', { inAudience: true, email: 'd@gmail.com' }), user('e', { inAudience: true })]

  it('offers only those in the audience with the run grant and a company address, and says why each other is not', () => {
    const f = recipientFilter(candidates, shared(), [])
    expect(f.offered.map((u) => u.id)).toEqual(['a', 'e'])
    expect(f.barred.map((b) => [b.user.id, b.bar])).toEqual([['b', 'audience'], ['c', 'runGrant'], ['d', 'address']])
    expect(f.full).toBe(false)
  })

  it('at 25 chosen it is full: it offers only those already chosen, so no 26th can be ticked', () => {
    expect(RECIPIENT_CAP).toBe(25)
    const many = Array.from({ length: 30 }, (_, i) => user(`u${i}`, { inAudience: true }))
    const chosen = many.slice(0, 25).map((u) => u.id)
    const f = recipientFilter(many, shared(), chosen)
    expect(f.full).toBe(true)
    expect(f.offered.map((u) => u.id)).toEqual(chosen)
    expect(recipientFilter(many, shared(), chosen.slice(0, 24)).full).toBe(false)
  })
})

describe('refusedRecipients: ANALYTICS-414 names each refused recipient and why', () => {
  const refusal414 = (data: unknown) => new ApiError('business', 'Invalid recipients.', 400, [{ errorCode: 'ANALYTICS-414', internalErrorCode: '', errorMessage: 'Invalid recipients.' }], data)

  it('reads each recipient and its reason', () => {
    const err = refusal414({ recipients: [{ id: 'sqahtani', why: 'audience' }, { id: 'kalotaibi', why: 'runGrant' }, { id: 'x', why: 'address' }, { id: 'y', why: 'cap' }] })
    expect(refusedRecipients(err)).toEqual([
      { id: 'sqahtani', why: 'audience' },
      { id: 'kalotaibi', why: 'runGrant' },
      { id: 'x', why: 'address' },
      { id: 'y', why: 'cap' },
    ])
  })

  it('an unknown reason stays, read as the server said nothing more; a row with no id is dropped', () => {
    expect(refusedRecipients(refusal414({ recipients: [{ id: 'a', why: 'other' }, { why: 'audience' }] }))).toEqual([{ id: 'a', why: null }])
  })

  it('another refusal, or a 414 without data, names nobody', () => {
    expect(refusedRecipients(refusal414(null))).toEqual([])
    expect(refusedRecipients(new ApiError('business', 'x', 400, [{ errorCode: 'ANALYTICS-412', internalErrorCode: '', errorMessage: 'x' }], { recipients: [{ id: 'a', why: 'audience' }] }))).toBeNull()
  })
})

describe('readSchedule / readRun: the proposed wire, read defensively', () => {
  it('a schedule keeps its cadence, time, values, language, recipients, state and suspension', () => {
    expect(readSchedule({ id: 's1', cadence: { kind: 'weekly', days: [0, 9, 3] }, time: '07:00', values: { period: { kind: 'period', token: 'yesterday' } }, lang: 'ar', recipients: ['a', 7], enabled: true, suspended: { reason: 'value', param: 'city' } })).toEqual({
      id: 's1',
      cadence: { kind: 'weekly', days: [0, 3] },
      time: '07:00',
      values: { period: { kind: 'period', token: 'yesterday' } },
      lang: 'ar',
      recipients: ['a'],
      enabled: true,
      suspended: { reason: 'value', param: 'city' },
    })
  })

  it('an unknown cadence reads as daily, a missing language as English, an absent suspension as none', () => {
    expect(readSchedule({ id: 's2', cadence: { kind: 'hourly' }, time: '06:00' })).toMatchObject({ cadence: { kind: 'daily' }, lang: 'en', recipients: [], enabled: false, suspended: null })
  })

  it('a run reads its recipients as users (a bare id as itself) and its artefacts as gone unless kept', () => {
    const run = readRun({ id: 'run-1', reportId: 'r-827', revision: 3, ranAt: '2026-11-05T07:00:00', trigger: 'sendNow', outcome: 'chartsUnavailable', recipients: ['nalharbi', { id: 'kalotaibi', name: 'Khalid Alotaibi', employeeId: '10551' }] })
    expect(run).toMatchObject({ id: 'run-1', trigger: 'sendNow', outcome: 'chartsUnavailable', artefactsKept: false, hasPdf: false, dropped: [], summary: null, dataAsOf: null })
    expect(run.recipients.map((u) => [u.id, u.name])).toEqual([['nalharbi', ''], ['kalotaibi', 'Khalid Alotaibi']])
  })

  it('an unknown trigger reads as the schedule, an unknown outcome as failed', () => {
    expect(readRun({ id: 'r', trigger: 'x', outcome: 'y' })).toMatchObject({ trigger: 'schedule', outcome: 'failed' })
  })
})

describe('the server’s wire (BackOffice 3408 §G, confirmed live in 835)', () => {
  const refusal414 = (data: unknown) => new ApiError('business', 'Invalid recipients.', 400, [{ errorCode: 'ANALYTICS-414', internalErrorCode: '', errorMessage: 'Invalid recipients.' }], data)

  it('weekly days come as sun … sat, monthly as a day or last; recipients as { id, name }', () => {
    expect(readSchedule({ id: 's1', cadence: { kind: 'weekly', days: ['sun', 'tue', 'xyz', 'sat'] }, time: '07:00', recipients: [{ id: '14419', name: 'M' }, { name: 'no id' }] })).toMatchObject({
      cadence: { kind: 'weekly', days: [0, 2, 6] },
      recipients: ['14419'],
    })
    expect(readSchedule({ id: 's2', cadence: { kind: 'monthly', day: 'last' } }).cadence).toEqual({ kind: 'monthly', day: 'last' })
    expect(readSchedule({ id: 's3', cadence: { kind: 'monthly', day: 15 } }).cadence).toEqual({ kind: 'monthly', day: 15 })
  })

  it('a suspension for a lost grant reads as ownerGrant, whichever grant', () => {
    expect(readSchedule({ id: 's', suspended: { reason: 'ownerNoRun', at: '2026-11-07T07:00:00' } }).suspended).toEqual({ reason: 'ownerGrant' })
    expect(readSchedule({ id: 's', suspended: { reason: 'ownerNoAuthor', at: '' } }).suspended).toEqual({ reason: 'ownerGrant' })
  })

  it('the write sends weekly days as sun … sat, and a monthly day or last as is', () => {
    const base = { time: '07:00', values: {}, lang: 'en' as const, recipients: ['14419'], enabled: true }
    expect(scheduleBody({ ...base, cadence: { kind: 'weekly', days: [0, 2, 6] } })).toEqual({ ...base, cadence: { kind: 'weekly', days: ['sun', 'tue', 'sat'] } })
    expect(scheduleBody({ ...base, cadence: { kind: 'monthly', day: 'last' } }).cadence).toEqual({ kind: 'monthly', day: 'last' })
    expect(scheduleBody({ ...base, cadence: { kind: 'daily' } }).cadence).toEqual({ kind: 'daily' })
  })

  it('a 414 names each recipient with the server’s reason', () => {
    const err = refusal414({ recipients: [{ id: 'a', reason: 'notInAudience' }, { id: 'b', reason: 'noRunGrant' }, { id: 'c', reason: 'noCompanyEmail' }, { id: 'd', reason: 'overLimit' }, { id: 'e', reason: 'new' }] })
    expect(refusedRecipients(err)).toEqual([
      { id: 'a', why: 'audience' },
      { id: 'b', why: 'runGrant' },
      { id: 'c', why: 'address' },
      { id: 'd', why: 'cap' },
      { id: 'e', why: null },
    ])
  })

  it('a run: recipients { sent, dropped }, a plain summary, artefacts { html, pdf, expired }, slot and server outcomes', () => {
    const run = readRun({
      id: 'run-1', scheduleId: 'sch-1', reportId: 'r-1', slotKey: 'now:01J', trigger: 'slot', revision: 2, values: {}, lang: 'en', dataAsOf: '2026-11-06',
      recipients: { sent: ['14419'], dropped: [{ id: '777', reason: 'notInAudience' }] },
      outcome: 'sentWithoutCharts', summary: 'HungerStation led QC.', isProcessed: true, addedAt: '2026-11-07T07:00:00', processedAt: '2026-11-07T07:01:10',
      artefacts: { html: true, pdf: false, expired: false, keptUntil: '2027-02-05T07:01:10' },
    })
    expect(run).toMatchObject({ trigger: 'schedule', outcome: 'chartsUnavailable', ranAt: '2026-11-07T07:01:10', summary: { en: 'HungerStation led QC.', ar: 'HungerStation led QC.' }, artefactsKept: true, hasPdf: false })
    expect(run.recipients.map((u) => u.id)).toEqual(['14419'])
    expect(run.dropped.map((u) => u.id)).toEqual(['777'])
    expect(readRun({ id: 'r', outcome: 'missed' }).outcome).toBe('skipped')
    expect(readRun({ id: 'r', artefacts: { html: true, pdf: true, expired: true } })).toMatchObject({ artefactsKept: false, hasPdf: false })
  })

  it('a run still open (Send now just queued) reads as open, at the time it was added', () => {
    expect(readRun({ id: 'r', outcome: '', isProcessed: false, addedAt: '2026-11-07T07:00:00', processedAt: '' })).toMatchObject({ outcome: 'open', ranAt: '2026-11-07T07:00:00' })
  })

  it('a candidate the server cannot vouch for (no email, run grant or audience flag sent) is offered; the save’s 414 decides', () => {
    const bare = { id: '14419', name: 'M', employeeId: '14419' }
    expect(recipientBar(bare, { tier: 'certified', owner: 'x' })).toBeNull()
    expect(recipientBar(bare, { tier: 'shared', owner: 'x', audience: { everyone: false, roles: [{ key: 'HQ', label: { en: '', ar: '' }, removed: false }], users: [] } })).toBeNull()
    // …but what the web does know still bars: a Personal report is its owner’s, an audience of users only names them.
    expect(recipientBar(bare, { tier: 'personal', owner: 'x' })).toBe('audience')
    expect(recipientBar(bare, { tier: 'shared', owner: 'x', audience: { everyone: false, roles: [], users: [] } })).toBe('audience')
  })
})

describe('isGone: an artefact past its 90 days', () => {
  it('a 410 from the artefact door is gone', () => {
    expect(isGone(new ApiError('unknown', 'Gone', 410))).toBe(true)
  })
  it('ANALYTICS-410 (an area unavailable) is not, nor any other failure', () => {
    expect(isGone(new ApiError('business', 'x', 410, [{ errorCode: 'ANALYTICS-410', internalErrorCode: '', errorMessage: 'x' }]))).toBe(false)
    expect(isGone(new ApiError('server', 'x', 500))).toBe(false)
    expect(isGone(new Error('x'))).toBe(false)
  })
})
