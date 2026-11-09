/**
 * Oms 852 (BackOffice 3459): every leaf of the five once-ungated areas — Campaigns, the store engine switch, Insurance
 * rules, HQ prescription sessions and Send Broadcast — is hidden until its Access probe says yes.
 *
 * Read out of the REAL `MENU` through the real `resolveMenu`, answering each gated item by its probe KEY, as the
 * shared react-query cache does at runtime. The network is stubbed at the `@/core/api` boundary for the Broadcast
 * probe's 404.
 */
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn(), postJsonBlob: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { MENU } = await import('./menu-model')
const { resolveMenu } = await import('./useVisibleMenu')
const { RULES_ACCESS_KEY } = await import('@/core/rules/access')
const { INSURANCE_RULES_ACCESS_KEY, INSURANCE_RULES_FLAGS } = await import('@/core/insurance-rules/access')
const { PRESCRIPTION_SESSION_ACCESS_KEY } = await import('@/features/oms/prescription-sessions/access')
const { broadcastApi } = await import('@/features/admin/broadcast/api')

type Item = (typeof MENU)[number]
type State = { isPending: boolean; isSuccess: boolean; data: unknown }

const BROADCAST_KEY = ['broadcast', 'access'] as const
const keyOf = (k: readonly unknown[]) => JSON.stringify(k)
const PROBE_KEYS = [RULES_ACCESS_KEY, INSURANCE_RULES_ACCESS_KEY, PRESCRIPTION_SESSION_ACCESS_KEY, BROADCAST_KEY].map(keyOf)

const gated = (items: Item[]): Item[] => items.flatMap((i) => [...(i.access ? [i] : []), ...gated(i.items ?? [])])
const leaves = (items: Item[]): Item[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))

const answered = (data: unknown): State => ({ isPending: false, isSuccess: true, data })
const errored: State = { isPending: false, isSuccess: false, data: undefined }
const pending: State = { isPending: true, isSuccess: false, data: undefined }

/** Every gated item answered by its key; every probe outside the five areas errors, so only the five can show. */
function visibleLeaves(byKey: Record<string, State>): string[] {
  const states = gated(MENU).map((i) => byKey[keyOf(i.access!.key)] ?? errored)
  return leaves(resolveMenu(MENU, states).items).map((l) => l.labelKey)
}

const RULES_NONE = { canAuthor: false, canApprove: false, canSupport: false, canSwitchEngine: false }
const INS_NONE = Object.fromEntries(INSURANCE_RULES_FLAGS.map((f) => [f, false]))
const ALL_FALSE: Record<string, State> = {
  [keyOf(RULES_ACCESS_KEY)]: answered(RULES_NONE),
  [keyOf(INSURANCE_RULES_ACCESS_KEY)]: answered(INS_NONE),
  [keyOf(PRESCRIPTION_SESSION_ACCESS_KEY)]: answered({ canView: false, canWriteOff: false }),
  [keyOf(BROADCAST_KEY)]: answered({ allowed: false }),
}

const AUTHORING = ['campaigns:menu.promotions', 'campaigns:menu.priority', 'campaigns:menu.simulator', 'campaigns:menu.uploads']
const SUPPORT = ['campaigns:menu.sessions', 'campaigns:menu.couponFinder', 'campaigns:menu.customers']

