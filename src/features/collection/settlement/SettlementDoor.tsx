import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { RefreshCw, Search, TriangleAlert, Wallet } from 'lucide-react'
import { toast } from 'sonner'

import { apiErrorMessage } from '@/core/api'
import { formatMoneyIn } from '@/core/money'
import type {
  SettlementOrphanRow,
  SettlementScope,
  SettlementUncollectedRow,
} from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  branchSearch,
  ledgerSearch,
  readQuery,
  writeQuery,
} from './addresses'
import { settlementApi } from './api'
import { AccountShimmer } from './AccountStates'
import { criteriaForEntryNumber } from './ledger'
import PostEntryDialog from './PostEntryDialog'
import RepairDialog from './RepairDialog'
import { resolveScope } from './scope'
import { resolveSubmit, searchBranches, type BranchSearchResult } from './search'
import { estateFigures } from './figures'
import { buildWorklist } from './worklist'

/**
 * **The door** — a search box and a triaged worklist (ticket 270, spec 267 D2).
 *
 * 🔑 **Nobody browses 1394 branches.** An accountant arrives with a *branch* in
 * mind (a phone call quoting an entry number) or with *work* in mind, never with a
 * list in mind — so the front page is these two things and never a master–detail
 * over the estate. The branch account (269) is the destination both of them reach.
 *
 * 🔑 **The lanes are ordered by what they cost to read**, which is the finding that
 * makes this screen work: the prototype's untriaged *needs you* list went from 3
 * cards at six branches to ~140 at estate scale, of which 131 were merely ageing,
 * and the four that were actually *wrong* sank into them.
 *
 * ⚠️ **Two searches happen here and they are not the same search.** Branch ranking
 * is client-side over the fleet answer and runs as the accountant types; the entry
 * number goes to the **ledger door** and runs on submit. Keeping the second off the
 * keystroke path is why typing `143` does not issue three lookups for `1`, `14` and
 * `143` — and, since an entry number lookup *navigates*, running it per keystroke
 * would move the screen out from under someone still typing.
 */
