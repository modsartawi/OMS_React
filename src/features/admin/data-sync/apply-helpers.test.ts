import { describe, expect, it } from 'vitest'
import { ApiError, type ApiEnvelope } from '@/core/api'
import type { Campaign, TableSpec } from '@/core/models/data-sync'
import type { StoreControlRequest, StoreControlResponse } from '@/core/models/sync-console'
import { buildCreateRequest, type CreateDraft } from './create-helpers'
import en from '@/locales/en/data-sync.json'
import {
  applyReadiness,
  applyTableSplit,
  campaignControlReason,
  createWarningStore,
  pendingControlReason,
  reasonProblem,
  runApplyFlow,
  stillPausedAfterFailure,
  storeControlBatches,
  storesReadiness,
  type ApplyFlowDeps,
  type ApplyStep,
} from './apply-helpers'

const spec = (table: string, applyAllowed: boolean): TableSpec => ({
  table,
  where: null,
  includeColumns: null,
  excludeColumns: null,
  applyAllowed,
  strategy: 'Reconcile',
  deletesAllowed: true,
  caseInsensitiveCompare: false,
})

const draft = (over: Partial<CreateDraft> = {}): CreateDraft => ({
  profileId: 'P1',
  profileTables: ['dbo.Product', 'dbo.Category'],
  pickedTables: ['dbo.Product', 'dbo.Category'],
  mode: 'Apply',
  targets: { kind: 'fleet' },
  name: '',
  reason: '',
  ...over,
})

describe('reasonProblem (Apply)', () => {
  it('asks for a reason when blank or only spaces', () => {
    expect(reasonProblem('')).toBe('required')
    expect(reasonProblem('    ')).toBe('required')
  })
  it('wants at least 10 characters once trimmed', () => {
    expect(reasonProblem('  too short  ')).toBe('tooShort') // "too short" = 9
    expect(reasonProblem('  ten chars!  ')).toBeNull() // "ten chars!" = 10
  })
})

describe('buildCreateRequest (Apply)', () => {
  it('sends the reason trimmed', () => {
    expect(buildCreateRequest(draft({ reason: '  Fix the price drift at P001  ' }))).toEqual({
      profileId: 'P1',
      mode: 'Apply',
      targets: { fleet: 'all' },
      reason: 'Fix the price drift at P001',
    })
  })
})

describe('applyTableSplit', () => {
  const set = [spec('dbo.Category', true), spec('dbo.Product', false), spec('dbo.PriceList', true)]
  it('lists the picked appliable tables as written and the rest as only reported, in profile order', () => {
    expect(applyTableSplit(set, ['dbo.PriceList', 'dbo.Product', 'dbo.Category'])).toEqual({
      written: ['dbo.Category', 'dbo.PriceList'],
      reported: ['dbo.Product'],
    })
  })
  it('ignores unticked tables', () => {
    expect(applyTableSplit(set, ['dbo.Product'])).toEqual({
      written: [],
      reported: ['dbo.Product'],
    })
  })
})

describe('applyReadiness', () => {
  const row = (code: string, host: 'Worker' | 'Wpf' | 'None', isPaused: boolean, controlPending: boolean) => ({
    code,
    host,
    isPaused,
    controlPending,
  })
  it('a WPF-hosted store is never appliable', () => {
    expect(applyReadiness(row('P001', 'Wpf', false, false))).toEqual({
      readiness: 'never',
      why: 'wpf',
    })
  })
  it('a store ActionSync does not know is never appliable', () => {
    expect(applyReadiness(undefined)).toEqual({
      readiness: 'never',
      why: 'notFound',
    })
  })
  it('on the worker, paused and acknowledged is ready', () => {
    expect(applyReadiness(row('P002', 'Worker', true, false))).toEqual({
      readiness: 'ready',
    })
  })
  it('on the worker, paused but not yet acknowledged, or not paused, will be paused', () => {
    expect(applyReadiness(row('P003', 'Worker', true, true))).toEqual({
      readiness: 'willPause',
    })
    expect(applyReadiness(row('P004', 'Worker', false, false))).toEqual({
      readiness: 'willPause',
    })
  })
  it('a store with no host is ready (nothing writes to it)', () => {
    expect(applyReadiness(row('P005', 'None', false, false))).toEqual({
      readiness: 'ready',
    })
  })
})

