// Wire shapes for the serving-list doors (BackOffice spec 3042; door ticket 3045 — oms tickets 567-571).
//
// 🚩 The ONE source is BackOffice
// `Sartawi.Retail.Data\Modules\Callouts\ServingLists\ServingListAdminModels.cs` (branch `spec3042`), field for
// field in the camelCase ASP.NET Core emits. Words are BackOffice `CONTEXT.md` § Serving list: serving list,
// member, enabled / disabled (a member), active / deactivated (a list), on duty, no roster, pointing type.
// Never "zone" or "branch group".
//
// Every type the later slices need lives here (567 grid, 568 members, 569 picker, 570 writes, 571 history), so
// they import rather than re-declare. Times are local wall-clock with no offset (`yyyy-MM-ddTHH:mm:ss`).
// The state and action unions are open (`| string`), so a value the server adds later still parses.

/** A local wall-clock time, `yyyy-MM-ddTHH:mm:ss`, no offset. Never append a `Z`. */
export type LocalDateTime = string

/** `GET ServingListWeb/Access` — cookie-only, not grant-gated; a check that throws reads false. */
export interface ServingListAccess {
  /** `BackOfficeScreen[ServingList]` Display 03: the menu leaf and the `ScreenGate`. */
  canViewServingLists: boolean
  /** Execute 06: every edit control. */
  canEditServingLists: boolean
}

/** A delivery type whose `ServingListId` names the list (set by HQ script, never by a door). */
export interface ServingListPointingType {
  documentType: string
  description: string
  isCompeted: boolean
}

/** One list, as `GET ServingListWeb/Lists` and every write answer it. */
export interface ServingListRow {
  servingListId: string
  nameEn: string
  nameAr: string
  isActive: boolean
  memberCount: number
  enabledMemberCount: number
  pointingTypes: ServingListPointingType[]
  createdAt: LocalDateTime
  createdBy: string
  updatedAt: LocalDateTime
  updatedBy: string
  /** Set on a deactivation when COMPETED types point at the list (named); null otherwise. */
  warning: string | null
}

/** `ServingListDutyStates`: a member's duty today, at the moment of the read. */
export const SERVING_LIST_DUTY_STATES = ['OnDuty', 'OffDuty', 'NoRoster'] as const
export type ServingListDutyState = (typeof SERVING_LIST_DUTY_STATES)[number] | (string & {})

export const isServingListDutyState = (v: unknown): v is (typeof SERVING_LIST_DUTY_STATES)[number] =>
  typeof v === 'string' && (SERVING_LIST_DUTY_STATES as readonly string[]).includes(v)

/** One of a member's shifts today: `HH:mm` local; `overnight` = `close` is tomorrow morning. */
export interface ServingListMemberShift {
  open: string
  close: string
  overnight: boolean
}

/** One member, with its duty today (`GET ServingListWeb/Lists/{id}/Members`). */
export interface ServingListMemberRow {
  storeCode: string
  storeName: string
  city: string
  storeClosed: boolean
  isEnabled: boolean
  addedAt: LocalDateTime
  addedBy: string
  updatedAt: LocalDateTime
  updatedBy: string
  duty: ServingListDutyState
  onDutyNow: boolean
  /** By open time; empty when no roster holds today's weekday. */
  todayShifts: ServingListMemberShift[]
}

/** The members read's optional, combining filters. `duty` outside the states is refused `SVL-00009`. */
export interface ServingListMembersFilter {
  city?: string
  enabled?: boolean | null
  duty?: ServingListDutyState | ''
}

/** `ServingListChange.Action`. */
export const SERVING_LIST_CHANGE_ACTIONS = [
  'Create',
  'Rename',
  'Deactivate',
  'Reactivate',
  'AddStore',
  'RemoveStore',
  'EnableStore',
  'DisableStore',
] as const
export type ServingListChangeAction = (typeof SERVING_LIST_CHANGE_ACTIONS)[number] | (string & {})

export const isServingListChangeAction = (v: unknown): v is (typeof SERVING_LIST_CHANGE_ACTIONS)[number] =>
  typeof v === 'string' && (SERVING_LIST_CHANGE_ACTIONS as readonly string[]).includes(v)

/** One change-log row, newest first (`GET ServingListWeb/Lists/{id}/Changes`). */
export interface ServingListChangeRow {
  changeId: string
  servingListId: string
  action: ServingListChangeAction
  /** Blank for a list-level action. */
  storeCode: string
  changedAt: LocalDateTime
  changedBy: string
  note: string
  /** On a create and a rename. */
  oldNameEn: string
  oldNameAr: string
  newNameEn: string
  newNameAr: string
}

/** One store of the master, as the add-stores picker shows it (`GET ServingListWeb/Stores`). */
export interface ServingListStoreRow {
  storeCode: string
  /** The store master's single `Description`; there is no Arabic name. */
  name: string
  city: string
  closed: boolean
  /** Already on the list the query named (false when it named none). */
  onList: boolean
}

/** The picker's query: `take` defaults to 50, at most 200; an unknown `servingListId` is `SVL-00001`. */
export interface ServingListStoreSearch {
  search?: string
  servingListId?: string
  take?: number
}

// ── The five request bodies. `note` is optional everywhere and clamped to 500 by the door. ─────────────

/** `POST ServingListWeb/Lists`. Both names required, at most 100 characters each. */
export interface ServingListCreateRequest {
  nameEn: string
  nameAr: string
  note?: string
}

/** `PUT ServingListWeb/Lists/{id}/Name`. The same names is a silent no-op. */
export interface ServingListRenameRequest {
  nameEn: string
  nameAr: string
  note?: string
}

/** `POST ServingListWeb/Lists/{id}/Deactivate` and `.../Reactivate`. */
export interface ServingListNoteRequest {
  note?: string
}

/** `POST ServingListWeb/Lists/{id}/Stores`. One bad code refuses the whole batch. */
export interface ServingListAddStoresRequest {
  storeCodes: string[]
  note?: string
}

/** `PUT ServingListWeb/Lists/{id}/Stores/{storeCode}/Enabled`. */
export interface ServingListStoreEnabledRequest {
  enabled: boolean
  note?: string
}

/** A refused batch add's `ApiError.data` (`SVL-00002` / `SVL-00003`). */
export interface ServingListBatchRefusal {
  badStoreCodes: string[]
}

/** `ServingListErrorCodes`. The message is one `"English / Arabic"` string; the screen words each by code. */
export const SERVING_LIST_ERRORS = {
  UnknownList: 'SVL-00001',
  UnknownStore: 'SVL-00002',
  AlreadyMember: 'SVL-00003',
  NotMember: 'SVL-00004',
  NameRequired: 'SVL-00005',
  NameTooLong: 'SVL-00006',
  AlreadyInState: 'SVL-00007',
  StoreCodesRequired: 'SVL-00008',
  UnknownDutyFilter: 'SVL-00009',
} as const
export type ServingListErrorCode = (typeof SERVING_LIST_ERRORS)[keyof typeof SERVING_LIST_ERRORS]
