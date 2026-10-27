// Wire shapes for the change-log reads (BackOffice spec 3148, ticket 3152) — `SdConfigChangeLogModels.cs` on branch
// `spec3148`, field for field in the camelCase ASP.NET Core emits. Kept apart from `types.ts` so the slices that add
// their own shapes there (3150–3156) never meet this one.

/** `SdConfigChangeLog.EntityType` — what kind of thing a row changed. */
export const CONFIG_ENTITY_TYPES = [
  'DocumentType',
  'DeliveryDocumentType',
  'ItemCategoryAssignment',
  'PlantNetwork',
  'ActionType',
  'DocumentSource',
  /** 3154: a delivery type's courier assignment, logged under the owning delivery type (only a copy writes one). */
  'CourierAssignment',
] as const
export type ConfigEntityType = (typeof CONFIG_ENTITY_TYPES)[number]

/** `SdConfigChangeLog.Action`. */
export const CONFIG_CHANGE_ACTIONS = ['Create', 'Copy', 'Update', 'Delete'] as const

/** One log row as stored. `beforeJson` is '' on a create / copy, `afterJson` '' on a delete. */
export interface ConfigChangeRow {
  changeId: string
  entityType: string
  /** The natural key, composite parts joined with `|` (`BUPA||`, `CANCEL`). */
  entityKey: string
  /** The owning document / delivery type code, or the source code; '' for an action type. */
  documentType: string
  action: string
  /** The source code on a copy, else ''. */
  copiedFrom: string
  reason: string
  /** A Ua user, or `SQL seed NNN`. */
  changedBy: string
  /** Local wall-clock time, no offset (no-utc-time). */
  changedAt: string
  beforeJson: string
  afterJson: string
}

/** `GET SdDocTypeConfigWeb/ConfigChanges` — one page, newest first, with the matching total. */
export interface ConfigChangePage {
  rows: ConfigChangeRow[]
  total: number
  page: number
  pageSize: number
}

/**
 * The Config changes page's filter, as typed. Blank is no filter. Kind is exact; key and user are contained text;
 * from / to are LOCAL `yyyy-MM-dd` days, both included.
 */
export interface ConfigChangeFilter {
  entityType: string
  entityKey: string
  user: string
  from: string
  to: string
}
