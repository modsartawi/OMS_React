import { useMemo, useState, type ReactNode } from 'react'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { rememberNewDraft, ruleCampaignApi, ruleCampaignsQuery } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import { notify } from '@/core/services/notify'
import FromTemplate, { TEMPLATE_CREATE_KEY } from './FromTemplate'
import { EMPTY_CREATE_FORM, createFormProblems, formId, toCreateSave, type CampaignIdProblem, type CreateCampaignForm, type CreateFormProblem } from './create-form'

/**
 * Create campaign (ticket 502; the prototype's Talon-shaped dialog): the name in English and
 * Arabic — both required — and the optional features, each with a line saying what it switches on.
 * Create saves a new draft through HQ and lands on its dashboard; HQ mints its code.
 *
 * A missing name is said at its field once Create has been tried, not before — an empty form is not
 * an error. A refusal from the door is shown in the dialog, verbatim, and the form is kept.
 *
 * Its second tab, From a template (ticket 503), is `./FromTemplate`; the footer's Create sends
 * whichever tab is open. A reopened dialog is on the blank tab.
 */
const FORM_ID = 'create-campaign-form'
const TEMPLATE_FORM_ID = 'create-campaign-template-form'
type CreateTab = 'blank' | 'template'
const TABS: readonly CreateTab[] = ['blank', 'template']

