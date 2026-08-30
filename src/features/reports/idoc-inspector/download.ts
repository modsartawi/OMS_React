/**
 * What the download strip offers, and what to call the file when the server did
 * not say (ticket 299).
 *
 * Pure — no React, no i18n, no network. The two decisions here are the ones a
 * component could get wrong without a typecheck noticing: *which* buttons exist,
 * and what a nameless blob is saved as.
 */
import type { IDocInspectorDocument } from '@/core/models/idoc-inspector'
import type { LookupKey } from './lookup-key'

/**
 * The distinct IDoc types this transaction produced — **one button each**.
 *
 * 🔑 **Per TYPE, never per document and never per line.** The rail above is per
 * document, and a transaction can split into two documents of one type; the file
 * a SAP consultant hands over is per type, so two buttons for one type would
 * offer the same file twice. Equally, one button for the whole transaction is
 * ruled out at the other end: aggregated and financial are two downloads, never a
 * bundle, because all three serialisers emit the same envelope and a mixed file
 * would be structurally legal and semantically false.
 *
 * 🚩 **Export state is not a filter and neither is `isHeld`.** Exported, batched
 * but not exported, and not batched all yield the same file — export state
 * changes what the consultant is *told*, not what they can *take*. The 3.1% of
 * production sitting in no batch at all is exactly the population that most needs
 * its XML looked at.
 *
 * ⚠️ **A blank type is dropped**, because `idocType` is required on the wire: a
 * button for one could only ever produce `400 IDOC_TYPE_REQUIRED`, a refusal the
 * screen would have offered the user itself. It is trimmed for the same reason a
 * padded value must not become a second button — the server matches documents on
 * the value, not on a rendering of it.
 *
 * Kept OUT of `document-graph.ts` deliberately: that module answers questions
 * about one document (its pane, its badge, its counts), and this is a question
 * about the transaction — the shape 297 predicted when it declined to build this
 * helper without a caller.
 */
export function idocTypesPresent(
  documents: readonly IDocInspectorDocument[] | null | undefined,
): string[] {
  const seen: string[] = []
  for (const doc of documents ?? []) {
    const type = (doc.iDocType ?? '').trim()
    if (type !== '' && !seen.includes(type)) seen.push(type)
  }
  return seen
}

/**
 * The name to save under when `Content-Disposition` carried none.
 *
 * 🔑 **The server owns the filename and the client uses what it is given** — this
 * is only reached when the header was absent or unparseable, which is a proxy
 * fault rather than a state the rail produces. It exists because saving a blob
 * with no name at all puts an opaque `download` in the consultant's folder, and
 * the whole point of the name is that files from several lookups do not collide.
 *
 * ⚠️ **A mirror of the server's `IDocInspectorDownloadFileName`, and a mirror can
 * drift.** It is copied rather than invented so the fallback and the real name
 * never look like two different files; if the server's format changes this is a
 * second place to change.
 *
 * ⚠️ **Local wall-clock, never UTC**, and this is not a stylistic choice: the
 * whole estate runs on one clock, and a UTC stamp would name a different calendar
 * day than the consultant's own between midnight and 03:00 — on a file whose
 * entire purpose is to be filed and found again.
 *
 * 🚩 Minutes and not seconds: two lookups a minute apart must not collide, and
 * two in the same minute are the same file taken twice.
 *
 * ⚠️ The stamp is the moment the file was **taken**, not the moment it was
 * exported. The document row carries a creation timestamp and no update
 * timestamp, so nothing here — and nothing on the screen — may claim to be what
 * SAP received.
 */
export function fallbackFileName(key: LookupKey, idocType: string, takenAt: Date): string {
  const stamp =
    `${takenAt.getFullYear()}${pad2(takenAt.getMonth() + 1)}${pad2(takenAt.getDate())}` +
    `-${pad2(takenAt.getHours())}${pad2(takenAt.getMinutes())}`
  return `idoc_${safe(idocType)}_${safe(key.storeCode)}_${safe(key.trxNumber)}_${stamp}.xml`
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/**
 * Keeps a key part to characters a file name can hold — the server's own rule,
 * letter/digit/hyphen/dot through, everything else an underscore.
 *
 * ⚠️ **Unicode-aware (`\p{L}\p{N}`), not `A-Za-z0-9`, because the rule being
 * mirrored is `char.IsLetterOrDigit`** — which passes non-ASCII letters. An ASCII
 * class here would sanitise a non-Latin store code differently from the server
 * and produce exactly the two-different-looking-files outcome this mirror exists
 * to prevent.
 */
const safe = (part: string): string => part.replace(/[^\p{L}\p{N}.-]/gu, '_')
