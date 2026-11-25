import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONTROL_ACTIONS, type DisablePreviewStore } from '@/core/models/sync-console'
import { permissionsOf } from '@/core/permissions'
import {
  AUDIT_PAGE_SIZE,
  EMPTY_AUDIT_FILTER,
  SELECTION_CAP,
  allowedControls,
  bulkActions,
  auditActionKey,
  auditQuery,
  auditRangeValid,
  cleanReason,
  controlResultSummary,
  deadLetterActions,
  disableConfirmReady,
  disableWarnings,
  failureLabelKey,
  mirrorRefusalLabel,
  reasonReady,
  selectionCap,
  selectAllMatching,
  selectionOnFilterChange,
  BULK_CAP,
  limitedList,
  disableWarningRowsShown,
  controlRoute,
  groupAuditByBatch,
  resumeAllRequest,
  resumeAllTicks,
  resumeAllView,
  tickAllResume,
  toggleResumeTick,
} from './control-helpers'
import type { PausedStore } from '@/core/models/sync-console'
import type { SyncAudit } from '@/core/models/sync-console'
import { syncConsoleApi } from './api'
import en from '@/locales/en/sync-console.json'
import ar from '@/locales/ar/sync-console.json'

const lookup = (key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en)

const operate = permissionsOf({ screens: ['ActionSyncConsole:03', 'ActionSyncConsole:06'] })
const viewOnly = permissionsOf({ screens: ['ActionSyncConsole:03'] })

describe('allowedControls', () => {
  it('offers a worker store Pause, Disable and Hand back (allowedControls_activeWorker_offersDisable)', () => {
    expect(allowedControls({ host: 'Worker', isPaused: false, isDisabled: false }, operate)).toEqual(['Pause', 'Disable', 'HandBack'])
  })

  it('offers a paused worker store Resume, Disable and Hand back', () => {
    expect(allowedControls({ host: 'Worker', isPaused: true, isDisabled: false }, operate)).toEqual(['Resume', 'Disable', 'HandBack'])
  })

  it('offers a disabled store only Enable (allowedControls_disabledStore_offersOnlyEnable)', () => {
    // A disabled store is paused underneath (BackOffice 3913): still only Enable, never Resume.
    expect(allowedControls({ host: 'Worker', isPaused: true, isDisabled: true }, operate)).toEqual(['Enable'])
    expect(allowedControls({ host: 'Worker', isPaused: true, isDisabled: true }, viewOnly)).toEqual([])
  })

  it('reads a door that sends no isDisabled as an active store', () => {
    expect(allowedControls({ host: 'Worker', isPaused: false }, operate)).toEqual(['Pause', 'Disable', 'HandBack'])
  })

  it('offers a WPF store only Move to worker', () => {
    expect(allowedControls({ host: 'Wpf', isPaused: false }, operate)).toEqual(['Move'])
    // A WPF row's paused flag changes nothing: the worker alone pauses.
    expect(allowedControls({ host: 'Wpf', isPaused: true }, operate)).toEqual(['Move'])
  })

  it('offers nothing without the operate grant', () => {
    expect(allowedControls({ host: 'Worker', isPaused: false }, viewOnly)).toEqual([])
    expect(allowedControls({ host: 'Worker', isPaused: true }, viewOnly)).toEqual([])
    expect(allowedControls({ host: 'Wpf', isPaused: false }, viewOnly)).toEqual([])
  })

  it('fails closed on an unread answer, and on a neighbouring key', () => {
    expect(allowedControls({ host: 'Worker', isPaused: false }, permissionsOf(null))).toEqual([])
    expect(allowedControls({ host: 'Worker', isPaused: false }, permissionsOf({ screens: ['ActionSyncConsole:03', 'StoreOnboard:06'] }))).toEqual([])
  })

  it('labels every control', () => {
    for (const action of CONTROL_ACTIONS) expect(lookup(`controls.${action}`)).toBeTruthy()
  })
})

describe('bulkActions (bulkActions_perView)', () => {
  it('offers Disable beside the lasting controls and Re-push in the normal view, and never Enable', () => {
    expect(bulkActions('active')).toEqual(['Move', 'HandBack', 'Pause', 'Resume', 'RePush', 'Disable'])
  })

  it('offers only Enable in the disabled view', () => {
    expect(bulkActions('disabled')).toEqual(['Enable'])
  })
})

describe('reasonReady', () => {
  it('refuses a blank or whitespace reason', () => {
    expect(reasonReady('')).toBe(false)
    expect(reasonReady('   \n\t ')).toBe(false)
  })

  it('accepts any non-blank reason, sent trimmed', () => {
    expect(reasonReady('x')).toBe(true)
    expect(cleanReason('  Store closed for renovation \n')).toBe('Store closed for renovation')
  })
})

