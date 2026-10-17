import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ShoppingCart, TriangleAlert } from 'lucide-react'
import type { RuleItemFilter } from '@/core/models/rule-campaign'
import { filterLetsRxIn, type FilterNameProblem } from '@/core/rules/filters'
import LookupPicks from '@/core/rules/LookupPicks'
import { RX_CATEGORY } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { INPUT } from './builder-ui'

/**
 * A named cart-item filter as an editable chain (ticket 506; schema 1 in 522): the categories and
 * products it keeps — each searched on HQ (the lookups); a collection pick adds the collection's
 * products — then the categories it never discounts, then its name. Prescription (A006) is red
 * when it is not kept out. (Fee lines are a discount's own `scope`, no longer the filter's.)
 *
 * Controlled: `onChange` gets each change as a patch. "Certain items…" at a field holds a draft and
 * saves it whole; the rule card's chain edits the rule's filter in place, every change a history step.
 */
export default function FilterEditor({
  filter,
  onChange,
  nameProblem,
  footer,
  data,
}: {
  filter: RuleItemFilter
  /** `coalesce` folds a run of typing (the name) into one step. */
  onChange: (patch: Partial<Omit<RuleItemFilter, 'id'>>, coalesce?: boolean) => void
  nameProblem: FilterNameProblem
  footer: ReactNode
  data: string
}) {
  const { t } = useTranslation('campaign-workspace')
  const nameId = `filter-${data}-name`
  const problemId = `${nameId}-problem`
  // The same rule as the chain's flag: a filter held to other categories cannot reach Rx.
  const rxMissing = filterLetsRxIn(filter)
  const categories = filter.categories ?? []
  const articles = filter.articles ?? []
  const never = filter.exclude?.categories ?? []
  return (
    <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary-050/40 p-3" role="group" aria-label={t('filters.editor')} data-filter-editor={data}>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <ShoppingCart className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('filters.head')}
      </p>
      <div className="grid items-start gap-x-3 gap-y-2.5 sm:grid-cols-[11rem_1fr]">
        <LookupPicks kind="categories" label={t('filters.categories')} value={categories} onChange={(c) => onChange({ categories: c })} data="categories" />
        <LookupPicks
          kind="collections"
          label={t('filters.collections')}
          value={[]}
          onChange={() => {}}
          onPickHit={(hit) => onChange({ articles: [...new Set([...articles, ...(hit.articles ?? [])])] })}
          empty={t('filters.collectionsAdd')}
          data="collections"
        />
        <LookupPicks kind="materials" label={t('filters.materials')} value={articles} onChange={(a) => onChange({ articles: a })} data="articles" />
        <LookupPicks
          kind="categories"
          label={t('filters.never')}
          value={never}
          onChange={(c) => onChange({ exclude: { ...filter.exclude, categories: c } })}
          empty={t('filters.noneExcluded')}
          data="exclude"
          after={
            rxMissing && (
              <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-danger-800" data-rx-missing="">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                <span>
                  <Trans t={t} i18nKey="filters.rxMissing" values={{ code: RX_CATEGORY }} components={{ code: <Ltr /> }} />
                </span>
                <Button variant="danger-outlined" onClick={() => onChange({ exclude: { ...filter.exclude, categories: [...never, RX_CATEGORY] } })} data-keep-rx-out="">
                  {t('filters.keepRxOut')}
                </Button>
              </span>
            )
          }
        />
        <label htmlFor={nameId} className="pt-1.5 text-xs font-medium text-muted-foreground">
          {t('filters.name')}
        </label>
        <span className="flex flex-col gap-1">
          <input
            id={nameId}
            dir="auto"
            className={`${INPUT} w-56 font-mono`}
            value={filter.name}
            aria-invalid={nameProblem ? true : undefined}
            aria-describedby={nameProblem ? problemId : undefined}
            onChange={(e) => onChange({ name: e.target.value }, true)}
            data-filter-name-input=""
          />
          {nameProblem && (
            <span id={problemId} className="text-xs text-danger-800" data-filter-name-problem={nameProblem}>
              {t(`filters.nameProblem.${nameProblem}`)}
            </span>
          )}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t('filters.hint')}</p>
      <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>
    </div>
  )
}

