import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  OMS_GRID_HEADER_HEIGHT,
  OMS_GRID_ROW_HEIGHT,
  omsGridDirection,
  omsGridTheme,
} from '@/core/theme/ag-grid-theme'
import { collectionAccessQuery } from '@/core/collection/api'
import { ASSIGNMENT_OPTIONS_KEY, canOpenAssignment, collectionApi } from './api'
import {
  ASSIGNMENT_LANDING,
  assignmentCounts,
  branchStatus,
  buildSaveBody,
  isDirty,
  visibleBranches,
  type AssignmentBranch,
  type AssignmentFilter,
  type AssignmentStatusFilter,
} from './assignment'
import {
  PICKABLE_ROLES,
  blankPerson,
  matchesPersonSearch,
  personFormError,
  personToBody,
  roleLabelKey,
  rosterNameOf,
  slotPeople,
  supervisorIds,
  supervisorOptions,
  type RosterPerson,
  type SavePersonBody,
  type Slot,
} from './people'
import {
  applyBulkResult,
  buildBulkBody,
  buildConfirmation,
  bulkPins,
  isApplicable,
  keepVisible,
  pageCodes,
  selectionFromFilter,
  selectionFromPaste,
  selectionFromTicks,
  type BulkConfirmation,
  type BulkFlow,
} from './bulk'
import { GRID_PAGE_SIZE } from './cap'
import { EmptyState, ListShimmer } from './GridStates'
import ScreenGate from '@/core/ui/ScreenGate'
import type { AssignmentPerson } from './served-by'

/**
 * Collection Assignment (`/collection/assignment`) — BackOffice spec 1162 D11,
 * tickets 1169 (Branches) and 1170 (People). The one screen in this area that
 * WRITES.
 *
 * **Two tabs, and the order between them is the design.** Branches lists all 1394
 * open branches — not the 139 finance's spreadsheet covers, because the gap is the
 * work — and People maintains the roster those branches are assigned FROM.
 *
 * 🔑 **People is a tab rather than a pane because the roster is add-person-first.**
 * None of the 8 accountants exists in `Staff`, `UaEmployee` or `UaUser` (BackOffice
 * 1157), so `PosCollectionStaff` is the only place their names live: a new hire
 * must be creatable here before they can be assigned anywhere, and the story the
 * ticket is named for is both happening in one afternoon.
 *
 * ⚠️ **It opens on everything, unfiltered** — deliberately not the default-to-mine
 * the four inquiry screens land on. Its user maintains the estate rather than
 * finding their own work.
 *
 * 🔑 **The one behaviour to preserve above all: a touched row stays on screen until
 * it is saved.** Under *With a gap* — the filter the 1255 actually get closed from
 * — filling a slot makes the row stop matching, and it would vanish mid-edit with
 * the edit unsaved. The rule lives in `visibleBranches`; this Page only has to keep
 * an honest `touched` set, which is why an edit is dropped on SUCCESS and kept on
 * failure.
 *
 * ⚠️ **The gate is the SHARED one** (`@/core/ui/ScreenGate`), not the copied shape
 * 244 §1 allowed. Ticket 268 graduated it when the settlement account became a
 * second feature needing it — so the `query` (the options, not just the key) and
 * the `ns` this screen's five `access.*` sentences live in are passed in, rather
 * than being baked into a feature-local copy.
 */
export default function CollectionAssignmentPage() {
  const { t } = useTranslation('collection')
  return (
    <ScreenGate
      query={collectionAccessQuery()}
      can={canOpenAssignment}
      ns="collection"
      title={t('assignment.title')}
      subtitle={t('assignment.subtitle')}
    >
      {/* A child component, not inlined markup: its queries must not run for a
          session the gate is about to refuse. */}
      <AssignmentBody />
    </ScreenGate>
  )
}

/** The roster query key, shared by both tabs — ONE fetch, and the People tab's save
 *  writes into it, which is what makes a new hire show up in the Branches tab's
 *  dropdowns without a refetch or a second name source. */
const ROSTER_KEY = ['collection', 'assignment', 'people'] as const

type Tab = 'branches' | 'people'

