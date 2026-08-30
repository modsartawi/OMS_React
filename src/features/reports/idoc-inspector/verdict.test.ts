import { describe, expect, it } from 'vitest'

import en from '@/locales/en/reports.json'
import { aDocument, aTransaction } from './__fixtures__/graph'
import {
  EXPORT_VERSION_DISAGREES,
  VERDICT_CODES,
  banners,
  readVerdict,
} from './verdict'

/**
 * The ten verdicts and their copy (ticket 298, BackOffice 1390 + 1391).
 *
 * 🔑 **The copy is asserted against the LOCALE FILE, not against the module.** A
 * verdict whose sentence is missing renders its raw key to a consultant, and a
 * typecheck cannot see that — so the table below walks the shipped `reports.json`
 * and is the whole of "an unmapped code cannot ship". The idiom is
 * `ua-admin/csv.test.ts`'s and `callcenter/confirm-action.test.ts`'s.
 *
 * ⚠️ **The ten codes are spelled out HERE as literals**, deliberately duplicating
 * the module's table. Reading them from the module would let a dropped verdict
 * pass green in both places at once; the server's published contract
 * (`IDocInspectorVerdicts`) is what this list mirrors, and the two lists
 * disagreeing is exactly the failure worth catching.
 */
const SERVER_VERDICTS = [
  // 1. documents exist
  'Processed',
  'ProcessedWithHeldDocuments',
  'ProcessedButStampedLegacy',
  // 2. no documents, a queue entry exists
  'Parked',
  'Queued',
  'Retrying',
  'GaveUp',
  // 3. no queue entry
  'Legacy',
  'StampedNotEnqueued',
  // 4. no transaction row at all
  'NoSuchTransaction',
] as const

const copy = en.idocInspector.verdict as Record<string, { name: string; sentence: string }>

describe('the verdict table', () => {
  it('eachVerdictCodeMapsToItsOwnCopy', () => {
    expect([...VERDICT_CODES].sort()).toEqual([...SERVER_VERDICTS].sort())
    expect(VERDICT_CODES).toHaveLength(10)

    const names = new Set<string>()
    const sentences = new Set<string>()

    for (const code of SERVER_VERDICTS) {
      const said = copy[code]
      // The whole point of the table: no verdict falls through to a raw key.
      expect(said, `no copy for verdict ${code}`).toBeTruthy()
      expect(said.name.trim().length, `blank name for ${code}`).toBeGreaterThan(0)
      // A sentence, not a label — the ticket asks for plain language.
      expect(said.sentence.trim().length, `blank sentence for ${code}`).toBeGreaterThan(20)

      // 🔑 "its OWN copy". Two verdicts sharing a sentence would be two answers
      // rendered as one, which is the blank page with extra steps.
      expect(names.has(said.name), `duplicate name for ${code}`).toBe(false)
      expect(sentences.has(said.sentence), `duplicate sentence for ${code}`).toBe(false)
      names.add(said.name)
      sentences.add(said.sentence)

      // …and the reading itself resolves, for every one of the ten.
      const reading = readVerdict(aTransaction({ verdict: code, documents: [] }))
      expect(reading.known).toBe(true)
      expect(reading.code).toBe(code)
    }

    // No orphan copy either: a key under `verdict.*` that no code names is copy
    // nobody will ever read, and usually the wreckage of a rename.
    expect(Object.keys(copy).sort()).toEqual([...SERVER_VERDICTS].sort())
  })

  it('parkedReadsAsNotYetShippedNotAsFailure', () => {
    const said = copy.Parked

    // ⚠️ The ticket's wording obligation, asserted literally. A parked entry
    // describes work that has NOT BEEN BUILT, and it is the commonest empty
    // result in production (3.2% of entries).
    expect(said.sentence.toLowerCase()).toContain('has not shipped yet')

    // …and never the three readings it is mistaken for.
    const forbidden = /fail|failed|failure|error|pending|abandon/i
    expect(forbidden.test(said.name), said.name).toBe(false)
    expect(forbidden.test(said.sentence), said.sentence).toBe(false)

    // Nor a severity that colours it as a fault. Nothing went wrong here.
    const reading = readVerdict(aTransaction({ verdict: 'Parked', documents: [] }))
    expect(reading.sev).toBe('mute')
    expect(reading.showsDocuments).toBe(false)
  })

  it('gaveUpDoesNotReadAsSuccess', () => {
    const said = copy.GaveUp

    // ⚠️ The trap: the underlying row has its processed flag SET. A consultant
    // who reads "processed" reports a lost invoice as delivered — so no word of
    // arrival may appear in this copy at all.
    // ⚠️ Word-bounded on purpose: "aban**done**d" is the very word this verdict
    // needs, and a naive substring ban would forbid the honest answer.
    const success =
      /\b(success|successful|succeeded|delivered|delivery|complete|completed|finished|done|sent)\b/i
    expect(success.test(said.name), said.name).toBe(false)
    expect(success.test(said.sentence), said.sentence).toBe(false)

    // …and the copy must name the flag rather than leave it to be discovered.
    expect(said.sentence.toLowerCase()).toContain('processed flag')

    // The machine-checkable half: this verdict is never coloured as an outcome
    // that went well.
    const reading = readVerdict(aTransaction({ verdict: 'GaveUp', documents: [] }))
    expect(reading.sev).toBe('bad')
    expect(reading.showsDocuments).toBe(false)
  })
})

