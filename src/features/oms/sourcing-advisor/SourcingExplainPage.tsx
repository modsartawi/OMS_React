import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { ChevronLeft, Loader2, TriangleAlert } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { canViewSourcingAdvisor, sourcingAdvisorAccessQuery } from '@/core/sourcing-advisor/access'
import { iconButtonClass } from '@/core/ui/control-classes'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { TD, TH } from '@/core/ui/sheet-table'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { sourcingAdvisorApi } from './api'
import { explainModel, type CandidateRow, type OnTimeState, type StoreSide } from './explain-model'
import { refusalKey } from './refusal'

/**
 * One order's explanation (ticket 738, spec 734 D15/D17/D18/D20/D21): the order, the store that filled
 * it against the cheapest on-time candidate, the saving and its reasons, and the candidate table — with
 * the "placeholder rates" banner whenever the reply says so (S2: until finance's rates arrive).
 *
 * 🚩 Read-only, and the door's figures as sent (`./explain-model`). Store `code · name` pairs and every
 * km, SAR and minute are machine values, isolated with `Ltr`; the city is free text in a `<bdi>`; the
 * reasons are i18n sentences built from the codes, never server text.
 */
export default function SourcingExplainPage() {
  const { t } = useTranslation('sourcing-advisor')
  return (
    <ScreenGate query={sourcingAdvisorAccessQuery()} can={canViewSourcingAdvisor} ns="sourcing-advisor" title={t('title')} subtitle={t('subtitle')}>
      <Explain />
    </ScreenGate>
  )
}

const ON_TIME_SEV: Record<OnTimeState, Severity> = { yes: 'ok', no: 'bad', unknown: 'mute' }

function OnTime({ state }: { state: OnTimeState }) {
  const { t } = useTranslation('sourcing-advisor')
  return (
    <span data-on-time={state}>
      <StatusBadge sev={ON_TIME_SEV[state]}>{t(`onTime.${state}`)}</StatusBadge>
    </span>
  )
}

/** A figure with its unit (`<v>…</v> km`), or the dash when absent. */
function Unit({ unit, value }: { unit: 'km' | 'sar' | 'mins'; value: string | null }) {
  const { t } = useTranslation('sourcing-advisor')
  if (value === null) return <>{t('dash')}</>
  return <Trans t={t} i18nKey={`unit.${unit}`} values={{ value }} components={{ v: <Ltr /> }} />
}