function AssignmentBody() {
  const { t } = useTranslation('collection')
  const [tab, setTab] = useState<Tab>('branches')

  // 🔑 THE ROSTER IS FETCHED ONCE FOR THE WHOLE SCREEN, by both tabs, and it is the
  // screen's ONE name source. The Branches tab deliberately does NOT read the four
  // inquiry screens' `AssignmentOptions` payload: that one is pre-grouped for a
  // picker and carries no `role` or `supervisorId`, so this screen would have had
  // two roster copies that could disagree — and a person added on the People tab
  // would not have appeared in the Branches tab's dropdowns until the other cache
  // entry happened to refetch.
  const roster = useQuery({
    queryKey: ROSTER_KEY,
    queryFn: () => collectionApi.assignmentPeople(),
  })

  const people = useMemo(() => roster.data ?? [], [roster.data])

  return (
    <>
      <div className="flex gap-1 border-b border-border/60" role="tablist">
        {(['branches', 'people'] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={
              'rounded-t-md px-4 py-2 text-sm ' +
              (tab === name
                ? 'border border-b-0 border-border/60 bg-background font-medium'
                : 'text-muted-foreground hover:text-foreground')
            }
          >
            {t('assignment.tabs.' + name)}
          </button>
        ))}
      </div>

      {roster.isError && (
        <ErrorBanner
          message={apiErrorMessage(roster.error, t('assignment.errors.rosterFailed'))}
          className="p-3"
        />
      )}

      {tab === 'branches' ? <BranchesTab people={people} /> : <PeopleTab people={people} />}
    </>
  )
}

// =============================================================================
// Branches — 1169
// =============================================================================

