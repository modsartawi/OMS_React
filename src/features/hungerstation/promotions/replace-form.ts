import type { HungerStationPromotionDetail, HungerStationPromotionReplaceBody, HungerStationPromotionReplaceRefusal } from '@/core/models/hungerstation'
import { windowFromLocal, windowProblem, windowToLocal, type LocalWindow } from './local-window'
import { editMode } from './promotion-edit'

/**
 * **Replace** (ticket 671, BackOffice 3216): HungerStation keys a promotion by its name, stores and
 * window, so a change to any of them is a NEW promotion — the server switches the old one off
 * first and sends the new one only if every switch-off was accepted. This is the dialog's form,
 * the body it becomes, when the change needs a replace at all, and when Replace and Switch off are
 * offered. Pure: no React, no `t`.
 */

export interface ReplaceForm {
  name: string
  window: LocalWindow
  /** The store codes ticked. Always explicit: a replace freezes its stores when it is sent. */
  stores: string[]
}

type Sent = Pick<HungerStationPromotionDetail, 'name' | 'startAt' | 'endAt' | 'stores'>

/** The form as sent: the name, the window, the stores frozen at send. */
export function replaceFormFromDetail(d: Sent): ReplaceForm {
  return { name: d.name, window: windowFromLocal(d.startAt, d.endAt), stores: (d.stores ?? []).map((s) => s.storeCode) }
}

const minute = (at: string) => at.slice(0, 16)
const sameSet = (a: readonly string[], b: readonly string[]) => {
  const x = new Set(a)
  const y = new Set(b)
  return x.size === y.size && [...x].every((v) => y.has(v))
}

/** True exactly when the name, the stores, the start or the end differ from what was sent. */
export function replaceNeeded(sent: Sent, form: ReplaceForm): boolean {
  const { startAt, endAt } = windowToLocal(form.window)
  return (
    form.name.trim() !== sent.name ||
    minute(startAt) !== minute(sent.startAt) ||
    minute(endAt) !== minute(sent.endAt) ||
    !sameSet(form.stores, (sent.stores ?? []).map((s) => s.storeCode))
  )
}

export type ReplaceField = 'name' | 'window' | 'stores'

/** What keeps the form from replacing, in form order. The name in use is the server's. */
export function replaceProblems(form: ReplaceForm, now: Date): ReplaceField[] {
  const out: ReplaceField[] = []
  if (!form.name.trim()) out.push('name')
  if (windowProblem(form.window, now)) out.push('window')
  if (form.stores.length === 0) out.push('stores')
  return out
}

/** `POST …/Replace`: call only on a form with no problems. */
export function replaceBody(form: ReplaceForm, reason: string): HungerStationPromotionReplaceBody {
  return { name: form.name.trim(), ...windowToLocal(form.window), allStores: false, storeCodes: form.stores, reason: reason.trim() }
}

/**
 * Replace and Switch off: `offered` on a sent promotion that still runs (never a draft, nor once
 * switched off, replaced or ended); `sending` — so disabled — while ANY part is Sending (spec 3201
 * § Doors refuses every write then; the server's DHS-00017 stays the guard). The same lock as 670's
 * in-place edit: it reads `editMode`.
 */
export function promotionActions(d: Pick<HungerStationPromotionDetail, 'status' | 'parts'>): { offered: boolean; sending: boolean } {
  const mode = editMode(d)
  return { offered: mode === 'inPlace' || mode === 'sending', sending: mode === 'sending' }
}

/** The part a DHS-00020 refusal names, read defensively from the envelope's `data`; `null` when it
 *  names none (the server's message still shows). */
export function replaceRefusalOf(data: unknown): (Omit<HungerStationPromotionReplaceRefusal, 'name'> & { name: string | null }) | null {
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  if (typeof d.partId !== 'string' || !d.partId) return null
  return {
    partId: d.partId,
    name: typeof d.name === 'string' ? d.name : null,
    httpStatus: typeof d.httpStatus === 'number' ? d.httpStatus : null,
    error: typeof d.error === 'string' ? d.error : null,
  }
}
