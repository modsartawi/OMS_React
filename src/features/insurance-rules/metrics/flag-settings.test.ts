/**
 * Review 3126 P5 — the flag thresholds are edited (`PUT InsuranceRules/Settings/Flags`, brief 3141): the noisy
 * override rate is typed as a whole percent, every count is a whole number of at least 1, the jump factor is above 1.
 */
import { describe, expect, it } from 'vitest'
import { flagSettingsForm, flagSettingsBody, flagSettingsProblems } from './flag-settings'

const S = { noisyOverrideRate: 0.8, noisyMinFires: 30, windowDays: 30, silentDays: 60, jumpFactor: 10 }

describe('flag settings form', () => {
  it('flagSettingsForm_readsTheRateAsAPercent_andBodyWritesItBack', () => {
    const f = flagSettingsForm(S)
    expect(f).toEqual({ noisyPct: 80, noisyMinFires: 30, windowDays: 30, silentDays: 60, jumpFactor: 10 })
    expect(flagSettingsBody({ ...f, noisyPct: 75 })).toEqual({ ...S, noisyOverrideRate: 0.75 })
    expect(flagSettingsProblems(f)).toEqual([])
  })
  it('refuses a rate outside 1–100, a count below 1 or not whole, and a jump factor of 1 or less', () => {
    expect(flagSettingsProblems({ noisyPct: 0, noisyMinFires: 0, windowDays: 2.5, silentDays: 60, jumpFactor: 1 })).toEqual(['noisyPct', 'noisyMinFires', 'windowDays', 'jumpFactor'])
    expect(flagSettingsProblems({ noisyPct: 101, noisyMinFires: 1, windowDays: 1, silentDays: 0, jumpFactor: 1.5 })).toEqual(['noisyPct', 'silentDays'])
  })
})
