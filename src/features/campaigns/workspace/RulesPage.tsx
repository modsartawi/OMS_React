import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { ruleCatalogueQuery } from '@/core/rules/api'
import type { SentenceContext } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { useWorkspace } from './context'
import RuleCard from './RuleCard'

/**
 * The Rule builder (ticket 504), read-only for now: the campaign's rules top to bottom, each a
 * collapsible card read as sentences from the block catalogue (fetched once and kept,
 * `ruleCatalogueQuery`). 505 adds the palette, the panels and Undo / Redo / Cancel / Save.
 */
export default function RulesPage() {
  const { t, i18n } = useTranslation('campaign-workspace')
  const { campaign: c } = useWorkspace()
  const catalogue = useQuery(ruleCatalogueQuery())
  /** The rules the reader closed; every rule opens expanded. */
  const [shut, setShut] = useState<ReadonlySet<string>>(() => new Set())

  const toggle = (id: string) =>
    setShut((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  let body: ReactNode
  if (catalogue.isPending) {
    body = (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('rules.catalogueLoading')}
      </div>
    )
  } else if (catalogue.isError) {
    body = (
      <ErrorBanner className="p-3" title={t('rules.catalogueFailedTitle')} message={apiErrorMessage(catalogue.error, t('rules.catalogueFailed'))}>
        <Button variant="outlined" className="mt-2" onClick={() => void catalogue.refetch()} disabled={catalogue.isFetching} data-catalogue-retry="">
          {t('rules.retry')}
        </Button>
      </ErrorBanner>
    )
  } else if (!c.rules.length) {
    body = <p className="text-sm text-muted-foreground">{t('rules.noRules')}</p>
  } else {
    const has = (key: string, count?: number) => i18n.exists(key, { ns: 'campaign-workspace', ...(count === undefined ? {} : { count }) })
    body = (
      <div className="flex flex-col gap-3" data-rules="">
        {c.rules.map((rule, i) => {
          const ctx: SentenceContext = { campaign: c, rule, catalogue: catalogue.data, has }
          return <RuleCard key={rule.id} rule={rule} index={i} open={!shut.has(rule.id)} onToggle={() => toggle(rule.id)} ctx={ctx} />
        })}
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4" data-rule-builder="">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-lg font-semibold tracking-tight">{t('rules.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('rules.intro')}</p>
        </div>
        {c.rules.length > 1 && catalogue.isSuccess && (
          <div className="flex gap-2">
            <Button variant="outlined" onClick={() => setShut(new Set(c.rules.map((r) => r.id)))} data-rules-collapse-all="">
              {t('rules.collapseAll')}
            </Button>
            <Button variant="outlined" onClick={() => setShut(new Set())} data-rules-expand-all="">
              {t('rules.expandAll')}
            </Button>
          </div>
        )}
      </header>
      {body}
    </section>
  )
}
