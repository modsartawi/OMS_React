import { useTranslation } from 'react-i18next'
import type { IDocInspectorDocument } from '@/core/models/idoc-inspector'
import { formatMoney } from '@/core/util/number-format'
import { documentCounts, documentPane } from './document-graph'
import ExportStateBadge from './ExportStateBadge'

/**
 * The document rail — **level one of the screen's two-level navigation budget**
 * (ticket 297, BackOffice 1381).
 *
 * 🔑 **Selection, not a tree and not a master-detail split.** At most five
 * documents exist on any transaction (measured, not assumed), which is few
 * enough to show all at once and too heavy to stack down the page. A right-hand
 * detail column is what the nearest comparable screen in this repo *removed*;
 * the surface is already two levels deep and a side panel makes a third.
 *
 * 🚩 Selecting a card is a **render, never a request** — the whole graph arrived
 * in one call.
 *
 * The card carries the batch story: type, receipt, payment group, split and row
 * counts, plus one **export badge**. It carries no action: the download is one
 * button per IDoc type on the verdict strip (ticket 299), because a per-document
 * button would imply a per-document file, which is not what the download is.
 */
export default function DocumentRail({
  documents,
  selected,
  onSelect,
}: {
  documents: IDocInspectorDocument[]
  selected: number
  onSelect: (index: number) => void
}) {
  const { t } = useTranslation('reports')

  return (
    <div
      role="group"
      aria-label={t('idocInspector.rail.label')}
      className="flex gap-2 overflow-x-auto pb-0.5"
    >
      {documents.map((doc, index) => {
        const counts = documentCounts(doc)
        const isFi = documentPane(doc) === 'fi'
        return (
          <button
            key={`${doc.pharmacyId}/${doc.receiptNumber}/${index}`}
            type="button"
            data-document-card={index}
            aria-pressed={index === selected}
            onClick={() => onSelect(index)}
            className={`flex min-w-[11.5rem] shrink-0 flex-col gap-1 rounded-lg border border-s-[3px] p-2.5 text-start transition-colors ${
              index === selected
                ? 'border-primary-border border-s-primary bg-primary-050'
                : 'border-border/60 border-s-transparent bg-card-2 hover:bg-accent/60'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {/* The raw type code, never a friendly name instead of it. */}
              <span className="font-mono text-[10px] font-bold tracking-wider">
                {doc.idocType}
              </span>
              <span className="text-[12.5px] font-semibold tabular-nums">
                {doc.receiptNumber}
              </span>
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {t('idocInspector.rail.split', {
                group: doc.paymentGroupId,
                amount: formatMoney(doc.splitAmount),
                // 🚩 A FRACTION, not a percentage — the billing split writes
                // `1.000000000000` for a whole document.
                percent: Math.round((doc.splitRatio ?? 0) * 100),
              })}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {isFi
                ? t('idocInspector.rail.fiCounts', { fiItems: counts.fiItems })
                : t('idocInspector.rail.counts', {
                    lines: counts.lines,
                    payments: counts.payments,
                  })}
            </span>
            <span>
              <ExportStateBadge state={doc.exportState} />
            </span>
          </button>
        )
      })}
    </div>
  )
}
