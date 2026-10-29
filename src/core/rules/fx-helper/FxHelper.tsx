import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { RuleFormulaFunction, RuleFormulaType } from '@/core/rules/formula-guide'
import Button from '@/core/ui/Button'
import UiChip from '@/core/ui/Chip'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { fsi, stripIsolates } from '@/core/util/bidi'
import { operatorChip, TEXT_CHIP, type Chip } from './insert'

// The guided ƒx helper (ticket 507), open under a formula box — in core since oms 657, so the
// promotion rule's formulas and the insurance guard's share one. Fields, each with its type badge;
// Functions with their signature, meaning and an example; Recipes that write a whole formula; and
// the operator chips. What a click inserts is the caller's guide; the WORDS are the caller's
// namespace, under its `fx.*` keys (`ns`): each feature owns its own bundle. A field, group,
// function or recipe the bundle has no words for shows as its code.

type Tab = 'fields' | 'functions' | 'recipes'
const TABS: Tab[] = ['fields', 'functions', 'recipes']

/** One row of the Fields tab. */
export interface FxEntry {
  /** Its `data-fx-item`. */
  key: string
  /** Its heading: `fx.group.<group>`, else the group as a code. */
  group: string
  type: RuleFormulaType
  /** What a click puts in. */
  insert: Chip
  /** The code shown beside the words (the path as written). */
  code: string
  /** Its words: `fx.field.<words>.label` / `.desc`. */
  words?: string
  /** Its words already said (a rule's own filter or value, named by the caller); `<bdi>`-isolated. */
  label?: string
  desc?: string
}

/** One row of the Recipes tab: its words are `fx.recipe.<key>.title` / `.desc` (with `descValues`). */
export interface FxRecipeRow {
  key: string
  formula: string
  /** Why it cannot be used yet, as an `fx.*` key; null = usable. */
  blocked: string | null
  /** Hide its description (it would name what is missing). */
  hideDesc?: boolean
  descValues?: Record<string, string>
}

export interface FxHelperProps {
  /** The namespace holding the `fx.*` words. */
  ns: string
  fields: readonly FxEntry[]
  functions: readonly RuleFormulaFunction[]
  operators: readonly string[]
  recipes: readonly FxRecipeRow[]
  /** Above the recipes (the promotion rule's filter pick). */
  recipesHeader?: ReactNode
  /** Puts a chip where the cursor was. */
  onInsert: (chip: Chip) => void
  /** Writes a recipe's formula in place of the box's. */
  onUse: (formula: string) => void
  onDone: () => void
}

function useFx(ns: string) {
  const { t, i18n } = useTranslation(ns, { keyPrefix: 'fx' })
  const has = (key: string) => i18n.exists(`fx.${key}`, { ns })
  return { t, has }
}

export default function FxHelper({ ns, fields, functions, operators, recipes, recipesHeader, onInsert, onUse, onDone }: FxHelperProps) {
  const { t } = useFx(ns)
  const [tab, setTab] = useState<Tab>('fields')
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background p-2" data-fx-helper="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex gap-1" role="group" aria-label={t('tabs')}>
          {TABS.map((k) => (
            <UiChip key={k} on={tab === k} onClick={() => setTab(k)} data-fx-tab={k}>
              {t(`tab.${k}`)}
            </UiChip>
          ))}
        </div>
        <Button variant="ghost" onClick={onDone} data-fx-done="">
          {t('done')}
        </Button>
      </div>
      {tab === 'fields' && <FieldsTab ns={ns} fields={fields} onInsert={onInsert} />}
      {tab === 'functions' && <FunctionsTab ns={ns} functions={functions} onInsert={onInsert} />}
      {tab === 'recipes' && <RecipesTab ns={ns} recipes={recipes} header={recipesHeader} onUse={onUse} />}
      <div className="flex flex-wrap items-center gap-1" data-fx-operators="">
        <span className="me-1 text-xs text-muted-foreground">{t('operators')}</span>
        {operators.map((op) => (
          <OperatorKey key={op} onClick={() => onInsert(operatorChip(op))} label={t('insertOperator', { op: fsi(op) })} data={op}>
            {op}
          </OperatorKey>
        ))}
        <OperatorKey onClick={() => onInsert(TEXT_CHIP)} label={t('insertText')} data="text">
          {t('textChip')}
        </OperatorKey>
      </div>
      <p className="text-xs text-muted-foreground">{t('hint')}</p>
    </div>
  )
}

/** An operator key: its glyph is the face, its accessible name says what it inserts. */
function OperatorKey({ onClick, label, data, children }: { onClick: () => void; label: string; data: string; children: ReactNode }) {
  return (
    <Button variant="outlined" className="font-mono" aria-label={label} onClick={onClick} data-fx-op={data}>
      <Ltr>{children}</Ltr>
    </Button>
  )
}