function BranchesTab({ people }: { people: readonly RosterPerson[] }) {
  const { t } = useTranslation('collection')
  const queryClient = useQueryClient()

  const branchesKey = ['collection', 'assignment', 'branches'] as const

  const list = useQuery({
    queryKey: branchesKey,
    queryFn: () => collectionApi.assignmentBranches(),
  })

  // 🚩 Each slot is filtered to ITS OWN Role — a collector cannot be offered for the
  // accountant slot, and the pure manager (blank Role) is offered for neither,
  // because somebody who does nothing for branches must not be assignable to one.
  // ⚠️ This is emphatically NOT the rule the People tab's supervisor field follows.
  const accountants = useMemo<AssignmentPerson[]>(
    () => slotPeople(people, 'accountantId'),
    [people],
  )
  const collectors = useMemo<AssignmentPerson[]>(() => slotPeople(people, 'collectorId'), [people])

  const nameOf = useMemo(() => rosterNameOf(people), [people])

  // ---- the filter (client-side over the one payload) ----
  const [filter, setFilter] = useState<AssignmentFilter>(ASSIGNMENT_LANDING)

  // ---- edits in flight ----
  //
  // 🔑 `edits` IS the touched set: a branch is in it from the moment a dropdown
  // changes until the server has confirmed the change. Dropping the entry on
  // success is what lets a filled row finally leave the *With a gap* filter —
  // the screen reporting progress, with nothing at risk by then — and keeping it
  // on failure is what leaves the user their unsaved edit to fix.
  const [edits, setEdits] = useState<Record<string, AssignmentBranch>>({})
  const [saving, setSaving] = useState<Record<string, true>>({})
  const [failures, setFailures] = useState<Record<string, string>>({})

  const serverRows = useMemo(() => list.data ?? [], [list.data])

  // What the grid binds: the server's row unless the user has an unsaved edit
  // over it.
  const rows = useMemo(
    () => serverRows.map((row) => edits[row.storeCode] ?? row),
    [serverRows, edits],
  )

  // ---- the three bulk flows (1171) ----
  //
  // 🔑 Three gestures, ONE selection type and ONE dialog. Everything below is about
  // arriving at a list of store codes; the moment it exists, the flow it came from
  // stops mattering to anything but the dialog's wording.
  const [flow, setFlow] = useState<BulkFlow>('ticked')
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())
  const [pasted, setPasted] = useState('')
  const [bulkSlot, setBulkSlot] = useState<Slot>('collectorId')
  const [bulkStaffId, setBulkStaffId] = useState('')
  const [confirmation, setConfirmation] = useState<BulkConfirmation | null>(null)
  const [bulkError, setBulkError] = useState('')
  const [bulkNotice, setBulkNotice] = useState('')
  // 🚩 The rows a bulk apply just changed, held on screen whatever the filter says —
  // 1169's touched-row rule at set scale. ⚠️ A SEPARATE set from `edits`: those are
  // unsaved and leave on success, these ARE saved and are pinned so that a
  // set-sized change is legible instead of the grid emptying in one frame. Cleared
  // by the user's next gesture, never by the server.
  const [pins, setPins] = useState<ReadonlySet<string>>(() => new Set())
  const [pageIndex, setPageIndex] = useState(0)

  const touched = useMemo(() => new Set(Object.keys(edits)), [edits])
  const visible = useMemo(
    () => visibleBranches(rows, filter, nameOf, keepVisible(touched, pins)),
    [rows, filter, nameOf, touched, pins],
  )
  const counts = useMemo(() => assignmentCounts(rows), [rows])

  // The filter flow is built over the WHOLE payload, never over the page the grid
  // drew: the screen holds all ~1394 branches and pages client-side, so "everything
  // matching" has to mean the 1255 and not the 50 on screen.
  //
  // ⚠️ And over the SERVER's rows rather than `rows`, which carries unsaved edits on
  // top of them. A branch whose gap is filled only by an in-flight or refused edit
  // still has that gap in the sink — dropping it out of *With a gap* here would make
  // the membership of the set and the server's count of that set two different
  // questions, which is the one thing this flow must not do.
  const matching = useMemo(
    () => selectionFromFilter(serverRows, filter, nameOf),
    [serverRows, filter, nameOf],
  )

  const selection = useMemo(() => {
    if (flow === 'pasted') return selectionFromPaste(pasted)
    if (flow === 'ticked') return selectionFromTicks(ticked)
    return matching
  }, [flow, pasted, ticked, matching])

  const bulkPeople = bulkSlot === 'accountantId' ? accountants : collectors

  const save = useMutation({
    mutationFn: (body: Parameters<typeof collectionApi.saveAssignment>[0]) =>
      collectionApi.saveAssignment(body),
  })

  const onSlotChange = useCallback(
    (row: AssignmentBranch, slot: Slot, staffId: string) => {
      const original = serverRows.find((r) => r.storeCode === row.storeCode) ?? row
      const edited: AssignmentBranch = { ...row, [slot]: staffId }

      // Back to what the server already holds — nothing to save, and nothing to
      // hold on screen either.
      if (!isDirty(original, edited)) {
        setEdits(({ [row.storeCode]: _dropped, ...rest }) => rest)
        setFailures(({ [row.storeCode]: _cleared, ...rest }) => rest)
        return
      }

      setEdits((current) => ({ ...current, [row.storeCode]: edited }))
      setFailures(({ [row.storeCode]: _cleared, ...rest }) => rest)
      setSaving((current) => ({ ...current, [row.storeCode]: true }))

      save.mutate(buildSaveBody(original, edited), {
        onSuccess: (saved) => {
          // The SERVER's row is what the list now holds — the screen settles on
          // what was actually written, not on what it optimistically drew. The
          // save echoes only the pairing, so the branch's five descriptive
          // columns are kept from the row already on screen.
          queryClient.setQueryData<AssignmentBranch[]>(branchesKey, (current) =>
            (current ?? []).map((r) =>
              r.storeCode === saved.storeCode
                ? {
                    ...r,
                    accountantId: saved.accountantId,
                    collectorId: saved.collectorId,
                    updatedBy: saved.updatedBy,
                    updatedAt: saved.updatedAt,
                  }
                : r,
            ),
          )
          setEdits(({ [row.storeCode]: _saved, ...rest }) => rest)
        },
        onError: (error) => {
          // ⚠️ The edit STAYS — both in the row and in the touched set. A refused
          // save stages nothing server-side, so the branch is exactly as it was
          // and the only copy of the user's intent is the one on screen.
          setFailures((current) => ({
            ...current,
            [row.storeCode]: apiErrorMessage(
              error,
              t('assignment.errors.saveFailed', { store: row.storeCode }),
            ),
          }))
        },
        onSettled: () => {
          setSaving(({ [row.storeCode]: _done, ...rest }) => rest)
        },
      })
    },
    [branchesKey, queryClient, save, serverRows, t],
  )

  // ---- the bulk calls ----
  //
  // Two of them, and the SAME body goes to both — which is what stops the number in
  // the dialog and the number the write is about from being two different questions.
  const preview = useMutation({
    mutationFn: () => collectionApi.bulkAssignmentPreview(buildBulkBody(selection, bulkSlot, bulkStaffId)),
    onSuccess: (result) => {
      setBulkError('')
      setBulkNotice('')
      setConfirmation(buildConfirmation(selection, bulkSlot, bulkStaffId, result))
    },
    onError: (error) =>
      setBulkError(apiErrorMessage(error, t('assignment.bulk.errors.previewFailed'))),
  })

  const applyBulk = useMutation({
    mutationFn: () => collectionApi.bulkAssignment(buildBulkBody(selection, bulkSlot, bulkStaffId)),
    onSuccess: (result) => {
      // Settle the grid on what the SERVER wrote — the applied set, the applied slot
      // and nothing else — then hold those rows on screen.
      queryClient.setQueryData<AssignmentBranch[]>(branchesKey, (current) =>
        applyBulkResult(current ?? [], result, bulkSlot, bulkStaffId),
      )
      // ⚠️ The pins ACCUMULATE across applies. Replacing them would make the rows a
      // first bulk apply changed vanish the moment a second one runs — which is the
      // very disappearance this pin exists to prevent, arriving one gesture later.
      setPins((current) => keepVisible(current, bulkPins(result)))
      setTicked(new Set())
      setConfirmation(null)
      setBulkError('')
      setBulkNotice(
        t('assignment.bulk.applied', { count: result.applied }) +
          (result.unknownStoreCodes.length > 0
            ? ' ' +
              t('assignment.bulk.skipped', {
                count: result.unknownStoreCodes.length,
                codes: result.unknownStoreCodes.join(', '),
              })
            : ''),
      )
    },
    onError: (error) => {
      // ⚠️ The dialog stays open with the selection intact: a refused bulk apply
      // stages nothing server-side, so the administrator's intent is still only on
      // screen — exactly as a refused per-row save leaves its edit in the row.
      setBulkError(apiErrorMessage(error, t('assignment.bulk.errors.applyFailed')))
    },
  })

  const toggleTick = useCallback((storeCode: string) => {
    setTicked((current) => {
      const next = new Set(current)
      if (!next.delete(storeCode)) next.add(storeCode)
      return next
    })
  }, [])

  const columns = useMemo<ColDef<AssignmentBranch>[]>(
    () => [
      {
        colId: 'tick',
        headerName: '',
        width: 44,
        sortable: false,
        // Ticking rows is the second of the three flows — and select-page /
        // select-all-matching are the same thing by the time they reach the
        // selection, so they are two buttons over this one column rather than two
        // more modes.
        cellRenderer: (p: ICellRendererParams<AssignmentBranch>) => (
          <input
            type="checkbox"
            aria-label={p.data!.storeCode}
            checked={ticked.has(p.data!.storeCode)}
            onChange={() => toggleTick(p.data!.storeCode)}
          />
        ),
      },
      { field: 'storeCode', headerName: t('assignment.columns.storeCode'), width: 130 },
      { field: 'storeName', headerName: t('assignment.columns.storeName'), flex: 1, minWidth: 200 },
      { field: 'city', headerName: t('assignment.columns.city'), width: 140 },
      { field: 'area', headerName: t('assignment.columns.area'), width: 160 },
      {
        colId: 'accountant',
        headerName: t('assignment.columns.accountant'),
        width: 200,
        // 🚩 A dropdown over the roster, never a free-text box — deliberately
        // against the house style of the four inquiry toolbars beside it,
        // because this writes master data and a typo'd staff id here is inert,
        // invisible and permanent. Each slot is filtered to ITS OWN Role, so a
        // collector cannot be filed as an accountant; the server refuses both
        // mistakes independently.
        cellRenderer: (p: ICellRendererParams<AssignmentBranch>) => (
          <SlotSelect
            row={p.data!}
            slot="accountantId"
            people={accountants}
            busy={saving[p.data!.storeCode] === true}
            nobodyLabel={t('assignment.nobodyOption')}
            onChange={onSlotChange}
          />
        ),
      },
      {
        colId: 'collector',
        headerName: t('assignment.columns.collector'),
        width: 200,
        cellRenderer: (p: ICellRendererParams<AssignmentBranch>) => (
          <SlotSelect
            row={p.data!}
            slot="collectorId"
            people={collectors}
            busy={saving[p.data!.storeCode] === true}
            nobodyLabel={t('assignment.nobodyOption')}
            onChange={onSlotChange}
          />
        ),
      },
      {
        colId: 'status',
        headerName: t('assignment.columns.status'),
        width: 150,
        // The two absences are named SEPARATELY — a branch with an accountant and
        // no collector is a different state from one with nobody, and this
        // screen writes each slot on its own, so both are reachable from day one.
        valueGetter: (p) => (p.data ? t('assignment.status.' + branchStatus(p.data)) : ''),
      },
      { field: 'updatedBy', headerName: t('assignment.columns.updatedBy'), width: 140 },
    ],
    [accountants, collectors, onSlotChange, saving, t, ticked, toggleTick],
  )

  const failed = Object.entries(failures)

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('assignment.search.label')}</span>
          <input
            className="h-9 w-72 rounded-md border border-border/60 bg-background px-3 text-sm"
            value={filter.search}
            placeholder={t('assignment.search.placeholder')}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('assignment.search.status')}</span>
          <select
            className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
            value={filter.status}
            onChange={(e) =>
              setFilter((f) => ({ ...f, status: e.target.value as AssignmentStatusFilter }))
            }
          >
            {(['all', 'gap', 'assigned', 'noAccountant', 'noCollector', 'nobody'] as const).map(
              (status) => (
                <option key={status} value={status}>
                  {t('assignment.status.' + status, {
                    defaultValue: t('assignment.status.' + status),
                  })}
                </option>
              ),
            )}
          </select>
        </label>

        <div className="ms-auto text-sm text-muted-foreground">
          {t('assignment.counts', {
            total: counts.total,
            assigned: counts.assigned,
            half: counts.half,
            nobody: counts.nobody,
          })}
        </div>
      </div>

      {/* ---- the three bulk flows, in one bar (1171) ----
           Assigning 1255 unserved branches one row at a time is not a screen, it is
           a week. The three targets are three ways of arriving at a set — and they
           all end at the same dialog below. */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border/60 p-3">
        <span className="pb-2 text-sm font-medium">{t('assignment.bulk.heading')}</span>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('assignment.bulk.target')}</span>
          <select
            className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
            value={flow}
            onChange={(e) => setFlow(e.target.value as BulkFlow)}
          >
            <option value="ticked">
              {t('assignment.bulk.targets.ticked', { count: ticked.size })}
            </option>
            <option value="filter">
              {t('assignment.bulk.targets.filter', { count: matching.storeCodes.length })}
            </option>
            <option value="pasted">{t('assignment.bulk.targets.pasted')}</option>
          </select>
        </label>

        {flow === 'pasted' && (
          <textarea
            className="h-16 w-72 rounded-md border border-border/60 bg-background px-3 py-1 text-sm"
            value={pasted}
            placeholder={t('assignment.bulk.pastePlaceholder')}
            onChange={(e) => setPasted(e.target.value)}
          />
        )}

        {flow === 'ticked' && (
          <div className="flex items-center gap-2 pb-1 text-sm">
            <button
              type="button"
              className="h-9 rounded-md border border-border/60 px-3"
              onClick={() => setTicked(new Set(pageCodes(visible, pageIndex, GRID_PAGE_SIZE)))}
            >
              {t('assignment.bulk.selectPage')}
            </button>
            <button
              type="button"
              className="h-9 rounded-md border border-border/60 px-3"
              onClick={() => setTicked(new Set(matching.storeCodes))}
            >
              {t('assignment.bulk.selectMatching')}
            </button>
            <button
              type="button"
              className="h-9 rounded-md px-2 text-muted-foreground"
              onClick={() => setTicked(new Set())}
            >
              {t('assignment.bulk.clearTicks')}
            </button>
          </div>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('assignment.bulk.slot')}</span>
          {/* ⚠️ ONE slot travels. Applying collectors to a city leaves every branch's
              accountant exactly as finance set it, branch by branch. */}
          <select
            className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
            value={bulkSlot}
            onChange={(e) => {
              setBulkSlot(e.target.value as Slot)
              // The person picker is filtered to the slot's Role, so the previous
              // pick is not offered by the new one.
              setBulkStaffId('')
            }}
          >
            {(['accountantId', 'collectorId'] as const).map((slot) => (
              <option key={slot} value={slot}>
                {t('assignment.bulk.slots.' + slot)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('assignment.bulk.person')}</span>
          <select
            className="h-9 w-56 rounded-md border border-border/60 bg-background px-2 text-sm"
            value={bulkStaffId}
            onChange={(e) => setBulkStaffId(e.target.value)}
          >
            <option value="">{t('assignment.nobodyOption')}</option>
            {bulkPeople.map((person) => (
              <option key={person.staffId} value={person.staffId}>
                {person.displayName}
              </option>
            ))}
          </select>
        </label>

        {/* 🔑 It says *Review*, not *Apply*: the button opens the confirmation, and
            the confirmation is the guard. */}
        <button
          type="button"
          className="h-9 rounded-md border border-border/60 px-4 text-sm font-medium disabled:opacity-50"
          disabled={selection.storeCodes.length === 0 || preview.isPending}
          onClick={() => preview.mutate()}
        >
          {t('assignment.bulk.review')}
        </button>
      </div>

      {bulkError !== '' && <ErrorBanner message={bulkError} className="p-3" />}

      {bulkNotice !== '' && (
        <div className="flex items-center gap-3 rounded-md border border-border/60 p-3 text-sm">
          <span>{bulkNotice}</span>
          {pins.size > 0 && (
            <>
              <span className="text-muted-foreground">
                {t('assignment.bulk.pinned', { count: pins.size })}
              </span>
              {/* Releasing the pin is the user's gesture — the rows leave the filter
                  when they say so, not when the server answers. */}
              <button
                type="button"
                className="ms-auto h-8 rounded-md border border-border/60 px-3"
                onClick={() => {
                  setPins(new Set())
                  setBulkNotice('')
                }}
              >
                {t('assignment.bulk.unpin')}
              </button>
            </>
          )}
        </div>
      )}

      {confirmation !== null && (
        <BulkConfirmDialog
          confirmation={confirmation}
          personName={nameOf(confirmation.staffId) || t('assignment.nobodyOption')}
          busy={applyBulk.isPending}
          onCancel={() => setConfirmation(null)}
          onApply={() => applyBulk.mutate()}
        />
      )}

      {list.isError && (
        <ErrorBanner
          message={apiErrorMessage(list.error, t('assignment.errors.loadFailed'))}
          className="p-3"
        />
      )}

      {/* One banner per branch that refused, naming the branch — which is what a
          per-row save buys over a batch: a failure that says WHICH row. */}
      {failed.map(([storeCode, message]) => (
        <ErrorBanner key={storeCode} message={message} className="p-3" />
      ))}

      {list.isPending ? (
        <ListShimmer label={t('assignment.loading')} />
      ) : visible.length === 0 && !list.isError ? (
        <EmptyState title={t('assignment.empty.title')} hint={t('assignment.empty.hint')} />
      ) : (
        <div className="min-h-[24rem] flex-1">
          <AgGridReact<AssignmentBranch>
            theme={omsGridTheme}
            rowData={visible}
            columnDefs={columns}
            getRowId={(p) => p.data.storeCode}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            pagination
            paginationPageSize={GRID_PAGE_SIZE}
            paginationPageSizeSelector={false}
            onPaginationChanged={(e) => setPageIndex(e.api.paginationGetCurrentPage())}
            {...omsGridDirection}
          />
        </div>
      )}
    </>
  )
}

/**
 * 🔑 **THE ONE CONFIRMATION ALL THREE FLOWS END AT**, and the reason the bulk
 * button says *Review*.
 *
 * It always states **both** numbers. "300 branches" alone is the sentence an
 * administrator agrees to without reading; over an unfiltered estate the same button
 * that fills 300 gaps would otherwise rewrite the 139 pairings finance already
 * decided, silently, and nothing on screen would have said so.
 *
 * ⚠️ Both numbers are the **server's**, measured over the actual target set — not
 * counted from the rows this grid happens to hold, which on the paste flow it may
 * never have shown at all.
 */
function BulkConfirmDialog({
  confirmation,
  personName,
  busy,
  onCancel,
  onApply,
}: {
  confirmation: BulkConfirmation
  personName: string
  busy: boolean
  onCancel: () => void
  onApply: () => void
}) {
  const { t } = useTranslation('collection')
  const applicable = isApplicable(confirmation)

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="rounded-md border border-border/60 bg-background p-4"
    >
      <p className="font-medium">
        {t('assignment.bulk.confirm.title', { count: confirmation.targeted })}
      </p>

      <p className="mt-1 text-sm text-muted-foreground">
        {t('assignment.bulk.confirm.slotLine', {
          slot: t('assignment.bulk.slots.' + confirmation.slot),
          person: personName,
        })}
      </p>

      {/* The guard itself. The zero case is its own key rather than a `_zero`
          plural: English has no zero plural rule, so a `_zero` suffix would resolve
          through the "other" branch on the one count that most needs its own
          sentence. */}
      <p className="mt-2 text-sm">
        {confirmation.alreadyServed === 0
          ? t('assignment.bulk.confirm.alreadyServedNone')
          : t('assignment.bulk.confirm.alreadyServed', { count: confirmation.alreadyServed })}
      </p>

      {/* 🚩 Unknown codes are NAMED. A typo in a list arriving by email must be
          visible, or the branch it was meant for stays unserved with nothing on
          screen saying so. */}
      {confirmation.unknown.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('assignment.bulk.confirm.unknown', {
            count: confirmation.unknown.length,
            codes: confirmation.unknown.join(', '),
          })}
        </p>
      )}

      {!applicable && <p className="mt-2 text-sm">{t('assignment.bulk.confirm.nothing')}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="h-9 rounded-md border border-border/60 px-4 text-sm font-medium disabled:opacity-50"
          disabled={!applicable || busy}
          onClick={onApply}
        >
          {t('assignment.bulk.confirm.apply')}
        </button>
        <button
          type="button"
          className="h-9 rounded-md px-3 text-sm text-muted-foreground"
          onClick={onCancel}
        >
          {t('assignment.bulk.confirm.cancel')}
        </button>
      </div>
    </div>
  )
}

