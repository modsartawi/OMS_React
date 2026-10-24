import type { ICellRendererParams } from 'ag-grid-community'
import Ltr from './Ltr'

/**
 * A grid cell renderer for a machine value (a code, a key, a time): the value as its column's
 * `valueFormatter` shaped it, isolated left-to-right ONCE. Unlike a bare `Ltr` it keeps the
 * formatter's text, so a column may use both (bidi rule, § Grid cells). Shared by every delivery-rail
 * grid (Deliverect, HungerStation) rather than re-declared in each columns file.
 */
export default function LtrCell({ value, valueFormatted }: ICellRendererParams) {
  const text = valueFormatted ?? (value == null ? '' : String(value))
  return text === '' ? null : <Ltr>{text}</Ltr>
}
