import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { FilePenLine, GitMerge, Layers, Loader2, Plus, Send, Trash2 } from 'lucide-react'

import { apiErrorData, apiErrorMessage, isBareDenial } from '@/core/api'
import { DeniedCard, Loading, TD, TH } from '@/core/insurance-rules/parts'
import { notify } from '@/core/services/notify'
import { useSession } from '@/core/session' // 646
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
import { idfDraftOwnerApi, versionsQuery } from './api' // 646
import { draftAddBody, draftEditRefusal, EMPTY_DRAFT_ADD, type IdfDraft, type IdfDraftDiff, type IdfDraftMark, type IdfDraftAddForm } from './draft'
import { draftPanelState, draftStartRefusal, groupAddResult, rebaseResult, type IdfDraftPanelState, type IdfDraftProblem } from './draft' // 646, 654
import { draftActions, type IdfDraftActions } from './access' // 654
import { useIdfAccess } from './useIdfAccess' // 654
import { wholePriority } from './general-edit' // 3185 review
import type { IdfEntryRow } from './items'
import { useDraft } from './useDraft'

/**
 * A master's **draft panel** (BackOffice spec 3185, door 3189; oms ticket 645): Start copies the live items into a
 * draft, which the server keeps (it survives closing the browser); Add / re-rank / remove change it, each checked as
 * an upload line is — a refused edit shows the rule and its message and leaves the draft as it was (a business
 * outcome, inline, never an error toast); Publish with a note makes ONE new live version; Discard asks first.
 * The items section above shows the draft's rows marked against the version it was copied from (`useDraft`).
 *
 * 646 (door 3190): the header names the owner, the start, the last change and the base version. The panel is one of
 * `draftPanelState`'s four: no draft (Start — a refused one names the open draft's owner); mine (edits, Add a group,
 * Publish); mine and stale (the same, Publish off, Rebase on); someone else's ("Draft open by X since …", no edits,
 * Discard with a confirm that says it is their work).
 * 3185 review: a refused Start re-reads the draft, so the open one (and its Discard) shows at once beside the refusal;
 * a base version that cannot be read says so with a retry instead of "comparing…" forever.
 * 654: every draft action (start, add, re-rank, remove, add a group, rebase, publish, discard) shows only with
 * `canEditIdf` (`GET IdfPriority/Access`, `draftActions`); without it the draft is read-only (its header and rows still
 * show). A rebase answers `{ draft, reapplied, rows }`: the panel says how many edits re-applied and lists the ones that
 * could not be (dropped from the draft), with their edit, rule and message.
 */
export default function DraftPanel({ masterId }: { masterId: string }) {
  const { t } = useTranslation('insurance-idf')
  const { draft, base, diff } = useDraft(masterId)
  const userId = useSession((s) => s.userId)
  const view = draft.data === undefined ? null : draftPanelState(draft.data, userId)
  const actions = draftActions(view ?? 'none', useIdfAccess().canEditIdf)
  const refresh = useDraftRefresh(masterId)
  // Start lives here, not in `NoDraft`: a refused Start re-reads the draft (someone opened one meanwhile), which swaps
  // `NoDraft` for their draft — the refusal naming them stays on show above it.
  const start = useMutation({ mutationFn: () => idfDraftApi.start(masterId), onSettled: () => refresh() })
  const namesOwner = start.isError && draftStartRefusal(apiErrorData(start.error)) !== null
  const baseFailed = base.isError ? base.error : null
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
        <NoDraft start={start} canStart={actions.start} />
      ) : (
        <>
          {view === 'someoneElse' && namesOwner && <StartRefusal err={start.error} />}
          {draft.data && <OpenDraft masterId={masterId} draft={draft.data} diff={diff} state={view} actions={actions} baseFailed={baseFailed} onRetryBase={() => void base.refetch()} />}
        </>
      )}
    </div>
  )
}

/** Refresh the draft after an edit (its rows) — the base version has not moved. */
function useDraftRefresh(masterId: string) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: [...IDF_DRAFT_KEY, masterId] })
}

/** No draft: Start. A refusal that names no owner (nothing opened meanwhile) stays here as the envelope's message. */
function NoDraft({ start, canStart }: { start: { isPending: boolean; isError: boolean; error: unknown; mutate: () => void }; canStart: boolean }) {
  const { t } = useTranslation('insurance-idf')
  const namesOwner = start.isError && draftStartRefusal(apiErrorData(start.error)) !== null
  return (
    <>
      <p className="text-sm text-muted-foreground" data-idf-draft-none="">
        {t('draft.none')}
      </p>
      {canStart ? (
        <div>
          <Button variant="secondary" data-idf-draft-start="" disabled={start.isPending} onClick={() => start.mutate()}>
            {start.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <FilePenLine className="h-3.5 w-3.5" aria-hidden />}
            {t('draft.start')}
          </Button>
        </div>
      ) : (
        <ViewOnly />
      )}
      {start.isError && !namesOwner && <StartRefusal err={start.error} />}
    </>
  )
}

