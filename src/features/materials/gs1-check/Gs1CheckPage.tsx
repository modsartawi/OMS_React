import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { AlertTriangle, Check, FileSpreadsheet, History, Info, RotateCcw, ScanBarcode, Trash2, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import ScreenGate from '@/core/ui/ScreenGate'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { formatPair, fsi } from '@/core/util/bidi'
import { joinDayAndTime } from '@/core/util/date-format'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { materialAccessQuery } from '@/core/materials/api'
import { canCheckGs1 } from '@/core/materials/access'
import type { Gs1CheckAnswer } from '@/core/models/materials'
import { gs1CheckApi } from './api'
import { EXPAND_COL_ID, EXPORT_AS_TEXT, scanColumns, type ScanGridContext, type ScanRow } from './columns'
import { historyQuery, historyRequest } from './history-on-demand'
import { GS1_LIST_CAP, addScans, emptyScanList, scanBatches, splitScans, visibleScan, type ScanEntry, type ScanList } from './scan-buffer'
import {
  batchView,
  isDuplicate,
  issueCategoryKey,
  materialReasonView,
  showsSyncNote,
  statusView,
  trxTypeView,
  wellFormedView,
} from './verdict-view'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'

/**
 * GS1 check (ticket 454, BackOffice spec 2544 stories 34–43): scan a DataMatrix — or paste codes
 * with `#` separators — and read the server's verdict: well-formed or its issues, the material,
 * the vendor batch, and whether the unit is sellable, sold or held; keep scanning to build a list
 * of up to 500, open a unit's sale/return history on demand, and export the list.
 *
 * Behind `canCheckGs1` on the ONE Materials probe, the same predicate the menu leaf reads.
 * 🚩 The page never judges a code itself — every verdict is the server's, shown as given. Its
 * doors (`MaterialWeb/Gs1/Check`, `Gs1/History`) are BackOffice 2549.
 */
export default function Gs1CheckPage() {
  const { t } = useTranslation('materials-gs1-check')
  return (
    <ScreenGate query={materialAccessQuery()} can={canCheckGs1} ns="materials-gs1-check" title={t('title')} subtitle={t('subtitle')}>
      <Gs1Check />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef<ScanRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  filter: true,
  suppressHeaderMenuButton: true,
}

const PANEL = 'flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3'

/** The number a sentence names, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

function Gs1Check() {
  const { t, i18n } = useTranslation('materials-gs1-check')
  const box = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')
  const [list, setList] = useState<ScanList>(emptyScanList)
  const [answers, setAnswers] = useState<ReadonlyMap<number, Gs1CheckAnswer>>(new Map())
  const [failed, setFailed] = useState<ReadonlySet<number>>(new Set())
  const [refused, setRefused] = useState(0)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  // The last failed batch's error, kept apart from the mutation's own state: a later batch that
  // succeeds must not wipe the server's words off the banner.
  const [failure, setFailure] = useState<unknown>(null)
  // Every id below this was cleared. Ids keep counting up across a Clear, so a batch still in
  // flight when the list was cleared is recognised by its ids and dropped, answer or error alike.
  const clearedBelow = useRef(1)

  // Each batch of new scans is ONE `POST MaterialWeb/Gs1/Check`; its answers come back in request
  // order and are pinned to the scans by id.
  const check = useMutation({
    mutationFn: (batch: ScanEntry[]) => gs1CheckApi.check(batch.map((e) => e.code)),
    onSuccess: (data, batch) => {
      if (batch[0] && batch[0].id < clearedBelow.current) return
      setAnswers((prev) => {
        const next = new Map(prev)
        batch.forEach((entry, i) => {
          if (data[i]) next.set(entry.id, data[i])
        })
        return next
      })
      const unanswered = batch.filter((_, i) => !data[i]).map((e) => e.id)
      if (unanswered.length > 0) setFailed((prev) => new Set([...prev, ...unanswered]))
    },
    onError: (err, batch) => {
      if (batch[0] && batch[0].id < clearedBelow.current) return
      setFailure(err)
      setFailed((prev) => new Set([...prev, ...batch.map((e) => e.id)]))
    },
  })

  function send(entries: ScanEntry[]) {
    for (const batch of scanBatches(entries)) check.mutate(batch)
  }

  function add(scans: readonly string[]) {
    const result = addScans(list, scans)
    setList(result.list)
    setRefused(result.refused.length)
    send(result.added)
  }

  function commit() {
    const scans = splitScans(draft)
    setDraft('')
    if (scans.length > 0) add(scans)
    box.current?.focus()
  }

  function retry() {
    const again = list.entries.filter((e) => failed.has(e.id))
    setFailed(new Set())
    send(again)
    box.current?.focus()
  }

  function clear() {
    clearedBelow.current = list.nextId
    setList({ entries: [], nextId: list.nextId })
    setAnswers(new Map())
    setFailed(new Set())
    setFailure(null)
    setRefused(0)
    setExpandedId(null)
    check.reset()
    box.current?.focus()
  }

  const rows = useMemo<ScanRow[]>(
    () =>
      list.entries.map((e) => ({
        id: e.id,
        code: e.code,
        listDuplicate: e.duplicate,
        answer: answers.get(e.id) ?? null,
        failed: failed.has(e.id),
      })),
    [list.entries, answers, failed],
  )
  const latest = rows.at(-1) ?? null
  const expanded = rows.find((r) => r.id === expandedId) ?? null
  const pending = rows.some((r) => !r.answer && !r.failed)

  const columns = useMemo(() => scanColumns(t, i18n.language), [t, i18n.language])
  const gridApi = useRef<GridApi<ScanRow> | null>(null)
  const context = useMemo<ScanGridContext>(
    () => ({ expandedId, toggle: (id) => setExpandedId((prev) => (prev === id ? null : id)) }),
    [expandedId],
  )
  // The chevrons and the open row's mark read `expandedId` through the context: redraw the row that
  // closed and the row that opened when it moves — only those two.
  const lastExpanded = useRef<number | null>(null)
  useEffect(() => {
    const api = gridApi.current
    const ids = [lastExpanded.current, expandedId].filter((id): id is number => id !== null)
    lastExpanded.current = expandedId
    const rowNodes = ids.map((id) => api?.getRowNode(String(id))).filter((n) => n !== undefined)
    if (api && rowNodes.length > 0) api.redrawRows({ rowNodes })
  }, [expandedId])

  /** The list as shown — its columns, filters and sort — through the core writer. */
  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t('export.sheet'), {
        skip: (colId) => colId === EXPAND_COL_ID,
        asText: (colId) => EXPORT_AS_TEXT.has(colId),
      })
      await writeWorkbook([sheet], xlsxFileName(t('export.fileName')))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(figure(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(20rem,2fr)_3fr]">
        {/* ── The scan box ── */}
        <div className={PANEL} data-gs1-scan-panel="">
          <Field label={t('scan.label')}>
            <Input
              ref={box}
              // Always ready for the next scan: focused on landing, and again after every action.
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commit()
                }
              }}
              onPaste={(e) => {
                // A single-line box would fold a pasted block into one line; several lines are
                // several scans, so they are added at once, each byte for byte.
                const text = e.clipboardData.getData('text')
                if (!/[\r\n]/.test(text)) return
                e.preventDefault()
                add(splitScans(text))
              }}
              placeholder={t('scan.placeholder')}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="gs1-scan-note"
              className="font-mono"
              data-gs1-scan=""
            />
          </Field>
          <div id="gs1-scan-note" className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">{t('scan.hint')}</span>
            <span className="text-muted-foreground" data-gs1-count={rows.length}>
              <Trans
                t={t}
                i18nKey="scan.count"
                count={rows.length}
                values={{ n: figure(rows.length), max: figure(GS1_LIST_CAP) }}
                components={{ n: <Ltr />, max: <Ltr /> }}
              />
            </span>
            {/* The 501st is refused HERE, before any call — the door's MAT-00005, said first. */}
            {refused > 0 && (
              <p role="alert" className="flex items-center gap-1.5 text-danger-800" data-gs1-cap-refused={refused}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>
                  <Trans
                    t={t}
                    i18nKey="scan.refused"
                    count={refused}
                    values={{ n: figure(refused), max: figure(GS1_LIST_CAP) }}
                    components={{ n: <Ltr />, max: <Ltr /> }}
                  />
                </span>
              </p>
            )}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <Button
              variant="outlined"
              onClick={clear}
              disabled={rows.length === 0}
              data-gs1-clear=""
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {t('scan.clear')}
            </Button>
            {pending && (
              <span className="text-xs text-muted-foreground" role="status">
                {t('scan.checking')}
              </span>
            )}
          </div>
        </div>

        {/* ── The latest scan's verdict ── */}
        <VerdictCard row={latest} onShowHistory={(id) => setExpandedId(id)} />
      </div>

      {failed.size > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-gs1-failed={failed.size}>
          <ErrorBanner
            className="flex-1 p-2.5"
            title={t('scan.failedTitle')}
            message={apiErrorMessage(failure, t('scan.failed'))}
          />
          <Button variant="outlined" onClick={retry} disabled={check.isPending} data-gs1-retry="">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('scan.retry')}
          </Button>
        </div>
      )}

      {/* ── The scan list ── */}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outlined" disabled={rows.length === 0} onClick={() => void exportXlsx()} data-gs1-export="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
        </div>
        <div className="relative h-[24rem]" data-gs1-grid="">
          <AgGridReact<ScanRow>
            theme={omsGridTheme}
            rowData={rows}
            columnDefs={columns}
            defaultColDef={DEFAULT_COL_DEF}
            context={context}
            getRowId={({ data }) => String(data.id)}
            onGridReady={({ api }) => {
              gridApi.current = api
            }}
            onGridPreDestroyed={() => {
              gridApi.current = null
            }}
            rowClassRules={OPEN_ROW}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            tooltipShowDelay={500}
            animateRows={false}
            noRowsOverlayComponent={NoScans}
          />
        </div>
      </div>

      {/* ── One unit's history, on demand: under the grid, never fetched before it is opened ── */}
      {expanded?.answer && <HistoryPane row={expanded} onClose={() => setExpandedId(null)} />}
    </div>
  )
}

