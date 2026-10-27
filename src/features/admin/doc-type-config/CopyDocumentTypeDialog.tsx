import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { DOCUMENT_TYPES_KEY, documentTypeFieldsQuery, documentTypesQuery } from './api'
import { CHANGE_LOG_KEY } from './change-log-api'
import { codeOnlyBehaviourQuery, copyApi } from './copy-api'
import { CODE_MAX, copyDraft, copyRequest, copyState, copyWarning, setCopyField } from './copy-form'
import { FieldInput, useDefaultDeliveryTypeChoices } from './EditDocumentTypeDialog'
import { fieldMetaIndex } from './field-meta'
import ReasonField from './ReasonField'
import { FIELD_GROUPS } from './fields'
import { settingsRefusals } from './settings-refusal'
import type { DocumentTypeSettings } from './types'

/**
 * Copy a document type (BackOffice spec 3148 stories 26-32; ticket 3153). The source's every setting, with a blank
 * code and description to fill; EVERY setting is editable here — category and engine too, since they lock only once
 * the type exists. When the server lists the source code as carrying behaviour tied to the code itself, a warning
 * names it, line by line in English and Arabic; it never blocks. Save waits for a new code, a description and a
 * reason (`copyState`). The server copies every physical column, the item-category assignment and plant network rows,
 * and logs a Copy row for each — one commit. Rendered only for a session holding the grant.
 */
export default function CopyDocumentTypeDialog({
  open,
  source,
  onClose,
}: {
  open: boolean
  source: DocumentTypeSettings
  onClose: () => void
}) {
  const { t } = useTranslation('doc-type-config')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => copyDraft(source))
  const [reasonText, setReasonText] = useState('')
  // A fresh opening starts from the source and an empty reason (adjusted while rendering, before paint).
  const [shownOpen, setShownOpen] = useState(open)
  if (shownOpen !== open) {
    setShownOpen(open)
    setDraft(copyDraft(source))
    setReasonText('')
  }

  const types = useQuery({ ...documentTypesQuery(), enabled: open })
  const fieldMetas = useQuery({ ...documentTypeFieldsQuery(), enabled: open })
  const metaIndex = fieldMetaIndex(fieldMetas.data)
  const deliveryTypeChoices = useDefaultDeliveryTypeChoices(open, draft.defaultDeliveryType)
  const behaviour = useQuery({ ...codeOnlyBehaviourQuery('DocumentType', source.documentType), enabled: open })
  const warning = copyWarning(behaviour.data)

  const save = useMutation({
    mutationFn: () => copyApi.copyDocumentType(source.documentType, copyRequest(draft, reasonText)),
    onSuccess: (saved) => {
      queryClient.setQueryData([...DOCUMENT_TYPES_KEY, saved.documentType], saved)
      void queryClient.invalidateQueries({ queryKey: DOCUMENT_TYPES_KEY, exact: true })
      void queryClient.invalidateQueries({ queryKey: CHANGE_LOG_KEY })
      notify.success(t('copy.saved', { code: fsi(saved.documentType) }))
      onClose()
      navigate(`/admin/doc-types/${encodeURIComponent(saved.documentType)}`)
    },
  })

  const state = copyState(
    draft,
    reasonText,
    (types.data ?? []).map((r) => r.documentType),
  )
  const refusals = save.error ? settingsRefusals(save.error) : {}
  const refusedOnFields = Object.keys(refusals).length > 0
  const busy = save.isPending
  const errorCode = save.error ? apiErrorCode(save.error) : null

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t('copy.title', { code: fsi(source.documentType) })}
      width="56rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-copy-cancel="">
            {t('dialog.cancel')}
          </Button>
          <Button disabled={!state.canSave || busy} onClick={() => state.canSave && !busy && save.mutate()} data-copy-save="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('dialog.sending') : t('copy.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-copy-dialog="">
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t('copy.note')}</p>

        {warning.show && (
          <section role="note" className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-sm" data-copy-warning="">
            <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-attention-800">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {t('copy.warningTitle', { code: fsi(source.documentType) })}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {warning.lines.map((l) => (
                <li key={`${l.entityType}|${l.code}|${l.english}`} className="flex flex-col" data-copy-warning-line={l.code}>
                  <bdi dir="ltr" className="text-start" data-copy-warning-en="">
                    {l.english}
                  </bdi>
                  <bdi dir="rtl" className="text-start" lang="ar" data-copy-warning-ar="">
                    {l.arabic}
                  </bdi>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">{t('copy.warningNote')}</p>
          </section>
        )}

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
                    locked={false}
                    choices={def.field === 'defaultDeliveryType' ? deliveryTypeChoices : null}
                    onChange={(v) => {
                      setDraft((d) => setCopyField(d, def.field, v))
                      save.reset()
                    }}
                  />
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        {state.blocker && state.blocker !== 'reason' && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-copy-blocker={state.blocker}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t(`copy.blockers.${state.blocker}`, { code: fsi(state.code), max: fsi(String(CODE_MAX)) })}
          </p>
        )}

        <ReasonField
          value={reasonText}
          reason={state.reason}
          disabled={busy}
          errorCode={errorCode}
          attr="copy-reason"
          onChange={(text) => {
            setReasonText(text)
            save.reset()
          }}
        />

        {save.isError &&
          (isBareDenial(save.error) ? (
            <ErrorBanner className="p-2" message={t('edit.notGranted')} />
          ) : (
            <ErrorBanner
              className="p-2"
              title={t('copy.failed')}
              message={refusedOnFields ? t('edit.refusedOnFields') : apiErrorMessage(save.error, t('dialog.failedHint'))}
            >
              {errorCode && (
                <span className="font-mono text-xs" data-copy-error={errorCode}>
                  <Ltr>{errorCode}</Ltr>
                </span>
              )}
            </ErrorBanner>
          ))}
      </div>
    </Modal>
  )
}
