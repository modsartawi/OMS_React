import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Trash2 } from 'lucide-react'
import type {
  CampaignRule,
  RuleCampaign,
  RuleCatalogueBlock,
  RuleCatalogueField,
  RuleCondition,
  RuleEffect,
  RuleExpr,
  RuleFieldType,
  RuleIssue,
  RuleItemFilter,
  Says,
} from '@/core/models/rule-campaign'
import { filterNameProblem, newFilter, nextFilterName } from '@/core/rules/filters'
import type { RuleFormulaGuide } from '@/core/rules/formula-guide'
import { blockFields, campaignCurrency, exprText, saysRoleOf, unitOf } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { INPUT, labelText, useHas } from './builder-ui'
import CheckNotes, { checkTone, SEVERITY_LOOK } from './CheckNotes'
import { NO_BLOCK_CHECKS, type BlockChecks } from './checks'
import FilterEditor from './FilterEditor'
import FormulaBox from './FormulaBox'
import { fieldLabelKey, optionLabelKey, timingNoneKey } from './panel-keys'

/**
 * A block's panel (ticket 505): one typed control per catalogue field, by its kind and unit, and
 * the marketer's EN + AR texts as two inputs, the Arabic right-to-left. It edits the block in place
 * through `set` — every change is a step of the builder's history — and closes with Done.
 *
 * Items are the rule's own filters, by id, or "Certain items…" (ticket 506): the picker opens at
 * the field, and saving it adds a named filter to the rule and points the field at it, in ONE
 * history step. A formula is written with the guided ƒx helper (`./FormulaBox`, ticket 507): its
 * text is read into the stored JSON expression by `@/core/rules/expr` (ticket 522).
 *
 * HQ's checks of the saved draft (ticket 508) show at the field they point at; one on the block as
 * a whole, or on a field this panel does not show, shows at the top.
 */
export interface BlockPanelProps {
  block: RuleCondition | RuleEffect
  /** The block's builder key (`./block-keys`) — its controls' ids. */
  bkey: string
  /** Its catalogue entry. */
  entry: RuleCatalogueBlock
  rule: CampaignRule
  campaign: Pick<RuleCampaign, 'id' | 'budgets' | 'audience'>
  /** What the guided ƒx helper offers (ticket 507). */
  guide: RuleFormulaGuide
  /** Sets one field (`undefined` leaves it out); `coalesce` folds a run of keystrokes into one history step. */
  set: (key: string, value: unknown, coalesce?: boolean) => void
  /** Adds `filter` to the rule and sets `key = value` (which points at it), as one step. */
  withFilter: (filter: RuleItemFilter, key: string, value: unknown) => void
  newId: () => string
  /** HQ's messages on this block (ticket 508, `./checks`). */
  checks?: BlockChecks
  onDone: () => void
  onDelete: () => void
}

export default function BlockPanel({ block, bkey, entry, rule, campaign, guide, set, withFilter, newId, checks = NO_BLOCK_CHECKS, onDone, onDelete }: BlockPanelProps) {
  const { t } = useTranslation('campaign-workspace')
  const has = useHas()
  const raw = block as Record<string, unknown>
  const own = blockFields(entry)
  // A group's conditions are edited in the rule card, not here.
  const fields = own.filter((f) => f.type !== 'text' && !NOT_IN_PANEL.has(f.type))
  const saysFields = own.filter((f) => f.type === 'text')
  const shown = new Set([...fields, ...saysFields].map((f) => f.name))
  const atTop = checks.all.filter((m) => !shown.has(fieldOf(m)))

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-md border border-primary/30 bg-primary-050/40 p-3" data-block-panel={bkey}>
      <CheckNotes messages={atTop} data="panel" />
      {fields.length > 0 && (
        <div className="grid items-center gap-x-3 gap-y-2 sm:grid-cols-[11rem_1fr]">
          {fields.map((f) => {
            const id = `panel-${bkey}-${f.name}`
            return (
              <FieldRow key={f.name} id={id} label={labelText(t, fieldLabelKey(entry.type, f.name, has), f.name, has)} notes={checks.byField[f.name]} field={f.name}>
                <FieldControl id={id} field={f} entry={entry} raw={raw} rule={rule} campaign={campaign} guide={guide} set={set} withFilter={withFilter} newId={newId} issues={checks.byField[f.name] ?? []} />
              </FieldRow>
            )
          })}
        </div>
      )}
      {saysFields.map((f) => (
        <SaysInput
          key={f.name}
          id={`panel-${bkey}-${f.name}`}
          label={t(`rules.says.${saysRoleOf(f.name)}`)}
          value={(raw[f.name] as Partial<Says> | undefined) ?? { en: '', ar: '' }}
          onChange={(v) => set(f.name, v, true)}
          data={saysRoleOf(f.name)}
          notes={checks.byField[f.name]}
          field={f.name}
        />
      ))}
      <div className="flex justify-end gap-2">
        <Button variant="danger-outlined" onClick={onDelete} data-panel-delete="">
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {t('panel.delete')}
        </Button>
        <Button variant="primary" onClick={onDone} data-panel-done="">
          <Check className="h-3.5 w-3.5" aria-hidden />
          {t('panel.done')}
        </Button>
      </div>
    </div>
  )
}

