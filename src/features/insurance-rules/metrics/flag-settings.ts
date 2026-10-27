import type { FlagSettings } from './model'

// The flag thresholds as the Flags tab edits them (review 3126 P5; `PUT InsuranceRules/Settings/Flags`, 3141).
// Pure. The override rate is typed as a whole percent; HQ keeps the 0–1 share.

export interface FlagSettingsForm {
  noisyPct: number
  noisyMinFires: number
  windowDays: number
  silentDays: number
  jumpFactor: number
}

export type FlagSettingsField = keyof FlagSettingsForm

export const FLAG_SETTINGS_FIELDS: readonly FlagSettingsField[] = ['noisyPct', 'noisyMinFires', 'windowDays', 'silentDays', 'jumpFactor']

export const flagSettingsForm = (s: FlagSettings): FlagSettingsForm => ({
  noisyPct: Math.round(s.noisyOverrideRate * 100),
  noisyMinFires: s.noisyMinFires,
  windowDays: s.windowDays,
  silentDays: s.silentDays,
  jumpFactor: s.jumpFactor,
})

export const flagSettingsBody = (f: FlagSettingsForm): FlagSettings => ({
  noisyOverrideRate: f.noisyPct / 100,
  noisyMinFires: f.noisyMinFires,
  windowDays: f.windowDays,
  silentDays: f.silentDays,
  jumpFactor: f.jumpFactor,
})

const wholeAtLeast1 = (n: number) => Number.isInteger(n) && n >= 1

/** The fields that would be refused, in form order. */
export function flagSettingsProblems(f: FlagSettingsForm): FlagSettingsField[] {
  const bad: FlagSettingsField[] = []
  if (!(Number.isFinite(f.noisyPct) && f.noisyPct >= 1 && f.noisyPct <= 100)) bad.push('noisyPct')
  for (const k of ['noisyMinFires', 'windowDays', 'silentDays'] as const) if (!wholeAtLeast1(f[k])) bad.push(k)
  if (!(Number.isFinite(f.jumpFactor) && f.jumpFactor > 1)) bad.push('jumpFactor')
  return bad
}
