import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardCopy, FileSpreadsheet } from 'lucide-react'
import ScreenGate from '@/core/ui/ScreenGate'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import {
  CENTRAL_INVOICE_MAX_DELIVERIES,
  canOpenCentralInvoice,
  centralInvoiceAccessQuery,
  isGrantRefused,
} from '@/core/central-invoice/api'
import { RaiseButton, ReasonField, useRaiseCentralInvoice } from '@/core/central-invoice/raise'
import { retryList, verdictTally } from '@/core/central-invoice/verdicts'
import { csvRows, deliveryColumn, fileKind, parseDeliveryList } from './delivery-list'
import { xlsxRows } from './xlsx'
import ResultGrid from './ResultGrid'

/**
 * Raise central invoices in bulk (ticket 332, BackOffice spec 2094 story 2).
 *
 * Paste delivery numbers (or add a CSV/XLSX column of them), give one reason, send; every
 * delivery comes back as a row with its verdict, code and the server's sentence. The
 * refused and *wait* rows copy back out for a later retry.
 *
 * ⚠️ No feature `api.ts`: this screen's only call is `POST Sd/CentralInvoice`, which the
 * delivery page's action makes too, so it lives in `@/core/central-invoice/api` beside
 * the shared probe — a feature may not import another feature.
 *
 * Behind its own grant (`CentralInvoice`), not the OMS one: a user who can open
 * deliveries has no claim on bypassing the pick gate. The gate is the in-page backstop;
 * the endpoint's grant filter is the boundary.
 */
export default function CentralInvoicePage() {
  const { t } = useTranslation('central-invoice')
  return (
    <ScreenGate
      query={centralInvoiceAccessQuery()}
      can={canOpenCentralInvoice}
      ns="central-invoice"
      title={t('bulk.title')}
      subtitle={t('bulk.subtitle')}
    >
      <BulkRaise />
    </ScreenGate>
  )
}

/** What the last file added, said under the list. */
interface FileNote {
  tone: 'info' | 'error'
  text: string
}

