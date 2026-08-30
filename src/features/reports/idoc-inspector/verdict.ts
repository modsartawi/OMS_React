/**
 * The ten verdicts, and what the screen says about each of them (ticket 298,
 * BackOffice 1390 + 1391).
 *
 * 🔑 **A lookup that finds nothing never shows a blank page.** Every way of
 * having nothing to show arrives as a **200 carrying a stable machine code**, and
 * the empty state replaces the document area with that verdict's own name and a
 * plain-language sentence. An empty result is an ANSWER; the only thing a blank
 * page would tell a consultant is that the screen does not know either.
 *
 * 🔑 **The wording is not here.** This module names a *key*; the locale file owns
 * the sentence, so a verdict can be reworded without a server release (spec 1386,
 * user story 42) — which is also why the server never sends prose. The nearest
 * precedent in this repo is `retail-invoice/download-outcome.ts`: a table of codes
 * to keys, pure, tested at the table.
 *
 * ⚠️ **The ten codes ARE written down here, and that is not the bundled-legend
 * mistake ticket 300 forbids.** The nine closed vocabularies are open-ended sets
 * of *data* that grow whenever a constant is added, which is why they arrive on
 * `Metadata`. The verdicts are a **published client contract** — BackOffice's
 * `IDocInspectorVerdicts` says so in as many words ("oms-react switches on these
 * strings and owns the wording") — and a code this screen cannot switch on is a
 * code it cannot word. What protects them from drift is not a route but
 * `verdict.test.ts`, which walks all ten against the shipped locale file.
 *
 * Pure — no React, no i18n, no network. The seam the ticket's Proof names: *"the
 * verdict-to-copy mapping is a pure module; test it there, not through
 * components."*
 */
import type { IDocInspectorDocument, IDocInspectorTransaction } from '@/core/models/idoc-inspector'
import type { Severity } from '@/core/ui/severity'
import { published } from './code-table'

/**
 * The banner over a full render, and there are four kinds for two reasons.
 *
 * The first two are the spec's: a **held** document and a transaction whose
 * export-version column **disagrees** with the documents beside it are both
 * findings on a graph that renders in full, not empty results. The other two are
 * this screen refusing to be silent about a code it does not recognise — an
 * unknown verdict or an unknown attention code is a contract drift between two
 * repositories on different release cadences, and the one thing it must not do is
 * render as an ordinary screen.
 */
export type BannerKind =
  | 'held'
  | 'disagreement'
  | 'unknownVerdict'
  /** ⚠️ A verdict that never arrived at all — its own kind, because the
   *  unrecognised copy asks the consultant to **report the raw code** and there
   *  is no code to report. `readVerdict` already tells the two apart. */
  | 'missingVerdict'
  | 'unknownAttention'

interface VerdictEntry {
  /**
   * The pill's colour, and on two rows it is load-bearing:
   *
   * - ⚠️ `GaveUp` is `bad` and can never be `ok` — the underlying row has its
   *   processed flag set, and a green pill beside "abandoned" is the exact
   *   misreading that turns a lost invoice into a delivered one.
   * - ⚠️ `Parked` is `mute` and deliberately **not** `warn` — the workflow has not
   *   shipped yet. Nothing went wrong, so nothing here may be coloured as though
   *   something had.
   */
  sev: Severity
  /** Does the document area draw the graph? Three verdicts say yes. */
  showsDocuments: boolean
  /** The banner this verdict carries on its own account, if any. */
  banner: BannerKind | null
}

/**
 * The published table, in the server's evaluation order (BackOffice 1390 §"the
 * evaluation order is itself the decision"): documents first, the queue entry
 * second, the export-version column last and only ever to *name* an empty result.
 *
 * 🚩 The order is the server's decision and this client never re-derives it — two
 * consultants reading one transaction must never disagree because their browsers
 * computed it differently (spec 1386, user story 29). What follows is a wording
 * table, not a decision table.
 */
const VERDICTS: Record<string, VerdictEntry> = {
  // ----- 1. documents exist -------------------------------------------------
  Processed: { sev: 'ok', showsDocuments: true, banner: null },
  ProcessedWithHeldDocuments: { sev: 'warn', showsDocuments: true, banner: 'held' },
  ProcessedButStampedLegacy: { sev: 'warn', showsDocuments: true, banner: 'disagreement' },

  // ----- 2. no documents, a queue entry exists ------------------------------
  Parked: { sev: 'mute', showsDocuments: false, banner: null },
  Queued: { sev: 'go', showsDocuments: false, banner: null },
  Retrying: { sev: 'go', showsDocuments: false, banner: null },
  GaveUp: { sev: 'bad', showsDocuments: false, banner: null },

  // ----- 3. no queue entry ---------------------------------------------------
  Legacy: { sev: 'mute', showsDocuments: false, banner: null },
  // 🚩 `warn` rather than `mute`: stamped for the new rail and never enqueued is a
  // gap in the rail itself, which is a different thing from a transaction the
  // legacy uploader legitimately owns.
  StampedNotEnqueued: { sev: 'warn', showsDocuments: false, banner: null },

  // ----- 4. no transaction row at all ---------------------------------------
  // 🚩 `mute`, not `bad`. This is far more often a typo than a problem, and the
  // whole reason the server distinguishes it from "exists and produced nothing"
  // is so a consultant can tell those two apart.
  NoSuchTransaction: { sev: 'mute', showsDocuments: false, banner: null },
}

