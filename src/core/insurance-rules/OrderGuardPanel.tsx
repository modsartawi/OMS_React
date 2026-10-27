import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import CoreReasonDialog from '@/core/reason/ReasonDialog'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import GuardDialog, { type GuardLineItem } from './GuardDialog'
import { guardAnswer } from './guard-answer'
import type { OrderGuards, OrderGuardState } from './guard-check'
import { guardHeld } from './order-guards'
import { orderGuardsApi } from './order-guards-api'
import { ORDER_GUARD_STATE_SEV } from './tones'


/** An order's guard state as a pill ("Guard check: action needed"); nothing for `none` or absent. */
export function OrderGuardStateBadge({ state }: { state: OrderGuardState | null | undefined }) {
  const { t } = useTranslation('insurance-order-guards')
  if (!state || state === 'none') return null
  return (
    <span data-guard-state={state}>
      <StatusBadge sev={ORDER_GUARD_STATE_SEV[state] ?? 'mute'}>{t(`state.${state}`)}</StatusBadge>
    </span>
  )
}

/**
 * The guard check of an insured OMS order on Delivery details (BackOffice 3142/3143, oms ticket 616): where
 * it stands, how many lines need an answer, and its three acts — answer the guards (the dialog), check
 * again (`…/Guards/Recheck`, after the order's lines were changed), and, with the release grant, release
 * an order held for its guard check (`…/Guards/Release` with a reason). Drawn only for an order that has a
 * guard check. Every act tells the page (`onChanged`), which reads the order again.
 */
export default function OrderGuardPanel({
  documentNo,
  state,
  guards,
  lineItem,
  canOverride,
  canRelease,
  onChanged,
}: {
  documentNo: string
  state: OrderGuardState | null | undefined
  guards: OrderGuards | null | undefined
  lineItem: (line: number) => GuardLineItem | null
  canOverride: boolean
  canRelease: boolean
  onChanged: () => void
}) {
  const { t } = useTranslation('insurance-order-guards')
  const [answerOpen, setAnswerOpen] = useState(false)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const recheck = useMutation({
    mutationFn: () => orderGuardsApi.recheck(documentNo),
    onSuccess: () => {
      notify.success(t('panel.recheckDone'))
      onChanged()
    },
    onError: (err) => notify.apiError(t('panel.recheckFailed'), err, t('guard.failedHint')),
  })
  const release = useMutation({
    mutationFn: (reason: string) => orderGuardsApi.release(documentNo, { reason }),
    onSuccess: () => {
      setReleaseOpen(false)
      notify.success(t('release.done'), t('release.doneDetail', { order: fsi(documentNo) }))
      onChanged()
    },
  })

  const items = guards ? guardAnswer({ guards, reasons: null, drafts: {}, user: '', canOverride }).items : []
  const linesToAnswer = new Set(items.filter((i) => i.need !== 'exception').map((i) => i.line)).size
  if ((!state || state === 'none') && linesToAnswer === 0) return null
  const held = guardHeld(state)

  return (
    <section className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/60 bg-card px-3 py-2" data-order-guards={state ?? ''}>
      <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden />
      <span className="text-sm font-semibold">{t('panel.title')}</span>
      <OrderGuardStateBadge state={state} />
      {state && state !== 'none' && (
        <span className="text-xs text-muted-foreground" data-order-guards-hint="">
          {t(`panel.hint.${state}`)}
        </span>
      )}
      {linesToAnswer > 0 && (
        <span className="text-xs font-medium" data-order-guards-lines={linesToAnswer}>
          {t('panel.lines', { count: linesToAnswer })}
        </span>
      )}
      <span className="ms-auto flex flex-wrap gap-2">
        {guards && linesToAnswer > 0 && (
          <Button variant="primary" onClick={() => setAnswerOpen(true)} data-order-guards-answer="">
            {t('panel.answer')}
          </Button>
        )}
        <Button variant="outlined" disabled={recheck.isPending} onClick={() => recheck.mutate()} data-order-guards-recheck="">
          {recheck.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
          {recheck.isPending ? t('panel.rechecking') : t('panel.recheck')}
        </Button>
        {canRelease && held && (
          <Button variant="danger-outlined" onClick={() => setReleaseOpen(true)} data-order-guards-release="">
            {t('panel.release')}
          </Button>
        )}
      </span>

      {guards && (
        <GuardDialog
          open={answerOpen}
          guards={guards}
          lineItem={lineItem}
          canOverride={canOverride}
          onClose={() => setAnswerOpen(false)}
          onAnswered={(r) => {
            setAnswerOpen(false)
            notify.success(t('guard.sent'), t('guard.sentDetail', { id: fsi(r.decisionId) }))
            onChanged()
          }}
        />
      )}
      <CoreReasonDialog
        ns="insurance-order-guards"
        reasonRefusal={() => null}
        open={releaseOpen}
        title={t('release.title')}
        note={<Trans t={t} i18nKey="release.note" values={{ order: documentNo }} components={{ d: <Ltr /> }} />}
        busy={release.isPending}
        error={release.error}
        danger
        confirmLabel={t('release.confirm')}
        onEdit={() => release.isError && release.reset()}
        onConfirm={(reason) => release.mutate(reason)}
        onClose={() => {
          setReleaseOpen(false)
          release.reset()
        }}
      />
    </section>
  )
}