export default function CreateCampaignDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('campaign-list')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CreateCampaignForm>(EMPTY_CREATE_FORM)
  const [tried, setTried] = useState(false)
  const [tab, setTab] = useState<CreateTab>('blank')

  const create = useMutation({
    mutationFn: ruleCampaignApi.save,
    onSuccess: (draft) => rememberNewDraft(queryClient, draft),
  })
  const fromTemplatePending = useIsMutating({ mutationKey: TEMPLATE_CREATE_KEY }) > 0
  const pending = create.isPending || fromTemplatePending

  /** Back to an empty form, on the way out, so a reopened dialog never shows the last one. */
  const clear = () => {
    setForm(EMPTY_CREATE_FORM)
    setTried(false)
    setTab('blank')
    create.reset()
  }

  // The campaigns listed: Create refuses one's id (a disabled campaign with no draft is not listed
  // until HQ has a list door, BO ask A).
  const listed = useQuery(ruleCampaignsQuery()).data
  const taken = useMemo(() => (listed ?? []).map((r) => r.campaign), [listed])
  const problems = createFormProblems(form, taken)
  const shown = (p: CreateFormProblem) => tried && problems.includes(p)
  // The id's own problem shows at once while it is typed (a reserved word, a bad character), and
  // an empty id once Create is pressed.
  const idProblem = problems.find((p): p is CampaignIdProblem => p.startsWith('id') && (tried || p !== 'idRequired')) ?? null
  const set = (change: Partial<CreateCampaignForm>) => {
    setForm((f) => ({ ...f, ...change }))
    // A refusal was about the form as it was sent; an edit makes it stale.
    if (create.isError) create.reset()
  }

  const close = () => {
    if (pending) return
    clear()
    onClose()
  }
  const submit = () => {
    setTried(true)
    if (problems.length || create.isPending) return
    // Landing on the draft rides on THIS call's success, which does not fire once the list has
    // unmounted: a user who left during a slow create is not pulled back to the draft.
    create.mutate(toCreateSave(form), {
      onSuccess: (draft) => {
        notify.success(t('create.done'))
        clear()
        onClose()
        navigate(campaignPath(draft.code))
      },
    })
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('create.title')}
      width="34rem"
      footer={
        <>
          <Button variant="text" disabled={pending} onClick={close}>
            {t('create.cancel')}
          </Button>
          {/* The form's own submit button (by `form=`), so Enter in a name field sends it too. */}
          <Button type="submit" form={tab === 'blank' ? FORM_ID : TEMPLATE_FORM_ID} variant="primary" disabled={pending} data-create-submit="">
            {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t('create.submit')}
          </Button>
        </>
      }
    >
      <div role="tablist" aria-label={t('create.tabs.label')} className="mb-3 flex gap-1 border-b border-border/60" data-create-tabs="">
        {TABS.map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            id={`create-tab-${x}`}
            aria-selected={tab === x}
            aria-controls={`create-panel-${x}`}
            disabled={pending}
            onClick={() => setTab(x)}
            data-create-tab={x}
            className={
              '-mb-px border-b-2 px-3 py-2 text-sm transition-colors ' +
              (tab === x ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t(`create.tabs.${x}`)}
          </button>
        ))}
      </div>
      {tab === 'template' ? (
        <div role="tabpanel" id="create-panel-template" aria-labelledby="create-tab-template">
          <FromTemplate
            formId={TEMPLATE_FORM_ID}
            onCreated={() => {
              clear()
              onClose()
            }}
          />
        </div>
      ) : (
        <div role="tabpanel" id="create-panel-blank" aria-labelledby="create-tab-blank">
          <form
            id={FORM_ID}
            className="flex flex-col gap-3"
            data-create-campaign=""
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <NameField
              id="create-name-en"
              label={t('create.nameEn')}
              placeholder={t('create.nameEnPlaceholder')}
              value={form.nameEn}
              onChange={(nameEn) => set({ nameEn })}
              error={shown('nameEnRequired') ? t('create.problem.nameEnRequired') : null}
              dir="ltr"
              data="nameEn"
            />
            <NameField
              id="create-name-ar"
              label={t('create.nameAr')}
              placeholder={t('create.nameArPlaceholder')}
              value={form.nameAr}
              onChange={(nameAr) => set({ nameAr })}
              error={shown('nameArRequired') ? t('create.problem.nameArRequired') : null}
              dir="rtl"
              data="nameAr"
            />
            <NameField
              id="create-id"
              label={t('create.id')}
              placeholder={t('create.idPlaceholder')}
              value={formId(form)}
              onChange={(id) => set({ id, idEdited: true })}
              error={idProblem ? t(`create.problem.${idProblem}`) : null}
              dir="ltr"
              data="id"
            />
            <p className="text-xs text-muted-foreground">{t('create.idHint')}</p>

            <fieldset className="flex flex-col gap-2 rounded-md border border-border/60 p-3" data-create-features="">
              <legend className="px-1 text-xs font-medium text-muted-foreground">{t('create.features.legend')}</legend>
              <Feature checked={form.coupons} onChange={(coupons) => set({ coupons })} data="coupons" hint={t('create.features.couponsHint')}>
                {t('create.features.coupons')}
              </Feature>
              <Feature checked={form.points} onChange={(points) => set({ points })} data="points" hint={t('create.features.pointsHint')}>
                {t('create.features.points')}
              </Feature>
            </fieldset>
            <p className="text-xs text-muted-foreground">{t('create.later')}</p>

            {create.isError && (
              <ErrorBanner className="p-2.5" title={t('create.failedTitle')} message={apiErrorMessage(create.error, t('create.failed'))} />
            )}
          </form>
        </div>
      )}
    </Modal>
  )
}

function NameField({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  dir,
  data,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  error: string | null
  dir: 'ltr' | 'rtl'
  data: string
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
        placeholder={placeholder}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        data-create-field={data}
        className={
          'h-9 w-full rounded-md border bg-background px-2.5 text-sm text-foreground focus:outline-none ' +
          (error ? 'border-danger-border focus:border-danger' : 'border-border/60 focus:border-primary/50')
        }
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger-800" data-create-problem={data}>
          {error}
        </p>
      )}
    </div>
  )
}

function Feature({
  checked,
  onChange,
  hint,
  data,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  hint: string
  data: string
  children: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} data-create-feature={data} />
      <span className="flex flex-col">
        <span className="font-medium">{children}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  )
}
