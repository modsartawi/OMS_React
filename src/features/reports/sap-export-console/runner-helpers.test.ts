import { describe, expect, it } from 'vitest'
import { RUNNER_KEYS, type Runner } from '@/core/models/sap-export'
import { livenessBadge, outcomeBadge, runnerRows } from './runner-helpers'
import en from '@/locales/en/sap-export-console.json'

const runner = (over: Partial<Runner> = {}): Runner => ({
  key: 'idocProcessing',
  liveness: 'up',
  fromHeartbeat: true,
  host: 'HQ-API-01',
  lastCycleStartedAt: '2026-10-11T08:00:00',
  lastCycleEndedAt: '2026-10-11T08:00:04',
  lastOutcome: 'moved',
  lastMoved: 120,
  lastMessage: null,
  lastNonIdleAt: '2026-10-11T08:00:04',
  dueBacklog: 40,
  downAfterMinutes: 15,
  ...over,
})

/** A dotted key read from the en bundle. */
const lookup = (key: string): unknown => key.split('.').reduce<unknown>((node, k) => (node as Record<string, unknown> | undefined)?.[k], en)

describe('runnerRows', () => {
  it('maps liveness to its token: down danger, up success, idle muted', () => {
    expect(livenessBadge('down').token).toBe('danger')
    expect(livenessBadge('up').token).toBe('success')
    expect(livenessBadge('idle').token).toBe('muted')
  })

  it('never draws idle red', () => {
    const { rows, down } = runnerRows([runner({ liveness: 'idle', dueBacklog: 0, lastOutcome: 'idle' })])
    expect(rows[0].liveness.token).not.toBe('danger')
    expect(rows[0].outcome.token).not.toBe('danger')
    expect(down).toEqual([])
  })

  it('raises the banner for any down runner, naming each in the door order', () => {
    const { down } = runnerRows([
      runner({ key: 'legacyUploader', liveness: 'down' }),
      runner({ key: 'idocProcessing', liveness: 'up' }),
      runner({ key: 'censusRollup', liveness: 'down' }),
    ])
    expect(down.map((r) => r.key)).toEqual(['legacyUploader', 'censusRollup'])
  })

  it('raises no banner when nothing is down', () => {
    expect(runnerRows([runner(), runner({ key: 'idocExport', liveness: 'idle' })]).down).toEqual([])
    expect(runnerRows([]).down).toEqual([])
  })

  it('marks a row with no heartbeat as inferred', () => {
    const { rows } = runnerRows([runner({ fromHeartbeat: false }), runner({ key: 'idocExport' })])
    expect(rows.map((r) => r.inferred)).toEqual([true, false])
  })

  it('shows the fault message beside a faulted cycle only', () => {
    const { rows } = runnerRows([
      runner({ lastOutcome: 'faulted', lastMessage: 'Timeout reading P014.' }),
      runner({ key: 'idocExport', lastOutcome: 'moved', lastMessage: 'stale text' }),
      runner({ key: 'idocBatching', lastOutcome: 'faulted', lastMessage: null }),
    ])
    expect(rows.map((r) => r.faultMessage)).toEqual(['Timeout reading P014.', null, null])
    expect(rows[0].outcome.token).toBe('danger')
  })

  it('keeps the door order and the runner as sent', () => {
    const items = RUNNER_KEYS.map((key) => runner({ key }))
    const { rows } = runnerRows(items)
    expect(rows.map((r) => r.key)).toEqual([...RUNNER_KEYS])
    expect(rows[2].runner).toBe(items[2])
  })

  it('has a name, a liveness and an outcome sentence in the bundle for every contract value', () => {
    for (const key of RUNNER_KEYS) expect(lookup(runnerRows([runner({ key })]).rows[0].nameKey!)).toBeTruthy()
    for (const l of ['up', 'idle', 'down']) expect(lookup(livenessBadge(l).labelKey!)).toBeTruthy()
    for (const o of ['moved', 'idle', 'faulted', 'none']) expect(lookup(outcomeBadge(o).labelKey!)).toBeTruthy()
    expect(lookup('runners.inferred')).toBeTruthy()
  })

  it('draws an unknown key, liveness or outcome raw and neutral, never as a crash', () => {
    const odd = { ...runner(), key: 'newStage', liveness: 'asleep', lastOutcome: 'odd' } as unknown as Runner
    const { rows, down } = runnerRows([odd])
    expect(rows[0].nameKey).toBeNull()
    expect(rows[0].liveness).toEqual({ token: 'neutral', labelKey: null })
    expect(rows[0].outcome).toEqual({ token: 'neutral', labelKey: null })
    expect(down).toEqual([])
    expect(livenessBadge('toString').labelKey).toBeNull()
  })
})
