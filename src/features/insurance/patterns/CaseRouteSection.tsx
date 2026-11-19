import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import LazyMapPanel from '@/core/map/LazyMapPanel'
import type { PatternCaseDetail } from '@/core/models/insurance-patterns'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair, formatParts, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { caseRoute, legsBesideMap, routeLegs, type RouteLegRow, type RouteWords } from './route'
import { unitWords } from './words'

/**
 * A case's route (oms 922; BackOffice spec 4050 stories 11, 14): the stores on Google's map (ADR 0139, `@/core/map`),
 * the legs between counter dispenses joined in time order, each labelled with its number, km and time, a travel leg in
 * the map's warning orange, a delivery's store a point with no leg (`./route`).
 *
 * When the map cannot draw — no `maps` part on the case (a guessed BackOffice ask), Google refusing the key, Google
 * unreachable — the legs show as a table instead, numbered as on the map: the screen stays usable. A store without
 * coordinates is listed under the map, and so are the legs the map cannot draw for it (review 9), with their numbers.
 */
export default function CaseRouteSection({ detail }: { detail: PatternCaseDetail }) {
  const { t } = useTranslation('insurance-patterns')
  const { stores, dispenses, legs } = detail
  // One drawing per route and language. Keyed on the three lists the route reads: a re-read after a mark keeps them
  // (TanStack's structural sharing), so the map is not started again.
  const route = useMemo(() => {
    const units = unitWords(t)
    const words: RouteWords = {
      leg: (n, km, minutes) => formatParts([n, km === null ? '' : units.km(km), units.duration(minutes)]),
      card: (store, counts) => ({
        title: store.storeName,
        subtitle: store.storeCode,
        figures: [
          { label: t('case.route.card.dispenses'), value: String(counts.dispenses) },
          { label: t('case.route.card.deliveries'), value: String(counts.deliveries) },
        ],
      }),
    }
    return caseRoute({ stores, dispenses, legs }, words)
  }, [stores, dispenses, legs, t])
  const legRows = useMemo(() => routeLegs({ stores, dispenses, legs }), [stores, dispenses, legs])

  // "Cannot draw" holds for the key it was tried with: a case read again with a key tries again.
  const key = detail.maps?.key ?? ''
  const [failedWith, setFailedWith] = useState<string | null>(null)
  const cannotDraw = failedWith !== null && failedWith === key
  const nothingToDraw = route.points.length === 0
  const onMap = !cannotDraw && !nothingToDraw
  const listed = legsBesideMap(legRows, onMap)

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" aria-labelledby="pattern-route-title" data-testid="pattern-route">
      <h3 id="pattern-route-title" className="text-sm font-semibold">
        {t('case.route.title')}
      </h3>
      {nothingToDraw ? (
        <p className="text-sm text-muted-foreground" data-testid="pattern-route-nothing">
          {t('case.route.noStores')}
        </p>
      ) : cannotDraw ? (
        <p className="text-sm text-muted-foreground" data-testid="pattern-route-cannot-draw">
          {t('case.route.cannotDraw')}
        </p>
      ) : (
        <>
          <LazyMapPanel
            points={route.points}
            lines={route.lines}
            maps={detail.maps}
            ariaLabel={t('case.route.mapLabel', { caseNumber: fsi(detail.caseNumber) })}
            className="h-96 w-full"
            onCannotDraw={() => setFailedWith(key)}
          />
          <Legend />
        </>
      )}
      {route.unplaced.length > 0 && (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" data-testid="pattern-route-unplaced">
          <span>{t('case.route.unplaced')}</span>
          {route.unplaced.map((s) => (
            <Ltr key={s.storeCode}>{formatPair(s.storeCode, s.storeName)}</Ltr>
          ))}
        </p>
      )}
      {onMap ? listed.length > 0 && <LegsTable rows={listed} title={t('case.route.legs.offMap')} /> : <LegsTable rows={listed} />}
    </section>
  )
}

/** What the marks on the map mean, in the map's own colours. */
function Legend() {
  const { t } = useTranslation('insurance-patterns')
  const line = 'inline-block h-[3px] w-5 rounded-full'
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" data-testid="pattern-route-legend">
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block size-2.5 rounded-full border border-map-ring bg-chart-1" aria-hidden />
        {t('case.route.legendPoint')}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className={`${line} bg-map-ring`} aria-hidden />
        {t('case.route.legendLeg')}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className={`${line} bg-map-worse`} aria-hidden />
        {t('case.route.legendTravel')}
      </li>
      <li>{t('case.route.legendDelivery')}</li>
    </ul>
  )
}

/**
 * The legs as a table, numbered as on the map: every leg the server sent, or — under a map, `title` naming them — the
 * legs it cannot draw.
 */
function LegsTable({ rows, title }: { rows: RouteLegRow[]; title?: string }) {
  const { t } = useTranslation('insurance-patterns')
  const units = unitWords(t)
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted-foreground" data-testid="pattern-legs-none">
        {t('case.route.legs.none')}
      </p>
    )
  const end = (d: RouteLegRow['from']) =>
    d && (
      <span className="flex flex-col">
        <Ltr>{formatPair(d.storeCode, d.storeName)}</Ltr>
        <span className="text-xs text-muted-foreground">
          <Ltr>{formatDateTime(d.at)}</Ltr>
        </span>
      </span>
    )
  return (
    <div className="flex flex-col gap-1">
      {title && (
        <p className="text-xs text-muted-foreground" data-testid="pattern-legs-off-map">
          {title}
        </p>
      )}
      <div className="overflow-auto">
        <table className="w-full text-sm" aria-label={title ?? t('case.route.legs.title')} data-testid="pattern-legs">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className={`${TH} text-end`}>{t('case.route.legs.n')}</th>
              <th className={TH}>{t('case.route.legs.from')}</th>
              <th className={TH}>{t('case.route.legs.to')}</th>
              <th className={`${TH} text-end`}>{t('case.route.legs.km')}</th>
              <th className={TH}>{t('case.route.legs.time')}</th>
              <th className={`${TH} text-end`}>{t('case.route.legs.speed')}</th>
              <th className={TH}>{t('case.route.legs.travel')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.leg.fromEventId}-${r.leg.toEventId}`} className="border-t border-border/60" data-testid="pattern-leg" data-travel={r.leg.travel}>
                <td className={`${TD} text-end tabular-nums`}>
                  <Ltr>{r.n}</Ltr>
                </td>
                <td className={TD}>{end(r.from)}</td>
                <td className={TD}>{end(r.to)}</td>
                <td className={`${TD} text-end`}>{r.leg.km !== null && <bdi>{units.km(r.leg.km)}</bdi>}</td>
                <td className={TD}>
                  <bdi>{units.duration(r.leg.minutes)}</bdi>
                </td>
                <td className={`${TD} text-end`}>{r.leg.kmPerHour !== null && <bdi>{units.speed(r.leg.kmPerHour)}</bdi>}</td>
                <td className={TD}>
                  <span className="flex flex-wrap gap-1">
                    {r.leg.travel && <StatusBadge sev="warn">{t('signal.travel')}</StatusBadge>}
                    {!r.drawn && <StatusBadge sev="mute">{t('case.route.legs.notOnMap')}</StatusBadge>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
