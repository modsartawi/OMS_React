/**
 * Ticket 886 (BackOffice spec 3631 S24/S30, contract 3662): the "My schedules" page — the reader's personal schedules
 * with the next send, the five acts each on its own door and redrawn from the answer, and a personal report opening
 * read only with its line. The network is stubbed at the `@/core/api` boundary.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { analyticsApi } = await import('./api')
const { mySchedulesOffered } = await import('./access')
const { actOnMySchedule, myScheduleRow, mySchedulesOff, personalReportOf } = await import('./my-schedules')

const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}${JSON.stringify(opts)}` : key)
const iso = (s: string) => `⁨${s}⁩`

/** Two rows as the server sends them (3662 "Wire / contract"). */
const MONDAYS = {
  id: 's1',
  reportId: 'r1',
  title: { en: 'Sales by region', ar: 'Sales by region' },
  cadence: { kind: 'weekly', days: ['mon', 'thu'], day: null },
  time: '07:00',
  timeZone: 'Asia/Riyadh',
  lang: 'en',
  paused: false,
  suspended: null,
  nextSend: '2026-11-16T07:00',
  periodLengthDays: 7,
}
const MONTHLY = {
  ...MONDAYS,
  id: 's2',
  reportId: 'r2',
  title: { en: 'Month end', ar: 'Month end' },
  cadence: { kind: 'monthly', days: null, day: 'last' },
  time: '18:30',
  paused: true,
  nextSend: null,
}

const coded = (code: string) => new ApiError('business', `Server says ${code}.`, 400, [{ errorCode: code, internalErrorCode: '', errorMessage: '' }])

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(null)
})

describe('the page lists the reader’s schedules with the next send', () => {
  it('GET Analytics/MySchedules, read oldest first as sent, weekly days and the month’s last day read as any schedule’s', async () => {
    api.get.mockResolvedValue([MONDAYS, MONTHLY])
    const rows = await analyticsApi.mySchedules()
    expect(api.get).toHaveBeenCalledWith('Analytics/MySchedules')
    expect(rows.map((r) => r.id)).toEqual(['s1', 's2'])
    expect(rows[0].cadence).toEqual({ kind: 'weekly', days: [1, 4] })
    expect(rows[1].cadence).toEqual({ kind: 'monthly', day: 'last' })
    expect(rows[0].reportId).toBe('r1')
  })

  it('a row says its days and time, its next send, and that it is running', async () => {
    api.get.mockResolvedValue([MONDAYS])
    const [s] = await analyticsApi.mySchedules()
    const row = myScheduleRow(s, t)
    expect(row.when).toBe(`schedule.cadence.summary.weekly${JSON.stringify({ days: iso('schedule.day.1schedule.daysJoinschedule.day.4'), time: iso('07:00') })}`)
    expect(row.nextSend).toBe('2026-11-16 07:00')
    expect(row.state).toBe('active')
    expect(row.reportHref).toBe('/analytics/report/r1')
  })

  it('a paused row has no next send and says paused; a suspended one says suspended', async () => {
    api.get.mockResolvedValue([MONTHLY, { ...MONDAYS, nextSend: null, suspended: { reason: 'ownerNoRun', at: '2026-11-10T07:00' } }])
    const [paused, suspended] = (await analyticsApi.mySchedules()).map((s) => myScheduleRow(s, t))
    expect(paused.nextSend).toBeNull()
    expect(paused.state).toBe('paused')
    expect(suspended.nextSend).toBeNull()
    expect(suspended.state).toBe('suspended')
  })

  it('an absent list reads empty, and a row without an id is dropped', async () => {
    api.get.mockResolvedValue(null)
    expect(await analyticsApi.mySchedules()).toEqual([])
    api.get.mockResolvedValue([{ ...MONDAYS, id: '' }])
    expect(await analyticsApi.mySchedules()).toEqual([])
  })

  it('ANALYTICS-424 (the switch is off) is the page not offered; any other failure is not', () => {
    expect(mySchedulesOff(coded('ANALYTICS-424'))).toBe(true)
    expect(mySchedulesOff(coded('ANALYTICS-401'))).toBe(false)
    expect(mySchedulesOff(new Error('boom'))).toBe(false)
  })

  it('the menu offers the page only when the list door answers: off (424) hides it, and so does any failure', async () => {
    api.get.mockResolvedValue([])
    expect(await mySchedulesOffered()).toBe(true)
    expect(api.get).toHaveBeenCalledWith('Analytics/MySchedules')
    api.get.mockRejectedValue(coded('ANALYTICS-424'))
    expect(await mySchedulesOffered()).toBe(false)
    api.get.mockRejectedValue(coded('ANALYTICS-401'))
    await expect(mySchedulesOffered()).rejects.toBeInstanceOf(ApiError)
  })
})

