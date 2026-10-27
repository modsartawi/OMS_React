/**
 * The Approvals screen's doors (BackOffice spec 3126; door 3139, shadow figures from 3141; oms ticket 611).
 * The draft and its checks come through `@/core/insurance-rules/api`, the latest back-test through
 * `@/core/insurance-rules/backtest` (612 starts it).
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 611): no door here has met a real SIS.Api.
 * The brief spells Submit / Approve / SendBack / Promote / Versions / Restore and their bodies only in part; the
 * guesses (the `Approval` read, every answer's shape, Approve / SendBack taking `{ note }`, a version's fields)
 * are recorded under 611's ## Comments for 618.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY, rulesetApprovalDoors, type RulesetVersion } from '@/core/insurance-rules/api'
import type { DraftApproval } from '@/core/insurance-rules/approval'
import type { GuardRuleset } from '@/core/insurance-rules/model'

const GUARDS = `${INSURANCE_RULES_BASE}/Guards`

export type { RulesetVersion }

const doors = rulesetApprovalDoors<GuardRuleset>('Guards')

/** A shadow rule's figures since it went into shadow (`GET InsuranceRules/Metrics?by=rule`, 3141). */
export interface ShadowFigures {
  shadowFires: number
  fires: { refuse: number; override: number; warn: number }
}

export const approvalsApi = {
  /** `GET InsuranceRules/Guards/Approval` (⚠️ GUESSED door) — where the draft stands, and what the viewer may do. */
  approval(): Promise<DraftApproval> {
    return doors.approval()
  },
  /** `POST …/Submit { note }` — refused without a back-test of this revision. */
  submit(note: string): Promise<DraftApproval> {
    return doors.submit(note)
  },
  /** `POST …/Approve` — approver only, not the author. */
  approve(note: string): Promise<DraftApproval> {
    return doors.approve(note)
  },
  /** `POST …/SendBack` — approver only, not the author. */
  sendBack(note: string): Promise<DraftApproval> {
    return doors.sendBack(note)
  },
  /** `POST …/Rules/{id}/Promote { skipReason? }` — refused under 14 days without a reason. */
  promote(ruleId: string, skipReason: string | null): Promise<unknown> {
    return api.post<unknown>(`${GUARDS}/Rules/${encodeURIComponent(ruleId)}/Promote`, skipReason ? { skipReason } : {})
  },
  /** `GET …/Versions` — newest first. */
  versions(): Promise<RulesetVersion[]> {
    return doors.versions()
  },
  /** `POST …/Versions/{v}/Restore` — the version becomes a NEW draft (answered whole, its new revision). */
  restore(version: number): Promise<GuardRuleset> {
    return doors.restore(version)
  },
  /** The rule's row of `GET InsuranceRules/Metrics?by=rule&from&to`, or null when it has not fired. */
  async shadowFigures(ruleId: string, from: string, to: string): Promise<ShadowFigures | null> {
    const rows = (await api.get<({ key: string } & ShadowFigures)[] | null>(`${INSURANCE_RULES_BASE}/Metrics`, { by: 'rule', from, to })) ?? []
    const row = rows.find((r) => r.key === ruleId)
    return row ? { shadowFires: row.shadowFires, fires: row.fires } : null
  },
}

export const APPROVALS_KEY = [...INSURANCE_RULES_KEY, 'guards', 'approval'] as const

export const approvalQuery = () => ({ queryKey: APPROVALS_KEY, queryFn: () => approvalsApi.approval(), retry: false }) as const
export const versionsQuery = () => ({ queryKey: [...INSURANCE_RULES_KEY, 'guards', 'versions'], queryFn: () => approvalsApi.versions(), retry: false }) as const
export const shadowFiguresQuery = (ruleId: string, from: string, to: string) =>
  ({ queryKey: [...INSURANCE_RULES_KEY, 'guards', 'shadow', ruleId, from, to], queryFn: () => approvalsApi.shadowFigures(ruleId, from, to), retry: false }) as const
