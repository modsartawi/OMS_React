import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Equal, Trash2 } from 'lucide-react'
import type {
  CampaignRule,
  RuleBlockCatalogue,
  RuleBlockKind,
  RuleCampaign,
  RuleCatalogueBlock,
  RuleCondition,
  RuleEffect,
} from '@/core/models/rule-campaign'
import {
  blockSentence,
  catalogueBlock,
  filterChain,
  groupSentence,
  isConditionGroup,
  ruleSummary,
  valueSentence,
  whenSentence,
  type RuleConditionGroup,
  type SaysLine,
  type SentenceContext,
} from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import BlockPanel from './BlockPanel'
import { INPUT } from './builder-ui'
import PaletteMenu from './PaletteMenu'
import { newBlock } from './palette'
import {
  addCondition,
  addEffect,
  deleteBlock,
  deleteRule,
  moveBlock,
  moveRule,
  renameRule,
  setBlockField,
  setPartial,
  setWhenMode,
} from './rule-edit'
import SentenceView from './SentenceView'

/** What the builder page hands each card: the edit door into its history, and the open panel. */
export interface Builder {
  /** One pure edit of the rules; `coalesce` folds a run of keystrokes into one history step. */
  edit: (fn: (rules: CampaignRule[]) => CampaignRule[], coalesce?: string) => void
  /** The block whose panel is open — one at a time. */
  openId: string | null
  setOpenId: (id: string | null) => void
  campaign: RuleCampaign
  catalogue: RuleBlockCatalogue
  newId: () => string
}

/**
 * One rule of the builder (tickets 504, 505): a collapsible card with a one-line summary, its name,
 * and up / down / delete; inside, the rule's named filters as chains, its named values, When (all /
 * any — or "always") and Then. Each block reads as a sentence; clicking it opens its panel, closed
 * with Done. "+ Condition" / "+ Effect" open the palette. Filters and named values stay read-only
 * here: their editors are 506's and 507's.
 */
