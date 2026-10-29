import type { HungerStationPromotionDetail, HungerStationPromotionReplaceBody } from '@/core/models/hungerstation'
import { windowFromLocal, windowProblem, windowToLocal, type LocalWindow } from './local-window'
import { editMode, lifecycleClosed } from './promotion-edit'

/**
 * **Replace** (ticket 671, BackOffice 3216): HungerStation keys a promotion by its name, stores and
 * window, so a change to any of them is a NEW promotion — the server switches the old one off
 * first and sends the new one only if every switch-off was accepted. This is the dialog's form,
 * the body it becomes (only what changed: a `null` keeps the old value), when the change needs a
 * replace at all, and when Replace and Switch off are offered. Pure: no React, no `t`.
 */

export interface ReplaceForm {
  name: string
  window: LocalWindow
  /** The store codes ticked. Always explicit: the old stores are frozen, and so are the new. */
  stores: string[]
}

type Sent = Pick<HungerStationPromotionDetail, 'name' | 'startAt' | 'endAt' | 'stores'>

/** The form as sent: the name, the window, the stores frozen at send. */
export function replaceFormFromDetail(d: Sent): ReplaceForm {
  return { name: d.name, window: windowFromLocal(d.startAt, d.endAt), stores: (d.stores ?? []).map((s) => s.storeCode) }
}

const minute = (at: string | null) => (at ?? '').slice(0, 16)
const sameSet = (a: readonly string[], b: readonly string[]) => {
  const x = new Set(a)
  const y = new Set(b)
  return x.size === y.size && [...x].every((v) => y.has(v))
}

function changes(sent: Sent, form: ReplaceForm) {
  const { startAt, endAt } = windowToLocal(form.window)
  return {
    name: form.name.trim() !== sent.name,
    startAt: minute(startAt) !== minute(sent.startAt),
    endAt: minute(endAt) !== minute(sent.endAt),
    stores: !sameSet(form.stores, (sent.stores ?? []).map((s) => s.storeCode)),
  }
}

/** True exactly when the name, the stores, the start or the end differ from what was sent. */
export function replaceNeeded(sent: Sent, form: ReplaceForm): boolean {
  return Object.values(changes(sent, form)).some(Boolean)
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

/** `POST …/Replace`: only what changed, a `null` for the rest (the old value, the stores as
 *  frozen). Call only on a form with no problems that `replaceNeeded`. */
export function replaceBody(sent: Sent, form: ReplaceForm, reason: string): HungerStationPromotionReplaceBody {
  const c = changes(sent, form)
  const { startAt, endAt } = windowToLocal(form.window)
  return {
    name: c.name ? form.name.trim() : null,
    startAt: c.startAt ? startAt : null,
    endAt: c.endAt ? endAt : null,
    allStores: null,
    storeCodes: c.stores ? form.stores : null,
    reason: reason.trim(),
  }
}

type Acting = Parameters<typeof editMode>[0]

/**
 * Replace and Switch off (contract 3216):
 * - both on a sent promotion that still runs (never a draft, nor once ended); disabled — `sending`
 *   — while it or any part reads Sending (DHS-00017 stays the guard);
 * - once switched off or replaced, neither — EXCEPT Switch off on one that reads Failed: a
 *   switch-off job failed, the part is still on HungerStation, and SwitchOff retries exactly it.
 */
export function promotionActions(d: Acting): { replace: boolean; switchOff: boolean; sending: boolean } {
  const mode = editMode(d)
  const running = mode === 'inPlace' || mode === 'sending'
  if (lifecycleClosed(d)) return { replace: false, switchOff: d.status === 'failed', sending: false }
  return { replace: running, switchOff: running, sending: mode === 'sending' }
}
