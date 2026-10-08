// Wire shapes for the Document source users screen (spec 430 D7, ticket 438) — BackOffice ask BO-6,
// NOT built yet. The row is WPF's `SdDocumentSourceUserModel`
// (`Sartawi.Retail.Data/Modules/Sd/Services/DocumentSource/Models`), in the camelCase ASP.NET Core
// emits. Nothing is invented beyond that class.

/** A row of `GET SdDocumentWeb/DocumentSourceUsers`: a staff user pinned to a document source. */
export interface SdDocumentSourceUserModel {
  userId: string
  documentSource: string
  /** The .NET unset `DateTime` (`0001-01-01T00:00:00`) when never stamped; drawn blank. */
  updatedAt: string
  updatedBy: string | null
}

/**
 * A line of `POST SdDocumentWeb/DocumentSourceUsers/Import`'s `{ lines }` — WPF's
 * `SdDocumentSourceUserUpdateModel`. 🚩 The flag is `isDeleted`, NOT the geography imports'
 * `isDelete`: this side maps to the server's name and never renames it.
 */
export interface SdDocumentSourceUserImportLine {
  userId: string
  documentSource: string
  isDeleted: boolean
}
