import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Trash2, X } from 'lucide-react'
import type { AnalyticsModel, Grain, Param, ParamKind } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field, { FIELD_LABEL } from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import MultiSelect from '@/core/ui/MultiSelect'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { bind, blankParam, canBind, changeParam, nameProblem, overview, type BindPanel, type Declarations } from './bindings'
import { GRAINS } from './editor'
import { ParamControl } from './FilterStrip'
import { paramLabel, readyMadeLabelKey } from './params'
import { dimensionOf } from './wire'

/**
 * The parameter inspector (spec 819 §E, 798 item 5; ticket 824): a pane on the end side, never a modal.
 * Declaring goes kind (with its hint) → the name, checked live → the label in English and Arabic → the
 * kind's fields → the default, set with the viewer's own control → "Viewers can't clear it" → "Applies to",
 * pre-filled, with the reason for each panel that can't take it. Under it, the binding overview: every
 * parameter against every panel. Each change goes to the caller as the item's new declarations
 * (`./bindings`); the caller keeps the item's state.
 */

export const PARAM_KINDS: readonly ParamKind[] = ['period', 'members', 'grain', 'threshold', 'topN', 'measure', 'breakdown']

/** A panel the inspector binds to: the binding module's panel, and its title in the screen's language. */
export interface InspectorPanel extends BindPanel {
  title: string
}

/** A field the inspector should take the author to (a 411 problem, `at` so the same one can be asked twice). */
export interface InspectorFocus {
  field: 'name' | 'binding' | 'default'
  panel?: string
  at: number
}

