import { useTranslation } from 'react-i18next'
import { Database } from 'lucide-react'
import StatusBadge from '@/core/ui/StatusBadge'
import type { SqlMark as Mark } from './sql-panel'

/**
 * The "SQL" / "SQL, verified" mark (ticket 891, BackOffice spec 3632 Q43): wherever a SQL item is drawn — the library,
 * its own page, a board panel, a report block and the print page the PDF is made from. Nothing for a cube item.
 */
export default function SqlMark({ mark }: { mark: Mark | null }) {
  const { t } = useTranslation('boards')
  if (!mark) return null
  return (
    <span data-analytics-sql-mark={mark}>
      <StatusBadge sev={mark === 'verified' ? 'ok' : 'warn'}>
        <Database className="me-1 size-3" aria-hidden />
        {t(mark === 'verified' ? 'sqlEditor.markVerified' : 'sqlEditor.mark')}
      </StatusBadge>
    </span>
  )
}
