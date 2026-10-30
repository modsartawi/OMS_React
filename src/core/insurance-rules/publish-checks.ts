// What publish shows (oms 698; stories 19, 47, 67; J14, D5, L14; doors 3284, 3293, 3297). Pure, and computed by no
// client rule: both lists are HQ's Validate answer, told apart by the door's own severity (`checks.isError`).
//
// ⚠️ GUESS, 711 reconciles: the three warnings arrive on the same `Validate` answer, each an issue with `kind`, `fact`
// and (for a channel) `channel`. A kind this client does not know, or none, is shown as a plain warning with its server text.
import { isError, type GuardIssue } from './checks'

export const PUBLISH_WARNING_KINDS = ['channelNever', 'fieldFlagged', 'arabicMissing'] as const
export type PublishWarningKind = (typeof PUBLISH_WARNING_KINDS)[number] | 'other'

export const publishWarningKind = (i: Pick<GuardIssue, 'kind'>): PublishWarningKind =>
  (PUBLISH_WARNING_KINDS as readonly (string | null | undefined)[]).includes(i.kind) ? (i.kind as PublishWarningKind) : 'other'

/** The refusals, which hold the publish, and the warnings, which never do; HQ's order kept within each. */
export function publishChecks(issues: readonly GuardIssue[] | null | undefined): { warnings: GuardIssue[]; refusals: GuardIssue[] } {
  const all = issues ?? []
  return { warnings: all.filter((i) => !isError(i)), refusals: all.filter(isError) }
}
