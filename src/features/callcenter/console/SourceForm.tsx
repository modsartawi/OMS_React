/**
 * The document source and its reference (ticket 173, US20) — how the order is
 * traced back to the campaign or system that produced the call.
 *
 * Three properties this surface exists to hold:
 *
 * 1. 🚩 **The sources offered are the AGENT's own, and there is no user id in
 *    the path.** `CallCenterWeb/MyDocumentSources` resolves the agent off the
 *    session row (137's second deliberate break with *delegates verbatim*), so
 *    this component has nothing to identify itself with and cannot widen what it
 *    reads. The console never falls back to the estate-wide `DocumentSources`
 *    lookup: a source this agent may not use is not an option, it is a refusal
 *    waiting to happen.
 * 2. 🚩 **One verb carries both fields.** Which sources require a reference is
 *    the SERVER's rule, evaluated over the pair — so they are captured together
 *    and sent together, and the console never predicts the answer. It does not
 *    disable *Save* on an empty reference for exactly that reason: the refusal
 *    `SOURCE_REFERENCE_REQUIRED` is worded here, and a client-side required-field
 *    rule would be a second opinion about a rule that is not this console's.
 * 3. **Two chips, one section.** Source and reference collapse into their own
 *    chips (135's progressive disclosure) but re-open the same form, because
 *    they are one act — a reference belongs to the source it references.
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { callCenterApi, MY_SOURCES_KEY } from './api'
import { NOTE } from './console-notes'

export interface SourceApply {
  busy: boolean
  /** The failure, already worded by the caller — including the mandatory-reference
   *  refusal, which is the server's rule stated in the agent's words. */
  error: string | null
  onApply: (documentSource: string, sourceReference: string) => void
}

export default function SourceForm({
  open,
  currentSource,
  currentReference,
  apply,
  onClose,
}: {
  open: boolean
  currentSource: string | null
  currentReference: string | null
  apply: SourceApply
  onClose: () => void
}) {
  const { t } = useTranslation('callcenter')
  const [source, setSource] = useState('')
  const [reference, setReference] = useState('')

  const sources = useQuery({
    queryKey: MY_SOURCES_KEY,
    queryFn: () => callCenterApi.myDocumentSources(),
    // The agent's own list does not change during a shift, and it is read on
    // first open rather than at mount: an agent who never re-opens this section
    // pays for it once.
    staleTime: Infinity,
    retry: false,
    enabled: open,
  })
  const options = sources.data ?? []

  // Seeded from what the ORDER holds, every time the form opens — a re-opened
  // section shows what is settled, not what was typed into it last time.
  //
  // 🚩 On an order that names NO source, the agent's own default fills the box
  // (`isDefault`, BackOffice owner ruling 2026-07-29 — the operator's usual
  // channel is configured for them, and typing it on every call is work nobody
  // asked for). It is a PRE-SELECTION and nothing more: the select stays open,
  // and nothing is on the order until *Save* is pressed. What the order already
  // holds always wins — a settled source is never overwritten by a default.
  useEffect(() => {
    if (!open) return
    setSource(currentSource ?? '')
    setReference(currentReference ?? '')
  }, [open, currentSource, currentReference])

  // Deliberately a SECOND effect keyed on the list, not a branch inside the one
  // above: the sources arrive after the form opens, so the seed cannot be read
  // at open time — and folding it in would re-run on every list settle and undo
  // what the agent had already picked.
  useEffect(() => {
    if (!open || currentSource) return
    const preferred = sources.data?.find((option) => option.isDefault)
    if (preferred) setSource((chosen) => (chosen === '' ? preferred.documentSource : chosen))
  }, [open, currentSource, sources.data])

  // The one thing that is genuinely this form's to require: a verb that names no
  // source has nothing to send. Which sources need a REFERENCE is not asked here.
  const canApply = source !== '' && !apply.busy

  return (
    <Modal
      open={open}
      onClose={() => !apply.busy && onClose()}
      title={t('source.title')}
      width="28rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={apply.busy} data-cc-source-close>
            {t('source.close')}
          </Button>
          <Button
            variant="primary"
            onClick={() => apply.onApply(source, reference.trim())}
            disabled={!canApply}
            data-cc-source-apply
          >
            {apply.busy ? t('source.saving') : t('source.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm" data-cc-source-form>
        {sources.isPending && (
          <p className="flex items-center gap-2 text-muted-foreground" data-cc-source-loading>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('source.loading')}
          </p>
        )}

        {sources.isError && (
          <>
            <p className={NOTE.danger} data-cc-source-list-error>
              {apiErrorMessage(sources.error, t('source.loadFailed'))}
            </p>
            {/* The read is pure, so trying it again costs the order nothing. */}
            <Button
              variant="outlined"
              onClick={() => void sources.refetch()}
              disabled={sources.isFetching}
              data-cc-source-reload
            >
              {t('actions.retry')}
            </Button>
          </>
        )}

        {sources.isSuccess && options.length === 0 && (
          <p className={NOTE.attention} data-cc-source-empty>
            {t('source.noneForYou')}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="cc-source">
            {t('source.field')}
          </label>
          <select
            id="cc-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={apply.busy || options.length === 0}
            data-cc-source-select
            className="h-8 w-full rounded-lg border border-input bg-background px-2 text-[0.8125rem]"
          >
            <option value="">{t('source.choose')}</option>
            {options.map((option) => (
              <option key={option.documentSource} value={option.documentSource}>
                {/* Server-supplied, passed through as data. */}
                {[option.documentSource, option.description].filter(Boolean).join(' · ')}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="cc-source-reference">
            {t('source.reference')}
          </label>
          <input
            id="cc-source-reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            disabled={apply.busy}
            autoComplete="off"
            placeholder={t('source.referencePlaceholder')}
            data-cc-source-reference
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <p className="text-[11px] text-muted-foreground">{t('source.referenceHint')}</p>
        </div>

        {apply.error && (
          <p className={NOTE.danger} data-cc-source-error>
            {apply.error}
          </p>
        )}
      </div>
    </Modal>
  )
}
