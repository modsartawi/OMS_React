import { useTranslation } from 'react-i18next'
import type { PickSupportShapeMatch } from '@/core/models/pick-support'
import { Code, EnAr, TD, TH, Val } from './bits'

/**
 * A stuck shape's body, drawn by the shape card (ticket 496) and again in the fix dialog (ticket
 * 497), so the agent reads what is wrong and what the fix will touch before confirming: the
 * server's explanation and fix sentence (EN beside AR), then the donor requests and the delivery's
 * own documents it is about, each with its `action` tag (shown AS the code; the full sentence is
 * the shape's `fixEn` / `fixAr`).
 */
export default function ShapeBody({ card }: { card: PickSupportShapeMatch }) {
  const { t } = useTranslation('pick-support')
  const requests = card.requests ?? []
  const documents = card.documents ?? []
  return (
    <>
      <div>
        <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{t('shape.explanation')}</h4>
        <EnAr en={card.explanationEn} ar={card.explanationAr} name="explanation" />
      </div>
      <div>
        <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{t('shape.fix')}</h4>
        <EnAr en={card.fixEn} ar={card.fixAr} name="fix" />
      </div>
      {requests.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{t('shape.requests')}</h4>
          <div className="overflow-x-auto">
            <table className="text-sm" data-ps-card-requests="">
              <thead>
                <tr>
                  <th className={TH}>{t('shape.request')}</th>
                  <th className={TH}>{t('shape.document')}</th>
                  <th className={TH}>{t('shape.donorStore')}</th>
                  <th className={TH}>{t('shape.orderStore')}</th>
                  <th className={TH}>{t('shape.state')}</th>
                  <th className={TH}>{t('shape.action')}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.requestNo}>
                    <td className={TD}>
                      <Val value={r.requestNo} />
                    </td>
                    <td className={TD}>
                      <Val value={r.documentNo} />
                    </td>
                    <td className={TD}>
                      <Val value={r.donorStore} />
                    </td>
                    <td className={TD}>
                      <Val value={r.orderStore} />
                    </td>
                    <td className={TD}>
                      <Code>{r.state}</Code>
                    </td>
                    <td className={TD} data-ps-action={r.action}>
                      <Code>{r.action}</Code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {documents.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{t('shape.documents')}</h4>
          <div className="overflow-x-auto">
            <table className="text-sm" data-ps-card-documents="">
              <thead>
                <tr>
                  <th className={TH}>{t('shape.document')}</th>
                  <th className={TH}>{t('shape.store')}</th>
                  <th className={TH}>{t('shape.state')}</th>
                  <th className={TH}>{t('shape.action')}</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.documentNo}>
                    <td className={TD}>
                      <Val value={d.documentNo} />
                    </td>
                    <td className={TD}>
                      <Val value={d.storeCode} />
                    </td>
                    <td className={TD}>
                      <Code>{d.state}</Code>
                    </td>
                    <td className={TD} data-ps-action={d.action}>
                      <Code>{d.action}</Code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
