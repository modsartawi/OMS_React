import CoreReasonDialog, { type ReasonDialogProps } from '@/core/reason/ReasonDialog'
import { reasonRefusal } from './reason'

export { InlineRefusal } from '@/core/reason/ReasonDialog'

/**
 * The ONE write dialog of the HungerStation area (spec 3028, ticket 551): the shared
 * `@/core/reason/ReasonDialog`, bound to `hungerstation-stores` (the area's first namespace holds
 * its shared words — the menu, the reason field and the dialog chrome) and to DHS-00008, shown
 * inline under the reason. 552–556 compose every HungerStation write from it.
 */
export default function ReasonDialog(props: ReasonDialogProps) {
  return <CoreReasonDialog {...props} ns="hungerstation-stores" reasonRefusal={reasonRefusal} />
}
