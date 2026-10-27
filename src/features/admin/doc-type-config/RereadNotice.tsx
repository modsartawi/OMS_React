import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'

/** Shown when the row under an open dialog was re-read and differed: the draft was rebuilt, the edits must be redone
 *  (`use-reread-draft.ts`). */
export default function RereadNotice() {
  const { t } = useTranslation('doc-type-config')
  return (
    <p role="status" className="flex items-center gap-1.5 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-reread="">
      <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {t('edit.reread')}
    </p>
  )
}