describe('the two verdicts that render a full graph under a banner', () => {
  it('heldDocumentsRenderInFullUnderABanner', () => {
    const result = aTransaction({
      verdict: 'ProcessedWithHeldDocuments',
      documents: [aDocument({ isHeld: true }), aDocument({ receiptNumber: '4211900772' })],
    })
    const reading = readVerdict(result)

    // 🔑 NOT an empty state. The documents render, all of them.
    expect(reading.showsDocuments).toBe(true)
    expect(reading.known).toBe(true)
    expect(reading.contradiction).toBe(false)

    expect(banners(result).map((b) => b.kind)).toEqual(['held'])
  })

  it('theHoldBackIsNamedEvenWhenTheDisagreementOutranksIt', () => {
    // BackOffice 1391: `ProcessedButStampedLegacy` OUTRANKS
    // `ProcessedWithHeldDocuments` on the wire, because the verdict is
    // single-valued. The hold-back is still legible off the graph, so the screen
    // says both rather than losing the one the server had to drop.
    const result = aTransaction({
      verdict: 'ProcessedButStampedLegacy',
      attention: { code: EXPORT_VERSION_DISAGREES, exportVersion: 'L' },
      documents: [aDocument({ isHeld: true })],
    })
    expect(banners(result).map((b) => b.kind)).toEqual(['disagreement', 'held'])
  })

  it('aLegacyStampWithDocumentsRendersEverythingAndNamesTheDisagreement', () => {
    const result = aTransaction({
      verdict: 'ProcessedButStampedLegacy',
      attention: { code: EXPORT_VERSION_DISAGREES, exportVersion: 'L' },
      documents: [aDocument(), aDocument({ receiptNumber: '4211900772' })],
    })

    // Everything renders — this is the 367-transaction population whose 751
    // documents a verdict keyed off the export-version column would have hidden.
    expect(readVerdict(result).showsDocuments).toBe(true)

    const [banner, ...rest] = banners(result)
    expect(rest).toEqual([])
    expect(banner.kind).toBe('disagreement')
    // 🔑 The offending value is NAMED, verbatim, because that is the one thing
    // the verdict code alone cannot carry.
    expect(banner.exportVersion).toEqual({ kind: 'value', value: 'L' })
    expect(banner.code).toBe(EXPORT_VERSION_DISAGREES)
  })

  it('aNullExportVersionArrivesBlankAndIsQuotedAsBlankRatherThanInvented', () => {
    // The server ships the column verbatim and a NULL arrives as `""` — never as
    // an invented `'L'`. The screen must say "empty", not print nothing and not
    // print a stamp nobody stored.
    const result = aTransaction({
      verdict: 'ProcessedButStampedLegacy',
      attention: { code: EXPORT_VERSION_DISAGREES, exportVersion: '' },
      documents: [aDocument()],
    })
    expect(banners(result)[0].exportVersion).toEqual({ kind: 'blank' })
  })
})

