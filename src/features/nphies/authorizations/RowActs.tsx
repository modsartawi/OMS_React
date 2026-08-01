import type { TFunction } from 'i18next'
import { Ban, FileSearch, RefreshCcwDot, Radar } from 'lucide-react'

import Button from '@/core/ui/Button'
import type { AuthListRow } from '@/core/models/nphies'
import { AUTH_ACTS, authRowActs, type AuthAct } from './row-acts'

/**
 * The acts of one row (ticket 215) — every one of them, in one cell.
 *
 * 🚩 **A withheld act is rendered, not removed.** It stays visible, stays
 * focusable (`aria-disabled` rather than the `disabled` attribute — `@/core/ui/Button`'s
 * own rule), and carries its reason as its `title` and its `aria-description`. An
 * act that vanished on some states would teach an agent nothing; an act greyed
 * with no reason would teach them less. The row is where this vocabulary is
 * learnt, not the refusal that follows a hopeful click.
 *
 * Nothing here decides anything: `authRowActs` owns the mapping and this file
 * wires it to four buttons.
 *
 * 🚩 **No in-flight state lives in this cell**, deliberately. A busy flag here
 * would have to travel through the column definitions, and a changed `columnDefs`
 * makes AG Grid tear the cell down and rebuild it — which throws keyboard focus
 * back to the document body the instant an agent presses one of these buttons,
 * defeating the whole reason they are `aria-disabled` and focusable. The act in
 * flight is announced **above the grid** instead, where it survives a re-render
 * and a screen reader can hear it.
 */

const ICONS: Record<AuthAct, typeof Radar> = {
  statusCheck: Radar,
  retry: RefreshCcwDot,
  cancel: Ban,
  openRefusal: FileSearch,
}

/** Cancel is the one terminal act here; the rest are ordinary. */
const VARIANT = (act: AuthAct) => (act === 'cancel' ? 'danger-outlined' : 'secondary')

export interface RowActsProps {
  row: AuthListRow
  t: TFunction
  /** Fires only for an act the row actually offers — a withheld one cannot call
   *  it, because `aria-disabled` does not stop a click on its own. */
  onAct: (act: AuthAct, row: AuthListRow) => void
}

export default function RowActs({ row, t, onAct }: RowActsProps) {
  const acts = authRowActs(row)

  return (
    <span className="flex items-center gap-1">
      {acts.map(({ act, available, reason }) => {
        const Icon = ICONS[act]
        // The reason is the whole of what a withheld act says, so it is read
        // twice: as the tooltip and as the accessible name. An offered act gets
        // its own one-line hint instead of an empty title.
        const title = available ? t(`acts.hint.${act}`) : t(`acts.withheld.${reason}`)
        return (
          <Button
            key={act}
            variant={VARIANT(act)}
            // 🚩 `aria-disabled`, never `disabled`: a control that is unavailable
            // FOR A REASON has to stay in the tab order to be able to state it.
            aria-disabled={!available}
            title={title}
            aria-label={t('acts.ariaLabel', { act: t(`acts.${act}`), reason: title })}
            onClick={() => {
              if (!available) return
              onAct(act, row)
            }}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {t(`acts.${act}`)}
          </Button>
        )
      })}
      {/* Asserted rather than assumed: the cell renders the whole table. If an act
          is ever added to `AUTH_ACTS` without a place here, this is where it shows
          up as missing. */}
      {acts.length !== AUTH_ACTS.length && <span className="sr-only">{t('acts.incomplete')}</span>}
    </span>
  )
}
