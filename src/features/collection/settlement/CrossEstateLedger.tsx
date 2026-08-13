import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { formatMoneyIn } from '@/core/money'
import type { SettlementLedgerRow } from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import { batchSearch, branchSearch } from './addresses'
import { AccountCapBanner, AccountShimmer } from './AccountStates'
import { settlementApi } from './api'
import { GRID_PAGE_SIZE, LEDGER_LIMIT, isCapReached } from './cap'
import { ledgerFigures } from './figures'
import {
  EMPTY_LEDGER_CRITERIA,
  hasLedgerCriteria,
  readLedgerCriteria,
  writeLedgerCriteria,
  type LedgerCriteria,
} from './ledger'
import { buildLedgerColumns } from './ledger-columns'

/**
 * The **flat cross-estate ledger** — the door's support view (ticket 270, spec 267
 * D2), reached from the ageing lane's *way through* and from nowhere else.
 *
 * It answers one question: *"find entry 143, whichever branch it is on."*
 *
 * ⚠️ **It is explicitly not the account, and the design says so twice.** A row here
 * is an entry torn out of its branch, so this view can state what an entry *is* but
 * never what a branch's position *is* — it can only assert a total nobody owes and
 * nobody consumes. Its figures are therefore rendered as **report figures**, and
 * every row is a link back to 269's account, which is the only view that holds a
 * position.
 *
 * **Filter-first and capped**, like the four collection inquiries: nothing is
 * fetched until a criterion is set, `LEDGER_LIMIT` bounds the answer, and the
 * banner fires when it bites.
 */
