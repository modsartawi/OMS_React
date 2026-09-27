import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ban, Download, FileText } from 'lucide-react'

import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'
import type { StoredAttachment, WithdrawnAttachment } from '@/core/models/attachment'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { saveBlob } from '@/core/util/download-file'
import AttachmentAdd from './AttachmentAdd'
import AttachmentSourceText from './AttachmentSourceText'
import AttachmentWithdrawDialog from './AttachmentWithdrawDialog'
import {
  attachmentContentKey,
  attachmentContentQuery,
  attachmentsByOwnerKey,
  attachmentsByOwnerQuery,
  type AttachmentFreshness,
} from './api'
import type { AttachmentsPanelWords } from './panel-words'
import { attachmentContentFailure, attachmentPreviewKind, attachmentSource, wallClockText } from './rules'
import type { AttachmentTarget } from './upload'
import type { WithdrawClosingAnswer, WithdrawReason } from './withdraw'

/**
 * **An owner's files** (spec 319's tickets 321–323, lifted into `core/` by ticket 326)
 * — the body the ECR-slip drawer draws, and (from 327) the order page's Attachments
 * tab. It lists, previews and downloads, adds, and withdraws.
 *
 * What the caller decides, and hands in:
 * - `target`: the owner kind and key, and the category and kind an Add files as;
 * - `freshness`: how often ByOwner is read (every ByOwner writes an audit row);
 * - `reasons`: the withdraw reasons as data, in the order shown;
 * - `words`: every sentence that names what the files are (`AttachmentsPanelWords`);
 * - `addOffered` / `withdrawOffered`: the caller's gates, from the one shared probe.
 *   A bare 403 on a withdraw takes Withdraw away for the rest of this panel's life,
 *   and that stays in here;
 * - `onChanged`: the owner's files changed (an Add's 200, a withdraw's 200 or 404).
 *   🚩 The caller re-reads ByOwner there (`attachmentsByOwnerKey`) along with anything
 *   else it counts. The panel does not re-read after an Add or a withdraw, so the two
 *   never ask twice; it re-reads by itself only after a `/Content` 404, as it always has.
 *
 * Key it by the owner: a new owner starts on a fresh selection and a fresh grant.
 *
 * 🔑 **Object URLs are revoked on every exit**: a new selection unmounts the old
 * preview (it is keyed by the file) and leaving unmounts the lot, and each preview
 * revokes its own URL on the way out. **No file is ever selected for you**, so no
 * `/Content` is read before a click.
 *
 * The test hooks keep their spec 319 names — `data-testid`/`data-region` `slip-*`,
 * `data-slip`, `data-cell="till"`: the four slip drives read them, and those drives
 * pass unedited. Rename none of them without a hook parameter the slip keeps.
 */
