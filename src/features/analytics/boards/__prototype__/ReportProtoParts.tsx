/* PROTOTYPE — throwaway. Wayfinder ticket 798 (map 793). Never merge.
 *
 * The pieces every designer variant shares: the seven parameter controls, the strip, the
 * parameter / panel / text editors, the binding list, the panel renderer, live-figure text,
 * the summary block, the share dialog, the 411 refusal and the 413 page. The variants differ
 * in WHERE these sit, which is the question.
 */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Settings2, Sparkles, Trash2, TriangleAlert, Lock, Users } from 'lucide-react'
import KpiTile from '@/core/charts/KpiTile'
import SeriesChart from '@/core/charts/SeriesChart'
import TableChart from '@/core/charts/TableChart'
import VerticalBarChart from '@/core/charts/VerticalBarChart'
import { formatValue } from '@/core/charts/format'
import { slotColour } from '@/core/charts/slots'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import MultiSelect, { type MultiSelectOption } from '@/core/ui/MultiSelect'
import Select from '@/core/ui/Select'
import Textarea from '@/core/ui/Textarea'
import { formatPair, fsi } from '@/core/util/bidi'
import { periodNameKey } from '../periods'
import {
  AREAS,
  CATEGORY_DIMENSIONS,
  DIMENSIONS,
  GRAINS,
  MEASURES,
  PARAM_KINDS,
  PROTO_PERIODS,
  RESERVED_NAMES,
  ROLES,
  TOKEN,
  USERS,
  blankParam,
  canBind,
  dimensionOf,
  figureValue,
  figuresOf,
  measureOf,
  panelsOf,
  runPanel,
  say,
  stubSummary,
  type Audience,
  type BindReason,
  type Block,
  type ChartType,
  type Panel,
  type Param,
  type ParamKind,
  type ParamValue,
  type Refusal,
  type Report,
  type Series,
  type ThresholdOp,
  type Values,
  type Words,
} from './report-proto-model'

export function useProto() {
  const { t, i18n } = useTranslation('boards')
  const lang = i18n.language
  const p = (key: string, o?: Record<string, unknown>) => t(`proto798.${key}`, o ?? {}) as string
  return { t, p, lang }
}

export const fmt = (v: number | null, measure: string, lang: string) => formatValue(v, measureOf(measure)?.unit ?? 'count', lang)

const memberText = (dim: string, key: string, lang: string): string => {
  const d = dimensionOf(dim)
  const mm = d?.members.find((x) => x.key === key)
  if (!mm) return key
  return d?.machine ? formatPair(key, say(mm.label, lang)) : say(mm.label, lang)
}
const memberOptions = (dim: string, lang: string, only?: string[] | null): MultiSelectOption[] =>
  (dimensionOf(dim)?.members ?? [])
    .filter((mm) => !only || only.includes(mm.key))
    .map((mm) => ({ value: mm.key, text: memberText(dim, mm.key, lang), machine: dimensionOf(dim)?.machine }))

export const paramLabel = (prm: Param, lang: string) => say(prm.label, lang) || prm.name

// ── One parameter's control (797 §1) ────────────────────────────────────────────────────────