/** The ten, for the table-driven test that makes an unmapped code unshippable. */
export const VERDICT_CODES: readonly string[] = Object.keys(VERDICTS)

/**
 * The one attention code the server ships (BackOffice 1391), and the bar for a
 * second is high: an attention block earns its place only when it carries
 * something the verdict *cannot* — here, the offending export-version value.
 *
 * ⚠️ There is deliberately **no `DOCUMENTS_HELD`**. That would be a second
 * spelling of `ProcessedWithHeldDocuments`, and the question it would have been
 * answering — *which* document is held — is a question about the graph, answered
 * on the document by `isHeld`.
 */
export const EXPORT_VERSION_DISAGREES = 'EXPORT_VERSION_DISAGREES'

const ATTENTION_BANNERS: Record<string, BannerKind> = {
  [EXPORT_VERSION_DISAGREES]: 'disagreement',
}

/** How one verdict renders. `nameKey` / `sentenceKey` are `reports` keys — this
 *  module names copy and never holds it. */
export interface VerdictReading {
  /** The raw code, trimmed. Rendered as itself wherever the verdict is loud, so a
   *  consultant can quote what the server actually said. */
  code: string
  /** Is it one of the ten? A `false` here is a contract drift, never a state. */
  known: boolean
  sev: Severity
  /** Does the document area draw the graph, or the named empty state? */
  showsDocuments: boolean
  /**
   * ⚠️ A verdict from the documents family that arrived with **no documents**.
   * Unreachable from a correct server, and precisely why it is named: drawing the
   * `Processed` sentence over an empty document area would be this screen
   * asserting documents exist while showing none.
   */
  contradiction: boolean
  nameKey: string
  sentenceKey: string
}

const KEY = 'idocInspector'

/**
 * What to say about this answer.
 *
 * 🔑 **The verdict decides, and the array only ever narrows it.** A code the table
 * knows takes its presentation from the table; the document count can turn a
 * documents-verdict into a named *contradiction*, but it can never promote an
 * empty verdict into a graph — that would be the client re-deciding the verdict.
 *
 * ⚠️ An **unknown** code is the one case where the array leads: it renders whatever
 * arrived, because the codes on the graph are what the consultant came for and a
 * screen that blanks on an unfamiliar verdict has thrown away a working answer.
 * `banners` puts the loud notice above it either way.
 */
export function readVerdict(
  result: IDocInspectorTransaction | null | undefined,
): VerdictReading {
  const code = (result?.verdict ?? '').trim()
  // 🚩 `published`, never a bare index: `VERDICTS['constructor']` is an inherited
  // FUNCTION, and it would pass the `!entry` test below as a known verdict
  // carrying an undefined severity and a raw key on screen (`code-table.ts`).
  const entry = published(VERDICTS, code)
  const count = result?.documents?.length ?? 0

  if (!entry) {
    // ⚠️ **No verdict at all is not an unrecognised one.** A 200 whose envelope
    // carried `data: null`, or a payload missing the field, leaves nothing to
    // quote — and the unrecognised copy asks the consultant to report the raw
    // code, which would be an empty sentence asking for a blank. Its own two
    // lines, so the screen says what actually happened.
    const missing = code === ''
    return {
      code,
      known: false,
      sev: 'warn',
      showsDocuments: count > 0,
      contradiction: false,
      nameKey: missing ? `${KEY}.verdictMissing.name` : `${KEY}.verdictUnknown.name`,
      sentenceKey: missing ? `${KEY}.verdictMissing.sentence` : `${KEY}.verdictUnknown.sentence`,
    }
  }

  const contradiction = entry.showsDocuments && count === 0
  return {
    code,
    known: true,
    // ⚠️ **A contradiction takes the whole reading, not just the sentence.** The
    // documents family carries `ok`, so keeping the entry's own severity and name
    // here would put a green *Processed* pill over a sentence saying the server
    // contradicted itself — the same shape of trap as a `GaveUp` that reads like
    // success, one row down.
    sev: contradiction ? 'warn' : entry.sev,
    showsDocuments: entry.showsDocuments && count > 0,
    contradiction,
    nameKey: contradiction ? `${KEY}.verdictContradiction.name` : `${KEY}.verdict.${code}.name`,
    sentenceKey: contradiction
      ? `${KEY}.verdictContradiction.sentence`
      : `${KEY}.verdict.${code}.sentence`,
  }
}

