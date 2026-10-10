import { describe, expect, it } from 'vitest'
import {
  DEAD_LETTER_REASONS,
  DEAD_LETTER_STAGES,
  HOUR_CELLS,
  type AgreementDay,
  type AgreementGapKind,
  type PassOutcome,
} from '@/core/models/sync-console'
import {
  AGREEMENT_PAGE_SIZE,
  HOUR_LEGEND,
  STORE_TABS,
  DEFAULT_MIRROR_FILTER,
  MIRROR_PAGE_SIZE,
  agreementQuery,
  applyRecheck,
  clampPassesFrom,
  dayVerdict,
  deadLetterReasonLabel,
  deadLetterStageLabel,
  gapKindLabel,
  hostBadge,
  hourCellLegend,
  isOnMirror,
  isWpfStore,
  mirrorQuery,
  passLineBadge,
  passOutcomeBadge,
  passesFromBound,
  recheckRefusalLabel,
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
  // 🚩 Changed on purpose by ticket 457 (Mirror appended: six → seven, two → three) and again by
  // 459 (Agreement appended after it: seven → eight, three → four).
  it('gives a worker store all eight tabs, in the prototype order, Mirror then Agreement last', () => {
    expect(storeTabs({ host: 'Worker' })).toEqual(['counters', 'passes', 'commands', 'scripts', 'audit', 'location', 'mirror', 'agreement'])
    expect(storeTabs({ host: 'Worker' })).toEqual(STORE_TABS)
  })

  it('gives a WPF store Counters and Passes, and its own mirror lane and rail agreement', () => {
    expect(storeTabs({ host: 'Wpf' })).toEqual(['counters', 'passes', 'mirror', 'agreement'])
    expect(isWpfStore({ host: 'Wpf' })).toBe(true)
    expect(isWpfStore({ host: 'Worker' })).toBe(false)
  })

  it('offers Mirror and Agreement to every store, on mirror or not', () => {
    for (const host of ['Worker', 'Wpf'] as const) {
      expect(storeTabs({ host })).toContain('mirror')
      expect(storeTabs({ host })).toContain('agreement')
    }
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

// ── Spec 2563, ticket 459: the Agreement tab ────────────────────────────────────

describe('gapKindLabel', () => {
  it('labels every AgreementGapKind, with its token: a missing receipt bad, a total mismatch a warning', () => {
    const kinds: AgreementGapKind[] = ['missingAtCounter', 'missingAtMirror', 'totalMismatch']
    for (const k of kinds) {
      expect(gapKindLabel(k).labelKey).toBe(`agreementTab.gapKinds.${k}`)
      expect(label(gapKindLabel(k).labelKey as string)).toEqual(expect.any(String))
    }
    expect(gapKindLabel('missingAtCounter').sev).toBe('bad')
    expect(gapKindLabel('missingAtMirror').sev).toBe('bad')
    expect(gapKindLabel('totalMismatch').sev).toBe('warn')
  })

  it('leaves a kind this bundle does not know neutral and unlabelled', () => {
    expect(gapKindLabel('missingEverywhere')).toEqual({ labelKey: null, sev: 'mute' })
    expect(gapKindLabel('constructor')).toEqual({ labelKey: null, sev: 'mute' })
  })
})

describe('recheckRefusalLabel', () => {
  it("words each of the recheck door's refusals, BAD_DATE included", () => {
    for (const code of ['BAD_DATE', 'BAD_REQUEST']) {
      expect(recheckRefusalLabel(code)).toBe(`agreementTab.recheck.refusals.${code}`)
      expect(label(recheckRefusalLabel(code) as string)).toEqual(expect.any(String))
    }
  })

  it("reuses the console's shared words for REASON_REQUIRED and NO_STORE", () => {
    for (const code of ['REASON_REQUIRED', 'NO_STORE']) {
      expect(recheckRefusalLabel(code)).toBe(`failures.${code}`)
      expect(label(recheckRefusalLabel(code) as string)).toEqual(expect.any(String))
    }
  })

  it('leaves any other code raw', () => {
    expect(recheckRefusalLabel('BOOM')).toBeNull()
    expect(recheckRefusalLabel('')).toBeNull()
  })
})

describe('dayVerdict', () => {
  it('reads a judged day as agree or disagree, never not judged', () => {
    expect(dayVerdict({ agrees: true })).toBe('agree')
    expect(dayVerdict({ agrees: false })).toBe('disagree')
    // Only a real `true` agrees.
    expect(dayVerdict({ agrees: 'true' as never })).toBe('disagree')
  })
})

describe('agreementQuery', () => {
  it('asks every gap at page 1 of 50, the day dropped when none is picked', () => {
    expect(agreementQuery('P001', null, 1)).toEqual({ code: 'P001', day: null, page: 1, pageSize: AGREEMENT_PAGE_SIZE })
    expect(AGREEMENT_PAGE_SIZE).toBe(50)
  })

  it('narrows to a picked day, as the door spells it, and never asks below page 1', () => {
    expect(agreementQuery('P001', '2026-10-08', 2)).toEqual({ code: 'P001', day: '2026-10-08', page: 2, pageSize: 50 })
    expect(agreementQuery('P001', null, 0).page).toBe(1)
    expect(agreementQuery('P001', null, 2.7).page).toBe(2)
  })
})

describe('applyRecheck', () => {
  const day = (businessDay: string, agrees: boolean, over: Partial<AgreementDay> = {}): AgreementDay => ({
    businessDay,
    judgedAt: `${businessDay}T03:00:00`,
    agrees,
    mirrorCount: 100,
    counterCount: agrees ? 100 : 99,
    mirrorTotal: 1234.5,
    counterTotal: agrees ? 1234.5 : 1200.25,
    missingAtCounter: agrees ? 0 : 1,
    missingAtMirror: 0,
    totalMismatches: 0,
    ...over,
  })
  // The door's order: newest first; 2026-10-05 had no NewPos receipt, so it is absent.
  const DAYS = [day('2026-10-08', false), day('2026-10-07', true), day('2026-10-06', false), day('2026-10-04', true)]
  const order = (days: AgreementDay[]) => days.map((d) => d.businessDay)

  it("replaces the rechecked day with the door's answer, in place", () => {
    const healed = day('2026-10-06', true, { judgedAt: '2026-10-10T09:12:00' })
    const next = applyRecheck(DAYS, '2026-10-06', healed)
    expect(order(next)).toEqual(['2026-10-08', '2026-10-07', '2026-10-06', '2026-10-04'])
    expect(next[2]).toBe(healed)
    // The others are the very same rows.
    expect(next[0]).toBe(DAYS[0])
    expect(next[3]).toBe(DAYS[3])
  })

  it('replaces the newest and the oldest day in place too', () => {
    expect(order(applyRecheck(DAYS, '2026-10-08', day('2026-10-08', true)))).toEqual(order(DAYS))
    expect(order(applyRecheck(DAYS, '2026-10-04', day('2026-10-04', false)))).toEqual(order(DAYS))
  })

  it('removes the day when the answer is null (no NewPos receipt that day)', () => {
    expect(order(applyRecheck(DAYS, '2026-10-07', null))).toEqual(['2026-10-08', '2026-10-06', '2026-10-04'])
    expect(applyRecheck([day('2026-10-08', false)], '2026-10-08', null)).toEqual([])
  })

  it('never mutates the list it was given', () => {
    const copy = [...DAYS]
    applyRecheck(DAYS, '2026-10-06', null)
    applyRecheck(DAYS, '2026-10-06', day('2026-10-06', true))
    expect(DAYS).toEqual(copy)
  })

  it('keeps the door order rather than re-sorting it', () => {
    // A list the door sent out of date order stays as sent around the replaced day.
    const odd = [day('2026-10-06', false), day('2026-10-08', false), day('2026-10-07', true)]
    expect(order(applyRecheck(odd, '2026-10-08', day('2026-10-08', true)))).toEqual(['2026-10-06', '2026-10-08', '2026-10-07'])
  })

  it('places an answer for a day the list did not hold by date, newest first', () => {
    expect(order(applyRecheck(DAYS, '2026-10-05', day('2026-10-05', true)))).toEqual([
      '2026-10-08',
      '2026-10-07',
      '2026-10-06',
      '2026-10-05',
      '2026-10-04',
    ])
    expect(order(applyRecheck(DAYS, '2026-10-03', day('2026-10-03', true))).slice(-1)).toEqual(['2026-10-03'])
    // …and a null answer for an unlisted day changes nothing.
    expect(order(applyRecheck(DAYS, '2026-10-05', null))).toEqual(order(DAYS))
  })

  it('never drops the rechecked day for an answer that names another day', () => {
    const other = day('2026-10-07', false)
    const next = applyRecheck(DAYS, '2026-10-06', other)
    expect(order(next)).toEqual(order(DAYS))
    expect(next[1]).toBe(other)
    expect(next[2]).toBe(DAYS[2])
  })
})
