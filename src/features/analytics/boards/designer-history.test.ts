import { describe, expect, it } from 'vitest'
import { COALESCE_MS, HISTORY_CAP, historyReducer, startHistory, type History } from './designer-history'

type Doc = { items: string[]; title: string }
const doc = (items: string[], title = ''): Doc => ({ items, title })
const start = (d: Doc = doc(['a', 'b', 'c'])) => startHistory<Doc, string>(d)
const apply = (h: History<Doc, string>, next: Doc | ((d: Doc) => Doc), at: number, key: string | null = null, label: string | null = null) =>
  historyReducer(h, { type: 'apply', next, key, label, at })
const undo = (h: History<Doc, string>) => historyReducer(h, { type: 'undo' })
const redo = (h: History<Doc, string>) => historyReducer(h, { type: 'redo' })

describe('the designer history (828)', () => {
  it('applies, undoes and redoes', () => {
    let h = start()
    h = apply(h, (d) => ({ ...d, items: [...d.items, 'd'] }), 1000)
    expect(h.present.items).toEqual(['a', 'b', 'c', 'd'])
    expect(h.past).toHaveLength(1)
    h = undo(h)
    expect(h.present.items).toEqual(['a', 'b', 'c'])
    expect(h.future).toHaveLength(1)
    h = redo(h)
    expect(h.present.items).toEqual(['a', 'b', 'c', 'd'])
    expect(h.future).toHaveLength(0)
  })

  it('does nothing on undo with no past or redo with no future', () => {
    const h = start()
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })

  it('an edit that changes nothing is no step', () => {
    const h = start()
    expect(apply(h, (d) => d, 1000)).toBe(h)
  })

  it(`keeps at most ${HISTORY_CAP} steps, the oldest dropped first`, () => {
    let h = start(doc([]))
    for (let i = 1; i <= HISTORY_CAP + 20; i++) h = apply(h, (d) => ({ ...d, items: [...d.items, String(i)] }), i * 10_000)
    expect(h.past).toHaveLength(HISTORY_CAP)
    for (let i = 0; i < HISTORY_CAP; i++) h = undo(h)
    expect(undo(h)).toBe(h)
    expect(h.present.items).toHaveLength(20)
  })

  it(`typing in one field is one step while the same key is edited within ${COALESCE_MS} ms`, () => {
    let h = start()
    h = apply(h, (d) => ({ ...d, title: 'S' }), 1000, 'title')
    h = apply(h, (d) => ({ ...d, title: 'Sa' }), 1000 + COALESCE_MS - 1, 'title')
    h = apply(h, (d) => ({ ...d, title: 'Sal' }), 1000 + 2 * (COALESCE_MS - 1), 'title')
    expect(h.past).toHaveLength(1)
    expect(undo(h).present.title).toBe('')
  })

  it('a pause, another key or no key starts a new step', () => {
    let h = start()
    h = apply(h, (d) => ({ ...d, title: 'S' }), 1000, 'title')
    h = apply(h, (d) => ({ ...d, title: 'Sa' }), 1000 + COALESCE_MS, 'title')
    expect(h.past).toHaveLength(2)
    h = apply(h, (d) => ({ ...d, title: 'Sal' }), 1000 + COALESCE_MS + 1, 'heading:s1')
    expect(h.past).toHaveLength(3)
    h = apply(h, (d) => ({ ...d, items: [] }), 1000 + COALESCE_MS + 2)
    h = apply(h, (d) => ({ ...d, items: ['x'] }), 1000 + COALESCE_MS + 3)
    expect(h.past).toHaveLength(5)
  })

  it('an undo ends the typing run: the next keystroke is a new step', () => {
    let h = start()
    h = apply(h, (d) => ({ ...d, title: 'S' }), 1000, 'title')
    h = apply(h, (d) => ({ ...d, title: 'Sa' }), 1100, 'title')
    h = undo(h)
    h = apply(h, (d) => ({ ...d, title: 'X' }), 1200, 'title')
    expect(h.past).toHaveLength(1)
    expect(undo(h).present.title).toBe('')
  })

  it('a new edit clears redo', () => {
    let h = start()
    h = apply(h, (d) => ({ ...d, items: ['a'] }), 1000)
    h = undo(h)
    expect(h.future).toHaveLength(1)
    h = apply(h, (d) => ({ ...d, items: ['z'] }), 2000)
    expect(h.future).toHaveLength(0)
    expect(redo(h)).toBe(h)
  })

  it("a removal's undo restores the exact position", () => {
    let h = start(doc(['a', 'b', 'c', 'd']))
    h = apply(h, (d) => ({ ...d, items: d.items.filter((x) => x !== 'c') }), 1000, null, 'removed c')
    expect(h.present.items).toEqual(['a', 'b', 'd'])
    expect(h.fresh).toBe('removed c')
    h = undo(h)
    expect(h.present.items).toEqual(['a', 'b', 'c', 'd'])
    expect(h.fresh).toBeNull()
  })

  it('labels each step: what undo and redo would take back or bring again', () => {
    let h = start()
    h = apply(h, (d) => ({ ...d, items: [] }), 1000, null, 'cleared')
    expect(h.past.at(-1)?.label).toBe('cleared')
    h = undo(h)
    expect(h.future[0]?.label).toBe('cleared')
    h = redo(h)
    expect(h.past.at(-1)?.label).toBe('cleared')
    expect(h.fresh).toBeNull()
  })

  it('a whole-definition replace from outside (the copilot, 832) is one labelled step', () => {
    let h = start()
    h = apply(h, (d) => ({ ...d, title: 'mine' }), 1000, 'title')
    h = apply(h, doc(['x', 'y'], 'AI'), 1100, null, 'AI: add the cancellation rate')
    expect(h.present).toEqual(doc(['x', 'y'], 'AI'))
    expect(h.fresh).toBe('AI: add the cancellation rate')
    h = undo(h)
    expect(h.present.title).toBe('mine')
    // ...and it never coalesces into the typing run before it.
    expect(h.past).toHaveLength(1)
  })

  it('a save clears the unsaved marker but not the history', () => {
    let h = start()
    expect(h.present === h.saved).toBe(true)
    h = apply(h, (d) => ({ ...d, items: ['a'] }), 1000)
    expect(h.present === h.saved).toBe(false)
    h = historyReducer(h, { type: 'saved' })
    expect(h.present === h.saved).toBe(true)
    expect(h.past).toHaveLength(1)
    h = undo(h)
    expect(h.present === h.saved).toBe(false)
  })

  it('a load starts over on a new present', () => {
    let h = start()
    h = apply(h, (d) => ({ ...d, items: [] }), 1000)
    h = historyReducer(h, { type: 'load', present: doc(['fresh']) })
    expect(h.past).toHaveLength(0)
    expect(h.future).toHaveLength(0)
    expect(h.present.items).toEqual(['fresh'])
    expect(h.present === h.saved).toBe(true)
  })
})