describe('selectionCap', () => {
  const codes = (n: number, from = 1) => Array.from({ length: n }, (_, i) => `S${String(from + i).padStart(3, '0')}`)

  it('caps at 50', () => {
    expect(SELECTION_CAP).toBe(50)
  })

  it('takes additions under the cap with no message', () => {
    const r = selectionCap(codes(3), codes(5))
    expect(r).toEqual({ codes: codes(5), refused: 0, messageKey: null })
  })

  it('takes the 50th', () => {
    const r = selectionCap(codes(49), codes(50))
    expect(r.codes).toHaveLength(50)
    expect(r.messageKey).toBeNull()
  })

  it('refuses the 51st with a message key that exists', () => {
    const r = selectionCap(codes(50), codes(51))
    expect(r.codes).toEqual(codes(50))
    expect(r.refused).toBe(1)
    expect(r.messageKey).toBe('selection.capped')
    expect(lookup('selection.capped')).toBeTruthy()
  })

  it('fills up to the cap and refuses the rest of a page-wide select', () => {
    const r = selectionCap(codes(45), [...codes(45), ...codes(10, 46)])
    expect(r.codes).toEqual(codes(50))
    expect(r.refused).toBe(5)
  })

  it('always lets a removal through, even at the cap', () => {
    const r = selectionCap(codes(50), codes(49))
    expect(r).toEqual({ codes: codes(49), refused: 0, messageKey: null })
  })

  it('keeps the old order and ignores a repeated code', () => {
    const r = selectionCap(['B', 'A'], ['A', 'C', 'B', 'C'])
    expect(r.codes).toEqual(['B', 'A', 'C'])
  })

  it('never grows a selection already over the cap', () => {
    const r = selectionCap(codes(55), [...codes(55), 'X'])
    expect(r.codes).toEqual(codes(55))
    expect(r.refused).toBe(1)
  })
})

describe('selectAllMatching (selectAllMatching_takesEveryCode_uncapped)', () => {
  const many = Array.from({ length: 137 }, (_, i) => `S${String(i).padStart(3, '0')}`)

  it('takes every code the filter matched, past the 50 cap, in the door order', () => {
    const picked = selectAllMatching(many)
    expect(picked.tooMany).toBe(false)
    expect(picked.codes).toHaveLength(137)
    expect(picked.codes[0]).toBe('S000')
    expect(picked.codes[136]).toBe('S136')
  })

  it('replaces the selection it is given, and keeps one of a code sent twice', () => {
    expect(selectAllMatching(['A001', 'B002', 'A001']).codes).toEqual(['A001', 'B002'])
  })

  it('leaves the one-by-one cap where it was: a click past 50 on that selection is still refused', () => {
    const next = selectionCap(selectAllMatching(many).codes, [...many, 'Z999'])
    expect(next.refused).toBe(1)
    expect(next.codes).toHaveLength(137)
  })

  it('refuses a match over the bulk door ceiling (5,000 codes, BackOffice 3916/3917) and selects nothing', () => {
    expect(BULK_CAP).toBe(5000)
    const big = Array.from({ length: 5001 }, (_, i) => `X${i}`)
    expect(selectAllMatching(big)).toEqual({ codes: [], tooMany: true })
    expect(selectAllMatching(big.slice(0, 5000))).toMatchObject({ tooMany: false })
    expect(selectAllMatching(big.slice(0, 5000)).codes).toHaveLength(5000)
  })
})

describe('selectionOnFilterChange (an over-cap selection never outlives its filter)', () => {
  const codes = (n: number) => Array.from({ length: n }, (_, i) => `C${i}`)
  it("empties a selection over 50: it was the old filter's 'all matching'", () => {
    expect(selectionOnFilterChange(codes(51))).toEqual([])
  })
  it('keeps a selection of 50 or fewer, as ticks have always been kept across filters', () => {
    expect(selectionOnFilterChange(codes(50))).toHaveLength(50)
    expect(selectionOnFilterChange([])).toEqual([])
  })
})

