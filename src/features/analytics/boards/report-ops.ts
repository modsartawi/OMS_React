import type { AnalyticsLabel, AnalyticsModel, AnalyticsReportBlock, AnalyticsReportDefinition, AnalyticsReportSection, AnalyticsViewDefinition } from '@/core/models/analytics'
import { bindPanel, canBind, keptBindings } from './bindings'
import { reportBlocks } from './report'

/**
 * The designer's structure operations (spec 819 §E, ticket 828; the 798 prototype's `ops.*`) — pure functions
 * of a report's definition, each a whole new definition (never a mutation), so each is one history step
 * (`./designer-history`). An operation that changes nothing answers the SAME definition, which the history
 * takes as no step: a drop on its own place, "up" on the first block.
 *
 * Drag and drop and the keyboard share them: a drop asks `moveBlockTo` / `moveSectionTo` with an index that
 * counts the places as they stand before the move (`dropIndex` of the target and its half, `dropSide`); up and
 * down ask `moveBlock` / `moveSection`, which make the same moves one place at a time.
 */

/** The half of a target a drag is over: `0` the top half (before it), `1` the bottom half (after it). */
export const dropSide = (clientY: number, top: number, height: number): 0 | 1 => (clientY > top + height / 2 ? 1 : 0)

/** The place a drop lands: before the target at `index` (`side` 0) or after it (1). */
export const dropIndex = (index: number, side: 0 | 1): number => index + side

/** Where a block is: its section's id and its place in it. */
export function locateBlock(def: AnalyticsReportDefinition, blockId: string): { section: string; index: number } | null {
  for (const s of def.sections) {
    const index = s.blocks.findIndex((b) => b.id === blockId)
    if (index >= 0) return { section: s.id, index }
  }
  return null
}

/** The first free id with this prefix (`s4`, `t3`, `p3`), across sections and blocks. */
export function freshId(def: AnalyticsReportDefinition, prefix: string): string {
  const taken = new Set([...def.sections.map((s) => s.id), ...reportBlocks(def).map((b) => b.id)])
  for (let i = 1; ; i++) if (!taken.has(`${prefix}${i}`)) return `${prefix}${i}`
}

/** Whether the report already holds its one summary block. */
export const hasSummary = (def: AnalyticsReportDefinition): boolean => reportBlocks(def).some((b) => b.kind === 'summary')

const withSections = (def: AnalyticsReportDefinition, sections: AnalyticsReportSection[]): AnalyticsReportDefinition => ({ ...def, sections })

/**
 * Moves a block to `index` of a section (the same or another), `index` counted before the move: dropping a block
 * after itself, or before the one after it, is its own place and no change.
 */
export function moveBlockTo(def: AnalyticsReportDefinition, blockId: string, toSection: string, index: number): AnalyticsReportDefinition {
  const from = locateBlock(def, blockId)
  const target = def.sections.find((s) => s.id === toSection)
  if (!from || !target) return def
  const same = from.section === toSection
  const at = same && from.index < index ? index - 1 : index
  if (same && at === from.index) return def
  const block = def.sections.find((s) => s.id === from.section)!.blocks[from.index]
  return withSections(
    def,
    def.sections.map((s) => {
      let blocks = s.id === from.section ? s.blocks.filter((b) => b.id !== blockId) : s.blocks
      if (s.id === toSection) blocks = [...blocks.slice(0, at), block, ...blocks.slice(at)]
      return blocks === s.blocks ? s : { ...s, blocks }
    }),
  )
}

/**
 * Moves a block one place up or down, the keyboard's drag: at its section's edge it crosses into the section
 * before (its end) or after (its top), an empty one too. The report's first block goes no higher, its last no lower.
 */
export function moveBlock(def: AnalyticsReportDefinition, blockId: string, by: -1 | 1): AnalyticsReportDefinition {
  const from = locateBlock(def, blockId)
  if (!from) return def
  const si = def.sections.findIndex((s) => s.id === from.section)
  const count = def.sections[si].blocks.length
  const inside = from.index + by
  if (inside >= 0 && inside < count) return moveBlockTo(def, blockId, from.section, by < 0 ? inside : inside + 1)
  const next = def.sections[si + by]
  if (!next) return def
  return moveBlockTo(def, blockId, next.id, by < 0 ? next.blocks.length : 0)
}

/** Moves a section, its blocks with it, to `index` counted before the move. */
export function moveSectionTo(def: AnalyticsReportDefinition, sectionId: string, index: number): AnalyticsReportDefinition {
  const from = def.sections.findIndex((s) => s.id === sectionId)
  if (from < 0) return def
  const at = from < index ? index - 1 : index
  if (at === from) return def
  const rest = def.sections.filter((s) => s.id !== sectionId)
  return withSections(def, [...rest.slice(0, at), def.sections[from], ...rest.slice(at)])
}

/** Moves a section one place up or down, stopping at the ends. */
export function moveSection(def: AnalyticsReportDefinition, sectionId: string, by: -1 | 1): AnalyticsReportDefinition {
  const from = def.sections.findIndex((s) => s.id === sectionId)
  if (from < 0) return def
  const to = from + by
  if (to < 0 || to >= def.sections.length) return def
  return moveSectionTo(def, sectionId, by < 0 ? to : to + 1)
}

