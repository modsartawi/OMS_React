import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Bookmark, Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { AdviseReply, KeptRun } from '@/core/models/sourcing-run'
import { notify } from '@/core/services/notify'
import { KEPT_RUNS_PATH } from '@/core/sourcing-advisor/simulator-path'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { keptRunsQuery, simulatorApi } from './api'
import CopyRunLink from './CopyRunLink'
import { KEPT_NAME_MAX, keepOffer, keepProblem } from './kept-runs-model'

/**
 * "Keep and name this run" (ticket 969, BackOffice spec 4354 §12; BackOffice 4380). The run on screen is held 30
 * minutes as a working copy with no link; kept under a name, its full record is stored for good with a link any holder
 * of the run grant can open. Keyed by the run by its caller, so a new run starts unkept.
 */
export default function KeepRun({ reply, stored }: { reply: AdviseReply; stored: boolean }) {
  const { t } = useTranslation('sourcing-simulator')
  const queryClient = useQueryClient()
  const [asking, setAsking] = useState(false)
  const [name, setName] = useState('')
  const [tried, setTried] = useState(false)
  const [kept, setKept] = useState<KeptRun | null>(null)
  const keep = useMutation({
    mutationFn: (n: string) => simulatorApi.keepRun({ runId: reply.runId, name: n }),
    onSuccess: (run) => {
      setKept(run)
      setAsking(false)
      notify.success(t('kept.keep.done'))
      void queryClient.invalidateQueries({ queryKey: keptRunsQuery().queryKey })
    },
  })
  const offer = keepOffer(reply, stored)
  if (offer === 'stored') return null

  const problem = keepProblem(name)
  const problemText = problem === 'noName' ? t('kept.keep.dialog.noName') : problem === 'tooLong' ? t('kept.keep.dialog.tooLong', { max: KEPT_NAME_MAX }) : undefined
  const submit = () => {
    setTried(true)
    if (!problem) keep.mutate(name.trim())
  }

  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-3 py-2 text-xs" data-keep-run={offer}>
      {kept ? (
        <span className="flex flex-wrap items-center gap-2" data-keep-done={kept.runId}>
          <Bookmark className="size-3.5 text-primary" aria-hidden />
          {t('kept.keep.kept')}
          <b>
            <bdi>{kept.name}</bdi>
          </b>
          <CopyRunLink runId={kept.runId} />
          <Link to={KEPT_RUNS_PATH} className="text-primary underline underline-offset-2" data-kept-runs-link="">
            {t('kept.link')}
          </Link>
        </span>
      ) : offer === 'notHeld' ? (
        <span className="text-muted-foreground" data-keep-not-held="">
          {t('kept.keep.notHeld')}
        </span>
      ) : (
        <>
          {reply.held && <span className="text-muted-foreground">{t('kept.keep.held', { time: fsi(reply.held.until.slice(11, 16)) })}</span>}
          <Button
            variant="outlined"
            className="ms-auto"
            onClick={() => {
              keep.reset()
              setTried(false)
              setAsking(true)
            }}
            data-keep-open=""
          >
            <Bookmark className="size-3.5" aria-hidden />
            {t('kept.keep.button')}
          </Button>
        </>
      )}
      <Modal
        open={asking}
        onClose={() => setAsking(false)}
        title={t('kept.keep.dialog.title')}
        dismissable={!keep.isPending}
        footer={
          <>
            <Button variant="outlined" onClick={() => setAsking(false)} disabled={keep.isPending}>
              {t('kept.keep.dialog.cancel')}
            </Button>
            <Button variant="primary" onClick={submit} disabled={keep.isPending} data-keep-confirm="">
              {keep.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t('kept.keep.dialog.keep')}
            </Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Field label={t('kept.keep.dialog.name')} error={tried ? problemText : undefined} invalid={tried && !!problem}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('kept.keep.dialog.namePlaceholder')} autoFocus data-keep-name="" />
          </Field>
          <p className="text-xs text-muted-foreground">{t('kept.keep.dialog.hint')}</p>
          {keep.isError && (
            <ErrorBanner
              className="px-3 py-2"
              message={apiErrorCode(keep.error) === 'ADVISE-404' ? t('kept.keep.gone') : apiErrorMessage(keep.error, t('kept.keep.failed'))}
            />
          )}
        </form>
      </Modal>
    </section>
  )
}
