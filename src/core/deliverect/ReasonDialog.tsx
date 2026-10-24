import CoreReasonDialog, { type ReasonDialogProps } from '@/core/reason/ReasonDialog'
import { reasonRefusal } from './reason'

export { InlineRefusal } from '@/core/reason/ReasonDialog'

/**
 * The ONE write dialog of the Deliverect area (spec 2615, ticket 477). Since ticket 551 the dialog
 * itself is the shared `@/core/reason/ReasonDialog`; this binding names what is Deliverect's: it
 * speaks in `deliverect-stores` (the area's first namespace holds its shared words, the Materials
 * precedent) and shows DLV-00009 inline under the reason. Every Deliverect call site is unchanged.
 */
export default function ReasonDialog(props: ReasonDialogProps) {
  return <CoreReasonDialog {...props} ns="deliverect-stores" reasonRefusal={reasonRefusal} />
}
