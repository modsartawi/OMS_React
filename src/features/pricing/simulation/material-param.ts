import type { SimItemRow } from './SimItemsEntry'

// The simulator's own `?material=` (ticket 452, BackOffice spec 2544 story 22): a material's detail
// links here with its number, and the simulator opens with that material already in its items.
// Read by the simulator itself, so no feature imports another. Pure.

/** The query parameter a material's detail links with. */
export const SIMULATION_MATERIAL_PARAM = 'material'

/**
 * The simulator's initial item rows. With `?material=`, ONE row holding that material, qty 1, EA —
 * the first value if the param repeats, trimmed, leading zeros kept. Without it (or blank), the
 * one empty row the simulator has always opened with. Initial state only: it never processes.
 */
export function simulationMaterialParam(params: URLSearchParams, emptyRow: () => SimItemRow): SimItemRow[] {
  const row = emptyRow()
  const material = params
    .getAll(SIMULATION_MATERIAL_PARAM)
    .map((value) => value.trim())
    .find((value) => value !== '')
  return material === undefined ? [row] : [{ ...row, materialNumber: material, quantity: '1', qtyUnit: 'EA' }]
}
