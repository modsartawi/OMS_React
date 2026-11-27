import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'
import LazyMapPanel from '@/core/map/LazyMapPanel'
import type { MapPlace } from '@/core/map/map-panel'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatPair, fsi } from '@/core/util/bidi'
import { lookupQueries } from '@/core/services/lookups'
import { workbenchQuery } from './api'
import { pointText } from './cart'
import { CUSTOMER_INK, mapPlans, MODE_INK, storePlaces, type MapScope, type MapWords } from './map-plans-model'
import { useSimulatorRun } from './run-context'
import type { SimulatorTabProps } from './SimulatorTabs'
import { usePlanWords } from './use-plan-words'

const SCOPES: readonly MapScope[] = ['all', 'plan']
const WITHHELD = new Set(['NO_GRANT', 'NOT_A_REPLAY', 'NOT_FULL_LEVEL', 'NOT_ASKED'])
/** The modes the legend names, in its order: the carriers share one colour. */
const LEGEND_MODES = ['DAWAA_NOW', 'SLOT', 'CARRIER_SAME_DAY'] as const

/**
 * The map tab (ticket 964, BackOffice spec 4354 §19, §12; SIMT decisions 4–5), on the Google map panel: every plan's
 * stores at once by mode (a switch narrows it to the plan picked above), each leg to the customer labelled with its
 * distance, the pick-up leg dashed, a dotted line joining one plan's stores, the 5 km and 10 km rings and the customer's
 * pin. A click places the customer and a drag moves the pin: the run plans again on the drop. Without the customer's
 * point there is no pin, no ring and no leg, and the tab says why. Under the map: each store with its mode, plan, road and
 * straight-line distance; and the distances between the stores.
 */
