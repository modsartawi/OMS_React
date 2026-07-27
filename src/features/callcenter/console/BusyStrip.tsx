/**
 * A routine mutex, drawn as a routine thing (ticket 164, US60/US61).
 *
 * The engine's 15 s strict claim is the only mutual exclusion there is, so two
 * requests on one order collide as a matter of course — a second tab, or the
 * agent's own two keystrokes. Law 7 calls that ROUTINE, and the whole design of
 * this component is that sentence made visible:
 *
 * 1. 🚩 **It is a strip in the flow, never an overlay.** It sits between the top
 *    bar and the three columns and pushes nothing over the basket. A spinner
 *    across the order would say "something is wrong" about a mutex working
 *    exactly as designed — and would take the screen away from an agent who is
 *    mid-sentence on a phone call.
 * 2. **It says typing still works**, because the one thing the agent needs to
 *    know is that they need do nothing. A strip that only says "retrying" leaves
 *    them waiting on it.
 * 3. **Primary-toned, not danger-toned.** A collision is not a fault and is not
 *    coloured like one; the attention/danger registers stay for things that
 *    actually need the agent (135's tone discipline).
 * 4. **The exhausted state keeps an action in it.** After the bounded schedule
 *    (`BUSY_BACKOFF_MS`) the agent is offered a manual retry rather than being
 *    told to wait — they are never left without something to do.
 *
 * It is a live region so a strip appearing under the top bar is announced rather
 * than only seen; `polite`, because it must never interrupt.
 */
import { useTranslation } from 'react-i18next'
import { RotateCw } from 'lucide-react'

export type BusyPhase =
  /** Riding out the collision — the schedule is running on its own. */
  | { phase: 'retrying'; retry: number }
  /** The schedule is spent. `again` re-runs the very action that collided. */
  | { phase: 'exhausted'; again: () => void }

export default function BusyStrip({ busy }: { busy: BusyPhase | null }) {
  const { t } = useTranslation('callcenter')
  if (!busy) return null

  const retrying = busy.phase === 'retrying'
  return (
    <div
      className="relative shrink-0 overflow-hidden border-b border-primary-border bg-primary-050 px-4 py-1.5"
      role="status"
      aria-live="polite"
      data-cc-busy={busy.phase}
    >
      <div className="flex items-center gap-3 text-xs text-primary-800">
        <span className="font-medium">
          {retrying ? t('busy.retrying') : t('busy.stillBusy')}
        </span>
        {/* The same sentence in both states: the order is untouched and nothing
            the agent has done is lost. It is the reassurance, not a detail. */}
        <span className="text-muted-foreground">
          {retrying ? t('busy.keepTyping') : t('busy.nothingLost')}
        </span>
        {!retrying && (
          <button
            type="button"
            onClick={busy.again}
            data-cc-busy-retry
            className="ms-auto inline-flex items-center gap-1.5 rounded-full border border-primary-border bg-card px-3 py-0.5 font-medium text-primary-800 hover:opacity-90"
          >
            <RotateCw className="h-3 w-3" aria-hidden />
            {t('actions.retry')}
          </button>
        )}
      </div>
      {retrying && (
        // The indeterminate sweep — the wait reports no progress, so nothing
        // here may imply it does. Physical translate by the same exception spec
        // 110 recorded: a progress sweep is machine motion, not text, and does
        // not mirror under RTL.
        <span
          aria-hidden
          data-cc-busy-hairline
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
        >
          <span className="absolute inset-y-0 w-1/3 animate-indeterminate bg-primary/60" />
        </span>
      )}
    </div>
  )
}
