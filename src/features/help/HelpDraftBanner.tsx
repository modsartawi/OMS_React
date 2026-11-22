import { useTranslation } from 'react-i18next'
import { FilePen } from 'lucide-react'
import type { HelpLang } from '@/core/models/help'

/** The Draft banner (oms 951): shown while the area's help is draft (BO config, default draft), nothing once published. */
export default function HelpDraftBanner({ draft, lang }: { draft: boolean; lang: HelpLang }) {
  const { t } = useTranslation('help', { lng: lang })
  if (!draft) return null
  return (
    <div role="status" data-help-draft className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 px-3 py-2 text-sm text-attention-800">
      <FilePen className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <div className="font-semibold">{t('draft.title')}</div>
        <div>{t('draft.body')}</div>
      </div>
    </div>
  )
}
