import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { AlertTriangle, Loader2, Lock } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { DOC_TYPE_CONFIG_ERRORS, documentTypesQuery } from './api'
import { CHANGE_LOG_KEY } from './change-log-api'
import CodeChoiceSelect from './CodeChoiceSelect'
import {
  DELIVERY_ALL_FIELDS,
  DELIVERY_CATEGORIES,
  DELIVERY_CODE_MAX,
  DELIVERY_FIELD_GROUPS,
  codeChoices,
  deliveryCopyDraft,
  deliveryCopyRequest,
  deliveryCopyState,
  deliveryEditState,
  deliveryFieldRefusals,
  deliverySaveRequest,
  isDeliveryLocked,
  setDeliveryField,
  type DeliveryFieldDef,
  type DeliveryFieldValue,
} from './delivery-type-form'
import type { DeliveryTypeSettings } from './delivery-type-types'
import { DELIVERY_TYPES_KEY, deliveryTypesApi, deliveryTypesQuery } from './delivery-types-api'
import DeliveryTypeValueText from './DeliveryTypeValueText'
import ReasonField from './ReasonField'
import RereadNotice from './RereadNotice'
import { useReReadDraft } from './use-reread-draft'
import type { FieldRefusal } from './settings-refusal'

/**
 * Edit or copy a delivery document type (BackOffice spec 3148 stories 34-35, 37; ticket 3154). Edit: every setting but
 * code and category (read-only, refused by the server too), the before/after of the changed fields, a required reason;
 * the save sends the before-state the page loaded (`SDC-00004` when someone saved since). Copy: the source's every
 * setting with a blank code and description, everything editable until the first save; the server copies every
 * physical column and the courier assignments, one Copy log row each. A refused setting is shown on its field
 * (`SDC-00010`). Rendered only for a session holding the grant.
 */