/**
 * What the screen was told about the offending export-version column — **three
 * states, and collapsing any two of them makes the banner lie.**
 *
 * ⚠️ `blank` and `unstated` are not the same fact. A NULL column arrives from the
 * server as `""` (its `StringType` coerces it) and *is* a disagreement, because
 * the legacy uploader batches on null as well as on `'L'` — so the screen says
 * the column is empty. `unstated` is the screen never having been told: the
 * verdict said the stamp disagrees but no attention block came with it. Saying
 * "the column is empty" there would be inventing the very fact this banner exists
 * to report.
 */
export type ExportVersionQuote =
  | { kind: 'value'; value: string }
  | { kind: 'blank' }
  | { kind: 'unstated' }

const UNSTATED: ExportVersionQuote = { kind: 'unstated' }

/** A finding drawn above the graph. `code` is the raw value that produced it —
 *  the verdict's or the attention block's — so a loud banner can quote it. */
export interface VerdictBanner {
  kind: BannerKind
  code: string
  /** ⚠️ The column **verbatim**, never normalised: this is the value a consultant
   *  quotes to whoever owns the export-version spec. */
  exportVersion: ExportVersionQuote
}

/**
 * Every banner this answer earns, loudest first.
 *
 * 🔑 **Held documents and a disagreeing stamp are NOT empty states.** They render
 * in full, under a banner: a held document is a finding, and a transaction being
 * exported by both rails is the one thing this screen must not smooth over — it
 * would otherwise be the only place a double-posted invoice looks entirely normal.
 *
 * 🚩 **The hold-back is recovered even when the verdict had to drop it.** The
 * verdict is single-valued and BackOffice 1391 ruled that
 * `ProcessedButStampedLegacy` outranks `ProcessedWithHeldDocuments`, on the
 * reasoning that the hold-back stays legible off the graph. This is where it stays
 * legible: any document carrying `isHeld` earns the held banner whatever the
 * verdict says. Deduplicated by kind, so a verdict and an attention block naming
 * one finding never draw it twice.
 */
export function banners(result: IDocInspectorTransaction | null | undefined): VerdictBanner[] {
  if (!result) return []

  const out: VerdictBanner[] = []
  const push = (kind: BannerKind, code: string, exportVersion = UNSTATED) => {
    if (!out.some((b) => b.kind === kind)) out.push({ kind, code, exportVersion })
  }

  const reading = readVerdict(result)
  // Loudest first: a code neither repository recognises is a defect in the
  // contract, and it outranks any finding the payload was trying to report.
  //
  // 🚩 Only over a GRAPH. With nothing to draw, `VerdictEmptyState` already says
  // this in the document area's own place — a banner above it would be the same
  // shout twice, and the empty state is the louder of the two.
  // ⚠️ **A verdict that never arrived is not an unrecognised one**, and the two
  // must not share a banner: "the server answered , which this screen does not
  // know — report the raw code" asks a consultant to report a blank. Same
  // distinction `readVerdict` draws, and the same reasoning that drops a
  // codeless attention block below.
  if (!reading.known && reading.showsDocuments)
    push(reading.code === '' ? 'missingVerdict' : 'unknownVerdict', reading.code)

  const attention = result.attention
  const attentionCode = (attention?.code ?? '').trim()
  // ⚠️ A block with **no code names nothing**, and is dropped rather than drawn:
  // the block's whole contract is a machine code, and "the server flagged this
  // with , which this screen does not know" is a banner about nothing. The
  // disagreement itself is not lost with it — the verdict's own fallback below
  // still fires.
  if (attention && attentionCode !== '') {
    const version = attention.exportVersion
    push(
      published(ATTENTION_BANNERS, attentionCode) ?? 'unknownAttention',
      attentionCode,
      // 🚩 A block that arrived is a block that was TOLD — including when what it
      // was told is a blank column. Only the absence of a block is `unstated`.
      version === null || version === undefined
        ? UNSTATED
        : version.trim() === ''
          ? { kind: 'blank' }
          : { kind: 'value', value: version.trim() },
    )
  }

  const own = published(VERDICTS, reading.code)?.banner
  // ⚠️ Kept as a fallback rather than deleted as redundant: a
  // `ProcessedButStampedLegacy` that arrived without its attention block would
  // otherwise render as an ordinary transaction, losing the finding entirely.
  if (own) push(own, reading.code)

  if (result.documents?.some(isHeld)) push('held', reading.code)

  return out
}

/**
 * Was this document held back from batching?
 *
 * 🔑 **The answer to "which one".** BackOffice 1390 shipped
 * `ProcessedWithHeldDocuments` as a verdict only, which told a consultant that one
 * of two documents was held without saying which; 1391 answered it on the document
 * itself. So the banner names the finding and the card names the document, and
 * neither is enough alone.
 *
 * ⚠️ `=== true` and nothing looser: a payload predating the field must read as
 * *not held* rather than as truthy-adjacent noise.
 */
export function isHeld(doc: IDocInspectorDocument): boolean {
  return doc.isHeld === true
}
