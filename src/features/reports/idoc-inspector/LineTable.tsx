import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Undo2 } from 'lucide-react'
import type { IDocInspectorLine } from '@/core/models/idoc-inspector'
import Ltr from '@/core/ui/Ltr'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import LineExpansion from './LineExpansion'
import { SourceTagChip } from './SourceTag'

/**
 * The document's line items — **level two of the navigation budget**, and the
 * last one (ticket 297, BackOffice 1381).
 *
 * 🔑 **No AG Grid.** The nearest solved problem in this repo — lines with
 * conditions — is exactly where a comparable feature's *last* AG Grid was
 * deliberately removed, on the reasoning that a handful of rows do not need
 * thirty rows' worth of grid chrome. This document's worst realistic case is ~60
 * lines and its typical one is four. A grid buys column resize and
 * virtualisation nobody here needs, and costs the in-place expansion the whole
 * shape rests on. ⚠️ **The idiom is reused, never the components** — that feature
 * is another feature and the import boundary forbids reaching into it.
 *
 * 🚩 **A line opens IN PLACE**: the expansion is its own row with a single
 * `colSpan` cell, so it is bounded by this table's width and can never widen the
 * frame. Any number of lines may be open at once; nothing ever opens by itself.
 */

/** The column count. Named because the expansion row spans it, and a `colSpan`
 *  that drifts from the `<colgroup>` puts the expansion in the wrong box. */
const COLUMNS = 6

const HEAD_CELL = 'px-2 py-1.5 font-bold'

export default function LineTable({
  lines,
  openItemNumbers,
  filterTag,
  onToggle,
}: {
  /** Already filtered by the minted-by bar — the table draws what it is given. */
  lines: IDocInspectorLine[]
  openItemNumbers: ReadonlySet<number>
  filterTag: string | null
  onToggle: (itemNumber: number) => void
}) {
  const { t } = useTranslation('reports')

  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col className="w-[46px]" />
        <col />
        <col className="w-[86px]" />
        <col className="w-[70px]" />
        <col className="w-[100px]" />
        <col className="w-[150px]" />
      </colgroup>
      <thead>
        <tr className="border-b border-border/70 text-[9.5px] uppercase tracking-wider text-ink-3">
          <th className={`${HEAD_CELL} text-start`}>{t('idocInspector.lines.head.pos')}</th>
          <th className={`${HEAD_CELL} text-start`}>{t('idocInspector.lines.head.item')}</th>
          <th className={`${HEAD_CELL} text-end`}>{t('idocInspector.lines.head.qty')}</th>
          <th className={`${HEAD_CELL} text-end`}>{t('idocInspector.lines.head.conditions')}</th>
          <th className={`${HEAD_CELL} text-end`}>{t('idocInspector.lines.head.amount')}</th>
          {/* 🔑 ONE provenance column, on the line and on every condition row
              inside it. The condition's own origin rides beside its tag. */}
          <th className={`${HEAD_CELL} text-start`}>{t('idocInspector.lines.head.mintedBy')}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const open = openItemNumbers.has(line.itemNumber)
          return [
            <tr
              key={line.itemNumber}
              data-line={line.itemNumber}
              tabIndex={0}
              role="button"
              aria-expanded={open}
              onClick={() => onToggle(line.itemNumber)}
              onKeyDown={(e) => onRowKey(e, () => onToggle(line.itemNumber))}
              className={`h-[34px] cursor-pointer border-s-[3px] border-b border-b-divider text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                open ? 'border-s-primary bg-card-2' : 'border-s-transparent hover:bg-accent/60'
              }`}
            >
              <td className="px-2 align-middle text-[11px] font-bold tabular-nums text-ink-3">
                <span className="flex items-center gap-0.5">
                  {/* The disclosure's affordance, seated beside the position
                      number rather than costing a seventh column. An SVG, so it
                      does not auto-mirror and needs the explicit flip — and the
                      flip is on the CLOSED state only, because the open one
                      points down and down is direction-neutral. */}
                  <ChevronRight
                    data-line-twisty={open ? 'open' : 'closed'}
                    className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                      open ? 'rotate-90' : 'rtl:-scale-x-100'
                    }`}
                    aria-hidden
                  />
                  {line.itemNumber}
                </span>
              </td>

              <td className="min-w-0 px-2 py-[2px]">
                {/* The material number reads first and is what a consultant
                    pastes into a SAP ticket. There is no description column on
                    this rail's line table — the row does not carry one, and a
                    permanently empty column teaches nothing. */}
                <div className="truncate text-[13px] font-medium leading-4 tabular-nums">
                  {line.materialNumber}
                </div>
                <div className="flex items-center gap-1.5 truncate text-[11px] leading-[13px] text-muted-foreground">
                  <span className="font-mono">{line.itemTypeCode}</span>
                  {line.isReturn && (
                    <span className="inline-flex items-center gap-0.5 text-attention-800">
                      <Undo2 className="h-3 w-3" aria-hidden />
                      {t('idocInspector.lines.isReturn')}
                    </span>
                  )}
                </div>
              </td>

              <td className="px-2 py-[2px] text-end text-[13px] text-muted-foreground">
                {/* A quantity and its unit are ONE value — isolated whole, never
                    as a fragment. */}
                <Ltr>{`${formatNumber(line.quantity)} ${line.salesUom ?? ''}`.trim()}</Ltr>
              </td>

              <td className="px-2 align-middle text-end text-[13px] tabular-nums text-muted-foreground">
                {line.conditions.length}
              </td>

              <td className="px-2 align-middle text-end text-[13px] font-semibold tabular-nums">
                {formatMoney(line.salesAmount)}
              </td>

              <td className="px-2 align-middle">
                <SourceTagChip tag={line.sourceTag} />
              </td>
            </tr>,

            // The expansion, in place: its own row, one `colSpan` cell. Rendered
            // only while open, so a closed line contributes nothing to the height.
            open ? (
              <tr
                key={`${line.itemNumber}-expansion`}
                className="border-b border-b-divider bg-card-2/40"
              >
                <td colSpan={COLUMNS} className="border-s-[3px] border-s-primary p-0">
                  <LineExpansion line={line} filterTag={filterTag} />
                </td>
              </tr>
            ) : null,
          ]
        })}
      </tbody>
    </table>
  )
}

/** Enter / Space toggles, mirroring a native button. */
function onRowKey(e: KeyboardEvent, toggle: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    toggle()
  }
}
