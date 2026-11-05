import type { ComponentType } from 'react'

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
