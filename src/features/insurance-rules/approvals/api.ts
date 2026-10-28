/**
 * The Approvals screen's doors (BackOffice spec 3126; door 3139, shadow figures from 3141; oms ticket 611).
 * The draft and its checks come through `@/core/insurance-rules/api`, the latest back-test through
 * `@/core/insurance-rules/backtest` (612 starts it).
 *
 * As BUILT (oms 618 reconciled 3139): there is no `…/Approval` read — where the draft stands is the draft
 * (`guardDraftStateQuery`, `approvalOf`); Submit / Approve carry the draft's `revision`; Submit / SendBack / Restore
 * answer the draft, Approve / Promote the published version; a version is `{ versionNo, publishedAt, publishedBy,
 * requestedBy, action, note }`. The stubs (`tools/insurance-rules-stubs.mjs`, section 611) serve these shapes.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE, INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import type { GuardRuleset } from '@/core/insurance-rules/model'
import { rulesetDoors, type RulesetDraft, type RulesetVersionRow } from '@/core/insurance-rules/ruleset-draft'

const GUARDS = `${INSURANCE_RULES_BASE}/Guards`

export type RulesetVersion = RulesetVersionRow

const doors = () => rulesetDoors<GuardRuleset>('Guards')

/** A shadow rule's figures since it went into shadow (`GET InsuranceRules/Metrics?by=rule&daily=false`, 3141). */
export interface ShadowFigures {
  shadowFires: number
  fires: { refuse: number; override: number; warn: number }
}

export const approvalsApi = {
  /** `POST …/Submit { revision, note }` → the draft, now `pending`; 409 `GUARDS_BACKTEST_MISSING` without a done back-test. */
  submit(revision: number, note: string): Promise<RulesetDraft<GuardRuleset>> {
    return doors().submit(revision, note)
  },
  /** `POST …/Approve { revision, note }` → the published version; 403 `GUARDS_SELF_APPROVAL` for its author. */
  approve(revision: number, note: string): Promise<RulesetVersionRow> {
    return doors().approve(revision, note)
  },
  /** `POST …/SendBack { note }` (note required) → the draft, now `sentBack`. */
  sendBack(note: string): Promise<RulesetDraft<GuardRuleset>> {
    return doors().sendBack(note)
  },
  /** `POST …/Rules/{id}/Promote { skipReason? }` → the new version; 409 `GUARDS_SHADOW_TOO_SHORT` under 14 days without a reason. */
  promote(ruleId: string, skipReason: string | null): Promise<RulesetVersionRow> {
    return api.post<RulesetVersionRow>(`${GUARDS}/Rules/${encodeURIComponent(ruleId)}/Promote`, skipReason ? { skipReason } : {})
  },
  /** `GET …/Versions` — `[{ versionNo, publishedAt, publishedBy, requestedBy, action, note }]`, newest first. */
  versions(): Promise<RulesetVersionRow[]> {
    return doors().versions()
  },
  /** `POST …/Versions/{v}/Restore` — the version becomes a NEW draft (`origin: restore:v`); 409 `GUARDS_DRAFT_EXISTS`. */
  restore(version: number): Promise<RulesetDraft<GuardRuleset>> {
    return doors().restore(version)
  },
  /** The rule's row of `GET InsuranceRules/Metrics?by=rule&from&to&daily=false` (one row per rule), or null when it has not fired. */
  async shadowFigures(ruleId: string, from: string, to: string): Promise<ShadowFigures | null> {
    const rows = (await api.get<({ key: string } & ShadowFigures)[] | null>(`${INSURANCE_RULES_BASE}/Metrics`, { by: 'rule', from, to, daily: 'false' })) ?? []
    const row = rows.find((r) => r.key === ruleId)
    return row ? { shadowFires: row.shadowFires, fires: row.fires } : null
  },
}

export const versionsQuery = () => ({ queryKey: [...INSURANCE_RULES_KEY, 'guards', 'versions'], queryFn: () => approvalsApi.versions(), retry: false }) as const
export const shadowFiguresQuery = (ruleId: string, from: string, to: string) =>
  ({ queryKey: [...INSURANCE_RULES_KEY, 'guards', 'shadow', ruleId, from, to], queryFn: () => approvalsApi.shadowFigures(ruleId, from, to), retry: false }) as const
