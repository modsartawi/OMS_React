/**
 * Ticket 688 — the "Open in playground" hand-off: the experiment travels by router state, with a short-lived
 * per-tab storage fallback so a reload of the playground keeps it. Only a link that asked for a copy reads the
 * fallback, so a later visit from the menu never re-opens an old copy.
 */
import { describe, expect, it } from 'vitest'
import { experimentFromRule } from './experiment'
import { handoffState, readHandoff, stashHandoff, HANDOFF_TTL_MS, PLAYGROUND_COPY_SEARCH } from './playground-handoff'

const memory = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}
const RULE = { id: 'C-002', name: { en: 'x', ar: 'س' }, state: 'live', when: [], then: [{ effect: 'covered', value: false }] }
const H = { experiment: experimentFromRule({ kind: 'coverage', rule: RULE, document: {} }, '2026-10-30T14:05:00'), from: { kind: 'coverage' as const, ruleId: 'C-002' } }
const NOW = 1_000_000

describe('playground hand-off', () => {
  it('router state carries the copy', () => {
    expect(readHandoff(handoffState(H), '', NOW, memory())).toEqual(H)
  })

  it('a reload with no state reads the stash while it is fresh, and only on a copy link', () => {
    const s = memory()
    stashHandoff(H, NOW, s)
    expect(readHandoff(null, PLAYGROUND_COPY_SEARCH, NOW + 1000, s)).toEqual(H)
    expect(readHandoff(null, '', NOW + 1000, s)).toBeNull()
    expect(readHandoff(null, PLAYGROUND_COPY_SEARCH, NOW + HANDOFF_TTL_MS + 1, s)).toBeNull()
  })

  it('anything that is not an experiment is no hand-off; storage that throws is no hand-off and no crash', () => {
    expect(readHandoff({ playgroundCopy: { file: { format: 'x' }, from: H.from } }, '', NOW, memory())).toBeNull()
    const off = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') }, removeItem: () => {} }
    expect(() => stashHandoff(H, NOW, off)).not.toThrow()
    expect(readHandoff(null, PLAYGROUND_COPY_SEARCH, NOW, off)).toBeNull()
  })
})
