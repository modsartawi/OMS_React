import { useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, FileSpreadsheet } from 'lucide-react'
import { apiErrorCode } from '@/core/api'
import ImportAnswerDialog from '@/core/import/ImportAnswerDialog'
import ReasonDialog, { InlineRefusal } from '@/core/hungerstation/ReasonDialog'
import { fieldRefusal } from '@/core/hungerstation/reason'
import {
  HUNGERSTATION_ERRORS,
  type HungerStationMaterialImportResult,
  type HungerStationMaterialRow,
  type HungerStationMaterialsPage,
} from '@/core/models/hungerstation'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { xlsxRows } from '@/core/util/xlsx-read'
import { MATERIALS_KEY, materialsApi } from './api'
import { MATERIAL_IMPORT_MAX, parseMaterialImport } from './material-import'
import { withRow } from './materials-query'

/** How many problem rows the preview lists; the count says how many there are in all. */
const PROBLEMS_SHOWN = 50

/** What the last picked file did, said under the list. */
interface FileNote {
  tone: 'info' | 'error'
  text: string
}

/** The material a dialog is about — its number and both names, each isolated by its kind. */
function MaterialLine({ row }: { row: HungerStationMaterialRow }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm" data-dialog-material={row.materialNumber}>
      <span className="font-mono">
        <Ltr>{row.materialNumber}</Ltr>
      </span>
      <bdi>{row.nameEn}</bdi>
      <bdi>{row.nameAr}</bdi>
    </p>
  )
}

/**
 * **Change one material** (ticket 555; `PUT HungerStationWeb/Materials/{materialNumber}`): set
 * disabled and deleted, with a reason. The boxes open on the row's flags and Confirm waits for a
 * change. The door returns the row, which is patched into every cached page in place. DHS-00009 (the
 * material is no longer in the list) shows inline, the list is read again and Confirm stays off.
 */
export function ChangeDialog({ row, onClose }: { row: HungerStationMaterialRow; onClose: () => void }) {
  const { t } = useTranslation('hungerstation-materials')
  const qc = useQueryClient()
  const [disabled, setDisabled] = useState(row.disabled)
  const [deleted, setDeleted] = useState(row.deleted)
  const send = useMutation({
    mutationFn: (reason: string) => materialsApi.change(row.materialNumber, { disabled, deleted, reason }),
    onSuccess: (changed) => {
      qc.setQueriesData<HungerStationMaterialsPage>({ queryKey: MATERIALS_KEY }, (page) => withRow(page, changed))
      notify.success(t('change.done'), t('change.doneDetail', { material: fsi(row.materialNumber) }))
      onClose()
    },
    onError: (err) => {
      if (apiErrorCode(err) === HUNGERSTATION_ERRORS.noSuchMaterial) void qc.invalidateQueries({ queryKey: MATERIALS_KEY })
    },
  })
  const gone = fieldRefusal(send.error, [HUNGERSTATION_ERRORS.noSuchMaterial], t('change.goneHint'))
  const unchanged = disabled === row.disabled && deleted === row.deleted

  const box = (label: string, checked: boolean, set: (v: boolean) => void, hook: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          send.reset()
          set(e.target.checked)
        }}
        disabled={send.isPending || !!gone}
        {...{ [hook]: '' }}
      />
      {label}
    </label>
  )

  return (
    <ReasonDialog
      open
      title={t('change.title')}
      note={<span data-change-note="">{t('change.note')}</span>}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('change.confirm')}
      confirmDisabled={unchanged || !!gone}
      handledCodes={[HUNGERSTATION_ERRORS.noSuchMaterial]}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-2" data-change-dialog="">
        <MaterialLine row={row} />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-xs font-medium">{t('change.legend')}</legend>
          {box(t('change.disabled'), disabled, setDisabled, 'data-change-disabled')}
          {box(t('change.deleted'), deleted, setDeleted, 'data-change-deleted')}
        </fieldset>
        {gone && (
          <div className="flex flex-col gap-1" data-change-gone="">
            <p className="text-xs text-danger-800">{t('change.gone')}</p>
            <InlineRefusal message={gone.message} code={gone.code} />
          </div>
        )}
      </div>
    </ReasonDialog>
  )
}

/**
 * **Import the material list** (ticket 555; `POST HungerStationWeb/Materials/Import`): paste the WPF
 * sheet's rows (material number, then an `X` for disabled, then an `X` for deleted; `true` / `false`
 * read too) or pick an `.xlsx`, and send them with a reason. A picked sheet REPLACES the paste, its
 * first three columns written out tab-separated, so what is shown is what is parsed and sent.
 *
 * The preview says what the body carries before it goes: the rows (how many disabled, how many
 * deleted), the repeats collapsed (the last row wins), a header skipped, and every row that is not
 * a material number or holds a mark that cannot be read — any such row, or more than 5000 rows,
 * keeps Confirm off. DHS-00010 (the door's own refusal) shows inline under the list.
 */
