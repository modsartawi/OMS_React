import type { ReactNode } from 'react'
import Ltr from '@/core/ui/Ltr'

/** One figure: its caption, its value isolated whole, and an optional line under it. */
export default function Tile({
  id,
  caption,
  value,
  unit,
  accent = 'border-t-border',
  children,
}: {
  id: string
  caption: string
  value: string
  unit?: string
  accent?: string
  children?: ReactNode
}) {
  return (
    <div className={`flex flex-col gap-1 rounded-lg border border-t-2 border-border/60 bg-card p-3 ${accent}`} data-figure-tile={id}>
      <span className="text-xs font-medium text-muted-foreground">{caption}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums" data-figure={id}>
        <Ltr>{value}</Ltr>
        {unit && <span className="ms-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </span>
      {children}
    </div>
  )
}