describe('what an unrecognised code does', () => {
  it('anUnknownVerdictCodeFailsLoudlyRatherThanRenderingBlank', () => {
    // With no documents: the empty area names the raw code rather than drawing
    // one of the ten sentences at random or nothing at all.
    const empty = readVerdict(aTransaction({ verdict: 'PartiallyReconciled', documents: [] }))
    expect(empty.known).toBe(false)
    expect(empty.code).toBe('PartiallyReconciled')
    expect(empty.sev).toBe('warn')
    expect(empty.showsDocuments).toBe(false)
    expect(en.idocInspector.verdictUnknown.sentence).toContain('{{code}}')

    // With documents: the graph still renders — the codes are what the
    // consultant came for — under a banner naming the verdict nobody knows.
    const withGraph = aTransaction({ verdict: 'PartiallyReconciled' })
    expect(readVerdict(withGraph).showsDocuments).toBe(true)
    expect(banners(withGraph).map((b) => b.kind)).toEqual(['unknownVerdict'])
    expect(banners(withGraph)[0].code).toBe('PartiallyReconciled')
  })

  it('anUnknownATTENTIONCodeIsLoudToo', () => {
    const result = aTransaction({
      verdict: 'Processed',
      attention: { code: 'BATCH_DISAGREES', exportVersion: null },
    })
    const [banner] = banners(result)
    expect(banner.kind).toBe('unknownAttention')
    expect(banner.code).toBe('BATCH_DISAGREES')
  })

  it('aDocumentsVerdictCarryingNoDocumentsIsAContradictionAndSaysSo', () => {
    // Not reachable from a correct server, which is why it must not render as a
    // blank document area under a sentence claiming documents exist.
    const reading = readVerdict(aTransaction({ verdict: 'Processed', documents: [] }))
    expect(reading.known).toBe(true)
    expect(reading.showsDocuments).toBe(false)
    expect(reading.contradiction).toBe(true)
    expect(en.idocInspector.verdictContradiction.sentence).toContain('{{code}}')

    // ⚠️ …and the whole reading turns, not just the sentence. `Processed` carries
    // `ok`, so keeping the entry's own severity and name would put a green
    // *Processed* pill over a sentence saying the server contradicted itself —
    // the same shape of trap as a `GaveUp` that reads like success.
    expect(reading.sev).toBe('warn')
    expect(reading.nameKey).toBe('idocInspector.verdictContradiction.name')
  })

  it('aVerdictThatDisagreesWithoutSayingWhatTheColumnHeldQuotesNothing', () => {
    // ⚠️ The fallback path: the verdict names the disagreement but no attention
    // block came with it. `blank` (a NULL column, which IS a disagreement) and
    // `unstated` (we were never told) are different facts, and giving the second
    // the first's sentence would have the screen inventing the very value the
    // banner exists to report.
    const result = aTransaction({ verdict: 'ProcessedButStampedLegacy', attention: null })
    const [banner] = banners(result)
    expect(banner.kind).toBe('disagreement')
    expect(banner.exportVersion).toEqual({ kind: 'unstated' })
    expect(en.idocInspector.banner.disagreement.bodyUnstated).toBeTruthy()
  })

  it('anAttentionBlockWithNoCodeNamesNothingAndIsNotDrawn', () => {
    // A block whose whole contract is a machine code, arriving without one, would
    // otherwise render "flagged this transaction with , which this screen does not
    // know" — a banner about nothing, asking for a blank to be reported.
    const result = aTransaction({
      verdict: 'ProcessedButStampedLegacy',
      attention: { code: '  ', exportVersion: 'L' },
    })
    // 🚩 …and the disagreement itself is NOT lost with it: the verdict's own
    // fallback still fires, quoting nothing because nothing was quotable.
    expect(banners(result).map((b) => b.kind)).toEqual(['disagreement'])
    expect(banners(result)[0].exportVersion).toEqual({ kind: 'unstated' })
  })

  it('anAttentionBlockOnAnEmptyVerdictIsStillDrawn', () => {
    // 🚩 The findings are not the graph's. A block attached to a verdict with no
    // documents must survive: dropping a finding because there was nothing to draw
    // it over is the silence this ticket exists to end.
    const result = aTransaction({
      verdict: 'Legacy',
      attention: { code: 'SOMETHING_NEW', exportVersion: null },
      documents: [],
    })
    expect(readVerdict(result).showsDocuments).toBe(false)
    expect(banners(result).map((b) => b.kind)).toEqual(['unknownAttention'])
  })

  it('anUnknownVerdictWithNoGraphIsShoutedOnceRatherThanTwice', () => {
    // The empty state already carries the loud sentence in the document area's own
    // place; a banner above it would be the same shout twice.
    expect(banners(aTransaction({ verdict: 'PartiallyReconciled', documents: [] }))).toEqual([])
  })

  it('anAnswerCarryingNoVerdictAtAllSaysThatRatherThanQuotingABlank', () => {
    // ⚠️ A 200 whose envelope carried `data: null`, or a payload missing the
    // field. The unrecognised copy asks for the raw code to be reported, which
    // here would be an empty sentence asking for a blank — so it gets its own.
    const reading = readVerdict(aTransaction({ verdict: '', documents: [] }))
    expect(reading.known).toBe(false)
    expect(reading.code).toBe('')
    expect(reading.sentenceKey).toBe('idocInspector.verdictMissing.sentence')
    expect(en.idocInspector.verdictMissing.sentence).not.toContain('{{code}}')
  })

  it('anAbsentAnswerIsNoSuchVerdictRatherThanACrash', () => {
    // `readVerdict(null)` is reachable for one render between the query settling
    // and the component seeing the data; it must not throw and must not claim.
    const reading = readVerdict(null)
    expect(reading.known).toBe(false)
    expect(reading.showsDocuments).toBe(false)
    expect(banners(null)).toEqual([])
  })
})

