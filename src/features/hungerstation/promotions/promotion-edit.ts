import type { HungerStationPromotionDetail } from '@/core/models/hungerstation'
import { partSending } from './part-refusals'
import type { PromotionForm } from './promotion-form'

/**
 * Editing a SENT promotion in place (ticket 670, BackOffice 3215) — pure.
 *
 * A sent promotion keeps its HungerStation identity: its **name, type, stores, start and end**.
 * Changing the name, stores or window is not an edit but a **Replace** (671): the server refuses it
 * here (DHS-00021). So the editor locks those fields and points to Replace. The chain and the type
 * are fixed outright (neither is in Replace's body). Everything else — items, values, max
 * quantities, limits, display names, the HungerStation reason, the defaults — is edited and re-sent
 * with a reason.
 *
 * Every write waits while the promotion reads Sending, or any part does (DHS-00017).
 */

/** The form fields a lock can name: the form's own keys (the window is start + end together). */
export type EditField = keyof PromotionForm

/** Fields whose change makes a Replace. */
const IDENTITY: readonly EditField[] = ['name', 'stores', 'window']
/** Fields fixed once sent: no edit and no Replace changes them. */
const FIXED: readonly EditField[] = ['chainKey', 'type']

/** Why a field cannot be edited here: `replace` (it is the identity — change it with Replace),
 *  `fixed` (it never changes once sent), or `null` (editable). A draft locks nothing. */
export function lockOf(status: string, field: EditField): 'replace' | 'fixed' | null {
  if (status === 'draft') return null
  if (IDENTITY.includes(field)) return 'replace'
  if (FIXED.includes(field)) return 'fixed'
  return null
}

/** The name, stores, start or end of a sent promotion: changing it replaces the promotion. */
export const identityLocked = (status: string, field: EditField): boolean => lockOf(status, field) === 'replace'

type Lifecycle = Pick<HungerStationPromotionDetail, 'switchedOffAt' | 'replacedByPromotionId'>

/** Switched off or replaced — by its stamps, whatever it reads now (a switch-off job that failed
 *  makes it read Failed: it is still on HungerStation, and only SwitchOff may touch it). */
export const lifecycleClosed = (d: Lifecycle): boolean => d.switchedOffAt != null || d.replacedByPromotionId != null

/**
 * What the editor may do with a promotion:
 * - `draft` — every field, Save draft and Send (666);
 * - `inPlace` — sent and still running: edit and re-send in place (670);
 * - `sending` — it, or a part, waits for HungerStation's answer: nothing is written;
 * - `closed` — switched off, replaced, ended, or a status the contract does not name: read only.
 *
 * A part unanswered for 24 hours reads Failed (contract 3214): it is not Sending.
 */
export type EditMode = 'draft' | 'inPlace' | 'sending' | 'closed'

const IN_PLACE = ['live', 'livePartlyRefused', 'failed', 'scheduled']

export function editMode(p: Pick<HungerStationPromotionDetail, 'status'> & Lifecycle & { parts: readonly { status: string | null }[] | null }): EditMode {
  if (p.status === 'draft') return 'draft'
  if (p.status === 'sending' || (p.parts ?? []).some(partSending)) return 'sending'
  if (lifecycleClosed(p)) return 'closed'
  return IN_PLACE.includes(p.status) ? 'inPlace' : 'closed'
}