/** Field types the panel has no control for: a group's nested conditions (edited in the card), and settings' shapes. */
const NOT_IN_PANEL: ReadonlySet<RuleFieldType> = new Set<RuleFieldType>(['conditions', 'object', 'objects', 'entries'])

/** The control an issue points at: its field's first segment (`label.ar` → `label`). */
const fieldOf = (m: RuleIssue): string => (m.field ?? '').split(/[.[]/)[0]

function FieldRow({ id, label, notes, field, children }: { id: string; label: ReactNode; notes?: RuleIssue[]; field: string; children: ReactNode }) {
  const bad = checkTone(notes ?? []) === 'error'
  return (
    <>
      <label htmlFor={id} className={'text-xs font-medium ' + (bad ? SEVERITY_LOOK.error.ink : 'text-muted-foreground')}>
        {label}
      </label>
      <div className="flex min-w-0 flex-wrap items-center gap-2" data-panel-row={field}>
        {children}
        <CheckNotes messages={notes ?? []} data={field} />
      </div>
    </>
  )
}

interface ControlProps {
  id: string
  field: RuleCatalogueField
  entry: RuleCatalogueBlock
  raw: Record<string, unknown>
  rule: CampaignRule
  campaign: Pick<RuleCampaign, 'id' | 'budgets' | 'audience'>
  guide: RuleFormulaGuide
  set: BlockPanelProps['set']
  withFilter: BlockPanelProps['withFilter']
  newId: () => string
  /** HQ's issues at this field — the ƒx helper's validator line. */
  issues: RuleIssue[]
}

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

function FieldControl({ id, field, entry, raw, rule, campaign, guide, set, withFilter, newId, issues }: ControlProps) {
  const { t } = useTranslation('campaign-workspace')
  const has = useHas()
  const optionText = (o: string) => {
    const key = optionLabelKey(entry.type, field.name, o, has)
    return key ? t(key) : fsi(o)
  }
  /** The same option inside JSX (a checkbox label): a code HQ has no words for goes in `Ltr`, not `fsi`. */
  const optionNode = (o: string) => {
    const key = optionLabelKey(entry.type, field.name, o, has)
    return key ? t(key) : <Ltr>{o}</Ltr>
  }
  const value = raw[field.name]
  const put = (v: unknown, coalesce?: boolean) => set(field.name, v, coalesce)
  const data = { 'data-panel-field': field.name }
  // The unit beside a figure. A currency code is a machine value and takes `Ltr`; a word ("points")
  // reads in the UI's direction.
  const unit = unitOf(field, raw)
  const currency = unit === 'currency' ? campaignCurrency(campaign.audience) : null
  const suffix: ReactNode = unit === '%' ? t('panel.percent') : unit === 'points' ? t('panel.points') : currency && <Ltr>{currency}</Ltr>
  const withSuffix = (control: ReactNode) => (
    <>
      {control}
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </>
  )

  switch (field.type) {
    case 'filter':
      return (
        <ItemsChoice
          id={id}
          value={typeof value === 'string' ? value : ''}
          rule={rule}
          newId={newId}
          onChange={(v) => put(v === '' ? undefined : v)}
          onCreate={(filter) => withFilter(filter, field.name, filter.id)}
          data={field.name}
        />
      )
    case 'money':
    case 'percent':
    case 'number':
    case 'points':
      return withSuffix(<NumberInput id={id} value={value} onChange={(v) => put(v ?? undefined, true)} {...data} />)
    case 'count':
      return withSuffix(<NumberInput id={id} value={value} step={1} onChange={(v) => put(v ?? undefined, true)} {...data} />)
    case 'formula':
      // A figure with a unit (a discount, points) is a number, a named value or an expression; a
      // formula with none (the formula condition's test) is written with the guided ƒx helper.
      if (field.unit) return <NumberOrValue id={id} value={value} rule={rule} suffix={suffix} onChange={put} data={field.name} />
      return (
        <span className="flex w-full min-w-0" {...data}>
          <FormulaBox
            id={id}
            value={(value ?? null) as RuleExpr}
            onChange={(expr, typed) => put(expr, typed)}
            expect={entry.kind === 'condition' ? 'bool' : 'number'}
            rule={rule}
            issues={issues}
            guide={guide}
            data={field.name}
          />
        </span>
      )
    case 'code':
    case 'time':
      return (
        <input
          id={id}
          dir="ltr"
          className={`${INPUT} w-48 font-mono`}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => put(e.target.value, true)}
          {...data}
        />
      )
    case 'codes': {
      if (!field.values) return <CodesInput id={id} value={Array.isArray(value) ? (value as string[]) : []} onChange={(v) => put(v, true)} data={field.name} />
      const picked = Array.isArray(value) ? (value as string[]) : []
      return (
        <span id={id} role="group" className="flex flex-wrap gap-3" {...data}>
          {field.values.map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={picked.includes(o)}
                onChange={(e) => put(e.target.checked ? [...picked, o] : picked.filter((x) => x !== o))}
                data-panel-choice={o}
              />
              {optionNode(o)}
            </label>
          ))}
        </span>
      )
    }
    case 'choice': {
      const options = field.values ?? []
      const current = value == null ? '' : String(value)
      return (
        <select id={id} className={INPUT} value={current} onChange={(e) => put(e.target.value)} {...data}>
          {!options.includes(current) && <option value={current}>{fsi(current)}</option>}
          {options.map((o) => (
            <option key={o} value={o}>
              {optionText(o)}
            </option>
          ))}
        </select>
      )
    }
    case 'pointsDate':
      return <TimingInput id={id} field={field.name} value={value} onChange={put} />
    case 'date':
      return <input id={id} type="date" className={INPUT} value={typeof value === 'string' ? value : ''} onChange={(e) => put(e.target.value || undefined, true)} {...data} />
    case 'budget':
      return campaign.budgets?.length ? (
        <select id={id} className={INPUT} value={typeof value === 'string' ? value : ''} onChange={(e) => put(e.target.value)} {...data}>
          <option value="">{t('panel.pickBudget')}</option>
          {(campaign.budgets ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {fsi(b.name.en || b.id)}
            </option>
          ))}
        </select>
      ) : (
        <span id={id} className="text-sm text-muted-foreground">
          {t('panel.noBudgets')}
        </span>
      )
    case 'bool':
      return <input id={id} type="checkbox" checked={value === true} onChange={(e) => put(e.target.checked)} {...data} />
    case 'text':
    case 'conditions':
    case 'object':
    case 'objects':
    case 'entries':
      return null
  }
}

