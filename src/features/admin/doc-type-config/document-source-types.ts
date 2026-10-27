// Wire shapes for the document sources (BackOffice spec 3148, ticket 3156) — `SdDocTypeConfigAdminModels.DocumentSources.cs`
// on branch `spec3148`, in the camelCase ASP.NET Core emits. Kept apart from `types.ts` so the sibling slices never meet it.

/** A document source as the page shows it and the log snapshots it. The code is locked. */
export interface DocumentSourceSettings {
  documentSource: string
  description: string
  /** `''` or `'C'` (the call-centre channels — a `C` source is on every agent's source list). */
  documentSourceCategory: string
}

/** The fields a consultant may change. */
export type DocumentSourceEditableField = 'description' | 'documentSourceCategory'

/** `PUT SdDocTypeConfigWeb/DocumentSources/{source}`. */
export interface DocumentSourceUpdateRequest {
  before: DocumentSourceSettings
  after: DocumentSourceSettings
  reason: string
}

/** `POST SdDocTypeConfigWeb/DocumentSources/{source}/Copy` — the new code is `after.documentSource`. */
export interface DocumentSourceCopyRequest {
  after: DocumentSourceSettings
  reason: string
}
