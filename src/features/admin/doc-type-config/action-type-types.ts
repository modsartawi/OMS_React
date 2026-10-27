// Wire shapes for the action types (BackOffice spec 3148, ticket 3155) — `SdDocTypeConfigAdminModels.ActionTypes.cs` on
// branch `spec3148`, in the camelCase ASP.NET Core emits. Kept apart from `types.ts` so the sibling slices never meet it.

/** An action type as the page shows it and the log snapshots it. Code and category are locked. */
export interface ActionTypeSettings {
  actionType: string
  description: string
  documentCategory: string
  updateLastAction: boolean
  deactivateDocument: boolean
  activateDocument: boolean
  completeDocument: boolean
  allowedWhenCompleted: boolean
}

/** The five options, in the order the page and the dialog show them. */
export const ACTION_TYPE_OPTIONS = [
  'updateLastAction',
  'deactivateDocument',
  'activateDocument',
  'completeDocument',
  'allowedWhenCompleted',
] as const
export type ActionTypeOption = (typeof ACTION_TYPE_OPTIONS)[number]

/** The fields a consultant may change: the description and the five options. */
export type ActionTypeEditableField = 'description' | ActionTypeOption

/** `SdAffectedTypeKinds`. */
export type AffectedTypeKind = 'DocumentType' | 'DeliveryDocumentType'

/** A document type or delivery type an edit in the category reaches. */
export interface AffectedDocumentType {
  documentType: string
  description: string
  kind: AffectedTypeKind | string
}

/** `GET SdDocTypeConfigWeb/ActionTypeCategories/{category}`. */
export interface ActionTypeCategory {
  category: string
  actionTypes: ActionTypeSettings[]
  affectedTypes: AffectedDocumentType[]
}

/** `PUT SdDocTypeConfigWeb/ActionTypes/{actionType}`. */
export interface ActionTypeUpdateRequest {
  before: ActionTypeSettings
  after: ActionTypeSettings
  reason: string
}