describe('the door a control goes through (controlRoute_over50_usesBulkDoor_else50Door)', () => {
  afterEach(() => vi.unstubAllGlobals())

  const codes = (n: number) => Array.from({ length: n }, (_, i) => `C${String(i).padStart(3, '0')}`)

  /** Sends one control through the console's router and reports the path it was posted to. */
  const posted = async (n: number) => {
    const fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        statusCode: 200,
        success: true,
        message: '',
        errors: [],
        data: { batchId: '01JBATCH', auditId: 'A1', results: [] },
      }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetch)
    await syncConsoleApi.sendControl({ action: 'Resume', codes: codes(n), reason: 'after DataSync' })
    const url = String(fetch.mock.calls[0][0])
    const body = JSON.parse(String((fetch.mock.calls[0][1] as RequestInit).body))
    return { path: url.slice(url.indexOf('ActionSync/')), body }
  }

  it('keeps 50 or fewer on the 50-store door, and sends 51 and on to the bulk door', () => {
    expect(controlRoute(1)).toBe('control')
    expect(controlRoute(50)).toBe('control')
    expect(controlRoute(51)).toBe('bulk')
    expect(controlRoute(300)).toBe('bulk')
  })

  it('posts 50 stores to Stores/Control', async () => {
    expect((await posted(50)).path).toBe('ActionSync/Stores/Control')
  })

  it('posts 51 stores to Stores/Control/Bulk with the same body, every code in it', async () => {
    const { path, body } = await posted(51)
    expect(path).toBe('ActionSync/Stores/Control/Bulk')
    expect(body).toEqual({ action: 'Resume', codes: codes(51), reason: 'after DataSync' })
  })

  it('reads the bulk door answer as per-store results plus its batch id', async () => {
    const fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({
        statusCode: 200,
        success: true,
        message: '',
        errors: [],
        data: {
          batchId: '01JBATCH',
          results: [
            { code: 'C000', ok: true, error: null, controlVersion: 4 },
            { code: 'C001', ok: false, error: 'DISABLED', controlVersion: 2 },
          ],
        },
      }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetch)
    const answer = await syncConsoleApi.controlBulk({ action: 'Resume', codes: codes(120), reason: 'r' })
    expect(answer.batchId).toBe('01JBATCH')
    expect(controlResultSummary(answer.results).failures).toEqual([
      { id: 'C001', code: 'DISABLED', labelKey: 'failures.DISABLED' },
    ])
  })

  it('offers a selection over 50 only the group actions of its view: no Move, Hand back or Re-push', () => {
    expect(bulkActions('active', 51)).toEqual(['Pause', 'Resume', 'Disable'])
    expect(bulkActions('disabled', 51)).toEqual(['Enable'])
    expect(bulkActions('active', 50)).toEqual(['Move', 'HandBack', 'Pause', 'Resume', 'RePush', 'Disable'])
  })
})

describe('controlResultSummary', () => {
  const row = (code: string, ok: boolean, error: string | null = null) => ({ code, ok, error, controlVersion: 3 })

  it('reads every row done as one sentence and no failures', () => {
    const s = controlResultSummary([row('P001', true), row('P002', true), row('P003', true)])
    expect(s).toEqual({ outcome: 'allOk', ok: 3, failed: 0, total: 3, failures: [] })
  })

  it('lists the failed rows with their code, in the door order', () => {
    const s = controlResultSummary([
      row('P001', true),
      row('P002', false, 'NOT_ON_WORKER'),
      row('P003', true),
      row('P404', false, 'NO_STORE'),
    ])
    expect(s.outcome).toBe('someFailed')
    expect([s.ok, s.failed, s.total]).toEqual([2, 2, 4])
    expect(s.failures).toEqual([
      { id: 'P002', code: 'NOT_ON_WORKER', labelKey: 'failures.NOT_ON_WORKER' },
      { id: 'P404', code: 'NO_STORE', labelKey: 'failures.NO_STORE' },
    ])
  })

  it('falls back to the raw code for one this bundle does not know', () => {
    const s = controlResultSummary([row('P001', false, 'MELTED')])
    expect(s.outcome).toBe('allFailed')
    expect(s.failures).toEqual([{ id: 'P001', code: 'MELTED', labelKey: null }])
  })

  it('keeps a failed row that carried no code', () => {
    const s = controlResultSummary([row('P001', false, null)])
    expect(s.failures).toEqual([{ id: 'P001', code: '', labelKey: null }])
  })

  it('names a row by the id it is given (a command id for Cancel)', () => {
    const s = controlResultSummary([{ commandId: 'C-9', ok: false, error: 'NOT_PENDING' }], (r) => r.commandId)
    expect(s.failures[0].id).toBe('C-9')
  })

  it('reads an empty answer as empty', () => {
    expect(controlResultSummary([]).outcome).toBe('empty')
  })

  it('has a sentence for every outcome and a label for every known failure', () => {
    for (const outcome of ['allOk', 'someFailed', 'allFailed', 'empty']) {
      const node = lookup(`results.${outcome}`) ?? lookup(`results.${outcome}_other`)
      expect(node).toBeTruthy()
    }
    for (const code of ['NOT_ON_WORKER', 'NO_STORE', 'NO_STORES', 'TOO_MANY_STORES', 'REASON_REQUIRED', 'BAD_FIELD', 'FAILED', 'DISABLED', 'NOT_DISABLED']) {
      const key = failureLabelKey(code)
      expect(key).toBe(`failures.${code}`)
      expect(lookup(key as string)).toBeTruthy()
    }
    expect(failureLabelKey('toString')).toBeNull()
  })
})

describe('auditQuery', () => {
  it('sends the filters trimmed, page and 50 a page', () => {
    expect(auditQuery({ from: '2026-10-01', to: '2026-10-09', who: ' n.alharbi ', code: ' P001 ' }, 2)).toEqual({
      from: '2026-10-01',
      to: '2026-10-09',
      who: 'n.alharbi',
      code: 'P001',
      page: 2,
      pageSize: AUDIT_PAGE_SIZE,
    })
    expect(AUDIT_PAGE_SIZE).toBe(50)
  })

  it('never re-cases a code, and never asks below page 1', () => {
    const q = auditQuery({ ...EMPTY_AUDIT_FILTER, code: 'p001' }, 0)
    expect(q.code).toBe('p001')
    expect(q.page).toBe(1)
  })

  it('refuses an end date before the start date, and allows an open end', () => {
    expect(auditRangeValid({ from: '2026-10-09', to: '2026-10-01' })).toBe(false)
    expect(auditRangeValid({ from: '2026-10-01', to: '2026-10-01' })).toBe(true)
    expect(auditRangeValid({ from: '', to: '2026-10-01' })).toBe(true)
    expect(auditRangeValid({ from: '2026-10-01', to: '' })).toBe(true)
  })
})

