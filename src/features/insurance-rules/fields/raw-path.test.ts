/** Oms 695 (BackOffice spec 3271; 3262 V4): raw-FHIRPath mode's latest-wins Compile and its can-propose rule. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FhirCatalogRow } from '@/core/insurance-rules/fhir-catalog'
import en from '@/locales/en/insurance-fields.json'
import ar from '@/locales/ar/insurance-fields.json'
import {
  COMPILE_DELAY_MS,
  RAW_PATH_REFUSALS,
  answerLoop,
  compileInput,
  currentAnswer,
  inputKey,
  isZeroMatches,
  proposalBody,
  proposeBlockers,
  rawPathForm,
  type CompileInput,
  type CompileVerdict,
  type ProbeReply,
  type RawPathValues,
} from './raw-path'

const GOOD: RawPathValues = rawPathForm({ path: 'total', moment: 'claim', level: 'message', type: 'money', key: 'grandTotal', labelEn: 'Grand total', labelAr: 'الإجمالي الكلي' })
const CLEAN: CompileVerdict = { refusals: [], warnings: [] }
const ANSWERED: ProbeReply = { payers: [{ payer: 'BUPA', match: 3, noMatch: 1, unknown: 0 }], refusals: [] }
const NO_MATCH: ProbeReply = { payers: [{ payer: 'BUPA', match: 0, noMatch: 4, unknown: 0 }, { payer: 'GIG', match: 0, noMatch: 0, unknown: 2 }], refusals: [] }
const keyOf = (form: RawPathValues) => inputKey(compileInput(form)!)

/** The blockers with both doors having answered THIS form. */
const blockersWith = (form: RawPathValues, verdict: CompileVerdict | null, probe: ProbeReply | null, catalog: FhirCatalogRow[] = []) =>
  proposeBlockers(form, verdict && { key: keyOf(form), value: verdict }, probe && { key: keyOf(form), value: probe }, catalog)

describe('a stale Compile reply', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /** A compile door whose replies the test releases by hand, in any order. */
  function door() {
    const calls: { path: string; answer: (v: CompileVerdict) => void }[] = []
    const compile = (b: CompileInput) => new Promise<CompileVerdict>((answer) => calls.push({ path: b.path, answer }))
    return { calls, compile }
  }

  it('never overwrites a newer one: of two in flight, the older answering last is dropped', async () => {
    const { calls, compile } = door()
    const told: string[] = []
    const loop = answerLoop(COMPILE_DELAY_MS, compile, (a) => told.push(a.key))
    const older = compileInput(rawPathForm({ path: 'older' }))!
    const newer = compileInput(rawPathForm({ path: 'newer' }))!

    loop.edit(older)
    await vi.advanceTimersByTimeAsync(COMPILE_DELAY_MS)
    loop.edit(newer)
    await vi.advanceTimersByTimeAsync(COMPILE_DELAY_MS)
    expect(calls.map((c) => c.path)).toEqual(['older', 'newer'])

    calls[1].answer(CLEAN)
    await vi.advanceTimersByTimeAsync(0)
    calls[0].answer({ refusals: [{ code: 'syntax', message: 'Bad.' }], warnings: [] })
    await vi.advanceTimersByTimeAsync(0)
    expect(told).toEqual([inputKey(newer)])
  })

  it('edits inside the window make one request', async () => {
    const { calls, compile } = door()
    const loop = answerLoop(COMPILE_DELAY_MS, compile, () => {})
    for (const path of ['t', 'to', 'tot']) {
      loop.edit(compileInput(rawPathForm({ path }))!)
      await vi.advanceTimersByTimeAsync(COMPILE_DELAY_MS - 1)
    }
    await vi.advanceTimersByTimeAsync(1)
    expect(calls.map((c) => c.path)).toEqual(['tot'])
  })

  it('an answer for what the form no longer says does not count, even with no newer request sent yet', async () => {
    const { calls, compile } = door()
    const told: { key: string; value?: CompileVerdict }[] = []
    const loop = answerLoop(COMPILE_DELAY_MS, compile, (a) => told.push(a))
    const was = rawPathForm({ ...GOOD, path: 'was' })
    loop.edit(compileInput(was)!)
    await vi.advanceTimersByTimeAsync(COMPILE_DELAY_MS)
    // The author types again: the new body waits in its window while the old reply lands.
    const now = rawPathForm({ ...GOOD, path: 'now' })
    loop.edit(compileInput(now)!)
    calls[0].answer(CLEAN)
    await vi.advanceTimersByTimeAsync(0)
    expect(told).toHaveLength(1)
    expect(currentAnswer(told[0], keyOf(now))).toBeNull()
    expect(currentAnswer(told[0], keyOf(was))).toBe(told[0])
    expect(proposeBlockers(now, told[0], { key: keyOf(now), value: ANSWERED }, [])).toContain('notChecked')
  })

  it('a door failure comes back as an answer with no value, tagged with its input', async () => {
    const failing = () => Promise.reject(new Error('down'))
    const told: { key: string; value?: unknown; error?: unknown }[] = []
    const input = compileInput(GOOD)!
    answerLoop(0, failing, (a) => told.push(a)).edit(input)
    await vi.advanceTimersByTimeAsync(0)
    expect(told[0].key).toBe(inputKey(input))
    expect(told[0].value).toBeUndefined()
    expect(told[0].error).toBeInstanceOf(Error)
  })

  it('a changed declared type is a new question: the verdict depends on it', () => {
    expect(keyOf(GOOD)).not.toBe(keyOf({ ...GOOD, type: 'text' }))
    expect(keyOf(GOOD)).not.toBe(keyOf({ ...GOOD, cardinality: 'list' }))
    expect(keyOf(GOOD)).not.toBe(keyOf({ ...GOOD, level: 'line' }))
    expect(keyOf(GOOD)).toBe(keyOf({ ...GOOD, labelEn: 'Renamed', key: 'other' }))
  })
})

