import { Fragment } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import i18n from '@/core/i18n'
import type { AnalyticsItem } from '@/core/models/analytics'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { audienceOf, audienceSummary } from './audience'

/**
 * A Shared item's audience chip (spec 819 §E, ticket 826) — on the home's rows, the board's header, the view's and
 * (827) the report's: "Shared with everyone", or the roles then the users, at most three named and the rest counted
 * (`n / m`, isolated once). A role authz deleted is marked "removed". Names are free text (`<bdi>`); the count is a
 * machine value (`Ltr`). Nothing off a Shared item.
 */
export default function AudienceChip({ item }: { item: Pick<AnalyticsItem, 'tier' | 'audience'> }) {
  const { t } = useTranslation('boards')
  const audience = audienceOf(item)
  if (!audience) return null
  const summary = audienceSummary(audience, i18n.language)
  const chip = 'inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground'

  if (summary.everyone)
    return (
      <span className={chip} data-analytics-audience="everyone">
        <Users className="size-3 shrink-0" aria-hidden />
        {t('audience.everyone')}
      </span>
    )

  const separator = t('audience.separator')
  return (
    <span
      className={chip}
      data-analytics-audience="chosen"
      title={summary.names.map((n) => fsi(n.text)).join(separator)}
    >
      <Users className="size-3 shrink-0" aria-hidden />
      <span className="shrink-0">{t('audience.with')}</span>
      <span className="truncate">
        {summary.names.map((n, i) => (
          <Fragment key={`${n.kind}:${n.key}`}>
            {i > 0 && separator}
            <span data-analytics-audience-name={n.key} data-removed={n.removed ? 'true' : undefined} className={n.removed ? 'line-through' : undefined}>
              <bdi>{n.text}</bdi>
            </span>
            {n.removed && <span className="ms-1 text-attention-800">{t('audience.removed')}</span>}
          </Fragment>
        ))}
      </span>
      {summary.count && (
        <span className="shrink-0" data-analytics-audience-count>
          <Trans t={t} i18nKey="audience.counted" values={{ count: summary.count }} components={{ n: <Ltr /> }} />
        </span>
      )}
    </span>
  )
}
