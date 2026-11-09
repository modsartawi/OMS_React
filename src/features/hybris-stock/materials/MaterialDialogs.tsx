import { useId, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { FileUp, Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ReasonDialog, { InlineRefusal } from '@/core/hybris-stock/ReasonDialog'
import { HYBRIS_STOCK_ERRORS as E, type HybrisStockMaterialRow, type HybrisStockMaterialsPage, type HybrisStockPreviewOutcome, type HybrisStockUploadPreview } from '@/core/models/hybris-stock'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatPair, fsi } from '@/core/util/bidi'
import { listText } from '@/core/util/list-format'
import { formatFigure as figure } from '@/core/util/number-format'
import { MATERIALS_KEY, materialsApi } from './api'
import { MATERIAL_NUMBER, withRow } from './materials-query'
import { OUTCOMES, changeKind, previewSummary, refusalKind, rowState } from './upload-preview'

/**
 * Add one material to the list, with a reason (spec 3447 story 18; ticket 848). It is added enabled,
 * so the next delta sends it to every Hybris stock store whether or not its stock changed (story 20).
 * HYS-00010 (not in the material master) and HYS-00011 (already listed) show inline at the number.
 */
export function AddDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('hybris-stock-materials')
  const qc = useQueryClient()
  const id = useId()
  const [number, setNumber] = useState('')
  const trimmed = number.trim()
  const valid = MATERIAL_NUMBER.test(trimmed)
  const send = useMutation({
    mutationFn: (reason: string) => materialsApi.add({ materialNumber: trimmed, reason }),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: MATERIALS_KEY })
      notify.success(t('add.done'), t('add.doneDetail', { material: fsi(row.materialNumber) }))
      onClose()
    },
  })
  const code = apiErrorCode(send.error)
  const atNumber = code === E.unknownMaterial || code === E.materialListed
  return (
    <ReasonDialog
      open
      title={t('add.title')}
      note={t('add.note')}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('add.confirm')}
      confirmDisabled={!valid}
      handledCodes={[E.unknownMaterial, E.materialListed]}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1.5" data-add-dialog="">
        <Field label={t('add.number')} id={id} hint={t('add.numberHint')} invalid={(trimmed !== '' && !valid) || atNumber}>
          <Input
            id={id}
            value={number}
            dir="ltr"
            onChange={(e) => {
              setNumber(e.target.value)
              send.reset()
            }}
            disabled={send.isPending}
            data-add-number=""
          />
        </Field>
        {atNumber && <InlineRefusal message={apiErrorMessage(send.error, t('add.failed'))} code={code} />}
      </div>
    </ReasonDialog>
  )
}

/**
 * Enable or disable one material, with a reason (spec 3447 stories 18–20). Disabling drops it out of
 * the files — Hybris keeps what it was last sent; enabling sends it in the next delta. The door
 * answers the row, patched into the page where it stands. HYS-00012 (no longer listed) and HYS-00013 /
 * 00014 (already so — changed from another screen) re-read the list and turn Confirm off.
 */
/** Enable / Disable refusals after which the row on screen is out of date. */
const TOGGLE_STALE: string[] = [E.materialNotListed, E.alreadyEnabled, E.alreadyDisabled]

export function EnabledDialog({ row, onClose }: { row: HybrisStockMaterialRow; onClose: () => void }) {
  const { t } = useTranslation('hybris-stock-materials')
  const qc = useQueryClient()
  const verb = row.enabled ? 'disable' : 'enable'
  const send = useMutation({
    mutationFn: (reason: string) => materialsApi.setEnabled(row.materialNumber, !row.enabled, { reason }),
    onSuccess: (next) => {
      qc.setQueriesData<HybrisStockMaterialsPage>({ queryKey: MATERIALS_KEY }, (page) => withRow(page, next))
      // A page under the enabled filter may no longer hold the row: read those again.
      void qc.invalidateQueries({ queryKey: MATERIALS_KEY, predicate: (q) => String(q.queryKey[2] ?? '').includes('enabled=') })
      notify.success(t(`${verb}.done`), t(`${verb}.doneDetail`, { material: fsi(row.materialNumber) }))
      onClose()
    },
    onError: (err) => {
      if (TOGGLE_STALE.includes(apiErrorCode(err) ?? '')) void qc.invalidateQueries({ queryKey: MATERIALS_KEY })
    },
  })
  const name = row.nameEn || row.nameAr
  return (
    <ReasonDialog
      open
      title={t(`${verb}.title`)}
      note={
        <Trans
          t={t}
          i18nKey={`${verb}.note`}
          values={{ material: name ? formatPair(row.materialNumber, name) : row.materialNumber }}
          components={{ material: <Ltr /> }}
        />
      }
      busy={send.isPending}
      error={send.error}
      confirmLabel={t(`${verb}.confirm`)}
      confirmDisabled={TOGGLE_STALE.includes(apiErrorCode(send.error) ?? '')}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div data-enabled-dialog={verb} />
    </ReasonDialog>
  )
}

