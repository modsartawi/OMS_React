/**
 * The pattern thresholds (oms 924; BackOffice 4055 `GET`/`PUT InsuranceRules/Patterns/Settings`): the ONE ranges table the
 * settings page validates against, and the body a save sends. Pure: the page reads its problems from here, and the call
 * sends only a body this module made.
 *
 * The ranges are BackOffice 4055's and live HERE only — not read from the `min`/`max` the server sends beside each value
 * — so a value out of range is refused on the page and never reaches the door. (The server allows up to 4 decimals;
 * the share's field steps in hundredths.)
 *
 * Reconciled with 4055 as built: a save sends only the thresholds that changed, FLAT under their camelCased keys
 * (`{ windowDays: 10, overlapShare: 0.3 }`; the server keeps the others and logs each change), and the days and
 * pharmacies are whole numbers.
 */
import type { PatternSetting, PatternSettings, PatternSettingsBody } from '@/core/models/insurance-pattern-manager'

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

/** A threshold's key in the `PUT` body: its name camelCased (`WindowDays` → `windowDays`). */
export const wireKey = (name: SettingName) => (name.charAt(0).toLowerCase() + name.slice(1)) as keyof PatternSettingsBody

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
 * The `PUT` body: the changed thresholds as numbers, flat under their camelCased keys. Null — so nothing is sent — when
 * nothing changed, or when ANY field has a problem: one value out of range holds the whole save.
 */
export function settingsBody(drafts: SettingDrafts, saved: readonly PatternSetting[]): PatternSettingsBody | null {
  if (SETTING_NAMES.some((name) => settingProblem(name, drafts[name]) !== null)) return null
  const changed = changedSettings(drafts, saved)
  if (changed.length === 0) return null
  return Object.fromEntries(changed.map((name) => [wireKey(name), Number(drafts[name].trim())])) as PatternSettingsBody
}

/** The answer names every threshold of the table with a number, as the GET answers. */
const namesEveryThreshold = (answer: PatternSettings) =>
  SETTING_NAMES.every((name) => typeof answer.settings.find((s) => s.name === name)?.value === 'number')

/**
 * What the page holds after a save (review 6). The PUT answers like the GET (4055), and its answer stands when
 * it names every threshold. A server that answers less never blanks a field: the thresholds held before, with the
 * values just sent (the save held), and the change log as it was. Either way the page reads the settings again.
 */
export function settingsAfterSave(held: PatternSettings, sent: PatternSettingsBody, answer: PatternSettings): PatternSettings {
  if (namesEveryThreshold(answer)) return answer
  const sentValue = new Map<string, number>()
  for (const name of SETTING_NAMES) {
    const value = sent[wireKey(name)]
    if (typeof value === 'number') sentValue.set(name, value)
  }
  const settings = held.settings.map((s) => (sentValue.has(s.name) ? { ...s, value: sentValue.get(s.name)! } : s))
  for (const [name, value] of sentValue) if (!held.settings.some((h) => h.name === name)) settings.push({ name, value })
  return { settings, changes: held.changes }
}

/**
 * The fields the manager typed in, after a save (review 8): a field that still holds what was sent goes back to reading
 * the saved value; a field typed while the save was in flight keeps what was typed.
 */
export function editsAfterSave(edits: Partial<SettingDrafts>, sent: SettingDrafts): Partial<SettingDrafts> {
  return Object.fromEntries(Object.entries(edits).filter(([name, typed]) => typed !== sent[name as SettingName])) as Partial<SettingDrafts>
}
