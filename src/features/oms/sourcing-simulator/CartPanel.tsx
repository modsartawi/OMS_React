import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, MapPin, Play, Plus, Trash2 } from 'lucide-react'
import LazyMapPanel from '@/core/map/LazyMapPanel'
import type { MapPlace, MapPoint, MapsAccess } from '@/core/map/map-panel'
import type { AdviseReply } from '@/core/models/sourcing-run'
import { lookupQueries } from '@/core/services/lookups'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { pointText, simulatorChannels, type CartForm, type CartProblem } from './cart'
import { START_KINDS, type ReplayForm, type ReplayProblem, type StartKind } from './replay'
import ReplayStart from './ReplayStart'

const PROBLEM_KEY: Record<CartProblem | ReplayProblem, string> = {
  noOrder: 'replay.needs',
  badOrder: 'replay.badOrder',
  noLines: 'run.needs',
  noPoint: 'run.needs',
  badLine: 'run.badLine',
  badPoint: 'run.badPoint',
  badTotal: 'run.badTotal',
}

/**
 * The left column (ticket 962): start a run. The channel, the time of day, the cart's lines and the customer, placed by
 * a click on the map panel (or typed, when the map cannot be drawn). It runs on the Run button, never on a change.
 * 964: a two-way switch first (SIMT decision 6) — replay an order (`./ReplayStart`) or build a cart.
 */
