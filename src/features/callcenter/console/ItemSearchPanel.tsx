/**
 * The box the agent types into while the caller is talking (ticket 168).
 *
 * It sits in the centre column between the chip row and the basket — 135's
 * fixed vertical order, so the thing the agent uses on every single call is at
 * the same pixels at hour nine as at hour one.
 *
 * Four properties it exists to hold:
 *
 * 1. 🚩 **The estimate never enters the money column.** Where it goes is
 *    `item-search.ts`'s ruling and this component only obeys it: the row's
 *    second line carries item number · Arabic name · estimate, and the row's end
 *    edge carries availability and *Add* only. The panel keeps a **standing**
 *    note above the rows saying catalogue prices are estimates and the basket
 *    price is what the caller pays — stated once, rather than inferred per row.
 * 2. 🚩 **Availability renders three ways and `unknown` is not `zero`** — ground,
 *    ink and wording all differ, because they are opposite decisions.
 * 3. **Every row is addable in one action.** The server already filtered to what
 *    this order would accept (CC1's whitelist, at the order's plant), so there
 *    is no select-then-confirm ritual mid-sentence.
 * 4. **No paging.** A cap plus `truncated`, whose affordance is *narrow your
 *    search* — an agent scanning at call pace retypes; they do not page.
 *
 * The Arabic name rides the meta line inside the **`dir`-pinned** isolate
 * (`@/core/ui/Ltr` is `<bdi dir="ltr">`), which is 138's ruling: a bare `<bdi>`
 * implies `dir="auto"` and flips the whole block.
 */
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Search, X } from 'lucide-react'
import type { SessionState } from '@/core/models/callcenter'
import { apiErrorMessage } from '@/core/api'
import Ltr from '@/core/ui/Ltr'
import { callCenterApi, itemSearchKey } from './api'
import AvailabilityPill from './AvailabilityPill'
import { NOTE } from './console-notes'
import {
  MIN_QUERY_LENGTH,
  isSearchable,
  searchRowViews,
  type MetaPart,
  type SearchRowView,
} from './item-search'

/**
 * `addItem` and everything it is currently saying, as one prop — the shape the
 * rail's two verbs (165) and the address book (166) already use. The call
 * itself is the page's: it returns the whole `SessionState` and the cache is the
 * store of record.
 */
export interface AddItemActions {
  /**
   * 🚩 `null` while `capabilities.canAddItem` is false. A control the door would
   * refuse is worse than no control (165's ruling), so a refused add is not a
   * disabled button the agent can reach for — the row simply carries none.
   */
  onAdd: ((itemNumber: string, description: string) => void) | null
  /** The item number currently being added, if any. */
  pending: string | null
  /**
   * 🚩 How many adds have actually **landed** on the basket. The panel watches it
   * change and puts the question away — the results of a question the agent has
   * finished asking are a list they now have to clear by hand, over the basket
   * line that just appeared.
   *
   * A counter rather than a boolean because the same item can be added twice and
   * the second landing must read as an event, not as the first one still being
   * true. It counts **landings only**: a below-availability ask carries the
   * unchanged state, so nothing was added and the rows stay in front of the
   * agent who is about to accept.
   */
  landed: number
  /** This add's own outcome, already worded. Drawn under the rows, where the
   *  agent's eye already is, rather than as a toast that leaves the screen. */
  error: string | null
  /** 🚩 Forgets that outcome. Called when the agent asks a NEW question — a
   *  refusal belongs to the act that raised it, and one left standing over the
   *  next search is a sentence about an item no longer on screen. */
  dismissError: () => void
}

/** What each part of the meta line is allowed to do with the width it has. The
 *  Arabic run is the one that can be long; the two numeric runs are short and
 *  must not be squeezed by it. */
const META_WIDTH: Record<MetaPart['id'], string> = {
  itemNumber: 'shrink-0',
  description2: 'min-w-0 truncate',
  estimate: 'shrink-0',
}

/** How long the typing settles before the catalogue is asked. Long enough that
 *  a word costs one non-sargable scan rather than six (799's own open latency
 *  question), short enough to keep up with someone talking. */
const SETTLE_MS = 250

