import { toast } from 'sonner'
import i18n from '@/core/i18n'
import { navigateTo, currentPath } from '@/core/nav'
import { useSession } from '@/core/session'

// Universal SIS.Api envelope (PRD §2.2)
export interface GeneralErrorResponse {
  errorCode: string
  internalErrorCode: string
  errorMessage: string
}
interface HttpGeneralResponse<T> {
  statusCode: number
  success: boolean
  message: string
  errors: GeneralErrorResponse[]
  data: T
}

export type ApiErrorKind = 'auth' | 'business' | 'server' | 'network' | 'unknown'

export class ApiError extends Error {
  constructor(
    public kind: ApiErrorKind,
    message: string,
    public statusCode: number,
    public details: GeneralErrorResponse[] = [],
    /**
     * The envelope's own `data` on a refusal that carried one. A guardrail
     * refusal is not always just a code and a sentence — some carry a
     * structured body the screen has to read to explain itself. The envelope
     * is this module's to unwrap on the success path, so it is this module's
     * to carry on the failure path too: a feature that re-read the body would
     * be re-implementing the envelope.
     *
     * `unknown` deliberately. What a refusal's `data` MEANS is the refusing
     * feature's to know, and `core/` must not learn one feature's codes.
     */
    public data: unknown = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback
}

/** The server's machine-readable code for a business failure (e.g. LAST_ADMIN,
 *  SYSTEM_ROLE, IN_USE, DUPLICATE_NAME), or null when the error carries none. */
export function apiErrorCode(err: unknown): string | null {
  return err instanceof ApiError ? (err.details[0]?.errorCode ?? null) : null
}

// API base is environment-driven (428/435). Dev talks to the `/api` Vite proxy
// (stripped to root before SIS.Api); prod is same-origin under IIS with SIS.Api's
// endpoints at the root, so the base is `/`. `VITE_API_BASE` overrides both if ops
// ever needs a non-default base. Trailing slash matters: request() strips the
// leading slash off each path, so BASE must end in '/'.
const BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.PROD ? '/' : '/api/')

// Coalesce concurrent 401s into one toast + one redirect (Angular parity §1.4).
let redirectInFlight = false

function handle401(requestPath: string): ApiError {
  const message = i18n.t('common:errors.sessionEnded')
  // The anonymous auth endpoints must never trigger the expired-session redirect:
  // a rejected password/TOTP is a login failure, not an ended session. The Ua
  // two-step family (UaLogin/UaVerifyTotp/UaChangePassword) joins the legacy
  // Auth/Login here; the /login pathname guard also covers the in-page flow.
  const skip =
    requestPath.endsWith('Auth/Login') ||
    requestPath.includes('Auth/Ua') ||
    window.location.pathname === '/login'
  if (!skip && !redirectInFlight) {
    redirectInFlight = true
    useSession.getState().clear()
    toast.dismiss()
    toast.warning(message)
    const returnUrl = encodeURIComponent(currentPath())
    navigateTo(`/login?returnUrl=${returnUrl}&reason=expired`)
    // Release after navigation settles so a later, separate expiry redirects again.
    setTimeout(() => {
      redirectInFlight = false
    }, 1000)
  }
  return new ApiError('auth', message, 401)
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const cleanPath = path.replace(/^\//, '')
  let res: Response
  try {
    res = await fetch(BASE + cleanPath, {
      ...init,
      credentials: 'same-origin',
      headers: {
        'X-Web-Client': '1',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('network', i18n.t('common:errors.network'), 0)
  }

  if (res.status === 401) throw handle401(cleanPath)

  let body: HttpGeneralResponse<T> | null = null
  try {
    body = (await res.json()) as HttpGeneralResponse<T>
  } catch {
    /* non-JSON body — fall through to status mapping */
  }

  if (res.status === 400)
    throw new ApiError(
      'business',
      body?.message || i18n.t('common:errors.rejected'),
      400,
      body?.errors ?? [],
      body?.data ?? null,
    )
  // A non-2xx that still carries the SIS.Api envelope with success=false is a mapped
  // business outcome — the AuthzAdminWeb family answers guard denials (403), unknown
  // targets (404) and rule violations (409) with a machine code + message INSIDE the
  // envelope. Surface that message + code so guardrail refusals (LAST_ADMIN,
  // SYSTEM_ROLE, IN_USE, …) explain themselves, rather than a generic "unexpected".
  //
  // 🚩 **A CODED refusal outranks its status, including a 5xx.** A service that
  // answers a deliberate, named outcome with a 503 (a downstream it depends on
  // being briefly unavailable, say) is still telling us something the screen can
  // act on, and flattening it to `kind:'server'` turns a routine retryable answer
  // into "something unexpected happened". The error CODE is what admits a 5xx
  // here: a genuine crash carries no `errorCode` and still reads as a server
  // fault below, exactly as it did before.
  if (!res.ok) {
    const coded = body?.success === false && !!body.errors?.[0]?.errorCode
    if (body && body.success === false && (res.status < 500 || coded))
      throw new ApiError(
        'business',
        body.message || i18n.t('common:errors.notSuccessful'),
        body.statusCode || res.status,
        body.errors ?? [],
        body.data ?? null,
      )
    if (res.status >= 500) throw new ApiError('server', i18n.t('common:errors.server'), res.status)
    throw new ApiError('unknown', i18n.t('common:errors.unexpected', { status: res.status }), res.status)
  }
  if (body === null)
    throw new ApiError('unknown', i18n.t('common:errors.unexpected', { status: res.status }), res.status)

  if (!body.success)
    throw new ApiError(
      'business',
      body.message || i18n.t('common:errors.notSuccessful'),
      body.statusCode,
      body.errors ?? [],
      body.data ?? null,
    )
  return body.data
}

/** Query params: null/undefined/'' entries are dropped entirely (PRD §5.2). */
function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return ''
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    qs.set(key, String(value))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const api = {
  // `headers` is an optional per-request passthrough (merged last, so a caller
  // header wins over the defaults). The Notification Center poll uses it to send
  // `x-presence: skip` — a cooperative throttle the server reads to skip its
  // presence heartbeat write. Kept optional so every existing caller is untouched.
  get<T>(path: string, params?: Record<string, unknown>, headers?: Record<string, string>): Promise<T> {
    return request<T>(path + buildQuery(params), { method: 'GET', headers })
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
  },
}
