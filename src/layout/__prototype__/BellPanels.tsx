/* PROTOTYPE 377 — throwaway. The bell panel, redrawn two ways under palette B.
 *
 *   dense — the same dropdown, at the console's density: 360px, 12.5px titles,
 *           two-line clamped bodies, squared 082-tier type tags, a primary dot
 *           for unread (NOT the cursor bar — that already means "selected").
 *   sheet — a full-height sheet on the inline-end edge, UNDER the 44px top bar so
 *           the bell stays reachable to close it; grouped New / Earlier.
 *
 * Real data path (the store's items, markNotificationRead/markAll). Literal copy
 * that is new here ("New", "Earlier", "N new") is dev chrome.
 */
import { useTranslation } from 'react-i18next'
import type { NotificationItem } from '@/core/models/notifications'
import { relativeTime } from '../notifications/helpers'
import { markNotificationRead, markAllNotificationsRead } from '../notifications/actions'

function unreadOf(items: NotificationItem[]) {
  return items.filter((i) => i.status === 'Active' && !i.isRead)
}

function Row({ item, now }: { item: NotificationItem; now: number }) {
  const { t } = useTranslation('notifications')
  const rel = relativeTime(item.createdAt, now)
  const broadcast = item.typeCode === 'BROADCAST'
  const unread = !item.isRead
  return (
    <button
      type="button"
      onClick={() => void markNotificationRead(item.notificationId)}
      className="grid w-full grid-cols-[6px_1fr_auto] items-baseline gap-x-2 border-b border-divider px-3 py-2 text-start last:border-b-0 hover:bg-card-2"
    >
      <span className={'h-1.5 w-1.5 -translate-y-px self-center rounded-full ' + (unread ? 'bg-primary' : '')} aria-hidden />
      <span className={'truncate text-[12.5px] ' + (unread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
        {item.title}
      </span>
      <span className="whitespace-nowrap text-[11px] text-ink-3">{t(`relative.${rel.key}`, { count: rel.count })}</span>
      <span />
      <span className="col-span-2 mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{item.body}</span>
      <span />
      <span className="col-span-2 mt-1">
        <span
          className={
            'inline-block rounded-sm border px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide ' +
            (broadcast ? 'border-primary-border bg-primary-050 text-primary-800' : 'border-border bg-muted text-muted-foreground')
          }
        >
          {t(`type.${broadcast ? 'broadcast' : 'job'}`)}
        </span>
      </span>
    </button>
  )
}

function Head({ items }: { items: NotificationItem[] }) {
  const { t } = useTranslation('notifications')
  const unread = unreadOf(items)
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
      <h3 className="text-[13px] font-semibold">{t('panel.title')}</h3>
      {unread.length > 0 && (
        <span className="rounded-sm bg-primary-050 px-1 text-[11px] font-medium text-primary-800">{unread.length} new</span>
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => void markAllNotificationsRead(unread.map((i) => i.notificationId))}
        disabled={unread.length === 0}
        className="h-6 rounded-md px-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        {t('panel.markAll')}
      </button>
    </div>
  )
}

function Empty() {
  const { t } = useTranslation('notifications')
  return <div className="px-4 py-10 text-center text-xs text-muted-foreground">{t('panel.empty')}</div>
}

export function DensePanel({ items, now }: { items: NotificationItem[]; now: number }) {
  const { t } = useTranslation('notifications')
  return (
    <div
      role="dialog"
      aria-label={t('panel.title')}
      data-ov="pop"
      className="absolute end-0 top-full z-50 mt-1.5 flex max-h-[440px] w-[360px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
    >
      <Head items={items} />
      {items.length === 0 ? <Empty /> : <div className="overflow-y-auto">{items.map((i) => <Row key={i.notificationId} item={i} now={now} />)}</div>}
    </div>
  )
}

export function SheetPanel({ items, now }: { items: NotificationItem[]; now: number }) {
  const { t } = useTranslation('notifications')
  const fresh = items.filter((i) => !i.isRead)
  const earlier = items.filter((i) => i.isRead)
  const group = (label: string, list: NotificationItem[]) =>
    list.length > 0 && (
      <>
        <div className="px-3 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</div>
        {list.map((i) => <Row key={i.notificationId} item={i} now={now} />)}
      </>
    )
  return (
    <div
      role="dialog"
      aria-label={t('panel.title')}
      data-ov="sheet"
      className="fixed bottom-0 end-0 top-11 z-40 flex w-[380px] max-w-full flex-col border-s border-border-strong bg-card shadow-[var(--shadow-pop)]"
    >
      <Head items={items} />
      {items.length === 0 ? (
        <Empty />
      ) : (
        <div className="overflow-y-auto">
          {group('New', fresh)}
          {group('Earlier', earlier)}
        </div>
      )}
    </div>
  )
}
