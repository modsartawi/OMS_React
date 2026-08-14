import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FileSpreadsheet, TriangleAlert } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type {
  SettlementBulkCommitResult,
  SettlementBulkPreview,
  SettlementEntryKind,
} from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { settlementMoney } from './money-display'
import { batchSearch } from './addresses'
import { amountInWords } from './amount-words'
import { settlementApi } from './api'
import { reviewBulk, type BulkReview, type BulkTotal } from './bulk'
import { inWordsSentence } from './in-words'

/** The two kinds, in the order the toggle draws them — 271's order, because it is
 *  the same choice made once for a whole file. */
const KINDS: readonly SettlementEntryKind[] = ['SHORTAGE', 'SURPLUS']

/** What the file picker offers. The server parses; this only stops an accountant
 *  handing the door a PDF and waiting for a round trip to be told. */
const ACCEPT = '.xlsx,.csv'

/* ⚠️ **`HASH_MISMATCH` stood here until 274 and is gone.** 273 expected the
 * changed-sheet refusal to arrive as an envelope error code; the door answers a 200
 * with `accepted: false` and its own `refusalReason`, which the commit handler reads
 * directly. There is no code to match on because there is no error to match it in. */

/**
 * **The second posting door** — a month's audit, uploaded (ticket 273, spec 267
 * D7). 271's single form is untouched beside it and stays the door for one entry.
 *
 * 🔑 **The input shape is found, not invented.** Finance's monthly audit already
 * ends in a spreadsheet; the alternative — a multi-row grid typed on this screen —
 * would be a shape invented here for finance to re-key *into*.
 *
 * 🔑 **Two calls over the same upload, and what commits is the FILE.** Preview
 * parses and resolves; commit **re-sends the same bytes** with the `batchId` minted
 * at preview. There is no staging table and no client-held row state, so what is
 * posted cannot have diverged from what was reviewed — and a sheet edited in between
 * is refused by the server on its hash.
 *
 * 🔑 **The guard is at two levels, and both are required:**
 *
 * 1. **The preview grid is the row-level guard** — every row with its store code
 *    resolved to a **branch name**, which is what catches the error a number-only
 *    review cannot: the right amount posted onto the wrong branch.
 * 2. **The file's total, in words, at the commit button** — *"47 entries, one
 *    hundred twenty-eight thousand seven hundred riyals"*. This is 271's guard
 *    lifted to the aggregate, and it is what still catches `50,000` typed for `500`.
 *
 * ⚠️ **271's in-words guard does not survive multiplication**, so it is not
 * multiplied: forty in-words lines is a page nobody reads by row forty, which is
 * exactly when it stops guarding. There is deliberately no per-row read-back.
 *
 * 🚩 **No client-side parsing, and no dependency for it.** XLSX and CSV go up as
 * bytes; every figure on this screen came back from the server's own reading of the
 * file.
 */
