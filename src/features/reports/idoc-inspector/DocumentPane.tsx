import { useTranslation } from 'react-i18next'
import type { IDocInspectorDocument } from '@/core/models/idoc-inspector'
import { formatDateTime } from '@/core/util/date-format'
import { formatMoney } from '@/core/util/number-format'
import { documentPane, exportBadge } from './document-graph'
import { FiPane, PaymentsPane } from './DocumentPanes'
import ExportStateBadge from './ExportStateBadge'
import LineTable from './LineTable'
import MintedByFilter from './MintedByFilter'
import { filterLines } from './provenance'

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

  const attributes: { key: string; label: string; value: string }[] = [
    { key: 'receipt', label: t('idocInspector.document.receipt'), value: doc.receiptNumber },
    { key: 'pharmacy', label: t('idocInspector.document.pharmacy'), value: doc.pharmacyId },
    { key: 'billingType', label: t('idocInspector.document.billingType'), value: doc.billingType },
    {
      key: 'paymentGroup',
      label: t('idocInspector.document.paymentGroup'),
      value: doc.paymentGroupId,
    },
    {
      key: 'split',
      label: t('idocInspector.document.split'),
      // 🚩 `splitRatio` is a FRACTION, not a percentage — the engine's billing
      // split writes `1.000000000000` for a whole document — so it is scaled
      // here and nowhere else.
      value: t('idocInspector.document.splitValue', {
        amount: formatMoney(doc.splitAmount),
        percent: Math.round((doc.splitRatio ?? 0) * 100),
      }),
    },
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
        {/* ⚠️ There is deliberately no ERROR badge here yet. A document held out
            of batching is a finding that renders in full under an attention
            banner, and that whole story — banner, verdict and the fields it
            reads — is ticket 298's; splitting it across two slices would put
            half a finding on the screen. */}
        <span className="ms-auto">
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
