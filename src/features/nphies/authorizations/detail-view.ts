/**
 * What the authorization detail may say, and where each sentence comes from
 * (ticket 216, spec 209 stories 77–79, contract v1.0 §3.4 / §5).
 *
 * The ticket's discovery is that **there is no rejection view to build**: the
 * ordinary detail always carries the per-line verdict, the approved quantity, the
 * rejected amount and the payer's reason *already decoded into words*, so a
 * partial approval — a header saying approved with individual lines refused — is
 * just the ordinary detail read carefully.
 *
 * 🚩 **The one trap this module defuses.** `ErrorMessageShort` carries *either* a
 * transport error *or* the decoded adjudication display, depending on which
 * branch of `ProcessAuthResponse` filled it (`:53-65` from the transport codings;
 * **only if that left it empty** does `:120` fill it from
 * `GetAdjudicationOutcomeDisplay`). The rule is that **the Request state picks
 * both the label and the source** — `failureMessage` is the only place in the
 * feature that reads the field, and it answers `null` on a completed
 * authorization whatever the field holds. A neutral "Message" label would
 * re-conflate exactly what the two axes exist to keep apart.
 *
 * Pure: no React, no i18n, no `@/core/api`. It is where the ticket's assertions
 * live, which is what makes them testable with no React Testing Library in the
 * repo (spec 209's tier-1 ruling).
 *
 * It sits in the feature rather than in `core/` for 215's reason: the
 * authorizations feature is its only consumer, and the piece two features
 * genuinely share — the two axes and their value sets — is already up in
 * `@/core/nphies/status`, which this composes rather than re-derives.
 */
import type { AuthDetail, AuthDetailLine, AuthSupportingInfo } from '@/core/models/nphies'
import { authVerdictOf, deriveAuthAxes, showsFailureMessage } from '@/core/nphies/status'
import type { AuthVerdict } from '@/core/nphies/status'

/**
 * The failure message, or `null` — and `null` is the answer on a **completed**
 * authorization however much the field holds.
 *
 * See the flag at the top of the file. The two states §5 admits are `Failed` and
 * `Pending`; `Complete` and `Cancelled` both answer `null`, the second because a
 * cancel happens *after* an answer and is not a failure to report.
 */
export function failureMessage(detail: AuthDetail): string | null {
  if (!showsFailureMessage(deriveAuthAxes(detail).request)) return null
  const message = (detail.errorMessageShort ?? '').trim()
  return message === '' ? null : message
}

/**
 * One line of the detail as the screen reads it: the server's own numbers, plus
 * the two things that are derived — the verdict and whether the line is one to
 * look at.
 *
 * 🚩 **No money is computed here.** Every amount is a field the server sent,
 * carried through unchanged; there is no sum, no total and no derived figure
 * anywhere in this module (law 1 — amounts are one-way, engine → client, display
 * only).
 */
export interface AuthLineView extends AuthDetailLine {
  /**
   * The line's own adjudication outcome, over the same value set as the header's
   * — and **blank until the header's Request is `Complete`**.
   *
   * 🚩 The blank is enforced here rather than at the render site, for the same
   * reason `deriveAuthAxes` enforces it on the header: the line carries
   * `AdjudicationOutcome` whatever happened to the request, because
   * `ProcessAuthResponse` writes the header and the lines from one response. A
   * screen that read the column directly would tell an agent a payer approved a
   * line the payer never saw.
   */
  verdict: AuthVerdict | null
  /**
   * Something on this line was **not** approved — the flag that makes a partial
   * legible at a glance.
   *
   * Deliberately wider than `verdict === 'rejected'`: a `partial` line outcome is
   * a partly refused line, and a line whose outcome reads `approved` while
   * carrying a non-zero `Rejected` amount is money the payer did not pay, which
   * the agent explaining the bill has to be able to find. It is **never** true
   * while the verdict is blank — nothing is claimed about a request that never
   * reached the payer.
   */
  refused: boolean
}

