import StatusBadge from '@/core/ui/StatusBadge'
import { statusSeverity } from './status-severity'

/** The BBY header status badge — code → `Severity`, then the core badge. One
 *  wrapper for all three sites (the Status column, the pinned identity cell and
 *  the Details modal): two copies of this three-line hop is the same drift, one
 *  level down, that ticket 086 deleted from the class-string maps.
 *
 *  Colour is redundant to the text — the label always renders beside it through
 *  `codeLabels` + `t()` — so it never carries meaning alone (WCAG). An empty code
 *  renders nothing rather than an empty pill. */
export default function BbyStatusBadge({ code, label }: { code: string; label: string }) {
  if (!code) return null
  return <StatusBadge sev={statusSeverity(code)}>{label}</StatusBadge>
}
