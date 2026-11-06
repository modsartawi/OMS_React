import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { CircleAlert, Info, Minus, Plus, RotateCcw } from 'lucide-react'
import type { AnalyticsModel, BoardPeriod, Param, ParamValue, PeriodToken, ThresholdOp } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field, { FIELD_LABEL } from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import MultiSelect, { type MultiSelectOption } from '@/core/ui/MultiSelect'
import Select from '@/core/ui/Select'
import { toIsoDate } from '@/core/util/date-format'
import { formatPair, fsi } from '@/core/util/bidi'
import { saysIn } from '@/core/rules/sentence'
import { analyticsApi, analyticsMembersKey } from './api'
import type { StreamWave } from './board'
import { GRAINS } from './editor'
import { boardPeriodOf, movedOff, paramLabel, periodValue, stripControlOf, TOP_N_MAX, TOP_N_MIN, valueOf, type ParamValues } from './params'
import { periodNameKey, PERIODS } from './periods'
import { dimensionOf, measureOf } from './wire'

/**
 * The board's parameter strip (spec 766 §F, ticket 771; rendered from the board's parameters since 819,
 * ticket 821, with every kind's control since 823): a period (a relative preset or a fixed range); a
 * `members` parameter searched through `Analytics/DimensionValues`, picked from the model's inline values,
 * or from the author's pinned list — one value or several; grain chips over the allowed subset; an
 * operator and a number in the display unit for a threshold; a top N stepper (1–100); a measure or a
 * breakdown choice. The six ready-made parameters draw exactly v1's six controls. Every change goes to the
 * caller, who writes it to the URL — the permalink. "Reset to defaults" (`onReset`) gives back the
 * author's values.
 *
 * Under the controls, one line per parameter whose link value fell back to its default (`fellBack`), and
 * one per parameter the server refused the value of (`invalid`, `ANALYTICS-412`), whose control is also
 * marked invalid. It also shows the stream: "Updating… n of N panels" with a determinate bar, in a polite
 * live region.
 */
