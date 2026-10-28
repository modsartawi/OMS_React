import type { FlagSettings } from './model'

// The flag thresholds as the Flags tab edits them (review 3126 P5; `PUT InsuranceRules/Settings/Flags`, 3141 as built:
// all seven, each a whole number; 400 `INSMETRICS_BAD_REQUEST` below 1, a pct over 100, a window over 366 days). Pure.

export interface FlagSettingsForm {
  noisyPct: number
  noisyMinFires: number
  noisyDays: number
  silentDays: number
  jumpFactor: number
  jumpDays: number
  jumpMinFires: number
}

export type FlagSettingsField = keyof FlagSettingsForm

export const FLAG_SETTINGS_FIELDS: readonly FlagSettingsField[] = ['noisyPct', 'noisyMinFires', 'noisyDays', 'silentDays', 'jumpFactor', 'jumpDays', 'jumpMinFires']

/** The windows a threshold is counted over, at most 366 days. */
const WINDOWS: readonly FlagSettingsField[] = ['noisyDays', 'silentDays', 'jumpDays']
export const MAX_FLAG_WINDOW_DAYS = 366

export const flagSettingsForm = (s: FlagSettings): FlagSettingsForm => ({
  noisyPct: s.noisyOverridePct,
  noisyMinFires: s.noisyMinFires,
  noisyDays: s.noisyDays,
  silentDays: s.silentDays,
  jumpFactor: s.jumpFactor,
  jumpDays: s.jumpDays,
  jumpMinFires: s.jumpMinFires,
})

export const flagSettingsBody = (f: FlagSettingsForm): FlagSettings => ({
  noisyOverridePct: f.noisyPct,
  noisyMinFires: f.noisyMinFires,
  noisyDays: f.noisyDays,
  silentDays: f.silentDays,
  jumpFactor: f.jumpFactor,
  jumpDays: f.jumpDays,
  jumpMinFires: f.jumpMinFires,
})

const wholeAtLeast1 = (n: number) => Number.isInteger(n) && n >= 1

/** The fields that would be refused, in form order. */
export function flagSettingsProblems(f: FlagSettingsForm): FlagSettingsField[] {
  return FLAG_SETTINGS_FIELDS.filter((k) => {
    const n = f[k]
    if (!wholeAtLeast1(n)) return true
    if (k === 'noisyPct') return n > 100
    return WINDOWS.includes(k) && n > MAX_FLAG_WINDOW_DAYS
  })
}
