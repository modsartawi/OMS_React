import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, ListTree, RefreshCw, Search, TriangleAlert, Upload } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { formatDateTime } from '@/core/util/date-format'
import type {
  SettlementFleetRow,
  SettlementOrphanRow,
  SettlementScope,
} from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { branchSearch, readQuery, uploadSearch, writeQuery } from './addresses'
import { settlementMoney } from './money-display'
import { settlementApi } from './api'
import { AccountShimmer } from './AccountStates'
import { OPEN_LANE_LIMIT } from './cap'
import PostEntryDialog from './PostEntryDialog'
import RepairDialog from './RepairDialog'
import { resolveSubmit, searchBranches, type BranchSearchResult } from './search'
import { estateFigures } from './figures'
import { ledgerSearch } from './ledger'
import { OPEN_LANE_TABS, openTabSearch, tallyOpenLane, type OpenLaneTally } from './open-lane'
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
  //
  // 🔑 **274: the scope is IN the key, because it is now on the wire.** 270 fetched
  // the estate once and narrowed it here; the door resolves *mine* from the session
  // against the assignment tables, so each scope is a different answer and must be a
  // different cache entry.
  const fleet = useQuery({
    queryKey: ['settlement', 'fleet', scope],
    queryFn: () => settlementApi.fleet(scope),
    staleTime: 60_000,
  })
  // ⚠️ The wrong-money lane, and no longer *the worklist*: `Settlement/Orphans` is
  // one lane. Cash-waiting has no door and ageing has no rule (274 §B2, §B3).
  const orphans = useQuery({
    queryKey: ['settlement', 'orphans'],
    queryFn: () => settlementApi.orphans(),
    staleTime: 60_000,
  })
  /**
   * 🔑 **288's signpost — and it is the LANE's query, key and all** (`OpenSettlements`
   * uses the same one). Not a second call and not a count endpoint: the spec's whole
   * argument for one call (D5) is that the front page's numbers and the lane's tab
   * counts describe one answer and therefore cannot disagree. Sharing the key also
   * means clicking through to the lane costs nothing — the answer is already cached.
   */
  const openLane = useQuery({
    queryKey: ['settlement', 'open-lane'],
    queryFn: () => settlementApi.openLane(),
    staleTime: 60_000,
  })

  const results = useMemo(() => searchBranches(fleet.data, query), [fleet.data, query])
  const lanes = useMemo(() => buildWorklist(orphans.data), [orphans.data])
  const figures = useMemo(() => estateFigures(fleet.data), [fleet.data])
  const tally = useMemo(
    () => tallyOpenLane({ rows: openLane.data, failed: openLane.isError }),
    [openLane.data, openLane.isError],
  )

  const [repairing, setRepairing] = useState<SettlementOrphanRow | null>(null)
  /** 271's posting form. It opens with **no branch seeded** from here: the door is
   *  the estate, and the branch is typed into the form itself (D4). */
  const [posting, setPosting] = useState(false)
  /* ⚠️ **273's upload used to open from here as dialog state, and 283 moved it to an
   * address** (`/collection/settlement/upload`). It seeds nothing either way — the
   * kind is the FILE's and the branches are the sheet's — so nothing was lost by
   * making it a screen, and what is gained is one spelling: the nav leaf 284 adds and
   * this button reach the upload the same way, and a reader who reloaded mid-upload
   * is still on the upload. */

  /**
   * Submit — an address, or nothing at all.
   *
   * ⚠️ **274 removed the second meaning: an entry number.** 270's box jumped
   * straight to *"entry 143, whichever branch it is on"* through the cross-estate
   * ledger, and that door does not exist (§B1) — `Settlement/Account` cannot serve
   * it, because it needs the `storeId` the caller is asking for. So a bare number
   * now matches only as a branch code, and the box's own placeholder says what it
   * searches rather than letting a real entry number return silence.
   *
   * 🔑 The exact-code rule survives in `resolveSubmit` and matters for the same
   * reason it always did: `1001` is both a real branch code and a real entry number.
   */
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const intent = resolveSubmit(fleet.data, query)
    if (intent.kind === 'branch') navigate(branchSearch(searchParams, intent.storeId))
  }

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['settlement', 'fleet'] })
    void queryClient.invalidateQueries({ queryKey: ['settlement', 'orphans'] })
    // ⚠️ The signpost is on this screen, so *Refresh* has to mean it too — a button
    // that re-read two of the three counted things on a page would leave the third
    // stating a position up to a minute old beside two that had just been re-asked.
    void queryClient.invalidateQueries({ queryKey: ['settlement', 'open-lane'] })
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
        {/* 🚩 **Beside the single form, never instead of it** (D7). Forty shortages
            must not cost forty forms; one shortage must not cost a spreadsheet. */}
        <Button
          type="button"
          variant="outlined"
          onClick={() => navigate(uploadSearch(searchParams))}
          data-testid="bulk-open"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {t('bulk.open')}
        </Button>
        {/* 🔑 **The way to the cross-estate lookup** (BackOffice 1199 §3). It belongs
            beside the box rather than inside it because the two searches answer
            different questions: this box finds a BRANCH, the ledger finds an ENTRY —
            which is exactly the meaning 274 had to remove from here when it found the
            door missing (a bare number went to a ledger that did not exist, and
            returned silence). It lands on `status=OPEN` rather than on an empty
            prompt: *"what is still owed out there"* is the question an accountant
            arriving here has, and it is a criterion, so the door will answer it. */}
        <Button
          type="button"
          variant="outlined"
          onClick={() => navigate(ledgerSearch(searchParams, { status: 'OPEN' }))}
          data-testid="ledger-open"
        >
          <ListTree className="h-3.5 w-3.5" aria-hidden />
          {t('ledger.open')}
        </Button>
      </form>

      {fleet.isError && (
        <ErrorBanner
          message={apiErrorMessage(fleet.error, t('door.errors.fleetFailed'))}
          className="p-3"
        />
      )}

      {fleet.isPending || (!query && orphans.isPending) ? (
        <AccountShimmer label={t('door.loading')} />
      ) : query ? (
        <SearchResults results={results} params={searchParams} />
      ) : (
        <>
          {orphans.isError ? (
            // 🚩 The banner REPLACES the lanes rather than sitting above them. An
            // empty worklist renders the sentence *"nothing needs a human"* — which
            // would be a false statement about orphan money if the door that knows
            // had just failed to answer. A screen may say it does not know; it may
            // not say there is nothing wrong because it could not ask.
            <ErrorBanner
              message={apiErrorMessage(orphans.error, t('door.errors.worklistFailed'))}
              className="p-3"
            />
          ) : (
            <Worklist
              lanes={lanes}
              busy={orphans.isFetching || fleet.isFetching}
              params={searchParams}
              onRefresh={refresh}
              onRepair={setRepairing}
            />
          )}
          {/* 🚩 **Under the triage and above the estate's headline**, which is the order
              this screen has always been in: wrong money is rare and every row of it is
              money handed over against a document that will never exist, so it stays
              first. This is the bigger, slower job — and it is a POINTER to it rather
              than the job itself (288: ~140 cards at estate scale buried the four that
              were actually wrong, and that finding is what keeps the lane on its own
              screen). */}
          <OpenSignpost
            tally={tally}
            pending={openLane.isPending}
            error={openLane.error}
            params={searchParams}
          />
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
  // ⚠️ The concrete row type, not the bare `BranchSearchResult`: `searchBranches` is
  // generic over anything with a code and a name (the picker ranks the `Store` master
  // through it too), and a default-parameterised annotation here would erase the
  // fleet's own fields — `openCount` among them — back to the shared minimum.
  results: BranchSearchResult<SettlementFleetRow>
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
            {/* ⚠️ The city and the in-scope marker stood here until 274. Neither
                `city` nor `assignment` is on the live fleet row (§B4, §B5), so the
                hit shows what the row actually carries. The marker's PURPOSE — the
                scope ranks and never refuses — is now enforced by the server, which
                OR's the estate-wide carve-out into every scoped predicate. */}
            <Link
              to={branchSearch(params, hit.row.storeId)}
              data-hit={hit.row.storeId}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm hover:bg-muted"
            >
              <span className="font-mono text-[12px] text-muted-foreground">{hit.row.storeId}</span>
              <span className="font-medium">{hit.row.storeName}</span>
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
              {/* ⚠️ **The branch is a CODE and the entry is unnamed** — 274 §B2.
                  `Settlement/Orphans` answers a consumption row: no `storeName`, no
                  `entryNumber`, no `ageDays`. The link still lands on the branch's
                  account, which is headed by its full name and holds the entry. */}
              <BranchLink params={params} storeId={row.storeId} storeName={row.storeId} />
              <span className="tabular-nums">{settlementMoney(row.amount, '')}</span>
              <span className="text-muted-foreground">
                {t('worklist.wrongMoney.row', { at: formatDateTime(row.consumedAt) })}
              </span>
              <Button variant="secondary" className="ms-auto" onClick={() => onRepair(row)}>
                {t('worklist.wrongMoney.repair')}
              </Button>
            </li>
          ))}
        </Lane>
      )}

      {/* ── Cash waiting, and ageing ─────────────────────────────────────────
          ⚠️ **Two lanes stood here until ticket 274 and are gone.** Neither had a
          server behind it, and each is gone for a different reason:

          - **cash waiting** — receipts a branch prepared and no collector took.
            There is no door that enumerates them (§B2): the fleet row carries
            `hasUncollectedReceipt`, a FLAG, and the same argument that won
            `Settlement/Orphans` its own door applies unchanged — a lane that can
            only say *"0331 has one somewhere"* sends the accountant hunting. The
            lane is spec 1173's own expectation ("it ages visibly on the
            accountant's cash-waiting lane"), so this one is an ask, not a mistake.
          - **ageing** — a count and a way through. ⚠️ Spec 1173 rules entry
            staleness **fog** and declines to set a threshold (§B3), so there is no
            rule to count against. 270 was right to refuse to invent one; the honest
            end of that refusal is no lane rather than a lane counting to nothing.

          🚩 Neither is commented out or stubbed. A lane rendering zeros would read as
          *there is no waiting cash*, which is a claim about money this screen cannot
          make. */}
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
 * **The counted signpost through to the open settlements lane** (ticket 288).
 *
 * 🔑 **What makes the work discoverable from the screen an accountant already opens.**
 * Until this line existed, a branch that posted a shortage in March and has paid
 * nothing appeared on no screen at all until somebody typed its code.
 *
 * 🚩 **It says how big the job is and points at it — it does not become the job.** The
 * front page stays a glance: the prototype's untriaged list ran to ~140 cards at estate
 * scale, of which 131 were merely ageing, and the four that were actually *wrong* sank
 * into them. Chasing is a work session and lives on its own screen.
 *
 * ⚠️ **A failed read draws an em-dash and says the read failed.** Never `0`, and never
 * *nothing needs you* — that exact mistake was one of ticket 270's `/code-review`
 * findings, on this surface. A read still in flight draws the same em-dash and says
 * nothing at all: the count resolves *into* a number rather than out of one.
 *
 * *Cash waiting* joins the two entry counts when 286 builds its door. It is absent
 * rather than zero until then — the ticket's own boundary, and the same rule the
 * lane's tab strip follows.
 */
