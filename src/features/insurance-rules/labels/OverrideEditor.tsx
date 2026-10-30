import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2 } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { ByAt } from '@/core/insurance-rules/parts'
import { notify } from '@/core/services/notify'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { LABELS_KEY, labelsApi } from './api'
import type { LabelText } from './labels'
import { approveStanding, overrideBody, overrideProblems, pendingFor, type LabelOverride, type OverrideForm } from './overrides'
import { Label } from './WorkbookUpload'

/** A code from the worklist or a proposal, or `new` for a code named by hand (a corrected English label). */
export type EditorTarget = { kind: 'new' } | { kind: 'code'; system: string; code: string; current?: LabelText | null }

/**
 * The override editor (ticket 707). A code with a proposal waiting shows that proposal for a second person to approve;
 * any other code takes one. There is no translate action, and the boxes start empty, so nobody approves words no
 * person wrote.
 */
export default function OverrideEditor({ target, proposals, onClose }: { target: EditorTarget; proposals: LabelOverride[]; onClose: () => void }) {
  const waiting = target.kind === 'code' ? pendingFor(proposals, target.system, target.code) : undefined
  return waiting ? <ReviewProposal override={waiting} current={target.kind === 'code' ? target.current : null} onClose={onClose} /> : <ProposeLabel target={target} onClose={onClose} />
}

/** The refusal, in the door's words; a bare 403 says no access. */
function Refusal({ error, fallback }: { error: unknown; fallback: string }) {
  const { t } = useTranslation('insurance-labels')
  return (
    <div data-override-refused="">
      <ErrorBanner className="p-3" message={isBareDenial(error) ? t('access.deniedTitle') : apiErrorMessage(error, fallback)} />
    </div>
  )
}

function CodeLine({ system, code }: { system: string; code: string }) {
  const { t } = useTranslation('insurance-labels')
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-xs text-muted-foreground">{t('worklist.code')}</dt>
      <dd data-override-code="">
        <Ltr>{code}</Ltr>
      </dd>
      <dt className="text-xs text-muted-foreground">{t('worklist.system')}</dt>
      <dd className="break-all text-xs" data-override-system="">
        <Ltr>{system}</Ltr>
      </dd>
    </dl>
  )
}

function ProposeLabel({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const { t } = useTranslation('insurance-labels')
  const qc = useQueryClient()
  const known = target.kind === 'code' ? target : null
  const [form, setForm] = useState<OverrideForm>({ system: known?.system ?? '', code: known?.code ?? '', en: '', ar: '' })
  const [tried, setTried] = useState(false)
  const problems = overrideProblems(form)
  const shown = tried ? problems : []
  const propose = useMutation({
    mutationFn: () => labelsApi.propose(overrideBody(form)),
    onSuccess: async (o) => {
      notify.success(t('override.proposed'), t('override.proposedDetail', { code: fsi(o.code) }))
      await qc.invalidateQueries({ queryKey: LABELS_KEY })
      onClose()
    },
  })
  const set = (patch: Partial<OverrideForm>) => {
    if (propose.isError) propose.reset()
    setForm((f) => ({ ...f, ...patch }))
  }
  const submit = () => {
    setTried(true)
    if (problems.length === 0 && !propose.isPending) propose.mutate()
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="36rem"
      title={t('override.writeTitle')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('override.cancel')}
          </Button>
          <Button variant="primary" aria-disabled={propose.isPending} onClick={submit} data-override-submit="">
            {propose.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {t('override.submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-override-editor="">
        {known ? (
          <>
            <CodeLine system={known.system} code={known.code} />
            <div className="text-sm" data-override-current="">
              <div className="text-xs text-muted-foreground">{t('override.current')}</div>
              <Label text={known.current} />
            </div>
          </>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1fr_8rem]">
            <Field label={t('worklist.system')} error={shown.includes('systemMissing') ? t('problem.systemMissing') : undefined}>
              <Input dir="ltr" value={form.system} onChange={(e) => set({ system: e.target.value })} data-override-system-input="" />
            </Field>
            <Field label={t('worklist.code')} error={shown.includes('codeMissing') ? t('problem.codeMissing') : undefined}>
              <Input dir="ltr" value={form.code} onChange={(e) => set({ code: e.target.value })} data-override-code-input="" />
            </Field>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t('override.hint')}</p>
        <Field label={t('override.ar')}>
          <Input dir="rtl" lang="ar" value={form.ar} onChange={(e) => set({ ar: e.target.value })} data-override-ar="" />
        </Field>
        <Field label={t('override.en')}>
          <Input dir="ltr" lang="en" value={form.en} onChange={(e) => set({ en: e.target.value })} data-override-en="" />
        </Field>
        {shown.includes('labelMissing') && (
          <p className="text-xs text-danger-800" role="alert" data-override-problem="labelMissing">
            {t('problem.labelMissing')}
          </p>
        )}
        {propose.isError && <Refusal error={propose.error} fallback={t('override.proposeFailed')} />}
      </div>
    </Modal>
  )
}

function ReviewProposal({ override, current, onClose }: { override: LabelOverride; current?: LabelText | null; onClose: () => void }) {
  const { t } = useTranslation('insurance-labels')
  const qc = useQueryClient()
  const userId = useSession((s) => s.userId)
  const standing = approveStanding(override, userId)
  const approve = useMutation({
    mutationFn: () => labelsApi.approve(override.id),
    onSuccess: async () => {
      notify.success(t('override.approved'), t('override.approvedDetail', { code: fsi(override.code) }))
      await qc.invalidateQueries({ queryKey: LABELS_KEY })
      onClose()
    },
  })

  return (
    <Modal
      open
      onClose={onClose}
      width="36rem"
      title={t('override.reviewTitle')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('override.cancel')}
          </Button>
          {standing === 'may' && (
            <Button variant="primary" aria-disabled={approve.isPending} onClick={() => !approve.isPending && approve.mutate()} data-override-approve="">
              {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
              {t('override.approve')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3" data-override-review="">
        <CodeLine system={override.system} code={override.code} />
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div data-override-current="">
            <div className="text-xs text-muted-foreground">{t('override.current')}</div>
            <Label text={override.current ?? current} />
          </div>
          <div data-override-proposed="">
            <div className="text-xs text-muted-foreground">{t('proposals.proposed')}</div>
            <Label text={override} />
          </div>
        </div>
        <div className="text-xs text-muted-foreground" data-override-by="">
          <ByAt by={override.proposedBy} at={override.proposedAt} />
        </div>
        <p className="text-xs text-muted-foreground">{t('override.approveHint')}</p>
        {standing === 'ownProposal' && (
          <p className="text-xs text-muted-foreground" data-override-why="">
            {t('override.own')}
          </p>
        )}
        {approve.isError && <Refusal error={approve.error} fallback={t('override.approveFailed')} />}
      </div>
    </Modal>
  )
}
