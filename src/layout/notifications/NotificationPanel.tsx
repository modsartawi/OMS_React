import { useTranslation } from 'react-i18next'
import type { NotificationItem } from '@/core/models/notifications'
import { relativeTime } from './helpers'

// The Notification Center dropdown panel (spec 031, ticket 033) — anchored under
// the bell, ~380px, listing the polled announcements newest-first. Rows show a
// title, short body, relative time and a type tag; unread rows are emphasised and
// read rows muted (binary — no traffic-light). An empty panel reads "all caught
// up". Opening the panel does NOT mark anything read (034 owns read actions).

function typeTagKey(typeCode: string): 'broadcast' | 'job' {
  return typeCode === 'BROADCAST' ? 'broadcast' : 'job'
}

function NotificationRow({ item, now }: { item: NotificationItem; now: number }) {
  const { t } = useTranslation('notifications')
  const rel = relativeTime(item.createdAt, now)
  const tag = typeTagKey(item.typeCode)
  const read = item.isRead
  return (
    <div
      className={
        'grid grid-cols-[8px_1fr_auto] gap-2.5 border-b border-border/50 px-3.5 py-3 last:border-b-0'
      }
    >
      <span
        className={
          'mt-1.5 h-2 w-2 rounded-full ' + (read ? 'bg-transparent' : 'bg-ring')
        }
        aria-hidden
      />
      <div className="min-w-0">
        <div className={'flex items-center gap-1.5 ' + (read ? 'font-medium text-muted-foreground' : 'font-semibold')}>
          <span className="truncate">{item.title}</span>
          <span
            className={
              'shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ' +
              (tag === 'broadcast'
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                : 'bg-muted text-muted-foreground')
            }
          >
            {t(`type.${tag}`)}
          </span>
        </div>
        <div className={'mt-0.5 text-[13px] text-muted-foreground ' + (read ? 'opacity-75' : '')}>
          {item.body}
        </div>
      </div>
      <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
        {t(`relative.${rel.key}`, { count: rel.count })}
      </span>
    </div>
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
  return (
    <div
      role="dialog"
      aria-label={t('panel.title')}
      className="absolute end-0 top-full z-50 mt-1.5 flex max-h-[460px] w-[380px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
    >
      <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
        <h3 className="text-sm font-semibold">{t('panel.title')}</h3>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
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
