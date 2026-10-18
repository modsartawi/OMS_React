import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import type { CampaignRule } from '@/core/models/rule-campaign'
import type { RuleFormulaExpect, RuleFormulaGuide, RuleFormulaType } from '@/core/rules/formula-guide'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi, stripIsolates } from '@/core/util/bidi'
import { INPUT, useHas } from './builder-ui'
import { fxFields, operatorChip, recipeFormula, recipeNeedsCurrent, recipeNeedsFilter, TEXT_CHIP, type Chip, type FxField } from './fx'

type Tab = 'fields' | 'functions' | 'recipes'
const TABS: Tab[] = ['fields', 'functions', 'recipes']

/**
 * The guided ƒx helper (ticket 507), open under a formula box. Fields — this rule's filters and the
 * values above the one being written, then what a rule may read, each with its type badge —,
 * Functions with their signature, meaning and an example, Recipes that write a whole formula, and
 * the operator chips. Everything a click inserts comes from HQ's catalogue; only the words around
 * it are this bundle's. A field HQ added that the bundle has no words for shows as its path.
 */
export default function FxHelper({
  guide,
  rule,
  valueKey,
  expect,
  current,
  onInsert,
  onUse,
  onDone,
}: {
  guide: RuleFormulaGuide
  rule: CampaignRule
  valueKey: string | null
  expect: RuleFormulaExpect
  /** The box's formula as written — a cap recipe wraps it. */
  current: string
  /** Puts a chip where the cursor was. */
  onInsert: (chip: Chip) => void
  /** Writes a recipe's formula in place of the box's. */
  onUse: (formula: string) => void
  onDone: () => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const [tab, setTab] = useState<Tab>('fields')
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background p-2" data-fx-helper="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-border/60 p-0.5" role="group" aria-label={t('fx.tabs')}>
          {TABS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              className={'rounded px-2.5 py-1 text-xs font-medium ' + (tab === k ? 'bg-primary-050 text-primary-800' : 'text-muted-foreground hover:text-foreground')}
              onClick={() => setTab(k)}
              data-fx-tab={k}
            >
              {t(`fx.tab.${k}`)}
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={onDone} data-fx-done="">
          {t('fx.done')}
        </Button>
      </div>
      {tab === 'fields' && <FieldsTab guide={guide} rule={rule} valueKey={valueKey} onInsert={onInsert} />}
      {tab === 'functions' && <FunctionsTab guide={guide} onInsert={onInsert} />}
      {tab === 'recipes' && <RecipesTab guide={guide} rule={rule} expect={expect} current={current} onUse={onUse} />}
      <div className="flex flex-wrap items-center gap-1" data-fx-operators="">
        <span className="me-1 text-xs text-muted-foreground">{t('fx.operators')}</span>
        {guide.operators.map((op) => (
          <Chip key={op} onClick={() => onInsert(operatorChip(op))} label={t('fx.insertOperator', { op: fsi(op) })} data={op}>
            {op}
          </Chip>
        ))}
        <Chip onClick={() => onInsert(TEXT_CHIP)} label={t('fx.insertText')} data="text">
          {t('fx.textChip')}
        </Chip>
      </div>
      <p className="text-xs text-muted-foreground">{t('fx.hint')}</p>
    </div>
  )
}

function Chip({ onClick, label, data, children }: { onClick: () => void; label: string; data: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className="min-w-7 rounded-md border border-border/60 px-1.5 py-0.5 font-mono text-xs hover:bg-accent"
      aria-label={label}
      onClick={onClick}
      data-fx-op={data}
    >
      <Ltr>{children}</Ltr>
    </button>
  )
}

/** A type badge: what the field gives. */
function TypeBadge({ type }: { type: RuleFormulaType }) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground uppercase" data-fx-type={type}>
      {t(`fx.type.${type}`)}
    </span>
  )
}

