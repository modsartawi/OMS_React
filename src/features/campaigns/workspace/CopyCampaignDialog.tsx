import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { RuleDraft } from '@/core/models/rule-campaign'
import { rememberNewDraft, ruleCampaignApi } from '@/core/rules/api'
import { campaignIdProblem, copyIdOf } from '@/core/rules/campaign-id'
import { campaignPath } from '@/core/rules/campaign-state'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'

const FORM_ID = 'copy-campaign-form'

/**
 * Copy campaign (tickets 502, 524; `Drafts/Copy { from, campaign, name? }`): the author picks the
 * copy's id — offered as the source's with `-COPY` — and its name in both languages, offered as the
 * source's. HQ makes an independent draft (its budgets count under its own id, no evaluation order),
 * and the copy opens on its own dashboard; the source is untouched. An id another campaign holds is
 * HQ's `RULES_CAMPAIGN_EXISTS`, shown in the dialog (ticket 535 dropped the client's pre-check).
 */
export default function CopyCampaignDialog({ source, onClose }: { source: RuleDraft; onClose: () => void }) {
  const { t } = useTranslation('campaign-workspace')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [id, setId] = useState(() => copyIdOf(source.code))
  const [nameEn, setNameEn] = useState(source.campaign.name.en)
  const [nameAr, setNameAr] = useState(source.campaign.name.ar)
  const [tried, setTried] = useState(false)

  const idProblem = campaignIdProblem(id.trim())
  const enMissing = !nameEn.trim()
  const arMissing = !nameAr.trim()

  const copy = useMutation({
    mutationFn: () => ruleCampaignApi.copy({ from: source.code, campaign: id.trim(), name: { en: nameEn.trim(), ar: nameAr.trim() } }),
    onSuccess: (draft) => rememberNewDraft(queryClient, draft),
  })

  const close = () => !copy.isPending && onClose()
  const submit = () => {
    setTried(true)
    if (idProblem || enMissing || arMissing || copy.isPending) return
    // Opening the copy rides on THIS call's success, which does not fire once the dialog has
    // unmounted: a user who moved on is not pulled to the copy.
    copy.mutate(undefined, {
      onSuccess: (copied) => {
        notify.success(t('actions.copied'))
        onClose()
        navigate(campaignPath(copied.code))
      },
    })
  }

  return (
    <Modal
      open
      onClose={close}
      title={t('copy.title')}
      width="32rem"
      footer={
        <>
          <Button variant="text" disabled={copy.isPending} onClick={close} data-copy-cancel="">
            {t('copy.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" disabled={copy.isPending} data-copy-submit="">
            {copy.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t('copy.submit')}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="flex flex-col gap-3"
        noValidate
        data-copy-campaign=""
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <p className="text-sm text-muted-foreground">{t('copy.intro')}</p>
        <Field id="copy-id" label={t('copy.id')} value={id} dir="ltr" data="id" onChange={(v) => { setId(v); copy.reset() }} problem={idProblem && (tried || idProblem !== 'idRequired') ? t(`copy.problem.${idProblem}`) : null} />
        <p className="-mt-2 text-xs text-muted-foreground">{t('copy.idHint')}</p>
        <Field id="copy-name-en" label={t('copy.nameEn')} value={nameEn} dir="ltr" data="nameEn" onChange={(v) => { setNameEn(v); copy.reset() }} problem={tried && enMissing ? t('copy.problem.nameEnRequired') : null} />
        <Field id="copy-name-ar" label={t('copy.nameAr')} value={nameAr} dir="rtl" data="nameAr" onChange={(v) => { setNameAr(v); copy.reset() }} problem={tried && arMissing ? t('copy.problem.nameArRequired') : null} />
        {copy.isError && (
          <div data-copy-refusal="">
            <ErrorBanner className="p-2.5" title={t('actions.copyFailed')} message={isBareDenial(copy.error) ? t('copy.denied') : apiErrorMessage(copy.error, t('actions.tryAgain'))} />
          </div>
        )}
      </form>
    </Modal>
  )
}

function Field({
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
        required
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-problem` : undefined}
        data-copy-field={data}
        className={
          'h-9 w-full rounded-md border bg-background px-2.5 text-sm text-foreground focus:outline-none ' +
          (problem ? 'border-danger-border focus:border-danger' : 'border-border/60 focus:border-primary/50')
        }
      />
      {problem && (
        <p id={`${id}-problem`} className="text-xs text-danger-800" data-copy-problem={data}>
          {problem}
        </p>
      )}
    </div>
  )
}