// ---------------------------------------------------------------------------

describe('aNameEveryObjectInheritsIsNotAPublishedCode', () => {
  // 🚩 The hazard `member-commands.ts` and `profile-form.ts` already guard by
  // name: a bare index into an object literal reaches `Object.prototype`, so a
  // server verdict of `constructor` would resolve to a FUNCTION, pass the `!entry`
  // test as a known verdict, and render `sev: undefined`, `showsDocuments:
  // undefined` and a raw `idocInspector.verdict.constructor.name` key on screen —
  // with no unknown-verdict banner and no empty state to say anything is wrong.
  const inherited = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']

  it('reads every inherited name as an UNRECOGNISED verdict, not as a known one', () => {
    for (const code of inherited) {
      const reading = readVerdict({ verdict: code, documents: [] } as never)
      expect(reading.known).toBe(false)
      expect(reading.code).toBe(code)
      expect(reading.sev).toBe('warn')
      expect(reading.nameKey).toBe('idocInspector.verdictUnknown.name')
    }
  })

  it('and raises the unknown-verdict banner over a graph, as any other stranger would', () => {
    const banner = banners({
      verdict: 'toString',
      documents: [{ idocType: 'INVOIC' }],
    } as never)
    expect(banner.map((b) => b.kind)).toContain('unknownVerdict')
  })

  it('🚩 an inherited ATTENTION code is unrecognised too — never a BannerKind of its own', () => {
    // Unguarded, `ATTENTION_BANNERS['toString']` is a function, survives the
    // `??`, and is handed to `t()` as the banner's copy lookup.
    const banner = banners({
      verdict: 'Processed',
      documents: [{ idocType: 'INVOIC' }],
      attention: { code: 'valueOf', exportVersion: null },
    } as never)
    expect(banner.map((b) => b.kind)).toContain('unknownAttention')
    for (const b of banner) expect(typeof b.kind).toBe('string')
  })
})

describe('aVerdictThatNeverArrivedIsNotAnUnrecognisedOne', () => {
  it('🚩 asks nobody to report a blank code', () => {
    // `readVerdict` already tells the two apart — that is what `verdictMissing`
    // exists for. The banner said `unknownVerdict` for both, which renders "the
    // server answered , which this screen does not know… Report the raw code".
    const kinds = banners({ documents: [{ idocType: 'INVOIC' }] } as never).map((b) => b.kind)
    expect(kinds).toContain('missingVerdict')
    expect(kinds).not.toContain('unknownVerdict')
    // Copy asserted against the shipped locale, this file's standing idiom: a
    // banner whose sentence is missing renders its raw key to a consultant, and
    // a typecheck cannot see that. And it quotes no code, because there is none.
    expect(en.idocInspector.banner.missingVerdict.title).toBeTruthy()
    expect(en.idocInspector.banner.missingVerdict.body).toBeTruthy()
    expect(en.idocInspector.banner.missingVerdict.body).not.toContain('{{code}}')
  })

  it('and still says nothing twice over an EMPTY answer — the empty state is louder', () => {
    expect(banners({ documents: [] } as never).map((b) => b.kind)).toEqual([])
  })
})
