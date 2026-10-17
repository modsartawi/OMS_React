import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import type {
  CampaignRule,
  RuleBlockCatalogue,
  RuleBlockKind,
  RuleBundle,
  RuleCampaign,
  RuleCatalogueBlock,
  RuleCondition,
  RuleEffect,
  RuleFeature,
} from '@/core/models/rule-campaign'
import { RULE_BURN_POINTS, RULE_GROUP_CHECK, type RuleConditionGroup } from '@/core/models/rule-campaign'
import { addFilter, effectLetsRxIn } from '@/core/rules/filters'
import {
  blockSentence,
  blockType,
  bundleSentence,
  catalogueBlock,
  groupSentence,
  isConditionGroup,
  ruleSummary,
  whenSentence,
  type SaysLine,
  type SentenceContext,
} from '@/core/rules/sentence'
import { fsi } from '@/core/util/bidi'
import Ltr from '@/core/ui/Ltr'
import BlockPanel from './BlockPanel'
import CheckNotes, { checkTone, SEVERITY_LOOK } from './CheckNotes'
import { NO_BLOCK_CHECKS, type ChecksIndex } from './checks'
import { INPUT } from './builder-ui'
import PaletteMenu from './PaletteMenu'
import { BLOCK_KEY, keyOf } from './block-keys'
import { BUNDLE_EFFECTS, newBlock, newBundleList } from './palette'
import RuleFilters, { RxFlag } from './RuleFilters'
import RuleValues from './RuleValues'
import {
  addCondition,
  addEffect,
  deleteBlock,
  deleteRule,
  moveBlock,
  moveRule,
  renameRule,
  setBlockField,
  setBundle,
  setPartial,
} from './rule-edit'
import SentenceView from './SentenceView'

/** What the builder page hands each card: the edit door into its history, and the open panel. */
export interface Builder {
  /** One pure edit of the rules; `coalesce` folds a run of keystrokes into one history step. */
  edit: (fn: (rules: CampaignRule[]) => CampaignRule[], coalesce?: string) => void
  /** The block whose panel is open (its builder key, or a filter's id) — one at a time. */
  openId: string | null
  setOpenId: (id: string | null) => void
  campaign: RuleCampaign
  /** The draft's features: they gate the palette. */
  features: RuleFeature[]
  catalogue: RuleBlockCatalogue
  /** A new rule's or filter's id (blocks and values get builder keys instead). */
  newId: () => string
  /** A new block's or value's builder key (`./block-keys`). */
  newKey: () => string
  /** HQ's checks of the saved draft, found on the rules on screen and indexed (ticket 508). */
  checks: ChecksIndex
}

/**
 * One rule of the builder (tickets 504, 505): a collapsible card with a one-line summary, its name,
 * and up / down / delete; inside, the rule's named filters as chains, its named values, When (all /
 * any — or "always") and Then. Each block reads as a sentence; clicking it opens its panel, closed
 * with Done. "+ Condition" / "+ Effect" open the palette. Filters are edited as chains
 * (`./RuleFilters`, ticket 506); a discount that reaches Prescription lines is flagged red. Named
 * values and the formula condition are written with the guided ƒx helper (`./RuleValues`,
 * `./FormulaBox`, ticket 507).
 */
export default function RuleCard({
  rule,
  rules,
  index,
  open,
  onToggle,
  ctx,
  b,
}: {
  rule: CampaignRule
  /** Every rule of the campaign, as on screen — "Copy filter from rule N" reads them. */
  rules: CampaignRule[]
  index: number
  open: boolean
  onToggle: () => void
  ctx: SentenceContext
  b: Builder
}) {
  const { t } = useTranslation('campaign-workspace')
  const count = rules.length
  const sum = ruleSummary(rule)
  const bodyId = `rule-body-${rule.id}`
  const nameId = `rule-name-${rule.id}`
  const Chevron = open ? ChevronDown : ChevronRight
  const edit = b.edit

  const pick = (block: RuleCatalogueBlock, groupKey: string | null) => {
    const key = b.newKey()
    const item = { ...newBlock(block, rule), [BLOCK_KEY]: key } as unknown as RuleCondition | RuleEffect
    edit((rules) => {
      if (block.kind === 'condition') return addCondition(rules, rule.id, groupKey, item as RuleCondition)
      const next = addEffect(rules, rule.id, item as RuleEffect)
      // A bundle effect prices the rule's bundle: a rule with none gets one list to start from.
      return BUNDLE_EFFECTS.includes(block.type) && !rule.bundle ? setBundle(next, rule.id, { lists: [newBundleList(rule)] }) : next
    })
    if (block.type !== RULE_GROUP_CHECK) b.setOpenId(key)
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
        <CheckNotes messages={b.checks.rules.get(rule.id) ?? []} data="rule" />
      </header>
      {open && (
        <div id={bodyId} className="flex flex-col gap-4 border-t border-border/60 p-3" data-rule-body="">
          <Section title={t('rules.filters')} hint={t('rules.filtersHint')} data="filters">
            <RuleFilters rule={rule} rules={rules} b={b} />
          </Section>

          <Section title={t('rules.values')} hint={t('rules.valuesHint')} data="values">
            <RuleValues rule={rule} b={b} />
          </Section>

          <Section title={t('rules.conditions')} data="when">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium" data-when={sum.conditions ? 'all' : 'always'}>
                <SentenceView s={whenSentence(rule)} />
              </p>
            </div>
            {rule.when.length ? <Conditions items={rule.when} path="when" rule={rule} ctx={ctx} b={b} pick={pick} /> : <Muted>{t('rules.alwaysHint')}</Muted>}
            <PaletteMenu
              kind="condition"
              label={t('builder.addCondition')}
              catalogue={b.catalogue}
              features={b.features}
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
                    <Block key={keyOf(e)} kind="effect" item={e} path={`then.${i}`} index={i} count={rule.then.length} rule={rule} ctx={ctx} b={b} />
                  ))}
                </ul>
                {rule.then.some((e) => e.effect === RULE_BURN_POINTS) && (
                  <label className="flex flex-wrap items-center gap-2 text-sm" data-partial="">
                    <span className="text-muted-foreground">{t('builder.partial')}</span>
                    <select
                      className={INPUT}
                      value={rule.partial ?? 'refuse'}
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
            <PaletteMenu kind="effect" label={t('builder.addEffect')} catalogue={b.catalogue} features={b.features} onPick={(block) => pick(block, null)} data="then" />
          </Section>

          {(rule.bundle || rule.then.some((e) => BUNDLE_EFFECTS.includes(e.effect))) && (
            <Section title={t('rules.bundle')} hint={t('rules.bundleHint')} data="bundle">
              <BundleEditor rule={rule} b={b} />
            </Section>
          )}
        </div>
      )}
    </article>
  )
}

