import { describe, expect, it } from 'vitest'
import { firstLoadTone, headlineKey, healthTone, monthLabel, parseLastRun, readHealth, runTone, storedTime } from './health'

const fresh = {
  status: 'ok',
  version: '1.0.0',
  cube: 'ready',
  marts: { status: 'fresh', lastGoodRunAtRiyadh: '2026-11-05 14:30:12', minutesSince: 7, maxMinutes: 45, lastRun: 'intraday success at 2026-11-05 14:30:12' },
  checkedAt: '2026-11-05T14:37:00',
}

describe('readHealth', () => {
  it('reads the door as sent', () => {
    const h = readHealth(fresh)
    expect(h.status).toBe('ok')
    expect(h.cube).toBe('ready')
    expect(h.marts).toEqual(fresh.marts)
    expect(h.version).toBe('1.0.0')
  })

  it('an absent or unknown overall status is unreachable, never ok', () => {
    expect(readHealth(null).status).toBe('unreachable')
    expect(readHealth({ status: 'OK' }).status).toBe('unreachable')
    expect(readHealth({}).marts).toEqual({ status: '', lastGoodRunAtRiyadh: '', minutesSince: null, maxMinutes: null, lastRun: '' })
  })

  it('unknown states and non-integer minutes are blanked', () => {
    const h = readHealth({ status: 'fail', cube: 'maybe', marts: { status: 'exploded', minutesSince: '7', maxMinutes: 4.5 } })
    expect(h.cube).toBe('')
    expect(h.marts.status).toBe('')
    expect(h.marts.minutesSince).toBeNull()
    expect(h.marts.maxMinutes).toBeNull()
  })
})

describe('firstLoad (image 1.2.0)', () => {
  it('reads a backfill in progress as sent', () => {
    const firstLoad = {
      status: 'running', phase: 'backfill', monthsDone: 6, monthsTotal: 10, currentMonth: '2026-07-01',
      startedAtRiyadh: '2026-11-05 20:47:01', finishedAtRiyadh: '',
    }
    expect(readHealth({ ...fresh, firstLoad }).firstLoad).toEqual(firstLoad)
  })

  it('an older image sends none: blank, so the card shows no row', () => {
    expect(readHealth(fresh).firstLoad).toEqual({
      status: '', phase: '', monthsDone: null, monthsTotal: null, currentMonth: '', startedAtRiyadh: '', finishedAtRiyadh: '',
    })
  })

  it('unknown states, phases and non-integer months are blanked', () => {
    const h = readHealth({ ...fresh, firstLoad: { status: 'exploded', phase: 'drop', monthsDone: '6', monthsTotal: 2.5 } })
    expect(h.firstLoad.status).toBe('')
    expect(h.firstLoad.phase).toBe('')
    expect(h.firstLoad.monthsDone).toBeNull()
    expect(h.firstLoad.monthsTotal).toBeNull()
  })

  it('does not change the overall tone: the old marts keep serving', () => {
    expect(healthTone(readHealth({ ...fresh, firstLoad: { status: 'running', phase: 'rebuild' } }))).toBe('ok')
  })

  it('tones: done ok, running in motion, failed bad, the rest neutral', () => {
    expect(firstLoadTone('done')).toBe('ok')
    expect(firstLoadTone('running')).toBe('go')
    expect(firstLoadTone('failed')).toBe('bad')
    expect(firstLoadTone('not_started')).toBe('mute')
    expect(firstLoadTone('')).toBe('mute')
  })

  it('names the month being read, in the locale', () => {
    expect(monthLabel('2026-07-01', 'en')).toBe('July 2026')
    expect(monthLabel('', 'en')).toBe('')
    expect(monthLabel('July', 'en')).toBe('')
  })
})

describe('healthTone and headlineKey', () => {
  const at = (over: Record<string, unknown>, marts: Record<string, unknown> = {}) =>
    readHealth({ ...fresh, ...over, marts: { ...fresh.marts, ...marts } })

  it.each([
    ['ok', at({}), 'ok', 'ok'],
    ['stale marts, Cube up: behind, a warning', at({ status: 'fail' }, { status: 'stale' }), 'warn', 'behind'],
    ['Cube down', at({ status: 'fail', cube: 'not_ready' }), 'bad', 'cubeDown'],
    ['Cube down AND stale: Cube is the headline', at({ status: 'fail', cube: 'not_ready' }, { status: 'stale' }), 'bad', 'cubeDown'],
    ['marts never built', at({ status: 'fail' }, { status: 'never_built' }), 'bad', 'martsDown'],
    ['marts unreadable', at({ status: 'fail' }, { status: 'unreachable' }), 'bad', 'martsDown'],
    ['no answer', readHealth({ status: 'unreachable' }), 'bad', 'unreachable'],
    ['not configured', readHealth({ status: 'not_configured' }), 'mute', 'notConfigured'],
  ])('%s', (_why, h, tone, headline) => {
    expect(healthTone(h)).toBe(tone)
    expect(headlineKey(h)).toBe(headline)
  })
})

describe('parseLastRun', () => {
  it('splits job, outcome and time', () => {
    expect(parseLastRun('intraday stale_source at 2026-11-05 13:30:04')).toEqual({ job: 'intraday', status: 'stale_source', at: '2026-11-05 13:30:04' })
  })

  it('a run by hand has no job', () => {
    expect(parseLastRun('success at 2026-11-05 03:00:00')).toEqual({ job: '', status: 'success', at: '2026-11-05 03:00:00' })
  })

  it('anything else is not a run', () => {
    expect(parseLastRun('')).toBeNull()
    expect(parseLastRun('the marts are fine')).toBeNull()
  })
})

describe('runTone and storedTime', () => {
  it.each([
    ['success', 'ok'],
    ['stale_source', 'warn'],
    ['error', 'bad'],
    ['test_fail', 'bad'],
    ['skipped', 'mute'],
    ['something_new', 'mute'],
  ])('%s is %s', (status, tone) => expect(runTone(status)).toBe(tone))

  it('a stored time reads as local, not UTC', () => {
    expect(storedTime('2026-11-05 14:30:12')).toBe('2026-11-05T14:30:12')
  })
})
