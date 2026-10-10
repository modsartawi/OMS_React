import { describe, expect, it } from 'vitest'
import { DEAD_LETTER_REASONS, DEAD_LETTER_STAGES, HOUR_CELLS, type PassOutcome } from '@/core/models/sync-console'
import {
  HOUR_LEGEND,
  STORE_TABS,
  DEFAULT_MIRROR_FILTER,
  MIRROR_PAGE_SIZE,
  clampPassesFrom,
  deadLetterReasonLabel,
  deadLetterStageLabel,
  hostBadge,
  hourCellLegend,
  isOnMirror,
  isWpfStore,
  mirrorQuery,
  passLineBadge,
  passOutcomeBadge,
  passesFromBound,
  resolveStoreTab,
  scriptBadge,
  storeTabs,
} from './store-helpers'
import en from '@/locales/en/sync-console.json'

/** Read a dotted key out of the en bundle, so a label key that renders raw fails here. */
const label = (key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en)

describe('hourCellLegend', () => {
  it('maps every HourCell to a token colour and a label that exists', () => {
    for (const cell of HOUR_CELLS) {
      const entry = hourCellLegend(cell)
      expect(entry.cell).toBe(cell)
      expect(entry.swatch).toMatch(/^bg-(success|attention|danger|muted)(\/\d+)?$/)
      expect(label(entry.labelKey)).toEqual(expect.any(String))
    }
  })

  it('gives the five cells five different swatches', () => {
    expect(new Set(HOUR_CELLS.map((c) => hourCellLegend(c).swatch)).size).toBe(5)
  })

  it('reads an unknown cell as noData', () => {
    expect(hourCellLegend('melting')).toEqual(hourCellLegend('noData'))
    expect(hourCellLegend('toString').cell).toBe('noData')
  })

  it('lists the legend in the contract order', () => {
    expect(HOUR_LEGEND.map((e) => e.cell)).toEqual([...HOUR_CELLS])
  })
})

describe('passesFromBound', () => {
  const today = new Date(2026, 9, 9, 23, 30) // 2026-10-09, late in the local day

  it('bounds the picker to the last 30 days and opens on 7 days ago, from the LOCAL date', () => {
    expect(passesFromBound(today)).toEqual({ min: '2026-09-09', max: '2026-10-09', initial: '2026-10-02' })
  })

  it('crosses a month and a year boundary by the calendar', () => {
    expect(passesFromBound(new Date(2026, 0, 5)).min).toBe('2025-12-06')
    expect(passesFromBound(new Date(2024, 2, 1)).min).toBe('2024-01-31')
  })

  it('cannot go past 30 days: an older pick is pulled back to the bound', () => {
    expect(clampPassesFrom('2026-09-08', today)).toBe('2026-09-09')
    expect(clampPassesFrom('2020-01-01', today)).toBe('2026-09-09')
  })

  it('keeps a pick inside the window, including both ends', () => {
    expect(clampPassesFrom('2026-09-09', today)).toBe('2026-09-09')
    expect(clampPassesFrom('2026-09-20', today)).toBe('2026-09-20')
    expect(clampPassesFrom('2026-10-09', today)).toBe('2026-10-09')
  })

  it('pulls a future pick back to today', () => {
    expect(clampPassesFrom('2026-10-10', today)).toBe('2026-10-09')
  })

  it('sends a cleared or unreadable box back to the opening date', () => {
    expect(clampPassesFrom('', today)).toBe('2026-10-02')
    expect(clampPassesFrom('not a date', today)).toBe('2026-10-02')
  })
})

describe('storeTabs', () => {
  // 🚩 Changed on purpose by ticket 457: the Mirror tab is appended to both lists (six → seven, two → three).
  it('gives a worker store all seven tabs, in the prototype order, Mirror last', () => {
    expect(storeTabs({ host: 'Worker' })).toEqual(['counters', 'passes', 'commands', 'scripts', 'audit', 'location', 'mirror'])
    expect(storeTabs({ host: 'Worker' })).toEqual(STORE_TABS)
  })

  it('gives a WPF store Counters and Passes, and its own mirror lane', () => {
    expect(storeTabs({ host: 'Wpf' })).toEqual(['counters', 'passes', 'mirror'])
    expect(isWpfStore({ host: 'Wpf' })).toBe(true)
    expect(isWpfStore({ host: 'Worker' })).toBe(false)
  })

  it('offers Mirror to every store, on mirror or not', () => {
    for (const host of ['Worker', 'Wpf'] as const) expect(storeTabs({ host })).toContain('mirror')
  })

  it('reads Store/Mirror only for a store on mirror; onMirror false shows not-on-mirror', () => {
    expect(isOnMirror({ mirror: { onMirror: true } as never })).toBe(true)
    expect(isOnMirror({ mirror: { onMirror: false } as never })).toBe(false)
    // A lane the door did not send is not one to read.
    expect(isOnMirror({ mirror: undefined as never })).toBe(false)
    // Only a real `true` is on mirror: a malformed lane is not.
    expect(isOnMirror({ mirror: { onMirror: 'true' } as never })).toBe(false)
    expect(label('mirrorTab.notOnMirror')).toEqual(expect.any(String))
  })

  it('labels every tab', () => {
    for (const tab of STORE_TABS) expect(label(`tabs.${tab}`)).toEqual(expect.any(String))
  })
})

