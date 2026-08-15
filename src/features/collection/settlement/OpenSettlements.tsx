import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { UserCheck } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { SettlementOpenLaneRow } from '@/core/models/settlement'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import { branchSearch } from './addresses'
import { settlementApi } from './api'
import { AccountCapBanner, AccountShimmer, ToggleChip } from './AccountStates'
import { OPEN_LANE_LIMIT } from './cap'
import { buildOpenColumns, ageWords, openRowId } from './open-columns'
import {
  buildOpenLane,
  OPEN_LANE_TABS,
  openTabSearch,
  readOpenTab,
  type OpenLane,
  type OpenLaneSection,
  type OpenLaneTab,
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
 * in which case this draws one unsectioned oldest-first list and **derives nothing**.
 * No client clock stands in for the age, and no guess stands in for the ranking.
 * `open-lane.ts` owns that decision; this file only draws its answer.
 *
 * This slice is the two entry tabs. *Cash waiting* is 286's (it needs a door of its
 * own), and the chase note and its column are 287's.
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

  const built = useMemo(
    () => buildOpenLane({ rows: lane.data, failed: lane.isError, tab, mineOnly }),
    [lane.data, lane.isError, tab, mineOnly],
  )
  const columns = useMemo(() => buildOpenColumns(t, built.named), [t, built.named])

  return (
    <section className="flex flex-col gap-4" data-region="settlement-open">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t('open.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('open.subtitle')}</p>
      </header>

      {/* ⚠️ **Unknown while the read is in flight, and that is the same rule the
          failed case follows** — `0` is a number this screen has not been told, and
          *"Owing 0"* under a shimmer is the estate looking settled for as long as the
          door takes to answer. The em-dash resolves into a count, never out of one. */}
      <Tabs
        tab={tab}
        counts={lane.isPending ? UNKNOWN_COUNTS : built.counts}
        onTab={(next) => navigate(openTabSearch(searchParams, next))}
      />

      {/* ⚠️ Offered only when the wire actually labelled the rows. A chip over a field
          nobody sent could only ever empty the list, which would read as *you have
          nothing* rather than as *the server did not say*. */}
      {built.ranked && (
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
      {built.capReached && (
        <AccountCapBanner
          message={t('open.capReached', { limit: OPEN_LANE_LIMIT.toLocaleString('en-US') })}
        />
      )}

      {lane.isPending ? (
        <AccountShimmer label={t('open.loading')} />
      ) : (
        <LaneBody
          lane={built}
          tab={tab}
          columns={columns}
          error={lane.error}
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
  counts: OpenLane['counts']
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

/** The five states, in the order a reader meets them. */
function LaneBody({
  lane,
  tab,
  columns,
  error,
  onClearFilter,
  onRow,
}: {
  lane: OpenLane
  tab: OpenLaneTab
  columns: ReturnType<typeof buildOpenColumns>
  error: unknown
  onClearFilter: () => void
  onRow: (row: SettlementOpenLaneRow) => void
}) {
  const { t } = useTranslation('settlement')

  if (lane.view.kind === 'failed') {
    // ⚠️ **The refusal, by its own message.** The door refuses an unfiltered call with
    // `SettlementLedgerCriterionRequired` — which `status=OPEN` satisfies, so seeing
    // it here means something real changed. Swallowing it into a generic sentence
    // would lose the one word that says what to tell head office.
    return (
      <ErrorBanner message={apiErrorMessage(error, t('open.errors.laneFailed'))} className="p-3" />
    )
  }

  if (lane.view.kind === 'empty') {
    // 🚩 Worded per tab: *nothing owing* and *nothing owed* are two different pieces
    // of good news, and one generic sentence would make neither of them legible.
    return (
      <Nothing title={t(`open.empty.${tab}.title`)} hint={t(`open.empty.${tab}.hint`)} testId="open-empty" />
    )
  }

  if (lane.view.kind === 'filtered') {
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
      {!lane.ranked && (
        <p className="text-xs text-muted-foreground" data-testid="open-unranked">
          {t('open.unranked')}
        </p>
      )}
      {lane.view.sections.map((section) => (
        <Section key={section.which} section={section} columns={columns} onRow={onRow} />
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
function Section({
  section,
  columns,
  onRow,
}: {
  section: OpenLaneSection
  columns: ReturnType<typeof buildOpenColumns>
  onRow: (row: SettlementOpenLaneRow) => void
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
        <AgGridReact<SettlementOpenLaneRow>
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
          getRowId={openRowId}
          // 🔑 Every row is a way into the branch's ACCOUNT, landing on this exact
          // entry (269's `?store=&entry=` idiom): *understanding* an entry is one
          // click from *chasing* it, and the account is where it can be acted on.
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
function Signpost({ section }: { section: OpenLaneSection }) {
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
