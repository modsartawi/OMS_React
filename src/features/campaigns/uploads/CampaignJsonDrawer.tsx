import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { RuleCampaign } from '@/core/models/rule-campaign'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import { SHEET } from '@/core/ui/overlay'

/** One panel of the sheet: a campaign's JSON, or the words for why there is none. */
export interface JsonSide {
  key: string
  /** Shown over the panel when the sheet holds two. */
  label?: string
  campaign: RuleCampaign | null
  /** Said when `campaign` is null. */
  none: string
}

/**
 * A campaign of an upload, read-only: its JSON in the rule language, pretty-printed as HQ composed
 * it — one panel for the read (ticket 530), or the uploaded campaign beside the live one (ticket
 * 532). A campaign of an upload is never edited here — the fix is a new workbook.
 *
 * The frame copies the house side sheet (a feature never imports another): a native `<dialog>`
 * docked to the inline end on the overlay recipe's `SHEET`, with its top layer, focus trap, focus
 * given back and Escape. React state stays the one source of truth for open. The JSON is ONE
 * left-to-right island, in Arabic too.
 */
export default function CampaignJsonDrawer({ id, eyebrow, sides, onClose }: { id: string; eyebrow: string; sides: JsonSide[]; onClose: () => void }) {
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
      data-upload-json={id}
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
      className={'end-0 my-0 me-0 ms-auto h-dvh max-h-dvh max-w-[96vw] border-0 border-s p-0 ' + (sides.length > 1 ? 'w-[84rem] ' : 'w-[44rem] ') + SHEET}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{eyebrow}</span>
            <h2 id={titleId} className="font-mono text-sm font-semibold tracking-tight">
              <Ltr>{id}</Ltr>
            </h2>
          </div>
          <IconButton onClick={onClose} label={t('json.close')} data-upload-json-close="">
            <X className="h-4 w-4" aria-hidden />
          </IconButton>
        </header>
        <div className={'grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 ' + (sides.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
          {sides.map((side) => (
            <section key={side.key} className="flex min-w-0 flex-col gap-1.5" data-upload-json-side={side.key}>
              {side.label && <h3 className="text-xs font-semibold">{side.label}</h3>}
              {side.campaign ? (
                <pre dir="ltr" className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre" data-upload-json-body="">
                  {JSON.stringify(side.campaign, null, 2)}
                </pre>
              ) : (
                <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground" data-upload-json-none="">
                  {side.none}
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </dialog>
  )
}
