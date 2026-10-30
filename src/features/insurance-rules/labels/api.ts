/**
 * The Code labels screen's doors (BackOffice 3295 + 3296; oms ticket 706). 🚩 Both unbuilt and guessed; 711
 * reconciles them. A session without the grant is answered a bare 403.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import { uploadForm, type WorkbookLoad, type WorkbookUploadReply } from './labels'

const WORKBOOKS = `${INSURANCE_RULES_BASE}/Labels/Workbooks`

export const labelsApi = {
  /** `GET InsuranceRules/Labels/Workbooks` — the past loads, newest first. */
  async loads(): Promise<WorkbookLoad[]> {
    return (await api.get<WorkbookLoad[] | null>(WORKBOOKS)) ?? []
  },
  /** `POST InsuranceRules/Labels/Workbooks` multipart `{ file }`; an unknown layout or an older version is refused. */
  upload(file: File): Promise<WorkbookUploadReply> {
    return api.upload<WorkbookUploadReply>(WORKBOOKS, uploadForm(file))
  },
}

export const LABELS_KEY = [...INSURANCE_RULES_KEY, 'labels'] as const

export function loadsQuery() {
  return { queryKey: [...LABELS_KEY, 'loads'], queryFn: () => labelsApi.loads(), retry: false } as const
}
