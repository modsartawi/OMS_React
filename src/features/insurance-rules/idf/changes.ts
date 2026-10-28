import { formatPair, formatParts } from '@/core/util/bidi'

/**
 * The general change log, pure (BackOffice spec 3185, door 3194; oms ticket 650). `GET IdfPriority/general/changes?
 * item&idf&user&from&to&page&pageSize` answers one page `{ page, pageSize, total, rows }`, newest first. Every write to
 * the general master (648's set / clear, 649's applied upload — `uploadId` set) and to an IDF group (652 / 653) is a row.
 *
 * 654 reconciled with the door as built (BackOffice 3194, `IdfGeneralAdminService` / `IdfGroupAdminService`): `before`
 * / `after` are the logged JSON snapshots as a flat object, or `null` where there was none. An item row (`set` /
 * `clear`, by hand or from an upload) logs `{ idfNumber, priority }` — none on the side where the item was in no group;
 * a group row (`add` / `edit` / `remove`) logs `{ idfNumber, description, dosageForm }` — none before an add or
 * after a remove. Each row also carries `idfNumberBefore` / `idfNumberAfter` (`''` = none). A side is read by the
 * row's `entity` (`changeSide`), never guessed from its keys: a group snapshot names its number too.
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
  /** The IDF group before / after the change (`''` = none): an item's group, or the group row's own number. */
  idfNumberBefore?: string | null
  idfNumberAfter?: string | null
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

/**
 * A side of a change for the row's entity, or null when it has none (before a first set or an add, after a clear or a
 * remove, an empty snapshot, an entity this build does not know).
 */
export function changeSide(entity: string, side: unknown): IdfChangeSide | null {
  if (side == null || typeof side !== 'object' || Array.isArray(side)) return null
  const s = side as Record<string, unknown>
  if (entity === 'item') {
    // An item's ranking: its IDF group and priority, ONE machine pair. A group-less, priority-0 side is the cleared one.
    const group = str(s.idfNumber)
    const priority = str(s.priority)
    if (!group && (!priority || priority === '0')) return null
    return { text: formatPair(group, priority), machine: true }
  }
  if (entity === 'group') {
    // A group's fields, free text; its number is the row's key, so it is not repeated here.
    const text = formatParts([str(s.description), str(s.dosageForm)])
    return text ? { text, machine: false } : null
  }
  return null
}

export function changeSides(row: Pick<IdfChange, 'entity' | 'before' | 'after'>): { before: IdfChangeSide | null; after: IdfChangeSide | null } {
  return { before: changeSide(row.entity, row.before), after: changeSide(row.entity, row.after) }
}

export function entityWordKey(entity: string): `changes.entity.${IdfChangeEntity}` | null {
  return (IDF_CHANGE_ENTITIES as readonly string[]).includes(entity) ? (`changes.entity.${entity}` as `changes.entity.${IdfChangeEntity}`) : null
}

export function actionWordKey(action: string): `changes.action.${IdfChangeAction}` | null {
  return (IDF_CHANGE_ACTIONS as readonly string[]).includes(action) ? (`changes.action.${action}` as `changes.action.${IdfChangeAction}`) : null
}
