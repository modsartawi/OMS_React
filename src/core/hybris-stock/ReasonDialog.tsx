import CoreReasonDialog, { type ReasonDialogProps } from '@/core/reason/ReasonDialog'
import { reasonRefusal } from './reason'

export { InlineRefusal } from '@/core/reason/ReasonDialog'

/**
 * The ONE write dialog of the Hybris stock area (spec 3447, ticket 847): the shared
 * `@/core/reason/ReasonDialog`, bound to `hybris-stock-stores` (the area's first namespace holds its
 * shared words — the menu, the mode banner, the reason field and the dialog chrome) and to HYS-00001,
 * shown inline under the reason.
 */
export default function ReasonDialog(props: ReasonDialogProps) {
  return <CoreReasonDialog {...props} ns="hybris-stock-stores" reasonRefusal={reasonRefusal} />
}
