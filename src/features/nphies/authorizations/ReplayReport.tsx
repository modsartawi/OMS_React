import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react'

import type { ReplayFinding } from './replay'

/**
 * **What the replay did not bring back** (ticket 221, spec 209 stories 82–84,
 * contract v1.0 §3.9).
 *
 * 🚩 **The report is the feature.** Rebuilding a refused request from what was
 * submitted is the easy half; the half that makes it safe is saying, in words and
 * on screen, that an item was blocked, or repriced, or lost its category since.
 * A silent restore would be worse than no reopen at all, because the agent would
 * press Submit believing they were resending the same request.
 *
 * So this panel renders in **three** states and never in none:
 *
 * - **replaying** — the verbs are going out, one per line, and the form is held
 *   still behind it.
 * - **clean** — every line came back the way it went out, said out loud. Silence
 *   here would be indistinguishable from a report nobody wrote.
 * - **findings** — each named, with the server's own sentence where there is one.
 *
 * Inline, like every other surface in this flow: no modal opens anywhere.
 */
export default function ReplayReport({
  sourceAuthId,
  replaying,
  done,
  findings,
  error,
}: {
  /** The authorization being replayed FROM — provenance, so the agent knows which
   *  refusal this request came out of. */
  sourceAuthId: string
  /** The verbs are still going out. */
  replaying: boolean
  /** The replay has finished and the report below is the whole of it. */
  done: boolean
  findings: ReplayFinding[]
  /** The journal could not be read, in the server's own words (§6 kind 2). */
  error: string | null
}) {
  const { t } = useTranslation('authorizations')

  if (error) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-050 p-3 text-[0.8125rem] text-danger-800"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <span className="font-medium">{t('form.replay.unreadableTitle')}</span>
          {/* Server-supplied text, passed through as data — the label around it is
              what is keyed. */}
          <span>{error}</span>
          <span className="text-muted-foreground">{t('form.replay.unreadableHint')}</span>
        </div>
      </div>
    )
  }

  if (replaying) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-[0.8125rem]"
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        {t('form.replay.working', { authId: sourceAuthId })}
      </div>
    )
  }

  if (!done) return null

  if (findings.length === 0) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-border/60 bg-card/40 p-3 text-[0.8125rem]"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>{t('form.replay.clean', { authId: sourceAuthId })}</span>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-[0.8125rem] text-attention-800"
    >
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">
            {t('form.replay.title', { count: findings.length, authId: sourceAuthId })}
          </span>
          {/* The sentence that stops the agent reading this as noise: what is on
              screen is NOT the request that was refused, and where it differs is
              listed below. */}
          <span>{t('form.replay.detail')}</span>
        </div>
      </div>
      <ul className="flex list-disc flex-col gap-1 ps-9">
        {findings.map((f, index) => (
          <li key={`${f.kind}-${f.itemNumber ?? ''}-${index}`}>
            {t(`form.replay.findings.${f.kind}`, {
              itemNumber: f.itemNumber ?? '',
              sequence: f.sequence ?? 0,
              was: f.was ?? '',
              now: f.now ?? '',
            })}
            {/* 🚩 The door's own words, beside the client's sentence rather than
                instead of it: the kind says what happened, the message says why,
                and only the server knows the why. */}
            {f.message && <span className="text-attention-800/80"> {f.message}</span>}
          </li>
        ))}
      </ul>
      <p className="ps-9 text-attention-800/80">
        {t('form.replay.correctHere')}{' '}
        <Link
          to={`/nphies/authorizations/${encodeURIComponent(sourceAuthId)}`}
          className="underline underline-offset-2"
        >
          {t('form.replay.openSource')}
        </Link>
      </p>
    </div>
  )
}