describe('storesReadiness', () => {
  const rows = [
    {
      code: 'P001',
      host: 'Wpf' as const,
      isPaused: false,
      controlPending: false,
    },
    {
      code: 'P002',
      host: 'Worker' as const,
      isPaused: true,
      controlPending: false,
    },
    {
      code: 'P003',
      host: 'Worker' as const,
      isPaused: false,
      controlPending: false,
    },
  ]
  it('matches picked codes case-insensitively and groups them; every store not "never" is paused, spelt as ActionSync spells it', () => {
    expect(storesReadiness({ kind: 'stores', codes: ['p003', 'P001', 'X999', 'P002'] }, rows)).toEqual({
      never: [
        { code: 'P001', why: 'wpf' },
        { code: 'X999', why: 'notFound' },
      ],
      ready: ['P002'],
      willPause: ['P003'],
      toPause: ['P003', 'P002'],
    })
  })
  it('reads the whole fleet as every row ActionSync lists', () => {
    expect(storesReadiness({ kind: 'fleet' }, rows)).toEqual({
      never: [{ code: 'P001', why: 'wpf' }],
      ready: ['P002'],
      willPause: ['P003'],
      toPause: ['P002', 'P003'],
    })
  })
})

describe('ActionSync control batches', () => {
  it('tags the reason with the campaign (and the pending pause with no id yet)', () => {
    expect(campaignControlReason('01JB2C9X4E6F8G0H1J3K5M7N9P', '  Fix the price drift  ')).toBe(
      'DataSync campaign 01JB2C9X4E6F8G0H1J3K5M7N9P: Fix the price drift',
    )
    expect(pendingControlReason(' Fix the price drift ')).toBe('DataSync campaign (pending): Fix the price drift')
  })
  it('splits the stores into batches of at most 50, each with the reason', () => {
    const codes = Array.from({ length: 120 }, (_, i) => `S${String(i).padStart(3, '0')}`)
    const batches = storeControlBatches('Pause', codes, 'DataSync campaign C1: why')
    expect(batches.map((b) => b.codes.length)).toEqual([50, 50, 20])
    expect(batches[0]).toMatchObject({
      action: 'Pause',
      reason: 'DataSync campaign C1: why',
    })
    expect(batches[0].codes[0]).toBe('S000')
    expect(batches[2].codes[19]).toBe('S119')
  })
  it('sends nothing for no stores', () => {
    expect(storeControlBatches('Resume', [], 'r')).toEqual([])
  })
})

// ── The flow ──────────────────────────────────────────────────────────────────

const CID = '01JB2C9X4E6F8G0H1J3K5M7N9P'
const campaign = (status: Campaign['status']) => ({ campaignId: CID, status }) as Campaign
const okRows = (req: StoreControlRequest): StoreControlResponse => ({
  auditId: 'A',
  results: req.codes.map((code) => ({
    code,
    ok: code !== 'P009',
    error: code === 'P009' ? 'NOT_ON_WORKER' : null,
    controlVersion: 2,
  })),
})

/** A fake set of doors that writes down every call, in order. */
function doors(
  over: {
    create?: () => Promise<ApiEnvelope<Campaign>>
    start?: () => Promise<Campaign>
    failControlAt?: number
  } = {},
) {
  const calls: string[] = []
  let n = 0
  const deps: ApplyFlowDeps = {
    control: async (req) => {
      calls.push(`control ${req.action} [${req.codes.join(',')}] ${req.reason}`)
      if (over.failControlAt === n++) throw new ApiError('server', 'ActionSync is down.', 500)
      return okRows(req)
    },
    create: async (body) => {
      calls.push(`create ${body.mode}`)
      return over.create
        ? over.create()
        : {
            statusCode: 201,
            success: true,
            message: '',
            errors: [
              {
                errorCode: 'DATASYNC_STORE_WPF_HOSTED',
                internalErrorCode: 'DS-0409-08',
                errorMessage: '000/P001 has Host=Wpf.',
              },
            ],
            data: campaign('Ready'),
          }
    },
    start: async (id) => {
      calls.push(`start ${id}`)
      return over.start ? over.start() : campaign('Running')
    },
  }
  return { calls, deps }
}

const BODY = {
  profileId: 'P1',
  mode: 'Apply' as const,
  targets: { fleet: 'all' as const },
  reason: 'Fix the drift',
}
const many = Array.from({ length: 60 }, (_, i) => `S${String(i).padStart(2, '0')}`)

