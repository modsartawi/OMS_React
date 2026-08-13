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
import { assignmentOptionsQuery, canOpenAssignment, collectionApi } from './api'
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
import { GRID_PAGE_SIZE } from './cap'
import { EmptyState, ListShimmer } from './GridStates'
import ScreenGate from './ScreenGate'
import type { AssignmentPerson } from './served-by'

/**
 * Collection Assignment (`/collection/assignment`) — BackOffice spec 1162 D11,
 * ticket 1169. The one screen in this area that WRITES.
 *
 * It lists **all 1394 open branches**, not the 139 finance's spreadsheet covers,
 * because the gap is the work: ~1255 branches have nobody, and a screen listing
 * the assignment table could not reach the majority of its own subject.
 *
 * ⚠️ **It opens on everything, unfiltered** — deliberately not the default-to-mine
 * the four inquiry screens land on. Its user maintains the estate rather than
 * finding their own work.
 *
 * 🔑 **The one behaviour to preserve above all: a touched row stays on screen
 * until it is saved.** Under *With a gap* — the filter the 1255 actually get
 * closed from — filling a slot makes the row stop matching, and it would vanish
 * mid-edit with the edit unsaved. The rule lives in `visibleBranches`; this Page
 * only has to keep an honest `touched` set, which is why an edit is dropped on
 * SUCCESS and kept on failure.
 *
 * The estate arrives in one payload and the screen searches, filters and pages
 * over it client-side — 1394 rows is one read, and a server round trip per
 * keystroke over a 1394-row master would be slower than the filter it replaces.
 *
 * ⚠️ **Copied shape, not extracted** (244 §1), like the four screens beside it.
 */
export default function CollectionAssignmentPage() {
  const { t } = useTranslation('collection')
  return (
    <ScreenGate
      can={canOpenAssignment}
      title={t('assignment.title')}
      subtitle={t('assignment.subtitle')}
    >
      {/* A child component, not inlined markup: its queries must not run for a
          session the gate is about to refuse. */}
      <AssignmentBody />
    </ScreenGate>
  )
}

/** The two slots, so the save path is written once rather than per column. */
type Slot = 'accountantId' | 'collectorId'

function AssignmentBody() {
  const { t } = useTranslation('collection')
  const queryClient = useQueryClient()

  const branchesKey = ['collection', 'assignment', 'branches'] as const

  const list = useQuery({
    queryKey: branchesKey,
    queryFn: () => collectionApi.assignmentBranches(),
  })

  // The roster — the SAME payload and the SAME cache key the *Served by* picker
  // on the four inquiry screens uses. The two dropdowns are built from it, and
  // so is every name this screen shows: there are no name columns on a row.
  const roster = useQuery(assignmentOptionsQuery())

  const accountants = useMemo<AssignmentPerson[]>(
    () => roster.data?.accountants ?? [],
    [roster.data],
  )
  const collectors = useMemo<AssignmentPerson[]>(() => roster.data?.collectors ?? [], [roster.data])

  const nameOf = useMemo(() => {
    const names = new Map<string, string>()
    for (const person of [...accountants, ...collectors]) names.set(person.staffId, person.displayName)
    // An id with no roster row echoes itself rather than rendering blank — a
    // person who was removed from the roster after being assigned is still a
    // legible id rather than an empty cell.
    return (staffId: string) => names.get(staffId) ?? staffId
  }, [accountants, collectors])

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

  const touched = useMemo(() => new Set(Object.keys(edits)), [edits])
  const visible = useMemo(
    () => visibleBranches(rows, filter, nameOf, touched),
    [rows, filter, nameOf, touched],
  )
  const counts = useMemo(() => assignmentCounts(rows), [rows])

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

  const columns = useMemo<ColDef<AssignmentBranch>[]>(
    () => [
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
    [accountants, collectors, onSlotChange, saving, t],
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
            {...omsGridDirection}
          />
        </div>
      )}
    </>
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