/** Every line of the detail, in the order the server sent them. Sort is the
 *  server's here as it is on the list, and `Sequence` is the engine's own line
 *  identity — re-ordering would renumber what the payer answered. */
export function projectAuthLines(detail: AuthDetail): AuthLineView[] {
  // One derivation for the whole document: the lines' verdicts hang off the
  // HEADER's Request state, not off anything per line.
  const answered = deriveAuthAxes(detail).request === 'complete'
  return (detail.authLines ?? []).map((line) => {
    const verdict = answered ? authVerdictOf(line.adjudicationOutcome) : null
    return {
      ...line,
      verdict,
      refused:
        verdict !== null &&
        (verdict === 'rejected' || verdict === 'partlyApproved' || (line.rejected ?? 0) > 0),
    }
  })
}

/**
 * The lines an agent chasing a rejection is looking for. A filter over what
 * `projectAuthLines` already decided — the rule is stated once, above.
 */
export function refusedLines(lines: AuthLineView[]): AuthLineView[] {
  return lines.filter((line) => line.refused)
}

/**
 * One attachment **as it was submitted**, ready to render.
 *
 * The response carries the base64 whether the client renders it or not (§3.4), so
 * showing an agent what the payer was actually given costs no endpoint, no
 * upload, no second fetch and no server change.
 */
export interface AuthAttachmentView {
  id: string
  sequence: number
  /** §3.5's closed 7-value title, as it reached the payer. Server data — passed
   *  through, never keyed. */
  title: string
  /** ⚠️ **Derived from the service's own mapping, not from the wire.** See below. */
  contentType: string
  isImage: boolean
  /** `data:<contentType>;base64,<attachment>` — what an `<img>` or an `<a>` needs. */
  dataUrl: string
}

/**
 * ⚠️ `attachmentType` is **not** a MIME type. §3.5 spells the submit body's field
 * `contentType`, but what comes back is the service's two-valued flag:
 * `ProcessAddAuthRequest.cs:216` writes `ContentType.StartsWith("image") ?
 * "image" : "pdf"`, and `Extensions.cs:725` reads it back as
 * `AttachmentType == "image" ? "image/jpeg" : "application/pdf"`.
 *
 * This mirrors that map exactly rather than inventing one — it is what the payer
 * was actually sent. The one hedge is a value that already contains a `/`, which
 * is passed through as the MIME it plainly is, because §3.5's wording means
 * SIS.Api may yet forward a real one once 920 lands. Logged as a §8 gap in
 * `.afk/HITL-216.md`.
 */
function contentTypeOf(attachmentType: string | null | undefined): string {
  const raw = (attachmentType ?? '').trim()
  if (raw.includes('/')) return raw
  return raw.toLowerCase() === 'image' ? 'image/jpeg' : 'application/pdf'
}

/**
 * The attachments among the supporting infos.
 *
 * 🚩 **The collection is not "the attachments"** — `days-supply`,
 * `reason-for-visit` and `morphology` ride in it too. The filter is on a
 * **non-empty `attachment`**, i.e. on the base64 itself, rather than on
 * `category === 'attachment'`: the payload is the fact that matters, and the
 * category spelling is not something the contract freezes.
 *
 * Duplicates are kept. Two prescriptions are two prescriptions (§3.5), and
 * `sequence` already distinguishes them — this is the deliberate opposite of the
 * duplicate-item refusal at `addItem`.
 */
export function submittedAttachments(
  infos: AuthSupportingInfo[] | null | undefined,
): AuthAttachmentView[] {
  return (infos ?? [])
    .filter((info) => (info.attachment ?? '').trim() !== '')
    .map((info) => {
      const contentType = contentTypeOf(info.attachmentType)
      return {
        id: info.id,
        sequence: info.sequence,
        title: info.attachmentTitle ?? '',
        contentType,
        isImage: contentType.startsWith('image/'),
        dataUrl: `data:${contentType};base64,${info.attachment.trim()}`,
      }
    })
}