const OUTCOME_SEV = { new: 'go', changed: 'warn', unchanged: 'mute', refused: 'bad' } as const

/** The picked file could not be read (moved, deleted, or edited on disk after it was picked). */
class FileUnreadable extends Error {}

/**
 * The picked file's bytes, read once into memory. A browser `File` is a handle onto the disk: edited
 * there after the pick, a later read of it fails (NotReadableError). The copy is what the preview
 * read, so the commit and Preview again re-send exactly those bytes.
 */
async function snapshot(file: File): Promise<File> {
  try {
    return new File([await file.arrayBuffer()], file.name, { type: file.type, lastModified: file.lastModified })
  } catch {
    throw new FileUnreadable(file.name)
  }
}

/**
 * **Upload a material list** (spec 3447 stories 13–17, 21; ticket 848): pick a CSV or XLSX (a
 * material number column, an optional enabled column) → the server's PREVIEW, grouped new / changed /
 * unchanged / refused, each refused row with its reason → commit under a reason, which applies exactly
 * that preview: the commit sends the SAME file with the preview's `contentHash`, and the server refuses
 * HYS-00015 when the file or the list changed since — the dialog then offers to preview the file again.
 * The dialog says up front that an upload never deletes. Picking another file starts a new preview.
 * Confirm stays off until a preview holds something to apply.
 */