export default function DeliveryTypeDialog({
  mode,
  open,
  loaded,
  onClose,
}: {
  mode: 'edit' | 'copy'
  open: boolean
  loaded: DeliveryTypeSettings
  onClose: () => void
}) {
  const { t } = useTranslation('doc-type-config')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const copying = mode === 'copy'
  // A fresh opening starts from the loaded settings and an empty reason (adjusted while rendering, before paint). On an
  // edit, a re-read that moved the type (a stale refusal's refetch) rebuilds the draft: never fresh before + stale after.
  const { base, draft, reread, setDraft } = useReReadDraft(open, loaded, {
    start: copying ? deliveryCopyDraft : undefined,
    track: !copying,
  })
  const [reasonText, setReasonText] = useState('')
  const [shownOpen, setShownOpen] = useState(open)
  if (shownOpen !== open) {
    setShownOpen(open)
    setReasonText('')
  }

  const deliveryTypes = useQuery({ ...deliveryTypesQuery(), enabled: open && copying })
  const documentTypes = useQuery({ ...documentTypesQuery(), enabled: open })

  const save = useMutation({
    mutationFn: () =>
      copying
        ? deliveryTypesApi.copy(loaded.documentType, deliveryCopyRequest(draft, reasonText))
        : deliveryTypesApi.update(base.documentType, deliverySaveRequest(base, draft, reasonText)),
    onSuccess: (saved) => {
      queryClient.setQueryData([...DELIVERY_TYPES_KEY, saved.documentType], saved)
      void queryClient.invalidateQueries({ queryKey: DELIVERY_TYPES_KEY, exact: true })
      void queryClient.invalidateQueries({ queryKey: CHANGE_LOG_KEY })
      notify.success(t(copying ? 'deliveryTypes.copy.saved' : 'deliveryTypes.edit.saved', { code: fsi(saved.documentType) }))
      onClose()
      if (copying) navigate(`/admin/delivery-types/${encodeURIComponent(saved.documentType)}`)
    },
    onError: (err) => {
      if (!copying && apiErrorCode(err) === DOC_TYPE_CONFIG_ERRORS.staleBeforeState)
        void queryClient.invalidateQueries({ queryKey: [...DELIVERY_TYPES_KEY, loaded.documentType] })
    },
  })

  const edit = deliveryEditState(base, draft, reasonText)
  const copy = deliveryCopyState(
    draft,
    reasonText,
    (deliveryTypes.data ?? []).map((r) => r.documentType),
  )
  const canSave = copying ? copy.canSave : edit.canSave
  const reason = copying ? copy.reason : edit.reason
  const refusals = save.error ? deliveryFieldRefusals(save.error) : {}
  const refusedOnFields = Object.keys(refusals).length > 0
  const busy = save.isPending
  const errorCode = save.error ? apiErrorCode(save.error) : null
  const stale = !copying && errorCode === DOC_TYPE_CONFIG_ERRORS.staleBeforeState && !reread
  const docTypeChoices = codeChoices(
    documentTypes.data?.map((r) => ({ code: r.documentType, description: r.description })),
    draft.defaultDocumentType,
  )

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t(copying ? 'deliveryTypes.copy.title' : 'deliveryTypes.edit.title', { code: fsi(loaded.documentType) })}
      width="48rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-delivery-cancel="">
            {t('dialog.cancel')}
          </Button>
          <Button disabled={!canSave || busy || stale} onClick={() => canSave && !busy && save.mutate()} data-delivery-save="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('dialog.sending') : t(copying ? 'copy.confirm' : 'edit.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-delivery-dialog={mode}>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t(copying ? 'deliveryTypes.copy.note' : 'deliveryTypes.edit.note')}
        </p>

        <div className="grid gap-3 md:grid-cols-2">
          {DELIVERY_FIELD_GROUPS.map(({ group, fields }) => (
            <fieldset key={group} className="rounded-lg border border-border/60 p-3" data-edit-group={group}>
              <legend className="px-1 text-sm font-semibold">{t(`deliveryTypes.groups.${group}`)}</legend>
              <div className="flex flex-col gap-2">
                {fields.map((def) => (
                  <DeliveryFieldInput
                    key={def.field}
                    def={def}
                    value={draft[def.field]}
                    disabled={busy}
                    locked={!copying && isDeliveryLocked(def.field)}
                    refusal={refusals[def.field]}
                    docTypeChoices={docTypeChoices}
                    onChange={(v) => {
                      setDraft((d) => setDeliveryField(d, def.field, v, { copy: copying }))
                      save.reset()
                    }}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        {!copying && (
          <section data-edit-diff="">
            <h3 className="mb-1 text-sm font-semibold">{t('edit.changesTitle')}</h3>
            {edit.changes.length === 0 ? (
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
                  {edit.changes.map((c) => {
                    const def = DELIVERY_ALL_FIELDS.find((f) => f.field === c.field)!
                    return (
                      <tr key={c.field} className="border-t border-border/60" data-edit-change={c.field}>
                        <td className="py-1 pe-3">
                          {t(`fields.${c.field}`)}
                          {def.notRead && <NotRead />}
                        </td>
                        <td className="py-1 pe-3" data-edit-before="">
                          <DeliveryTypeValueText def={def} value={c.before} />
                        </td>
                        <td className="py-1 pe-3" data-edit-after="">
                          <DeliveryTypeValueText def={def} value={c.after} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {copying && copy.blocker && copy.blocker !== 'reason' && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-copy-blocker={copy.blocker}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t(`deliveryTypes.copy.blockers.${copy.blocker}`, { code: fsi(copy.code), max: fsi(String(DELIVERY_CODE_MAX)) })}
          </p>
        )}

        {reread && !save.isSuccess && <RereadNotice />}

        <ReasonField
          value={reasonText}
          reason={reason}
          disabled={busy}
          errorCode={errorCode}
          attr="delivery-reason"
          onChange={(text) => {
            setReasonText(text)
            save.reset()
          }}
        />

        {save.isError &&
          !(reread && errorCode === DOC_TYPE_CONFIG_ERRORS.staleBeforeState) &&
          (isBareDenial(save.error) ? (
            <ErrorBanner className="p-2" message={t('edit.notGranted')} />
          ) : (
            <ErrorBanner
              className="p-2"
              title={t(copying ? 'deliveryTypes.copy.failed' : 'dialog.failed')}
              message={
                stale
                  ? t('deliveryTypes.edit.stale')
                  : refusedOnFields
                    ? t('edit.refusedOnFields')
                    : apiErrorMessage(save.error, t('dialog.failedHint'))
              }
            >
              {errorCode && (
                <span className="font-mono text-xs" data-delivery-error={errorCode}>
                  <Ltr>{errorCode}</Ltr>
                </span>
              )}
            </ErrorBanner>
          ))}
      </div>
    </Modal>
  )
}

/** One delivery setting's input: a checkbox, a number, the category / default document type dropdown, or a text box
 *  clamped to the column's width; a locked field is shown, never editable. */
function DeliveryFieldInput({
  def,
  value,
  disabled,
  locked,
  refusal,
  docTypeChoices,
  onChange,
}: {
  def: DeliveryFieldDef
  value: DeliveryFieldValue
  disabled: boolean
  locked: boolean
  refusal: FieldRefusal | undefined
  docTypeChoices: ReturnType<typeof codeChoices>
  onChange: (value: DeliveryFieldValue) => void
}) {
  const { t } = useTranslation('doc-type-config')
  const label = t(`fields.${def.field}`)
  if (locked) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm" data-edit-field={def.field} data-edit-locked="">
        <span className="flex items-center gap-1 text-muted-foreground">
          {label}
          <Lock className="h-3 w-3" aria-label={t('detail.locked')} />
        </span>
        <DeliveryTypeValueText def={def} value={value} />
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
  const refused = refusal && (
    <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800" data-edit-refusal={refusal.code}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <bdi>{refusal.message}</bdi>
    </p>
  )
  const text = String(value ?? '')
  let input
  if (def.choice === 'category') {
    const options: string[] = (DELIVERY_CATEGORIES as readonly string[]).includes(text.trim())
      ? [...DELIVERY_CATEGORIES]
      : [...DELIVERY_CATEGORIES, text.trim()]
    input = (
      <Select
        value={text.trim()}
        disabled={disabled}
        aria-invalid={refusal ? true : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-48"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {t(`deliveryTypes.categories.${o}`, { defaultValue: o })}
          </option>
        ))}
      </Select>
    )
  } else if (def.choice === 'documentType' && docTypeChoices) {
    input = <CodeChoiceSelect choices={docTypeChoices} value={text} disabled={disabled} invalid={!!refusal} onChange={onChange} />
  } else {
    const numeric = def.kind === 'number'
    input = (
      <Input
        type={numeric ? 'number' : 'text'}
        step={numeric ? (def.integer ? '1' : '0.01') : undefined}
        min={numeric ? 0 : undefined}
        value={text}
        maxLength={def.maxLength}
        disabled={disabled}
        dir={def.freeText ? 'auto' : 'ltr'}
        aria-invalid={refusal ? true : undefined}
        onChange={(e) => onChange(numeric ? Number(e.target.value) : e.target.value)}
        className="w-48"
      />
    )
  }
  return (
    <div className="flex flex-col gap-1" data-edit-field={def.field}>
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        {input}
      </label>
      {def.notRead && <NotRead />}
      {refused}
    </div>
  )
}

/** The billing settings' label (ticket 3150), for a delivery setting nothing in order processing reads. */
function NotRead() {
  const { t } = useTranslation('doc-type-config')
  return (
    <span className="block text-xs text-warning-800" data-edit-not-read="">
      {t('edit.notRead')}
    </span>
  )
}