function NumberInput({
  id,
  value,
  onChange,
  step,
  ...rest
}: {
  id: string
  value: unknown
  onChange: (v: number | null) => void
  step?: number
  'aria-label'?: string
  [data: `data-${string}`]: string
}) {
  return (
    <input
      id={id}
      type="number"
      dir="ltr"
      min={0}
      step={step ?? 'any'}
      className={`${INPUT} w-28`}
      value={isNumber(value) ? value : ''}
      onChange={(e) => {
        const n = e.target.value === '' ? null : Number(e.target.value)
        onChange(n === null || Number.isFinite(n) ? n : null)
      }}
      {...rest}
    />
  )
}

/** The select's value for "Certain items…" — never a filter id (the browser mints those). */
const CERTAIN = '__certain'

/**
 * An items field: all merchandise, one of the rule's filters by id (a filter that is gone stays
 * visible as such), or "Certain items…", which opens the picker here, at the field. Its draft is a
 * new filter, Prescription kept out; Save filter adds it and points the field at it, Cancel leaves
 * the field as it was.
 */
function ItemsChoice({
  id,
  value,
  rule,
  newId,
  onChange,
  onCreate,
  data,
  ariaLabel,
}: {
  id: string
  value: string
  rule: CampaignRule
  newId: () => string
  onChange: (v: string) => void
  onCreate: (filter: RuleItemFilter) => void
  data: string
  /** For a picker with no `<label>` of its own (a bundle part's "of"). */
  ariaLabel?: string
}) {
  const { t } = useTranslation('campaign-workspace')
  const [draft, setDraft] = useState<RuleItemFilter | null>(null)
  const known = value === '' || rule.filters.some((f) => f.id === value)
  const problem = draft ? filterNameProblem(rule.filters, draft.name, undefined, rule.values) : null
  return (
    <>
      <select
        id={id}
        aria-label={ariaLabel}
        className={INPUT}
        value={draft ? CERTAIN : value}
        onChange={(e) => {
          if (e.target.value === CERTAIN) setDraft(newFilter(newId(), nextFilterName(rule.filters, t('filters.defaultName'))))
          else {
            setDraft(null)
            onChange(e.target.value)
          }
        }}
        data-panel-field={data}
      >
        <option value="">{t('panel.allItems')}</option>
        {rule.filters.map((f) => (
          <option key={f.id} value={f.id}>
            {fsi(f.name)}
          </option>
        ))}
        {!known && <option value={value}>{t('panel.missing')}</option>}
        <option value={CERTAIN}>{t('filters.certainItems')}</option>
      </select>
      {draft && (
        <div className="basis-full">
          <FilterEditor
            filter={draft}
            onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
            nameProblem={problem}
            data={`${data}-new`}
            footer={
              <>
                <Button variant="text" onClick={() => setDraft(null)} data-filter-cancel="">
                  {t('filters.cancel')}
                </Button>
                <Button
                  variant="primary"
                  disabled={problem !== null}
                  onClick={() => {
                    onCreate({ ...draft, name: draft.name.trim() })
                    setDraft(null)
                  }}
                  data-filter-save=""
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  {t('filters.save')}
                </Button>
              </>
            }
          />
        </div>
      )}
    </>
  )
}