export default function ParamInspector({
  decl,
  name,
  fresh,
  panels,
  model,
  lang,
  focus,
  onChange,
  onSelect,
  onRemove,
  onClose,
}: {
  decl: Declarations
  name: string
  /** A parameter declared in this sitting: its kind may still change. */
  fresh: boolean
  panels: readonly InspectorPanel[]
  model: AnalyticsModel
  lang: string
  focus: InspectorFocus | null
  /** The new declarations, and the parameter's name in them (a rename moves the selection). */
  onChange: (next: Declarations, name: string) => void
  onSelect: (name: string) => void
  onRemove: () => void
  onClose: () => void
}) {
  const { t } = useTranslation('boards')
  const root = useRef<HTMLElement>(null)
  const param = decl.params.find((p) => p.name === name)
  const [draft, setDraft] = useState(name)
  useEffect(() => setDraft(name), [name])

  useEffect(() => {
    if (!focus) return
    const sel = focus.field === 'binding' ? `[data-param-binding="${CSS.escape(focus.panel ?? '')}"]` : `[data-param-field="${focus.field}"]`
    const at = root.current?.querySelector<HTMLElement>(sel)
    const el = at?.matches('input, button, select') ? at : at?.querySelector<HTMLElement>('input, button:not([disabled]), select')
    el?.scrollIntoView({ block: 'center' })
    el?.focus()
  }, [focus])

  if (!param) return null
  const others = decl.params.filter((p) => p.name !== name).map((p) => p.name)
  const problem = nameProblem(draft, others)
  const set = (next: Param) => onChange(changeParam(decl, name, next, panels, model), next.name)
  const onName = (v: string) => {
    setDraft(v)
    if (!nameProblem(v, others)) set({ ...param, name: v })
  }
  const onKind = (kind: ParamKind) => set({ ...blankParam(kind, others, model), label: param.label })
  const readyMade = readyMadeLabelKey(param.name) !== null

  return (
    <aside
      ref={root}
      className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-4 lg:sticky lg:top-2 lg:max-h-[calc(100vh-1rem)] lg:overflow-y-auto"
      aria-label={t('params.inspector.label')}
      data-param-inspector={param.name}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {t('params.inspector.title')}{' '}
          <span className="font-mono text-xs text-muted-foreground">
            <Ltr>{param.name}</Ltr>
          </span>
        </h2>
        <IconButton label={t('params.inspector.done')} onClick={onClose} data-param-inspector-close>
          <X className="size-4" aria-hidden />
        </IconButton>
      </header>

      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL}>{t('params.field.kind')}</span>
        {fresh ? (
          <div className="flex flex-wrap gap-1" role="group" aria-label={t('params.field.kind')}>
            {PARAM_KINDS.map((k) => (
              <Chip key={k} on={param.kind === k} onClick={() => onKind(k)} data-param-kind={k}>
                {t(`params.kind.${k}`)}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-sm" data-param-kind-shown={param.kind}>
            {t(`params.kind.${param.kind}`)}
            {readyMade && <span className="ms-2 text-xs text-muted-foreground">{t('params.field.readyMade')}</span>}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t(`params.kindHint.${param.kind}`)}</p>
      </div>

      <div data-param-field="name">
        <Field label={t('params.field.name')} hint={t('params.field.nameHint', { name: fsi(draft) })} error={problem ? t(`params.field.nameProblem.${problem}`) : undefined}>
          <Input dir="ltr" value={draft} onChange={(e) => onName(e.target.value)} data-param-name />
        </Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={t('params.field.labelEn')}>
          <Input dir="ltr" lang="en" value={param.label.en} onChange={(e) => set({ ...param, label: { ...param.label, en: e.target.value } })} data-param-label="en" />
        </Field>
        <Field label={t('params.field.labelAr')}>
          <Input dir="rtl" lang="ar" value={param.label.ar} onChange={(e) => set({ ...param, label: { ...param.label, ar: e.target.value } })} data-param-label="ar" />
        </Field>
      </div>

      <KindFields param={param} model={model} lang={lang} onParam={set} />

      <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3" data-param-field="default">
        <span className={FIELD_LABEL}>{t('params.field.default')}</span>
        <ParamControl param={param} value={param.default} onChange={(d) => set({ ...param, default: d })} invalid={false} model={model} lang={lang} />
        <div>
          <Chip on={param.required} onClick={() => set({ ...param, required: !param.required })} data-param-required>
            {t('params.field.required')}
          </Chip>
        </div>
        <p className="text-xs text-muted-foreground">{t('params.field.defaultHint')}</p>
      </div>

      <AppliesTo decl={decl} param={param} panels={panels} model={model} lang={lang} onChange={(next) => onChange(next, param.name)} />

      <div>
        <Button variant="danger-outlined" onClick={onRemove} data-param-remove>
          <Trash2 className="size-3.5" aria-hidden />
          {t('params.field.remove')}
        </Button>
        {readyMade && <p className="mt-1 text-xs text-muted-foreground">{t('params.field.removeReadyMade')}</p>}
      </div>

      <Overview decl={decl} selected={param.name} panels={panels} model={model} lang={lang} onChange={(next) => onChange(next, param.name)} onSelect={onSelect} />
    </aside>
  )
}

function KindFields({ param, model, lang, onParam }: { param: Param; model: AnalyticsModel; lang: string; onParam: (next: Param) => void }) {
  const { t } = useTranslation('boards')
  const say = (label: { en: string; ar: string } | undefined, key: string) => saysIn(label, lang) || key
  const categories = model.dimensions.filter((d) => d.kind === 'category')
  switch (param.kind) {
    case 'members': {
      const inline = dimensionOf(model, param.dimension)?.values ?? []
      return (
        <div className="flex flex-col gap-3">
          <Field label={t('params.field.dimension')}>
            <Select value={param.dimension ?? ''} onChange={(e) => onParam({ ...param, dimension: e.target.value, pinned: null, default: { kind: 'members', values: [] } })} data-param-dimension>
              {categories.map((d) => (
                <option key={d.key} value={d.key}>
                  {fsi(say(d.label, d.key))}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>{t('params.field.choices')}</span>
            <div className="flex flex-wrap gap-1">
              <Chip on={!param.pinned} onClick={() => onParam({ ...param, pinned: null })} data-param-choices="open">
                {t('params.field.openSearch')}
              </Chip>
              <Chip on={!!param.pinned} disabled={inline.length === 0} onClick={() => onParam({ ...param, pinned: [] })} data-param-choices="pinned">
                {t('params.field.pinnedList')}
              </Chip>
              <Chip on={param.multi !== false} onClick={() => onParam({ ...param, multi: param.multi === false })} data-param-multi>
                {t('params.field.multi')}
              </Chip>
            </div>
            {inline.length === 0 && <p className="text-xs text-muted-foreground">{t('params.field.pinnedNone')}</p>}
          </div>
          {param.pinned && (
            <Field label={t('params.field.pinned')}>
              <MultiSelect
                value={param.pinned}
                onChange={(pinned) => onParam({ ...param, pinned, default: { kind: 'members', values: param.default.kind === 'members' ? param.default.values.filter((v) => pinned.includes(v)) : [] } })}
                options={inline.map((v) => ({ value: v.key, text: saysIn(v.label, lang) || v.key, machine: !saysIn(v.label, lang) }))}
                label={t('params.field.pinned')}
                data-testid="param-pinned"
              />
            </Field>
          )}
        </div>
      )
    }
    case 'grain': {
      const allowed = param.grains ?? []
      const toggle = (g: Grain) => {
        const grains = allowed.includes(g) ? allowed.filter((x) => x !== g) : GRAINS.filter((x) => x === g || allowed.includes(x))
        const d = param.default.kind === 'grain' && grains.includes(param.default.grain) ? param.default : { kind: 'grain' as const, grain: grains[0] ?? g }
        onParam({ ...param, grains, default: d })
      }
      return (
        <div className="flex flex-col gap-1">
          <span className={FIELD_LABEL}>{t('params.field.allowedGrains')}</span>
          <div className="flex gap-1">
            {GRAINS.map((g) => (
              <Chip key={g} on={allowed.includes(g)} onClick={() => toggle(g)} data-param-grain={g}>
                {t(`board.params.grain.${g}`)}
              </Chip>
            ))}
          </div>
        </div>
      )
    }
    case 'threshold':
      return (
        <Field label={t('params.field.thresholdMeasure')} hint={t('params.field.thresholdHint')}>
          <Select value={param.measure ?? ''} onChange={(e) => onParam({ ...param, measure: e.target.value })} data-param-measure>
            {model.measures.map((m) => (
              <option key={m.key} value={m.key}>
                {fsi(say(m.label, m.key))}
              </option>
            ))}
          </Select>
        </Field>
      )
    case 'measure':
    case 'breakdown': {
      const kind = param.kind
      const choices = kind === 'measure' ? model.measures.map((m) => ({ key: m.key, label: m.label })) : categories.map((d) => ({ key: d.key, label: d.label }))
      const options = param.options ?? []
      const current = param.default.kind === kind ? param.default.key : ''
      return (
        <Field label={t('params.field.options')} hint={t('params.field.optionsHint')}>
          <MultiSelect
            value={options}
            onChange={(next) => onParam({ ...param, options: next, default: { kind, key: next.includes(current) ? current : (next[0] ?? '') } })}
            options={choices.map((c) => ({ value: c.key, text: say(c.label, c.key) }))}
            label={t('params.field.options')}
            data-testid="param-options"
          />
        </Field>
      )
    }
    default:
      return null
  }
}

/** "Applies to": every panel — bound (and, for members, to which dimension), or why it cannot be. */
function AppliesTo({ decl, param, panels, model, lang, onChange }: { decl: Declarations; param: Param; panels: readonly InspectorPanel[]; model: AnalyticsModel; lang: string; onChange: (next: Declarations) => void }) {
  const { t } = useTranslation('boards')
  const bound = decl.bindings[param.name] ?? {}
  const categories = model.dimensions.filter((d) => d.kind === 'category')
  return (
    <fieldset className="flex flex-col gap-1.5 rounded-md border border-border p-3" data-param-bindings={param.name}>
      <legend className="px-1 text-xs font-medium text-muted-foreground">{t('params.bind.title')}</legend>
      <p className="text-xs text-muted-foreground">{t('params.bind.hint')}</p>
      {panels.length === 0 && <p className="text-xs text-muted-foreground">{t('params.bind.noPanels')}</p>}
      {panels.map((panel) => {
        const at = bound[panel.id]
        const def = panel.definition
        const now = def ? canBind(param, def, model, typeof at === 'string' ? at : undefined) : null
        const fresh = def ? canBind(param, def, model) : null
        const toggle = () => onChange(bind(decl, param.name, panel.id, at !== undefined ? null : fresh?.ok ? (fresh.target ?? true) : true))
        const reason = at !== undefined ? (now && !now.ok ? now.reason : null) : fresh && !fresh.ok ? fresh.reason : null
        return (
          <div key={panel.id} className="flex flex-wrap items-center gap-2" data-param-binding={panel.id} data-param-bound={at !== undefined ? 'true' : 'false'}>
            <Chip on={at !== undefined} onClick={toggle} disabled={at === undefined && !fresh?.ok} className="max-w-full">
              <bdi className="truncate">{panel.title}</bdi>
            </Chip>
            {param.kind === 'members' && at !== undefined && def && (
              <Select
                value={typeof at === 'string' ? at : ''}
                onChange={(e) => onChange(bind(decl, param.name, panel.id, e.target.value))}
                className="w-44"
                aria-label={t('params.bind.target')}
                data-param-binding-target={panel.id}
              >
                {categories.map((d) => (
                  <option key={d.key} value={d.key} disabled={d.key !== at && !canBind(param, def, model, d.key).ok}>
                    {fsi(saysIn(d.label, lang) || d.key)}
                  </option>
                ))}
              </Select>
            )}
            {!def && <span className="text-xs text-muted-foreground">{t('params.bind.loading')}</span>}
            {reason && (
              <span className={'text-xs ' + (at !== undefined ? 'text-danger-800' : 'text-muted-foreground')} data-param-reason={reason}>
                {t(`params.reason.${reason}`)}
              </span>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}

/** The binding overview: parameters down, panels across — every cell bound, unbound, can't (why), or doesn't fit. */
function Overview({
  decl,
  selected,
  panels,
  model,
  lang,
  onChange,
  onSelect,
}: {
  decl: Declarations
  selected: string
  panels: readonly InspectorPanel[]
  model: AnalyticsModel
  lang: string
  onChange: (next: Declarations) => void
  onSelect: (name: string) => void
}) {
  const { t } = useTranslation('boards')
  const rows = overview(decl, panels, model)
  if (panels.length === 0) return null
  return (
    <section className="flex flex-col gap-1.5" data-param-overview>
      <h3 className="text-xs font-medium text-muted-foreground">{t('params.overview.title')}</h3>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="p-1.5 text-start font-medium">{t('params.overview.param')}</th>
              {panels.map((p) => (
                <th key={p.id} className="max-w-28 p-1.5 text-start font-medium">
                  <bdi className="line-clamp-2">{p.title}</bdi>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const p = decl.params.find((x) => x.name === row.param)!
              const label = paramLabel(p, lang, t)
              return (
                <tr key={row.param} className={'border-b border-border/50 ' + (row.param === selected ? 'bg-primary-050' : '')} data-param-overview-row={row.param}>
                  <td className="p-1.5">
                    <Button variant="link" onClick={() => onSelect(row.param)}>
                      <bdi>{label}</bdi>
                    </Button>
                  </td>
                  {row.cells.map((cell) => {
                    const panel = panels.find((x) => x.id === cell.panel)!
                    const aria = t('params.overview.cell', { param: fsi(label), panel: fsi(panel.title) })
                    const fresh = panel.definition ? canBind(p, panel.definition, model) : null
                    return (
                      <td key={cell.panel} className="p-1.5" data-param-overview-cell={cell.panel} data-state={cell.state}>
                        {cell.state === 'cannot' ? (
                          <span className="text-muted-foreground" title={t(`params.reason.${cell.reason}`)}>
                            {t('params.overview.cannot')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Chip
                              on={cell.state !== 'unbound'}
                              onClick={() => onChange(bind(decl, p.name, cell.panel, cell.state === 'unbound' ? (fresh?.ok ? (fresh.target ?? true) : true) : null))}
                              aria-label={aria}
                              title={cell.state === 'broken' ? t(`params.reason.${cell.reason}`) : aria}
                            >
                              {cell.state === 'unbound' ? <span className="size-3.5" /> : <Check className="size-3.5" aria-hidden />}
                            </Chip>
                            {cell.state === 'broken' && <span className="text-danger-800">{t('params.overview.broken')}</span>}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
