import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { FileSearch, PackageSearch, TriangleAlert } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { ApiError, apiErrorAttemptId, apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { saveBlob } from '@/core/util/download-file'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import type { InvoiceCandidate } from '@/core/models/retail-invoice'
import ScreenGate from '@/core/ui/ScreenGate'
import { canOpenRetailInvoice, retailInvoiceAccessQuery, retailInvoiceApi } from './api'
import SearchToolbar from './SearchToolbar'
import { buildDownloadActionColumn } from './DownloadAction'
import { fallbackFileName, invoiceRowKey } from './invoice-key'
import { DownloadConfirmDialog, DownloadFailureDialog } from './DownloadDialogs'
import { downloadFailure, type DownloadOutcome } from './download-outcome'
import {
  buildInvoiceColumns,
  buildInvoiceDefaultColDef,
  needsDownloadConfirm,
} from './invoice-columns'
import {
  buildInvoiceSearchParams,
  landingCriteria,
  sameQuery,
  type InvoiceCriteria,
  type InvoiceSearchQuery,
} from './invoice-criteria'

/**
 * Invoices (`/reports/invoice`) — the first screen of the **Reports** area
 * (spec 261). 263 landed the area, the route, the namespace and the gate; **264
 * hangs the screen's content inside it**: one required field, a Search, and a
 * candidate grid. The download on a row is 265's.
 *
 * **Templated on `features/pricing/bonus-buy-inquiry`** — gate → toolbar
 * producing a criteria *draft* that only Search promotes to a query → AG Grid.
 * ⚠️ **Copied, not extracted**: a feature may not import a feature, and spec
 * 249's 244 §1 ruling against a shared inquiry shell stands.
 *
 * 🚩 **Four states, and the first two are not the same state.** "Untouched" (no
 * search has run) says what to type; "no matches" is a *successful answer* — a
 * 200 with `rows: []`, never a 404 — and says no invoice carries that number. A
 * screen that collapsed them would tell a user their number was wrong before
 * they had entered one. The other two are a list (a single match is still a
 * **one-row list**, never an automatic download) and a refusal.
 *
 * ⚠️ **The refusal is the one that gets got wrong.** `Search` re-checks the
 * grant server-side and refuses with a **bare 403 carrying no body at all** — no
 * envelope, no `errorCode` — so `apiErrorCode(err)` is `null` and the generic
 * fallback message is all there is. This screen branches on
 * `statusCode === 403`. An empty grid there would be a lie.
 *
 * **265 hangs the download on the row** — the point of the whole effort. Four
 * states again, and again two of them are easy to merge and must not be: a
 * confirm (this row is not a customer receipt), a pending render (1.5–3 s warm,
 * and ⚠️ **the page must not navigate**), and a failure whose sentence comes from
 * contract §4 — where 🔑 **503 and 504 are different answers**.
 */

/**
 * Where a download has got to, for the ONE row a user is downloading.
 *
 * 🚩 Deliberately one state and not a map keyed by row: a render is a deliberate,
 * 1.5–3 s act on a list that essentially always holds one row (the transaction
 * number is near-unique by construction), and a per-row map would be machinery
 * for a concurrency nobody is asking for. The rest of the screen stays usable
 * throughout regardless — this state disables one button, nothing else.
 *
 * ⚠️ Plain state rather than a react-query mutation, and `attempts` is why: the
 * retry rule is 504's "**once**, then it is an incident", which has to count the
 * attempts a *user* made. Nothing here ever retries by itself — SIS.Api has
 * already retried the internal call twice by the time a 503 arrives.
 */
type DownloadState =
  | { phase: 'idle' }
  | { phase: 'confirm'; row: InvoiceCandidate }
  | { phase: 'pending'; row: InvoiceCandidate }
  | {
      phase: 'failed'
      row: InvoiceCandidate
      /**
       * 🚩 **Consecutive failures of THIS kind**, not attempts made overall — and
       * the difference is the whole of 504's "retry once". A row that hit two
       * recycling hosts (503, 503) and then a hung render has made three
       * attempts, but it has timed out **once**, and the timeout is entitled to
       * its one more go. Counting them together would withdraw the button on the
       * first timeout a user ever saw.
       */
      attempts: number
      outcome: DownloadOutcome
      attemptId: string | null
    }

/** What a retry carries forward: the failure it is retrying, and how many times
 *  that same failure has now happened in a row. */
type PreviousFailure = { outcome: DownloadOutcome; attempts: number }

export default function RetailInvoicePage() {
  const { t } = useTranslation('reports')

  // The live toolbar draft, and the query that has actually been ISSUED. Only
  // Search promotes one to the other, so a half-typed transaction number never
  // fires a request. `null` is "nothing has been searched yet" — the landing
  // state, which is why it is not `{}`.
  const [criteria, setCriteria] = useState<InvoiceCriteria>(landingCriteria)
  const [appliedParams, setAppliedParams] = useState<InvoiceSearchQuery | null>(null)
  // The LOCAL required-field refusal (`invoice-criteria` cannot build params for
  // a blank number), which is why the server's `400 TRX_NUMBER_REQUIRED` stays a
  // defence this client cannot reach.
  const [invalid, setInvalid] = useState(false)

  const search = useQuery({
    queryKey: ['reports', 'retail-invoice', 'search', appliedParams],
    // Non-null by construction: `enabled` below is the same condition, so the fn
    // cannot run with a null query. A `?? { trxNumber: '' }` fallback here would
    // be a blank search that can never fire, sitting where a reader looks to see
    // what IS sent.
    queryFn: () => retailInvoiceApi.search(appliedParams!),
    // 🚩 Nothing fires on mount, and nothing fires until Search: the screen
    // cannot guess a transaction number.
    enabled: appliedParams !== null,
    // A refusal is an answer and an exact-number search is a user action they
    // can repeat — so no automatic second attempt. (Retries on this rail are the
    // server's: SIS.Api already retries the internal render call twice.)
    retry: false,
  })

  const onChange = useCallback((patch: Partial<InvoiceCriteria>) => {
    setCriteria((c) => ({ ...c, ...patch }))
    setInvalid(false)
  }, [])

  const refetch = search.refetch
  const onSearch = useCallback(() => {
    const params = buildInvoiceSearchParams(criteria)
    setInvalid(params === null)

    if (params === null) {
      // 🚩 The refusal clears the ISSUED query too, not just the field. Leaving
      // it would draw "enter a transaction number" over the previous search's
      // rows — a grid of results under a message saying there is nothing to
      // search — and 265 is about to hang a Download on those rows.
      setAppliedParams(null)
      return
    }

    // 🚩 Pressing Search again on the SAME criteria has to re-ask the server.
    // The query key IS the params, so react-query would otherwise answer from
    // cache and a failed search would have no way back: `retry` is off here and
    // `refetchOnWindowFocus` is off app-wide, which would leave a dead button
    // under the error banner until the number changed or the page reloaded.
    if (appliedParams !== null && sameQuery(params, appliedParams)) {
      void refetch()
      return
    }
    setAppliedParams(params)
  }, [appliedParams, criteria, refetch])

  const onReset = useCallback(() => {
    setCriteria(landingCriteria())
    setAppliedParams(null)
    setInvalid(false)
  }, [])

  // ---- 265: the download ----------------------------------------------------
  const [download, setDownload] = useState<DownloadState>({ phase: 'idle' })
  /** Which download owns the state. See `start`. */
  const runId = useRef(0)

  /**
   * Fetch the PDF and save it. ⚠️ **No navigation**: the bytes come back through
   * 262's `api.blob` (a browser navigation cannot send the `X-Web-Client` CSRF
   * header the cookie branch requires, so a plain `<a href>` answers 401) and go
   * to disk through `@/core/util/download-file`'s `saveBlob`. Nothing here opens
   * a tab, an `<iframe>` or an embedded viewer — a preview is a decision nobody
   * has taken.
   */
  const start = useCallback(async (row: InvoiceCandidate, previous: PreviousFailure | null) => {
    // ⚠️ Only the pending row's own button is disabled — the rest of the screen
    // stays usable, which means a user CAN start a second row while the first is
    // rendering. This token is what stops the slower of the two from writing its
    // answer over the faster one's dialog: the newest request owns the state, and
    // an overtaken one lands silently.
    const id = ++runId.current
    setDownload({ phase: 'pending', row })
    try {
      // 🔑 The key is built from the CLICKED ROW, never from user input, and it
      // is three parts — `api.download` names them one by one so a fourth cannot
      // arrive by accident.
      const { blob, filename } = await retailInvoiceApi.download(row)
      // `Content-Disposition` is the filename authority; the contract's shape is
      // the fallback only.
      //
      // 🚩 Saved even when this request has been overtaken. The bytes arrived and
      // the user asked for them; throwing away a rendered PDF because they
      // clicked a second row would be the one outcome nobody wants, and every
      // attempt is journalled server-side either way.
      saveBlob(filename ?? fallbackFileName(row), blob)
      if (runId.current === id) setDownload({ phase: 'idle' })
    } catch (err) {
      if (runId.current !== id) return
      const outcome = downloadFailure(err)
      setDownload({
        phase: 'failed',
        row,
        // Consecutive failures of the SAME kind. A different sentence is a
        // different problem and starts its own count.
        attempts:
          previous && previous.outcome.messageKey === outcome.messageKey
            ? previous.attempts + 1
            : 1,
        outcome,
        // 262's reader. Present on 422/504, where a render was attempted and
        // journalled; null everywhere else.
        attemptId: apiErrorAttemptId(err),
      })
    }
  }, [])

  const onDownload = useCallback(
    (row: InvoiceCandidate) => {
      // 🚩 Confirm, don't prevent. The row stays in the list and the action stays
      // enabled — asking is the only thing the client may do about a row that
      // cannot be rendered (owner ruling, 988).
      if (needsDownloadConfirm(row)) setDownload({ phase: 'confirm', row })
      else void start(row, null)
    },
    [start],
  )

  const closeDownload = useCallback(() => setDownload({ phase: 'idle' }), [])

  const pendingKey = download.phase === 'pending' ? invoiceRowKey(download.row) : null
  /** The failure the dialog is about, read once rather than narrowed at each prop. */
  const failure = download.phase === 'failed' ? download : null

  const defaultColDef = useMemo(() => buildInvoiceDefaultColDef(), [])
  // The action column is rebuilt when the pending row changes so the button it
  // draws is never a frame behind the request it fired. The data columns depend
  // on `t` alone, exactly as they did at 264.
  const columns = useMemo(
    () => [...buildInvoiceColumns(t), buildDownloadActionColumn(t, { pendingKey, onDownload })],
    [t, pendingKey, onDownload],
  )

  const rows: InvoiceCandidate[] = search.data?.rows ?? []
  // ⚠️ A bare 403 carries no body, so there is no code to read — the status is
  // the whole signal. Every other arm of the error table branches on the code.
  const refused = search.error instanceof ApiError && search.error.statusCode === 403

  return (
    <ScreenGate
      query={retailInvoiceAccessQuery()}
      can={canOpenRetailInvoice}
      ns="reports"
      // 🚩 Its own block of the five `access.*` sentences (ticket 296). The area
      // namespace holds TWO gated screens now, and the top-level `access.*`
      // block was this one's copy — so it moved under this screen's own prefix
      // rather than staying the default a third screen would silently inherit.
      keyPrefix="invoice.access"
      title={t('invoice.title')}
      subtitle={t('invoice.subtitle')}
    >
      <SearchToolbar
        criteria={criteria}
        onChange={onChange}
        onSearch={onSearch}
        onReset={onReset}
        invalid={invalid}
      />

      {/* 🚩 The 50-row cap is a TRIPWIRE, not a page size (contract §6.4): on an
          exact-number search `capReached` means the DATA is wrong, so it draws
          one plain line and never a pager. A local `t()` string — collection's
          `CapBanner` lives in another feature and may not be imported, and one
          sentence on a path that should never fire is not a graduation. */}
      {search.data?.capReached === true && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-[0.8125rem] text-attention-800"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t('invoice.capReached')}</span>
        </div>
      )}

      {search.isError && (
        <ErrorBanner
          title={refused ? t('invoice.errors.deniedTitle') : undefined}
          message={
            refused
              ? t('invoice.errors.deniedHint')
              : apiErrorMessage(search.error, t('invoice.errors.searchFailed'))
          }
          className="p-3"
        />
      )}

      {appliedParams === null ? (
        // State 1 — untouched. Not an empty result: nothing has been asked yet.
        <Placeholder
          icon={<FileSearch className="h-8 w-8 text-muted-foreground" aria-hidden />}
          title={t('invoice.landing.title')}
          hint={t('invoice.landing.hint')}
        />
      ) : search.isPending ? (
        <ListShimmer label={t('invoice.loading')} />
      ) : search.isError ? null : rows.length === 0 ? (
        // State 2 — a successful answer that found nothing. A different sentence
        // from an error, and it must read as one.
        <Placeholder
          icon={<PackageSearch className="h-8 w-8 text-muted-foreground" aria-hidden />}
          title={t('invoice.empty.title')}
          hint={t('invoice.empty.hint')}
        />
      ) : (
        // State 3 — a list. ⚠️ Including when it holds exactly one row, which it
        // essentially always will: the client parses one success shape and never
        // acts on a match by itself.
        <div className="min-h-[24rem] flex-1">
          <AgGridReact<InvoiceCandidate>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={defaultColDef}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            groupHeaderHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            {...omsGridDirection}
          />
        </div>
      )}

      {/* 🚩 The confirm names what the row actually is — a cash clearance, a
          training receipt, a parked sale — and then lets the user through. It
          never fires on `Sales`/`Return`. */}
      <DownloadConfirmDialog
        row={download.phase === 'confirm' ? download.row : null}
        t={t}
        onCancel={closeDownload}
        onConfirm={() => {
          if (download.phase === 'confirm') void start(download.row, null)
        }}
      />

      <DownloadFailureDialog
        outcome={failure?.outcome ?? null}
        attemptId={failure?.attemptId ?? null}
        attempts={failure?.attempts ?? 0}
        t={t}
        onClose={closeDownload}
        onRetry={() => {
          // The retry BUTTON, carrying the failure it is retrying: a 503 offers
          // it for as long as the user wants, a 504 offers exactly one more.
          if (failure)
            void start(failure.row, { outcome: failure.outcome, attempts: failure.attempts })
        }}
      />
    </ScreenGate>
  )
}

/** Busy shimmer: a few pulsing placeholder rows, so a search that is running
 *  reads as running rather than as an answer of nothing. */
function ListShimmer({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label={label}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

/** The screen's two wordy states — untouched and no-matches — drawn the same way
 *  and saying different things. Same chrome deliberately: what distinguishes
 *  them is the sentence, not the furniture. */
function Placeholder({
  icon,
  title,
  hint,
}: {
  icon: ReactNode
  title: string
  hint: string
}) {
  return (
    <div className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-2 text-center">
      {icon}
      <div className="text-base font-semibold tracking-tight">{title}</div>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}