export default function BulkUploadDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('settlement')
  const queryClient = useQueryClient()

  const [kind, setKind] = useState<SettlementEntryKind>('SHORTAGE')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<SettlementBulkPreview | null>(null)
  const [committed, setCommitted] = useState<SettlementBulkCommitResult | null>(null)
  /** A commit the server refused — its own words, kept on screen beside a way to
   *  preview again. The hash mismatch lands here. */
  const [refusal, setRefusal] = useState<string | null>(null)

  // A fresh door per opening. A preview left over from a dialog someone dismissed
  // describes a file that is no longer on screen, and its `batchId` would commit it.
  useEffect(() => {
    if (!open) return
    setKind('SHORTAGE')
    setFile(null)
    setPreview(null)
    setCommitted(null)
    setRefusal(null)
  }, [open])

  const review = useMemo(() => reviewBulk(preview), [preview])

  const previewCall = useMutation({
    mutationFn: () => settlementApi.bulkPreview(file!, kind),
    onSuccess: (result) => {
      setPreview(result)
      setRefusal(null)
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('bulk.errors.previewFailed'))),
  })

  const commitCall = useMutation({
    mutationFn: () =>
      settlementApi.bulkCommit(file!, preview!.batchId, kind, preview!.contentHash),
    onSuccess: (result) => {
      // 🔑 **274: a refusal arrives HERE, on a 200, not in `onError`.** 273 modelled
      // the changed-sheet case as a business `ApiError`; the door answers
      // `accepted: false` with its own `refusalReason`, exactly as cancel and repair
      // do — the server decided, and a decision is not a crash. Reading `posted`
      // without reading `accepted` would report a refused commit as a successful one.
      if (!result?.accepted) {
        setRefusal(result?.refusalReason || t('bulk.errors.commitRefused'))
        return
      }

      setCommitted(result)
      toast.success(t('bulk.done.toast', { count: result?.posted ?? 0 }))
      // The same fan-out one posted entry causes (271), for the same reason: a
      // month's audit changes every one of these, and a stale door would invite the
      // accountant to post the file again.
      void queryClient.invalidateQueries({ queryKey: ['settlement', 'fleet'] })
      void queryClient.invalidateQueries({ queryKey: ['settlement', 'orphans'] })
      void queryClient.invalidateQueries({ queryKey: ['settlement', 'account'] })
    },
    // ⚠️ **What is left here is a MALFORMED call, not a decision about money** — no
    // file, over 10 MB, an extension outside the allow-list, or bytes that yield no
    // rows. Those are 400s through the envelope.
    //
    // 🚩 **The sentence must not assert the hash.** This client never read the file,
    // so *"it no longer matches the one that was previewed"* is a thing it cannot
    // know — and a 500, a timeout or a dropped connection would have said it anyway.
    // That claim now belongs to the refusal path above, where the SERVER makes it.
    // (269's cap banner made the same correction: a screen may not assert what it
    // can only infer.)
    onError: (error) => setRefusal(apiErrorMessage(error, t('bulk.errors.commitFailed'))),
  })

  /** Back to the file step, keeping the kind: a refused or reconsidered file is
   *  re-previewed, never committed from a `batchId` that describes other bytes. */
  const startOver = () => {
    setPreview(null)
    setRefusal(null)
    setCommitted(null)
  }

  if (!open) return null

  return (
    <Modal
      open
      onClose={onClose}
      title={t('bulk.title')}
      width="64rem"
      footer={
        committed ? (
          <Button variant="primary" onClick={onClose} data-testid="bulk-close">
            {t('bulk.done.close')}
          </Button>
        ) : preview ? (
          <>
            <Button variant="text" onClick={startOver} data-testid="bulk-back">
              {t('bulk.review.back')}
            </Button>
            {/* 🚩 **A refused commit does not re-offer the same button**, which is
                272's ruling on the cancel that lost its race: a button that reappears
                unchanged after a refusal is a button someone presses in a loop. The
                only way on is to preview the file again, and it is offered twice —
                here and on the notice. */}
            <Button
              variant="primary"
              onClick={() =>
                refusal
                  ? startOver()
                  : review.canCommit && !commitCall.isPending && commitCall.mutate()
              }
              aria-disabled={(!refusal && !review.canCommit) || commitCall.isPending || undefined}
              data-testid={refusal ? 'bulk-again-footer' : 'bulk-commit'}
            >
              {/* 🔑 The guard rides ON the button, not above it: the last thing read
                  before the press is what the file is worth, in words. */}
              {refusal ? t('bulk.review.previewAgain') : commitLabel(t, review)}
            </Button>
          </>
        ) : (
          <>
            <Button variant="text" onClick={onClose}>
              {t('bulk.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => file && !previewCall.isPending && previewCall.mutate()}
              aria-disabled={!file || previewCall.isPending || undefined}
              data-testid="bulk-preview"
            >
              {t('bulk.file.preview')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4 text-sm" data-region="bulk-upload">
        {committed ? (
          <CommittedPanel result={committed} batchId={preview?.batchId ?? ''} review={review} />
        ) : preview ? (
          <PreviewStep
            preview={preview}
            review={review}
            refusal={refusal}
            onStartOver={startOver}
          />
        ) : (
          <FileStep
            kind={kind}
            onKind={setKind}
            file={file}
            onFile={setFile}
            busy={previewCall.isPending}
          />
        )}
      </div>
    </Modal>
  )
}

/**
 * Step one: **the kind, then the file.**
 *
 * 🔑 **One kind per file, chosen at the file level** (D7). The sheet carries no kind
 * column, because a mixed file makes the total in words a **net** figure a typo can
 * hide inside — which is the one thing the aggregate guard cannot survive.
 */
function FileStep({
  kind,
  onKind,
  file,
  onFile,
  busy,
}: {
  kind: SettlementEntryKind
  onKind: (next: SettlementEntryKind) => void
  file: File | null
  onFile: (next: File | null) => void
  busy: boolean
}) {
  const { t } = useTranslation('settlement')

  return (
    <>
      <fieldset className="flex flex-col gap-2" data-region="bulk-kind">
        <legend className="text-xs font-medium">{t('bulk.kind.legend')}</legend>
        <div role="group" aria-label={t('bulk.kind.legend')} className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onKind(key)}
              aria-pressed={kind === key}
              data-kind={key}
              className={
                'flex flex-col items-start gap-0.5 rounded-lg border p-3 text-start transition-colors ' +
                (kind === key
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:bg-muted')
              }
            >
              <span className="text-sm font-medium">{t(`post.kind.${key}.consequence`)}</span>
              <span className="text-xs text-muted-foreground">{t(`account.kind.${key}`)}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t('bulk.kind.oneKindPerFile')}</p>
      </fieldset>

      <label className="flex flex-col gap-1" data-region="bulk-file">
        <span className="text-xs font-medium">{t('bulk.file.label')}</span>
        <input
          type="file"
          accept={ACCEPT}
          data-testid="bulk-file"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="rounded-md border border-border bg-card p-2 text-sm file:me-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs"
        />
        <span className="text-xs text-muted-foreground">{t('bulk.file.hint')}</span>
        {file && (
          <span className="text-xs" data-testid="bulk-file-name">
            {t('bulk.file.chosen', { name: file.name })}
          </span>
        )}
        {busy && <span className="text-xs text-muted-foreground">{t('bulk.file.reading')}</span>}
      </label>

      {/* ⚠️ Said before the upload rather than discovered after it: nothing here
          parses the sheet, so the headers are the server's rule and a re-ordered
          sheet is fine while a missing column is not. */}
      <p className="text-xs text-muted-foreground">{t('bulk.file.serverParses')}</p>
    </>
  )
}

/**
 * Step two: **the preview — the row-level guard.**
 *
 * Every parsed row with its store code **resolved to a branch name**, plus kind,
 * amount and reason. Hard errors are enumerated above it and block the whole file;
 * duplicate warnings sit on their own rows and commit anyway.
 */
function PreviewStep({
  preview,
  review,
  refusal,
  onStartOver,
}: {
  preview: SettlementBulkPreview
  review: BulkReview
  refusal: string | null
  onStartOver: () => void
}) {
  const { t } = useTranslation('settlement')

  return (
    <>
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t('bulk.review.summary', {
          rows: review.rows.length,
          // ⚠️ The kind the SERVER echoed back, not the one still sitting in this
          // component's state. They agree today; the echo is the field that can
          // prove it, and *what was reviewed* is the only thing worth stating here.
          kind: t(`account.kind.${preview.entryKind}`),
        })}
      </p>

      {/* 🔑 The content hash **warns and never refuses** — refusing would make a
          genuinely identical repeat unpostable.

          ⚠️ 274: the replay notice is a file-level WARNING carrying the server's own
          sentence, not the structured `replay` object 273 modelled. So it renders as
          data, unlocalised, exactly as every other server sentence on this screen
          does — and any other file-level warning the parser grows lands here too,
          rather than vanishing for want of a row to sit on. */}
      {review.fileNotices.map((notice, i) => (
        <p
          key={i}
          data-testid="bulk-file-notice"
          className="rounded-lg border border-attention-border bg-attention-050 p-3 text-xs text-attention-800"
        >
          {notice}
        </p>
      ))}

      {refusal && (
        <div
          data-testid="bulk-refusal"
          className="flex flex-col items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3"
        >
          <p className="flex items-start gap-1.5 text-xs font-medium text-attention-800">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {refusal}
          </p>
          <p className="text-xs text-muted-foreground">{t('bulk.review.refusedHint')}</p>
          <Button variant="secondary" onClick={onStartOver} data-testid="bulk-again">
            {t('bulk.review.previewAgain')}
          </Button>
        </div>
      )}

      {/* 🔑 **All-or-nothing.** The bad rows are enumerated, finance fixes the sheet
          and re-uploads — deliberately stricter than the seed's insert-all-blind
          precedent, because a seed row is inert and a posted entry is money someone
          will be asked for. */}
      {review.blockers.length > 0 && (
        <section
          data-testid="bulk-blockers"
          data-blocker-count={review.blockers.length}
          className="flex flex-col gap-1 rounded-lg border border-attention-border bg-attention-050 p-3"
        >
          <p className="flex items-start gap-1.5 text-xs font-medium text-attention-800">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('bulk.review.blocked', { count: review.blockers.length })}
          </p>
          <ul className="flex flex-col gap-0.5 text-xs">
            {review.blockers.map((b, i) => (
              <li key={`${b.rowNumber}-${b.code}-${i}`} data-blocker-row={b.rowNumber}>
                {/* ⚠️ 274 replaced the guessed `column` with the server's own machine
                    `code`, which is not a sentence and is not shown — the server's
                    `message` already reads as one, and a code beside it would be
                    noise to an accountant fixing a spreadsheet. The ticket's open
                    question — *"a missing required header must refuse naming what it
                    expected"* — is answered by that message, which names it. */}
                {b.source === 'unresolved'
                  ? t('bulk.review.unresolved', { row: b.rowNumber, code: b.storeCode })
                  : b.rowNumber === 0
                    ? t('bulk.review.fileError', { message: b.message })
                    : t('bulk.review.rowError', {
                        row: b.rowNumber,
                        message: b.message,
                      })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.disagreement && (
        <p className="text-xs text-attention-800" data-testid="bulk-disagree">
          {/* Drawn with `formatMoneyIn`, like every other figure here: a comparison
              panel rendering its two sums through a second money path is the one
              place a difference could be an artefact of the rendering. */}
          {t('bulk.review.disagree', {
            server: settlementMoney(review.disagreement.server, review.totals[0]?.currencyKey),
            rows: settlementMoney(review.disagreement.rows, review.totals[0]?.currencyKey),
          })}
        </p>
      )}

      <div className="max-h-[24rem] overflow-auto rounded-lg border border-border/60">
        <table className="w-full text-xs" data-testid="bulk-rows">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-start font-medium">{t('bulk.columns.row')}</th>
              <th className="px-2 py-1.5 text-start font-medium">{t('bulk.columns.store')}</th>
              <th className="px-2 py-1.5 text-start font-medium">{t('bulk.columns.storeName')}</th>
              <th className="px-2 py-1.5 text-end font-medium">{t('bulk.columns.amount')}</th>
              <th className="px-2 py-1.5 text-start font-medium">{t('bulk.columns.reason')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {review.rows.map((row) => {
              const warnings = review.warningsByRow[row.rowNumber] ?? []
              const unresolved = !row.storeName.trim()
              return (
                <tr
                  key={row.rowNumber}
                  data-row={row.rowNumber}
                  data-unresolved={unresolved ? 'true' : undefined}
                  data-warned={warnings.length ? 'true' : undefined}
                  className={unresolved || warnings.length ? 'bg-attention-050' : undefined}
                >
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{row.rowNumber}</td>
                  <td className="px-2 py-1.5 font-mono">{row.storeCode}</td>
                  {/* 🔑 The resolved NAME — the whole reason this grid exists. An
                      unresolvable code says so in words rather than leaving a blank
                      cell to skim past. */}
                  <td className="px-2 py-1.5" dir="auto">
                    {row.storeName.trim() || (
                      <span className="text-attention-800">{t('bulk.review.noBranch')}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-end tabular-nums">
                    {settlementMoney(row.amount, row.currencyKey)} {row.currencyKey}
                  </td>
                  <td className="px-2 py-1.5" dir="auto">
                    {row.reason}
                    {warnings.map((w, i) => (
                      <span key={i} className="mt-0.5 block text-attention-800">
                        {w}
                      </span>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 🚩 Warnings are counted here and refused a veto: the batch must never be
          stricter than the single form, or a real second shortage months apart
          becomes unpostable by file. */}
      {review.warnedRows > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="bulk-warned">
          {t('bulk.review.warned', { count: review.warnedRows })}
        </p>
      )}

      {/* 🔑 The aggregate guard, stated in full above the button that carries it. */}
      <TotalInWords totals={review.totals} rows={review.rows.length} />
    </>
  )
}

/**
 * 🔑 **The file's total, read back in words** — 271's guard lifted to the aggregate.
 *
 * One fat-fingered row moves the total by two orders of magnitude, and the sentence
 * says so where the digits do not: `128,700.50` and `178,700.50` are one keystroke
 * apart to the eye.
 *
 * ⚠️ **One sentence per currency, never a sum across them** (D10). A riyal added to
 * a dinar is a figure wrong in both, and it would be drawn at whichever precision
 * the caller guessed.
 */
function TotalInWords({ totals, rows }: { totals: BulkTotal[]; rows: number }) {
  const { t } = useTranslation('settlement')
  if (totals.length === 0) return null

  return (
    <section
      data-testid="bulk-total"
      className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3"
    >
      {totals.map((total) => {
        const words = amountInWords(total.total, total.currencyKey)
        return (
          <div key={total.currencyKey} className="flex flex-col gap-0.5">
            <p className="text-xl font-semibold tabular-nums" data-currency={total.currencyKey}>
              {t('bulk.review.totalFigure', {
                count: total.rowCount,
                amount: words.grouped,
                currency: total.currencyKey,
              })}
            </p>
            <p className="text-sm" data-testid="bulk-total-words">
              {inWordsSentence(t, words, total.currencyKey)}
            </p>
            {/* ⚠️ A bucket of rows the answer named no currency for. It is drawn
                rather than dropped — a figure missing from the read-back is the
                guard failing open — and it says what it does not know. */}
            {!total.currencyKey && (
              <p className="text-xs text-attention-800" data-testid="bulk-total-nocurrency">
                {t('bulk.review.noCurrency', { count: total.rowCount })}
              </p>
            )}
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground">{t('bulk.review.totalHint', { count: rows })}</p>
    </section>
  )
}

/** The commit button's own label — the count and the total, so the guard is the last
 *  thing read before the press. Multi-currency files name the count alone; two
 *  totals do not fit on a button and both are stated in full above it. */
function commitLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  review: BulkReview,
): string {
  if (!review.canCommit) return t('bulk.review.commitBlocked')
  const only = review.totals.length === 1 ? review.totals[0] : null
  // A file in two currencies has two totals and no single sentence; both are read
  // back in full in the panel above, and the button counts what it can.
  if (!only) return t('bulk.review.commit', { count: review.rows.length })
  return t('bulk.review.commitWithTotal', {
    count: review.rows.length,
    // 🔑 **In WORDS, on the button** — the ticket puts the guard at the control, not
    // merely on the screen: the last thing read before the press is the sentence,
    // because the digits are what a fat-fingered row hides in.
    words: inWordsSentence(t, amountInWords(only.total, only.currencyKey), only.currencyKey),
  })
}

/**
 * The confirmation — **the batch, and the way to withdraw it.**
 *
 * 🔑 A replayed commit says so plainly: *these were already posted, nothing was
 * doubled*. It is the answer to a second tab, and the one outcome that would
 * otherwise read as a month posted twice.
 */
function CommittedPanel({
  result,
  batchId,
  review,
}: {
  result: SettlementBulkCommitResult
  batchId: string
  review: BulkReview
}) {
  const { t } = useTranslation('settlement')
  const [searchParams] = useSearchParams()
  const numbers = result?.entryNumbers ?? []

  return (
    <section className="flex flex-col gap-2" data-region="bulk-done" data-batch={batchId}>
      <p className="text-lg font-semibold" data-testid="bulk-done-count">
        {t('bulk.done.posted', { count: result?.posted ?? 0 })}
      </p>
      {result?.replayed && (
        <p className="text-sm text-attention-800" data-testid="bulk-done-replayed">
          {t('bulk.done.replayed')}
        </p>
      )}
      {review.totals.map((total) => (
        <p key={total.currencyKey} className="text-sm tabular-nums">
          {t('bulk.review.totalFigure', {
            count: total.rowCount,
            amount: settlementMoney(total.total, total.currencyKey),
            currency: total.currencyKey,
          })}
        </p>
      ))}
      {numbers.length > 0 && (
        <p className="text-xs text-muted-foreground" data-testid="bulk-done-numbers">
          {t('bulk.done.numbers', { numbers: numbers.join(', ') })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('bulk.done.immutable')}</p>
      {/* 🚩 The withdrawal is an ADDRESS, so *"finance sent the wrong file"* is still
          one repair an hour and a reload later. */}
      {batchId && (
        <Link
          to={batchSearch(searchParams, batchId)}
          data-testid="bulk-done-withdraw"
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          {t('bulk.done.withdraw')}
        </Link>
      )}
    </section>
  )
}