describe('can-propose', () => {
  it('a clean, probed, complete row can be proposed', () => {
    expect(blockersWith(GOOD, CLEAN, ANSWERED)).toEqual([])
  })

  it.each(RAW_PATH_REFUSALS)('the refusal %s blocks', (code) => {
    expect(blockersWith(GOOD, { refusals: [{ code, message: 'No.' }], warnings: [] }, ANSWERED)).toEqual(['refused'])
  })

  it('a refusal code the client has no word for still blocks', () => {
    expect(blockersWith(GOOD, { refusals: [{ code: 'somethingNew', message: 'No.' }], warnings: [] }, ANSWERED)).toEqual(['refused'])
  })

  it('a refusal at Probe blocks', () => {
    expect(blockersWith(GOOD, CLEAN, { payers: [], refusals: [{ code: 'typeMisfit', message: 'No.' }] })).toEqual(['refused'])
  })

  it('the case-only warning does not block', () => {
    const warned: CompileVerdict = { refusals: [], warnings: [{ code: 'caseOnlyCode', message: 'Case.', literal: 'coPay', known: 'copay' }] }
    expect(blockersWith(GOOD, warned, ANSWERED)).toEqual([])
  })

  it('zero matches is a warning and does not block', () => {
    expect(isZeroMatches(NO_MATCH)).toBe(true)
    expect(isZeroMatches(ANSWERED)).toBe(false)
    expect(blockersWith(GOOD, CLEAN, NO_MATCH)).toEqual([])
  })

  it('no verdict yet blocks, and so does a failed check', () => {
    expect(blockersWith(GOOD, null, ANSWERED)).toEqual(['notChecked'])
    expect(proposeBlockers(GOOD, { key: keyOf(GOOD), error: new Error('down') }, { key: keyOf(GOOD), value: ANSWERED }, [])).toEqual(['notChecked'])
  })

  it('a path nobody probed for this form blocks', () => {
    expect(blockersWith(GOOD, CLEAN, null)).toEqual(['notProbed'])
    expect(proposeBlockers(GOOD, { key: keyOf(GOOD), value: CLEAN }, { key: 'another', value: ANSWERED }, [])).toEqual(['notProbed'])
  })

  it('the row must be complete', () => {
    expect(blockersWith({ ...GOOD, key: ' ' }, CLEAN, ANSWERED)).toEqual(['keyMissing'])
    expect(blockersWith({ ...GOOD, key: '1 bad' }, CLEAN, ANSWERED)).toEqual(['keyInvalid'])
    expect(blockersWith({ ...GOOD, labelAr: '' }, CLEAN, ANSWERED)).toEqual(['labelMissing'])
    expect(blockersWith({ ...GOOD, type: 'code' }, CLEAN, ANSWERED)).toEqual(['systemMissing'])
    expect(blockersWith({ ...GOOD, type: 'code', system: 'http://x' }, CLEAN, ANSWERED)).toEqual([])
    expect(proposeBlockers({ ...GOOD, path: '  ' }, null, null, [])).toEqual(['pathMissing'])
  })

  it('a key already in the catalog at this message and level is taken, in any case; the other level is free', () => {
    const row = { moment: 'claim', level: 'message', key: 'GRANDTOTAL' } as FhirCatalogRow
    expect(blockersWith(GOOD, CLEAN, ANSWERED, [row])).toEqual(['keyTaken'])
    expect(blockersWith({ ...GOOD, level: 'line' }, CLEAN, ANSWERED, [row])).toEqual([])
  })
})

describe('the form', () => {
  it('opens filled with what it is given, the rest blank', () => {
    const form = rawPathForm({ path: "item.where(code = 'x')", level: 'line' })
    expect(form.path).toBe("item.where(code = 'x')")
    expect(form.level).toBe('line')
    expect(form.moment).toBe('eligibility')
    expect(form.cardinality).toBe('single')
    expect(form.key).toBe('')
  })

  it('a blank path asks nothing', () => {
    expect(compileInput(rawPathForm({ path: '   ' }))).toBeNull()
  })

  it('sends the row with the path as typed but for its ends, and no system as null', () => {
    expect(proposalBody({ ...GOOD, path: ' total ', key: ' grandTotal ', labelEn: ' Grand total ' })).toEqual({
      key: 'grandTotal',
      label: { en: 'Grand total', ar: 'الإجمالي الكلي' },
      moment: 'claim',
      level: 'message',
      type: 'money',
      cardinality: 'single',
      system: null,
      fhirPath: 'total',
    })
  })
})

describe('the words', () => {
  const leaves = (node: unknown, prefix = ''): string[] => (typeof node !== 'object' || node === null ? [prefix] : Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k)))

  it('every refusal and blocker has a word, and ar mirrors en', () => {
    expect(leaves(ar.rawPath)).toEqual(leaves(en.rawPath))
    for (const code of RAW_PATH_REFUSALS) expect(en.rawPath.refusal[code]).toBeTruthy()
    for (const b of ['pathMissing', 'keyMissing', 'keyInvalid', 'keyTaken', 'labelMissing', 'systemMissing', 'notChecked', 'notProbed', 'refused'] as const) expect(en.rawPath.blocker[b]).toBeTruthy()
  })
})
