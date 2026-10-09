import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMMAND_KINDS, COMMAND_STATUSES } from '@/core/models/sync-console'
import {
  COMMANDS_PAGE_SIZE,
  EMPTY_COMMANDS_FILTER,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  allowedCommands,
  canCancel,
  clampRePushFrom,
  commandKindKey,
  commandStatusBadge,
  commandsQuery,
  echoedDay,
  isTerminal,
  pollUntilTerminal,
  rePushDateBounds,
  rePushPreviewSentence,
  runVerdict,
  sameRePushInputs,
  storeActions,
} from './command-helpers'
import { failureLabelKey } from './control-helpers'
import en from '@/locales/en/sync-console.json'

const lookup = (key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en)

const operate = { canOperate: true }
const viewOnly = { canOperate: false }

describe('allowedCommands / storeActions', () => {
  it('offers a worker store every command, in the prototype order around its controls', () => {
    expect(allowedCommands({ host: 'Worker' }, operate)).toEqual(['RetryNow', 'RePush', 'ConnectionTest'])
    expect(storeActions({ host: 'Worker', isPaused: false }, operate)).toEqual([
      'RetryNow',
      'Pause',
      'RePush',
      'ConnectionTest',
      'HandBack',
    ])
    expect(storeActions({ host: 'Worker', isPaused: true }, operate)).toEqual([
      'RetryNow',
      'Resume',
      'RePush',
      'ConnectionTest',
      'HandBack',
    ])
  })

  it('offers a WPF store only Move to worker and Test connection', () => {
    expect(allowedCommands({ host: 'Wpf' }, operate)).toEqual(['ConnectionTest'])
    expect(storeActions({ host: 'Wpf', isPaused: false }, operate)).toEqual(['Move', 'ConnectionTest'])
  })

  it('offers nothing without canOperate, or before the probe has answered', () => {
    expect(storeActions({ host: 'Worker', isPaused: false }, viewOnly)).toEqual([])
    expect(storeActions({ host: 'Wpf', isPaused: false }, undefined)).toEqual([])
    expect(allowedCommands({ host: 'Worker' }, null)).toEqual([])
  })
})

describe('rePushDateBounds', () => {
  const today = new Date(2026, 9, 9, 23, 30) // 2026-10-09, late in the local day

  it('starts the window 41 days long (today and the 40 before it), defaulting to its start', () => {
    const b = rePushDateBounds(today)
    expect(b).toEqual({ min: '2026-08-30', max: '2026-10-09', initial: '2026-08-30' })
    expect(b.initial).toBe(b.min)
  })

  it('reads today from the LOCAL date, just after local midnight too', () => {
    expect(rePushDateBounds(new Date(2026, 9, 9, 0, 5)).max).toBe('2026-10-09')
  })

  it('crosses a year by the calendar', () => {
    expect(rePushDateBounds(new Date(2027, 0, 10)).min).toBe('2026-12-01')
  })

  it('pulls a pick outside the window back to it, and a blank one to the start', () => {
    expect(clampRePushFrom('2026-08-01', today)).toBe('2026-08-30')
    expect(clampRePushFrom('2026-10-20', today)).toBe('2026-10-09')
    expect(clampRePushFrom('2026-09-15', today)).toBe('2026-09-15')
    expect(clampRePushFrom('', today)).toBe('2026-08-30')
    expect(clampRePushFrom('soon', today)).toBe('2026-08-30')
  })
})

