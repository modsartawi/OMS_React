import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, FileText, X } from 'lucide-react'

import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'
import type { StoredSlip, WithdrawnSlip } from '@/core/models/collection'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { saveBlob } from '@/core/util/download-file'
import { slipContentQuery, slipsByOwnerKey, slipsByOwnerQuery } from './api'
import { ListShimmer } from './GridStates'
import {
  slipContentFailure,
  slipPreviewKind,
  slipTill,
  wallClockText,
  type SlipDay,
  type SlipTill,
} from './slips'

/**
 * **A store day's slips** (ticket 321, BackOffice 2034 + 2035) — the side drawer a
 * count on Ready or Cash Collections opens. Read-only here: Add is 322's, Withdraw
 * 323's.
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
 * 🔑 **Object URLs are revoked on every exit**: a new selection unmounts the old
 * preview (it is keyed by the slip) and closing unmounts the lot, and each preview
 * revokes its own URL on the way out.
 */
export default function SlipDrawer({ day, onClose }: { day: SlipDay | null; onClose: () => void }) {
  const { t } = useTranslation('collection')
  if (!day) return null
  return (
    <DrawerFrame title={t('slips.drawer.title', { store: day.store, day: day.businessDate })} onClose={onClose}>
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
 */
function DrawerFrame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // The backdrop reports the dialog itself as the target; content never does.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="my-0 me-0 ms-auto h-dvh max-h-dvh w-[64rem] max-w-[96vw] border-0 border-s border-border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/50"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('slips.drawer.close')}
            title={t('slips.drawer.close')}
            data-testid="slip-drawer-close"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </dialog>
  )
}

/** The list, the Withdrawn (n) section under it, and the preview beside them. */
function SlipDayBody({ day }: { day: SlipDay }) {
  const { t } = useTranslation('collection')
  const queryClient = useQueryClient()
  const list = useQuery(slipsByOwnerQuery(day.ownerKey))

  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** The file name of a slip that answered 404 — withdrawn since the list was read. */
  const [goneName, setGoneName] = useState<string | null>(null)

  // A selection that is no longer in the list (re-read after a 404) previews nothing.
  const selected = list.data?.stored.find((s) => s.attachmentId === selectedId) ?? null

  const select = (id: string) => {
    setSelectedId(id)
    setGoneName(null)
  }

  // 404: say so, drop the selection (its preview unmounts and revokes), re-read ByOwner.
  const onGone = useCallback(
    (slip: StoredSlip) => {
      setGoneName(slip.fileName)
      setSelectedId(null)
      void queryClient.invalidateQueries({ queryKey: slipsByOwnerKey(day.ownerKey) })
    },
    [queryClient, day.ownerKey],
  )

  if (list.isPending) return <ListShimmer label={t('slips.drawer.loading')} />

  if (list.isError) {
    // A bare 403 is the door's grant filter: the probe said yes, the door says no.
    // Said as a refusal, as the grids say it, rather than "unexpected error (HTTP 403)".
    const refused = list.error instanceof ApiError && list.error.statusCode === 403
    return (
      <div data-testid="slip-list-error">
        <ErrorBanner
          message={
            refused ? t('slips.drawer.errors.refused') : apiErrorMessage(list.error, t('slips.drawer.errors.loadFailed'))
          }
          className="p-3"
        />
      </div>
    )
  }

  const { stored, withdrawn } = list.data

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        {goneName && (
          <div data-testid="slip-gone">
            <ErrorBanner message={t('slips.drawer.preview.gone', { fileName: goneName })} className="p-3" />
          </div>
        )}

        {stored.length === 0 ? (
          <p className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground" data-testid="slip-empty">
            {t('slips.drawer.empty')}
          </p>
        ) : (
          <SlipList slips={stored} selectedId={selected?.attachmentId ?? null} onSelect={select} />
        )}

        {withdrawn.length > 0 && <WithdrawnList slips={withdrawn} />}
      </div>

      <section className="min-w-0" aria-label={t('slips.drawer.preview.region')} data-region="slip-preview">
        {selected ? (
          <SlipPreview key={selected.attachmentId} slip={selected} onGone={onGone} />
        ) : (
          stored.length > 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t('slips.drawer.preview.pick')}
            </p>
          )
        )}
      </section>
    </div>
  )
}

/** The till cell: the device, or "Web · <uploadedBy>" for a web upload (BackOffice 2035). */
function TillText({ till }: { till: SlipTill }) {
  const { t } = useTranslation('collection')
  if (till.kind === 'device') return <span className="font-mono">{till.device}</span>
  return <>{till.uploadedBy ? t('slips.drawer.webTill', { uploadedBy: till.uploadedBy }) : t('slips.drawer.web')}</>
}