describe('pause, resume, retime, rename and delete each call their door and redraw', () => {
  const read = async () => {
    api.get.mockResolvedValue([MONDAYS, MONTHLY])
    return analyticsApi.mySchedules()
  }

  it('pause: POST …/{sid}/Pause, and the row is redrawn from the answer', async () => {
    const rows = await read()
    api.post.mockResolvedValue({ ...MONDAYS, paused: true, nextSend: null })
    const next = await actOnMySchedule(rows, { act: 'pause', id: 's1' })
    expect(api.post).toHaveBeenCalledWith('Analytics/MySchedules/s1/Pause', {})
    expect(next.map((r) => [r.id, r.paused, r.nextSend])).toEqual([
      ['s1', true, null],
      ['s2', true, null],
    ])
  })

  it('resume: POST …/{sid}/Resume, and the next send comes back', async () => {
    const rows = await read()
    api.post.mockResolvedValue({ ...MONTHLY, paused: false, nextSend: '2026-11-30T18:30' })
    const next = await actOnMySchedule(rows, { act: 'resume', id: 's2' })
    expect(api.post).toHaveBeenCalledWith('Analytics/MySchedules/s2/Resume', {})
    expect(myScheduleRow(next[1], t).nextSend).toBe('2026-11-30 18:30')
    expect(next[0]).toBe(rows[0])
  })

  it('retime: PUT …/{sid}/Time with the weekdays named as the server names them', async () => {
    const rows = await read()
    api.put.mockResolvedValue({ ...MONDAYS, cadence: { kind: 'weekly', days: ['sun', 'wed'], day: null }, time: '06:15', nextSend: '2026-11-15T06:15' })
    const next = await actOnMySchedule(rows, { act: 'retime', id: 's1', cadence: { kind: 'weekly', days: [3, 0] }, time: '06:15' })
    expect(api.put).toHaveBeenCalledWith('Analytics/MySchedules/s1/Time', { cadence: { kind: 'weekly', days: ['sun', 'wed'] }, time: '06:15' })
    expect(next[0].cadence).toEqual({ kind: 'weekly', days: [0, 3] })
    expect(next[0].time).toBe('06:15')
  })

  it('retime to monthly sends its day; to daily, the kind alone', async () => {
    const rows = await read()
    api.put.mockResolvedValue(MONDAYS)
    await actOnMySchedule(rows, { act: 'retime', id: 's1', cadence: { kind: 'monthly', day: 15 }, time: '09:00' })
    expect(api.put).toHaveBeenLastCalledWith('Analytics/MySchedules/s1/Time', { cadence: { kind: 'monthly', day: 15 }, time: '09:00' })
    await actOnMySchedule(rows, { act: 'retime', id: 's1', cadence: { kind: 'daily' }, time: '09:00' })
    expect(api.put).toHaveBeenLastCalledWith('Analytics/MySchedules/s1/Time', { cadence: { kind: 'daily' }, time: '09:00' })
  })

  it('rename: PUT …/{sid}/Title with the words trimmed, and the row takes the server’s title', async () => {
    const rows = await read()
    api.put.mockResolvedValue({ ...MONDAYS, title: { en: 'Regions weekly', ar: 'Regions weekly' } })
    const next = await actOnMySchedule(rows, { act: 'rename', id: 's1', title: '  Regions weekly ' })
    expect(api.put).toHaveBeenCalledWith('Analytics/MySchedules/s1/Title', { title: 'Regions weekly' })
    expect(next[0].title).toEqual({ en: 'Regions weekly', ar: 'Regions weekly' })
  })

  it('delete: DELETE …/{sid}, and the row leaves the list', async () => {
    const rows = await read()
    api.del.mockResolvedValue(true)
    const next = await actOnMySchedule(rows, { act: 'delete', id: 's1' })
    expect(api.del).toHaveBeenCalledWith('Analytics/MySchedules/s1')
    expect(next.map((r) => r.id)).toEqual(['s2'])
  })

  it('a refused act leaves the list as it was and passes the refusal on', async () => {
    const rows = await read()
    api.post.mockRejectedValue(coded('ANALYTICS-404'))
    await expect(actOnMySchedule(rows, { act: 'pause', id: 's1' })).rejects.toBeInstanceOf(ApiError)
    expect(rows.map((r) => r.paused)).toEqual([false, true])
  })

  it('an id is escaped into the door', async () => {
    const rows = await read()
    api.del.mockResolvedValue(true)
    await actOnMySchedule(rows, { act: 'delete', id: 'a/b' })
    expect(api.del).toHaveBeenCalledWith('Analytics/MySchedules/a%2Fb')
  })
})

describe('a viewer’s personal report opens read only with the line', () => {
  it('GET Analytics/Item carrying personalScheduleId reads as a personal report: read only, the line linking My schedules', async () => {
    api.get.mockResolvedValue({ id: 'r1', kind: 'report', tier: 'personal', owner: 'nalharbi', title: { en: 'Sales', ar: 'Sales' }, actions: [], personalScheduleId: 's1', definition: { sections: [] } })
    const report = await analyticsApi.report('r1')
    expect(report.personalScheduleId).toBe('s1')
    expect(personalReportOf(report)).toEqual({ readOnly: true, scheduleId: 's1', href: '/analytics/my-schedules' })
  })

  it('an ordinary report (the field absent, or blank) is not one', async () => {
    api.get.mockResolvedValue({ id: 'r2', kind: 'report', tier: 'personal', owner: 'nalharbi', definition: { sections: [] } })
    expect(personalReportOf(await analyticsApi.report('r2'))).toBeNull()
    api.get.mockResolvedValue({ id: 'r3', kind: 'report', tier: 'personal', owner: 'nalharbi', personalScheduleId: '', definition: { sections: [] } })
    const blank = await analyticsApi.report('r3')
    expect(blank.personalScheduleId).toBeUndefined()
    expect(personalReportOf(blank)).toBeNull()
  })
})
