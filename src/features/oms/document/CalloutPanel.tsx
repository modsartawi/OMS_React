import { Trans, useTranslation } from 'react-i18next'
import { Lock, MoonStar, Unlock } from 'lucide-react'
import { bidRow, formatClock, outcomeView, type BidMoment, type BidRowView } from '@/core/dispatch/view'
import type { DeliveryCalloutRecord } from '@/core/models/delivery-callout'
import { calloutLog } from '@/core/oms/callout-moments'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatCount } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import ReasonText from './CalloutReason'

/**
 * The Callout sub-tab under Activity (ticket 542; 2950 Answer point 2, variant C): for each callout
 * of the delivery (normally one), its header and lock, the one-row-per-bid ledger (store, km, ATP at
 * offer, tills online / signed in, the four moments with seconds from offer, the answer with staff
 * and register, the bid's outcome), and the raw `CalloutEvent` log in server order, for disputes.
 * Read-only. Only drawn when the delivery has a callout.
 */
export default function CalloutPanel({ callouts }: { callouts: readonly DeliveryCalloutRecord[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-3" data-callout-panel="">
      {callouts.map((callout) => (
        <CalloutSection key={callout.calloutId} callout={callout} />
      ))}
    </div>
  )
}

const TH = 'py-1 pe-3 text-start font-medium whitespace-nowrap'
const TD = 'py-1 pe-3 align-top'

function CalloutSection({ callout: c }: { callout: DeliveryCalloutRecord }) {
  const { t } = useTranslation('document')
  const outcome = outcomeView(c.outcome)
  const notCompeted = c.status === 'NOT_OPENED'
  const heldAt = c.awardedParty || c.fallbackParty
  const log = calloutLog(c)
  return (
    <section
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-3 text-sm"
      data-callout-section={c.calloutId}
      aria-label={t('callout.panel.ariaLabel')}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">{t('callout.panel.title')}</h2>
        <span data-callout-outcome={outcome.raw}>
          <StatusBadge sev={outcome.sev}>
            {outcome.key ? t(`callout.${outcome.key}`) : <Ltr>{outcome.raw}</Ltr>}
          </StatusBadge>
        </span>
        <span className="text-xs text-muted-foreground">
          <Trans
            t={t}
            i18nKey="callout.panel.opened"
            values={{ at: formatDateTime(c.openedAt) }}
            components={{ at: <Ltr /> }}
          />
        </span>
        <span className="text-xs text-muted-foreground">
          <Trans
            t={t}
            i18nKey="callout.candidates"
            count={c.candidateCount}
            values={{ count: c.candidateCount }}
            components={{ n: <Ltr /> }}
          />
        </span>
        {c.fallbackParty && (
          <span className="text-xs text-muted-foreground">
            <Trans
              t={t}
              i18nKey="callout.panel.fallback"
              values={{ store: c.fallbackParty }}
              components={{ store: <Ltr /> }}
            />
          </span>
        )}
        {c.endReason && !notCompeted && (
          <span className="text-xs text-muted-foreground" data-end-reason={c.endReason}>
            <ReasonText group="endReason" value={c.endReason} />
          </span>
        )}
      </div>

      {c.locked && (
        <p className="flex items-center gap-1.5 text-xs text-attention-800" data-callout-locked="">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          <Trans t={t} i18nKey="callout.panel.locked" values={{ store: heldAt }} components={{ store: <Ltr /> }} />
        </p>
      )}
      {c.releasedAt && (
        <div
          className="flex flex-wrap items-baseline gap-x-2 rounded-md bg-muted px-3 py-1.5 text-xs"
          data-callout-released=""
        >
          <Unlock className="size-3.5 shrink-0 self-center" aria-hidden />
          <span>
            <Trans
              t={t}
              i18nKey="callout.panel.released"
              values={{ at: formatDateTime(c.releasedAt), by: c.releasedBy }}
              components={{ at: <Ltr />, by: <bdi /> }}
            />
          </span>
          {c.releaseReason && (
            <span className="text-muted-foreground">
              <ReasonText group="releaseReason" value={c.releaseReason} />
            </span>
          )}
          {c.releaseNote && (
            <span className="text-muted-foreground">
              <bdi>{c.releaseNote}</bdi>
            </span>
          )}
        </div>
      )}

      {notCompeted ? (
        <p className="text-sm" data-not-competed={c.endReason}>
          <Trans
            t={t}
            i18nKey={c.fallbackParty ? 'callout.moment.notCompeted' : 'callout.moment.notCompetedNoStore'}
            values={{ store: c.fallbackParty }}
            components={{ store: <Ltr /> }}
          />
          {c.endReason && (
            <>
              {' · '}
              <ReasonText group="notOpened" value={c.endReason} />
            </>
          )}
        </p>
      ) : (
        <div className="min-w-0">
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t('callout.ledger.title')}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-ledger="">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className={TH}>{t('callout.ledger.store')}</th>
                  <th className={`${TH} text-end`}>{t('callout.ledger.km')}</th>
                  <th className={TH}>{t('callout.ledger.atp')}</th>
                  <th className={TH} title={t('callout.ledger.tillsHint')}>
                    {t('callout.ledger.tills')}
                  </th>
                  <th className={TH}>{t('callout.ledger.delivered')}</th>
                  <th className={TH}>{t('callout.ledger.shown')}</th>
                  <th className={TH}>{t('callout.ledger.opened')}</th>
                  <th className={TH}>{t('callout.ledger.answered')}</th>
                  <th className={TH}>{t('callout.ledger.by')}</th>
                  <th className={TH}>{t('callout.ledger.outcome')}</th>
                </tr>
              </thead>
              <tbody>
                {c.bids.map((b) => (
                  <LedgerRow key={b.bidId} view={bidRow(b)} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{t('callout.ledger.hint')}</p>
        </div>
      )}

      <div className="min-w-0">
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <Trans t={t} i18nKey="callout.log.title" values={{ n: String(log.length) }} components={{ n: <Ltr /> }} />
        </h3>
        {log.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('callout.log.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-event-log="">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className={TH}>{t('callout.log.at')}</th>
                  <th className={`${TH} text-end`}>{t('callout.log.offset')}</th>
                  <th className={TH}>{t('callout.log.party')}</th>
                  <th className={TH}>{t('callout.log.kind')}</th>
                  <th className={TH}>{t('callout.log.staff')}</th>
                  <th className={TH}>{t('callout.log.register')}</th>
                  <th className={TH}>{t('callout.log.detail')}</th>
                </tr>
              </thead>
              <tbody>
                {log.map(({ event, seconds }, i) => (
                  <tr key={`${event.eventId}-${i}`} className="border-b border-border/40" data-event={event.kind}>
                    <td className={`${TD} font-mono whitespace-nowrap`}>
                      <Ltr>{formatDateTime(event.at)}</Ltr>
                    </td>
                    <td className={`${TD} text-end font-mono`}>
                      {seconds != null && <Ltr>{`+${formatClock(seconds)}`}</Ltr>}
                    </td>
                    <td className={`${TD} font-mono`}>{event.party && <Ltr>{event.party}</Ltr>}</td>
                    <td className={`${TD} font-mono`}>
                      <Ltr>{event.kind}</Ltr>
                    </td>
                    <td className={TD}>{event.staff && <bdi>{event.staff}</bdi>}</td>
                    <td className={`${TD} font-mono`}>{event.register && <Ltr>{event.register}</Ltr>}</td>
                    <td className={TD}>{event.detail && <bdi>{event.detail}</bdi>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

/** A moment's cell: seconds from offer, or a dash when it never happened. */
function MomentCell({ moment }: { moment: BidMoment }) {
  const { t } = useTranslation('document')
  return (
    <td className={`${TD} font-mono`} data-moment={moment.kind} data-moment-seconds={moment.seconds ?? ''}>
      {moment.seconds != null ? (
        <Ltr>{`+${formatClock(moment.seconds)}`}</Ltr>
      ) : (
        <span className="text-muted-foreground">{t('callout.ledger.never')}</span>
      )}
    </td>
  )
}

function LedgerRow({ view }: { view: BidRowView }) {
  const { t } = useTranslation('document')
  const answered = view.moments[3]
  return (
    <tr className="border-b border-border/40" data-ledger-row={view.store} data-bid-status={view.status.raw}>
      <td className={`${TD} font-mono font-medium`}>
        <span className="inline-flex items-center gap-1">
          <Ltr>{view.store}</Ltr>
          {view.dark && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-muted px-1 font-sans text-[10px] text-muted-foreground"
              data-dark=""
            >
              <MoonStar className="size-3" aria-hidden />
              {t('callout.ledger.dark')}
            </span>
          )}
        </span>
      </td>
      <td className={`${TD} text-end font-mono`}>
        <Ltr>{view.km.toFixed(1)}</Ltr>
      </td>
      <td className={TD} data-atp={view.atp.kind}>
        {view.atp.kind === 'covers' ? (
          <StatusBadge sev="ok">{t('callout.atp.covers')}</StatusBadge>
        ) : view.atp.kind === 'short' ? (
          <StatusBadge sev="warn">
            <Trans
              t={t}
              i18nKey="callout.atp.short"
              values={{ n: String(view.atp.lines) }}
              components={{ n: <Ltr /> }}
            />
          </StatusBadge>
        ) : (
          <StatusBadge sev="mute">{t('callout.atp.unknown')}</StatusBadge>
        )}
      </td>
      <td className={`${TD} font-mono`} data-tills="">
        <Ltr>{formatCount(view.tills.online, view.tills.signedIn)}</Ltr>
      </td>
      {view.moments.map((m) => (
        <MomentCell key={m.kind} moment={m} />
      ))}
      <td className={TD} data-answered-by="">
        {answered.at && (
          <>
            {answered.staff && <bdi>{answered.staff}</bdi>}
            {answered.register && (
              <span className="ms-1 text-muted-foreground">
                <Trans
                  t={t}
                  i18nKey="callout.register"
                  values={{ reg: answered.register }}
                  components={{ r: <Ltr /> }}
                />
              </span>
            )}
          </>
        )}
      </td>
      <td className={TD} data-outcome="">
        <StatusBadge sev={view.status.sev}>
          {view.status.key ? t(`callout.${view.status.key}`) : <Ltr>{view.status.raw}</Ltr>}
        </StatusBadge>
        {view.ignoreReason && (
          <div className="mt-0.5 text-[11px] text-muted-foreground" data-ignore-reason={view.ignoreReason}>
            <ReasonText group="ignoreReason" value={view.ignoreReason} />
          </div>
        )}
      </td>
    </tr>
  )
}
