import { api } from '@/core/api'
import type { RuleUploadReport } from '@/core/models/rule-upload'

// The campaign upload's doors (ADR 0097; BackOffice 2836, the 2737 brief's "HQ contract: campaign
// uploads"): every door POST, cookie session, each with its OWN grant on
// `BackOfficeScreen[RuleAuthoring, command]` — 03 reader for the template, 02 author for the read.
// There is no access probe: a session without the grant is a BARE 403 with no body, which the page
// names through `isBareDenial`. Calls go through @/core/api (.claude/rules/api-envelope.md).
const TEMPLATE = 'Rules/Authoring/Uploads/Template'
const READ = 'Rules/Authoring/Uploads/Read'

/** The name a workbook is saved under when the reply's `Content-Disposition` names none. */
export const CAMPAIGN_UPLOAD_FALLBACK_NAME = 'campaign-upload.xlsx'

/** A workbook HQ answered, and the name to save it under. */
export interface UploadFile {
  blob: Blob
  fileName: string
}

export const campaignUploadApi = {
  /** POST Rules/Authoring/Uploads/Template — the blank workbook, `campaign-upload-template.xlsx`. */
  async template(): Promise<UploadFile> {
    const file = await api.postBlob(TEMPLATE)
    return { blob: file.blob, fileName: file.filename ?? CAMPAIGN_UPLOAD_FALLBACK_NAME }
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
}

/** An upload's page in Approvals → Uploads (ticket 532's route; a plain link until it lands). */
export const campaignUploadPath = (dealCode: string) => `/campaigns/uploads/${encodeURIComponent(dealCode)}`
