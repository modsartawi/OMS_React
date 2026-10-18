import { api, type FileResponse } from '@/core/api'
import type { RuleUploadReport } from '@/core/models/rule-upload'

// The campaign upload's doors (ADR 0097; BackOffice 2836, the 2737 brief's "HQ contract: campaign
// uploads"): every door POST, cookie session, each with its OWN grant on
// `BackOfficeScreen[RuleAuthoring, command]` — 03 reader for the template, 02 author for the read
// and the conversion.
// There is no access probe: a session without the grant is a BARE 403 with no body, which the page
// names through `isBareDenial`. Calls go through @/core/api (.claude/rules/api-envelope.md).
const TEMPLATE = 'Rules/Authoring/Uploads/Template'
const READ = 'Rules/Authoring/Uploads/Read'
const CONVERT_BBY = 'Rules/Authoring/Uploads/ConvertBby'

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
   * BBy `.txt` in, our workbook pre-filled from it out, named `<DealCode>.xlsx`. Nothing is stored:
   * the author reviews the workbook and uploads it through `read`. A file that cannot be converted
   * at all (no BBy row, more than one SAP deal number, not a `.txt`, over 10 MB) is 400
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
}

/** An upload's page in Approvals → Uploads (ticket 532's route; a plain link until it lands). */
export const campaignUploadPath = (dealCode: string) => `/campaigns/uploads/${encodeURIComponent(dealCode)}`
