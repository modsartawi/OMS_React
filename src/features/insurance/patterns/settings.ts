/**
 * The pattern thresholds (oms 924; BackOffice 4055 `GET`/`PUT Insurance/Patterns/Settings`): the ONE ranges table the
 * settings page validates against, and the body a save sends. Pure: the page reads its problems from here, and the call
 * sends only a body this module made.
 *
 * The ranges are BackOffice 4055's and live HERE only — not read from the `min`/`max` the server sends beside each value
 * — so a value out of range is refused on the page and never reaches the door.
 *
 * 🚩 GUESSED (reconcile with 4055): a save sends only the thresholds that changed (the server keeps the others and logs
 * each change), and the days and pharmacies are whole numbers.
 */
import type { PatternSetting, PatternSettingsBody } from '@/core/models/insurance-pattern-manager'

/** The seven thresholds the nightly job reads (BackOffice 4051's `InsurancePatternSetting` rows). */
export type SettingName = 'WindowDays' | 'MinStores' | 'MaxKmPerHour' | 'MinTravelKm' | 'OverlapShare' | 'CaseQuietDays' | 'LookbackDays'

export interface SettingRange {
  min: number
  max: number
  /** A whole number only (days and pharmacies); the share is a fraction. */
  whole: boolean
  /** The field's spinner step. */
  step: number
}

/** BackOffice 4055's ranges, in the order the page lists them. */
export const SETTING_RANGES: Readonly<Record<SettingName, SettingRange>> = Object.freeze({
  WindowDays: { min: 1, max: 30, whole: true, step: 1 },
  MinStores: { min: 2, max: 10, whole: true, step: 1 },
  MaxKmPerHour: { min: 30, max: 500, whole: true, step: 1 },
  MinTravelKm: { min: 1, max: 500, whole: true, step: 1 },
  OverlapShare: { min: 0.05, max: 0.9, whole: false, step: 0.01 },
  CaseQuietDays: { min: 7, max: 90, whole: true, step: 1 },
  LookbackDays: { min: 30, max: 365, whole: true, step: 1 },
})

/** The table's names, in its order. */
export const SETTING_NAMES = Object.keys(SETTING_RANGES) as SettingName[]

/** Why a typed value cannot be sent. */
export type SettingProblem = 'missing' | 'notNumber' | 'notWhole' | 'outOfRange'

/** The problem with a value as typed into a threshold's field, or null when it can be sent. */
export function settingProblem(name: SettingName, draft: string): SettingProblem | null {
  const range = SETTING_RANGES[name]
  const typed = draft.trim()
  if (typed === '') return 'missing'
  const value = Number(typed)
  if (!Number.isFinite(value)) return 'notNumber'
  if (range.whole && !Number.isInteger(value)) return 'notWhole'
  if (value < range.min || value > range.max) return 'outOfRange'
  return null
}

/** Each threshold's field as typed: a string, so a half-typed value is kept as the reviewer left it. */
export type SettingDrafts = Record<SettingName, string>

const savedValue = (saved: readonly PatternSetting[], name: SettingName): number | null => saved.find((s) => s.name === name)?.value ?? null

/** The fields as they open: each saved value, or blank when the server sent none. A name the table lacks gets no field. */
export function draftsOf(saved: readonly PatternSetting[]): SettingDrafts {
  return Object.fromEntries(SETTING_NAMES.map((name) => [name, String(savedValue(saved, name) ?? '')])) as SettingDrafts
}

/** The thresholds whose field no longer reads the saved number, in the table's order. */
export function changedSettings(drafts: SettingDrafts, saved: readonly PatternSetting[]): SettingName[] {
  return SETTING_NAMES.filter((name) => {
    const typed = drafts[name].trim()
    const was = savedValue(saved, name)
    return was === null ? typed !== '' : typed === '' || Number(typed) !== was
  })
}

/**
 * The `PUT` body: the changed thresholds as numbers. Null — so nothing is sent — when nothing changed, or when ANY field
 * has a problem: one value out of range holds the whole save.
 */
export function settingsBody(drafts: SettingDrafts, saved: readonly PatternSetting[]): PatternSettingsBody | null {
  if (SETTING_NAMES.some((name) => settingProblem(name, drafts[name]) !== null)) return null
  const changed = changedSettings(drafts, saved)
  if (changed.length === 0) return null
  return { settings: changed.map((name) => ({ name, value: Number(drafts[name].trim()) })) }
}
