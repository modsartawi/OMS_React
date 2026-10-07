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
import type { RecentRecord } from '@/core/commands/recent'
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
const openShortcuts = () => {}

const compose = (o: {
  probes?: ProbeState[]
  detail?: ProbeState
  query?: string
  commands?: Parameters<typeof commandRow>[0][]
  singleKeyScreen?: boolean
  recent?: RecentRecord[]
  member?: ProbeState
}) =>
  paletteGroups({
    commands: o.commands ?? [],
    singleKeyScreen: o.singleKeyScreen ?? false,
    openShortcuts,
    recent: o.recent ?? [],
    menu: resolveMenu(MENU, o.probes ?? ALL).items,
    detail: o.detail ?? granted({ canOpenList: true, canOpenDetail: true }),
    member: o.member ?? errored,
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
      singleKeyScreen: false,
      openShortcuts,
      recent: [],
      detail: granted({ canOpenDetail: true }),
      member: errored,
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
      singleKeyScreen: false,
      openShortcuts,
      recent: [],
      detail: granted({ canOpenDetail: true }),
      member: errored,
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
    expect(ids(compose({ probes: [pending, pending, pending, pending] }))).toEqual(['screen'])
  })

  it('when no page registered anything, This screen holds only the shortcuts row', () => {
    const groups = compose({})
    expect(ids(groups)).toEqual(['screen', 'goto'])
    expect(groups[0].rows.map((r) => r.id)).toEqual(['core:shortcuts'])
  })
})

