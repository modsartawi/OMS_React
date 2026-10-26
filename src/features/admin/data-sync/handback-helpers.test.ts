import { describe, expect, it } from 'vitest'
import type { Job, JobStatus } from '@/core/models/data-sync'
import { allCampaignJobs, handBackBatches, handBackSplit } from './handback-helpers'
import en from '@/locales/en/data-sync.json'

const job = (code: string, status: JobStatus, actionSyncResumable = false): Job => ({
  jobId: `J-${code}`,
  campaignId: 'C1',
  store: { client: '000', code },
  target: null,
  status,
  phase: null,
  tableTasks: [],
  startedAt: null,
  finishedAt: null,
  failureReason: null,
  attemptCount: 0,
  waitReason: null,
  notBefore: null,
  holdReason: null,
  actionSyncResumable,
})

describe('handBackSplit', () => {
  it('hands back only Succeeded + resumable jobs, and keeps every other store paused with why', () => {
    const split = handBackSplit('Apply', [
      job('S01', 'Succeeded', true),
      job('S02', 'Succeeded', false),
      job('S03', 'Failed'),
      job('S04', 'Cancelled'),
      job('S05', 'Running'),
      job('S06', 'Queued'),
      job('S07', 'Paused'),
      job('S08', 'Succeeded', true),
      job('S09', 'Pausing'),
      job('S10', 'Cancelling'),
    ])
    expect(split.handBack.map((s) => s.code)).toEqual(['S01', 'S08'])
    expect(split.stayPaused.map((s) => [s.code, s.why])).toEqual([
      ['S02', 'notResumable'],
      ['S03', 'failed'],
      ['S04', 'cancelled'],
      ['S05', 'inFlight'],
      ['S06', 'inFlight'],
      ['S07', 'inFlight'],
      ['S09', 'inFlight'],
      ['S10', 'inFlight'],
    ])
    expect(split.inFlight).toBe(5)
  })

  it('never offers a resumable flag on a job that has not succeeded', () => {
    const split = handBackSplit('Apply', [job('S01', 'Failed', true), job('S02', 'Running', true)])
    expect(split.handBack).toEqual([])
    expect(split.stayPaused.map((s) => s.why)).toEqual(['failed', 'inFlight'])
  })

  it('gives a report-only campaign neither set: nothing of it was paused', () => {
    const split = handBackSplit('ReportOnly', [job('S01', 'Succeeded', true), job('S02', 'Failed')])
    expect(split).toEqual({ handBack: [], stayPaused: [], inFlight: 0 })
  })

  it('keeps the store label and the job beside each code', () => {
    const [s] = handBackSplit('Apply', [job('S01', 'Succeeded', true)]).handBack
    expect(s).toEqual({ code: 'S01', store: '000/S01', jobId: 'J-S01' })
  })

  it('has a sentence for every why', () => {
    for (const why of ['failed', 'cancelled', 'inFlight', 'notResumable'])
      expect(typeof (en as unknown as { handBack: { why: Record<string, unknown> } }).handBack.why[why]).toBe('string')
  })
})

describe('handBackBatches', () => {
  it('resumes the codes in batches of at most 50, each tagged with the campaign and its reason', () => {
    const codes = Array.from({ length: 51 }, (_, i) => `S${i}`)
    const batches = handBackBatches('01JCAMP', '  Price fix for the north  ', codes)
    expect(batches).toHaveLength(2)
    expect(batches[0]).toEqual({ action: 'Resume', codes: codes.slice(0, 50), reason: 'DataSync campaign 01JCAMP: Price fix for the north' })
    expect(batches[1]).toEqual({ action: 'Resume', codes: ['S50'], reason: 'DataSync campaign 01JCAMP: Price fix for the north' })
  })

  it('sends nothing for no codes', () => {
    expect(handBackBatches('01JCAMP', 'reason text', [])).toEqual([])
  })
})

describe('allCampaignJobs', () => {
  it('reads pages of 50 until a short page', async () => {
    const asked: number[] = []
    const pages: Record<number, Job[]> = {
      1: Array.from({ length: 50 }, (_, i) => job(`A${i}`, 'Succeeded', true)),
      2: Array.from({ length: 50 }, (_, i) => job(`B${i}`, 'Failed')),
      3: [job('C0', 'Running')],
    }
    const jobs = await allCampaignJobs(async (page) => {
      asked.push(page)
      return pages[page] ?? []
    })
    expect(asked).toEqual([1, 2, 3])
    expect(jobs).toHaveLength(101)
    expect(jobs[100].store.code).toBe('C0')
  })

  it('stops on an empty page after a full one', async () => {
    const asked: number[] = []
    const jobs = await allCampaignJobs(async (page) => {
      asked.push(page)
      return page === 1 ? Array.from({ length: 50 }, (_, i) => job(`A${i}`, 'Failed')) : []
    })
    expect(asked).toEqual([1, 2])
    expect(jobs).toHaveLength(50)
  })
})
