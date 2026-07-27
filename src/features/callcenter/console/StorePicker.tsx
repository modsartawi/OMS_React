/**
 * The deliberate store override (ticket 167, US14).
 *
 * The usual way the fulfilment store is decided is derivation — the district
 * rule runs server-side at `setAddress` and the answer arrives in the projection
 * ([166](.issues/166-address-derives-the-store.md)). This is the other way: an
 * operational reality the derivation does not know about, honoured by the agent
 * choosing a branch outright. It is the same rebind and takes the **same**
 * confirm path (`StoreMoveConfirm`) — the console has one confirmation
 * mechanism, not one per verb.
 *
 * Two things it deliberately does not do:
 *
 * 1. 🚩 **It does not decide which stores are legal.** The list is the whole
 *    estate, unfiltered — CC2's own behaviour (§2.2) — and the door refuses what
 *    it will not do. A client-side filter here would be a second opinion about
 *    fulfilment, which is the failure mode 166 was built to avoid on the
 *    derivation side.
 * 2. **It does not read the estate until it is opened.** `StoreDetails` is a
 *    reference read off the door, already served by `@/core/services/lookups.ts`
 *    and shared session-wide — an agent who never overrides the store costs it
 *    nothing.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { lookupQueries } from '@/core/services/lookups'
import type { StoreDetailModel } from '@/core/models/lookups'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { NOTE } from './console-notes'

/** How many rows are drawn at once. The estate runs to hundreds and a modal is
 *  not a grid; the count of what is NOT drawn is stated rather than silently
 *  truncated, so "my branch isn't here" is answerable by typing. */
const SHOWN = 40

export default function StorePicker({
  open,
  currentPlant,
  /** The store code currently being applied, if any. */
  pending,
  /** The failed override, already turned into agent-facing text by the caller. */
  error,
  onPick,
  onClose,
}: {
  open: boolean
  currentPlant: string | null
  pending: string | null
  error: string | null
  onPick: (storeCode: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('callcenter')
  const [query, setQuery] = useState('')

  const stores = useQuery({ ...lookupQueries.storeDetails(), enabled: open })

  const needle = query.trim().toLowerCase()
  const matches = (stores.data ?? []).filter((store) => matchesStore(store, needle))
  const busy = pending !== null

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t('store.title')}
      width="30rem"
      footer={
        <Button variant="text" onClick={onClose} disabled={busy} data-cc-store-close>
          {t('store.close')}
        </Button>
      }
    >
      <div className="space-y-2 text-sm" data-cc-store-picker>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={busy}
          autoComplete="off"
          placeholder={t('store.searchPlaceholder')}
          aria-label={t('store.search')}
          data-cc-store-search
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
        />

        {stores.isPending && (
          <p className="flex items-center gap-2 text-muted-foreground" data-cc-store-loading>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('store.loading')}
          </p>
        )}

        {stores.isError && (
          <>
            <p className={NOTE.danger} data-cc-store-list-error>
              {apiErrorMessage(stores.error, t('store.loadFailed'))}
            </p>
            {/* The read is pure, so trying it again costs the order nothing. */}
            <Button
              variant="outlined"
              onClick={() => void stores.refetch()}
              disabled={stores.isFetching}
              data-cc-store-reload
            >
              {t('actions.retry')}
            </Button>
          </>
        )}

        {stores.isSuccess && matches.length === 0 && (
          <p className="text-muted-foreground" data-cc-store-empty>
            {t('store.noMatch')}
          </p>
        )}

        {matches.slice(0, SHOWN).map((store) => {
          const isCurrent = store.storeCode === currentPlant
          return (
            <button
              key={store.storeCode}
              type="button"
              onClick={() => onPick(store.storeCode)}
              disabled={busy || isCurrent}
              data-cc-store-option={store.storeCode}
              className="flex w-full items-start gap-2 rounded-md border border-border bg-card p-2.5 text-start hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-card"
            >
              <div className="min-w-0 flex-1">
                <div data-numeric className="text-sm font-medium">
                  {store.storeCode}
                </div>
                {/* Server-supplied, passed through as data. */}
                <div className="text-xs text-muted-foreground">
                  {[store.city, store.region, store.storeAddress].filter(Boolean).join(' · ')}
                </div>
              </div>
              {isCurrent && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] text-success-800"
                  data-cc-store-current
                >
                  <Check className="h-3 w-3" aria-hidden />
                  {t('store.onThisOrder')}
                </span>
              )}
              {pending === store.storeCode && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
              )}
            </button>
          )
        })}

        {matches.length > SHOWN && (
          // 🚩 Named, never silent: a list that quietly stopped at forty reads as
          // "your branch is not in the estate".
          <p className="text-xs text-muted-foreground" data-cc-store-truncated>
            {t('store.truncated', { shown: SHOWN, total: matches.length })}
          </p>
        )}

        {error && (
          <p className={NOTE.danger} data-cc-store-error>
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function matchesStore(store: StoreDetailModel, needle: string): boolean {
  if (!needle) return true
  return [store.storeCode, store.city, store.region, store.storeAddress]
    .filter(Boolean)
    .some((field) => field.toLowerCase().includes(needle))
}
