import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { apiErrorMessage } from '@/core/api'
import { storeProfileHref } from '@/core/command-center-routes'
import { TONE_DOT } from '@/core/findings/finding-card'
import type { CcLang, CcMeasure, CcScorecard } from '@/core/models/command-center'
import { buttonClass } from '@/core/ui/control-classes'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { fsi } from '@/core/util/bidi'
import type { CcT } from './lang'
import { scorecardQuery } from './scorecard-api'

/**
 * A pharmacy's scorecard panel (oms 947, spec 4165 "The scorecard panel"): the six measures, each with its stored
 * colour, its own figure and its peer group's, and the way on — the store profile (948). Opened by a point on the map or
 * a pharmacy code in the brief: both put the pharmacy in the URL (`?store=`), so they open the same panel.
 *
 * `action` is the slot for the panel's other button: 950 hands in "Ask the copilot" built from the scorecard (its `ask`).
 * The panel draws no Ask of its own. The page computes nothing: colours, figures and order are the server's.
 */
export default function ScorecardPanel({
  storeCode,
  lang,
  t,
  onClose,
  action,
}: {
  storeCode: string
  lang: CcLang
  t: CcT
  onClose: () => void
  /** The caller's button(s) beside "Open the store profile" (950: "Ask the copilot"), given the loaded scorecard. */
  action?: (scorecard: CcScorecard) => ReactNode
}) {
  const titleId = useId()
  const card = useQuery(scorecardQuery(storeCode, lang))
  return (
    <SideSheet onClose={onClose} width="w-[28rem]" aria-labelledby={titleId} data-cc-scorecard={storeCode}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('scorecard.eyebrow')}
        title={<Ltr>{card.data?.title ?? storeCode}</Ltr>}
        hint={card.data ? <bdi>{card.data.peerGroup}</bdi> : undefined}
        closeLabel={t('scorecard.close')}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3 text-sm">
        {card.isPending ? (
          <p className="text-muted-foreground" role="status">
            {t('scorecard.loading')}
          </p>
        ) : card.isError ? (
          <ErrorBanner message={apiErrorMessage(card.error, t('scorecard.loadFailed'))} />
        ) : (
          <Scorecard card={card.data} lang={lang} t={t} action={action} />
        )}
      </div>
    </SideSheet>
  )
}

function Scorecard({ card, lang, t, action }: { card: CcScorecard; lang: CcLang; t: CcT; action?: (scorecard: CcScorecard) => ReactNode }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{t('scorecard.dataAsOf', { date: fsi(card.dataAsOf) })}</span>
        {card.flagged && (
          <span className="rounded-full bg-danger-050 px-2 py-0.5 font-medium text-danger-800" data-cc-flagged>
            {t('scorecard.flagged')}
          </span>
        )}
        {card.isNew && (
          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground" data-cc-is-new>
            {t('scorecard.isNew')}
          </span>
        )}
      </div>
      <ol className="flex flex-col divide-y divide-border/50 rounded-lg border border-border/60" data-cc-measures>
        {card.measures.map((measure) => (
          <Measure key={measure.key} measure={measure} t={t} />
        ))}
      </ol>
      {card.context.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2" data-cc-context>
          {card.context.map((figure) => (
            <div key={figure.label} className="flex flex-col">
              <dt className="text-xs text-muted-foreground">
                <bdi>{figure.label}</bdi>
              </dt>
              <dd className="font-medium tabular-nums">
                <Ltr>{figure.value}</Ltr>
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex flex-wrap items-center gap-2" data-cc-scorecard-actions>
        <Link to={storeProfileHref(card.storeCode, { lang })} className={buttonClass('secondary')} data-cc-open-profile>
          {t('scorecard.openProfile')}
        </Link>
        {action?.(card)}
      </div>
    </>
  )
}

/**
 * One measure: its stored colour as a dot, its name, and its own and peer figures. A new pharmacy's growth measures read
 * "new" and show no figure (spec 4165 "New pharmacy"); a measure not scored says so. The colour is never the only sign:
 * the figures and the words sit beside it.
 */
function Measure({ measure, t }: { measure: CcMeasure; t: CcT }) {
  return (
    <li className="flex items-start gap-2 px-3 py-2" data-cc-measure={measure.key} data-cc-state={measure.state}>
      <span
        aria-hidden
        className={`mt-1.5 size-2 shrink-0 rounded-full ${measure.colour ? TONE_DOT[measure.colour] : 'border border-border'}`}
        data-tone={measure.colour ?? 'none'}
      />
      <span className="min-w-0 flex-1">
        <bdi className="font-medium">{measure.label}</bdi>
        {measure.plain && (
          <span className="block text-xs text-muted-foreground">
            {t('scorecard.plain')} <Ltr>{measure.plain}</Ltr>
          </span>
        )}
      </span>
      {measure.state === 'new' ? (
        <span className="shrink-0 font-medium text-muted-foreground" data-cc-new>
          {t('scorecard.new')}
        </span>
      ) : measure.state === 'not-scored' ? (
        <span className="shrink-0 text-muted-foreground">{t('scorecard.notScored')}</span>
      ) : (
        <span className="flex shrink-0 flex-col items-end tabular-nums">
          <span className="font-semibold" data-cc-own>
            <Ltr>{measure.own}</Ltr>
          </span>
          <span className="text-xs text-muted-foreground">
            {t('scorecard.peer')} <Ltr>{measure.peer}</Ltr>
          </span>
        </span>
      )}
    </li>
  )
}
