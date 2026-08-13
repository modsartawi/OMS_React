import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Filter } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { formatMoneyIn } from '@/core/money'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import {
  accountRowClass,
  accountRowId,
  buildAccountColumns,
  buildAccountDefaultColDef,
} from './account-columns'
import { accountHeadline, projectAccount, type AccountEntryRow } from './account-projection'
import { settlementApi } from './api'
import { ACCOUNT_LIMIT, GRID_PAGE_SIZE, isCapReached } from './cap'
import { AccountCapBanner, AccountShimmer, ToggleChip } from './AccountStates'
import EntryJournal from './EntryJournal'

/**
 * **The destination** — one branch's whole position, and the history behind every
 * entry (ticket 269).
 *
 * Built before the door (270) deliberately: the door's whole job is to reach this,
 * and a door onto nothing cannot be judged. Structurally `CashCollectionsPage`, so
 * it costs the accountant no new habit — headline, a toolbar row, the grid, and the
 * detail region stacked beneath it.
 *
 * It is a **child component and not inlined markup** for the reason 254 gives: its
 * query must not run for a session the gate is about to refuse, and an element that
 * is never rendered is never mounted.
 */
export default function BranchAccount({ storeId }: { storeId: string }) {
  const { t } = useTranslation('settlement')

  const account = useQuery({
    queryKey: ['settlement', 'account', storeId],
    queryFn: () => settlementApi.account(storeId),
  })

  // 🚩 The selection is an entry ID, not a row object. A refetch hands back new
  // objects, and a selection held by reference would silently drop the journal the
  // reader was looking at — while an id survives, because `accountRowId` is the
  // entry's own.
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(true)

  const rows = useMemo(
    () => (account.data ? projectAccount(account.data) : []),
    [account.data],
  )
  const currencyKey = account.data?.currencyKey ?? ''
  const headline = useMemo(
    () => accountHeadline(account.data?.entries ?? []),
    [account.data],
  )
  const columns = useMemo(() => buildAccountColumns(t, currencyKey), [t, currencyKey])
  const defaultColDef = useMemo(() => buildAccountDefaultColDef(showFilters), [showFilters])

  // 🚩 The journal follows the GRID's selection and nothing else. It used to fall
  // back to `rows[0]` when nothing was selected, which was wrong in the one case it
  // mattered: after the reader sorts, `rows[0]` is no longer the row on top, so the
  // journal would describe an entry that was neither highlighted nor first. The grid
  // selects the first row for itself on arrival (`onRowDataUpdated` below), so the
  // region still lands populated — it just lands populated *and highlighted*.
  const openRow: AccountEntryRow | null =
    rows.find((r) => r.settlementEntryId === openEntryId) ?? null

  const capReached = isCapReached(rows.length, ACCOUNT_LIMIT)

  if (account.isPending) return <AccountShimmer label={t('account.loading')} />

  if (account.isError)
    return (
      <ErrorBanner
        message={apiErrorMessage(account.error, t('account.errors.loadFailed'))}
        className="p-3"
      />
    )

  return (
    <div className="flex flex-col gap-4" data-region="branch-account" data-store={storeId}>
      <AccountHeadline
        // ⚠️ `?? the id we asked for` rather than a bare deref: react-query narrows
        // `data` to non-nullable once the query has settled, but the ENVELOPE can
        // still carry `data: null` on an unsettled contract (D8 is 274's to confirm),
        // and a `.storeId` on that would blank the SPA rather than render an account
        // with nothing in it. The store id is the one field we already know.
        storeId={account.data?.storeId || storeId}
        storeName={account.data?.storeName ?? ''}
        currencyKey={currencyKey}
        headline={headline}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <ToggleChip
          icon={<Filter className="h-3.5 w-3.5" aria-hidden />}
          label={t('account.toolbar.filterRow')}
          pressed={showFilters}
          onToggle={() => setShowFilters((v) => !v)}
        />
      </div>

      {/* The one case where entries really ARE missing, said out loud. It fires on a
          branch that REACHED the door's `TOP`, never on one that is merely busy. */}
      {capReached && (
        <AccountCapBanner
          message={t('account.capReached', { limit: ACCOUNT_LIMIT.toLocaleString('en-US') })}
        />
      )}

      {rows.length === 0 ? (
        // ⚠️ Not an error, and never worded as one: a branch that has never had a
        // settlement entry posted against it is the ordinary case for most of the
        // estate, not a failed lookup.
        <p className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
          {t('account.empty')}
        </p>
      ) : (
        <>
          <div className="min-h-[20rem]">
            <AgGridReact<AccountEntryRow>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={defaultColDef}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              getRowId={accountRowId}
              getRowClass={accountRowClass}
              rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
              // ONE source of truth for which entry the journal is showing: whatever
              // the grid says is selected. A separate click handler would drift from
              // it the first time a selection changed by any other means.
              onSelectionChanged={(e) =>
                setOpenEntryId(e.api.getSelectedNodes()[0]?.data?.settlementEntryId ?? null)
              }
              // …and the grid opens with its first DISPLAYED row selected, so the
              // journal below arrives populated. `getDisplayedRowAtIndex` rather than
              // `rows[0]`: after a sort or a filter those are different entries, and
              // the highlighted one is the one the reader will believe.
              onRowDataUpdated={(e) => {
                if (e.api.getSelectedNodes().length === 0)
                  e.api.getDisplayedRowAtIndex(0)?.setSelected(true)
              }}
              // Paging like the neighbours: 50 a page, in the browser, over the whole
              // account — so sort and the per-column filter row see every entry
              // rather than the visible page.
              pagination
              paginationPageSize={GRID_PAGE_SIZE}
              paginationPageSizeSelector={false}
              {...omsGridDirection}
            />
          </div>

          <EntryJournal row={openRow} currencyKey={currencyKey} />
        </>
      )}
    </div>
  )
}