export default function SettlementDoor({ scope }: { scope: SettlementScope }) {
  const { t } = useTranslation('settlement')
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // 🚩 The query lives in the URL, 269's `?store=` idiom one screen over: a search
  // an accountant is reading can be pasted into a ticket or sent to a colleague,
  // and the Back button undoes it. `replace` so typing does not bury the previous
  // screen under one history entry per keystroke.
  const query = readQuery(searchParams)
  const setQuery = (next: string) => setSearchParams(writeQuery(searchParams, next), { replace: true })

  // 🚩 **The worklist refreshes MANUALLY, and the ticket's open question is settled
  // here.** Neither door polls: the contents change when a till closes a shift —
  // hours apart, not seconds — and a list whose whole job is triage must not move
  // rows under a reader's cursor while they are deciding which one to repair. The
  // Refresh button is the way, and it is beside the lanes rather than hidden.
  //
  // `staleTime` is what makes *leaving and coming back* free: an accountant opening
  // three accounts from the worklist and returning between each would otherwise
  // re-fetch 1394 rows three times to show numbers that had not changed. A minute is
  // short enough that a refetch after real work is still automatic, and long enough
  // that navigation is not a query.
  const fleet = useQuery({
    queryKey: ['settlement', 'fleet'],
    queryFn: () => settlementApi.fleet(),
    staleTime: 60_000,
  })
  const worklist = useQuery({
    queryKey: ['settlement', 'worklist'],
    queryFn: () => settlementApi.worklist(),
    staleTime: 60_000,
  })

  const resolution = useMemo(() => resolveScope(scope, fleet.data), [scope, fleet.data])
  const results = useMemo(
    () => searchBranches(fleet.data, query, resolution),
    [fleet.data, query, resolution],
  )
  const lanes = useMemo(
    () => buildWorklist(worklist.data, fleet.data, resolution),
    [worklist.data, fleet.data, resolution],
  )
  const figures = useMemo(() => estateFigures(fleet.data), [fleet.data])

  /** What an entry-number search found, once it has been asked. `null` = not asked. */
  const [entryMiss, setEntryMiss] = useState<string | null>(null)
  const [repairing, setRepairing] = useState<SettlementOrphanRow | null>(null)
  /** 271's posting form. It opens with **no branch seeded** from here: the door is
   *  the estate, and the branch is typed into the form itself (D4). */
  const [posting, setPosting] = useState(false)

  // *"There is no entry 9999"* is an answer about a query, so it dies with the
  // query. Left standing, it would sit under the results of the NEXT search and read
  // as a statement about that one.
  useEffect(() => setEntryMiss(null), [query])

  /**
   * Submit — an address, an entry number, or nothing at all.
   *
   * 🔑 Which of the three a query is, is decided in `resolveSubmit` and not here:
   * an **exact branch code wins over an entry number**, because `1001` is both a
   * real code and a real entry number and taking someone who typed their own
   * branch's code to a different branch's account is the worst thing this box could
   * do. An entry number then **jumps straight to that entry's branch account** (the
   * ticket's own words), and one that matches nothing says so — *"no entry 9999"* is
   * the answer to the question that was asked.
   */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEntryMiss(null)
    const intent = resolveSubmit(fleet.data, query, resolution)

    if (intent.kind === 'branch') {
      navigate(branchSearch(searchParams, intent.storeId))
      return
    }
    if (intent.kind !== 'entry') return

    const criteria = criteriaForEntryNumber(intent.entryNumber)
    try {
      const rows = await queryClient.fetchQuery({
        queryKey: ['settlement', 'ledger', criteria],
        queryFn: () => settlementApi.ledger(criteria),
      })
      const hit = rows?.[0]
      // 🔑 The ledger is how an entry number becomes a branch — it is the only door
      // that knows which branch entry 143 is on.
      if (hit) navigate(branchSearch(searchParams, hit.storeId, hit.entryNumber))
      else setEntryMiss(t('search.noEntry', { number: intent.entryNumber }))
    } catch (error) {
      // ⚠️ Caught, because this is the one query on the screen with no component
      // rendering its state: an unhandled rejection here would leave the accountant
      // pressing Enter at a box that silently did nothing.
      toast.error(apiErrorMessage(error, t('search.lookupFailed')))
    }
  }

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['settlement', 'fleet'] })
    void queryClient.invalidateQueries({ queryKey: ['settlement', 'worklist'] })
  }

  return (
    <div className="flex flex-col gap-4" data-region="settlement-door">
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2" role="search">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('search.label')}
            placeholder={t('search.placeholder')}
            data-testid="settlement-search"
            className="h-9 w-full rounded-full border border-border bg-card ps-9 pe-3 text-sm outline-none focus:border-primary/60"
          />
        </div>
        <Button type="submit" variant="secondary">
          {t('search.submit')}
        </Button>
        {query && (
          <Button type="button" variant="text" onClick={() => setQuery('')}>
            {t('search.clear')}
          </Button>
        )}
        {/* 🚩 Posting sits beside the search rather than behind a branch, because an
            accountant arrives with a figure and a branch code, not with a screen they
            have already navigated to. The form types its own branch (D4). */}
        <Button
          type="button"
          variant="primary"
          onClick={() => setPosting(true)}
          data-testid="post-open"
        >
          {t('post.open')}
        </Button>
      </form>

      {fleet.isError && (
        <ErrorBanner
          message={apiErrorMessage(fleet.error, t('door.errors.fleetFailed'))}
          className="p-3"
        />
      )}
      {entryMiss && <p className="text-sm text-muted-foreground">{entryMiss}</p>}

      {fleet.isPending || (!query && worklist.isPending) ? (
        <AccountShimmer label={t('door.loading')} />
      ) : query ? (
        <SearchResults results={results} params={searchParams} />
      ) : (
        <>
          {worklist.isError ? (
            // 🚩 The banner REPLACES the lanes rather than sitting above them. An
            // empty worklist renders the sentence *"nothing needs a human"* — which
            // would be a false statement about orphan money if the door that knows
            // had just failed to answer. A screen may say it does not know; it may
            // not say there is nothing wrong because it could not ask.
            <ErrorBanner
              message={apiErrorMessage(worklist.error, t('door.errors.worklistFailed'))}
              className="p-3"
            />
          ) : (
            <Worklist
              lanes={lanes}
              busy={worklist.isFetching || fleet.isFetching}
              params={searchParams}
              onRefresh={refresh}
              onRepair={setRepairing}
            />
          )}
          <EstateFigures figures={figures} />
        </>
      )}

      <RepairDialog
        row={repairing}
        onClose={() => setRepairing(null)}
        onDone={() => {
          setRepairing(null)
          refresh()
        }}
      />

      <PostEntryDialog open={posting} onClose={() => setPosting(false)} />
    </div>
  )
}

