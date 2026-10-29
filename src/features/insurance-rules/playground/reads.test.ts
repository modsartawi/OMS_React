/**
 * Ticket 686 — the Evaluate reply's `reads[]` (BackOffice 3251's read log) → the read log the Outcome pane draws per
 * line: a registry field as raw → parsed (or "not a number → unknown"), a missing fact as missing, a derived fact with
 * the value the engine derived, an eligibility fact as ONE value on every line (it belongs to the whole request), a
 * request- or patient-scope field flagged "no live source", and no reads at all as "none from the door".
 */
import { describe, expect, it } from 'vitest'
import { readsView } from './reads'

const read = (o: Record<string, unknown>) => ({ ruleId: 'G-1', blockPath: 'when[0]', raw: null, missing: false, noLiveSource: false, ...o })

describe('readsView', () => {
  it('a registry field shows its raw text and what it parsed to', () => {
    const v = readsView({ lines: [{ line: 1, matched: true, trace: [], reads: [read({ path: 'line.field.HouseBrand', raw: 'Y', value: true })] }] })
    expect(v).toEqual({
      kind: 'reads',
      lines: [
        {
          line: 1,
          rows: [{ ruleId: 'G-1', blockPath: 'when[0]', path: 'line.field.HouseBrand', kind: 'field', raw: 'Y', shown: { state: 'value', text: 'true' }, noLiveSource: false, wholeRequest: false }],
        },
      ],
    })
  })

  it('a field whose raw text does not parse reads unknown, naming the type it is not (from the document fields)', () => {
    const v = readsView(
      { lines: [{ line: 1, matched: false, trace: [], reads: [read({ path: 'line.field.MaxDays', raw: 'abc', value: null })] }] },
      [{ key: 'MaxDays', scope: 'line', type: 'number' }],
    )
    expect(v.kind === 'reads' && v.lines[0].rows[0]).toMatchObject({ kind: 'field', raw: 'abc', shown: { state: 'unparsed', expected: 'number' } })
  })

  it('an unparsed field with no declared type still reads unknown, the type unnamed', () => {
    const v = readsView({ lines: [{ line: 1, matched: false, trace: [], reads: [read({ path: 'line.field.X', raw: 'abc', value: null })] }] })
    expect(v.kind === 'reads' && v.lines[0].rows[0].shown).toEqual({ state: 'unparsed', expected: null })
  })

  it('a missing fact is said as missing, whatever value came beside it', () => {
    const v = readsView({ lines: [{ line: 1, matched: false, trace: [], reads: [read({ path: 'line.daysSupply', missing: true, value: null })] }] })
    expect(v.kind === 'reads' && v.lines[0].rows[0]).toMatchObject({ kind: 'fact', shown: { state: 'missing' } })
  })

  it('derived facts (patient.age, line.supplyEndsOn) are marked derived and carry the derived value', () => {
    const v = readsView({
      lines: [
        {
          line: 1,
          matched: true,
          trace: [],
          reads: [read({ path: 'patient.age', value: 36 }), read({ path: 'line.supplyEndsOn', value: '2027-02-27' })],
        },
      ],
    })
    expect(v.kind === 'reads' && v.lines[0].rows.map((r) => [r.path, r.kind, r.shown])).toEqual([
      ['patient.age', 'derived', { state: 'value', text: '36' }],
      ['line.supplyEndsOn', 'derived', { state: 'value', text: '2027-02-27' }],
    ])
  })

  it('an eligibility fact read on two lines shows one value on both, marked as the whole request', () => {
    const key = 'eligibility.benefit[66].approvalLimit'
    const v = readsView({
      lines: [
        { line: 1, matched: true, trace: [], reads: [read({ path: key, value: { type: 'number', number: 10000, unit: 'SAR' } })] },
        { line: 2, matched: true, trace: [], reads: [read({ path: key, value: 9999 })] },
      ],
    })
    expect(v.kind === 'reads' && v.lines.map((l) => l.rows[0])).toEqual([
      { ruleId: 'G-1', blockPath: 'when[0]', path: key, kind: 'eligibility', raw: null, shown: { state: 'value', text: '10000', unit: 'SAR' }, noLiveSource: false, wholeRequest: true },
      { ruleId: 'G-1', blockPath: 'when[0]', path: key, kind: 'eligibility', raw: null, shown: { state: 'value', text: '10000', unit: 'SAR' }, noLiveSource: false, wholeRequest: true },
    ])
  })

  it('a request-scope field read carries noLiveSource; a patient-scope one too, even when the flag is absent', () => {
    const v = readsView({
      lines: [
        {
          line: 1,
          matched: false,
          trace: [],
          reads: [
            read({ path: 'request.field.Referral', raw: 'Y', value: true, noLiveSource: true }),
            { ruleId: 'G-1', blockPath: 'when[1]', path: 'patient.field.Vip', raw: 'N', value: false },
            read({ path: 'line.field.HouseBrand', raw: 'Y', value: true }),
          ],
        },
      ],
    })
    expect(v.kind === 'reads' && v.lines[0].rows.map((r) => [r.path, r.noLiveSource])).toEqual([
      ['request.field.Referral', true],
      ['patient.field.Vip', true],
      ['line.field.HouseBrand', false],
    ])
  })

  it('no reads on any line (the door before 3251) is "none from the door"; absent arrays read as empty', () => {
    expect(readsView({ lines: [{ line: 1, matched: true, trace: [], reads: [] }, { line: 2, matched: false, trace: [] }] })).toEqual({ kind: 'none' })
    expect(readsView(null)).toEqual({ kind: 'none' })
    expect(readsView({ errors: [{ path: 'rules[0]', message: 'x' }] })).toEqual({ kind: 'none' })
  })

  it('a line with no number takes its place from 1, as the outcome does', () => {
    const v = readsView({ lines: [{ matched: false, reads: [read({ path: 'line.quantity', value: 2 })] } as never] })
    expect(v.kind === 'reads' && v.lines.map((l) => l.line)).toEqual([1])
  })
})
