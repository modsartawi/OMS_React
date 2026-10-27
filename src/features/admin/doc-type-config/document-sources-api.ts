/**
 * The document-source doors (BackOffice spec 3148, ticket 3156; `SdDocTypeConfigWebEndpoints`). Reads need the existing
 * OMS access only; the save and the copy also need `BackOfficeScreen[SdDocTypeConfig,06]` (a bare 403 without it).
 * Refusals: the shared `SDC-00002/3/4/5` (reason, locked code, stale before-state, missing before/after), the copy's
 * `COPY_ERRORS` (new code blank / too long / taken) and `DOCUMENT_SOURCE_ERRORS`. The copy dialog's warning reads 3153's
 * `codeOnlyBehaviourQuery('DocumentSource', code)`.
 *
 * ⚠️ BackOffice 3156 is built on `spec3148`, not deployed: `tools/document-sources-drive.mjs` stubs every call in the
 * shapes of `SdDocTypeConfigAdminModels.DocumentSources.cs`.
 */
import { api } from '@/core/api'
import { DOC_TYPE_CONFIG_KEY } from './api'
import { CHANGE_LOG_KEY, type HistoryQuery } from './change-log-api'
import type { ConfigChangeRow } from './change-log-types'
import type { DocumentSourceCopyRequest, DocumentSourceSettings, DocumentSourceUpdateRequest } from './document-source-types'

const BASE = 'SdDocTypeConfigWeb'
const one = (code: string) => `${BASE}/DocumentSources/${encodeURIComponent(code)}`

/** `SdDocTypeConfigErrorCodes`, block 70-79. */
export const DOCUMENT_SOURCE_ERRORS = {
  unknownDocumentSource: 'SDC-00070',
  descriptionInvalid: 'SDC-00071',
  categoryInvalid: 'SDC-00072',
} as const

export const documentSourcesApi = {
  /** `GET SdDocTypeConfigWeb/DocumentSources` — every source, by code. */
  list(): Promise<DocumentSourceSettings[]> {
    return api.get<DocumentSourceSettings[]>(`${BASE}/DocumentSources`)
  },

  /** `GET SdDocTypeConfigWeb/DocumentSources/{source}/History` — its log rows, newest first. */
  history(code: string): Promise<ConfigChangeRow[]> {
    return api.get<ConfigChangeRow[]>(`${one(code)}/History`)
  },

  /** `PUT SdDocTypeConfigWeb/DocumentSources/{source}` `{ before, after, reason }` — answers the saved source. */
  update(code: string, body: DocumentSourceUpdateRequest): Promise<DocumentSourceSettings> {
    return api.put<DocumentSourceSettings>(one(code), body)
  },

  /** `POST SdDocTypeConfigWeb/DocumentSources/{source}/Copy` `{ after, reason }` — answers the new source. */
  copy(code: string, body: DocumentSourceCopyRequest): Promise<DocumentSourceSettings> {
    return api.post<DocumentSourceSettings>(`${one(code)}/Copy`, body)
  },
}

export const DOCUMENT_SOURCES_KEY = [...DOC_TYPE_CONFIG_KEY, 'document-sources'] as const

export function documentSourcesQuery() {
  return { queryKey: DOCUMENT_SOURCES_KEY, queryFn: () => documentSourcesApi.list(), retry: false } as const
}

/** A source's History tab (the shared `HistoryTab`). */
export function documentSourceHistoryQuery(code: string): HistoryQuery {
  return {
    queryKey: [...CHANGE_LOG_KEY, 'DocumentSource', code] as const,
    queryFn: () => documentSourcesApi.history(code),
    retry: false,
  }
}
