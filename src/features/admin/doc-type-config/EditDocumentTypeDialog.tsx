import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { DOCUMENT_TYPES_KEY, DOC_TYPE_CONFIG_ERRORS, docTypeConfigApi, documentTypeFieldsQuery } from './api'
import CodeChoiceSelect from './CodeChoiceSelect'
import { codeChoices, type CodeChoice } from './delivery-type-form'
import { deliveryTypesQuery } from './delivery-types-api'
import { editState, saveRequest, setField } from './edit-form'
import { changeLabels, fieldMetaIndex, optionsFor, type FieldMetaIndex } from './field-meta'
import FieldValueText from './FieldValueText'
import { optionLabelKey } from './option-label'
import { settingsRefusals, type FieldRefusal } from './settings-refusal'
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

  // 3150: the dropdowns and the diff's open/new-orders labels come from the server's field metadata. While it loads
  // (or if it failed) the coded fields are text boxes and the diff carries no label; the server refuses regardless.
  const fieldMetas = useQuery(documentTypeFieldsQuery())
  const metaIndex = fieldMetaIndex(fieldMetas.data)
  const deliveryTypeChoices = useDefaultDeliveryTypeChoices(open, draft.defaultDeliveryType)

  const state = editState(loaded, draft, reasonText)
  const labels = changeLabels(state.changes, metaIndex)
  const refusals = save.error ? settingsRefusals(save.error) : {}
  const refusedOnFields = Object.keys(refusals).length > 0
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
                    metaIndex={metaIndex}
                    refusal={refusals[def.field]}
                    choices={def.field === 'defaultDeliveryType' ? deliveryTypeChoices : null}
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
                  <th className="py-1 text-start font-medium">{t('edit.effect')}</th>
                </tr>
              </thead>
              <tbody>
                {state.changes.map((c, i) => {
                  const def = ALL_FIELDS.find((f) => f.field === c.field)!
                  const label = labels[i]
                  return (
                    <tr key={c.field} className="border-t border-border/60" data-edit-change={c.field}>
                      <td className="py-1 pe-3">{t(`fields.${c.field}`)}</td>
                      <td className="py-1 pe-3" data-edit-before="">
                        <FieldValueText def={def} value={c.before} />
                      </td>
                      <td className="py-1 pe-3" data-edit-after="">
                        <FieldValueText def={def} value={c.after} />
                      </td>
                      <td className="py-1 text-xs" data-edit-effect={label.effectKey ?? ''}>
                        {label.effectKey && <span className="text-muted-foreground">{t(label.effectKey)}</span>}
                        {label.notRead && (
                          <span className="block text-warning-800" data-edit-not-read="">
                            {t('edit.notRead')}
                          </span>
                        )}
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
              message={
                stale
                  ? t('edit.stale')
                  : refusedOnFields
                    ? t('edit.refusedOnFields')
                    : apiErrorMessage(save.error, t('dialog.failedHint'))
              }
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

/** Ticket 3154 (story 36): the default delivery type is chosen from the delivery types, never typed. Null while the
 *  list loads or if it failed — the field is then a text box, and the server checks the code regardless (SDC-00013). */
export function useDefaultDeliveryTypeChoices(open: boolean, current: string): CodeChoice[] | null {
  const deliveryTypes = useQuery({ ...deliveryTypesQuery(), enabled: open })
  return codeChoices(
    deliveryTypes.data?.map((r) => ({ code: r.documentType, description: r.description })),
    current,
  )
}

/** One setting's input: a checkbox for a flag, a number for an amount, a dropdown for a coded setting or a code picked
 *  from a list (`choices`, 3154), a text box clamped to the column's width; a locked field is shown, never editable.
 *  `locked` defaults to the saved type's lock (`isLocked`); the copy dialog (3153) passes `false` — nothing is locked
 *  before the first save. */
export function FieldInput({
  def,
  value,
  disabled,
  metaIndex,
  refusal,
  onChange,
  locked = isLocked(def.field),
  choices = null,
}: {
  def: FieldDef
  value: string | number | boolean
  disabled: boolean
  metaIndex: FieldMetaIndex
  refusal: FieldRefusal | undefined
  onChange: (value: string | number | boolean) => void
  locked?: boolean
  choices?: readonly CodeChoice[] | null
}) {
  const { t } = useTranslation('doc-type-config')
  const label = t(`fields.${def.field}`)
  const options = optionsFor(metaIndex, def.field, value)
  if (locked) {
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
  // 3150: the server's refusal of THIS field, under it.
  const refused = refusal && (
    <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800" data-edit-refusal={refusal.code}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <bdi>{refusal.message}</bdi>
    </p>
  )
  if (choices) {
    return (
      <div className="flex flex-col gap-1" data-edit-field={def.field} data-edit-choice="">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>{label}</span>
          <CodeChoiceSelect choices={choices} value={String(value ?? '')} disabled={disabled} invalid={!!refusal} onChange={onChange} />
        </label>
        {refused}
      </div>
    )
  }
  if (options) {
    return (
      <div className="flex flex-col gap-1" data-edit-field={def.field} data-edit-coded="">
        <label className="flex items-center justify-between gap-2 text-sm">
          <span>{label}</span>
          <select
            value={String(value ?? '').trim()}
            disabled={disabled}
            aria-invalid={refusal ? true : undefined}
            onChange={(e) => onChange(e.target.value)}
            className="w-48 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
          >
            {options.map((o) => {
              const key = optionLabelKey(def.field, o)
              const bare = o === '' ? t('value.blank') : o
              return (
                <option key={o} value={o}>
                  {key ? t(key, { defaultValue: bare }) : bare}
                </option>
              )
            })}
          </select>
        </label>
        {refused}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1" data-edit-field={def.field}>
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        <input
          type={def.kind === 'amount' ? 'number' : 'text'}
          step={def.kind === 'amount' ? '0.01' : undefined}
          min={def.kind === 'amount' ? 0 : undefined}
          value={def.kind === 'amount' ? String(value) : String(value ?? '')}
          maxLength={def.maxLength}
          disabled={disabled}
          dir={def.freeText ? 'auto' : 'ltr'}
          aria-invalid={refusal ? true : undefined}
          onChange={(e) => onChange(def.kind === 'amount' ? Number(e.target.value) : e.target.value)}
          className="w-48 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
        />
      </label>
      {refused}
    </div>
  )
}
