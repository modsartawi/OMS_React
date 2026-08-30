/**
 * Reading the transaction graph: the document rail, the export badge, and which
 * pane hangs off a document (ticket 297).
 *
 * Pure — no React, no i18n, no network. Everything the screen decides ABOUT a
 * document is decided here so it can be tested here; the components render the
 * verdict and add the `t()` calls.
 */
import type { Severity } from '@/core/ui/severity'
import type { IDocExportState, IDocInspectorDocument } from '@/core/models/idoc-inspector'
import { published } from './code-table'

/**
 * How the export state renders: a severity and a copy key.
 *
 * 🔑 **Three states, three severities, three sentences.** The middle one is the
 * whole reason this is not a boolean: *sealed into a batch that has not left
 * yet* is neither "SAP has it" nor "nothing has happened". They escalate —
 * `exported` is done, `batched-not-exported` is in motion, `not-batched` wants a
 * human, because a document in no batch has no file anywhere and 3.1% of
 * production is sitting there.
 *
 * ⚠️ An unrecognised value renders its **raw code**, muted, rather than falling
 * into one of the three. A fourth state invented server-side must look wrong
 * here, not quietly claim to be exported.
 */
export interface ExportBadge {
  sev: Severity
  /** The copy key under `idocInspector.exportState.*`, or `null` when the value
   *  is not one of the three — then `raw` is what to draw. */
  key: string | null
  raw: string
}

const EXPORT_BADGES: Record<IDocExportState, { sev: Severity; key: string }> = {
  exported: { sev: 'ok', key: 'exported' },
  'batched-not-exported': { sev: 'go', key: 'batchedNotExported' },
  'not-batched': { sev: 'warn', key: 'notBatched' },
}

export function exportBadge(state: string | null | undefined): ExportBadge {
  const raw = (state ?? '').trim()
  // 🚩 `published`, never a bare index — an inherited name is a FUNCTION, and
  // it would render as a known state carrying an undefined severity and an
  // undefined copy key (`code-table.ts`).
  const known = published(EXPORT_BADGES, raw)
  return known ? { sev: known.sev, key: known.key, raw } : { sev: 'mute', key: null, raw }
}

/**
 * The IDoc type whose document carries FI lines instead of payments.
 *
 * ⚠️ **A behavioural constant, NOT a bundled legend.** Ticket 300 forbids
 * compiling the estate's nine closed vocabularies into this bundle, because a
 * legend of *labels* goes stale the first time a constant changes. This is a
 * different thing: one value the screen must BEHAVE differently for, matching
 * the backend's own `IDocTypeConstants.FinancialDocument`. The fallback below is
 * what keeps a new financial-ish type from being silently mis-paned anyway.
 */
const FI_TYPE = 'FI'

/**
 * Which of the two **document-level panes** hangs off this document — one slot,
 * never two with one always empty. Payments are an `AGG`/`SAPR` fact and FI
 * lines an `FI` fact.
 *
 * ⚠️ **Keyed on the document's TYPE first, not on whether `fiItems` is
 * populated.** An FI document whose FI lines failed to load must show an EMPTY
 * FI pane, loudly — that is the silently-empty-section trap the rail's ordinary
 * loader falls into (BackOffice 1389). Deriving the pane from the array alone
 * would hide exactly the bug the pane exists to reveal, by drawing a payments
 * table instead.
 *
 * 🚩 …and a document that carries FI lines under some OTHER type still gets the
 * FI pane. The type is the primary reading; the array is the safety net, so an
 * unfamiliar type cannot make FI lines vanish.
 *
 * ⚠️ This chooses the PANE only. The line table is not part of this slot — every
 * document's `lines` render, whatever its type.
 */
export function documentPane(doc: IDocInspectorDocument): 'fi' | 'payments' {
  return (doc.iDocType ?? '') === FI_TYPE || doc.fiItems.length > 0 ? 'fi' : 'payments'
}

/** What the rail card counts. An FI document counts FI lines; everything else
 *  counts line items and payments. */
export interface DocumentCounts {
  lines: number
  payments: number
  fiItems: number
}

export function documentCounts(doc: IDocInspectorDocument): DocumentCounts {
  return {
    lines: doc.lines.length,
    payments: doc.payments.length,
    fiItems: doc.fiItems.length,
  }
}

/**
 * ⚠️ **The `3302` blanking, marked rather than hidden.** A `DiscTypeCode` /
 * `TypeCode` of `3302` makes the serialisers write a blank amount into the XML
 * while the stored row keeps its number. The screen shows the stored row — that
 * is what it is for — and puts a mark on the figure saying the file disagrees.
 * Silently matching the XML instead would make the table lie about the row.
 */
export const XML_BLANKED_CODE = '3302'

export function blankedInXml(code: string | null | undefined): boolean {
  return (code ?? '').trim() === XML_BLANKED_CODE
}

/**
 * Which document the rail should have selected, given how many there are and
 * what was selected before.
 *
 * 🚩 The FIRST document, and never none: a transaction with documents always has
 * a pane open, because an unselected rail over an empty pane is a second empty
 * state that means nothing. A stale index (the previous lookup had five
 * documents, this one has one) clamps back to the first rather than rendering
 * `undefined`.
 */
export function selectedIndex(documentCount: number, wanted: number): number {
  if (documentCount <= 0) return 0
  return wanted >= 0 && wanted < documentCount ? wanted : 0
}

// 🚩 `hasDocuments` lived here through ticket 297 and is GONE with 298. Whether a
// graph is drawn is now the VERDICT's answer (`readVerdict().showsDocuments`), and
// leaving a second predicate that counted the array would be a second reading of
// the same question — free to drift from the server's decision, which is the one
// thing user story 29 forbids.

// 🚩 There is deliberately no `idocTypesPresent` here. The DISTINCT IDoc types on
// a transaction are what the download hangs one button off (299) — the rail is
// per document, not per type — so the list belongs to the slice that first has a
// caller for it, exactly as `sameLookup` waited for this one. A forward-built
// helper with no caller has no way to be wrong, which is how it ships subtly
// mismatched to the thing it was written for.
