import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { TriangleAlert } from 'lucide-react'
import type { StockConsoleFleetProblem } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { FLEET_PATH } from './console-pages'
import { fleetLine, type FleetLineItem } from './fleet'
import { wordText } from './WordOrRaw'

/**
 * The fleet line (oms 942, spec 4157 story 72): the fleet facts that are a problem now — a late feed, the recompute
 * never run or stale, the reader behind — said once above the stores list, so no store is blamed for them, with a link
 * to Feeds and switches. Nothing is drawn when no fleet fact is a problem.
 */
export default function FleetLine({ problems }: { problems: readonly StockConsoleFleetProblem[] }) {
  const { t } = useTranslation('stock-console')
  const items = fleetLine(problems)
  if (items.length === 0) return null
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-sm text-attention-800"
      role="status"
      data-fleet-line={items.length}
    >
      <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
      <span className="font-medium">{t('fleetLine.lead')}</span>
      {items.map((item, i) => (
        <Problem key={`${item.fact}-${i}`} item={item} />
      ))}
      <Link to={FLEET_PATH} className="ms-auto font-medium underline underline-offset-2" data-fleet-line-link="">
        {t('fleetLine.link')}
      </Link>
    </div>
  )
}

function Problem({ item }: { item: FleetLineItem }) {
  const { t } = useTranslation('stock-console')
  const subject = item.subject === null ? '' : wordText(t, item.subject)
  // `<s>` holds a feed's name in our words (free text, `bdi`) — or a code: an unknown fact, a feed we have no word for.
  const code = item.key === 'fleetLine.unknown' || item.subject === null || 'raw' in item.subject
  return (
    <span className="inline-flex flex-wrap gap-x-1.5" data-fleet-problem={item.fact}>
      <span>
        <Trans
          t={t}
          i18nKey={item.key}
          values={{ fact: item.fact, subject, value: formatFigure(item.value), limit: formatFigure(item.limit) }}
          components={{ s: code ? <Ltr /> : <bdi />, v: <Ltr /> }}
        />
      </span>
      {item.since && (
        <span className="text-xs">
          <Trans t={t} i18nKey="fleetLine.since" values={{ at: formatDateTime(item.since) }} components={{ at: <Ltr /> }} />
        </span>
      )}
    </span>
  )
}