export function ParamControl({ param, value, onChange }: { param: Param; value: ParamValue; onChange: (v: ParamValue) => void }) {
  const { t, p, lang } = useProto()
  const label = paramLabel(param, lang)
  switch (value.kind) {
    case 'period':
      return (
        <Field label={label} className="w-40">
          <Select value={value.token} onChange={(e) => onChange({ kind: 'period', token: e.target.value as typeof value.token })} data-proto-param={param.name}>
            {PROTO_PERIODS.map((tok) => (
              <option key={tok} value={tok}>
                {t(periodNameKey(tok))}
              </option>
            ))}
          </Select>
        </Field>
      )
    case 'members':
      return (
        <Field label={label} className="w-56">
          <MultiSelect
            value={value.values}
            onChange={(v) => onChange({ kind: 'members', values: param.multi === false ? v.slice(-1) : v })}
            options={memberOptions(param.dimension ?? '', lang, param.pinned)}
            label={label}
            data-testid={`proto-param-${param.name}`}
          />
        </Field>
      )
    case 'grain':
      return (
        <Field label={label}>
          <div className="flex gap-1" data-proto-param={param.name}>
            {(param.grains ?? GRAINS).map((g) => (
              <Chip key={g} on={value.grain === g} onClick={() => onChange({ kind: 'grain', grain: g })}>
                {p(`grain.${g}`)}
              </Chip>
            ))}
          </div>
        </Field>
      )
    case 'threshold': {
      const meas = measureOf(param.measure ?? '')
      return (
        <Field label={label}>
          <div className="flex items-center gap-1" data-proto-param={param.name}>
            <Select value={value.op} onChange={(e) => onChange({ ...value, op: e.target.value as ThresholdOp })} className="w-36" aria-label={label}>
              {(['off', 'gt', 'gte', 'lt', 'lte'] as const).map((op) => (
                <option key={op} value={op} disabled={op === 'off' && param.required}>
                  {p(`op.${op}`, { measure: fsi(say(meas?.label, lang)) })}
                </option>
              ))}
            </Select>
            {value.op !== 'off' && (
              <>
                <Input type="number" dir="ltr" className="w-20" value={value.value} onChange={(e) => onChange({ ...value, value: Number(e.target.value) })} aria-label={p('threshold.number')} />
                {meas?.unit === 'share' && <span className="text-xs text-muted-foreground">%</span>}
              </>
            )}
          </div>
        </Field>
      )
    }
    case 'topN':
      return (
        <Field label={label} className="w-28">
          <Input type="number" dir="ltr" min={1} max={100} value={value.n} onChange={(e) => onChange({ kind: 'topN', n: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} data-proto-param={param.name} />
        </Field>
      )
    case 'measure':
      return (
        <Field label={label} className="w-44">
          <Select value={value.key} onChange={(e) => onChange({ kind: 'measure', key: e.target.value })} data-proto-param={param.name}>
            {(param.options ?? []).map((o) => (
              <option key={o} value={o}>
                {say(measureOf(o)?.label, lang)}
              </option>
            ))}
          </Select>
        </Field>
      )
    case 'breakdown':
      return (
        <Field label={label} className="w-40">
          <Select value={value.key} onChange={(e) => onChange({ kind: 'breakdown', key: e.target.value })} data-proto-param={param.name}>
            {(param.options ?? []).map((o) => (
              <option key={o} value={o}>
                {say(dimensionOf(o)?.label, lang)}
              </option>
            ))}
          </Select>
        </Field>
      )
  }
}

// ── The one strip (797 §6) ──────────────────────────────────────────────────────────────────

export function ParamStrip({
  report,
  values,
  onValue,
  onReset,
  design,
}: {
  report: Report
  values: Values
  onValue: (name: string, v: ParamValue) => void
  onReset?: () => void
  design?: { selected: string | null; onEdit: (name: string) => void; onAdd: () => void }
}) {
  const { p } = useProto()
  return (
    <section className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card p-3" aria-label={p('strip.label')} data-proto-strip>
      {report.params.map((prm) => (
        <div key={prm.name} className={`flex items-end gap-0.5 rounded-md ${design?.selected === `param:${prm.name}` ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}>
          <ParamControl param={prm} value={values[prm.name] ?? prm.default} onChange={(v) => onValue(prm.name, v)} />
          {design && (
            <IconButton label={p('strip.edit', { name: fsi(prm.name) })} size="compact" onClick={() => design.onEdit(prm.name)} data-proto-edit-param={prm.name}>
              <Settings2 className="size-3.5" />
            </IconButton>
          )}
        </div>
      ))}
      <div className="ms-auto flex items-end gap-2">
        {design && (
          <Button variant="outlined" onClick={design.onAdd} data-proto-add-param>
            <Plus className="size-3.5" />
            {p('strip.add')}
          </Button>
        )}
        {onReset && (
          <Button variant="text" onClick={onReset}>
            {p('strip.reset')}
          </Button>
        )}
      </div>
    </section>
  )
}

// ── Words in two languages (801: the author's words are data in English and Arabic) ─────────

export function WordsFields({ label, value, onChange, area = false }: { label: string; value: Words; onChange: (w: Words) => void; area?: boolean }) {
  const { p } = useProto()
  const C = area ? Textarea : Input
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={p('words.en', { label: fsi(label) })}>
        <C dir="ltr" lang="en" value={value.en} onChange={(e: { target: { value: string } }) => onChange({ ...value, en: e.target.value })} rows={area ? 4 : undefined} />
      </Field>
      <Field label={p('words.ar', { label: fsi(label) })}>
        <C dir="rtl" lang="ar" value={value.ar} onChange={(e: { target: { value: string } }) => onChange({ ...value, ar: e.target.value })} rows={area ? 4 : undefined} />
      </Field>
    </div>
  )
}

// ── Declaring a parameter (797) ─────────────────────────────────────────────────────────────

export function nameProblem(report: Report, prm: Param, original: string | null): string | null {
  if (RESERVED_NAMES.includes(prm.name)) return 'reserved'
  if (!/^[a-z][a-z0-9-]*$/.test(prm.name)) return 'slug'
  if (report.params.some((x) => x.name === prm.name && x.name !== original)) return 'duplicate'
  return null
}

export function ParamEditor({
  report,
  param,
  original,
  onParam,
  bindings,
  onBindings,
  onDelete,
  compact = false,
}: {
  report: Report
  param: Param
  /** The saved name, or null for a new parameter (its kind can still change). */
  original: string | null
  onParam: (next: Param) => void
  bindings: Record<string, string | true>
  onBindings: (next: Record<string, string | true>) => void
  onDelete?: () => void
  compact?: boolean
}) {
  const { p } = useProto()
  const problem = nameProblem(report, param, original)
  const kindRow = (
    <Field label={p('param.kind')}>
      {original === null ? (
        <div className="flex flex-wrap gap-1" data-proto-kind-picker>
          {PARAM_KINDS.map((k) => (
            <Chip key={k} on={param.kind === k} onClick={() => onParam({ ...blankParam(k, report.params.map((x) => x.name)), label: param.label })}>
              {p(`kind.${k}`)}
            </Chip>
          ))}
        </div>
      ) : (
        <p className="text-sm">
          {p(`kind.${param.kind}`)}
          {param.readyMade && <span className="ms-2 text-xs text-muted-foreground">{p('param.readyMade')}</span>}
        </p>
      )}
    </Field>
  )
  return (
    <div className="flex flex-col gap-4" data-proto-param-editor={param.name}>
      {kindRow}
      <p className="-mt-2 text-xs text-muted-foreground">{p(`kindHint.${param.kind}`)}</p>
      <div className={compact ? 'flex flex-col gap-3' : 'grid grid-cols-[12rem_1fr] gap-3'}>
        <Field label={p('param.name')} hint={p('param.nameHint', { name: fsi(param.name) })} error={problem ? p(`param.nameProblem.${problem}`) : undefined}>
          <Input dir="ltr" value={param.name} onChange={(e) => onParam({ ...param, name: e.target.value })} data-proto-param-name />
        </Field>
        <WordsFields label={p('param.label')} value={param.label} onChange={(label) => onParam({ ...param, label })} />
      </div>
      <KindFields param={param} onParam={onParam} />
      <div className="flex flex-wrap items-end gap-4 rounded-md bg-muted/50 p-3">
        <ParamControl param={param} value={param.default} onChange={(d) => onParam({ ...param, default: d })} />
        <Chip on={param.required} onClick={() => onParam({ ...param, required: !param.required })}>
          {p('param.required')}
        </Chip>
        <p className="basis-full text-xs text-muted-foreground">{p('param.defaultHint')}</p>
      </div>
      <BindingList report={report} param={param} bindings={bindings} onBindings={onBindings} />
      {onDelete && (
        <div>
          <Button variant="danger-outlined" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            {p('param.remove')}
          </Button>
          {param.readyMade && <p className="mt-1 text-xs text-muted-foreground">{p('param.removeReadyMade')}</p>}
        </div>
      )}
    </div>
  )
}

function KindFields({ param, onParam }: { param: Param; onParam: (next: Param) => void }) {
  const { p, lang } = useProto()
  switch (param.kind) {
    case 'members':
      return (
        <div className="flex flex-wrap items-end gap-3">
          <Field label={p('param.dimension')} className="w-44">
            <Select value={param.dimension} onChange={(e) => onParam({ ...param, dimension: e.target.value, pinned: null, default: { kind: 'members', values: [] } })}>
              {DIMENSIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {say(d.label, lang)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={p('param.choices')}>
            <div className="flex gap-1">
              <Chip on={param.pinned === null} onClick={() => onParam({ ...param, pinned: null })}>
                {p('param.openSearch')}
              </Chip>
              <Chip on={param.pinned !== null} onClick={() => onParam({ ...param, pinned: [] })}>
                {p('param.pinnedList')}
              </Chip>
            </div>
          </Field>
          {param.pinned !== null && (
            <Field label={p('param.pinned')} className="w-72">
              <MultiSelect value={param.pinned ?? []} onChange={(v) => onParam({ ...param, pinned: v })} options={memberOptions(param.dimension ?? '', lang)} label={p('param.pinned')} />
            </Field>
          )}
          <Chip on={param.multi !== false} onClick={() => onParam({ ...param, multi: param.multi === false })}>
            {p('param.multi')}
          </Chip>
        </div>
      )
    case 'grain':
      return (
        <Field label={p('param.allowedGrains')}>
          <div className="flex gap-1">
            {GRAINS.map((g) => {
              const on = (param.grains ?? []).includes(g)
              return (
                <Chip key={g} on={on} onClick={() => onParam({ ...param, grains: on ? (param.grains ?? []).filter((x) => x !== g) : [...(param.grains ?? []), g] })}>
                  {p(`grain.${g}`)}
                </Chip>
              )
            })}
          </div>
        </Field>
      )
    case 'threshold':
      return (
        <Field label={p('param.thresholdMeasure')} hint={p('param.thresholdHint')} className="w-72">
          <Select value={param.measure} onChange={(e) => onParam({ ...param, measure: e.target.value })}>
            {MEASURES.map((mm) => (
              <option key={mm.key} value={mm.key}>
                {say(mm.label, lang)}
              </option>
            ))}
          </Select>
        </Field>
      )
    case 'measure':
      return (
        <Field label={p('param.options')} hint={p('param.optionsHint')} className="w-96">
          <MultiSelect
            value={param.options ?? []}
            onChange={(v) => onParam({ ...param, options: v, default: { kind: 'measure', key: v.includes((param.default as { key: string }).key) ? (param.default as { key: string }).key : (v[0] ?? '') } })}
            options={MEASURES.map((mm) => ({ value: mm.key, text: say(mm.label, lang) }))}
            label={p('param.options')}
          />
        </Field>
      )
    case 'breakdown':
      return (
        <Field label={p('param.options')} hint={p('param.optionsHint')} className="w-96">
          <MultiSelect
            value={param.options ?? []}
            onChange={(v) => onParam({ ...param, options: v, default: { kind: 'breakdown', key: v.includes((param.default as { key: string }).key) ? (param.default as { key: string }).key : (v[0] ?? '') } })}
            options={DIMENSIONS.map((d) => ({ value: d.key, text: say(d.label, lang) }))}
            label={p('param.options')}
          />
        </Field>
      )
    default:
      return null
  }
}

/** Every panel in the report: bound (and, for members, to which dimension), or why it cannot be. */
export function BindingList({ report, param, bindings, onBindings }: { report: Report; param: Param; bindings: Record<string, string | true>; onBindings: (next: Record<string, string | true>) => void }) {
  const { p, lang } = useProto()
  return (
    <fieldset className="flex flex-col gap-1.5 rounded-md border border-border p-3" data-proto-bindings={param.name}>
      <legend className="px-1 text-xs font-medium text-muted-foreground">{p('bind.title')}</legend>
      <p className="text-xs text-muted-foreground">{p('bind.hint')}</p>
      {panelsOf(report).map((panel) => {
        const bound = bindings[panel.id]
        const check = canBind(param, panel, typeof bound === 'string' ? bound : undefined)
        const fresh = canBind(param, panel)
        const toggle = () => {
          const next = { ...bindings }
          if (bound !== undefined) delete next[panel.id]
          else if (fresh.ok) next[panel.id] = fresh.target ?? true
          onBindings(next)
        }
        return (
          <div key={panel.id} className="flex flex-wrap items-center gap-2" data-proto-binding={panel.id}>
            <Chip on={bound !== undefined} onClick={toggle} disabled={!fresh.ok && bound === undefined} className="max-w-[22rem]">
              <bdi className="truncate">{say(panel.title, lang)}</bdi>
            </Chip>
            {param.kind === 'members' && bound !== undefined && (
              <Select
                value={typeof bound === 'string' ? bound : ''}
                onChange={(e) => onBindings({ ...bindings, [panel.id]: e.target.value })}
                className="w-40"
                aria-label={p('bind.target')}
              >
                {CATEGORY_DIMENSIONS.map((d) => (
                  <option key={d} value={d} disabled={!canBind(param, panel, d).ok}>
                    {p('bind.filters', { dimension: fsi(say(dimensionOf(d)?.label, lang)) })}
                  </option>
                ))}
              </Select>
            )}
            {bound !== undefined && !check.ok && <span className="text-xs text-danger-800">{p(`reason.${check.reason}`)}</span>}
            {bound === undefined && !fresh.ok && <span className="text-xs text-muted-foreground">{p(`reason.${fresh.reason}`)}</span>}
          </div>
        )
      })}
    </fieldset>
  )
}

// ── The panel editor (one inline panel: 801 §2, named series: 799 §2) ───────────────────────

export function PanelEditor({ report, panel, onPanel, onBind }: { report: Report; panel: Panel; onPanel: (next: Panel) => void; onBind: (param: string, panelId: string, on: boolean) => void }) {
  const { p, lang } = useProto()
  const areaMeasures = MEASURES.filter((mm) => mm.areas.includes(panel.area))
  const setSeries = (series: Series[]) => onPanel({ ...panel, series })
  const nextId = () => {
    for (let i = 1; ; i++) if (!panel.series.some((s) => s.id === `s${i}`)) return `s${i}`
  }
  return (
    <div className="flex flex-col gap-4" data-proto-panel-editor={panel.id}>
      {panel.from && (
        <div className="rounded-md border border-attention-border bg-attention-050 p-2 text-xs text-attention-800" data-proto-provenance>
          <p>{p('panel.from', { view: fsi(say(panel.from.view, lang)), revision: fsi(panel.from.revision) })}</p>
          {panel.from.changed && <p className="mt-1 font-medium">{p('panel.fromChanged')}</p>}
        </div>
      )}
      <WordsFields label={p('panel.title')} value={panel.title} onChange={(title) => onPanel({ ...panel, title })} />
      <div className="flex flex-wrap items-end gap-3">
        <Field label={p('panel.area')} className="w-60">
          <Select value={panel.area} onChange={(e) => onPanel({ ...panel, area: e.target.value as Panel['area'], measures: [] })}>
            {AREAS.map((a) => (
              <option key={a.key} value={a.key}>
                {say(a.label, lang)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={p('panel.measures')} className="w-80">
          <MultiSelect value={panel.measures} onChange={(v) => onPanel({ ...panel, measures: v })} options={areaMeasures.map((mm) => ({ value: mm.key, text: say(mm.label, lang) }))} label={p('panel.measures')} />
        </Field>
        <Field label={p('panel.axis')} className="w-44">
          <Select value={panel.axis ?? ''} onChange={(e) => onPanel({ ...panel, axis: e.target.value || null })}>
            <option value="">{p('panel.axisNone')}</option>
            <option value="date">{p('panel.axisDate')}</option>
            {DIMENSIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {say(d.label, lang)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={p('panel.chart')}>
        <div className="flex gap-1">
          {(['bar', 'line', 'kpi', 'table'] as ChartType[]).map((c) => (
            <Chip key={c} on={panel.chart === c} onClick={() => onPanel({ ...panel, chart: c })}>
              {p(`chart.${c}`)}
            </Chip>
          ))}
        </div>
      </Field>

      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3" data-proto-series>
        <legend className="px-1 text-xs font-medium text-muted-foreground">{p('series.title')}</legend>
        <p className="text-xs text-muted-foreground">{p('series.hint')}</p>
        {panel.series.map((s, i) => (
          <div key={s.id} className="flex flex-col gap-2 rounded-md bg-muted/40 p-2" data-proto-series-row={s.id}>
            <div className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-sm" style={{ background: slotColour(i) }} aria-hidden />
              <div className="flex-1">
                <WordsFields label={p('series.label')} value={s.label} onChange={(label) => setSeries(panel.series.map((x) => (x.id === s.id ? { ...x, label } : x)))} />
              </div>
              <IconButton label={p('series.remove')} variant="danger" onClick={() => setSeries(panel.series.filter((x) => x.id !== s.id))}>
                <Trash2 className="size-3.5" />
              </IconButton>
            </div>
            {s.filters.map((f, fi) => (
              <div key={fi} className="flex flex-wrap items-end gap-2 ps-5">
                <Field label={p('series.where')} className="w-40">
                  <Select
                    value={f.dimension}
                    onChange={(e) => setSeries(panel.series.map((x) => (x.id === s.id ? { ...x, filters: x.filters.map((y, yi) => (yi === fi ? { dimension: e.target.value, values: [] } : y)) } : x)))}
                  >
                    {DIMENSIONS.map((d) => (
                      <option key={d.key} value={d.key}>
                        {say(d.label, lang)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={p('series.is')} className="w-64">
                  <MultiSelect
                    value={f.values}
                    onChange={(v) => setSeries(panel.series.map((x) => (x.id === s.id ? { ...x, filters: x.filters.map((y, yi) => (yi === fi ? { ...y, values: v } : y)) } : x)))}
                    options={memberOptions(f.dimension, lang)}
                    label={p('series.is')}
                  />
                </Field>
              </div>
            ))}
            <div className="ps-5">
              <Button variant="text" onClick={() => setSeries(panel.series.map((x) => (x.id === s.id ? { ...x, filters: [...x.filters, { dimension: 'city', values: [] }] } : x)))}>
                <Plus className="size-3.5" />
                {p('series.addFilter')}
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button
            variant="outlined"
            disabled={panel.series.length >= 4}
            title={panel.series.length >= 4 ? p('series.max') : undefined}
            onClick={() => setSeries([...panel.series, { id: nextId(), label: { en: '', ar: '' }, filters: [{ dimension: 'channel', values: [] }] }])}
            data-proto-add-series
          >
            <Plus className="size-3.5" />
            {p('series.add', { n: fsi(panel.series.length), max: fsi(4) })}
          </Button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">{p('panel.params')}</legend>
        {report.params.map((prm) => {
          const bound = report.bindings[prm.name]?.[panel.id] !== undefined
          const c = canBind(prm, panel)
          return (
            <div key={prm.name} className="flex items-center gap-2">
              <Chip on={bound} disabled={!c.ok && !bound} onClick={() => onBind(prm.name, panel.id, !bound)}>
                {paramLabel(prm, lang)}
              </Chip>
              {!c.ok && <span className="text-xs text-muted-foreground">{p(`reason.${c.reason}`)}</span>}
            </div>
          )
        })}
      </fieldset>
    </div>
  )
}

// ── Text with live figures (801 §3) ─────────────────────────────────────────────────────────

export function TextEditor({ report, values, text, onText }: { report: Report; values: Values; text: Words; onText: (w: Words) => void }) {
  const { p, lang } = useProto()
  const [into, setInto] = useState<'en' | 'ar'>(lang.startsWith('ar') ? 'ar' : 'en')
  const figures = panelsOf(report).flatMap((panel) => figuresOf(panel).map((f) => ({ token: `{${panel.id}:${f.figure}}`, panel, f })))
  return (
    <div className="flex flex-col gap-3" data-proto-text-editor>
      <WordsFields label={p('text.words')} value={text} onChange={onText} area />
      <div className="flex flex-wrap items-end gap-2">
        <Field label={p('text.insert')} className="w-96">
          <Select
            value=""
            onChange={(e) => {
              if (!e.target.value) return
              onText({ ...text, [into]: `${text[into]} ${e.target.value}`.trim() })
            }}
            data-proto-insert-figure
          >
            <option value="">{p('text.pick')}</option>
            {figures.map(({ token, panel, f }) => (
              <option key={token} value={token}>
                {fsi(formatPair(say(panel.title, lang), say(f.label, lang)))}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={p('text.into')}>
          <div className="flex gap-1">
            <Chip on={into === 'en'} onClick={() => setInto('en')}>
              {p('text.intoEn')}
            </Chip>
            <Chip on={into === 'ar'} onClick={() => setInto('ar')}>
              {p('text.intoAr')}
            </Chip>
          </div>
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">{p('text.hint')}</p>
      <div className="rounded-md border border-dashed border-border p-3">
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">{p('text.preview')}</p>
        <LiveText report={report} values={values} text={text} design />
      </div>
    </div>
  )
}

export function LiveText({ report, values, text, design = false }: { report: Report; values: Values; text: Words; design?: boolean }) {
  const { p, lang } = useProto()
  const words = say(text, lang)
  const parts: ReactNode[] = []
  let last = 0
  for (const x of words.matchAll(TOKEN)) {
    parts.push(words.slice(last, x.index))
    const fv = figureValue(report, values, x[1], x[2])
    parts.push(
      fv ? (
        <span key={x.index} className={design ? 'rounded bg-primary-050 px-0.5 text-primary-800' : 'font-semibold'} title={design ? p('text.figureTitle', { token: fsi(x[0]) }) : undefined} data-proto-figure={x[0]}>
          <Ltr>{fmt(fv.value, fv.measure, lang)}</Ltr>
        </span>
      ) : (
        <span key={x.index} className="rounded bg-danger-050 px-0.5 text-danger-800" data-proto-figure-missing={x[0]}>
          {p('text.missing')} <Ltr>{x[0]}</Ltr>
        </span>
      ),
    )
    last = (x.index ?? 0) + x[0].length
  }
  parts.push(words.slice(last))
  return (
    <p className="leading-7">
      <bdi>{parts}</bdi>
    </p>
  )
}

// ── The summary block (801 §3) ──────────────────────────────────────────────────────────────

export function SummaryBlock({ report, values, failed, design = false }: { report: Report; values: Values; failed: boolean; design?: boolean }) {
  const { p, lang } = useProto()
  const text = failed ? null : stubSummary(report, values, lang, (v, mm) => fmt(v, mm, lang))
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3" data-proto-summary={text ? 'written' : 'unavailable'}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5" />
        {p('summary.title')}
      </p>
      {text ? (
        <>
          <p className="leading-7">
            <bdi>{text}</bdi>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">{p('summary.checked')}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">{p('summary.unavailable')}</p>
      )}
      {design && <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">{p('summary.design')}</p>}
    </div>
  )
}

// ── One panel, run (797 §4: a parameter that does not reach says so) ────────────────────────

export function PanelView({ report, panel, values, design = false }: { report: Report; panel: Panel; values: Values; design?: boolean }) {
  const { p, lang } = useProto()
  const res = runPanel(report, panel, values)
  const title = say(panel.title, lang)
  const unit = measureOf(res.measures[0])?.unit ?? 'count'
  const xLabel = (x: string) => (res.axis && res.axis !== 'date' ? memberText(res.axis, x, lang) : x)
  const notReached = res.notReached.filter((n) => n.reason !== 'unbound' || design)

  let body: ReactNode
  if (res.rows.length === 0) body = <p className="py-10 text-center text-sm text-muted-foreground">{p('panel.empty')}</p>
  else if (panel.chart === 'kpi')
    body = (
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${res.keys.length}, minmax(0, 1fr))` }}>
        {res.keys.map((k, i) => (
          <div key={k.key} className="border-t-4 pt-1" style={{ borderColor: slotColour(i) }}>
            <KpiTile measureLabel={say(k.label, lang)} value={res.overall[k.key]} previous={null} delta={null} spark={[]} unit={measureOf(k.measure)?.unit ?? 'count'} format={measureOf(k.measure)?.format ?? 'auto'} locale={lang} />
          </div>
        ))}
      </div>
    )
  else if (panel.chart === 'table')
    body = (
      <div className="h-72">
        <TableChart
          columns={[
            { key: 'x', role: 'dimension', label: say(dimensionOf(res.axis ?? '')?.label, lang) },
            ...res.keys.map((k) => ({ key: k.key, role: 'measure' as const, label: say(k.label, lang), unit: measureOf(k.measure)?.unit })),
          ]}
          rows={res.rows.map((r) => ({ x: xLabel(r.x), ...r.values }))}
          sort={null}
          locale={lang}
          ariaLabel={title}
        />
      </div>
    )
  else if (panel.chart === 'bar' && panel.series.length === 0 && res.keys.length === 1 && res.axis !== 'date')
    body = (
      <VerticalBarChart
        points={res.rows.map((r) => ({ member: r.x, label: xLabel(r.x), value: r.values[res.keys[0].key], slot: null }))}
        colourBy="single"
        unit={unit}
        measureLabel={say(res.keys[0].label, lang)}
        locale={lang}
        ariaLabel={title}
        height={240}
      />
    )
  else
    body = (
      <SeriesChart
        form={panel.chart === 'line' ? 'line' : 'bar'}
        stacking={panel.chart === 'bar' ? 'grouped' : 'none'}
        series={res.keys.map((k, i) => ({ key: k.key, label: say(k.label, lang), slot: i, other: false, unit: measureOf(k.measure)?.unit ?? 'count' }))}
        rows={res.rows.map((r) => ({ x: r.x, label: xLabel(r.x), values: r.values, slot: null }))}
        colourBy="single"
        unit={unit}
        format={measureOf(res.measures[0])?.format ?? 'auto'}
        locale={lang}
        ariaLabel={title}
        height={240}
      />
    )

  return (
    <figure className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 [break-inside:avoid]" data-proto-panel={panel.id}>
      <figcaption className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">
          <bdi>{title}</bdi>
        </span>
        <span className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
          <span>{say(AREAS.find((a) => a.key === panel.area)?.label, lang)}</span>
          {res.topN !== undefined && <span>{p('panel.topN', { n: fsi(res.topN) })}</span>}
          {res.threshold && (
            <span>{p(`panel.threshold.${res.threshold.op}`, { measure: fsi(say(measureOf(res.threshold.measure)?.label, lang)), value: fsi(fmt(measureOf(res.threshold.measure)?.unit === 'share' ? res.threshold.value / 100 : res.threshold.value, res.threshold.measure, lang)) })}</span>
          )}
          {design && panel.from && <span>{p('panel.fromShort', { view: fsi(say(panel.from.view, lang)) })}</span>}
        </span>
      </figcaption>
      {body}
      {notReached.length > 0 && (
        <p className="text-[11px] text-muted-foreground" data-proto-not-reached>
          {p('panel.notReached')}{' '}
          {notReached.map((n, i) => (
            <span key={n.param.name}>
              {i > 0 && ' · '}
              <span className="font-medium">{paramLabel(n.param, lang)}</span> ({p(n.reason === 'unbound' ? 'reason.unbound' : `reason.${n.reason}`)})
            </span>
          ))}
        </p>
      )}
      {panel.caveat && (
        <p className="text-[11px] text-muted-foreground">
          <TriangleAlert className="me-1 inline size-3" />
          <bdi>{say(panel.caveat, lang)}</bdi>
        </p>
      )}
    </figure>
  )
}

// ── The report, top to bottom (801 §1) ──────────────────────────────────────────────────────

export function BlockView({ report, values, block, failedSummary, design }: { report: Report; values: Values; block: Block; failedSummary: boolean; design?: boolean }) {
  if (block.kind === 'panel') return <PanelView report={report} panel={block.panel} values={values} design={design} />
  if (block.kind === 'text') return <LiveText report={report} values={values} text={block.text} design={design} />
  return <SummaryBlock report={report} values={values} failed={failedSummary} design={design} />
}

export function ReportBody({
  report,
  values,
  failedSummary,
  design = false,
  sectionTools,
  blockFrame,
  afterSection,
}: {
  report: Report
  values: Values
  failedSummary: boolean
  design?: boolean
  sectionTools?: (sectionId: string) => ReactNode
  /** A variant may wrap each block (selection ring, tools). */
  blockFrame?: (sectionId: string, block: Block, rendered: ReactNode) => ReactNode
  afterSection?: (sectionId: string) => ReactNode
}) {
  const { lang } = useProto()
  return (
    <div className="flex flex-col gap-6">
      {report.sections.map((s) => (
        <section key={s.id} className="flex flex-col gap-3" data-proto-section={s.id}>
          <div className="flex items-center gap-2 border-b border-border pb-1">
            <h2 className="text-lg font-semibold">
              <bdi>{say(s.heading, lang)}</bdi>
            </h2>
            {sectionTools?.(s.id)}
          </div>
          {s.blocks.map((b) => {
            const rendered = <BlockView report={report} values={values} block={b} failedSummary={failedSummary} design={design} />
            return <div key={b.id}>{blockFrame ? blockFrame(s.id, b, rendered) : rendered}</div>
          })}
          {afterSection?.(s.id)}
        </section>
      ))}
    </div>
  )
}

// ── Share with teams (794) ──────────────────────────────────────────────────────────────────

export function ShareDialog({ report, onClose, onShare }: { report: Report; onClose: () => void; onShare: (a: Audience) => void }) {
  const { p, lang } = useProto()
  const [a, setA] = useState<Audience>(report.audience)
  return (
    <Modal
      open
      onClose={onClose}
      title={p('share.title', { title: fsi(say(report.title, lang)) })}
      width="38rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {p('share.cancel')}
          </Button>
          <Button onClick={() => onShare(a)} disabled={!a.everyone && a.roles.length === 0 && a.users.length === 0} data-proto-share-save>
            {p('share.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-proto-share>
        <Field label={p('share.who')}>
          <div className="flex gap-1">
            <Chip on={a.everyone} onClick={() => setA({ ...a, everyone: true })}>
              {p('share.everyone')}
            </Chip>
            <Chip on={!a.everyone} onClick={() => setA({ ...a, everyone: false })}>
              {p('share.chosen')}
            </Chip>
          </div>
        </Field>
        {!a.everyone && (
          <>
            <Field label={p('share.roles')} hint={p('share.rolesHint')}>
              <MultiSelect
                value={a.roles}
                onChange={(roles) => setA({ ...a, roles })}
                options={ROLES.map((r) => ({ value: r.key, text: say(r.label, lang), tone: r.removed ? 'danger' : 'default', note: r.removed ? p('share.removedRole') : undefined }))}
                label={p('share.roles')}
                data-testid="proto-share-roles"
              />
            </Field>
            <Field label={p('share.people')}>
              <MultiSelect
                value={a.users}
                onChange={(users) => setA({ ...a, users })}
                options={USERS.map((u) => ({ value: u.key, text: formatPair(u.key, u.name), machine: true }))}
                label={p('share.people')}
              />
            </Field>
          </>
        )}
        <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-3 text-xs">
          <div>
            <p className="mb-1 flex items-center gap-1 font-medium">
              <Users className="size-3.5" />
              {p('share.canTitle')}
            </p>
            <ul className="list-disc ps-4 text-muted-foreground">
              {['run', 'params', 'export', 'link'].map((k) => (
                <li key={k}>{p(`share.can.${k}`)}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 font-medium">
              <Lock className="size-3.5" />
              {p('share.cannotTitle')}
            </p>
            <ul className="list-disc ps-4 text-muted-foreground">
              {['edit', 'ai', 'copy'].map((k) => (
                <li key={k}>{p(`share.cannot.${k}`)}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{p('share.history')}</p>
      </div>
    </Modal>
  )
}

export function AudienceChip({ audience }: { audience: Audience }) {
  const { p, lang } = useProto()
  if (!audience.everyone && audience.roles.length + audience.users.length === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]" data-proto-audience>
        <Lock className="size-3" />
        {p('tier.private')}
      </span>
    )
  const names = audience.everyone
    ? p('share.everyone')
    : [...audience.roles.map((r) => say(ROLES.find((x) => x.key === r)?.label, lang)), ...audience.users.map((u) => USERS.find((x) => x.key === u)?.name ?? u)].join(lang.startsWith('ar') ? '، ' : ', ')
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]" data-proto-audience>
      <Users className="size-3" />
      {p('tier.shared')} · <bdi>{names}</bdi>
    </span>
  )
}

// ── Refusals: ANALYTICS-411 at save, 413 not shared (794 §7) ────────────────────────────────

export function RefusalList({ report, refusals, onClose }: { report: Report; refusals: Refusal[]; onClose: () => void }) {
  const { p, lang } = useProto()
  const panelTitle = (id: string) => say(panelsOf(report).find((x) => x.id === id)?.title, lang) || id
  const paramName = (name: string) => {
    const prm = report.params.find((x) => x.name === name)
    return prm ? paramLabel(prm, lang) : name
  }
  return (
    <div role="alert" className="rounded-lg border border-danger-border bg-danger-050 p-3 text-sm text-danger-800" data-proto-refused>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">
          {p('refused.title')} <Ltr>ANALYTICS-411</Ltr>
        </p>
        <Button variant="text" onClick={onClose}>
          {p('refused.close')}
        </Button>
      </div>
      <ul className="mt-1 list-disc ps-5">
        {refusals.map((r, i) => (
          <li key={i}>
            {r.what === 'name' && p(`refused.name.${r.why}`, { param: fsi(r.param) })}
            {r.what === 'binding' && p('refused.binding', { param: fsi(paramName(r.param)), panel: fsi(panelTitle(r.panel)), reason: p(`reason.${r.reason}`) })}
            {r.what === 'figure' && p('refused.figure', { token: fsi(r.token) })}
            {r.what === 'series' && p(`refused.series.${r.why}`, { panel: fsi(panelTitle(r.panel)) })}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">{p('refused.kept')}</p>
    </div>
  )
}

export function NotShared({ owner }: { owner: string }) {
  const { p } = useProto()
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-2 rounded-lg border border-border bg-card p-8 text-center" data-proto-413>
      <Lock className="size-6 text-muted-foreground" />
      <h1 className="text-lg font-semibold">{p('notShared.title')}</h1>
      <p className="text-sm text-muted-foreground">{p('notShared.ask', { owner: fsi(owner) })}</p>
      <p className="text-xs text-muted-foreground">
        <Ltr>ANALYTICS-413</Ltr>
      </p>
    </div>
  )
}

export type BindReasonKey = BindReason
export type { ParamKind }
