import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { FilePenLine, Loader2, Plus, Send, Trash2 } from 'lucide-react'

import { apiErrorData, apiErrorMessage, isBareDenial } from '@/core/api'
import { ByAt, DeniedCard, Loading } from '@/core/insurance-rules/parts'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { IDF_DRAFT_KEY, IDF_KEY, idfDraftApi } from './api'
import { draftAddBody, draftEditRefusal, draftPanelView, EMPTY_DRAFT_ADD, type IdfDraft, type IdfDraftDiff, type IdfDraftMark, type IdfDraftAddForm } from './draft'
import type { IdfEntryRow } from './items'
import { useDraft } from './useDraft'

/**
 * A master's **draft panel** (BackOffice spec 3185, door 3189; oms ticket 645): Start copies the live items into a
 * draft, which the server keeps (it survives closing the browser); Add / re-rank / remove change it, each checked as
 * an upload line is — a refused edit shows the rule and its message and leaves the draft as it was (a business
 * outcome, inline, never an error toast); Publish with a note makes ONE new live version; Discard asks first.
 * The items section above shows the draft's rows marked against the version it was copied from (`useDraft`).
 *
 * 646 slots in here: `draftPanelView` grows mine / someone else's / stale, Rebase and Add a group join `OpenDraft`.
 * 🚩 UNGATED until 654 adds the edit-grant probe.
 */
export default function DraftPanel({ masterId }: { masterId: string }) {
  const { t } = useTranslation('insurance-idf')
  const { draft, diff } = useDraft(masterId)
  const view = draft.data === undefined ? null : draftPanelView(draft.data)
  return (
    <div className="flex max-w-5xl flex-col gap-3 rounded-md border border-border/60 bg-card p-3" data-idf-draft-panel={view ?? ''}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <FilePenLine className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('draft.title')}
      </div>
      {draft.isError && isBareDenial(draft.error) ? (
        <DeniedCard ns="insurance-idf" hook="idf-draft-denied" />
      ) : draft.isError ? (
        <div data-idf-draft-failed="">
          <ErrorBanner message={apiErrorMessage(draft.error, t('draft.failed'))} />
        </div>
      ) : view === null ? (
        <Loading text={t('draft.loading')} />
      ) : view === 'none' ? (
        <NoDraft masterId={masterId} />
      ) : (
        draft.data && <OpenDraft masterId={masterId} draft={draft.data} diff={diff} />
      )}
    </div>
  )
}

/** Refresh the draft after an edit (its rows) — the base version has not moved. */
function useDraftRefresh(masterId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [...IDF_DRAFT_KEY, masterId] })
}

function NoDraft({ masterId }: { masterId: string }) {
  const { t } = useTranslation('insurance-idf')
  const refresh = useDraftRefresh(masterId)
  const start = useMutation({ mutationFn: () => idfDraftApi.start(masterId), onSuccess: () => refresh() })
  return (
    <>
      <p className="text-sm text-muted-foreground" data-idf-draft-none="">
        {t('draft.none')}
      </p>
      <div>
        <Button variant="secondary" data-idf-draft-start="" disabled={start.isPending} onClick={() => start.mutate()}>
          {start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FilePenLine className="h-3.5 w-3.5" aria-hidden />}
          {t('draft.start')}
        </Button>
      </div>
      {start.isError && (
        <div data-idf-draft-start-refused="">
          <ErrorBanner message={apiErrorMessage(start.error, t('draft.startFailed'))} />
        </div>
      )}
    </>
  )
}

function OpenDraft({ masterId, draft, diff }: { masterId: string; draft: IdfDraft; diff: IdfDraftDiff | null }) {
  const { t } = useTranslation('insurance-idf')
  return (
    <>
      <p className="text-xs text-muted-foreground">{t('draft.lede')}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-idf-draft={draft.draftId}>
        <dt className="text-muted-foreground">{t('draft.started')}</dt>
        <dd data-col="started">
          <ByAt by={draft.by} at={draft.startedAt} />
        </dd>
        <dt className="text-muted-foreground">{t('draft.changed')}</dt>
        <dd data-col="changed">
          {draft.changedAt && <Ltr>{formatDateTime(draft.changedAt)}</Ltr>}
        </dd>
        <dt className="text-muted-foreground">{t('draft.changes')}</dt>
        <dd data-col="counts" data-idf-draft-counts="">
          {diff ? (
            <Trans
              t={t}
              i18nKey="draft.counts"
              values={{ added: formatFigure(diff.counts.added), reRanked: formatFigure(diff.counts.reRanked), moved: formatFigure(diff.counts.moved), removed: formatFigure(diff.counts.removed) }}
              components={{ v: <Ltr /> }}
            />
          ) : (
            <span className="text-muted-foreground">{t('draft.comparing')}</span>
          )}
        </dd>
      </dl>
      <AddItem masterId={masterId} />
      <Publish masterId={masterId} draft={draft} />
    </>
  )
}

