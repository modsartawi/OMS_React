import type { DeliverectPlatform } from '@/core/models/deliverect'

/**
 * The platform exclusion editor (ticket 479; contract § Catalog `PUT Exclusions/{material}`;
 * glossary **Platform exclusion**) — pure.
 *
 * One box per **delivery platform** from the Platforms read; ticked means the material is sold
 * there, unticked means it is excluded (out of stock on that platform only). The door REPLACES the
 * material's set, so the set sent is (every listed platform) minus (the ticked ones).
 *
 * 🚩 A key the material is excluded on that the read does NOT list — a platform retired or not yet
 * readable — cannot be a box. It is set aside as `unlisted`, shown read-only, and ALWAYS sent back:
 * dropping it would silently put the material back on that platform.
 */

export interface ExclusionBox {
  platformKey: string
  displayName: string
  active: boolean
  /** Sold on this platform — the material is NOT excluded on it. */
  ticked: boolean
}

export interface ExclusionEditor {
  /** One per listed platform, in the read's order. */
  boxes: ExclusionBox[]
  /** Excluded keys the read does not list, in the row's order — kept in every set sent. */
  unlisted: string[]
}

/** The editor's starting state, from the row's `excludedPlatforms` and the Platforms read. */
export function exclusionEditor(excluded: readonly string[], platforms: readonly DeliverectPlatform[]): ExclusionEditor {
  const out = new Set(excluded)
  const listed = new Set(platforms.map((p) => p.platformKey))
  return {
    boxes: platforms.map((p) => ({
      platformKey: p.platformKey,
      displayName: p.displayName,
      active: p.active,
      ticked: !out.has(p.platformKey),
    })),
    unlisted: [...new Set(excluded.filter((k) => !listed.has(k)))],
  }
}

/**
 * The set the PUT sends: every listed platform not ticked, then every unlisted key carried over.
 * A ticked key the read does not list is ignored (it is no box); no key is sent twice.
 */
export function exclusionSet(listed: readonly string[], ticked: readonly string[], unlisted: readonly string[]): string[] {
  const on = new Set(ticked)
  return [...new Set([...listed.filter((k) => !on.has(k)), ...unlisted])]
}

/** Two exclusion sets hold the same keys (order is not meaning). */
export function sameExclusions(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a)
  const right = new Set(b)
  return left.size === right.size && [...left].every((k) => right.has(k))
}
