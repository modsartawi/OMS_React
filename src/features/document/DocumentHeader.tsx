import { useTranslation } from 'react-i18next'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import { customerRows, documentGroupRows, statusSummaryRows } from './fields'
import FieldGroup from './FieldGroup'

/**
 * The Screen 2 header area — the read-only Document, Status summary and
 * Customer groups. The Dawaa Now badge and the command panel live elsewhere.
 */
export default function DocumentHeader({ document }: { document: SdDocumentHeaderModel }) {
  const { t } = useTranslation('document')
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] items-start gap-2.5">
      <FieldGroup title={t('groups.document')} fields={documentGroupRows(document, t)} />
      <FieldGroup title={t('groups.status')} fields={statusSummaryRows(document, t)} />
      <FieldGroup title={t('groups.customer')} fields={customerRows(document, t)} />
    </div>
  )
}