function AddItem({ masterId }: { masterId: string }) {
  const { t } = useTranslation('insurance-idf')
  const refresh = useDraftRefresh(masterId)
  const [form, setForm] = useState<IdfDraftAddForm>(EMPTY_DRAFT_ADD)
  const body = draftAddBody(form)
  const add = useMutation({
    mutationFn: () => idfDraftApi.add(masterId, body!),
    onSuccess: async () => {
      setForm(EMPTY_DRAFT_ADD)
      await refresh()
    },
  })
  const field = (k: keyof IdfDraftAddForm) => ({
    value: form[k],
    'data-field': k,
    dir: 'ltr' as const,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      add.reset()
      setForm((f) => ({ ...f, [k]: e.target.value }))
    },
  })
  return (
    <fieldset className="flex flex-col gap-2 border-t border-border/60 pt-3" data-idf-draft-add="">
      <legend className="text-sm font-medium">{t('draft.addTitle')}</legend>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('draft.item')}>
          <Input {...field('itemNumber')} className="w-36" placeholder={t('draft.itemPlaceholder')} />
        </Field>
        <Field label={t('draft.group')}>
          <Input {...field('idfNumber')} className="w-40" placeholder={t('draft.groupPlaceholder')} />
        </Field>
        <Field label={t('draft.priority')}>
          <Input {...field('priority')} className="w-24" inputMode="numeric" />
        </Field>
        <Button variant="secondary" data-idf-draft-add-submit="" disabled={!body || add.isPending} onClick={() => body && add.mutate()}>
          {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
          {t('draft.add')}
        </Button>
      </div>
      {add.isError && <EditRefusal err={add.error} />}
    </fieldset>
  )
}

function Publish({ masterId, draft }: { masterId: string; draft: IdfDraft }) {
  const { t } = useTranslation('insurance-idf')
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const publish = useMutation({
    mutationFn: () => idfDraftApi.publish(masterId, note.trim()),
    onSuccess: async (v) => {
      notify.success(t('draft.published'), t('draft.publishedDetail', { n: fsi(formatFigure(v.number)) }))
      setNote('')
      // Every IDF read: the master's live version, the versions list, the entries and the (now closed) draft.
      await queryClient.invalidateQueries({ queryKey: IDF_KEY })
    },
  })
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3" data-idf-draft-publish-step="">
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('draft.note')} className="min-w-64 flex-1">
          <Input value={note} placeholder={t('draft.notePlaceholder')} data-idf-draft-note="" onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button variant="primary" data-idf-draft-publish="" disabled={note.trim() === '' || publish.isPending || draft.isStale} onClick={() => publish.mutate()}>
          {publish.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
          {t('draft.publish')}
        </Button>
        <Button variant="danger" data-idf-draft-discard="" disabled={publish.isPending} onClick={() => setDiscarding(true)}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {t('draft.discard')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('draft.publishHint')}</p>
      {publish.isError && (
        <div data-idf-draft-publish-refused="">
          <ErrorBanner message={apiErrorMessage(publish.error, t('draft.publishFailed'))} />
        </div>
      )}
      {discarding && <DiscardDialog masterId={masterId} onClose={() => setDiscarding(false)} />}
    </div>
  )
}

function DiscardDialog({ masterId, onClose }: { masterId: string; onClose: () => void }) {
  const { t } = useTranslation('insurance-idf')
  const queryClient = useQueryClient()
  const discard = useMutation({
    mutationFn: () => idfDraftApi.discard(masterId),
    onSuccess: async () => {
      notify.success(t('draft.discarded'))
      onClose()
      await queryClient.invalidateQueries({ queryKey: [...IDF_DRAFT_KEY, masterId] })
    },
  })
  return (
    <Modal
      open
      onClose={onClose}
      width="28rem"
      title={t('draft.discardTitle')}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('draft.cancel')}
          </Button>
          <Button variant="danger" disabled={discard.isPending} data-idf-draft-discard-confirm="" onClick={() => discard.mutate()}>
            {t('draft.discard')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-draft-discard-dialog="">
        <p className="text-sm">{t('draft.discardHint')}</p>
        {discard.isError && (
          <div data-idf-draft-discard-refused="">
            <ErrorBanner message={apiErrorMessage(discard.error, t('draft.discardFailed'))} />
          </div>
        )}
      </div>
    </Modal>
  )
}

/**
 * A refused draft edit: the rule's word (its raw code when this build has none) and the server's message in the
 * reader's language — or, for a refusal that names no rule, the envelope's message.
 */
