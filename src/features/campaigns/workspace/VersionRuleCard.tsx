import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Equal } from 'lucide-react'
import type { CampaignRule, RuleBlockKind, RuleCondition, RuleEffect, RuleItemFilter } from '@/core/models/rule-campaign'
import { RULE_BURN_POINTS } from '@/core/models/rule-campaign'
import { effectLetsRxIn, filterLetsRxIn } from '@/core/rules/filters'
import {
  blockSentence,
  blockType,
  bundleSentence,
  catalogueBlock,
  filterChain,
  groupSentence,
  isConditionGroup,
  leafConditions,
  ruleSummary,
  sentenceId,
  valueSentence,
  whenSentence,
  type SentenceContext,
} from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { Pill, Says, Section } from './RuleCard'
import { RxFlag } from './RuleFilters'
import SentenceView from './SentenceView'
import IconButton from '@/core/ui/IconButton'

/**
 * One rule of a published version, read-only (ticket 512) — 504's reading of a rule: a collapsible
 * card with its one-line summary, and inside it the named filters as chains, the named values, When
 * (all / any — or "always") and Then, each block a sentence with its EN + AR lines under it. Nothing
 * here edits: a version never changes, and Restore is how one is worked on again.
 */
export default function VersionRuleCard({
  rule,
  index,
  open,
  onToggle,
  ctx,
  idPrefix,
}: {
  rule: CampaignRule
  index: number
  open: boolean
  onToggle: () => void
  ctx: SentenceContext
  /** Keeps the body's id unique when two versions are open with the same rule. */
  idPrefix: string
}) {
  const { t } = useTranslation('campaign-workspace')
  const sum = ruleSummary(rule)
  const bodyId = `${idPrefix}-rule-${rule.id}`
  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <article className="rounded-lg border border-border/60 bg-card" data-version-rule={rule.id}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
        <IconButton label={t(open ? 'rules.collapse' : 'rules.expand')} onClick={onToggle} aria-expanded={open} aria-controls={bodyId} data-rule-toggle="">
          <Chevron className={'h-4 w-4' + (open ? '' : ' rtl:rotate-180')} aria-hidden />
        </IconButton>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">
            <Trans t={t} i18nKey="rules.ruleNumber" values={{ n: index + 1 }} components={{ n: <Ltr /> }} />
          </span>
          <h3 className="text-sm font-semibold" data-rule-name="">
            {rule.name ? <bdi>{rule.name}</bdi> : <span className="text-muted-foreground">{t('versions.untitledRule')}</span>}
          </h3>
        </div>
        <p className="flex flex-wrap gap-1.5 text-xs text-muted-foreground" data-rule-summary="">
          <Pill>
            <Trans t={t} i18nKey="rules.summary.filters" count={sum.filters} components={{ n: <Ltr /> }} />
          </Pill>
          <Pill>
            {sum.conditions ? (
              <Trans t={t} i18nKey="rules.summary.conditions" count={sum.conditions} components={{ n: <Ltr /> }} />
            ) : (
              t('rules.summary.always')
            )}
          </Pill>
          <Pill>
            <Trans t={t} i18nKey="rules.summary.effects" count={sum.effects} components={{ n: <Ltr /> }} />
          </Pill>
        </p>
      </header>
      {open && (
        <div id={bodyId} className="flex flex-col gap-4 border-t border-border/60 p-3" data-rule-body="">
          <Section title={t('rules.filters')} hint={t('rules.filtersHint')} data="filters">
            {rule.filters.length ? (
              <ul className="flex flex-col gap-1.5">
                {rule.filters.map((f) => {
                  const chain = filterChain(f)
                  return (
                    <li key={f.id} className="flex flex-wrap items-center gap-1.5 text-sm" data-filter={f.id} data-filter-rx={filterLetsRxIn(f) ? '' : undefined}>
                      <span className="font-mono font-semibold" data-filter-name="">
                        <bdi>{chain.name}</bdi>
                      </span>
                      <Equal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      {chain.links.map((link, i) => (
                        <span key={i} className="rounded-full border border-border/60 px-2 py-0.5 text-xs" data-filter-link={link.key}>
                          <SentenceView s={link} />
                        </span>
                      ))}
                      {filterLetsRxIn(f) && <RxFlag label={t('filters.rxFlag')} />}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <Muted>{t('rules.noFilters')}</Muted>
            )}
          </Section>

          {rule.values.length > 0 && (
            <Section title={t('rules.values')} hint={t('rules.valuesHint')} data="values">
              <ul className="flex flex-col gap-1 text-sm">
                {rule.values.map((v, i) => (
                  <li key={i} data-value-index={i}>
                    <SentenceView s={valueSentence(v, rule)} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={t('rules.conditions')} data="when">
            <p className="text-sm font-medium" data-when={sum.conditions ? 'all' : 'always'}>
              <SentenceView s={whenSentence(rule)} />
            </p>
            {sum.conditions ? <Conditions items={rule.when} path="when" ctx={ctx} filters={rule.filters} /> : <Muted>{t('rules.alwaysHint')}</Muted>}
          </Section>

          <Section title={t('rules.effects')} data="then">
            {rule.then.length ? (
              <>
                <p className="text-sm font-medium">{t('rules.effectsHead')}</p>
                <ul className="flex flex-col gap-1.5">
                  {rule.then.map((e, i) => (
                    <Block key={i} kind="effect" item={e} path={`then.${i}`} ctx={ctx} filters={rule.filters} />
                  ))}
                </ul>
                {rule.bundle && (
                  <p className="text-sm" data-bundle-sentence="">
                    <SentenceView s={bundleSentence(rule.bundle, rule).sentence} />
                    {bundleSentence(rule.bundle, rule).clauses.map((c) => (
                      <SentenceView key={c.key} s={c} />
                    ))}
                  </p>
                )}
                {rule.then.some((e) => e.effect === RULE_BURN_POINTS) && (
                  <p className="text-sm text-muted-foreground" data-partial="">
                    {t('versions.partial', { then: t(rule.partial === 'scale' ? 'builder.partialOption.scale' : 'builder.partialOption.refuse') })}
                  </p>
                )}
              </>
            ) : (
              <Muted>{t('rules.noEffects')}</Muted>
            )}
          </Section>
        </div>
      )}
    </article>
  )
}

/** A rule's conditions; a nested group opens with its own all / any line. */
function Conditions({ items, path, ctx, filters }: { items: RuleCondition[]; path: string; ctx: SentenceContext; filters: readonly RuleItemFilter[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((c, i) =>
        isConditionGroup(c) ? (
          // A group with nothing in it says nothing; the rule's summary does not count it either.
          !leafConditions(c.conditions).length ? null : (
            <li key={i} className="flex flex-col gap-1.5 rounded-md border border-dashed border-border p-2" data-condition-group={`${path}.${i}`}>
              <p className="text-sm font-medium">
                <SentenceView s={groupSentence(c.mode)} />
              </p>
              <Conditions items={c.conditions} path={`${path}.${i}.conditions`} ctx={ctx} filters={filters} />
            </li>
          )
        ) : (
          <Block key={i} kind="condition" item={c} path={`${path}.${i}`} ctx={ctx} filters={filters} />
        ),
      )}
    </ul>
  )
}

/**
 * One condition or effect: its sentence and clauses, then its EN + AR lines. A discount that reaches
 * Prescription lines carries the builder's red flag here too (512 review): a version is read to decide
 * whether to restore it.
 */
function Block({
  kind,
  item,
  path,
  ctx,
  filters,
}: {
  kind: RuleBlockKind
  item: RuleCondition | RuleEffect
  path: string
  ctx: SentenceContext
  filters: readonly RuleItemFilter[]
}) {
  const { t } = useTranslation('campaign-workspace')
  const read = blockSentence(kind, item, ctx)
  const rx = kind === 'effect' && effectLetsRxIn(item as RuleEffect, catalogueBlock(ctx.catalogue, kind, blockType(item)), filters)
  return (
    <li
      className={'rounded-md border px-3 py-2 ' + (!read.known ? 'border-attention-border bg-attention-050' : rx ? 'border-danger-border' : 'border-border/60')}
      {...{ [`data-${kind}`]: path }}
      data-block-path={path}
      data-sentence={sentenceId(read.sentence, blockType(item))}
      data-block-rx={rx ? '' : undefined}
    >
      <p className="text-sm leading-relaxed" data-block-sentence="">
        <SentenceView s={read.sentence} />
        {read.clauses.map((c) => (
          <SentenceView key={c.key} s={c} />
        ))}
      </p>
      {rx && (
        <p className="mt-1">
          <RxFlag label={t('filters.rxEffect')} />
        </p>
      )}
      {read.says.map((line) => (
        <Says key={line.field} line={line} />
      ))}
    </li>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
