import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { DeniedCard, FORM_INPUT, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'
import { IDF_STORE_LISTS_KEY, idfStoreListsApi, storeListsQuery } from './api'
import { addStores, removeStore, sameStoreSet, type IdfStoreList } from './store-lists'

/**
 * Insurance rules ▸ IDF store lists — `/insurance-rules/idf/store-lists` (BackOffice spec 3157, door 3162; oms
 * ticket 620). The named store lists a store master or a scoped insurer master points at (the operation
 * pharmacies, the pilot rollout list), each with its store count. Create a list, rename it, open it to add or
 * remove stores — saved as the whole set — and delete it, except the pilot list (`isPilotList`), which is marked
 * "Pilot" and offers no delete.
 *
 * A refusal (`success:false`) shows its message and its code above the lists; a bare 403 on the read is "You do
 * not have access". 🚩 UNGATED until 628.
 */
export default function StoreListsPage() {
  const { t } = useTranslation('insurance-idf')
  const lists = useQuery(storeListsQuery())
  const [refusal, setRefusal] = useState<unknown>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const open = lists.data?.find((l) => l.storeListId === openId) ?? null

  return (
    <section className="flex h-full w-full max-w-5xl flex-col gap-4" data-idf-store-lists-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('storeLists.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('storeLists.lede')}</p>
      </header>
      {lists.isError && isBareDenial(lists.error) ? (
        <DeniedCard ns="insurance-idf" hook="idf-store-lists-denied" />
      ) : lists.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(lists.error, t('storeLists.failed'))} />
      ) : !lists.data ? (
        <Loading text={t('storeLists.loading')} />
      ) : (
        <>
          {refusal != null && <Refusal err={refusal} />}
          <CreateList onRefused={setRefusal} />
          {lists.data.length === 0 ? (
            <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-idf-store-lists-empty="">
              {t('storeLists.empty')}
            </p>
          ) : (
            <ListsTable lists={lists.data} openId={openId} onOpen={setOpenId} onRefused={setRefusal} />
          )}
          {open && <StoresEditor key={open.storeListId} list={open} onClose={() => setOpenId(null)} onRefused={setRefusal} />}
        </>
      )}
    </section>
  )
}

/** A write's refusal: the server's message and, when it sent one, its code. A bare 403 says "no access". */
function Refusal({ err }: { err: unknown }) {
  const { t } = useTranslation('insurance-idf')
  const code = apiErrorCode(err)
  return (
    <div data-idf-store-lists-refusal={code ?? ''}>
      <ErrorBanner className="p-3" title={t('storeLists.refused')} message={isBareDenial(err) ? t('access.deniedTitle') : apiErrorMessage(err, t('storeLists.refusedFallback'))}>
        {code && (
          <div className="mt-1 text-xs" data-refusal-code="">
            <Trans t={t} i18nKey="storeLists.refusalCode" values={{ code }} components={{ v: <Ltr /> }} />
          </div>
        )}
      </ErrorBanner>
    </div>
  )
}

type OnRefused = (err: unknown) => void

function useListWrite<A, R>(fn: (a: A) => Promise<R>, onRefused: OnRefused, done: (r: R, a: A) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, a) => {
      onRefused(null)
      done(r, a)
      return qc.invalidateQueries({ queryKey: IDF_STORE_LISTS_KEY })
    },
    onError: (err) => onRefused(err),
  })
}

function CreateList({ onRefused }: { onRefused: OnRefused }) {
  const { t } = useTranslation('insurance-idf')
  const [name, setName] = useState('')
  const create = useListWrite((n: string) => idfStoreListsApi.create(n), onRefused, (_r, n) => {
    notify.success(t('storeLists.create.done'), fsi(n))
    setName('')
  })
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      data-idf-store-list-create=""
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim() && !create.isPending) create.mutate(name.trim())
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('storeLists.create.label')}
        <input className={`${FORM_INPUT} w-72`} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('storeLists.create.placeholder')} data-create-name="" />
      </label>
      <Button type="submit" variant="primary" disabled={!name.trim() || create.isPending} data-create-submit="">
        {t('storeLists.create.action')}
      </Button>
    </form>
  )
}

