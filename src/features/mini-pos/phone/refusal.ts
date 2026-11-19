import { apiErrorCode, apiErrorData, apiErrorKind, apiErrorMessage } from '@/core/api'

/**
 * A refusal as the phone shows it (spec 4063: "each refusal carries its own error code and an Arabic and English
 * message"). The Mini POS door's own refusals carry both: English on `message`, Arabic on `data.messageAr`
 * (`MiniPosEndpointHelpers.Refusal`). The session verbs' refusals (an unknown item, `NO_CUSTOMER_ATTACHED`, a busy
 * session) carry English only, and are shown as they came. The words are the server's; nothing is re-worded here.
 */
export interface ShownRefusal {
  code: string | null
  english: string
  arabic: string | null
}

export function readRefusal(err: unknown, fallback: string): ShownRefusal {
  const data = apiErrorData(err)
  const ar = data && typeof data === 'object' ? (data as { messageAr?: unknown }).messageAr : null
  const en = data && typeof data === 'object' ? (data as { messageEn?: unknown }).messageEn : null
  return {
    code: apiErrorCode(err),
    english: typeof en === 'string' && en ? en : apiErrorMessage(err, fallback),
    arabic: typeof ar === 'string' && ar ? ar : null,
  }
}

/** Where a refusal of the door sends the phone. `null`: stay where you are and show it. */
export type DoorScreen = 'signIn' | 'notAssigned' | 'blocked' | 'unlock'

/**
 * The door's steps, in the order `MiniPosEndpointFilter` runs them: the mobile session, the promoter grant, Mini POS
 * enabled, today's assignment, then presence. The phone does not decide any of them; it goes where the answer says.
 */
export function doorScreenFor(err: unknown): DoorScreen | null {
  if (apiErrorKind(err) === 'auth') return 'signIn'
  switch (apiErrorCode(err)) {
    case 'MINIPOS_NOT_SIGNED_IN':
      return 'signIn'
    case 'MINIPOS_NOT_ASSIGNED_TODAY':
      return 'notAssigned'
    case 'MINIPOS_NOT_PROMOTER':
    case 'MINIPOS_DISABLED':
    case 'MINIPOS_LOGIN_TOO_LONG':
      return 'blocked'
    case 'MINIPOS_NOT_UNLOCKED':
      return 'unlock'
    default:
      return null
  }
}
