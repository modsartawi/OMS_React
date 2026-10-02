/* PROTOTYPE CHROME 377 — dev-only, throwaway. Copy is dev chrome, exempt from t().
 *
 * A collapsible floating bar (bottom-start, so it stays out of the toast corners):
 * the five 377 axes, a stage that raises each overlay on demand through the REAL
 * code paths (notify.*, confirmAction, Modal, the NC store), plus the 363/362
 * switches still needed (shell, RTL, dark, stub).
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { create } from 'zustand'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import { confirmAction } from '@/core/services/confirm'
import { useNcStore } from '../notifications/store'
import { useTheme } from '../theme'
import { proto, setProto } from '@/core/theme/proto-362'
import { p363, setP363, SHELLS, type Shell } from './proto-363'
import { AXES, useP377, type P377 } from './proto-377'

const useStage = create<{ form: boolean; setForm: (v: boolean) => void }>((set) => ({
  form: false,
  setForm: (form) => set({ form }),
}))

const stage = {
  toasts() {
    notify.success('Delivery 80001238 rescheduled', 'New window Sat 4 Oct, 16:00 – 18:00.')
    setTimeout(() => notify.info('Saved view applied', 'Failed jobs triage · 36 rows'), 150)
    setTimeout(() => notify.warn('No acting store', 'Pick a store before searching deliveries.'), 300)
    setTimeout(
      () => notify.error('Couldn’t request cancellation', 'Delivery 80001238 is already out for delivery (OUT_FOR_DELIVERY).'),
      450,
    )
  },
  arrival() {
    // the two shapes useNotificationArrivals raises
    toast('Store 1017 closes at 21:00 on 3 Oct', {
      description: 'Reroute evening slots to 1002 Al Malaz.',
      duration: Infinity,
      action: { label: 'View', onClick: () => useNcStore.getState().setPanelOpen(true) },
      cancel: { label: 'Dismiss', onClick: () => {} },
    })
    setTimeout(() => toast('Export ready', { description: 'deliveries-2026-09.csv · 1,204 rows', duration: 8000 }), 200)
  },
  confirm() {
    void confirmAction(
      'Request cancellation for delivery 80001238? The store is told at once and the request cannot be withdrawn.',
      'Request cancellation',
    )
  },
  form() {
    useStage.getState().setForm(true)
  },
  errorInDialog() {
    useStage.getState().setForm(true)
    setTimeout(() => notify.error('Couldn’t reschedule', 'The 16:00 – 18:00 window is full (SLOT_FULL).'), 600)
  },
  bell() {
    useNcStore.getState().setPanelOpen(true)
  },
}

const FIELD = 'h-7 w-full rounded-md border border-input bg-background px-2 text-xs'
const LABEL = 'text-xs font-semibold text-muted-foreground'

/** A representative form dialog on the real Modal: select, select, textarea, checkbox. */
function ProtoFormDialog() {
  const open = useStage((s) => s.form)
  const setForm = useStage((s) => s.setForm)
  return (
    <Modal
      open={open}
      onClose={() => setForm(false)}
      title="Reschedule delivery 80001238"
      footer={
        <>
          <Button variant="text" onClick={() => setForm(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => setForm(false)}>
            Reschedule
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <p className="text-[0.8125rem] text-muted-foreground">Today’s window: Fri 3 Oct, 18:00 – 20:00 · store 1001.</p>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Day</span>
            <select className={FIELD} defaultValue="sat">
              <option value="sat">Sat 4 Oct</option>
              <option value="sun">Sun 5 Oct</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL}>Window</span>
            <select className={FIELD} defaultValue="16">
              <option value="16">16:00 – 18:00</option>
              <option value="18">18:00 – 20:00</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Note</span>
          <textarea rows={3} className="w-full resize-y rounded-md border border-input bg-background px-2 py-1 text-[0.8125rem]" defaultValue="Customer asked for a later slot." />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" defaultChecked /> Tell the customer by SMS
        </label>
      </div>
    </Modal>
  )
}

// capture-script handle (tools/proto-377-shots.mjs) — dev only
if (import.meta.env.DEV) Object.assign(window, { __stage: stage, __p377: useP377 })

export default function OverlayBar() {
  const o = useP377()
  const theme = useTheme()
  const [open, setOpen] = useState(true)
  if (!import.meta.env.DEV) return null
  const btn = 'rounded-md border border-white/30 px-2 py-1 hover:bg-white/15'
  const on = 'rounded-md border border-white bg-white px-2 py-1 text-black'

  return (
    <>
      <ProtoFormDialog />
      <div className="pointer-events-none fixed bottom-2 start-2 z-[100] max-w-[calc(100vw-1rem)]" data-proto-bar>
        <div
          className="pointer-events-auto flex flex-col gap-1.5 rounded-xl border-2 border-black/70 bg-black/90 px-3 py-2 text-[11px] text-white shadow-2xl"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className={btn} onClick={() => setOpen(!open)}>
              {open ? '▾ 377' : '▸ 377'}
            </button>
            {open && (
              <>
                <span className="opacity-60">stage</span>
                <button type="button" className={btn} onClick={stage.toasts}>toasts ×4</button>
                <button type="button" className={btn} onClick={stage.arrival}>arrival</button>
                <button type="button" className={btn} onClick={stage.confirm}>confirm</button>
                <button type="button" className={btn} onClick={stage.form}>form dialog</button>
                <button type="button" className={btn} onClick={stage.errorInDialog}>error in dialog</button>
                <button type="button" className={btn} onClick={stage.bell}>bell</button>
                <button type="button" className={btn} onClick={() => toast.dismiss()}>clear</button>
                <span className="mx-1 h-4 w-px bg-white/30" />
                <button type="button" className={theme.dark ? on : btn} onClick={theme.toggle}>dark</button>
                <button type="button" className={p363.rtl ? on : btn} onClick={() => setP363({ rtl: !p363.rtl })}>RTL</button>
                <select
                  className="rounded-md border border-white/30 bg-black px-1 py-1"
                  value={p363.shell}
                  onChange={(e) => setP363({ shell: e.target.value as Shell })}
                >
                  {SHELLS.map((s) => (
                    <option key={s.key} value={s.key}>{s.name}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 opacity-80">
                  <input type="checkbox" checked={proto.stub} onChange={(e) => setProto({ stub: e.target.checked })} />
                  stub
                </label>
              </>
            )}
          </div>
          {open &&
            (Object.keys(AXES) as (keyof P377)[]).map((k) => (
              <div key={k} className="flex flex-wrap items-center gap-1">
                <span className="w-9 opacity-60">{k}</span>
                {AXES[k].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={o[k] === opt.key ? on : btn}
                    onClick={() => o.set({ [k]: opt.key } as Partial<P377>)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ))}
        </div>
      </div>
    </>
  )
}
