import { useTranslation } from 'react-i18next'
import type { IDocInspectorDocument } from '@/core/models/idoc-inspector'
import StatusBadge from '@/core/ui/StatusBadge'
import { CodeValue } from './CodeValue'
import { documentCounts, documentPane } from './document-graph'
import ExportStateBadge from './ExportStateBadge'
import { isHeld } from './verdict'

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
 * The card carries the batch story: the IDoc type **with its legend label**, the
 * receipt, the row counts and one **export badge**. It carries no
 * action: the download is one button per IDoc type on the verdict strip (ticket
 * 299), because a per-document button would imply a per-document file, which is
 * not what the download is.
 *
 * ⚠️ **The payment group and the split are gone** (ticket 300). 297 drew them from
 * 1381's prototype data while BackOffice 1388 was still open; the shipped payload
 * carries neither, so the line read `Group undefined · SAR 0.00 · 0%`. What
 * replaced it is the IDoc type's label — the vocabulary this card actually has a
 * code for. 🚩 The pharmacy is deliberately NOT on the card: it is the same value
 * on every document of one transaction, so a line of it would be three identical
 * sub-headings telling the cards apart by nothing. It is on the document strip,
 * once, where it belongs.
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
              {/* 🔑 The raw type code with its label beside it — never a friendly
                  name INSTEAD of it. This is the one card-level code the payload
                  carries, and it is what 299 hangs a download button off. */}
              <CodeValue vocabulary="iDocType" code={doc.iDocType} className="text-[10px]" />
              <span className="text-[12.5px] font-semibold tabular-nums">
                {doc.receiptNumber}
              </span>
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {isFi
                ? t('idocInspector.rail.fiCounts', { fiItems: counts.fiItems })
                : t('idocInspector.rail.counts', {
                    lines: counts.lines,
                    payments: counts.payments,
                  })}
            </span>
            <span className="flex flex-wrap items-center gap-1">
              <ExportStateBadge state={doc.exportState} />
              {/* 🔑 **Which document is held** (ticket 298, BackOffice 1391). The
                  banner names the finding; this names the document. Without it a
                  held document wears the same `not-batched` badge as an ordinary
                  unbatched one, which is the gap 1390 asserted out loud. */}
              {isHeld(doc) && (
                <span data-held={index}>
                  <StatusBadge sev="warn">{t('idocInspector.document.held')}</StatusBadge>
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
