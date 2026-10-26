import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Check, ClipboardPaste, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { ServingListAddStoresRequest, ServingListRow, ServingListStoreRow } from '@/core/models/serving-list'
import { servingListName } from '@/core/serving-list/view'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { useDebounced } from '@/core/util/use-debounced'
import { servingListsApi } from './api'
import { addStoresRefusal, isBadCode } from './add-stores-refusal'
import { EMPTY_BASKET, addHits, addPasted, basketBody, inBasket, pickable, removeCodes, toggleHit, type Basket } from './basket'
import { NoteField, useRefreshList } from './WriteDialog'

/** The search door's page: its default, said aloud when the answer fills it. */
const STORE_SEARCH_TAKE = 50
/** The picker's own key (under the feature's prefix); a successful add re-reads it, `onList` having changed. */
const STORES_KEY = ['oms', 'serving-lists', 'stores'] as const

function storesQuery(servingListId: string, search: string) {
  return {
    queryKey: [...STORES_KEY, servingListId, search] as const,
    queryFn: () => servingListsApi.stores({ search, servingListId, take: STORE_SEARCH_TAKE }),
    placeholderData: keepPreviousData,
    retry: false,
  }
}

const FIELD =
  'rounded-md border border-border/60 bg-background px-2 text-sm text-foreground outline-none focus:border-primary/60 disabled:opacity-60'

/**
 * "Add stores" (oms ticket 569; BackOffice spec 3042 stories 31, 41): onboarding a contract's ~500 stores in
 * ONE `POST ServingListWeb/Lists/{id}/Stores`, not 500 clicks.
 *
 * - **Search** `GET ServingListWeb/Stores?search=&servingListId=&take=` (debounced; matches inside the code, name
 *   or city). A store already on the list is checked off and cannot be picked; a closed store can, marked.
 * - **Basket** — picks across several searches plus **pasted codes** (a contract sheet's column), de-duplicated
 *   case-insensitively (`./basket`); a count, and Clear.
 * - **Refusals stay here** (`./add-stores-refusal`): one bad code refuses the whole batch; `SVL-00002` /
 *   `SVL-00003` highlight their codes in the basket with "Remove these and retry".
 *
 * Mounted only while open, so every open starts with an empty basket.
 */