function Explain() {
  const { t } = useTranslation('sourcing-advisor')
  const orderNo = (useParams().orderNo ?? '').trim()
  const explain = useQuery({
    queryKey: ['sourcing-advisor', 'explain', orderNo],
    queryFn: () => sourcingAdvisorApi.explain(orderNo),
    enabled: orderNo !== '',
    retry: false,
  })

  const back = (
    <Link
      to={`/oms/delivery/${encodeURIComponent(orderNo)}`}
      aria-label={t('order.backToDelivery')}
      title={t('order.backToDelivery')}
      className={iconButtonClass('outlined')}
      data-sourcing-back=""
    >
      <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden />
    </Link>
  )

  if (explain.isPending) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('load.loading')}
      </div>
    )
  }
  if (explain.isError) {
    const key = refusalKey(explain.error)
    return (
      <div className="flex flex-col gap-3">
        <div>{back}</div>
        <div data-sourcing-refusal={key ?? 'unknown'}>
          <ErrorBanner
            title={t('load.failedTitle')}
            message={key ? t(key, { orderNo: fsi(orderNo) }) : apiErrorMessage(explain.error, t('load.failed'))}
            className="p-4"
          />
        </div>
      </div>
    )
  }

  const m = explainModel(explain.data)
  const dash = t('dash')
  return (
    <div className="flex min-w-0 flex-col gap-4" data-sourcing-explain="">
      {m.placeholderRates && (
        <div
          role="note"
          data-sourcing-placeholder=""
          className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 px-3 py-2 text-sm text-attention-800"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <div className="font-semibold">{t('placeholder.title')}</div>
            <p>{t('placeholder.body')}</p>
            {m.rateVersion !== '' && (
              <p className="text-xs">
                <Trans t={t} i18nKey="placeholder.rateVersion" values={{ version: m.rateVersion }} components={{ v: <Ltr /> }} />
              </p>
            )}
          </div>
        </div>
      )}

      <Card title={t('order.heading')} lead={back} attr="order">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Fact label={t('order.orderNo')} attr="orderNo">
            <span className="font-mono">
              <Ltr>{m.order.orderNo || orderNo}</Ltr>
            </span>
          </Fact>
          <Fact label={t('order.deliveryType')} attr="deliveryType">
            <Ltr>{m.order.deliveryType || dash}</Ltr>
          </Fact>
          <Fact label={t('order.city')} attr="city">
            <bdi>{m.order.city || dash}</bdi>
          </Fact>
          <Fact label={t('order.promisedBy')} attr="promisedBy">
            <Ltr>{formatDateTime(m.order.promisedBy) || dash}</Ltr>
          </Fact>
        </dl>
      </Card>

      <Card title={t('compare.heading')} attr="compare">
        <div className="grid gap-3 md:grid-cols-2">
          <Side label={t('compare.actual')} side={m.actual} attr="actual" />
          <Side label={t('compare.best')} side={m.best} attr="best" />
        </div>
      </Card>

      <Card title={t('saving.heading')} attr="saving">
        <p className="text-sm font-semibold" data-sourcing-saving={m.saving.shown ? 'shown' : 'none'}>
          {m.saving.shown ? (
            <Trans t={t} i18nKey="saving.amount" values={{ amount: m.saving.amount }} components={{ v: <Ltr /> }} />
          ) : (
            t('saving.none')
          )}
        </p>
        <h3 className="mt-3 text-xs font-medium text-muted-foreground">{t('reasons.heading')}</h3>
        {m.reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('reasons.none')}</p>
        ) : (
          <ul className="mt-1 list-disc ps-5 text-sm" data-sourcing-reasons="">
            {m.reasons.map((r) => (
              <li key={r.code} data-reason={r.code}>
                <Trans t={t} i18nKey={r.key} values={{ code: r.code }} components={{ v: <Ltr /> }} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={t('candidates.heading')} attr="candidates">
        <p className="mb-2 text-xs text-muted-foreground">{t('candidates.count')}</p>
        {m.candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('candidates.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-sourcing-candidates="">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className={TH}>{t('candidates.store')}</th>
                  <th className={`${TH} text-end`}>{t('candidates.km')}</th>
                  <th className={`${TH} text-end`}>{t('candidates.courier')}</th>
                  <th className={`${TH} text-end`}>{t('candidates.pick')}</th>
                  <th className={`${TH} text-end`}>{t('candidates.split')}</th>
                  <th className={`${TH} text-end`}>{t('candidates.express')}</th>
                  <th className={`${TH} text-end`}>{t('candidates.cost')}</th>
                  <th className={TH}>{t('candidates.onTime')}</th>
                  <th className={TH}>{t('candidates.stock')}</th>
                </tr>
              </thead>
              <tbody>
                {m.candidates.map((c, i) => (
                  <Candidate key={`${c.store}-${i}`} row={c} dash={dash} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Card({ title, lead, attr, children }: { title: string; lead?: ReactNode; attr: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-3" data-sourcing-card={attr}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {lead}
        {title}
      </h2>
      {children}
    </section>
  )
}

function Fact({ label, attr, children }: { label: string; attr: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5" data-fact={attr}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Side({ label, side, attr }: { label: string; side: StoreSide | null; attr: string }) {
  const { t } = useTranslation('sourcing-advisor')
  return (
    <div className="rounded-md border border-border/60 p-3" data-sourcing-side={attr}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {side === null ? (
        <p className="mt-1 text-sm text-muted-foreground">{t('compare.none')}</p>
      ) : (
        <>
          <div className="mt-1 font-semibold" data-side-store="">
            <Ltr>{side.store || t('dash')}</Ltr>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <Fact label={t('compare.km')} attr="km">
              <Unit unit="km" value={side.km} />
            </Fact>
            <Fact label={t('compare.cost')} attr="cost">
              <Unit unit="sar" value={side.cost} />
            </Fact>
            <Fact label={t('compare.ready')} attr="ready">
              <Unit unit="mins" value={side.readyMins} />
            </Fact>
            <Fact label={t('compare.travel')} attr="travel">
              <Unit unit="mins" value={side.travelMins} />
            </Fact>
            <Fact label={t('compare.onTime')} attr="onTime">
              <OnTime state={side.onTime} />
            </Fact>
          </dl>
        </>
      )}
    </div>
  )
}

function Money({ value, dash }: { value: string | null; dash: string }) {
  return value === null ? <>{dash}</> : <Ltr>{value}</Ltr>
}

function Candidate({ row, dash }: { row: CandidateRow; dash: string }) {
  const { t } = useTranslation('sourcing-advisor')
  return (
    <tr
      className={`border-b border-border/50 ${row.isBest ? 'bg-success-050' : ''}`}
      data-candidate={row.store}
      data-actual={row.isActual ? '' : undefined}
      data-best={row.isBest ? '' : undefined}
    >
      <td className={TD}>
        <span className="flex items-center gap-2">
          <span data-cell="store">
            <Ltr>{row.store || dash}</Ltr>
          </span>
          {row.isActual && <StatusBadge sev="go">{t('candidates.actualTag')}</StatusBadge>}
          {row.isBest && <StatusBadge sev="ok">{t('candidates.bestTag')}</StatusBadge>}
        </span>
      </td>
      <td className={`${TD} text-end`} data-cell="km">
        <Money value={row.km} dash={dash} />
      </td>
      <td className={`${TD} text-end`} data-cell="courier">
        <Money value={row.courier} dash={dash} />
      </td>
      <td className={`${TD} text-end`} data-cell="pick">
        <Money value={row.pick} dash={dash} />
      </td>
      <td className={`${TD} text-end`} data-cell="split">
        <Money value={row.split} dash={dash} />
      </td>
      <td className={`${TD} text-end`} data-cell="express">
        <Money value={row.express} dash={dash} />
      </td>
      <td className={`${TD} text-end font-semibold`} data-cell="cost">
        <Money value={row.cost} dash={dash} />
      </td>
      <td className={TD} data-cell="onTime">
        <OnTime state={row.onTime} />
      </td>
      <td className={TD} data-cell="stock" data-stock={row.stock}>
        {t(`stock.${row.stock}`)}
      </td>
    </tr>
  )
}