describe('runApplyFlow', () => {
  it('with "pause ActionSync first": pauses untagged, creates, re-pauses the same stores tagged with the new id, then starts — in that order, in batches of 50', async () => {
    const { calls, deps } = doors()
    const out = await runApplyFlow(deps, {
      body: BODY,
      reason: '  Fix the drift  ',
      toPause: many,
    })
    const first = many.slice(0, 50).join(',')
    const rest = many.slice(50).join(',')
    expect(calls).toEqual([
      `control Pause [${first}] DataSync campaign (pending): Fix the drift`,
      `control Pause [${rest}] DataSync campaign (pending): Fix the drift`,
      'create Apply',
      `control Pause [${first}] DataSync campaign ${CID}: Fix the drift`,
      `control Pause [${rest}] DataSync campaign ${CID}: Fix the drift`,
      `start ${CID}`,
    ])
    expect(out.campaign?.campaignId).toBe(CID)
    expect(out.started?.status).toBe('Running')
    expect(out.warnings.map((w) => w.errorCode)).toEqual(['DATASYNC_STORE_WPF_HOSTED'])
  })

  it('re-pauses only the stores the first pause took, and lists the per-store refusals', async () => {
    const { calls, deps } = doors()
    const out = await runApplyFlow(deps, {
      body: BODY,
      reason: 'Fix the drift',
      toPause: ['P001', 'P009'],
    })
    expect(out.held?.refused).toEqual([{ code: 'P009', error: 'NOT_ON_WORKER' }])
    expect(calls[2]).toBe(`control Pause [P001] DataSync campaign ${CID}: Fix the drift`)
  })

  it('a failed create leaves the stores paused and says which — nothing is resumed and nothing started', async () => {
    const refused = new ApiError('business', 'No target store is safe to apply.', 409, [
      {
        errorCode: 'DATASYNC_STORE_BUSY',
        internalErrorCode: 'DS-0409-07',
        errorMessage: 'pause them first.',
      },
    ])
    const { calls, deps } = doors({ create: () => Promise.reject(refused) })
    const out = await runApplyFlow(deps, {
      body: BODY,
      reason: 'Fix the drift',
      toPause: ['P001', 'P002'],
    })
    expect(calls).toEqual(['control Pause [P001,P002] DataSync campaign (pending): Fix the drift', 'create Apply'])
    expect(out.createError).toBe(refused)
    expect(stillPausedAfterFailure(out)).toEqual(['P001', 'P002'])
  })

  it('a pause batch that fails outright stops before the create; the batches already sent stay paused', async () => {
    const { calls, deps } = doors({ failControlAt: 1 })
    const out = await runApplyFlow(deps, {
      body: BODY,
      reason: 'Fix the drift',
      toPause: many,
    })
    expect(calls).toHaveLength(2)
    expect(out.held?.error).toBeInstanceOf(ApiError)
    expect(out.held?.unsent).toEqual(many.slice(50))
    expect(out.campaign).toBeNull()
    expect(stillPausedAfterFailure(out)).toEqual(many.slice(0, 50))
  })

  it('a refused Start keeps the created campaign and its paused stores', async () => {
    const { deps } = doors({
      start: () => Promise.reject(new ApiError('business', 'Start is not valid.', 409)),
    })
    const out = await runApplyFlow(deps, {
      body: BODY,
      reason: 'Fix the drift',
      toPause: ['P001'],
    })
    expect(out.campaign?.campaignId).toBe(CID)
    expect(out.startError).toBeInstanceOf(ApiError)
    expect(out.tagged?.ok).toEqual(['P001'])
  })

  it('without "pause ActionSync first": only creates, and leaves Start to the page', async () => {
    const { calls, deps } = doors()
    const out = await runApplyFlow(deps, {
      body: BODY,
      reason: 'Fix the drift',
      toPause: null,
    })
    expect(calls).toEqual(['create Apply'])
    expect(out.campaign?.status).toBe('Ready')
    expect(out.started).toBeNull()
  })
})

describe('createWarningStore', () => {
  it('reads the client/code a create warning names in its text', () => {
    expect(
      createWarningStore({
        errorCode: 'DATASYNC_STORE_WPF_HOSTED',
        internalErrorCode: 'DS-0409-08',
        errorMessage: '000/P001 has Host=Wpf (or no ActionSyncStore row); the WPF host cannot be paused.',
      }),
    ).toBe('000/P001')
    expect(
      createWarningStore({
        errorCode: 'DATASYNC_STORE_BUSY',
        internalErrorCode: 'DS-0409-07',
        errorMessage: 'The live ActionSync worker is driving 000/DEMO01; pause it before applying to it.',
      }),
    ).toBe('000/DEMO01')
  })
  it('gives nothing when the text names no store', () => {
    expect(
      createWarningStore({
        errorCode: 'DATASYNC_STORE_BUSY',
        internalErrorCode: 'x',
        errorMessage: 'Busy.',
      }),
    ).toBeNull()
  })
})

describe('the Apply words', () => {
  it('has a sentence for every step, never-why, ActionSync refusal and create warning the dialog names by key', () => {
    const steps: ApplyStep[] = ['holding', 'creating', 'tagging', 'starting']
    for (const s of steps) expect(en.apply.step[s]).toBeTruthy()
    for (const w of ['wpf', 'notFound'] as const) expect(en.apply.readiness[w]).toBeTruthy()
    for (const c of ['NOT_ON_WORKER', 'NO_STORE'] as const) expect(en.apply.refused[c]).toBeTruthy()
    for (const c of ['DATASYNC_STORE_BUSY', 'DATASYNC_STORE_WPF_HOSTED'] as const) expect(en.apply.outcome.warning[c]).toBeTruthy()
  })
})
