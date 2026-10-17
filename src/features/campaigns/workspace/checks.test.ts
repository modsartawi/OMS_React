/**
 * Ticket 508 — HQ's checks of a draft point at rule → block → field BY ID. The builder finds each
 * message on the rules as they are on screen (a moved block is still found, a deleted one is gone),
 * and only errors block "Ask for approval".
 */
import { describe, expect, it } from 'vitest'
import type { CampaignRule, RuleCheckMessage, RuleCondition } from '@/core/models/rule-campaign'
import { approvalVerdict, focusTarget, indexChecks, locateCheck, locateChecks } from './checks'

const cond = (id: string, extra: Record<string, unknown> = {}): RuleCondition => ({ id, type: 'minSubtotal', says: { en: '', ar: '' }, amount: 0, ...extra })
const rules = (): CampaignRule[] => [
  { id: 'r1', name: 'First', filters: [], values: [], when: { mode: 'all', items: [] }, then: [], partial: 'refuse' },
  {
    id: 'r2',
    name: 'Second',
    filters: [{ id: 'f1', name: 'eligible', cats: [], colls: [], skus: [], exclCats: ['A006'], scope: 'items' }],
    values: [{ id: 'v1', name: 'back', formula: 'sum(eligible)' }],
    when: { mode: 'all', items: [cond('c1'), { id: 'g1', type: 'group', says: { en: '', ar: '' }, mode: 'any', items: [cond('c2'), cond('c3')] }] },
    then: [{ id: 'e1', type: 'discountSession' }, { id: 'e2', type: 'burnPoints' }],
    partial: 'refuse',
  },
]
const msg = (o: Partial<RuleCheckMessage>): RuleCheckMessage => ({ severity: 'error', code: 'X', message: 'HQ says', ruleId: null, blockId: null, field: null, ...o })

