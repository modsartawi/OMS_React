import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Plus, Trash2, X } from 'lucide-react'
import type {
  CampaignRule,
  RuleCampaign,
  RuleCatalogueBlock,
  RuleCatalogueField,
  RuleCondition,
  RuleEffect,
  Says,
} from '@/core/models/rule-campaign'
import { campaignCurrency } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { INPUT, labelText, useHas } from './builder-ui'
import { fieldLabelKey, optionLabelKey, timingNoneKey } from './panel-keys'

/**
 * A block's panel (ticket 505): one typed control per catalogue field, by its kind and unit, and
 * the marketer's EN + AR texts as two inputs, the Arabic right-to-left. It edits the block in place
 * through `set` — every change is a step of the builder's history — and closes with Done.
 *
 * Items are picked from the rule's own filters, by id (the "Certain items…" picker is 506's). A
 * formula is shown as written and not edited here: the guided ƒx helper is 507's, and the client
 * never parses the expression language (ADR 0089).
 */
export interface BlockPanelProps {
  block: RuleCondition | RuleEffect
  /** Its catalogue entry. */
  entry: RuleCatalogueBlock
  rule: CampaignRule
  campaign: Pick<RuleCampaign, 'budgets' | 'audience'>
  /** Sets one field; `coalesce` folds a run of keystrokes into one history step. */
  set: (key: string, value: unknown, coalesce?: boolean) => void
  onDone: () => void
  onDelete: () => void
}