export default function RuleCard({
  rule,
  index,
  count,
  open,
  onToggle,
  ctx,
  b,
}: {
  rule: CampaignRule
  index: number
  /** How many rules the campaign has — the last one cannot move down. */
  count: number
  open: boolean
  onToggle: () => void
  ctx: SentenceContext
  b: Builder
}) {
  const { t } = useTranslation('campaign-workspace')
  const sum = ruleSummary(rule)
  const bodyId = `rule-body-${rule.id}`
  const nameId = `rule-name-${rule.id}`
  const Chevron = open ? ChevronDown : ChevronRight
  const edit = b.edit

  const pick = (block: RuleCatalogueBlock, groupId: string | null) => {
    const item = newBlock(block, rule, b.newId())
    edit((rules) => (block.kind === 'condition' ? addCondition(rules, rule.id, groupId, item as RuleCondition) : addEffect(rules, rule.id, item as RuleEffect)))
    if (block.type !== 'group') b.setOpenId(item.id)
  }

  return (
    <article className="rounded-lg border border-border/60 bg-card" data-rule-card={rule.id}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={t(open ? 'rules.collapse' : 'rules.expand')}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          data-rule-toggle=""
        >
          <Chevron className={'h-4 w-4' + (open ? '' : ' rtl:rotate-180')} aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <label htmlFor={nameId} className="text-xs text-muted-foreground">
            <Trans t={t} i18nKey="rules.ruleNumber" values={{ n: index + 1 }} components={{ n: <Ltr /> }} />
          </label>
          <input
            id={nameId}
            dir="auto"
            className={`${INPUT} max-w-xl font-semibold`}
            value={rule.name}
            placeholder={t('builder.ruleNamePlaceholder')}
            onChange={(e) => edit((rules) => renameRule(rules, rule.id, e.target.value), `name:${rule.id}`)}
            data-rule-name=""
          />
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
        <Tools
          up={index > 0 ? () => edit((rules) => moveRule(rules, rule.id, -1)) : null}
          down={index < count - 1 ? () => edit((rules) => moveRule(rules, rule.id, 1)) : null}
          remove={() => {
            // A panel open inside the rule goes with it, and does not come back open on an Undo.
            b.setOpenId(null)
            edit((rules) => deleteRule(rules, rule.id))
          }}
          labels={{ up: t('builder.moveRuleUp'), down: t('builder.moveRuleDown'), remove: t('builder.deleteRule') }}
          data="rule"
        />
      </header>
      {open && (
        <div id={bodyId} className="flex flex-col gap-4 border-t border-border/60 p-3" data-rule-body="">
          <Section title={t('rules.filters')} hint={t('rules.filtersHint')} data="filters">
            {rule.filters.length ? (
              <ul className="flex flex-col gap-1.5">
                {rule.filters.map((f) => {
                  const chain = filterChain(f)
                  return (
                    <li key={f.id} className="flex flex-wrap items-center gap-1.5 text-sm" data-filter={f.id}>
                      <span className="font-mono font-semibold" data-filter-name="">
                        <bdi>{chain.name}</bdi>
                      </span>
                      <Equal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      {chain.links.map((link, i) => (
                        <span key={i} className="rounded-full border border-border/60 px-2 py-0.5 text-xs" data-filter-link={link.key}>
                          <SentenceView s={link} />
                        </span>
                      ))}
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
                {rule.values.map((v) => (
                  <li key={v.id} data-value-id={v.id}>
                    <SentenceView s={valueSentence(v)} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={t('rules.conditions')} data="when">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium" data-when={sum.conditions ? rule.when.mode : 'always'}>
                <SentenceView s={whenSentence(rule)} />
              </p>
              {sum.conditions > 0 && (
                <MatchSelect value={rule.when.mode} onChange={(mode) => edit((rules) => setWhenMode(rules, rule.id, mode))} data="when" />
              )}
            </div>
            {rule.when.items.length ? <Conditions items={rule.when.items} rule={rule} ctx={ctx} b={b} pick={pick} /> : <Muted>{t('rules.alwaysHint')}</Muted>}
            <PaletteMenu
              kind="condition"
              label={t('builder.addCondition')}
              catalogue={b.catalogue}
              features={b.campaign.features}
              onPick={(block) => pick(block, null)}
              data="when"
            />
          </Section>

          <Section title={t('rules.effects')} data="then">
            {rule.then.length ? (
              <>
                <p className="text-sm font-medium">{t('rules.effectsHead')}</p>
                <ul className="flex flex-col gap-1.5">
                  {rule.then.map((e, i) => (
                    <Block key={e.id} kind="effect" item={e} index={i} count={rule.then.length} rule={rule} ctx={ctx} b={b} />
                  ))}
                </ul>
                {rule.then.some((e) => e.type === 'burnPoints') && (
                  <label className="flex flex-wrap items-center gap-2 text-sm" data-partial="">
                    <span className="text-muted-foreground">{t('builder.partial')}</span>
                    <select
                      className={INPUT}
                      value={rule.partial}
                      onChange={(e) => edit((rules) => setPartial(rules, rule.id, e.target.value === 'scale' ? 'scale' : 'refuse'))}
                      data-partial-select=""
                    >
                      <option value="refuse">{t('builder.partialOption.refuse')}</option>
                      <option value="scale">{t('builder.partialOption.scale')}</option>
                    </select>
                  </label>
                )}
              </>
            ) : (
              <Muted>{t('rules.noEffects')}</Muted>
            )}
            <PaletteMenu kind="effect" label={t('builder.addEffect')} catalogue={b.catalogue} features={b.campaign.features} onPick={(block) => pick(block, null)} data="then" />
          </Section>
        </div>
      )}
    </article>
  )
}

/** A rule's (or a group's) conditions; a group opens with its own all / any and its own palette. */
function Conditions({
  items,
  rule,
  ctx,
  b,
  pick,
}: {
  items: RuleCondition[]
  rule: CampaignRule
  ctx: SentenceContext
  b: Builder
  pick: (block: RuleCatalogueBlock, groupId: string | null) => void
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((c, i) =>
        isConditionGroup(c) ? (
          <Group key={c.id} group={c} index={i} count={items.length} rule={rule} ctx={ctx} b={b} pick={pick} />
        ) : (
          <Block key={c.id} kind="condition" item={c} index={i} count={items.length} rule={rule} ctx={ctx} b={b} />
        ),
      )}
    </ul>
  )
}

function Group({
  group,
  index,
  count,
  rule,
  ctx,
  b,
  pick,
}: {
  group: RuleConditionGroup
  index: number
  count: number
  rule: CampaignRule
  ctx: SentenceContext
  b: Builder
  pick: (block: RuleCatalogueBlock, groupId: string | null) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const mode = group.mode === 'any' ? 'any' : 'all'
  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-dashed border-border p-2" data-condition-group={group.id}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm font-medium">
          <SentenceView s={groupSentence(group.mode)} />
        </p>
        <MatchSelect value={mode} onChange={(m) => b.edit((rules) => setBlockField(rules, rule.id, group.id, 'mode', m))} data={group.id} />
        <BlockTools rule={rule} id={group.id} index={index} count={count} b={b} />
      </div>
      {group.items.length ? <Conditions items={group.items} rule={rule} ctx={ctx} b={b} pick={pick} /> : <Muted>{t('builder.emptyGroup')}</Muted>}
      <PaletteMenu
        kind="condition"
        label={t('builder.addToGroup')}
        catalogue={b.catalogue}
        features={b.campaign.features}
        onPick={(block) => pick(block, group.id)}
        data={group.id}
      />
    </li>
  )
}

/**
 * One condition or effect: its sentence and clauses — a button that opens its panel — then its
 * EN + AR lines. A block the catalogue does not know reads as such and can only be deleted.
 */
function Block({
  kind,
  item,
  index,
  count,
  rule,
  ctx,
  b,
}: {
  kind: RuleBlockKind
  item: RuleCondition | RuleEffect
  index: number
  count: number
  rule: CampaignRule
  ctx: SentenceContext
  b: Builder
}) {
  const { t } = useTranslation('campaign-workspace')
  const read = blockSentence(kind, item, ctx)
  const entry = catalogueBlock(ctx.catalogue, kind, item.type)
  const open = !!entry && b.openId === item.id
  const panelId = `panel-${item.id}`
  const sentence = (
    <span className="block text-sm leading-relaxed" data-block-sentence="">
      <SentenceView s={read.sentence} />
      {read.clauses.map((c) => (
        <SentenceView key={c.key} s={c} />
      ))}
    </span>
  )
  return (
    <li
      className={'rounded-md border px-3 py-2 ' + (!read.known ? 'border-attention-border bg-attention-050' : open ? 'border-primary/40' : 'border-border/60')}
      {...{ [`data-${kind}`]: item.id }}
      data-sentence={read.sentence.key}
      data-open={open ? '' : undefined}
    >
      <div className="flex items-start gap-2">
        {entry ? (
          <button
            type="button"
            className="min-w-0 flex-1 rounded-sm text-start hover:text-primary-800"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => b.setOpenId(open ? null : item.id)}
            data-block-edit=""
          >
            {sentence}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{sentence}</div>
        )}
        <BlockTools rule={rule} id={item.id} index={index} count={count} b={b} />
      </div>
      {!open && read.says.map((line) => <Says key={line.field} line={line} />)}
      {open && entry && (
        <div id={panelId}>
          <BlockPanel
            block={item}
            entry={entry}
            rule={rule}
            campaign={b.campaign}
            set={(key, value, coalesce) => b.edit((rules) => setBlockField(rules, rule.id, item.id, key, value), coalesce ? `field:${item.id}.${key}` : undefined)}
            onDone={() => b.setOpenId(null)}
            onDelete={() => {
              b.setOpenId(null)
              b.edit((rules) => deleteBlock(rules, rule.id, item.id))
            }}
          />
        </div>
      )}
      {!entry && <p className="mt-1 text-xs text-muted-foreground">{t('panel.unknownBlock')}</p>}
    </li>
  )
}

/** Up / down within the block's own list, and delete. */
function BlockTools({ rule, id, index, count, b }: { rule: CampaignRule; id: string; index: number; count: number; b: Builder }) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <Tools
      up={index > 0 ? () => b.edit((rules) => moveBlock(rules, rule.id, id, -1)) : null}
      down={index < count - 1 ? () => b.edit((rules) => moveBlock(rules, rule.id, id, 1)) : null}
      remove={() => {
        // Its panel, or one inside the group, goes with it.
        b.setOpenId(null)
        b.edit((rules) => deleteBlock(rules, rule.id, id))
      }}
      labels={{ up: t('builder.moveUp'), down: t('builder.moveDown'), remove: t('builder.delete') }}
      data="block"
    />
  )
}

function Tools({
  up,
  down,
  remove,
  labels,
  data,
}: {
  up: (() => void) | null
  down: (() => void) | null
  remove: () => void
  labels: { up: string; down: string; remove: string }
  data: string
}) {
  const btn = 'rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <button type="button" className={btn} aria-label={labels.up} disabled={!up} onClick={() => up?.()} data-move-up={data}>
        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button type="button" className={btn} aria-label={labels.down} disabled={!down} onClick={() => down?.()} data-move-down={data}>
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button type="button" className={`${btn} hover:text-danger-800`} aria-label={labels.remove} onClick={remove} data-delete={data}>
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </button>
    </span>
  )
}

function MatchSelect({ value, onChange, data }: { value: 'all' | 'any'; onChange: (mode: 'all' | 'any') => void; data: string }) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <select
      className={`${INPUT} h-7 text-xs`}
      aria-label={t('builder.match')}
      value={value}
      onChange={(e) => onChange(e.target.value === 'any' ? 'any' : 'all')}
      data-match={data}
    >
      <option value="all">{t('builder.matchAll')}</option>
      <option value="any">{t('builder.matchAny')}</option>
    </select>
  )
}

/** A marketer's EN + AR text, both shown: the English, then the Arabic right-to-left. */
function Says({ line }: { line: SaysLine }) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <dl className="mt-1 grid gap-x-2 text-xs sm:grid-cols-[11rem_1fr]" data-says={line.role}>
      <dt className="text-muted-foreground">{t(`rules.says.${line.role}`)}</dt>
      <dd className="flex min-w-0 flex-wrap gap-x-4 gap-y-0.5">
        <bdi lang="en" data-says-en="">
          {line.says.en}
        </bdi>
        {line.says.ar ? (
          <bdi dir="rtl" lang="ar" data-says-ar="">
            {line.says.ar}
          </bdi>
        ) : (
          <span className="text-muted-foreground" data-says-ar="">
            {t('rules.says.noArabic')}
          </span>
        )}
      </dd>
    </dl>
  )
}

function Section({ title, hint, data, children }: { title: string; hint?: string; data: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5" data-rule-section={data}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5">{children}</span>
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
