import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { RuleSession, RuleSessionRollback } from '@/core/models/rule-campaign'
import { ruleSessionAccessQuery, ruleSessionQuery } from '@/core/rules/api'
import { moneyText } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import CancelSessionDialog, { RollbackPanel } from './CancelSessionDialog'
import SessionCampaigns from './SessionCampaigns'
import SessionCart from './SessionCart'
import SessionEvents from './SessionEvents'
import { SESSION_STATUS_SEV, backPath, canCancelSession } from './session-query'
import { momentDay, momentText } from './timeline'

type Tab = 'events' | 'cart' | 'campaigns'
const TABS: readonly Tab[] = ['events', 'cart', 'campaigns']

/**
 * One customer session (ticket 518, BackOffice spec 2737), looked up by its sale id: its header,
 * then three tabs — Events (every call and the movements it caused), Cart items (each line's effects
 * and unit allocation) and Campaigns (each campaign's outcome). **Cancel session** is drawn only for
 * support holding the permission (`RuleCampaign/SessionAccess`, failing closed); it asks first, and
 * then the page shows HQ's rollback.
 */
export default function SessionPage() {
  const { t } = useTranslation('rule-sessions')
  const { saleId = '' } = useParams()
  const { state } = useLocation()
  const session = useQuery(ruleSessionQuery(saleId))
  const access = useQuery(ruleSessionAccessQuery())
  const [tab, setTab] = useState<Tab>('events')
  const [cancelling, setCancelling] = useState(false)
  // HQ's rollback, kept for the sale id it was asked for.
  const [rollback, setRollback] = useState<{ saleId: string; rollback: RuleSessionRollback } | null>(null)

  const s = session.data
  const back = backPath(state, s ? { store: s.store, date: momentDay(s.created), status: null } : null)
  const mayCancel = !!s && access.data?.canCancel === true && canCancelSession(s.status)

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
          {s && (
            <span data-session-status={s.status}>
              <StatusBadge sev={SESSION_STATUS_SEV[s.status]}>{t(`status.${s.status}`)}</StatusBadge>
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
        <ErrorBanner className="p-2.5" title={t('detail.failedTitle')} message={apiErrorMessage(session.error, t('detail.failed'))} />
      )}

      {s && (
        <>
          {rollback?.saleId === saleId && <RollbackPanel rollback={rollback.rollback} currency={s.currency} />}
          <Header session={s} />

          <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1 border-b border-border">
            {TABS.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-medium ${tab === k ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                onClick={() => setTab(k)}
                data-session-tab={k}
              >
                {t(`tabs.${k}`)}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'events' && <SessionEvents session={s} />}
            {tab === 'cart' && <SessionCart session={s} />}
            {tab === 'campaigns' && <SessionCampaigns session={s} />}
          </div>
        </>
      )}

      {cancelling && s && (
        <CancelSessionDialog
          saleId={saleId}
          onClose={() => setCancelling(false)}
          onCancelled={(result) => {
            setRollback({ saleId, rollback: result.rollback })
            setCancelling(false)
          }}
        />
      )}
    </section>
  )
}

/** The session's facts: where and who, when, and its money. */
function Header({ session: s }: { session: RuleSession }) {
  const { t } = useTranslation('rule-sessions')
  const money = (n: number) => moneyText({ amount: n, currency: s.currency })
  const facts: [string, string, boolean][] = [
    ['store', s.store, true],
    ['channel', s.channel, true],
    ['member', s.memberId ?? t('walkIn'), !!s.memberId],
    ['created', momentText(s.created), true],
    ['lastActivity', momentText(s.lastActivity), true],
    ['gross', money(s.gross), true],
    ['discount', money(s.discount), true],
    ['net', money(s.net), true],
  ]
  return (
    <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4" data-session-facts="">
      {facts.map(([k, v, machine]) => (
        <div key={k} className="flex flex-col gap-0.5" data-session-fact={k}>
          <dt className="text-xs text-muted-foreground">{t(`detail.${k}`)}</dt>
          <dd className={k === 'net' ? 'text-base font-semibold' : 'text-sm'}>{machine ? <Ltr>{v}</Ltr> : v}</dd>
        </div>
      ))}
    </dl>
  )
}