export default function CartPanel({
  form,
  onChange,
  maps,
  problem,
  running,
  waiting = false,
  onRun,
  start = 'build',
  onStart,
  replay,
  onReplay,
  reply = null,
}: {
  form: CartForm
  onChange: (form: CartForm) => void
  maps: MapsAccess | null
  problem: CartProblem | ReplayProblem | null
  running: boolean
  /** Review 4354 #7: the weight set is still being read; Run waits for it. */
  waiting?: boolean
  onRun: () => void
  /** 964: how the run is started; absent builds a cart, as before. */
  start?: StartKind
  onStart?: (start: StartKind) => void
  replay?: ReplayForm
  onReplay?: (form: ReplayForm) => void
  /** The latest reply, for the replayed order's lines, channel and time. */
  reply?: AdviseReply | null
}) {
  const { t } = useTranslation('sourcing-simulator')
  const [cannotDraw, setCannotDraw] = useState(false)
  // The call centre's channels are the order sources of category C (BackOffice 4381).
  const sources = useQuery(lookupQueries.documentSources())
  const channels = useMemo(() => simulatorChannels(sources.data), [sources.data])
  const set = (patch: Partial<CartForm>) => onChange({ ...form, ...patch })
  const setLine = (key: number, patch: { item?: string; quantity?: string }) =>
    set({ lines: form.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) })
  const addLine = () => set({ lines: [...form.lines, { key: Math.max(0, ...form.lines.map((l) => l.key)) + 1, item: '', quantity: '1' }] })
  const removeLine = (key: number) => set({ lines: form.lines.filter((l) => l.key !== key) })

  // The customer's pin: one point, stable while the place stands (a new array restarts the map).
  const lat = Number(form.lat)
  const lng = Number(form.lng)
  const placed = form.lat.trim() !== '' && form.lng.trim() !== '' && Number.isFinite(lat) && Number.isFinite(lng)
  const pinTitle = t('customer.pinTitle')
  const points = useMemo<MapPoint[]>(
    () => (placed ? [{ id: 'customer', lon: lng, lat, ink: '--primary', card: { title: pinTitle, subtitle: '', figures: [] } }] : []),
    [placed, lat, lng, pinTitle],
  )
  // The latest form, so the click handler never restarts the map.
  const onPlace = useCallback((p: MapPlace) => onChange({ ...form, lat: pointText(p.lat), lng: pointText(p.lon) }), [form, onChange])

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-sim-cart="">
      <h2 className="text-sm font-semibold">{t('cart.title')}</h2>
      {onStart && (
        <div role="group" aria-label={t('replay.startLabel')} className="flex gap-1" data-sim-start={start}>
          {START_KINDS.map((k) => (
            <Chip key={k} on={start === k} onClick={() => onStart(k)} data-sim-start-switch={k}>
              {t(`replay.start.${k}`)}
            </Chip>
          ))}
        </div>
      )}
      {start === 'replay' && replay && onReplay && <ReplayStart form={replay} onChange={onReplay} reply={reply} />}
      {/* 964: the cart's own fields, shown only when building a cart (left at their indent to keep the change small). */}
      {start === 'build' && (<>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('cart.channel')}>
          <Select className="w-full" value={form.channel} onChange={(e) => set({ channel: e.target.value })} data-sim-field="channel">
            {channels.map((c) => (
              <option key={c} value={c}>
                {t(`cart.channels.${c}`, { defaultValue: t('cart.channels.callCentreSource', { code: fsi(c) }) })}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('cart.time')} hint={t('cart.timeHint')}>
          <Input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} data-sim-field="time" />
        </Field>
        <Field className="col-span-2" label={t('cart.goodsTotal')} hint={t('cart.goodsTotalHint')}>
          <Input dir="ltr" inputMode="decimal" value={form.goodsTotal} onChange={(e) => set({ goodsTotal: e.target.value })} data-sim-field="goodsTotal" />
        </Field>
      </div>

      <div className="flex flex-col gap-2" data-sim-lines="">
        <h3 className="text-xs font-semibold text-muted-foreground">{t('cart.lines')}</h3>
        {form.lines.map((l, i) => (
          <div key={l.key} className="flex items-end gap-2" data-sim-line={i + 1}>
            <span className="pb-1.5 text-xs text-muted-foreground">
              <Ltr>{i + 1}</Ltr>
            </span>
            <Field className="min-w-0 flex-1" label={t('cart.item')}>
              <Input dir="ltr" className="w-full font-mono" value={l.item} onChange={(e) => setLine(l.key, { item: e.target.value })} data-sim-line-item="" />
            </Field>
            <Field className="w-24" label={t('cart.quantity')}>
              <Input dir="ltr" inputMode="numeric" className="w-full" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} data-sim-line-qty="" />
            </Field>
            <IconButton label={t('cart.removeLine', { n: fsi(i + 1) })} onClick={() => removeLine(l.key)} data-sim-line-remove="">
              <Trash2 className="size-3.5" aria-hidden />
            </IconButton>
          </div>
        ))}
        <Button variant="secondary" className="self-start" onClick={addLine} data-sim-add-line="">
          <Plus className="size-3.5" aria-hidden />
          {t('cart.addLine')}
        </Button>
      </div>

      <div className="flex flex-col gap-2" data-sim-customer="">
        <h3 className="text-xs font-semibold text-muted-foreground">{t('customer.title')}</h3>
        <p className="text-xs text-muted-foreground">{cannotDraw ? t('customer.cannotDraw') : t('customer.hint')}</p>
        <LazyMapPanel
          points={points}
          groupNearby={false}
          maps={maps}
          ariaLabel={t('customer.mapLabel')}
          onPlace={onPlace}
          onDrawn={() => setCannotDraw(false)}
          onCannotDraw={() => setCannotDraw(true)}
          className="h-64 w-full"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('customer.lat')}>
            <Input dir="ltr" inputMode="decimal" className="w-full font-mono" value={form.lat} onChange={(e) => set({ lat: e.target.value })} data-sim-field="lat" />
          </Field>
          <Field label={t('customer.lng')}>
            <Input dir="ltr" inputMode="decimal" className="w-full font-mono" value={form.lng} onChange={(e) => set({ lng: e.target.value })} data-sim-field="lng" />
          </Field>
        </div>
        {placed && (
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-sim-placed="">
            <MapPin className="size-3.5" aria-hidden />
            {t('customer.placed')}
          </p>
        )}
      </div>
      </>)}

      {problem ? (
        <p className="text-xs text-muted-foreground" data-sim-needs={problem}>
          {t(PROBLEM_KEY[problem])}
        </p>
      ) : (
        waiting && (
          <p className="text-xs text-muted-foreground" data-sim-waits-for-set="">
            {t('run.readingSet')}
          </p>
        )
      )}
      <Button variant="primary" className="self-start" disabled={!!problem || running || waiting} onClick={onRun} data-sim-run="">
        {running ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        {running ? t('run.planning') : t('run.action')}
      </Button>
    </section>
  )
}
