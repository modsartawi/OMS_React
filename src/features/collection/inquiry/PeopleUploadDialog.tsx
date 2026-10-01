import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { englishLine } from './assignment-upload'
import { roleLabelKey } from './people'
import {
  describePeopleIssue,
  peopleCommitOutcome,
  peopleFileRefusalKey,
  previewRole,
  reviewPeopleUpload,
  withPeopleCommitRowErrors,
  type PeopleUploadCommit,
  type PeopleUploadIssue,
  type PeopleUploadPreview,
  type PeopleUploadReview,
  type PeopleUploadRow,
} from './people-upload'
import { PEOPLE_TEMPLATE_COLUMNS, PEOPLE_TEMPLATE_FILENAME, peopleTemplateCsv } from './people-template'

/** What the file picker offers. The server decides; this only saves a round trip for a PDF. */
const ACCEPT = '.xlsx,.csv'

/**
 * **A people file, previewed then committed** (ticket 337, BackOffice 2156) — finance's
 * sheet of StaffId, Name, Role and SupervisorId, upserted onto the roster in one act.
 *
 * 🔑 **The assignment upload dialog's shape** (`AssignmentUploadDialog`, ticket 318),
 * step for step: template and picker, the server's reading of the file row by row,
 * then Apply **re-sends the same file** with the preview's `contentHash`. Nothing here
 * parses the sheet, so what is applied cannot have drifted from what was reviewed.
 *
 * 🔑 **The preview is the guard.** Every row says added / updated / unchanged with its
 * current and new values, and every refused row is named — one refused row and nothing
 * is applied (all or nothing, the server's rule).
 *
 * 🚩 **A re-press must not apply twice on screen.** A press in flight is held by a ref,
 * and an answer from an earlier opening of the dialog is not drawn.
 *
 * ⚠️ **A bare 403 hides the upload.** The session lacks the People tab's grant (or the
 * route lost its cookie marker): the dialog says so in place of the picker, and
 * `onForbidden` takes the button off the tab.
 */
