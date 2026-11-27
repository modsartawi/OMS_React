import { createContext, useContext, type ReactNode } from 'react'
import type { ResultsFigure } from '@/core/models/sourcing-results'
import Ltr from '@/core/ui/Ltr'
import { formatFigure } from '@/core/util/number-format'
import { figureKey } from './figure'

/**
 * An underlined figure that opens its orders in the drawer (ticket 971, results ticket decision 5: "every underlined
 * figure opens one"). The page provides the opener once (`DrillProvider`), so every panel and every tab 972 and 973 add
 * draws `<Drill figure count />` and nothing more.
 */
const DrillContext = createContext<(figure: ResultsFigure) => void>(() => {})

export function DrillProvider({ open, children }: { open: (figure: ResultsFigure) => void; children: ReactNode }) {
  return <DrillContext.Provider value={open}>{children}</DrillContext.Provider>
}

/** The opener, for a control that opens a figure's orders without drawing the count (the bar's segments). */
export const useDrill = (): ((figure: ResultsFigure) => void) => useContext(DrillContext)

/** `children` is ignored: inside a `<Trans>` sentence the slot may hand some, and the count is drawn from `count`. */
export default function Drill({ figure, count, label }: { figure: ResultsFigure; count: number; label?: string; children?: ReactNode }) {
  const open = useContext(DrillContext)
  // A figure of nothing opens nothing: the count is drawn plain.
  if (!(count > 0)) return <Ltr>{formatFigure(count)}</Ltr>
  return (
    <button
      type="button"
      className="cursor-pointer font-semibold text-foreground underline decoration-dotted underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onClick={() => open(figure)}
      aria-label={label}
      data-drill={figureKey(figure)}
    >
      <Ltr>{formatFigure(count)}</Ltr>
    </button>
  )
}