function OpenSignpost({
  tally,
  pending,
  error,
  params,
}: {
  tally: OpenLaneTally
  pending: boolean
  error: unknown
  params: URLSearchParams
}) {
  const { t } = useTranslation('settlement')

  return (
    <section
      data-region="open-signpost"
      className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{t('door.signpost.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('door.signpost.hint')}</p>
      </header>

      <ul className="flex flex-wrap gap-2">
        {OPEN_LANE_TABS.map((tab) => (
          <li key={tab}>
            {/* 🔑 **The lane's own builder, not a second spelling of it.** The tab is
                the address (`?tab=owed`) and the scope rides along — but *which value
                is the default, and therefore written as an absence* is `open-lane.ts`'s
                to decide (`addresses.ts` says so in as many words). A signpost that
                re-derived it here would be the second place this screen's URL grammar
                was spelled, and the first one to drift the day a third tab lands. */}
            <Link
              to={openTabSearch(params, tab)}
              data-signpost={tab}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-primary/60 hover:bg-muted"
            >
              <span>{t(`open.tabs.${tab}`)}</span>
              {/* ⚠️ Reads the SAME key the lane's own tab strip reads for an unknown
                  count, so the two surfaces cannot spell *not known* two ways. */}
              <span
                data-testid={`signpost-count-${tab}`}
                className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
              >
                {pending || tally.counts[tab] === null
                  ? t('open.tabs.noCount')
                  : tally.counts[tab].toLocaleString('en-US')}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {/* ⚠️ **The refusal INSIDE this screen's own sentence, not instead of it.** The
          server's words are the ones to quote to head office — but on their own
          (*"at least one ledger criterion is required"*) they say nothing about what
          the em-dashes beside them mean. Interpolated rather than concatenated, so the
          Arabic retrofit stays a data change.

          The banner sits beside the links rather than replacing them: the lane is
          still worth opening, and the reader is owed the reason the numbers are gone. */}
      {tally.failed && (
        <ErrorBanner
          message={t('door.signpost.failed', {
            detail: apiErrorMessage(error, t('door.signpost.failedNoReason')),
          })}
          className="p-2 text-xs"
        />
      )}

      {/* 🚩 At the cap a count is a FLOOR, not a total. Printing *2,000* flat here
          would be the one thing this signpost may not do — state a number it cannot
          stand behind. */}
      {tally.capReached && (
        <p className="text-xs text-muted-foreground" data-testid="signpost-capped">
          {t('door.signpost.capped', { limit: OPEN_LANE_LIMIT.toLocaleString('en-US') })}
        </p>
      )}
    </section>
  )
}

/**
 * The estate headline — 🚩 **a report figure, and not actionable** (D2).
 *
 * ⚠️ **274 took the money out of it.** 270 drew two magnitudes per currency; the
 * fleet row carries no `currencyKey` (§B6) and the estate is KSA **and** Bahrain,
 * so there is no honest cross-branch total left to state — folding them together
 * adds dinars to riyals and is wrong in both. What remains is counts, which no
 * currency can corrupt, and which still answer what the headline is for: *is the
 * estate quiet, or is there a lot out there?* See `figures.ts`.
 */
function EstateFigures({ figures }: { figures: ReturnType<typeof estateFigures> }) {
  const { t } = useTranslation('settlement')
  if (figures.branchCount === 0) return null

  return (
    <section data-region="estate-figures" className="flex flex-col gap-1 text-xs text-muted-foreground">
      <p className="tabular-nums">
        {t('door.estate.figure', {
          branches: figures.branchCount,
          entries: figures.openCount,
        })}
      </p>
      <p>{t('figures.notActionable')}</p>
    </section>
  )
}