export default function AddStoresDialog({ list, onClose }: { list: ServingListRow; onClose: () => void }) {
  const { t, i18n } = useTranslation('serving-lists')
  const queryClient = useQueryClient()
  const refresh = useRefreshList()
  const id = list.servingListId
  const listName = servingListName(list, i18n.language)

  const [basket, setBasket] = useState<Basket>(EMPTY_BASKET)
  const [note, setNote] = useState('')

  const send = useMutation({
    mutationFn: (body: ServingListAddStoresRequest) => servingListsApi.addStores(id, body),
    onSuccess: (_row, body) => {
      const n = body.storeCodes.length
      toast.success(t('addStores.done', { count: n, n: fsi(formatFigure(n)), list: fsi(listName) }))
      onClose()
      // Lists, this list's Members and Changes (an add logs a change), and the picker's `onList`.
      refresh(id)
      void queryClient.invalidateQueries({ queryKey: [...STORES_KEY, id] })
    },
    onError: (err) => {
      // The list is gone, or a code is already on it: the screen is behind the server.
      const r = addStoresRefusal(err)
      if ((r.kind === 'refused' || r.kind === 'badCodes') && r.stale) {
        refresh(id)
        void queryClient.invalidateQueries({ queryKey: [...STORES_KEY, id] })
      }
    },
  })

  const refusal = send.isError ? addStoresRefusal(send.error) : null
  const badCodes = refusal?.kind === 'badCodes' ? refusal.codes : []
  const busy = send.isPending
  const ready = basket.length > 0 && !busy && refusal?.kind !== 'notGranted'

  const retryWithout = (codes: readonly string[]) => {
    const next = removeCodes(basket, codes)
    setBasket(next)
    if (next.length > 0) send.mutate(basketBody(next, note))
    else send.reset()
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={t('addStores.title', { list: fsi(listName) })}
      width="56rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-add-stores-cancel="">
            {t('addStores.cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} onClick={() => ready && send.mutate(basketBody(basket, note))} data-add-stores-confirm="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('addStores.sending') : t('addStores.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-add-stores-dialog={id}>
        <p className="text-xs text-muted-foreground">{t('addStores.intro')}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <StoreSearch servingListId={id} basket={basket} onBasket={setBasket} disabled={busy} />
          <div className="flex min-w-0 flex-col gap-3">
            <PasteCodes basket={basket} onBasket={setBasket} disabled={busy} />
            <BasketView basket={basket} badCodes={badCodes} onBasket={setBasket} disabled={busy} />
          </div>
        </div>

        <NoteField label={t('addStores.note.label')} value={note} onChange={setNote} disabled={busy} hook="add-stores-note" rows={2} />

        {refusal?.kind === 'notGranted' && (
          <ErrorBanner className="p-2" title={t('addStores.refusal.title')} message={t('addStores.refusal.notGranted')}>
            <span data-add-stores-refusal="notGranted" />
          </ErrorBanner>
        )}
        {refusal?.kind === 'badCodes' && (
          <ErrorBanner className="p-2" title={t('addStores.refusal.title')} message={refusal.message || t('addStores.refusal.failed')}>
            <div className="mt-1 flex flex-col gap-1.5" data-add-stores-refusal={refusal.code}>
              <span className="text-xs" data-add-stores-refusal-label="">
                {t(refusal.labelKey)}
              </span>
              <span className="flex flex-wrap gap-1" data-add-stores-bad-codes="">
                {refusal.codes.map((c) => (
                  <code key={c} className="rounded-full border border-danger-border px-2 py-0.5 font-mono text-xs" data-bad-code={c}>
                    <Ltr>{c}</Ltr>
                  </code>
                ))}
              </span>
              <span>
                <Button variant="danger-outlined" onClick={() => retryWithout(refusal.codes)} disabled={busy} data-add-stores-remove-retry="">
                  {t('addStores.refusal.removeAndRetry')}
                </Button>
              </span>
            </div>
          </ErrorBanner>
        )}
        {refusal?.kind === 'refused' && (
          <ErrorBanner className="p-2" title={t('addStores.refusal.title')} message={refusal.message || t('addStores.refusal.failed')}>
            {refusal.labelKey && (
              <span className="me-2 text-xs" data-add-stores-refusal-label="">
                {t(refusal.labelKey)}
              </span>
            )}
            <span className="font-mono text-xs" data-add-stores-refusal={refusal.code}>
              <Ltr>{refusal.code}</Ltr>
            </span>
          </ErrorBanner>
        )}
        {refusal?.kind === 'failed' && (
          <ErrorBanner className="p-2" title={t('addStores.refusal.title')} message={refusal.message || t('addStores.refusal.failed')}>
            <span data-add-stores-refusal="failed" />
          </ErrorBanner>
        )}
      </div>
    </Modal>
  )
}

function StoreSearch({ servingListId, basket, onBasket, disabled }: { servingListId: string; basket: Basket; onBasket: (b: Basket) => void; disabled: boolean }) {
  const { t } = useTranslation('serving-lists')
  const [find, setFind] = useState('')
  const q = useDebounced(find.trim(), 250)
  // A blank search is allowed: the door answers its first page, by code.
  const hits = useQuery(storesQuery(servingListId, q))
  const rows = hits.data ?? []
  // While a new search reads, `rows` are the previous search's (keepPreviousData): not what "shown" will mean.
  const stale = hits.isPlaceholderData
  const pickableCount = rows.filter((r) => pickable(r) && !inBasket(basket, r.storeCode)).length

  return (
    <div className="flex min-w-0 flex-col gap-2" data-add-stores-search="">
      <label className="flex flex-col gap-1 text-xs font-medium">
        {t('addStores.search.label')}
        <span className="relative flex items-center">
          <Search className="pointer-events-none absolute start-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <input
            type="search"
            dir="auto"
            value={find}
            disabled={disabled}
            placeholder={t('addStores.search.placeholder')}
            onChange={(e) => setFind(e.target.value)}
            onKeyDown={(e) => {
              // Escape clears the search only — the native <dialog> does not close; Enter submits nothing.
              if (e.key === 'Escape' && find) {
                e.preventDefault()
                e.stopPropagation()
                setFind('')
              }
              if (e.key === 'Enter') e.preventDefault()
            }}
            className={FIELD + ' h-8 w-full ps-7 font-normal'}
            data-add-stores-find=""
          />
        </span>
      </label>

      <div className="rounded-md border border-border/60 bg-card" aria-live="polite" aria-busy={hits.isFetching} data-add-stores-hits="">
        {hits.isPending ? (
          <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('addStores.search.searching')}
          </p>
        ) : hits.isError ? (
          <p className="px-2 py-1.5 text-xs text-danger-800" role="alert" data-add-stores-search-error="">
            {isBareDenial(hits.error) ? t('access.deniedTitle') : apiErrorMessage(hits.error, t('addStores.search.failed'))}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground" data-add-stores-no-hits="">
            {t('addStores.search.noHits')}
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto py-1">
            {rows.map((r) => (
              <Hit key={r.storeCode} row={r} picked={inBasket(basket, r.storeCode)} disabled={disabled} onToggle={() => onBasket(toggleHit(basket, r))} />
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outlined" disabled={disabled || stale || pickableCount === 0} onClick={() => !stale && onBasket(addHits(basket, rows))} data-add-stores-pick-all="">
          {t('addStores.search.pickAll')}
        </Button>
        {rows.length >= STORE_SEARCH_TAKE && (
          <span className="text-xs text-muted-foreground" data-add-stores-more="">
            <Trans t={t} i18nKey="addStores.search.more" values={{ n: formatFigure(STORE_SEARCH_TAKE) }} components={{ v: <Ltr /> }} />
          </span>
        )}
      </div>
    </div>
  )
}

function Hit({ row, picked, disabled, onToggle }: { row: ServingListStoreRow; picked: boolean; disabled: boolean; onToggle: () => void }) {
  const { t } = useTranslation('serving-lists')
  const onList = row.onList
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={onList || picked}
        disabled={disabled || onList}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-1 text-start text-sm hover:bg-accent disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent"
        data-hit={row.storeCode}
        data-on-list={onList ? '' : undefined}
        data-picked={picked ? '' : undefined}
        data-closed={row.closed ? '' : undefined}
      >
        <span
          className={
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border ' +
            (onList || picked ? 'border-primary bg-primary text-primary-foreground' : 'border-border')
          }
          aria-hidden
        >
          {(onList || picked) && <Check className="h-3 w-3" />}
        </span>
        <span className="w-14 shrink-0 font-mono text-[12px]">
          <Ltr>{row.storeCode}</Ltr>
        </span>
        <span className="min-w-0 flex-1 truncate">
          <bdi>{row.name}</bdi>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          <bdi>{row.city}</bdi>
        </span>
        {row.closed && (
          <span className="shrink-0" title={t('addStores.search.closedHint')} data-hit-closed="">
            <StatusBadge sev="warn">{t('addStores.search.closed')}</StatusBadge>
          </span>
        )}
        {onList && (
          <span className="shrink-0 text-[11px]" data-hit-on-list="">
            {t('addStores.search.onList')}
          </span>
        )}
      </button>
    </li>
  )
}

function PasteCodes({ basket, onBasket, disabled }: { basket: Basket; onBasket: (b: Basket) => void; disabled: boolean }) {
  const { t } = useTranslation('serving-lists')
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null)
  return (
    <div className="flex flex-col gap-1.5" data-add-stores-paste="">
      <label className="flex flex-col gap-1 text-xs font-medium">
        {t('addStores.paste.label')}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          dir="ltr"
          disabled={disabled}
          className={FIELD + ' py-1.5 font-mono font-normal'}
          data-add-stores-paste-text=""
        />
        <span className="font-normal text-muted-foreground">{t('addStores.paste.hint')}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outlined"
          disabled={disabled || text.trim() === ''}
          onClick={() => {
            const r = addPasted(basket, text)
            onBasket(r.basket)
            setResult({ added: r.added, skipped: r.skipped })
            setText('')
          }}
          data-add-stores-paste-add=""
        >
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
          {t('addStores.paste.add')}
        </Button>
        {result && (
          <span className="text-xs text-muted-foreground" data-add-stores-paste-result={`${result.added}/${result.skipped}`}>
            <Trans t={t} i18nKey="addStores.paste.result" values={{ added: formatFigure(result.added), skipped: formatFigure(result.skipped) }} components={{ v: <Ltr /> }} />
          </span>
        )}
      </div>
    </div>
  )
}

function BasketView({ basket, badCodes, onBasket, disabled }: { basket: Basket; badCodes: readonly string[]; onBasket: (b: Basket) => void; disabled: boolean }) {
  const { t } = useTranslation('serving-lists')
  const n = basket.length
  return (
    <section className="flex flex-col gap-1.5 rounded-md border border-border/60 p-2" aria-label={t('addStores.basket.title')} data-add-stores-basket={n}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium" data-basket-count={n}>
          <Trans t={t} i18nKey="addStores.basket.count" count={n} values={{ n: formatFigure(n) }} components={{ v: <Ltr /> }} />
        </span>
        {n > 0 && (
          <Button variant="text" className="ms-auto" disabled={disabled} onClick={() => onBasket(EMPTY_BASKET)} data-basket-clear="">
            {t('addStores.basket.clear')}
          </Button>
        )}
      </div>
      {n === 0 ? (
        <p className="text-xs text-muted-foreground" data-basket-empty="">
          {t('addStores.basket.empty')}
        </p>
      ) : (
        <ul className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
          {basket.map((item) => {
            const bad = isBadCode(badCodes, item.storeCode)
            return (
              <li
                key={item.storeCode}
                className={
                  'inline-flex items-center gap-0.5 rounded-full border py-0.5 ps-2 pe-0.5 text-xs ' +
                  (bad ? 'border-danger-border bg-danger-050 text-danger-800' : 'border-border/60 bg-card')
                }
                title={item.name ? fsi(item.name) : undefined}
                data-basket-code={item.storeCode}
                data-basket-bad={bad ? '' : undefined}
                data-basket-closed={item.closed ? '' : undefined}
              >
                <code className="font-mono">
                  <Ltr>{item.storeCode}</Ltr>
                </code>
                {bad && <span className="sr-only">{t('addStores.basket.refused')}</span>}
                {item.closed && <span className="text-[10px] text-warn-800">{t('addStores.basket.closed')}</span>}
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-danger-800"
                  aria-label={t('addStores.basket.remove', { code: fsi(item.storeCode) })}
                  disabled={disabled}
                  onClick={() => onBasket(removeCodes(basket, [item.storeCode]))}
                  data-basket-remove={item.storeCode}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
