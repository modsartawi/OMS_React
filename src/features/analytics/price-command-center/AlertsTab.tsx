import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { formatMoneyIn } from '@/core/money'
import { PRICE_ALERT_ERRORS, type DismissAlertBody, type PriceAlertView, type PriceWatchCoverage } from '@/core/models/price-watch'
import { usePermissions } from '@/core/permissions'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { canManagePriceWatch } from './access'
import AlertMaterialCell from './AlertMaterialCell'
import {
  ALERT_STATES,
  DEFAULT_ALERT_FILTER,
  alertsRequest,
  formatGapPercent,
  recommendedView,
  refusalReloadsAlerts,
  shownAlerts,
  type AlertFilter,
  type AlertScope,
} from './alerts'
import { priceAlertsApi, priceWatchSharedApi } from './api'
import DismissDialog from './DismissDialog'

const NS = 'price-command-center'
/** Every price alert read shares this prefix, so a decision refreshes Mine and All alike. */
const ALERTS_KEY = ['price-watch', 'alerts'] as const
/** The server's default `take`: a list that long may have more behind it (no paging, no total on the wire). */
const SERVER_TAKE = 100

const STATUS_SEVERITY: Record<string, Severity> = { OPEN: 'warn', ACCEPTED: 'go', DISMISSED: 'mute', RESOLVED: 'ok' }

/**
 * The Alerts tab (oms 934, BackOffice spec 4127): the price alerts to decide, Mine by default, ranked by value at risk.
 * Accept and Dismiss need the Manage grant (`PriceWatch:06`); the server's refusals are shown like any other.
 */
