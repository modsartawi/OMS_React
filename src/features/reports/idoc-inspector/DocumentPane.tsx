import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { IDocInspectorDocument } from '@/core/models/idoc-inspector'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { CodeValue } from './CodeValue'
import { documentPane, exportBadge } from './document-graph'
import { FiPane, PaymentsPane } from './DocumentPanes'
import ExportStateBadge from './ExportStateBadge'
import LineTable from './LineTable'
import MintedByFilter from './MintedByFilter'
import { filterLines } from './provenance'
import { isHeld } from './verdict'

/**
 * The selected document: its attribute strip, its minted-by filter, its lines,
 * and the one pane that hangs off it (ticket 297, BackOffice 1381).
 *
 * ⚠️ **The line table is NOT part of the pane choice.** Payments-versus-FI-lines
 * is the mutually-exclusive slot; the lines are every document's, whatever its
 * type. Hiding them behind the pane choice would be the same
 * silently-empty-section bug one level up.
 */
export default function DocumentPane({
  doc,
  openItemNumbers,
  filterTag,
  onToggleLine,
  onFilter,
}: {
  doc: IDocInspectorDocument
  openItemNumbers: ReadonlySet<number>
  filterTag: string | null
  onToggleLine: (itemNumber: number) => void
  onFilter: (tag: string | null) => void
}) {
  const { t } = useTranslation('reports')
  const badge = exportBadge(doc.exportState)
  const pane = documentPane(doc)
  const shownLines = filterLines(doc.lines, filterTag)

  // ⚠️ **Three attributes 297 drew are gone** (ticket 300): the billing type, the
  // payment group and the split. 297 modelled them from 1381's prototype data
  // while BackOffice 1388 was still open; the spec's payload outline names none of
  // them and the shipped `IDocInspectorDocument` carries none of them, so all
  // three were rendering `undefined` — and two of them were the very codes this
  // ticket was told to label. They come back the day the server ships them.
  const attributes: { key: string; label: string; value: ReactNode }[] = [
    {
      // 🔑 The strip's one CODE, raw, with the legend's label beside it — the
      // reason a consultant can read `SAPR` without a spreadsheet open beside the
      // monitor. A `ReactNode` value rather than a second hand-drawn block, so it
      // wears the strip's own label chrome and cannot drift a padding from it.
      key: 'idocType',
      label: t('idocInspector.document.idocType'),
      value: <CodeValue vocabulary="iDocType" code={doc.iDocType} className="text-[12px]" />,
    },
    { key: 'receipt', label: t('idocInspector.document.receipt'), value: doc.receiptNumber },
    { key: 'pharmacy', label: t('idocInspector.document.pharmacy'), value: doc.pharmacyId },
    {
      // ⚠️ The **IDoc batch** — a unit of delivery to SAP. The `batch` inside an
      // open line is a batch (CHARG), a physical lot of a material. Two words,
      // one screen; the labels keep them apart.
      key: 'batch',
      label: t('idocInspector.document.idocBatch'),
      value: doc.batch?.id ?? t('idocInspector.document.noBatch'),
    },
    {
      // ⚠️ **Read off the EXPORT STATE, not off the timestamp.** The batch row's
      // exported-at column is a non-nullable `DateTime`, so an unexported batch
      // carries the .NET default rather than a null — and printing it would put
      // `0001-01-01` where "not exported" belongs. `formatDateTime` blanks that
      // sentinel too, so the two guards agree; the state is what decides.
      key: 'exportedAt',
      label: t('idocInspector.document.exportedAt'),
      value:
        badge.key === 'exported'
          ? formatDateTime(doc.batch?.exportedAt) || t('idocInspector.document.exportedUndated')
          : t('idocInspector.document.notExported'),
    },
  ]

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {attributes.map((attribute) => (
          <span key={attribute.key} className="text-[12px]">
            <span className="me-1.5 text-[9.5px] font-bold uppercase tracking-wider text-ink-3">
              {attribute.label}
            </span>
            <span className="tabular-nums">{attribute.value}</span>
          </span>
        ))}
        <span className="ms-auto flex items-center gap-1.5">
          {/* 🔑 **Held, on the open document too** (ticket 298). The rail card
              carries the same mark so a held document is findable without opening
              each one; here it sits beside the export badge because that is where
              the question is answered — a held document wears `not-batched` and
              is NOT the ordinary unbatched document that badge otherwise means.
              ⚠️ There is deliberately no reason given: the generator's error type
              and message are not on the wire (BackOffice 1391), and inventing one
              would be this screen diagnosing. */}
          {isHeld(doc) && <StatusBadge sev="warn">{t('idocInspector.document.held')}</StatusBadge>}
          <ExportStateBadge state={doc.exportState} />
        </span>
      </div>

      <MintedByFilter lines={doc.lines} filterTag={filterTag} onFilter={onFilter} />

      {shownLines.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">
          {filterTag === null
            ? t('idocInspector.lines.none')
            : // A filter that matched nothing is an answer, not an empty
              // document — it must not look like one.
              t('idocInspector.lines.noneForTag')}
        </p>
      ) : (
        <LineTable
          lines={shownLines}
          openItemNumbers={openItemNumbers}
          filterTag={filterTag}
          onToggle={onToggleLine}
        />
      )}

      {pane === 'fi' ? <FiPane doc={doc} /> : <PaymentsPane doc={doc} />}
    </div>
  )
}
