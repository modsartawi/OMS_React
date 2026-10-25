import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Lock, MoonStar, Unlock } from 'lucide-react'

import ServingListName from '@/core/dispatch/ServingListName'
import { bidRow, dutyRemovedView, formatClock, outcomeView, servingListView, type BidMoment, type BidRowView } from '@/core/dispatch/view'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatCount, formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime, formatTimeOfDay } from '@/core/util/date-format'
import { formatMoney } from '@/core/util/number-format'
import { Countdown, type BoardRow } from './columns'

const deliveryHref = (no: string) => `/oms/delivery/${encodeURIComponent(no)}`

const KNOWN_END_REASONS = ['AllPassed', 'Expired', 'Withdrawn']

/**
 * The bid inspector beside the two grids (2950 Answer, point 1): the callout's header, then one row per
 * bid — store, km, ATP at offer, tills online / signed in, the delivered · shown · opened moments with
 * seconds from offer, and the answer with its staff and register. A locked callout says where it is
 * held, and with Execute offers Release lock; once released, a Change store link opens Delivery details.
 */
export default function Inspector({
  row,
  canRelease,
  justReleased,
  onRelease,
  canLinkServingList = false,
}: {
  row: BoardRow | null
  canRelease: boolean
  /** 567's `canViewServingLists`: the serving list links to its screen. */
  canLinkServingList?: boolean
  /** Released in this page life — the board's next read will carry `releasedAt` too. */
  justReleased: boolean
  onRelease: () => void
}) {
  const { t, i18n } = useTranslation('dispatch-board')
  if (!row) {
    return (
      <aside className="rounded-lg border border-border/60 bg-card p-4 text-sm text-muted-foreground" data-inspector="">
        {t('inspector.select')}
      </aside>
    )
  }
  const c = row
  const outcome = outcomeView(c.outcome)
  const heldAt = c.awardedParty || c.fallbackParty
  const released = justReleased || c.releasedAt != null
  const notCompeted = c.status === 'NOT_OPENED' || c.outcome === 'NotCompeted'
  const endReason = c.endReason ? (KNOWN_END_REASONS.includes(c.endReason) ? t(`endReasons.${c.endReason}`) : null) : null
  const dutyRemoved = dutyRemovedView(c)

  return (
    <aside className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 text-sm" data-inspector={c.calloutId}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-base font-semibold" data-inspector-delivery="">
          <Ltr>{c.deliveryNumber}</Ltr>
        </h2>
        <StatusBadge sev={outcome.sev}>{outcome.key ? t(outcome.key) : <Ltr>{outcome.raw}</Ltr>}</StatusBadge>
        <span className="flex-1" />
        <Link to={deliveryHref(c.deliveryNumber)} className="text-xs font-medium text-primary underline-offset-2 hover:underline" data-activity-link="">
          {t('inspector.activity')}
        </Link>
      </div>

      <p className="text-xs text-muted-foreground" data-inspector-facts="">
        <Ltr>{formatPair(c.deliveryType, c.channel)}</Ltr>
        {' · '}
        <bdi>{formatPair(c.district, c.city)}</bdi>
        {' · '}
        {t('inspector.lines', { count: c.lineCount, n: fsi(String(c.lineCount)) })}
        {' · '}
        <span className="font-mono">
          <Ltr>{formatMoney(c.value)}</Ltr>
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        <Trans
          t={t}
          i18nKey="inspector.openedLine"
          values={{ at: formatDateTime(c.openedAt), n: String(c.candidateCount) }}
          components={{ at: <Ltr />, n: <Ltr /> }}
        />
        {c.fallbackParty && (
          <>
            {' · '}
            <Trans t={t} i18nKey="inspector.fallbackLine" values={{ store: c.fallbackParty }} components={{ s: <Ltr /> }} />
          </>
        )}
        {endReason && <> · {endReason}</>}
      </p>
      {/* Beside the candidate count: did a serving list or the duty check narrow the race (spec 3042)? */}
      <p className="text-xs text-muted-foreground" data-inspector-serving="">
        {t('inspector.servingList')}{' '}
        <ServingListName view={servingListView(c, i18n.language)} dash={t('inspector.noServingList')} canLink={canLinkServingList} />
        {dutyRemoved != null && (
          <span data-duty-removed={dutyRemoved}>
            {' · '}
            <Trans t={t} i18nKey="inspector.dutyRemoved" values={{ n: String(dutyRemoved) }} components={{ n: <Ltr /> }} />
          </span>
        )}
      </p>

      {c.outcome === 'Open' && (
        <div data-inspector-countdown="">
          <Countdown secondsLeft={c.secondsLeft} fetchedAt={c.fetchedAt} />
        </div>
      )}

      {notCompeted ? (
        <section data-not-competed="">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('inspector.notCompeted')}</h3>
          <p>
            {/* The reason in words, as Delivery details reads it; a reason the client does not know shows as it came. */}
            {i18n.exists(`dispatch-board:notOpened.${c.endReason}`) ? (
              <span data-not-competed-reason={c.endReason}>{t(`notOpened.${c.endReason}`)}</span>
            ) : (
              <span className="font-mono" data-not-competed-reason={c.endReason}>
                <Ltr>{c.endReason}</Ltr>
              </span>
            )}
            {' · '}
            {t('inspector.candidates', { count: c.candidateCount, n: fsi(String(c.candidateCount)) })}
          </p>
        </section>
      ) : (
        <section className="min-w-0">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('inspector.bids')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-bid-table="">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60 text-start">
                  <th className="py-1 pe-2 text-start font-medium">{t('bid.store')}</th>
                  <th className="py-1 pe-2 text-end font-medium">{t('bid.km')}</th>
                  <th className="py-1 pe-2 text-start font-medium">{t('bid.atp')}</th>
                  <th className="py-1 pe-2 text-start font-medium">{t('bid.tills')}</th>
                  <th className="py-1 pe-2 text-start font-medium">{t('bid.seen')}</th>
                  <th className="py-1 text-start font-medium">{t('bid.answer')}</th>
                </tr>
              </thead>
              <tbody>
                {c.bids.map((b) => (
                  <BidRow key={b.bidId} view={bidRow(b)} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{t('inspector.dotsHint')}</p>
        </section>
      )}

      {c.locked && !justReleased && (
        <p className="flex items-center gap-1.5 text-xs text-attention-800" data-locked-line="">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <Trans t={t} i18nKey="inspector.locked" values={{ store: heldAt }} components={{ s: <Ltr /> }} />
        </p>
      )}
      {c.locked && !justReleased && canRelease && (
        <div>
          <Button variant="danger-outlined" onClick={onRelease} data-release-open="">
            <Unlock className="h-3.5 w-3.5" aria-hidden />
            {t('inspector.releaseLock')}
          </Button>
        </div>
      )}
      {released && (
        <div className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2 text-xs" data-released="">
          <span>
            {c.releasedAt ? (
              <Trans
                t={t}
                i18nKey="inspector.releasedAt"
                values={{ at: formatDateTime(c.releasedAt), by: c.releasedBy }}
                components={{ at: <Ltr />, by: <bdi /> }}
              />
            ) : (
              t('inspector.releasedNow')
            )}
          </span>
          <span>
            <Link to={deliveryHref(c.deliveryNumber)} className="font-medium text-primary underline-offset-2 hover:underline" data-change-store="">
              {t('inspector.changeStore')}
            </Link>{' '}
            <span className="text-muted-foreground">{t('inspector.changeStoreHint')}</span>
          </span>
        </div>
      )}
    </aside>
  )
}

const DOT: Record<BidMoment['kind'], string> = {
  delivered: 'bg-muted-foreground',
  shown: 'bg-primary',
  opened: 'bg-success',
  answered: 'bg-foreground',
}

function BidRow({ view }: { view: BidRowView }) {
  const { t } = useTranslation('dispatch-board')
  const [delivered, shown, opened, answered] = view.moments
  const seen = [delivered, shown, opened]
  const last = [...seen].reverse().find((m) => m.seconds != null)
  return (
    <tr className="border-b border-border/40 align-top" data-bid={view.store} data-bid-status={view.status.raw}>
      <td className="py-1 pe-2 font-mono font-medium">
        <span className="inline-flex items-center gap-1">
          <Ltr>{view.store}</Ltr>
          {view.dark && (
            <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1 text-[10px] font-sans text-muted-foreground" data-dark="">
              <MoonStar className="h-3 w-3" aria-hidden />
              {t('bid.dark')}
            </span>
          )}
        </span>
      </td>
      <td className="py-1 pe-2 text-end font-mono">
        <Ltr>{view.km.toFixed(1)}</Ltr>
      </td>
      <td className="py-1 pe-2" data-atp={view.atp.kind}>
        {view.atp.kind === 'covers' ? (
          <StatusBadge sev="ok">{t('atp.covers')}</StatusBadge>
        ) : view.atp.kind === 'short' ? (
          <StatusBadge sev="warn">
            <Trans t={t} i18nKey="atp.short" values={{ n: String(view.atp.lines) }} components={{ n: <Ltr /> }} />
          </StatusBadge>
        ) : (
          <StatusBadge sev="mute">{t('atp.unknown')}</StatusBadge>
        )}
      </td>
      <td className={'py-1 pe-2 font-mono ' + (view.tills.online === 0 ? 'text-attention-800' : '')} title={t('bid.tillsHint')} data-tills="">
        <Ltr>{formatCount(view.tills.online, view.tills.signedIn)}</Ltr>
      </td>
      <td className="py-1 pe-2" data-seen="">
        <span className="inline-flex items-center gap-1">
          {seen.map((m) => (
            <span
              key={m.kind}
              className={'inline-block h-2 w-2 rounded-full ' + (m.at ? DOT[m.kind] : 'border border-border bg-transparent')}
              title={t(`moments.${m.kind}`)}
              data-moment={m.kind}
              data-moment-seconds={m.seconds ?? ''}
            />
          ))}
          {last && (
            <span className="font-mono text-[11px] text-muted-foreground">
              <Ltr>{`+${formatClock(last.seconds!)}`}</Ltr>
            </span>
          )}
        </span>
      </td>
      <td className="py-1" data-answer="">
        <StatusBadge sev={view.status.sev}>{view.status.key ? t(view.status.key) : <Ltr>{view.status.raw}</Ltr>}</StatusBadge>
        {answered.at && (
          <div className="mt-0.5 text-[11px] text-muted-foreground" data-answered-by="">
            <bdi>{answered.staff}</bdi>
            {answered.register && (
              <>
                {' · '}
                <Trans t={t} i18nKey="bid.register" values={{ reg: answered.register }} components={{ r: <Ltr /> }} />
              </>
            )}
            {' · '}
            <Ltr>{`+${formatClock(answered.seconds ?? 0)}`}</Ltr>
            {' · '}
            <Ltr>{formatTimeOfDay(answered.at)}</Ltr>
          </div>
        )}
        {view.ignoreReason && (
          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground" data-ignore-reason={view.ignoreReason}>
            <Ltr>{view.ignoreReason}</Ltr>
          </div>
        )}
      </td>
    </tr>
  )
}
