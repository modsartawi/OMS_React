// A picked unit's serial cell (ticket 540, BackOffice brief 2875). Pure: no React, no `t`.
//
// 🚩 SIS.Api withholds the serial ITSELF for a caller without `PickSupportSerial,03`, and marks the
// unit `serialWithheld`. This only reads that mark: it never works out visibility, and never from
// the probe flag (`canSeePickSupportSerial` is advisory). If the flag and the data disagree, the data wins.

import type { PickDocumentUnitModel } from '@/core/models/pick-support'

/**
 * - `restricted` — the server withheld the serial (`serialWithheld: true`);
 * - `serial` — a serial came, shown as sent;
 * - `none` — the unit never had one ("—", as before 540). An absent `serialWithheld` reads false.
 */
export type SerialCell = { kind: 'restricted' } | { kind: 'serial'; serial: string } | { kind: 'none' }

/** One rule for every table that draws a serial: the diagnosis units and the serial holds. */
export function serialCell(u: Pick<PickDocumentUnitModel, 'serialNumber' | 'serialWithheld'>): SerialCell {
  if (u.serialWithheld === true) return { kind: 'restricted' }
  const serial = (u.serialNumber ?? '').trim()
  return serial ? { kind: 'serial', serial } : { kind: 'none' }
}
