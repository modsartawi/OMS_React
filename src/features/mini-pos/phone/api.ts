import { api } from '@/core/api'
import type { AbandonResult, OpenResult, SessionState, SubmitResult } from '@/core/models/callcenter'
import { newRequestId } from '@/core/engine-session/request-id'
import { phoneHeaders } from './phone-session'

/**
 * The Mini POS phone's server calls (spec 4063, ticket 916): the Ua two-step login on the `mobile` channel, then the
 * `MiniPos/*` door (BackOffice 4065, 4067, 4069). Every call carries the channel key and the mobile bearer; no body
 * carries a store, a promoter, a seat or an amount, because the server decides them all (3706 P15).
 *
 * The session verbs are the call-center web session's under the Mini POS seat, so they answer the same projection
 * (`SessionState`, `OpenResult`, `SubmitResult`; contract `.issues/assets/136-cc-contract/CONTRACT.md`).
 */

/** The channel the session is minted on. The collector filter refuses a token of any other. */
export const MOBILE_CHANNEL = 'mobile'

/** `UaAuth/Login` (and `VerifyTotp`) — success or not arrives in the body, never as a throw. */
export interface UaMobileLoginResult {
  success: boolean
  errorCode: string | null
  message: string | null
  challengeId?: string | null
  requiresTotp?: boolean
  mustChangePassword?: boolean
  token: string | null
  expiresAt: string | null
  displayName: string | null
  userId: string | null
}

/** `MiniPos/Unlock` — the presence row written for this sign-in. */
export interface MiniPosUnlocked {
  storeCode: string
  codeKind: 'T' | 'P' | string
  unlockedAt: string
}

/** How the code on an add reached the phone (the scan event, BackOffice 4073). */
export type EntryMode = 'camera' | 'typed' | 'wedge'

export interface AddItemInput {
  transactionId: string
  /** One user action's id, reused verbatim when a below-availability add is confirmed. */
  requestId: string
  code: string
  qty: number
  entryMode: EntryMode
  msToRead: number | null
  reader: 'native' | 'zxing' | 'wedge' | null
  serial: string | null
  confirmToken?: string
}

const post = <T>(path: string, body: unknown) => api.post<T>(path, body, undefined, phoneHeaders())

export const miniPosApi = {
  login(userId: string, password: string): Promise<UaMobileLoginResult> {
    return post('UaAuth/Login', { userId, password, channel: MOBILE_CHANNEL })
  },
  verifyTotp(challengeId: string, totpCode: string): Promise<UaMobileLoginResult> {
    return post('UaAuth/VerifyTotp', { challengeId, totpCode })
  },

  /** The pharmacy's code as scanned (the till screen's changing QR, or the printed one). */
  unlock(code: string): Promise<MiniPosUnlocked> {
    return post('MiniPos/Unlock', { code })
  },

  /** Opens the promoter's basket at the assigned pharmacy, or answers the one already open. */
  open(): Promise<OpenResult> {
    return post('MiniPos/Open', { requestId: newRequestId() })
  },
  state(transactionId: string): Promise<SessionState> {
    return api.get('MiniPos/State', { transactionId }, phoneHeaders())
  },
  addItem(input: AddItemInput): Promise<SessionState> {
    return post('MiniPos/AddItem', input)
  },
  changeQty(transactionId: string, lineId: string, newQty: number): Promise<SessionState> {
    return post('MiniPos/ChangeQty', { transactionId, requestId: newRequestId(), lineId, newQty })
  },
  voidLine(transactionId: string, lineId: string): Promise<SessionState> {
    return post('MiniPos/VoidLine', { transactionId, requestId: newRequestId(), lineId })
  },
  submit(transactionId: string, requestId: string): Promise<SubmitResult> {
    return post('MiniPos/Submit', { transactionId, requestId })
  },
  abandon(transactionId: string): Promise<AbandonResult> {
    return post('MiniPos/Abandon', { transactionId, requestId: newRequestId() })
  },
}