function EditRefusal({ err }: { err: unknown }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const refusal = draftEditRefusal(apiErrorData(err), i18n.language)
  return (
    <div className="rounded-md border border-attention-border bg-attention-050 p-2 text-sm text-attention-800" role="alert" data-idf-draft-refused={refusal?.rule ?? ''}>
      {refusal ? (
        <>
          <span className="font-medium" data-col="rule">
            {refusal.wordKey ? t(refusal.wordKey) : <Ltr>{refusal.rule}</Ltr>}
          </span>
          {refusal.message && (
            <span className="ms-2" data-col="message">
              <bdi>{refusal.message}</bdi>
            </span>
          )}
        </>
      ) : (
        <span data-col="message">
          <bdi>{apiErrorMessage(err, t('draft.editFailed'))}</bdi>
        </span>
      )}
    </div>
  )
}

/** The items table's mark cell for a draft row (or a removed one). */
export function DraftMark({ mark }: { mark: IdfDraftMark | 'removed' | null }) {
  const { t } = useTranslation('insurance-idf')
  if (!mark) return null
  const tone = mark === 'unchanged' ? 'text-muted-foreground' : 'font-medium'
  return (
    <span className={`text-xs ${tone}`} data-mark={mark}>
      {t(`draft.mark.${mark}`)}
    </span>
  )
}

/** A draft row's Re-rank and Remove, each in a dialog that shows a refusal and leaves the draft as it was. */
export function DraftRowActions({ masterId, row }: { masterId: string; row: IdfEntryRow }) {
  const { t } = useTranslation('insurance-idf')
  const [open, setOpen] = useState<'reRank' | 'remove' | null>(null)
  return (
    <div className="flex gap-1">
      <Button variant="ghost" data-idf-draft-rerank={row.itemNumber} onClick={() => setOpen('reRank')}>
        {t('draft.reRank')}
      </Button>
      <Button variant="ghost" data-idf-draft-remove={row.itemNumber} onClick={() => setOpen('remove')}>
        {t('draft.remove')}
      </Button>
      {open === 'reRank' && <ReRankDialog masterId={masterId} row={row} onClose={() => setOpen(null)} />}
      {open === 'remove' && <RemoveDialog masterId={masterId} row={row} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ReRankDialog({ masterId, row, onClose }: { masterId: string; row: IdfEntryRow; onClose: () => void }) {
  const { t } = useTranslation('insurance-idf')
  const refresh = useDraftRefresh(masterId)
  const [priority, setPriority] = useState(String(row.priority))
  const value = Number(priority.trim())
  const valid = priority.trim() !== '' && Number.isFinite(value)
  const reRank = useMutation({
    mutationFn: () => idfDraftApi.reRank(masterId, row.itemNumber, value),
    onSuccess: async () => {
      onClose()
      await refresh()
    },
  })
  return (
    <Modal
      open
      onClose={onClose}
      width="26rem"
      title={t('draft.reRankTitle', { item: fsi(row.itemNumber) })}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('draft.cancel')}
          </Button>
          <Button variant="primary" disabled={!valid || reRank.isPending} data-idf-draft-rerank-confirm="" onClick={() => reRank.mutate()}>
            {t('draft.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-draft-rerank-dialog={row.itemNumber}>
        <Field label={t('draft.newPriority')}>
          <Input
            value={priority}
            dir="ltr"
            inputMode="numeric"
            className="w-24"
            data-field="priority"
            onChange={(e) => {
              reRank.reset()
              setPriority(e.target.value)
            }}
          />
        </Field>
        {reRank.isError && <EditRefusal err={reRank.error} />}
      </div>
    </Modal>
  )
}

function RemoveDialog({ masterId, row, onClose }: { masterId: string; row: IdfEntryRow; onClose: () => void }) {
  const { t } = useTranslation('insurance-idf')
  const refresh = useDraftRefresh(masterId)
  const remove = useMutation({
    mutationFn: () => idfDraftApi.remove(masterId, row.itemNumber),
    onSuccess: async () => {
      onClose()
      await refresh()
    },
  })
  return (
    <Modal
      open
      onClose={onClose}
      width="26rem"
      title={t('draft.removeTitle', { item: fsi(row.itemNumber) })}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('draft.cancel')}
          </Button>
          <Button variant="danger" disabled={remove.isPending} data-idf-draft-remove-confirm="" onClick={() => remove.mutate()}>
            {t('draft.remove')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-idf-draft-remove-dialog={row.itemNumber}>
        <p className="text-sm">{t('draft.removeHint')}</p>
        {remove.isError && <EditRefusal err={remove.error} />}
      </div>
    </Modal>
  )
}
