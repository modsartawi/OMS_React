import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Loader2, Plus, Trash2 } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import type { KeyedList, KeyedListEntry, KeyedListKind } from '@/core/insurance-rules/registry'
import { insurersQuery, keyedListsKey, keyedListsQuery, type Insurer } from '@/core/insurance-rules/registry-api'
import CoreReasonDialog from '@/core/reason/ReasonDialog'
import { notify } from '@/core/services/notify'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { localToday } from '@/core/util/date-window'
import { entriesQuery, keyedListKey, listsApi, logQuery } from './api'
import { entryAction, entryBody, entryIdentity, entryProblems, newListBody, newListProblems, type EntryForm, type NewListForm } from './entry-form'
import { CARD } from './ui'
import { DeniedCard, Loading } from '@/core/insurance-rules/parts'

const BLANK: EntryForm = { key: '', reason: '', expiresOn: '', payer: '' }
const BLANK_LIST: NewListForm = { id: '', en: '', ar: '' }
/** The lists doors' refusal of a missing or bad reason (3133), shown under the reason field. */
const BAD_REQUEST = 'INSLISTS_BAD_REQUEST'
const EXISTS = 'INSLISTS_EXISTS'

const reasonRefusal = (err: unknown, fallback: string): string | null => (apiErrorCode(err) === BAD_REQUEST ? apiErrorMessage(err, fallback) : null)

/** Every write of the keyed lists carries a reason (3133): the shared reason dialog, in this namespace. */
function ReasonDialog(props: Omit<Parameters<typeof CoreReasonDialog>[0], 'ns' | 'reasonRefusal'>) {
  return <CoreReasonDialog {...props} ns="insurance-lists" reasonRefusal={reasonRefusal} />
}

/** "payer · name" for an insurer the list names; the payer alone when it has no name (3144's rows carry none). */
function insurerText(payer: string, insurers: readonly Insurer[], lang: string): string {
  const name = insurers.find((i) => i.payer === payer)?.name
  return name ? formatPair(payer, saysIn(name, lang)) : payer
}

/**
 * The Patients / Policies / Classes tab (ticket 610; BackOffice 3133 + 3172): the lists of one kind (`?list=`
 * picks one) and a new one, the picked list's entries — the key (National ID / Iqama, SubscriberId, or policy
 * class with the insurer it counts for), who added it, why, until when, expired or not — an add form, Remove, and
 * the list's change log. No approval: an author edits, every change carries a reason and is logged.
 */