describe('auditGrouping_byBatchId', () => {
  const row = (id: string, at: string, codes: string[], batchId: string | null, action: SyncAudit['action'] = 'Resume'): SyncAudit => ({
    id,
    at,
    who: 'ops1',
    action,
    codes,
    batchId,
    before: 'Worker, paused',
    after: 'Worker',
    reason: 'after DataSync',
  })

  // Newest first, as the door pages it: a 120-store resume wrote three chunks (C3 newest), with a
  // single pause before and after it.
  const page: SyncAudit[] = [
    row('9', '2026-11-16T10:05:00', ['Z001'], null, 'Pause'),
    row('8', '2026-11-16T10:00:03', ['C101', 'C120'], 'B1'),
    row('7', '2026-11-16T10:00:02', ['C051', 'C100'], 'B1'),
    row('6', '2026-11-16T10:00:01', ['C001', 'C050'], 'B1'),
    row('5', '2026-11-16T09:00:00', ['Y001'], null, 'Pause'),
  ]

  it('draws the rows of one batch as one event, with its chunk count, where its newest chunk sits', () => {
    const events = groupAuditByBatch(page)
    expect(events.map((e) => e.id)).toEqual(['9', '8', '5'])
    expect(events[1].chunks).toBe(3)
    expect(events[1].batchId).toBe('B1')
  })

  it('lists the stores of every chunk in the order they were sent: first chunk first', () => {
    expect(groupAuditByBatch(page)[1].codes).toEqual(['C001', 'C050', 'C051', 'C100', 'C101', 'C120'])
  })

  it('leaves a row with no batch, or the only row of its batch, as it was: one chunk', () => {
    const events = groupAuditByBatch([row('1', '2026-11-16T08:00:00', ['A001'], 'R9', 'RePush'), page[0]])
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ id: '1', codes: ['A001'], batchId: 'R9', chunks: 1 })
    expect(events[1]).toMatchObject({ id: '9', batchId: null, chunks: 1 })
  })
})

describe('auditGrouping_onlyBulkControlRowsWithOneChange', () => {
  const row = (id: string, codes: string[], over: Partial<SyncAudit> = {}): SyncAudit => ({
    id,
    at: '2026-11-16T10:00:00',
    who: 'ops1',
    action: 'Pause',
    codes,
    batchId: 'B1',
    before: 'Worker',
    after: 'Worker, paused',
    reason: 'closing',
    ...over,
  })

  it('never folds rows of a non-control action that share a batch id (a Re-push batch stays row by row)', () => {
    const events = groupAuditByBatch([
      row('2', ['A002'], { action: 'RePush', batchId: 'R1' }),
      row('1', ['A001'], { action: 'RePush', batchId: 'R1' }),
    ])
    expect(events.map((e) => [e.id, e.chunks])).toEqual([
      ['2', 1],
      ['1', 1],
    ])
  })

  it('keeps apart rows of one batch whose action or before/after differ, so no summary misstates a change', () => {
    const events = groupAuditByBatch([
      row('4', ['C004']),
      row('3', ['C003'], { before: 'Wpf' }),
      row('2', ['C002']),
      row('1', ['C001'], { action: 'Resume' }),
    ])
    expect(events.map((e) => [e.id, e.codes])).toEqual([
      ['4', ['C002', 'C004']],
      ['3', ['C003']],
      ['1', ['C001']],
    ])
  })

  it("marks an event the door's paging cut: the first on a page that follows another, the last on a page with more after it", () => {
    const page = [row('3', ['C003']), row('2', ['C002']), row('1', ['C001'], { batchId: null })]
    const cut = groupAuditByBatch(page, { before: true, after: false })
    expect(cut.map((e) => [e.id, e.cut])).toEqual([
      ['3', true],
      ['1', false],
    ])
    // A row with no batch is never cut; nor anything when the page stands alone.
    expect(groupAuditByBatch(page, { before: false, after: true }).map((e) => e.cut)).toEqual([false, false])
    expect(groupAuditByBatch([row('2', ['C002']), row('1', ['C001'])], { before: false, after: true })[0].cut).toBe(true)
    expect(groupAuditByBatch(page).every((e) => e.cut === false)).toBe(true)
  })
})

describe('limitedList (a long list of codes is a count plus its first ones)', () => {
  it('shows up to the limit and counts the rest', () => {
    expect(limitedList(['a', 'b', 'c'], 2)).toEqual({ shown: ['a', 'b'], more: 1 })
    expect(limitedList(['a', 'b'], 2)).toEqual({ shown: ['a', 'b'], more: 0 })
  })
})