function BulkRaise() {
  const { t } = useTranslation('central-invoice')
  const fileInput = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [reason, setReason] = useState('')
  const [fileNote, setFileNote] = useState<FileNote | null>(null)

  const list = useMemo(() => parseDeliveryList(text, CENTRAL_INVOICE_MAX_DELIVERIES), [text])
  const trimmedReason = reason.trim()

  // A 403 revokes the grant for the page life (`useRaiseCentralInvoice`): the gate above
  // re-renders as the denial, and the menu leaf and the delivery page's action go with it.
  const { mutation: raise, send } = useRaiseCentralInvoice()

  const busy = raise.isPending
  const canSend = list.numbers.length > 0 && list.overBy === 0 && trimmedReason !== '' && !busy

  async function addFile(file: File | null) {
    if (!file) return
    const fileName = file.name
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const kind = fileKind(bytes)
      if (kind === 'unsupported') throw new Error('unsupported file')
      const rows = kind === 'xlsx' ? await xlsxRows(bytes) : csvRows(new TextDecoder(kind).decode(bytes))
      const values = deliveryColumn(rows)
      // Counted as the LIST will read them: the list is the one source of truth and splits a
      // cell holding a space or a comma, so the note must not promise fewer than it adds.
      const added = parseDeliveryList(values.join('\n'), Infinity).numbers.length
      if (added === 0) {
        setFileNote({ tone: 'error', text: t('bulk.file.empty', { fileName }) })
        return
      }
      // Appended, not replaced: whatever was already pasted stays, and duplicates collapse.
      setText((prev) => (prev.trim() ? prev.replace(/\s*$/, '\n') : '') + values.join('\n'))
      setFileNote({ tone: 'info', text: t('bulk.file.added', { count: added, fileName }) })
    } catch {
      setFileNote({ tone: 'error', text: t('bulk.file.unreadable', { fileName }) })
    }
  }

  const results = raise.data ?? null
  const retry = results ? retryList(results) : []
  const tally = results ? verdictTally(results) : null

  function copyRetry() {
    const count = retry.length
    // `?.` — a non-secure context (plain http on a test box) has no clipboard at all.
    const write = navigator.clipboard?.writeText(retry.join('\n'))
    if (!write) {
      notify.error(t('results.copyFailed'), t('results.copyFailedDetail'))
      return
    }
    write.then(
      () => notify.success(t('results.copied', { count }), t('results.copiedDetail')),
      () => notify.error(t('results.copyFailed'), t('results.copyFailedDetail')),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="central-invoice-list">
            {t('bulk.list.label')}
          </label>
          <textarea
            id="central-invoice-list"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            rows={8}
            spellCheck={false}
            aria-describedby="central-invoice-list-hint central-invoice-list-count"
            className="w-full rounded-lg border border-input bg-background px-2 py-1.5 font-mono text-[0.8125rem]"
          />
          <p id="central-invoice-list-hint" className="text-xs text-muted-foreground">
            {t('bulk.list.hint')}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span id="central-invoice-list-count" className="font-medium tabular-nums" data-central-invoice-count>
              {t('bulk.list.count', { count: list.numbers.length })}
              {list.duplicates > 0 && (
                <span className="ms-2 font-normal text-muted-foreground">
                  {t('bulk.list.duplicates', { count: list.duplicates })}
                </span>
              )}
            </span>
            <span className="ms-auto flex flex-wrap items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                data-central-invoice-file
                onChange={(e) => {
                  void addFile(e.target.files?.[0] ?? null)
                  // Reset so the same file can be added again after a Clear.
                  e.target.value = ''
                }}
              />
              <Button variant="outlined" disabled={busy} onClick={() => fileInput.current?.click()}>
                <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
                {t('bulk.file.add')}
              </Button>
              <Button
                variant="text"
                disabled={busy || text === ''}
                onClick={() => {
                  setText('')
                  setFileNote(null)
                }}
              >
                {t('bulk.list.clear')}
              </Button>
            </span>
          </div>
          {fileNote && (
            <p
              role={fileNote.tone === 'error' ? 'alert' : 'status'}
              className={'text-xs ' + (fileNote.tone === 'error' ? 'text-danger-800' : 'text-muted-foreground')}
            >
              {fileNote.text}
            </p>
          )}
          {list.overBy > 0 && (
            <ErrorBanner
              className="p-2.5"
              message={t('bulk.list.overCap', { max: CENTRAL_INVOICE_MAX_DELIVERIES, overBy: list.overBy })}
            />
          )}
        </div>

        <ReasonField
          id="central-invoice-bulk-reason"
          value={reason}
          onChange={setReason}
          disabled={busy}
          rows={2}
        />

        {raise.isError && !isGrantRefused(raise.error) && (
          <ErrorBanner
            className="p-2.5"
            title={t('send.failedTitle')}
            message={apiErrorMessage(raise.error, t('send.failed'))}
          />
        )}

        <div className="flex justify-end">
          <RaiseButton
            count={list.numbers.length}
            pending={busy}
            disabled={!canSend}
            onClick={() => send({ deliveryNos: list.numbers, reason: trimmedReason })}
          />
        </div>
      </section>

      {results && tally && (
        <section
          className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3"
          aria-labelledby="central-invoice-results-title"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="central-invoice-results-title" className="text-sm font-semibold tracking-tight">
              {t('results.title')}
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums" data-central-invoice-summary>
              {t('results.summary', { accepted: tally.accepted, wait: tally.wait, refused: tally.refused })}
              {tally.unknown > 0 && <> · {t('results.unknown', { count: tally.unknown })}</>}
            </span>
            <Button
              variant="outlined"
              className="ms-auto"
              disabled={retry.length === 0}
              title={t('results.copyHint')}
              onClick={copyRetry}
            >
              <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
              {t('results.copy', { count: retry.length })}
            </Button>
          </div>
          <ResultGrid rows={results} />
        </section>
      )}
    </div>
  )
}