export default function ItemSearchPanel({
  state,
  add,
  scope = null,
  onClearScope,
}: {
  state: SessionState
  add: AddItemActions
  /**
   * The offer this search is narrowed to — the guidance strip's hand-off (172),
   * `Search the other 994`. A set of 997 must not become a second screen, so it
   * lands HERE, in the search the agent already has, with the offer stated
   * rather than implied.
   *
   * 🚩 The narrowing itself is the SERVER's: `offerId` rides the query. The chip
   * says which offer was asked for, which is the honest thing to draw while
   * BackOffice 799 has not built the parameter yet — a server that ignores it
   * answers the whole catalogue, and a chip that claimed *filtered* would then
   * be the console's own lie.
   */
  scope?: { offerId: string; description: string } | null
  onClearScope?: () => void
}) {
  const { t } = useTranslation('callcenter')
  const [query, setQuery] = useState('')
  /** The box the hand-off puts the agent's cursor in. A scope with no term is
   *  not a dead end — it is the agent about to say what the caller asked for. */
  const box = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (scope) box.current?.focus()
  }, [scope])
  /** The settled term — what is actually asked. Separate from `query` so every
   *  keystroke does not become a scan of the item master. */
  const [term, setTerm] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [query])

  /**
   * Put the question away, and leave the caret where the next one is typed.
   *
   * 🚩 `term` is set here as well as `query` rather than being left to the
   * settle timer: the rows are gated on `term`, so clearing only the box would
   * leave the list standing for another quarter second — which is exactly the
   * "I deleted it and the list is still there" the agent is trying to escape.
   */
  const clear = () => {
    setQuery('')
    setTerm('')
    box.current?.focus()
  }

  /**
   * 🚩 The add landed, so the question is answered — the list closes by itself
   * and the box is empty and focused for the next item. Without this the agent
   * finishes every add by deleting their own search text before they can type
   * the next one, at call pace, on the console's most-pressed control.
   *
   * Guarded on the counter having actually moved: the first render is not a
   * landing, and clearing a scoped search the guidance strip has just put the
   * agent into (172) would undo the hand-off before they had typed a word.
   */
  const landed = add.landed
  useEffect(() => {
    if (landed === 0) return
    setQuery('')
    setTerm('')
    box.current?.focus()
  }, [landed])

  // 🚩 A new question is being asked, so the last add's outcome is over — it
  // named an item that is about to leave the screen. Held through a ref rather
  // than as a dependency: the page passes a fresh closure on every render, and
  // depending on it directly would clear the sentence the frame after it
  // appeared.
  const dismiss = useRef(add.dismissError)
  dismiss.current = add.dismissError
  useEffect(() => {
    dismiss.current()
  }, [term])

  const search = useQuery({
    // The scope is part of the question, so it is part of the key: the same
    // words asked inside an offer and across the catalogue are two different
    // answers, and one key would serve the first from the other's cache.
    queryKey: itemSearchKey(state.transactionId, term, scope?.offerId ?? null),
    queryFn: () => callCenterApi.itemSearch(state.transactionId, term, scope?.offerId ?? null),
    // 🚩 Held until the server would accept the term — under three characters it
    // answers 400, and spending that round trip while a caller waits buys the
    // agent nothing. The hint below says so rather than the console failing.
    enabled: isSearchable(term),
    // The catalogue and the plant's stock both move under a long call, and the
    // answer is cheap to re-ask. Re-reading on a repeated term is the honest
    // default for a figure the agent is about to act on.
    staleTime: 0,
    retry: false,
  })

  const rows = searchRowViews(search.data)
  const asked = isSearchable(term)

  return (
    <div className="shrink-0 border-b border-divider bg-card-2 px-4 py-3" data-cc-search>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="cc-item-search"
            ref={box}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // 🚩 The keyboard's own way out, and the one every agent already
            // tries. It is `Escape` on the box only — not a document listener —
            // because a modal is the one thing on this console that outranks
            // the search, and a global handler would eat the key that closes it.
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query !== '') {
                // Nothing above may also act on it: with rows on screen the key
                // means "put this list away", not "leave the console".
                event.stopPropagation()
                clear()
              }
            }}
            aria-label={t('search.label')}
            placeholder={t('search.placeholder')}
            data-cc-search-input
            // Room at the end edge for the clear button, always — a padding that
            // changed with the button's presence would shift the text under the
            // caret as the agent types the third character.
            className="w-full rounded-md border border-input bg-card py-2 pe-8 ps-8 text-sm outline-none focus:border-primary"
          />
          {/* 🚩 The visible way out, for the hand that is on the mouse. Present
              from the first character rather than from the third: a one- or
              two-character term draws no rows but is still text the agent has to
              get rid of before the next item. */}
          {query !== '' && (
            <button
              type="button"
              onClick={clear}
              aria-label={t('search.clear')}
              title={t('search.clear')}
              data-cc-search-clear
              className="absolute end-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        {search.isFetching && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden data-cc-search-busy />
        )}
      </div>

      {/* The hand-off, landed (172): which offer this search is narrowed to, and
          the way back to the whole catalogue. Above the note, because it changes
          what the rows below MEAN. */}
      {scope && (
        <div
          className="mt-2 flex items-baseline gap-2 text-[11px] text-primary-800"
          data-cc-search-scope={scope.offerId}
        >
          <span className="shrink-0">{t('search.scope')}</span>
          {/* Server text, passed through as data — the offer's own words. */}
          <span className="min-w-0 truncate font-medium" data-cc-server-text>
            <Ltr>{scope.description}</Ltr>
          </span>
          {onClearScope && (
            <button
              type="button"
              onClick={onClearScope}
              data-cc-search-scope-clear
              className="shrink-0 underline hover:no-underline"
            >
              {t('search.scopeClear')}
            </button>
          )}
        </div>
      )}

      {/* 🚩 STANDING, in the panel and not in the results box (US28): the rule is
          stated once and is on screen before the agent has typed anything, which
          is the point of a standing header — a caption that appears with the
          rows is a rule the agent reads only after they are already looking at
          prices. */}
      <div
        className="mt-2 flex items-baseline justify-between gap-3 text-[11px] text-muted-foreground"
        data-cc-search-note
      >
        <span>{t('search.estimateNote')}</span>
        {search.data?.truncated && asked && (
          // Not a pager: an agent scanning at call pace retypes, and keyset
          // paging over a re-ranked relevance order is unstable anyway.
          <span className="shrink-0 font-medium" data-cc-search-truncated>
            {t('search.truncated', { shown: rows.length })}
          </span>
        )}
      </div>

      {/* Under three characters the console says what is needed rather than
          growing a results box to hold a message about itself. */}
      {query.trim().length > 0 && !isSearchable(query) && (
        <p className="mt-1 text-xs text-muted-foreground" data-cc-search-hint>
          {t('search.minChars', { min: MIN_QUERY_LENGTH })}
        </p>
      )}

      {/* 🚩 Outside the results gate: an add that was refused must not be
          un-said by the agent clearing the box, which is the first thing they do
          when something did not land. */}
      {add.error && (
        <p className={`mt-2 ${NOTE.danger}`} data-cc-search-add-error>
          {add.error}
        </p>
      )}

      {asked && (
        <div className="mt-2 overflow-hidden rounded-md border border-border bg-card">
          {search.isPending && (
            <p className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground" data-cc-search-loading>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t('search.searching')}
            </p>
          )}

          {search.isError && (
            <div className="space-y-2 p-2">
              <p className={NOTE.danger} data-cc-search-error>
                {apiErrorMessage(search.error, t('search.failed'))}
              </p>
              {/* The read is pure, so trying it again costs the order nothing. */}
              <button
                type="button"
                onClick={() => void search.refetch()}
                disabled={search.isFetching}
                data-cc-search-retry
                className="rounded-md border border-input px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-50"
              >
                {t('actions.retry')}
              </button>
            </div>
          )}

          {search.isSuccess && rows.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted-foreground" data-cc-search-empty>
              {t('search.noMatch')}
            </p>
          )}

          {rows.map((row) => (
            <Row key={row.itemNumber} row={row} add={add} />
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ row, add }: { row: SearchRowView; add: AddItemActions }) {
  const { t } = useTranslation('callcenter')
  const adding = add.pending === row.itemNumber
  return (
    <div
      className="flex items-center gap-3 border-b border-divider px-3 py-2 last:border-0 hover:bg-accent"
      data-cc-search-row={row.itemNumber}
    >
      <div className="min-w-0 flex-1">
        {/* The name, alone on its line — it is what the agent reads out. */}
        <div className="truncate text-sm" data-cc-search-title>
          {row.title}
        </div>
        {/* 🚩 The second line: item number · Arabic name · estimate. This is the
            money column's absence, made structural. */}
        <div className="flex min-w-0 items-baseline gap-2 text-xs text-muted-foreground" data-cc-search-meta>
          {row.meta.map((part) => (
            <span
              key={part.id}
              className={META_WIDTH[part.id]}
              // One handle, naming which part it is — the model already
              // classified them, so the component does not re-decide it.
              data-cc-search-part={part.id}
              {...(part.id === 'description2' ? {} : { 'data-numeric': '' })}
            >
              {/* `dir`-pinned, never `dir="auto"` (138): the isolation without
                  the block flip, for the Arabic run and the numeric ones alike. */}
              <Ltr>{part.text}</Ltr>
            </span>
          ))}
        </div>
      </div>
      {/* 🚩 The end edge: availability, and the one action. No figure that could
          be read as money is drawn here. LIVE availability — the same pill on a
          basket line reads *at add* instead, because a frozen figure and a live
          one must never read alike (169). */}
      <AvailabilityPill availability={row.availability} keyBase="search.atp" />
      {add.onAdd && (
        <button
          type="button"
          // The name travels with the press so a below-availability acceptance
          // (169) can say what the agent just read out, rather than an item
          // number. It is display only — the wire carries neither (law 1).
          onClick={() => add.onAdd?.(row.itemNumber, row.title)}
          // Every row's action is held while one is in flight, deliberately: the
          // engine's claim is a 15 s mutual exclusion, so a second add sent on
          // top of the first collides and is ridden out (law 7) — and a panel
          // that accepted both would be showing one *Adding…* for two acts. It
          // is one round trip, not a step: *one action adds it* is intact.
          disabled={add.pending !== null}
          data-cc-search-add={row.itemNumber}
          className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {adding ? t('search.adding') : t('search.add')}
        </button>
      )}
    </div>
  )
}