describe('disableWarningRowsShown (an over-cap Disable draws the stores holding work first, and a limited table)', () => {
  const s = (code: string, pendingActions = 0): DisablePreviewStore => ({
    code,
    description: code,
    lastConnectOkAt: null,
    push: { lastPassAt: null, lastPassOutcome: null } as unknown as DisablePreviewStore['push'],
    pull: { lastPassAt: null, lastPassOutcome: null } as unknown as DisablePreviewStore['pull'],
    lastTrxPulledAt: null,
    pendingActions,
    tillBacklogCount: null,
    openDeadLetters: 0,
    scriptsWaiting: 0,
  })

  it('puts held rows first (each kind in the door order) and cuts at the limit, counting the rows left out', () => {
    const w = disableWarnings([s('1'), s('2', 4), s('3'), s('4', 1), s('5')])
    const shown = disableWarningRowsShown(w, 3)
    expect(shown.rows.map((r) => r.store.code)).toEqual(['2', '4', '1'])
    expect(shown.hidden).toBe(2)
    expect(disableWarningRowsShown(w, 10).hidden).toBe(0)
  })
})

describe('auditActionKey', () => {
  it('labels Disable and Enable (auditActionKey_knowsDisableEnable, BackOffice 3913)', () => {
    expect(lookup(auditActionKey('Disable') as string)).toBe('Disabled a store')
    expect(lookup(auditActionKey('Enable') as string)).toBe('Enabled a store')
  })

  it('labels every audit action, and leaves an unknown one raw', () => {
    for (const a of ['Move', 'HandBack', 'Pause', 'Resume', 'RePush', 'RetryNow', 'ConnectionTest', 'CancelCommand', 'CreateLocation', 'EditLocation', 'DismissPending', 'OnboardStore', 'EditStore', 'MirrorRetry', 'MirrorAcknowledge', 'AgreementRecheck', 'TransactionSnapshotView', 'ReceiptReplay', 'EnrolObject']) {
      const key = auditActionKey(a)
      expect(key).toBe(`auditActions.${a}`)
      expect(lookup(key as string)).toBeTruthy()
    }
    expect(auditActionKey('Explode')).toBeNull()
  })

  it('labels a receipt replay "Replayed a receipt" (spec 470)', () => {
    expect(lookup(auditActionKey('ReceiptReplay') as string)).toBe('Replayed a receipt')
  })

  it('labels an enrolment "Enrolled a push object" (ticket 662)', () => {
    expect(lookup(auditActionKey('EnrolObject') as string)).toBe('Enrolled a push object')
  })

  it('labels the three store script writes (ticket 664, spec 3202 D13)', () => {
    expect(lookup(auditActionKey('SendScript') as string)).toBe('Sent a store script')
    expect(lookup(auditActionKey('WithdrawScript') as string)).toBe('Withdrew a store script')
    expect(lookup(auditActionKey('RetryScript') as string)).toBe('Retried a store script')
  })
})

describe('deadLetterActions', () => {
  const dl = (canRetry: boolean, acknowledgedAt: string | null = null) => ({ canRetry, acknowledgedAt })
  const retryable = dl(true)
  const pullOpen = dl(false)
  const acknowledged = dl(false, '2026-10-09T10:00:00')

  it('offers Retry and Acknowledge when every selected row can be retried', () => {
    expect(deadLetterActions([retryable, retryable], true)).toEqual(['retry', 'acknowledge'])
  })

  it('withholds Retry as soon as one selected row cannot be retried (the door says so, never the stage)', () => {
    expect(deadLetterActions([retryable, pullOpen], true)).toEqual(['acknowledge'])
    expect(deadLetterActions([pullOpen], true)).toEqual(['acknowledge'])
    // The door's canRetry is read as sent: an apply-stage row it marks false is not retried.
    const applyRefused = { stage: 'apply' as const, canRetry: false, acknowledgedAt: null }
    expect(deadLetterActions([applyRefused], true)).toEqual(['acknowledge'])
  })

  it('acknowledges only unacknowledged rows', () => {
    expect(deadLetterActions([acknowledged], true)).toEqual([])
    expect(deadLetterActions([retryable, acknowledged], true)).toEqual([])
  })

  it('offers nothing for an empty selection', () => {
    expect(deadLetterActions([], true)).toEqual([])
  })

  it('offers nothing without the grant', () => {
    expect(deadLetterActions([retryable], false)).toEqual([])
    expect(deadLetterActions([pullOpen], false)).toEqual([])
  })
})