/**
 * The ranked branches for a query.
 *
 * 🔑 **An out-of-scope hit is drawn, and marked.** The scope ranks results; it
 * never refuses one (D2) — so a branch belonging to a colleague, or to nobody, is
 * still one click away and simply says which it is.
 */
function SearchResults({
  results,
  params,
}: {
  results: BranchSearchResult
  params: URLSearchParams
}) {
  const { t } = useTranslation('settlement')
  const { hits, total } = results

  if (total === 0)
    return (
      <p className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
        {t('search.empty')}
      </p>
    )

  return (
    <section data-region="search-results" className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">
        {t('search.showing', { shown: hits.length, total })}
      </p>
      <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card/40">
        {hits.map((hit) => (
          <li key={hit.row.storeId}>
            <Link
              to={branchSearch(params, hit.row.storeId)}
              data-hit={hit.row.storeId}
              data-in-scope={hit.inScope ? 'true' : 'false'}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm hover:bg-muted"
            >
              <span className="font-mono text-[12px] text-muted-foreground">{hit.row.storeId}</span>
              <span className="font-medium">{hit.row.storeName}</span>
              <span className="text-xs text-muted-foreground">{hit.row.city}</span>
              {!hit.inScope && (
                <span className="text-xs text-muted-foreground">
                  {t(`search.assignment.${hit.row.assignment}`)}
                </span>
              )}
              <span className="ms-auto text-xs text-muted-foreground tabular-nums">
                {t('search.openCount', { count: hit.row.openCount })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The three lanes, in the order the ticket's own table gives them. */
function Worklist({
  lanes,
  busy,
  params,
  onRefresh,
  onRepair,
}: {
  lanes: ReturnType<typeof buildWorklist>
  busy: boolean
  params: URLSearchParams
  onRefresh: () => void
  onRepair: (row: SettlementOrphanRow) => void
}) {
  const { t } = useTranslation('settlement')

  return (
    <section data-region="worklist" className="flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t('worklist.title')}</h2>
        {/* ⚠️ Said out loud on the face of the screen, not only in a docblock: the
            two lanes below are estate-wide whatever the scope control says. A reader
            who did not know that would read an empty *mine* scope as an empty
            estate. */}
        <p className="text-xs text-muted-foreground">{t('worklist.estateWide')}</p>
        {/* 🚩 Manual refresh, and the choice is recorded in the ticket: a poll on a
            screen whose whole job is triage would move rows under a reader's cursor
            mid-decision, and the worklist's contents change on a shift close — hours
            apart, not seconds. */}
        <Button
          variant="outlined"
          className="ms-auto"
          onClick={onRefresh}
          aria-disabled={busy || undefined}
          data-testid="worklist-refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden />
          {t('worklist.refresh')}
        </Button>
      </header>

      {lanes.isEmpty && (
        <p className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
          {t('worklist.nothing')}
        </p>
      )}

      {/* ── Wrong money ───────────────────────────────────────────────────────
          🔑 Enumerated in full and first, because it is rare and every row is
          money a branch handed over against a document that will never exist. */}
      {lanes.wrongMoney.length > 0 && (
        <Lane
          tone="attention"
          icon={<TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />}
          lane="wrong-money"
          title={t('worklist.wrongMoney.title', { count: lanes.wrongMoney.length })}
          hint={t('worklist.wrongMoney.hint')}
        >
          {lanes.wrongMoney.map((row) => (
            <li
              key={row.settlementConsumptionId}
              data-orphan={row.settlementConsumptionId}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm"
            >
              <BranchLink
                params={params}
                storeId={row.storeId}
                storeName={row.storeName}
                // The orphan lane knows which entry the money came off, so the row
                // lands the reader on it rather than on the branch's top entry.
                entryNumber={row.entryNumber}
              />
              <span className="tabular-nums">{formatMoneyIn(row.amount, row.currencyKey)}</span>
              <span className="text-muted-foreground">
                {t('worklist.wrongMoney.row', { entry: row.entryNumber, days: row.ageDays })}
              </span>
              <Button variant="secondary" className="ms-auto" onClick={() => onRepair(row)}>
                {t('worklist.wrongMoney.repair')}
              </Button>
            </li>
          ))}
        </Lane>
      )}

      {/* ── Cash waiting ─────────────────────────────────────────────────────
          They never expire and are never auto-voided, so AGE is the only thing
          this lane owes — there is nothing to act on here and no button. */}
      {lanes.cashWaiting.length > 0 && (
        <Lane
          tone="quiet"
          icon={<Wallet className="h-4 w-4 shrink-0" aria-hidden />}
          lane="cash-waiting"
          title={t('worklist.cashWaiting.title', { count: lanes.cashWaiting.length })}
          hint={t('worklist.cashWaiting.hint')}
        >
          {lanes.cashWaiting.map((row: SettlementUncollectedRow) => (
            <li
              key={row.documentId}
              data-receipt={row.documentId}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm"
            >
              <BranchLink params={params} storeId={row.storeId} storeName={row.storeName} />
              <span className="tabular-nums">{formatMoneyIn(row.amount, row.currencyKey)}</span>
              <span className="text-muted-foreground">
                {t('worklist.cashWaiting.row', {
                  number: row.documentNumber,
                  days: row.ageDays,
                })}
              </span>
            </li>
          ))}
        </Lane>
      )}

      {/* ── Ageing ───────────────────────────────────────────────────────────
          🔑 A count and a way through, **never a card each**. There is no row array
          on `lanes.ageing` to render one from — see `worklist.ts`.

          ⚠️ The count is **scoped and thresholded**; the way through is the ledger
          filtered to *open entries*, which is neither. The link says what it does
          (*browse open entries*) and the count says what it counted, because the
          ledger has no ageing predicate to seed — the threshold is the server's and
          this ticket may not invent one. Logged for 274 in `.afk/HITL-270.md`. */}
      {lanes.ageing.count > 0 && (
        <div
          data-lane="ageing"
          data-ageing-count={lanes.ageing.count}
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-card/40 p-3 text-sm"
        >
          <span className="font-medium">{t('worklist.ageing.title')}</span>
          <span className="text-muted-foreground">
            {t('worklist.ageing.summary', {
              count: lanes.ageing.count,
              days: lanes.ageing.thresholdDays,
              branches: lanes.ageing.branchCount,
            })}
          </span>
          <Link
            to={ledgerSearch(params, { status: 'OPEN' })}
            data-testid="open-ledger"
            className="ms-auto text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {t('worklist.ageing.openLedger')}
          </Link>
        </div>
      )}
    </section>
  )
}

/** One lane: a heading that says what it costs, and the rows under it. */
function Lane({
  tone,
  icon,
  lane,
  title,
  hint,
  children,
}: {
  tone: 'attention' | 'quiet'
  icon: React.ReactNode
  lane: string
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section
      data-lane={lane}
      className={`rounded-lg border ${
        tone === 'attention' ? 'border-attention-border bg-attention-050' : 'border-border/60 bg-card/40'
      }`}
    >
      <header
        className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2 ${
          tone === 'attention' ? 'text-attention-800' : ''
        }`}
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </header>
      <ul className="divide-y divide-border/40 border-t border-border/40">{children}</ul>
    </section>
  )
}

/** Every worklist row is a way to its branch's account — the destination 269 built. */
function BranchLink({
  params,
  storeId,
  storeName,
  entryNumber,
}: {
  params: URLSearchParams
  storeId: string
  storeName: string
  entryNumber?: number
}) {
  return (
    <Link
      to={branchSearch(params, storeId, entryNumber)}
      className="flex items-baseline gap-2 hover:underline"
    >
      <span className="font-mono text-[12px] text-muted-foreground">{storeId}</span>
      <span className="font-medium">{storeName}</span>
    </Link>
  )
}

/**
 * The estate headline — 🚩 **a report figure, and not actionable** (D2).
 *
 * Per currency, and the two magnitudes apart: an estate-wide net would be a number
 * nobody owes and nobody consumes.
 */
function EstateFigures({ figures }: { figures: ReturnType<typeof estateFigures> }) {
  const { t } = useTranslation('settlement')
  if (figures.length === 0) return null

  return (
    <section data-region="estate-figures" className="flex flex-col gap-1 text-xs text-muted-foreground">
      {figures.map((f) => (
        <p key={f.currencyKey} className="tabular-nums">
          {t('door.estate.figure', {
            currency: f.currencyKey,
            branches: f.branchCount,
            entries: f.openCount,
            shortage: formatMoneyIn(f.shortageTotal, f.currencyKey),
            surplus: formatMoneyIn(f.surplusTotal, f.currencyKey),
          })}
        </p>
      ))}
      <p>{t('figures.notActionable')}</p>
    </section>
  )
}
