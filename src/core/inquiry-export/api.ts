/**
 * The inquiry-export doors (BackOffice spec 4314, ticket 4317's contract; this client is ticket 4318).
 *
 * An **export job** is a month of one inquiry screen written to an XLSX by a SIS.Api worker and collected from
 * *My exports* (glossary: Export job, beside the screen's own Quick export). Shared by the six screens that offer
 * *Export month…* (4318 Collection Attempts; 4321–4325 the rest) and by the My exports page, so it lives in `core/`.
 *
 * Every door is owner-scoped and cookie-session only. A refusal answers 400 with `errors[0].errorCode` `INQX-000nn`
 * (`apiErrorCode`); the file door answers a bare 404 when the job is not the caller's, not done, removed, or the
 * feature is off.
 */
import { api, type FileResponse } from '@/core/api'

/**
 * The server's screen keys (`InquiryExportScreens`), one per screen that may export a month. Each later ticket adds its
 * key here when its row source lands; a key the server does not know refuses the request (`INQX-00002`).
 */
export type InquiryExportScreen = 'CollectionAttempts' | 'CashCollections' | 'Deposits'

/**
 * Where each screen's user collects the file: My exports under the screen's own area, so the area's group stays lit.
 * A `Record` over the screen union, so a screen added above cannot forget its page.
 */
export const MY_EXPORTS_PATH: Record<InquiryExportScreen, string> = {
  CollectionAttempts: '/collection/exports',
  CashCollections: '/collection/exports',
  Deposits: '/collection/exports',
}

/** `GET InquiryExport/Capabilities`: the feature is on (the share is configured) and the screens this session may export. */
export interface InquiryExportCapabilities {
  enabled: boolean
  screens: string[]
}

export type InquiryExportStatus = 'Waiting' | 'Running' | 'Done' | 'Failed' | 'Cancelled'

/** One job as the list and the request answer it. Dates are local wall-clock ISO stamps. */
export interface InquiryExportJob {
  jobId: string
  jobNumber: string
  screen: string
  /** Null on a job read without a range (Cash Collections narrowed to one ACR, ticket 4323). */
  fromDate: string | null
  toDate: string | null
  status: InquiryExportStatus
  rowCount: number
  isCut: boolean
  fileName: string
  fileAvailable: boolean
  fileDeletedTime: string | null
  addedTime: string
  startedTime: string | null
  processedTime: string | null
  errorMessage: string
}

/** One visible grid column, in the user's order, with the header text the user sees. */
export interface InquiryExportColumn {
  id: string
  header: string
}

/** `POST InquiryExport/Jobs`' body. Dates are plain days (`yyyy-MM-dd`). */
export interface InquiryExportRequest {
  screen: InquiryExportScreen
  /** Null when the screen's filters bound the export on their own (`ExportMonthSource.undated`). */
  fromDate: string | null
  toDate: string | null
  /** The screen's inquiry parameters, spelt as its grid's query string (the server reads them case-insensitively). */
  filters: Record<string, unknown>
  columns: InquiryExportColumn[]
  language: 'en' | 'ar'
}

/** The one capabilities cache entry: the split buttons on every screen read it. */
export const INQUIRY_EXPORT_CAPABILITIES_KEY = ['inquiry-export', 'capabilities'] as const
/** The caller's jobs (My exports). Invalidated by a successful request. */
export const INQUIRY_EXPORT_JOBS_KEY = ['inquiry-export', 'jobs'] as const

export const inquiryExportApi = {
  capabilities(): Promise<InquiryExportCapabilities> {
    return api.get<InquiryExportCapabilities>('InquiryExport/Capabilities')
  },
  request(body: InquiryExportRequest): Promise<InquiryExportJob> {
    return api.post<InquiryExportJob>('InquiryExport/Jobs', body)
  },
  myJobs(): Promise<InquiryExportJob[]> {
    return api.get<InquiryExportJob[]>('InquiryExport/Jobs')
  },
  file(jobId: string): Promise<FileResponse> {
    return api.blob(`InquiryExport/Jobs/${encodeURIComponent(jobId)}/File`)
  },
}

/**
 * The capabilities query. Read once per page life (a switch ops flips between deploys, not between clicks); a failure
 * reads as "off" — the screen keeps its quick export and offers nothing it cannot honour.
 */
export function capabilitiesQuery() {
  return {
    queryKey: INQUIRY_EXPORT_CAPABILITIES_KEY,
    queryFn: () => inquiryExportApi.capabilities(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The menu's `offered` door for the two My exports leaves: shown only while the feature is on and this session may
 * export at least one screen. Its own cache entry (the menu's door answers a boolean, the split buttons the whole
 * capabilities answer), so a cold load asks twice at most; a failure hides the leaf.
 */
export const MY_EXPORTS_OFFER = {
  queryKey: ['inquiry-export', 'offered'] as const,
  queryFn: async (): Promise<boolean> => {
    const caps = await inquiryExportApi.capabilities()
    return caps?.enabled === true && Array.isArray(caps.screens) && caps.screens.length > 0
  },
}

/**
 * May this session ask for a month of `screen`? Only when the feature is on AND the server lists the screen among
 * those this session holds the export permission for (`<Screen>Export:03`, checked server-side per session).
 * Pending, failed or malformed answers say no.
 */
export function canExportMonth(caps: InquiryExportCapabilities | null | undefined, screen: InquiryExportScreen): boolean {
  if (!caps || caps.enabled !== true || !Array.isArray(caps.screens)) return false
  return caps.screens.includes(screen)
}
