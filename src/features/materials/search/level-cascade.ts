/**
 * The A → E level filters' cascade (ticket 451, spec 2544 user stories 7–9). Pure.
 *
 * Each level's options come from `MaterialWeb/Levels`, asked with the choices made ABOVE it as
 * filters (`levelsAbove`) — never the ones below, which the door ignores anyway. So changing a
 * level re-asks every level below it, and when a lower level's new options arrive, any choice
 * there that is no longer offered is dropped (`pruneLevel`). That can change the filters the next
 * level down is asked with, so the drop runs on down level by level until nothing changes.
 *
 * 🔑 Picking or pruning a level NEVER touches a level above it: the cascade only runs downward.
 */
import type { MaterialLevel, MaterialLevelValue } from '@/core/models/materials'
import { MATERIAL_LEVELS, levelParam, type LevelChoices, type LevelParam } from './search-query'

const indexOf = (level: MaterialLevel) => MATERIAL_LEVELS.indexOf(level)

/** The levels strictly above `level`. */
export const levelsAboveOf = (level: MaterialLevel): MaterialLevel[] => MATERIAL_LEVELS.slice(0, indexOf(level))

/**
 * The `MaterialWeb/Levels` filters for `level`: the choices made above it, each as its repeated
 * parameter. A level above with no choice is left off ("any").
 */
export function levelsAbove(levels: LevelChoices, level: MaterialLevel): Partial<Record<LevelParam, string[]>> {
  const out: Partial<Record<LevelParam, string[]>> = {}
  for (const above of levelsAboveOf(level)) if (levels[above].length > 0) out[levelParam(above)] = [...levels[above]]
  return out
}

/**
 * `codes` chosen at `level`. Every other level is kept exactly as it was: the levels above are
 * never touched, and the levels below are only pruned once their new options are known.
 */
export function pickLevel(levels: LevelChoices, level: MaterialLevel, codes: readonly string[]): LevelChoices {
  return { ...levels, [level]: [...new Set(codes.filter((c) => c !== ''))] }
}

/**
 * Drop the choices at `level` that `offered` (its options under the current filters above) does
 * not hold. Returns the SAME object when nothing is dropped, so a caller can tell "no change" by
 * identity and the cascade settles.
 */
export function pruneLevel(
  levels: LevelChoices,
  level: MaterialLevel,
  offered: readonly MaterialLevelValue[],
): LevelChoices {
  const codes = new Set(offered.map((o) => o.code))
  const kept = levels[level].filter((c) => codes.has(c))
  return kept.length === levels[level].length ? levels : { ...levels, [level]: kept }
}

/**
 * The cascade run over every level whose options are known, top to bottom. `offered[L]` is L's
 * options under the choices above it after THEIR pruning — which is what the page's per-level
 * queries hold once they settle.
 */
export function cascade(
  levels: LevelChoices,
  offered: Partial<Record<MaterialLevel, readonly MaterialLevelValue[]>>,
): LevelChoices {
  let out = levels
  for (const level of MATERIAL_LEVELS) {
    const options = offered[level]
    if (options) out = pruneLevel(out, level, options)
  }
  return out
}
