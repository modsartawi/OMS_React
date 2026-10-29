import { apiErrorCode, apiErrorData } from '@/core/api'
import { HUNGERSTATION_PROMOTION_ERRORS, type HungerStationPromotionProblem } from '@/core/models/hungerstation'

/**
 * The rows a refused Send names (ticket 666) — pure. A Send refused because a check still refuses
 * (`DHS-00018`, "check failed, with per-row detail", spec 3201 § Doors) is assumed to carry the
 * Check answer (`HungerStationPromotionCheckResult`) as the envelope's `data`; each row with a
 * refusal — a material with no HungerStation SKU, first of all (BackOffice 3211) — is keyed by our
 * material number for the editor to mark on its row. 🚩 Provisional until the contract names the
 * shape. Read defensively: anything it cannot read is no row.
 */
export function rowRefusals(err: unknown): Map<string, HungerStationPromotionProblem[]> {
  const out = new Map<string, HungerStationPromotionProblem[]>()
  if (apiErrorCode(err) !== HUNGERSTATION_PROMOTION_ERRORS.checkFailed) return out
  const rows = (apiErrorData(err) as { rows?: unknown } | null)?.rows
  if (!Array.isArray(rows)) return out
  for (const r of rows as { materialNumber?: unknown; refusals?: unknown }[]) {
    if (typeof r?.materialNumber !== 'string' || !Array.isArray(r.refusals) || r.refusals.length === 0) continue
    out.set(
      r.materialNumber,
      (r.refusals as { code?: unknown; message?: unknown }[]).map((p) => ({ code: String(p?.code ?? ''), message: String(p?.message ?? '') })),
    )
  }
  return out
}
