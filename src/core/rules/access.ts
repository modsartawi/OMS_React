/**
 * The rule engine's grants (BackOffice 3459, oms 852; oms 909: off the one permissions answer). In `@/core/` because
 * two areas read them: the Campaigns nav group (eight leaves across `features/campaigns/*`) and the store engine switch
 * (`features/admin/engine-switch`), and a feature may never import another (`.claude/rules/feature-structure.md`).
 *
 * Pure: no React, no `t`.
 */
import type { Permissions } from '@/core/permissions'

/**
 * The authoring family's screens (Promotions, Priority, Simulator, Campaign uploads) open on `[RuleAuthoring, 03]`,
 * which oms-react reads as author (02) OR approver (06), because the seeds bind 03 to both roles (client-side, kept).
 * ⚠ An approver sees Simulator and is refused on Simulate (02).
 */
export const canReadAuthoring = (p: Permissions): boolean => p.has('RuleAuthoring:02') || p.has('RuleAuthoring:06')

/** Campaign upload — a workbook becomes drafts: the author's act (`RuleAuthoring:02`), not the approver's. */
export const canAuthorRules = (p: Permissions): boolean => p.has('RuleAuthoring:02')

/** The approver (`RuleAuthoring:06`). */
export const canApproveRules = (p: Permissions): boolean => p.has('RuleAuthoring:06')

/**
 * Support's screens: Sessions reads `[RuleSupport, 03]`. ⚠ Coupon finder and Customers ride it too, provisionally:
 * their doors (`RuleCampaign/Coupons`, `RuleCampaign/Members`) do not exist yet, so no grant can be read for them.
 */
export const canSupportRules = (p: Permissions): boolean => p.has('RuleSupport:03')

/** The store engine switch: `BackOfficeScreen[RuleEngineSwitch, 02]`. */
export const canSwitchEngine = (p: Permissions): boolean => p.has('RuleEngineSwitch:02')