/** Without the IDF edit grant the draft is shown, never changed. */
function ViewOnly() {
  const { t } = useTranslation('insurance-idf')
  return (
    <p className="text-xs text-muted-foreground" data-idf-draft-view-only="">
      {t('draft.viewOnly')}
    </p>
  )
}

function OpenDraft({
  masterId,
  draft,
  diff,
  state,
  actions,
  baseFailed,
  onRetryBase,
}: {
  masterId: string
  draft: IdfDraft
  diff: IdfDraftDiff | null
  state: IdfDraftPanelState
  actions: IdfDraftActions
  /** The base version's read failed (the diff cannot be drawn). */
  baseFailed: unknown
  onRetryBase: () => void
}) {
  const { t, i18n } = useTranslation('insurance-idf')
  const [discarding, setDiscarding] = useState(false)
  // 654 · the last rebase's answer, kept here and not in `Rebase`: a rebased draft is no longer stale, so `Rebase` unmounts.
  const [rebased, setRebased] = useState<unknown>(null)
  const rebase = rebased === null ? null : rebaseResult(rebased, i18n.language)
  return (
    <>
      {state === 'someoneElse' ? (
        <p className="rounded-md border border-attention-border bg-attention-050 p-2 text-sm text-attention-800" role="status" data-idf-draft-someone-else={draft.by}>
          <Trans t={t} i18nKey="draft.someoneElse" values={{ by: draft.by, since: formatDateTime(draft.startedAt) }} components={{ b: <bdi />, v: <Ltr /> }} />
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t('draft.lede')}</p>
      )}
      <DraftHeader masterId={masterId} draft={draft} diff={diff} mine={state !== 'someoneElse'} baseFailed={baseFailed != null} />
      {baseFailed != null && (
        <div data-idf-draft-base-failed="">
          <ErrorBanner className="p-3" title={t('draft.baseFailed')} message={apiErrorMessage(baseFailed, t('draft.baseFailed'))}>
            <Button variant="secondary" className="mt-2" data-idf-draft-base-retry="" onClick={onRetryBase}>
              {t('draft.baseRetry')}
            </Button>
          </ErrorBanner>
        </div>
      )}
      {state === 'stale' && actions.rebase && <Rebase masterId={masterId} onRebased={setRebased} />}
      {rebase && (
        <div className="flex flex-col gap-2 rounded-md border border-border/60 p-2" role="status" data-idf-draft-rebase-result="" data-reapplied={rebase.reapplied} data-dropped={rebase.failed.length}>
          <p className="text-sm" data-idf-draft-rebase-reapplied="">
            <Trans t={t} i18nKey="draft.rebaseReapplied" count={rebase.reapplied} values={{ n: formatFigure(rebase.reapplied) }} components={{ v: <Ltr /> }} />
          </p>
          {rebase.failed.length > 0 && <ProblemsTable caption={t('draft.rebaseDropped')} rows={rebase.failed} withEdit hook="data-idf-draft-rebase-dropped" />}
        </div>
      )}
      {!actions.edit && !actions.discard && <ViewOnly />}
      {state === 'someoneElse' ? (
        actions.discard && (
          <div className="border-t border-border/60 pt-3">
            <Button variant="danger" data-idf-draft-discard="" onClick={() => setDiscarding(true)}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {t('draft.discard')}
            </Button>
            {discarding && <DiscardDialog masterId={masterId} owner={draft} onClose={() => setDiscarding(false)} />}
          </div>
        )
      ) : (
        <>
          {actions.edit && <AddItem masterId={masterId} />}
          {actions.edit && <AddGroup masterId={masterId} />}
          {actions.publish && <Publish masterId={masterId} draft={draft} />}
        </>
      )}
    </>
  )
}