describe('mirrorRefusalLabel', () => {
  it('labels every per-row refusal of the dead-letter doors', () => {
    for (const code of ['PULL_STAGE', 'ACKNOWLEDGED', 'NOT_DEAD_LETTER', 'NOT_FOUND']) {
      const key = mirrorRefusalLabel(code)
      expect(key).toBe(`mirrorRefusals.${code}`)
      expect(lookup(key as string)).toBeTruthy()
    }
  })

  it('leaves an unknown code raw', () => {
    expect(mirrorRefusalLabel('MELTED')).toBeNull()
    expect(mirrorRefusalLabel('toString')).toBeNull()
  })

  it('labels a dead letter answer in the summary, named by stage and id', () => {
    const s = controlResultSummary(
      [
        { stage: 'apply' as const, id: '41', ok: true, error: null },
        { stage: 'pull' as const, id: '7', ok: false, error: 'PULL_STAGE' },
        { stage: 'apply' as const, id: '42', ok: false, error: 'MELTED' },
      ],
      (r) => `${r.stage}:${r.id}`,
      mirrorRefusalLabel,
    )
    expect(s.outcome).toBe('someFailed')
    expect(s.failures).toEqual([
      { id: 'pull:7', code: 'PULL_STAGE', labelKey: 'mirrorRefusals.PULL_STAGE' },
      { id: 'apply:42', code: 'MELTED', labelKey: null },
    ])
  })
})

describe('the disabled-store words (BackOffice 3913, ticket 900)', () => {
  const at = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)
  const KEYS = [
    'controls.Disable',
    'controls.Enable',
    'controls.notes.Disable',
    'controls.notes.Enable',
    'failures.DISABLED',
    'failures.NOT_DISABLED',
    'states.disabled',
    'auditActions.Disable',
    'auditActions.Enable',
    'fleetView.show',
    'fleetView.showUnknown',
    'fleetView.back',
    'fleetView.note',
    'fleetView.empty',
    'store.disabled',
  ]

  it('has every new key in English and in Arabic', () => {
    for (const key of KEYS) {
      expect(at(en, key), `en ${key}`).toBeTruthy()
      expect(at(ar, key), `ar ${key}`).toBeTruthy()
    }
  })

  it('keeps the same slots in both languages', () => {
    const slots = (text: unknown) => [...String(text).matchAll(/<(\w+)>|\{\{(\w+)\}\}/g)].map((m) => m[1] ?? m[2]).sort()
    for (const key of ['fleetView.show', 'store.disabled']) expect(slots(at(ar, key))).toEqual(slots(at(en, key)))
  })

  it('carries only the spec 3913 words in Arabic: every other key still falls back to English', () => {
    expect(Object.keys(ar).sort()).toEqual([
      'audit',
      'auditActions',
      'controls',
      'dialog',
      'disableWarnings',
      // oms 931: the Mirror drain page is fully worded in Arabic.
      'drain',
      'failures',
      'fleetView',
      'nav',
      'replay',
      'results',
      'resumeAll',
      'scriptCodes',
      'selection',
      'states',
      'store',
      'storeDb',
      // Spec 4288 (BackOffice 4290): the Tills tab and its words, in Arabic beside English.
      'tabs',
      'tills',
    ])
    expect(Object.keys((ar as Record<string, object>).tabs)).toEqual(['tills'])
    expect(Object.keys((ar as Record<string, object>).store)).toEqual(['disabled', 'unrecorded'])
  })
})

describe('the select-all-matching words (BackOffice 3913, ticket 902)', () => {
  const at = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)
  const KEYS = [
    'states.closedNotDisabled',
    'selection.all',
    'selection.allNone',
    'selection.allFailed',
    'selection.bulk',
    'results.batch',
    'audit.chunks_one',
    'audit.chunks_other',
    // The 3913 review's words: the select-all ceiling, the cleared selection, the folded code list,
    // the limited warnings table, the cut batch, and an unrecorded Disable stamp.
    'selection.tooMany',
    'selection.clearedOnFilter',
    'dialog.storesCount_one',
    'dialog.storesCount_other',
    'dialog.showStores',
    'dialog.storesMore',
    'disableWarnings.hidden',
    'audit.cut',
    'audit.pageNote',
    'store.unrecorded',
  ]

  it('has every new key in English and in Arabic', () => {
    for (const key of KEYS) {
      expect(at(en, key), `en ${key}`).toBeTruthy()
      expect(at(ar, key), `ar ${key}`).toBeTruthy()
    }
  })

  it('keeps the same slots in both languages', () => {
    const slots = (text: unknown) => [...new Set([...String(text).matchAll(/<(\w+)>|\{\{(\w+)\}\}/g)].map((m) => m[1] ?? m[2]))].sort()
    for (const key of KEYS) expect(slots(at(ar, key)), key).toEqual(slots(at(en, key)))
  })
})

