/**
 * The deactivate confirm's warning (oms ticket 570, BackOffice spec 3042 story 33). The door does NOT refuse a
 * deactivation a type points at; the confirm is ours. It names the COMPETED pointing types — their deliveries stop
 * being competed and go to their fallback store. Pure: the dialog joins the codes with `listText`.
 */
import type { ServingListRow } from '@/core/models/serving-list'

/** The competed pointing types' codes, in the door's order; `null` when none (no warning). */
export function deactivateWarning(row: Pick<ServingListRow, 'pointingTypes'>): string[] | null {
  const codes = (row.pointingTypes ?? []).filter((p) => p.isCompeted === true).map((p) => p.documentType)
  return codes.length > 0 ? codes : null
}
