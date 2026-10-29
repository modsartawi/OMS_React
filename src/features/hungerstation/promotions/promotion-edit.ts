import type { HungerStationPromotionEditCheckBody, HungerStationPromotionPart } from '@/core/models/hungerstation'
import { partSending } from './part-refusals'
import { saveBody, type PromotionForm } from './promotion-form'

/**
 * Editing a SENT promotion in place (ticket 670, BackOffice 3215) — pure.
 *
 * A sent promotion keeps its HungerStation identity: its **name, stores, start and end**. Changing
 * any of them is not an edit but a **Replace** (671): HungerStation sees a new promotion. So the
 * editor locks those fields and points to Replace. The chain and the type are fixed outright (🚩 an
 * assumption: neither is in-place per spec 3201 nor in Replace's body). Everything else — items,
 * values, max quantities, limits, display names, the HungerStation reason, the defaults — is edited
 * and re-sent with a reason.
 *
 * Every write waits while ANY part is Sending (spec 3201 § Changing a sent promotion: "Any write is
 * refused while a part of the promotion is Sending"). 669's Resend locks per part; this is wider.
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

/**
 * What the editor may do with a promotion:
 * - `draft` — every field, Save draft and Send (666);
 * - `inPlace` — sent and still running: edit and re-send in place (670);
 * - `sending` — a part waits for HungerStation's answer: nothing is written;
 * - `closed` — switched off, replaced, ended, or a status the contract does not name: read only.
 *
 * A part queued past 24 hours (`unanswered`) is no longer Sending: the server has stopped polling it.
 */
export type EditMode = 'draft' | 'inPlace' | 'sending' | 'closed'

const IN_PLACE = ['live', 'livePartlyRefused', 'failed', 'scheduled']

export function editMode(p: { status: string; parts: readonly Pick<HungerStationPromotionPart, 'latestJobStatus' | 'unanswered'>[] | null }): EditMode {
  if (p.status === 'draft') return 'draft'
  if (p.status === 'sending' || (p.parts ?? []).some(partSending)) return 'sending'
  return IN_PLACE.includes(p.status) ? 'inPlace' : 'closed'
}

/** The edit as Check previews it: the save body it would send, with no reason (nothing is written). */
export function editCheckBody(f: PromotionForm): HungerStationPromotionEditCheckBody {
  const { reason: _reason, ...body } = saveBody(f, '')
  return body
}