/**
 * One slot's dropdown — the roster filtered to that slot's Role, plus an explicit
 * *nobody*.
 *
 * ⚠️ **Clearing has to stay sayable**: blank is how this whole family spells "no
 * accountant", and without the option a mistaken assignment could never be undone
 * from the screen that made it.
 */
function SlotSelect({
  row,
  slot,
  people,
  busy,
  nobodyLabel,
  onChange,
}: {
  row: AssignmentBranch
  slot: Slot
  people: AssignmentPerson[]
  busy: boolean
  nobodyLabel: string
  onChange: (row: AssignmentBranch, slot: Slot, staffId: string) => void
}) {
  const value = row[slot] ?? ''
  // An id that is no longer on the roster still renders, rather than silently
  // resetting the cell to "nobody" the moment the screen is opened.
  const orphan = value !== '' && !people.some((p) => p.staffId === value)

  return (
    <select
      className="h-7 w-full rounded border border-border/60 bg-background px-1 text-sm"
      value={value}
      disabled={busy}
      onChange={(e) => onChange(row, slot, e.target.value)}
    >
      <option value="">{nobodyLabel}</option>
      {orphan && <option value={value}>{value}</option>}
      {people.map((person) => (
        <option key={person.staffId} value={person.staffId}>
          {person.displayName}
        </option>
      ))}
    </select>
  )
}

