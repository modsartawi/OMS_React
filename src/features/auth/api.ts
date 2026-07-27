import { api } from '@/core/api'

// Shapes per the live API (the client models the live API, not the design doc).

/**
 * Ua web login step 1 (POST Auth/UaLogin) — always HTTP 200; failure arrives as
 * `success:false` with a display `message`. On success one of three branches:
 *   • `requiresTotp:false` — a live web session already covered the second factor
 *     (issue 370): the cookie is already set, go straight in.
 *   • `requiresTotp:true, mustChangePassword:true` — a temporary password must be
 *     replaced before the TOTP step (carries `challengeId`).
 *   • `requiresTotp:true, mustChangePassword:false` — proceed to the TOTP step
 *     (carries `challengeId`).
 * The channel is forced to `web` server-side; the raw token never reaches JS
 * (it lands only in the HttpOnly `sis_session` cookie).
 */
export interface UaLoginStep1Result {
  success: boolean
  errorCode: string | null
  message: string | null
  challengeId: string | null
  requiresTotp: boolean
  mustChangePassword: boolean
  displayName: string | null
  userId: string | null
}
/** Ua step 2 (POST Auth/UaVerifyTotp) and its cousins — success sets the cookie. */
export interface UaStepResult {
  success: boolean
  errorCode: string | null
  message: string | null
  displayName: string | null
  userId: string | null
}
/** Forced-change interstitial (POST Auth/UaChangePassword) — mints no session. */
export interface UaChangePasswordResult {
  success: boolean
  errorCode: string | null
  message: string | null
}
/**
 * Reset/re-enroll request step (POST Auth/UaRequestPasswordReset |
 * Auth/UaRequestTotpReenroll) — always HTTP 200. Success carries the `resetId`
 * the next two steps quote and says NOTHING about whether an SMS actually went
 * out: an id comes back for an unknown / phone-less employee too (anti-enum
 * decoy), so the caller must never read success as "the SMS was sent".
 */
export interface UaResetRequestResult {
  success: boolean
  errorCode: string | null
  message: string | null
  resetId: string | null
}
/** Shared OTP verify + set-password steps — carry only success + code + message. */
export interface UaResetStepResult {
  success: boolean
  errorCode: string | null
  message: string | null
}
/**
 * Re-enroll terminal step (POST Auth/UaReenrollTotp, issue 477) — on success the
 * `qrCodeUri` is the full otpauth URI (`otpauth://totp/DMSCO:{id}?secret=…`) the
 * browser renders locally as a QR; no secret is assembled in JS.
 */
export interface UaReenrollResult {
  success: boolean
  errorCode: string | null
  message: string | null
  qrCodeUri: string | null
}
export interface WebMeResult {
  authenticated: boolean
  userId: string | null
  currentStoreCode: string | null
}
export interface WebSessionModel {
  userId: string | null
  currentStoreCode: string | null
}

export const authApi = {
  /**
   * Ua login step 1 — password. Always HTTP 200; the caller branches on the
   * returned flags (success / requiresTotp / mustChangePassword), so unlike the
   * retired legacy login this does NOT throw on `success:false` — a failed
   * password is a branch, not an exception.
   */
  uaLogin(userId: string, password: string): Promise<UaLoginStep1Result> {
    // Channel is forced to `web` server-side — never sent from the browser.
    return api.post<UaLoginStep1Result>('Auth/UaLogin', { userId, password })
  },
  /** Ua login step 2 — TOTP. Success sets the session cookie server-side. */
  uaVerifyTotp(challengeId: string, totpCode: string): Promise<UaStepResult> {
    return api.post<UaStepResult>('Auth/UaVerifyTotp', { challengeId, totpCode })
  },
  /** Forced-change step, between password and TOTP. Sets no cookie. */
  uaChangePassword(
    challengeId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<UaChangePasswordResult> {
    return api.post<UaChangePasswordResult>('Auth/UaChangePassword', {
      challengeId,
      oldPassword,
      newPassword,
    })
  },
  // --- self-service password set/reset (issue 476) --------------------------
  // Anonymous, cookie-family, self-authorizing via the SMS code. All three wrap
  // UaPasswordResetService unchanged and set no cookie.

  /** Reset step 1 — employee id → reset id (+ SMS). Always HTTP 200; never an oracle. */
  uaRequestPasswordReset(userId: string): Promise<UaResetRequestResult> {
    return api.post<UaResetRequestResult>('Auth/UaRequestPasswordReset', { userId })
  },
  /** Shared verify — reset id + SMS code. Serves both reset and re-enroll (477). */
  uaVerifyResetOtp(resetId: string, otpCode: string): Promise<UaResetStepResult> {
    return api.post<UaResetStepResult>('Auth/UaVerifyResetOtp', { resetId, otpCode })
  },
  /** Reset step 3 — verified reset id + chosen password → credential set, id spent. */
  uaSetPassword(resetId: string, newPassword: string): Promise<UaResetStepResult> {
    return api.post<UaResetStepResult>('Auth/UaSetPassword', { resetId, newPassword })
  },

  // --- self-service TOTP activation / re-enroll (issue 477) -----------------
  // The verify step reuses uaVerifyResetOtp above (shared server verify). These
  // two wrap UaTotpEnrollmentService / UaPasswordResetService unchanged.

  /** Re-enroll step 1 — employee id → reset id (+ SMS). Always HTTP 200; never an oracle. */
  uaRequestTotpReenroll(userId: string): Promise<UaResetRequestResult> {
    return api.post<UaResetRequestResult>('Auth/UaRequestTotpReenroll', { userId })
  },
  /** Re-enroll step 3 — verified reset id → the otpauth URI to render as a QR. */
  uaReenrollTotp(resetId: string): Promise<UaReenrollResult> {
    return api.post<UaReenrollResult>('Auth/UaReenrollTotp', { resetId })
  },
  /** Always HTTP 200 — anonymous is a response ({authenticated:false}), not an error. */
  me(): Promise<WebMeResult> {
    return api.get<WebMeResult>('Auth/Me')
  },
  switchStore(storeCode: string): Promise<WebSessionModel> {
    return api.post<WebSessionModel>('Auth/SwitchStore', { storeCode })
  },
}