describe('This screen and its keys (ticket 393)', () => {
  const screen = (o: Parameters<typeof compose>[0]) => compose(o).find((g) => g.id === 'screen')!.rows

  it('the shortcuts row sits last, after the page’s own commands, and opens the sheet', () => {
    let opened = 0
    const rows = paletteGroups({
      commands: [{ id: 'export', label: 'export', run: () => {} }],
      singleKeyScreen: false,
      openShortcuts: () => opened++,
      recent: [],
      menu: [],
      detail: errored,
      member: errored,
      query: '',
      textOf,
      navigate,
    })[0].rows
    expect(rows.map((r) => r.id)).toEqual(['screen:export', 'core:shortcuts'])
    rows[1].run?.()
    expect(opened).toBe(1)
  })

  it('the shortcuts row hints `?` only on a single-key screen, where `?` is live', () => {
    expect(screen({ singleKeyScreen: true }).at(-1)?.keys).toBe('Shift+Slash')
    expect(screen({ singleKeyScreen: false }).at(-1)?.keys).toBeNull()
  })

  it('a hidden command (J/K) binds but is never a palette row', () => {
    const rows = screen({
      singleKeyScreen: true,
      commands: [
        { id: 'next', label: 'next', keys: 'KeyJ', hidden: true, run: () => {} },
        { id: 'reschedule', label: 'reschedule', keys: 'KeyR', run: () => {} },
      ],
    })
    expect(rows.map((r) => r.id)).toEqual(['screen:reschedule', 'core:shortcuts'])
  })

  it('a row hints the key it is BOUND to — never one the registry refused', () => {
    const rows = screen({
      singleKeyScreen: true,
      commands: [
        { id: 'a', label: 'a', keys: 'KeyR', run: () => {} },
        { id: 'b', label: 'b', keys: 'KeyR', run: () => {} },
        { id: 'c', label: 'c', keys: 'Alt+KeyX', run: () => {} },
      ],
    })
    expect(rows.slice(0, 3).map((r) => [r.id, r.keys])).toEqual([
      ['screen:a', 'KeyR'],
      ['screen:b', null],
      ['screen:c', null],
    ])
  })

  it('off a single-key screen a letter binds nothing, so it hints nothing', () => {
    const rows = screen({ commands: [{ id: 'a', label: 'a', keys: 'KeyR', run: () => {} }] })
    expect(rows[0].keys).toBeNull()
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

describe('recentRefiltersByCurrentGrants', () => {
  const RECENT: RecentRecord[] = [
    { kind: 'delivery', no: '8000000175' },
    { kind: 'document', no: '1000000393' },
  ]

  it('with the detail grant, Recent sits between This screen and Go to, newest first', () => {
    const groups = compose({ recent: RECENT })
    expect(ids(groups)).toEqual(['screen', 'recent', 'goto'])
    const recent = groups.find((g) => g.id === 'recent')!.rows
    expect(recent.map((r) => [r.id, r.label, r.value])).toEqual([
      ['recent:delivery:8000000175', 'common:palette.jump.delivery', '8000000175'],
      ['recent:document:1000000393', 'common:palette.jump.document', '1000000393'],
    ])
  })

  it('choosing a row navigates to its route, where the page applies its own gate', () => {
    const went: string[] = []
    const rows = paletteGroups({
      commands: [],
      singleKeyScreen: false,
      openShortcuts,
      recent: RECENT,
      menu: [],
      detail: granted({ canOpenDetail: true }),
      member: errored,
      query: '',
      textOf,
      navigate: (to) => went.push(to),
    }).find((g) => g.id === 'recent')!.rows
    rows.forEach((r) => r.run?.())
    expect(went).toEqual(['/oms/delivery/8000000175', '/oms/document/1000000393'])
  })

  it('a typed number narrows Recent to the record that IS that number', () => {
    const recent = compose({ recent: RECENT, query: '8000000175' }).find((g) => g.id === 'recent')!.rows
    expect(recent.map((r) => r.id)).toEqual(['recent:delivery:8000000175'])
  })

  it('a number typed on an Arabic layout finds its Recent record', () => {
    const recent = compose({ recent: RECENT, query: '٨٠٠٠٠٠٠١٧٥' }).find((g) => g.id === 'recent')?.rows ?? []
    expect(recent.map((r) => r.id)).toEqual(['recent:delivery:8000000175'])
  })

  it('🚩 a number that is only PART of a recent one leaves Recent out, so Enter jumps to what was typed', () => {
    const groups = compose({ recent: RECENT, query: '800000017' })
    expect(ids(groups)).toEqual(['jump'])
    expect(groups[0].rows[0].id).toBe('jump:delivery')
  })

  it('words narrow Recent like any group', () => {
    const textOfLabel = (row: PaletteRow) => `${row.label} ${row.value ?? ''}`
    const rows = paletteGroups({
      commands: [],
      singleKeyScreen: false,
      openShortcuts,
      recent: RECENT,
      menu: [],
      detail: granted({ canOpenDetail: true }),
      member: errored,
      query: 'jump.document',
      textOf: textOfLabel,
      navigate,
    }).flatMap((g) => g.rows)
    expect(rows.map((r) => r.id)).toEqual(['recent:document:1000000393'])
  })

  // K12: re-filtered by the CURRENT grants — a revoked, pending or errored one hides the history.
  it.each([
    ['denied', granted({ canOpenList: true, canOpenDetail: false })],
    ['pending', pending],
    ['errored', errored],
    ['malformed', granted({ canOpenDetail: 'yes' })],
  ])('🚩 a %s detail grant hides Recent whole', (_, detail) => {
    expect(ids(compose({ recent: RECENT, detail }))).not.toContain('recent')
  })

  it('an empty store shows no Recent group', () => {
    expect(ids(compose({ recent: [] }))).toEqual(['screen', 'goto'])
  })
})

describe('memberJumpFollowsTheLoyProbe (ticket 427)', () => {
  const loyGranted = granted({ canOpenLoyMember: true })
  const noDetail = granted({ canOpenDetail: false })
  const groupsOf = (o: {
    query: string
    detail?: ProbeState
    member?: ProbeState
    navigate?: (to: string, state?: unknown) => void
  }) =>
    paletteGroups({
      commands: [],
      menu: [],
      singleKeyScreen: false,
      openShortcuts,
      recent: [],
      detail: o.detail ?? granted({ canOpenDetail: true }),
      member: o.member ?? loyGranted,
      query: o.query,
      textOf,
      navigate: o.navigate ?? navigate,
    })
  const jumpRowsOf = (o: Parameters<typeof groupsOf>[0]) => groupsOf(o).find((g) => g.id === 'jump')?.rows ?? []

  it('a bare number yields delivery, document, then the member — the member LAST', () => {
    expect(jumpRowsOf({ query: '80001237' }).map((r) => [r.id, r.label, r.value])).toEqual([
      ['jump:delivery', 'common:palette.jump.delivery', '80001237'],
      ['jump:document', 'common:palette.jump.document', '80001237'],
      ['jump:member', 'common:palette.jump.member', '80001237'],
    ])
  })

  it('a pasted mobile yields only the member row, which is therefore the aimed one', () => {
    const groups = groupsOf({ query: '+966 55 500 0111' })
    expect(ids(groups)).toEqual(['jump'])
    expect(groups[0].rows.map((r) => [r.id, r.value])).toEqual([['jump:member', '+966 55 500 0111']])
  })

  it('a Loy-only session sees the member row alone', () => {
    expect(jumpRowsOf({ query: '80001237', detail: noDetail }).map((r) => r.id)).toEqual(['jump:member'])
  })

  it('an Arabic layout’s number shows the member row with ASCII digits', () => {
    expect(jumpRowsOf({ query: '٠٥٥٥٠٠٠١١١', detail: noDetail }).map((r) => r.value)).toEqual(['0555000111'])
  })

  it('words never become a member row', () => {
    expect(jumpRowsOf({ query: 'members' })).toEqual([])
  })

  it.each([
    ['denied', granted({ canOpenLoyMember: false })],
    ['pending', pending],
    ['errored', errored],
    ['malformed', granted({ canOpenLoyMember: 'true' })],
  ])('🚩 a %s Loy probe hides the member row and leaves delivery/document alone', (_, member) => {
    expect(jumpRowsOf({ query: '80001237', member }).map((r) => r.id)).toEqual(['jump:delivery', 'jump:document'])
  })

  it('🚩 the member row navigates to the lookup with the key in router STATE, never the URL', () => {
    const went: [string, unknown][] = []
    const row = jumpRowsOf({
      query: ' +966 55 500 0111 ',
      detail: noDetail,
      navigate: (to, state) => went.push([to, state]),
    })[0]
    row.run?.()
    expect(went).toEqual([['/loy/members', { lookup: '+966 55 500 0111' }]])
  })

  it('🚩 Recent never holds a member: only delivery and document records are drawn', () => {
    const groups = compose({ recent: [{ kind: 'delivery', no: '80001237' }], query: '80001237' })
    expect(groups.find((g) => g.id === 'recent')!.rows.map((r) => r.id)).toEqual(['recent:delivery:80001237'])
  })
})