// =============================================================================
// People — 1170
// =============================================================================

/**
 * The roster tab: a form over a list, rather than an editable grid.
 *
 * 🔑 **Add-person-first is the whole point of the tab.** A person created here is
 * in the Branches tab's dropdowns immediately — the save writes into the SAME
 * cache entry both tabs read — which is the ticket's story: a new hire is recorded
 * and assigned in one afternoon.
 *
 * 🚩 **The supervisor field offers the whole roster** and the two slot dropdowns on
 * the other tab do not. The two rules are opposite and live one import away from
 * each other in `people.ts`, where they can be read together.
 */
function PeopleTab({ people }: { people: readonly RosterPerson[] }) {
  const { t } = useTranslation('collection')
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [form, setForm] = useState<SavePersonBody>(blankPerson)
  // Blank while adding; the person's id while editing an existing row — which is
  // also what disables the id field, since StaffId is the primary key.
  const [editing, setEditing] = useState('')
  const [failure, setFailure] = useState('')

  const nameOf = useMemo(() => rosterNameOf(people), [people])
  const supervisors = useMemo(() => supervisorIds(people), [people])
  const offeredSupervisors = useMemo(
    () => supervisorOptions(people, form.staffId),
    [people, form.staffId],
  )

  const visible = useMemo(
    () => people.filter((person) => matchesPersonSearch(person, search, nameOf)),
    [people, search, nameOf],
  )

  const save = useMutation({
    mutationFn: (body: SavePersonBody) => collectionApi.savePerson(body),
    onSuccess: (saved) => {
      // Settle the shared roster on what the SERVER wrote. Both tabs read this
      // entry, so the new person is in the Branches tab's dropdown the moment this
      // returns — no refetch, and no second copy that could disagree.
      queryClient.setQueryData<RosterPerson[]>(ROSTER_KEY, (current) => {
        const rest = (current ?? []).filter((p) => p.staffId !== saved.staffId)
        return [...rest, saved].sort((a, b) => a.displayName.localeCompare(b.displayName))
      })

      // 🔑 AND THE PICKER ON THE OTHER FOUR SCREENS. This is the ticket's *Done
      // when* — "naming a supervisor here is what makes the group show up in the
      // Served by control on four screens" — and without this line it would be
      // true only after a hard reload: `assignmentOptionsQuery` is deliberately
      // `staleTime: Infinity` (a roster does not change inside a page life), which
      // is exactly right for the four readers and exactly wrong for the ONE writer
      // that can change it. So the writer invalidates, rather than the four
      // readers each going stale on a timer.
      void queryClient.invalidateQueries({ queryKey: ASSIGNMENT_OPTIONS_KEY })

      setForm(blankPerson())
      setEditing('')
      setFailure('')
    },
    onError: (error) => {
      // ⚠️ The form STAYS filled. A refused save stages nothing server-side — every
      // check runs before the write context opens — so the only copy of the
      // administrator's intent is the one on screen.
      setFailure(apiErrorMessage(error, t('assignment.errors.personFailed')))
    },
  })

  const invalid = personFormError(form)

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('assignment.people.search')}</span>
          <input
            className="h-9 w-72 rounded-md border border-border/60 bg-background px-3 text-sm"
            value={search}
            placeholder={t('assignment.people.searchPlaceholder')}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="ms-auto text-sm text-muted-foreground">
          {t('assignment.people.counts', { total: people.length, supervisors: supervisors.size })}
        </div>
      </div>

      {/* ---- the form: add, or edit the row that was clicked ---- */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-border/60 p-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('assignment.people.staffId')}</span>
          <input
            className="h-9 w-36 rounded-md border border-border/60 bg-background px-3 text-sm disabled:opacity-60"
            value={form.staffId}
            // The primary key. Renaming a person is a save; re-keying one would be a
            // second row with the first still assigned to branches.
            disabled={editing !== ''}
            onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('assignment.people.displayName')}</span>
          <input
            className="h-9 w-64 rounded-md border border-border/60 bg-background px-3 text-sm"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('assignment.people.role')}</span>
          <select
            className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            {/* 🔑 Blank is a legitimate Role, not an empty choice: the pure manager
                who supervises people and serves no branch at all. */}
            <option value="">{t('assignment.people.roleNone')}</option>
            {PICKABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(roleLabelKey(role))}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t('assignment.people.supervisor')}</span>
          {/* 🚩 THE WHOLE ROSTER, unfiltered by Role. Anyone may supervise anyone,
              because supervising is not a role — and naming somebody here is what
              makes the Supervisors group appear in the Served by control on four
              screens. */}
          <select
            className="h-9 w-56 rounded-md border border-border/60 bg-background px-2 text-sm"
            value={form.supervisorId}
            onChange={(e) => setForm((f) => ({ ...f, supervisorId: e.target.value }))}
          >
            <option value="">{t('assignment.nobodyOption')}</option>
            {offeredSupervisors.map((person) => (
              <option key={person.staffId} value={person.staffId}>
                {person.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          <span className="text-muted-foreground">{t('assignment.people.isActive')}</span>
        </label>

        <button
          type="button"
          className="h-9 rounded-md border border-border/60 px-4 text-sm font-medium disabled:opacity-50"
          disabled={invalid !== null || save.isPending}
          onClick={() => save.mutate(form)}
        >
          {editing === '' ? t('assignment.people.add') : t('assignment.people.update')}
        </button>

        {/* Which field is missing, not merely THAT one is — a disabled button with
            no reason beside it is the same dead end on a two-field form as on a
            twenty-field one. */}
        {invalid !== null && (
          <span className="pb-2 text-sm text-muted-foreground">
            {t('assignment.people.required', { field: t('assignment.people.' + invalid) })}
          </span>
        )}

        {editing !== '' && (
          <button
            type="button"
            className="h-9 rounded-md px-3 text-sm text-muted-foreground"
            onClick={() => {
              setForm(blankPerson())
              setEditing('')
              setFailure('')
            }}
          >
            {t('assignment.people.cancel')}
          </button>
        )}
      </div>

      {failure !== '' && <ErrorBanner message={failure} className="p-3" />}

      {visible.length === 0 ? (
        <EmptyState
          title={t('assignment.people.empty.title')}
          hint={t('assignment.people.empty.hint')}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-start text-muted-foreground">
              <tr>
                <th className="p-2 text-start">{t('assignment.people.staffId')}</th>
                <th className="p-2 text-start">{t('assignment.people.displayName')}</th>
                <th className="p-2 text-start">{t('assignment.people.role')}</th>
                <th className="p-2 text-start">{t('assignment.people.supervisor')}</th>
                <th className="p-2 text-start">{t('assignment.people.isSupervisor')}</th>
                <th className="p-2 text-start">{t('assignment.people.isActive')}</th>
                <th className="p-2 text-start">{t('assignment.columns.updatedBy')}</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((person) => (
                <tr key={person.staffId} className="border-t border-border/40">
                  <td className="p-2">{person.staffId}</td>
                  <td className="p-2">{person.displayName}</td>
                  <td className="p-2">{t(roleLabelKey(person.role))}</td>
                  <td className="p-2">
                    {person.supervisorId === '' ? '—' : nameOf(person.supervisorId)}
                  </td>
                  {/* 🔑 A supervisor is not a Role: this column is "somebody names
                      you", which is a different fact from the one beside it — and a
                      person can legitimately be both. */}
                  <td className="p-2">{supervisors.has(person.staffId) ? '✓' : ''}</td>
                  <td className="p-2">{person.isActive ? '✓' : ''}</td>
                  <td className="p-2">{person.updatedBy}</td>
                  <td className="p-2 text-end">
                    <button
                      type="button"
                      className="rounded border border-border/60 px-2 py-1 text-xs"
                      onClick={() => {
                        setForm(personToBody(person))
                        setEditing(person.staffId)
                        setFailure('')
                      }}
                    >
                      {t('assignment.people.edit')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
