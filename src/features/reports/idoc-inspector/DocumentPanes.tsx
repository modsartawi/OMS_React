import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import type { IDocInspectorDocument } from '@/core/models/idoc-inspector'
import { formatMoney } from '@/core/util/number-format'
import { blankedInXml } from './document-graph'
import { SUB_HEAD_CELL_END, SUB_HEAD_CELL_START, SUB_ROW } from './sub-table'

/**
 * The **one document-level pane** — payments, or FI lines (ticket 297,
 * BackOffice 1381).
 *
 * 🔑 **One slot, not two.** Payments belong to an aggregated or
 * sales-as-per-receipt document and FI lines to a financial one, so drawing both
 * would always leave one empty.
 *
 * 🔑 **Neither carries provenance at all, and both SAY so.** There is no
 * source-tag column here — not an empty one — and the heading states it in
 * words, so a consultant never reads a blank column as missing data. The wire
 * model has no field for it either, which is what makes that a fact rather than
 * a rendering choice.
 *
 * They live together in one file because they are one decision: whichever
 * renders, the other must not, and the two headings must keep saying the same
 * sentence about provenance.
 */

/** The heading both panes share: a title plus the standing statement that these
 *  rows carry no provenance. */
function PaneHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mb-1 mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {title} <span className="font-medium normal-case text-ink-3">{note}</span>
    </div>
  )
}

export function PaymentsPane({ doc }: { doc: IDocInspectorDocument }) {
  const { t } = useTranslation('reports')
  return (
    <div data-pane="payments">
      <PaneHeading
        title={t('idocInspector.payments.title')}
        note={t('idocInspector.payments.noProvenance')}
      />
      {doc.payments.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">{t('idocInspector.payments.none')}</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-ink-3">
              <th className={SUB_HEAD_CELL_START}>{t('idocInspector.payments.head.seq')}</th>
              <th className={SUB_HEAD_CELL_START}>{t('idocInspector.payments.head.type')}</th>
              <th className={SUB_HEAD_CELL_START}>{t('idocInspector.payments.head.code')}</th>
              <th className={SUB_HEAD_CELL_START}>{t('idocInspector.payments.head.card')}</th>
              <th className={SUB_HEAD_CELL_START}>
                {t('idocInspector.payments.head.authorization')}
              </th>
              <th className={SUB_HEAD_CELL_END}>{t('idocInspector.payments.head.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {doc.payments.map((payment) => (
              <tr key={payment.seq} className={SUB_ROW}>
                <td className="px-1.5 py-1 font-mono tabular-nums">{payment.seq}</td>
                <td className="px-1.5 py-1 font-mono">{payment.conditionType}</td>
                <td className="px-1.5 py-1 font-mono text-muted-foreground">{payment.typeCode}</td>
                <td className="px-1.5 py-1">{payment.cardType}</td>
                <td className="px-1.5 py-1 font-mono text-muted-foreground">
                  {payment.authorizationNo}
                </td>
                <td className="px-1.5 py-1 text-end tabular-nums">
                  {formatMoney(payment.amount)}
                  {blankedInXml(payment.typeCode) && (
                    <XmlBlankedMark id={`payment-${payment.seq}`} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/**
 * The FI pane.
 *
 * ⚠️ **It renders even when it is empty, and that is the point.** The rail's
 * ordinary document loader excludes FI lines, so an FI document served through
 * it comes back with a silently empty section. An empty FI pane on an FI
 * document is a finding a consultant can report; a hidden one is a bug nobody
 * can see — so the emptiness is drawn in attention ink and says as much.
 */
export function FiPane({ doc }: { doc: IDocInspectorDocument }) {
  const { t } = useTranslation('reports')
  return (
    <div data-pane="fi">
      <PaneHeading title={t('idocInspector.fi.title')} note={t('idocInspector.fi.noProvenance')} />
      {doc.fiItems.length === 0 ? (
        <p className="text-[12px] text-attention-800">{t('idocInspector.fi.none')}</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-ink-3">
              <th className={SUB_HEAD_CELL_START}>{t('idocInspector.fi.head.number')}</th>
              <th className={SUB_HEAD_CELL_START}>{t('idocInspector.fi.head.glAccount')}</th>
              <th className={SUB_HEAD_CELL_START}>{t('idocInspector.fi.head.profitCenter')}</th>
              <th className={SUB_HEAD_CELL_START}>{t('idocInspector.fi.head.type')}</th>
              <th className={SUB_HEAD_CELL_START}>{t('idocInspector.fi.head.assignment')}</th>
              <th className={SUB_HEAD_CELL_END}>{t('idocInspector.fi.head.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {doc.fiItems.map((item) => (
              <tr key={`${item.fiTypeNumber}/${item.glAccount}`} className={SUB_ROW}>
                <td className="px-1.5 py-1 font-mono tabular-nums">{item.fiTypeNumber}</td>
                <td className="px-1.5 py-1 font-mono">{item.glAccount}</td>
                <td className="px-1.5 py-1 font-mono">{item.profitCenter}</td>
                <td className="px-1.5 py-1 font-mono text-muted-foreground">{item.fiTypeCode}</td>
                <td className="px-1.5 py-1">{item.assignment}</td>
                <td className="px-1.5 py-1 text-end tabular-nums">{formatMoney(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/**
 * ⚠️ **The stored row keeps this figure; the exported XML writes it blank.** The
 * screen shows the row — that is what it is for — and marks the disagreement.
 * Silently matching the XML instead would make the table lie about what is
 * stored, and this screen is about to hand that XML over (ticket 299).
 */
export function XmlBlankedMark({ id }: { id: string }) {
  const { t } = useTranslation('reports')
  return (
    <span
      data-xml-blanked={id}
      title={t('idocInspector.expansion.xmlBlanked')}
      className="ms-1 inline-flex cursor-help align-middle text-attention-800"
    >
      <TriangleAlert className="h-3 w-3" aria-label={t('idocInspector.expansion.xmlBlanked')} />
    </span>
  )
}
