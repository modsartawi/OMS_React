import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '@/core/api'
import { INQUIRY_EXPORT_JOBS_KEY, inquiryExportApi, type InquiryExportJob } from '@/core/inquiry-export/api'
import { drawExport, seeded } from '@/core/inquiry-export/test-render'
import MyExportsPage from './MyExportsPage'
import { canCancel, downloadFailure, refreshEvery } from './jobs'

// Ticket 4318 (spec 4314 stories 11-13, 16, 19): My exports lists the caller's jobs with their state, rows, cut flag
// and times, a download while the file is kept and "file removed" once it is gone; it refreshes while any job is
// waiting or running.

const base: InquiryExportJob = {
  jobId: '01JOB',
  jobNumber: '261126-191303-014',
  screen: 'CollectionAttempts',
  fromDate: '2026-07-01T00:00:00',
  toDate: '2026-07-31T00:00:00',
  status: 'Waiting',
  rowCount: 0,
  isCut: false,
  fileName: '',
  fileAvailable: false,
  fileDeletedTime: null,
  addedTime: '2026-11-26T19:13:03.014',
  startedTime: null,
  processedTime: null,
  errorMessage: '',
}
const job = (over: Partial<InquiryExportJob>): InquiryExportJob => ({ ...base, ...over })

const WAITING = job({ jobId: 'W', jobNumber: 'J-W' })
const RUNNING = job({ jobId: 'R', jobNumber: 'J-R', status: 'Running', startedTime: '2026-11-26T19:14:00' })
const DONE = job({
  jobId: 'D',
  jobNumber: 'J-D',
  status: 'Done',
  rowCount: 48213,
  fileName: 'CollectionAttempts_20260701-20260731_J-D.xlsx',
  fileAvailable: true,
  startedTime: '2026-11-26T19:14:00',
  processedTime: '2026-11-26T19:20:00',
})
const CUT = job({ ...DONE, jobId: 'C', jobNumber: 'J-C', rowCount: 500000, isCut: true })
const FAILED = job({ jobId: 'F', jobNumber: 'J-F', status: 'Failed', processedTime: '2026-11-26T19:20:00', errorMessage: 'Timeout expired' })
const REMOVED = job({ ...DONE, jobId: 'X', jobNumber: 'J-X', fileAvailable: false, fileDeletedTime: '2026-12-03T02:00:00' })

const draw = (jobs: InquiryExportJob[], lng: 'en' | 'ar' = 'en') =>
  drawExport(createElement(MyExportsPage), seeded([[INQUIRY_EXPORT_JOBS_KEY, jobs]]), lng)

/** The markup of one job's row. */
function row(html: string, jobId: string): string {
  const m = new RegExp(`<tr[^>]*data-export-job="${jobId}"[^>]*>(.*?)</tr>`, 's').exec(html)
  expect(m, `row ${jobId}`).not.toBeNull()
  return m![1]
}

describe('MyExportsPage shows waiting, running, done with download, failed and file-removed states', () => {
  const html = draw([WAITING, RUNNING, DONE, CUT, FAILED, REMOVED])

  it('waiting and running say so, and offer no download', () => {
    expect(row(html, 'W')).toContain('Waiting')
    expect(row(html, 'W')).not.toContain('data-export-download')
    expect(row(html, 'R')).toContain('Running')
    expect(row(html, 'R')).not.toContain('data-export-download')
  })

  it('done shows its row count and a download, and says nothing about a cut', () => {
    const r = row(html, 'D')
    expect(r).toContain('Done')
    expect(r).toContain('48,213')
    expect(r).toContain('data-export-download')
    expect(r).not.toContain('data-export-cut')
  })

  it('a file cut at the ceiling says so beside its rows', () => {
    const r = row(html, 'C')
    expect(r).toContain('500,000')
    expect(r).toContain('data-export-cut')
    expect(r).toContain('data-export-download')
  })

  it('failed says it failed in plain words, with no download', () => {
    const r = row(html, 'F')
    expect(r).toContain('Failed')
    expect(r).not.toContain('data-export-download')
  })

  it('a removed file says "file removed" instead of a download', () => {
    const r = row(html, 'X')
    expect(r).toContain('data-export-removed')
    expect(r).toContain('File removed')
    expect(r).not.toContain('data-export-download')
  })

  it('names the screen and the range, not the server key', () => {
    expect(row(html, 'D')).toContain('Collection Attempts')
    expect(row(html, 'D')).toContain('2026-07-01')
    expect(row(html, 'D')).toContain('2026-07-31')
  })

  it('in Arabic, the states are Arabic', () => {
    const ar = draw([REMOVED, FAILED], 'ar')
    expect(row(ar, 'X')).toContain('أُزيل الملف')
    expect(row(ar, 'F')).toContain('فشل')
  })

  it('no jobs: says so', () => {
    expect(draw([])).toContain('data-export-none')
  })
})

describe('My exports refreshes while a job is waiting or running', () => {
  it('polls while any job is waiting or running, and stops when none is', () => {
    expect(refreshEvery([DONE, WAITING])).toBeGreaterThan(0)
    expect(refreshEvery([RUNNING])).toBeGreaterThan(0)
    expect(refreshEvery([DONE, FAILED, REMOVED])).toBe(false)
    expect(refreshEvery(undefined)).toBe(false)
  })
})

// BackOffice spec 4314 review: the owner cancels a Waiting job from My exports (ticket 4320's door), and a download of
// a swept job (410 Gone) says "file removed", not a generic failure.
describe('My exports cancels a waiting job', () => {
  afterEach(() => vi.restoreAllMocks())

  it('the cancel door is a POST to the job’s own Cancel', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ...WAITING, status: 'Cancelled' })
    const answer = await inquiryExportApi.cancel('01J/X')
    expect(post).toHaveBeenCalledWith('InquiryExport/Jobs/01J%2FX/Cancel', {})
    expect(answer.status).toBe('Cancelled')
  })

  it('only a waiting job can be cancelled', () => {
    expect(canCancel(WAITING)).toBe(true)
    for (const j of [RUNNING, DONE, FAILED, REMOVED, job({ status: 'Cancelled' })]) expect(canCancel(j)).toBe(false)
  })

  it('a waiting row offers Cancel; no other row does', () => {
    const html = draw([WAITING, RUNNING, DONE, FAILED, job({ jobId: 'K', status: 'Cancelled' })])
    expect(row(html, 'W')).toContain('data-export-cancel')
    expect(row(html, 'W')).toContain('Cancel')
    for (const id of ['R', 'D', 'F', 'K']) expect(row(html, id)).not.toContain('data-export-cancel')
  })

  it('in Arabic, Cancel and Cancelled are Arabic', () => {
    const ar = draw([WAITING, job({ jobId: 'K', status: 'Cancelled' })], 'ar')
    expect(row(ar, 'W')).toContain('إلغاء')
    expect(row(ar, 'K')).toContain('أُلغي')
  })
})

describe('a download of a swept file says the file was removed', () => {
  it('410 Gone is "removed"; anything else is a failed download', () => {
    expect(downloadFailure(new ApiError('unknown', 'Unexpected API error (HTTP 410)', 410))).toBe('removed')
    expect(downloadFailure(new ApiError('unknown', 'Unexpected API error (HTTP 404)', 404))).toBe('failed')
    expect(downloadFailure(new ApiError('network', 'offline', 0))).toBe('failed')
    expect(downloadFailure(new TypeError('boom'))).toBe('failed')
  })
})
