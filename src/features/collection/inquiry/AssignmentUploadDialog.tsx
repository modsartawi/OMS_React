import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, FileSpreadsheet, TriangleAlert } from 'lucide-react'

import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'
import { downloadCsv } from '@/core/util/download-file'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import { collectionApi } from './api'
import type { NameOf } from './assignment'
import {
  commitOutcome,
  describeIssue,
  englishLine,
  fileRefusalKey,
  reviewUpload,
  withCommitRowErrors,
  type AssignmentUploadCommit,
  type AssignmentUploadIssue,
  type AssignmentUploadPreview,
  type AssignmentUploadRow,
  type UploadReview,
} from './assignment-upload'
import {
  ASSIGNMENT_TEMPLATE_COLUMNS,
  ASSIGNMENT_TEMPLATE_FILENAME,
  assignmentTemplateCsv,
} from './assignment-template'

/** What the file picker offers. The server decides; this only saves a round trip for a PDF. */
const ACCEPT = '.xlsx,.csv'

/**
 * **An assignment file, previewed then committed** (ticket 318, BackOffice 1996) —
 * finance's own sheet of StoreCode, AccountantId and CollectorId, set on many branches
 * in one act.
 *
 * 🔑 **The settlement bulk upload's shape** (`settlement/BulkUploadDialog`): pick the
 * file, the server reads it back row by row, and Apply **re-sends the same file** with
 * the preview's `contentHash`. Nothing on this side parses the sheet, so what is
 * applied cannot have drifted from what was reviewed — and a sheet edited in between
 * is refused by the server on its hash.
 *
 * 🔑 **The preview is the guard.** Every row says what the branch holds now and what it
 * will hold, in the roster's names, and every refused row is named — one refused row
 * and nothing is applied (all or nothing, the server's rule).
 *
 * 🚩 **A re-press must not apply twice.** The server is idempotent (a second press
 * writes nothing), but a second ANSWER would still overwrite the first on screen and
 * report *nothing needed changing* over a file that just changed forty branches — so a
 * press in flight is held by a ref, which a double-click cannot slip past the way it
 * can slip past a re-render.
 */
