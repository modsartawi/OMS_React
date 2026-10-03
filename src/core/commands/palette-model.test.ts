/**
 * The app-wide palette's rows, asserted at the module's edge (ticket 392, spec 380
 * K7–K13): what a registered command becomes, what a typed number yields, what the
 * aim and `Enter` reach, and which routes opt out of the palette altogether.
 *
 * The group ORDER and each group's GATE are asserted in `layout/palette-groups.test.ts`,
 * where the app-wide groups are composed from the menu and the probes.
 */
import { describe, expect, it } from 'vitest'
import { NO_HIGHLIGHT } from './highlight'
import {
  commandRow,
  composePalette,
  jumpNumberOf,
  paletteAim,
  paletteOptedOut,
  paletteQuestion,
  paletteRun,
  screenRows,
  shortcutsRow,
  singleKeyScreenOf,
  type PaletteRow,
} from './palette-model'
import { bindKeys } from './keys'

const textOf = (row: PaletteRow) => `${row.label} ${row.value ?? ''}`

const gotoRow = (path: string): PaletteRow => ({
  id: `goto:${path}`,
  group: 'goto',
  label: path,
  context: null,
  value: null,
  icon: null,
  enabled: true,
  reason: null,
  run: () => {},
})

describe('disabledCommandCarriesItsReason', () => {
  it('a command with a handler is an enabled row that runs that very handler', () => {
    const run = () => {}
    const row = commandRow({ id: 'export', label: 'deliveries:export', run })
    expect(row).toMatchObject({ id: 'screen:export', group: 'screen', enabled: true, reason: null })
    expect(row.run).toBe(run)
  })

  // 🚩 K2/K13: enablement IS the handler being present — there is no second predicate.
  it('a command without a handler is a DISABLED row carrying its reason', () => {
    const row = commandRow({ id: 'reschedule', label: 'document:reschedule', reason: 'document:noRow' })
    expect(row.enabled).toBe(false)
    expect(row.run).toBeNull()
    expect(row.reason).toBe('document:noRow')
  })

  it('a null handler is the same refusal as an absent one', () => {
    expect(commandRow({ id: 'x', label: 'k', run: null, reason: 'r' }).enabled).toBe(false)
  })

  it('an enabled row carries no reason even when the page passed one', () => {
    expect(commandRow({ id: 'x', label: 'k', run: () => {}, reason: 'r' }).reason).toBeNull()
  })

  it('it composes into This screen, stays aimable, and choosing it is a no-op', () => {
    const refused = commandRow({ id: 'reschedule', label: 'reschedule', reason: 'why' })
    const rows = composePalette({ screen: [refused], recent: [], goto: [], jump: [], query: '', textOf }).flatMap(
      (g) => g.rows,
    )
    expect(rows).toEqual([refused])
    // The aim lands on it (the reason is the answer to the question asked)…
    const aim = paletteAim(NO_HIGHLIGHT, rows, paletteQuestion(rows, ''))
    expect(aim).toBe(0)
    // …and `Enter` reaches nothing.
    expect(paletteRun(rows, aim)).toBeNull()
  })
})

describe('jumpNumberOf', () => {
  it('reads a typed number, trimmed', () => {
    expect(jumpNumberOf(' 8000000174 ')).toBe('8000000174')
  })

  it('anything that is not wholly digits is no number', () => {
    expect(jumpNumberOf('')).toBeNull()
    expect(jumpNumberOf('   ')).toBeNull()
    expect(jumpNumberOf('80001 238')).toBeNull()
    expect(jumpNumberOf('8000-1238')).toBeNull()
    expect(jumpNumberOf('delivery 8000')).toBeNull()
    expect(jumpNumberOf('-5')).toBeNull()
  })

  // An Arabic layout's digit row may type Arabic-Indic digits; the route takes ASCII.
  it('folds Arabic-Indic and Persian digits to ASCII', () => {
    expect(jumpNumberOf('٨٠٠٠١٢٣٨')).toBe('80001238')
    expect(jumpNumberOf('۸۰۰۰۱۲۳۸')).toBe('80001238')
  })
})

