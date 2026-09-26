import { useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RotateCw, Upload } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import { slipAccessQuery } from './api'
import { SLIP_ACCEPT, type SlipUpload } from './slip-upload'
import { useSlipUploads } from './slip-upload-store'
import { canSeeSlips } from './slips'

const NO_UPLOADS: SlipUpload[] = []

/**
 * **Add slip** (ticket 322, BackOffice 2035) — for a slip a store emailed in. Any
 * day's drawer takes it, a `0` included, and a collected Collections row as readily
 * as a Ready row (no collection cutoff, C3).
 *
 * Shown only when the ONE shared probe's `categories` holds `CASH_CLOSE`
 * (`canSeeSlips`, the answer that shows the column). Pick as many files as you like
 * (no count cap, C9): each is checked in the browser, a refused one is named with
 * its reason and never sent, and the others go one request each.
 *
 * The files live in `./slip-upload-store`, outside this component, so a file's
 * `ClientRequestId` outlives the drawer.
 */
export default function SlipAdd({ ownerKey }: { ownerKey: string }) {
  const { t } = useTranslation('collection')
  const access = useQuery(slipAccessQuery())
  const queryClient = useQueryClient()
  const items = useSlipUploads((s) => s.byOwner[ownerKey]) ?? NO_UPLOADS
  const add = useSlipUploads((s) => s.add)
  const retry = useSlipUploads((s) => s.retry)
  const input = useRef<HTMLInputElement>(null)

  if (!canSeeSlips(access.data)) return null

  return (
    <section className="flex flex-col gap-2" data-region="slip-add" aria-label={t('slips.add.region')}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => input.current?.click()} data-testid="slip-add">
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {t('slips.add.button')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('slips.add.hint')}</span>
        <input
          ref={input}
          type="file"
          multiple
          accept={SLIP_ACCEPT}
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          data-testid="slip-add-input"
          onChange={(e) => {
            // Copied before the reset: clearing `value` empties the live FileList, and
            // the reset is what lets the same file be picked again as a new capture.
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) add(ownerKey, files, queryClient)
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
              onRetry={() => retry(ownerKey, item.clientRequestId, queryClient)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/** One picked file: its name, where it stands, and — only when it can help — Retry. */
function UploadRow({ item, onRetry }: { item: SlipUpload; onRetry: () => void }) {
  const { t } = useTranslation('collection')
  return (
    <li className="flex flex-col gap-1 px-3 py-2" data-upload={item.file.name} data-status={item.status}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="break-all font-medium" dir="auto">
          {item.file.name}
        </span>
        <span className={statusClass(item)} data-cell="status">
          {t(`slips.add.status.${item.status}`)}
        </span>
      </div>

      {item.status === 'local-refused' && (
        <span className="text-danger-800" data-cell="reason">
          {t(item.localRefusal === 'size' ? 'slips.add.refusedSize' : 'slips.add.refusedType')}
        </span>
      )}

      {item.status === 'refused' && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          {/* The server's words as sent: English, then Arabic. */}
          <span className="whitespace-pre-line text-danger-800" dir="auto" data-cell="reason">
            {apiErrorMessage(item.error, t('slips.add.failed'))}
          </span>
          {item.retryable && (
            <Button variant="outlined" onClick={onRetry} data-testid="slip-upload-retry">
              <RotateCw className="h-3.5 w-3.5" aria-hidden />
              {t('slips.add.retry')}
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

function statusClass(item: SlipUpload): string {
  if (item.status === 'stored') return 'font-medium text-success-800'
  if (item.status === 'refused' || item.status === 'local-refused') return 'font-medium text-danger-800'
  return 'text-muted-foreground'
}
