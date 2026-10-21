import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { RuleFromTemplateBody, RuleTemplate, RuleTemplatePlaceholder } from '@/core/models/rule-campaign'
import { rememberNewDraft, ruleCampaignApi, ruleTemplatesQuery } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import LookupPicks, { RULE_INPUT } from '@/core/rules/LookupPicks'
import { saysIn } from '@/core/rules/sentence'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import {
  placeholderKind,
  placeholderLookup,
  templateBody,
  templateFormFor,
  templateFormId,
  templateProblems,
  templateReady,
  type TemplateForm,
  type TemplateProblemCode,
} from './template-form'

/** The create-from-template call's key: the dialog's footer reads whether it is under way. */
export const TEMPLATE_CREATE_KEY = ['rule-template-create'] as const

/**
 * Create campaign ▸ From a template (tickets 503, 524; `Templates/List` + `Drafts/FromTemplate`):
 * HQ's templates, each with the values it asks for. Picking one asks for its placeholders — each
 * labelled in the reader's language, asked for by its default's kind (a number, a text, yes / no,
 * codes through the builder's item picker, or JSON) — and for the new draft's id and names. Create
 * sends the values by placeholder name; HQ puts each at its path in the template's campaign, makes
 * it a draft, and its dashboard opens.
 *
 * The form is sent by the dialog's footer (by `formId`). A missing value is said at its field once
 * Create has been tried; a refusal from the door is shown here, verbatim.
 */