describe('rePushPreviewSentence', () => {
  const row = (code: string, actions: number, ok = true, error: string | null = null) => ({
    code,
    actions,
    ok,
    error,
    commandId: null,
  })

  it('makes one sentence of the per-store and total counts and the ECHOED date', () => {
    const s = rePushPreviewSentence({
      effectiveFromDate: '2026-08-30T00:00:00',
      totalActions: 13204,
      perStore: [row('P005', 12000), row('P006', 1204)],
    })
    expect(s.key).toBe('rePush.preview.many')
    expect(s.values).toMatchObject({
      total: '13,204',
      stores: '2',
      count: 13204,
      from: '2026-08-30',
      perStore: 'P005 · 12,000, P006 · 1,204',
    })
    expect(lookup(`${s.key}_other`)).toEqual(expect.any(String))
  })

  it('names the one store of a single-store preview', () => {
    const s = rePushPreviewSentence({ effectiveFromDate: '2026-09-01', totalActions: 7, perStore: [row('P031', 7)] })
    expect(s.key).toBe('rePush.preview.one')
    expect(s.values).toMatchObject({ code: 'P031', total: '7', count: 7, from: '2026-09-01' })
    expect(lookup(`${s.key}_one`)).toEqual(expect.any(String))
    expect(lookup(`${s.key}_other`)).toEqual(expect.any(String))
  })

  it('leaves the refused stores out of the counts, and says so when none will replay', () => {
    const some = rePushPreviewSentence({
      effectiveFromDate: '2026-08-30',
      totalActions: 50,
      perStore: [row('P002', 0, false, 'NOT_ON_WORKER'), row('P007', 50)],
    })
    expect(some.key).toBe('rePush.preview.one')
    expect(some.values.code).toBe('P007')
    const none = rePushPreviewSentence({
      effectiveFromDate: '2026-08-30',
      totalActions: 0,
      perStore: [row('P002', 0, false, 'NOT_ON_WORKER')],
    })
    expect(none.key).toBe('rePush.preview.none')
    expect(lookup(none.key)).toEqual(expect.any(String))
  })

  it('shows the echoed date as written, never shifted through a Date', () => {
    expect(echoedDay('2026-08-30')).toBe('2026-08-30')
    expect(echoedDay('2026-08-30T00:00:00')).toBe('2026-08-30')
    expect(echoedDay('30/08/2026')).toBe('30/08/2026')
  })
})

describe('sameRePushInputs', () => {
  const base = { codes: ['P005', 'P006'], objectIds: null, fromDate: '2026-09-01' }

  it('matches the same request, objects in any order', () => {
    expect(sameRePushInputs(base, { ...base })).toBe(true)
    expect(
      sameRePushInputs({ ...base, objectIds: ['Item', 'ItemPrice'] }, { ...base, objectIds: ['ItemPrice', 'Item'] }),
    ).toBe(true)
  })

  it('is broken by any changed input', () => {
    expect(sameRePushInputs(base, { ...base, fromDate: '2026-09-02' })).toBe(false)
    expect(sameRePushInputs(base, { ...base, objectIds: ['Item'] })).toBe(false)
    expect(sameRePushInputs({ ...base, objectIds: ['Item'] }, { ...base, objectIds: ['Item', 'Coupon'] })).toBe(false)
    expect(sameRePushInputs(base, { ...base, codes: ['P005'] })).toBe(false)
  })
})

