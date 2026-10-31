/**
 * The Code labels screen's doors (BackOffice 3295 + 3296; oms ticket 706). 🚩 Both unbuilt and guessed; 711
 * reconciles them. A session without the grant is answered a bare 403.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import { uploadForm, type WorkbookLoad, type WorkbookUploadReply } from './labels'

import { overrideOf, worklistRows, type LabelOverride, type OverrideBody, type OverrideDoorRow, type WorklistDoorItem, type WorklistRow } from './overrides'

const WORKBOOKS = `${INSURANCE_RULES_BASE}/Labels/Workbooks`
const WORKLIST = `${INSURANCE_RULES_BASE}/Labels/Worklist`
const OVERRIDES = `${INSURANCE_RULES_BASE}/Labels/Overrides`

export const labelsApi = {
  /** `GET InsuranceRules/Labels/Workbooks` — the past loads, newest first. */
  async loads(): Promise<WorkbookLoad[]> {
    return (await api.get<WorkbookLoad[] | null>(WORKBOOKS)) ?? []
  },
  /** `POST InsuranceRules/Labels/Workbooks` multipart `{ file }`; an unknown layout or an older version is refused. */
  upload(file: File): Promise<WorkbookUploadReply> {
    return api.upload<WorkbookUploadReply>(WORKBOOKS, uploadForm(file))
  },
  /** `GET InsuranceRules/Labels/Worklist` (3297) — ranked by the door; the client never re-sorts it. */
  async worklist(): Promise<WorklistRow[]> {
    return worklistRows(await api.get<{ items?: WorklistDoorItem[] | null } | null>(WORKLIST))
  },
  /** `GET InsuranceRules/Labels/Overrides?waiting=true` (3297) — what waits for a second person. */
  async proposed(): Promise<LabelOverride[]> {
    return ((await api.get<OverrideDoorRow[] | null>(OVERRIDES, { waiting: true })) ?? []).map(overrideOf)
  },
  /** `POST InsuranceRules/Labels/Overrides` (3297). */
  propose(body: OverrideBody): Promise<LabelOverride> {
    return api.post<OverrideDoorRow>(OVERRIDES, body).then(overrideOf)
  },
  /** `POST InsuranceRules/Labels/Overrides/{id}/Approve` (3297); HQ refuses the author. */
  approve(id: string): Promise<LabelOverride> {
    return api.post<OverrideDoorRow>(`${OVERRIDES}/${encodeURIComponent(id)}/Approve`, {}).then(overrideOf)
  },
}

export const LABELS_KEY = [...INSURANCE_RULES_KEY, 'labels'] as const

export function loadsQuery() {
  return { queryKey: [...LABELS_KEY, 'loads'], queryFn: () => labelsApi.loads(), retry: false } as const
}

export function worklistQuery() {
  return { queryKey: [...LABELS_KEY, 'worklist'], queryFn: () => labelsApi.worklist(), retry: false } as const
}

export function proposedQuery() {
  return { queryKey: [...LABELS_KEY, 'proposed'], queryFn: () => labelsApi.proposed(), retry: false } as const
}