/** A rule's (or a group's) conditions; a group opens with its own all / any and its own palette. */
function Conditions({
  items,
  path,
  rule,
  ctx,
  b,
  pick,
}: {
  items: RuleCondition[]
  /** The list's place in the rule: `when`, or a group's `when.1.conditions`. */
  path: string
  rule: CampaignRule
  ctx: SentenceContext
  b: Builder
  pick: (block: RuleCatalogueBlock, groupKey: string | null) => void
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((c, i) =>
        isConditionGroup(c) ? (
          <Group key={keyOf(c)} group={c} path={`${path}.${i}`} index={i} count={items.length} rule={rule} ctx={ctx} b={b} pick={pick} />
        ) : (
          <Block key={keyOf(c)} kind="condition" item={c} path={`${path}.${i}`} index={i} count={items.length} rule={rule} ctx={ctx} b={b} />
        ),
      )}
    </ul>
  )
}

function Group({
  group,
  path,
  index,
  count,
  rule,
  ctx,
  b,
  pick,
}: {
  group: RuleConditionGroup
  path: string
  index: number
  count: number
  rule: CampaignRule
  ctx: SentenceContext
  b: Builder
  pick: (block: RuleCatalogueBlock, groupKey: string | null) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const mode = group.mode === 'any' ? 'any' : 'all'
  const key = keyOf(group)
  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-dashed border-border p-2" data-condition-group={key} data-block-path={path}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm font-medium">
          <SentenceView s={groupSentence(group.mode)} />
        </p>
        <MatchSelect value={mode} onChange={(m) => b.edit((rules) => setBlockField(rules, rule.id, key, 'mode', m))} data={key} />
        <BlockTools rule={rule} id={key} index={index} count={count} b={b} />
      </div>
      <CheckNotes messages={(b.checks.blocks.get(key) ?? NO_BLOCK_CHECKS).all} data="group" />
      {group.conditions.length ? (
        <Conditions items={group.conditions} path={`${path}.conditions`} rule={rule} ctx={ctx} b={b} pick={pick} />
      ) : (
        <Muted>{t('builder.emptyGroup')}</Muted>
      )}
      <PaletteMenu kind="condition" label={t('builder.addToGroup')} catalogue={b.catalogue} features={b.features} onPick={(block) => pick(block, key)} data={key} />
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
  path,
  index,
  count,
  rule,
  ctx,
  b,
}: {
  kind: RuleBlockKind
  item: RuleCondition | RuleEffect
  /** Its place in the rule: `when.0`, `when.1.conditions.0`, `then.1`. */
  path: string
  index: number
  count: number
  rule: CampaignRule
  ctx: SentenceContext
  b: Builder
}) {
  const { t } = useTranslation('campaign-workspace')
  const key = keyOf(item)
  const read = blockSentence(kind, item, ctx)
  const entry = catalogueBlock(ctx.catalogue, kind, blockType(item))
  const open = !!entry && b.openId === key
  const panelId = `panel-${key}`
  const rx = kind === 'effect' && effectLetsRxIn(item as RuleEffect, entry, rule.filters)
  const notes = b.checks.blocks.get(key) ?? NO_BLOCK_CHECKS
  const tone = checkTone(notes.all)
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
      className={
        'rounded-md border px-3 py-2 ' +
        (!read.known
          ? 'border-attention-border bg-attention-050'
          : rx
            ? 'border-danger-border'
            : tone
              ? SEVERITY_LOOK[tone].border
              : open
                ? 'border-primary/40'
                : 'border-border/60')
      }
      {...{ [`data-${kind}`]: key }}
      data-block-path={path}
      data-sentence={read.sentence.key}
      data-open={open ? '' : undefined}
      data-block-rx={rx ? '' : undefined}
      data-block-checks={tone ?? undefined}
    >
      <div className="flex items-start gap-2">
        {entry ? (
          <button
            type="button"
            className="min-w-0 flex-1 rounded-sm text-start hover:text-primary-800"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => b.setOpenId(open ? null : key)}
            data-block-edit=""
          >
            {sentence}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{sentence}</div>
        )}
        <BlockTools rule={rule} id={key} index={index} count={count} b={b} />
      </div>
      {rx && (
        <p className="mt-1">
          <RxFlag label={t('filters.rxEffect')} />
        </p>
      )}
      {!open && read.says.map((line) => <Says key={line.field} line={line} />)}
      {/* Closed, the block lists its messages; open, its panel shows each at its field. */}
      {!(open && entry) && (
        <div className="mt-1">
          <CheckNotes messages={notes.all} data="block" />
        </div>
      )}
      {open && entry && (
        <div id={panelId}>
          <BlockPanel
            block={item}
            bkey={key}
            entry={entry}
            rule={rule}
            campaign={b.campaign}
            guide={b.catalogue.formula}
            set={(field, value, coalesce) => b.edit((rules) => setBlockField(rules, rule.id, key, field, value), coalesce ? `field:${key}.${field}` : undefined)}
            withFilter={(filter, field, value) => b.edit((rules) => setBlockField(addFilter(rules, rule.id, filter), rule.id, key, field, value))}
            newId={b.newId}
            checks={notes}
            onDone={() => b.setOpenId(null)}
            onDelete={() => {
              b.setOpenId(null)
              b.edit((rules) => deleteBlock(rules, rule.id, key))
            }}
          />
        </div>
      )}
      {!entry && <p className="mt-1 text-xs text-muted-foreground">{t('panel.unknownBlock')}</p>}
    </li>
  )
}

