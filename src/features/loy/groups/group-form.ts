/**
 * The create and rename forms' pure half (oms ticket 630, BackOffice spec 3173). No React, no `t`:
 * a check answers a `loy-groups` key, the caller translates it.
 */
import type { LoyGroupRenameRequest } from '@/core/models/loy-groups'

/** What the server takes for a code (brief: `[A-Z0-9_-]{1,20}`). The server stays the authority. */
export const GROUP_CODE_MAX = 20
const CODE_ALPHABET = /^[A-Z0-9_-]+$/

/** The code as the user should see it while typing: upper-cased, nothing else (no trim, no folding). */
export function normaliseGroupCode(raw: string): string {
  return raw.toUpperCase()
}

export type GroupCodeProblem = 'create.code.required' | 'create.code.tooLong' | 'create.code.badChar'

/** `null` when the (already normalised) code fits the pattern, else the reason's key. */
export function checkGroupCode(code: string): GroupCodeProblem | null {
  if (code.length === 0) return 'create.code.required'
  if (!CODE_ALPHABET.test(code)) return 'create.code.badChar'
  if (code.length > GROUP_CODE_MAX) return 'create.code.tooLong'
  return null
}

/** The editable half of a group: what both forms hold. */
export interface GroupNamesForm {
  nameEn: string
  nameAr: string
}

/**
 * The Rename body from the page's form — `{ groupId, nameEn, nameAr }` and nothing else, so no code
 * can ever ride along. Both names exactly as typed: the Arabic name is stored as typed (brief).
 */
export function renameRequest(groupId: string, form: GroupNamesForm): LoyGroupRenameRequest {
  return { groupId, nameEn: form.nameEn, nameAr: form.nameAr }
}
