import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Loader2, Plus, Trash2 } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import type { KeyedList, KeyedListKind } from '@/core/insurance-rules/registry'
import { keyedListsKey, keyedListsQuery } from '@/core/insurance-rules/registry-api'
import { REASON_MAX, reasonField } from '@/core/reason/reason'
import { notify } from '@/core/services/notify'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { localToday } from '@/core/util/date-window'
import { entriesQuery, keyedListKey, listsApi, logQuery } from './api'
import { entryBody, entryProblems, type EntryForm } from './entry-form'
import { CARD } from './ui'
import { DeniedCard, Loading } from '@/core/insurance-rules/parts'

const BLANK: EntryForm = { key: '', reason: '', expiresOn: '' }

/**
 * The Patients / Policies tab (ticket 610; BackOffice 3133): the lists of one kind (`?list=` picks one), the
 * picked list's entries — the key (National ID / Iqama, or SubscriberId), who added it, why, until when — an
 * add form, Remove, and the list's change log. No approval: an author edits, and every change is logged.
 */
export default function KeyedLists({ kind }: { kind: KeyedListKind }) {
  const { t } = useTranslation('insurance-lists')
  const [params, setParams] = useSearchParams()
  const lists = useQuery(keyedListsQuery(kind))
  const [creating, setCreating] = useState(false)

  if (lists.isError && isBareDenial(lists.error)) return <DeniedCard ns="insurance-lists" hook="keyed-denied" />
  if (lists.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(lists.error, t('keyed.failed'))} />
  if (!lists.data) return <Loading text={t('keyed.loading')} />

  const pick = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('list', id)
    setParams(next, { replace: true })
  }
  const create = (
    <>
      <Button variant="primary" className="mb-3" onClick={() => setCreating(true)} data-keyed-new={kind}>
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {t('keyed.newList')}
      </Button>
      <NewListDialog kind={kind} open={creating} onClose={() => setCreating(false)} onCreated={pick} />
    </>
  )
  if (lists.data.length === 0)
    return (
      <div className="flex flex-col items-center py-6" data-keyed-lists={kind}>
        <p className="mb-3 text-sm text-muted-foreground">{t(`keyed.${kind}.none`)}</p>
        <p className="mb-3 max-w-xl text-center text-xs text-muted-foreground">{t(`keyed.${kind}.lede`)}</p>
        {create}
      </div>
    )

  const picked = lists.data.find((l) => l.id === params.get('list')) ?? lists.data[0]
  return (
    <div className="flex flex-col gap-4 md:flex-row" data-keyed-lists={kind}>
      <aside className="w-full shrink-0 md:w-64">
        {create}
        <p className="mb-2 text-xs text-muted-foreground">{t(`keyed.${kind}.lede`)}</p>
        <ul className="flex flex-col gap-1">
          {lists.data.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                aria-current={l.id === picked.id}
                onClick={() => pick(l.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-sm ${l.id === picked.id ? 'bg-primary-050 text-primary-800' : 'hover:bg-accent'}`}
                data-keyed-pick={l.id}
              >
                <bdi>{l.name.en}</bdi>
                <span className="text-xs text-muted-foreground">
                  <Ltr>{l.entries}</Ltr>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <KeyedListPanel key={picked.id} kind={kind} list={picked} />
    </div>
  )
}

function KeyedListPanel({ kind, list }: { kind: KeyedListKind; list: KeyedList }) {
  const { t, i18n } = useTranslation('insurance-lists')
  const qc = useQueryClient()
  const entries = useQuery(entriesQuery(kind, list.id))
  const log = useQuery(logQuery(kind, list.id))
  const [form, setForm] = useState<EntryForm>(BLANK)
  const [tried, setTried] = useState(false)
  const listed = (entries.data ?? []).map((e) => e.key)
  const problems = entryProblems(form, kind, listed, localToday())

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: keyedListKey(kind, list.id) }), qc.invalidateQueries({ queryKey: keyedListsKey(kind), exact: true })])
  const add = useMutation({
    mutationFn: () => listsApi.addEntry(kind, list.id, entryBody(form)),
    onSuccess: () => {
      notify.success(t('keyed.added'), fsi(form.key.trim()))
      setForm(BLANK)
      setTried(false)
      return refresh()
    },
    onError: (err) => notify.apiError(t('keyed.addFailed'), err, isBareDenial(err) ? t('access.deniedHint') : t('keyed.addFailed')),
  })
  // HQ takes a reason on a removal too (3133: `DELETE …/Entries { key, reason }`), so Remove asks for one.
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeReason, setRemoveReason] = useState('')
  const remove = useMutation({
    mutationFn: ({ key, reason }: { key: string; reason: string }) => listsApi.removeEntry(kind, list.id, key, reason),
    onSuccess: (_d, { key }) => {
      notify.success(t('keyed.removed'), fsi(key))
      setRemoving(null)
      return refresh()
    },
    onError: (err) => notify.apiError(t('keyed.removeFailed'), err, isBareDenial(err) ? t('access.deniedHint') : t('keyed.removeFailed')),
  })
  const submit = () => {
    setTried(true)
    if (problems.length === 0 && !add.isPending) add.mutate()
  }
  const askRemove = (key: string) => {
    setRemoveReason('')
    setRemoving(key)
  }
  const removeCheck = reasonField(removeReason)
  const confirmRemove = () => {
    if (removing && removeCheck.problem === null && !remove.isPending) remove.mutate({ key: removing, reason: removeReason.trim() })
  }
  const shown = tried ? problems : []

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4" data-keyed-panel={list.id}>
      <header>
        <h2 className="text-base font-semibold tracking-tight">
          <bdi>{list.name.en}</bdi>{' '}
          <bdi dir="rtl" lang="ar" className="text-sm font-normal text-muted-foreground">
            {list.name.ar}
          </bdi>
        </h2>
      </header>

      <form
        className={`${CARD} grid gap-3 md:grid-cols-[1fr_2fr_auto_auto] md:items-end`}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        data-entry-form=""
      >
        <Field label={t(`keyed.${kind}.key`)}>
          <Input dir="ltr" inputMode={kind === 'patient' ? 'numeric' : 'text'} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} data-entry-key="" />
        </Field>
        <Field label={t('keyed.reason')}>
          <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-entry-reason="" />
        </Field>
        <Field label={t('keyed.expiresOn')}>
          <Input type="date" value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} data-entry-expires="" />
        </Field>
        <Button type="submit" variant="primary" aria-disabled={add.isPending} data-entry-add="">
          {add.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {t('keyed.add')}
        </Button>
        {shown.length > 0 && (
          <ul className="text-xs text-danger-800 md:col-span-4" role="alert" data-entry-problems="">
            {shown.map((p) => (
              <li key={p} data-problem={p}>
                {t(`entryProblem.${p}`)}
              </li>
            ))}
          </ul>
        )}
      </form>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">{t('keyed.entries')}</h3>
        {entries.isError ? (
          <ErrorBanner className="p-2" message={apiErrorMessage(entries.error, t('keyed.failed'))} />
        ) : !entries.data ? (
          <Loading text={t('keyed.loading')} />
        ) : entries.data.length === 0 ? (
          <p className="rounded-md border border-border/60 py-4 text-center text-sm text-muted-foreground" data-entries-empty="">
            {t('keyed.noEntry')}
          </p>
        ) : (
          <table className="w-full text-sm" data-entries="">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-1 text-start font-medium">{t(`keyed.${kind}.key`)}</th>
                <th className="py-1 text-start font-medium">{t('keyed.addedBy')}</th>
                <th className="py-1 text-start font-medium">{t('keyed.reason')}</th>
                <th className="py-1 text-start font-medium">{t('keyed.expiresOn')}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {entries.data.map((e) => (
                <tr key={e.key} className="border-t border-border/60" data-entry={e.key}>
                  <td className="py-1.5 font-mono">
                    <Ltr>{e.key}</Ltr>
                  </td>
                  <td className="py-1.5">
                    <Ltr>{e.addedBy}</Ltr>
                  </td>
                  <td className="py-1.5">
                    <bdi>{e.reason}</bdi>
                  </td>
                  <td className="py-1.5" data-entry-expiry="">
                    {e.expiresOn ? <Ltr>{formatDay(e.expiresOn)}</Ltr> : <span className="text-muted-foreground">{t('keyed.noExpiry')}</span>}
                    {e.expired && (
                      <span className="ms-2 rounded-full bg-attention-050 px-2 py-0.5 text-xs text-attention-800" data-entry-expired="">
                        {t('keyed.expired')}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-end">
                    <IconButton variant="danger" label={t('keyed.removeLabel', { key: fsi(e.key) })} onClick={() => askRemove(e.key)} data-entry-remove={e.key}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2" data-keyed-log="">
        <h3 className="text-sm font-semibold">{t('keyed.log')}</h3>
        {log.isError ? (
          <ErrorBanner className="p-2" message={apiErrorMessage(log.error, t('keyed.logFailed'))} />
        ) : !log.data ? (
          <Loading text={t('keyed.loading')} />
        ) : log.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('keyed.noLog')}</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {log.data.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-border/60 py-1" data-log-row={r.action}>
                <span className="text-xs text-muted-foreground">
                  <Ltr>{formatDateTime(r.at)}</Ltr>
                </span>
                <span>{t(`logAction.${r.action}`)}</span>
                {r.key && (
                  <span className="font-mono" data-log-key="">
                    <Ltr>{r.key}</Ltr>
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {t('keyed.by')} <Ltr>{r.by}</Ltr>
                </span>
                {r.reason && (
                  <span className="text-muted-foreground">
                    <bdi>{r.reason}</bdi>
                  </span>
                )}
                {r.expiresOn && (
                  <span className="text-xs text-muted-foreground">
                    {t('keyed.until')} <Ltr>{formatDay(r.expiresOn)}</Ltr>
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <Modal
        open={removing !== null}
        onClose={() => !remove.isPending && setRemoving(null)}
        title={t('keyed.removeTitle')}
        footer={
          <>
            <Button variant="text" onClick={() => setRemoving(null)} disabled={remove.isPending} data-remove-cancel="">
              {t('editor.cancel')}
            </Button>
            <Button variant="danger" aria-disabled={removeCheck.problem !== null || remove.isPending} onClick={confirmRemove} data-remove-confirm="">
              {remove.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {t('keyed.remove')}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm">{removing && t('keyed.removeConfirm', { key: fsi(removing), list: fsi(saysIn(list.name, i18n.language)) })}</p>
        <Field label={t('keyed.reason')}>
          <Input value={removeReason} maxLength={REASON_MAX} onChange={(e) => setRemoveReason(e.target.value)} data-remove-reason="" />
        </Field>
      </Modal>
    </div>
  )
}

const LIST_ID = /^[A-Za-z0-9._-]{1,40}$/

/** `POST InsuranceRules/{Patient|Policy}Lists { id, name: { en, ar }, reason }` (3133): a new, empty list. */
function NewListDialog({ kind, open, onClose, onCreated }: { kind: KeyedListKind; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation('insurance-lists')
  const qc = useQueryClient()
  const [form, setForm] = useState({ id: '', en: '', ar: '', reason: '' })
  const id = form.id.trim()
  const ready = LIST_ID.test(id) && form.en.trim() !== '' && form.ar.trim() !== '' && reasonField(form.reason).problem === null
  const create = useMutation({
    mutationFn: () => listsApi.createList(kind, { id, name: { en: form.en.trim(), ar: form.ar.trim() }, reason: form.reason.trim() }),
    onSuccess: async () => {
      notify.success(t('keyed.created'), fsi(id))
      await qc.invalidateQueries({ queryKey: keyedListsKey(kind), exact: true })
      onCreated(id)
      close()
    },
  })
  function close() {
    setForm({ id: '', en: '', ar: '', reason: '' })
    create.reset()
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={() => !create.isPending && close()}
      title={t(`keyed.${kind}.newTitle`)}
      footer={
        <>
          <Button variant="text" onClick={close} disabled={create.isPending} data-newlist-cancel="">
            {t('editor.cancel')}
          </Button>
          <Button variant="primary" aria-disabled={!ready || create.isPending} onClick={() => ready && !create.isPending && create.mutate()} data-newlist-create="">
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {t('keyed.create')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-newlist={kind}>
        <Field label={t('editor.id')} hint={t('keyed.idHint')}>
          <Input dir="ltr" maxLength={40} value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} data-newlist-id="" />
        </Field>
        <Field label={t('editor.nameEn')}>
          <Input lang="en" dir="ltr" value={form.en} onChange={(e) => setForm({ ...form, en: e.target.value })} data-newlist-en="" />
        </Field>
        <Field label={t('editor.nameAr')}>
          <Input lang="ar" dir="rtl" value={form.ar} onChange={(e) => setForm({ ...form, ar: e.target.value })} data-newlist-ar="" />
        </Field>
        <Field label={t('keyed.reason')}>
          <Input value={form.reason} maxLength={REASON_MAX} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-newlist-reason="" />
        </Field>
        {create.isError && (
          <ErrorBanner
            className="p-2"
            message={apiErrorCode(create.error) === 'INSLISTS_EXISTS' ? t('keyed.idTaken') : apiErrorMessage(create.error, isBareDenial(create.error) ? t('access.deniedHint') : t('keyed.createFailed'))}
          />
        )}
      </div>
    </Modal>
  )
}