/** A rule's bundle (`rule.bundle`): its lists — N units of one of the rule's filters each — and at
 *  most how many per sale. A bundle effect prices it. */
function BundleEditor({ rule, b }: { rule: CampaignRule; b: Builder }) {
  const { t } = useTranslation('campaign-workspace')
  const bundle: RuleBundle = rule.bundle ?? { lists: [] }
  const put = (next: RuleBundle | null) => b.edit((rules) => setBundle(rules, rule.id, next), 'bundle:' + rule.id)
  const read = bundleSentence(bundle, rule)
  const lists = bundle.lists
  return (
    <div className="flex flex-col gap-2" data-bundle="">
      <p className="text-sm" data-bundle-sentence="">
        <SentenceView s={read.sentence} />
        {read.clauses.map((c) => (
          <SentenceView key={c.key} s={c} />
        ))}
      </p>
      <ul className="flex flex-col gap-1.5">
        {lists.map((l, i) => (
          <li key={`${i}/${lists.length}`} className="flex flex-wrap items-center gap-2" data-bundle-list={i}>
            <input
              type="number"
              dir="ltr"
              min={1}
              step={1}
              className={`${INPUT} w-20`}
              aria-label={t('rules.bundleCount')}
              value={Number.isFinite(l.count) ? l.count : ''}
              onChange={(e) => put({ ...bundle, lists: lists.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)) })}
              data-bundle-count=""
            />
            <select
              className={INPUT}
              aria-label={t('rules.bundleFilter')}
              value={l.filter}
              onChange={(e) => put({ ...bundle, lists: lists.map((x, j) => (j === i ? { ...x, filter: e.target.value } : x)) })}
              data-bundle-filter=""
            >
              {!rule.filters.some((f) => f.id === l.filter) && <option value={l.filter}>{t('panel.missing')}</option>}
              {rule.filters.map((f) => (
                <option key={f.id} value={f.id}>
                  {fsi(f.name)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-danger-800"
              aria-label={t('rules.bundleRemove')}
              onClick={() => put(lists.length > 1 ? { ...bundle, lists: lists.filter((_, j) => j !== i) } : null)}
              data-bundle-remove=""
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary-800 hover:underline" onClick={() => put({ ...bundle, lists: [...lists, newBundleList(rule)] })} data-bundle-add="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('rules.bundleAdd')}
        </button>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t('rules.bundleMax')}
          <input
            type="number"
            dir="ltr"
            min={1}
            step={1}
            className={`${INPUT} w-20`}
            value={bundle.max ?? ''}
            onChange={(e) => {
              const { max: _old, ...rest } = bundle
              put(e.target.value === '' ? rest : { ...rest, max: Number(e.target.value) })
            }}
            data-bundle-max=""
          />
        </label>
      </div>
    </div>
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
export function Says({ line }: { line: SaysLine }) {
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

export function Section({ title, hint, data, children }: { title: string; hint?: string; data: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5" data-rule-section={data}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-muted px-2 py-0.5">{children}</span>
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
