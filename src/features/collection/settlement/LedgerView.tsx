import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { Filter, Search } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { distinctCurrencies } from '@/core/money'
import type { AssignmentPerson } from '@/core/models/collection'
import type {
  SettlementEntryKind,
  SettlementEntryStatus,
  SettlementLedgerCriteria,
  SettlementLedgerRow,
} from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { fsi } from '@/core/util/bidi'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { branchSearch } from './addresses'
import { settlementApi, settlementRosterQuery } from './api'
import { AccountCapBanner, AccountShimmer, ToggleChip } from './AccountStates'
import { GRID_PAGE_SIZE, isCapReached, LEDGER_LIMIT } from './cap'
import { entryKindLabel, entryStatusLabel } from './entry-cells'
import {
  hasCriterion,
  LEDGER_KINDS,
  LEDGER_STATUSES,
  ledgerKey,
  ledgerSearch,
  readCriteria,
  readLedgerAmount,
} from './ledger'
import { buildLedgerColumns, ledgerRowClass, ledgerRowId } from './ledger-columns'

/**
 * **The cross-estate lookup** — `/collection/settlement/ledger`, over
 * `Settlement/Ledger` (BackOffice 1199 §3). A screen of its own since 283; its six
 * criteria stay parameters, because they are the *question* it is asking.
 *
 * 🔑 **The question this screen could not answer until now.** BackOffice spec 1173
 * mints `entryNumber` and calls it *"the handle finance and the branch settle by on
 * the phone"* — then gives no way to resolve one, because `Settlement/Account` takes
 * the `storeId` the caller is ringing up to **ask for**. So the accountant had to
 * already know the branch in order to look up the entry whose entire purpose is to be
 * quoted without one. Ticket 270 built this view against a door that did not exist;
 * 274 deleted it rather than fake it (§B1); the door was then built, and here it is
 * again — this time against a server.
 *
 * 🚩 **Every criterion lives in the URL**, the rule this whole screen follows: a
 * lookup an accountant is reading can be pasted into a ticket or sent to a colleague,
 * and the Back button undoes it. Nothing is mirrored into component state beside it,
 * so no copy can drift.
 *
 * ⚠️ **The empty question is refused, not answered.** With nothing asked, this draws
 * a prompt and issues no request — because the door itself refuses a bare call
 * (`SettlementLedgerCriterionRequired`). An unfiltered ledger is bounded only by the
 * row cap, so it would answer *"the newest 500 entries in the estate"* while looking
 * like the ledger. `status: OPEN` alone is a perfectly good question, and is the one
 * the *"show me everything still owed"* button asks.
 *
 * ⚠️ **No total anywhere on it.** The estate is KSA **and** Bahrain, so a Σ over a
 * cross-branch money column adds dinars to riyals and is wrong in both — the same
 * refusal `figures.ts` makes on the front page, for the same reason. What the rows
 * carry instead is a per-row `currencyKey`, so each figure is drawn at its own
 * branch's precision.
 */
