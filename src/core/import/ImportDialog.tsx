import { useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GetRowIdFunc, RowClassRules } from 'ag-grid-community'
import { Loader2 } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { apiErrorKind, apiErrorMessage } from '@/core/api'
import type { ImportResultModel } from '@/core/models/import-result'
import { decodeImportFile, importTally, parseImport, sendableLines, type ImportLine, type ImportOkLine } from './parse-import'
import { importResult, type ImportResultView } from './import-result'
import { importPreviewColumns } from './preview-columns'

interface Props<K extends string> {
  /**
   * The importing feature's i18n namespace. It carries the dialog's `import.*` block (file, paste,
   * summary, send, result, reasons…), so the copy — and its Arabic — stays the feature's.
   */
  ns: string
  /** Which import this is: the dialog's `data-import-dialog` hook. */
  kind: string
  title: string
  /** The file's format, worded by the feature: its columns in order and the trailing X. */
  format: string
  /** The feature's column spec: the field keys, in file order. */
  columns: readonly K[]
  /** Each column's preview header, worded by the feature. */
  header: (key: K) => string
  /** Posts the lines — every line of the file, in order, none in error — to the feature's door. */
  send: (lines: readonly ImportOkLine<K>[]) => Promise<ImportResultModel>
  onClose: () => void
  /** The import reached the server (or may have): the page reloads its lists. */
  onImported: () => void
}

const lineRowId: GetRowIdFunc<ImportLine<string>> = ({ data }) => String(data.line)

const ROW_CLASS: RowClassRules<ImportLine<string>> = { 'bg-danger-050': ({ data }) => !!data?.error }

const CELL = 'border-b border-border px-2 py-1 text-start align-top'

/** A count, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

/**
 * The WPF tab-separated import (spec 430 D8/D14) — built for Cities & districts at ticket 437 and
 * graduated here at ticket 438, when Document source users became its second feature (features may
 * not import each other). The file, picked or pasted, is read by the core parser against the
 * feature's column spec into a preview before anything is sent. A line with the wrong number of
 * columns is flagged and keeps Send off until the text is fixed; a header is an ordinary line, so
 * it is seen. Send hands the feature every line (it maps them to its own body: `isDelete` or
 * `isDeleted`); the result says what was applied, what was unchanged, and every line the server
 * skipped and why.
 *
 * What core owns is the SHAPE; the copy is the feature's (`ns`), as `ScreenGate` does it.
 *
 * The text box is the one source: a picked file fills it, and an edit re-reads the preview.
 *
 * It is open while it is mounted: a caller mounts it per import (`{kind && <ImportDialog … />}`), so
 * nothing of one import is drawn in the next.
 */
