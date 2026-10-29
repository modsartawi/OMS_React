/**
 * Ticket 686 — "Explain this result": the trace and the read log → the plain-words paragraph, as sentence keys with
 * their values (the pane isolates each value). A matched rule, a false block and an unknown block (from a missing or an
 * unparsed read) each give their sentence; with no read log it works from the trace alone; every key it builds exists
 * in en and ar.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-playground.json'
import ar from '@/locales/ar/insurance-playground.json'
import { hasLocaleKey } from '@/core/test/locale'
import { explain } from './explain'
import { outcomeView } from './outcome'
import { readsView } from './reads'
import type { PlaygroundEvaluateReply } from '@/core/insurance-rules/playground'

const run = (reply: PlaygroundEvaluateReply, fields?: unknown) => explain(outcomeView(reply), readsView(reply, fields))
const step = (blockPath: string, value: string, why: string | null = null, ruleId = 'G-1') => ({ ruleId, blockPath, value: value as never, why })
const read = (o: Record<string, unknown>) => ({ ruleId: 'G-1', blockPath: 'when[1]', raw: null, value: null, missing: false, noLiveSource: false, ...o })

describe('explain', () => {
  it('a matched rule: it names the line and the rule, every block held', () => {
    expect(run({ lines: [{ line: 1, matched: true, trace: [step('when[0]', 'true'), step('when[1]', 'true')], reads: [read({ path: 'line.daysSupply', value: 120 })] }] })).toEqual([
      { key: 'explain.matched', values: { line: '1', rule: 'G-1' } },
    ])
  })

  it('a false block decides: it is named, and the engine’s why follows', () => {
    expect(run({ lines: [{ line: 2, matched: false, trace: [step('when[0]', 'unknown'), step('when[1]', 'false', 'daysSupply 30 not > 90')], reads: [] }] })).toEqual([
      { key: 'explain.nothingMatched', values: {} },
      { key: 'explain.false', values: { line: '2', rule: 'G-1', block: 'when[1]' } },
      { key: 'explain.why', values: { why: 'daysSupply 30 not > 90' } },
      { key: 'explain.noReads', values: {} },
    ])
  })

  it('an unknown block names the missing read that made it unknown', () => {
    expect(
      run({ lines: [{ line: 1, matched: false, trace: [step('when[0]', 'true'), step('when[1]', 'unknown')], reads: [read({ path: 'line.icd', missing: true })] }] }),
    ).toEqual([
      { key: 'explain.nothingMatched', values: {} },
      { key: 'explain.unknown', values: { line: '1', rule: 'G-1', block: 'when[1]' } },
      { key: 'explain.missing', values: { path: 'line.icd' } },
    ])
  })

  it('an unknown block from a field that did not parse names its raw text and the type it is not', () => {
    const reply = {
      lines: [{ line: 1, matched: false, trace: [step('when[1]', 'unknown')], reads: [read({ blockPath: 'when[1].all[0]', path: 'line.field.MaxDays', raw: 'abc' })] }],
    }
    expect(run(reply, [{ key: 'MaxDays', scope: 'line', type: 'number' }])).toEqual([
      { key: 'explain.nothingMatched', values: {} },
      { key: 'explain.unknown', values: { line: '1', rule: 'G-1', block: 'when[1]' } },
      { key: 'explain.unparsedAs.number', values: { path: 'line.field.MaxDays', raw: 'abc' } },
    ])
    expect(run(reply).at(-1)).toEqual({ key: 'explain.unparsed', values: { path: 'line.field.MaxDays', raw: 'abc' } })
  })

  it('each rule on a line gets its own sentence, in the trace’s order', () => {
    expect(
      run({ lines: [{ line: 1, matched: true, trace: [step('when[0]', 'false', null, 'G-1'), step('when[0]', 'true', null, 'G-2')], reads: [read({ path: 'line.quantity', value: 2 })] }] }).map((s) => s.key),
    ).toEqual(['explain.false', 'explain.matched'])
  })

  it('nothing matched opens the paragraph; no lines, a line with no trace, and a reader error each say so', () => {
    expect(run({ lines: [{ line: 1, matched: false, trace: [step('when[0]', 'false')], reads: [read({ path: 'line.daysSupply', value: 30 })] }] })[0]).toEqual({
      key: 'explain.nothingMatched',
      values: {},
    })
    expect(run({ lines: [] })).toEqual([{ key: 'explain.noLines', values: {} }])
    expect(run({ lines: [{ line: 3, matched: false, trace: [] }] }).map((s) => s.key)).toEqual(['explain.nothingMatched', 'explain.lineNoTrace', 'explain.noReads'])
    expect(run({ errors: [{ path: 'rules[0]', message: 'x' }] })).toEqual([])
  })

  it.each([en, ar])('every key it builds exists', (locale) => {
    const keys = ['matched', 'false', 'unknown', 'why', 'missing', 'unparsed', 'nothingMatched', 'noLines', 'lineNoTrace', 'noReads', 'title', ...['number', 'date', 'flag', 'text'].map((t) => `unparsedAs.${t}`)]
    for (const k of keys) expect([k, hasLocaleKey(locale, `explain.${k}`)]).toEqual([k, true])
  })
})
