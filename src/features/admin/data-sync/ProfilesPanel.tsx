import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { SyncProfile } from '@/core/models/data-sync'
import { formatPair } from '@/core/util/bidi'
import { profilesQuery } from './api'
import CodeWord from './CodeWord'

/**
 * The Profiles panel (spec 558 story 5): each runnable profile's source and tables, with each
 * table's strategy, compare window (`where`) and whether it may be applied. Read-only — profiles
 * are admin-owned config outside the API.
 */
export default function ProfilesPanel() {
  const { t } = useTranslation('data-sync')
  const profiles = useQuery(profilesQuery())
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="ds-profiles-heading" data-profiles="">
      <div>
        <h2 id="ds-profiles-heading" className="text-sm font-semibold">
          {t('profiles.heading')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('profiles.hint')}</p>
      </div>
      {profiles.isError && <ErrorBanner className="p-3" message={apiErrorMessage(profiles.error, t('profiles.failed'))} />}
      {profiles.isPending ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('profiles.loading')}
        </div>
      ) : profiles.data && profiles.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('profiles.empty')}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(24rem,1fr))] gap-3">
          {profiles.data?.map((p) => <ProfileCard key={p.profileId} profile={p} />)}
        </div>
      )}
    </section>
  )
}

function ProfileCard({ profile }: { profile: SyncProfile }) {
  const { t } = useTranslation('data-sync')
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" data-profile={profile.profileId}>
      <header className="flex flex-col gap-0.5">
        <h3 className="text-sm font-medium">
          <bdi>{profile.name}</bdi>
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('profiles.source')}{' '}
          <span className="font-mono" data-profile-source="">
            {/* server · database: a pair of machine values, isolated once as a whole. */}
            <Ltr>{formatPair(profile.source.server, profile.source.database)}</Ltr>
          </span>
        </p>
        {!profile.allowsApply && <p className="text-xs text-muted-foreground">{t('profiles.noApply')}</p>}
      </header>
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border/60">
            <th className="py-1 pe-2 text-start font-medium">{t('profiles.columns.table')}</th>
            <th className="py-1 pe-2 text-start font-medium">{t('profiles.columns.strategy')}</th>
            <th className="py-1 pe-2 text-start font-medium">{t('profiles.columns.where')}</th>
            <th className="py-1 text-start font-medium">{t('profiles.columns.apply')}</th>
          </tr>
        </thead>
        <tbody>
          {profile.tableSet.map((spec) => (
            <tr key={spec.table} className="border-b border-border/30 last:border-0" data-profile-table={spec.table}>
              <td className="py-1 pe-2 font-mono">
                <Ltr>{spec.table}</Ltr>
              </td>
              <td className="py-1 pe-2">
                <CodeWord prefix="strategy" code={spec.strategy} />
              </td>
              <td className="py-1 pe-2 font-mono" data-where="">
                {spec.where ? <Ltr>{spec.where}</Ltr> : <span className="font-sans text-muted-foreground">{t('profiles.wholeTable')}</span>}
              </td>
              <td className="py-1" data-apply={spec.applyAllowed ? 'yes' : 'no'}>
                <StatusBadge sev={spec.applyAllowed ? 'go' : 'mute'}>
                  {spec.applyAllowed ? t('profiles.applyAllowed') : t('profiles.reportOnly')}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  )
}
