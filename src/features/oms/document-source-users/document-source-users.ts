import type { ImportOkLine } from '@/core/import/parse-import'
import type { SdDocumentSourceUserImportLine } from '@/core/models/document-source-user'
import { documentSourceUsersApi } from './api'

// Document source users (ticket 438, spec 430 D7/D16/D20): what the screen reads and what its
// import sends. Read and import only — there is no single-row edit (D20).

/** The list's one key: the import reloads it. */
export const SOURCE_USERS_KEY = ['document-source-users'] as const

/** Every pin, on open (D16): the list is small. */
export function sourceUsersQuery() {
  return {
    queryKey: SOURCE_USERS_KEY,
    queryFn: () => documentSourceUsersApi.list(),
    retry: false,
  }
}

/** WPF's file (`DocumentSourceUsersImportController`): user ID, then document source, then an optional X. */
export const SOURCE_USER_IMPORT_COLUMNS = ['userId', 'documentSource'] as const

export type SourceUserImportColumn = (typeof SOURCE_USER_IMPORT_COLUMNS)[number]

/**
 * The `{ lines }` of `POST SdDocumentWeb/DocumentSourceUsers/Import`: every line in file order,
 * a trailing X as `isDeleted`. 🚩 `isDeleted` is the server's field (WPF's
 * `SdDocumentSourceUserUpdateModel`); the geography imports' `isDelete` is a different door's.
 */
export function sourceUserLines(lines: readonly ImportOkLine<SourceUserImportColumn>[]): SdDocumentSourceUserImportLine[] {
  return lines.map((l) => ({ userId: l.fields.userId, documentSource: l.fields.documentSource, isDeleted: l.action === 'delete' }))
}
