import { useTranslation } from 'react-i18next'
import { RotateCcw } from 'lucide-react'
import { apiErrorCode, isBareDenial } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { errorText } from './error-text'

/**
 * A run the door refused (ticket 962; 4281 decision 51): the screen's own title and sentence for its code, in the
 * screen's language, and the code itself. The door's message is English for developers and is not shown. Where a
 * second press may plan, "try again" sends the same request again. A 401 never lands here: `@/core/api` signs out.
 */
export default function RunRefusal({ error, onRetry, retrying }: { error: unknown; onRetry: () => void; retrying: boolean }) {
  const { t } = useTranslation('sourcing-simulator')
  const text = errorText(apiErrorCode(error), isBareDenial(error))
  return (
    <ErrorBanner className="px-3 py-2" title={t(text.titleKey)} message={t(text.bodyKey)}>
      {text.code && (
        <p className="mt-1 text-xs" data-run-error-code={text.code}>
          {t('run.code')}{' '}
          <span className="font-mono">
            <Ltr>{text.code}</Ltr>
          </span>
        </p>
      )}
      {text.retry && (
        <Button variant="secondary" className="mt-2" disabled={retrying} onClick={onRetry} data-run-retry="">
          <RotateCcw className="size-3.5" aria-hidden />
          {t('run.tryAgain')}
        </Button>
      )}
    </ErrorBanner>
  )
}
