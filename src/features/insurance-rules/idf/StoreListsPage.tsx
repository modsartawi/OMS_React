import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

import { apiErrorCode, apiErrorData, apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { DeniedCard, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'
import { IDF_STORE_LISTS_KEY, idfStoreListsApi, storeListsQuery } from './api'
import { badStoreCodes, scopeClash } from './master-form'
import { masterName } from './masters'
import {
  addStores,
  createListProblems,
  removeStore,
  sameStoreSet,
  STORE_LIST_CODE_MAX,
  storeListName,
  type IdfStoreList,
  type IdfStoreListCreateBody,
  type IdfStoreListRenameBody,
} from './store-lists'

/**
 * Insurance rules ▸ IDF store lists — `/insurance-rules/idf/store-lists` (BackOffice spec 3157, door 3162; oms
 * ticket 620). The named store lists a store master or a scoped insurer master points at (the operation
 * pharmacies, the pilot rollout list), each with its code and store count. Create a list (code + EN + AR names),
 * rename it (both names; the code never changes), open it to add or remove stores — saved as the whole set. The
 * pilot list (`isPilotList`, listed first) is marked "Pilot". There is no delete (3162 builds no delete door).
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

/**
 * A write's refusal: the server's message and, when it sent one, its code. An unknown store (`IDF-00016`) names the
 * codes; an overlap (`IDF-00015`) names the clashing master and the stores both cover. A bare 403 says "no access".
 */
function Refusal({ err }: { err: unknown }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const code = apiErrorCode(err)
  const data = apiErrorData(err)
  const bad = badStoreCodes(data)
  const clash = scopeClash(data)
  return (
    <div data-idf-store-lists-refusal={code ?? ''}>
      <ErrorBanner className="p-3" title={t('storeLists.refused')} message={isBareDenial(err) ? t('access.deniedTitle') : apiErrorMessage(err, t('storeLists.refusedFallback'))}>
        {bad.length > 0 && (
          <div className="mt-1 text-xs" data-bad-store-codes="">
            <Trans t={t} i18nKey="storeLists.badStores" values={{ codes: bad.join(', ') }} components={{ v: <Ltr /> }} />
          </div>
        )}
        {clash && (
          <div className="mt-1 text-xs" data-clashing-master={clash.clashingMasterId}>
            <Trans
              t={t}
              i18nKey="storeLists.clashesWith"
              values={{ name: masterName({ nameEn: clash.clashingNameEn, nameAr: clash.clashingNameAr }, i18n.language) || clash.clashingMasterId, id: clash.clashingMasterId }}
              components={{ n: <bdi />, v: <Ltr /> }}
            />
            {clash.sharedStores.length > 0 && (
              <div data-shared-stores="">
                <Trans t={t} i18nKey="storeLists.sharedStores" values={{ stores: clash.sharedStores.join(', ') }} components={{ v: <Ltr /> }} />
              </div>
            )}
          </div>
        )}
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

const EMPTY_CREATE: IdfStoreListCreateBody = { code: '', nameEn: '', nameAr: '' }

/** A new list: its code (plain ASCII, at most 26, never changes) and both names (3162). It starts with no stores. */
function CreateList({ onRefused }: { onRefused: OnRefused }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const [draft, setDraft] = useState<IdfStoreListCreateBody>(EMPTY_CREATE)
  const [tried, setTried] = useState(false)
  const problems = createListProblems(draft)
  const create = useListWrite((b: IdfStoreListCreateBody) => idfStoreListsApi.create(b), onRefused, (_r, b) => {
    notify.success(t('storeLists.create.done'), fsi(storeListName(b, i18n.language)))
    setDraft(EMPTY_CREATE)
    setTried(false)
  })
  const set = (k: keyof IdfStoreListCreateBody) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }))
  const problem = (p: string | undefined) =>
    tried && p ? (
      <span role="alert" data-problem={p}>
        {t(`storeLists.problem.${p}`)}
      </span>
    ) : undefined
  return (
    <form
      className="flex flex-wrap items-start gap-2"
      data-idf-store-list-create=""
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (Object.keys(problems).length === 0 && !create.isPending)
          create.mutate({ code: draft.code.trim(), nameEn: draft.nameEn.trim(), nameAr: draft.nameAr.trim() })
      }}
    >
      <Field label={t('storeLists.create.code')} error={problem(problems.code)}>
        <Input className="w-44" dir="ltr" maxLength={STORE_LIST_CODE_MAX} value={draft.code} onChange={set('code')} placeholder={t('storeLists.create.codePlaceholder')} data-create-code="" />
      </Field>
      <Field label={t('storeLists.create.nameEn')} error={problem(problems.nameEn)}>
        <Input className="w-56" dir="ltr" value={draft.nameEn} onChange={set('nameEn')} data-create-name-en="" />
      </Field>
      <Field label={t('storeLists.create.nameAr')} error={problem(problems.nameAr)}>
        <Input className="w-56" dir="rtl" lang="ar" value={draft.nameAr} onChange={set('nameAr')} data-create-name-ar="" />
      </Field>
      <Button type="submit" variant="primary" className="mt-5" disabled={create.isPending} data-create-submit="">
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
            <th className={TH}>{t('storeLists.columns.code')}</th>
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

/** One list. Rename changes both names together (the code never changes); 3162 has no delete door. */
function ListRow({ list, isOpen, onOpen, onRefused }: { list: IdfStoreList; isOpen: boolean; onOpen: (id: string | null) => void; onRefused: OnRefused }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const [renaming, setRenaming] = useState<IdfStoreListRenameBody | null>(null)
  const rename = useListWrite((b: IdfStoreListRenameBody) => idfStoreListsApi.rename(list.storeListId, b), onRefused, (_r, b) => {
    notify.success(t('storeLists.rename.done'), fsi(storeListName({ ...b, code: list.code }, i18n.language)))
    setRenaming(null)
  })
  const pilot = !!list.isPilotList
  const name = storeListName(list, i18n.language)
  const canRename = renaming != null && renaming.nameEn.trim() !== '' && renaming.nameAr.trim() !== ''
  return (
    <tr className={`border-t border-border/60 ${isOpen ? 'bg-accent/40' : ''}`} data-store-list={list.storeListId} data-pilot={pilot || undefined}>
      <td className={`${TD} font-medium`} data-col="name">
        {renaming != null ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (canRename && !rename.isPending) rename.mutate({ nameEn: renaming.nameEn.trim(), nameAr: renaming.nameAr.trim() })
            }}
          >
            <Input className="w-52" dir="ltr" value={renaming.nameEn} onChange={(e) => setRenaming((r) => r && { ...r, nameEn: e.target.value })} aria-label={t('storeLists.rename.nameEn')} data-rename-en="" autoFocus />
            <Input className="w-52" dir="rtl" lang="ar" value={renaming.nameAr} onChange={(e) => setRenaming((r) => r && { ...r, nameAr: e.target.value })} aria-label={t('storeLists.rename.nameAr')} data-rename-ar="" />
            <Button type="submit" variant="primary" disabled={!canRename || rename.isPending} data-rename-save="">
              {t('storeLists.rename.save')}
            </Button>
            <Button type="button" variant="text" onClick={() => setRenaming(null)}>
              {t('storeLists.cancel')}
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <bdi>{name}</bdi>
            {pilot && (
              <span data-pilot-mark="">
                <StatusBadge sev="go">{t('storeLists.pilot')}</StatusBadge>
              </span>
            )}
          </div>
        )}
      </td>
      <td className={`${TD} font-mono text-xs`} data-col="code">
        <Ltr>{list.code}</Ltr>
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
            <Button variant="text" onClick={() => setRenaming({ nameEn: list.nameEn ?? '', nameAr: list.nameAr ?? '' })} data-rename={list.storeListId}>
              {t('storeLists.rename.action')}
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

/** One list's stores, edited as a set and saved whole. */
function StoresEditor({ list, onClose, onRefused }: { list: IdfStoreList; onClose: () => void; onRefused: OnRefused }) {
  const { t, i18n } = useTranslation('insurance-idf')
  const name = storeListName(list, i18n.language)
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
    notify.success(t('storeLists.stores.done'), fsi(name))
  })
  const add = () => {
    setSet((s) => addStores(s, typed))
    setTyped('')
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-idf-store-list-editor={list.storeListId}>
      <h2 className="text-sm font-semibold">
        <Trans t={t} i18nKey="storeLists.stores.title" values={{ name }} components={{ n: <bdi /> }} />
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
              <IconButton size="compact" label={t('storeLists.stores.remove', { code: fsi(code) })} onClick={() => setSet((s) => removeStore(s, code))} data-remove={code}>
                <X className="h-3 w-3" aria-hidden />
              </IconButton>
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
        <Field label={t('storeLists.stores.addLabel')}>
          <Input className="w-72" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('storeLists.stores.addPlaceholder')} data-add-input="" />
        </Field>
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