export default function LedgerView() {
  const { t } = useTranslation('settlement')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const criteria = useMemo(() => readCriteria(searchParams), [searchParams])
  const asked = hasCriterion(criteria)

  const ledger = useQuery({
    queryKey: ['settlement', 'ledger', ledgerKey(criteria)],
    queryFn: () => settlementApi.ledger(criteria),
    // 🚩 The one thing that stops this being a request per keystroke of a hand-edited
    // URL — and the guard that keeps the screen from issuing a call the door has
    // already told us it refuses.
    enabled: asked,
    // The same minute the door's own reads use: an accountant opening three entries
    // out of one result and coming back between each must not re-run the query to see
    // figures that have not changed.
    staleTime: 60_000,
  })

  // Spec 2423 (ticket 426): the Posted-by picker's people. ⚠️ A 403 (a session holding
  // only the settlement grant — see `settlementRosterQuery`) leaves the picker empty and
  // every other criterion working; it is never an error banner over the ledger.
  const roster = useQuery(settlementRosterQuery())
  const accountants = roster.data?.accountants ?? []
  const rosterUnavailable = roster.isError

  const rows = useMemo(() => ledger.data ?? [], [ledger.data])
  // 244 §7's rule: the code is a column only when the ANSWER actually mixes.
  const mixedCurrency = useMemo(() => distinctCurrencies(rows, (r) => r.currencyKey).length > 1, [rows])

  // 339: the business day is a column only when the answer holds a theft — the only
  // kind that names one.
  const hasTheft = useMemo(() => rows.some((r) => r.entryKind === 'THEFT'), [rows])

  const [showFilters, setShowFilters] = useState(false)
  const columns = useMemo(
    () => buildLedgerColumns(t, mixedCurrency, hasTheft),
    [t, mixedCurrency, hasTheft],
  )
  const defaultColDef = useMemo(
    () => ({
      ...OMS_GRID_BASE_COL_DEF,
      sortable: true,
      resizable: true,
      filter: 'agTextColumnFilter',
      floatingFilter: showFilters,
      cellDataType: false,
    }),
    [showFilters],
  )

  const capReached = isCapReached(rows.length, LEDGER_LIMIT)

  /** Change one criterion, keeping the rest — an address, not state. */
  const amend = (patch: Partial<SettlementLedgerCriteria>) =>
    navigate(ledgerSearch(searchParams, { ...criteria, ...patch }))

  return (
    <section className="flex flex-col gap-4" data-region="settlement-ledger">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold tracking-tight">{t('ledger.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('ledger.subtitle')}</p>
      </header>

      <Criteria
        criteria={criteria}
        accountants={accountants}
        rosterUnavailable={rosterUnavailable}
        onAmend={amend}
        onClear={() => navigate(ledgerSearch(searchParams, {}))}
      />

      {!asked ? (
        // ⚠️ A prompt, not an empty grid and not an error. Nothing was asked, so
        // nothing is claimed — and the sentence says which criteria exist rather than
        // leaving the reader to discover them by trying.
        <p
          className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground"
          data-testid="ledger-prompt"
        >
          {t('ledger.prompt')}
        </p>
      ) : ledger.isError ? (
        <ErrorBanner
          message={apiErrorMessage(ledger.error, t('ledger.errors.lookupFailed'))}
          className="p-3"
        />
      ) : ledger.isPending ? (
        <AccountShimmer label={t('ledger.loading')} />
      ) : rows.length === 0 ? (
        // Not an error either: an entry number that matches nothing is a real answer
        // to a real question, and usually a mistyped digit.
        <p
          className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground"
          data-testid="ledger-empty"
        >
          {t('ledger.empty')}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground" data-testid="ledger-count">
              {t('ledger.showing', { count: rows.length })}
            </p>
            <div className="ms-auto">
              <ToggleChip
                icon={<Filter className="h-3.5 w-3.5" aria-hidden />}
                label={t('account.toolbar.filterRow')}
                pressed={showFilters}
                onToggle={() => setShowFilters((v) => !v)}
              />
            </div>
          </div>

          {/* 🚩 The cap here means *"the question was too broad to read"*, not *"the
              estate is bigger than the page"* — which is why the sentence tells the
              accountant to narrow it rather than merely reporting a number. */}
          {capReached && (
            <AccountCapBanner
              message={t('ledger.capReached', { limit: LEDGER_LIMIT.toLocaleString('en-US') })}
            />
          )}

          <div className="min-h-[20rem]">
            <AgGridReact<SettlementLedgerRow>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={defaultColDef}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              getRowId={ledgerRowId}
              getRowClass={ledgerRowClass}
              // 🔑 Every row is a way to its branch's ACCOUNT, landing on this exact
              // entry (269's `?store=&entry=` idiom). The ledger answers *which
              // branch*; the account is where the entry can be acted on — this view
              // deliberately offers no cancel, no write-off and no repair, because a
              // correction made without the entry's journal in front of you is the
              // one this screen must not make easy.
              onRowClicked={(e) =>
                e.data && navigate(branchSearch(searchParams, e.data.storeId, e.data.entryNumber))
              }
              rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }}
              pagination
              paginationPageSize={GRID_PAGE_SIZE}
              paginationPageSizeSelector={false}
            />
          </div>
        </>
      )}
    </section>
  )
}

