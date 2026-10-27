import { Fragment, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowRight, Loader2, Plus, X } from 'lucide-react'

import { ApiError, apiErrorMessage, isBareDenial } from '@/core/api'
import { GUARD_DRAFT_KEY } from '@/core/insurance-rules/api'
import type { GuardList, GuardListAttribute, GuardListFilter, GuardRuleset } from '@/core/insurance-rules/model'
import { liveFields, type RegistryField } from '@/core/insurance-rules/registry'
import { fieldValuesQuery } from '@/core/insurance-rules/registry-api'
import { notify } from '@/core/services/notify'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { fsi, formatPair } from '@/core/util/bidi'
import { useDebounced } from '@/core/util/use-debounced'
import { listsApi, type ListPreview } from './api'
import { attributeCodes, attributeMode, listProblems, withList, type ListProblem } from './list-graph'
import { CARD, CHIP } from './ui'

interface Props {
  initial: GuardList
  isNew: boolean
  draft: GuardRuleset
  fields: RegistryField[]
  onDone: () => void
}

/**
 * One item list being built (ticket 610): its id (new lists only — an id never changes) and EN + AR name; its
 * filters — each a set of registry-field rows that must ALL hold (any of / none of some codes, each code shown
 * with its description), the filters OR'd; the other lists it includes or takes out. A cycle or a fourth level
 * is refused here before the save (`listProblems`). Preview asks HQ which items match today, and warns when
 * none does. Save PUTs the whole draft at the revision it was read; a 409 says someone saved first.
 */
