import { useEffect, useRef, useState, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Filter, Plus, RotateCcw, Search } from 'lucide-react'
import { useKeyHint } from '@/core/commands/key-hint'
import { lookupQueries } from '@/core/services/lookups'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { POPOVER } from '@/core/ui/overlay'
import {
  barTokens,
  discardedDraft,
  inSearch,
  pendingDiff,
  QUERY_FIELDS,
  QUERY_FOCUS_KEYS,
  QUERY_GROUPS,
  restoreField,
  withField,
  type QueryCriteria,
  type QueryField,
} from './query-model'
import QueryToken, { usePopoverDismiss, type LookupOptions } from './QueryToken'

/**
 * Map a lookup query to sorted, de-duplicated options keyed on the row's `description` — the
 * WPF filter contract sends the description text, not the code (R-3). A failed lookup degrades
 * gracefully: one warning toast, an empty list; the text criteria still work.
 */
function useLookupOptions(
  query: { data?: readonly { description: string }[]; isError: boolean },
  lookupNameKey: string,
): string[] {
  const { t } = useTranslation()
  const warned = useRef(false)

  useEffect(() => {
    if (query.isError && !warned.current) {
      warned.current = true
      toast.warning(t('deliveries:lookupUnavailable.title'), {
        description: t('deliveries:lookupUnavailable.detail', { name: t(lookupNameKey) }),
      })
    }
  }, [query.isError, t, lookupNameKey])

  const descriptions = new Set<string>()
  for (const row of query.data ?? []) {
    const description = (row.description ?? '').trim()
    if (description) descriptions.add(description)
  }
  return [...descriptions].sort((a, b) => a.localeCompare(b))
}

/**
 * The Deliveries list's query bar (ticket 399, spec 380 L8; ruling 368 §1), across the top of
 * the centre column. It replaces the old criteria panel.
 *
 * - Each criterion in the search is a **token**; a click edits it in a popover where Enter
 *   searches. **+ Filter** lists all 14 criteria in four groups, From/To as one relative Date.
 * - At the inline end: the **Limit** token, always shown and never removable, the pending note,
 *   and **Search**.
 * - The draft is measured against the last search that ran. Until Search runs, an edit is
 *   dashed amber, a removal stays as a struck ghost with a restore, the note reads "N changes
 *   not searched · Discard", and Search carries an amber dot.
 *
 * The draft lives in the search store, so a trip to Delivery details and back restores it.
 * `/` focuses + Filter (`addRef`), through the page's registered command.
 */
export default function QueryBar({
  draft,
  lastRun,
  searching,
  addRef,
  onDraft,
  onSearch,
}: {
  draft: QueryCriteria
  lastRun: QueryCriteria | null
  searching: boolean
  addRef: RefObject<HTMLButtonElement | null>
  onDraft: (draft: QueryCriteria) => void
  /** Runs the draft as it stands in the store. */
  onSearch: () => void
}) {
  const { t } = useTranslation('deliveries')
  const [editing, setEditing] = useState<QueryField | null>(null)
  const [adding, setAdding] = useState(false)

  const lookups: LookupOptions = {
    documentTypes: useLookupOptions(useQuery(lookupQueries.documentTypes()), 'deliveries:lookups.documentTypes'),
    documentSources: useLookupOptions(useQuery(lookupQueries.documentSources()), 'deliveries:lookups.documentSources'),
    deliveryDocumentTypes: useLookupOptions(
      useQuery(lookupQueries.deliveryDocumentTypes()),
      'deliveries:lookups.deliveryDocumentTypes',
    ),
  }

  const diff = pendingDiff(draft, lastRun)
  const tokens = barTokens(draft, lastRun, editing)

  /** Opens a field's popover. A Date opened with no range starts at Today. */
  function edit(field: QueryField) {
    setAdding(false)
    if (field === 'date' && !draft.date) onDraft(withField(draft, 'date', { preset: 'today' }))
    setEditing(field)
  }

  const tokenProps = (field: QueryField) => ({
    open: editing === field,
    draft,
    lookups,
    onToggle: () => (editing === field ? setEditing(null) : edit(field)),
    onClose: () => setEditing((now) => (now === field ? null : now)),
    onDraft,
    onRemove: () => {
      onDraft(withField(draft, field, null))
      setEditing(null)
      addRef.current?.focus()
    },
    onRestore: () => onDraft(restoreField(draft, lastRun, field)),
    onSearch,
  })

  return (
    <div
      role="search"
      aria-label={t('query.region')}
      className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5"
      data-query-bar=""
    >
      <Filter className="size-3.5 shrink-0 text-ink-3" aria-hidden />
      {tokens.map((token) => (
        <QueryToken key={token.field} field={token.field} value={token.value} state={token.state} {...tokenProps(token.field)} />
      ))}
      <AddFilter draft={draft} open={adding} setOpen={setAdding} onPick={edit} addRef={addRef} />
      <span className="flex-1" />
      {/* The Limit is always shown: it decides whether a page was cut (366). */}
      <QueryToken
        field="limit"
        value={draft.limit}
        state={diff.edited.includes('limit') ? 'edited' : 'applied'}
        align="end"
        {...tokenProps('limit')}
      />
      <PendingNote count={diff.count} onDiscard={() => onDraft(discardedDraft(lastRun))} />
      <Button
        className="relative"
        disabled={searching}
        aria-busy={searching}
        onClick={() => {
          setEditing(null)
          onSearch()
        }}
        data-query-search=""
      >
        <Search className="size-3.5" aria-hidden />
        {t('query.search')}
        {diff.count > 0 && (
          <span
            className="absolute -end-1 -top-1 size-2.5 rounded-full border-2 border-card bg-attention"
            aria-hidden
            data-pending-dot=""
          />
        )}
      </Button>
    </div>
  )
}