describe('disableWarnings (BackOffice 3913, ticket 901)', () => {
  const quiet = (code: string, over: Partial<DisablePreviewStore> = {}): DisablePreviewStore => ({
    code,
    description: `Store ${code}`,
    lastConnectOkAt: '2026-11-10T08:00:00',
    push: { lastPassAt: '2026-11-10T08:00:00', lastPassOutcome: 'Ok', lastErrorAt: null, lastError: null },
    pull: { lastPassAt: '2026-11-10T08:00:00', lastPassOutcome: 'Failed', lastErrorAt: null, lastError: null },
    lastTrxPulledAt: '2026-11-10T07:59:00',
    pendingActions: 0,
    tillBacklogCount: 0,
    openDeadLetters: 0,
    scriptsWaiting: 0,
    ...over,
  })

  it('flags the stores with outstanding work and counts them (disableWarnings_flagsStoresWithOutstandingWork_countsThem)', () => {
    const w = disableWarnings([
      quiet('1001'),
      quiet('1002', { pendingActions: 3 }),
      quiet('1003', { tillBacklogCount: 12, scriptsWaiting: 1 }),
      quiet('1004', { openDeadLetters: 2 }),
      // Never measured is not outstanding work: nothing is known to be held there.
      quiet('1005', { tillBacklogCount: null, lastConnectOkAt: null }),
    ])
    expect(w.total).toBe(5)
    expect(w.outstanding).toBe(3)
    expect(w.rows.map((r) => [r.store.code, r.work])).toEqual([
      ['1001', []],
      ['1002', ['pendingActions']],
      ['1003', ['tillBacklog', 'scriptsWaiting']],
      ['1004', ['deadLetters']],
      ['1005', []],
    ])
    // A failed last pull is shown, but it is not work held: the store is not flagged for it alone.
    expect(w.rows[0].work).toEqual([])
  })

  it('never blocks Confirm: only the reason gates it (disableWarnings_neverBlocksConfirm)', () => {
    // Every store holds work, and the closed one was never reachable: still allowed once a reason is given.
    const allHeld = disableWarnings([
      quiet('1002', { pendingActions: 3, lastConnectOkAt: null }),
      quiet('1003', { openDeadLetters: 9 }),
    ])
    expect(allHeld.outstanding).toBe(2)
    expect(disableConfirmReady('store closed for good', allHeld)).toBe(true)
    // The preview still being read, or failed outright, holds nothing back either.
    expect(disableConfirmReady('store closed for good', 'loading')).toBe(true)
    expect(disableConfirmReady('store closed for good', 'failed')).toBe(true)
    // The reason is the one gate, as on every control.
    expect(disableConfirmReady('   ', allHeld)).toBe(false)
    expect(disableConfirmReady('', 'failed')).toBe(false)
  })

  it('counts nothing for an empty preview', () => {
    expect(disableWarnings([])).toEqual({ rows: [], total: 0, outstanding: 0 })
  })
})

describe("a disabled store's refusals on the doors that reach a store (BackOffice 3915)", () => {
  const at = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)
  const KEYS = ['failures.DISABLED', 'scriptCodes.DISABLED', 'replay.refusal.DISABLED', 'disableWarnings.unknown']

  it('has every key in English and in Arabic', () => {
    for (const key of KEYS) {
      expect(at(en, key), `en ${key}`).toBeTruthy()
      expect(at(ar, key), `ar ${key}`).toBeTruthy()
    }
  })

  it('words a command or re-push row refused for a disabled store, never the raw code', () => {
    const s = controlResultSummary([
      { code: 'P001', ok: true, error: null },
      { code: 'P042', ok: false, error: 'DISABLED' },
    ])
    expect(s.failures).toEqual([{ id: 'P042', code: 'DISABLED', labelKey: 'failures.DISABLED' }])
  })

  it('carries in Arabic only the replay and script words it adds', () => {
    expect(Object.keys(at(ar, 'scriptCodes') as object)).toEqual(['DISABLED'])
    expect(Object.keys(at(ar, 'replay') as object)).toEqual(['refusal'])
    expect(Object.keys(at(ar, 'replay.refusal') as object)).toEqual(['DISABLED'])
  })
})

describe('the Disable warnings words (ticket 901)', () => {
  const at = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)
  const keys = (bundle: unknown, prefix = ''): string[] =>
    Object.entries(bundle as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  it('has the same keys in English and in Arabic, each with the same slots', () => {
    const enKeys = keys(at(en, 'disableWarnings'), 'disableWarnings.')
    expect(enKeys.length).toBeGreaterThan(10)
    expect(keys(at(ar, 'disableWarnings'), 'disableWarnings.').sort()).toEqual([...enKeys].sort())
    const slots = (text: unknown) => [...String(text).matchAll(/<(\w+)>|\{\{(\w+)\}\}/g)].map((m) => m[1] ?? m[2]).sort()
    for (const key of enKeys) expect(slots(at(ar, key)), key).toEqual(slots(at(en, key)))
  })
})