export default function BlockPanel({ block, entry, rule, campaign, set, onDone, onDelete }: BlockPanelProps) {
  const { t } = useTranslation('campaign-workspace')
  const has = useHas()
  const raw = block as Record<string, unknown>
  const fields = entry.fields.filter((f) => f.kind !== 'says')
  const says = entry.fields.filter((f) => f.kind === 'says')
  // A condition always has its "not met" pair, even where the catalogue does not list it (a group has none).
  const saysFields: RuleCatalogueField[] =
    entry.kind === 'condition' && entry.type !== 'group' && !says.some((f) => f.key === 'says') ? [...says, { key: 'says', kind: 'says', role: 'notMet' }] : says

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-md border border-primary/30 bg-primary-050/40 p-3" data-block-panel={block.id}>
      {fields.length > 0 && (
        <div className="grid items-center gap-x-3 gap-y-2 sm:grid-cols-[11rem_1fr]">
          {fields.map((f) => {
            const id = `panel-${block.id}-${f.key}`
            return (
              <FieldRow key={f.key} id={id} label={labelText(t, fieldLabelKey(entry.type, f.key, has), f.key, has)}>
                <FieldControl id={id} field={f} entry={entry} raw={raw} rule={rule} campaign={campaign} set={set} />
              </FieldRow>
            )
          })}
        </div>
      )}
      {saysFields.map((f) => (
        <SaysInput
          key={f.key}
          id={`panel-${block.id}-${f.key}`}
          label={t(`rules.says.${f.role ?? 'message'}`)}
          value={(raw[f.key] as Partial<Says> | undefined) ?? { en: '', ar: '' }}
          onChange={(v) => set(f.key, v, true)}
          data={f.role ?? 'message'}
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

function FieldRow({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </>
  )
}

interface ControlProps {
  id: string
  field: RuleCatalogueField
  entry: RuleCatalogueBlock
  raw: Record<string, unknown>
  rule: CampaignRule
  campaign: Pick<RuleCampaign, 'budgets' | 'audience'>
  set: BlockPanelProps['set']
}

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

function FieldControl({ id, field, entry, raw, rule, campaign, set }: ControlProps) {
  const { t } = useTranslation('campaign-workspace')
  const has = useHas()
  const optionText = (o: string) => {
    const key = optionLabelKey(entry.type, field.key, o, has)
    return key ? t(key) : fsi(o)
  }
  const value = raw[field.key]
  const put = (v: unknown, coalesce?: boolean) => set(field.key, v, coalesce)
  const data = { 'data-panel-field': field.key }

  switch (field.kind) {
    case 'items':
      return <ItemsSelect id={id} value={typeof value === 'string' ? value : ''} rule={rule} onChange={put} data={field.key} />
    case 'itemParts':
      return <PartsEditor id={id} value={Array.isArray(value) ? (value as Part[]) : []} rule={rule} onChange={put} />
    case 'money': {
      const currency = campaignCurrency(campaign.audience)
      return (
        <>
          <NumberInput id={id} value={value} onChange={(v) => put(v, true)} {...data} />
          {currency && <span className="text-xs text-muted-foreground"><Ltr>{currency}</Ltr></span>}
        </>
      )
    }
    case 'count':
    case 'days':
      return <NumberInput id={id} value={value} step={1} onChange={(v) => put(v, true)} {...data} />
    case 'discount':
    case 'points': {
      const unit = field.unitFrom ? raw[field.unitFrom] : undefined
      const suffix =
        field.kind === 'discount'
          ? unit === 'percent'
            ? t('panel.percent')
            : campaignCurrency(campaign.audience)
          : unit === 'PTS'
            ? t('panel.points')
            : null
      return <NumberOrValue id={id} value={value} rule={rule} suffix={suffix} onChange={put} data={field.key} />
    }
    case 'code':
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
    case 'codes':
      return <CodesInput id={id} value={Array.isArray(value) ? (value as string[]) : []} onChange={(v) => put(v, true)} data={field.key} />
    case 'text':
      return <input id={id} dir="auto" className={`${INPUT} w-64`} value={typeof value === 'string' ? value : ''} onChange={(e) => put(e.target.value, true)} {...data} />
    case 'choice': {
      const options = field.options ?? []
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
    case 'choices': {
      const picked = Array.isArray(value) ? (value as string[]) : []
      return (
        <span id={id} role="group" className="flex flex-wrap gap-3" {...data}>
          {(field.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={picked.includes(o)}
                onChange={(e) => put(e.target.checked ? [...picked, o] : picked.filter((x) => x !== o))}
                data-panel-choice={o}
              />
              {optionText(o)}
            </label>
          ))}
        </span>
      )
    }
    case 'formula':
      return (
        <span className="flex flex-col gap-1" {...data}>
          <code id={id} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            <Ltr>{typeof value === 'string' ? value : ''}</Ltr>
          </code>
          <span className="text-xs text-muted-foreground">{t('panel.formulaReadOnly')}</span>
        </span>
      )
    case 'timing':
      return <TimingInput id={id} field={field.key} value={value} onChange={put} />
    case 'budget':
      return campaign.budgets.length ? (
        <select id={id} className={INPUT} value={typeof value === 'string' ? value : ''} onChange={(e) => put(e.target.value)} {...data}>
          <option value="">{t('panel.pickBudget')}</option>
          {campaign.budgets.map((b) => (
            <option key={b.id} value={b.id}>
              {fsi(b.name)}
            </option>
          ))}
        </select>
      ) : (
        <span id={id} className="text-sm text-muted-foreground">
          {t('panel.noBudgets')}
        </span>
      )
    case 'flag':
      return <input id={id} type="checkbox" checked={value === true} onChange={(e) => put(e.target.checked)} {...data} />
    case 'says':
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

/** The rule's filters, by id, with "all merchandise" first; a filter that is gone stays visible as such. */
function ItemsSelect({ id, value, rule, onChange, data }: { id: string; value: string; rule: CampaignRule; onChange: (v: string) => void; data: string }) {
  const { t } = useTranslation('campaign-workspace')
  const known = value === '' || rule.filters.some((f) => f.id === value)
  return (
    <select id={id} className={INPUT} value={value} onChange={(e) => onChange(e.target.value)} data-panel-field={data}>
      <option value="">{t('panel.allItems')}</option>
      {rule.filters.map((f) => (
        <option key={f.id} value={f.id}>
          {fsi(f.name)}
        </option>
      ))}
      {!known && <option value={value}>{t('panel.missing')}</option>}
    </select>
  )
}

interface Part {
  of: string
  count: number | null
}

function PartsEditor({ id, value, rule, onChange }: { id: string; value: Part[]; rule: CampaignRule; onChange: (v: Part[]) => void }) {
  const { t } = useTranslation('campaign-workspace')
  const put = (i: number, part: Partial<Part>) => onChange(value.map((p, j) => (j === i ? { ...p, ...part } : p)))
  return (
    <div id={id} className="flex flex-col gap-1.5" data-panel-field="parts">
      {value.map((p, i) => (
        <span key={i} className="flex flex-wrap items-center gap-2" data-panel-part={i}>
          <NumberInput id={`${id}-count-${i}`} value={p.count} step={1} onChange={(count) => put(i, { count })} aria-label={t('panel.partCount')} />
          <ItemsSelect id={`${id}-of-${i}`} value={p.of} rule={rule} onChange={(of) => put(i, { of })} data={`part-${i}`} />
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-danger-800"
            aria-label={t('panel.removePart')}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      ))}
      <span>
        <Button variant="ghost" onClick={() => onChange([...value, { of: rule.filters[0]?.id ?? '', count: 1 }])} data-panel-add-part="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('panel.addPart')}
        </Button>
      </span>
    </div>
  )
}

/**
 * A discount or points field: a number, or one of the rule's named values (by id). The named value's
 * formula is not touched here — it is 507's.
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
  suffix: string | null
  onChange: (v: unknown, coalesce?: boolean) => void
  data: string
}) {
  const { t } = useTranslation('campaign-workspace')
  const named = typeof value === 'string' && value ? (rule.values.find((v) => v.id === value) ?? rule.values.find((v) => v.name === value)) : undefined
  const missing = typeof value === 'string' && value !== '' && !named
  const choosing = rule.values.length > 0 || missing
  const number = (
    <>
      <NumberInput
        id={choosing ? `${id}-n` : id}
        value={value}
        onChange={(v) => onChange(v, true)}
        aria-label={choosing ? t('panel.aNumber') : undefined}
        data-panel-field={data}
      />
      {suffix && <span className="text-xs text-muted-foreground"><Ltr>{suffix}</Ltr></span>}
    </>
  )
  if (!choosing) return number
  const picked = named ? named.id : missing ? String(value) : ''
  return (
    <>
      <select
        id={id}
        className={INPUT}
        value={picked}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
        data-panel-value-source={data}
      >
        <option value="">{t('panel.aNumber')}</option>
        {rule.values.map((v) => (
          <option key={v.id} value={v.id}>
            {fsi(v.name)}
          </option>
        ))}
        {missing && <option value={String(value)}>{t('panel.missing')}</option>}
      </select>
      {picked === '' && number}
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

const TIMING_MODES = ['none', 'afterDays', 'afterHours', 'on'] as const

/** When points activate or expire: not set, after N days or hours, or on a local day (never a `Z`). */
function TimingInput({ id, field, value, onChange }: { id: string; field: string; value: unknown; onChange: (v: unknown, coalesce?: boolean) => void }) {
  const { t } = useTranslation('campaign-workspace')
  const has = useHas()
  const v = (value ?? {}) as { mode?: string; value?: unknown }
  const mode = TIMING_MODES.includes(v.mode as (typeof TIMING_MODES)[number]) ? (v.mode as string) : 'none'
  return (
    <>
      <select
        id={id}
        className={INPUT}
        value={mode}
        onChange={(e) => onChange({ mode: e.target.value, value: e.target.value === 'on' ? '' : null })}
        data-panel-field={field}
      >
        {TIMING_MODES.map((m) => (
          <option key={m} value={m}>
            {m === 'none' ? t(timingNoneKey(field, has)) : t(`panel.timing.${m}`)}
          </option>
        ))}
      </select>
      {mode === 'on' && (
        <input
          type="date"
          className={INPUT}
          value={typeof v.value === 'string' ? v.value : ''}
          aria-label={t('panel.timing.on')}
          onChange={(e) => onChange({ mode, value: e.target.value }, true)}
          data-panel-timing-day={field}
        />
      )}
      {(mode === 'afterDays' || mode === 'afterHours') && (
        <NumberInput id={`${id}-n`} value={v.value} step={1} onChange={(n) => onChange({ mode, value: n }, true)} aria-label={t(`panel.timing.${mode}`)} />
      )}
    </>
  )
}

/** A marketer's text in both languages: two inputs, the Arabic one right-to-left. */
function SaysInput({ id, label, value, onChange, data }: { id: string; label: string; value: Partial<Says>; onChange: (v: Says) => void; data: string }) {
  const { t } = useTranslation('campaign-workspace')
  const en = value.en ?? ''
  const ar = value.ar ?? ''
  return (
    <fieldset className="grid gap-x-3 gap-y-1 sm:grid-cols-[11rem_1fr_1fr]" data-panel-says={data}>
      <legend className="sr-only">{label}</legend>
      <span className="text-xs font-medium text-muted-foreground" aria-hidden>
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
    </fieldset>
  )
}
