import { Trans, useTranslation } from 'react-i18next'
import type { OrderSessionsView, SessionLine } from '@/core/prescription-session/lines'
import { AfterCloseText, StepSummary, Word } from '@/core/prescription-session/SessionWords'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { HEADING } from './facts-heading'

/**
 * **Prescription sessions** on Document Details (ticket 544, BackOffice 3016 + 3014): for an order
 * or a delivery, read-only — the order's one status line, then one line per attached session
 * (display id, source, holding store, state, route, its next step: label, owner, waiting on, parked
 * + note, badges), and under each session one line per after-close event. So an agent can answer
 * "where is my medicine?". It advances nothing: there is no button on it.
 *
 * The page draws it only with a view (`orderSessionsView` is null for an order with no session),
 * so an order without a session shows no heading and no empty state.
 */
export default function PrescriptionSessionsPanel({ view }: { view: OrderSessionsView }) {
  const { t } = useTranslation('document')
  return (
    <section
      aria-labelledby="doc-ps-heading"
      className="min-w-0 rounded-lg border border-border bg-card p-3 text-[0.8125rem]"
      data-ps-panel=""
    >
      <h3 id="doc-ps-heading" className={`mb-1.5 ${HEADING} text-prescription`}>
        {t('prescriptionSessions.heading')}
      </h3>
      {view.row && (
        <p className="mb-2 flex min-w-0 flex-wrap items-baseline gap-x-2" data-ps-row="">
          <span className="text-muted-foreground">{t('prescriptionSessions.row')}</span>
          <StepSummary step={view.row} />
        </p>
      )}
      <ul className="flex min-w-0 flex-col gap-2">
        {view.sessions.map((s) => (
          <SessionItem key={s.sessionId} session={s} />
        ))}
      </ul>
    </section>
  )
}

function SessionItem({ session: s }: { session: SessionLine }) {
  const { t } = useTranslation('document')
  return (
    <li className="min-w-0 border-t border-border pt-2 first:border-t-0 first:pt-0" data-ps-session={s.displayId}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-mono font-semibold" data-ps-display-id="">
          <Ltr>{s.displayId}</Ltr>
        </span>
        <span className="text-muted-foreground" data-ps-source={s.source.raw}>
          <Word word={s.source} />
        </span>
        <span className="text-muted-foreground" data-ps-holding-store={s.holdingStore}>
          <Trans
            t={t}
            i18nKey="prescriptionSessions.holdingStore"
            values={{ store: s.holdingStore }}
            components={{ v: <Ltr /> }}
          />
        </span>
        <span data-ps-state={s.state.raw}>
          <StatusBadge sev={s.stateSev}>
            <Word word={s.state} />
          </StatusBadge>
        </span>
        <span className="text-muted-foreground" data-ps-route={s.route.raw || 'none'}>
          <Word word={s.route} />
        </span>
      </div>
      {s.step && (
        <div className="mt-0.5 ps-3">
          <StepSummary step={s.step} />
        </div>
      )}
      {s.afterClose.length > 0 && (
        <ul className="mt-1 flex min-w-0 flex-col gap-0.5 ps-3" aria-label={t('prescriptionSessions.afterClose')} data-ps-after-close-list="">
          {s.afterClose.map((line, i) => (
            <li key={i} className="min-w-0 border-s-2 border-border ps-2">
              <AfterCloseText line={line} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