/**
 * + Filter (dashed): all 14 criteria in four groups — When · Find one · Narrow · Rows — with the
 * ones already in the search marked "in search". From/To is the one Date entry.
 */
function AddFilter({
  draft,
  open,
  setOpen,
  onPick,
  addRef,
}: {
  draft: QueryCriteria
  open: boolean
  setOpen: (open: boolean) => void
  onPick: (field: QueryField) => void
  addRef: RefObject<HTMLButtonElement | null>
}) {
  const { t } = useTranslation('deliveries')
  const wrapper = useRef<HTMLSpanElement>(null)
  const hint = useKeyHint(QUERY_FOCUS_KEYS)

  usePopoverDismiss(open, wrapper, (by) => {
    setOpen(false)
    if (by === 'escape') addRef.current?.focus()
  })

  return (
    <span ref={wrapper} className="relative">
      <button
        ref={addRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-keyshortcuts={hint.ariaKeyShortcuts}
        title={hint.title(t('query.focus'))}
        onClick={() => setOpen(!open)}
        className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-border-strong px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        data-query-add=""
      >
        <Plus className="size-3" aria-hidden />
        {t('query.add')}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('query.addMenu')}
          className={`${POPOVER} absolute start-0 top-full z-50 mt-1 w-72 p-1`}
          data-query-menu=""
        >
          <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">{t('query.addMenu')}</div>
          {QUERY_GROUPS.map((group) => (
            <section
              key={group}
              aria-label={t(`query.group.${group}`)}
              className="border-t border-divider py-0.5"
              data-query-group={group}
            >
              {QUERY_FIELDS.filter((f) => f.group === group).map((f, i) => {
                const used = inSearch(draft, f.id)
                return (
                  <button
                    key={f.id}
                    type="button"
                    // The menu opens with the caret on its first entry.
                    autoFocus={group === 'when' && i === 0}
                    onClick={() => onPick(f.id)}
                    className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-start text-xs hover:bg-accent focus:bg-accent focus:outline-none"
                    data-query-entry={f.id}
                  >
                    <span className="flex-1">{t(`query.field.${f.id}`)}</span>
                    {used && <span className="text-[10.5px] text-success-800">{t('query.inSearch')}</span>}
                  </button>
                )
              })}
            </section>
          ))}
        </div>
      )}
    </span>
  )
}

/** "N changes not searched · Discard", while the draft differs from the search that ran. */
function PendingNote({ count, onDiscard }: { count: number; onDiscard: () => void }) {
  const { t } = useTranslation('deliveries')
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-attention-800" data-pending-note="">
      {count > 0 && (
        <>
          <span className="size-1.5 rounded-full bg-attention" aria-hidden />
          <span>
            <Trans t={t} i18nKey="query.pending" count={count} values={{ n: String(count) }} components={{ n: <Ltr /> }} />
          </span>
          <button
            type="button"
            onClick={onDiscard}
            className="inline-flex items-center gap-0.5 rounded px-1 text-muted-foreground underline-offset-2 hover:underline"
            data-query-discard=""
          >
            <RotateCcw className="size-3" aria-hidden />
            {t('query.discard')}
          </button>
        </>
      )}
    </span>
  )
}