export default function ListEditor({ initial, isNew, draft, fields, onDone }: Props) {
  const { t, i18n } = useTranslation('insurance-lists')
  const qc = useQueryClient()
  const [list, setList] = useState<GuardList>(() => structuredClone(initial))
  const others = draft.lists.filter((l) => isNew || l.id !== initial.id)
  const problems = listProblems(list, others, { isNew })
  const itemFields = fields.filter((f) => f.scope === 'item' && (!f.retired || list.filters.some((x) => x.attributes.some((a) => a.field === f.key))))
  const firstField = liveFields(fields, 'item')[0]?.key ?? ''

  const [previewed, setPreviewed] = useState<{ json: string; result: ListPreview } | null>(null)
  const json = JSON.stringify(list)
  const preview = useMutation({
    mutationFn: () => listsApi.preview(list, others),
    onSuccess: (result) => setPreviewed({ json, result }),
  })
  const [stale, setStale] = useState(false)
  const save = useMutation({
    mutationFn: () => listsApi.saveDraft({ ...draft, lists: withList(draft.lists, list, isNew ? null : initial.id) }),
    onSuccess: (saved) => {
      qc.setQueryData(GUARD_DRAFT_KEY, saved)
      notify.success(t('editor.saved'), fsi(saysIn(list.name, i18n.language)))
      onDone()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.statusCode === 409) setStale(true)
      else if (isBareDenial(err)) notify.error(t('editor.saveFailed'), t('access.deniedHint'))
      else notify.apiError(t('editor.saveFailed'), err, t('editor.saveFailed'))
    },
  })

  const setFilter = (fi: number, f: GuardListFilter) => setList((l) => ({ ...l, filters: l.filters.map((x, i) => (i === fi ? f : x)) }))
  const setAttr = (fi: number, ai: number, a: GuardListAttribute) =>
    setFilter(fi, { ...list.filters[fi], attributes: list.filters[fi].attributes.map((x, i) => (i === ai ? a : x)) })
  const toggleRef = (side: 'include' | 'exclude', id: string) =>
    setList((l) => ({ ...l, [side]: l[side].includes(id) ? l[side].filter((x) => x !== id) : [...l[side], id] }))

  const current = previewed && previewed.json === json ? previewed.result : null
  const blocked = problems.length > 0

  return (
    <div className="flex max-w-5xl flex-col gap-4" data-list-editor={isNew ? 'new' : initial.id}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{isNew ? t('editor.newTitle') : t('editor.editTitle')}</h2>
        {!isNew && (
          <code className="text-xs text-muted-foreground">
            <Ltr>{initial.id}</Ltr>
          </code>
        )}
      </header>

      <div className={`${CARD} grid gap-3 md:grid-cols-3`}>
        {isNew && (
          <Field label={t('editor.id')} hint={t('editor.idHint')}>
            <Input dir="ltr" value={list.id} onChange={(e) => setList({ ...list, id: e.target.value.trim() })} data-list-id-input="" />
          </Field>
        )}
        <Field label={t('editor.nameEn')}>
          <Input lang="en" dir="ltr" value={list.name.en} onChange={(e) => setList({ ...list, name: { ...list.name, en: e.target.value } })} data-list-name-en="" />
        </Field>
        <Field label={t('editor.nameAr')}>
          <Input lang="ar" dir="rtl" value={list.name.ar} onChange={(e) => setList({ ...list, name: { ...list.name, ar: e.target.value } })} data-list-name-ar="" />
        </Field>
      </div>

      <section className="flex flex-col gap-2" data-editor-filters="">
        <h3 className="text-sm font-semibold">{t('editor.filters')}</h3>
        <p className="text-xs text-muted-foreground">{t('editor.filtersHint')}</p>
        {list.filters.map((f, fi) => (
          <Fragment key={fi}>
            {fi > 0 && <span className="text-xs font-semibold uppercase text-muted-foreground">{t('def.or')}</span>}
            <div className={`${CARD} flex flex-col gap-2`} data-editor-filter={fi}>
              {f.attributes.map((a, ai) => (
                <AttributeRow
                  key={ai}
                  attr={a}
                  fields={itemFields}
                  onChange={(next) => setAttr(fi, ai, next)}
                  onRemove={() => setFilter(fi, { ...f, attributes: f.attributes.filter((_, i) => i !== ai) })}
                />
              ))}
              {(['articles', 'categories'] as const).map((k) =>
                f[k].length ? (
                  <div key={k} className="flex flex-wrap items-center gap-1 text-sm" data-editor-picked={k}>
                    <span className="text-xs text-muted-foreground">{t(`def.${k}`)}</span>
                    {f[k].map((v) => (
                      <span key={v} className={CHIP}>
                        <Ltr>{v}</Ltr>
                        <IconButton variant="danger" size="compact" label={t('editor.removeCode', { code: fsi(v) })} onClick={() => setFilter(fi, { ...f, [k]: f[k].filter((x) => x !== v) })}>
                          <X className="h-3 w-3" aria-hidden />
                        </IconButton>
                      </span>
                    ))}
                  </div>
                ) : null,
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outlined"
                  disabled={!firstField}
                  onClick={() => setFilter(fi, { ...f, attributes: [...f.attributes, { field: firstField, anyOf: [] }] })}
                  data-add-attribute={fi}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {t('editor.addField')}
                </Button>
                {list.filters.length > 1 && (
                  <Button variant="text" onClick={() => setList({ ...list, filters: list.filters.filter((_, i) => i !== fi) })} data-remove-filter={fi}>
                    {t('editor.removeFilter')}
                  </Button>
                )}
              </div>
            </div>
          </Fragment>
        ))}
        <Button
          variant="outlined"
          className="w-fit"
          onClick={() => setList({ ...list, filters: [...list.filters, { articles: [], categories: [], attributes: [] }] })}
          data-add-filter=""
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('editor.addFilter')}
        </Button>
      </section>

      <section className="grid gap-3 md:grid-cols-2" data-editor-refs="">
        {(['include', 'exclude'] as const).map((side) => (
          <fieldset key={side} className={CARD} data-editor-side={side}>
            <legend className="px-1 text-sm font-semibold">{t(`editor.${side}`)}</legend>
            <p className="mb-2 text-xs text-muted-foreground">{t(`editor.${side}Hint`)}</p>
            {others.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('editor.noOtherList')}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {others.map((o) => (
                  <li key={o.id}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={list[side].includes(o.id)} onChange={() => toggleRef(side, o.id)} data-ref={`${side}:${o.id}`} />
                      <bdi>{o.name.en}</bdi>
                      <code className="text-xs text-muted-foreground">
                        <Ltr>{o.id}</Ltr>
                      </code>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        ))}
      </section>

      {problems.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-attention-border bg-attention-050 p-3 text-sm" role="alert" data-list-problems="">
          {problems.map((p, i) => (
            <li key={i} data-problem={p.kind}>
              <Problem problem={p} />
            </li>
          ))}
        </ul>
      )}

      <section className={`${CARD} flex flex-col gap-2`} data-list-preview="">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t('preview.title')}</h3>
          <Button variant="secondary" aria-disabled={blocked || preview.isPending} onClick={() => !blocked && !preview.isPending && preview.mutate()} data-preview-run="">
            {preview.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {t('preview.run')}
          </Button>
        </div>
        {preview.isError && <ErrorBanner className="p-2" message={apiErrorMessage(preview.error, t('preview.failed'))} />}
        {!current && !preview.isError && <p className="text-xs text-muted-foreground">{blocked ? t('preview.blocked') : t('preview.hint')}</p>}
        {current && <PreviewResult preview={current} />}
      </section>

      {stale && (
        <ErrorBanner className="p-3" message={t('editor.stale')}>
          <Button variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: GUARD_DRAFT_KEY }).then(onDone)} data-stale-reload="">
            {t('editor.reload')}
          </Button>
        </ErrorBanner>
      )}

      <div className="flex gap-2">
        <Button variant="primary" aria-disabled={blocked || save.isPending} onClick={() => !blocked && !save.isPending && save.mutate()} data-list-save="">
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {t('editor.save')}
        </Button>
        <Button variant="text" onClick={onDone} data-list-cancel="">
          {t('editor.cancel')}
        </Button>
      </div>
    </div>
  )
}

