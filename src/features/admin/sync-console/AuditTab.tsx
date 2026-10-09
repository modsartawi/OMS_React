import { useTranslation } from 'react-i18next'
import { EMPTY_AUDIT_FILTER } from './control-helpers'
import AuditFeed from './AuditFeed'

/** The store page's Audit tab (ticket 447): the fleet-wide feed, narrowed to this store's code. */
export default function AuditTab({ code }: { code: string }) {
  const { t } = useTranslation('sync-console')
  return <AuditFeed filter={{ ...EMPTY_AUDIT_FILTER, code }} empty={t('audit.emptyStore')} />
}