/** Whose draft, started and last changed when, copied from which version, and what it changes. */
function DraftHeader({ masterId, draft, diff, mine, baseFailed }: { masterId: string; draft: IdfDraft; diff: IdfDraftDiff | null; mine: boolean; baseFailed: boolean }) {
  const { t } = useTranslation('insurance-idf')
  // The versions list's query (shared cache with the Versions section) names the base version by its number.
  const versions = useQuery(versionsQuery(masterId))
  const base = draft.baseVersionId ? versions.data?.find((v) => v.versionId === draft.baseVersionId) : undefined
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-idf-draft={draft.draftId}>
      <dt className="text-muted-foreground">{t('draft.owner')}</dt>
      <dd data-col="owner">
        <bdi>{draft.by}</bdi>
        {mine && <span className="ms-1 text-muted-foreground">{t('draft.you')}</span>}
      </dd>
      <dt className="text-muted-foreground">{t('draft.started')}</dt>
      <dd data-col="started">{draft.startedAt && <Ltr>{formatDateTime(draft.startedAt)}</Ltr>}</dd>
      <dt className="text-muted-foreground">{t('draft.changed')}</dt>
      <dd data-col="changed">{draft.changedAt && <Ltr>{formatDateTime(draft.changedAt)}</Ltr>}</dd>
      <dt className="text-muted-foreground">{t('draft.base')}</dt>
      <dd data-col="base" data-base={draft.baseVersionId ?? ''}>
        {!draft.baseVersionId ? (
          t('draft.baseNone')
        ) : base ? (
          <Trans t={t} i18nKey="draft.baseVersion" values={{ n: formatFigure(base.number) }} components={{ v: <Ltr /> }} />
        ) : (
          <Ltr>{draft.baseVersionId}</Ltr>
        )}
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
        ) : baseFailed ? null : (
          <span className="text-muted-foreground">{t('draft.comparing')}</span>
        )}
      </dd>
    </dl>
  )
}

/**
 * A stale draft: Publish is off until the edits are re-applied on the current live version; the diff then refreshes.
 * The answer (`{ draft, reapplied, rows }`) goes up to `OpenDraft`, which shows what re-applied and what was dropped.
 */
function Rebase({ masterId, onRebased }: { masterId: string; onRebased: (answer: unknown) => void }) {
  const { t } = useTranslation('insurance-idf')
  const queryClient = useQueryClient()
  const rebase = useMutation({
    mutationFn: () => idfDraftOwnerApi.rebase(masterId),
    onSuccess: async (answer) => {
      notify.success(t('draft.rebased'))
      onRebased(answer ?? {})
      // Every IDF read, as Publish does: the draft's new `baseVersionId` keys a new base read (the diff follows), and
      // the live version it was rebased onto is read into the masters list and the versions (the header's Base).
      await queryClient.invalidateQueries({ queryKey: IDF_KEY })
    },
  })
  return (
    <div className="flex flex-col gap-2 rounded-md border border-attention-border bg-attention-050 p-2 text-sm text-attention-800" role="status" data-idf-draft-stale="">
      <p>{t('draft.stale')}</p>
      <div>
        <Button variant="secondary" data-idf-draft-rebase="" disabled={rebase.isPending} onClick={() => rebase.mutate()}>
          {rebase.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <GitMerge className="h-3.5 w-3.5" aria-hidden />}
          {t('draft.rebase')}
        </Button>
      </div>
      {rebase.isError && (
        <div data-idf-draft-rebase-refused="">
          <ErrorBanner message={apiErrorMessage(rebase.error, t('draft.rebaseFailed'))} />
        </div>
      )}
    </div>
  )
}

/** A refused Start: the draft already open, by whom and last changed when — else the envelope's message. */
function StartRefusal({ err }: { err: unknown }) {
  const { t } = useTranslation('insurance-idf')
  const open = draftStartRefusal(apiErrorData(err))
  if (!open)
    return (
      <div data-idf-draft-start-refused="">
        <ErrorBanner message={apiErrorMessage(err, t('draft.startFailed'))} />
      </div>
    )
  return (
    <p className="rounded-md border border-attention-border bg-attention-050 p-2 text-sm text-attention-800" role="alert" data-idf-draft-start-refused={open.by}>
      <Trans
        t={t}
        i18nKey={open.changedAt ? 'draft.startRefused' : 'draft.startRefusedNoDate'}
        values={{ by: open.by, changedAt: formatDateTime(open.changedAt) }}
        components={{ b: <bdi />, v: <Ltr /> }}
      />
    </p>
  )
}

