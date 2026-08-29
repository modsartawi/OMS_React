import { describe, expect, it } from 'vitest'
import {
  blankedInXml,
  documentCounts,
  documentPane,
  exportBadge,
  hasDocuments,
  selectedIndex,
} from './document-graph'
import { aDocument, aLine, anFiDocument, aTransaction } from './__fixtures__/graph'

// Ticket 297's Proof, at the seam the spec allows the client to test: pure
// modules. What a pure test cannot reach — that the rail RENDERS, that a line
// opens IN PLACE, that the FI pane draws no provenance column — is asserted in
// the DOM by `tools/idoc-inspector-drive.mjs`, which drives the real screen.

describe('aLookupRendersOneTabPerGeneratedIDocType', () => {
  // The rail itself is asserted in the DOM by the drive — one card per document,
  // every generated type on it. What is pure here is the graph it reads.
  it('gives the rail one entry per document, each carrying its own type', () => {
    const result = aTransaction({ documents: [aDocument(), anFiDocument()] })
    expect(result.documents.map((d) => d.idocType)).toEqual(['AGG', 'FI'])
  })

  it('🚩 a fat split is FIVE documents of ONE type — the rail is per DOCUMENT', () => {
    // Production's worst case: one transaction split across five payment groups.
    // Five cards in the rail, and (ticket 299) still one XML file to download.
    const split = [0, 1, 2, 3, 4].map((i) =>
      aDocument({ receiptNumber: `421190077${i}`, paymentGroupId: `0${i + 1}` }),
    )
    expect(split).toHaveLength(5)
    expect(new Set(split.map((d) => d.idocType)).size).toBe(1)
  })

  it('knows a transaction that generated nothing from one that did', () => {
    expect(hasDocuments(aTransaction({ verdict: 'Parked', documents: [] }))).toBe(false)
    expect(hasDocuments(null)).toBe(false)
    expect(hasDocuments(aTransaction())).toBe(true)
  })
})

describe('theExportStateBadgeDistinguishesAllThreeStates', () => {
  it('🔑 gives each of the three its OWN severity and its OWN sentence', () => {
    const exported = exportBadge('exported')
    const batched = exportBadge('batched-not-exported')
    const unbatched = exportBadge('not-batched')

    expect([exported.key, batched.key, unbatched.key]).toEqual([
      'exported',
      'batchedNotExported',
      'notBatched',
    ])
    // Three distinct severities: no two states may share a colour, or the badge
    // is a two-way one wearing three words.
    expect(new Set([exported.sev, batched.sev, unbatched.sev]).size).toBe(3)
  })

  it('🚩 "batched but not exported" is NOT "exported" — the state a boolean loses', () => {
    expect(exportBadge('batched-not-exported').key).not.toBe(exportBadge('exported').key)
    expect(exportBadge('batched-not-exported').sev).not.toBe('ok')
  })

  it('⚠️ renders an unrecognised value RAW and muted, never as one of the three', () => {
    const strange = exportBadge('half-exported')
    expect(strange.key).toBeNull()
    expect(strange.raw).toBe('half-exported')
    expect(strange.sev).toBe('mute')
  })

  it('⚠️ a missing state is not silently "exported" either', () => {
    for (const missing of [null, undefined, '']) {
      const badge = exportBadge(missing)
      expect(badge.key).toBeNull()
      expect(badge.sev).toBe('mute')
    }
  })
})

describe('paymentAndFiRowsShowNoProvenanceColumn', () => {
  it('🔑 a payment carries NO source tag — absent from the type, not null', () => {
    const payment = aDocument().payments[0]
    // @ts-expect-error — a payment row has no `sourceTag`, and adding one to the
    // model would break this line. That is the point: a nullable provenance
    // field would invite a dimmed "unknown" chip where the honest answer is
    // "this row never had one".
    expect(payment.sourceTag).toBeUndefined()
  })

  it('🔑 an FI line carries NO source tag either', () => {
    const fiItem = anFiDocument().fiItems[0]
    // @ts-expect-error — see above. Provenance is out of scope for FI lines.
    expect(fiItem.sourceTag).toBeUndefined()
  })

  it('a line and a condition, by contrast, both carry one', () => {
    const line = aLine()
    expect(line.sourceTag).toBe('pos')
    expect(line.conditions[0].sourceTag).toBe('pos')
  })
})

describe('the pane that hangs off a document', () => {
  it('is FI lines for an FI document and payments for everything else', () => {
    expect(documentPane(anFiDocument())).toBe('fi')
    expect(documentPane(aDocument())).toBe('payments')
    expect(documentPane(aDocument({ idocType: 'SAPR' }))).toBe('payments')
  })

  it('⚠️ stays the FI pane when an FI document has NO FI lines — the trap', () => {
    // The rail's ordinary loader excludes FI lines, so an FI document served
    // through it comes back with an empty section. Deriving the pane from the
    // array alone would draw a payments table and hide the bug entirely.
    expect(documentPane(anFiDocument({ fiItems: [] }))).toBe('fi')
  })

  it('🚩 …and an UNFAMILIAR type carrying FI lines still gets the FI pane', () => {
    // The type is the primary reading; the array is the safety net, so a type
    // this bundle has never heard of cannot make FI lines vanish.
    expect(documentPane(anFiDocument({ idocType: 'FI2' }))).toBe('fi')
  })

  it('counts what the rail card prints', () => {
    const doc = aDocument({
      lines: [aLine({ itemNumber: 1 }), aLine({ itemNumber: 2, conditions: [] })],
    })
    expect(documentCounts(doc)).toEqual({ lines: 2, payments: 1, fiItems: 0 })
  })

  it('⚠️ an FI document that DOES carry line items keeps them — the pane is not the table', () => {
    // The mutually-exclusive slot is payments-vs-FI-lines. Every document's line
    // items render whatever its type; hiding them behind the pane choice would
    // be the same silent-empty-section bug one level up.
    const fiWithLines = anFiDocument({ lines: [aLine()] })
    expect(documentPane(fiWithLines)).toBe('fi')
    expect(documentCounts(fiWithLines).lines).toBe(1)
  })
})

describe('which document the rail has selected', () => {
  it('opens on the first one — a rail over an empty pane is a second empty state', () => {
    expect(selectedIndex(2, 0)).toBe(0)
  })

  it('keeps a valid selection', () => {
    expect(selectedIndex(5, 3)).toBe(3)
  })

  it('🚩 clamps a stale index back to the first rather than rendering nothing', () => {
    expect(selectedIndex(1, 4)).toBe(0)
    expect(selectedIndex(3, -1)).toBe(0)
    expect(selectedIndex(0, 2)).toBe(0)
  })
})

describe('⚠️ the 3302 blanking is marked, not hidden', () => {
  it('marks the code the serialisers blank in the XML', () => {
    expect(blankedInXml('3302')).toBe(true)
  })

  it('leaves every other code alone', () => {
    expect(blankedInXml('3301')).toBe(false)
    expect(blankedInXml('')).toBe(false)
    expect(blankedInXml(null)).toBe(false)
  })
})
