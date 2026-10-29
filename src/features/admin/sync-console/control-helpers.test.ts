import { describe, expect, it } from 'vitest'
import { CONTROL_ACTIONS } from '@/core/models/sync-console'
import {
  AUDIT_PAGE_SIZE,
  EMPTY_AUDIT_FILTER,
  SELECTION_CAP,
  allowedControls,
  auditActionKey,
  auditQuery,
  auditRangeValid,
  cleanReason,
  controlResultSummary,
  deadLetterActions,
  failureLabelKey,
  mirrorRefusalLabel,
  reasonReady,
  selectionCap,
} from './control-helpers'
import en from '@/locales/en/sync-console.json'

const lookup = (key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en)

const operate = { canOperate: true }
const viewOnly = { canOperate: false }

describe('allowedControls', () => {
  it('offers a worker store Pause and Hand back', () => {
    expect(allowedControls({ host: 'Worker', isPaused: false }, operate)).toEqual(['Pause', 'HandBack'])
  })

  it('offers a paused worker store Resume and Hand back', () => {
    expect(allowedControls({ host: 'Worker', isPaused: true }, operate)).toEqual(['Resume', 'HandBack'])
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

  it('fails closed on an unread or malformed access answer', () => {
    expect(allowedControls({ host: 'Worker', isPaused: false }, undefined)).toEqual([])
    expect(allowedControls({ host: 'Worker', isPaused: false }, null)).toEqual([])
    expect(allowedControls({ host: 'Worker', isPaused: false }, { canOperate: 'yes' as unknown as boolean })).toEqual([])
  })

  it('labels every control', () => {
    for (const action of CONTROL_ACTIONS) expect(lookup(`controls.${action}`)).toBeTruthy()
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
    for (const code of ['NOT_ON_WORKER', 'NO_STORE', 'NO_STORES', 'TOO_MANY_STORES', 'REASON_REQUIRED', 'BAD_FIELD', 'FAILED']) {
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

describe('auditActionKey', () => {
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