export default function KeyedLists({ kind }: { kind: KeyedListKind }) {
  const { t } = useTranslation('insurance-lists')
  const [params, setParams] = useSearchParams()
  const lists = useQuery(keyedListsQuery(kind))
  const [creating, setCreating] = useState(false)

  if (lists.isError && isBareDenial(lists.error)) return <DeniedCard ns="insurance-lists" hook="keyed-denied" />
  if (lists.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(lists.error, t('keyed.failed'))} />
  if (!lists.data) return <Loading text={t('keyed.loading')} />

  const picked = lists.data.find((l) => l.id === params.get('list')) ?? lists.data[0]
  const pick = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('list', id)
    setParams(next, { replace: true })
  }
  return (
    <div className="flex flex-col gap-4 md:flex-row" data-keyed-lists={kind}>
      <aside className="w-full shrink-0 md:w-64">
        <p className="mb-2 text-xs text-muted-foreground">{t(`keyed.${kind}.lede`)}</p>
        {lists.data.length === 0 && <p className="py-2 text-sm text-muted-foreground">{t(`keyed.${kind}.none`)}</p>}
        <ul className="flex flex-col gap-1">
          {lists.data.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                aria-current={l.id === picked?.id}
                onClick={() => pick(l.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-sm ${l.id === picked?.id ? 'bg-primary-050 text-primary-800' : 'hover:bg-accent'}`}
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
        <Button variant="text" className="mt-2" onClick={() => setCreating(true)} data-keyed-new="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('keyed.newList')}
        </Button>
      </aside>
      {picked && <KeyedListPanel key={picked.id} kind={kind} list={picked} />}
      <NewListDialog kind={kind} open={creating} taken={lists.data.map((l) => l.id)} onClose={() => setCreating(false)} onCreated={pick} />
    </div>
  )
}

/** `POST …Lists { id, name, reason }` — a new list of this kind, named in both languages. */
function NewListDialog({ kind, open, taken, onClose, onCreated }: { kind: KeyedListKind; open: boolean; taken: string[]; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation('insurance-lists')
  const qc = useQueryClient()
  const [form, setForm] = useState<NewListForm>(BLANK_LIST)
  const problems = newListProblems(form, taken)
  const create = useMutation({
    mutationFn: (reason: string) => listsApi.createList(kind, newListBody(form, reason)),
    onSuccess: async (_d) => {
      const id = form.id.trim()
      notify.success(t('keyed.created'), fsi(id))
      await qc.invalidateQueries({ queryKey: keyedListsKey(kind), exact: true })
      setForm(BLANK_LIST)
      onCreated(id)
      onClose()
    },
  })
  const taken409 = apiErrorCode(create.error) === EXISTS
  const shown = form.id || form.en || form.ar ? problems : []
  return (
    <ReasonDialog
      open={open}
      title={t(`keyed.${kind}.newTitle`)}
      busy={create.isPending}
      error={create.error}
      handledCodes={[EXISTS]}
      confirmLabel={t('keyed.create')}
      confirmDisabled={problems.length > 0}
      onEdit={() => create.reset()}
      onConfirm={(reason) => create.mutate(reason)}
      onClose={() => {
        create.reset()
        onClose()
      }}
    >
      <div className="grid gap-3" data-new-list="">
        <Field label={t('keyed.listId')} hint={t('keyed.listIdHint')}>
          <Input dir="ltr" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} data-new-list-id="" />
        </Field>
        <Field label={t('editor.nameEn')}>
          <Input value={form.en} onChange={(e) => setForm({ ...form, en: e.target.value })} data-new-list-en="" />
        </Field>
        <Field label={t('editor.nameAr')}>
          <Input dir="rtl" lang="ar" value={form.ar} onChange={(e) => setForm({ ...form, ar: e.target.value })} data-new-list-ar="" />
        </Field>
        {(shown.length > 0 || taken409) && (
          <ul className="text-xs text-danger-800" role="alert">
            {(taken409 && !shown.includes('idTaken') ? [...shown, 'idTaken' as const] : shown).map((p) => (
              <li key={p} data-problem={p}>
                {t(`listProblem.${p}`)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </ReasonDialog>
  )
}

function KeyedListPanel({ kind, list }: { kind: KeyedListKind; list: KeyedList }) {
  const { t, i18n } = useTranslation('insurance-lists')
  const qc = useQueryClient()
  const entries = useQuery(entriesQuery(kind, list.id))
  const log = useQuery(logQuery(kind, list.id))
  const insurers = useQuery({ ...insurersQuery(), enabled: kind === 'class' }).data ?? []
  const [form, setForm] = useState<EntryForm>(BLANK)
  const [tried, setTried] = useState(false)
  const [removing, setRemoving] = useState<KeyedListEntry | null>(null)
  const listed = (entries.data ?? []).map((e) => entryIdentity(e.key, e.payer))
  const problems = entryProblems(form, kind, localToday())
  // A key (+ insurer) already on the list is a CHANGE: HQ replaces its reason and expiry and logs `change`.
  const action = entryAction(form, kind, listed)
  const isClass = kind === 'class'
  const lang = i18n.language

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: keyedListKey(kind, list.id) }), qc.invalidateQueries({ queryKey: keyedListsKey(kind), exact: true })])
  const add = useMutation({
    mutationFn: (_action: 'add' | 'change') => listsApi.addEntry(kind, list.id, entryBody(form, kind)),
    onSuccess: (entry, done) => {
      notify.success(t(done === 'change' ? 'keyed.changed' : 'keyed.added'), fsi(entry?.key ?? entryBody(form, kind).key))
      setForm(BLANK)
      setTried(false)
      return refresh()
    },
    onError: (err, done) => {
      const failed = t(done === 'change' ? 'keyed.changeFailed' : 'keyed.addFailed')
      notify.apiError(failed, err, isBareDenial(err) ? t('access.deniedHint') : failed)
    },
  })
  const remove = useMutation({
    mutationFn: ({ entry, reason }: { entry: KeyedListEntry; reason: string }) => listsApi.removeEntry(kind, list.id, entry, reason),
    onSuccess: (_d, { entry }) => {
      notify.success(t('keyed.removed'), fsi(entry.key))
      setRemoving(null)
      return refresh()
    },
  })
  const submit = () => {
    setTried(true)
    if (problems.length === 0 && !add.isPending) add.mutate(action)
  }
  const shown = tried ? problems : []
  const forOne = (entries.data ?? []).filter((e) => !!e.payer).length
  const forAny = (entries.data ?? []).length - forOne
  const cols = isClass ? 'md:grid-cols-[1fr_1fr_2fr_auto_auto]' : 'md:grid-cols-[1fr_2fr_auto_auto]'

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
        className={`${CARD} grid gap-3 ${cols} md:items-end`}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        data-entry-form=""
      >
        <Field label={t(`keyed.${kind}.key`)}>
          <Input dir="ltr" inputMode={kind === 'patient' ? 'numeric' : 'text'} value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} data-entry-key="" />
        </Field>
        {isClass && (
          <Field label={t('keyed.insurer')}>
            <Select value={form.payer ?? ''} onChange={(e) => setForm({ ...form, payer: e.target.value })} data-entry-payer="">
              <option value="">{t('keyed.anyInsurer')}</option>
              {insurers.map((ins) => (
                <option key={ins.payer} value={ins.payer}>
                  {fsi(insurerText(ins.payer, insurers, lang))}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t('keyed.reason')}>
          <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-entry-reason="" />
        </Field>
        <Field label={t('keyed.expiresOn')}>
          <Input type="date" value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} data-entry-expires="" />
        </Field>
        <Button type="submit" variant="primary" aria-disabled={add.isPending} data-entry-add={action}>
          {add.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {t(action === 'change' ? 'keyed.change' : 'keyed.add')}
        </Button>
        {action === 'change' && (
          <p className={`text-xs text-attention-800 ${isClass ? 'md:col-span-5' : 'md:col-span-4'}`} data-entry-change="">
            {t('keyed.changeHint')}
          </p>
        )}
        {shown.length > 0 && (
          <ul className={`text-xs text-danger-800 ${isClass ? 'md:col-span-5' : 'md:col-span-4'}`} role="alert" data-entry-problems="">
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
        {isClass && entries.data && entries.data.length > 0 && (
          <p className="text-xs text-muted-foreground" data-class-split={`${forOne}/${forAny}`}>
            {t('keyed.class.split', { forOne: fsi(forOne), forAny: fsi(forAny) })}
          </p>
        )}
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
                {isClass && <th className="py-1 text-start font-medium">{t('keyed.insurer')}</th>}
                <th className="py-1 text-start font-medium">{t('keyed.addedBy')}</th>
                <th className="py-1 text-start font-medium">{t('keyed.reason')}</th>
                <th className="py-1 text-start font-medium">{t('keyed.expiresOn')}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {entries.data.map((e) => {
                const id = entryIdentity(e.key, e.payer)
                return (
                  <tr key={id} className={`border-t border-border/60 ${e.expired ? 'text-muted-foreground' : ''}`} data-entry={isClass ? id : e.key} data-expired={e.expired ? 'true' : 'false'}>
                    <td className="py-1.5 font-mono">
                      <Ltr>{e.key}</Ltr>
                    </td>
                    {isClass && (
                      <td className="py-1.5" data-entry-insurer={e.payer ?? ''}>
                        {e.payer ? <Ltr>{insurerText(e.payer, insurers, lang)}</Ltr> : <span className="text-muted-foreground">{t('keyed.anyInsurer')}</span>}
                      </td>
                    )}
                    <td className="py-1.5">
                      <Ltr>{e.addedBy}</Ltr>
                    </td>
                    <td className="py-1.5">
                      <bdi>{e.reason}</bdi>
                    </td>
                    <td className="py-1.5" data-entry-expiry="">
                      <span className="inline-flex items-center gap-2">
                        {e.expiresOn ? <Ltr>{formatDay(e.expiresOn)}</Ltr> : <span className="text-muted-foreground">{t('keyed.noExpiry')}</span>}
                        {e.expired && (
                          <span data-entry-expired="">
                            <StatusBadge sev="mute">{t('keyed.expired')}</StatusBadge>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-1.5 text-end">
                      <IconButton variant="danger" label={t('keyed.removeLabel', { key: fsi(e.key) })} onClick={() => setRemoving(e)} data-entry-remove={isClass ? id : e.key}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </IconButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <ReasonDialog
        open={removing !== null}
        title={t('keyed.removeTitle')}
        note={removing ? t('keyed.removeConfirm', { key: fsi(removing.key), list: fsi(saysIn(list.name, lang)) }) : undefined}
        busy={remove.isPending}
        error={remove.error}
        danger
        confirmLabel={t('keyed.remove')}
        onEdit={() => remove.reset()}
        onConfirm={(reason) => removing && remove.mutate({ entry: removing, reason })}
        onClose={() => {
          remove.reset()
          setRemoving(null)
        }}
      />

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
                {isClass && r.key && (
                  <span className="text-xs text-muted-foreground" data-log-insurer={r.payer ?? ''}>
                    {r.payer ? <Ltr>{insurerText(r.payer, insurers, lang)}</Ltr> : t('keyed.anyInsurer')}
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
    </div>
  )
}