export default function CrossEstateLedger() {
  const { t } = useTranslation('settlement')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // 🚩 **The committed criteria live in the URL**, so the ageing lane's link
  // (`?view=ledger&status=OPEN`) arrives on an answer rather than on an empty form,
  // a found entry is a pasteable address, and pressing Back out of the account a row
  // opened brings the same search back instead of a blank filter and a fresh
  // estate-wide query. Only the DRAFT — what is typed but not yet submitted — is
  // component state, because a query per keystroke is not an address.
  const criteria = useMemo(() => readLedgerCriteria(searchParams), [searchParams])
  const [draft, setDraft] = useState<LedgerCriteria>(criteria)

  const enabled = hasLedgerCriteria(criteria)
  const ledger = useQuery({
    queryKey: ['settlement', 'ledger', criteria],
    queryFn: () => settlementApi.ledger(criteria),
    enabled,
  })

  const rows = useMemo(() => ledger.data ?? [], [ledger.data])
  const figures = useMemo(() => ledgerFigures(rows), [rows])
  const columns = useMemo(() => buildLedgerColumns(t), [t])
  const capReached = isCapReached(rows.length, LEDGER_LIMIT)

  const set = (patch: Partial<LedgerCriteria>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <section className="flex flex-col gap-4" data-region="cross-estate-ledger">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t('ledger.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('ledger.notTheAccount')}</p>
      </header>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setSearchParams(writeLedgerCriteria(searchParams, draft))
        }}
      >
        <Field label={t('ledger.criteria.entryNumber')}>
          <input
            value={draft.entryNumber}
            onChange={(e) => set({ entryNumber: e.target.value })}
            inputMode="numeric"
            data-testid="ledger-entry-number"
            className="h-8 w-28 rounded-md border border-border bg-card px-2 text-sm outline-none focus:border-primary/60"
          />
        </Field>
        <Field label={t('ledger.criteria.storeId')}>
          <input
            value={draft.storeId}
            onChange={(e) => set({ storeId: e.target.value })}
            data-testid="ledger-store"
            className="h-8 w-28 rounded-md border border-border bg-card px-2 text-sm outline-none focus:border-primary/60"
          />
        </Field>
        <Field label={t('ledger.criteria.entryKind')}>
          <select
            value={draft.entryKind}
            onChange={(e) => set({ entryKind: e.target.value as LedgerCriteria['entryKind'] })}
            className="h-8 rounded-md border border-border bg-card px-2 text-sm outline-none focus:border-primary/60"
          >
            <option value="">{t('ledger.criteria.any')}</option>
            <option value="SHORTAGE">{t('account.kind.SHORTAGE')}</option>
            <option value="SURPLUS">{t('account.kind.SURPLUS')}</option>
          </select>
        </Field>
        {/* 🔑 273's batch handle. An uploaded month is reachable an hour later
            because every entry carries its `batchId` — the lookup answers *"which
            entries did that file post"* without a door of its own. */}
        <Field label={t('ledger.criteria.batchId')}>
          <input
            value={draft.batchId}
            onChange={(e) => set({ batchId: e.target.value })}
            data-testid="ledger-batch"
            className="h-8 w-40 rounded-md border border-border bg-card px-2 text-sm outline-none focus:border-primary/60"
          />
        </Field>
        <Field label={t('ledger.criteria.status')}>
          <select
            value={draft.status}
            onChange={(e) => set({ status: e.target.value as LedgerCriteria['status'] })}
            data-testid="ledger-status"
            className="h-8 rounded-md border border-border bg-card px-2 text-sm outline-none focus:border-primary/60"
          >
            <option value="">{t('ledger.criteria.any')}</option>
            <option value="OPEN">{t('account.status.OPEN')}</option>
            <option value="CONSUMED">{t('account.status.CONSUMED')}</option>
            <option value="CANCELLED">{t('account.status.CANCELLED')}</option>
            <option value="CLOSED_OUT">{t('account.status.CLOSED_OUT')}</option>
          </select>
        </Field>
        <Button type="submit" variant="secondary">
          {t('ledger.criteria.search')}
        </Button>
        <Button
          type="button"
          variant="text"
          onClick={() => {
            setDraft(EMPTY_LEDGER_CRITERIA)
            setSearchParams(writeLedgerCriteria(searchParams, EMPTY_LEDGER_CRITERIA))
          }}
        >
          {t('ledger.criteria.clear')}
        </Button>
      </form>

      {/* …and once a batch IS the filter, the act it licenses is one link away:
          withdrawing the whole file is 273's own repair for *finance sent the wrong
          one*. It is offered on the criterion, not on a row — a batch is withdrawn
          as a unit or not at all. */}
      {criteria.batchId && rows.length > 0 && (
        <Link
          to={batchSearch(searchParams, criteria.batchId)}
          data-testid="ledger-withdraw-batch"
          className="w-fit text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          {t('ledger.withdrawBatch', { count: rows.length })}
        </Link>
      )}

      {ledger.isError && (
        <ErrorBanner
          message={apiErrorMessage(ledger.error, t('ledger.errors.loadFailed'))}
          className="p-3"
        />
      )}

      {!enabled ? (
        // 🔑 Filter-first, said out loud: an unfiltered ledger would be the
        // 1394-branch list this whole design refused, arriving through the back door.
        <p className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
          {t('ledger.filterFirst')}
        </p>
      ) : ledger.isPending ? (
        <AccountShimmer label={t('ledger.loading')} />
      ) : (
        <>
          {capReached && (
            <AccountCapBanner
              message={t('ledger.capReached', { limit: LEDGER_LIMIT.toLocaleString('en-US') })}
            />
          )}

          {rows.length === 0 ? (
            <p className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
              {t('ledger.empty')}
            </p>
          ) : (
            <>
              <div className="min-h-[24rem]">
                <AgGridReact<SettlementLedgerRow>
                  theme={omsGridTheme}
                  rowData={rows}
                  columnDefs={columns}
                  defaultColDef={{
                    sortable: true,
                    resizable: true,
                    filter: 'agTextColumnFilter',
                    floatingFilter: true,
                    cellDataType: false,
                  }}
                  rowHeight={OMS_GRID_ROW_HEIGHT}
                  headerHeight={OMS_GRID_HEADER_HEIGHT}
                  animateRows={false}
                  getRowId={(p) => p.data.settlementEntryId}
                  // 🔑 Every row is a way through to the branch's own account — the
                  // one view that can state a position. This grid states none.
                  onRowClicked={(e) =>
                    e.data &&
                    navigate(branchSearch(searchParams, e.data.storeId, e.data.entryNumber))
                  }
                  pagination
                  paginationPageSize={GRID_PAGE_SIZE}
                  paginationPageSizeSelector={false}
                  {...omsGridDirection}
                />
              </div>

              {/* 🚩 A REPORT FIGURE: per currency, two magnitudes, never netted, and
                  never a claim on anybody. See `ledger.ts`. */}
              <div
                data-region="ledger-figures"
                className="flex flex-col gap-1 text-xs text-muted-foreground"
              >
                {figures.map((f) => (
                  <p key={f.currencyKey} className="tabular-nums">
                    {t('ledger.figure', {
                      currency: f.currencyKey,
                      rows: f.rowCount,
                      open: f.openCount,
                      shortage: formatMoneyIn(f.shortageTotal, f.currencyKey),
                      surplus: formatMoneyIn(f.surplusTotal, f.currencyKey),
                    })}
                  </p>
                ))}
                <p>{t('figures.notActionable')}</p>
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