/** The select's value for a field that holds an expression rather than a number or a named value. */
const EXPR = '__expr'

/**
 * A discount or points field: a number, one of the rule's named values (read by name, `"$name"`),
 * or — as HQ stores it — an expression, shown as text (its JSON when it cannot be printed). A named
 * value's formula is written in the rule's Named values (`./RuleValues`).
 */
function NumberOrValue({
  id,
  value,
  rule,
  suffix,
  onChange,
  data,
}: {
  id: string
  value: unknown
  rule: CampaignRule
  suffix: ReactNode
  onChange: (v: unknown, coalesce?: boolean) => void
  data: string
}) {
  const { t } = useTranslation('campaign-workspace')
  const ref = typeof value === 'string' && value.startsWith('$') ? value.slice(1) : null
  const named = ref !== null ? rule.values.find((v) => v.name === ref) : undefined
  const missing = ref !== null && !named
  const expr = Array.isArray(value) ? (value as RuleExpr) : null
  const choosing = rule.values.length > 0 || missing || expr !== null
  const number = (
    <>
      <NumberInput
        id={choosing ? `${id}-n` : id}
        value={value}
        onChange={(v) => onChange(v ?? undefined, true)}
        aria-label={choosing ? t('panel.aNumber') : undefined}
        data-panel-field={data}
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </>
  )
  if (!choosing) return number
  const picked = expr !== null ? EXPR : ref !== null ? String(value) : ''
  return (
    <>
      <select
        id={id}
        className={INPUT}
        value={picked}
        onChange={(e) => {
          if (e.target.value !== EXPR) onChange(e.target.value === '' ? undefined : e.target.value)
        }}
        data-panel-value-source={data}
      >
        <option value="">{t('panel.aNumber')}</option>
        {rule.values.map((v, i) => (
          <option key={`${i}:${v.name}`} value={`$${v.name}`}>
            {v.name.trim() ? fsi(v.name) : t('panel.unnamedValue')}
          </option>
        ))}
        {missing && <option value={String(value)}>{t('panel.missing')}</option>}
        {expr !== null && <option value={EXPR}>{t('panel.anExpression')}</option>}
      </select>
      {picked === '' && number}
      {expr !== null && (
        <code className="font-mono text-xs" data-panel-expr={data}>
          <Ltr>{exprText(expr, rule)}</Ltr>
        </code>
      )}
    </>
  )
}

