// Types for `campaigns-fixtures.mjs`, so a vitest proof reads the SAME stub data the drive serves
// (ticket 504) rather than a copy of it. The draft doors' shapes are the real ones of
// `src/core/models/rule-campaign.ts` (ticket 522); the doors 523-526 still own are PROVISIONAL.
import type {
  RuleBlockCatalogue,
  RuleBudgetUsage,
  RuleCampaign,
  RuleDraft,
  RuleDraftDeleted,
  RuleDraftSave,
  RuleValidation,
  RuleCampaignListRow,
  RuleCampaignVersion,
  RuleCampaignVersionDetail,
  RuleLookupItem,
  RuleLookupKind,
  RuleOfflineVerdict,
} from '../src/core/models/rule-campaign'

/** A refusal of a stubbed door: its code, status and message. */
type Refused = { refused: string; status: number; message: string }

/** Drafts/Load replies around schema-1 campaigns (ticket 522). */
export const CAMPAIGNS: RuleDraft[]
export const NEVER: string
export function offlineOf(c: RuleCampaign): RuleOfflineVerdict
export function validationOf(c: RuleCampaign): RuleValidation
export const CATALOGUE: RuleBlockCatalogue
export function listRow(d: RuleDraft): RuleCampaignListRow
export function loadDraft(store: RuleDraft[], code: string): { draft: RuleDraft } | Refused
export function saveDraft(store: RuleDraft[], body: RuleDraftSave, at: string): { draft: RuleDraft } | Refused
export function deleteDraft(store: RuleDraft[], body: { campaign: string; revision: number }): { deleted: RuleDraftDeleted } | Refused
export function copyOf(store: RuleDraft[], source: RuleDraft, at: string): RuleDraft
export const LOOKUPS: Record<RuleLookupKind, RuleLookupItem[]>
export function lookup(kind: RuleLookupKind, search?: string): RuleLookupItem[]
export function lifecycle(
  d: RuleDraft,
  act: 'AskForApproval' | 'Activate' | 'SendBack' | 'Disable',
  o: { note?: string; by: string; at: string },
): { campaign: RuleDraft; refused?: undefined } | { refused: string; campaign?: undefined }
export function budgetUsage(d: RuleDraft): RuleBudgetUsage[]
export function changeLimit(
  d: RuleDraft,
  budgetId: string,
  value: number,
): { campaign: RuleDraft; refused?: undefined } | { refused: string; message: string; campaign?: undefined }
export function versionsOf(store: RuleDraft[]): Map<string, RuleCampaignVersionDetail[]>
export function versionRow(v: RuleCampaignVersionDetail): RuleCampaignVersion
export function publishVersion(versions: Map<string, RuleCampaignVersionDetail[]>, d: RuleDraft, note?: string): void
export function restoreVersion(
  d: RuleDraft,
  versions: Map<string, RuleCampaignVersionDetail[]>,
  n: number,
): { campaign: RuleDraft; refused?: undefined } | { refused: string; message: string; campaign?: undefined }
