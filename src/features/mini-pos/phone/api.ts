import { api, apiErrorCode } from '@/core/api'
import type {
  AbandonResult,
  LoyaltyMember,
  LoyaltySignupCapture,
  LoyaltySignupConfirmCapture,
  OpenResult,
  SessionState,
  SubmitResult,
} from '@/core/models/callcenter'
import { newRequestId } from '@/core/engine-session/request-id'
import { phoneHeaders } from './phone-session'

/**
 * The Mini POS phone's server calls (spec 4063, ticket 928): the Ua two-step login on the `mobile` channel, then the
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

/** One of the promoter's orders of today (`MiniPos/MyOrdersToday`, BackOffice 4071), as the server states it. */
export interface MiniPosOrder {
  documentNo: string
  /** `open` (editable), `held` (open at a till right now), `paid` (billed at a till), `closed` (the day ended, or
   *  cancelled; an expired order the sweep has not reached yet is listed closed too). The server's word. */
  status: MiniPosOrderStatus | string
  enteredAt: string
  netTotal: number
  storeCode: string
  customerId: string
}

export type MiniPosOrderStatus = 'open' | 'held' | 'paid' | 'closed'

/** `MiniPos/Reopen` — the order being edited, and the new basket it was loaded into (priced again). */
export interface MiniPosReopened {
  documentNo: string
  state: SessionState
}

/** `LoyMemberService`'s "no member with this mobile" (the call-center console's lookup reads it as absence too). */
export const MEMBER_NOT_FOUND = 'LOY-00100'

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

  // ----- the customer (BackOffice 4070): find or sign up a member, then attach -----

  /** A member by the mobile as typed (normalised by the server), or `null` when the mobile is not a member. */
  async memberByMobile(mobile: string): Promise<LoyaltyMember | null> {
    try {
      return await api.get<LoyaltyMember>(`MiniPos/MemberByMobile/${encodeURIComponent(mobile)}`, undefined, phoneHeaders())
    } catch (err) {
      if (apiErrorCode(err) === MEMBER_NOT_FOUND) return null
      throw err
    }
  },
  /** The Arbahi app's QR, as read. Single use and short-lived (120 s): the server burns it on this call. */
  memberByScanCode(scanCode: string): Promise<LoyaltyMember> {
    return post('MiniPos/MemberByScanCode', { scanCode })
  },
  /** Sends the sign-up code to a new mobile. No branch on the wire: the server enrols at the assigned pharmacy. */
  signUp(requestId: string, capture: LoyaltySignupCapture): Promise<unknown> {
    return post('MiniPos/SignUpByBranch', { requestId, ...capture })
  },
  /** The code the customer received → the new member, whom the phone then attaches. */
  confirmSignUp(requestId: string, capture: LoyaltySignupConfirmCapture): Promise<LoyaltyMember> {
    return post('MiniPos/ConfirmSignUpByBranch', { requestId, ...capture })
  },
  attachCustomer(transactionId: string, customerId: string): Promise<SessionState> {
    return post('MiniPos/AttachCustomer', { transactionId, requestId: newRequestId(), customerId })
  },

  // ----- my orders today, reopen and resubmit (BackOffice 4071) -----

  myOrdersToday(): Promise<MiniPosOrder[]> {
    return api.get('MiniPos/MyOrdersToday', undefined, phoneHeaders())
  },
  reopen(documentNo: string): Promise<MiniPosReopened> {
    return post('MiniPos/Reopen', { documentNo, requestId: newRequestId() })
  },
  /** A reopened basket's submit: the order's lines replaced under the same number. */
  resubmit(transactionId: string, requestId: string): Promise<SubmitResult> {
    return post('MiniPos/Resubmit', { transactionId, requestId })
  },
}
