import type { RuleBlockKind } from '@/core/models/rule-campaign'

// Where the palette's and the panel's words live in the `campaign-workspace` bundle (ticket 505).
// Pure: `has` answers whether a key exists. A field's label is its block's own when the block has
// one (`panel.typeField.<type>.<key>`), else the field's usual one (`panel.field.<key>`); a choice's
// words are the panel's own, else the sentence's (`sentence.option.…`), else null — the panel then
// shows the value as a code, never a raw key.

type Has = (key: string) => boolean

export const blockLabelKey = (kind: RuleBlockKind, type: string) => `palette.block.${kind}.${type}`

export const groupLabelKey = (group: string) => `palette.group.${group}`

export const fieldLabelKey = (type: string, key: string, has: Has): string => {
  const own = `panel.typeField.${type}.${key}`
  return has(own) ? own : `panel.field.${key}`
}

export function optionLabelKey(type: string, field: string, value: string, has: Has): string | null {
  for (const key of [`panel.option.${type}.${field}.${value}`, `sentence.option.${type}.${field}.${value}`]) if (has(key)) return key
  return null
}

/** What "not set" reads as for a timing field — "at once" for when points activate, "never" for when they expire. */
export const timingNoneKey = (field: string, has: Has): string => {
  const own = `panel.timing.${field}.none`
  return has(own) ? own : 'panel.timing.none'
}
