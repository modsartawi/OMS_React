import { useTranslation } from 'react-i18next'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import { customerRows, documentGroupRows } from './fields'
import FieldGroup from './FieldGroup'

/**
 * The Screen 2 header area — the read-only Document and Customer groups. The
 * Dawaa Now badge and the command panel live elsewhere.
 *
 * The Status summary group left with ticket 090: its four rows were Overall,
 * Last Action, Ready and Delivery — three of them are now the pill rail above,
 * and all four remain in the rail's All-statuses disclosure.
 */
export default function DocumentHeader({ document }: { document: SdDocumentHeaderModel }) {
  const { t } = useTranslation('document')
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] items-start gap-2.5">
      <FieldGroup title={t('groups.document')} fields={documentGroupRows(document, t)} />
      <FieldGroup title={t('groups.customer')} fields={customerRows(document, t)} />
    </div>
  )
}
