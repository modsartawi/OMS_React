import { useId, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Check, Search, ShoppingCart, TriangleAlert, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { RuleItemFilter, RuleLookupKind } from '@/core/models/rule-campaign'
import { ruleLookupQuery } from '@/core/rules/api'
import { filterLetsRxIn, type FilterNameProblem } from '@/core/rules/filters'
import { RX_CATEGORY } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { INPUT, useDebounced } from './builder-ui'

/**
 * A named cart-item filter as an editable chain (ticket 506): what it looks at, then the
 * categories, collections and products it keeps — each searched on HQ (the lookups) — then the
 * categories it never discounts, then its name. Picks within a step match any; the steps narrow
 * each other. Prescription (A006) is red when it is not kept out.
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
  const scopeId = `filter-${data}-scope`
  const problemId = `${nameId}-problem`
  // The same rule as the chain's flag: a filter held to fee lines or to other categories cannot reach Rx.
  const rxMissing = filterLetsRxIn(filter)
  return (
    <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary-050/40 p-3" role="group" aria-label={t('filters.editor')} data-filter-editor={data}>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <ShoppingCart className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('filters.head')}
      </p>
      <div className="grid items-start gap-x-3 gap-y-2.5 sm:grid-cols-[11rem_1fr]">
        <label htmlFor={scopeId} className="pt-1.5 text-xs font-medium text-muted-foreground">
          {t('filters.lookAt')}
        </label>
        <span>
          <select id={scopeId} className={INPUT} value={filter.scope} onChange={(e) => onChange({ scope: e.target.value })} data-filter-scope="">
            {!SCOPES.includes(filter.scope) && <option value={filter.scope}>{fsi(filter.scope)}</option>}
            {SCOPES.map((s) => (
              <option key={s} value={s}>
                {t(`filters.scope.${s}`)}
              </option>
            ))}
          </select>
        </span>
        <LookupPicks kind="categories" label={t('filters.categories')} value={filter.cats} onChange={(cats) => onChange({ cats })} data="cats" />
        <LookupPicks kind="collections" label={t('filters.collections')} value={filter.colls} onChange={(colls) => onChange({ colls })} data="colls" />
        <LookupPicks kind="materials" label={t('filters.materials')} value={filter.skus} onChange={(skus) => onChange({ skus })} data="skus" />
        <LookupPicks
          kind="categories"
          label={t('filters.never')}
          value={filter.exclCats}
          onChange={(exclCats) => onChange({ exclCats })}
          empty={t('filters.noneExcluded')}
          data="excl"
          after={
            rxMissing && (
              <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-danger-800" data-rx-missing="">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                <span>
                  <Trans t={t} i18nKey="filters.rxMissing" values={{ code: RX_CATEGORY }} components={{ code: <Ltr /> }} />
                </span>
                <Button variant="danger-outlined" onClick={() => onChange({ exclCats: [...filter.exclCats, RX_CATEGORY] })} data-keep-rx-out="">
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

const SCOPES = ['items', 'fees', 'itemsAndFees']

/** A label and its controls on the editor's grid. */
function Step({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <>
      <label htmlFor={id} className="pt-1.5 text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
    </>
  )
}

/**
 * One step of the chain: the codes picked so far, each removable, and a search on HQ's lookup
 * (`ruleLookupQuery`) whose hits add a code. A material is found by its SKU or its name.
 */
function LookupPicks({
  kind,
  label,
  value,
  onChange,
  after,
  empty,
  data,
}: {
  kind: RuleLookupKind
  label: string
  value: string[]
  onChange: (codes: string[]) => void
  after?: ReactNode
  /** What an empty step reads; "Any" by default. */
  empty?: string
  data: string
}) {
  const { t } = useTranslation('campaign-workspace')
  const [find, setFind] = useState('')
  const q = useDebounced(find.trim(), 250)
  const hits = useQuery({ ...ruleLookupQuery(kind, q), enabled: q !== '' })
  const id = `lookup-${data}-${useId()}`
  const listId = `${id}-hits`
  // Only while the search settled on what is typed: a pick clears the input, and its old hits go with it.
  const searching = q !== '' && q === find.trim()
  const found = hits.data ?? []

  return (
    <Step id={id} label={label}>
      <span className="flex flex-wrap items-center gap-1.5" data-picks={data}>
        {value.length === 0 && <span className="text-xs text-muted-foreground">{empty ?? t('filters.none')}</span>}
        {value.map((code) => (
          <span key={code} className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-card py-0.5 ps-2 pe-0.5 text-xs" data-pick={code}>
            <code className="font-mono">
              <Ltr>{code}</Ltr>
            </code>
            <button
              type="button"
              className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-danger-800"
              aria-label={t('filters.remove', { code: fsi(code) })}
              onClick={() => onChange(value.filter((c) => c !== code))}
              data-pick-remove={code}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
      </span>
      <span className="relative flex max-w-md items-center">
        <Search className="pointer-events-none absolute start-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <input
          id={id}
          type="search"
          dir="auto"
          className={`${INPUT} w-full ps-7`}
          value={find}
          placeholder={t(`filters.search.${kind}`)}
          aria-controls={searching ? listId : undefined}
          onChange={(e) => setFind(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && find) {
              e.stopPropagation()
              setFind('')
            }
          }}
          data-lookup={data}
        />
      </span>
      {searching && (
        <div id={listId} className="max-w-md rounded-md border border-border/60 bg-card" aria-live="polite" data-lookup-hits={data}>
          {hits.isPending ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('filters.searching')}</p>
          ) : hits.isError ? (
            <p className="px-2 py-1.5 text-xs text-danger-800" role="alert">
              {apiErrorMessage(hits.error, t('filters.lookupFailed'))}
            </p>
          ) : found.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground" data-lookup-empty="">
              {t('filters.noHits')}
            </p>
          ) : (
            <ul className="max-h-48 overflow-y-auto py-1">
              {found.map((h) => {
                const picked = value.includes(h.code)
                return (
                  <li key={h.code}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-2 py-1 text-start text-sm hover:bg-accent disabled:text-muted-foreground disabled:hover:bg-transparent"
                      disabled={picked}
                      onClick={() => {
                        onChange([...value, h.code])
                        setFind('')
                      }}
                      data-lookup-hit={h.code}
                    >
                      <span className="flex-1">
                        <Ltr>{formatPair(h.code, h.name)}</Ltr>
                      </span>
                      {picked && <Check className="h-3.5 w-3.5" aria-label={t('filters.picked')} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      {after}
    </Step>
  )
}
