/**
 * The app-wide palette's groups, composed where the app composes them (ticket 392,
 * spec 380 K8, K10–K12; ruling 364 §1–§2): the registered commands, the menu the rail
 * draws and the detail grant in; the groups out, in the one order, each behind its gate.
 *
 * 🚩 The negatives are the point. A pending or an errored probe must HIDE what it gates
 * (fail closed), never show it while the answer is on its way.
 */
import { describe, expect, it } from 'vitest'
import { commandRow, type PaletteRow } from '@/core/commands/palette-model'
import { accessProbe, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'
import { gotoRows, paletteGroups } from './palette-groups'

const granted = (data: unknown): ProbeState => ({ isPending: false, isSuccess: true, data })
const pending: ProbeState = { isPending: true, isSuccess: false, data: undefined }
const errored: ProbeState = { isPending: false, isSuccess: false, data: undefined }

const probe = accessProbe<{ ok: boolean }>({ key: ['t'], run: async () => ({ ok: true }), visible: (r) => r.ok })

const MENU: ShellMenuItem[] = [
  {
    labelKey: 'g:oms',
    items: [
      { labelKey: 'g:deliveries', routerLink: '/oms/deliveries', access: probe },
      { labelKey: 'g:invoices', routerLink: '/oms/central-invoices', access: probe },
    ],
  },
  {
    labelKey: 'g:collections',
    items: [
      { labelKey: 'g:collections.cash', routerLink: '/collection/collections', access: probe },
      {
        labelKey: 'g:settlement',
        items: [{ labelKey: 'g:settlement.ledger', routerLink: '/collection/settlement/ledger', access: probe }],
      },
    ],
  },
]
const ALL = [true, true, true, true].map((ok) => granted({ ok }))

const textOf = (row: PaletteRow) => `${row.label} ${row.value ?? ''}`
const navigate = () => {}

const compose = (o: {
  probes?: ProbeState[]
  detail?: ProbeState
  query?: string
  commands?: Parameters<typeof commandRow>[0][]
}) =>
  paletteGroups({
    commands: o.commands ?? [],
    menu: resolveMenu(MENU, o.probes ?? ALL).items,
    detail: o.detail ?? granted({ canOpenList: true, canOpenDetail: true }),
    query: o.query ?? '',
    textOf,
    navigate,
  })

const ids = (groups: ReturnType<typeof compose>) => groups.map((g) => g.id)

describe('paletteGroupsComposeInOrderAndFailClosed', () => {
  it('with an empty box the order is This screen → Go to, and there is no Jump', () => {
    const groups = compose({ commands: [{ id: 'export', label: 'export', run: () => {} }] })
    expect(ids(groups)).toEqual(['screen', 'goto'])
  })

  it('a typed number adds Jump after them: Open delivery N, then Open document N', () => {
    const groups = paletteGroups({
      commands: [{ id: 'copy', label: 'copy 8000000174' }],
      menu: [{ labelKey: 'history of 8000000174', routerLink: '/x' }],
      detail: granted({ canOpenDetail: true }),
      query: '8000000174',
      textOf,
      navigate,
    })
    expect(ids(groups)).toEqual(['screen', 'goto', 'jump'])
    const jump = groups.find((g) => g.id === 'jump')!.rows
    expect(jump.map((r) => [r.id, r.value])).toEqual([
      ['jump:delivery', '8000000174'],
      ['jump:document', '8000000174'],
    ])
  })

  it('the Jump rows navigate straight to the two existing routes, with no read', () => {
    const went: string[] = []
    const jump = paletteGroups({
      commands: [],
      menu: [],
      detail: granted({ canOpenDetail: true }),
      query: '8000000174',
      textOf,
      navigate: (to) => went.push(to),
    }).flatMap((g) => g.rows)
    jump.forEach((r) => r.run?.())
    expect(went).toEqual(['/oms/delivery/8000000174', '/oms/document/8000000174'])
  })

  it('a query that is not a number yields no Jump rows', () => {
    expect(ids(compose({ query: 'deliv' }))).toEqual(['goto'])
    expect(ids(compose({ query: '8000 deliv' }))).not.toContain('jump')
  })

  // K11 + K12: Jump lands on Delivery details, so it follows `canOpenDetail`.
  it.each([
    ['denied', granted({ canOpenList: true, canOpenDetail: false })],
    ['pending', pending],
    ['errored', errored],
    ['malformed', granted({ canOpenDetail: 'yes' })],
  ])('🚩 a %s detail grant hides Jump', (_, detail) => {
    expect(ids(compose({ query: '8000000174', detail }))).not.toContain('jump')
  })

  // K10: Go to reads the very menu the rail draws — `resolveMenu`, the probes it fails closed on.
  it('Go to lists every leaf the rail shows, nested sub-groups included', () => {
    const goto = compose({}).find((g) => g.id === 'goto')!.rows
    expect(goto.map((r) => r.id)).toEqual([
      'goto:/oms/deliveries',
      'goto:/oms/central-invoices',
      'goto:/collection/collections',
      'goto:/collection/settlement/ledger',
    ])
  })

  it.each([
    ['denied', granted({ ok: false })],
    ['pending', pending],
    ['errored', errored],
  ])('🚩 a %s menu probe hides its Go to row', (_, state) => {
    const goto = compose({ probes: [state, ...ALL.slice(1)] }).find((g) => g.id === 'goto')!.rows
    expect(goto.map((r) => r.id)).not.toContain('goto:/oms/deliveries')
    expect(goto).toHaveLength(3)
  })

  it('🚩 with every probe pending, the Go to group is hidden whole', () => {
    expect(ids(compose({ probes: [pending, pending, pending, pending] }))).toEqual([])
  })

  it('This screen is absent when no page registered anything', () => {
    expect(ids(compose({}))).toEqual(['goto'])
  })
})

describe('gotoRows', () => {
  it('names each leaf by its own label, under the group it sits in', () => {
    const rows = gotoRows(resolveMenu(MENU, ALL).items, navigate)
    expect(rows[0]).toMatchObject({ label: 'g:deliveries', context: 'g:oms', enabled: true })
    // A leaf inside a sub-group is named by the sub-group it sits in.
    expect(rows[3]).toMatchObject({ label: 'g:settlement.ledger', context: 'g:settlement' })
  })

  it('a row navigates to its leaf', () => {
    const went: string[] = []
    gotoRows(resolveMenu(MENU, ALL).items, (to) => went.push(to))[1].run?.()
    expect(went).toEqual(['/oms/central-invoices'])
  })
})
