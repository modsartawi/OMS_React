import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { RuleSession, RuleSimOutcome } from '@/core/models/rule-campaign'
import { campaignPath } from '@/core/rules/campaign-state'
import { moneyText } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatNumber } from '@/core/util/number-format'
import { Both } from './session-ui'

const OUTCOME_SEV: Record<RuleSimOutcome, Severity> = { applied: 'ok', notMet: 'mute', skipped: 'mute', budget: 'warn', lost: 'warn' }

/**
 * Campaigns (ticket 518): each campaign's outcome on the session, so "why didn't I get the offer"
 * has an answer — HQ's reason for a skip or a budget stop, the group it lost and to whom, and the
 * "not met" messages of the conditions that failed, in both languages.
 */
export default function SessionCampaigns({ session }: { session: RuleSession }) {
  const { t } = useTranslation('rule-sessions')
  if (session.campaigns.length === 0) return <p className="text-sm text-muted-foreground">{t('campaigns.none')}</p>
  return (
    <ul className="flex flex-col gap-2" data-session-campaigns="">
      {session.campaigns.map((c) => (
        <li key={c.campaignId} className="rounded-md border border-border bg-card p-3 text-xs" data-session-campaign={c.code} data-outcome={c.outcome}>
          <div className="flex flex-wrap items-start gap-2">
            <StatusBadge sev={OUTCOME_SEV[c.outcome]}>{t(`campaigns.outcome.${c.outcome}`)}</StatusBadge>
            <Link to={campaignPath(c.campaignId)} className="font-mono font-semibold text-primary hover:underline">
              <Ltr>{c.code}</Ltr>
            </Link>
            <Both says={c.name} />
            {c.version != null && (
              <span className="ms-auto text-muted-foreground" data-session-campaign-version="">
                <Trans t={t} i18nKey="campaigns.version" values={{ n: formatNumber(c.version) }} components={{ v: <Ltr /> }} />
              </span>
            )}
          </div>
          {c.outcome === 'applied' && (c.discount > 0 || c.points > 0) && (
            <p className="mt-1.5" data-session-campaign-gave="">
              {c.discount > 0 && (
                <span className="me-3">
                  <Trans t={t} i18nKey="campaigns.discount" values={{ amount: moneyText({ amount: c.discount, currency: session.currency }) }} components={{ v: <Ltr /> }} />
                </span>
              )}
              {c.points > 0 && (
                <span>
                  <Trans t={t} i18nKey="campaigns.points" values={{ points: formatNumber(c.points) }} components={{ v: <Ltr /> }} />
                </span>
              )}
            </p>
          )}
          {c.outcome === 'lost' && c.lostTo && (
            <p className="mt-1.5" data-session-campaign-lost="">
              <Trans t={t} i18nKey="campaigns.lostTo" values={{ code: c.lostTo }} components={{ v: <Ltr /> }} />
            </p>
          )}
          {c.reason && (
            <p className="mt-1.5" data-session-campaign-reason="">
              <bdi>{c.reason}</bdi>
            </p>
          )}
          {c.notMet.length > 0 && (
            <div className="mt-2" data-session-campaign-not-met="">
              <span className="font-medium text-muted-foreground">{t('campaigns.notMet')}</span>
              <ul className="mt-1 flex flex-col gap-1">
                {c.notMet.map((says, i) => (
                  <li key={i} className="rounded border border-border/60 bg-card-2 px-2 py-1.5">
                    <Both says={says} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