/** A list of codes typed with commas between them. The text is kept as typed; the codes go in as a list. */
function CodesInput({ id, value, onChange, data }: { id: string; value: string[]; onChange: (v: string[]) => void; data: string }) {
  const { t } = useTranslation('campaign-workspace')
  const [text, setText] = useState(() => value.join(', '))
  // An Undo, a Redo or a Cancel changes the codes under the input: show them as they now are.
  useEffect(() => {
    if (JSON.stringify(parseCodes(text)) !== JSON.stringify(value)) setText(value.join(', '))
    // Only a change from outside the input re-writes it; typing keeps the text as typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const hintId = `${id}-hint`
  return (
    <span className="flex flex-col gap-1">
      <input
        id={id}
        dir="ltr"
        className={`${INPUT} w-64 font-mono`}
        value={text}
        aria-describedby={hintId}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseCodes(e.target.value))
        }}
        data-panel-field={data}
      />
      <span id={hintId} className="text-xs text-muted-foreground">
        {t('panel.codesHint')}
      </span>
    </span>
  )
}

const parseCodes = (text: string) =>
  text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)


/** How a points date is set: not at all (at once / never), N days after, or on a local day. */
const POINTS_DATE_MODES = ['none', 'afterDays', 'on'] as const

/** When points activate or expire: `{ afterDays }` or `{ on: 'yyyy-MM-dd' }` (never a `Z`); absent = not set. */
function TimingInput({ id, field, value, onChange }: { id: string; field: string; value: unknown; onChange: (v: unknown, coalesce?: boolean) => void }) {
  const { t } = useTranslation('campaign-workspace')
  const has = useHas()
  const v = (value ?? {}) as { afterDays?: unknown; on?: unknown }
  const mode = typeof v.on === 'string' ? 'on' : 'afterDays' in v ? 'afterDays' : 'none'
  return (
    <>
      <select
        id={id}
        className={INPUT}
        value={mode}
        onChange={(e) => onChange(e.target.value === 'on' ? { on: '' } : e.target.value === 'afterDays' ? { afterDays: null } : undefined)}
        data-panel-field={field}
      >
        {POINTS_DATE_MODES.map((m) => (
          <option key={m} value={m}>
            {m === 'none' ? t(timingNoneKey(field, has)) : t(`panel.timing.${m}`)}
          </option>
        ))}
      </select>
      {mode === 'on' && (
        <input
          type="date"
          className={INPUT}
          value={typeof v.on === 'string' ? v.on : ''}
          aria-label={t('panel.timing.on')}
          onChange={(e) => onChange({ on: e.target.value }, true)}
          data-panel-timing-day={field}
        />
      )}
      {mode === 'afterDays' && (
        <NumberInput id={`${id}-n`} value={v.afterDays} step={1} onChange={(n) => onChange({ afterDays: n }, true)} aria-label={t('panel.timing.afterDays')} />
      )}
    </>
  )
}

/** A marketer's text in both languages: two inputs, the Arabic one right-to-left. */
function SaysInput({
  id,
  label,
  value,
  onChange,
  data,
  notes,
  field,
}: {
  id: string
  label: string
  value: Partial<Says>
  onChange: (v: Says) => void
  data: string
  notes?: RuleIssue[]
  field: string
}) {
  const { t } = useTranslation('campaign-workspace')
  const en = value.en ?? ''
  const ar = value.ar ?? ''
  return (
    <fieldset className="grid gap-x-3 gap-y-1 sm:grid-cols-[11rem_1fr_1fr]" data-panel-says={data}>
      <legend className="sr-only">{label}</legend>
      <span className={'text-xs font-medium ' + (checkTone(notes ?? []) === 'error' ? SEVERITY_LOOK.error.ink : 'text-muted-foreground')} aria-hidden>
        {label}
      </span>
      <input
        id={`${id}-en`}
        dir="ltr"
        lang="en"
        className={`${INPUT} w-full`}
        value={en}
        placeholder={t('panel.english')}
        aria-label={t('panel.saysEnglish', { label })}
        onChange={(e) => onChange({ en: e.target.value, ar })}
        data-panel-says-en=""
      />
      <input
        id={`${id}-ar`}
        dir="rtl"
        lang="ar"
        className={`${INPUT} w-full`}
        value={ar}
        placeholder={t('panel.arabic')}
        aria-label={t('panel.saysArabic', { label })}
        onChange={(e) => onChange({ en, ar: e.target.value })}
        data-panel-says-ar=""
      />
      {notes && notes.length > 0 && (
        <div className="sm:col-start-2 sm:col-end-4" data-panel-row={field}>
          <CheckNotes messages={notes} data={field} />
        </div>
      )}
    </fieldset>
  )
}
