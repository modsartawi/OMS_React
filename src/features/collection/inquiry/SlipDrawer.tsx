import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { X } from 'lucide-react'

import AttachmentsPanel from '@/core/attachments/AttachmentsPanel'
import { READ_ON_EVERY_OPENING, attachmentAccessQuery } from '@/core/attachments/api'
import type { AttachmentsPanelWords } from '@/core/attachments/panel-words'
import { SHEET } from '@/core/ui/overlay'
import { uploadInFlight, uploadsOf, useAttachmentUploads } from '@/core/attachments/upload-store'
import { slipDayPanelOwner } from './api'
import { canWithdrawSlips, slipWithdrawReasons } from './slip-withdraw'
import { canSeeSlips, slipTarget, type SlipDay } from './slips'

/**
 * **A store day's slips** (ticket 321, BackOffice 2034 + 2035) — the side drawer a
 * count on Ready or Cash Collections opens. It lists, previews and downloads (321),
 * adds (322) and withdraws (323).
 *
 * 🚩 **The drawer primitive is this feature's own.** The app has no shared drawer
 * or sheet, the call-center console's `ConfirmSheet` is another feature's (features
 * never import features), and `layout/` is the composition root rather than a
 * component shelf. So it is built as `AssignmentUploadDialog` is — a component in
 * `collection/inquiry` — on the native `<dialog>` `core/ui/Modal` rests on: the top
 * layer, the focus trap, focus given back to the count that opened it, and Escape.
 * Modal itself draws a centred box and takes no placement, so the frame below is a
 * copy of its contract pinned to the inline end instead.
 *
 * 🔑 **The body is the shared attachments panel** (`@/core/attachments/AttachmentsPanel`,
 * ticket 326) — the list, Withdrawn (n), the preview, Add and Withdraw, which the order
 * page's Attachments tab draws too. What stays here is the slip's: this frame, its
 * title and in-flight guard, and the parameters `SlipDayBody` hands the panel.
 *
 * 🚩 **Not dismissible while a slip is sending** (322): the close button is
 * disabled, and Escape and the backdrop do nothing. A closing drawer forgets its
 * day's settled uploads, and keeps the ones whose `ClientRequestId` still matters.
 */
export default function SlipDrawer({ day, onClose }: { day: SlipDay | null; onClose: () => void }) {
  const { t } = useTranslation('collection')
  const uploads = useAttachmentUploads((s) => (day ? uploadsOf(s, slipTarget(day.ownerKey)) : undefined))
  const clearSettled = useAttachmentUploads((s) => s.clearSettled)
  const busy = uploadInFlight(uploads)
  if (!day) return null
  const close = () => {
    if (busy) return
    clearSettled(slipTarget(day.ownerKey))
    onClose()
  }
  return (
    <DrawerFrame
      title={t('slips.drawer.title', { store: day.store, day: day.businessDate })}
      onClose={close}
      busy={busy}
    >
      {/* Keyed by the day, so a second day opens on a fresh selection. */}
      <SlipDayBody key={day.ownerKey} day={day} />
    </DrawerFrame>
  )
}

/**
 * The frame: `core/ui/Modal`'s contract (Escape and a backdrop click both dismiss,
 * and React state stays the one source of truth for open), pinned to the inline
 * end at full height. `ms-auto` rather than a physical side, so it opens on the
 * left in Arabic.
 *
 * `busy` holds it open: the browser may still close a modal dialog on a repeated
 * Escape however the cancel is refused, so a native close while busy re-opens it.
 */
function DrawerFrame({
  title,
  onClose,
  busy,
  children,
}: {
  title: string
  onClose: () => void
  busy: boolean
  children: ReactNode
}) {
  const { t } = useTranslation('collection')
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
      data-region="slip-drawer"
      // A cancel from the withdraw dialog over the drawer (323) reaches here too, since
      // React bubbles it up the component tree. Only the drawer's own Escape closes it.
      onCancel={(e) => {
        e.preventDefault()
        if (e.target === ref.current) onClose()
      }}
      onClose={() => {
        const dialog = ref.current
        if (!dialog || dialog.open) return
        if (busy) dialog.showModal()
        else onClose()
      }}
      // The backdrop reports the dialog itself as the target; content never does.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className={'my-0 me-0 ms-auto h-dvh max-h-dvh w-[64rem] max-w-[96vw] border-0 border-s p-0 ' + SHEET}
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t('slips.drawer.close')}
            title={busy ? t('slips.add.busy') : t('slips.drawer.close')}
            data-testid="slip-drawer-close"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  )
}

/**
 * A day's body: the shared attachments panel (`@/core/attachments`, ticket 326), with
 * the slip's parameters — its owner and codes (`slipTarget`), a new read on every
 * opening, its five client reasons, its own words, and the gates the grids read off
 * the one shared probe. A change re-reads the day and marks both grids stale.
 */
function SlipDayBody({ day }: { day: SlipDay }) {
  const { t } = useTranslation('collection')
  const queryClient = useQueryClient()
  const access = useQuery(attachmentAccessQuery())
  const reasons = useMemo(() => slipWithdrawReasons((key) => t(key)), [t])
  const words = useMemo(() => slipPanelWords(t), [t])
  const { target, onChanged } = slipDayPanelOwner(queryClient, day.ownerKey)
  return (
    <AttachmentsPanel
      target={target}
      freshness={READ_ON_EVERY_OPENING}
      reasons={reasons}
      words={words}
      addOffered={canSeeSlips(access.data)}
      withdrawOffered={canWithdrawSlips(access.data)}
      onChanged={onChanged}
    />
  )
}

/** The slip's words for the panel — every sentence that says "slip", "day" or "drawer". */
function slipPanelWords(t: TFunction<'collection'>): AttachmentsPanelWords {
  return {
    loading: t('slips.drawer.loading'),
    empty: t('slips.drawer.empty'),
    listRefused: t('slips.drawer.errors.refused'),
    listFailed: t('slips.drawer.errors.loadFailed'),
    sourceColumn: t('slips.drawer.columns.till'),
    previewRegion: t('slips.drawer.preview.region'),
    noSelection: t('slips.drawer.preview.pick'),
    previewLoading: t('slips.drawer.preview.loading'),
    previewAlt: (fileName) => t('slips.drawer.preview.alt', { fileName }),
    previewFailed: t('slips.drawer.preview.failed'),
    addRegion: t('slips.add.region'),
    addButton: t('slips.add.button'),
    addFailed: t('slips.add.failed'),
    withdrawTitle: t('slips.withdraw.title'),
    withdrawFinal: t('slips.withdraw.final'),
    withdrawNoteRequired: t('slips.withdraw.noteRequired'),
    withdrawConfirm: t('slips.withdraw.confirm'),
    withdrawFailed: t('slips.withdraw.failed'),
    withdrawGone: (fileName) => t('slips.withdraw.gone', { fileName }),
    withdrawForbidden: t('slips.withdraw.forbidden'),
  }
}
