/**
 * The Lists screen's own doors (BackOffice spec 3126; doors 3132 + 3133, oms ticket 610). The item lists live
 * IN the guard ruleset (they are versioned with it), so saving one is a PUT of the whole draft; the patient and
 * policy lists are their own doors, edited without approval, every change logged. The reads two features need
 * (the Fields, the patient / policy lists) are `@/core/insurance-rules/registry-api`.
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 610): no door here has met a real SIS.Api.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE } from '@/core/insurance-rules/api'
import type { GuardList, GuardRuleset } from '@/core/insurance-rules/model'
import type { KeyedListEntry, KeyedListKind, KeyedListLogRow } from '@/core/insurance-rules/registry'
import { keyedListsKey, keyedListsPath } from '@/core/insurance-rules/registry-api'
import type { EntryBody } from './entry-form'

/** One matched item of a preview. ⚠️ PROVISIONAL spelling (`article`, `name`). */
export interface PreviewItem {
  article: string
  name: string
}

/**
 * `POST InsuranceRules/Lists/Preview` → "matched items (count plus the first page) and the matches-nothing warning".
 * ⚠️ PROVISIONAL spelling (`count`, `items`, `matchesNothing`).
 */
export interface ListPreview {
  count: number
  items: PreviewItem[]
  matchesNothing: boolean
}

export const listsApi = {
  /**
   * `PUT InsuranceRules/Guards/Draft` — the WHOLE ruleset with the revision it was read at → the saved document
   * (its new revision). A stale revision is a 409. (608's editor saves through the same door.)
   */
  saveDraft(ruleset: GuardRuleset): Promise<GuardRuleset> {
    return api.put<GuardRuleset>(`${INSURANCE_RULES_BASE}/Guards/Draft`, ruleset)
  },
  /**
   * `POST InsuranceRules/Lists/Preview` — ⚠️ PROVISIONAL body `{ list, lists }`: the definition being edited and
   * the draft's other lists, so the lists it includes or excludes resolve before the save.
   */
  preview(list: GuardList, lists: GuardList[]): Promise<ListPreview> {
    return api.post<ListPreview>(`${INSURANCE_RULES_BASE}/Lists/Preview`, { list, lists })
  },
  /** `GET InsuranceRules/{Patient|Policy}Lists/{id}/Entries`. */
  async entries(kind: KeyedListKind, id: string): Promise<KeyedListEntry[]> {
    return (await api.get<KeyedListEntry[] | null>(`${keyedListsPath(kind)}/${encodeURIComponent(id)}/Entries`)) ?? []
  },
  /** `POST InsuranceRules/{Patient|Policy}Lists/{id}/Entries` `{ key, reason, expiresOn? }` → the entry. */
  addEntry(kind: KeyedListKind, id: string, body: EntryBody): Promise<KeyedListEntry> {
    return api.post<KeyedListEntry>(`${keyedListsPath(kind)}/${encodeURIComponent(id)}/Entries`, body)
  },
  /** `DELETE InsuranceRules/{Patient|Policy}Lists/{id}/Entries?key=` — ⚠️ PROVISIONAL: the key as a query param. */
  removeEntry(kind: KeyedListKind, id: string, key: string): Promise<unknown> {
    return api.del<unknown>(`${keyedListsPath(kind)}/${encodeURIComponent(id)}/Entries`, { key })
  },
  /** `GET InsuranceRules/{Patient|Policy}Lists/{id}/Log` — every change, newest first. */
  async log(kind: KeyedListKind, id: string): Promise<KeyedListLogRow[]> {
    return (await api.get<KeyedListLogRow[] | null>(`${keyedListsPath(kind)}/${encodeURIComponent(id)}/Log`)) ?? []
  },
}

export const keyedListKey = (kind: KeyedListKind, id: string) => [...keyedListsKey(kind), id] as const

export function entriesQuery(kind: KeyedListKind, id: string) {
  return { queryKey: [...keyedListKey(kind, id), 'entries'], queryFn: () => listsApi.entries(kind, id), retry: false } as const
}

export function logQuery(kind: KeyedListKind, id: string) {
  return { queryKey: [...keyedListKey(kind, id), 'log'], queryFn: () => listsApi.log(kind, id), retry: false } as const
}
