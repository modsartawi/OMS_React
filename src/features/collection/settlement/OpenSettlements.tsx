import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { UserCheck } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import { branchSearch } from './addresses'
import { settlementApi } from './api'
import { AccountCapBanner, AccountShimmer, ToggleChip } from './AccountStates'
import { CASH_LANE_LIMIT, OPEN_LANE_LIMIT } from './cap'
import { buildCashColumns, buildOpenColumns, ageWords, cashRowId, openRowId } from './open-columns'
import {
  buildCashLane,
  buildOpenLane,
  DEFAULT_OPEN_TAB,
  isEntryTab,
  OPEN_LANE_TABS,
  openTabSearch,
  readOpenTab,
  type OpenLane,
  type OpenLaneRowFacts,
  type OpenLaneSection,
  type OpenLaneTab,
  type OpenLaneTabCounts,
  type OpenLaneView,
} from './open-lane'

/**
 * **Open settlements** — `/collection/settlement/open` (spec 282, ticket 285), the
 * accountant's follow-up surface: *who has not sent the money, how long has it been,
 * and who do I ring?*
 *
 * 🔑 **A work session, not a glance.** The accountant opens it holding a phone and
 * works down it, which is why every ruling on this screen is about what a row says
 * out loud rather than about what a dashboard shows.
 *
 * 🚩 **Ordered oldest first and by nothing else.** The domain has not ruled when an
 * entry is late — BackOffice spec 1173 calls entry staleness *fog* — so the screen
 * states the age as a **fact** and never as a judgement. No red, no *overdue*, no
 * badge. The ageing lane 270 built was deleted by 274 for counting against exactly
 * that missing rule; this one counts against nothing.
 *
 * 🔑 **The estate is ranked, never narrowed.** 1,255 of the estate's 1,394 branches
 * are paired to nobody, so a screen that silently scoped to *mine* would drop most of
 * the estate's late money out of the door. Both sections are on one page — and the
 * second one's header says what is inside it, because the prototype found that
 * mine-first ranking pushed the estate's oldest entry **176 rows down the page**.
 *
 * ⚠️ **The lane ships ahead of its server.** Server dependency §6 (the ledger
 * extension) is not built, so `servedBy` / `isMine` / `ageDays` may all be absent —
 * in which case this draws one unsectioned list **in the order it arrived** and
 * **derives nothing**. No client clock stands in for the age and no guess for the
 * ranking; and because the sort is half of that same dependency, the screen also stops
 * claiming *oldest first* (`aged`) rather than describing an arrangement the rows do
 * not have. `open-lane.ts` owns those decisions; this file only draws its answer.
 *
 * 🔑 **The third tab is a SECOND door** (286): *Cash waiting* enumerates the prepared
 * receipts nobody has collected, off `Settlement/Uncollected` — a different call, a
 * different cap (500, a rare event rather than a population) and a **failure of its
 * own**, which is why its count can be an em-dash while the other two still count. The
 * arrangement is identical and shared; what changes is three things and nothing else —
 * the age says *prepared*, the money is the receipt's whole amount, and the name
 * column is the **collector**, because a waiting receipt is a visit that did not
 * happen.
 *
 * The chase note and its column are 287's.
 */