/**
 * What is being asked — one row of controls, each writing its own key into the URL.
 *
 * 🚩 **The entry number is a form and everything else is a chip**, and the split is
 * the door's own shape: the number is a *one-row seek* (it is unique estate-wide) and
 * the rest are *narrowings*. Putting the number in a submitted form rather than on
 * the keystroke path is the same rule the door's search box follows — a lookup that
 * navigates must not move the screen out from under someone still typing.
 */
function Criteria({
  criteria,
  accountants,
  rosterUnavailable,
  onAmend,
  onClear,
}: {
  criteria: SettlementLedgerCriteria
  accountants: readonly AssignmentPerson[]
  rosterUnavailable: boolean
  onAmend: (patch: Partial<SettlementLedgerCriteria>) => void
  onClear: () => void
}) {
  const { t } = useTranslation('settlement')
  const [typed, setTyped] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = typed.trim()
    // ⚠️ An unreadable entry number CLEARS the criterion rather than sending a
    // malformed one: the door refuses what it cannot parse, and a refusal an
    // accountant reads as "the system is broken" is worse than an empty box.
    onAmend({ entryNumber: /^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined })
    setTyped('')
  }

  return (
    <div className="flex flex-col gap-2" data-region="ledger-criteria">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2" role="search">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label={t('ledger.entry.label')}
            placeholder={t('ledger.entry.placeholder')}
            data-testid="ledger-entry"
            className="h-9 w-full rounded-full border border-border bg-card ps-9 pe-3 text-sm outline-none focus:border-primary/60"
          />
        </div>
        <Button type="submit" variant="secondary">
          {t('ledger.entry.submit')}
        </Button>
        {/* 🔑 The estate-wide call, one click — `status=OPEN` and nothing else, which
            is a criterion and therefore not the refused empty question. This is the
            *"what is still owed out there"* the front page's worklist deliberately
            does not answer (an open entry is not, by itself, work). */}
        <Button
          type="button"
          variant="outlined"
          onClick={() => onAmend({ entryNumber: undefined, status: 'OPEN' })}
          data-testid="ledger-all-open"
        >
          {t('ledger.allOpen')}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ChipRow
          label={t('ledger.filters.kind')}
          values={LEDGER_KINDS}
          active={criteria.entryKind}
          render={(v) => entryKindLabel(t, v)}
          onPick={(v) => onAmend({ entryKind: v as SettlementEntryKind | undefined })}
          testGroup="kind"
        />
        <ChipRow
          label={t('ledger.filters.status')}
          values={LEDGER_STATUSES}
          active={criteria.status}
          render={(v) => entryStatusLabel(t, v)}
          onPick={(v) => onAmend({ status: v as SettlementEntryStatus | undefined })}
          testGroup="status"
        />

        <DateBox
          label={t('ledger.filters.from')}
          value={criteria.postedFrom ?? ''}
          onValue={(v) => onAmend({ postedFrom: v || undefined })}
          testId="ledger-from"
        />
        <DateBox
          label={t('ledger.filters.to')}
          value={criteria.postedTo ?? ''}
          onValue={(v) => onAmend({ postedTo: v || undefined })}
          testId="ledger-to"
        />

        <Button type="button" variant="text" className="ms-auto" onClick={onClear}>
          {t('ledger.filters.clear')}
        </Button>
      </div>

      {/* Spec 2423 (ticket 426): Amount, Profit center and Posted by — each one alone
          is a question the door answers (`hasCriterion`). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-region="ledger-more-criteria">
        <CommitBox
          label={t('ledger.filters.amountFrom')}
          hint={t('ledger.filters.amountHint')}
          value={criteria.amountFrom === undefined ? '' : String(criteria.amountFrom)}
          read={amountText}
          onCommit={(v) => onAmend({ amountFrom: v ? Number(v) : undefined })}
          amount
          testId="ledger-amount-from"
        />
        <CommitBox
          label={t('ledger.filters.amountTo')}
          hint={t('ledger.filters.amountHint')}
          value={criteria.amountTo === undefined ? '' : String(criteria.amountTo)}
          read={amountText}
          onCommit={(v) => onAmend({ amountTo: v ? Number(v) : undefined })}
          amount
          testId="ledger-amount-to"
        />
        <CommitBox
          label={t('ledger.filters.profitCenter')}
          hint={t('ledger.filters.profitCenterHint')}
          value={criteria.profitCenter ?? ''}
          read={(v) => v.trim()}
          onCommit={(v) => onAmend({ profitCenter: v || undefined })}
          testId="ledger-profit-center"
        />
        <PostedByPicker
          accountants={accountants}
          unavailable={rosterUnavailable}
          value={criteria.postedByStaffId ?? ''}
          onPick={(v) => onAmend({ postedByStaffId: v || undefined })}
        />
      </div>

      {/* The two criteria that arrive by LINK rather than by control — a batch from
          273's commit summary, a branch from an account. Shown so a reader can see
          what is narrowing their result, and unset it. */}
      {(criteria.batchId || criteria.storeId) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {criteria.storeId && (
            <Pill
              label={t('ledger.filters.branch', { storeId: criteria.storeId })}
              onClear={() => onAmend({ storeId: undefined })}
              testId="ledger-branch-pill"
            />
          )}
          {criteria.batchId && (
            <Pill
              label={t('ledger.filters.batch', { batchId: criteria.batchId })}
              onClear={() => onAmend({ batchId: undefined })}
              testId="ledger-batch-pill"
            />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * One group of mutually-exclusive chips.
 *
 * 🚩 **Pressing the active chip clears it.** A filter with no way off is a filter a
 * reader has to reload the page to escape — and on this view the *absence* of a
 * status is a meaningful state (every ending, not just the open ones).
 */
function ChipRow({
  label,
  values,
  active,
  render,
  onPick,
  testGroup,
}: {
  label: string
  values: readonly string[]
  active: string | undefined
  render: (value: string) => string
  onPick: (value: string | undefined) => void
  testGroup: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div
        role="group"
        aria-label={label}
        data-region={`ledger-${testGroup}`}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-0.5"
      >
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPick(active === value ? undefined : value)}
            aria-pressed={active === value}
            data-chip={value}
            className={
              'h-6 rounded-full px-3 text-xs font-medium transition-colors ' +
              (active === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted')
            }
          >
            {render(value)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A calendar bound. `type="date"` so the browser's own picker enforces the shape the
 *  door expects (`YYYY-MM-DD`) rather than this screen validating free text. */
function DateBox({
  label,
  value,
  onValue,
  testId,
}: {
  label: string
  value: string
  onValue: (value: string) => void
  testId: string
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        data-testid={testId}
        className="h-7 rounded-full border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary/60"
      />
    </label>
  )
}

/**
 * An amount box's reading of what was typed: `''` for an empty box (no bound), the
 * amount in the address's own spelling (`.5` → `0.5`, `1000.0` → `1000`), or
 * `undefined` when it is not a plain decimal (`1,000`) — the ledger's drop rule
 * (`readLedgerAmount`), applied to a box rather than to a pasted address.
 */
const amountText = (typed: string): string | undefined => {
  if (typed.trim() === '') return ''
  const amount = readLedgerAmount(typed)
  return amount === undefined ? undefined : String(amount)
}

/**
 * A typed criterion (ticket 426) that **commits on Enter or on leaving the box**, never
 * per keystroke — every commit is a navigation, and the entry-number form's rule holds
 * here too: a lookup must not move the screen out from under someone still typing.
 *
 * Keyed on its URL value by the caller's `value`, so Back, *Clear all* or a link that
 * changes the criterion redraws the box with what is actually being asked.
 *
 * `read` turns the typed text into the address's own spelling of it. ⚠️ Typed text
 * it refuses (`undefined`) commits NOTHING — the criterion already asked stands, and
 * the box shows it again — and a spelling of the same value (`.5` over `0.5`) is no
 * change, so it adds no history entry.
 */
type CommitBoxProps = {
  label: string
  hint: string
  value: string
  read: (typed: string) => string | undefined
  onCommit: (value: string) => void
  amount?: boolean
  testId: string
}

function CommitBox(props: CommitBoxProps) {
  return <CommitInput key={props.value} {...props} />
}

function CommitInput({ label, hint, value, read, onCommit, amount = false, testId }: CommitBoxProps) {
  const [typed, setTyped] = useState(value)
  const commit = () => {
    const next = read(typed)
    // Refused or unchanged: the address stays as it is, and the box says what it asks.
    if (next === undefined || next === value) {
      setTyped(value)
      return
    }
    onCommit(next)
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <input
        type="text"
        // Amounts are machine values — LTR, whichever way the page runs.
        dir={amount ? 'ltr' : undefined}
        inputMode={amount ? 'decimal' : undefined}
        title={hint}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
        data-testid={testId}
        className={
          'h-7 rounded-full border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary/60 ' +
          (amount ? 'w-28 text-end tabular-nums' : 'w-36')
        }
      />
    </label>
  )
}

/**
 * **Posted by** — the spec's *Accountant* filter (2423 story 48): who POSTED the entry,
 * picked from the finance roster's accountants and sent as an exact staff id.
 *
 * 🚩 A native `<option>` is a string-only sink, so each name is isolated whole with
 * `fsi` (`.claude/rules/bidi.md`). A staff id from the address that the roster does not
 * name (a leaver, or a roster this session may not read) is still offered, as itself,
 * so the control always shows what the query actually carries.
 */
function PostedByPicker({
  accountants,
  unavailable,
  value,
  onPick,
}: {
  accountants: readonly AssignmentPerson[]
  /** The roster could not be read (a 403 for a settlement-only session, or an
   *  outage): said on the control, so an empty list is not read as *no accountants*. */
  unavailable: boolean
  value: string
  onPick: (staffId: string) => void
}) {
  const { t } = useTranslation('settlement')
  const known = accountants.some((a) => a.staffId === value)

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {t('ledger.filters.postedBy')}
      <select
        value={value}
        onChange={(e) => onPick(e.target.value)}
        title={unavailable ? t('ledger.filters.postedByUnavailable') : t('ledger.filters.postedByHint')}
        data-testid="ledger-posted-by"
        className="h-7 rounded-full border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-primary/60"
      >
        <option value="">{t('ledger.filters.postedByAny')}</option>
        {accountants.map((a) => (
          <option key={a.staffId} value={a.staffId}>
            {fsi(a.displayName || a.staffId)}
          </option>
        ))}
        {value && !known && <option value={value}>{fsi(value)}</option>}
      </select>
    </label>
  )
}

/** A criterion that arrived by link, with the way to drop it. */
function Pill({
  label,
  onClear,
  testId,
}: {
  label: string
  onClear: () => void
  testId: string
}) {
  const { t } = useTranslation('settlement')

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1"
      data-testid={testId}
    >
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={t('ledger.filters.remove', { criterion: label })}
        className="text-muted-foreground hover:text-foreground"
      >
        ×
      </button>
    </span>
  )
}