export default function AssignmentUploadDialog({
  open,
  onClose,
  nameOf,
  onApplied,
}: {
  open: boolean
  onClose: () => void
  /** The roster's resolver the Branches tab already uses — ONE name source. */
  nameOf: NameOf
  /** Settles the Branches grid on what the server wrote. */
  onApplied: (result: AssignmentUploadCommit) => void
}) {
  const { t } = useTranslation('collection')

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<AssignmentUploadPreview | null>(null)
  const [committed, setCommitted] = useState<AssignmentUploadCommit | null>(null)
  /** A preview that could not be made — the file's fault or the call's. */
  const [previewError, setPreviewError] = useState<string | null>(null)
  /** A commit the server refused, or that failed — kept beside a way to preview again. */
  const [refusal, setRefusal] = useState<string | null>(null)
  const committing = useRef(false)
  /**
   * Which opening of the dialog is on screen. A call carries the opening it was made
   * in, and an answer from an earlier one is not drawn: closing mid-preview and
   * reopening must not land the old file's preview in the fresh door, nor its Apply
   * on a file the door no longer holds.
   */
  const opening = useRef(0)

  // A fresh door per opening: a preview left over from a dismissed dialog describes a
  // file that is no longer on screen, and its hash would commit it.
  useEffect(() => {
    if (!open) return
    opening.current += 1
    setFile(null)
    setPreview(null)
    setCommitted(null)
    setPreviewError(null)
    setRefusal(null)
    committing.current = false
  }, [open])

  const review = useMemo(() => reviewUpload(preview), [preview])

  /** The 400s and the bare 403, worded. A code this screen words itself gets its key;
   *  anything else is the English line of the server's own sentence, or the fallback. */
  const failureMessage = (error: unknown, fallbackKey: string) => {
    if (error instanceof ApiError && error.statusCode === 403) return t('assignment.upload.errors.forbidden')
    const key = fileRefusalKey(apiErrorCode(error))
    if (key) return t(`assignment.upload.errors.${key}`)
    return englishLine(apiErrorMessage(error, t(fallbackKey)))
  }

  const previewCall = useMutation({
    mutationFn: (input: { file: File; opening: number }) =>
      collectionApi.assignmentUploadPreview(input.file),
    onSuccess: (result, input) => {
      if (input.opening !== opening.current) return
      setPreview(result)
      setPreviewError(null)
      setRefusal(null)
    },
    onError: (error, input) => {
      if (input.opening !== opening.current) return
      setPreviewError(failureMessage(error, 'assignment.upload.errors.previewFailed'))
    },
  })

  const commitCall = useMutation({
    mutationFn: (input: { file: File; contentHash: string; opening: number }) =>
      collectionApi.assignmentUploadCommit(input.file, input.contentHash),
    onSuccess: (result, input) => {
      const outcome = commitOutcome(result)
      // ⚠️ The grid is settled even when the dialog was closed mid-apply: the server
      // wrote the branches whether or not anybody is still looking at the dialog.
      if (outcome === 'applied' || outcome === 'nothingApplied') onApplied(result)
      if (input.opening !== opening.current) return
      switch (outcome) {
        case 'applied':
        case 'nothingApplied':
          setCommitted(result)
          return
        case 'rowErrors': {
          // A row gone bad since the preview (a person deactivated, a branch closed):
          // back to the preview, with those rows named on it.
          const folded = preview && withCommitRowErrors(preview, result)
          if (folded) {
            setPreview(folded)
            return
          }
          setRefusal(t('assignment.upload.errors.commitRefused'))
          return
        }
        case 'hashMismatch':
          setRefusal(t('assignment.upload.errors.hashMismatch'))
          return
        default:
          setRefusal(t('assignment.upload.errors.commitRefused'))
      }
    },
    // ⚠️ What lands here is a malformed call or a failed one, never a decision: the
    // sentence must not claim the file changed, which only the server can say.
    onError: (error, input) => {
      if (input.opening !== opening.current) return
      setRefusal(failureMessage(error, 'assignment.upload.errors.commitFailed'))
    },
    onSettled: (_result, _error, input) => {
      if (input.opening === opening.current) committing.current = false
    },
  })

  const runPreview = () => {
    if (!file || previewCall.isPending) return
    setPreviewError(null)
    previewCall.mutate({ file, opening: opening.current })
  }

  const runCommit = () => {
    if (committing.current || !file || !preview || !review.canCommit) return
    committing.current = true
    commitCall.mutate({ file, contentHash: preview.contentHash, opening: opening.current })
  }

  /** Back to the file step. A refused or reconsidered file is previewed again — never
   *  committed on a hash that describes other bytes.
   *
   *  ⚠️ The file is picked AGAIN, not kept: the picker on the file step is a fresh one,
   *  and a handle to a sheet edited on disk since it was picked is one the browser
   *  refuses to read — every "preview again" would fail the same way. */
  const startOver = () => {
    setFile(null)
    setPreview(null)
    setRefusal(null)
    setCommitted(null)
    setPreviewError(null)
  }

  if (!open) return null

  return (
    <Modal
      open
      onClose={onClose}
      title={t('assignment.upload.title')}
      width="64rem"
      footer={
        committed ? (
          <Button variant="primary" onClick={onClose} data-testid="upload-close">
            {t('assignment.upload.done.close')}
          </Button>
        ) : preview ? (
          <>
            <Button variant="text" onClick={startOver} data-testid="upload-back">
              {t('assignment.upload.review.back')}
            </Button>
            {/* A refused commit does not re-offer the same button — the only way on is
                to preview the file again (settlement's 272 ruling). */}
            <Button
              variant="primary"
              onClick={() => (refusal ? startOver() : runCommit())}
              aria-disabled={(!refusal && !review.canCommit) || commitCall.isPending || undefined}
              data-testid={refusal ? 'upload-again-footer' : 'upload-commit'}
            >
              {refusal
                ? t('assignment.upload.review.previewAgain')
                : commitCall.isPending
                  ? t('assignment.upload.review.applying')
                  : commitLabel(t, review)}
            </Button>
          </>
        ) : (
          <>
            <Button variant="text" onClick={onClose}>
              {t('assignment.upload.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={runPreview}
              aria-disabled={!file || previewCall.isPending || undefined}
              data-testid="upload-preview"
            >
              {t('assignment.upload.file.preview')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4 text-sm" data-region="assignment-upload">
        {committed ? (
          <DonePanel result={committed} />
        ) : preview ? (
          <PreviewStep review={review} refusal={refusal} nameOf={nameOf} onStartOver={startOver} />
        ) : (
          <FileStep
            file={file}
            onFile={(next) => {
              setFile(next)
              setPreviewError(null)
            }}
            busy={previewCall.isPending}
            error={previewError}
          />
        )}
      </div>
    </Modal>
  )
}

/** Step one: what the sheet looks like, a blank one to start from, and the file. */
function FileStep({
  file,
  onFile,
  busy,
  error,
}: {
  file: File | null
  onFile: (next: File | null) => void
  busy: boolean
  error: string | null
}) {
  const { t } = useTranslation('collection')

  return (
    <>
      <TemplateOffer />

      <label className="flex flex-col gap-1" data-region="upload-file">
        <span className="text-xs font-medium">{t('assignment.upload.file.label')}</span>
        <input
          type="file"
          accept={ACCEPT}
          data-testid="upload-file"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="rounded-md border border-border bg-card p-2 text-sm file:me-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs"
        />
        <span className="text-xs text-muted-foreground">{t('assignment.upload.file.hint')}</span>
        {file && (
          <span className="text-xs" data-testid="upload-file-name">
            {t('assignment.upload.file.chosen', { name: file.name })}
          </span>
        )}
      </label>

      {busy && (
        <p role="status" aria-label={t('assignment.upload.file.reading')} className="text-xs text-muted-foreground">
          {t('assignment.upload.file.reading')}
        </p>
      )}

      {error && <ErrorBanner message={error} className="p-3" />}
    </>
  )
}

/**
 * **The sheet's shape, stated before the upload rather than discovered after it.**
 *
 * ⚠️ The column names are shown as the machine names the server matches on — like an
 * endpoint path, not copy — so they are not localised; every sentence around them is.
 */
function TemplateOffer() {
  const { t } = useTranslation('collection')

  return (
    <section
      className="flex flex-col items-start gap-2 rounded-lg border border-border bg-muted/40 p-3"
      data-region="upload-template"
    >
      <p className="text-xs font-medium">{t('assignment.upload.template.title')}</p>
      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {ASSIGNMENT_TEMPLATE_COLUMNS.map((column) => (
          <li key={column} data-column={column}>
            <span className="font-mono text-foreground">{column}</span>
            {' — '}
            {t(`assignment.upload.template.columns.${column}`)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t('assignment.upload.template.blank')}</p>
      <Button
        variant="secondary"
        onClick={() => downloadCsv(ASSIGNMENT_TEMPLATE_FILENAME, assignmentTemplateCsv())}
        data-testid="upload-template-download"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        {t('assignment.upload.template.download')}
      </Button>
    </section>
  )
}

/** Step two: **the preview — every row, before and after, and every refusal named.** */
function PreviewStep({
  review,
  refusal,
  nameOf,
  onStartOver,
}: {
  review: UploadReview
  refusal: string | null
  nameOf: NameOf
  onStartOver: () => void
}) {
  const { t } = useTranslation('collection')

  const issueText = (issue: AssignmentUploadIssue) => {
    const copy = describeIssue(issue, review.rows)
    if (copy.kind === 'server') return copy.message
    return t(`assignment.upload.issues.${copy.code}`, {
      store: copy.store,
      staffId: copy.staffId,
      slot: copy.slot ? t(`assignment.bulk.slots.${copy.slot}`) : '',
    })
  }

  const blocked = Object.entries(review.issuesByRow)

  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground" data-testid="upload-summary">
        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t('assignment.upload.review.summary', {
          count: review.rows.length,
          changed: review.changed,
          unchanged: review.unchanged,
        })}
      </p>

      {refusal && (
        <div
          data-testid="upload-refusal"
          className="flex flex-col items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3"
        >
          <p className="flex items-start gap-1.5 text-xs font-medium text-attention-800">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {refusal}
          </p>
          <Button variant="secondary" onClick={onStartOver} data-testid="upload-again">
            {t('assignment.upload.review.previewAgain')}
          </Button>
        </div>
      )}

      {/* 🔑 All or nothing: the refused rows are named above the grid, and each row
          wears its own below — finance fixes the sheet and uploads it again. */}
      {(blocked.length > 0 || review.fileIssues.length > 0) && (
        <section
          data-testid="upload-blockers"
          data-refused-rows={review.refusedRows}
          className="flex flex-col gap-1 rounded-lg border border-attention-border bg-attention-050 p-3"
        >
          <p className="flex items-start gap-1.5 text-xs font-medium text-attention-800">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('assignment.upload.review.blocked', { count: Math.max(review.refusedRows, 1) })}
          </p>
          <ul className="flex flex-col gap-0.5 text-xs">
            {review.fileIssues.map((issue, i) => (
              <li key={`file-${i}`} data-blocker-row={0}>
                {issueText(issue)}
              </li>
            ))}
            {blocked.map(([row, issues]) =>
              issues.map((issue, i) => (
                <li key={`${row}-${i}`} data-blocker-row={row}>
                  {t('assignment.upload.review.rowIssue', { row, message: issueText(issue) })}
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      {review.nothingToApply && (
        <p className="text-xs text-muted-foreground" data-testid="upload-nothing">
          {t('assignment.upload.review.nothingToApply')}
        </p>
      )}

      {review.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="upload-empty">
          {t('assignment.upload.review.empty')}
        </p>
      ) : (
        <div className="max-h-[24rem] overflow-auto rounded-lg border border-border/60">
          <table className="w-full text-xs" data-testid="upload-rows">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.upload.columns.row')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.columns.storeCode')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.columns.storeName')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.columns.accountant')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.columns.collector')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.upload.columns.outcome')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {review.rows.map((row) => {
                const issues = review.issuesByRow[row.rowNumber] ?? []
                return (
                  <tr
                    key={row.rowNumber}
                    data-row={row.rowNumber}
                    data-changes={row.changes === true ? 'true' : undefined}
                    data-refused={issues.length ? 'true' : undefined}
                    className={issues.length ? 'bg-attention-050' : undefined}
                  >
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{row.rowNumber}</td>
                    <td className="px-2 py-1.5 font-mono">{row.storeCode}</td>
                    <td className="px-2 py-1.5" dir="auto">
                      {row.storeName}
                    </td>
                    <td className="px-2 py-1.5" data-slot="accountantId">
                      <SlotChange
                        before={row.currentAccountantId}
                        after={row.accountantId}
                        changes={row.accountantChanges === true}
                        nameOf={nameOf}
                      />
                    </td>
                    <td className="px-2 py-1.5" data-slot="collectorId">
                      <SlotChange
                        before={row.currentCollectorId}
                        after={row.collectorId}
                        changes={row.collectorChanges === true}
                        nameOf={nameOf}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {issues.length > 0 ? (
                        issues.map((issue, i) => (
                          <span
                            key={i}
                            className="block font-medium text-attention-800"
                            data-testid="upload-row-issue"
                          >
                            {issueText(issue)}
                          </span>
                        ))
                      ) : (
                        <RowOutcome row={row} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/**
 * One slot, before and after. A change reads *was → will be*; a slot the file leaves
 * alone (a blank cell, or the same person) reads as what the branch keeps.
 */
function SlotChange({
  before,
  after,
  changes,
  nameOf,
}: {
  before: string
  after: string
  changes: boolean
  nameOf: NameOf
}) {
  if (!changes) {
    return (
      <span className="text-muted-foreground" data-change="none">
        <Person id={after} nameOf={nameOf} />
      </span>
    )
  }
  return (
    <span className="flex flex-wrap items-baseline gap-x-1" data-change="changes">
      <span className="text-muted-foreground line-through">
        <Person id={before} nameOf={nameOf} />
      </span>
      <span aria-hidden>→</span>
      <span className="font-medium">
        <Person id={after} nameOf={nameOf} />
      </span>
    </span>
  )
}

/** A staff id in the roster's name, with the id beside it; `''` reads as nobody. */
function Person({ id, nameOf }: { id: string; nameOf: NameOf }) {
  const { t } = useTranslation('collection')
  if (!(id ?? '').trim()) return <>{t('assignment.nobodyOption')}</>
  const name = nameOf(id)
  return (
    <span dir="auto">
      {name}
      {name !== id && <span className="ms-1 font-mono text-muted-foreground">{id}</span>}
    </span>
  )
}

function RowOutcome({ row }: { row: AssignmentUploadRow }) {
  const { t } = useTranslation('collection')
  return row.changes === true ? (
    <span className="font-medium">{t('assignment.upload.review.changes')}</span>
  ) : (
    <span className="text-muted-foreground">{t('assignment.upload.review.noChange')}</span>
  )
}

/** The Apply button's own label — how many branches it changes, so the count is the
 *  last thing read before the press. */
function commitLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  review: UploadReview,
): string {
  if (review.nothingToApply) return t('assignment.upload.review.nothingToApplyButton')
  if (!review.canCommit) return t('assignment.upload.review.commitBlocked')
  return t('assignment.upload.review.commit', { count: review.changed })
}

/**
 * The outcome. 🔑 A re-press of an applied file says so plainly — nothing needed
 * changing, nothing was re-stamped — rather than reading as a second assignment.
 */
function DonePanel({ result }: { result: AssignmentUploadCommit }) {
  const { t } = useTranslation('collection')
  const codes = result.appliedStoreCodes ?? []

  return (
    <section className="flex flex-col gap-2" data-region="upload-done">
      <p className="text-lg font-semibold" data-testid="upload-done-count">
        {commitOutcome(result) === 'applied'
          ? t('assignment.upload.done.applied', { count: result.applied })
          : t('assignment.upload.done.nothing')}
      </p>
      {codes.length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="upload-done-codes">
          {t('assignment.upload.done.codes', { codes: codes.join(', ') })}
        </p>
      )}
      {(result.unchanged ?? 0) > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="upload-done-unchanged">
          {t('assignment.upload.done.unchanged', { count: result.unchanged })}
        </p>
      )}
    </section>
  )
}