function FieldsTab({ guide, rule, valueKey, onInsert }: { guide: RuleFormulaGuide; rule: CampaignRule; valueKey: string | null; onInsert: (chip: Chip) => void }) {
  const { t } = useTranslation('campaign-workspace')
  const has = useHas()
  const [find, setFind] = useState('')
  const q = find.trim().toLowerCase()
  const label = (f: FxField) => (f.kind === 'field' ? (has(`fx.field.${f.insert}.label`) ? t(`fx.field.${f.insert}.label`) : f.insert) : t(`fx.kind.${f.kind}`, { name: fsi(f.insert) }))
  const desc = (f: FxField) => (f.kind === 'field' ? (has(`fx.field.${f.insert}.desc`) ? t(`fx.field.${f.insert}.desc`) : '') : t(`fx.kindHint.${f.kind}`))
  // The label's isolates would split a search across the name ("filter eligible" in "Item filter ⁨eligible⁩").
  const items = fxFields(guide, rule, valueKey).filter((f) => !q || stripIsolates(`${label(f)} ${f.insert} ${desc(f)}`).toLowerCase().includes(q))
  const groups = [...new Set(items.map((f) => f.group))]
  return (
    <div className="flex flex-col gap-1.5">
      <label className="relative block">
        <Search className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input className={`${INPUT} w-full ps-7`} value={find} placeholder={t('fx.search')} aria-label={t('fx.search')} onChange={(e) => setFind(e.target.value)} data-fx-search="" />
      </label>
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {groups.map((g) => (
          <div key={g} data-fx-group={g}>
            <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{has(`fx.group.${g}`) ? t(`fx.group.${g}`) : <Ltr>{g}</Ltr>}</p>
            <ul className="flex flex-col">
              {items
                .filter((f) => f.group === g)
                .map((f) => (
                  <li key={f.key}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 rounded px-1.5 py-1 text-start hover:bg-accent"
                      onClick={() => onInsert({ text: f.insert })}
                      data-fx-item={f.key}
                    >
                      <TypeBadge type={f.type} />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm">
                          {/* A field this bundle has no words for shows its path once, as the code below. */}
                          {f.kind !== 'field' ? <bdi>{label(f)}</bdi> : has(`fx.field.${f.insert}.label`) ? label(f) : null}{' '}
                          <code className="text-xs text-muted-foreground">
                            <Ltr>{f.insert}</Ltr>
                          </code>
                        </span>
                        {desc(f) && <span className="text-xs text-muted-foreground">{desc(f)}</span>}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
        {!items.length && <p className="text-xs text-muted-foreground">{t('fx.noMatch')}</p>}
      </div>
    </div>
  )
}

function FunctionsTab({ guide, onInsert }: { guide: RuleFormulaGuide; onInsert: (chip: Chip) => void }) {
  const { t } = useTranslation('campaign-workspace')
  const has = useHas()
  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
      {guide.functions.map((f) => (
        <li key={f.name} className="flex items-start justify-between gap-2 rounded px-1.5 py-1 hover:bg-muted/50" data-fx-function={f.name}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <code className="text-sm font-semibold">
              <Ltr>{f.signature}</Ltr>
            </code>
            {has(`fx.function.${f.name}`) && <span className="text-xs">{t(`fx.function.${f.name}`)}</span>}
            <span className="text-xs text-muted-foreground">
              {t('fx.example')}{' '}
              <code>
                <Ltr>{f.example}</Ltr>
              </code>
            </span>
          </span>
          <Button variant="ghost" onClick={() => onInsert({ text: f.snippet, caret: f.caret })} data-fx-insert={f.name}>
            {t('fx.insert')}
          </Button>
        </li>
      ))}
    </ul>
  )
}

function RecipesTab({
  guide,
  rule,
  expect,
  current,
  onUse,
}: {
  guide: RuleFormulaGuide
  rule: CampaignRule
  expect: RuleFormulaExpect
  current: string
  onUse: (formula: string) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const has = useHas()
  const [filterId, setFilterId] = useState(rule.filters[0]?.id ?? '')
  const filter = rule.filters.find((f) => f.id === filterId) ?? rule.filters[0]
  const recipes = guide.recipes.filter((r) => r.expect === expect)
  return (
    <div className="flex flex-col gap-1.5">
      {rule.filters.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {t('fx.recipeFilter')}
          <select className={`${INPUT} h-7 text-xs`} value={filter?.id ?? ''} onChange={(e) => setFilterId(e.target.value)} data-fx-recipe-filter="">
            {rule.filters.map((f) => (
              <option key={f.id} value={f.id}>
                {fsi(f.name)}
              </option>
            ))}
          </select>
        </label>
      )}
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {recipes.map((r) => {
          const blocked = recipeNeedsFilter(r) && !filter ? 'filter' : recipeNeedsCurrent(r) && !current.trim() ? 'current' : null
          const formula = recipeFormula(r, filter?.name ?? '', current)
          const name = filter ? fsi(filter.name) : ''
          return (
            <li key={r.key} className="flex items-start justify-between gap-2 rounded px-1.5 py-1 hover:bg-muted/50" data-fx-recipe={r.key}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold">{has(`fx.recipe.${r.key}.title`) ? t(`fx.recipe.${r.key}.title`) : <Ltr>{r.key}</Ltr>}</span>
                {has(`fx.recipe.${r.key}.desc`) && blocked !== 'filter' && <span className="text-xs">{t(`fx.recipe.${r.key}.desc`, { filter: name })}</span>}
                {blocked ? (
                  <span className="text-xs text-muted-foreground">{t(blocked === 'filter' ? 'fx.recipeNeedsFilter' : 'fx.recipeNeedsCurrent')}</span>
                ) : (
                  <code className="text-xs text-muted-foreground" data-fx-recipe-formula="">
                    <Ltr>{formula}</Ltr>
                  </code>
                )}
              </span>
              <Button variant="ghost" disabled={blocked !== null} onClick={() => onUse(formula)} data-fx-use={r.key}>
                {t('fx.use')}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