/** The row whose history is open, marked through a token (read from the context, see the redraw). */
const OPEN_ROW = { 'bg-primary-050': ({ data, context }: { data?: ScanRow; context: ScanGridContext }) => data?.id === context.expandedId }

function NoScans() {
  const { t } = useTranslation('materials-gs1-check')
  return <span className="text-sm text-muted-foreground">{t('grid.empty')}</span>
}

/** A label above a value, the card's one shape. */
function ReadField({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-0.5 ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  )
}

/** The verdict card for the latest scan — every field the server's, as given. */
function VerdictCard({ row, onShowHistory }: { row: ScanRow | null; onShowHistory: (id: number) => void }) {
  const { t } = useTranslation('materials-gs1-check')
  const blank = <span className="text-muted-foreground">{t('card.blank')}</span>
  const machine = (value: string | null | undefined) => (value ? <Ltr>{value}</Ltr> : blank)

  const a = row?.answer ?? null
  const status = a ? statusView(a.status) : null
  const batch = a ? batchView(a.batch) : null
  const wellFormed = a ? wellFormedView(a.parse.valid) : null
  const reason = a?.materialReason ? materialReasonView(a.materialReason) : null

  return (
    <div className={PANEL} data-gs1-card={row ? (a ? 'answered' : row.failed ? 'failed' : 'pending') : 'empty'}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ScanBarcode className="h-3.5 w-3.5" aria-hidden />
        {t('card.title')}
        {row && isDuplicate(row.listDuplicate, a) && (
          <span data-gs1-card-duplicate="">
            <StatusBadge sev="warn">{t('badges.duplicate')}</StatusBadge>
          </span>
        )}
      </div>
      {!row ? (
        <p className="py-4 text-sm text-muted-foreground">{t('card.empty')}</p>
      ) : (
        <>
          <div className="break-all font-mono text-[12px] text-foreground" data-gs1-card-code="">
            <Ltr>{visibleScan(row.code)}</Ltr>
          </div>
          {!a ? (
            <p className="py-2 text-sm text-muted-foreground">{row.failed ? t('card.failed') : t('card.pending')}</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <ReadField label={t('card.wellFormed')} wide>
                <div className="flex flex-col gap-1" data-gs1-card-well-formed={a.parse.valid}>
                  <span className="inline-flex items-center gap-1">
                    {a.parse.valid && <Check className="h-3.5 w-3.5 text-success-800" aria-hidden />}
                    {wellFormed && <StatusBadge sev={wellFormed.sev}>{t(wellFormed.key)}</StatusBadge>}
                  </span>
                  {a.parse.issues.length > 0 && (
                    <ul className="flex flex-col gap-0.5 text-xs" aria-label={t('card.issues')} data-gs1-card-issues="">
                      {a.parse.issues.map((issue, i) => (
                        <li key={i} className="flex flex-wrap items-baseline gap-1.5" data-gs1-issue={issue.category}>
                          <span className="font-medium text-danger-800">{t(issueCategoryKey(issue.category))}</span>
                          <bdi className="text-muted-foreground">{issue.message}</bdi>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </ReadField>
              <ReadField label={t('card.status')} wide>
                <div className="flex flex-col gap-1" data-gs1-card-status={a.status ?? ''}>
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {status && <StatusBadge sev={status.sev}>{t(status.key)}</StatusBadge>}
                    {showsSyncNote(a.status) && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-gs1-sync-note="">
                        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {t('card.syncNote')}
                      </span>
                    )}
                  </span>
                  {a.status === 'SOLD' && a.soldRef && (
                    <span className="text-xs text-muted-foreground" data-gs1-sold-ref="">
                      <Trans
                        t={t}
                        i18nKey="card.soldRef"
                        values={{ store: a.soldRef.storeCode, till: a.soldRef.machine, invoice: a.soldRef.trxNumber }}
                        components={{ store: <Ltr />, till: <Ltr />, invoice: <Ltr /> }}
                      />
                    </span>
                  )}
                  {a.status === 'HELD' && a.heldBy && (
                    <span className="text-xs text-muted-foreground" data-gs1-held-by="">
                      <Trans
                        t={t}
                        i18nKey="card.heldBy"
                        values={{ doc: a.heldBy.documentNo, store: a.heldBy.storeCode }}
                        components={{ doc: <Ltr />, store: <Ltr /> }}
                      />
                    </span>
                  )}
                </div>
              </ReadField>
              <ReadField label={t('card.gtin')}>{machine(a.parse.gtin)}</ReadField>
              <ReadField label={t('card.expiry')}>{machine(a.parse.expiry)}</ReadField>
              <ReadField label={t('card.lot')}>{machine(a.parse.lot)}</ReadField>
              <ReadField label={t('card.serial')}>{machine(a.parse.serial)}</ReadField>
              <ReadField label={t('card.material')} wide>
                {a.material ? (
                  <div className="flex flex-col" data-gs1-card-material={a.material.materialNumber}>
                    <span className="font-mono text-[12px]">
                      <Ltr>{a.material.materialNumber}</Ltr>
                    </span>
                    {/* Inline isolates in a span, so a description keeps the card's own alignment. */}
                    {a.material.description && (
                      <span>
                        <bdi>{a.material.description}</bdi>
                      </span>
                    )}
                    {a.material.description2 && (
                      <span className="text-muted-foreground">
                        <bdi>{a.material.description2}</bdi>
                      </span>
                    )}
                  </div>
                ) : reason ? (
                  <span data-gs1-card-reason={a.materialReason}>
                    <StatusBadge sev={reason.sev}>{t(reason.key)}</StatusBadge>
                  </span>
                ) : (
                  blank
                )}
              </ReadField>
              <ReadField label={t('card.batch')}>
                {batch && (
                  <span data-gs1-card-batch={a.batch}>
                    <StatusBadge sev={batch.sev}>{t(batch.key)}</StatusBadge>
                  </span>
                )}
              </ReadField>
              <ReadField label={t('columns.historyCount')}>
                <div className="flex flex-col items-start gap-1">
                  <span className="text-xs text-muted-foreground" data-gs1-card-history-count={a.historyCount}>
                    <Trans t={t} i18nKey="card.historyCount" count={a.historyCount} values={{ n: figure(a.historyCount) }} components={{ n: <Ltr /> }} />
                  </span>
                  {historyRequest(a) && (
                    <Button variant="text" className="h-6 px-1.5 text-xs" onClick={() => onShowHistory(row.id)} data-gs1-card-show-history="">
                      <History className="h-3.5 w-3.5" aria-hidden />
                      {t('card.showHistory')}
                    </Button>
                  )}
                </div>
              </ReadField>
            </dl>
          )}
        </>
      )}
    </div>
  )
}

/**
 * One unit's sale/return trail, oldest → newest. 🚩 Asked only once its row is opened, and once per
 * unit (the query is keyed on material + serial + lot). A row whose lot differs from the scan is
 * highlighted through the attention token and says so in words.
 */
function HistoryPane({ row, onClose }: { row: ScanRow; onClose: () => void }) {
  const { t } = useTranslation('materials-gs1-check')
  const request = historyRequest(row.answer)
  const history = useQuery(historyQuery(request, true, row.answer?.historyCount ?? null))
  if (!request) return null

  const th = 'px-2.5 py-1.5 text-start text-[11px] font-medium text-muted-foreground'
  const td = 'px-2.5 py-1.5'

  return (
    <section className={PANEL} data-gs1-history={row.id}>
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="flex-1 text-sm font-semibold">
          <Trans
            t={t}
            i18nKey="history.title"
            values={{ serial: request.serial, material: request.material }}
            components={{ serial: <Ltr />, material: <Ltr /> }}
          />
        </h2>
        <Button variant="text" className="h-7 px-1.5" onClick={onClose} aria-label={t('history.close')} title={t('history.close')} data-gs1-history-close="">
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {history.isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t('history.loading')}
        </p>
      ) : history.isError ? (
        <ErrorBanner className="p-2.5" title={t('history.failedTitle')} message={apiErrorMessage(history.error, t('history.failed'))} />
      ) : history.data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-gs1-history-empty="">
          {t('history.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60">
              <tr>
                <th className={th}>{t('history.columns.when')}</th>
                <th className={th}>{t('history.columns.trxType')}</th>
                <th className={th}>{t('history.columns.store')}</th>
                <th className={th}>{t('history.columns.till')}</th>
                <th className={th}>{t('history.columns.invoice')}</th>
                <th className={th}>{t('history.columns.lot')}</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((h, i) => {
                const type = trxTypeView(h.trxType)
                return (
                  <tr
                    key={i}
                    className={`border-b border-border/40 last:border-b-0 ${h.lotMismatch ? 'bg-attention-050' : ''}`}
                    data-gs1-history-row={h.trxNumber}
                    data-lot-mismatch={h.lotMismatch}
                  >
                    {/* Day and time arrive as two fields: joined as sent, never made an instant. */}
                    <td className={`${td} tabular-nums`}>
                      <Ltr>{joinDayAndTime(h.date, h.time)}</Ltr>
                    </td>
                    <td className={td}>
                      <StatusBadge sev={type.sev}>{t(type.key)}</StatusBadge>
                    </td>
                    <td className={td}>
                      <Ltr>{formatPair(h.storeCode, h.storeName)}</Ltr>
                    </td>
                    <td className={`${td} font-mono text-[12px]`}>
                      <Ltr>{h.machine}</Ltr>
                    </td>
                    <td className={`${td} font-mono text-[12px]`}>
                      <Ltr>{h.trxNumber}</Ltr>
                    </td>
                    <td className={td}>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[12px]">{h.lot ? <Ltr>{h.lot}</Ltr> : null}</span>
                        {h.lotMismatch && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-attention-800" data-gs1-lot-mismatch="">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                            {t('history.lotMismatch')}
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
