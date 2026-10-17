/**
 * Tickets 508 / 522 — HQ's issues point by `path` into the campaign it checked (the saved draft).
 * The builder reads the path in the saved rules, takes the block's builder key, and finds it on the
 * rules as they are on screen (a moved block is still found, a deleted one is gone). Only errors
 * block "Ask for approval".
 */
import { describe, expect, it } from 'vitest'
import type { CampaignRule, RuleCondition, RuleIssue, RuleValidation } from '@/core/models/rule-campaign'
import { keyOf, withKeys } from './block-keys'
import { approvalVerdict, focusTarget, indexChecks, locateCheck, locateChecks, pathSteps } from './checks'
import { deleteBlock, moveBlock } from './rule-edit'

const cond = (extra: Record<string, unknown> = {}): RuleCondition => ({ check: 'minSubtotal', says: { en: '', ar: '' }, amount: 0, ...extra })
let n = 0
const saved = (): CampaignRule[] =>
  withKeys(
    [
      { id: 'r1', name: 'First', filters: [], values: [], when: [], then: [] },
      {
        id: 'r2',
        name: 'Second',
        filters: [{ id: 'f1', name: 'Eligible', exclude: { categories: ['A006'] } }],
        values: [{ name: 'back', expr: ['sum', ['items', 'f1'], '$item.net'] }],
        when: [cond(), { check: 'group', mode: 'any', conditions: [cond(), cond({ amount: 5 })] }],
        then: [{ effect: 'discountSession' }, { effect: 'burnPoints' }],
      },
    ],
    () => `k${++n}`,
  )
const issue = (path: string, o: Partial<RuleIssue> = {}): RuleIssue => ({
  severity: 'error',
  rule: null,
  ruleId: null,
  block: null,
  index: null,
  field: null,
  where: '',
  message: 'HQ says',
  path,
  ...o,
})
const validation = (errors: RuleIssue[], warnings: RuleIssue[] = []): RuleValidation => ({ canActivate: errors.length === 0, errors, warnings, offline: null })

describe('checks', () => {
  it('reads a path into steps', () => {
    expect(pathSteps('campaign.rules[1].when[1].conditions[0].amount')).toEqual([
      { name: 'campaign', index: null },
      { name: 'rules', index: 1 },
      { name: 'when', index: 1 },
      { name: 'conditions', index: 0 },
      { name: 'amount', index: null },
    ])
  })

  it('checks_pointByPath', () => {
    const s = saved()
    const r2 = s[1]
    expect(locateCheck(s, s, issue('campaign.window.until'))).toEqual({ at: 'campaign' })
    expect(locateCheck(s, s, issue('campaign.budgets[0].value'))).toEqual({ at: 'campaign' })
    expect(locateCheck(s, s, issue('campaign.rules[1].name'))).toEqual({ at: 'rule', ruleId: 'r2', ruleIndex: 1, field: 'name' })
    expect(locateCheck(s, s, issue('campaign.rules[1].when[0].amount'))).toEqual({
      at: 'block', ruleId: 'r2', ruleIndex: 1, kind: 'condition', blockId: keyOf(r2.when[0]), type: 'minSubtotal', index: 0, groupId: null, field: 'amount',
    })
    // Inside a group: its place in the group, and the group's key.
    const group = r2.when[1] as RuleCondition & { conditions: RuleCondition[] }
    expect(locateCheck(s, s, issue('campaign.rules[1].when[1].conditions[1].says.ar'))).toMatchObject({
      kind: 'condition', blockId: keyOf(group.conditions[1]), index: 1, groupId: keyOf(group), field: 'says.ar',
    })
    expect(locateCheck(s, s, issue('campaign.rules[1].then[1]'))).toMatchObject({ kind: 'effect', type: 'burnPoints', index: 1, field: null })
    expect(locateCheck(s, s, issue('campaign.rules[1].filters[0].name'))).toMatchObject({ kind: 'filter', blockId: 'f1', index: 0, field: 'name' })
    expect(locateCheck(s, s, issue('campaign.rules[1].values[0].expr'))).toMatchObject({ kind: 'value', blockId: keyOf(r2.values[0]), field: 'expr' })
  })

  it('finds a block moved since the save by its key, and says when it is gone', () => {
    const s = saved()
    const moved = moveBlock(s, 'r2', keyOf(s[1].then[1]), -1)
    expect(locateCheck(s, moved, issue('campaign.rules[1].then[1]'))).toMatchObject({ kind: 'effect', type: 'burnPoints', index: 0 })
    const gone = deleteBlock(s, 'r2', keyOf(s[1].then[1]))
    expect(locateCheck(s, gone, issue('campaign.rules[1].then[1]'))).toEqual({ at: 'gone', ruleIndex: 1 })
    expect(locateCheck(s, [s[1]], issue('campaign.rules[0].name'))).toEqual({ at: 'gone', ruleIndex: null })
  })

  it('lists errors first and indexes them by block and by rule', () => {
    const s = saved()
    const located = locateChecks(s, s, validation([issue('campaign.rules[1].when[0].amount')], [issue('campaign.rules[1].name', { severity: 'warning' })]))
    expect(located.map((l) => l.message.severity)).toEqual(['error', 'warning'])
    const index = indexChecks(located)
    expect(index.blocks.get(keyOf(s[1].when[0]))?.byField.amount).toHaveLength(1)
    expect(index.rules.get('r2')).toHaveLength(1)
  })

  it('only errors block approval', () => {
    expect(approvalVerdict(validation([], [issue('campaign.rules[0]', { severity: 'warning' })]))).toEqual({ errors: 0, warnings: 1, blocked: false })
    expect(approvalVerdict(validation([issue('campaign')]))).toEqual({ errors: 1, warnings: 0, blocked: true })
    expect(approvalVerdict(null)).toEqual({ errors: 0, warnings: 0, blocked: false })
  })

  it('a click goes to the field it points at', () => {
    const s = saved()
    const k = keyOf(s[1].when[0])
    expect(focusTarget(locateCheck(s, s, issue('campaign.rules[1].when[0].says.en')))).toEqual({
      ruleId: 'r2', open: k, ids: [`panel-${k}-says`, `panel-${k}-says-en`], within: `[data-block-panel="${k}"]`,
    })
    expect(focusTarget(locateCheck(s, s, issue('campaign.rules[1].filters[0].exclude.categories')))).toMatchObject({ open: 'f1', within: '#filter-editor-f1 [data-lookup="exclude"]' })
    expect(focusTarget({ at: 'campaign' })).toBeNull()
  })
})