describe('Resume all paused (BackOffice 3913, ticket 903)', () => {
  const paused = (code: string, pauseReason: string | null = 'DataSync campaign DS-0042'): PausedStore => ({
    code,
    description: `Store ${code}`,
    pausedBy: 'ops.ali',
    pausedAt: '2026-11-15T22:10:00',
    pauseReason,
  })
  const preview = [paused('S001'), paused('S002', 'store-side fault'), paused('S003')]

  it('starts with every paused store ticked, and an unticked store stays out (resumeAll_startsAllTicked_untickKeepsPaused)', () => {
    const start = resumeAllTicks(preview)
    expect(start).toEqual(['S001', 'S002', 'S003'])
    const ticked = toggleResumeTick(preview, start, 'S002')
    expect(ticked).toEqual(['S001', 'S003'])
    // The unticked store is not sent: it stays paused.
    expect(resumeAllRequest(preview, ticked, 'after DataSync')?.codes).toEqual(['S001', 'S003'])
    // Ticking it again puts it back in the preview's order, not at the end.
    expect(toggleResumeTick(preview, ticked, 'S002')).toEqual(['S001', 'S002', 'S003'])
    // Tick none, tick all.
    expect(tickAllResume(preview, false)).toEqual([])
    expect(tickAllResume(preview, true)).toEqual(['S001', 'S002', 'S003'])
  })

  describe('the send (resumeAll_sendsTickedCodesToBulkDoor_withReason)', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('sends the ticked codes as one Resume with the trimmed reason, and nothing while none is ticked or the reason is blank', () => {
      const ticked = toggleResumeTick(preview, resumeAllTicks(preview), 'S002')
      expect(resumeAllRequest(preview, ticked, '  after DataSync DS-0042 ')).toEqual({
        action: 'Resume',
        codes: ['S001', 'S003'],
        reason: 'after DataSync DS-0042',
      })
      expect(resumeAllRequest(preview, [], 'after DataSync')).toBeNull()
      expect(resumeAllRequest(preview, ticked, '   ')).toBeNull()
    })

    it('posts it to Stores/Control/Bulk even for a few stores, and reads the paused preview from Stores/Paused', async () => {
      const fetch = vi.fn().mockImplementation(async (url: string) => ({
        status: 200,
        ok: true,
        json: async () => ({
          statusCode: 200,
          success: true,
          message: '',
          errors: [],
          data: String(url).includes('Stores/Paused')
            ? { items: preview }
            : { batchId: '01JRESUME', results: [{ code: 'S001', ok: true, error: null, controlVersion: 5 }] },
        }),
      }))
      vi.stubGlobal('fetch', fetch)
      expect(await syncConsoleApi.pausedStores()).toEqual(preview)
      const request = resumeAllRequest(preview, ['S001', 'S003'], 'after DataSync')!
      const answer = await syncConsoleApi.controlBulk(request)
      const url = String(fetch.mock.calls[0][0])
      expect(url.slice(url.indexOf('ActionSync/'))).toBe('ActionSync/Stores/Paused')
      const sent = String(fetch.mock.calls[1][0])
      expect(sent.slice(sent.indexOf('ActionSync/'))).toBe('ActionSync/Stores/Control/Bulk')
      expect(JSON.parse(String((fetch.mock.calls[1][1] as RequestInit).body))).toEqual({
        action: 'Resume',
        codes: ['S001', 'S003'],
        reason: 'after DataSync',
      })
      expect(answer.batchId).toBe('01JRESUME')
    })
  })

  it('reads an empty preview as the empty state, never as an error or a list (resumeAll_emptyPreview_isEmptyState)', () => {
    expect(resumeAllView([], [])).toEqual({ state: 'empty' })
    expect(resumeAllRequest([], [], 'after DataSync')).toBeNull()
    // A list says how many are ticked and whether the tick-all box is on, off or mixed.
    expect(resumeAllView(preview, resumeAllTicks(preview))).toEqual({ state: 'list', ticked: 3, total: 3, all: 'all' })
    expect(resumeAllView(preview, ['S002'])).toEqual({ state: 'list', ticked: 1, total: 3, all: 'some' })
    expect(resumeAllView(preview, [])).toEqual({ state: 'list', ticked: 0, total: 3, all: 'none' })
  })
})

describe('the Resume-all words (ticket 903)', () => {
  const at = (bundle: unknown, key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)
  const KEYS = [
    'resumeAll.open',
    'resumeAll.title',
    'resumeAll.note',
    'resumeAll.loading',
    'resumeAll.failed',
    'resumeAll.failedHint',
    'resumeAll.empty',
    'resumeAll.summary',
    'resumeAll.tickAll',
    'resumeAll.tick',
    'resumeAll.columns.store',
    'resumeAll.columns.pausedBy',
    'resumeAll.columns.pausedAt',
    'resumeAll.columns.reason',
    'resumeAll.unrecorded',
    'resumeAll.confirm_one',
    'resumeAll.confirm_other',
  ]

  it('has every new key in English and in Arabic', () => {
    for (const key of KEYS) {
      expect(at(en, key), `en ${key}`).toBeTruthy()
      expect(at(ar, key), `ar ${key}`).toBeTruthy()
    }
  })

  it('keeps the same slots in both languages', () => {
    const slots = (text: unknown) => [...new Set([...String(text).matchAll(/<(\w+)>|\{\{(\w+)\}\}/g)].map((m) => m[1] ?? m[2]))].sort()
    for (const key of KEYS) expect(slots(at(ar, key)), key).toEqual(slots(at(en, key)))
  })
})