export default function FilterStrip({
  params,
  values,
  onChange,
  onReset,
  fellBack = [],
  invalid = [],
  model,
  lang,
  wave,
}: {
  params: readonly Param[]
  values: ParamValues
  onChange: (next: ParamValues) => void
  /** Absent where the strip edits the defaults themselves (the board editor). */
  onReset?: () => void
  fellBack?: readonly string[]
  invalid?: readonly string[]
  model: AnalyticsModel
  lang: string
  wave: StreamWave
}) {
  const { t } = useTranslation('boards')
  const set = (name: string, value: ParamValue) => onChange({ ...values, [name]: value })
  const moved = params.some((p) => movedOff(p, values))
  const labelOf = (name: string) => {
    const p = params.find((x) => x.name === name)
    return p ? paramLabel(p, lang, t) : name
  }
  const notices = [...fellBack.map((name) => ['fellBack', name] as const), ...invalid.map((name) => ['invalid', name] as const)]

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" aria-label={t('board.filters.label')} data-board-filters>
      <div className="flex flex-wrap items-end gap-3">
        {params.map((param) => (
          <ParamControl key={param.name} param={param} value={valueOf(param, values)} onChange={(v) => set(param.name, v)} invalid={invalid.includes(param.name)} model={model} lang={lang} />
        ))}
        {onReset && (
          <div className="ms-auto flex items-end">
            <Button variant="text" onClick={onReset} disabled={!moved} data-board-params-reset>
              <RotateCcw className="size-3.5" aria-hidden />
              {t('board.params.reset')}
            </Button>
          </div>
        )}
      </div>
      {notices.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs" aria-label={t('board.params.notices')}>
          {notices.map(([kind, name]) => (
            <li
              key={`${kind}-${name}`}
              className={'flex items-start gap-1.5 ' + (kind === 'invalid' ? 'text-danger-800' : 'text-muted-foreground')}
              data-board-param-notice={kind}
              data-param={name}
            >
              {kind === 'invalid' ? <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden /> : <Info className="mt-px size-3.5 shrink-0" aria-hidden />}
              <span>
                <Trans t={t} i18nKey={`board.params.${kind}`} values={{ param: labelOf(name) }} components={{ param: <bdi className="font-medium" /> }} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <StreamStatus wave={wave} />
    </section>
  )
}

type ControlData = Record<`data-${string}`, string | undefined>

/** One parameter's control, by its kind (823). */
function ParamControl({
  param,
  value,
  onChange,
  invalid,
  model,
  lang,
}: {
  param: Param
  value: ParamValue
  onChange: (v: ParamValue) => void
  invalid: boolean
  model: AnalyticsModel
  lang: string
}) {
  const { t } = useTranslation('boards')
  const control = stripControlOf(param, model)
  const label = paramLabel(param, lang, t)
  const error = invalid ? t('board.params.invalidField') : undefined
  const data: ControlData = { 'data-board-param': param.name, 'data-board-param-kind': param.kind, 'data-board-param-invalid': invalid ? 'true' : undefined }
  const errorLine = error && <span className="text-xs text-danger-800">{error}</span>

  if (control.kind === 'period') {
    const period = boardPeriodOf(value)
    return period && <PeriodPicker label={label} period={period} onChange={(p) => onChange(periodValue(p))} error={error} data={data} />
  }
  if (value.kind === 'members') {
    if (control.kind !== 'searched' && control.kind !== 'inline' && control.kind !== 'pinned') return null
    const onMembers = (v: string[]) => onChange({ kind: 'members', values: param.multi === false ? v.slice(-1) : v })
    if (control.kind === 'searched') {
      return <MemberPicker name={param.name} label={label} dimension={control.dimension} value={value.values} onChange={onMembers} lang={lang} error={error} data={data} />
    }
    const store = control.dimension === 'store'
    const options: MultiSelectOption[] = control.values.map((v) => {
      const said = saysIn(v.label, lang)
      return { value: v.key, text: said || v.key, machine: store || !said }
    })
    return (
      <div {...data}>
        <Field label={label} className="w-56" error={error}>
          <MultiSelect value={value.values} onChange={onMembers} options={options} label={label} data-testid={`board-filter-${param.name}`} />
        </Field>
      </div>
    )
  }
  if (value.kind === 'grain') {
    const grains = param.grains?.length ? param.grains : GRAINS
    return (
      <div className="flex flex-col gap-1" role="group" aria-label={label} {...data}>
        <span className={FIELD_LABEL} aria-hidden>
          {label}
        </span>
        <div className="flex gap-1">
          {grains.map((g) => (
            <Chip key={g} on={value.grain === g} onClick={() => onChange({ kind: 'grain', grain: g })} data-board-grain={g}>
              {t(`board.params.grain.${g}`)}
            </Chip>
          ))}
        </div>
        {errorLine}
      </div>
    )
  }
  if (value.kind === 'threshold') {
    const measure = measureOf(model, param.measure)
    const measureName = saysIn(measure?.label, lang) || (param.measure ?? '')
    const ops: ThresholdOp[] = param.required ? ['gt', 'gte', 'lt', 'lte'] : ['off', 'gt', 'gte', 'lt', 'lte']
    return (
      <div className="flex items-end gap-1.5" {...data}>
        <Field label={label} className="w-48" error={error}>
          <Select value={value.op} onChange={(e) => onChange({ ...value, op: e.target.value as ThresholdOp })} data-board-threshold-op>
            {ops.map((op) => (
              <option key={op} value={op}>
                {t(`board.params.op.${op}`, { measure: fsi(measureName) })}
              </option>
            ))}
          </Select>
        </Field>
        {value.op !== 'off' && (
          <>
            <NumberInput value={value.value} onCommit={(n) => onChange({ ...value, value: n })} label={t('board.params.thresholdValue')} className="w-20" invalid={invalid} data-board-threshold-value="" />
            {measure?.unit === 'share' && <span className="pb-2 text-xs text-muted-foreground">{t('board.params.percent')}</span>}
          </>
        )}
      </div>
    )
  }
  if (value.kind === 'topN') {
    const step = (d: number) => onChange({ kind: 'topN', n: Math.min(TOP_N_MAX, Math.max(TOP_N_MIN, value.n + d)) })
    return (
      <div className="flex flex-col gap-1" role="group" aria-label={label} {...data}>
        <span className={FIELD_LABEL} aria-hidden>
          {label}
        </span>
        <div className="flex items-center gap-1">
          <IconButton label={t('board.params.fewer')} variant="outlined" onClick={() => step(-1)} disabled={value.n <= TOP_N_MIN} data-board-topn-step="-1">
            <Minus className="size-3.5" aria-hidden />
          </IconButton>
          <NumberInput value={value.n} min={TOP_N_MIN} max={TOP_N_MAX} integer onCommit={(n) => onChange({ kind: 'topN', n })} label={label} className="w-16" invalid={invalid} data-board-topn="" />
          <IconButton label={t('board.params.more')} variant="outlined" onClick={() => step(1)} disabled={value.n >= TOP_N_MAX} data-board-topn-step="1">
            <Plus className="size-3.5" aria-hidden />
          </IconButton>
        </div>
        {errorLine}
      </div>
    )
  }
  if (value.kind === 'measure' || value.kind === 'breakdown') {
    const kind = value.kind
    const nameOf = (key: string) => saysIn((kind === 'measure' ? measureOf(model, key) : dimensionOf(model, key))?.label, lang) || key
    const options = param.options?.length ? param.options : [value.key]
    return (
      <div {...data}>
        <Field label={label} className="w-44" error={error}>
          <Select value={value.key} onChange={(e) => onChange({ kind, key: e.target.value })} data-board-choice={kind}>
            {options.map((key) => (
              <option key={key} value={key}>
                {nameOf(key)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    )
  }
  return null
}

/**
 * A number typed in the display unit (5 for 5 %), committed once it reads as a number in range and the
 * typing pauses — so "15" asks once, not for "1" and then "15". A value set from outside (the stepper,
 * Reset, a link) replaces what is shown.
 */
function NumberInput({
  value,
  onCommit,
  label,
  min,
  max,
  integer = false,
  invalid,
  className,
  ...data
}: { value: number; onCommit: (n: number) => void; label: string; min?: number; max?: number; integer?: boolean; invalid?: boolean; className?: string } & ControlData) {
  const [text, setText] = useState(String(value))
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setText(String(value))
  }
  const commit = useRef(onCommit)
  useEffect(() => {
    commit.current = onCommit
  }, [onCommit])
  useEffect(() => {
    const n = text.trim() === '' ? NaN : Number(text)
    const fits = Number.isFinite(n) && (!integer || Number.isInteger(n)) && (min === undefined || n >= min) && (max === undefined || n <= max)
    if (!fits || n === value) return
    const id = setTimeout(() => commit.current(n), 400)
    return () => clearTimeout(id)
  }, [text, value, min, max, integer])
  return (
    <Input
      type="number"
      dir="ltr"
      inputMode="decimal"
      min={min}
      max={max}
      step={integer ? 1 : 'any'}
      value={text}
      onChange={(e) => setText(e.target.value)}
      aria-label={label}
      aria-invalid={invalid || undefined}
      wrapperClassName={className}
      {...data}
    />
  )
}

function PeriodPicker({ label, period, onChange, error, data }: { label: string; period: BoardPeriod; onChange: (p: BoardPeriod) => void; error?: string; data?: ControlData }) {
  const { t } = useTranslation('boards')
  const today = toIsoDate(new Date())
  const pick = (v: string) =>
    onChange(v === 'fixed' ? { kind: 'fixed', from: period.kind === 'fixed' ? period.from : today, to: period.kind === 'fixed' ? period.to : today } : { kind: 'relative', token: v as PeriodToken })
  // A range is written only when it reads forwards; a half-typed one waits in the inputs.
  const range = (from: string, to: string) => from && to && from <= to && onChange({ kind: 'fixed', from, to })

  return (
    <div className="flex items-end gap-2" {...data}>
      <Field label={label} className="w-44" error={error}>
        <Select value={period.kind === 'fixed' ? 'fixed' : period.token} onChange={(e) => pick(e.target.value)} data-board-filter-period>
          {PERIODS.map((token) => (
            <option key={token} value={token}>
              {t(periodNameKey(token))}
            </option>
          ))}
          <option value="fixed">{t('board.period.fixed')}</option>
        </Select>
      </Field>
      {period.kind === 'fixed' && (
        <>
          <Field label={t('board.filters.from')} className="w-36">
            <Input type="date" dir="ltr" value={period.from} max={period.to} onChange={(e) => range(e.target.value, period.to)} data-board-filter-from />
          </Field>
          <Field label={t('board.filters.to')} className="w-36">
            <Input type="date" dir="ltr" value={period.to} min={period.from} onChange={(e) => range(period.from, e.target.value)} data-board-filter-to />
          </Field>
        </>
      )}
    </div>
  )
}

/** Members from `Analytics/DimensionValues` (city, region, store …), searched on the server (up to 50). */
function MemberPicker({
  name,
  label,
  dimension,
  value,
  onChange,
  lang,
  error,
  data,
}: {
  name: string
  label: string
  dimension: string
  value: string[]
  onChange: (v: string[]) => void
  lang: string
  error?: string
  data?: ControlData
}) {
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setSearch(typed.trim()), 250)
    return () => clearTimeout(id)
  }, [typed])
  const members = useQuery({
    queryKey: analyticsMembersKey(dimension, search),
    queryFn: () => analyticsApi.dimensionValues(dimension, search),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    retry: false,
  })

  // A store reads as `code · name`, one machine pair; a city or region by its name. Every member seen is
  // remembered, so a chosen one keeps its words after a search that no longer lists it.
  const seen = useRef(new Map<string, MultiSelectOption>())
  const options: MultiSelectOption[] = (members.data ?? []).map((m) => {
    const name = saysIn(m.label, lang)
    const o = dimension === 'store' ? { value: m.key, text: name ? formatPair(m.key, name) : m.key, machine: true } : { value: m.key, text: name || m.key }
    seen.current.set(m.key, o)
    return o
  })

  return (
    <div {...data}>
      <Field label={label} className="w-56" error={error}>
        <MultiSelect
          value={value}
          onChange={onChange}
          options={options}
          optionOf={(v) => seen.current.get(v) ?? { value: v, text: v, machine: true }}
          label={label}
          loading={members.isFetching && !members.data}
          failed={!!members.error}
          onQueryChange={setTyped}
          data-testid={`board-filter-${name}`}
        />
      </Field>
    </div>
  )
}

/** "Updating… n of N panels", a determinate bar, and a polite live region that says when they settle. */
function StreamStatus({ wave }: { wave: StreamWave }) {
  const { t } = useTranslation('boards')
  const running = wave.total > 0
  const pct = running ? Math.round((wave.done / wave.total) * 100) : 100
  return (
    <div role="status" aria-live="polite" className="flex min-h-5 items-center gap-3 text-xs text-muted-foreground" data-board-stream={running ? 'running' : 'idle'}>
      {running ? (
        <>
          <span data-board-stream-count={`${wave.done}/${wave.total}`}>
            <Trans t={t} i18nKey="board.stream.updating" values={{ done: wave.done, total: wave.total }} components={{ done: <Ltr />, total: <Ltr /> }} />
          </span>
          <div
            className="h-1 w-40 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={wave.total}
            aria-valuenow={wave.done}
            aria-label={t('board.stream.progress', { done: fsi(wave.done), total: fsi(wave.total) })}
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
        </>
      ) : (
        <span className="sr-only">{t('board.stream.settled')}</span>
      )}
    </div>
  )
}
