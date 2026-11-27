/**
 * Oms 852 (BackOffice 3459): every leaf of the five once-ungated areas — Campaigns, the store engine switch, Insurance
 * rules, HQ prescription sessions and Send Broadcast — is hidden until its grant is held. Since oms 914 every grant is
 * a key of the ONE permissions answer (brief 3995 rows 14, 25, 32, 34), not a probe per area.
 *
 * Read out of the REAL `MENU` through the real `resolveMenu`. The flag → key table below is the brief's, written out
 * literally, so a leaf that drifts onto another key fails here.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf, type Permissions, type PermissionsExtras } from '@/core/permissions'
import { MENU } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

type Item = (typeof MENU)[number]

const leaves = (items: Item[]): Item[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))
const visibleLeaves = (p: Permissions): string[] => leaves(resolveMenu(MENU, p).items).map((l) => l.labelKey)

const NO_EXTRAS: PermissionsExtras = {
  fileServerReady: false,
  notificationCenterOn: false,
  commandCenterOn: false,
  nphiesContractVersion: '',
  canManageRoles: false,
  canManageUsers: false,
}
const holding = (...screens: string[]) => permissionsOf({ screens })
const withExtras = (extras: Partial<PermissionsExtras>, ...screens: string[]) =>
  permissionsOf({ screens, extras: { ...NO_EXTRAS, ...extras } })
const pending = permissionsFromQuery({ isPending: true, isError: false, data: undefined })
const errored = permissionsFromQuery({ isPending: false, isError: true, data: undefined })

/** Brief 3995 row 14: each Insurance rules flag (`can` + the leaf's `menu.*` key) and the key it reads. */
const INSURANCE_KEY_OF: Record<string, string> = {
  canPatientLists: 'InsurancePatientBlock:03',
  canEditions: 'InsuranceReferenceEdition:03',
  canExceptions: 'InsuranceGuardException:03',
  canInsurers: 'InsurerSettings:03',
  canPlayground: 'InsuranceRulePlayground:01',
  canInspector: 'InsuranceRuleInspection:03',
  canRuleHits: 'InsuranceRuleHits:03',
  canIdfMasters: 'IdfPriority:03',
  canIdfStoreLists: 'IdfPriority:03',
  canIdfExceptions: 'IdfPriority:03',
  canIdfLookup: 'IdfPriority:03',
  canIdfEvents: 'IdfPriority:03',
  canIdfGroups: 'IdfPriority:03',
  canGuards: 'InsuranceRuleAuthoring:03',
  canTemplates: 'InsuranceRuleAuthoring:03',
  canLists: 'InsuranceRuleAuthoring:03',
  canFields: 'InsuranceRuleAuthoring:03',
  canApprovals: 'InsuranceRuleAuthoring:03',
  canSimulator: 'InsuranceRuleAuthoring:03',
  canReview: 'InsuranceRuleAuthoring:03',
  canMetrics: 'InsuranceRuleAuthoring:03',
  canCategories: 'InsuranceRuleAuthoring:03',
  canCoverage: 'InsuranceRuleAuthoring:03',
  canFieldProposals: 'InsuranceRuleAuthoring:03',
  canAliases: 'InsuranceRuleAuthoring:03',
  canCodeLabels: 'InsuranceRuleAuthoring:03',
}
/** The leaf a flag names: `canFieldProposals` → `insurance-rules:menu.fieldProposals` (the naming rule 3459 follows). */
const leafOf = (flag: string) => `insurance-rules:menu.${flag.slice(3, 4).toLowerCase()}${flag.slice(4)}`
const INSURANCE_KEYS = [...new Set(Object.values(INSURANCE_KEY_OF))]

const AUTHORING = ['campaigns:menu.promotions', 'campaigns:menu.priority', 'campaigns:menu.simulator', 'campaigns:menu.uploads']
const SUPPORT = ['campaigns:menu.sessions', 'campaigns:menu.couponFinder', 'campaigns:menu.customers']

describe('852 — the five areas hide until their grant is held', () => {
  it('every leaf of the five areas is gated', () => {
    const groups = MENU.filter((g) => g.labelKey === 'campaigns:menu.group' || g.labelKey === 'insurance-rules:menu.group')
    expect(groups).toHaveLength(2)
    for (const leaf of leaves(groups)) expect(isGated(leaf)).toBe(true)
    const named = ['engine-switch:menu.engineSwitch', 'prescription-sessions:menu.prescriptionSessions', 'broadcast:menu.sendBroadcast']
    for (const label of named) expect(isGated(leaves(MENU).find((l) => l.labelKey === label)!)).toBe(true)
  })

  it('the Insurance rules group holds exactly the 26 area leaves of row 14 plus Payer months', () => {
    const group = MENU.find((g) => g.labelKey === 'insurance-rules:menu.group')!
    expect(
      leaves([group])
        .map((l) => l.labelKey)
        .sort(),
    ).toEqual([...Object.keys(INSURANCE_KEY_OF).map(leafOf), 'insurance-rules:menu.payerMonths'].sort())
  })

  it('no grant shows none of the five areas — both groups drop', () => {
    expect(visibleLeaves(holding())).toEqual([])
    const groups = resolveMenu(MENU, holding()).items.map((g) => g.labelKey)
    expect(groups).not.toContain('campaigns:menu.group')
    expect(groups).not.toContain('insurance-rules:menu.group')
  })

  it.each([
    ['RuleAuthoring:02', [...AUTHORING, 'campaigns:menu.upload']],
    ['RuleAuthoring:06', AUTHORING],
    ['RuleSupport:03', SUPPORT],
    ['RuleEngineSwitch:02', ['engine-switch:menu.engineSwitch']],
  ])('%s alone shows only its leaves', (key, expected) => {
    expect([...visibleLeaves(holding(key))].sort()).toEqual([...expected].sort())
  })

  it.each(INSURANCE_KEYS.map((k) => [k]))('%s alone shows exactly the Insurance rules leaves row 14 maps to it', (key) => {
    const expected = Object.entries(INSURANCE_KEY_OF)
      .filter(([, k]) => k === key)
      .map(([flag]) => leafOf(flag))
    expect([...visibleLeaves(holding(key))].sort()).toEqual(expected.sort())
  })

  it('a near-miss insurance key (other command) shows nothing', () => {
    expect(visibleLeaves(holding('InsuranceRuleAuthoring:02', 'InsuranceRulePlayground:03', 'IdfPriority:06'))).toEqual([])
  })

  it('PrescriptionSessionHq:03 alone shows only its leaf; the write-off key alone shows nothing', () => {
    expect(visibleLeaves(holding('PrescriptionSessionHq:03'))).toEqual(['prescription-sessions:menu.prescriptionSessions'])
    expect(visibleLeaves(holding('PrescriptionSessionWriteOff:06'))).toEqual([])
  })

  it('Send Broadcast needs the key AND the notification center on (half-grant either way hides it)', () => {
    expect(visibleLeaves(withExtras({ notificationCenterOn: true }, 'NotificationBroadcast:01'))).toEqual([
      'broadcast:menu.sendBroadcast',
    ])
    expect(visibleLeaves(withExtras({ notificationCenterOn: false }, 'NotificationBroadcast:01'))).toEqual([])
    expect(visibleLeaves(withExtras({ notificationCenterOn: true }))).toEqual([])
  })

  it('a pending or errored answer hides every leaf of the five (no flash-then-hide)', () => {
    for (const p of [pending, errored]) expect(visibleLeaves(p)).toEqual([])
  })
})
