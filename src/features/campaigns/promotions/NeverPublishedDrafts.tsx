import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import { ruleDraftsQuery } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { neverPublishedDrafts } from './promotion-page'

/**
 * The no-promotion page's drafts never published (ticket 535): the `Drafts/List` rows with
 * `publishedVersionNo` 0. HQ keeps a campaign row from its first publish, so they are in no promotion
 * and in no `Promotions/Campaigns` page until published — and cannot be assigned before. Each opens
 * its workspace (they are in no list, so with no list context).
 */
export default function NeverPublishedDrafts() {
  const { t } = useTranslation('campaign-promotions')
  const drafts = useQuery(ruleDraftsQuery())
  const rows = neverPublishedDrafts(drafts.data ?? [])

  return (
    <section className="flex flex-col gap-2 rounded-md border border-border/60 bg-card-2 p-3" aria-labelledby="never-published-title" data-never-published="">
      <div>
        <h2 id="never-published-title" className="text-sm font-semibold">
          {t('drafts.title')}
        </h2>
        <p className="text-xs text-muted-foreground">{t('drafts.lede')}</p>
      </div>
      {drafts.isError && !drafts.data ? (
        <div data-never-published-failed="">
          <ErrorBanner
            className="p-2.5"
            title={isBareDenial(drafts.error) ? undefined : t('drafts.failedTitle')}
            message={isBareDenial(drafts.error) ? t('denied') : apiErrorMessage(drafts.error, t('drafts.failed'))}
          />
        </div>
      ) : drafts.isPending ? (
        <p className="text-xs text-muted-foreground">{t('drafts.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-never-published-none="">
          {t('drafts.none')}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((d) => (
            <li key={d.campaign} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-never-published-draft={d.campaign}>
              <Link to={campaignPath(d.campaign)} className="font-mono font-medium text-primary hover:underline">
                <Ltr>{d.campaign}</Ltr>
              </Link>
              {d.name.en && <bdi>{d.name.en}</bdi>}
              {d.name.ar && <bdi className="text-muted-foreground">{d.name.ar}</bdi>}
              <StatusBadge sev="mute">{t('drafts.badge')}</StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
