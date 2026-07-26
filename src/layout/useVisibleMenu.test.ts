import { describe, expect, it } from 'vitest'
import { accessProbe, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

// Ticket 124: the settled flag. `resolveMenu` is the pure half of `useVisibleMenu` —
// the hook only feeds it `useQueries`' results, so every rule about WHAT is visible and
// WHEN the answer is trustworthy is provable here, with no renderer.

const probe = (visible: boolean) =>
  accessProbe<{ canOpen: boolean }>({
    key: ['t', String(visible)],
    run: async () => ({ canOpen: true }),
    visible: (r) => r.canOpen === visible,
  })

/** Two gated leaves under one group, plus an ungated group. */
const MENU: ShellMenuItem[] = [
  { labelKey: 'g.open', items: [{ labelKey: 'l.open', routerLink: '/open' }] },
  {
    labelKey: 'g.gated',
    items: [
      { labelKey: 'l.a', routerLink: '/a', access: probe(true) },
      { labelKey: 'l.b', routerLink: '/b', access: probe(true) },
    ],
  },
]

const pending: ProbeState = { isPending: true, isSuccess: false, data: undefined }
const ok: ProbeState = { isPending: false, isSuccess: true, data: { canOpen: true } }
const errored: ProbeState = { isPending: false, isSuccess: false, data: undefined }

const labels = (items: ShellMenuItem[]): string[] =>
  items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

describe('resolveMenu — settled', () => {
  it('is false while ANY probe is still pending', () => {
    expect(resolveMenu(MENU, [pending, pending]).settled).toBe(false)
    expect(resolveMenu(MENU, [ok, pending]).settled).toBe(false)
  })

  it('is true once every probe has resolved', () => {
    expect(resolveMenu(MENU, [ok, ok]).settled).toBe(true)
  })

  it('is true when a probe ERRORED — an errored probe must not hang the flag forever', () => {
    expect(resolveMenu(MENU, [errored, errored]).settled).toBe(true)
    expect(resolveMenu(MENU, [ok, errored]).settled).toBe(true)
  })

  it('is true immediately when the menu has no gated items at all', () => {
    expect(resolveMenu([MENU[0]], []).settled).toBe(true)
  })

  it('is false when the results array has not caught up with the gated items', () => {
    // Defensive: a short/absent result is "not answered yet", never "answered no".
    expect(resolveMenu(MENU, []).settled).toBe(false)
    expect(resolveMenu(MENU, [ok]).settled).toBe(false)
  })
})

describe('resolveMenu — items', () => {
  it('keeps the ungated group and both granted leaves', () => {
    expect(labels(resolveMenu(MENU, [ok, ok]).items)).toEqual([
      'g.open',
      'l.open',
      'g.gated',
      'l.a',
      'l.b',
    ])
  })

  it('drops a group whose gated children all failed closed', () => {
    expect(labels(resolveMenu(MENU, [errored, errored]).items)).toEqual(['g.open', 'l.open'])
  })

  it('hides a gated leaf while its probe is pending (no flash-then-hide)', () => {
    expect(labels(resolveMenu(MENU, [pending, ok]).items)).toEqual([
      'g.open',
      'l.open',
      'g.gated',
      'l.b',
    ])
  })

  it('hides a leaf whose probe resolved to a DENIAL', () => {
    const denied: ShellMenuItem[] = [
      { labelKey: 'g', items: [{ labelKey: 'l', routerLink: '/l', access: probe(false) }] },
    ]
    const r = resolveMenu(denied, [ok])
    expect(r.items).toEqual([])
    expect(r.settled).toBe(true)
  })

  it('reports an EMPTY menu as settled — the empty-state case ticket 124 exists for', () => {
    const allGated: ShellMenuItem[] = [
      { labelKey: 'g', items: [{ labelKey: 'l', routerLink: '/l', access: probe(true) }] },
    ]
    const r = resolveMenu(allGated, [errored])
    expect(r.items).toEqual([])
    expect(r.settled).toBe(true)
  })
})
