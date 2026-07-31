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
 *
 * 🚩 **Two rows: the days, then that day's windows** (owner-stated 2026-07-29 —
 * *"I think it will be faster to select"*). It replaces a `<select>` of days
 * above a vertical stack of windows, which cost the agent a dropdown they had to
 * open, read and close before they could see a single time. Both halves of the
 * question are now on screen at once and each is one press.
 *
 * The shape is the same one this console already uses for a small closed set of
 * choices, and it changes nothing about what a window MEANS: `full` is still
 * drawn rather than hidden, the held window still carries its tick, and the
 * apply is still one press with no confirm step.
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
import ChipSection from './ChipSection'
import type { PickedSlot } from './api'
import { NOTE } from './console-notes'
import { initialDayIndex } from './slot-view'

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
  /**
   * A day index from the last open would point at a different day's windows, so
   * every open re-seeds it — and re-seeds it to **the day the order's own slot is
   * on** (`initialDayIndex`), not to the first day.
   *
   * ⚠️ `days` is in the dependency list on purpose: the list arrives AFTER the
   * open on a cold cache (the read is uncached by construction, property 2), so
   * seeding only on `open` would always land on 0 and the rule would silently
   * never fire. Re-running when the answer changes is what makes it land, and it
   * is idempotent — the same list seeds the same index.
   */
  useEffect(() => {
    if (open) setDayIndex(initialDayIndex(days, current))
  }, [open, plant, slots.data, current])

  const day = days[dayIndex] ?? null
  const busy = apply.pending !== null

  return (
    <ChipSection
      open={open}
      onClose={() => !busy && onClose()}
      name="slot"
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

        {/* ROW 1 — THE DAYS. Choosing one costs nothing: it is local state and
            touches no order, which is why it is drawn as a strip of presses
            rather than as a control that has to be opened first. */}
        {days.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">{t('slot.day')}</span>
            <div
              // Scrolls rather than wraps: the days are in order and a strip that
              // reflowed onto a second line would break the sequence the agent
              // reads along.
              className="flex gap-1.5 overflow-x-auto pb-1"
              role="tablist"
              aria-label={t('slot.day')}
              data-cc-slot-days
            >
              {days.map((entry, index) => (
                <button
                  key={entry.fullDay || index}
                  type="button"
                  onClick={() => setDayIndex(index)}
                  disabled={busy}
                  role="tab"
                  aria-selected={index === dayIndex}
                  data-cc-slot-day={index}
                  {...(index === dayIndex ? { 'data-cc-slot-day-chosen': index } : {})}
                  className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-center leading-tight disabled:cursor-not-allowed disabled:opacity-60 ${
                    index === dayIndex
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {/* Server-supplied both, split across two lines rather than
                      re-worded — `fullDay` is `${date} ${day}` and printing it
                      whole would make every chip the width of the row. */}
                  <span className="block text-[11px] uppercase tracking-wide">{entry.day}</span>
                  <span className="block text-[11px] tabular-nums" data-numeric>
                    {entry.date}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ROW 2 — THAT DAY'S WINDOWS. Wraps rather than scrolls, deliberately:
            a window hidden off the end of a scroller is a window the agent never
            offers the caller, and unlike the days these have no sequence to
            break. */}
        {day && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">{t('slot.windows')}</span>

            {day.times.length === 0 ? (
              <p className="text-muted-foreground" data-cc-slot-day-empty>
                {t('slot.noWindows')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5" data-cc-slot-windows>
                {day.times.map((entry) => (
                  <SlotChip
                    key={entry.slotId}
                    slot={entry}
                    current={current?.slotId === entry.slotId}
                    pending={apply.pending === entry.slotId}
                    busy={busy}
                    onPick={() =>
                      apply.onPick({
                        slotId: entry.slotId,
                        // Server-supplied, passed straight back as data — the
                        // console authors none of it and re-words none of it.
                        day: day.day,
                        description: entry.time,
                        from: entry.slotFrom,
                        to: entry.slotTo,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

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
    </ChipSection>
  )
}

/**
 * One bookable window, as a chip in the second row.
 *
 * 🚩 The three states it can be in are drawn on the chip itself rather than in a
 * column beside it — a wrapping row has no columns to line up in. `full` and
 * *on this order* are both a second line under the time, so a chip never changes
 * width because of its state and the row never reflows as one applies.
 */
function SlotChip({
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
      className={`flex min-w-0 flex-col items-start gap-0.5 rounded-lg border px-2.5 py-1.5 text-start leading-tight disabled:cursor-not-allowed disabled:hover:bg-card ${
        current
          ? 'border-success-800/40 bg-success-800/5'
          : 'border-border bg-card hover:bg-accent disabled:opacity-60'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {/* Server-supplied, passed through as data. */}
        <span className="text-[0.8125rem] font-medium">{slot.time}</span>
        {pending && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
      </span>
      {full && (
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground" data-cc-slot-full>
          {t('slot.full')}
        </span>
      )}
      {current && (
        <span className="inline-flex items-center gap-1 text-[10px] text-success-800" data-cc-slot-current>
          <Check className="h-2.5 w-2.5" aria-hidden />
          {t('slot.onThisOrder')}
        </span>
      )}
    </button>
  )
}
