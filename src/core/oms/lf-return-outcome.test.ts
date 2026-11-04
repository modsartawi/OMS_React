/**
 * The LF return outcome vocabulary (spec 759 F4–F6; BackOffice 3369 §Wire): one reading of the
 * outcome code for the panel, the banner, the force gate and the queue.
 */
import { describe, expect, it } from 'vitest'
import { isForceable, isSettled, needsAction, normaliseLfReturnOutcome } from './lf-return-outcome'

describe('normaliseLfReturnOutcome reads every spelling 3369 and 759 use', () => {
  it('reads each known outcome as itself, trimmed', () => {
    for (const code of ['open', 'refunded', 'short', 'nothingReceived', 'unanswered', 'forced']) {
      expect(normaliseLfReturnOutcome(code)).toBe(code)
      expect(normaliseLfReturnOutcome(` ${code}\t`)).toBe(code)
    }
  })

  it("reads 3369's prose spelling nothing-received as nothingReceived", () => {
    expect(normaliseLfReturnOutcome('nothing-received')).toBe('nothingReceived')
    expect(normaliseLfReturnOutcome(' nothing-received ')).toBe('nothingReceived')
  })

  it('reads an outcome it has not learned — or none — as unknown, never a guess', () => {
    for (const raw of ['somethingNew', 'Open', 'nothing_received', '', '   ', null, undefined, 'toString', '__proto__']) {
      expect([raw, normaliseLfReturnOutcome(raw)]).toEqual([raw, 'unknown'])
    }
  })
})

describe('the outcome sets', () => {
  it('needs action: unanswered, nothing received and short — nothing else', () => {
    expect(['open', 'refunded', 'short', 'nothingReceived', 'unanswered', 'forced', 'unknown'].filter((o) => needsAction(o as never))).toEqual([
      'short',
      'nothingReceived',
      'unanswered',
    ])
  })

  it('forceable: open and the three stuck ones; settled: refunded and forced; unknown is neither', () => {
    const all = ['open', 'refunded', 'short', 'nothingReceived', 'unanswered', 'forced', 'unknown'] as const
    expect(all.filter((o) => isForceable(o))).toEqual(['open', 'short', 'nothingReceived', 'unanswered'])
    expect(all.filter((o) => isSettled(o))).toEqual(['refunded', 'forced'])
  })
})
