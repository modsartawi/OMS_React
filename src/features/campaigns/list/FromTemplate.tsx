import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { RuleCampaignFromTemplate, RuleCampaignTemplate, RuleTemplatePlaceholder } from '@/core/models/rule-campaign'
import { rememberNewDraft, ruleCampaignApi, ruleTemplatesQuery } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import LookupPicks, { RULE_INPUT } from '@/core/rules/LookupPicks'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { notify } from '@/core/services/notify'
import { formatPair, formatRange, fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { fillTemplate, templateFormFor, templateProblems, templateValues, type TemplateForm, type TemplateProblemCode } from './template-form'

/** The create-from-template call's key: the dialog's footer reads whether it is under way. */
export const TEMPLATE_CREATE_KEY = ['rule-template-create'] as const

/**
 * Create campaign ▸ From a template (ticket 503; the prototype's Templates page, in the dialog):
 * HQ's templates, each with its one line and the values it asks for. Picking an enabled one asks
 * for its placeholders — a number within its bounds, the builder's item picker for a pick, a list
 * for a choice — and shows the name the draft will have. Create fills the template's draft with
 * the values (`fillTemplate`), HQ makes it a draft, and its dashboard opens.
 *
 * The form is sent by the dialog's footer (by `formId`). A missing or out-of-bounds value is said
 * at its field once Create has been tried; a refusal from the door is shown here, verbatim.
 */
export default function FromTemplate({ formId, onCreated }: { formId: string; onCreated: () => void }) {
  const { t, i18n } = useTranslation('campaign-list')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const templates = useQuery(ruleTemplatesQuery())
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [form, setForm] = useState<TemplateForm>({})
  const [tried, setTried] = useState(false)
  // Read from the templates as HQ last answered them, so a template disabled or changed since it was
  // picked is never filled from a stale copy: a disabled one drops out of the form.
  const picked = templates.data?.find((x) => x.id === pickedId && x.enabled) ?? null

  const create = useMutation({
    mutationKey: TEMPLATE_CREATE_KEY,
    mutationFn: ({ templateId, body }: { templateId: string; body: RuleCampaignFromTemplate }) => ruleCampaignApi.createFromTemplate(templateId, body),
    onSuccess: (draft) => rememberNewDraft(queryClient, draft),
  })

  const pick = (template: RuleCampaignTemplate) => {
    if (create.isPending) return
    setPickedId(template.id)
    setForm(templateFormFor(template))
    setTried(false)
    create.reset()
  }
  const set = (key: string, value: string | string[]) => {
    setForm((f) => ({ ...f, [key]: value }))
    // A refusal was about the values as they were sent; an edit makes it stale.
    if (create.isError) create.reset()
  }

  const problems = picked ? templateProblems(picked, form) : []
  const problemOf = (key: string) => (tried ? (problems.find((p) => p.key === key)?.problem ?? null) : null)
  const filled = picked && problems.length === 0 ? fillTemplate(picked.draft, templateValues(picked, form)) : null
  /** Keys the template's own draft uses and no placeholder fills — its author's slip, said at once. */
  const unset = filled && !filled.ok ? filled.unset : []

  const submit = () => {
    if (create.isPending) return
    setTried(true)
    if (!picked || problems.length) return
    const values = templateValues(picked, form)
    const out = fillTemplate(picked.draft, values)
    // A broken template is already said under the form.
    if (!out.ok) return
    // As in the blank form: landing rides on THIS call's success, so a user who left is not pulled back.
    create.mutate(
      { templateId: picked.id, body: { values, draft: out.draft } },
      {
        onSuccess: (draft) => {
          notify.success(t('create.done'))
          onCreated()
          navigate(campaignPath(draft.code))
        },
      },
    )
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
        <ErrorBanner className="p-2.5" title={t('template.failedTitle')} message={apiErrorMessage(templates.error, t('template.failed'))} />
      ) : templates.data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-template-none="">
          {t('template.none')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={t('template.listLabel')} data-template-list="">
          {templates.data.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                aria-pressed={picked?.id === x.id}
                disabled={!x.enabled || create.isPending}
                onClick={() => pick(x)}
                data-template={x.id}
                className={
                  'flex w-full flex-col gap-0.5 rounded-md border px-3 py-2 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-70 ' +
                  (picked?.id === x.id ? 'border-primary bg-primary-050/60' : 'border-border/60 hover:bg-accent')
                }
              >
                <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
                  <bdi>{x.name.en}</bdi>
                  <bdi dir="rtl" className="font-normal text-muted-foreground">
                    {x.name.ar}
                  </bdi>
                  {!x.enabled && (
                    <span className="ms-auto rounded-full border border-border/60 px-2 text-xs font-normal text-muted-foreground" data-template-draft="">
                      {t('template.draft')}
                    </span>
                  )}
                </span>
                <span className="text-xs">
                  <bdi>{x.description}</bdi>
                </span>
                <span className="text-xs text-muted-foreground" data-template-asks="">
                  {t('template.asks', { labels: listText(x.placeholders.map((p) => fsi(p.label)), i18n.language) })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked ? (
        <fieldset className="flex flex-col gap-3 rounded-md border border-border/60 p-3" data-template-fill={picked.id}>
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            {t('template.fillLegend')}
          </legend>
          {picked.placeholders.map((p) => (
            <Placeholder key={p.key} placeholder={p} value={form[p.key]} onChange={(v) => set(p.key, v)} problem={problemOf(p.key)} />
          ))}
          {filled?.ok && (
            <div className="flex flex-col gap-0.5 text-xs" data-template-preview="">
              <span className="text-muted-foreground">{t('template.named')}</span>
              <bdi className="text-sm font-medium" data-template-preview-name="en">
                {filled.draft.name.en}
              </bdi>
              <bdi dir="rtl" className="text-sm" data-template-preview-name="ar">
                {filled.draft.name.ar}
              </bdi>
              <span className="text-muted-foreground">{t('template.later')}</span>
            </div>
          )}
        </fieldset>
      ) : (
        templates.isSuccess &&
        templates.data.length > 0 && (
          <p className={'text-xs ' + (tried ? 'text-danger-800' : 'text-muted-foreground')} data-template-pick={tried ? 'missing' : ''}>
            {t(tried ? 'template.pickFirst' : 'template.pick')}
          </p>
        )
      )}

      {unset.length > 0 && (
        <ErrorBanner className="p-2.5" title={t('template.brokenTitle')} message={t('template.broken', { keys: listText(unset.map((k) => fsi(k)), i18n.language) })} />
      )}
      {create.isError && <ErrorBanner className="p-2.5" title={t('create.failedTitle')} message={apiErrorMessage(create.error, t('create.failed'))} />}
    </form>
  )
}

/** One placeholder's field: a typed number, the builder's item picker, or a list. */
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
  const { t } = useTranslation('campaign-list')
  const id = `template-${p.key}`
  const problemId = `${id}-problem`
  const error = problem && (
    <p id={problemId} className="text-xs text-danger-800" data-template-problem={p.key}>
      {t(`template.problem.${problem}`, { min: fsi(p.min ?? ''), max: fsi(p.max ?? '') })}
    </p>
  )

  if (p.kind === 'pick')
    return (
      <div className="flex flex-col gap-1" data-template-field={p.key}>
        <div className="grid items-start gap-x-3 gap-y-1 sm:grid-cols-[9rem_1fr]">
          <LookupPicks kind={p.lookup ?? 'categories'} label={<bdi>{p.label}</bdi>} value={Array.isArray(value) ? value : []} onChange={onChange} data={`template-${p.key}`} />
        </div>
        {error}
      </div>
    )

  const typed = typeof value === 'string' ? value : ''
  const bounds = p.kind === 'number' && (p.min != null || p.max != null)
  return (
    <div className="flex flex-col gap-1" data-template-field={p.key}>
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        <bdi>{p.label}</bdi>
      </label>
      {p.kind === 'choice' ? (
        <select
          id={id}
          className={`${RULE_INPUT} w-full max-w-xs`}
          value={typed}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          data-template-input={p.key}
        >
          {!(p.options ?? []).some((o) => o.code === typed) && <option value="">{t('template.choose')}</option>}
          {(p.options ?? []).map((o) => (
            <option key={o.code} value={o.code}>
              {fsi(formatPair(o.code, o.name))}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          dir="ltr"
          inputMode="decimal"
          className={`${RULE_INPUT} w-32 text-end tabular-nums`}
          value={typed}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : bounds ? `${id}-hint` : undefined}
          data-template-input={p.key}
        />
      )}
      {bounds && !problem && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground" data-template-hint={p.key}>
          {p.min != null && p.max != null ? (
            <Trans t={t} i18nKey="template.between" values={{ range: formatRange(p.min, p.max) }} components={{ v: <Ltr /> }} />
          ) : p.min != null ? (
            <Trans t={t} i18nKey="template.atLeast" values={{ min: p.min }} components={{ v: <Ltr /> }} />
          ) : (
            <Trans t={t} i18nKey="template.atMost" values={{ max: p.max }} components={{ v: <Ltr /> }} />
          )}
        </p>
      )}
      {error}
    </div>
  )
}