export default function OpenSettlements() {
  const { t } = useTranslation('settlement')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const tab = readOpenTab(searchParams)
  /**
   * 🚩 **Component state, not an address.** Spec 282 story 39 asks for the *scope* and
   * the *tab* to survive a walk through a branch account and names nothing else; the
   * chip is a narrowing of what is on screen rather than a description of what the
   * screen is looking at. `addresses.ts`'s `KEPT` list is a keep-list precisely so a
   * view's own parameter does not ride to the next screen.
   */
  const [mineOnly, setMineOnly] = useState(false)

  const lane = useQuery({
    // 🔑 ONE key for the whole screen — both tabs are two readings of one answer, so
    // switching tabs must not refetch and cannot produce two estates.
    queryKey: ['settlement', 'open-lane'],
    queryFn: () => settlementApi.openLane(),
    // The minute this feature's other reads use: an accountant opening four branches
    // out of this list and coming back between calls must not re-run the query.
    staleTime: 60_000,
  })

  /**
   * The third tab's own door (spec 282 D6) — **a second call, and deliberately not
   * folded into the one above.** A receipt nobody has collected is a row of the
   * consumption journal, not an entry: it has its own predicate, its own 500-row cap
   * and its own failure. One call answering both would mean either tab's refusal
   * taking the other's numbers down with it.
   *
   * ⚠️ **Fetched whichever tab is showing**, because the tab strip carries its count —
   * *Cash waiting* with no number beside it would be a job whose size you have to
   * open it to learn. It is estate-wide and takes no scope, as `Settlement/Orphans`
   * does.
   */
  const cash = useQuery({
    queryKey: ['settlement', 'cash-lane'],
    queryFn: () => settlementApi.uncollected(),
    staleTime: 60_000,
  })
  const onCash = !isEntryTab(tab)

  const built = useMemo(
    () =>
      buildOpenLane({
        rows: lane.data,
        failed: lane.isError,
        // The counts are the same whichever tab is drawn; only the view is a tab's.
        tab: isEntryTab(tab) ? tab : DEFAULT_OPEN_TAB,
        mineOnly,
      }),
    [lane.data, lane.isError, tab, mineOnly],
  )
  const cashBuilt = useMemo(
    () => buildCashLane({ rows: cash.data, failed: cash.isError, mineOnly }),
    [cash.data, cash.isError, mineOnly],
  )
  const columns = useMemo(() => buildOpenColumns(t, built.named), [t, built.named])
  const cashColumns = useMemo(() => buildCashColumns(t), [t])
  /**
   * 🚩 **Can this screen claim its own arrangement?** `sort=age` and `ageDays` are one
   * server dependency (§6): a door sending no ages is a door that ignored the sort and
   * answered `EntryNumber DESC`, so *oldest first* — and the cap banner's *"anything
   * missing is newer than what is here"* — would be a claim about rows that are not in
   * that order.
   *
   * ⚠️ Asked of **the answer**, not of the view — the subtitle stands above every one
   * of them, so keying it to `rows` left *nothing owing* and *nothing matches these
   * filters* still asserting the order this flag exists to stop claiming. What it is
   * guarding against is only the two cases where there is nothing to be wrong about:
   * a read still in flight, and an estate with nothing open.
   */
  const answered = (built.counts.owing ?? 0) + (built.counts.owed ?? 0) > 0
  const unordered = answered && !built.aged

  return (
    <section className="flex flex-col gap-4" data-region="settlement-open">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t('open.title')}</h2>
        {/* 🚩 The cash tab says what IT is looking at: *"every entry the estate still
            has open"* is not true of a shelf of prepared receipts, and its own age is
            counted from a different event. `unordered` is an entry-tab condition only
            — §6 is the ledger's dependency, and this door either answers whole or
            refuses. */}
        <p className="text-xs text-muted-foreground">
          {t(onCash ? 'open.subtitleCash' : unordered ? 'open.subtitleUnordered' : 'open.subtitle')}
        </p>
      </header>

      {/* ⚠️ **Unknown while the read is in flight, and that is the same rule the
          failed case follows** — `0` is a number this screen has not been told, and
          *"Owing 0"* under a shimmer is the estate looking settled for as long as the
          door takes to answer. The em-dash resolves into a count, never out of one.

          🔑 The third count comes from the third door and is unknown on its own terms:
          one lane refusing must not em-dash the other's numbers. */}
      <Tabs
        tab={tab}
        counts={{
          ...(lane.isPending ? UNKNOWN_COUNTS : built.counts),
          cash: cash.isPending ? null : cashBuilt.count,
        }}
        onTab={(next) => navigate(openTabSearch(searchParams, next))}
      />

      {/* ⚠️ Offered only when the wire actually labelled the rows. A chip over a field
          nobody sent could only ever empty the list, which would read as *you have
          nothing* rather than as *the server did not say*. (On the cash tab the door
          always labels them — §2 is whole or nothing.) */}
      {/* ⚠️ …and not over a shimmer either: the entry tabs' `ranked` is false until
          rows arrive, so gating the cash tab on the error alone would put a chip above
          a list that is not there yet. */}
      {(onCash ? !cash.isError && !cash.isPending : built.ranked) && (
        <div className="flex flex-wrap items-center gap-2">
          <ToggleChip
            icon={<UserCheck className="h-3.5 w-3.5" aria-hidden />}
            label={t('open.filters.mineOnly')}
            pressed={mineOnly}
            onToggle={() => setMineOnly((v) => !v)}
          />
        </div>
      )}

      {/* 🚩 *"Showing the first 2,000 — there may be more."* This lane answers a
          POPULATION, so reaching the cap means a complete answer was truncated — and
          because the order is oldest-first, the rows it dropped are the newest ones
          and nothing else on screen would look wrong. */}
      {!onCash && built.capReached && (
        <AccountCapBanner
          message={t(unordered ? 'open.capReachedUnordered' : 'open.capReached', {
            limit: OPEN_LANE_LIMIT.toLocaleString('en-US'),
          })}
        />
      )}

      {/* 🚩 **A different cap and a different sentence** — 500 here, because a waiting
          receipt is a rare event rather than a population. Reaching it does not mean
          the estate is bigger than the page; it means collection has stopped, which is
          news of its own (`cap.ts`). */}
      {onCash && cashBuilt.capReached && (
        <AccountCapBanner
          message={t('open.capReachedCash', { limit: CASH_LANE_LIMIT.toLocaleString('en-US') })}
        />
      )}

      {onCash ? (
        cash.isPending ? (
          <AccountShimmer label={t('open.loadingCash')} />
        ) : (
          <LaneBody
            view={cashBuilt.view}
            tab={tab}
            columns={cashColumns}
            getRowId={cashRowId}
            error={cash.error}
            failedMessage={t('open.errors.cashFailed')}
            onClearFilter={() => setMineOnly(false)}
            onRow={(row) => navigate(branchSearch(searchParams, row.storeId, row.entryNumber))}
          />
        )
      ) : lane.isPending ? (
        <AccountShimmer label={t('open.loading')} />
      ) : (
        <LaneBody
          view={built.view}
          tab={tab}
          columns={columns}
          getRowId={openRowId}
          unranked={!built.ranked}
          error={lane.error}
          failedMessage={t('open.errors.laneFailed')}
          onClearFilter={() => setMineOnly(false)}
          onRow={(row) => navigate(branchSearch(searchParams, row.storeId, row.entryNumber))}
        />
      )}
    </section>
  )
}

