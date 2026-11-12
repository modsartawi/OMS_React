import type { ComponentType } from 'react'
import type { CopilotAnswerTable } from '@/core/models/copilot'

/**
 * How a copilot answer draws the views it created, inline (CTO demo, spec 766 D): the copilot may not import the
 * analytics feature (`.claude/rules/feature-structure.md`), so the app shell registers the analytics feature's
 * embed here at start-up and the copilot panel reads it. Absent, the answer keeps its "Open view" links only.
 */
export type CopilotViewEmbed = ComponentType<{ viewId: string }>

let embed: CopilotViewEmbed | null = null

export function setCopilotViewEmbed(component: CopilotViewEmbed): void {
  embed = component
}

export function copilotViewEmbed(): CopilotViewEmbed | null {
  return embed
}

/**
 * How a copilot answer draws its tables (ticket 868, BackOffice spec 3558 D5): the analytics table form with its notes,
 * downloads and "Open as view", registered by the app shell like the view embed. Absent, the answer keeps its summary.
 *
 * `index` (878) is the table's place among the answer's tables: an analysis result gives one table per part, all on one
 * `step`, so the step alone no longer tells two tables apart (a download's name, a marker in the page).
 */
export type CopilotTableEmbed = ComponentType<{ table: CopilotAnswerTable; index: number }>

let tableEmbed: CopilotTableEmbed | null = null

export function setCopilotTableEmbed(component: CopilotTableEmbed): void {
  tableEmbed = component
}

export function copilotTableEmbed(): CopilotTableEmbed | null {
  return tableEmbed
}
