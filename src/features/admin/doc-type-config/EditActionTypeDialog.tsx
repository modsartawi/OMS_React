import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Lock } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { DOC_TYPE_CONFIG_ERRORS } from './api'
import { ACTION_DESCRIPTION_MAX, actionTypeEditState, actionTypeSaveRequest, setActionTypeField } from './action-type-edit'
import { ACTION_TYPE_OPTIONS, type ActionTypeSettings, type AffectedDocumentType } from './action-type-types'
import { ACTION_TYPES_KEY, ACTION_TYPE_ERRORS, actionTypesApi } from './action-types-api'
import AffectedTypesList from './AffectedTypesList'
import { CHANGE_LOG_KEY } from './change-log-api'
import ReasonField from './ReasonField'
import RereadNotice from './RereadNotice'
import { useReReadDraft } from './use-reread-draft'

/**
 * Edit an action type (BackOffice spec 3148 stories 39-40, 43; ticket 3155): its description and five options; code and
 * category shown locked. Below the form, the before/after of what changed, then EVERY document type and delivery type
 * the save reaches (the page's own list, repeated), then the required reason. A save over someone else's change is
 * refused (`SDC-00004`) and the category re-read. Rendered only for a session holding the grant.
 */
export default function EditActionTypeDialog({
  open,
  loaded,
  affectedTypes,
  onClose,
}: {
  open: boolean
  loaded: ActionTypeSettings
  affectedTypes: AffectedDocumentType[]
  onClose: () => void
}) {
  const { t } = useTranslation('doc-type-config')
  const queryClient = useQueryClient()
  // `loaded` is the live row: a re-read that moved it rebuilds the draft (never fresh before + stale after).
  const { base, draft, reread, setDraft } = useReReadDraft(open, loaded)
  const [reasonText, setReasonText] = useState('')
  const [shownOpen, setShownOpen] = useState(open)
  if (shownOpen !== open) {
    setShownOpen(open)
    setReasonText('')
  }

  const save = useMutation({
    mutationFn: () => actionTypesApi.update(base.actionType, actionTypeSaveRequest(base, draft, reasonText)),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ACTION_TYPES_KEY })
      void queryClient.invalidateQueries({ queryKey: CHANGE_LOG_KEY })
      notify.success(t('actionTypes.edit.saved', { code: fsi(saved.actionType) }))
      onClose()
    },
    onError: (err) => {
      if (apiErrorCode(err) === DOC_TYPE_CONFIG_ERRORS.staleBeforeState) void queryClient.invalidateQueries({ queryKey: ACTION_TYPES_KEY })
    },
  })

  const state = actionTypeEditState(base, draft, reasonText, affectedTypes)
  const busy = save.isPending
  const errorCode = save.error ? apiErrorCode(save.error) : null
  const stale = errorCode === DOC_TYPE_CONFIG_ERRORS.staleBeforeState && !reread
  const change = <F extends Parameters<typeof setActionTypeField>[1]>(field: F, value: ActionTypeSettings[F]) => {
    setDraft((d) => setActionTypeField(d, field, value))
    save.reset()
  }
  const yesNo = (v: string | boolean) => (typeof v === 'boolean' ? t(v ? 'value.yes' : 'value.no') : <bdi>{v}</bdi>)

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t('actionTypes.edit.title', { code: fsi(loaded.actionType) })}
      width="48rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-action-edit-cancel="">
            {t('dialog.cancel')}
          </Button>
          <Button disabled={!state.canSave || busy || stale} onClick={() => state.canSave && !busy && save.mutate()} data-action-edit-save="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('dialog.sending') : t('edit.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-action-edit-dialog="">
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t('actionTypes.edit.note')}</p>

        <div className="grid gap-2 text-sm md:grid-cols-2">
          {(['actionType', 'documentCategory'] as const).map((field) => (
            <div key={field} className="flex items-center justify-between gap-2" data-action-edit-locked={field}>
              <span className="flex items-center gap-1 text-muted-foreground">
                {t(`fields.${field}`)}
                <Lock className="h-3 w-3" aria-label={t('detail.locked')} />
              </span>
              <span className="font-mono">
                <Ltr>{loaded[field]}</Ltr>
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1" data-action-edit-field="description">
          <label className="flex items-center justify-between gap-2 text-sm">
            <span>{t('fields.description')}</span>
            <Input
              type="text"
              value={draft.description}
              maxLength={ACTION_DESCRIPTION_MAX}
              disabled={busy}
              dir="ltr"
              aria-invalid={state.description !== null || errorCode === ACTION_TYPE_ERRORS.descriptionInvalid || undefined}
              onChange={(e) => change('description', e.target.value)}
              className="w-72"
              data-action-edit-description=""
            />
          </label>
          {state.description && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800" data-action-edit-description-problem={state.description}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t(`actionTypes.edit.description.${state.description}`, { max: fsi(String(ACTION_DESCRIPTION_MAX)) })}
            </p>
          )}
        </div>

        <fieldset className="rounded-lg border border-border/60 p-3">
          <legend className="px-1 text-sm font-semibold">{t('actionTypes.options')}</legend>
          <div className="grid gap-2 md:grid-cols-2">
            {ACTION_TYPE_OPTIONS.map((field) => (
              <label key={field} className="flex items-center justify-between gap-2 text-sm" data-action-edit-field={field}>
                <span>{t(`fields.${field}`)}</span>
                <input type="checkbox" checked={draft[field]} disabled={busy} onChange={(e) => change(field, e.target.checked)} />
              </label>
            ))}
          </div>
        </fieldset>

        <section data-action-edit-diff="">
          <h3 className="mb-1 text-sm font-semibold">{t('edit.changesTitle')}</h3>
          {state.changes.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-action-edit-no-changes="">
              {t('edit.noChanges')}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-1 text-start font-medium" />
                  <th className="py-1 text-start font-medium">{t('edit.before')}</th>
                  <th className="py-1 text-start font-medium">{t('edit.after')}</th>
                </tr>
              </thead>
              <tbody>
                {state.changes.map((c) => (
                  <tr key={c.field} className="border-t border-border/60" data-action-edit-change={c.field}>
                    <td className="py-1 pe-3">{t(`fields.${c.field}`)}</td>
                    <td className="py-1 pe-3">{yesNo(c.before)}</td>
                    <td className="py-1 pe-3">{yesNo(c.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <AffectedTypesList view={state.affected} where="dialog" />

        {reread && !save.isSuccess && <RereadNotice />}

        <ReasonField
          value={reasonText}
          reason={state.reason}
          disabled={busy}
          errorCode={errorCode}
          attr="action-edit-reason"
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
              title={t('dialog.failed')}
              message={stale ? t('actionTypes.edit.stale') : apiErrorMessage(save.error, t('dialog.failedHint'))}
            >
              {errorCode && (
                <span className="font-mono text-xs" data-action-edit-error={errorCode}>
                  <Ltr>{errorCode}</Ltr>
                </span>
              )}
            </ErrorBanner>
          ))}
      </div>
    </Modal>
  )
}
