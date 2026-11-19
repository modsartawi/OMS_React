/**
 * The insurance manager's pattern doors (oms 924; BackOffice 4055 — settings and the reveal log — and 4056 — the block;
 * NOT BUILT: every path and shape here is GUESSED, see `@/core/models/insurance-pattern-manager`). Every call goes
 * through `@/core/api` (`.claude/rules/api-envelope.md`): the cookie session, the `X-Web-Client` header, 401 and the
 * error taxonomy are that module's. 🔑 No call sends an actor — the server reads it off the session.
 *
 * Beside 922's `./api` in a file of its own, so spec 4050's parallel slices never edit one file; its reads sit under the
 * same `PATTERNS_KEY` prefix. Every answer is read field by field (`./manager-wire`).
 */
import { api } from '@/core/api'
import type { PatternRevealsPage, PatternRevealsQuery, PatternSetting, PatternSettings } from '@/core/models/insurance-pattern-manager'
import { localToday, type LocalDate } from '@/core/util/date-window'
import { PATTERNS_KEY } from './api'
import { blockBody, type BlockForm } from './block'
import { readRevealsPage, readSettings } from './manager-wire'
import { settingsBody, type SettingDrafts } from './settings'

const SETTINGS = 'Insurance/Patterns/Settings'
const REVEALS = 'Insurance/Patterns/Reveals'
const CASES = 'Insurance/Patterns/Cases'
const seg = (v: string) => encodeURIComponent(v.trim())

export const settingsKey = [...PATTERNS_KEY, 'settings'] as const
/** Every read of the reveal log sits under this prefix (a block writes a row: it is read again). */
export const REVEALS_KEY = [...PATTERNS_KEY, 'reveals'] as const
export const revealsKey = (query: PatternRevealsQuery) => [...REVEALS_KEY, query] as const

/** Thrown before any request when a save would not be sent: a value out of range or not a number, or nothing changed. */
export class SettingsNotSentError extends Error {
  constructor() {
    super('settings not sent')
    this.name = 'SettingsNotSentError'
  }
}

/** Thrown before any request when a block's form would not be sent: no kind of finding, or its dates do not hold. */
export class BlockNotSentError extends Error {
  constructor() {
    super('block not sent')
    this.name = 'BlockNotSentError'
  }
}

export const managerApi = {
  /** `GET Insurance/Patterns/Settings` — the seven thresholds and their change log. */
  async settings(): Promise<PatternSettings> {
    return readSettings(await api.get<unknown>(SETTINGS))
  },

  /**
   * `PUT Insurance/Patterns/Settings` with the thresholds that changed — answered like the GET. A value the ranges table
   * refuses is never sent: the whole save is held before the call.
   */
  async saveSettings(drafts: SettingDrafts, saved: readonly PatternSetting[]): Promise<PatternSettings> {
    const body = settingsBody(drafts, saved)
    if (!body) throw new SettingsNotSentError()
    return readSettings(await api.put<unknown>(SETTINGS, body))
  },

  /** `GET Insurance/Patterns/Reveals` — a page of who revealed which case, when and why, newest first. Never whom. */
  async reveals(query: PatternRevealsQuery): Promise<PatternRevealsPage> {
    return readRevealsPage(await api.get<unknown>(REVEALS, { ...query }))
  },

  /**
   * `POST Insurance/Patterns/Cases/{caseId}/Block` — adds the confirmed case's patient to the blocked-patient list.
   * 🔒 Resolves to NOTHING: whatever the server answers (the list entry it made carries the patient key) is dropped
   * here, so no identity reaches a mutation's data, the cache, the screen or a toast.
   */
  async block(caseId: string, form: BlockForm, today: LocalDate = localToday()): Promise<void> {
    const body = blockBody(form, today)
    if (!body) throw new BlockNotSentError()
    await api.post<unknown>(`${CASES}/${seg(caseId)}/Block`, body)
  },
}
