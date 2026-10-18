import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { RuleSessionLookup } from '@/core/models/rule-session'
import { campaignPath } from '@/core/rules/campaign-state'
import { moneyText } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatNumber } from '@/core/util/number-format'
import SaysBoth from '@/core/rules/SaysBoth'
import { RefusalText, V } from './session-ui'
import { sessionCampaigns } from './session-read'
import { momentText } from './timeline'

/**
 * Campaigns (tickets 518, 527): what each campaign did on the session — the money it took off, the
 * free units, the points, the budgets it holds, the codes it created — and the refusals it was
 * answered, so "why didn't I get the offer" has HQ's answer. Then the sale's own refusals, its
 * campaign coupon with its refunds, and the points Loy posted.
 */
export default function SessionCampaigns({ session }: { session: RuleSessionLookup }) {
  const { t } = useTranslation('rule-sessions')
  const { campaigns, sale } = sessionCampaigns(session)
  const currency = session.session.currency
  const coupon = session.coupon
  const activities = session.pointsActivities ?? []
  const nothing = campaigns.length === 0 && sale.length === 0 && !coupon && activities.length === 0
  if (nothing) return <p className="text-sm text-muted-foreground">{t('campaigns.none')}</p>
  return (
    <div className="flex flex-col gap-4">
      {campaigns.length > 0 && (
        <ul className="flex flex-col gap-2" data-session-campaigns="">
          {campaigns.map((c) => {
            const applied = c.applied
            return (
              <li key={c.campaign} className="rounded-md border border-border bg-card p-3 text-xs" data-session-campaign={c.campaign} data-outcome={applied ? 'applied' : 'refused'}>
                <div className="flex flex-wrap items-start gap-2">
                  <StatusBadge sev={applied ? 'ok' : 'warn'}>{t(applied ? 'campaigns.outcome.applied' : 'campaigns.outcome.refused')}</StatusBadge>
                  <Link to={campaignPath(c.campaign)} className="font-mono font-semibold text-primary hover:underline">
                    <Ltr>{c.campaign}</Ltr>
                  </Link>
                </div>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {c.discount > 0 && (
                    <li data-session-campaign-gave="discount">
                      <Trans t={t} i18nKey="campaigns.discount" values={{ amount: moneyText({ amount: c.discount, currency }) }} components={{ v: V }} />
                    </li>
                  )}
                  {c.freeUnits > 0 && (
                    <li data-session-campaign-gave="free">
                      <Trans t={t} i18nKey="campaigns.freeUnits" count={c.freeUnits} values={{ n: formatNumber(c.freeUnits) }} components={{ v: V }} />
                    </li>
                  )}
                  {c.points.map((p, i) => (
                    <li key={i} data-session-campaign-gave={p.effect}>
                      <Trans
                        t={t}
                        i18nKey={p.effect === 'burnPoints' ? 'campaigns.burned' : 'campaigns.points'}
                        values={{ points: formatNumber(p.amount), unit: p.unit }}
                        components={{ v: V }}
                      />
                    </li>
                  ))}
                  {c.holds.map((h, i) => (
                    <li key={i} data-session-campaign-hold={h.budget}>
                      <Trans
                        t={t}
                        i18nKey={h.released ? 'campaigns.holdReleased' : 'campaigns.hold'}
                        values={{ amount: formatNumber(h.amount), budget: h.budget }}
                        components={{ v: V }}
                      />
                    </li>
                  ))}
                  {c.createdCoupons.map((cc, i) => (
                    <li key={i} className="flex flex-col gap-0.5" data-session-campaign-created={cc.code ?? ''}>
                      <span>
                        <Trans
                          t={t}
                          i18nKey={!cc.code ? 'campaigns.toCreate' : cc.state ? 'campaigns.created' : 'campaigns.createdBare'}
                          values={{ code: cc.code ?? '', state: cc.state ?? '' }}
                          components={{ v: V }}
                        />
                      </span>
                      {cc.label && <SaysBoth says={cc.label} />}
                    </li>
                  ))}
                </ul>
                {c.refusals.length > 0 && (
                  <div className="mt-2" data-session-campaign-refusals="">
                    <span className="font-medium text-muted-foreground">{t('campaigns.refusals')}</span>
                    <ul className="mt-1 flex flex-col gap-1">
                      {c.refusals.map((r, i) => (
                        <li key={i} className="rounded border border-border/60 bg-card-2 px-2 py-1.5">
                          <RefusalText refusal={r} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {sale.length > 0 && (
        <Section title={t('campaigns.saleRefusals')} data="sale-refusals">
          {sale.map((r, i) => (
            <li key={i} className="rounded border border-border/60 bg-card-2 px-2 py-1.5">
              <RefusalText refusal={r} />
            </li>
          ))}
        </Section>
      )}

      {coupon && (
        <Section title={t('campaigns.coupon')} data="coupon">
          <li>
            <Trans t={t} i18nKey="campaigns.couponRedeemed" values={{ code: coupon.code, tx: coupon.redeemTransactionId }} components={{ v: V }} />
          </li>
          {coupon.refunds.map((r) => (
            <li key={r.transactionId} data-coupon-refund={r.transactionId}>
              <Trans t={t} i18nKey="campaigns.couponRefunded" values={{ at: momentText(r.at), tx: r.transactionId }} components={{ v: V }} />
            </li>
          ))}
        </Section>
      )}

      {activities.length > 0 && (
        <Section title={t('campaigns.pointsPosted')} data="points-activities">
          {activities.map((a) => (
            <li key={a.activityId} data-points-activity={a.activityType}>
              <Trans
                t={t}
                i18nKey="campaigns.activity"
                values={{ at: momentText(a.at), type: a.activityType, points: formatNumber(a.points), loyId: a.loyId, status: a.status }}
                components={{ v: V }}
              />
            </li>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, data, children }: { title: string; data: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1 text-xs" data-session-section={data}>
      <h3 className="font-semibold text-muted-foreground">{title}</h3>
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  )
}
