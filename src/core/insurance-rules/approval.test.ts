/**
 * Review 3126 P6b — the approval by role, shared by the guard ruleset (611) and the category / coverage rulesets
 * (617, "the same authoring doors"). The guard draft waits for a back-test; a category or coverage draft has none
 * to wait for, and none may be asked for with unsaved changes.
 */
import { describe, expect, it } from 'vitest'
import { actionsFor, type DraftApproval } from './approval'

const approval = (o: Partial<DraftApproval> = {}): DraftApproval => ({
  revision: 4,
  state: 'draft',
  submittedBy: null,
  submittedAt: null,
  note: null,
  sentBack: null,
  viewer: { author: true, approver: false },
  ...o,
})
const pass = { errors: 0, warnings: 0, blocked: false }

describe('actionsFor without a back-test (category / coverage)', () => {
  it('actionsFor_noBacktestNeeded_submitsOnPassingChecks', () => {
    expect(actionsFor({ approval: approval(), userId: 'a', backtest: null, checks: pass, needsBacktest: false })).toEqual([{ kind: 'submit', enabled: true, why: null }])
    expect(actionsFor({ approval: approval(), userId: 'a', backtest: null, checks: { errors: 1, warnings: 0, blocked: true }, needsBacktest: false })[0].why).toBe('checks')
  })
  it('unsaved changes come first', () => {
    expect(actionsFor({ approval: approval(), userId: 'a', backtest: null, checks: pass, needsBacktest: false, dirty: true })[0]).toEqual({ kind: 'submit', enabled: false, why: 'unsaved' })
  })
  it('the guard draft still waits for its back-test', () => {
    expect(actionsFor({ approval: approval(), userId: 'a', backtest: null, checks: pass })[0].why).toBe('noBacktest')
  })
})