export default function ImportDialog<K extends string>({
  ns,
  kind,
  title,
  format,
  columns,
  header,
  send,
  onClose,
  onImported,
}: Props<K>) {
  const { t } = useTranslation(ns)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [readError, setReadError] = useState(false)
  const [result, setResult] = useState<ImportResultView | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const lines = useMemo(() => parseImport(text, columns), [text, columns])
  // What Send posts, and whether it is offered: one reading of the rule.
  const ok = useMemo(() => sendableLines(lines), [lines])
  const tally = importTally(lines)
  const previewCols = useMemo(() => importPreviewColumns(t, columns, header), [t, columns, header])
  const defaultColDef = useMemo<ColDef<ImportLine<string>>>(
    () => ({ ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true, suppressHeaderMenuButton: true }),
    [],
  )

  const sending = useMutation({
    mutationFn: send,
    onSuccess: (answer) => setResult(importResult(answer)),
    // Even a failed or unanswered send may have committed: the lists are read again either way.
    onSettled: () => onImported(),
  })

  function reset() {
    setText('')
    setFileName('')
    setReadError(false)
    setResult(null)
    sending.reset()
    if (fileInput.current) fileInput.current.value = ''
  }

  // A send in flight is not abandoned by Escape or a backdrop click: its answer is the user's.
  function close() {
    if (sending.isPending) return
    onClose()
  }

  async function onFile(file: File | null) {
    setReadError(false)
    sending.reset()
    if (!file) return
    try {
      setText(decodeImportFile(new Uint8Array(await file.arrayBuffer())))
      setFileName(file.name)
    } catch {
      // Nothing of an earlier file stays behind to be sent in this one's name.
      setText('')
      setFileName('')
      setReadError(true)
    }
  }

  function submit() {
    if (!ok || sending.isPending) return
    sending.mutate(ok)
  }

  const sendable = ok !== null && !sending.isPending

  const footer = result ? (
    <>
      <Button variant="text" onClick={reset} data-import-again="">
        {t('import.again')}
      </Button>
      <Button variant="primary" onClick={close} data-import-close="">
        {t('import.close')}
      </Button>
    </>
  ) : (
    <>
      <Button variant="text" onClick={close} disabled={sending.isPending}>
        {t('import.cancel')}
      </Button>
      <Button variant="primary" onClick={submit} disabled={!sendable} data-import-send="">
        {sending.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {sending.isPending ? t('import.sending') : t('import.send', { count: tally.lines })}
      </Button>
    </>
  )

  return (
    <Modal open onClose={close} onShow={reset} title={title} width="72rem" footer={footer}>
      <div className="flex flex-col gap-3 text-sm" data-import-dialog={kind}>
        {result ? (
          <ResultPanel ns={ns} result={result} />
        ) : (
          <>
            <p className="text-xs text-muted-foreground" data-import-format="">
              {format}
            </p>
            <div className="flex flex-wrap items-start gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium">{t('import.file')}</span>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".txt,.tsv,.tab,text/plain,text/tab-separated-values"
                  disabled={sending.isPending}
                  onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
                  className="rounded-md border border-border bg-card p-2 text-sm file:me-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs"
                  data-import-file=""
                />
                {fileName && (
                  <span className="text-xs text-muted-foreground">
                    <Trans t={t} i18nKey="import.fileChosen" values={{ name: fileName }} components={{ name: <bdi /> }} />
                  </span>
                )}
              </label>
              <label className="flex min-w-72 flex-1 flex-col gap-1">
                <span className="text-xs font-medium">{t('import.paste')}</span>
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value)
                    sending.reset()
                  }}
                  disabled={sending.isPending}
                  rows={4}
                  spellCheck={false}
                  // The rows are tab-separated machine text: they read left to right in either UI.
                  dir="ltr"
                  className="rounded-md border border-border/60 bg-background p-2 font-mono text-xs text-foreground focus:border-primary/50 focus:outline-none"
                  data-import-text=""
                />
              </label>
            </div>

            {readError && <ErrorBanner className="p-2.5" message={t('import.readFailed')} />}

            {lines.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-3 text-xs" data-import-summary="">
                  <span className="font-medium">
                    <Trans
                      t={t}
                      i18nKey="import.summary"
                      count={tally.lines}
                      values={{ n: figure(tally.lines), upserts: figure(tally.upserts), deletes: figure(tally.deletes) }}
                      components={{ n: <Ltr />, upserts: <Ltr />, deletes: <Ltr /> }}
                    />
                  </span>
                  {tally.errors > 0 && (
                    <span className="font-medium text-danger-800" role="alert" data-import-blocked="">
                      <Trans
                        t={t}
                        i18nKey="import.blocked"
                        count={tally.errors}
                        values={{ n: figure(tally.errors) }}
                        components={{ n: <Ltr /> }}
                      />
                    </span>
                  )}
                </div>
                <div className="h-64" data-import-preview="">
                  <AgGridReact<ImportLine<string>>
                    theme={omsGridTheme}
                    rowData={lines}
                    columnDefs={previewCols}
                    defaultColDef={defaultColDef}
                    getRowId={lineRowId}
                    rowClassRules={ROW_CLASS}
                    rowHeight={OMS_GRID_ROW_HEIGHT}
                    headerHeight={OMS_GRID_HEADER_HEIGHT}
                    animateRows={false}
                    suppressColumnVirtualisation
                  />
                </div>
              </>
            )}

            {sending.isError && (
              <ErrorBanner
                className="p-2.5"
                // A refusal is the server's decision: nothing was applied. Anything else may have been.
                title={apiErrorKind(sending.error) === 'business' ? t('import.refusedTitle') : t('import.failedTitle')}
                message={apiErrorMessage(sending.error, t('import.failed'))}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

/** What the server answered: the three counts, then every skipped line with its key and reason. */
function ResultPanel({ ns, result }: { ns: string; result: ImportResultView }) {
  const { t } = useTranslation(ns)
  const counts = [
    ['applied', result.applied],
    ['unchanged', result.unchanged],
    ['skipped', result.skippedCount],
  ] as const
  return (
    <div className="flex flex-col gap-3" data-import-result="">
      <dl className="flex flex-wrap gap-6">
        {counts.map(([key, n]) => (
          <div key={key} className="flex flex-col" data-import-count={key}>
            <dt className="text-xs text-muted-foreground">{t(`import.result.${key}`)}</dt>
            <dd className={'text-lg font-semibold tabular-nums ' + (key === 'skipped' && n > 0 ? 'text-attention-800' : '')}>
              <Ltr>{figure(n)}</Ltr>
            </dd>
          </div>
        ))}
      </dl>
      {result.clean ? (
        <p className="text-sm text-muted-foreground" data-import-clean="">
          {t('import.result.clean')}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-medium">{t('import.result.skippedTitle')}</h3>
          <div className="max-h-[45vh] overflow-auto rounded-md border border-border/60">
            <table className="w-full border-collapse text-xs" data-import-skipped="">
              <thead className="sticky top-0 bg-card text-muted-foreground">
                <tr>
                  <th className={CELL}>{t('import.result.line')}</th>
                  <th className={CELL}>{t('import.result.key')}</th>
                  <th className={CELL}>{t('import.result.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {result.skipped.map((s, i) => (
                  <tr key={`${s.line}-${i}`} data-skipped-line={s.line}>
                    <td className={CELL + ' tabular-nums'}>
                      <Ltr>{figure(s.line)}</Ltr>
                    </td>
                    <td className={CELL + ' font-mono'}>
                      <Ltr>{s.key}</Ltr>
                    </td>
                    <td className={CELL} data-reason={s.reason}>
                      {s.reasonKey ? t(`import.reason.${s.reasonKey}`) : <Ltr>{s.reason}</Ltr>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
