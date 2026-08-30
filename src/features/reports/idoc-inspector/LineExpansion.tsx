import { useTranslation } from 'react-i18next'
import type { IDocInspectorLine } from '@/core/models/idoc-inspector'
import { formatMoney } from '@/core/util/number-format'
import { CodeMark, DiscTypeCode } from './CodeValue'
import { conditionTypeMeaning } from './code-legend'
import { blankedInXml } from './document-graph'
import { XmlBlankedMark } from './DocumentPanes'
import { conditionsForTag } from './provenance'
import { ConditionProvenance } from './SourceTag'
import { SUB_HEAD_CELL_END, SUB_HEAD_CELL_START, SUB_ROW } from './sub-table'

/**
 * What an open line shows: **its item details and its conditions, in place**
 * (ticket 297, BackOffice 1381).
 *
 * 🔑 **Conditions are never a third navigation level.** They are the reason the
 * line was opened; putting them behind another click would bury the payload the
 * whole screen exists to show. Item details sit in the same disclosure for the
 * same reason — batch and tracking data is one gesture away, not two.
 *
 * The surface renders inside a `colSpan` cell of the lines table, so it is
 * bounded by that table's width and can never out-grow the frame it opened in.
 *
 * ⚠️ **Two absences are deliberate here** and are drawn nowhere rather than
 * conditionally: there is **no header-conditions pane** (this rail never writes
 * an item-0 condition, so it would be permanently blank and read as a bug), and
 * the *read the rate, not the value* rule does **not** apply — that governs the
 * pricing engine's condition table, not this one. Rate and value are both shown,
 * plainly.
 */
export default function LineExpansion({
  line,
  filterTag,
}: {
  line: IDocInspectorLine
  /** The minted-by filter, or `null`. A filtered expansion shows the matching
   *  conditions **and says how many there were**. */
  filterTag: string | null
}) {
  const { t } = useTranslation('reports')
  const conditions = conditionsForTag(line, filterTag)

  // The line's own attributes, drawn as pills beside its item details: an
  // ordered name/value list of one to three entries, which a table would be four
  // times the size of.
  //
  // ⚠️ `batch` here is a **batch (CHARG)** — the physical lot of this material —
  // and has nothing to do with the **IDoc batch** the document sits in. Both
  // words are on this one screen, so the label names which one this is.
  const pills: { key: string; label: string; value: string }[] = [
    ...(line.batchNumber
      ? [{ key: 'charg', label: t('idocInspector.line.charg'), value: line.batchNumber }]
      : []),
    ...(line.promotionId
      ? [{ key: 'promo', label: t('idocInspector.line.promotionId'), value: line.promotionId }]
      : []),
    ...line.itemDetails.map((detail) => ({
      key: `detail-${detail.seq}-${detail.attributeName}`,
      label: detail.attributeName,
      value: detail.attributeValue,
    })),
  ]

  return (
    <div data-line-expansion={line.itemNumber} className="flex flex-col gap-3 px-3 py-2.5">
      {pills.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t('idocInspector.expansion.itemDetails')}
          </div>
          <div className="flex flex-wrap gap-1">
            {pills.map((pill) => (
              <span key={pill.key} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
                <span className="me-1 font-mono text-[9px] font-bold tracking-wide text-ink-3">
                  {pill.label}
                </span>
                {pill.value}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {t('idocInspector.expansion.conditions')}{' '}
          <span className="font-medium text-ink-3">
            {/* 🚩 `1 of 4` under a filter — without the total, a filtered
                expansion reads as a line that only ever had one condition. */}
            {conditions.filtered
              ? t('idocInspector.expansion.conditionsFiltered', {
                  shown: conditions.shown.length,
                  total: conditions.total,
                })
              : t('idocInspector.expansion.conditionsCount', { total: conditions.total })}
          </span>
        </div>

        {conditions.shown.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            {/* Two different facts, and the filter is what tells them apart: a
                line that carries no conditions at all, and one whose conditions
                were all filtered out. Saying the second where the first is true
                blames a filter nobody set. */}
            {conditions.filtered
              ? t('idocInspector.expansion.noConditionsForTag')
              : t('idocInspector.expansion.noConditions')}
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-ink-3">
                <th className={SUB_HEAD_CELL_START}>{t('idocInspector.expansion.head.seq')}</th>
                <th className={SUB_HEAD_CELL_START}>{t('idocInspector.expansion.head.type')}</th>
                <th className={SUB_HEAD_CELL_START}>{t('idocInspector.expansion.head.meaning')}</th>
                <th className={SUB_HEAD_CELL_END}>{t('idocInspector.expansion.head.rate')}</th>
                <th className={SUB_HEAD_CELL_END}>{t('idocInspector.expansion.head.value')}</th>
                <th className={SUB_HEAD_CELL_START}>{t('idocInspector.expansion.head.discCode')}</th>
                <th className={SUB_HEAD_CELL_START}>{t('idocInspector.expansion.head.mintedBy')}</th>
              </tr>
            </thead>
            <tbody>
              {conditions.shown.map((condition) => (
                <tr
                  key={condition.seq}
                  data-condition={condition.seq}
                  className={SUB_ROW}
                >
                  <td className="px-1.5 py-1 font-mono tabular-nums">{condition.seq}</td>
                  {/* The raw condition type, and beside it the condition's CLASS
                      and CONTROL as two dotted marks carrying the legend's names.
                      🚩 Marks, not columns: the expansion already has seven inside
                      a `colSpan` cell, and two more to show two near-constant
                      letters would cost the in-place shape the screen rests on.
                      This is the idiom 297 settled for the condition origin. */}
                  <td className="px-1.5 py-1">
                    <span className="inline-flex items-baseline gap-1">
                      <span className="font-mono">{condition.conditionType}</span>
                      <CodeMark vocabulary="conditionClass" code={condition.conditionClass} />
                      <CodeMark vocabulary="conditionControl" code={condition.conditionControl} />
                    </span>
                  </td>
                  {/* 🔑 Open master data, resolved per row by the SERVER — the one
                      code on this screen that is not in the legend, because a
                      pricing analyst adds a condition type without a deployment.
                      No description ⇒ the code alone, already in the cell before
                      this one; nothing is invented to fill this one. */}
                  <td className="px-1.5 py-1 text-muted-foreground">
                    {conditionTypeMeaning(condition.conditionTypeDescription) ?? ''}
                  </td>
                  <td className="px-1.5 py-1 text-end tabular-nums">
                    {formatMoney(condition.conditionRate)}
                  </td>
                  <td className="px-1.5 py-1 text-end tabular-nums">
                    {formatMoney(condition.conditionValue)}
                    {blankedInXml(condition.discTypeCode) && (
                      <XmlBlankedMark id={`condition-${condition.seq}`} />
                    )}
                  </td>
                  <td className="px-1.5 py-1 font-mono text-muted-foreground">
                    <DiscTypeCode code={condition.discTypeCode} />
                  </td>
                  <td className="px-1.5 py-1">
                    <ConditionProvenance
                      tag={condition.sourceTag}
                      source={condition.conditionSource}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
