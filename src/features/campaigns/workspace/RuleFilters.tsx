import { Trans, useTranslation } from 'react-i18next'
import { Check, Equal, Plus, Trash2, TriangleAlert } from 'lucide-react'
import type { CampaignRule } from '@/core/models/rule-campaign'
import {
  addFilter,
  copyFilterInto,
  deleteFilter,
  filterLetsRxIn,
  filterNameProblem,
  filterUses,
  newFilter,
  nextFilterName,
  updateFilter,
} from '@/core/rules/filters'
import { filterChain } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { INPUT } from './builder-ui'
import FilterEditor from './FilterEditor'
import type { Builder } from './RuleCard'
import SentenceView from './SentenceView'

/**
 * A rule's named cart-item filters (tickets 504, 506): each a chain — its name, what it looks at,
 * its picks, "not …" — that opens its editor in place, one panel open at a time. Every change is a
 * step of the builder's history. Conditions and effects point at a filter by id, so a rename reads
 * through every one of them. A filter that lets Prescription in is flagged red; a filter in use
 * cannot be deleted. "Add filter" makes one with Prescription kept out; "Copy filter from rule N"
 * copies another rule's.
 */
export default function RuleFilters({ rule, rules, b }: { rule: CampaignRule; rules: CampaignRule[]; b: Builder }) {
  const { t } = useTranslation('campaign-workspace')
  const others = rules.map((r, i) => ({ r, n: i + 1 })).filter((x) => x.r.id !== rule.id && x.r.filters.length > 0)

  const add = () => {
    const f = newFilter(b.newId(), nextFilterName(rule.filters, t('filters.defaultName')))
    b.edit((rs) => addFilter(rs, rule.id, f))
    b.setOpenId(f.id)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {rule.filters.length ? (
        <ul className="flex flex-col gap-1.5">
          {rule.filters.map((f) => {
            const chain = filterChain(f)
            const open = b.openId === f.id
            const uses = filterUses(rule, f.id, b.catalogue)
            const problem = filterNameProblem(rule.filters, f.name, f.id)
            const rx = filterLetsRxIn(f)
            const editorId = `filter-editor-${f.id}`
            const remove = (
              <Button
                variant="danger-outlined"
                disabled={uses > 0}
                title={uses > 0 ? t('filters.inUse', { count: uses, n: fsi(uses) }) : undefined}
                onClick={() => {
                  b.setOpenId(null)
                  b.edit((rs) => deleteFilter(rs, rule.id, f.id, b.catalogue))
                }}
                data-filter-delete=""
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                {t('filters.delete')}
              </Button>
            )
            return (
              <li key={f.id} className="flex flex-col gap-1.5" data-filter={f.id} data-filter-rx={rx ? '' : undefined}>
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <button
                    type="button"
                    className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-sm text-start hover:text-primary-800"
                    aria-expanded={open}
                    aria-controls={open ? editorId : undefined}
                    aria-label={t('filters.edit', { name: fsi(f.name) })}
                    // A filter with no name, or another's, stays open until it has one of its own.
                    onClick={() => (open ? problem === null && b.setOpenId(null) : b.setOpenId(f.id))}
                    data-filter-edit=""
                  >
                    <span className="font-mono font-semibold" data-filter-name="">
                      <bdi>{chain.name}</bdi>
                    </span>
                    <Equal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    {chain.links.map((link, i) => (
                      <span key={i} className="rounded-full border border-border/60 px-2 py-0.5 text-xs" data-filter-link={link.key}>
                        <SentenceView s={link} />
                      </span>
                    ))}
                  </button>
                  {rx && <RxFlag label={t('filters.rxFlag')} />}
                  {/* The editor holds a bad name while it is open; once it closes another way, the chain says so. */}
                  {problem && !open && (
                    <span className="text-xs font-medium text-danger-800" data-filter-chain-problem={problem}>
                      {t(`filters.nameProblem.${problem}`)}
                    </span>
                  )}
                </div>
                {open && (
                  <div id={editorId}>
                    <FilterEditor
                      filter={f}
                      onChange={(patch, coalesce) => b.edit((rs) => updateFilter(rs, rule.id, f.id, patch), coalesce ? `filter:${f.id}` : undefined)}
                      nameProblem={problem}
                      data={f.id}
                      footer={
                        <>
                          {uses > 0 && (
                            <span className="text-xs text-muted-foreground" data-filter-uses={uses}>
                              <Trans t={t} i18nKey="filters.usedBy" count={uses} components={{ n: <Ltr /> }} />
                            </span>
                          )}
                          {remove}
                          <Button variant="primary" disabled={problem !== null} onClick={() => b.setOpenId(null)} data-filter-done="">
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            {t('filters.done')}
                          </Button>
                        </>
                      }
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('rules.noFilters')}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outlined" onClick={add} data-filter-add="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('filters.add')}
        </Button>
        {others.length > 0 && (
          <select
            className={INPUT}
            value=""
            aria-label={t('filters.copyFrom')}
            onChange={(e) => {
              const [ri, fi] = e.target.value.split('/').map(Number)
              const source = rules[ri]?.filters[fi]
              if (source) b.edit((rs) => copyFilterInto(rs, rule.id, source, b.newId()))
            }}
            data-filter-copy=""
          >
            <option value="">{t('filters.copyFrom')}</option>
            {others.map(({ r, n }) => (
              <optgroup key={r.id} label={t('filters.copyGroup', { n: fsi(n) })}>
                {r.filters.map((f, fi) => (
                  <option key={f.id} value={`${n - 1}/${fi}`}>
                    {fsi(f.name)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

/** The red flag on a filter or a discount that reaches Prescription lines. */
export function RxFlag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-danger-border bg-danger-050 px-2 py-0.5 text-xs font-semibold text-danger-800" data-rx-flag="">
      <TriangleAlert className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}