export default function FromTemplate({ formId, onCreated }: { formId: string; onCreated: () => void }) {
  const { t, i18n } = useTranslation('campaign-promotions')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const templates = useQuery(ruleTemplatesQuery())
  const [pickedCode, setPickedCode] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateForm | null>(null)
  const [tried, setTried] = useState(false)
  // Read from the templates as HQ last answered them, so a template changed since it was picked is
  // never sent from a stale copy.
  const picked = templates.data?.find((x) => x.code === pickedCode) ?? null

  const create = useMutation({
    mutationKey: TEMPLATE_CREATE_KEY,
    mutationFn: (body: RuleFromTemplateBody) => ruleCampaignApi.fromTemplate(body),
    onSuccess: (draft) => rememberNewDraft(queryClient, draft),
  })

  const pick = (template: RuleTemplate) => {
    if (create.isPending) return
    setPickedCode(template.code)
    setForm(templateFormFor(template))
    setTried(false)
    create.reset()
  }
  const set = (change: Partial<TemplateForm>) => {
    setForm((f) => (f ? { ...f, ...change } : f))
    // A refusal was about the values as they were sent; an edit makes it stale.
    if (create.isError) create.reset()
  }
  const setValue = (name: string, value: string | string[]) => {
    setForm((f) => (f ? { ...f, values: { ...f.values, [name]: value } } : f))
    if (create.isError) create.reset()
  }

  const problems = picked && form ? templateProblems(picked, form) : null
  const problemOf = (name: string) => (tried ? (problems?.values.find((p) => p.name === name)?.problem ?? null) : null)
  // The id's own problem shows at once while it is typed, and an empty id once Create is pressed.
  const idProblem = problems?.id && (tried || problems.id !== 'idRequired') ? problems.id : null

  const submit = () => {
    if (create.isPending) return
    setTried(true)
    if (!picked || !form || !problems || !templateReady(problems)) return
    // As in the blank form: landing rides on THIS call's success, so a user who left is not pulled back.
    create.mutate(templateBody(picked, form), {
      onSuccess: (draft) => {
        notify.success(t('create.done'))
        onCreated()
        navigate(campaignPath(draft.code))
      },
    })
  }

  return (
    <form
      id={formId}
      className="flex flex-col gap-3"
      data-create-template=""
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {templates.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t('template.loading')}
        </p>
      ) : templates.isError ? (
        <ErrorBanner
          className="p-2.5"
          title={t('template.failedTitle')}
          message={isBareDenial(templates.error) ? t('template.denied') : apiErrorMessage(templates.error, t('template.failed'))}
        />
      ) : templates.data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-template-none="">
          {t('template.none')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={t('template.listLabel')} data-template-list="">
          {templates.data.map((x) => (
            <li key={x.code}>
              <button
                type="button"
                aria-pressed={picked?.code === x.code}
                disabled={create.isPending}
                onClick={() => pick(x)}
                data-template={x.code}
                className={
                  'flex w-full flex-col gap-0.5 rounded-md border px-3 py-2 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-70 ' +
                  (picked?.code === x.code ? 'border-primary bg-primary-050/60' : 'border-border/60 hover:bg-accent')
                }
              >
                <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                  <bdi>{x.name.en}</bdi>
                  <bdi dir="rtl" className="font-normal text-muted-foreground">
                    {x.name.ar}
                  </bdi>
                </span>
                <span className="text-xs text-muted-foreground" data-template-asks="">
                  {x.placeholders.length
                    ? t('template.asks', { labels: listText(x.placeholders.map((p) => fsi(saysIn(p.label, i18n.language))), i18n.language) })
                    : t('template.asksNothing')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && form ? (
        <fieldset className="flex flex-col gap-3 rounded-md border border-border/60 p-3" data-template-fill={picked.code}>
          <legend className="px-1 text-xs font-medium text-muted-foreground">{t('template.fillLegend')}</legend>
          {picked.placeholders.map((p) => (
            <Placeholder key={p.name} placeholder={p} value={form.values[p.name]} onChange={(v) => setValue(p.name, v)} problem={problemOf(p.name)} />
          ))}
          <TextField
            id="template-name-en"
            label={t('create.nameEn')}
            value={form.nameEn}
            dir="ltr"
            data="nameEn"
            onChange={(nameEn) => set({ nameEn })}
            problem={tried && problems?.nameEnRequired ? t('create.problem.nameEnRequired') : null}
          />
          <TextField
            id="template-name-ar"
            label={t('create.nameAr')}
            value={form.nameAr}
            dir="rtl"
            data="nameAr"
            onChange={(nameAr) => set({ nameAr })}
            problem={tried && problems?.nameArRequired ? t('create.problem.nameArRequired') : null}
          />
          <TextField
            id="template-id"
            label={t('create.id')}
            value={templateFormId(form)}
            dir="ltr"
            data="id"
            onChange={(id) => set({ id, idEdited: true })}
            problem={idProblem ? t(`create.problem.${idProblem}`) : null}
          />
          <p className="-mt-2 text-xs text-muted-foreground">{t('create.idHint')}</p>
          <p className="text-xs text-muted-foreground">{t('template.later')}</p>
        </fieldset>
      ) : (
        templates.isSuccess &&
        templates.data.length > 0 && (
          <p className={'text-xs ' + (tried ? 'text-danger-800' : 'text-muted-foreground')} data-template-pick={tried ? 'missing' : ''}>
            {t(tried ? 'template.pickFirst' : 'template.pick')}
          </p>
        )
      )}

      {create.isError && (
        <ErrorBanner
          className="p-2.5"
          title={t('create.failedTitle')}
          message={isBareDenial(create.error) ? t('template.createDenied') : apiErrorMessage(create.error, t('create.failed'))}
        />
      )}
    </form>
  )
}

function TextField({
  id,
  label,
  value,
  dir,
  data,
  onChange,
  problem,
}: {
  id: string
  label: string
  value: string
  dir: 'ltr' | 'rtl'
  data: string
  onChange: (value: string) => void
  problem: string | null
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        dir={dir}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-problem` : undefined}
        data-template-field-name={data}
        className={`${RULE_INPUT} w-full ` + (problem ? 'border-danger-border' : '')}
      />
      {problem && (
        <p id={`${id}-problem`} className="text-xs text-danger-800" data-template-name-problem={data}>
          {problem}
        </p>
      )}
    </div>
  )
}

/** One placeholder's field, by its default's kind: a number, a text, yes / no, codes or JSON. */
function Placeholder({
  placeholder: p,
  value,
  onChange,
  problem,
}: {
  placeholder: RuleTemplatePlaceholder
  value: string | string[] | undefined
  onChange: (value: string | string[]) => void
  problem: TemplateProblemCode | null
}) {
  const { t, i18n } = useTranslation('campaign-promotions')
  const id = `template-${p.name}`
  const problemId = `${id}-problem`
  const label = <bdi>{saysIn(p.label, i18n.language)}</bdi>
  const kind = placeholderKind(p)
  const lookup = kind === 'codes' ? placeholderLookup(p) : null
  const typed = typeof value === 'string' ? value : Array.isArray(value) ? value.join(', ') : ''
  const error = problem && (
    <p id={problemId} className="text-xs text-danger-800" data-template-problem={p.name}>
      {t(`template.problem.${problem}`)}
    </p>
  )
  const path = (
    <p className="text-xs text-muted-foreground" data-template-path={p.name}>
      {t('template.path')} <span className="font-mono"><Ltr>{p.path}</Ltr></span>
    </p>
  )

  if (lookup)
    return (
      <div className="flex flex-col gap-1" data-template-field={p.name}>
        <div className="grid items-start gap-x-3 gap-y-1 sm:grid-cols-[9rem_1fr]">
          <LookupPicks kind={lookup} label={label} value={Array.isArray(value) ? value : []} onChange={onChange} data={`template-${p.name}`} />
        </div>
        {error}
      </div>
    )

  if (kind === 'bool')
    return (
      <div className="flex flex-col gap-1" data-template-field={p.name}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={typed === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} data-template-input={p.name} />
          {label}
        </label>
        {path}
      </div>
    )

  return (
    <div className="flex flex-col gap-1" data-template-field={p.name}>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {kind === 'json' ? (
        <textarea
          id={id}
          dir="ltr"
          rows={3}
          className={`${RULE_INPUT} h-auto w-full py-1.5 font-mono text-xs`}
          value={typed}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          data-template-input={p.name}
        />
      ) : (
        <input
          id={id}
          dir={kind === 'text' ? 'auto' : 'ltr'}
          inputMode={kind === 'number' ? 'decimal' : undefined}
          className={`${RULE_INPUT} ` + (kind === 'number' ? 'w-32 text-end tabular-nums' : 'w-full')}
          value={typed}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          data-template-input={p.name}
        />
      )}
      {kind === 'json' && <p className="text-xs text-muted-foreground">{t('template.jsonHint')}</p>}
      {kind === 'codes' && <p className="text-xs text-muted-foreground">{t('template.codesHint')}</p>}
      {path}
      {error}
    </div>
  )
}
