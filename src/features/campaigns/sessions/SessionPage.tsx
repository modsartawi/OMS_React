import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { RuleSessionLookup, RuleSupportCancelReply } from '@/core/models/rule-session'
import { ruleSessionQuery } from '@/core/rules/api'
import { moneyText } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatNumber } from '@/core/util/number-format'
import CancelSessionDialog, { RollbackPanel } from './CancelSessionDialog'
import SessionCampaigns from './SessionCampaigns'
import SessionCart from './SessionCart'
import SessionEvents from './SessionEvents'
import { SESSION_STATUS_SEV, backPath, canCancelSession } from './session-query'
import { sessionTotals } from './session-read'
import { momentDay, momentText } from './timeline'

type Tab = 'events' | 'cart' | 'campaigns'
const TABS: readonly Tab[] = ['events', 'cart', 'campaigns']

/**
 * One customer session (tickets 518, 527, BackOffice 2760), looked up by its sale id through
 * `GET Rules/Support/Session`: its header, then three tabs — Events (every call, journal line and
 * budget event), Cart items (each line's effects and units) and Campaigns (what each campaign did
 * and was refused). **Cancel session** is drawn on a session that holds something to roll back.
 * There is no access probe for `RuleSupport` 02 yet (BO ask B, ticket 529): a reader without the
 * grant meets the door's bare 403, which the dialog explains. It asks why first, then the page
 * shows HQ's rollback.
 */
export default function SessionPage() {
  const { t } = useTranslation('rule-sessions')
  const { saleId = '' } = useParams()
  const { state } = useLocation()
  const session = useQuery(ruleSessionQuery(saleId))
  const [tab, setTab] = useState<Tab>('events')
  const [cancelling, setCancelling] = useState(false)
  // HQ's cancel answer, kept for the sale id it was asked for.
  const [cancelled, setCancelled] = useState<{ saleId: string; result: RuleSupportCancelReply } | null>(null)

  const s = session.data
  const row = s?.session
  const back = backPath(state, row ? { store: row.storeCode, date: momentDay(row.openedAt), status: null } : null)
  const mayCancel = !!row && canCancelSession(row.state)
  const denied = isBareDenial(session.error)

  return (
    <section className="flex w-full max-w-7xl flex-col gap-4" data-session-page={saleId}>
      <Link to={back} className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground" data-session-back="">
        <ArrowLeft className="size-3.5 rtl:-scale-x-100" aria-hidden />
        {t('detail.back')}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-lg font-semibold tracking-tight">
            <Ltr>{saleId}</Ltr>
          </h1>
          {row && (
            <span data-session-status={row.state}>
              <StatusBadge sev={SESSION_STATUS_SEV[row.state]}>{t(`status.${row.state}`)}</StatusBadge>
            </span>
          )}
        </div>
        {mayCancel && (
          <Button variant="danger" onClick={() => setCancelling(true)} data-session-cancel-open="">
            {t('cancel.open')}
          </Button>
        )}
      </header>

      {session.isPending && (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t('detail.loading')}
        </p>
      )}
      {session.isError && (
        <ErrorBanner className="p-2.5" title={t('detail.failedTitle')} message={denied ? t('detail.denied') : apiErrorMessage(session.error, t('detail.failed'))} />
      )}

      {s && row && (
        <>
          {cancelled?.saleId === saleId && <RollbackPanel result={cancelled.result} session={s} />}
          <Header session={s} />

          <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1">
            {TABS.map((k) => (
              <Chip key={k} variant="tab" on={tab === k} onClick={() => setTab(k)} data-session-tab={k}>
                {t(`tabs.${k}`)}
              </Chip>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'events' && <SessionEvents session={s} />}
            {tab === 'cart' && <SessionCart session={s} />}
            {tab === 'campaigns' && <SessionCampaigns session={s} />}
          </div>
        </>
      )}

      {cancelling && row && (
        <CancelSessionDialog
          saleId={saleId}
          state={row.state}
          onClose={() => setCancelling(false)}
          onCancelled={(result) => {
            setCancelled({ saleId, result })
            setCancelling(false)
          }}
        />
      )}
    </section>
  )
}

/** The session's facts: where, which ruleset, when each stamp was reached, and its money. */
function Header({ session: s }: { session: RuleSessionLookup }) {
  const { t } = useTranslation('rule-sessions')
  const row = s.session
  const totals = sessionTotals(s)
  const money = (n: number) => moneyText({ amount: n, currency: row.currency })
  // A stamp the session never reached is null: it is not shown at all.
  const stamps: [string, string | null][] = [
    ['opened', row.openedAt],
    ['paid', row.paidAt],
    ['closed', row.closedAt],
    ['returnedAt', row.returnedAt],
    ['cancelledAt', row.cancelledAt],
    ['updated', row.updatedAt],
  ]
  const facts: [string, string][] = [
    ['store', row.storeCode],
    ['channel', row.channel],
    ['ruleset', formatNumber(row.rulesetVersion)],
    ...(row.couponCode ? ([['coupon', row.couponCode]] as [string, string][]) : []),
    ...stamps.map(([k, at]): [string, string] => [k, momentText(at)]).filter(([, v]) => v !== ''),
    ...(totals
      ? ([
          ['before', money(totals.before)],
          ['discount', money(totals.discount)],
          ['net', money(totals.net)],
        ] as [string, string][])
      : []),
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4" data-session-facts="">
      {facts.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5" data-session-fact={k}>
          <dt className="text-xs text-muted-foreground">{t(`detail.${k}`)}</dt>
          <dd className={k === 'net' ? 'text-base font-semibold' : 'text-sm'}>
            <Ltr>{v}</Ltr>
          </dd>
        </div>
      ))}
    </dl>
  )
}
