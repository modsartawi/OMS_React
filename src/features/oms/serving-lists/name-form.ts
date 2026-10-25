/**
 * The create / rename name form (oms ticket 570, BackOffice spec 3042). The door trims both names and refuses a
 * blank one (`SVL-00005`) or one over 100 characters (`SVL-00006`); this checks the same before sending, so a
 * refusal is the stale-screen case, not the normal one. Pure: no React, no `t` — the dialog words each problem.
 */
import type { ServingListCreateRequest } from '@/core/models/serving-list'

/** `ServingList.Widths.NameEn / NameAr` — on the trimmed name, in UTF-16 units (`.length`, as .NET counts). */
export const NAME_MAX = 100
/** The door clamps every write's note to this. */
export const NOTE_MAX = 500

export interface NameForm {
  nameEn: string
  nameAr: string
  note: string
}

export type NameProblem = 'required' | 'tooLong'

export interface NameCheck {
  en: NameProblem | null
  ar: NameProblem | null
  /** A rename whose trimmed names equal the list's (the door would answer 200 and log nothing). */
  unchanged: boolean
  /** May be sent. */
  ready: boolean
}

function problem(name: string): NameProblem | null {
  const v = name.trim()
  return v === '' ? 'required' : v.length > NAME_MAX ? 'tooLong' : null
}

/** Check the form as the door will; `current` is the list's names on a rename, absent on a create. */
export function nameCheck(form: NameForm, current?: { nameEn: string; nameAr: string }): NameCheck {
  const en = problem(form.nameEn)
  const ar = problem(form.nameAr)
  const unchanged = current !== undefined && form.nameEn.trim() === current.nameEn.trim() && form.nameAr.trim() === current.nameAr.trim()
  return { en, ar, unchanged, ready: en === null && ar === null && !unchanged }
}

/** The body create and rename send: names trimmed, the note trimmed and left out when blank. */
export function nameBody(form: NameForm): ServingListCreateRequest {
  const body: ServingListCreateRequest = { nameEn: form.nameEn.trim(), nameAr: form.nameAr.trim() }
  const note = form.note.trim()
  if (note) body.note = note
  return body
}

/** A note-only write's body (`{ note? }`): trimmed, left out when blank. */
export function noteBody(note: string): { note?: string } {
  const v = note.trim()
  return v ? { note: v } : {}
}
