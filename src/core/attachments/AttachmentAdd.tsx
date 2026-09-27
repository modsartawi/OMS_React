import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCw, Upload } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import type { AttachmentsPanelWords } from './panel-words'
import {
  ATTACHMENT_ACCEPT,
  attachmentFileRefusal,
  type AttachmentTarget,
  type AttachmentUpload,
} from './upload'
import { uploadsOf, useAttachmentUploads } from './upload-store'

const NO_UPLOADS: AttachmentUpload[] = []

/**
 * **Add** (spec 319's ticket 322, BackOffice 2035; lifted into the shared panel by
 * ticket 326) — for a file sent in by email. Pick as many files as you like (no
 * count cap, C9): each is checked in the browser, a refused one is named with its
 * reason and never sent, and the others go one request each.
 *
 * Drawn only when the caller's gate admits (the slip's: the probe's `categories`
 * holds `CASH_CLOSE`); this component does not read the probe.
 *
 * The files live in the shared upload store (`./upload-store`), outside this
 * component, so a file's `ClientRequestId` outlives the panel. `onStored` runs after
 * each 200 and never on a refusal: the slip's re-reads the day and marks both grids
 * stale (`markSlipDayChanged`); the order tab re-reads its list.
 *
 * **`captioned`** (ticket 330, the order's Add prescription) is the other mode: ONE file
 * per Add, with an optional caption typed first. The caption rides on the file's item
 * (`clampText`, 200 — the field itself has no `maxLength`, so the ONE clamp trims before
 * it cuts), so a retry sends the same words under the same id, and the field
 * clears once a file the browser admits has been picked. The slip passes nothing and
 * keeps its multi-file, caption-less Add exactly.
 */
export default function AttachmentAdd({
  target,
  captioned = false,
  words,
  onStored,
}: {
  target: AttachmentTarget
  captioned?: boolean
  words: Pick<AttachmentsPanelWords, 'addRegion' | 'addButton' | 'addFailed' | 'addCaptionLabel' | 'addCaptionHint'>
  onStored: () => void
}) {
  const { t } = useTranslation('attachments')
  const items = useAttachmentUploads((s) => uploadsOf(s, target)) ?? NO_UPLOADS
  const add = useAttachmentUploads((s) => s.add)
  const retry = useAttachmentUploads((s) => s.retry)
  const input = useRef<HTMLInputElement>(null)
  const captionId = useId()
  const [caption, setCaption] = useState('')

  const pick = (files: File[]) => {
    if (!captioned) {
      add(target, files, onStored)
      return
    }
    const [file] = files
    add(target, [file], onStored, caption)
    // A file the browser refuses is never sent: keep the words for the next pick.
    if (attachmentFileRefusal(file) === null) setCaption('')
  }

  return (
    <section className="flex flex-col gap-2" data-region="slip-add" aria-label={words.addRegion}>
      {captioned && (
        <div className="flex max-w-xl flex-col gap-1">
          <label htmlFor={captionId} className="text-xs font-medium text-muted-foreground">
            {words.addCaptionLabel}
          </label>
          <input
            id={captionId}
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            dir="auto"
            className="rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
            data-testid="slip-add-caption"
          />
          <span className="text-xs text-muted-foreground">{words.addCaptionHint}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => input.current?.click()} data-testid="slip-add">
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {words.addButton}
        </Button>
        <span className="text-xs text-muted-foreground">{captioned ? t('add.hintOne') : t('add.hint')}</span>
        <input
          ref={input}
          type="file"
          multiple={!captioned}
          accept={ATTACHMENT_ACCEPT}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          data-testid="slip-add-input"
          onChange={(e) => {
            // Copied before the reset: clearing `value` empties the live FileList, and
            // the reset is what lets the same file be picked again as a new capture.
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) pick(files)
          }}
        />
      </div>

      {items.length > 0 && (
        <ul
          className="divide-y divide-border/40 rounded-lg border border-border/60 text-xs"
          aria-live="polite"
          data-testid="slip-uploads"
        >
          {items.map((item) => (
            <UploadRow
              key={item.clientRequestId}
              item={item}
              failed={words.addFailed}
              onRetry={() => retry(target, item.clientRequestId, onStored)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/** One picked file: its name, where it stands, and — only when it can help — Retry. */
function UploadRow({ item, failed, onRetry }: { item: AttachmentUpload; failed: string; onRetry: () => void }) {
  const { t } = useTranslation('attachments')
  return (
    <li className="flex flex-col gap-1 px-3 py-2" data-upload={item.file.name} data-status={item.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="break-all font-medium" dir="auto">
          {item.file.name}
        </span>
        <span className={statusClass(item)} data-cell="status">
          {t(`add.status.${item.status}`)}
        </span>
      </div>

      {item.caption && (
        <span className="break-words text-muted-foreground" dir="auto" data-cell="upload-caption">
          {item.caption}
        </span>
      )}

      {item.status === 'local-refused' && (
        <span className="text-danger-800" data-cell="reason">
          {item.localRefusal === 'size' ? t('add.refusedSize') : t('add.refusedType')}
        </span>
      )}

      {item.status === 'refused' && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          {/* The server's words as sent: English, then Arabic. */}
          <span className="whitespace-pre-line text-danger-800" dir="auto" data-cell="reason">
            {apiErrorMessage(item.error, failed)}
          </span>
          {item.retryable && (
            <Button variant="outlined" onClick={onRetry} data-testid="slip-upload-retry">
              <RotateCw className="h-3.5 w-3.5" aria-hidden />
              {t('add.retry')}
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

function statusClass(item: AttachmentUpload): string {
  if (item.status === 'stored') return 'font-medium text-success-800'
  if (item.status === 'refused' || item.status === 'local-refused') return 'font-medium text-danger-800'
  return 'text-muted-foreground'
}