export function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: (result: HungerStationMaterialImportResult) => void }) {
  const { t } = useTranslation('hungerstation-materials')
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [fileNote, setFileNote] = useState<FileNote | null>(null)
  // The latest pick (or edit) wins: an older file still being read never overwrites the list.
  const pickSeq = useRef(0)
  const list = useMemo(() => parseMaterialImport(text), [text])
  const marked = useMemo(
    () => ({ disabled: list.rows.filter((r) => r.disabled).length, deleted: list.rows.filter((r) => r.deleted).length }),
    [list.rows],
  )
  const send = useMutation({
    mutationFn: (reason: string) => materialsApi.import({ rows: list.rows, reason }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: MATERIALS_KEY })
      onDone(result)
    },
  })
  const listRefusal = fieldRefusal(send.error, [HUNGERSTATION_ERRORS.importInvalid], t('import.failedHint'))

  async function pick(file: File | null) {
    if (!file) return
    const fileName = fsi(file.name)
    const seq = ++pickSeq.current
    send.reset()
    try {
      const sheet = await xlsxRows(new Uint8Array(await file.arrayBuffer()))
      if (seq !== pickSeq.current) return
      const parsed = parseMaterialImport(sheet)
      const read = parsed.entries + parsed.problems.length
      if (read === 0) return setFileNote({ tone: 'error', text: t('import.file.empty', { fileName }) })
      // Blank rows stay as blank lines, so a problem's line is still its sheet row.
      setText(sheet.map((row) => row.slice(0, 3).join('\t')).join('\n'))
      setFileNote({ tone: 'info', text: t('import.file.read', { count: read, n: fsi(figure(read)), fileName }) })
    } catch {
      if (seq !== pickSeq.current) return
      setFileNote({ tone: 'error', text: t('import.file.unreadable', { fileName }) })
    }
  }

  const count = (key: string, n: number, hook: string) => (
    <span {...{ [hook]: n }}>
      <Trans t={t} i18nKey={key} count={n} values={{ n: figure(n) }} components={{ n: <Ltr /> }} />
    </span>
  )

  return (
    <ReasonDialog
      open
      title={t('import.title')}
      note={t('import.note')}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('import.confirm')}
      confirmDisabled={list.rows.length === 0 || list.overBy > 0 || list.problems.length > 0}
      handledCodes={[HUNGERSTATION_ERRORS.importInvalid]}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1.5" data-import-dialog="">
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t('import.list')}
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setFileNote(null)
              pickSeq.current++
              send.reset()
            }}
            rows={7}
            disabled={send.isPending}
            dir="ltr"
            autoFocus
            placeholder={t('import.placeholder')}
            className="rounded-md border border-border/60 bg-background px-2 py-1.5 font-mono text-sm font-normal text-foreground outline-none focus:border-primary/60"
            data-import-text=""
          />
        </label>
        <span className="text-xs text-muted-foreground">{t('import.format')}</span>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            data-import-file=""
            onChange={(e) => {
              void pick(e.target.files?.[0] ?? null)
              // Reset so the same file can be picked again.
              e.target.value = ''
            }}
          />
          <Button variant="outlined" disabled={send.isPending} onClick={() => fileInput.current?.click()} data-import-pick="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('import.file.pick')}
          </Button>
        </div>
        {fileNote && (
          <p
            role={fileNote.tone === 'error' ? 'alert' : 'status'}
            className={'text-xs ' + (fileNote.tone === 'error' ? 'text-danger-800' : 'text-muted-foreground')}
            data-import-file-note={fileNote.tone}
          >
            {fileNote.text}
          </p>
        )}
        <div className="flex flex-col gap-0.5 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground" data-import-preview="">
          <span className="flex flex-wrap gap-x-3">
            {count('import.preview.rows', list.rows.length, 'data-preview-rows')}
            {count('import.preview.disabled', marked.disabled, 'data-preview-disabled')}
            {count('import.preview.deleted', marked.deleted, 'data-preview-deleted')}
            {list.repeats > 0 && count('import.preview.repeats', list.repeats, 'data-preview-repeats')}
          </span>
          {list.header !== null && (
            <span data-import-header="">
              <Trans t={t} i18nKey="import.preview.header" values={{ header: list.header }} components={{ header: <bdi /> }} />
            </span>
          )}
        </div>
        {list.problems.length > 0 && (
          <div className="flex flex-col gap-1" role="alert" data-import-problems={list.problems.length}>
            <p className="flex items-center gap-1.5 text-xs text-danger-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <Trans
                t={t}
                i18nKey="import.problems.title"
                count={list.problems.length}
                values={{ n: figure(list.problems.length) }}
                components={{ n: <Ltr /> }}
              />
            </p>
            <ul className="max-h-32 overflow-auto rounded-md border border-danger-200 px-2 py-1 text-xs">
              {list.problems.slice(0, PROBLEMS_SHOWN).map((p) => (
                <li key={p.line} data-import-problem={p.kind} data-problem-line={p.line}>
                  <Trans
                    t={t}
                    i18nKey={`import.problems.${p.kind}`}
                    values={{ line: figure(p.line), value: p.value }}
                    components={{ line: <Ltr />, value: <bdi className="font-mono" /> }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
        {list.overBy > 0 && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800" data-import-over-cap="">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('import.overCap', { count: list.overBy, max: fsi(figure(MATERIAL_IMPORT_MAX)), overBy: fsi(figure(list.overBy)) })}
          </p>
        )}
        {listRefusal && <InlineRefusal message={listRefusal.message} code={listRefusal.code} />}
      </div>
    </ReasonDialog>
  )
}

/** The import's answer: added, updated, and the unknown numbers (not in the material master, not
 *  added) as a copyable list — the core answer dialog. */
export function ImportResultDialog({ result, onClose }: { result: HungerStationMaterialImportResult; onClose: () => void }) {
  const { t } = useTranslation('hungerstation-materials')
  return (
    <ImportAnswerDialog
      ns="hungerstation-materials"
      counts={[
        { label: t('result.added'), value: result.added ?? 0, attr: 'added' },
        { label: t('result.updated'), value: result.updated ?? 0, attr: 'updated' },
      ]}
      unknown={result.unknown ?? []}
      onClose={onClose}
    />
  )
}
