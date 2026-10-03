/**
 * When a key fires (ticket 393, spec 380 K4; ruling 365 §3): three tiers, decided by one
 * pure function from the press, where focus is, whether a dialog is open and the
 * single-key switch.
 */
import { describe, expect, it } from 'vitest'
import { fireDecision, focusKindOf, type FocusKind, type FocusTarget, type KeyFacts } from './fire-tier'

const press = (over: Partial<KeyFacts>): KeyFacts => ({
  key: 'r',
  code: 'KeyR',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
  defaultPrevented: false,
  repeat: false,
  ...over,
})
const CTRL_K = press({ key: 'k', code: 'KeyK', ctrlKey: true })
const CTRL_ENTER = press({ key: 'Enter', code: 'Enter', ctrlKey: true })
const ESC = press({ key: 'Escape', code: 'Escape' })
const QUESTION = press({ key: '?', code: 'Slash', shiftKey: true })

const decide = (
  event: KeyFacts,
  o: { focus?: FocusKind; dialogOpen?: boolean; switchOn?: boolean; repeatable?: boolean } = {},
) =>
  fireDecision({
    event,
    focus: o.focus ?? 'other',
    dialogOpen: o.dialogOpen ?? false,
    switchOn: o.switchOn ?? true,
    repeatable: o.repeatable,
  })

describe('fireTierDecision', () => {
  it('a chord fires from anywhere — a text box and a grid cell editor included', () => {
    expect(decide(CTRL_K, { focus: 'entry' })).toBe('fire')
    expect(decide(CTRL_ENTER, { focus: 'entry' })).toBe('fire')
    expect(decide(CTRL_K, { focus: 'cellEditor' })).toBe('fire')
    expect(decide(press({ key: 'k', code: 'KeyK', metaKey: true }))).toBe('fire')
  })

  it('🚩 a chord is inert while a dialog is open', () => {
    expect(decide(CTRL_K, { dialogOpen: true })).toBe('skip')
    expect(decide(CTRL_ENTER, { dialogOpen: true, focus: 'entry' })).toBe('skip')
  })

  it('a letter fires off a text box, and is typing inside one', () => {
    expect(decide(press({}))).toBe('fire')
    expect(decide(press({}), { focus: 'entry' })).toBe('skip')
    expect(decide(QUESTION, { focus: 'entry' })).toBe('skip')
  })

  it('🚩 a letter in an AG Grid cell editor is the editor’s', () => {
    expect(decide(press({}), { focus: 'cellEditor' })).toBe('skip')
  })

  it('a letter under a dialog does nothing', () => {
    expect(decide(press({}), { dialogOpen: true })).toBe('skip')
  })

  it('a press mid-composition (an IME) is never a key', () => {
    expect(decide(press({ isComposing: true }))).toBe('skip')
    expect(decide({ ...CTRL_ENTER, isComposing: true })).toBe('skip')
  })

  it('Shift only for `?`: Shift+R is not R, and Ctrl, Alt or Meta on a letter never fire it', () => {
    expect(decide(QUESTION)).toBe('fire')
    expect(decide(press({ shiftKey: true }))).toBe('skip')
    expect(decide(press({ altKey: true }))).toBe('skip')
    expect(decide(press({ shiftKey: true, altKey: true, code: 'Slash' }))).toBe('skip')
  })

  it('🚩 the switch off turns letters, `/` and `?` off — and leaves chords and Esc alone', () => {
    expect(decide(press({}), { switchOn: false })).toBe('skip')
    expect(decide(press({ key: '/', code: 'Slash' }), { switchOn: false })).toBe('skip')
    expect(decide(QUESTION, { switchOn: false })).toBe('skip')
    expect(decide(CTRL_K, { switchOn: false })).toBe('fire')
    expect(decide(ESC, { switchOn: false })).toBe('fire')
  })

  it('🚩 a press a control already handled stays that control’s — every tier skips it', () => {
    expect(decide({ ...press({}), defaultPrevented: true })).toBe('skip')
    expect(decide({ ...CTRL_K, defaultPrevented: true })).toBe('skip')
    expect(decide({ ...ESC, defaultPrevented: true })).toBe('skip')
    expect(decide(press({ key: 'Enter', code: 'Enter', defaultPrevented: true }))).toBe('skip')
  })

  it('🚩 an Arabic `key` with a `KeyJ` code still fires', () => {
    expect(decide(press({ key: 'ت', code: 'KeyJ' }))).toBe('fire')
    expect(decide(press({ key: 'ن', code: 'KeyK', ctrlKey: true }))).toBe('fire')
  })

  it('acts never repeat while held; a hidden navigation command (J/K) does', () => {
    expect(decide(press({ repeat: true }))).toBe('skip')
    expect(decide(press({ code: 'KeyJ', repeat: true }), { repeatable: true })).toBe('fire')
  })

  it('Esc reaches the screen only when no layer above took it', () => {
    expect(decide(ESC)).toBe('fire')
    // A native dialog keeps its own Esc.
    expect(decide(ESC, { dialogOpen: true })).toBe('skip')
    // A cell editor's Esc cancels the edit.
    expect(decide(ESC, { focus: 'cellEditor' })).toBe('skip')
    // In a text box, the first Esc only takes focus out of it (365 §6's two-step).
    expect(decide(ESC, { focus: 'entry' })).toBe('blur')
  })

  it('a press with no code is nothing', () => {
    expect(decide(press({ key: 'Unidentified', code: '' }))).toBe('skip')
  })
})

/** A stand-in element: a tag, a role, contenteditable, and the selectors it sits inside. */
const el = (tagName: string, o: { role?: string; editable?: boolean; inside?: string[] } = {}): FocusTarget => ({
  tagName,
  isContentEditable: o.editable ?? false,
  getAttribute: (name) => (name === 'role' ? (o.role ?? null) : null),
  closest: (selector) => (selector.split(',').some((s) => o.inside?.includes(s.trim())) ? {} : null),
})

describe('focusKindOf', () => {
  it('an input, textarea, select or contenteditable is a text entry', () => {
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) expect(focusKindOf(el(tag))).toBe('entry')
    expect(focusKindOf(el('DIV', { editable: true }))).toBe('entry')
  })

  it('a textbox, combobox or searchbox role is a text entry — AG Grid’s floating filters included', () => {
    for (const role of ['textbox', 'combobox', 'searchbox']) expect(focusKindOf(el('DIV', { role }))).toBe('entry')
  })

  it('anything inside an AG Grid inline or popup editor is the cell editor', () => {
    expect(focusKindOf(el('INPUT', { inside: ['.ag-cell-inline-editing'] }))).toBe('cellEditor')
    expect(focusKindOf(el('DIV', { inside: ['.ag-popup-editor'] }))).toBe('cellEditor')
  })

  it('a grid cell, a button or nothing at all is `other`', () => {
    expect(focusKindOf(el('DIV', { role: 'gridcell' }))).toBe('other')
    expect(focusKindOf(el('BUTTON'))).toBe('other')
    expect(focusKindOf(null)).toBe('other')
  })
})
