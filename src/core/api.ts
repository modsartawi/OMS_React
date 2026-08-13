import { toast } from 'sonner'
import i18n from '@/core/i18n'
import { navigateTo, currentPath } from '@/core/nav'
import { useSession } from '@/core/session'
import { filenameFromDisposition } from '@/core/util/content-disposition'

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
  /**
   * The render rail's support handle (ticket 262) — the row id in the HQ
   * `ReportRenderAttempt` log, present on a 422/504 (the render was attempted and
   * journalled) and absent when nothing was attempted.
   *
   * 🚩 A **top-level sibling** of `message`/`errors`, not an entry inside
   * `errors[]`. It lives on the shared envelope rather than in the feature that
   * reads it because it is SIS.Api's field, not one screen's — and there is no
   * separate audit table, so it is the only thing a user can quote in a support
   * conversation.
   */
  attemptId?: string
}

/** A file fetched through `api.blob` — the body, and the name the server gave it. */
export interface FileResponse {
  blob: Blob
  /** From `Content-Disposition`. Null when the header is absent or unparseable. */
  filename: string | null
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
    /**
     * The envelope's top-level `attemptId` when the refusal carried one, else
     * null. Read it with `apiErrorAttemptId` rather than reaching in — the
     * companion reader to `apiErrorCode`/`apiErrorKind`, for the same reason.
     */
    public attemptId: string | null = null,
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

/**
 * The render attempt this failure was journalled under (SIS.Api's `attemptId`),
 * or null when the failure carried none — and on the render rail it is carried on
 * a 422 and a 504 only, because those are the statuses where a render was
 * actually attempted. Null too for any value that is not an `ApiError` at all.
 *
 * The reader does not police which statuses may carry one: it reports whatever
 * the envelope held, on whatever arm it arrived.
 *
 * It is the only support handle a user can quote: every render attempt writes one
 * row in the HQ `ReportRenderAttempt` log, and there is no separate audit.
 */
export function apiErrorAttemptId(err: unknown): string | null {
  return err instanceof ApiError ? err.attemptId : null
}

/**
 * Which arm of the taxonomy a failure is, or `null` when it is not an `ApiError`
 * at all (a bug in feature code, say — which is emphatically not a business
 * outcome).
 *
 * The companion to `apiErrorCode`, and the reason it exists is the same: a
 * feature that branches on `err instanceof ApiError && err.kind === …` is
 * re-implementing the taxonomy at each call site. A rule like the Loy
 * resolution cascade — "only a BUSINESS `LOY-00100` retries; auth, server and
 * network show themselves and stop" — has to name the kind, and it must name it
 * the same way everywhere.
 */
export function apiErrorKind(err: unknown): ApiErrorKind | null {
  return err instanceof ApiError ? err.kind : null
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

/**
 * The wire half every call shares: `BASE` + the leading-slash-stripped path,
 * `credentials: 'same-origin'`, the `X-Web-Client` CSRF header the cookie branch
 * of SIS.Api's `ApiKeyEndpointFilter` requires on **every** cookie-authenticated
 * request, and the 401 redirect.
 *
 * ⚠ `same-origin`, not `include`: vite proxies `/api` → SIS.Api and prod is
 * same-origin under IIS, so every call already *is* same-origin.
 *
 * Extracted at ticket 262 so `api.blob` reaches the same door as `request`
 * rather than hand-rolling a `fetch` beside it (`api-envelope`).
 */
async function send(path: string, init: RequestInit): Promise<Response> {
  const cleanPath = path.replace(/^\//, '')
  let res: Response
  try {
    res = await fetch(BASE + cleanPath, {
      ...init,
      credentials: 'same-origin',
      headers: {
        'X-Web-Client': '1',
        // ⚠ A `FormData` body is deliberately left WITHOUT a Content-Type (ticket
        // 273). The browser generates `multipart/form-data; boundary=…` for it, and
        // a hand-set `application/json` here replaces that header wholesale —
        // boundary and all — so the server receives a body it cannot split into
        // parts and parses no file at all. The one shape where saying nothing is
        // the correct thing to say.
        ...(init.body && !(init.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError('network', i18n.t('common:errors.network'), 0)
  }

  if (res.status === 401) throw handle401(cleanPath)
  return res
}

/** The envelope a non-2xx carried, or null when the body was not JSON at all. */
async function readEnvelope<T>(res: Response): Promise<HttpGeneralResponse<T> | null> {
  try {
    return (await res.json()) as HttpGeneralResponse<T>
  } catch {
    /* non-JSON body — the caller falls through to status mapping */
    return null
  }
}

/**
 * The refusal an envelope with `success:false` describes — one construction, used
 * everywhere one is built (ticket 262), so the message fallback, the code list,
 * the refusal's own `data` and its `attemptId` cannot start disagreeing between
 * the three paths that reach it.
 *
 * `statusCode` is the caller's because the two paths differ on it by a hair the
 * refactor must not flatten: the ok-path takes the envelope's own `statusCode`
 * verbatim, the failure paths fall back to the response's when it is absent.
 */
function businessFromEnvelope<T>(body: HttpGeneralResponse<T>, statusCode: number): ApiError {
  return new ApiError(
    'business',
    body.message || i18n.t('common:errors.notSuccessful'),
    statusCode,
    body.errors ?? [],
    body.data ?? null,
    body.attemptId ?? null,
  )
}

/**
 * The failure tail, shared by `request` and `requestBlob` (ticket 262): a non-2xx
 * response plus whatever envelope it carried, mapped to the one `ApiError` the
 * whole app branches on. Extracted rather than copied — the 400 arm, the
 * coded-refusal arm and the `>= 500` arm have to behave identically on both
 * paths, because the download's error table is mostly the same table.
 */
function failureFromEnvelope<T>(res: Response, body: HttpGeneralResponse<T> | null): ApiError {
  if (res.status === 400)
    return new ApiError(
      'business',
      body?.message || i18n.t('common:errors.rejected'),
      400,
      body?.errors ?? [],
      body?.data ?? null,
      body?.attemptId ?? null,
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
  const coded = body?.success === false && !!body.errors?.[0]?.errorCode
  if (body && body.success === false && (res.status < 500 || coded))
    return businessFromEnvelope(body, body.statusCode || res.status)
  if (res.status >= 500)
    return new ApiError(
      'server',
      i18n.t('common:errors.server'),
      res.status,
      [],
      null,
      body?.attemptId ?? null,
    )
  return new ApiError(
    'unknown',
    i18n.t('common:errors.unexpected', { status: res.status }),
    res.status,
    [],
    null,
    body?.attemptId ?? null,
  )
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const res = await send(path, init)
  const body = await readEnvelope<T>(res)

  if (!res.ok) throw failureFromEnvelope(res, body)

  if (body === null)
    throw new ApiError('unknown', i18n.t('common:errors.unexpected', { status: res.status }), res.status)

  if (!body.success) throw businessFromEnvelope(body, body.statusCode)
  return body.data
}

/**
 * A file off the same door (ticket 262).
 *
 * 🔑 **Success and failure read different body types off the same response.** A
 * 2xx is the raw bytes — `application/pdf`, not an envelope, so `res.json()`
 * would throw — while every failure *is* enveloped and goes through the shared
 * `failureFromEnvelope`, producing the identical `ApiError` a `api.get` would
 * have produced at that status.
 *
 * This exists because `request<T>` always calls `res.json()`, so there is no way
 * to reach a file through it — and because a browser navigation (`<a href>`,
 * `window.open`) cannot send the `X-Web-Client` header the cookie branch
 * requires, so a plain download link answers 401.
 */
async function requestBlob(path: string): Promise<FileResponse> {
  const res = await send(path, { method: 'GET' })

  if (!res.ok) throw failureFromEnvelope(res, await readEnvelope<unknown>(res))

  // 🚩 A 2xx that came back as JSON is a refusal wearing a success status — the
  // estate's envelope answers some business outcomes with `200 success:false`,
  // and `request` has always mapped that (below). Without this the envelope would
  // be saved to disk as the "PDF", which fails silently and much later. Keyed on
  // the content type rather than on sniffing the bytes, so it can never fire on
  // an actual `application/pdf`.
  if (res.headers.get('Content-Type')?.includes('json')) {
    const body = await readEnvelope<unknown>(res)
    if (body && !body.success) throw businessFromEnvelope(body, body.statusCode || res.status)
    throw new ApiError('unknown', i18n.t('common:errors.unexpected', { status: res.status }), res.status)
  }

  // ⚠ Guarded, because `res.blob()` CAN reject — a connection dropped mid-body,
  // a proxy that closed early — and an unguarded one escapes this module as a
  // raw `TypeError`, which is the one shape no caller branches on: it is not an
  // `ApiError`, so `apiErrorMessage`/`apiErrorCode`/`apiErrorKind` all decline it
  // and a screen shows its most generic sentence for the most retryable failure
  // there is. A truncated download is a network fault and says so. (Raised
  // against 262 at ticket 263's review, closed here by its first real consumer.)
  let blob: Blob
  try {
    blob = await res.blob()
  } catch {
    throw new ApiError('network', i18n.t('common:errors.network'), 0)
  }

  return {
    blob,
    filename: filenameFromDisposition(res.headers.get('Content-Disposition')),
  }
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
  // A file rather than an envelope — the same base, credentials, CSRF header and
  // 401 redirect as `get`, but the 2xx body is read with `res.blob()` and the
  // name comes off `Content-Disposition`. GET-only: the rail's downloads are
  // GETs, and a body-bearing binary request is a shape to add when one exists.
  blob(path: string, params?: Record<string, unknown>): Promise<FileResponse> {
    return requestBlob(path + buildQuery(params))
  },
  post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
  },
  /**
   * A **multipart** POST — bytes the user picked, plus whatever scalar fields ride
   * beside them (ticket 273, spec 267 D8's two bulk doors).
   *
   * 🔑 It is `post` with a different body type and **nothing else**: the same base,
   * credentials, `X-Web-Client` header and 401 redirect through `send`, and the same
   * envelope unwrap and error taxonomy through `request`. That is the whole reason
   * it lives here rather than as a `fetch` beside the feature that uploads
   * (`.claude/rules/api-envelope.md`) — a hand-rolled one would answer a refused
   * upload with a bare `Response` on a screen whose every other refusal is an
   * `ApiError` carrying the server's words.
   *
   * ⚠ The caller builds the `FormData` and names the parts, because part names are
   * one endpoint's contract and `core/` must not learn one feature's. What `core/`
   * owns is that the Content-Type is left to the browser — see `send`.
   */
  upload<T>(path: string, form: FormData): Promise<T> {
    return request<T>(path, { method: 'POST', body: form })
  },
  put<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
  },
  // `del` rather than `delete` — a reserved word cannot be a shorthand method
  // name's call site everywhere (`api.delete` parses, `const { delete } = api`
  // does not), and the three-letter form is what the rest of the estate uses.
  // It takes PARAMS, not a body: the DELETE routes on this API name their target
  // on the query string (`CallCenterWeb/CustomerAddresses?addressNumber=…`), and
  // a body on a DELETE is the shape fetch and the proxy agree least about.
  del<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    return request<T>(path + buildQuery(params), { method: 'DELETE' })
  },
}
