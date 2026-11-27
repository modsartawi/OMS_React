import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { ChevronLeft, FlaskConical, Loader2, Route } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { usePermissions } from '@/core/permissions'
import { canOpenStoredRun, canRunSourcingAdvisor, canViewSourcingAdvisor } from '@/core/sourcing-advisor/access'
import { buttonClass, iconButtonClass } from '@/core/ui/control-classes'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatDateTime } from '@/core/util/date-format'
import { orderLinkApi } from './api'
import { askedNumber, oldOrderLinkAnswer, storedLineKey } from './old-order-link-model'

/** The comparison results page (ticket 971), which the menu's "Sourcing advisor" opens. */
const RESULTS_PATH = '/oms/sourcing-results'

/**
 * OMS ▸ the retired advisor's order link, `/oms/sourcing-advisor/order/:orderNo` (ticket 974, BackOffice 4397, spec 4354
 * §20). Delivery details' "Why this store?" and any link kept from the old advisor land here. The order's stored run
 * opens in the simulator; with none, the page says so and offers a replay (`./old-order-link-model`). Under the
 * advisor view grant, as the door is; the simulator itself needs the run grant.
 */
export default function OldOrderLinkPage() {
  const { t } = useTranslation('sourcing-order-link')
  return (
    <ScreenGate can={canViewSourcingAdvisor} ns="sourcing-order-link" title={t('title')} subtitle={t('subtitle')}>
      <OrderLink />
    </ScreenGate>
  )
}

function OrderLink() {
  const { t } = useTranslation('sourcing-order-link')
  const permissions = usePermissions()
  const asked = askedNumber(useParams().orderNo)
  const run = useQuery({
    queryKey: ['sourcing-order-link', asked],
    queryFn: () => orderLinkApi.orderRun(asked!),
    enabled: asked !== null,
    retry: false,
  })

  // A blank number never asks the door (it would refuse it RESULTS-400), and a disabled query stays pending for ever.
  if (asked === null) {
    return (
      <Frame back={RESULTS_PATH} backLabel={t('backToResults')} state="no-order">
        <p className="text-sm text-muted-foreground">{t('noOrder')}</p>
      </Frame>
    )
  }
  const back = `/oms/delivery/${encodeURIComponent(asked)}`
  if (run.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-order-link="loading">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('loading')}
      </div>
    )
  }
  if (run.isError) {
    return (
      <Frame back={back} backLabel={t('backToDelivery')} state="failed">
        <ErrorBanner title={t('failedTitle')} message={apiErrorMessage(run.error, t('failed'))} className="p-4" />
      </Frame>
    )
  }

  const answer = oldOrderLinkAnswer(run.data, {
    canOpenRun: canOpenStoredRun(permissions),
    canReplay: canRunSourcingAdvisor(permissions),
  })
  if (answer.kind === 'open') return <Navigate to={answer.to} replace />

  const order = <Ltr />
  const results = (has: boolean) =>
    has && (
      <Link to={RESULTS_PATH} className={buttonClass('outlined')} data-order-link-results="">
        <Route className="h-3.5 w-3.5" aria-hidden />
        {t('openResults')}
      </Link>
    )

  if (answer.kind === 'stored') {
    return (
      <Frame back={back} backLabel={t('backToDelivery')} state="stored">
        <p className="text-sm">
          <Trans
            t={t}
            i18nKey={storedLineKey(answer.ranAt)}
            values={{ order: answer.orderNumber, ranAt: answer.ranAt ? formatDateTime(answer.ranAt) : '' }}
            components={{ order, at: <Ltr /> }}
          />
        </p>
        <p className="text-sm text-muted-foreground">{t('stored.needsRunGrant')}</p>
        <div className="flex flex-wrap gap-2">{results(answer.hasSummary)}</div>
      </Frame>
    )
  }
  if (answer.kind === 'none') {
    return (
      <Frame back={back} backLabel={t('backToDelivery')} state="none">
        <p className="text-sm">
          <Trans t={t} i18nKey="none.line" values={{ order: answer.orderNumber }} components={{ order }} />
        </p>
        {!answer.replayTo && <p className="text-sm text-muted-foreground">{t('none.needsRunGrant')}</p>}
        <div className="flex flex-wrap gap-2">
          {answer.replayTo && (
            <Link to={answer.replayTo} className={buttonClass('primary')} data-order-link-replay="">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              {t('none.replay')}
            </Link>
          )}
          {results(answer.hasSummary)}
        </div>
      </Frame>
    )
  }
  return (
    <Frame back={back} backLabel={t('backToDelivery')} state="unknown">
      <p className="text-sm">
        <Trans t={t} i18nKey="unknown" values={{ asked: answer.asked }} components={{ order }} />
      </p>
    </Frame>
  )
}

function Frame({ back, backLabel, state, children }: { back: string; backLabel: string; state: string; children: ReactNode }) {
  return (
    <div className="flex w-full max-w-3xl items-start gap-3" data-order-link={state}>
      <Link to={back} aria-label={backLabel} title={backLabel} className={iconButtonClass('outlined')} data-order-link-back="">
        <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-lg border border-border bg-card p-4">{children}</div>
    </div>
  )
}