/** The STORED slips, newest first as sent: file name, uploaded at, till. */
function SlipList({
  slips,
  selectedId,
  onSelect,
}: {
  slips: StoredSlip[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation('collection')
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-xs" data-testid="slip-list">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-start font-medium">{t('slips.drawer.columns.fileName')}</th>
            <th className="px-2 py-1.5 text-start font-medium">{t('slips.drawer.columns.storedAt')}</th>
            <th className="px-2 py-1.5 text-start font-medium">{t('slips.drawer.columns.till')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {slips.map((slip) => {
            const current = slip.attachmentId === selectedId
            return (
              <tr key={slip.attachmentId} data-slip={slip.attachmentId} className={current ? 'bg-primary/10' : undefined}>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(slip.attachmentId)}
                    aria-pressed={current}
                    dir="auto"
                    className="break-all text-start font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {slip.fileName}
                  </button>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums" data-cell="storedAt">
                  {wallClockText(slip.storedAt)}
                </td>
                <td className="px-2 py-1.5" data-cell="till">
                  <TillText till={slipTill(slip)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * **Withdrawn (n)**, collapsed, newest withdrawal first (BackOffice 2035). Metadata
 * only: no preview and no download, since `/Content` answers 404 for a withdrawn
 * slip and nothing here holds a handle to its bytes (C6). The reason is the
 * SERVER's two labels, English beside Arabic, never a client table.
 */
function WithdrawnList({ slips }: { slips: WithdrawnSlip[] }) {
  const { t } = useTranslation('collection')
  return (
    <details className="rounded-lg border border-border/60" data-testid="slip-withdrawn">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
        {t('slips.drawer.withdrawn.title', { n: slips.length })}
      </summary>
      <ul className="divide-y divide-border/40 border-t border-border/60 text-xs">
        {slips.map((slip) => (
          <li key={slip.attachmentId} className="flex flex-col gap-0.5 px-3 py-2" data-withdrawn={slip.attachmentId}>
            <span className="break-all font-medium" dir="auto">
              {slip.fileName}
            </span>
            <span className="text-muted-foreground" data-cell="till">
              <TillText till={slipTill(slip)} />
            </span>
            <span data-cell="withdrawn">
              {t('slips.drawer.withdrawn.by', { by: slip.withdrawnBy, at: wallClockText(slip.withdrawnAt) })}
            </span>
            <span data-cell="reason">
              {t('slips.drawer.withdrawn.reason', { label: slip.reasonLabel, labelArabic: slip.reasonLabelArabic })}
            </span>
            {slip.note && (
              <span className="text-muted-foreground" data-cell="note" dir="auto">
                {t('slips.drawer.withdrawn.note', { note: slip.note })}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

/**
 * An object URL for `blob`, revoked when the blob changes and when the preview
 * unmounts. Created in an effect, so StrictMode's second pass makes a fresh URL
 * rather than drawing one its first cleanup already revoked.
 */
function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

/**
 * One selected slip: its bytes fetched once through `api.blob`, shown as an image
 * or a PDF frame, and a Download that saves that same blob under `fileName`.
 *
 * - **404 `NOT_FOUND`**: withdrawn meanwhile. The body says so, drops this preview
 *   and re-reads.
 * - **502 `FILE_SERVER_MISSING`**: the File Server lost the file. Said plainly as
 *   not the user's fault, with the server's own words under it, and no retry.
 * - Anything else: the server's message as sent (English, then Arabic).
 */
function SlipPreview({ slip, onGone }: { slip: StoredSlip; onGone: (slip: StoredSlip) => void }) {
  const { t } = useTranslation('collection')
  const content = useQuery(slipContentQuery(slip.attachmentId))
  const failure = content.isError ? slipContentFailure(apiErrorCode(content.error)) : null

  useEffect(() => {
    if (failure === 'gone') onGone(slip)
  }, [failure, onGone, slip])

  const blob = content.data?.blob ?? null
  const kind = blob ? slipPreviewKind(blob.type) : 'none'
  // Only a previewable blob needs a URL; Download makes its own through `saveBlob`.
  const url = useObjectUrl(kind === 'none' ? null : blob)

  return (
    <div className="flex flex-col gap-3" data-preview-for={slip.attachmentId} data-preview-kind={blob ? kind : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="break-all" dir="auto">
            {slip.fileName}
          </span>
        </p>
        <Button
          variant="secondary"
          onClick={() => blob && saveBlob(slip.fileName, blob)}
          disabled={!blob}
          data-testid="slip-download"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          {t('slips.drawer.preview.download')}
        </Button>
      </div>

      {content.isPending && <ListShimmer label={t('slips.drawer.preview.loading')} />}

      {failure === 'lost' && (
        <div data-testid="slip-lost">
          <ErrorBanner
            title={t('slips.drawer.preview.lost')}
            message={apiErrorMessage(content.error, t('slips.drawer.preview.failed'))}
            className="p-3"
          />
        </div>
      )}

      {failure === 'other' && (
        <div data-testid="slip-preview-error">
          <ErrorBanner message={apiErrorMessage(content.error, t('slips.drawer.preview.failed'))} className="p-3" />
        </div>
      )}

      {blob && kind === 'image' && url && (
        <img
          src={url}
          alt={t('slips.drawer.preview.alt', { fileName: slip.fileName })}
          className="max-h-[70vh] w-full rounded-lg border border-border/60 object-contain"
        />
      )}

      {blob && kind === 'pdf' && url && (
        <iframe
          src={url}
          title={t('slips.drawer.preview.alt', { fileName: slip.fileName })}
          className="h-[70vh] w-full rounded-lg border border-border/60"
        />
      )}

      {blob && kind === 'none' && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="slip-no-preview">
          {t('slips.drawer.preview.none')}
        </p>
      )}
    </div>
  )
}
