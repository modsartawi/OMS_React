import type { ReactNode } from 'react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'

/**
 * A door's refusal as the Data sync screen shows it (review fix, 2026-10-24 — was copied into
 * Start, the Apply outcome, the control dialog and the New campaign dialog): the door's message
 * (`fallback` when it has none), the screen's own sentence for the code (`words`), the door's
 * detail text when given, and the code itself as a machine value.
 *
 * `hook` names the `data-*` hooks the drives read: `data-<hook>-refusal`, `data-<hook>-detail`,
 * `data-<hook>-error="<code>"`.
 */
export default function RefusalBanner({
  error,
  title,
  fallback,
  words,
  detail,
  hook,
  className = 'p-2',
}: {
  error: unknown
  title: string
  /** The words when the door sent no message (api-envelope rule: always a `t()` fallback). */
  fallback: string
  /** The screen's sentence for the code, already translated, or nothing. */
  words?: ReactNode
  /** The door's detail text (free text, isolated as `<bdi>`). */
  detail?: string
  hook: string
  className?: string
}) {
  const code = apiErrorCode(error)
  return (
    <ErrorBanner className={className} title={title} message={apiErrorMessage(error, fallback)}>
      {words && (
        <p className="mt-1 text-xs" {...{ [`data-${hook}-refusal`]: '' }}>
          {words}
        </p>
      )}
      {detail && (
        <p className="mt-1 text-xs" {...{ [`data-${hook}-detail`]: '' }}>
          <bdi>{detail}</bdi>
        </p>
      )}
      {code && (
        <span className="font-mono text-xs" {...{ [`data-${hook}-error`]: code }}>
          <Ltr>{code}</Ltr>
        </span>
      )}
    </ErrorBanner>
  )
}
