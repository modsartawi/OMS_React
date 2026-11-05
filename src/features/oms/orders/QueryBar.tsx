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
import { usePopoverDismiss } from '@/core/ui/use-popover-dismiss'
import { formatPair } from '@/core/util/bidi'
import {
  barTokens,
  discardedDraft,
  inSearch,
  pendingDiff,
  QUERY_FOCUS_KEYS,
  QUERY_GROUPS,
  queryFields,
  restoreField,
  withField,
  type QueryCriteria,
  type QueryField,
  withinGrant,
  type QueryGrants,
} from './query-model'
import QueryToken, { type LookupOption, type LookupOptions } from './QueryToken'

/**
 * A coded lookup as options keyed on its CODE — the order row carries codes (`BUPA`, `ERX`), and
 * so does 3391's criterion — labelled `code · description`. A failed lookup degrades gracefully:
 * one warning toast, an empty list; the text criteria still work.
 */
function useLookupOptions(
  query: { data?: readonly { code: string; description: string }[]; isError: boolean },
  lookupNameKey: string,
): LookupOption[] {
  const { t } = useTranslation('orders')
  const warned = useRef(false)
  useEffect(() => {
    if (query.isError && !warned.current) {
      warned.current = true
      toast.warning(t('lookupUnavailable.title'), { description: t('lookupUnavailable.detail', { name: t(lookupNameKey) }) })
    }
  }, [query.isError, t, lookupNameKey])

  const byCode = new Map<string, LookupOption>()
  for (const row of query.data ?? []) {
    const code = (row.code ?? '').trim()
    if (code && !byCode.has(code)) byCode.set(code, { code, label: formatPair(code, (row.description ?? '').trim()) })
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
}

/**
 * The Order / ERX list's query bar — the Deliveries bar, with the order criteria. Each criterion
 * in the search is a **token**; **+ Filter** lists the criteria this session may use in four
 * groups. The **Limit** token sits at the inline end, then the pending note and **Search**. The
 * draft is measured against the last search that ran. While an identifier is in the search the
 * Date token reads "ignored": the search sends no date (3391).
 */
export default function QueryBar({
  draft: heldDraft,
  lastRun: heldLastRun,
  searching,
  grants,
  dateIgnored,
  addRef,
  onDraft,
  onSearch,
}: {
  draft: QueryCriteria
  lastRun: QueryCriteria | null
  searching: boolean
  grants: QueryGrants
  dateIgnored: boolean
  addRef: RefObject<HTMLButtonElement | null>
  onDraft: (draft: QueryCriteria) => void
  onSearch: () => void
}) {
  const { t } = useTranslation('orders')
  const [editing, setEditing] = useState<QueryField | null>(null)
  const [adding, setAdding] = useState(false)
  // Without the grant a hidden patient or member ID is neither drawn nor counted as pending, and
  // every edit writes the draft back without it.
  const draft = withinGrant(heldDraft, grants)
  const lastRun = heldLastRun && withinGrant(heldLastRun, grants)

  const typeQuery = useQuery(lookupQueries.documentTypes())
  const sourceQuery = useQuery(lookupQueries.documentSources())
  const lookups: LookupOptions = {
    documentTypes: useLookupOptions(
      { data: typeQuery.data?.map((r) => ({ code: r.documentType, description: r.description })), isError: typeQuery.isError },
      'lookups.documentTypes',
    ),
    documentSources: useLookupOptions(
      { data: sourceQuery.data?.map((r) => ({ code: r.documentSource, description: r.description })), isError: sourceQuery.isError },
      'lookups.documentSources',
    ),
  }

  const offered = new Set(queryFields(grants).map((f) => f.id))
  const diff = pendingDiff(draft, lastRun)
  // Belt and braces: a token this session may not use is never drawn.
  const tokens = barTokens(draft, lastRun, editing).filter((token) => offered.has(token.field))

  function edit(field: QueryField) {
    setAdding(false)
    if (field === 'date' && !draft.date) onDraft(withField(draft, 'date', { preset: 'last3' }))
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
        <QueryToken
          key={token.field}
          field={token.field}
          value={token.value}
          state={token.state}
          ignored={token.field === 'date' && token.state !== 'ghost' && dateIgnored}
          {...tokenProps(token.field)}
        />
      ))}
      <AddFilter draft={draft} grants={grants} open={adding} setOpen={setAdding} onPick={edit} addRef={addRef} />
      <span className="flex-1" />
      {/* The Limit is always shown: it decides whether a page was cut (366). */}
      <QueryToken
        field="limit"
        value={draft.limit}
        state={diff.edited.includes('limit') ? 'edited' : 'applied'}
        align="end"
        {...tokenProps('limit')}
      />
      {diff.count > 0 && (
        <span role="status" className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-attention-800" data-pending-note="">
          <span className="size-1.5 rounded-full bg-attention" aria-hidden />
          <span>
            <Trans t={t} i18nKey="query.pending" count={diff.count} values={{ n: String(diff.count) }} components={{ n: <Ltr /> }} />
          </span>
          <Button variant="text" onClick={() => onDraft(discardedDraft(lastRun))} data-query-discard="">
            <RotateCcw className="size-3" aria-hidden />
            {t('query.discard')}
          </Button>
        </span>
      )}
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

/** + Filter (dashed): the criteria in four groups — When · Find one · Narrow · Rows. */
function AddFilter({
  draft,
  grants,
  open,
  setOpen,
  onPick,
  addRef,
}: {
  draft: QueryCriteria
  grants: QueryGrants
  open: boolean
  setOpen: (open: boolean) => void
  onPick: (field: QueryField) => void
  addRef: RefObject<HTMLButtonElement | null>
}) {
  const { t } = useTranslation('orders')
  const wrapper = useRef<HTMLSpanElement>(null)
  const hint = useKeyHint(QUERY_FOCUS_KEYS)
  const fields = queryFields(grants)

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
            <section key={group} aria-label={t(`query.group.${group}`)} className="border-t border-divider py-0.5" data-query-group={group}>
              {fields
                .filter((f) => f.group === group)
                .map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    autoFocus={group === 'when' && i === 0}
                    onClick={() => onPick(f.id)}
                    className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-start text-xs hover:bg-accent focus:bg-accent focus:outline-none"
                    data-query-entry={f.id}
                  >
                    <span className="flex-1">{t(`query.field.${f.id}`)}</span>
                    {inSearch(draft, f.id) && <span className="text-[10.5px] text-success-800">{t('query.inSearch')}</span>}
                  </button>
                ))}
            </section>
          ))}
        </div>
      )}
    </span>
  )
}
