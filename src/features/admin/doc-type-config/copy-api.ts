/**
 * Copying a document type (BackOffice spec 3148, ticket 3153, `SdDocTypeConfigWebEndpoints`): the copy write and the
 * code-only-behaviour warning the copy dialog shows. The copy needs `BackOfficeScreen[SdDocTypeConfig,06]` (a bare 403
 * without it); the warning is a read. Kept beside `api.ts` (not in it) so the 3148 slices built in parallel each own
 * their own file. 3156 (sources) reuses `codeOnlyBehaviourQuery('DocumentSource', code)`.
 *
 * ⚠️ Not deployed: `tools/doc-type-copy-drive.mjs` stubs both calls in the shapes of `SdDocTypeConfigAdminModels.Copy.cs`.
 */
import { api } from '@/core/api'
import { DOC_TYPE_CONFIG_KEY } from './api'
import type { CodeOnlyBehaviourLine, DocumentTypeCopyRequest, DocumentTypeSettings } from './types'

const BASE = 'SdDocTypeConfigWeb'

/** The server's copy refusals (`SdDocTypeConfigErrorCodes`, SDC-00040..43). */
export const COPY_ERRORS = {
  newCodeRequired: 'SDC-00040',
  newCodeTooLong: 'SDC-00041',
  newCodeExists: 'SDC-00042',
  unknownBehaviourKind: 'SDC-00043',
} as const

/** What the code-only-behaviour list covers. */
export type CodeOnlyBehaviourKind = 'DocumentType' | 'DocumentSource'

export const copyApi = {
  /** `POST SdDocTypeConfigWeb/DocumentTypes/{source}/Copy` `{ after, reason }` — answers the new type's settings. */
  copyDocumentType(source: string, body: DocumentTypeCopyRequest): Promise<DocumentTypeSettings> {
    return api.post<DocumentTypeSettings>(`${BASE}/DocumentTypes/${encodeURIComponent(source)}/Copy`, body)
  },

  /** `GET SdDocTypeConfigWeb/CodeOnlyBehaviour?entityType&code` — empty for an unlisted code. */
  codeOnlyBehaviour(entityType: CodeOnlyBehaviourKind, code: string): Promise<CodeOnlyBehaviourLine[]> {
    return api.get<CodeOnlyBehaviourLine[]>(`${BASE}/CodeOnlyBehaviour`, { entityType, code })
  },
}

/** The list is fixed server-side: read once per page life. */
export function codeOnlyBehaviourQuery(entityType: CodeOnlyBehaviourKind, code: string) {
  return {
    queryKey: [...DOC_TYPE_CONFIG_KEY, 'code-only-behaviour', entityType, code] as const,
    queryFn: () => copyApi.codeOnlyBehaviour(entityType, code),
    staleTime: Infinity,
    retry: false,
  } as const
}
