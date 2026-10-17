/**
 * Ticket 505 — the rule builder's edit history: Undo and Redo step through whole snapshots, typing
 * into one field is one step, Cancel goes back to the rules as HQ last saved them, and Save makes
 * the present the saved.
 */
import { describe, expect, it } from 'vitest'
import type { CampaignRule } from '@/core/models/rule-campaign'
import { CAMPAIGNS } from '../../../../tools/campaigns-fixtures.mjs'
import { builderHistory, canRedo, canUndo, HISTORY_LIMIT, initialHistory, isDirty, type BuilderAction, type BuilderHistory } from './builder-history'
import { renameRule } from './rule-edit'

const saved: CampaignRule[] = structuredClone(CAMPAIGNS.find((c) => c.code === 'SUN-3FOR2')!.campaign.rules)
const ruleId = saved[0].id
const run = (h: BuilderHistory, ...actions: BuilderAction[]) => actions.reduce(builderHistory, h)
const rename = (name: string, coalesce?: string): BuilderAction => ({ type: 'edit', edit: (rules) => renameRule(rules, ruleId, name), coalesce })
const name = (h: BuilderHistory) => h.present[0].name

describe('builderHistory', () => {
  it('builderHistory_undoRedo_andCancelRestoresSaved', () => {
    const start = initialHistory(saved)
    expect(isDirty(start)).toBe(false)
    expect(canUndo(start)).toBe(false)

    const edited = run(start, rename('A'), rename('B'))
    expect(name(edited)).toBe('B')
    expect(isDirty(edited)).toBe(true)

    const undone = run(edited, { type: 'undo' })
    expect(name(undone)).toBe('A')
    expect(canRedo(undone)).toBe(true)
    const twice = run(undone, { type: 'undo' })
    expect(name(twice)).toBe(saved[0].name)
    expect(isDirty(twice)).toBe(false)
    expect(canUndo(twice)).toBe(false)

    const redone = run(twice, { type: 'redo' }, { type: 'redo' })
    expect(name(redone)).toBe('B')
    expect(canRedo(redone)).toBe(false)

    // A new edit after an Undo drops what Redo had.
    expect(canRedo(run(edited, { type: 'undo' }, rename('C')))).toBe(false)

    const cancelled = run(edited, { type: 'cancel' })
    expect(cancelled.present).toBe(start.saved)
    expect(isDirty(cancelled)).toBe(false)
    expect(canUndo(cancelled) || canRedo(cancelled)).toBe(false)
    // The saved rules were never touched by the edits.
    expect(start.saved[0].name).toBe(saved[0].name)
  })

  it('Save makes the present the saved rules, and Cancel then goes back to them', () => {
    const edited = run(initialHistory(saved), rename('A'))
    const after = run(edited, { type: 'saved', rules: edited.present }, rename('B'), { type: 'cancel' })
    expect(name(after)).toBe('A')
    expect(isDirty(after)).toBe(false)
  })

  it('an edit made while the save was in flight is kept, unsaved', () => {
    const edited = run(initialHistory(saved), rename('A'))
    const sent = edited.present
    const during = run(edited, rename('B'))
    const after = run(during, { type: 'saved', rules: sent, sent })
    expect(name(after)).toBe('B')
    expect(isDirty(after)).toBe(true)
    expect(name(run(after, { type: 'cancel' }))).toBe('A')
    // Nothing edited meanwhile: the history starts again from the saved rules.
    const clean = run(edited, { type: 'saved', rules: sent, sent })
    expect(isDirty(clean) || canUndo(clean)).toBe(false)
  })

  it('a sealed run of typing is not joined by the next one', () => {
    const typed = run(initialHistory(saved), rename('S', 'name'), { type: 'seal' }, rename('Su', 'name'))
    expect(typed.past).toHaveLength(2)
  })

  it('typing into one field is one step', () => {
    const typed = run(initialHistory(saved), rename('S', 'name'), rename('Su', 'name'), rename('Sun', 'name'), rename('Sun!', 'other'))
    expect(typed.past).toHaveLength(2)
    expect(name(run(typed, { type: 'undo' }))).toBe('Sun')
    expect(name(run(typed, { type: 'undo' }, { type: 'undo' }))).toBe(saved[0].name)
    // An Undo ends the run: typing again is a new step.
    expect(run(typed, { type: 'undo' }, rename('Sunny', 'name')).past).toHaveLength(2)
  })

  it('an edit that changes nothing is no step', () => {
    const h = initialHistory(saved)
    expect(run(h, rename(saved[0].name))).toBe(h)
    expect(run(h, { type: 'undo' })).toBe(h)
    expect(run(h, { type: 'redo' })).toBe(h)
  })

  it('keeps at most HISTORY_LIMIT steps', () => {
    const many = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => rename(`n${i}`))
    expect(run(initialHistory(saved), ...many).past).toHaveLength(HISTORY_LIMIT)
  })

  it('a re-read from HQ never drops unsaved edits, but is taken when nothing is unsaved', () => {
    const fresh = structuredClone(saved)
    fresh[0].name = 'Renamed on HQ'
    const clean = run(initialHistory(saved), { type: 'load', rules: fresh })
    expect(name(clean)).toBe('Renamed on HQ')
    const dirty = run(initialHistory(saved), rename('Mine'), { type: 'load', rules: fresh })
    expect(name(dirty)).toBe('Mine')
    expect(name(run(dirty, { type: 'cancel' }))).toBe('Renamed on HQ')
  })
})
