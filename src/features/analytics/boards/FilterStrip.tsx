import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import type { AnalyticsModel, BoardPeriod, Param, ParamValue, PeriodToken } from '@/core/models/analytics'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import MultiSelect, { type MultiSelectOption } from '@/core/ui/MultiSelect'
import Select from '@/core/ui/Select'
import { toIsoDate } from '@/core/util/date-format'
import { formatPair, fsi } from '@/core/util/bidi'
import { saysIn } from '@/core/rules/sentence'
import { analyticsApi, analyticsMembersKey } from './api'
import type { StreamWave } from './board'
import { boardPeriodOf, paramLabel, periodValue, stripControlOf, valueOf, type ParamValues } from './params'
import { periodNameKey, PERIODS } from './periods'

/**
 * The board's filter strip (spec 766 §F, ticket 771), rendered from the board's parameters since 819
 * (ticket 821): a period (a relative preset or a fixed range); a `members` parameter searched through
 * `Analytics/DimensionValues`, or picked from the model's inline values. The six ready-made parameters
 * draw exactly v1's six controls. Every change goes to the caller, who writes it to the URL — the
 * permalink. The other kinds get their controls with their tickets.
 *
 * It also shows the stream: "Updating… n of N panels" with a determinate bar, in a polite live region.
 */
export default function FilterStrip({
  params,
  values,
  onChange,
  model,
  lang,
  wave,
}: {
  params: readonly Param[]
  values: ParamValues
  onChange: (next: ParamValues) => void
  model: AnalyticsModel
  lang: string
  wave: StreamWave
}) {
  const { t } = useTranslation('boards')
  const set = (name: string, value: ParamValue) => onChange({ ...values, [name]: value })

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" aria-label={t('board.filters.label')} data-board-filters>
      <div className="flex flex-wrap items-end gap-3">
        {params.map((param) => {
          const control = stripControlOf(param, model)
          const value = valueOf(param, values)
          const label = paramLabel(param, lang, t)
          if (control.kind === 'period') {
            const period = boardPeriodOf(value)
            return period && <PeriodPicker key={param.name} label={label} period={period} onChange={(p) => set(param.name, periodValue(p))} />
          }
          if (control.kind === 'none' || value.kind !== 'members') return null
          const onMembers = (v: string[]) => set(param.name, { kind: 'members', values: v })
          if (control.kind === 'searched') {
            return <MemberPicker key={param.name} name={param.name} label={label} dimension={control.dimension} value={value.values} onChange={onMembers} lang={lang} />
          }
          const options: MultiSelectOption[] = control.values.map((v) => ({ value: v.key, text: saysIn(v.label, lang) || v.key }))
          return (
            <Field key={param.name} label={label} className="w-56">
              <MultiSelect value={value.values} onChange={onMembers} options={options} label={label} data-testid={`board-filter-${param.name}`} />
            </Field>
          )
        })}
      </div>
      <StreamStatus wave={wave} />
    </section>
  )
}

function PeriodPicker({ label, period, onChange }: { label: string; period: BoardPeriod; onChange: (p: BoardPeriod) => void }) {
  const { t } = useTranslation('boards')
  const today = toIsoDate(new Date())
  const pick = (v: string) =>
    onChange(v === 'fixed' ? { kind: 'fixed', from: period.kind === 'fixed' ? period.from : today, to: period.kind === 'fixed' ? period.to : today } : { kind: 'relative', token: v as PeriodToken })
  // A range is written only when it reads forwards; a half-typed one waits in the inputs.
  const range = (from: string, to: string) => from && to && from <= to && onChange({ kind: 'fixed', from, to })

  return (
    <div className="flex items-end gap-2">
      <Field label={label} className="w-44">
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
function MemberPicker({ name, label, dimension, value, onChange, lang }: { name: string; label: string; dimension: string; value: string[]; onChange: (v: string[]) => void; lang: string }) {
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
    <Field label={label} className="w-56">
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
