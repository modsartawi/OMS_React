import { useCallback, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FileSearch, PackageSearch } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { canOpenIDocInspector, idocInspectorAccessQuery, idocInspectorApi } from './api'
import DocumentPane from './DocumentPane'
import DocumentRail from './DocumentRail'
import { hasDocuments, selectedIndex } from './document-graph'
import LookupToolbar from './LookupToolbar'
import {
  buildLookupKey,
  landingCriteria,
  missingParts,
  sameLookup,
  type LookupCriteria,
  type LookupKey,
  type MissingParts,
} from './lookup-key'

/**
 * IDoc Inspector (`/reports/idoc-inspector`) — the second screen of the
 * **Reports** area (spec 1386). 296 landed the access spine; **297 hangs the
 * screen's content inside it**: the lookup fires, and what comes back is
 * rendered.
 *
 * 🔑 **One page, two levels of navigation, and that is the whole budget.** A
 * document is *selected* in a horizontal rail (at most five exist on any
 * transaction, so a rail is the right shape and a tree is not); a line *opens in
 * place*. Conditions and item details live inside the open line and are never a
 * third level — they are the reason you opened it.
 *
 * 🔑 **Everything arrives in ONE server call**, so selecting a document or
 * opening a line never touches the network. The graph is capped by measurement —
 * five documents, 210 conditions, 515 rows at the extreme — so there is no
 * paging at any level and no second round-trip to add.
 *
 * ⚠️ **The empty result is a placeholder in this slice.** Every "nothing to show"
 * arrives as a 200 carrying one of ten named verdicts, and **ticket 298 owns
 * their wording** — including the three that must not be softened (parked is
 * *not yet shipped*, gave-up must never read as success, held documents are not
 * an empty state at all). Until then this screen says only that the lookup found
 * no documents, which is true of all ten and diagnostic of none.
 *
 * The download (299) sits on the verdict strip 298 builds; the code legend (300)
 * hangs labels beside the raw codes rendered here. Neither is here yet.
 */
