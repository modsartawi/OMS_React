// The Fields registry and the patient / policy / class lists (BackOffice spec 3126, doors 3132 + 3133 + 3172; oms 610).
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

/**
 * A patient list (keyed by National ID / Iqama), a policy list (keyed by SubscriberId) or a class list (keyed by
 * policy class code, each entry for one insurer or any — BackOffice 3172).
 */
export const KEYED_LIST_KINDS = ['patient', 'policy', 'class'] as const
export type KeyedListKind = (typeof KEYED_LIST_KINDS)[number]

/** `GET InsuranceRules/{Patient|Policy|Class}Lists` (3133 / 3172) — one list. */
export interface KeyedList {
  id: string
  name: Says
  /** How many entries it holds now. */
  entries: number
  createdBy: string
  /** Local moment. */
  createdAt: string
}

/** `GET …/{Patient|Policy|Class}Lists/{id}/Entries` — one entry (3133 / 3172). */
export interface KeyedListEntry {
  key: string
  addedBy: string
  /** Local moment. */
  addedAt: string
  reason: string
  /** The last local day it counts (inclusive); null = no expiry. */
  expiresOn: string | null
  /** Listed still, but no longer matches. */
  expired: boolean
  /** A class list's insurer (SAP customer id); null = any insurer, and always null on patient / policy lists. */
  payer?: string | null
}

/** `GET …/{Patient|Policy|Class}Lists/{id}/Log` — one change, newest first (3133 / 3172). */
export interface KeyedListLogRow {
  /** Local moment. */
  at: string
  by: string
  action: 'createList' | 'add' | 'change' | 'remove'
  key: string | null
  reason: string | null
  expiresOn: string | null
  payer?: string | null
}