function ListsTable({ lists, openId, onOpen, onRefused }: { lists: IdfStoreList[]; openId: string | null; onOpen: (id: string | null) => void; onRefused: OnRefused }) {
  const { t } = useTranslation('insurance-idf')
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm" data-idf-store-lists="">
        <thead className="bg-muted/50">
          <tr>
            <th className={TH}>{t('storeLists.columns.name')}</th>
            <th className={TH}>{t('storeLists.columns.id')}</th>
            <th className={`${TH} text-end`}>{t('storeLists.columns.stores')}</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {lists.map((l) => (
            <ListRow key={l.storeListId} list={l} isOpen={l.storeListId === openId} onOpen={onOpen} onRefused={onRefused} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ListRow({ list, isOpen, onOpen, onRefused }: { list: IdfStoreList; isOpen: boolean; onOpen: (id: string | null) => void; onRefused: OnRefused }) {
  const { t } = useTranslation('insurance-idf')
  const [renaming, setRenaming] = useState<string | null>(null)
  const rename = useListWrite((n: string) => idfStoreListsApi.rename(list.storeListId, n), onRefused, (_r, n) => {
    notify.success(t('storeLists.rename.done'), fsi(n))
    setRenaming(null)
  })
  const remove = useListWrite(() => idfStoreListsApi.remove(list.storeListId), onRefused, () => {
    notify.success(t('storeLists.delete.done'), fsi(list.name))
    if (isOpen) onOpen(null)
  })
  const askDelete = async () => {
    if (await confirmAction(t('storeLists.delete.confirm', { name: fsi(list.name) }), t('storeLists.delete.title'))) remove.mutate(undefined)
  }
  const pilot = !!list.isPilotList
  return (
    <tr className={`border-t border-border/60 ${isOpen ? 'bg-accent/40' : ''}`} data-store-list={list.storeListId} data-pilot={pilot || undefined}>
      <td className={`${TD} font-medium`} data-col="name">
        {renaming != null ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (renaming.trim() && !rename.isPending) rename.mutate(renaming.trim())
            }}
          >
            <input className={`${FORM_INPUT} h-8 w-60`} value={renaming} onChange={(e) => setRenaming(e.target.value)} aria-label={t('storeLists.rename.label')} data-rename-input="" autoFocus />
            <Button type="submit" variant="primary" disabled={!renaming.trim() || rename.isPending} data-rename-save="">
              {t('storeLists.rename.save')}
            </Button>
            <Button type="button" variant="text" onClick={() => setRenaming(null)}>
              {t('storeLists.cancel')}
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <bdi>{list.name}</bdi>
            {pilot && (
              <span data-pilot-mark="">
                <StatusBadge sev="go">{t('storeLists.pilot')}</StatusBadge>
              </span>
            )}
          </div>
        )}
      </td>
      <td className={`${TD} font-mono text-xs`} data-col="id">
        <Ltr>{list.storeListId}</Ltr>
      </td>
      <td className={NUM} data-col="stores">
        <Ltr>{formatFigure(list.storeCodes?.length ?? 0)}</Ltr>
      </td>
      <td className={`${TD} text-end`}>
        <div className="flex justify-end gap-1">
          <Button variant="secondary" onClick={() => onOpen(isOpen ? null : list.storeListId)} data-open={list.storeListId}>
            {isOpen ? t('storeLists.close') : t('storeLists.open')}
          </Button>
          {renaming == null && (
            <Button variant="text" onClick={() => setRenaming(list.name)} data-rename={list.storeListId}>
              {t('storeLists.rename.action')}
            </Button>
          )}
          {!pilot && (
            <Button variant="danger-outlined" onClick={askDelete} disabled={remove.isPending} data-delete={list.storeListId}>
              {t('storeLists.delete.action')}
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

/** One list's stores, edited as a set and saved whole. */
function StoresEditor({ list, onClose, onRefused }: { list: IdfStoreList; onClose: () => void; onRefused: OnRefused }) {
  const { t } = useTranslation('insurance-idf')
  // The set as last saved: the list's codes, then the server's answer to each save (re-seeded, so the editor shows
  // what the server kept — its order, its spelling — and nothing reads dirty before the list re-reads).
  const [saved, setSaved] = useState<string[]>(list.storeCodes ?? [])
  const [set, setSet] = useState<string[]>(saved)
  const [typed, setTyped] = useState('')
  const dirty = !sameStoreSet(set, saved)
  const save = useListWrite((codes: string[]) => idfStoreListsApi.saveStores(list.storeListId, codes), onRefused, (r, codes) => {
    const kept = r?.storeCodes ?? codes
    setSaved(kept)
    setSet(kept)
    notify.success(t('storeLists.stores.done'), fsi(list.name))
  })
  const add = () => {
    setSet((s) => addStores(s, typed))
    setTyped('')
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-idf-store-list-editor={list.storeListId}>
      <h2 className="text-sm font-semibold">
        <Trans t={t} i18nKey="storeLists.stores.title" values={{ name: list.name }} components={{ n: <bdi /> }} />
      </h2>
      {set.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-stores-empty="">
          {t('storeLists.stores.empty')}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5" data-stores="">
          {set.map((code) => (
            <li key={code} className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 ps-2.5 pe-1 py-0.5 text-xs" data-store={code}>
              <Ltr>{code}</Ltr>
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setSet((s) => removeStore(s, code))}
                aria-label={t('storeLists.stores.remove', { code: fsi(code) })}
                data-remove={code}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (typed.trim()) add()
        }}
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('storeLists.stores.addLabel')}
          <input className={`${FORM_INPUT} w-72`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('storeLists.stores.addPlaceholder')} data-add-input="" />
        </label>
        <Button type="submit" variant="secondary" disabled={!typed.trim()} data-add="">
          {t('storeLists.stores.add')}
        </Button>
      </form>
      <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
        <Button variant="text" onClick={onClose}>
          {t('storeLists.close')}
        </Button>
        <Button variant="primary" disabled={!dirty || save.isPending} onClick={() => save.mutate(set)} data-save-stores="">
          {t('storeLists.stores.save')}
        </Button>
      </div>
    </section>
  )
}
