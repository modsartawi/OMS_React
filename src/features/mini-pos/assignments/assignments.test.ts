/**
 * oms 927 (BackOffice spec 4063, doors 4074) — the Mini POS assignments screen: today's view, the add form's checks, the
 * server's overlap refusal shown with the clashing row, and the manage actions drawn only with `MiniPosAdmin:06`.
 * Components are rendered as static markup through a real i18next instance (en and ar); the network is stubbed at the
 * `@/core/api` boundary.
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'
import type { MiniPosAssignment } from '@/core/models/mini-pos'
import en from '@/locales/en/mini-pos-assignments.json'
import ar from '@/locales/ar/mini-pos-assignments.json'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { miniPosAssignmentsApi } = await import('./api')
const { EMPTY_DRAFT, canEndRow, draftProblem, overlapOf, refusalKey, toRequest, todayByStore } = await import('./assignments')
const { AssignmentTable, OverlapNotice, TodayView } = await import('./AssignmentViews')

const NS = 'mini-pos-assignments'
const draw = (element: ReactElement, lng: 'en' | 'ar' = 'en') => {
  const i18n = i18next.createInstance()
  i18n.init({ lng, resources: { [lng]: { [NS]: lng === 'en' ? en : ar } }, ns: [NS], defaultNS: NS, initAsync: false })
  return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, element))
}

const TODAY = '2026-11-19'
const row = (over: Partial<MiniPosAssignment> = {}): MiniPosAssignment => ({
  assignmentId: 'A1',
  promoterLoginId: '70001',
  promoterStaffId: '',
  promoterName: 'Sara Ali',
  storeCode: 'R101',
  fromDate: '2026-11-19T00:00:00',
  toDate: '2026-11-30T00:00:00',
  plannedHoursPerDay: 6,
  enteredBy: 'lead1',
  enteredAt: '2026-11-18T10:00:00',
  endedBy: null,
  endedAt: null,
  ...over,
})
const noop = () => {}
const actions = (canManage: boolean) => ({ canManage, today: TODAY, onEnd: noop, onEndPromoter: noop })

describe('today view', () => {
  const rows = [
    row({ assignmentId: 'A2', promoterLoginId: '70009', promoterName: 'Omar', storeCode: 'R205' }),
    row(),
    row({ assignmentId: 'A3', promoterLoginId: '70002', promoterName: '', storeCode: 'R101' }),
  ]

  it('groups who is where by pharmacy, pharmacies and promoters in code order', () => {
    expect(todayByStore(rows).map((g) => [g.storeCode, g.rows.map((r) => r.promoterLoginId)])).toEqual([
      ['R101', ['70001', '70002']],
      ['R205', ['70009']],
    ])
  })

  it('draws one block per pharmacy with its promoters, days and hours', () => {
    const html = draw(createElement(TodayView, { rows, ...actions(false) }))
    expect(html).toContain('data-minipos-today-store="R101"')
    expect(html).toContain('data-minipos-today-store="R205"')
    expect(html).toContain('Sara Ali')
    // A promoter the server names no one is shown by their login id.
    expect(html.match(/70002/g)?.length).toBe(2)
    // The days are one range, isolated once.
    expect(html).toContain('<bdi dir="ltr">2026-11-19 – 2026-11-30</bdi>')
    expect(html).toContain('<bdi dir="ltr">6</bdi>')
  })

  it('says so when nobody is assigned today', () => {
    expect(draw(createElement(TodayView, { rows: [], ...actions(true) }))).toContain('No promoter is assigned to a pharmacy today.')
  })

  it('hides End and End this promoter now without MiniPosAdmin:06', () => {
    const html = draw(createElement(TodayView, { rows, ...actions(false) }))
    expect(html).not.toContain('data-minipos-end=')
    expect(html).not.toContain('data-minipos-end-promoter=')
    expect(html).not.toContain('<button')
  })

  it('draws End and End this promoter now on each live row with MiniPosAdmin:06', () => {
    const html = draw(createElement(TodayView, { rows, ...actions(true) }))
    expect(html).toContain('data-minipos-end="A1"')
    expect(html).toContain('data-minipos-end-promoter="70001"')
    expect(html).toContain('End this promoter now')
  })

  it('offers no End on an ended row or one whose last day is past', () => {
    const ended = row({ assignmentId: 'E1', endedAt: '2026-11-19T09:00:00', endedBy: 'lead1' })
    const past = row({ assignmentId: 'P1', fromDate: '2026-11-01T00:00:00', toDate: '2026-11-18T00:00:00' })
    expect(canEndRow(ended, TODAY)).toBe(false)
    expect(canEndRow(past, TODAY)).toBe(false)
    expect(canEndRow(row(), TODAY)).toBe(true)
    const html = draw(createElement(AssignmentTable, { rows: [ended, past], ...actions(true) }))
    expect(html).not.toContain('data-minipos-end="E1"')
    expect(html).not.toContain('data-minipos-end="P1"')
    expect(html).toContain('Ended')
    // An ended row offers nothing at all, not even End this promoter now.
    expect(draw(createElement(AssignmentTable, { rows: [ended], ...actions(true) }))).not.toContain('<button')
  })

  it('draws in Arabic with every value isolated', () => {
    const html = draw(createElement(TodayView, { rows: [row()], ...actions(true) }), 'ar')
    expect(html).toContain('إنهاء هذا المروّج الآن')
    expect(html).toContain('<bdi dir="ltr">R101</bdi>')
    expect(html).toContain('<bdi>Sara Ali</bdi>')
  })
})

describe('the add form', () => {
  const ok = { ...EMPTY_DRAFT(TODAY), promoterLoginId: ' 70001 ', storeCode: ' r101 ', toDate: '2026-11-25', hours: '6' }

  it('starts on today, both days', () => {
    expect(EMPTY_DRAFT(TODAY)).toMatchObject({ fromDate: TODAY, toDate: TODAY, hours: '' })
  })

  it('names the first thing missing or wrong', () => {
    expect(draftProblem({ ...ok, promoterLoginId: ' ' }, TODAY)).toBe('promoter')
    expect(draftProblem({ ...ok, storeCode: '' }, TODAY)).toBe('store')
    expect(draftProblem({ ...ok, toDate: '' }, TODAY)).toBe('dates')
    expect(draftProblem({ ...ok, fromDate: '2026-11-18' }, TODAY)).toBe('past')
    expect(draftProblem({ ...ok, toDate: '2026-11-18', fromDate: TODAY }, TODAY)).toBe('order')
    for (const hours of ['', '0', '-1', '25', 'x']) expect(draftProblem({ ...ok, hours }, TODAY)).toBe('hours')
    expect(draftProblem(ok, TODAY)).toBeNull()
    expect(draftProblem({ ...ok, toDate: TODAY }, TODAY)).toBeNull()
  })

  it('sends the trimmed body, the store upper-cased, no empty staff id', () => {
    expect(toRequest(ok)).toEqual({
      promoterLoginId: '70001',
      storeCode: 'R101',
      fromDate: TODAY,
      toDate: '2026-11-25',
      plannedHoursPerDay: 6,
    })
    expect(toRequest({ ...ok, promoterStaffId: ' 9001 ', hours: '7.5' })).toMatchObject({ promoterStaffId: '9001', plannedHoursPerDay: 7.5 })
  })
})

describe('the overlap message comes from the server', () => {
  const clash = row({ assignmentId: 'C9', storeCode: 'R300', fromDate: '2026-11-20T00:00:00', toDate: '2026-11-24T00:00:00' })
  const overlap = (data: unknown) =>
    new ApiError(
      'business',
      'Promoter 70001 already has an assignment that overlaps these days.',
      400,
      [{ errorCode: 'MINIPOS_ASSIGNMENT_OVERLAP', internalErrorCode: '', errorMessage: 'overlap' }],
      data,
    )

  it('reads the clashing row out of the refusal data', () => {
    expect(overlapOf(overlap(clash))).toEqual(clash)
  })

  it('is not an overlap without the code, or without a row in data', () => {
    const other = new ApiError('business', 'x', 400, [{ errorCode: 'MINIPOS_ASSIGNMENT_PAST', internalErrorCode: '', errorMessage: 'x' }], clash)
    expect(overlapOf(other)).toBeNull()
    expect(overlapOf(overlap(null))).toBeNull()
    expect(overlapOf(overlap({ storeCode: 'R300' }))).toBeNull()
    expect(overlapOf(new Error('boom'))).toBeNull()
  })

  it('names the clashing pharmacy and days, and keeps the server sentence', () => {
    const err = overlap(clash)
    const html = draw(createElement(OverlapNotice, { clash: overlapOf(err)!, message: err.message }))
    expect(html).toContain('data-minipos-overlap="C9"')
    expect(html).toContain('These days overlap another assignment')
    // Interpolated values are FSI-isolated in a sentence.
    expect(html).toContain('pharmacy ⁨R300⁩ from ⁨2026-11-20⁩ to ⁨2026-11-24⁩')
    expect(html).toContain('<bdi>Promoter 70001 already has an assignment that overlaps these days.</bdi>')
  })

  it('in Arabic', () => {
    const html = draw(createElement(OverlapNotice, { clash, message: '' }), 'ar')
    expect(html).toContain('هذه الأيام تتداخل مع تكليف آخر')
    expect(html).toContain('⁨R300⁩')
  })

  it('words the other coded refusals itself, and leaves an unknown code to the server', () => {
    const coded = (code: string) => new ApiError('business', 'm', 400, [{ errorCode: code, internalErrorCode: '', errorMessage: 'm' }])
    expect(refusalKey(coded('MINIPOS_PROMOTER_UNKNOWN'))).toBe('promoterUnknown')
    expect(refusalKey(coded('MINIPOS_STORE_NOT_ENABLED'))).toBe('storeNotEnabled')
    expect(refusalKey(coded('MINIPOS_ASSIGNMENT_ENDED'))).toBe('ended')
    expect(refusalKey(coded('MINIPOS_ADMIN_INVALID'))).toBeNull()
  })
})

describe('the doors', () => {
  beforeEach(() => {
    api.get.mockReset()
    api.post.mockReset()
  })

  it('today and find', async () => {
    api.get.mockResolvedValueOnce(null).mockResolvedValueOnce([row()])
    expect(await miniPosAssignmentsApi.today()).toEqual([])
    expect(api.get).toHaveBeenLastCalledWith('MiniPosAdmin/Assignments/Today')
    expect(await miniPosAssignmentsApi.find({ promoter: '70001', store: '', includeHistory: true })).toHaveLength(1)
    expect(api.get).toHaveBeenLastCalledWith('MiniPosAdmin/Assignments', { promoter: '70001', store: '', includeHistory: 'true' })
  })

  it('add, end one row, end the promoter now', async () => {
    api.post.mockResolvedValue({})
    await miniPosAssignmentsApi.add(toRequest({ ...EMPTY_DRAFT(TODAY), promoterLoginId: '70001', storeCode: 'R101', hours: '6' }))
    expect(api.post).toHaveBeenLastCalledWith('MiniPosAdmin/Assignments', expect.objectContaining({ promoterLoginId: '70001', plannedHoursPerDay: 6 }))
    await miniPosAssignmentsApi.end('01J/X')
    expect(api.post).toHaveBeenLastCalledWith('MiniPosAdmin/Assignments/01J%2FX/End', {})
    await miniPosAssignmentsApi.endPromoterNow('70001')
    expect(api.post).toHaveBeenLastCalledWith('MiniPosAdmin/Promoters/70001/EndNow', {})
  })
})
