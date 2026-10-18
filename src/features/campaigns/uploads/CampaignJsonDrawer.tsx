import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { RuleUploadCampaign } from '@/core/models/rule-upload'
import Ltr from '@/core/ui/Ltr'
import { SHEET } from '@/core/ui/overlay'

/**
 * One campaign of the read, read-only (ticket 530): its JSON in the rule language, pretty-printed
 * as HQ composed it. A campaign of an upload is never edited here — the fix is a new workbook.
 *
 * The frame copies the house side sheet (a feature never imports another): a native `<dialog>`
 * docked to the inline end on the overlay recipe's `SHEET`, with its top layer, focus trap, focus
 * given back and Escape. React state stays the one source of truth for open. The JSON is ONE
 * left-to-right island, in Arabic too.
 */
export default function CampaignJsonDrawer({ campaign, onClose }: { campaign: RuleUploadCampaign; onClose: () => void }) {
  const { t } = useTranslation('campaign-uploads')
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-upload-json={campaign.id}
      onCancel={(e) => {
        e.preventDefault()
        // As core's Modal: Escape belongs to the top dialog, never to one that holds it too.
        e.stopPropagation()
        if (e.target === ref.current) onClose()
      }}
      onClose={() => {
        if (ref.current && !ref.current.open) onClose()
      }}
      // The backdrop reports the dialog itself as the target; content never does.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={'end-0 my-0 me-0 ms-auto h-dvh max-h-dvh w-[44rem] max-w-[96vw] border-0 border-s p-0 ' + SHEET}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{t('json.eyebrow')}</span>
            <h2 id={titleId} className="font-mono text-sm font-semibold tracking-tight">
              <Ltr>{campaign.id}</Ltr>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('json.close')}
            title={t('json.close')}
            data-upload-json-close=""
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {campaign.campaign ? (
            <pre dir="ltr" className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre" data-upload-json-body="">
              {JSON.stringify(campaign.campaign, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">{t('json.none')}</p>
          )}
        </div>
      </div>
    </dialog>
  )
}
