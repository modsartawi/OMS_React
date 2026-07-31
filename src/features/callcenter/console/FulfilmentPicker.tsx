/**
 * PROTOTYPE (wayfinder ticket 176) — *delivering, or collecting?*
 *
 * 🚩 **Two full-sentence choices, never a toggle.** Owner ruling on 175's
 * prototype. A toggle has a default, and a default here is a guess about the
 * caller; two sentences make it a question the agent asks out loud and answers
 * with what they hear. Each option also states its own consequence, because the
 * consequence is the thing the agent has to know *before* choosing: under
 * collection the address decides nothing, and there is no slot to book.
 *
 * It is a **modal**, not 175's inline section, because that is the idiom the
 * console was actually built in — `StorePicker`, `SlotPicker`, `SourceForm` are
 * all modals off their chip (spec 160, tickets 167/173). 175's variant-4
 * arrangement ruled the chip bar, which is what shipped; where a chip *opens to*
 * was settled by the build, and this ticket does not reopen it.
 *
 * What it never does is decide anything. `setFulfilment` is the server's verb and
 * the whole projection comes back from it; the flip can move the plant on the way
 * back to delivery (§2.2 — re-derived from the retained address), and that rides
 * the existing `storeChange` confirmation rather than a second one invented here.
 */
import { useTranslation } from 'react-i18next'
import { Check, Loader2 } from 'lucide-react'
import type { DeliveryType } from '@/core/models/callcenter'
import Button from '@/core/ui/Button'
import ChipSection from './ChipSection'
import { NOTE } from './console-notes'

const MODES: DeliveryType[] = ['Delivery', 'PickInStore']

export default function FulfilmentPicker({
  open,
  current,
  /** The mode currently being applied, if any. */
  pending,
  /** The failed flip, already turned into agent-facing text by the caller. */
  error,
  onPick,
  onClose,
}: {
  open: boolean
  current: DeliveryType
  pending: DeliveryType | null
  error: string | null
  onPick: (mode: DeliveryType) => void
  onClose: () => void
}) {
  const { t } = useTranslation('callcenter')
  const busy = pending !== null

  return (
    <ChipSection
      open={open}
      onClose={() => !busy && onClose()}
      name="fulfilment"
      title={t('fulfilment.title')}
      width="32rem"
      footer={
        <Button variant="text" onClick={onClose} disabled={busy} data-cc-fulfilment-close>
          {t('fulfilment.close')}
        </Button>
      }
    >
      <div className="space-y-2" data-cc-fulfilment-picker>
        {MODES.map((mode) => {
          const isCurrent = mode === current
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onPick(mode)}
              // The mode the order already holds is not a change. It stays
              // visible and marked rather than hidden: *this is what we have* is
              // the thing the agent reads back to the caller.
              disabled={busy || isCurrent}
              data-cc-fulfilment-option={mode}
              className="flex w-full items-start gap-2 rounded-md border border-border bg-card p-3 text-start hover:bg-accent disabled:cursor-not-allowed disabled:hover:bg-card"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{t(`fulfilment.option.${mode}.title`)}</div>
                {/* 🚩 The consequence, said before the choice rather than
                    discovered after it: under collection the address and the
                    slot stop existing, and the fee falls away. */}
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {t(`fulfilment.option.${mode}.consequence`)}
                </div>
              </div>
              {isCurrent && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] text-success-800"
                  data-cc-fulfilment-current
                >
                  <Check className="h-3 w-3" aria-hidden />
                  {t('fulfilment.onThisOrder')}
                </span>
              )}
              {pending === mode && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
              )}
            </button>
          )
        })}

        {/* 🚩 Said HERE rather than after the fact, and only where it is true:
            switching to delivery re-derives the store from the address the order
            kept, which can move the plant and can be REFUSED (§5.1, 129's door).
            The agent is told the shape of that before they press, so the
            confirmation that follows is expected rather than alarming. */}
        {current === 'PickInStore' && (
          <p className="text-xs text-muted-foreground" data-cc-fulfilment-rederive>
            {t('fulfilment.backToDelivery')}
          </p>
        )}

        {error && (
          <p className={NOTE.danger} data-cc-fulfilment-error>
            {error}
          </p>
        )}
      </div>
    </ChipSection>
  )
}
