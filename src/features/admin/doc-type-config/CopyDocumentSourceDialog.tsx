import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { CHANGE_LOG_KEY } from './change-log-api'
import { codeOnlyBehaviourQuery } from './copy-api'
import { copyWarning } from './copy-form'
import { SOURCE_CODE_MAX, setSourceField, sourceCopyDraft, sourceCopyRequest, sourceCopyState } from './document-source-edit'
import type { DocumentSourceSettings } from './document-source-types'
import { DOCUMENT_SOURCES_KEY, DOCUMENT_SOURCE_ERRORS, documentSourcesApi } from './document-sources-api'
import SourceFormFields, { SourceReason } from './SourceFormFields'

/**
 * Copy a document source under a new code (BackOffice spec 3148; ticket 3156). The new code, its description and its
 * category (kept from the source) are filled here; the server copies every column of the source and logs a Copy row
 * naming it — one commit. When the server lists the source code as carrying behaviour tied to the code itself (the
 * fulfilment-mode policy and any other source-code branch), a warning names it line by line in English and Arabic; it
 * never blocks. Rendered only for a session holding the grant.
 */
export default function CopyDocumentSourceDialog({
  open,
  source,
  existingCodes,
  onClose,
  onCopied,
}: {
  open: boolean
  source: DocumentSourceSettings
  existingCodes: readonly string[]
  onClose: () => void
  onCopied: (code: string) => void
}) {
  const { t } = useTranslation('doc-type-config')
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(() => sourceCopyDraft(source))
  const [code, setCode] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [shown, setShown] = useState({ open, source })
  if (shown.open !== open || shown.source !== source) {
    setShown({ open, source })
    setDraft(sourceCopyDraft(source))
    setCode('')
    setReasonText('')
  }

  const behaviour = useQuery({ ...codeOnlyBehaviourQuery('DocumentSource', source.documentSource), enabled: open })
  const warning = copyWarning(behaviour.data)
  const withCode = { ...draft, documentSource: code }

  const save = useMutation({
    mutationFn: () => documentSourcesApi.copy(source.documentSource, sourceCopyRequest(withCode, reasonText)),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: DOCUMENT_SOURCES_KEY })
      void queryClient.invalidateQueries({ queryKey: CHANGE_LOG_KEY })
      notify.success(t('documentSources.copy.saved', { code: fsi(saved.documentSource) }))
      onClose()
      onCopied(saved.documentSource)
    },
  })

  const state = sourceCopyState(withCode, reasonText, existingCodes)
  const busy = save.isPending
  const errorCode = save.error ? apiErrorCode(save.error) : null

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t('documentSources.copy.title', { code: fsi(source.documentSource) })}
      width="40rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-source-copy-cancel="">
            {t('dialog.cancel')}
          </Button>
          <Button disabled={!state.canSave || busy} onClick={() => state.canSave && !busy && save.mutate()} data-source-copy-save="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('dialog.sending') : t('copy.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-source-copy-dialog="">
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t('documentSources.copy.note')}</p>

        {warning.show && (
          <section role="note" className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-sm" data-source-copy-warning="">
            <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-attention-800">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {t('documentSources.copy.warningTitle', { code: fsi(source.documentSource) })}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {warning.lines.map((l) => (
                <li key={`${l.entityType}|${l.code}|${l.english}`} className="flex flex-col" data-source-copy-warning-line={l.code}>
                  <bdi dir="ltr" className="text-start">
                    {l.english}
                  </bdi>
                  <bdi dir="rtl" className="text-start" lang="ar">
                    {l.arabic}
                  </bdi>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">{t('copy.warningNote')}</p>
          </section>
        )}

        <label className="flex items-center justify-between gap-2 text-sm" data-source-field="documentSource">
          <span>{t('documentSources.copy.newCode')}</span>
          <input
            type="text"
            value={code}
            maxLength={SOURCE_CODE_MAX + 1}
            disabled={busy}
            dir="ltr"
            aria-invalid={(state.blocker !== null && state.blocker.startsWith('code')) || undefined}
            onChange={(e) => {
              setCode(e.target.value)
              save.reset()
            }}
            className="w-72 rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-sm uppercase"
            data-source-copy-code=""
          />
        </label>

        <SourceFormFields
          draft={draft}
          description={draft.description === '' ? null : state.description}
          disabled={busy}
          invalidDescription={errorCode === DOCUMENT_SOURCE_ERRORS.descriptionInvalid}
          invalidCategory={errorCode === DOCUMENT_SOURCE_ERRORS.categoryInvalid}
          onChange={(field, value) => {
            setDraft((d) => setSourceField(d, field, value))
            save.reset()
          }}
        />

        {state.blocker && state.blocker !== 'reason' && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-source-copy-blocker={state.blocker}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t(`documentSources.copy.blockers.${state.blocker}`, { code: fsi(state.code), max: fsi(String(SOURCE_CODE_MAX)) })}
          </p>
        )}

        <SourceReason
          value={reasonText}
          reason={state.reason}
          disabled={busy}
          onChange={(text) => {
            setReasonText(text)
            save.reset()
          }}
        />

        {save.isError &&
          (isBareDenial(save.error) ? (
            <ErrorBanner className="p-2" message={t('edit.notGranted')} />
          ) : (
            <ErrorBanner className="p-2" title={t('copy.failed')} message={apiErrorMessage(save.error, t('dialog.failedHint'))}>
              {errorCode && (
                <span className="font-mono text-xs" data-source-copy-error={errorCode}>
                  <Ltr>{errorCode}</Ltr>
                </span>
              )}
            </ErrorBanner>
          ))}
      </div>
    </Modal>
  )
}