describe('dead-letter labels', () => {
  it('labels every stage', () => {
    for (const stage of DEAD_LETTER_STAGES) {
      const badge = deadLetterStageLabel(stage)
      expect(badge.labelKey).toBe(`mirrorTab.stages.${stage}`)
      expect(label(badge.labelKey as string)).toEqual(expect.any(String))
    }
  })

  it('labels every reason', () => {
    for (const reason of DEAD_LETTER_REASONS) {
      const badge = deadLetterReasonLabel(reason)
      expect(badge.labelKey).toBe(`mirrorTab.reasons.${reason}`)
      expect(label(badge.labelKey as string)).toEqual(expect.any(String))
    }
  })

  it('leaves an unknown stage or reason neutral and unlabelled, so its raw code shows', () => {
    expect(deadLetterStageLabel('store')).toEqual({ labelKey: null, sev: 'mute' })
    expect(deadLetterReasonLabel('melted')).toEqual({ labelKey: null, sev: 'mute' })
    expect(deadLetterReasonLabel('toString')).toEqual({ labelKey: null, sev: 'mute' })
  })
})

describe('mirrorQuery', () => {
  it('asks for both stages, every reason, open dead letters only, at 50 a page by default', () => {
    expect(mirrorQuery('P001', DEFAULT_MIRROR_FILTER, 1)).toEqual({
      code: 'P001',
      stage: null,
      reason: null,
      includeAcknowledged: false,
      page: 1,
      pageSize: 50,
    })
    expect(MIRROR_PAGE_SIZE).toBe(50)
  })

  it('carries the filters and the page, never below 1', () => {
    expect(mirrorQuery('P001', { stage: 'apply', reason: 'orphaned', includeAcknowledged: true }, 2)).toMatchObject({
      stage: 'apply',
      reason: 'orphaned',
      includeAcknowledged: true,
      page: 2,
    })
    expect(mirrorQuery('P001', DEFAULT_MIRROR_FILTER, 0).page).toBe(1)
  })
})

describe('hostBadge', () => {
  it('labels both hosts, the worker in motion and WPF neutral', () => {
    expect(hostBadge('Worker')).toEqual({ labelKey: 'hosts.Worker', sev: 'go' })
    expect(hostBadge('Wpf')).toEqual({ labelKey: 'hosts.Wpf', sev: 'mute' })
    for (const h of ['Worker', 'Wpf']) expect(label(hostBadge(h).labelKey as string)).toEqual(expect.any(String))
  })

  it('leaves an unknown host neutral and unlabelled, so its raw code shows', () => {
    expect(hostBadge('None')).toEqual({ labelKey: null, sev: 'mute' })
  })
})

describe('resolveStoreTab', () => {
  it('opens the asked tab when the store offers it', () => {
    expect(resolveStoreTab('scripts', STORE_TABS)).toBe('scripts')
  })

  it('falls back to the first tab for a missing, unknown or withheld one', () => {
    expect(resolveStoreTab(null, STORE_TABS)).toBe('counters')
    expect(resolveStoreTab('sql', STORE_TABS)).toBe('counters')
    // A link to Scripts on a WPF store lands on Counters, not an empty panel.
    expect(resolveStoreTab('scripts', storeTabs({ host: 'Wpf' }))).toBe('counters')
  })
})

describe('pass badges', () => {
  it('labels every outcome, failed as bad and a partial pass as a warning', () => {
    const outcomes: PassOutcome[] = ['Ok', 'Partial', 'Failed', 'Skipped', 'None']
    for (const o of outcomes) expect(label(passOutcomeBadge(o).labelKey as string)).toEqual(expect.any(String))
    expect(passOutcomeBadge('Ok').sev).toBe('ok')
    expect(passOutcomeBadge('Partial').sev).toBe('warn')
    expect(passOutcomeBadge('Failed').sev).toBe('bad')
  })

  it('leaves an unknown outcome or line status neutral and unlabelled', () => {
    expect(passOutcomeBadge('Exploded')).toEqual({ labelKey: null, sev: 'mute' })
    expect(passLineBadge('Maybe')).toEqual({ labelKey: null, sev: 'mute' })
  })

  it('reads a detail line as ok or bad', () => {
    expect(passLineBadge('Ok').sev).toBe('ok')
    expect(passLineBadge('Error').sev).toBe('bad')
    expect(label(passLineBadge('Error').labelKey as string)).toEqual(expect.any(String))
  })
})

describe('scriptBadge', () => {
  it('reads executed as ok, an unexecuted script with an error as failed, else not run yet', () => {
    expect(scriptBadge({ isExecuted: true, errorMessage: 'old error' })).toEqual({ labelKey: 'scripts.executed', sev: 'ok' })
    expect(scriptBadge({ isExecuted: false, errorMessage: 'Invalid column' })).toEqual({ labelKey: 'scripts.failed', sev: 'bad' })
    expect(scriptBadge({ isExecuted: false, errorMessage: null })).toEqual({ labelKey: 'scripts.notExecuted', sev: 'mute' })
    for (const key of ['scripts.executed', 'scripts.failed', 'scripts.notExecuted']) expect(label(key)).toEqual(expect.any(String))
  })
})
