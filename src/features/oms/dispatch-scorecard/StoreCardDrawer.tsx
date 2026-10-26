import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type {
  DispatchScorecardBidClass,
  DispatchScorecardCardMeasure,
  DispatchScorecardFigure,
  DispatchScorecardQuery,
} from '@/core/models/dispatch-scorecard'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import { dispatchScorecardApi } from './api'
import type { OpenDrill } from './columns'
import { cardMedianText, cardRank, directionLabelKey, formatMeasure, formatSeconds } from './figures'
import { refusalKey } from './range'
import Sheet from './Sheet'

/** Each class's swatch in "where its bids went" — token classes only (the colour-literal gate). */
const CLASS_SWATCH: Partial<Record<DispatchScorecardBidClass, string>> = {
  Won: 'bg-success',
  LostRace: 'bg-primary',
  PassedWithStock: 'bg-attention',
  PassedShort: 'bg-attention-border',
  PassedUnknown: 'bg-attention-050',
  Ignored: 'bg-danger',
  Unseen: 'bg-ink-3',
  Beaten: 'bg-border-strong',
  Withdrawn: 'bg-muted',
}

/**
 * A store's report card (2950 point 3, variant B as the drill target): `DispatchScorecard/StoreCard` for
 * the range and the other filters. The five measures with "#n of m" and the estate median exactly as
 * sent, where its bids went (a stacked bar), the context chips, and its staff. A measure opens its bids.
 */
