import { api } from '@/core/api'
import type {
  CouponDetails,
  CouponsAccessResult,
  CouponTemplate,
  CreateImportJobRequest,
  CreateTemplateRequest,
  ImportJob,
  UpdateTemplateRequest,
} from '@/core/models/coupons'

// Every server call goes through @/core/api (see .claude/rules/api-envelope.md): it
// unwraps the SIS.Api envelope, returns `.data`, and maps a failed CouponResult to an
// ApiError whose `details[0].errorCode` carries the stable CUP-* machine code (mapped
// server-side by CouponWebErrorMapper → 404/409/400). Consumes the BackOffice web seam:
// 517 templates + 519 import. New-engine only, OMS-HQ only, no feature flag.
const BASE = 'CouponsAdminWeb'
const encode = (segment: string) => encodeURIComponent(segment)

export const couponsApi = {
  // Screen-open probe. Drives BOTH the in-page route-guard AND the shell's permission-
  // aware nav hiding (issue 429) — the shell's probe shares this exact ['coupons','access']
  // cache entry, so it's one call, not two. The server re-checks the grant on every
  // mutation regardless; the menu hide is show/hide hygiene only.
  access(): Promise<CouponsAccessResult> {
    return api.get<CouponsAccessResult>(`${BASE}/Access`)
  },

  // ── Templates (517) ──────────────────────────────────────────────────────
  getTemplate(templateId: string): Promise<CouponTemplate> {
    return api.get<CouponTemplate>(`${BASE}/Templates/${encode(templateId)}`)
  },
  createTemplate(request: CreateTemplateRequest): Promise<CouponTemplate> {
    return api.post<CouponTemplate>(`${BASE}/Templates`, request)
  },
  updateTemplate(templateId: string, request: UpdateTemplateRequest): Promise<CouponTemplate> {
    // PUT — the route id is authoritative (the seam overwrites any body id with it).
    return api.put<CouponTemplate>(`${BASE}/Templates/${encode(templateId)}`, request)
  },

  // ── Inquiry + support/destructive (518) ──────────────────────────────────
  // Look a coupon up by code — instance + template + redemption ledger. Support OR
  // admin. Unknown code → 404 (CUP-09001). A read (no audit server-side).
  getCouponDetails(couponCode: string): Promise<CouponDetails> {
    return api.get<CouponDetails>(`${BASE}/Coupons/${encode(couponCode)}`)
  },
  // Re-enable a killed instance — support OR admin. The actor/screen is the cookie
  // session server-side; the body carries only the code + an optional reason.
  reactivateInstance(couponCode: string, reason: string): Promise<unknown> {
    return api.post(`${BASE}/Coupons/Reactivate`, { couponCode, reason })
  },
  // Kill a single instance — admin-only. Reason is captured + audited server-side.
  deactivateInstance(couponCode: string, reason: string): Promise<unknown> {
    return api.post(`${BASE}/Coupons/Deactivate`, { couponCode, reason })
  },
  // Reverse ONE redemption — admin-only, keyed on the reversed transaction id. The
  // store is derived server-side from the reversed row. (`reason` has no server field
  // on RefundRequest — sent for the operator's record; harmlessly ignored.)
  refund(refTransactionId: string, reason: string): Promise<unknown> {
    return api.post(`${BASE}/Coupons/Refund`, { refTransactionId, reason })
  },
  // Full reset — zero RedeemCount (erases ALL redemptions). Admin-only. An empty reason
  // is refused server-side → 400 CUP-09099 (the client also requires it + a code retype).
  reset(couponCode: string, reason: string): Promise<unknown> {
    return api.post(`${BASE}/Coupons/Reset`, { couponCode, reason })
  },

  // ── Bulk import (519) ────────────────────────────────────────────────────
  // JSON codes → a Pending job. The server re-dedupes + re-enforces the 100k cap.
  createImportJob(templateId: string, request: CreateImportJobRequest): Promise<ImportJob> {
    return api.post<ImportJob>(`${BASE}/Templates/${encode(templateId)}/Import`, request)
  },
  // The template's jobs (the grid + polling). A bare array.
  jobsByTemplate(templateId: string): Promise<ImportJob[]> {
    return api.get<ImportJob[]>(`${BASE}/Templates/${encode(templateId)}/Jobs`)
  },
  // Re-queue a FAILED job (a non-failed job → 409 CUP-09042). No payload body needed —
  // the actor is the cookie session server-side.
  retryJob(jobId: string): Promise<unknown> {
    return api.post(`${BASE}/Jobs/${encode(jobId)}/Retry`, {})
  },
}
