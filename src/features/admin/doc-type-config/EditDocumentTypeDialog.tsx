import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Lock } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { REASON_MAX } from '@/core/reason/reason'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatCount, fsi } from '@/core/util/bidi'
import { DOCUMENT_TYPES_KEY, DOC_TYPE_CONFIG_ERRORS, docTypeConfigApi } from './api'
import { editState, saveRequest, setField } from './edit-form'
import FieldValueText from './FieldValueText'
import { ALL_FIELDS, FIELD_GROUPS, isLocked, type FieldDef } from './fields'
import type { DocumentTypeSettings } from './types'

/**
 * Edit a document type (BackOffice spec 3148 stories 9-10, 15, 17-19; ticket 3149). Every setting grouped as the
 * detail shows it; code, category and engine read-only. Below the form, the before/after of only the fields that
 * changed, then the required reason. Save is disabled until something changed AND the reason holds 1-200 characters
 * (`editState`). The save sends the before-state the page loaded: a type someone else saved since is refused
 * (`SDC-00004`), the detail is re-read, and the dialog says so. Rendered only for a session holding the grant.
 */
export default function EditDocumentTypeDialog({
  open,
  loaded,
  onClose,
}: {
  open: boolean
  loaded: DocumentTypeSettings
  onClose: () => void
}) {
  const { t } = useTranslation('doc-type-config')
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(loaded)
  const [reasonText, setReasonText] = useState('')
  // A fresh opening starts from the loaded settings and an empty reason (adjusted while rendering, before paint).
  const [shownOpen, setShownOpen] = useState(open)
  if (shownOpen !== open) {
    setShownOpen(open)
    setDraft(loaded)
    setReasonText('')
  }

  const save = useMutation({
    mutationFn: () => docTypeConfigApi.updateDocumentType(loaded.documentType, saveRequest(loaded, draft, reasonText)),
    onSuccess: (saved) => {
      queryClient.setQueryData([...DOCUMENT_TYPES_KEY, loaded.documentType], saved)
      void queryClient.invalidateQueries({ queryKey: DOCUMENT_TYPES_KEY, exact: true })
      notify.success(t('edit.saved', { code: fsi(saved.documentType) }))
      onClose()
    },
    onError: (err) => {
      if (apiErrorCode(err) === DOC_TYPE_CONFIG_ERRORS.staleBeforeState)
        void queryClient.invalidateQueries({ queryKey: [...DOCUMENT_TYPES_KEY, loaded.documentType] })
    },
  })

  const state = editState(loaded, draft, reasonText)
  const busy = save.isPending
  const errorCode = save.error ? apiErrorCode(save.error) : null
  const stale = errorCode === DOC_TYPE_CONFIG_ERRORS.staleBeforeState

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t('edit.title', { code: fsi(loaded.documentType) })}
      width="56rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-edit-cancel="">
            {t('dialog.cancel')}
          </Button>
          <Button disabled={!state.canSave || busy || stale} onClick={() => state.canSave && !busy && save.mutate()} data-edit-save="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('dialog.sending') : t('edit.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-edit-dialog="">
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t('edit.note')} {t('edit.lockedHint')}
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          {FIELD_GROUPS.map(({ group, fields }) => (
            <fieldset key={group} className="rounded-lg border border-border/60 p-3" data-edit-group={group}>
              <legend className="px-1 text-sm font-semibold">{t(`groups.${group}`)}</legend>
              <div className="flex flex-col gap-2">
                {fields.map((def) => (
                  <FieldInput
                    key={def.field}
                    def={def}
                    value={draft[def.field]}
                    disabled={busy}
                    onChange={(v) => {
                      setDraft((d) => setField(d, def.field, v))
                      save.reset()
                    }}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <section data-edit-diff="">
          <h3 className="mb-1 text-sm font-semibold">{t('edit.changesTitle')}</h3>
          {state.changes.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-edit-no-changes="">
              {t('edit.noChanges')}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs text-muted-foreground">
                  <th className="py-1 text-start font-medium" />
                  <th className="py-1 text-start font-medium">{t('edit.before')}</th>
                  <th className="py-1 text-start font-medium">{t('edit.after')}</th>
                </tr>
              </thead>
              <tbody>
                {state.changes.map((c) => {
                  const def = ALL_FIELDS.find((f) => f.field === c.field)!
                  return (
                    <tr key={c.field} className="border-t border-border/60" data-edit-change={c.field}>
                      <td className="py-1 pe-3">{t(`fields.${c.field}`)}</td>
                      <td className="py-1 pe-3" data-edit-before="">
                        <FieldValueText def={def} value={c.before} />
                      </td>
                      <td className="py-1" data-edit-after="">
                        <FieldValueText def={def} value={c.after} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        <label className="flex flex-col gap-1 text-xs font-medium">
          <span className="flex items-baseline justify-between gap-2">
            {t('reason.label')}
            <span
              className={'font-normal tabular-nums ' + (state.reason.problem === 'tooLong' ? 'text-danger-800' : 'text-muted-foreground')}
              data-edit-reason-count=""
            >
              <Ltr>{formatCount(state.reason.length, REASON_MAX)}</Ltr>
            </span>
          </span>
          <textarea
            value={reasonText}
            onChange={(e) => {
              setReasonText(e.target.value)
              save.reset()
            }}
            rows={3}
            required
            disabled={busy}
            dir="auto"
            aria-invalid={state.reason.problem === 'tooLong' || errorCode === DOC_TYPE_CONFIG_ERRORS.reasonRequired || undefined}
            className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary/60"
            data-edit-reason=""
          />
          <span className="font-normal text-muted-foreground">{t('reason.hint')}</span>
        </label>
        {state.reason.problem === 'tooLong' && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('reason.tooLong', { max: fsi(String(REASON_MAX)) })}
          </p>
        )}

        {save.isError &&
          (isBareDenial(save.error) ? (
            <ErrorBanner className="p-2" message={t('edit.notGranted')} />
          ) : (
            <ErrorBanner
              className="p-2"
              title={t('dialog.failed')}
              message={stale ? t('edit.stale') : apiErrorMessage(save.error, t('dialog.failedHint'))}
            >
              {errorCode && (
                <span className="font-mono text-xs" data-edit-error={errorCode}>
                  <Ltr>{errorCode}</Ltr>
                </span>
              )}
            </ErrorBanner>
          ))}
      </div>
    </Modal>
  )
}

/** One setting's input: a checkbox for a flag, a number for an amount, a text box clamped to the column's width;
 *  a locked field is shown, never editable. */
function FieldInput({
  def,
  value,
  disabled,
  onChange,
}: {
  def: FieldDef
  value: string | number | boolean
  disabled: boolean
  onChange: (value: string | number | boolean) => void
}) {
  const { t } = useTranslation('doc-type-config')
  const label = t(`fields.${def.field}`)
  if (isLocked(def.field)) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm" data-edit-field={def.field} data-edit-locked="">
        <span className="flex items-center gap-1 text-muted-foreground">
          {label}
          <Lock className="h-3 w-3" aria-label={t('detail.locked')} />
        </span>
        <FieldValueText def={def} value={value} />
      </div>
    )
  }
  if (def.kind === 'flag') {
    return (
      <label className="flex items-center justify-between gap-2 text-sm" data-edit-field={def.field}>
        <span>{label}</span>
        <input type="checkbox" checked={value === true} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      </label>
    )
  }
  return (
    <label className="flex items-center justify-between gap-2 text-sm" data-edit-field={def.field}>
      <span>{label}</span>
      <input
        type={def.kind === 'amount' ? 'number' : 'text'}
        step={def.kind === 'amount' ? '0.01' : undefined}
        min={def.kind === 'amount' ? 0 : undefined}
        value={def.kind === 'amount' ? String(value) : String(value ?? '')}
        maxLength={def.maxLength}
        disabled={disabled}
        dir={def.freeText ? 'auto' : 'ltr'}
        onChange={(e) => onChange(def.kind === 'amount' ? Number(e.target.value) : e.target.value)}
        className="w-48 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
      />
    </label>
  )
}
