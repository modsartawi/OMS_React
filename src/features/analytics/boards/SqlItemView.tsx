import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import { sqlEditHref } from '@/core/analytics-routes'
import i18n from '@/core/i18n'
import { saysIn } from '@/core/rules/sentence'
import { useSession } from '@/core/session'
import { buttonClass } from '@/core/ui/control-classes'
import { analyticsAccessQuery, canCurateAnalytics, canEditSql, canViewAnalytics } from './access'
import { analyticsApi, analyticsSqlItemKey } from './api'
import Refused from './Refused'
import { SqlRefusalNote, SqlResultTable } from './SqlResult'
import { sqlItemActions } from './sql-editor'
import SqlMark from './SqlMark'
import { sqlMark } from './sql-panel'

/**
 * A SQL item at `/analytics/view/:id` (ticket 890): its title and mark, its kept result (or the reason it did not run),
 * its statement folded, and Edit — the SQL editor — for its owner with the SQL grant, or a curator.
 */
export default function SqlItemView({ id }: { id: string }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const item = useQuery({ queryKey: analyticsSqlItemKey(id), queryFn: () => analyticsApi.sqlItem(id), retry: false })
  const access = useQuery(analyticsAccessQuery()).data
  const userId = useSession((s) => s.userId)
  if (item.error) return <Refused err={item.error} fallbackKey="sqlEditor.loadFailed" />
  if (!item.data) {
    return (
      <div className="text-sm text-muted-foreground" role="status">
        {t('sqlEditor.loading')}
      </div>
    )
  }
  const sql = item.data
  const acts = sqlItemActions(sql, { userId, canView: canViewAnalytics(access), canSql: canEditSql(access), canCurate: canCurateAnalytics(access) })
  const title = saysIn(sql.title, lang)
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-analytics-view={sql.id} data-analytics-sql-item>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight" data-analytics-view-title>
            <bdi>{title}</bdi>
          </h2>
          <SqlMark mark={sqlMark(sql)} />
        </div>
        {(acts.edit || acts.verify) && (
          <Link to={sqlEditHref(sql.id)} className={buttonClass('secondary')} data-analytics-sql-edit>
            <Pencil className="size-3.5" aria-hidden />
            {t('sqlEditor.edit')}
          </Link>
        )}
      </header>
      {sql.sql?.result ? (
        <SqlResultTable result={sql.sql.result} />
      ) : sql.sql?.refusal ? (
        <SqlRefusalNote refusal={sql.sql.refusal} statement={sql.definition.statement} />
      ) : null}
      <details className="rounded-lg border border-border p-2 text-xs">
        <summary className="cursor-pointer select-none font-medium text-muted-foreground">{t('sqlEditor.statement')}</summary>
        <pre dir="ltr" className="mt-2 w-full overflow-x-auto whitespace-pre rounded bg-muted p-2 text-start font-mono text-[11px] text-foreground">
          {sql.definition.statement}
        </pre>
      </details>
    </article>
  )
}