export function UploadDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation('hybris-stock-materials')
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [shown, setShown] = useState<HybrisStockPreviewOutcome>('new')
  // The previewed file and its answer travel together: the commit re-sends exactly this file.
  const preview = useMutation({
    mutationFn: async (picked: File): Promise<{ file: File; preview: HybrisStockUploadPreview }> => {
      const file = await snapshot(picked)
      return { file, preview: await materialsApi.preview(file) }
    },
    onSuccess: ({ preview: p }) => {
      const s = previewSummary(p)
      // Open on the first group that holds rows, so the user sees what the file does.
      setShown(OUTCOMES.find((o) => s.counts[o] > 0) ?? 'new')
    },
  })
  const commit = useMutation({
    mutationFn: (reason: string) => materialsApi.commit(preview.data!.file, preview.data!.preview.contentHash, reason),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: MATERIALS_KEY })
      notify.success(t('upload.done'), t('upload.doneDetail', { added: fsi(figure(r.counts?.new ?? 0)), changed: fsi(figure(r.counts?.changed ?? 0)) }))
      onClose()
    },
  })
  const summary = preview.data ? previewSummary(preview.data.preview) : null
  const gone = apiErrorCode(commit.error) === E.previewStale

  return (
    <ReasonDialog
      open
      title={t('upload.title')}
      note={t('upload.note')}
      busy={preview.isPending || commit.isPending}
      error={commit.error}
      confirmLabel={summary ? t('upload.confirm', { n: fsi(figure(summary.counts.new + summary.counts.changed)) }) : t('upload.confirmIdle')}
      confirmDisabled={!summary?.canCommit || gone}
      onEdit={() => commit.reset()}
      onConfirm={(reason) => commit.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3" data-upload-dialog="">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={preview.isPending || commit.isPending} data-upload-pick="">
            {preview.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FileUp className="h-3.5 w-3.5" aria-hidden />}
            {preview.isPending ? t('upload.reading') : t(preview.data ? 'upload.pickAnother' : 'upload.pick')}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            tabIndex={-1}
            aria-label={t('upload.file')}
            data-upload-file=""
            onChange={(e) => {
              const picked = e.target.files?.[0]
              // Cleared at once, so picking the same file again (after fixing it) reads it again.
              e.target.value = ''
              if (!picked) return
              commit.reset()
              preview.mutate(picked)
            }}
          />
          {preview.data && (
            <span className="font-mono text-xs text-muted-foreground" data-upload-file-name="">
              <bdi>{preview.data.file.name}</bdi>
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t('upload.shape')}</p>

        {preview.isError &&
          (preview.error instanceof FileUnreadable ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-danger-800" data-upload-unreadable="">
              <span>{t('upload.unreadable')}</span>
              <Button variant="secondary" onClick={() => fileInput.current?.click()} data-upload-repick="">
                {t('upload.pickAgain')}
              </Button>
            </div>
          ) : (
            <InlineRefusal message={apiErrorMessage(preview.error, t('upload.readFailed'))} code={apiErrorCode(preview.error)} />
          ))}

        {summary && (
          <div className="flex flex-col gap-2" data-upload-preview="">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('upload.groups')}>
              {OUTCOMES.map((o) => (
                <Chip key={o} variant="tab" on={shown === o} onClick={() => setShown(o)} data-upload-group={o} data-count={summary.counts[o]}>
                  <Trans t={t} i18nKey={`upload.outcome.${o}`} values={{ n: figure(summary.counts[o]) }} components={{ n: <Ltr /> }} />
                </Chip>
              ))}
            </div>
            {summary.refusals.length > 0 && (
              <p className="text-xs text-danger-800" data-upload-refusals="">
                {listText(
                  summary.refusals.map((r) => t(`upload.refusalTally.${r.kind}`, { n: fsi(figure(r.count)) })),
                  i18n.language,
                )}
              </p>
            )}
            {summary.countsMismatch && (
              <p className="text-xs text-attention-800" data-upload-mismatch="">
                {t('upload.mismatch')}
              </p>
            )}
            {!summary.canCommit && (
              <p className="text-xs text-muted-foreground" data-upload-nothing="">
                {t('upload.nothing')}
              </p>
            )}
            <div className="max-h-64 overflow-auto rounded-md border border-border">
              {summary.groups[shown].length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">{t('upload.groupEmpty')}</p>
              ) : (
                <table className="w-full text-xs" data-upload-rows={shown}>
                  <thead className="sticky top-0 border-b border-border bg-card text-muted-foreground">
                    <tr>
                      <th className={TH}>{t('upload.line')}</th>
                      <th className={TH}>{t('upload.material')}</th>
                      <th className={TH}>{t(shown === 'refused' ? 'upload.why' : 'upload.enabled')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.groups[shown].map((r) => (
                      <tr key={`${r.rowNumber}-${r.materialNumber}`} className="border-b border-border/50" data-upload-row={r.rowNumber}>
                        <td className={TD}>
                          <Ltr>{r.rowNumber}</Ltr>
                        </td>
                        <td className={`${TD} font-mono`}>
                          <Ltr>{r.materialNumber}</Ltr>
                        </td>
                        <td className={TD} data-upload-detail="">
                          {r.outcome === 'refused' ? (
                            <span className="text-danger-800">{t(`upload.refusal.${refusalKind(r.refusal)}`)}</span>
                          ) : (
                            <StatusBadge sev={OUTCOME_SEV[r.outcome]}>
                              {changeKind(r) ? t(`upload.change.${changeKind(r)}`) : t(rowState(r) ? 'upload.isEnabled' : 'upload.isDisabled')}
                            </StatusBadge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        {gone && (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-danger-800" data-upload-gone="">
            <span>{t('upload.gone')}</span>
            {preview.data && (
              <Button
                variant="secondary"
                onClick={() => {
                  const file = preview.data!.file
                  commit.reset()
                  preview.mutate(file)
                }}
                disabled={preview.isPending}
                data-upload-again=""
              >
                {t('upload.previewAgain')}
              </Button>
            )}
          </div>
        )}
      </div>
    </ReasonDialog>
  )
}
