/**
 * What a failed `IDocInspector/Download` says (ticket 299).
 *
 * 🔑 **A non-2xx carrying the envelope with `success:false` is a BUSINESS
 * outcome, not a crash** ([api-envelope](../../../../.claude/rules/api-envelope.md)).
 * The rail answers every named failure with its own sentence inside the envelope,
 * and `core/api.ts` has already put that sentence on the `ApiError` — so the job
 * here is to *let it through* rather than to replace it with a generic one. That
 * is the whole ticket, and it is the mistake this module exists to prevent: a
 * screen that shows "something went wrong" for a server that said exactly what
 * was wrong.
 *
 * ⚠️ **Two arms carry no sentence and must not read as one.** A grant refusal on
 * this rail is a **bare 403 with no body at all** — no envelope, no `errorCode` —
 * so `ApiError.message` is the shared *unexpected status* string, and a network
 * fault never reached the server to be answered. Both get the screen's own copy;
 * everything else gets the server's.
 *
 * ⚠️ **There is no retry model here, and its absence is a decision.** Every named
 * code on this rail is a fixed answer about persisted rows — the download reads
 * them and serialises in-process, so there is no render host to be briefly
 * unavailable and nothing that answers differently a second later. The button
 * itself is the retry. (Contrast `retail-invoice/download-outcome.ts`, whose
 * three-valued `DownloadRetry` exists because 503 and 504 are genuinely different
 * waits on a render host.)
 *
 * Pure — no React, no i18n lookup, no network. It names a KEY; the component
 * translates it.
 */
import { ApiError, apiErrorCode } from '@/core/api'
import { published } from './code-table'

export interface DownloadOutcome {
  /** The `reports` key of the sentence to show when there is no server sentence
   *  to show instead. */
  messageKey: string
  /**
   * The server's own words, or `null` when this failure carried none.
   *
   * 🔑 **Preferred over `messageKey` wherever it is present**, and that ordering
   * is the ticket: `IDOC_TYPE_NOT_PRESENT` explains itself far better than any
   * sentence this repo could keep in step with the rail. Read off the `ApiError`
   * here rather than in the component so it is one decision with one test, not a
   * `??` a future edit can quietly invert.
   */
  serverMessage: string | null
  /** The machine code, for the drive and for a consultant reporting a failure.
   *  Never shown as prose. */
  code: string | null
}

/** The rail's own machine codes (BackOffice `IDocInspectorDownloadCodes` and the
 *  two it shares with the transaction route). Not user-visible — matched, not
 *  read. */
export const STORE_CODE_REQUIRED = 'STORE_CODE_REQUIRED'
export const TRX_NUMBER_REQUIRED = 'TRX_NUMBER_REQUIRED'
export const IDOC_TYPE_REQUIRED = 'IDOC_TYPE_REQUIRED'
export const INVALID_KEY = 'INVALID_KEY'
export const IDOC_TYPE_NOT_PRESENT = 'IDOC_TYPE_NOT_PRESENT'
export const IDOC_TYPE_NOT_SERIALISABLE = 'IDOC_TYPE_NOT_SERIALISABLE'

/**
 * The fallback sentence per code, for the case where the envelope arrived with a
 * code and **no message**.
 *
 * 🚩 Not the primary reading. Every one of these is second to the server's own
 * words; they exist because an envelope with a blank `message` is a shape the
 * client cannot rule out, and the codes it names are the ones where "the download
 * failed" would be an actively unhelpful thing to say.
 *
 * ⚠️ Four of the six are **client defects** — the screen offers one button per
 * type *present* and builds the key from an issued lookup, so a user cannot browse
 * into them. Their copy says so rather than blaming the transaction.
 */
const OUTCOME_KEYS: Record<string, string> = {
  [STORE_CODE_REQUIRED]: 'idocInspector.download.errors.invalidKey',
  [TRX_NUMBER_REQUIRED]: 'idocInspector.download.errors.invalidKey',
  [INVALID_KEY]: 'idocInspector.download.errors.invalidKey',
  [IDOC_TYPE_REQUIRED]: 'idocInspector.download.errors.typeRequired',
  [IDOC_TYPE_NOT_PRESENT]: 'idocInspector.download.errors.notPresent',
  [IDOC_TYPE_NOT_SERIALISABLE]: 'idocInspector.download.errors.notSerialisable',
}

const GENERIC = 'idocInspector.download.errors.generic'
const DENIED = 'idocInspector.download.errors.denied'
const SESSION_ENDED = 'idocInspector.download.errors.session'
const OFFLINE = 'idocInspector.download.errors.network'

/**
 * The decision, read straight off whatever `api.blob` threw.
 *
 * The order of the arms is itself the decision:
 *
 * 1. **Not an `ApiError` at all** — a bug in this repo, not an answer. Generic.
 * 2. **`kind: 'network'`** — the request never reached the server, so there is no
 *    sentence to prefer and a 0 status no row names.
 * 3. **401** — `handle401` has already cleared the session, toasted and started
 *    the redirect. The sentence exists so the strip is never blank in the frame
 *    before the navigation settles; it is not an arm this screen acts on.
 * 4. **A coded failure** — the server named it, so the server's words win.
 * 5. **Any other business failure** — enveloped, `success:false`, no code this
 *    repo knows. Still the server's words: an unfamiliar code is a deployment
 *    ahead of this bundle, and the sentence beside it is still true.
 * 6. **403** — checked *after* the coded arms because a refusal here is bare. A
 *    coded 403 would be a deliberate, named outcome and is reported as one.
 * 7. Anything left: a proxy, a 5xx that lost its envelope. Generic.
 */
export function downloadFailure(err: unknown): DownloadOutcome {
  if (!(err instanceof ApiError)) return { messageKey: GENERIC, serverMessage: null, code: null }
  if (err.kind === 'network') return { messageKey: OFFLINE, serverMessage: null, code: null }
  if (err.statusCode === 401)
    return { messageKey: SESSION_ENDED, serverMessage: null, code: null }

  const code = apiErrorCode(err)
  if (code !== null)
    return {
      // 🚩 `published`, never a bare index: an inherited name would survive the
      // `??` and be handed to `t()` as a FUNCTION (`code-table.ts`).
      messageKey: published(OUTCOME_KEYS, code) ?? GENERIC,
      serverMessage: serverMessage(err),
      code,
    }

  if (err.kind === 'business')
    return { messageKey: GENERIC, serverMessage: serverMessage(err), code: null }

  if (err.statusCode === 403) return { messageKey: DENIED, serverMessage: null, code: null }
  return { messageKey: GENERIC, serverMessage: null, code: null }
}

/**
 * ⚠️ A blank server message is `null` and not `''` — an empty string would win
 * the `??` in the component and draw a failure with no sentence at all.
 *
 * 🚩 Reaches `err.message` rather than calling `apiErrorMessage(err, fallback)`,
 * and the difference is the *blank* case: the helper answers "the server's
 * sentence, or this fallback if it is not an `ApiError`", and what this needs is
 * "the server's sentence, or **nothing**, so the screen's own copy can take
 * over" — a fallback passed here would be chosen by a caller that has not yet
 * decided which key applies. The rule's intent (never swallow an `ApiError` into
 * a generic string) is what this module exists to serve; the `ApiError` is
 * already narrowed by the caller, so there is no unguarded reach.
 */
const serverMessage = (err: ApiError): string | null => (err.message.trim() === '' ? null : err.message)
