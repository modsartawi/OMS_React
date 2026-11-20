import { useTranslation } from 'react-i18next'
import { Trans } from 'react-i18next'
import type { HybrisStockPushRow } from '@/core/models/hybris-stock'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatCount, fsi } from '@/core/util/bidi'
import { statusLabel, targetLabel, typeLabel } from './push-labels'

/** A push's type in words (ticket 849). */
export function PushType({ type }: { type: string }) {
  const { t } = useTranslation('hybris-stock-pushes')
  return <span data-push-type={type}>{t(typeLabel(type))}</span>
}

/**
 * A push's status — "Delivered to hot folder", never "live on the website". The server's own
 * `statusText` ("<English> / <Arabic>") is its tooltip; a running split push says how many parts are up.
 */
export function PushStatus({ status, statusText, parts }: { status: string; statusText?: string | null; parts?: HybrisStockPushRow['parts'] }) {
  const { t } = useTranslation('hybris-stock-pushes')
  const s = statusLabel(status)
  return (
    <span className="flex items-center gap-1.5" data-push-status={status} title={statusText ? fsi(statusText) : undefined}>
      <StatusBadge sev={s.sev}>{t(s.key)}</StatusBadge>
      {parts && (
        <span className="text-muted-foreground" data-push-parts="">
          <Trans t={t} i18nKey="status.parts" values={{ n: formatCount(parts.uploaded, parts.total) }} components={{ n: <Ltr /> }} />
        </span>
      )}
    </span>
  )
}

/** Where a push's files went — a shadow path Hybris does not import, or the live hot folder; the path itself
 *  is its tooltip. */
export function PushTarget({ target, path }: { target: string; path?: string | null }) {
  const { t } = useTranslation('hybris-stock-pushes')
  const s = targetLabel(target)
  return (
    <span data-push-target={target} title={path ? fsi(path) : undefined}>
      <StatusBadge sev={s.sev}>{t(s.key)}</StatusBadge>
    </span>
  )
}