describe('852 — the five areas hide until their probe says yes', () => {
  it('every leaf of the five areas carries a probe on one of their four keys', () => {
    const groups = MENU.filter((g) => g.labelKey === 'campaigns:menu.group' || g.labelKey === 'insurance-rules:menu.group')
    expect(groups).toHaveLength(2)
    for (const leaf of leaves(groups)) expect(PROBE_KEYS).toContain(keyOf(leaf.access!.key))
    const named = ['engine-switch:menu.engineSwitch', 'prescription-sessions:menu.prescriptionSessions', 'broadcast:menu.sendBroadcast']
    for (const label of named) expect(PROBE_KEYS).toContain(keyOf(leaves(MENU).find((l) => l.labelKey === label)!.access!.key))
  })

  it('one call per area: the nine rule-engine leaves share ONE key, the insurance leaves another', () => {
    const onKey = (k: readonly unknown[]) => gated(MENU).filter((i) => keyOf(i.access!.key) === keyOf(k))
    expect(onKey(RULES_ACCESS_KEY)).toHaveLength(9)
    expect(onKey(INSURANCE_RULES_ACCESS_KEY)).toHaveLength(INSURANCE_RULES_FLAGS.length)
  })

  it('a probe set of all-false shows none of the five areas — both groups drop', () => {
    expect(visibleLeaves(ALL_FALSE)).toEqual([])
    const groups = resolveMenu(MENU, gated(MENU).map((i) => ALL_FALSE[keyOf(i.access!.key)] ?? errored)).items.map((g) => g.labelKey)
    expect(groups).not.toContain('campaigns:menu.group')
    expect(groups).not.toContain('insurance-rules:menu.group')
  })

  it.each([
    ['canAuthor', [...AUTHORING, 'campaigns:menu.upload']],
    ['canApprove', AUTHORING],
    ['canSupport', SUPPORT],
    ['canSwitchEngine', ['engine-switch:menu.engineSwitch']],
  ])('Rules/Access %s alone shows only its leaves', (flag, expected) => {
    const shown = visibleLeaves({ ...ALL_FALSE, [keyOf(RULES_ACCESS_KEY)]: answered({ ...RULES_NONE, [flag]: true }) })
    expect([...shown].sort()).toEqual([...expected].sort())
  })

  it.each(INSURANCE_RULES_FLAGS.map((f) => [f]))('InsuranceRules/Access %s alone shows only its leaf', (flag) => {
    const shown = visibleLeaves({ ...ALL_FALSE, [keyOf(INSURANCE_RULES_ACCESS_KEY)]: answered({ ...INS_NONE, [flag]: true }) })
    expect(shown).toHaveLength(1)
    // The flag is `can` + the leaf's `menu.*` key — the naming rule 3459's door follows.
    expect(`can${shown[0].replace('insurance-rules:menu.', '').replace(/^./, (c) => c.toUpperCase())}`).toBe(flag)
  })

  it('PrescriptionSessionWeb/Access canView alone shows only its leaf; canWriteOff alone shows nothing', () => {
    const key = keyOf(PRESCRIPTION_SESSION_ACCESS_KEY)
    expect(visibleLeaves({ ...ALL_FALSE, [key]: answered({ canView: true, canWriteOff: false }) })).toEqual([
      'prescription-sessions:menu.prescriptionSessions',
    ])
    expect(visibleLeaves({ ...ALL_FALSE, [key]: answered({ canView: false, canWriteOff: true }) })).toEqual([])
  })

  it('Send Broadcast shows only on an explicit allowed', () => {
    expect(visibleLeaves({ ...ALL_FALSE, [keyOf(BROADCAST_KEY)]: answered({ allowed: true }) })).toEqual(['broadcast:menu.sendBroadcast'])
  })

  it('a pending, errored or malformed probe hides every leaf of the five (no flash-then-hide)', () => {
    const malformed = answered({ canAuthor: 'true', canSupport: 1, canView: 'yes', allowed: 'true', canGuards: 1 })
    for (const state of [pending, errored, answered({}), answered(null), malformed])
      expect(visibleLeaves(Object.fromEntries(PROBE_KEYS.map((k) => [k, state])))).toEqual([])
  })
})

describe('852 — the Broadcast probe fails closed', () => {
  it('a 404 from Notifications/Access rejects — no longer "unknown → allowed" — so the leaf hides', async () => {
    api.get.mockImplementationOnce(() => Promise.reject(new ApiError('unknown', 'Not Found', 404)))
    const failure = await broadcastApi.access().then(() => null, (e: unknown) => e)
    expect(failure instanceof ApiError && failure.statusCode).toBe(404)
    expect(api.get).toHaveBeenLastCalledWith('Notifications/Access')
    expect(visibleLeaves({ ...ALL_FALSE, [keyOf(BROADCAST_KEY)]: errored })).toEqual([])
  })

  it('an answer maps canBroadcast to allowed, and only an explicit true allows', async () => {
    api.get.mockResolvedValueOnce({ canBroadcast: true })
    await expect(broadcastApi.access()).resolves.toEqual({ allowed: true })
    api.get.mockResolvedValueOnce({ canBroadcast: false })
    await expect(broadcastApi.access()).resolves.toEqual({ allowed: false })
    api.get.mockResolvedValueOnce({ canBroadcast: 'true' })
    await expect(broadcastApi.access()).resolves.toEqual({ allowed: false })
  })
})
