/**
 * Ticket 608 — the editor's history over the WHOLE draft document: Undo / Redo step through it, Cancel goes
 * back to what HQ last saved, Save makes HQ's answer the saved one, and typing into one field is one step.
 */
import { describe, expect, it } from 'vitest'
import { RULESET } from '../../../tools/insurance-rules-stubs.mjs'
import { canRedo, canUndo, editorHistory, initialEditorHistory, isDirty } from './editor-history'
import { editGuard } from './guard-edit'
import type { GuardRuleset } from './model'

const rename = (en: string) => (d: GuardRuleset) => editGuard(d, 'G-001', (r) => ({ ...r, name: { ...r.name, en } }))
const nameOf = (d: GuardRuleset) => d.rules.find((r) => r.id === 'G-001')!.name.en

describe('editor history', () => {
  it('undo, redo, cancel and save the draft whole', () => {
    let h = initialEditorHistory(RULESET)
    expect(isDirty(h)).toBe(false)
    h = editorHistory(h, { type: 'edit', edit: rename('A'), coalesce: 'name' })
    h = editorHistory(h, { type: 'edit', edit: rename('AB'), coalesce: 'name' })
    expect([nameOf(h.present), h.past.length, isDirty(h)]).toEqual(['AB', 1, true])
    h = editorHistory(h, { type: 'seal' })
    h = editorHistory(h, { type: 'edit', edit: rename('ABC'), coalesce: 'name' })
    expect(h.past.length).toBe(2)
    h = editorHistory(h, { type: 'undo' })
    expect([nameOf(h.present), canRedo(h)]).toEqual(['AB', true])
    h = editorHistory(h, { type: 'redo' })
    expect(nameOf(h.present)).toBe('ABC')
    // An edit that changes nothing is no step.
    expect(editorHistory(h, { type: 'edit', edit: (d) => d })).toBe(h)
    const cancelled = editorHistory(h, { type: 'cancel' })
    expect([nameOf(cancelled.present), isDirty(cancelled), canUndo(cancelled)]).toEqual(['Same item twice in 3 days', false, false])
    const saved = editorHistory(h, { type: 'saved', doc: { ...h.present, revision: 13 } })
    expect([saved.present.revision, isDirty(saved), canUndo(saved)]).toEqual([13, false, false])
  })

  it('a re-read never loses an unsaved edit; a new rule starts unsaved', () => {
    let h = editorHistory(initialEditorHistory(RULESET), { type: 'edit', edit: rename('Mine') })
    h = editorHistory(h, { type: 'load', doc: { ...RULESET, revision: 14 } })
    expect([nameOf(h.present), h.saved.revision, isDirty(h)]).toEqual(['Mine', 14, true])
    const fresh = initialEditorHistory(RULESET, { ...RULESET, rules: [...RULESET.rules, { ...RULESET.rules[0], id: 'G-012' }] })
    expect([isDirty(fresh), canUndo(fresh)]).toEqual([true, false])
  })
})
