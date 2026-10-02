import { Trans, useTranslation } from 'react-i18next'
import type { NotificationItem } from '@/core/models/notifications'
import Ltr from '@/core/ui/Ltr'
import { POPOVER } from '@/core/ui/overlay'
import { relativeTime, unreadItems } from './helpers'
import { markNotificationRead, markAllNotificationsRead } from './actions'

// The Notification Center dropdown panel (spec 031, ticket 033), redrawn at the
// console's density (spec 380 F17, ticket 389; 377 §3): 360px, max 440px tall, on
// the card recipe. A 36px header carries the title, an "N new" chip and Mark all as
// read. Each row is a title with its relative time at the inline end, a body clamped
// to two lines, and the type tag on its own line under it — inline, the tag truncated
// titles. Unread is a 6px primary dot (the cursor bar already means "selected") and a
// 600 title; read rows are 500 and muted. An empty panel reads "all caught up".
// Opening the panel does NOT mark anything read (034 owns read actions).

function typeTagKey(typeCode: string): 'broadcast' | 'job' {
  return typeCode === 'BROADCAST' ? 'broadcast' : 'job'
}

// A broadcast is an announcement, not a warning, so it takes the primary tier rather
// than amber (082 keeps `attention` for "needs attention"). Anything else stays muted.
const TAG_TONE = {
  broadcast: 'border-primary-border bg-primary-050 text-primary-800',
  job: 'border-border bg-muted text-muted-foreground',
} as const

function NotificationRow({ item, now }: { item: NotificationItem; now: number }) {
  const { t } = useTranslation('notifications')
  const rel = relativeTime(item.createdAt, now)
  const tag = typeTagKey(item.typeCode)
  const read = item.isRead
  // Title and body are server text in either script, so each reads in its own
  // direction (`<bdi>`, dir auto) inside the panel's.
  return (
    <button
      type="button"
      onClick={() => void markNotificationRead(item.notificationId)}
      data-nc-row
      className="grid w-full grid-cols-[6px_minmax(0,1fr)_auto] items-baseline gap-x-2 border-b border-divider px-3 py-2 text-start last:border-b-0 hover:bg-card-2"
    >
      {/* One title line tall, so the dot centres on the first line when a title wraps. */}
      <span className="flex h-[1lh] items-center self-start text-[12.5px]" aria-hidden>
        <span
          data-nc-unread={read ? undefined : ''}
          className={'h-1.5 w-1.5 rounded-full ' + (read ? '' : 'bg-primary')}
        />
      </span>
      <span
        className={
          'break-words text-[12.5px] ' + (read ? 'font-medium text-muted-foreground' : 'font-semibold text-foreground')
        }
      >
        <bdi>{item.title}</bdi>
      </span>
      <span className="whitespace-nowrap text-[11px] tabular-nums text-ink-3">
        <Trans t={t} i18nKey={`relative.${rel.key}`} count={rel.count} components={{ n: <Ltr /> }} />
      </span>
      <span
        data-nc-body
        className="col-span-2 col-start-2 mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground"
      >
        <bdi>{item.body}</bdi>
      </span>
      <span className="col-span-2 col-start-2 mt-1">
        <span
          data-nc-tag={tag}
          className={
            'inline-block rounded-sm border px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide ' +
            TAG_TONE[tag]
          }
        >
          {t(`type.${tag}`)}
        </span>
      </span>
    </button>
  )
}

export default function NotificationPanel({
  items,
  now,
}: {
  items: NotificationItem[]
  now: number
}) {
  const { t } = useTranslation('notifications')
  // The chip counts what Mark all as read would mark: the badge's own rule.
  const unread = unreadItems(items, now)
  return (
    <div
      role="dialog"
      aria-label={t('panel.title')}
      className={'absolute end-0 top-full z-50 mt-1.5 flex max-h-[440px] w-[360px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden ' + POPOVER}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <h3 className="text-[13px] font-semibold">{t('panel.title')}</h3>
        {unread.length > 0 && (
          <span data-nc-new className="rounded-sm bg-primary-050 px-1 text-[11px] font-medium text-primary-800">
            <Trans t={t} i18nKey="panel.newCount" count={unread.length} components={{ n: <Ltr /> }} />
          </span>
        )}
        <button
          type="button"
          onClick={() => void markAllNotificationsRead(unread.map((i) => i.notificationId))}
          disabled={unread.length === 0}
          className="ms-auto h-6 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          {t('panel.markAll')}
        </button>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-10 text-center text-xs text-muted-foreground">
          {t('panel.empty')}
        </div>
      ) : (
        <div className="overflow-y-auto">
          {items.map((item) => (
            <NotificationRow key={item.notificationId} item={item} now={now} />
          ))}
        </div>
      )}
    </div>
  )
}