export default function AttachmentsPanel({
  target,
  freshness,
  reasons,
  words,
  addOffered,
  withdrawOffered,
  onChanged,
}: {
  target: AttachmentTarget
  freshness: AttachmentFreshness
  reasons: readonly WithdrawReason[]
  words: AttachmentsPanelWords
  addOffered: boolean
  withdrawOffered: boolean
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const { ownerKind, ownerKey } = target
  const list = useQuery(attachmentsByOwnerQuery({ ownerKind, ownerKey }, freshness))

  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** The file name of a file that answered 404 — withdrawn since the list was read. */
  const [goneName, setGoneName] = useState<string | null>(null)

  // Withdraw (323): the file whose dialog is open, what the last one came to, and
  // whether the server refused the grant the probe claimed (a bare 403). That
  // refusal takes the action away for this panel; the caller keys it by the owner,
  // so another owner starts from the probe again.
  const [withdrawing, setWithdrawing] = useState<StoredAttachment | null>(null)
  const [notice, setNotice] = useState<WithdrawNotice | null>(null)
  const [withdrawRefused, setWithdrawRefused] = useState(false)
  const canWithdraw = withdrawOffered && !withdrawRefused

  // A selection that is no longer in the list (re-read after a 404) previews nothing.
  const selected = list.data?.stored.find((s) => s.attachmentId === selectedId) ?? null

  const select = (id: string) => {
    setSelectedId(id)
    setGoneName(null)
    setNotice(null)
  }

  /**
   * A withdraw that closed its dialog. On a 200 or a 404 the file's preview goes
   * (its object URL is revoked as it unmounts, and its bytes leave the cache), and
   * the caller is told (`onChanged`), which re-reads ByOwner so a 200 moves the file
   * under Withdrawn (n). A bare 403 takes the action away.
   */
  const onWithdrawSettled = (file: StoredAttachment, answer: WithdrawClosingAnswer, error: unknown) => {
    setWithdrawing(null)
    setGoneName(null)
    setNotice({
      answer,
      fileName: file.fileName,
      serverMessage: answer === 'gone' ? apiErrorMessage(error, '') || null : null,
    })
    if (answer === 'forbidden') {
      setWithdrawRefused(true)
      return
    }
    if (selectedId === file.attachmentId) setSelectedId(null)
    queryClient.removeQueries({ queryKey: attachmentContentKey(file.attachmentId) })
    onChanged()
  }

  // 404: say so, drop the selection (its preview unmounts and revokes), re-read ByOwner.
  const onGone = useCallback(
    (file: StoredAttachment) => {
      setGoneName(file.fileName)
      setSelectedId(null)
      void queryClient.invalidateQueries({ queryKey: attachmentsByOwnerKey({ ownerKind, ownerKey }) })
    },
    [queryClient, ownerKind, ownerKey],
  )

  return (
    <div className="flex flex-col gap-4">
      {addOffered && <AttachmentAdd target={target} words={words} onStored={onChanged} />}
      {notice && <WithdrawNoticeLine notice={notice} words={words} />}
      {list.isPending ? (
        <PanelShimmer label={words.loading} />
      ) : list.isError ? (
        <ListError error={list.error} words={words} />
      ) : (
        <PanelLists
          stored={list.data.stored}
          withdrawn={list.data.withdrawn}
          selected={selected}
          goneName={goneName}
          words={words}
          onSelect={select}
          onGone={onGone}
          onWithdraw={canWithdraw ? setWithdrawing : undefined}
        />
      )}
      {withdrawing && (
        <AttachmentWithdrawDialog
          key={withdrawing.attachmentId}
          file={withdrawing}
          reasons={reasons}
          words={words}
          onClose={() => setWithdrawing(null)}
          onSettled={(answer, error) => onWithdrawSettled(withdrawing, answer, error)}
        />
      )}
    </div>
  )
}

/**
 * The loading shimmer: the Collections grids' `ListShimmer`, drawn here because
 * `core/` may not import a feature (the same local copy `bonus-buy-inquiry`,
 * `idoc-inspector` and `retail-invoice` keep).
 */
function PanelShimmer({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label={label}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

/**
 * What the panel says once a withdraw has closed its dialog (323). `serverMessage` is
 * a 404's own words, shown as sent under the panel's sentence; a bare 403 has none.
 */
type WithdrawNotice = { answer: WithdrawClosingAnswer; fileName: string; serverMessage: string | null }

/** A withdraw's outcome, said in the panel once its dialog has closed. */
function WithdrawNoticeLine({
  notice,
  words,
}: {
  notice: WithdrawNotice
  words: Pick<AttachmentsPanelWords, 'withdrawGone' | 'withdrawForbidden'>
}) {
  const { t } = useTranslation('attachments')
  if (notice.answer === 'withdrawn')
    return (
      <p
        role="status"
        className="rounded-lg border border-success-border bg-success-050 p-3 text-sm text-success-800"
        data-testid="slip-withdraw-notice"
        data-answer={notice.answer}
      >
        {t('withdraw.done', { fileName: notice.fileName })}
      </p>
    )
  return (
    <div role="status" className="whitespace-pre-line" data-testid="slip-withdraw-notice" data-answer={notice.answer}>
      {notice.answer === 'gone' && notice.serverMessage ? (
        // The panel's sentence, and the server's own words under it, as sent.
        <ErrorBanner title={words.withdrawGone(notice.fileName)} message={notice.serverMessage} className="p-3" />
      ) : (
        <ErrorBanner
          message={notice.answer === 'gone' ? words.withdrawGone(notice.fileName) : words.withdrawForbidden}
          className="p-3"
        />
      )}
    </div>
  )
}

/** ByOwner's refusal, said as the grids say theirs. */
function ListError({
  error,
  words,
}: {
  error: unknown
  words: Pick<AttachmentsPanelWords, 'listRefused' | 'listFailed'>
}) {
  // A bare 403 is the door's grant filter: the probe said yes, the door says no.
  // Said as a refusal, as the grids say it, rather than "unexpected error (HTTP 403)".
  const refused = error instanceof ApiError && error.statusCode === 403
  return (
    <div data-testid="slip-list-error">
      <ErrorBanner message={refused ? words.listRefused : apiErrorMessage(error, words.listFailed)} className="p-3" />
    </div>
  )
}

/** The list, the Withdrawn (n) section under it, and the preview beside them. */
function PanelLists({
  stored,
  withdrawn,
  selected,
  goneName,
  words,
  onSelect,
  onGone,
  onWithdraw,
}: {
  stored: StoredAttachment[]
  withdrawn: WithdrawnAttachment[]
  selected: StoredAttachment | null
  goneName: string | null
  words: AttachmentsPanelWords
  onSelect: (id: string) => void
  onGone: (file: StoredAttachment) => void
  /** Open the withdraw dialog for a file. Absent when this session may not withdraw (323). */
  onWithdraw?: (file: StoredAttachment) => void
}) {
  const { t } = useTranslation('attachments')
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        {goneName && (
          <div data-testid="slip-gone">
            <ErrorBanner message={t('preview.gone', { fileName: goneName })} className="p-3" />
          </div>
        )}

        {stored.length === 0 ? (
          <p className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground" data-testid="slip-empty">
            {words.empty}
          </p>
        ) : (
          <StoredList
            files={stored}
            selectedId={selected?.attachmentId ?? null}
            sourceColumn={words.sourceColumn}
            onSelect={onSelect}
          />
        )}

        {withdrawn.length > 0 && <WithdrawnList files={withdrawn} />}
      </div>

      <section className="min-w-0" aria-label={words.previewRegion} data-region="slip-preview">
        {selected ? (
          <Preview key={selected.attachmentId} file={selected} words={words} onGone={onGone} onWithdraw={onWithdraw} />
        ) : (
          stored.length > 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {words.noSelection}
            </p>
          )
        )}
      </section>
    </div>
  )
}

/** The STORED files, newest first as sent: file name, uploaded at, source. */
function StoredList({
  files,
  selectedId,
  sourceColumn,
  onSelect,
}: {
  files: StoredAttachment[]
  selectedId: string | null
  sourceColumn: string
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation('attachments')
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-xs" data-testid="slip-list">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-start font-medium">{t('columns.fileName')}</th>
            <th className="px-2 py-1.5 text-start font-medium">{t('columns.storedAt')}</th>
            <th className="px-2 py-1.5 text-start font-medium">{sourceColumn}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {files.map((file) => {
            const current = file.attachmentId === selectedId
            return (
              <tr key={file.attachmentId} data-slip={file.attachmentId} className={current ? 'bg-primary/10' : undefined}>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(file.attachmentId)}
                    aria-pressed={current}
                    dir="auto"
                    className="break-all text-start font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {file.fileName}
                  </button>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums" data-cell="storedAt">
                  {wallClockText(file.storedAt)}
                </td>
                <td className="px-2 py-1.5" data-cell="till">
                  <AttachmentSourceText source={attachmentSource(file)} />
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
 * file and nothing here holds a handle to its bytes (C6). The reason is the
 * SERVER's two labels, English beside Arabic, never a client table.
 */
function WithdrawnList({ files }: { files: WithdrawnAttachment[] }) {
  const { t } = useTranslation('attachments')
  return (
    <details className="rounded-lg border border-border/60" data-testid="slip-withdrawn">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
        {t('withdrawn.title', { n: files.length })}
      </summary>
      <ul className="divide-y divide-border/40 border-t border-border/60 text-xs">
        {files.map((file) => (
          <li key={file.attachmentId} className="flex flex-col gap-0.5 px-3 py-2" data-withdrawn={file.attachmentId}>
            <span className="break-all font-medium" dir="auto">
              {file.fileName}
            </span>
            <span className="text-muted-foreground" data-cell="till">
              <AttachmentSourceText source={attachmentSource(file)} />
            </span>
            <span data-cell="withdrawn">
              {t('withdrawn.by', { by: file.withdrawnBy, at: wallClockText(file.withdrawnAt) })}
            </span>
            <span data-cell="reason">
              {t('withdrawn.reason', { label: file.reasonLabel, labelArabic: file.reasonLabelArabic })}
            </span>
            {file.note && (
              <span className="text-muted-foreground" data-cell="note" dir="auto">
                {t('withdrawn.note', { note: file.note })}
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
 * One selected file: its bytes fetched once through `api.blob`, shown as an image
 * or a PDF frame, and a Download that saves that same blob under `fileName`.
 *
 * - **404 `NOT_FOUND`**: withdrawn meanwhile. The panel says so, drops this preview
 *   and re-reads.
 * - **502 `FILE_SERVER_MISSING`**: the File Server lost the file. Said plainly as
 *   not the user's fault, with the server's own words under it, and no retry.
 * - Anything else: the server's message as sent (English, then Arabic).
 *
 * **Withdraw** (323) sits beside Download, for the file being looked at, whether
 * its bytes came back or not: an unreadable or lost file is withdrawn too. It shows
 * only when `onWithdraw` is given, which means the caller's gate admits and the
 * server has not refused the grant in this panel.
 */
function Preview({
  file,
  words,
  onGone,
  onWithdraw,
}: {
  file: StoredAttachment
  words: Pick<AttachmentsPanelWords, 'previewLoading' | 'previewAlt' | 'previewFailed'>
  onGone: (file: StoredAttachment) => void
  onWithdraw?: (file: StoredAttachment) => void
}) {
  const { t } = useTranslation('attachments')
  const content = useQuery(attachmentContentQuery(file.attachmentId))
  const failure = content.isError ? attachmentContentFailure(apiErrorCode(content.error)) : null

  useEffect(() => {
    if (failure === 'gone') onGone(file)
  }, [failure, onGone, file])

  const blob = content.data?.blob ?? null
  const kind = blob ? attachmentPreviewKind(blob.type) : 'none'
  // Only a previewable blob needs a URL; Download makes its own through `saveBlob`.
  const url = useObjectUrl(kind === 'none' ? null : blob)

  return (
    <div className="flex flex-col gap-3" data-preview-for={file.attachmentId} data-preview-kind={blob ? kind : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="break-all" dir="auto">
            {file.fileName}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {onWithdraw && (
            <Button
              variant="danger-outlined"
              onClick={() => onWithdraw(file)}
              aria-label={t('withdraw.buttonLabel', { fileName: file.fileName })}
              data-testid="slip-withdraw"
            >
              <Ban className="h-3.5 w-3.5" aria-hidden />
              {t('withdraw.button')}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => blob && saveBlob(file.fileName, blob)}
            disabled={!blob}
            data-testid="slip-download"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            {t('preview.download')}
          </Button>
        </div>
      </div>

      {content.isPending && <PanelShimmer label={words.previewLoading} />}

      {failure === 'lost' && (
        <div data-testid="slip-lost">
          <ErrorBanner
            title={t('preview.lost')}
            message={apiErrorMessage(content.error, words.previewFailed)}
            className="p-3"
          />
        </div>
      )}

      {failure === 'other' && (
        <div data-testid="slip-preview-error">
          <ErrorBanner message={apiErrorMessage(content.error, words.previewFailed)} className="p-3" />
        </div>
      )}

      {blob && kind === 'image' && url && (
        <img
          src={url}
          alt={words.previewAlt(file.fileName)}
          className="max-h-[70vh] w-full rounded-lg border border-border/60 object-contain"
        />
      )}

      {blob && kind === 'pdf' && url && (
        <iframe
          src={url}
          title={words.previewAlt(file.fileName)}
          className="h-[70vh] w-full rounded-lg border border-border/60"
        />
      )}

      {blob && kind === 'none' && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-testid="slip-no-preview">
          {t('preview.none')}
        </p>
      )}
    </div>
  )
}
