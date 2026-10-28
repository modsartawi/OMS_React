/**
 * Review 3126 P5 — the flag thresholds are edited (`PUT InsuranceRules/Settings/Flags`, 3141 as built, oms 618): seven
 * whole numbers; a pct 1–100, every count at least 1, a window at most 366 days.
 */
import { describe, expect, it } from 'vitest'
import { flagSettingsForm, flagSettingsBody, flagSettingsProblems } from './flag-settings'

const S = { noisyOverridePct: 80, noisyMinFires: 30, noisyDays: 30, silentDays: 60, jumpFactor: 10, jumpDays: 30, jumpMinFires: 10 }

describe('flag settings form', () => {
  it('flagSettingsForm_readsHqsSeven_andBodyWritesThemBack', () => {
    const f = flagSettingsForm(S)
    expect(f).toEqual({ noisyPct: 80, noisyMinFires: 30, noisyDays: 30, silentDays: 60, jumpFactor: 10, jumpDays: 30, jumpMinFires: 10 })
    expect(flagSettingsBody({ ...f, noisyPct: 75 })).toEqual({ ...S, noisyOverridePct: 75 })
    expect(flagSettingsProblems(f)).toEqual([])
  })
  it('refuses a pct outside 1–100, anything below 1 or not whole, a window over 366 days', () => {
    expect(flagSettingsProblems({ noisyPct: 0, noisyMinFires: 0, noisyDays: 2.5, silentDays: 60, jumpFactor: 1, jumpDays: 30, jumpMinFires: 10 })).toEqual(['noisyPct', 'noisyMinFires', 'noisyDays'])
    expect(flagSettingsProblems({ noisyPct: 101, noisyMinFires: 1, noisyDays: 1, silentDays: 367, jumpFactor: 1.5, jumpDays: 30, jumpMinFires: 0 })).toEqual(['noisyPct', 'silentDays', 'jumpFactor', 'jumpMinFires'])
  })
})
