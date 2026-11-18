/**
 * The document-type configuration's server calls (BackOffice spec 3148; door 3149 `SdDocTypeConfigWebEndpoints`).
 * Every `SdDocTypeConfigWeb/*` door is here, with the probe: this feature is its only consumer (the menu leaf reads
 * it through `layout`, which may import a feature).
 *
 * Reads need the existing OMS access only; every write also needs `BackOfficeScreen[SdDocTypeConfig,06]` — a session
 * without it gets a BARE 403 (`isBareDenial`). Every write acts as the signed-in user (no body names the user).
 * Refusals are `SDC-0000n` (`DOC_TYPE_CONFIG_ERRORS`).
 *
 * ⚠️ BackOffice 3149 is built on `spec3148`, not deployed: `tools/doc-type-config-drive.mjs` stubs every call in the
 * shapes of `SdDocTypeConfigAdminModels.cs`. The existing `GET SdDocument/DocumentTypes` lookup
 * (`@/core/services/lookups`) is a different, ungated door and stays as it is.
 */
import { api } from '@/core/api'
import type { Permissions } from '@/core/permissions'
import type {
  DocumentTypeFieldMeta,
  DocumentTypeListRow,
  DocumentTypeSettings,
  DocumentTypeUpdateRequest,
} from './types'

const BASE = 'SdDocTypeConfigWeb'
const type = (code: string) => `${BASE}/DocumentTypes/${encodeURIComponent(code)}`

/** The server's refusal codes (`SdDocTypeConfigErrorCodes`). */
export const DOC_TYPE_CONFIG_ERRORS = {
  unknownDocumentType: 'SDC-00001',
  reasonRequired: 'SDC-00002',
  lockedField: 'SDC-00003',
  staleBeforeState: 'SDC-00004',
  settingsRequired: 'SDC-00005',
  /** Review of 3148: the save's after equals its before on every field; nothing is written or logged. The dialogs keep
   *  Save disabled until something changed, so this reaches the screen only through a race; its message is shown. */
  nothingChanged: 'SDC-00006',
  /** 3150: one or more settings refused; `data.fields` names each (`settingsRefusals`). */
  settingsRefused: 'SDC-00010',
} as const

export const docTypeConfigApi = {
  /** `GET SdDocTypeConfigWeb/DocumentTypes` — every type: code, description, category, engine. */
  documentTypes(): Promise<DocumentTypeListRow[]> {
    return api.get<DocumentTypeListRow[]>(`${BASE}/DocumentTypes`)
  },

  /** `GET SdDocTypeConfigWeb/DocumentTypes/{code}` — every mapped setting; `SDC-00001` for an unknown code. */
  documentType(code: string): Promise<DocumentTypeSettings> {
    return api.get<DocumentTypeSettings>(type(code))
  },

  /** 3150: `GET SdDocTypeConfigWeb/DocumentTypeFields` — each setting's open/new-orders class and allowed values. */
  documentTypeFields(): Promise<DocumentTypeFieldMeta[]> {
    return api.get<DocumentTypeFieldMeta[]>(`${BASE}/DocumentTypeFields`)
  },

  /** `PUT SdDocTypeConfigWeb/DocumentTypes/{code}` `{ before, after, reason }` — answers the saved settings. */
  updateDocumentType(code: string, body: DocumentTypeUpdateRequest): Promise<DocumentTypeSettings> {
    return api.put<DocumentTypeSettings>(type(code), body)
  },
}

// ── The grants (oms 914, BackOffice spec 4002 row 42: off the one permissions answer) ──────────────────────

/** The menu leaf and the `ScreenGate` read THIS predicate: the existing OMS access, `DocumentList:03`. */
export const canViewDocTypeConfig = (p: Permissions): boolean => p.has('DocumentList:03')

/** Every write affordance: the configuration grant `SdDocTypeConfig:06`, and only beside the View grant. */
export const canEditDocTypeConfig = (p: Permissions): boolean => p.has('DocumentList:03') && p.has('SdDocTypeConfig:06')

// ── Reads ───────────────────────────────────────────────────────────────────────────────────────

/** Every configuration read sits under this prefix; a save invalidates what it changed. */
export const DOC_TYPE_CONFIG_KEY = ['admin', 'doc-type-config'] as const
export const DOCUMENT_TYPES_KEY = [...DOC_TYPE_CONFIG_KEY, 'document-types'] as const

export function documentTypesQuery() {
  return { queryKey: DOCUMENT_TYPES_KEY, queryFn: () => docTypeConfigApi.documentTypes(), retry: false } as const
}

export function documentTypeQuery(code: string) {
  return {
    queryKey: [...DOCUMENT_TYPES_KEY, code] as const,
    queryFn: () => docTypeConfigApi.documentType(code),
    retry: false,
  } as const
}

/** 3150: the settings' metadata is fixed server-side: read once per page life. */
export function documentTypeFieldsQuery() {
  return {
    queryKey: [...DOC_TYPE_CONFIG_KEY, 'document-type-fields'] as const,
    queryFn: () => docTypeConfigApi.documentTypeFields(),
    staleTime: Infinity,
    retry: false,
  } as const
}