/** Add every member of one IDF group at one priority; the answer counts the added and lists the refused members. */
function AddGroup({ masterId }: { masterId: string }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const refresh = useDraftRefresh(masterId)
  const [idfNumber, setIdfNumber] = useState('')
  const [priority, setPriority] = useState('')
  const value = wholePriority(priority)
  const valid = idfNumber.trim() !== '' && value !== null
  const add = useMutation({
    mutationFn: () => idfDraftOwnerApi.addGroup(masterId, { idfNumber: idfNumber.trim(), priority: value! }),
    onSuccess: async () => {
      await refresh()
    },
  })
  const result = add.isSuccess ? groupAddResult(add.data, i18n.language) : null
  const edit = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    add.reset()
    set(e.target.value)
  }
  return (
    <fieldset className="flex flex-col gap-2 border-t border-border/60 pt-3" data-idf-draft-group="">
      <legend className="text-sm font-medium">{t('draft.groupTitle')}</legend>
      <p className="text-xs text-muted-foreground">{t('draft.groupHint')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('draft.group')}>
          <Input value={idfNumber} dir="ltr" data-field="idfNumber" className="w-40" placeholder={t('draft.groupPlaceholder')} onChange={edit(setIdfNumber)} />
        </Field>
        <Field label={t('draft.priority')}>
          <Input value={priority} dir="ltr" data-field="priority" className="w-24" inputMode="numeric" onChange={edit(setPriority)} />
        </Field>
        <Button variant="secondary" data-idf-draft-group-submit="" disabled={!valid || add.isPending} onClick={() => valid && add.mutate()}>
          {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Layers className="h-3.5 w-3.5" aria-hidden />}
          {t('draft.addGroup')}
        </Button>
      </div>
      {add.isError && <EditRefusal err={add.error} />}
      {result && (
        <div className="flex flex-col gap-2" data-idf-draft-group-result="" data-added={result.added}>
          <p className="text-sm" data-idf-draft-group-added="">
            <Trans t={t} i18nKey="draft.groupAdded" count={result.added} values={{ n: formatFigure(result.added) }} components={{ v: <Ltr /> }} />
          </p>
          {result.refused.length > 0 && <ProblemsTable caption={t('draft.groupRefused')} rows={result.refused} hook="data-idf-draft-group-refused" />}
        </div>
      )}
    </fieldset>
  )
}

/** Edits a group add refused or a rebase dropped: the item, (for a rebase) the edit, the rule's word and the message. */
function ProblemsTable({ caption, rows, withEdit = false, hook }: { caption: string; rows: IdfDraftProblem[]; withEdit?: boolean; hook: string }) {
  const { t } = useTranslation('insurance-idf')
  return (
    <table className="w-full text-sm" {...{ [hook]: '' }}>
      <caption className="pb-1 text-start text-xs font-medium text-muted-foreground">{caption}</caption>
      <thead>
        <tr>
          <th className={TH}>{t('draft.item')}</th>
          {withEdit && <th className={TH}>{t('draft.editColumn')}</th>}
          <th className={TH}>{t('draft.rule')}</th>
          <th className={TH}>{t('draft.message')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.itemNumber}-${r.edit}`} data-item={r.itemNumber} data-edit={r.edit} data-rule={r.rule} className="border-t border-border/60">
            <td className={TD} data-col="item">
              <Ltr>{r.itemNumber}</Ltr>
            </td>
            {withEdit && (
              <td className={TD} data-col="edit">
                {r.edit === 'add' || r.edit === 'reRank' ? t(`draft.edit.${r.edit}`) : <Ltr>{r.edit}</Ltr>}
              </td>
            )}
            <td className={TD} data-col="rule">
              {r.wordKey ? t(r.wordKey) : <Ltr>{r.rule}</Ltr>}
            </td>
            <td className={TD} data-col="message">
              <bdi>{r.message}</bdi>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
    onSuccess: (v) => {
      // The answer may come back without a body: the version's number is then left out of the toast.
      notify.success(t('draft.published'), v ? t('draft.publishedDetail', { n: fsi(formatFigure(v.number)) }) : undefined)
      setNote('')
    },
    // Every IDF read, whatever the answer: the master's live version, the versions list, the entries and the draft.
    onSettled: () => queryClient.invalidateQueries({ queryKey: IDF_KEY }),
  })
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3" data-idf-draft-publish-step="">
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('draft.note')} className="min-w-64 flex-1">
          <Input value={note} placeholder={t('draft.notePlaceholder')} data-idf-draft-note="" onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Button variant="primary" data-idf-draft-publish="" disabled={note.trim() === '' || publish.isPending || draft.isStale || draft.rows.length === 0} onClick={() => publish.mutate()}>
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

function DiscardDialog({ masterId, owner, onClose }: { masterId: string; owner?: IdfDraft; onClose: () => void }) {
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
      title={t(owner ? 'draft.discardOtherTitle' : 'draft.discardTitle')}
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
      <div className="flex flex-col gap-3" data-idf-draft-discard-dialog={owner ? 'someone-else' : ''}>
        {owner ? (
          // 646 · someone else's work: say whose, and since when
          <p className="text-sm">
            <Trans t={t} i18nKey="draft.discardOtherHint" values={{ by: owner.by, since: formatDateTime(owner.startedAt) }} components={{ b: <bdi />, v: <Ltr /> }} />
          </p>
        ) : (
          <p className="text-sm">{t('draft.discardHint')}</p>
        )}
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
  const value = wholePriority(priority)
  const valid = value !== null
  const reRank = useMutation({
    mutationFn: () => idfDraftApi.reRank(masterId, row.itemNumber, value!),
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
