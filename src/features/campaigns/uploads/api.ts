import { api, type FileResponse } from '@/core/api'
import type { RuleUploadActivation, RuleUploadDetail, RuleUploadReport, RuleUploadReviewBody, RuleUploadSummary } from '@/core/models/rule-upload'

// The campaign upload's doors (ADR 0097; BackOffice 2836, the 2737 brief's "HQ contract: campaign
// uploads"): every door POST, cookie session, each with its OWN grant on
// `BackOfficeScreen[RuleAuthoring, command]` — 03 reader for the template, the list and an opened
// upload; 02 author for the read and the conversion; 06 approver to activate or send back.
// There is no access probe: a session without the grant is a BARE 403 with no body, which the page
// names through `isBareDenial`. Calls go through @/core/api (.claude/rules/api-envelope.md).
const TEMPLATE = 'Rules/Authoring/Uploads/Template'
const READ = 'Rules/Authoring/Uploads/Read'
const CONVERT_BBY = 'Rules/Authoring/Uploads/ConvertBby'
const LIST = 'Rules/Authoring/Uploads/List'
const LOAD = 'Rules/Authoring/Uploads/Load'
const ACTIVATE = 'Rules/Authoring/Uploads/Activate'
const SEND_BACK = 'Rules/Authoring/Uploads/SendBack'

/** The name a workbook is saved under when the reply's `Content-Disposition` names none. */
export const CAMPAIGN_UPLOAD_FALLBACK_NAME = 'campaign-upload.xlsx'

/** A workbook HQ answered, and the name to save it under. */
export interface UploadFile {
  blob: Blob
  fileName: string
}

const uploadFile = ({ blob, filename }: FileResponse): UploadFile => ({ blob, fileName: filename ?? CAMPAIGN_UPLOAD_FALLBACK_NAME })

export const campaignUploadApi = {
  /** POST Rules/Authoring/Uploads/Template — the blank workbook, `campaign-upload-template.xlsx`. */
  async template(): Promise<UploadFile> {
    return uploadFile(await api.postBlob(TEMPLATE))
  },

  /**
   * POST Rules/Authoring/Uploads/ConvertBby (multipart `file`, BackOffice 2838) — SAP's tab-separated
   * BBy `.txt` in, our workbook pre-filled from it out, named `<PromotionCode>.xlsx`. Nothing is stored:
   * the author reviews the workbook and uploads it through `read`. A file that cannot be converted
   * at all (no BBy row, more than one SAP promotion number, not a `.txt`, over 10 MB) is 400
   * `RULES_BAD_UPLOAD`, the JSON envelope.
   */
  async convertBby(file: File): Promise<UploadFile> {
    const form = new FormData()
    form.append('file', file, file.name)
    return uploadFile(await api.postBlob(CONVERT_BBY, form))
  },

  /**
   * POST Rules/Authoring/Uploads/Read (multipart `file`) — the workbook read all or none. A 200 is
   * the report either way (`accepted: false` stored nothing); a file that is not a workbook at all
   * is 400 `RULES_BAD_UPLOAD`.
   */
  read(file: File): Promise<RuleUploadReport> {
    const form = new FormData()
    form.append('file', file, file.name)
    return api.upload<RuleUploadReport>(READ, form)
  },

  /** POST Rules/Authoring/Uploads/List (BackOffice 2837) — every promotion's upload, newest upload first. */
  list(): Promise<RuleUploadSummary[]> {
    return api.post<RuleUploadSummary[]>(LIST, {})
  },

  /**
   * POST Rules/Authoring/Uploads/Load { promotionCode } — the upload, each campaign beside its live
   * version, the live campaigns it would disable, and what an activation would refuse now. 404
   * `RULES_UPLOAD_NOT_FOUND` for a promotion with no upload.
   */
  load(promotionCode: string): Promise<RuleUploadDetail> {
    return api.post<RuleUploadDetail>(LOAD, { promotionCode })
  },

  /**
   * POST Rules/Authoring/Uploads/Activate { promotionCode, revision, note? } — the whole upload at the
   * revision LOADED, as one ruleset version. The note is optional and left out when blank.
   */
  activate({ promotionCode, revision, note }: RuleUploadReviewBody): Promise<RuleUploadActivation> {
    const said = note?.trim()
    return api.post<RuleUploadActivation>(ACTIVATE, said ? { promotionCode, revision, note: said } : { promotionCode, revision })
  },

  /** POST Rules/Authoring/Uploads/SendBack { promotionCode, revision, note } — the note is required; the reply is the summary, `sentBack`. */
  sendBack({ promotionCode, revision, note }: RuleUploadReviewBody): Promise<RuleUploadSummary> {
    return api.post<RuleUploadSummary>(SEND_BACK, { promotionCode, revision, note: note?.trim() ?? '' })
  },
}

/** The approver's list, Campaigns ▸ Campaign uploads (ticket 532). */
export const CAMPAIGN_UPLOADS_PATH = '/campaigns/uploads'

/** An upload's page (ticket 532's route); the read's success line links here. */
export const campaignUploadPath = (promotionCode: string) => `${CAMPAIGN_UPLOADS_PATH}/${encodeURIComponent(promotionCode)}`

/** Every upload query: an Activate or a Send back refreshes the list and the upload together. A
 *  refusal is final (a bare 403, a 404 for a stale link), so neither query retries it. */
export const CAMPAIGN_UPLOADS_KEY = ['campaign-uploads'] as const

export const campaignUploadsQuery = () => ({
  queryKey: [...CAMPAIGN_UPLOADS_KEY, 'list'] as const,
  queryFn: campaignUploadApi.list,
  retry: false,
})

export const campaignUploadKey = (promotionCode: string) => [...CAMPAIGN_UPLOADS_KEY, 'one', promotionCode] as const

export const campaignUploadQuery = (promotionCode: string) => ({
  queryKey: campaignUploadKey(promotionCode),
  queryFn: () => campaignUploadApi.load(promotionCode),
  retry: false,
})
