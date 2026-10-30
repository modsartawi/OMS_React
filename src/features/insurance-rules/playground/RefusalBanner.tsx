import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { DeniedCard } from '@/core/insurance-rules/parts'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'

/**
 * A playground door's failure, said one way everywhere (the Outcome, Compare's B side, the Flatten panel): a bare 403
 * is the no-access words (`deniedWords` in a banner, else the playground's no-access card); any other failure is the
 * server's message under `title`, with its machine code (if any) isolated in a chip the drives find by `data-<codeHook>`.
 */
export default function RefusalBanner({
  error,
  title,
  fallback,
  codeHook = 'refusal-code',
  deniedWords,
}: {
  error: unknown
  title: string
  fallback: string
  codeHook?: string
  deniedWords?: string
}) {
  if (isBareDenial(error)) {
    return deniedWords ? <ErrorBanner className="p-3" message={deniedWords} /> : <DeniedCard ns="insurance-playground" hook="playground-denied" />
  }
  const code = apiErrorCode(error)
  return (
    <ErrorBanner className="p-3" title={title} message={apiErrorMessage(error, fallback)}>
      {code && (
        <span className="text-xs" {...{ [`data-${codeHook}`]: code }}>
          <Ltr>{code}</Ltr>
        </span>
      )}
    </ErrorBanner>
  )
}