export default function PeopleUploadDialog({
  open,
  onClose,
  nameOf,
  onApplied,
  onForbidden,
}: {
  open: boolean
  onClose: () => void
  /** The roster's resolver the People tab already uses — ONE name source. */
  nameOf: NameOf
  /** Settles the People list on what the server wrote. */
  onApplied: (result: PeopleUploadCommit) => void
  /** A bare 403 on either door. */
  onForbidden: () => void
}) {
  const { t } = useTranslation('collection')

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PeopleUploadPreview | null>(null)
  const [committed, setCommitted] = useState<PeopleUploadCommit | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const committing = useRef(false)
  /** Which opening of the dialog is on screen; an answer from an earlier one is not drawn. */
  const opening = useRef(0)

  useEffect(() => {
    if (!open) return
    opening.current += 1
    setFile(null)
    setPreview(null)
    setCommitted(null)
    setPreviewError(null)
    setRefusal(null)
    setForbidden(false)
    committing.current = false
  }, [open])

  const review = useMemo(() => reviewPeopleUpload(preview), [preview])

  /** `true` when the failure was the BARE 403 — handled by hiding the upload. A 403
   *  envelope that carries a code is a decision with the server's own words, and is
   *  shown as one rather than taking the upload away. */
  const refusedAccess = (error: unknown) => {
    if (!(error instanceof ApiError && error.statusCode === 403) || apiErrorCode(error)) return false
    setForbidden(true)
    onForbidden()
    return true
  }

  /** The 400s, worded: a code this dialog words itself gets its key; anything else is
   *  the English line of the server's own sentence, or the fallback. */
  const failureMessage = (error: unknown, fallbackKey: string) => {
    const key = peopleFileRefusalKey(apiErrorCode(error))
    if (key) return t(`assignment.upload.errors.${key}`)
    return englishLine(apiErrorMessage(error, t(fallbackKey)))
  }

  const previewCall = useMutation({
    mutationFn: (input: { file: File; opening: number }) => collectionApi.peopleUploadPreview(input.file),
    onSuccess: (result, input) => {
      if (input.opening !== opening.current) return
      setPreview(result)
      setPreviewError(null)
      setRefusal(null)
    },
    onError: (error, input) => {
      if (input.opening !== opening.current) return
      if (refusedAccess(error)) return
      setPreviewError(failureMessage(error, 'assignment.upload.errors.previewFailed'))
    },
  })

  const commitCall = useMutation({
    mutationFn: (input: { file: File; contentHash: string; opening: number }) =>
      collectionApi.peopleUploadCommit(input.file, input.contentHash),
    onSuccess: (result, input) => {
      const outcome = peopleCommitOutcome(result)
      // ⚠️ The list is settled even when the dialog was closed mid-apply: the server
      // wrote the roster whether or not anybody is still looking.
      if (outcome === 'applied' || outcome === 'nothingApplied') onApplied(result)
      if (input.opening !== opening.current) return
      switch (outcome) {
        case 'applied':
        case 'nothingApplied':
          setCommitted(result)
          return
        case 'rowErrors': {
          const folded = preview && withPeopleCommitRowErrors(preview, result)
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
    // ⚠️ What lands here is a malformed call or a failed one, never a decision.
    onError: (error, input) => {
      if (input.opening !== opening.current) return
      if (refusedAccess(error)) return
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

  /** Back to the file step — the file is picked AGAIN, never committed on a hash that
   *  describes other bytes (the assignment dialog's ruling). */
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
      title={t('assignment.peopleUpload.title')}
      width="64rem"
      footer={
        committed || forbidden ? (
          <Button variant="primary" onClick={onClose} data-testid="people-upload-close">
            {t('assignment.upload.done.close')}
          </Button>
        ) : preview ? (
          <>
            <Button variant="text" onClick={startOver} data-testid="people-upload-back">
              {t('assignment.upload.review.back')}
            </Button>
            <Button
              variant="primary"
              onClick={() => (refusal ? startOver() : runCommit())}
              aria-disabled={(!refusal && !review.canCommit) || commitCall.isPending || undefined}
              data-testid={refusal ? 'people-upload-again-footer' : 'people-upload-commit'}
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
              data-testid="people-upload-preview"
            >
              {t('assignment.upload.file.preview')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4 text-sm" data-region="people-upload">
        {forbidden ? (
          <ErrorBanner message={t('assignment.peopleUpload.forbidden')} className="p-3" />
        ) : committed ? (
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

      <label className="flex flex-col gap-1" data-region="people-upload-file">
        <span className="text-xs font-medium">{t('assignment.upload.file.label')}</span>
        <input
          type="file"
          accept={ACCEPT}
          data-testid="people-upload-file"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="rounded-md border border-border bg-card p-2 text-sm file:me-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs"
        />
        <span className="text-xs text-muted-foreground">{t('assignment.upload.file.hint')}</span>
        {file && (
          <span className="text-xs" data-testid="people-upload-file-name">
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
 * **The sheet's shape, stated before the upload rather than discovered after it** —
 * above all that a blank cell is a value here, which is the opposite of the assignment
 * file beside it. The column names are the machine names the server matches on, so
 * they are not localised; every sentence around them is.
 */
function TemplateOffer() {
  const { t } = useTranslation('collection')

  return (
    <section
      className="flex flex-col items-start gap-2 rounded-lg border border-border bg-muted/40 p-3"
      data-region="people-upload-template"
    >
      <p className="text-xs font-medium">{t('assignment.peopleUpload.template.title')}</p>
      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {PEOPLE_TEMPLATE_COLUMNS.map((column) => (
          <li key={column} data-column={column}>
            <span className="font-mono text-foreground">{column}</span>
            {' — '}
            {t(`assignment.peopleUpload.template.columns.${column}`)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground" data-testid="people-upload-blank-rule">
        {t('assignment.peopleUpload.template.blank')}
      </p>
      <p className="text-xs text-muted-foreground">{t('assignment.peopleUpload.template.untouched')}</p>
      <Button
        variant="secondary"
        onClick={() => downloadCsv(PEOPLE_TEMPLATE_FILENAME, peopleTemplateCsv())}
        data-testid="people-upload-template-download"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        {t('assignment.upload.template.download')}
      </Button>
    </section>
  )
}

/** Step two: **the preview — every row, current and new, and every refusal named.** */
function PreviewStep({
  review,
  refusal,
  nameOf,
  onStartOver,
}: {
  review: PeopleUploadReview
  refusal: string | null
  nameOf: NameOf
  onStartOver: () => void
}) {
  const { t } = useTranslation('collection')

  const issueText = (issue: PeopleUploadIssue) => {
    const copy = describePeopleIssue(issue, review.rows)
    if (copy.kind === 'server') return copy.message
    return t(`assignment.peopleUpload.issues.${copy.code}`, {
      staffId: copy.staffId,
      role: copy.role,
      supervisorId: copy.supervisorId,
    })
  }

  // A supervisor the same file adds is not on the roster yet: name them from the file.
  // Ids are compared case-insensitively, as the server compares them.
  const fileNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const row of review.rows) if (row.name) names.set(row.staffId.toUpperCase(), row.name)
    return names
  }, [review.rows])
  const supervisorName = (id: string) => {
    const known = nameOf(id)
    return known !== id ? known : (fileNames.get(id.toUpperCase()) ?? id)
  }

  const blocked = Object.entries(review.issuesByRow)

  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground" data-testid="people-upload-summary">
        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t('assignment.peopleUpload.review.summary', {
          count: review.rows.length,
          added: review.added,
          updated: review.updated,
          unchanged: review.unchanged,
        })}
      </p>

      {refusal && (
        <div
          data-testid="people-upload-refusal"
          className="flex flex-col items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3"
        >
          <p className="flex items-start gap-1.5 text-xs font-medium text-attention-800">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {refusal}
          </p>
          <Button variant="secondary" onClick={onStartOver} data-testid="people-upload-again">
            {t('assignment.upload.review.previewAgain')}
          </Button>
        </div>
      )}

      {(blocked.length > 0 || review.fileIssues.length > 0) && (
        <section
          data-testid="people-upload-blockers"
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
        <p className="text-xs text-muted-foreground" data-testid="people-upload-nothing">
          {t('assignment.peopleUpload.review.nothingToApply')}
        </p>
      )}

      {review.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="people-upload-empty">
          {t('assignment.upload.review.empty')}
        </p>
      ) : (
        <div className="max-h-[24rem] overflow-auto rounded-lg border border-border/60">
          <table className="w-full text-xs" data-testid="people-upload-rows">
            <thead className="sticky top-0 bg-card text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.upload.columns.row')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.people.staffId')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.people.displayName')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.people.role')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.people.supervisor')}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t('assignment.upload.columns.outcome')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {review.rows.map((row) => {
                const issues = review.issuesByRow[row.rowNumber] ?? []
                const added = row.change === 'ADDED'
                return (
                  <tr
                    key={row.rowNumber}
                    data-row={row.rowNumber}
                    data-change={row.change}
                    data-refused={issues.length ? 'true' : undefined}
                    className={issues.length ? 'bg-attention-050' : undefined}
                  >
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{row.rowNumber}</td>
                    <td className="px-2 py-1.5 font-mono">{row.staffId}</td>
                    <td className="px-2 py-1.5" data-field="name">
                      <ValueChange
                        before={<span dir="auto">{row.currentName}</span>}
                        after={<span dir="auto">{row.name}</span>}
                        changes={!added && row.nameChanges === true}
                      />
                    </td>
                    <td className="px-2 py-1.5" data-field="role">
                      <ValueChange
                        before={<RoleText role={row.currentRole} />}
                        after={<RoleText role={row.role} />}
                        changes={!added && row.roleChanges === true}
                      />
                    </td>
                    <td className="px-2 py-1.5" data-field="supervisor">
                      <ValueChange
                        before={<Person id={row.currentSupervisorId} nameOf={supervisorName} />}
                        after={<Person id={row.supervisorId} nameOf={supervisorName} />}
                        changes={!added && row.supervisorChanges === true}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <RowOutcome row={row} />
                      {issues.map((issue, i) => (
                        <span
                          key={i}
                          className="block font-medium text-attention-800"
                          data-testid="people-upload-row-issue"
                        >
                          {issueText(issue)}
                        </span>
                      ))}
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
 * One value, current and new. A change reads *was → will be*; a value the file leaves
 * as it is reads as what the person keeps. An added person has no "was", so only the
 * new value is drawn.
 */
function ValueChange({
  before,
  after,
  changes,
}: {
  before: ReactNode
  after: ReactNode
  changes: boolean
}) {
  if (!changes) {
    return <span data-change="none">{after}</span>
  }
  return (
    <span className="flex flex-wrap items-baseline gap-x-1" data-change="changes">
      <span className="text-muted-foreground line-through">{before}</span>
      {/* The arrow reads was → will be, so it follows the text direction. */}
      <span aria-hidden className="inline-block rtl:-scale-x-100">→</span>
      <span className="font-medium">{after}</span>
    </span>
  )
}

/** A role as the roster labels it; a word the server does not know, as the file wrote it. */
function RoleText({ role }: { role: string }) {
  const { t } = useTranslation('collection')
  const cell = previewRole(role)
  if (cell.kind === 'raw') return <span className="font-mono">{cell.text}</span>
  return <>{t(roleLabelKey(cell.role))}</>
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

function RowOutcome({ row }: { row: PeopleUploadRow }) {
  const { t } = useTranslation('collection')
  const key = row.change === 'ADDED' ? 'added' : row.change === 'UPDATED' ? 'updated' : 'unchanged'
  return (
    <span
      className={'block ' + (key === 'unchanged' ? 'text-muted-foreground' : 'font-medium')}
      data-testid="people-upload-row-change"
    >
      {t(`assignment.peopleUpload.review.change.${key}`)}
    </span>
  )
}

/** The Apply button's own label — how many people it writes. */
function commitLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  review: PeopleUploadReview,
): string {
  if (review.nothingToApply) return t('assignment.upload.review.nothingToApplyButton')
  if (!review.canCommit) return t('assignment.upload.review.commitBlocked')
  return t('assignment.peopleUpload.review.commit', { count: review.added + review.updated })
}

/** The outcome. A re-press of an applied file says so plainly. */
function DonePanel({ result }: { result: PeopleUploadCommit }) {
  const { t } = useTranslation('collection')
  const added = result.addedStaffIds ?? []
  const updated = result.updatedStaffIds ?? []

  return (
    <section className="flex flex-col gap-2" data-region="people-upload-done">
      <p className="text-lg font-semibold" data-testid="people-upload-done-count">
        {peopleCommitOutcome(result) === 'applied'
          ? t('assignment.peopleUpload.done.applied', { added: result.added, updated: result.updated })
          : t('assignment.peopleUpload.done.nothing')}
      </p>
      {added.length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="people-upload-done-added">
          {t('assignment.peopleUpload.done.addedIds', { ids: added.join(', ') })}
        </p>
      )}
      {updated.length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="people-upload-done-updated">
          {t('assignment.peopleUpload.done.updatedIds', { ids: updated.join(', ') })}
        </p>
      )}
      {(result.unchanged ?? 0) > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="people-upload-done-unchanged">
          {t('assignment.peopleUpload.done.unchanged', { count: result.unchanged })}
        </p>
      )}
    </section>
  )
}