/** Neither count is known yet — see the call site. */
const UNKNOWN_COUNTS: OpenLane['counts'] = { owing: null, owed: null }

/**
 * The tab strip — two jobs, each with its size on it.
 *
 * 🔑 **The counts come out of one answer**, so *Owing* and *Owed* can never disagree
 * with each other, with the cap banner or with 288's front-page signpost.
 *
 * ⚠️ **A failed read draws an em-dash and never a zero.** A `0` here is the screen
 * fabricating a number, and *"Owing 0"* is the single most misleading thing this
 * screen could say to somebody about to close it and go home.
 */
function Tabs({
  tab,
  counts,
  onTab,
}: {
  tab: OpenLaneTab
  counts: OpenLaneTabCounts
  onTab: (next: OpenLaneTab) => void
}) {
  const { t } = useTranslation('settlement')

  return (
    <div role="tablist" aria-label={t('open.title')} className="flex gap-1 border-b border-border">
      {OPEN_LANE_TABS.map((key) => {
        const selected = key === tab
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            data-tab={key}
            onClick={() => onTab(key)}
            className={
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ' +
              (selected
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t(`open.tabs.${key}`)}
            <span
              data-testid={`open-count-${key}`}
              className={
                'min-w-7 rounded-full px-2 py-0.5 text-center text-xs tabular-nums ' +
                (selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')
              }
            >
              {counts[key] === null ? t('open.tabs.noCount') : counts[key].toLocaleString('en-US')}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The five states, in the order a reader meets them.
 *
 * 🚩 **Generic over the row, and one implementation for all three tabs** (286). The
 * five states are the vocabulary the whole screen is read in — *empty* is good news,
 * *emptied by my own filter* is the reader's doing, *failed* is neither — and a second
 * copy of this for the third tab would be the place one of those three quietly
 * collapsed into another. What each tab supplies is its own words and its own columns.
 */
function LaneBody<Row extends OpenLaneRowFacts & { storeId: string; entryNumber: number }>({
  view,
  tab,
  columns,
  getRowId,
  unranked = false,
  error,
  failedMessage,
  onClearFilter,
  onRow,
}: {
  view: OpenLaneView<Row>
  tab: OpenLaneTab
  columns: ColDef<Row>[]
  getRowId: (p: { data: Row }) => string
  /** Only the entry tabs can be unranked — §6 is the ledger's dependency. */
  unranked?: boolean
  error: unknown
  /** ⚠️ Per door: a refused ledger and a refused receipt door are two different
   *  sentences, because the reader can act on one of them and not the other. */
  failedMessage: string
  onClearFilter: () => void
  onRow: (row: Row) => void
}) {
  const { t } = useTranslation('settlement')

  if (view.kind === 'failed') {
    // ⚠️ **The refusal, by its own message.** The door refuses an unfiltered call with
    // `SettlementLedgerCriterionRequired` — which `status=OPEN` satisfies, so seeing
    // it here means something real changed. Swallowing it into a generic sentence
    // would lose the one word that says what to tell head office.
    return <ErrorBanner message={apiErrorMessage(error, failedMessage)} className="p-3" />
  }

  if (view.kind === 'empty') {
    // 🚩 Worded per tab: *nothing owing*, *nothing owed* and *no cash waiting* are
    // three different pieces of good news, and one generic sentence would make none of
    // them legible.
    return (
      <Nothing title={t(`open.empty.${tab}.title`)} hint={t(`open.empty.${tab}.hint`)} testId="open-empty" />
    )
  }

  if (view.kind === 'filtered') {
    // ⚠️ **Never *nothing owing*.** The reader narrowed this themselves, and the way
    // out is named rather than left to be rediscovered.
    return (
      <Nothing
        title={t('open.filtered.title')}
        hint={t('open.filtered.hint')}
        testId="open-filtered"
        action={
          <button
            type="button"
            onClick={onClearFilter}
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            {t('open.filtered.clear')}
          </button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Said once, above both sections: the server did not label these rows, so this
          is one list rather than the arrangement the screen is designed around. */}
      {unranked && (
        <p className="text-xs text-muted-foreground" data-testid="open-unranked">
          {t('open.unranked')}
        </p>
      )}
      {view.sections.map((section) => (
        <Section
          /**
           * ⚠️ **Keyed by the TAB as well as the section**, so switching tabs mounts a
           * fresh grid. AG Grid keeps a column's sort and filter state across a
           * `columnDefs` swap, and the three tabs share column ids (`ageDays`,
           * `servedBy`, …) — so an *age > 100* filter set while chasing shortages
           * would silently empty the receipts list while its count still claimed 37
           * rows. Different lists, different grids.
           */
          key={`${tab}-${section.which}`}
          section={section}
          columns={columns}
          getRowId={getRowId}
          onRow={onRow}
        />
      ))}
    </div>
  )
}

/**
 * One section — *Yours*, *Everyone else's*, or the whole list when the wire said
 * nothing about who serves a branch.
 *
 * 🚩 **Fixed height and virtualised, never `autoHeight` and never paged.** The point
 * of the arrangement is that the estate's list is *underneath* yours rather than a
 * page away, so a per-section paginator would undo it; and 1,000 rows of `autoHeight`
 * is 1,000 rows in the DOM. Ten rows tall, and it scrolls the lot.
 */
function Section<Row extends OpenLaneRowFacts>({
  section,
  columns,
  getRowId,
  onRow,
}: {
  section: OpenLaneSection<Row>
  columns: ColDef<Row>[]
  getRowId: (p: { data: Row }) => string
  onRow: (row: Row) => void
}) {
  const { t } = useTranslation('settlement')

  const defaultColDef = useMemo(
    () => ({ sortable: true, resizable: true, filter: 'agTextColumnFilter', cellDataType: false }),
    [],
  )
  const height =
    OMS_GRID_HEADER_HEIGHT + Math.min(Math.max(section.rows.length, 3), 10) * LANE_ROW_HEIGHT + 2

  return (
    <section className="flex flex-col gap-2" data-region={`open-section-${section.which}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
          {t(`open.sections.${section.which}`)}
        </h3>
        <span
          data-testid={`open-section-count-${section.which}`}
          className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
        >
          {section.rows.length.toLocaleString('en-US')}
        </span>
        <Signpost section={section} />
      </div>

      <div style={{ height }}>
        <AgGridReact<Row>
          theme={omsGridTheme}
          rowData={section.rows}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          // A taller row than the rest of the feature's grids, and it is the whole
          // answer to *"a chase list is read one row at a time while talking"* — the
          // age carries its date underneath and the branch its code beside it.
          rowHeight={LANE_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          animateRows={false}
          // ⚠️ The row's own id and never the index — the entry's on two tabs, the
          // CONSUMPTION's on the third (one entry can have more than one receipt).
          getRowId={getRowId}
          // 🔑 Every row is a way into the branch's ACCOUNT, landing on this exact
          // entry (269's `?store=&entry=` idiom): *understanding* an entry is one
          // click from *chasing* it, and the account is where it can be acted on. A
          // waiting receipt quotes an entry number too, so the third tab lands the
          // same way.
          onRowClicked={(e) => e.data && onRow(e.data)}
          rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
          {...omsGridDirection}
        />
      </div>
    </section>
  )
}

/** Two lines of speech per row, so the row reads as one. */
const LANE_ROW_HEIGHT = 44

/**
 * What the second section's header says about what is inside it.
 *
 * 🔑 **This looks decorative and is not.** It is the only thing on screen that says
 * the estate holds something worse than anything of yours — without it, mine-first
 * ranking hides the estate's oldest entry below the fold and the carve-out that kept
 * unassigned money *in* the answer is undone by the arrangement.
 *
 * ⚠️ The comparison clause is `open-lane.ts`'s to claim, and it claims it only when
 * it is true. Interpolated, never concatenated, so the Arabic retrofit stays a data
 * change.
 */
function Signpost({ section }: { section: OpenLaneSection<OpenLaneRowFacts> }) {
  const { t } = useTranslation('settlement')
  const { signpost } = section

  if (signpost.kind === 'silent') return null

  return (
    <span className="text-xs text-muted-foreground" data-testid={`open-signpost-${section.which}`}>
      {signpost.kind === 'olderThanYours'
        ? t('open.signpost.olderThanYours', {
            oldest: ageWords(t, signpost.oldestAgeDays),
            yours: ageWords(t, signpost.yoursOldestAgeDays),
          })
        : t('open.signpost.oldest', { oldest: ageWords(t, signpost.oldestAgeDays) })}
    </span>
  )
}

/** A worded answer rather than an empty grid — the three good outcomes and the one
 *  the reader caused are each a sentence a person wrote. */
function Nothing({
  title,
  hint,
  testId,
  action,
}: {
  title: string
  hint: string
  testId: string
  action?: React.ReactNode
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-card/40 px-6 py-12 text-center"
      data-testid={testId}
    >
      <strong className="text-base font-semibold">{title}</strong>
      <p className="text-sm text-muted-foreground">{hint}</p>
      {action}
    </div>
  )
}