export default function MapTab({ reply, plan }: SimulatorTabProps) {
  const w = usePlanWords()
  const { t } = w
  const run = useSimulatorRun()
  const workbench = useQuery(workbenchQuery())
  // The run record carries no store's point: the store list every screen reads does.
  const details = useQuery(lookupQueries.storeDetails())
  const places = useMemo(() => storePlaces(details.data), [details.data])
  const [scope, setScope] = useState<MapScope>('all')
  const [cannotDraw, setCannotDraw] = useState(false)
  const [typed, setTyped] = useState({ lat: '', lng: '' })

  const customerName = t('map.customer')
  const view = useMemo(() => {
    const words: MapWords = { mode: w.mode, km: (km) => t('card.km', { km: km.toFixed(1) }), ring: (km) => t('map.ring', { km }), customer: customerName }
    return mapPlans(reply, { scope, goal: plan?.goal ?? null, words, places })
    // `w` and `t` change with the language only, as `customerName` does.
  }, [reply, scope, plan?.goal, customerName, places])

  const move = useCallback((p: MapPlace) => run?.moveCustomer(p), [run])
  const lat = Number(typed.lat)
  const lng = Number(typed.lng)
  const typedOk = typed.lat.trim() !== '' && typed.lng.trim() !== '' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && Number.isFinite(lat) && Number.isFinite(lng)
  const byHand = reply.kind === 'REPLAY_MOVED_POINT' || reply.kind === 'HAND_BUILT'

  return (
    <div className="flex flex-col gap-3" data-sim-map="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{run ? t('map.hint') : null}</p>
        <div role="group" aria-label={t('map.scopeLabel')} className="flex gap-1" data-map-scope={scope}>
          {SCOPES.map((s) => (
            <Chip key={s} on={scope === s} onClick={() => setScope(s)} data-map-scope-switch={s}>
              {t(`map.scope.${s}`)}
            </Chip>
          ))}
        </div>
      </div>

      {view.withheld && (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs" data-map-withheld={view.withheld}>
          {t(`map.withheld.${WITHHELD.has(view.withheld) ? view.withheld : 'unknown'}`)}
        </p>
      )}

      <LazyMapPanel
        points={view.points}
        lines={view.lines}
        rings={view.rings}
        pin={view.pin}
        groupNearby={false}
        maps={workbench.data?.maps ?? null}
        ariaLabel={t('map.mapLabel')}
        onPlace={run ? move : undefined}
        onPinMoved={run ? move : undefined}
        onDrawn={() => setCannotDraw(false)}
        onCannotDraw={() => setCannotDraw(true)}
        className="h-96 w-full"
      />

      {cannotDraw && run && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3" data-map-typed="">
          <p className="text-xs text-muted-foreground">{t('map.cannotDraw')}</p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('map.lat')}>
              <Input dir="ltr" inputMode="decimal" className="w-32 font-mono" value={typed.lat} onChange={(e) => setTyped({ ...typed, lat: e.target.value })} data-map-typed-field="lat" />
            </Field>
            <Field label={t('map.lng')}>
              <Input dir="ltr" inputMode="decimal" className="w-32 font-mono" value={typed.lng} onChange={(e) => setTyped({ ...typed, lng: e.target.value })} data-map-typed-field="lng" />
            </Field>
            <Button variant="secondary" disabled={!typedOk} onClick={() => move({ lat: Number(pointText(lat)), lon: Number(pointText(lng)) })} data-map-place-at="">
              <MapPin className="size-3.5" aria-hidden />
              {t('map.placeAt')}
            </Button>
          </div>
        </div>
      )}

      <ul aria-label={t('map.legend.label')} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" data-map-legend="">
        {view.pin && (
          <li className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rotate-45 border border-map-ring" style={{ background: `var(${CUSTOMER_INK})` }} aria-hidden />
            {byHand ? t('map.legend.customerByHand') : t('map.legend.customer')}
          </li>
        )}
        {LEGEND_MODES.map((m) => (
          <li key={m} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full" style={{ background: `var(${MODE_INK[m]})` }} aria-hidden />
            {t('map.legend.mode', { mode: w.mode(m) })}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full" style={{ background: `var(${MODE_INK.PICK_UP})` }} aria-hidden />
          {t('map.legend.pickUp')}
        </li>
        <li>{t('map.legend.between')}</li>
        {view.rings.length > 0 && <li>{t('map.legend.rings')}</li>}
      </ul>

      {view.unplaced.length > 0 && (
        <p className="text-xs text-muted-foreground" data-map-unplaced="">
          {t('map.unplaced', { stores: fsi(view.unplaced.join(', ')) })}
        </p>
      )}

      {view.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('map.noStores')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs" data-map-stores="">
            <thead>
              <tr>
                <th className={TH} scope="col">
                  {t('map.table.store')}
                </th>
                <th className={TH} scope="col">
                  {t('map.table.mode')}
                </th>
                <th className={TH} scope="col">
                  {t('map.table.plan')}
                </th>
                <th className={`${TH} text-end`} scope="col">
                  {t('map.table.road')}
                </th>
                <th className={`${TH} text-end`} scope="col">
                  {t('map.table.straight')}
                </th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <tr key={`${r.goal}-${r.shipmentNo}`} data-map-store-row={`${r.goal}:${r.shipmentNo}`} data-map-store={r.store}>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{formatPair(r.store, r.storeName)}</Ltr>
                  </td>
                  <td className={TD}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block size-2 rounded-full" style={{ background: `var(${MODE_INK[r.mode] ?? '--map-same'})` }} aria-hidden />
                      {w.mode(r.mode)}
                    </span>
                  </td>
                  <td className={TD}>{t('map.table.planShipment', { goal: w.goal(r.goal), n: fsi(r.shipmentNo) })}</td>
                  <td className={`${TD} text-end tabular-nums`} data-map-road="">
                    {r.km === null ? t('card.noLocation') : <Ltr>{w.km(r.km)}</Ltr>}
                    {r.kmKind === 'STRAIGHT_LINE' && <span className="ms-1.5 text-muted-foreground">{t('map.table.straightLineMark')}</span>}
                  </td>
                  <td className={`${TD} text-end tabular-nums`} data-map-straight="">
                    {r.straightKm === null ? t('dash') : <Ltr>{w.km(r.straightKm)}</Ltr>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view.between.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-semibold">{t('map.between.title')}</h4>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs" data-map-between="">
              <thead>
                <tr>
                  <th className={TH} scope="col">
                    {t('map.between.from')}
                  </th>
                  <th className={TH} scope="col">
                    {t('map.between.to')}
                  </th>
                  <th className={`${TH} text-end`} scope="col">
                    {t('map.between.km')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {view.between.map((b) => (
                  <tr key={`${b.from}-${b.to}`} data-map-between-row={`${b.from}:${b.to}`}>
                    <td className={`${TD} font-mono`}>
                      <Ltr>{formatPair(b.from, b.fromName)}</Ltr>
                    </td>
                    <td className={`${TD} font-mono`}>
                      <Ltr>{formatPair(b.to, b.toName)}</Ltr>
                    </td>
                    <td className={`${TD} text-end tabular-nums`}>
                      <Ltr>{w.km(b.km)}</Ltr>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">{t('map.between.note')}</p>
        </div>
      )}
    </div>
  )
}