/** A new, empty section at the end. */
export const addSection = (def: AnalyticsReportDefinition, id: string): AnalyticsReportDefinition =>
  withSections(def, [...def.sections, { id, heading: { en: '', ar: '' }, blocks: [] }])

/** A section's heading, in both languages. */
export function renameSection(def: AnalyticsReportDefinition, sectionId: string, heading: AnalyticsLabel): AnalyticsReportDefinition {
  const s = def.sections.find((x) => x.id === sectionId)
  if (!s || (s.heading.en === heading.en && s.heading.ar === heading.ar)) return def
  return withSections(def, def.sections.map((x) => (x.id === sectionId ? { ...x, heading } : x)))
}

/** The bindings to the panels still on the report. */
const bindingsLeft = (def: AnalyticsReportDefinition): AnalyticsReportDefinition => ({
  ...def,
  bindings: keptBindings(def.bindings, new Set(reportBlocks(def).map((b) => b.id))),
})

/** Removes a section, its blocks and their bindings. */
export function removeSection(def: AnalyticsReportDefinition, sectionId: string): AnalyticsReportDefinition {
  if (!def.sections.some((s) => s.id === sectionId)) return def
  return bindingsLeft(withSections(def, def.sections.filter((s) => s.id !== sectionId)))
}

/** Removes a block and its bindings. */
export function removeBlock(def: AnalyticsReportDefinition, blockId: string): AnalyticsReportDefinition {
  const at = locateBlock(def, blockId)
  if (!at) return def
  return bindingsLeft(withSections(def, def.sections.map((s) => (s.id === at.section ? { ...s, blocks: s.blocks.filter((b) => b.id !== blockId) } : s))))
}

/**
 * Adds a block at the end of a section. A panel binds every parameter that can take it (797 §4, `bindPanel`).
 * A report holds one summary: a second is no change.
 */
export function addBlock(def: AnalyticsReportDefinition, sectionId: string, block: AnalyticsReportBlock, model: AnalyticsModel): AnalyticsReportDefinition {
  if (!def.sections.some((s) => s.id === sectionId)) return def
  if (block.kind === 'summary' && hasSummary(def)) return def
  const placed = withSections(def, def.sections.map((s) => (s.id === sectionId ? { ...s, blocks: [...s.blocks, block] } : s)))
  if (block.kind !== 'panel') return placed
  const decl = bindPanel({ params: placed.params, bindings: placed.bindings }, { id: block.id, definition: block.definition }, model)
  return { ...placed, bindings: decl.bindings }
}

/**
 * One block changed in place (829's editors: a panel's definition or title, a text's words). An unchanged
 * block (the same object, or the same JSON) is no change, so no history step.
 *
 * With the `model`, a panel whose definition changed drops the bindings it can no longer take (`canBind`), and
 * keeps every other: a panel is bound when added (as a blank KPI), so its first real shape — a named series
 * filtering by channel, say — must not leave a ready-made parameter bound where the save would refuse it.
 * Nothing is bound anew: an author's unbinding stays.
 */
export function updateBlock(def: AnalyticsReportDefinition, blockId: string, f: (b: AnalyticsReportBlock) => AnalyticsReportBlock, model?: AnalyticsModel): AnalyticsReportDefinition {
  const at = locateBlock(def, blockId)
  if (!at) return def
  // Boxed: TypeScript does not follow an assignment made inside the map's callback.
  const changed: { block: AnalyticsReportBlock | null } = { block: null }
  const sections = def.sections.map((s) => {
    if (s.id !== at.section) return s
    const blocks = s.blocks.map((b) => {
      if (b.id !== blockId) return b
      const next = f(b)
      if (next === b || next.id !== b.id || JSON.stringify(next) === JSON.stringify(b)) return b
      changed.block = next
      return next
    })
    return changed.block ? { ...s, blocks } : s
  })
  if (!changed.block) return def
  const placed = withSections(def, sections)
  const edited = changed.block
  if (!model || edited.kind !== 'panel') return placed
  return { ...placed, bindings: bindingsTaken(placed, edited.id, edited.definition, model) }
}

/** The bindings with `panelId`'s kept only where its definition can still take them. The same object when none drop. */
function bindingsTaken(def: AnalyticsReportDefinition, panelId: string, definition: AnalyticsViewDefinition, model: AnalyticsModel): AnalyticsReportDefinition['bindings'] {
  let dropped = false
  const out: AnalyticsReportDefinition['bindings'] = {}
  for (const [name, bound] of Object.entries(def.bindings)) {
    const target = bound[panelId]
    const param = def.params.find((p) => p.name === name)
    if (target === undefined || !param || canBind(param, definition, model, typeof target === 'string' ? target : undefined).ok) {
      out[name] = bound
      continue
    }
    const { [panelId]: _gone, ...rest } = bound
    out[name] = rest
    dropped = true
  }
  return dropped ? out : def.bindings
}
