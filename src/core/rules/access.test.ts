/** The rule engine's grants off the one permissions answer (oms 914, BackOffice brief 3995 row 34). */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canApproveRules, canAuthorRules, canReadAuthoring, canSupportRules, canSwitchEngine } from './access'

const p = (...screens: string[]) => permissionsOf({ screens })

describe('rule engine predicates', () => {
  it('the authoring screens open for the author OR the approver', () => {
    expect(canReadAuthoring(p('RuleAuthoring:02'))).toBe(true)
    expect(canReadAuthoring(p('RuleAuthoring:06'))).toBe(true)
    expect(canReadAuthoring(p('RuleAuthoring:03', 'RuleSupport:03'))).toBe(false)
  })

  it('each family reads its own key only', () => {
    expect(canAuthorRules(p('RuleAuthoring:06'))).toBe(false)
    expect(canAuthorRules(p('RuleAuthoring:02'))).toBe(true)
    expect(canApproveRules(p('RuleAuthoring:06'))).toBe(true)
    expect(canSupportRules(p('RuleSupport:03'))).toBe(true)
    expect(canSupportRules(p('RuleAuthoring:02'))).toBe(false)
    expect(canSwitchEngine(p('RuleEngineSwitch:02'))).toBe(true)
    expect(canSwitchEngine(p('RuleEngineSwitch:03'))).toBe(false)
  })

  it('no answer grants nothing', () => {
    const none = permissionsOf(null)
    expect([canReadAuthoring, canAuthorRules, canApproveRules, canSupportRules, canSwitchEngine].map((f) => f(none))).toEqual([false, false, false, false, false])
  })
})
