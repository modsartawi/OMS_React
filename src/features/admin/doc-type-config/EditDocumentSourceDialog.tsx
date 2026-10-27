import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Lock } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { DOC_TYPE_CONFIG_ERRORS } from './api'
import { CHANGE_LOG_KEY } from './change-log-api'
import { setSourceField, sourceEditState, sourceSaveRequest } from './document-source-edit'
import type { DocumentSourceSettings } from './document-source-types'
import { DOCUMENT_SOURCES_KEY, DOCUMENT_SOURCE_ERRORS, documentSourcesApi } from './document-sources-api'
import ReasonField from './ReasonField'
import RereadNotice from './RereadNotice'
import SourceFormFields from './SourceFormFields'
import { useReReadDraft } from './use-reread-draft'

/**
 * Edit a document source (BackOffice spec 3148; ticket 3156): its description and category; the code shown locked. Below
 * the form, the before/after of what changed, then the required reason. A save over someone else's change is refused
 * (`SDC-00004`) and the list re-read. Rendered only for a session holding the grant.
 */
export default function EditDocumentSourceDialog({
  open,
  loaded,
  onClose,
}: {
  open: boolean
  loaded: DocumentSourceSettings
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
    mutationFn: () => documentSourcesApi.update(base.documentSource, sourceSaveRequest(base, draft, reasonText)),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: DOCUMENT_SOURCES_KEY })
      void queryClient.invalidateQueries({ queryKey: CHANGE_LOG_KEY })
      notify.success(t('documentSources.edit.saved', { code: fsi(saved.documentSource) }))
      onClose()
    },
    onError: (err) => {
      if (apiErrorCode(err) === DOC_TYPE_CONFIG_ERRORS.staleBeforeState) void queryClient.invalidateQueries({ queryKey: DOCUMENT_SOURCES_KEY })
    },
  })

  const state = sourceEditState(base, draft, reasonText)
  const busy = save.isPending
  const errorCode = save.error ? apiErrorCode(save.error) : null
  const stale = errorCode === DOC_TYPE_CONFIG_ERRORS.staleBeforeState && !reread
  const category = (v: string) => t(`documentSources.categories.${v.trim() || '_blank'}`, { defaultValue: v })

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t('documentSources.edit.title', { code: fsi(loaded.documentSource) })}
      width="40rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-source-edit-cancel="">
            {t('dialog.cancel')}
          </Button>
          <Button disabled={!state.canSave || busy || stale} onClick={() => state.canSave && !busy && save.mutate()} data-source-edit-save="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('dialog.sending') : t('edit.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-source-edit-dialog="">
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t('documentSources.edit.note')}</p>

        <div className="flex items-center justify-between gap-2 text-sm" data-source-edit-locked="documentSource">
          <span className="flex items-center gap-1 text-muted-foreground">
            {t('fields.documentSource')}
            <Lock className="h-3 w-3" aria-label={t('detail.locked')} />
          </span>
          <span className="font-mono">
            <Ltr>{loaded.documentSource}</Ltr>
          </span>
        </div>

        <SourceFormFields
          draft={draft}
          description={state.description}
          disabled={busy}
          invalidDescription={errorCode === DOCUMENT_SOURCE_ERRORS.descriptionInvalid}
          invalidCategory={errorCode === DOCUMENT_SOURCE_ERRORS.categoryInvalid}
          onChange={(field, value) => {
            setDraft((d) => setSourceField(d, field, value))
            save.reset()
          }}
        />

        <section data-source-edit-diff="">
          <h3 className="mb-1 text-sm font-semibold">{t('edit.changesTitle')}</h3>
          {state.changes.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-source-edit-no-changes="">
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
                  <tr key={c.field} className="border-t border-border/60" data-source-edit-change={c.field}>
                    <td className="py-1 pe-3">{t(`fields.${c.field}`)}</td>
                    <td className="py-1 pe-3">{c.field === 'documentSourceCategory' ? category(c.before) : <bdi>{c.before}</bdi>}</td>
                    <td className="py-1 pe-3">{c.field === 'documentSourceCategory' ? category(c.after) : <bdi>{c.after}</bdi>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {reread && !save.isSuccess && <RereadNotice />}

        <ReasonField
          value={reasonText}
          reason={state.reason}
          disabled={busy}
          errorCode={errorCode}
          attr="source-reason"
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
              message={stale ? t('documentSources.edit.stale') : apiErrorMessage(save.error, t('dialog.failedHint'))}
            >
              {errorCode && (
                <span className="font-mono text-xs" data-source-edit-error={errorCode}>
                  <Ltr>{errorCode}</Ltr>
                </span>
              )}
            </ErrorBanner>
          ))}
      </div>
    </Modal>
  )
}
