import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Wand2 } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { guardDraftQuery } from '@/core/insurance-rules/api'
import { GuardSeverityBadge } from '@/core/insurance-rules/badges'
import { ConditionTree } from '@/core/insurance-rules/GuardSentenceView'
import { ruleSeverity, type GuardList } from '@/core/insurance-rules/model'
import { guardSentence } from '@/core/insurance-rules/sentence'
import { templateOut, type GuardTemplate, type TemplateSource } from '@/core/insurance-rules/templates'
import JsonButton from '@/core/insurance-rules/JsonButton'
import { saysIn } from '@/core/rules/sentence'
import SaysBoth from '@/core/rules/SaysBoth'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { fsi } from '@/core/util/bidi'
import { templatesQuery } from './api'
import FillDialog from './FillDialog'
import { DeniedCard } from '@/core/insurance-rules/parts'

/**
 * Insurance rules ▸ Templates — `/insurance-rules/templates` (BackOffice spec 3126, door 3139, oms ticket 609).
 * The gallery: HQ's phase-1 guard templates (3093, each with its DUR conflict code) and the team's own, saved
 * from any rule. "Use this template" asks for its blanks and makes an independent draft rule, opened in the
 * editor.
 *
 * 🚩 UNGATED: no access probe until 618; a bare 403 on the read is "You do not have access".
 */
export default function TemplatesPage() {
  const { t } = useTranslation('insurance-templates')
  return (
    <section className="flex w-full max-w-6xl flex-col gap-4" data-templates-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
      </header>
      <Gallery />
    </section>
  )
}

const SOURCES: readonly TemplateSource[] = ['phase1', 'team']

function Gallery() {
  const { t } = useTranslation('insurance-templates')
  const templates = useQuery(templatesQuery())
  // The ruleset's item lists name a template's lists, and fill its list blanks.
  const draft = useQuery(guardDraftQuery())
  const [using, setUsing] = useState<GuardTemplate | null>(null)
  const lists = draft.data?.lists ?? []

  if (templates.isError && isBareDenial(templates.error)) return <DeniedCard ns="insurance-templates" hook="templates-denied" />
  if (templates.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(templates.error, t('failed'))} />
  if (!templates.data)
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('loading')}
      </div>
    )

  return (
    <>
      {SOURCES.map((source) => {
        const shown = templates.data.filter((x) => x.origin === source)
        return (
          <section key={source} className="flex flex-col gap-2" data-templates={source}>
            <h2 className="text-sm font-semibold">{t(`source.${source}`)}</h2>
            <p className="text-xs text-muted-foreground">{t(`source.${source}Hint`)}</p>
            {shown.length === 0 ? (
              <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-templates-empty={source}>
                {t(`source.${source}Empty`)}
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {shown.map((x) => (
                  <li key={x.id}>
                    <TemplateCard template={x} lists={lists} onUse={() => setUsing(x)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
      {using && draft.data && <FillDialog template={using} draft={draft.data} onClose={() => setUsing(null)} />}
    </>
  )
}

function TemplateCard({ template, lists, onUse }: { template: GuardTemplate; lists: readonly GuardList[]; onUse: () => void }) {
  const { t, i18n } = useTranslation('insurance-templates')
  const severity = ruleSeverity(template.rule)
  const s = useMemo(() => guardSentence(template.rule, lists), [template.rule, lists])
  const blanks = template.blanks.length
  return (
    <article className="flex h-full flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 text-sm" data-template={template.id}>
      <div className="flex flex-wrap items-center gap-2">
        {severity && <GuardSeverityBadge severity={severity} />}
        {template.conflictCode && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs" data-conflict-code={template.conflictCode}>
            {t('conflictCode')}
            <code className="font-mono font-semibold">
              <Ltr>{template.conflictCode}</Ltr>
            </code>
          </span>
        )}
      </div>
      <h3 className="font-semibold" data-template-name="">
        <SaysBoth says={template.name} />
      </h3>
      <div className="text-xs" data-template-reads="">
        <ConditionTree nodes={s.conditions} />
      </div>
      {template.origin === 'team' && (template.updatedBy || template.updatedAt) && (
        <p className="text-xs text-muted-foreground" data-template-by="">
          {t('savedBy')} <bdi>{template.updatedBy}</bdi> {template.updatedAt && <Ltr>{formatDateTime(template.updatedAt)}</Ltr>}
        </p>
      )}
      <div className="mt-auto flex items-center gap-2 pt-1">
        <span className="text-xs text-muted-foreground" data-blanks={blanks}>
          {t('blanks', { count: blanks, n: fsi(String(blanks)) })}
        </span>
        <JsonButton title={t('json', { name: fsi(saysIn(template.name, i18n.language)) })} value={templateOut(template)} hook={`template-${template.id}`} />
        <Button variant="primary" className="ms-auto" onClick={onUse} data-use-template={template.id}>
          <Wand2 className="h-3.5 w-3.5" aria-hidden />
          {t('use')}
        </Button>
      </div>
    </article>
  )
}