export default function AlertsTab() {
  const { t } = useTranslation(NS)
  const client = useQueryClient()
  const canManage = canManagePriceWatch(usePermissions())
  const [filter, setFilter] = useState<AlertFilter>(DEFAULT_ALERT_FILTER)
  const [refusal, setRefusal] = useState<unknown>(null)
  const { scope, query } = alertsRequest(filter)

  const competitors = useQuery({ queryKey: ['price-watch', 'coverage'], queryFn: () => priceWatchSharedApi.coverage(), retry: false })
  const list = useQuery({ queryKey: [...ALERTS_KEY, scope, query], queryFn: () => priceAlertsApi.list(scope, query), retry: false })

  const decided = (sentence: string) => {
    setRefusal(null)
    toast.success(sentence)
    void client.invalidateQueries({ queryKey: ALERTS_KEY })
  }
  const refused = (err: unknown) => {
    setRefusal(err)
    // The alert moved, is no longer open or is gone: the list is reloaded so the next decision is taken on what stands now.
    if (refusalReloadsAlerts(apiErrorCode(err))) void client.invalidateQueries({ queryKey: ALERTS_KEY })
  }
  const accept = useMutation({
    mutationFn: (alert: PriceAlertView) => priceAlertsApi.accept(alert.alertId),
    onSuccess: () => decided(t('alerts.accepted')),
    onError: refused,
  })
  const [dismissing, setDismissing] = useState<PriceAlertView | null>(null)
  const dismiss = useMutation({
    mutationFn: ({ alert, body }: { alert: PriceAlertView; body: DismissAlertBody }) => priceAlertsApi.dismiss(alert.alertId, body),
    onSuccess: () => {
      setDismissing(null)
      decided(t('alerts.dismissed'))
    },
    onError: (err) => {
      // Refused inside the dialog, which stays open; a stale alert also reloads the list behind it.
      if (refusalReloadsAlerts(apiErrorCode(err))) void client.invalidateQueries({ queryKey: ALERTS_KEY })
    },
  })
  const rows = list.data ? shownAlerts(list.data, filter.state) : []
  const busyId = accept.isPending ? (accept.variables?.alertId ?? null) : dismiss.isPending ? (dismiss.variables?.alert.alertId ?? null) : null

  return (
    <div className="flex flex-col gap-3" data-price-alerts="">
      <AlertFilters filter={filter} competitors={competitors.data ?? []} onChange={setFilter} />
      {refusal != null && <DecisionRefusal err={refusal} />}
      {list.isError ? (
        <ErrorBanner className="p-3" title={t('alerts.failed')} message={apiErrorMessage(list.error, t('alerts.failedHint'))} />
      ) : list.isPending ? (
        <p className="text-sm text-muted-foreground">{t('alerts.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground" data-alerts-empty={scope}>
          {t(`alerts.empty.${scope}`)}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground" data-alerts-count={rows.length}>
            {t('alerts.count', { n: fsi(formatFigure(rows.length)) })}
            {(list.data?.length ?? 0) >= SERVER_TAKE && <> {t('alerts.capped', { take: fsi(formatFigure(SERVER_TAKE)) })}</>}
          </p>
          <AlertsTable
            rows={rows}
            canManage={canManage}
            busyId={busyId}
            onAccept={(alert) => !busyId && accept.mutate(alert)}
            onDismiss={(alert) => {
              dismiss.reset()
              setDismissing(alert)
            }}
          />
        </>
      )}
      {dismissing && (
        <DismissDialog
          key={dismissing.alertId}
          alert={dismissing}
          busy={dismiss.isPending}
          error={dismiss.error}
          onEdit={() => dismiss.error && dismiss.reset()}
          onConfirm={(body) => dismiss.mutate({ alert: dismissing, body })}
          onClose={() => setDismissing(null)}
        />
      )}
    </div>
  )
}

/** A refused decision: the server's sentence and its code; PWT-00040 says the list was reloaded. */
function DecisionRefusal({ err }: { err: unknown }) {
  const { t } = useTranslation(NS)
  const code = apiErrorCode(err)
  const changed = code === PRICE_ALERT_ERRORS.alertChanged
  return (
    <ErrorBanner className="p-3" title={t('alerts.decisionFailed')} message={changed ? t('alerts.changed') : apiErrorMessage(err, t('alerts.failedHint'))}>
      {code && (
        <span className="font-mono text-xs" data-alert-refusal={code}>
          <Ltr>{code}</Ltr>
        </span>
      )}
    </ErrorBanner>
  )
}

/** Whose (Mine / All), A-level, competitor and state — the filters the wire supports. */
export function AlertFilters({
  filter,
  competitors,
  onChange,
}: {
  filter: AlertFilter
  competitors: readonly PriceWatchCoverage[]
  onChange: (next: AlertFilter) => void
}) {
  const { t } = useTranslation(NS)
  const [category, setCategory] = useState(filter.category)
  const scopes: AlertScope[] = ['mine', 'all']
  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onChange({ ...filter, category })
      }}
      data-alert-filters=""
    >
      <div role="group" aria-label={t('alerts.scope.label')} className="flex gap-1">
        {scopes.map((s) => (
          <Chip key={s} on={filter.scope === s} onClick={() => onChange({ ...filter, scope: s })} data-alert-scope={s}>
            {t(`alerts.scope.${s}`)}
          </Chip>
        ))}
      </div>
      <Field label={t('alerts.filters.state')} className="w-56">
        <Select value={filter.state} onChange={(e) => onChange({ ...filter, state: e.target.value as AlertFilter['state'] })} data-alert-state="">
          {ALERT_STATES.map((s) => (
            <option key={s} value={s}>
              {t(`alerts.state.${s}`)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('alerts.filters.competitor')} className="w-48">
        <Select value={filter.competitor} onChange={(e) => onChange({ ...filter, competitor: e.target.value })} data-alert-competitor="">
          <option value="">{t('alerts.filters.anyCompetitor')}</option>
          {competitors.map((c) => (
            <option key={c.competitorCode} value={c.competitorCode}>
              {fsi(formatPair(c.competitorCode, c.competitorName))}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('alerts.filters.category')} hint={t('alerts.filters.categoryHint')} className="w-40">
        <Input value={category} onChange={(e) => setCategory(e.target.value)} dir="ltr" data-alert-category="" />
      </Field>
      <Button type="submit" variant="outlined">
        {t('alerts.filters.apply')}
      </Button>
    </form>
  )
}

/** The price alerts, one row each, in the order given (rank them with `shownAlerts`). */
export function AlertsTable({
  rows,
  canManage,
  busyId,
  onAccept,
  onDismiss,
}: {
  rows: readonly PriceAlertView[]
  canManage: boolean
  /** The alert whose decision is being sent, if any. */
  busyId: string | null
  onAccept: (alert: PriceAlertView) => void
  onDismiss: (alert: PriceAlertView) => void
}) {
  const { t } = useTranslation(NS)
  const th = 'px-2 py-1.5 text-start text-xs font-medium text-muted-foreground'
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-sm" data-alerts-table="">
        <thead className="bg-muted/40">
          <tr>
            <th className={th}>{t('alerts.columns.material')}</th>
            <th className={th}>{t('alerts.columns.ours')}</th>
            <th className={th}>{t('alerts.columns.competitor')}</th>
            <th className={th}>{t('alerts.columns.gap')}</th>
            <th className={th} title={t('alerts.columns.valueAtRiskHint')}>
              {t('alerts.columns.valueAtRisk')}
            </th>
            <th className={th}>{t('alerts.columns.observed')}</th>
            <th className={th}>{t('alerts.columns.recommended')}</th>
            <th className={th}>{t('alerts.columns.status')}</th>
            {canManage && <th className={th}>{t('alerts.columns.actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((alert) => (
            <AlertRow key={alert.alertId} alert={alert} canManage={canManage} busy={busyId === alert.alertId} onAccept={onAccept} onDismiss={onDismiss} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AlertRow({
  alert,
  canManage,
  busy,
  onAccept,
  onDismiss,
}: {
  alert: PriceAlertView
  canManage: boolean
  busy: boolean
  onAccept: (alert: PriceAlertView) => void
  onDismiss: (alert: PriceAlertView) => void
}) {
  const { t } = useTranslation(NS)
  const money = (v: number | null) => formatMoneyIn(v, alert.currency)
  const td = 'px-2 py-2 align-top'
  const hasOffer = alert.theirOfferPrice !== null
  // Only an OPEN price alert can be decided (else PWT-00035); the column itself shows only with the Manage grant.
  const decidable = canManage && alert.status === 'OPEN'
  return (
    <tr className="border-t border-border/60" data-alert-row={alert.alertId}>
      <td className={td}>
        <AlertMaterialCell alert={alert} />
      </td>
      <td className={td}>
        <Labelled label={t('alerts.columns.basic')} value={money(alert.ourBasicPrice)} />
        <Labelled label={t('alerts.columns.effective')} value={money(alert.ourEffectivePrice)} strong />
      </td>
      <td className={td}>
        <div className="font-mono text-xs">
          <Ltr>{alert.competitorCode}</Ltr>
        </div>
        <Labelled label={t('alerts.columns.regular')} value={money(alert.theirRegularPrice)} struck={hasOffer} />
        {hasOffer ? (
          <Labelled label={t('alerts.columns.offer')} value={money(alert.theirOfferPrice)} strong />
        ) : (
          <div className="text-xs text-muted-foreground">{t('alerts.noOffer')}</div>
        )}
        {alert.sellerName && (
          <div className="text-xs text-muted-foreground" data-alert-seller="">
            {t('alerts.columns.seller')}: <bdi>{alert.sellerName}</bdi>
          </div>
        )}
      </td>
      <td className={td} data-alert-gap="">
        {/* The alert wire's sense: positive = the competitor is cheaper — the column says so in its header. */}
        <div className="font-medium tabular-nums">
          <Ltr>{formatGapPercent(alert.gapPercent)}</Ltr>
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          <Ltr>{money(alert.gapAmount)}</Ltr>
        </div>
      </td>
      <td className={td} data-alert-value-at-risk="">
        <div className="font-medium tabular-nums">
          <Ltr>{money(alert.valueAtRisk)}</Ltr>
        </div>
        <div className="text-xs text-muted-foreground">{t('alerts.units', { units: fsi(formatFigure(alert.thirtyDayUnits)) })}</div>
      </td>
      <td className={td + ' whitespace-nowrap text-xs'}>
        <Ltr>{formatDateTime(alert.observedAt)}</Ltr>
      </td>
      <td className={td}>
        <RecommendedCell alert={alert} />
      </td>
      <td className={td}>
        <StatusBadge sev={STATUS_SEVERITY[alert.status] ?? 'mute'}>
          {alert.status in STATUS_SEVERITY ? t(`alerts.status.${alert.status}`) : t('alerts.status.unknown')}
        </StatusBadge>
      </td>
      {canManage && (
        <td className={td}>
          {decidable && (
            <div className="flex flex-wrap gap-1.5">
              <Button variant="primary" disabled={busy} onClick={() => onAccept(alert)} data-alert-accept={alert.alertId}>
                {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                {t('alerts.accept')}
              </Button>
              <Button variant="outlined" disabled={busy} onClick={() => onDismiss(alert)} data-alert-dismiss={alert.alertId}>
                {t('alerts.dismiss')}
              </Button>
            </div>
          )}
        </td>
      )}
    </tr>
  )
}

/** The recommended price — "awaiting cost" while the floor is unset (see `recommendedView`). */
function RecommendedCell({ alert }: { alert: PriceAlertView }) {
  const { t } = useTranslation(NS)
  const view = recommendedView(alert)
  if (view.kind === 'awaitingCost')
    return (
      <div className="flex flex-col items-start gap-1" data-alert-recommended="awaiting-cost">
        <span title={t('alerts.awaitingCostHint')}>
          <StatusBadge sev="mute">{t('alerts.awaitingCost')}</StatusBadge>
        </span>
        <span className="text-xs text-muted-foreground">
          {t('alerts.lowestCompetitor', {
            price: fsi(formatMoneyIn(view.lowestPrice, alert.currency)),
            competitor: fsi(view.lowestFrom),
          })}
        </span>
      </div>
    )
  return (
    <div className="flex flex-col" data-alert-recommended="price">
      <span className="font-medium tabular-nums">
        <Ltr>{formatMoneyIn(view.price, alert.currency)}</Ltr>
      </span>
      <span className="font-mono text-xs text-muted-foreground">
        <Ltr>{view.from}</Ltr>
      </span>
    </div>
  )
}

/** One labelled figure in a cell: "Basic 25.00". The figure is a machine value, isolated whole. */
function Labelled({ label, value, strong = false, struck = false }: { label: string; value: string; strong?: boolean; struck?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={'tabular-nums ' + (strong ? 'font-medium text-sm ' : '') + (struck ? 'line-through text-muted-foreground' : '')}>
        <Ltr>{value}</Ltr>
      </span>
    </div>
  )
}