/**
 * The signed headline and its **two magnitudes**.
 *
 * 🔑 All three figures render, and that is the design rather than a redundancy.
 * Nothing in the model nets a shortage against a surplus — a till consumes one entry
 * of one kind through one document, and the two kinds move through *different*
 * documents in *opposite* directions. The net is a reading aid for one human on one
 * phone call; showing it alone would imply a branch can settle 500 of shortage by
 * keeping 500 of surplus, which no server-side path allows.
 *
 * The direction is a **sentence, not a sign**: `+455.50` needs a convention the
 * reader has to have been told, while *"this branch owes head office"* does not.
 */
function AccountHeadline({
  storeId,
  storeName,
  currencyKey,
  headline,
}: {
  storeId: string
  storeName: string
  currencyKey: string
  headline: ReturnType<typeof accountHeadline>
}) {
  const { t } = useTranslation('settlement')
  const money = (v: number) => formatMoneyIn(v, currencyKey)

  return (
    <section
      data-region="account-headline"
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">{storeName}</h2>
        <span className="font-mono text-[12px] text-muted-foreground">{storeId}</span>
        {/* The currency the figures below are drawn at, named rather than implied —
            three decimals on a Bahraini branch is otherwise indistinguishable from a
            formatting accident (D10). */}
        <span className="text-xs text-muted-foreground">{currencyKey}</span>
      </header>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums">
          {money(Math.abs(headline.signedPosition))}
        </span>
        <span className="text-sm text-muted-foreground">
          {t(`account.position.${headline.direction}`)}
        </span>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('account.headline.shortage')}
          </dt>
          <dd className="tabular-nums">{money(headline.shortageTotal)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('account.headline.surplus')}
          </dt>
          <dd className="tabular-nums">{money(headline.surplusTotal)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('account.headline.openCount')}
          </dt>
          <dd className="tabular-nums">{headline.openCount}</dd>
        </div>
      </dl>

      {/* ⚠️ Said out loud, because a big signed number at the top of a screen is
          exactly the thing someone eventually tries to settle in one act. */}
      <p className="text-xs text-muted-foreground">{t('account.headline.notActionable')}</p>
    </section>
  )
}