export default function StoreCardDrawer({
  query,
  store,
  openDrill,
  onClose,
}: {
  query: DispatchScorecardQuery
  store: string
  openDrill: OpenDrill
  onClose: () => void
}) {
  const { t } = useTranslation('dispatch-scorecard')
  const dash = t('dash')
  const wire = useMemo(() => ({ ...query, store }), [query, store])
  const card = useQuery({
    queryKey: ['oms', 'dispatch-scorecard', 'card', wire],
    queryFn: () => dispatchScorecardApi.storeCard(wire),
    retry: false,
  })
  const row = card.data?.row ?? null
  const classes = (card.data?.classes ?? []).filter((c) => c.count > 0)
  const total = classes.reduce((n, c) => n + c.count, 0)
  const refusal = card.isError ? refusalKey(card.error) : null

  return (
    <Sheet
      data-sc-card={store}
      width="w-[56rem]"
      eyebrow={t('card.eyebrow')}
      title={<Ltr>{formatPair(store, row?.name)}</Ltr>}
      onClose={onClose}
    >
      {card.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('card.loading')}
        </p>
      ) : card.isError ? (
        <ErrorBanner className="p-2.5" title={t('card.failedTitle')} message={refusal ? t(refusal) : apiErrorMessage(card.error, t('card.failed'))} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {row?.city && <bdi>{row.city}</bdi>}
            {row?.tooFew && (
              <span className="rounded-full border border-border px-1.5" data-sc-card-too-few="">
                {t('card.tooFew')}
              </span>
            )}
            <span>
              <Trans t={t} i18nKey="card.bids" count={row?.bids ?? 0} values={{ n: String(row?.bids ?? 0) }} components={{ n: <Ltr /> }} />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5" data-sc-card-measures="">
            {card.data.measures.map((m) => (
              <MeasureTile key={m.measure} m={m} dash={dash} onOpen={() => openDrill(m.measure as DispatchScorecardFigure, { store })} />
            ))}
          </div>

          <h3 className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('card.whereBidsWent')}</h3>
          {total === 0 ? (
            <p className="text-sm text-muted-foreground">{t('card.noBids')}</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" data-sc-card-bar="">
                {classes.map((c) => (
                  <div
                    key={c.class}
                    className={CLASS_SWATCH[c.class] ?? 'bg-muted-foreground'}
                    style={{ width: `${(c.count / total) * 100}%` }}
                    title={t(`class.${c.class}`, { defaultValue: c.class })}
                    data-sc-card-segment={c.class}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                {classes.map((c) => (
                  <span key={c.class} className="flex items-center gap-1.5">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${CLASS_SWATCH[c.class] ?? 'bg-muted-foreground'}`} aria-hidden />
                    {t(`class.${c.class}`, { defaultValue: c.class })} <Ltr>{String(c.count)}</Ltr>
                  </span>
                ))}
              </div>
            </>
          )}

          {row && (
            <>
              <h3 className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('card.context')}</h3>
              <div className="flex flex-wrap gap-2 text-xs" data-sc-card-context="">
                <Chip>
                  <Trans t={t} i18nKey="card.chip.nearMisses" count={row.nearMisses} values={{ n: String(row.nearMisses) }} components={{ n: <Ltr /> }} />
                </Chip>
                <Chip>
                  <Trans t={t} i18nKey="card.chip.darkOffers" count={row.darkOffers} values={{ n: String(row.darkOffers) }} components={{ n: <Ltr /> }} />
                </Chip>
                <Chip>
                  <Trans
                    t={t}
                    i18nKey="card.chip.unseen"
                    values={{ a: String(row.unseenNobodySignedIn), b: String(row.unseenOldBuild) }}
                    components={{ a: <Ltr />, b: <Ltr /> }}
                  />
                </Chip>
                <Chip>
                  <Trans
                    t={t}
                    i18nKey="card.chip.medianKm"
                    values={{ km: row.medianKm == null ? dash : row.medianKm.toFixed(1) }}
                    components={{ km: <Ltr /> }}
                  />
                </Chip>
                <Chip>
                  <Trans
                    t={t}
                    i18nKey="card.chip.fallbacks"
                    count={row.fallbacksReceived}
                    values={{ n: String(row.fallbacksReceived) }}
                    components={{ n: <Ltr /> }}
                  />
                </Chip>
                <Chip>
                  <Trans
                    t={t}
                    i18nKey="card.chip.released"
                    count={row.releasedAfterAward}
                    values={{ n: String(row.releasedAfterAward) }}
                    components={{ n: <Ltr /> }}
                  />
                </Chip>
              </div>
            </>
          )}

          <h3 className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('card.staff')}</h3>
          {card.data.staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('card.noStaff')}</p>
          ) : (
            <table className="w-full text-sm" data-sc-card-staff="">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 text-start font-medium">{t('column.staff')}</th>
                  <th className="py-1 text-end font-medium">{t('column.won')}</th>
                  <th className="py-1 text-end font-medium">{t('column.lostRaces')}</th>
                  <th className="py-1 text-end font-medium">{t('column.passedWithStock')}</th>
                  <th className="py-1 text-end font-medium">{t('measure.medianAnswerSeconds')}</th>
                  <th className="py-1 text-end font-medium">{t('measure.slowQuarterAnswerSeconds')}</th>
                </tr>
              </thead>
              <tbody>
                {card.data.staff.map((s) => (
                  <tr key={s.staff} className="border-t border-border/60" data-sc-card-person={s.staff}>
                    <td className="py-1">
                      <bdi>{s.staff}</bdi>
                      {s.tooFew && <span className="ms-1.5 text-[10.5px] text-muted-foreground">{t('tooFew')}</span>}
                    </td>
                    <td className="py-1 text-end tabular-nums"><Ltr>{String(s.won)}</Ltr></td>
                    <td className="py-1 text-end tabular-nums"><Ltr>{String(s.lostRaces)}</Ltr></td>
                    <td className="py-1 text-end tabular-nums"><Ltr>{String(s.passedWithStock)}</Ltr></td>
                    <td className="py-1 text-end tabular-nums">
                      <Ltr>{s.medianAnswerSeconds == null ? dash : formatSeconds(s.medianAnswerSeconds)}</Ltr>
                    </td>
                    <td className="py-1 text-end tabular-nums">
                      <Ltr>{s.slowQuarterAnswerSeconds == null ? dash : formatSeconds(s.slowQuarterAnswerSeconds)}</Ltr>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Sheet>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-border bg-card-2 px-2 py-0.5">{children}</span>
}

/** One measure: its value, its better direction, "#n of m" and the estate median, all as sent. */
function MeasureTile({ m, dash, onOpen }: { m: DispatchScorecardCardMeasure; dash: string; onOpen: () => void }) {
  const { t } = useTranslation('dispatch-scorecard')
  const rank = cardRank(m)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex cursor-pointer flex-col items-start gap-1 rounded-lg border border-border bg-card p-3 text-start hover:border-primary"
      data-sc-card-measure={m.measure}
    >
      <span className="text-xs text-muted-foreground">{t(`measure.${m.measure}`)}</span>
      <span className="text-[10.5px] text-muted-foreground">{t(directionLabelKey(m.better))}</span>
      <span className="text-lg font-semibold tabular-nums" data-sc-card-value="">
        <Ltr>{formatMeasure(m.measure, m.value, dash)}</Ltr>
      </span>
      <span className="text-xs text-muted-foreground" data-sc-card-rank="">
        {rank.ranked ? (
          <Trans t={t} i18nKey="card.rank" values={{ rank: rank.rank, of: rank.of }} components={{ rank: <Ltr />, of: <Ltr /> }} />
        ) : (
          t('card.unranked')
        )}
      </span>
      <span className="text-xs text-muted-foreground" data-sc-card-median="">
        <Trans t={t} i18nKey="card.estate" values={{ median: cardMedianText(m, dash) }} components={{ median: <Ltr /> }} />
      </span>
    </button>
  )
}
