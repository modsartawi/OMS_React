import { useId, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { Upload } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { loyGroupRefusal } from '@/core/loy-groups/refusal'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { xlsxRows } from '@/core/util/xlsx-read'
import { membersApi } from './api'
import { bulkOutcome, type BulkOutcome, type BulkRejectedLine } from './bulk-outcome'
import { LOY_GROUP_BULK_MAX, mobileLines, type MobileSource } from './mobile-lines'
import RefusalLine from './RefusalLine'

const REJECTED_COL_DEF: ColDef<BulkRejectedLine> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: false,
  filter: false,
  resizable: true,
  cellDataType: false,
}

/** A picked file as the parser's source: an `.xlsx` by its first sheet, anything else as CSV text. */
async function sourceOfFile(file: File): Promise<MobileSource> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (/\.xlsx$/i.test(file.name)) return { kind: 'sheet', rows: await xlsxRows(bytes) }
  return { kind: 'csv', text: new TextDecoder().decode(bytes) }
}

/**
 * Load a list (oms ticket 633; door BackOffice 3175 `POST LoyGroupWeb/Groups/Members/Bulk`). The maintainer
 * pastes mobiles or picks a `.csv` / `.xlsx`; the browser turns either into lines (`./mobile-lines`) and
 * previews them — how many go up, the header skipped, or the 50,000 cap refused before sending. The
 * answer shows a count per outcome and every line not added, with its reason, as typed.
 *
 * Valid lines are added even when others are not, so after any answer the page's members and count are
 * read again (`onLoaded`). A whole-batch refusal shows the server's sentence and code.
 *
 * Mounted per load by the Members tab, so nothing of one load is drawn in the next.
 */