describe('pollUntilTerminal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0))
  })
  afterEach(() => vi.useRealTimers())

  const cmd = (status: string) => ({ status })

  it.each(['Done', 'Failed', 'Cancelled', 'Expired'])('stops on %s', async (status) => {
    const answers = [[cmd('Pending')], [cmd('Running')], [cmd(status)]]
    const read = vi.fn(async () => answers.shift() ?? [cmd(status)])
    const run = pollUntilTerminal(read)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
    await expect(run).resolves.toEqual({ outcome: 'terminal', commands: [cmd(status)] })
    expect(read).toHaveBeenCalledTimes(3)
    // Nothing is asked after the verdict.
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 5)
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('waits for EVERY command of the batch', async () => {
    const answers = [[cmd('Done'), cmd('Running')], [cmd('Done'), cmd('Failed')]]
    const read = vi.fn(async () => answers.shift()!)
    const run = pollUntilTerminal(read)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
    await expect(run).resolves.toMatchObject({ outcome: 'terminal' })
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('asks every 2 s and gives up after 60 s with the last answer — still running, not failed', async () => {
    const read = vi.fn(async () => [cmd('Running')])
    const updates: number[] = []
    const run = pollUntilTerminal(read, { onUpdate: () => updates.push(Date.now()) })
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS - 1)
    expect(read).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS)
    await expect(run).resolves.toEqual({ outcome: 'timeout', commands: [cmd('Running')] })
    expect(read).toHaveBeenCalledTimes(POLL_TIMEOUT_MS / POLL_INTERVAL_MS)
    expect(runVerdict(cmd('Running') as never, true)).toBe('stillRunning')
  })

  it('does not take an empty answer or a failed read as a verdict', async () => {
    const answers: Array<() => Promise<{ status: string }[]>> = [
      async () => [],
      async () => {
        throw new Error('blip')
      },
      async () => [cmd('Done')],
    ]
    const read = vi.fn(() => answers.shift()!())
    const run = pollUntilTerminal(read)
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
    await expect(run).resolves.toMatchObject({ outcome: 'terminal' })
  })

  it('stops quietly when the caller aborts', async () => {
    const ctl = new AbortController()
    const read = vi.fn(async () => [cmd('Running')])
    const run = pollUntilTerminal(read, { signal: ctl.signal })
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    ctl.abort()
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
    await expect(run).resolves.toMatchObject({ outcome: 'aborted' })
    expect(read).toHaveBeenCalledTimes(1)
  })
})

describe('runVerdict', () => {
  it('reads Done as OK, any other end as failed, and an unfinished one by the clock', () => {
    expect(runVerdict({ status: 'Done' }, false)).toBe('ok')
    for (const s of ['Failed', 'Cancelled', 'Expired'] as const) expect(runVerdict({ status: s }, false)).toBe('failed')
    expect(runVerdict({ status: 'Pending' }, false)).toBe('running')
    expect(runVerdict(undefined, true)).toBe('stillRunning')
  })
})

describe('command labels', () => {
  it('labels every status and kind, and leaves an unknown one raw', () => {
    for (const s of COMMAND_STATUSES) expect(lookup(commandStatusBadge(s).labelKey as string)).toEqual(expect.any(String))
    for (const k of COMMAND_KINDS) expect(lookup(commandKindKey(k) as string)).toEqual(expect.any(String))
    expect(commandStatusBadge('Melting')).toEqual({ labelKey: null, sev: 'mute' })
    expect(commandKindKey('toString')).toBeNull()
    expect(isTerminal('toString')).toBe(false)
  })

  it('has words for the command refusals', () => {
    for (const code of ['DUPLICATE_PENDING', 'NOT_PENDING', 'NOT_ON_WORKER']) {
      expect(lookup(failureLabelKey(code) as string)).toEqual(expect.any(String))
    }
  })

  it('offers Cancel on a pending command only', () => {
    expect(COMMAND_STATUSES.filter((status) => canCancel({ status }))).toEqual(['Pending'])
  })
})

describe('commandsQuery', () => {
  it('sends the filters trimmed, the page and 50 a page; blanks are dropped by the core builder', () => {
    expect(commandsQuery({ status: 'Pending', batch: ' B-0412 ', code: ' P005', kind: 'RePush' }, 2)).toEqual({
      status: 'Pending',
      batch: 'B-0412',
      code: 'P005',
      kind: 'RePush',
      page: 2,
      pageSize: COMMANDS_PAGE_SIZE,
    })
    expect(commandsQuery(EMPTY_COMMANDS_FILTER, 0).page).toBe(1)
    expect(commandsQuery({ ...EMPTY_COMMANDS_FILTER, code: 'p005' }, 1).code).toBe('p005')
  })
})

describe('the per-row sentence groups', () => {
  it('has a sentence for every outcome of a control, a command and a cancel', () => {
    for (const group of ['results', 'commandResults', 'cancelResults']) {
      for (const outcome of ['allOk', 'someFailed', 'allFailed', 'empty']) {
        const plain = lookup(`${group}.${outcome}`)
        const plural = lookup(`${group}.${outcome}_other`)
        expect(typeof plain === 'string' || typeof plural === 'string', `${group}.${outcome}`).toBe(true)
      }
    }
  })
})
