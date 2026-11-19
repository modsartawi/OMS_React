/**
 * The Mini POS pharmacies screen's pure half (oms 927, BackOffice 4074): the trial role's words, which actions a row
 * offers, the print page's address, and the steps "add a pharmacy" takes. The server decides; these only keep the screen
 * from offering what the door would refuse.
 */
import { MINI_POS_TRIAL_ROLES, type MiniPosStore, type MiniPosTrialRole } from '@/core/models/mini-pos'

/** The i18n key under `trialRole.*` for a role as the server holds it (`''` and anything unknown are none). */
export function trialRoleKey(role: string | null | undefined): 'trial' | 'control' | 'none' {
  if (role === 'Trial') return 'trial'
  if (role === 'Control') return 'control'
  return 'none'
}

/** A role from a select's value: one of the three, or none. */
export const asTrialRole = (value: string): MiniPosTrialRole =>
  (MINI_POS_TRIAL_ROLES as readonly string[]).includes(value) ? (value as MiniPosTrialRole) : ''

/**
 * Whether the row's printed code can be drawn: an enabled store with a key (the door refuses `MINIPOS_STORE_NOT_ENABLED`
 * otherwise). A control pharmacy never runs Mini POS, so it is never enabled and never printed.
 */
export const canPrint = (store: Pick<MiniPosStore, 'isEnabled' | 'hasKey'>): boolean => store.isEnabled && store.hasKey

/** The print page's address: outside the shell, so the paper is the code alone. */
export const printPath = (storeCode: string): string => `/mini-pos/print/${encodeURIComponent(storeCode)}`

/** One write "add a pharmacy" makes, in order. */
export type AddStep = 'enable' | 'trialRole'

/**
 * The writes adding a pharmacy with a role makes. A control pharmacy is only marked (the server gives it a disabled row);
 * a trial pharmacy is enabled and marked; a plain one is enabled.
 */
export function addSteps(role: MiniPosTrialRole): AddStep[] {
  if (role === 'Control') return ['trialRole']
  if (role === 'Trial') return ['enable', 'trialRole']
  return ['enable']
}

/** Stores in code order, enabled ones first. */
export function storesShown(stores: readonly MiniPosStore[]): MiniPosStore[] {
  return [...stores].sort((a, b) => Number(b.isEnabled) - Number(a.isEnabled) || a.storeCode.localeCompare(b.storeCode))
}

/** The version a reprint will make (the server's own answer replaces it). */
export const nextVersion = (store: Pick<MiniPosStore, 'printedCodeVersion'>): number => (store.printedCodeVersion || 0) + 1