export default function BulkLoadDialog({ groupId, onClose, onLoaded }: { groupId: string; onClose: () => void; onLoaded: () => void }) {
  const { t, i18n } = useTranslation('loy-groups')
  const [source, setSource] = useState<MobileSource>({ kind: 'paste', text: '' })
  const [fileName, setFileName] = useState('')
  const [fileFailed, setFileFailed] = useState(false)
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null)
  const fileId = useId()

  const read = useMemo(() => mobileLines(source), [source])
  const n = (x: number) => fsi(formatFigure(x))

  const load = useMutation({
    mutationFn: (lines: string[]) => membersApi.bulk({ groupId, lines }),
    onSuccess: (answer, lines) => setOutcome(bulkOutcome(answer, lines.length)),
    // Valid lines may have been added whatever came back: the members are read again either way.
    onSettled: () => onLoaded(),
  })
  const refusal = load.isError ? loyGroupRefusal(load.error, i18n.language, t('members.bulk.failed')) : null

  const close = () => {
    if (!load.isPending) onClose()
  }
  const paste = (text: string) => {
    setFileName('')
    setFileFailed(false)
    load.reset()
    setSource({ kind: 'paste', text })
  }
  const pick = async (file: File | undefined) => {
    if (!file || load.isPending) return
    setFileFailed(false)
    load.reset()
    try {
      setSource(await sourceOfFile(file))
      setFileName(file.name)
    } catch {
      // Nothing of an earlier list stays behind to be sent in this file's name.
      setSource({ kind: 'paste', text: '' })
      setFileName('')
      setFileFailed(true)
    }
  }

  const columns = useMemo<ColDef<BulkRejectedLine>[]>(
    () => [
      { colId: 'line', headerName: t('members.bulk.rejected.line'), field: 'line', flex: 1, minWidth: 160 },
      {
        colId: 'reason',
        headerName: t('members.bulk.rejected.reason'),
        // An outcome this screen does not know is shown in the server's own word, never dropped.
        valueGetter: ({ data }) => (data ? (data.reason ? t(`members.bulk.outcome.${data.reason}`) : data.outcome) : ''),
        flex: 1,
        minWidth: 180,
      },
    ],
    [t],
  )

  const canLoad = read.lines.length > 0 && read.overBy === 0 && !load.isPending

  return (
    <Modal
      open
      onClose={close}
      title={t('members.bulk.title')}
      width="40rem"
      footer={
        outcome ? (
          <Button variant="primary" onClick={onClose} data-members-bulk-done="">
            {t('members.bulk.done')}
          </Button>
        ) : (
          <>
            <Button variant="text" onClick={close} disabled={load.isPending}>
              {t('members.bulk.cancel')}
            </Button>
            <Button variant="primary" onClick={() => load.mutate(read.lines)} disabled={!canLoad} data-members-bulk-submit="">
              {load.isPending ? t('members.bulk.saving') : t('members.bulk.submit')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3" data-members-bulk-dialog="">
        {!outcome && (
          <>
            <label
              htmlFor={fileId}
              className="flex cursor-pointer flex-col items-center gap-1.5 rounded-md border border-dashed border-border bg-card-2 px-4 py-4 text-center text-sm transition-colors hover:bg-accent"
              data-members-bulk-drop=""
            >
              <Upload className="size-4 text-muted-foreground" aria-hidden />
              <span className="font-medium">{t('members.bulk.pick')}</span>
              <span className="text-xs text-muted-foreground">{t('members.bulk.pickHint')}</span>
              <input
                id={fileId}
                type="file"
                accept=".csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={load.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  void pick(file)
                }}
                data-members-bulk-file=""
              />
            </label>
            {fileName !== '' && (
              <p className="text-xs text-muted-foreground" data-members-bulk-file-name="">
                {t('members.bulk.fileRead', { name: fsi(fileName) })}
              </p>
            )}
            {fileFailed && <ErrorBanner className="px-3 py-2" message={t('members.bulk.fileFailed')} />}

            <Field label={t('members.bulk.paste')} hint={t('members.bulk.pasteHint')}>
              <Textarea
                dir="ltr"
                rows={6}
                value={source.kind === 'paste' ? source.text : ''}
                onChange={(e) => paste(e.target.value)}
                placeholder={t('members.bulk.pastePlaceholder')}
                className="w-full font-mono"
                disabled={load.isPending}
                data-members-bulk-text=""
              />
            </Field>

            {read.header !== null && (
              <p className="text-xs text-muted-foreground" data-members-bulk-header="">
                {t('members.bulk.header', { header: fsi(read.header) })}
              </p>
            )}
            {read.overBy > 0 ? (
              <div data-members-bulk-over-cap="">
                <ErrorBanner className="px-3 py-2" message={t('members.bulk.overCap', { lines: n(read.lines.length), max: n(LOY_GROUP_BULK_MAX) })} />
              </div>
            ) : (
              read.lines.length > 0 && (
                <p className="text-sm" data-members-bulk-preview={String(read.lines.length)}>
                  {t('members.bulk.preview', { lines: n(read.lines.length) })}
                </p>
              )
            )}

            {refusal && (
              <div data-members-bulk-refused="">
                <ErrorBanner className="p-3" title={t('members.bulk.refused')} message={refusal.message}>
                  <RefusalLine code={refusal.code} />
                </ErrorBanner>
              </div>
            )}
          </>
        )}

        {outcome && (
          <div className="flex flex-col gap-3" data-members-bulk-result="">
            <p className="text-sm">{t('members.bulk.result.sent', { lines: n(outcome.sent) })}</p>
            <dl className="grid grid-cols-[auto_auto] justify-start gap-x-6 gap-y-1 text-sm">
              {outcome.counts.map((c) => (
                <div key={c.key} className="contents" data-members-bulk-count={c.key} data-count={String(c.count)}>
                  <dt className="text-muted-foreground">{t(`members.bulk.outcome.${c.key}`)}</dt>
                  <dd className="text-end tabular-nums">
                    <Ltr>{formatFigure(c.count)}</Ltr>
                  </dd>
                </div>
              ))}
            </dl>
            {!outcome.accountedFor && (
              <p className="text-xs text-muted-foreground" data-members-bulk-unaccounted="">
                {t('members.bulk.result.unaccounted', { total: n(outcome.total), lines: n(outcome.sent) })}
              </p>
            )}
            {outcome.rejected.length > 0 && (
              <>
                <h4 className="text-sm font-semibold">{t('members.bulk.rejected.title')}</h4>
                <div className="h-64" data-members-bulk-rejected="">
                  <AgGridReact<BulkRejectedLine>
                    theme={omsGridTheme}
                    rowData={outcome.rejected}
                    columnDefs={columns}
                    defaultColDef={REJECTED_COL_DEF}
                    rowHeight={OMS_GRID_ROW_HEIGHT}
                    headerHeight={OMS_GRID_HEADER_HEIGHT}
                    animateRows={false}
                    suppressColumnVirtualisation
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