/** One registry-field row: the field, any of / none of, the codes (each with its description), the picker. */
function AttributeRow({ attr, fields, onChange, onRemove }: { attr: GuardListAttribute; fields: RegistryField[]; onChange: (a: GuardListAttribute) => void; onRemove: () => void }) {
  const { t } = useTranslation('insurance-lists')
  const mode = attributeMode(attr)
  const codes = attributeCodes(attr)
  const make = (field: string, m: 'anyOf' | 'noneOf', values: string[]): GuardListAttribute => (m === 'anyOf' ? { field, anyOf: values } : { field, noneOf: values })
  const [q, setQ] = useState('')
  const settled = useDebounced(q.trim(), 250)
  const known = useQuery({ ...fieldValuesQuery(attr.field, ''), enabled: !!attr.field })
  const found = useQuery({ ...fieldValuesQuery(attr.field, settled), enabled: !!attr.field && settled !== '' })
  const describe = (code: string) => [...(known.data ?? []), ...(found.data ?? [])].find((v) => v.code === code)?.description ?? ''
  const options = (settled ? found.data : known.data)?.filter((v) => !codes.includes(v.code)).slice(0, 8) ?? []

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 p-2" data-attribute-row={attr.field}>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('editor.field')}>
          <Select value={attr.field} onChange={(e) => onChange(make(e.target.value, mode, []))} data-attribute-field="">
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {fsi(f.label.en)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('editor.mode')}>
          <Select value={mode} onChange={(e) => onChange(make(attr.field, e.target.value as 'anyOf' | 'noneOf', codes))} data-attribute-mode="">
            <option value="anyOf">{t('mode.anyOf')}</option>
            <option value="noneOf">{t('mode.noneOf')}</option>
          </Select>
        </Field>
        <Button variant="text" onClick={onRemove} data-attribute-remove="">
          {t('editor.removeField')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1" data-attribute-codes="">
        {codes.length === 0 && <span className="text-xs text-muted-foreground">{t('editor.noCode')}</span>}
        {codes.map((c) => (
          <span key={c} className={CHIP} data-code-chip={c}>
            <Ltr>{formatPair(c, describe(c))}</Ltr>
            <IconButton variant="danger" size="compact" label={t('editor.removeCode', { code: fsi(c) })} onClick={() => onChange(make(attr.field, mode, codes.filter((x) => x !== c)))}>
              <X className="h-3 w-3" aria-hidden />
            </IconButton>
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Input
          className="max-w-sm"
          placeholder={t('editor.searchValues')}
          aria-label={t('editor.searchValues')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-value-search=""
        />
        <div className="flex flex-wrap gap-1" data-value-options="">
          {options.map((v) => (
            <Button
              key={v.code}
              variant="outlined"
              onClick={() => onChange(make(attr.field, mode, [...codes, v.code]))}
              data-value-option={v.code}
            >
              <Ltr>{formatPair(v.code, v.description)}</Ltr>
            </Button>
          ))}
          {settled && found.data && options.length === 0 && <span className="text-xs text-muted-foreground">{t('editor.noValue')}</span>}
        </div>
      </div>
    </div>
  )
}

/** A refusal in words; a path of lists reads as ids joined by arrows that turn with the text. */
function Problem({ problem }: { problem: ListProblem }) {
  const { t } = useTranslation('insurance-lists')
  if (problem.kind === 'cycle' || problem.kind === 'tooDeep')
    return (
      <span className="flex flex-wrap items-center gap-1">
        {t(`problem.${problem.kind}`)}
        {problem.path.map((id, i) => (
          <Fragment key={i}>
            {i > 0 && <ArrowRight className="h-3 w-3 rtl:rotate-180" aria-hidden />}
            <code data-path-step={id}>
              <Ltr>{id}</Ltr>
            </code>
          </Fragment>
        ))}
      </span>
    )
  if (problem.kind === 'unknownList')
    return (
      <span>
        {t('problem.unknownList')}{' '}
        <code>
          <Ltr>{problem.id}</Ltr>
        </code>
      </span>
    )
  if (problem.kind === 'emptyAttribute') return <span>{t('problem.emptyAttribute')}</span>
  return <span>{t(`problem.${problem.kind}`)}</span>
}

function PreviewResult({ preview }: { preview: ListPreview }) {
  const { t } = useTranslation('insurance-lists')
  if (preview.matchesNothing || preview.count === 0)
    return (
      <p className="flex items-center gap-2 rounded-md bg-attention-050 p-2 text-sm text-attention-800" role="alert" data-preview-nothing="">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        {t('preview.nothing')}
      </p>
    )
  return (
    <div className="flex flex-col gap-2" data-preview-result="">
      <p className="text-sm" data-preview-count={preview.count}>
        {t('preview.count', { count: preview.count, n: fsi(preview.count) })}
        {preview.items.length < preview.count && (
          <span className="text-muted-foreground">
            {' '}
            {t('preview.firstPage', { count: preview.items.length, n: fsi(preview.items.length) })}
          </span>
        )}
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1 text-start font-medium">{t('preview.article')}</th>
            <th className="py-1 text-start font-medium">{t('preview.name')}</th>
          </tr>
        </thead>
        <tbody>
          {preview.items.map((it) => (
            <tr key={it.article} className="border-t border-border/60" data-preview-item={it.article}>
              <td className="py-1">
                <Ltr>{it.article}</Ltr>
              </td>
              <td className="py-1">
                <bdi>{it.name}</bdi>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