describe('composePalette', () => {
  it('filters This screen and Go to by the typed words, and drops an emptied group', () => {
    const groups = composePalette({
      screen: [commandRow({ id: 'export', label: 'export view', run: () => {} })],
      recent: [],
      goto: [gotoRow('deliveries'), gotoRow('simulation')],
      jump: [],
      query: 'simul',
      textOf,
    })
    expect(groups.map((g) => g.id)).toEqual(['goto'])
    expect(groups[0].rows.map((r) => r.id)).toEqual(['goto:simulation'])
  })

  // K8 (394): This screen → Recent → Go to → Jump, and a Recent row is narrowed by its number.
  it('lists Recent between This screen and Go to, narrowed by the typed number', () => {
    const recent = (no: string): PaletteRow => ({ ...gotoRow(no), id: `recent:delivery:${no}`, group: 'recent', value: no })
    const jump = { ...gotoRow('x'), id: 'jump:delivery', group: 'jump' as const }
    const all = composePalette({
      screen: [commandRow({ id: 'export', label: 'export', run: () => {} })],
      recent: [recent('8000000174'), recent('8000000175')],
      goto: [gotoRow('deliveries')],
      jump: [],
      query: '',
      textOf,
    })
    expect(all.map((g) => g.id)).toEqual(['screen', 'recent', 'goto'])
    const typed = composePalette({
      screen: [],
      recent: [recent('8000000174'), recent('8000000175')],
      goto: [],
      jump: [jump],
      query: '8000000175',
      textOf,
    })
    expect(typed.map((g) => [g.id, g.rows.map((r) => r.id)])).toEqual([
      ['recent', ['recent:delivery:8000000175']],
      ['jump', ['jump:delivery']],
    ])
  })

  // The Jump rows ARE the typed number: filtering them by it would be circular.
  it('never filters the Jump rows by the query that produced them', () => {
    const jump = { ...gotoRow('x'), id: 'jump:delivery', group: 'jump' as const, label: 'Open delivery' }
    const groups = composePalette({ screen: [], recent: [], goto: [], jump: [jump], query: '8000', textOf })
    expect(groups.map((g) => g.id)).toEqual(['jump'])
  })

  it('the first row is aimed from the start, and Enter runs it', () => {
    const rows = composePalette({ screen: [], recent: [], goto: [gotoRow('a'), gotoRow('b')], jump: [], query: '', textOf })
      .flatMap((g) => g.rows)
    const aim = paletteAim(NO_HIGHLIGHT, rows, paletteQuestion(rows, ''))
    expect(aim).toBe(0)
    expect(paletteRun(rows, aim)?.id).toBe('goto:a')
  })

  it('an empty answer aims at nothing', () => {
    expect(paletteAim(NO_HIGHLIGHT, [], paletteQuestion([], 'zzz'))).toBeNull()
    expect(paletteRun([], null)).toBeNull()
  })
})

describe('paletteOptedOut', () => {
  // 375 R4: an explicit flag on the route, never `chromeless`.
  it('a print route opts out through its route flag', () => {
    expect(paletteOptedOut([undefined, { print: true }])).toBe(true)
  })

  it('the console opts out through the same mechanism until 395', () => {
    expect(paletteOptedOut([{ ownPalette: true }, undefined])).toBe(true)
  })

  it('every other route hosts it, whatever else its handle carries', () => {
    expect(paletteOptedOut([])).toBe(false)
    expect(paletteOptedOut([undefined, null, 'x', { print: false }, { crumb: 'y' }])).toBe(false)
  })
})

describe('the This screen rows and their keys (ticket 393)', () => {
  const LIST = { singleKeyScreen: true }

  it('a hidden command is never a row; the others hint the key they are bound to', () => {
    const commands = [
      { id: 'next', label: 'n', keys: 'KeyJ', hidden: true, run: () => {} },
      { id: 'reschedule', label: 'r', keys: 'KeyR', run: () => {} },
      { id: 'export', label: 'e', run: () => {} },
    ]
    const rows = screenRows(commands, bindKeys(commands, LIST))
    expect(rows.map((r) => [r.id, r.keys])).toEqual([
      ['screen:reschedule', 'KeyR'],
      ['screen:export', null],
    ])
  })

  it('a refused key hints nothing on its row', () => {
    const commands = [{ id: 'save', label: 's', keys: 'Ctrl+KeyS', run: () => {} }]
    expect(screenRows(commands, bindKeys(commands, LIST))[0].keys).toBeNull()
  })

  it('the shortcuts row opens the sheet, and hints `?` only where `?` is live', () => {
    let opened = 0
    const row = shortcutsRow(() => opened++, LIST)
    expect(row).toMatchObject({ id: 'core:shortcuts', group: 'screen', enabled: true, keys: 'Shift+Slash' })
    row.run?.()
    expect(opened).toBe(1)
    expect(shortcutsRow(() => {}, { singleKeyScreen: false }).keys).toBeNull()
  })
})

describe('singleKeyScreenOf', () => {
  it('is true when a matched route flags single keys, read defensively', () => {
    expect(singleKeyScreenOf([undefined, { singleKeys: true }])).toBe(true)
    expect(singleKeyScreenOf([{ print: true }, null, 'x', { singleKeys: 'yes' }])).toBe(false)
    expect(singleKeyScreenOf([])).toBe(false)
  })
})
