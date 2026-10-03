import type { ReactNode } from 'react'

/**
 * A key cap (spec 380 K15, K17). A chord of caps is isolated as ONE unit by the caller
 * (`<Ltr>` around the whole row, 378 §5) — never one isolate per cap, which RTL lays out
 * as `K Ctrl`.
 *
 * `gold` is the Ctrl+K cap's signal fill (362: gold as a fill carrying navy ink).
 */
export default function Kbd({ children, gold = false }: { children: ReactNode; gold?: boolean }) {
  return (
    <kbd
      className={
        'inline-block min-w-[18px] rounded border border-b-2 px-1 text-center font-sans text-[10.5px] font-medium leading-normal ' +
        (gold ? 'border-gold bg-gold text-gold-foreground' : 'border-border-strong bg-card text-muted-foreground')
      }
    >
      {children}
    </kbd>
  )
}