/** A type badge: what the field gives. */
function TypeBadge({ ns, type }: { ns: string; type: RuleFormulaType }) {
  const { t } = useFx(ns)
  return (
    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground uppercase" data-fx-type={type}>
      {t(`type.${type}`)}
    </span>
  )
}

function FieldsTab({ ns, fields, onInsert }: { ns: string; fields: readonly FxEntry[]; onInsert: (chip: Chip) => void }) {
  const { t, has } = useFx(ns)
  const [find, setFind] = useState('')
  const q = find.trim().toLowerCase()
  const words = (f: FxEntry): string | null => (f.label !== undefined ? f.label : f.words && has(`field.${f.words}.label`) ? t(`field.${f.words}.label`) : null)
  const desc = (f: FxEntry): string => (f.desc !== undefined ? f.desc : f.words && has(`field.${f.words}.desc`) ? t(`field.${f.words}.desc`) : '')
  // The label's isolates would split a search across the name ("filter eligible" in "Item filter ⁨eligible⁩").
  const items = fields.filter((f) => !q || stripIsolates(`${words(f) ?? f.code} ${f.code} ${desc(f)}`).toLowerCase().includes(q))
  const groups = [...new Set(items.map((f) => f.group))]
  return (
    <div className="flex flex-col gap-1.5">
      <Input type="search" wrapperClassName="w-full" value={find} placeholder={t('search')} aria-label={t('search')} onChange={(e) => setFind(e.target.value)} data-fx-search="" />
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {groups.map((g) => (
          <div key={g} data-fx-group={g}>
            <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">{has(`group.${g}`) ? t(`group.${g}`) : <Ltr>{g}</Ltr>}</p>
            <ul className="flex flex-col">
              {items
                .filter((f) => f.group === g)
                .map((f) => {
                  const said = words(f)
                  const about = desc(f)
                  return (
                    <li key={f.key}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-start hover:bg-accent"
                        onClick={() => onInsert(f.insert)}
                        data-fx-item={f.key}
                      >
                        <TypeBadge ns={ns} type={f.type} />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-sm">
                            {/* A field this bundle has no words for shows its path once, as the code below. */}
                            {f.label !== undefined ? <bdi>{said}</bdi> : said}{' '}
                            <code className="text-xs text-muted-foreground">
                              <Ltr>{f.code}</Ltr>
                            </code>
                          </span>
                          {about && <span className="text-xs text-muted-foreground">{about}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
        {!items.length && <p className="text-xs text-muted-foreground">{t('noMatch')}</p>}
      </div>
    </div>
  )
}

function FunctionsTab({ ns, functions, onInsert }: { ns: string; functions: readonly RuleFormulaFunction[]; onInsert: (chip: Chip) => void }) {
  const { t, has } = useFx(ns)
  return (
    <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
      {functions.map((f) => (
        <li key={f.name} className="flex items-start justify-between gap-2 rounded px-1.5 py-1 hover:bg-muted/50" data-fx-function={f.name}>
          <span className="flex min-w-0 flex-col gap-0.5">
            <code className="text-sm font-semibold">
              <Ltr>{f.signature}</Ltr>
            </code>
            {has(`function.${f.name}`) && <span className="text-xs">{t(`function.${f.name}`)}</span>}
            <span className="text-xs text-muted-foreground">
              {t('example')}{' '}
              <code>
                <Ltr>{f.example}</Ltr>
              </code>
            </span>
          </span>
          <Button variant="ghost" onClick={() => onInsert({ text: f.snippet, caret: f.caret })} data-fx-insert={f.name}>
            {t('insert')}
          </Button>
        </li>
      ))}
    </ul>
  )
}

function RecipesTab({ ns, recipes, header, onUse }: { ns: string; recipes: readonly FxRecipeRow[]; header?: ReactNode; onUse: (formula: string) => void }) {
  const { t, has } = useFx(ns)
  return (
    <div className="flex flex-col gap-1.5">
      {header}
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {recipes.map((r) => (
          <li key={r.key} className="flex items-start justify-between gap-2 rounded px-1.5 py-1 hover:bg-muted/50" data-fx-recipe={r.key}>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">{has(`recipe.${r.key}.title`) ? t(`recipe.${r.key}.title`) : <Ltr>{r.key}</Ltr>}</span>
              {has(`recipe.${r.key}.desc`) && !r.hideDesc && <span className="text-xs">{t(`recipe.${r.key}.desc`, r.descValues)}</span>}
              {r.blocked ? (
                <span className="text-xs text-muted-foreground">{t(r.blocked)}</span>
              ) : (
                <code className="text-xs text-muted-foreground" data-fx-recipe-formula="">
                  <Ltr>{r.formula}</Ltr>
                </code>
              )}
            </span>
            <Button variant="ghost" disabled={r.blocked !== null} onClick={() => onUse(r.formula)} data-fx-use={r.key}>
              {t('use')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