describe('checks', () => {
  it('checks_locateEachMessage_atRuleBlockField_byIds', () => {
    const rs = rules()
    expect(locateCheck(rs, msg({}))).toEqual({ at: 'campaign' })
    expect(locateCheck(rs, msg({ ruleId: 'r2' }))).toEqual({ at: 'rule', ruleId: 'r2', ruleIndex: 1, field: null })
    expect(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'c1', field: 'amount' }))).toEqual({
      at: 'block', ruleId: 'r2', ruleIndex: 1, kind: 'condition', blockId: 'c1', type: 'minSubtotal', index: 0, groupId: null, field: 'amount',
    })
    // A condition inside a group: its place in the group, and the group.
    expect(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'c3', field: 'says' }))).toMatchObject({ kind: 'condition', blockId: 'c3', index: 1, groupId: 'g1', field: 'says' })
    expect(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'e2' }))).toMatchObject({ kind: 'effect', blockId: 'e2', type: 'burnPoints', index: 1, field: null })
    expect(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'f1', field: 'name' }))).toMatchObject({ kind: 'filter', blockId: 'f1', index: 0, field: 'name' })
    expect(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'v1', field: 'formula' }))).toMatchObject({ kind: 'value', blockId: 'v1', index: 0, field: 'formula' })

    // By id, never by place: a moved block is found where it now is.
    const moved = rules()
    moved[1].then.reverse()
    expect(locateCheck(moved, msg({ ruleId: 'r2', blockId: 'e2' }))).toMatchObject({ index: 0 })
    // A rule or block no longer on screen (deleted since the save) is gone — never another's place.
    expect(locateCheck(rs, msg({ ruleId: 'r9' }))).toEqual({ at: 'gone', ruleIndex: null })
    // Only the block is gone: its rule is still named.
    expect(locateCheck(rs, msg({ ruleId: 'r1', blockId: 'c1' }))).toEqual({ at: 'gone', ruleIndex: 0 })

    // Errors before warnings; HQ's order kept within each.
    const located = locateChecks(rs, { messages: [msg({ severity: 'warning', code: 'W1' }), msg({ code: 'E1' }), msg({ severity: 'warning', code: 'W2' }), msg({ code: 'E2' })] })
    expect(located.map((l) => l.message.code)).toEqual(['E1', 'E2', 'W1', 'W2'])
    expect(new Set(located.map((l) => l.key)).size).toBe(4)

    // Indexed once: a block's messages by field ('' = the block as a whole), and a rule's own.
    const index = indexChecks(
      locateChecks(rs, {
        messages: [msg({ ruleId: 'r2', blockId: 'c1', field: 'amount', severity: 'warning' }), msg({ ruleId: 'r2', blockId: 'c1' }), msg({ ruleId: 'r2', blockId: 'e1' }), msg({ ruleId: 'r2' })],
      }),
    )
    const c1 = index.blocks.get('c1')!
    expect(Object.keys(c1.byField).sort()).toEqual(['', 'amount'])
    expect(c1.all.map((m) => m.severity)).toEqual(['error', 'warning'])
    expect(index.blocks.get('e1')!.all).toHaveLength(1)
    expect(index.rules.get('r2')).toHaveLength(1)
    expect(index.blocks.has('c2')).toBe(false)
  })

  it('checks_errorsBlockApproval_warningsDoNot', () => {
    expect(approvalVerdict({ messages: [] })).toEqual({ errors: 0, warnings: 0, blocked: false })
    expect(approvalVerdict({ messages: [msg({ severity: 'warning' }), msg({ severity: 'warning' })] })).toEqual({ errors: 0, warnings: 2, blocked: false })
    expect(approvalVerdict({ messages: [msg({}), msg({ severity: 'warning' })] })).toEqual({ errors: 1, warnings: 1, blocked: true })
    // A severity this client does not know blocks, like an error: the contract is provisional.
    expect(approvalVerdict({ messages: [msg({ severity: 'fatal' as never })] })).toEqual({ errors: 1, warnings: 0, blocked: true })
    // A message on something deleted since the save still counts: HQ checked the SAVED draft.
    expect(approvalVerdict({ messages: [msg({ ruleId: 'gone', blockId: 'gone' })] }).blocked).toBe(true)
  })

  it('focusTarget opens the block and names the field’s control', () => {
    const rs = rules()
    expect(focusTarget(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'c1', field: 'amount' })))).toEqual({ ruleId: 'r2', open: 'c1', ids: ['panel-c1-amount', 'panel-c1-amount-en'], within: '[data-block-panel="c1"]' })
    expect(focusTarget(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'e1' })))).toEqual({ ruleId: 'r2', open: 'e1', ids: [], within: '[data-block-panel="e1"]' })
    expect(focusTarget(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'f1', field: 'name' })))).toEqual({ ruleId: 'r2', open: 'f1', ids: ['filter-f1-name'], within: null })
    expect(focusTarget(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'f1', field: 'exclCats' })))).toEqual({ ruleId: 'r2', open: 'f1', ids: [], within: '#filter-editor-f1 [data-lookup="excl"]' })
    expect(focusTarget(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'f1' })))).toEqual({ ruleId: 'r2', open: 'f1', ids: [], within: '#filter-editor-f1' })
    expect(focusTarget(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'v1', field: 'name' })))).toEqual({ ruleId: 'r2', open: null, ids: ['value-name-v1'], within: null })
    expect(focusTarget(locateCheck(rs, msg({ ruleId: 'r2', blockId: 'v1', field: 'formula' })))).toEqual({ ruleId: 'r2', open: null, ids: ['value-formula-v1'], within: null })
    expect(focusTarget(locateCheck(rs, msg({ ruleId: 'r2' })))).toEqual({ ruleId: 'r2', open: null, ids: ['rule-name-r2'], within: null })
    expect(focusTarget({ at: 'campaign' })).toBeNull()
    expect(focusTarget({ at: 'gone', ruleIndex: 0 })).toBeNull()
  })
})
