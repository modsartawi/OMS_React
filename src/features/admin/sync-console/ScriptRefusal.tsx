import { useTranslation } from 'react-i18next'
import { apiErrorCode, apiErrorData, apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { refusedStoreCodes, scriptRefusalKey } from './scripts-helpers'

/**
 * A script door's refusal of a preview (ticket 664), under `title`: its words, its code and, for a
 * refusal that names stores (`UNKNOWN_STORE`, `NOT_ELIGIBLE`, `NOT_EXHAUSTED`), the codes it names.
 * A refusal of the confirm shows under the reason (ReasonDialog); its named stores show here too,
 * through `storesOnly`.
 */
export default function ScriptRefusal({ error, title, storesOnly = false }: { error: unknown; title: string; storesOnly?: boolean }) {
  const { t } = useTranslation('sync-console')
  const code = apiErrorCode(error)
  const codeKey = code ? scriptRefusalKey(code) : null
  const stores = refusedStoreCodes(apiErrorData(error))
  const named =
    stores.length > 0 ? (
      <p className="text-xs" data-script-refused-stores="">
        <span className="text-muted-foreground">{t('scriptSend.refusedStores')} </span>
        {/* One list of machine codes, isolated once as a whole. */}
        <span className="font-mono [overflow-wrap:anywhere]">
          <Ltr>{stores.join(t('list.separator'))}</Ltr>
        </span>
      </p>
    ) : null
  if (storesOnly) return named
  return (
    <div className="flex flex-col gap-1" data-script-preview-error={code ?? ''}>
      {/* Titled: an untitled banner draws no children, and the code and its words must show. */}
      <ErrorBanner className="p-2" title={title} message={apiErrorMessage(error, t('dialog.failedHint'))}>
        {codeKey && <span className="me-2 text-xs">{t(codeKey)}</span>}
        {code && (
          <span className="font-mono text-xs">
            <Ltr>{code}</Ltr>
          </span>
        )}
      </ErrorBanner>
      {named}
    </div>
  )
}
