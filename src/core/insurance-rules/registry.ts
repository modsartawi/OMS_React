// The Fields registry and the patient / policy lists (BackOffice spec 3126, doors 3132 + 3133; oms ticket 610).
// In core because more than one feature reads them: 610's Lists and Fields pages, the guard editor's palette
// (608: a `patient` / `policy` condition picks a list by id) and 617, whose eligibility facts are Fields of
// scope `eligibility`. Shapes are the brief's ("HQ contract: lists, fields, patient and policy lists"); a field
// the brief does not spell is marked ⚠️ PROVISIONAL and is 618's to reconcile.

import type { Says } from './model'

export const FIELD_SCOPES = ['item', 'request', 'patient', 'eligibility'] as const
export type FieldScope = (typeof FIELD_SCOPES)[number]

/** ⚠️ PROVISIONAL values: the brief names a `type` and a `unit`, not their vocabulary. */
export const FIELD_TYPES = ['code', 'text', 'number', 'date', 'bool'] as const
export type FieldType = (typeof FIELD_TYPES)[number]

/** A fact a rule can test, named by `key` (rename-safe). Retired, never deleted. `GET InsuranceRules/Fields`. */
export interface RegistryField {
  key: string
  label: Says
  scope: FieldScope
  type: FieldType
  /** `days`, `SAR`, `years`… — null when the value has none. */
  unit: string | null
  /** Where HQ reads it: `ItemInfo.ECode / EDesc`, `Nphies eligibility answer`, … */
  source: string
  retired: boolean
}

/** `POST InsuranceRules/Fields` body. */
export type NewRegistryField = Omit<RegistryField, 'retired'>

/**
 * A value of a code field for the picker: `GET InsuranceRules/Fields/{key}/Values?q=`.
 * ⚠️ PROVISIONAL spelling (`code`, `description`) — the brief says "code + description values".
 */
export interface FieldValue {
  code: string
  description: string
}

/** The live fields of a scope (or of every scope), in registry order. */
export const liveFields = (fields: readonly RegistryField[], scope?: FieldScope): RegistryField[] =>
  fields.filter((f) => !f.retired && (scope === undefined || f.scope === scope))

/** A patient list (keyed by National ID / Iqama) or a policy list (keyed by SubscriberId). */
export type KeyedListKind = 'patient' | 'policy'

/**
 * One patient or policy list. ⚠️ PROVISIONAL door and shape: the brief spells only the lists' Entries and Log
 * doors; `GET InsuranceRules/PatientLists` / `PolicyLists` → `[{ id, name, entries }]` is 610's guess.
 */
export interface KeyedList {
  id: string
  name: Says
  /** How many entries it holds now. */
  entries: number
}

/** `GET …/{Patient|Policy}Lists/{id}/Entries` — one entry. */
export interface KeyedListEntry {
  key: string
  addedBy: string
  reason: string
  /** Local day; absent or null = no expiry. */
  expiresOn?: string | null
}

/** `GET …/{Patient|Policy}Lists/{id}/Log` — one change. ⚠️ PROVISIONAL shape (the brief says "the change log"). */
export interface KeyedListLogRow {
  /** Local moment. */
  at: string
  by: string
  action: 'added' | 'removed' | 'expired'
  key: string
  reason?: string | null
  expiresOn?: string | null
}
