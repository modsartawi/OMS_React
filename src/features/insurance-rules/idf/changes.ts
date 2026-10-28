import { formatPair, formatParts } from '@/core/util/bidi'

/**
 * The general change log, pure (BackOffice spec 3185, door 3194; oms ticket 650). `GET IdfPriority/general/changes?
 * item&idf&user&from&to&page&pageSize` answers one page `{ page, pageSize, total, rows }`, newest first. Every write to
 * the general master (648's set / clear, 649's applied upload — `uploadId` set) and to an IDF group (652 / 653) is a row.
 *
 * ⚠️ `before` / `after` are a sketch: the brief says "group and priority, or the group's fields" without a shape, so a
 * side is read defensively (`changeSide`) — an item's `{ idfNumber, priority }`, a group's `{ description, dosageForm }`,
 * a string as it is, anything else as none. 654 reconciles with the door as built.
 */

export const IDF_CHANGE_ENTITIES = ['item', 'group'] as const
export type IdfChangeEntity = (typeof IDF_CHANGE_ENTITIES)[number]
export const IDF_CHANGE_ACTIONS = ['set', 'clear', 'add', 'edit', 'remove'] as const
export type IdfChangeAction = (typeof IDF_CHANGE_ACTIONS)[number]

export interface IdfChange {
  changeId: string
  entity: IdfChangeEntity | string
  /** The item number (entity `item`) or the IDF group number (entity `group`). */
  key: string
  action: IdfChangeAction | string
  before: unknown
  after: unknown
  reason?: string | null
  by?: string | null
  at: string
  /** Set when the change came from an applied bulk upload. */
  uploadId?: string | null
}

export interface IdfChangesPage {
  page: number
  pageSize: number
  total: number
  rows: IdfChange[]
}

/** One side drawn as ONE whole value: `machine` → `Ltr`, else free text → `<bdi>`. */
export interface IdfChangeSide {
  text: string
  machine: boolean
}

const str = (v: unknown): string => (v == null ? '' : String(v).trim())

/** A side of a change, or null when it has none (before a set or an add, after a clear or a remove). */
export function changeSide(side: unknown): IdfChangeSide | null {
  if (side == null) return null
  if (typeof side === 'string' || typeof side === 'number') return str(side) ? { text: str(side), machine: false } : null
  if (typeof side !== 'object') return null
  const s = side as Record<string, unknown>
  // An item's ranking: its IDF group and priority, a machine pair.
  if ('idfNumber' in s || 'priority' in s) {
    const text = formatPair(str(s.idfNumber), str(s.priority))
    return text ? { text, machine: true } : null
  }
  // A group's fields: free text.
  const text = formatParts([str(s.description), str(s.dosageForm)])
  return text ? { text, machine: false } : null
}

export function changeSides(row: Pick<IdfChange, 'before' | 'after'>): { before: IdfChangeSide | null; after: IdfChangeSide | null } {
  return { before: changeSide(row.before), after: changeSide(row.after) }
}

export function entityWordKey(entity: string): `changes.entity.${IdfChangeEntity}` | null {
  return (IDF_CHANGE_ENTITIES as readonly string[]).includes(entity) ? (`changes.entity.${entity}` as `changes.entity.${IdfChangeEntity}`) : null
}

export function actionWordKey(action: string): `changes.action.${IdfChangeAction}` | null {
  return (IDF_CHANGE_ACTIONS as readonly string[]).includes(action) ? (`changes.action.${action}` as `changes.action.${IdfChangeAction}`) : null
}
