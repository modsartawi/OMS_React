/**
 * A serving list's change-log row as the History tab shows it (oms ticket 571, BackOffice spec 3042 — door
 * `GET ServingListWeb/Lists/{id}/Changes`). Pure: no React, no i18n — it returns `serving-lists:` keys and
 * values; the tab calls `t`. Pinned by `change-row.test.ts`.
 *
 * - The action in words (`history.action.<Action>`), or the raw value for an action this screen does not know.
 * - The store: the member a store action touched; blank for a list-level action (Create, Rename, Deactivate,
 *   Reactivate). An unknown action keeps whatever store the row carries.
 * - The names: a create's new names; a rename's old → new; nothing for any other action.
 */
import { isServingListChangeAction, type ServingListChangeRow } from '@/core/models/serving-list'

export type ChangeNames =
  | { kind: 'none' }
  | { kind: 'create'; en: string; ar: string }
  | { kind: 'rename'; fromEn: string; fromAr: string; toEn: string; toAr: string }

export interface ChangeRowView {
  /** The wire's action, as sent. */
  action: string
  /** `serving-lists:` key for the action's words, or null for an action this screen does not know (render `action`). */
  actionKey: string | null
  /** The store a store action touched; '' for a list-level action. */
  storeCode: string
  names: ChangeNames
}

/** `serving-lists:` key for an action's words, or null for an action this screen does not know. */
export function changeActionKey(action: string): string | null {
  return isServingListChangeAction(action) ? `history.action.${action}` : null
}

const LIST_LEVEL: ReadonlySet<string> = new Set(['Create', 'Rename', 'Deactivate', 'Reactivate'])

type ChangeRowInput = Pick<ServingListChangeRow, 'action' | 'storeCode' | 'oldNameEn' | 'oldNameAr' | 'newNameEn' | 'newNameAr'>

export function changeRow(row: ChangeRowInput): ChangeRowView {
  const action = row.action ?? ''
  const actionKey = changeActionKey(action)
  const storeCode = LIST_LEVEL.has(action) ? '' : (row.storeCode ?? '')
  let names: ChangeNames = { kind: 'none' }
  if (action === 'Create') names = { kind: 'create', en: row.newNameEn ?? '', ar: row.newNameAr ?? '' }
  else if (action === 'Rename')
    names = { kind: 'rename', fromEn: row.oldNameEn ?? '', fromAr: row.oldNameAr ?? '', toEn: row.newNameEn ?? '', toAr: row.newNameAr ?? '' }
  return { action, actionKey, storeCode, names }
}
