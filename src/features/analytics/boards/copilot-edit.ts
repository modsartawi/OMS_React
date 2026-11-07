import type { EditingItem } from './item-save'

/**
 * Whether the copilot may edit the item open in a designer (836), as the server rules it (3408 item 37, 3430): only a
 * saved item, owned by the user, that is not Certified (even a curator edits a Certified item through a copy).
 * `unsaved`: a new item (the AI edits a saved one); `notYours`: someone else's, or Certified.
 */
export type CopilotEditable = 'ok' | 'unsaved' | 'notYours'

export function copilotEditable(editing: Pick<EditingItem, 'owner' | 'tier'> | null, userId: string | null): CopilotEditable {
  if (!editing) return 'unsaved'
  if (editing.tier === 'certified' || !userId || editing.owner !== userId) return 'notYours'
  return 'ok'
}
