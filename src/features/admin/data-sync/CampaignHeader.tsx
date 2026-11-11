import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { JOBS_BY_STATE_KEYS, type Campaign } from '@/core/models/data-sync'
import { campaignPath } from './campaign-columns'
import CodeBadgeView from './CodeBadgeView'
import CodeWord from './CodeWord'
import { campaignStatusBadge, groupDigits } from './helpers'

/**
 * The campaign page's header (ticket 560): name, profile, mode, status, reason (Apply), the source,
 * created / started / finished, and the rollup tiles from `jobsByState` with its `asOf` stamp.
 *
 * 🔌 `actions` is the seam for the campaign-level buttons: Start (561), Pause / Resume / Cancel
 * (563) and the hand-back to ActionSync (565). It is drawn at the header's end, beside the name.
 */
export default function CampaignHeader({
  campaign,
  profileName,
  actions,
}: {
  campaign: Campaign
  /** The profile's name from the Profiles read, or `null` (a disabled profile shows its id). */
  profileName: string | null
  actions?: ReactNode
}) {
  const { t } = useTranslation('data-sync')
  const c = campaign
  const time = (iso: string | null) => (iso ? <Ltr>{formatDateTime(iso)}</Ltr> : t('campaign.notYet'))
  return (
    <section className="flex flex-col gap-4" aria-labelledby="ds-campaign-heading" data-campaign-header={c.campaignId}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="me-auto flex min-w-0 flex-col gap-1">
          <h2 id="ds-campaign-heading" className="text-base font-semibold tracking-tight" data-campaign-name="">
            {c.name ? <bdi>{c.name}</bdi> : t('campaign.unnamed')}
          </h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            <Ltr>{c.campaignId}</Ltr>
          </p>
        </div>
        <span data-campaign-status={c.status}>
          <CodeBadgeView badge={campaignStatusBadge(c.status)} code={c.status} />
        </span>
        {actions && (
          <div className="flex flex-wrap items-center gap-2" data-campaign-actions="">
            {actions}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-x-6 gap-y-2 text-sm">
        <Field label={t('campaign.profile')} hook="profile">
          {profileName ? <bdi>{profileName}</bdi> : <span className="font-mono text-xs"><Ltr>{c.profileId}</Ltr></span>}
        </Field>
        <Field label={t('campaign.mode')} hook="mode">
          <CodeWord prefix="mode" code={c.mode} className="font-mono text-xs" />
        </Field>
        <Field label={t('campaign.source')} hook="source">
          <span className="font-mono text-xs">
            <Ltr>{formatPair(c.source.server, c.source.database)}</Ltr>
          </span>
        </Field>
        <Field label={t('campaign.createdAt')} hook="createdAt">
          {time(c.createdAt)}
        </Field>
        <Field label={t('campaign.startedAt')} hook="startedAt">
          {time(c.startedAt)}
        </Field>
        <Field label={t('campaign.finishedAt')} hook="finishedAt">
          {time(c.finishedAt)}
        </Field>
        {c.rerunOf && (
          <Field label={t('rerun.of')} hook="rerunOf">
            <CampaignLinkView campaignId={c.rerunOf.campaignId} name={c.rerunOf.name} hook="data-rerun-of" />
          </Field>
        )}
        {(c.rerunBy?.length ?? 0) > 0 && (
          <div className="col-span-full flex flex-col gap-0.5" data-field="rerunBy">
            <dt className="text-xs text-muted-foreground">{t('rerun.by')}</dt>
            <dd>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {c.rerunBy?.map((r) => (
                  <li key={r.campaignId} className="inline-flex items-center gap-2">
                    <CampaignLinkView campaignId={r.campaignId} name={r.name} hook="data-rerun-by" />
                    <CodeBadgeView badge={campaignStatusBadge(r.status)} code={r.status} />
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        {c.reason && (
          <div className="col-span-full flex flex-col gap-0.5" data-field="reason">
            <dt className="text-xs text-muted-foreground">{t('campaign.reason')}</dt>
            <dd>
              <bdi>{c.reason}</bdi>
            </dd>
          </div>
        )}
      </dl>

      <div className="flex flex-col gap-1.5" data-rollup="">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="me-auto text-xs font-semibold text-muted-foreground">{t('campaign.rollup')}</h3>
          <span className="text-xs text-muted-foreground" data-as-of="">
            <Trans t={t} i18nKey="campaign.asOf" values={{ at: formatDateTime(c.asOf) }} components={{ at: <Ltr /> }} />
          </span>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2">
          <Tile label={t('campaign.totalJobs')} value={c.totalJobs} hook="total" />
          {JOBS_BY_STATE_KEYS.map((k) => (
            <Tile key={k} label={t(`jobsByState.${k}`)} value={c.jobsByState[k]} hook={k} />
          ))}
        </ul>
      </div>
    </section>
  )
}

/** A link to another campaign's page (863's *Re-run of* / *Re-run by*): its name, or its id when unnamed. */
function CampaignLinkView({ campaignId, name, hook }: { campaignId: string; name: string | null; hook: string }) {
  return (
    <Link to={campaignPath(campaignId)} className="text-primary underline-offset-2 hover:underline" {...{ [hook]: campaignId }}>
      {name ? <bdi>{name}</bdi> : <span className="font-mono text-xs"><Ltr>{campaignId}</Ltr></span>}
    </Link>
  )
}

function Field({ label, hook, children }: { label: string; hook: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5" data-field={hook}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Tile({ label, value, hook }: { label: string; value: number; hook: string }) {
  return (
    <li className="flex flex-col rounded-md border border-border/60 px-3 py-2" data-tile={hook}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-lg font-semibold tabular-nums" data-tile-count="">
        <Ltr>{groupDigits(value)}</Ltr>
      </span>
    </li>
  )
}