export default function IDocInspectorPage() {
  const { t } = useTranslation('reports')

  // The live draft, and the key that has actually been ISSUED. Only Look up
  // promotes one to the other, so a half-typed transaction number never fires a
  // request. `null` is "nothing has been asked yet" — the landing state.
  const [criteria, setCriteria] = useState<LookupCriteria>(landingCriteria)
  const [appliedKey, setAppliedKey] = useState<LookupKey | null>(null)
  const [invalid, setInvalid] = useState<MissingParts | null>(null)

  // Which document the rail has selected, and which lines are open. Both are
  // pure view state — no request hangs off either.
  const [wantedDocument, setWantedDocument] = useState(0)
  const [openItemNumbers, setOpenItemNumbers] = useState<ReadonlySet<number>>(new Set())
  const [filterTag, setFilterTag] = useState<string | null>(null)

  const lookup = useQuery({
    queryKey: ['reports', 'idoc-inspector', 'transaction', appliedKey],
    // Non-null by construction: `enabled` below is the same condition, so the fn
    // cannot run with a null key.
    queryFn: () => idocInspectorApi.transaction(appliedKey!),
    // 🚩 Nothing fires on mount and nothing fires until Look up: a transaction is
    // not a question this screen can answer unasked, and an auto-fired lookup
    // would be a guaranteed empty result pretending to be a verdict.
    enabled: appliedKey !== null,
    // A refusal is an answer and an exact keyed lookup is a user action they can
    // repeat, so no automatic second attempt.
    retry: false,
  })

  /** Everything derived from the PREVIOUS answer, cleared whenever a new one is
   *  asked for: a stale open line or a filter from another document would
   *  otherwise survive into a different transaction's graph. */
  const resetView = useCallback(() => {
    setWantedDocument(0)
    setOpenItemNumbers(new Set())
    setFilterTag(null)
  }, [])

  const onChange = useCallback((patch: Partial<LookupCriteria>) => {
    setCriteria((c) => ({ ...c, ...patch }))
    setInvalid(null)
  }, [])

  const refetch = lookup.refetch
  const onLookup = useCallback(() => {
    // 🔑 The BUILDER decides whether this may be sent — one reading of that rule
    // — and `missingParts` only says WHICH half to mark. Marking off the
    // builder's `null` rather than off a second predicate is what stops the form
    // and the request disagreeing.
    const key = buildLookupKey(criteria)
    setInvalid(key === null ? missingParts(criteria) : null)

    if (key === null) {
      // 🚩 The refusal clears the ISSUED key too, not just the field. Leaving it
      // would draw "enter a store" over the previous transaction's documents.
      setAppliedKey(null)
      resetView()
      return
    }

    resetView()

    // 🚩 Pressing Look up again on the SAME key has to re-ask the server. The
    // query key IS the key, so react-query would otherwise answer from cache:
    // `retry` is off here and `refetchOnWindowFocus` is off app-wide, which
    // would leave a dead button under the error banner until the key changed.
    if (appliedKey !== null && sameLookup(key, appliedKey)) {
      void refetch()
      return
    }
    setAppliedKey(key)
  }, [appliedKey, criteria, refetch, resetView])

  const onReset = useCallback(() => {
    setCriteria(landingCriteria())
    setAppliedKey(null)
    setInvalid(null)
    resetView()
  }, [resetView])

  const onSelectDocument = useCallback((index: number) => {
    setWantedDocument(index)
    // A different document's lines are different lines — an item number that
    // meant one thing on the aggregated document means another on the next.
    setOpenItemNumbers(new Set())
    // 🚩 …and so are its TAGS. The filter bar is drawn from the selected
    // document's own tags, so a filter carried across could match nothing on the
    // new document AND have no button left to clear itself with — an empty line
    // table with no way out of it.
    setFilterTag(null)
  }, [])

  const onToggleLine = useCallback((itemNumber: number) => {
    setOpenItemNumbers((open) => {
      const next = new Set(open)
      if (!next.delete(itemNumber)) next.add(itemNumber)
      return next
    })
  }, [])

  const documents = lookup.data?.documents ?? []
  const selected = selectedIndex(documents.length, wantedDocument)
  // Named `doc`, not `document`: the DOM global is a real name in this file's
  // scope and shadowing it is how a stray `document.querySelector` starts
  // reading a payload.
  const doc = documents[selected]

  return (
    <ScreenGate
      query={idocInspectorAccessQuery()}
      can={canOpenIDocInspector}
      ns="reports"
      // 🚩 Its own block of the five `access.*` sentences, not the invoices one.
      // Same area, same namespace, DIFFERENT grant — a consultant refused here
      // must not be told they lack the grant for invoices.
      keyPrefix="idocInspector.access"
      title={t('idocInspector.title')}
      subtitle={t('idocInspector.subtitle')}
    >
      <LookupToolbar
        criteria={criteria}
        onChange={onChange}
        onLookup={onLookup}
        onReset={onReset}
        invalid={invalid}
      />

      {lookup.isError && (
        <ErrorBanner
          message={apiErrorMessage(lookup.error, t('idocInspector.errors.lookupFailed'))}
          className="p-3"
        />
      )}

      {appliedKey === null ? (
        // State 1 — untouched. ⚠️ NOT an empty result: nothing has been asked
        // yet, and on this screen an empty result is a named verdict. Collapsing
        // the two would tell a consultant their transaction is empty before they
        // had typed it.
        <Placeholder
          icon={<FileSearch className="h-8 w-8 text-muted-foreground" aria-hidden />}
          title={t('idocInspector.landing.title')}
          hint={t('idocInspector.landing.hint')}
        />
      ) : lookup.isPending ? (
        <ListShimmer label={t('idocInspector.loading')} />
      ) : lookup.isError ? null : !hasDocuments(lookup.data) ? (
        // State 2 — a successful answer carrying no documents. ⚠️ Ticket 298
        // replaces this with the ten named verdicts and their copy; this slice
        // says only what is true of all ten.
        <Placeholder
          icon={<PackageSearch className="h-8 w-8 text-muted-foreground" aria-hidden />}
          title={t('idocInspector.noDocuments.title')}
          hint={t('idocInspector.noDocuments.hint')}
        />
      ) : (
        // State 3 — the graph. Rail, then pane; both render from the one answer.
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-border/60 bg-card p-2.5">
            <DocumentRail
              documents={documents}
              selected={selected}
              onSelect={onSelectDocument}
            />
          </div>
          {doc && (
            <DocumentPane
              // 🚩 Keyed by the selected document, so switching cards mounts a
              // fresh pane rather than reconciling one document's rows onto
              // another's.
              key={`${doc.pharmacyId}/${doc.receiptNumber}/${selected}`}
              doc={doc}
              openItemNumbers={openItemNumbers}
              filterTag={filterTag}
              onToggleLine={onToggleLine}
              onFilter={setFilterTag}
            />
          )}
        </div>
      )}
    </ScreenGate>
  )
}

/** Busy shimmer, so a lookup that is running reads as running rather than as an
 *  answer of nothing — which on this screen is a different thing entirely. */
function ListShimmer({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label={label}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

/** The screen's two wordy states — untouched and nothing-generated — drawn the
 *  same way and saying different things. Same chrome deliberately: what
 *  distinguishes them is the sentence, not the furniture. */
function Placeholder({
  icon,
  title,
  hint,
}: {
  icon: ReactNode
  title: string
  hint: string
}) {
  return (
    <div className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-2 text-center">
      {icon}
      <div className="text-base font-semibold tracking-tight">{title}</div>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}
