/**
 * The delivery slot, chosen from the store's own windows (ticket 173, US19).
 *
 * Three properties this surface exists to hold:
 *
 * 1. 🚩 **The gate is soft and stays soft.** A slot that lapses warns; it never
 *    blocks. `SLOT_UNAVAILABLE` (409) is a *warning path, not a submit blocker*
 *    by contract (§7), so a window that has gone since the list was read is
 *    drawn in the attention register — the order is untouched and the agent
 *    picks another — and never as a refusal the call has to stop for. The
 *    Wasfaty slot rule and its `1283`/`1154` exemption fell out with the
 *    non-CLCN kinds ([132](.issues/132-header-capture-inventory.md)) and are
 *    deliberately not re-introduced here.
 * 2. **The windows are read fresh, at the ORDER's store.** Slots are store- and
 *    time-specific — a window free two minutes ago may be full now — so the
 *    query is uncached by construction (`core/services/lookups`) and keyed by
 *    the plant the header actually holds. It is a reference read **off** the
 *    call-center door (137: store operational data, no document or customer data
 *    in it) and costs an agent who never opens this nothing.
 * 3. 🚩 **Nothing here decides whether a window is legal.** `status: false` is
 *    the server's own "full" and `SlotIsActive` is its own endpoint; the console
 *    renders both and the door refuses what it will not do.
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { SessionSlot } from '@/core/models/callcenter'
import type { TimeSlotTimeModel } from '@/core/models/slots'
import { lookupQueries } from '@/core/services/lookups'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import type { PickedSlot } from './api'
import { NOTE } from './console-notes'

export interface SlotApply {
  /** The window being applied, if any — its `slotId`. */
  pending: string | null
  /** A failure that is NOT the soft lapse, already worded by the caller. */
  error: string | null
  /** 🚩 The lapse, kept apart from `error` on purpose: it is the soft gate's own
   *  outcome and reads as a warning, not as something that went wrong. */
  lapsed: boolean
  /**
   * The window the agent chose, with the four descriptive fields v1.2 added to
   * `setSlot` (§10). They ride from here because the slot catalogue is not on
   * the call-center door (137) — the console already holds what it picked, and
   * the server would otherwise need a route added just to look it back up.
   */
  onPick: (slot: PickedSlot) => void
}


export default function SlotPicker({
  open,
  plant,
  current,
  apply,
  onClose,
}: {
  open: boolean
  /** The order's fulfilment store — whose windows these are. */
  plant: string
  /** What the order holds now, so the chosen one is marked and a lapse is named. */
  current: SessionSlot | null
  apply: SlotApply
  onClose: () => void
}) {
  const { t } = useTranslation('callcenter')
  const [dayIndex, setDayIndex] = useState(0)

  const slots = useQuery({ ...lookupQueries.availableSlots(plant), enabled: open && plant !== '' })
  const days = slots.data?.slots ?? []
  // A day index from the last open would point at a different day's windows.
  useEffect(() => {
    if (open) setDayIndex(0)
  }, [open, plant])

  const day = days[dayIndex] ?? null
  const busy = apply.pending !== null

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t('slot.title')}
      width="32rem"
      footer={
        // 🚩 There is no *clear the slot* here. `setSlot` takes `slotId | null`
        // and the ticket does not ask for the unset path — an agent who chose
        // the wrong window chooses another, which is one action rather than two.
        <Button variant="text" onClick={onClose} disabled={busy} data-cc-slot-close>
          {t('slot.close')}
        </Button>
      }
    >
      <div className="space-y-2 text-sm" data-cc-slot-picker>
        {/* Whose windows these are — the order's store, not the agent's. */}
        <p className="text-xs text-muted-foreground" data-cc-slot-store>
          {t('slot.atStore', { store: plant })}
        </p>

        {slots.isPending && (
          <p className="flex items-center gap-2 text-muted-foreground" data-cc-slot-loading>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('slot.loading')}
          </p>
        )}

        {slots.isError && (
          <>
            <p className={NOTE.danger} data-cc-slot-list-error>
              {apiErrorMessage(slots.error, t('slot.loadFailed'))}
            </p>
            {/* The read is pure, so trying it again costs the order nothing. */}
            <Button
              variant="outlined"
              onClick={() => void slots.refetch()}
              disabled={slots.isFetching}
              data-cc-slot-reload
            >
              {t('actions.retry')}
            </Button>
          </>
        )}

        {slots.isSuccess && days.length === 0 && (
          <p className="text-muted-foreground" data-cc-slot-empty>
            {t('slot.noneOffered')}
          </p>
        )}

        {days.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="cc-slot-day">
              {t('slot.day')}
            </label>
            <select
              id="cc-slot-day"
              value={String(dayIndex)}
              onChange={(e) => setDayIndex(Number(e.target.value))}
              disabled={busy}
              data-cc-slot-day
              className="h-8 w-full rounded-lg border border-input bg-background px-2 text-[0.8125rem]"
            >
              {days.map((entry, index) => (
                <option key={entry.fullDay || index} value={String(index)}>
                  {/* Server-supplied, passed through as data. */}
                  {entry.fullDay || `${entry.date} ${entry.day}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {day && day.times.length === 0 && (
          <p className="text-muted-foreground" data-cc-slot-day-empty>
            {t('slot.noWindows')}
          </p>
        )}

        {(day?.times ?? []).map((entry) => (
          <SlotRow
            key={entry.slotId}
            slot={entry}
            current={current?.slotId === entry.slotId}
            pending={apply.pending === entry.slotId}
            busy={busy}
            onPick={() =>
              apply.onPick({
                slotId: entry.slotId,
                // Server-supplied, passed straight back as data — the console
                // authors none of it and re-words none of it.
                day: day.day,
                description: entry.time,
                from: entry.slotFrom,
                to: entry.slotTo,
              })
            }
          />
        ))}

        {/* 🚩 The soft gate, drawn as a warning rather than as a failure: the
            window went while the list was open, the order is exactly as it was,
            and the order can still be placed. */}
        {apply.lapsed && (
          <p className={NOTE.attention} data-cc-slot-lapsed-refusal>
            {t('slot.lapsedRefusal')}
          </p>
        )}

        {apply.error && (
          <p className={NOTE.danger} data-cc-slot-error>
            {apply.error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function SlotRow({
  // Not named `window`: the domain word shadows the global, and a component that
  // has to think about which `window` it means is one keystroke from a bug.
  slot,
  current,
  pending,
  busy,
  onPick,
}: {
  slot: TimeSlotTimeModel
  current: boolean
  pending: boolean
  busy: boolean
  onPick: () => void
}) {
  const { t } = useTranslation('callcenter')
  // `status: false` is the server's own "full". It is drawn rather than hidden:
  // an agent who can see the window is full can say so to the caller.
  const full = slot.status === false
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy || current || full}
      data-cc-slot-option={slot.slotId}
      className="flex w-full items-center gap-2 rounded-md border border-border bg-card p-2.5 text-start hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card"
    >
      {/* Server-supplied, passed through as data. */}
      <span className="min-w-0 flex-1 text-sm font-medium">{slot.time}</span>
      {full && (
        <span className="shrink-0 text-[11px] text-muted-foreground" data-cc-slot-full>
          {t('slot.full')}
        </span>
      )}
      {current && (
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-success-800" data-cc-slot-current>
          <Check className="h-3 w-3" aria-hidden />
          {t('slot.onThisOrder')}
        </span>
      )}
      {pending && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
    </button>
  )
}
