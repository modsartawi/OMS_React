import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { CONFIG_CHANGE_ACTIONS, CONFIG_ENTITY_TYPES, type ConfigChangeRow } from './change-log-types'
import FieldDiffView from './FieldDiffView'

const KNOWN_ACTIONS = new Set<string>(CONFIG_CHANGE_ACTIONS)
const KNOWN_KINDS = new Set<string>(CONFIG_ENTITY_TYPES)
/** The kinds whose `documentType` names a document type (its own row and its child rows): they link to its page. */
const DOCUMENT_TYPE_KINDS = new Set(['DocumentType', 'ItemCategoryAssignment', 'PlantNetwork'])

/**
 * One change-log row (ticket 3152) — on a History tab and on the Config changes page: what changed (kind, key, action,
 * the type it was copied from), who and when, why, and the field-level diff. The kind and key are always shown — a
 * History tab of one thing holds its child rows too. `linkType` (the Config changes page) links a document type's
 * rows to that type's History.
 */
export default function ChangeEntry({ row, linkType = false }: { row: ConfigChangeRow; linkType?: boolean }) {
  const { t } = useTranslation('doc-type-config')
  const action = KNOWN_ACTIONS.has(row.action) ? t(`actions.${row.action}`) : <Ltr>{row.action}</Ltr>
  const kind = KNOWN_KINDS.has(row.entityType) ? t(`entityTypes.${row.entityType}`) : <Ltr>{row.entityType}</Ltr>
  const reason = row.reason.trim()

  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" data-change={row.changeId} data-change-action={row.action}>
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold" data-change-action-label="">
          {action}
        </span>
        <span className="text-muted-foreground">{kind}</span>
        <span className="font-mono" data-change-key="">
          <Ltr>{row.entityKey}</Ltr>
        </span>
        {linkType && row.documentType && DOCUMENT_TYPE_KINDS.has(row.entityType) && (
          <Link to={`/admin/doc-types/${encodeURIComponent(row.documentType)}?tab=history`} className="text-xs text-primary hover:underline" data-change-open="">
            {t('change.openType')}
          </Link>
        )}
        {row.copiedFrom && (
          <span className="text-xs text-muted-foreground" data-change-copied-from={row.copiedFrom}>
            {t('change.copiedFrom')} <Ltr>{row.copiedFrom}</Ltr>
          </span>
        )}
        <span className="ms-auto flex items-baseline gap-2 text-xs text-muted-foreground">
          <Ltr>{formatDateTime(row.changedAt)}</Ltr>
          <span data-change-by="">
            <Ltr>{row.changedBy}</Ltr>
          </span>
        </span>
      </header>
      <p className="text-sm" data-change-reason="">
        <span className="text-muted-foreground">{t('change.reason')}: </span>
        {reason ? <bdi>{reason}</bdi> : <span className="text-muted-foreground">{t('value.blank')}</span>}
      </p>
      <FieldDiffView row={row} />
    </article>
  )
}
