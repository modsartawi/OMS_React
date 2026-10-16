// Types for `campaigns-fixtures.mjs`, so a vitest proof reads the SAME stub data the drive serves
// (ticket 504) rather than a copy of it. The shapes are the PROVISIONAL ones of
// `src/core/models/rule-campaign.ts`; ticket 520 re-points both.
import type {
  RuleBlockCatalogue,
  RuleBudgetUsage,
  RuleCampaign,
  RuleCampaignCreate,
  RuleCampaignListRow,
  RuleCampaignVersion,
  RuleCampaignVersionDetail,
  RuleFormulaCheck,
  RuleFormulaCheckRequest,
  RuleLookupItem,
  RuleLookupKind,
  RuleOfflineVerdict,
} from '../src/core/models/rule-campaign'

export const CAMPAIGNS: RuleCampaign[]
export const CATALOGUE: RuleBlockCatalogue
export function listRow(c: RuleCampaign): RuleCampaignListRow
export function createDraft(store: RuleCampaign[], body: RuleCampaignCreate, at: string): RuleCampaign
export function copyOf(store: RuleCampaign[], source: RuleCampaign, at: string): RuleCampaign
export const LOOKUPS: Record<RuleLookupKind, RuleLookupItem[]>
export function lookup(kind: RuleLookupKind, search?: string): RuleLookupItem[]
export const SAMPLE_RESULT: number
export function checkFormula(body: RuleFormulaCheckRequest): RuleFormulaCheck
export function lifecycle(
  c: RuleCampaign,
  act: 'AskForApproval' | 'Activate' | 'SendBack' | 'Disable',
  o: { note?: string; by: string; at: string },
): { campaign: RuleCampaign; refused?: undefined } | { refused: string; campaign?: undefined }
export function offlineVerdict(c: RuleCampaign): RuleOfflineVerdict
export function saveSettings(
  c: RuleCampaign,
  part: 'Details' | 'Schedule' | 'Audience' | 'Features' | 'Budgets' | 'Offline',
  body: unknown,
  catalogue?: RuleBlockCatalogue,
): { campaign: RuleCampaign; refused?: undefined } | { refused: string; message: string; campaign?: undefined }
export function budgetUsage(c: RuleCampaign): RuleBudgetUsage[]
export function changeLimit(
  c: RuleCampaign,
  budgetId: string,
  value: number,
): { campaign: RuleCampaign; refused?: undefined } | { refused: string; message: string; campaign?: undefined }
export function versionsOf(store: RuleCampaign[]): Map<string, RuleCampaignVersionDetail[]>
export function versionRow(v: RuleCampaignVersionDetail): RuleCampaignVersion
export function publishVersion(versions: Map<string, RuleCampaignVersionDetail[]>, c: RuleCampaign, note?: string): void
export function restoreVersion(
  c: RuleCampaign,
  versions: Map<string, RuleCampaignVersionDetail[]>,
  n: number,
): { campaign: RuleCampaign; refused?: undefined } | { refused: string; message: string; campaign?: undefined }
