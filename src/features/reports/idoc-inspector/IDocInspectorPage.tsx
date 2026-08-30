import { useCallback, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FileSearch } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { canOpenIDocInspector, idocInspectorAccessQuery, idocInspectorApi } from './api'
import AttentionBanner from './AttentionBanner'
import DocumentPane from './DocumentPane'
import DocumentRail from './DocumentRail'
import DownloadStrip from './DownloadStrip'
import { selectedIndex } from './document-graph'
import { LegendProvider } from './LegendContext'
import LookupToolbar from './LookupToolbar'
import { banners, readVerdict } from './verdict'
import { VerdictEmptyState, VerdictStrip } from './VerdictStrip'
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
 * 🔑 **Every "nothing to show" is a named verdict** (ticket 298). Ten codes, each
 * with its own sentence in the locale file, and the empty state *replaces* the
 * document area rather than leaving a blank page — a lookup that finds nothing is
 * an answer, not a dead end. Three of the ten render a full graph instead, two of
 * those under an attention banner: a held document and a transaction whose
 * export-version column contradicts the documents beside it are **findings**, not
 * absences.
 *
 * The download (299) sits on the verdict strip. **The code legend (300)** is here
 * too: `LegendProvider` fetches `Metadata` once per session inside the gate, and
 * every code below draws its label from it while still rendering itself raw.
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

  // 🔑 **The server's verdict, read and never re-derived** (ticket 298). What is
  // drawn — the graph or a named empty state — comes from the verdict table, not
  // from counting the array: two consultants reading one transaction must never
  // disagree because their browsers decided it differently.
  const verdict = readVerdict(lookup.data)
  const findings = banners(lookup.data)

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
      <LegendProvider>
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
        ) : lookup.isError ? null : (
          // State 2 — an answer. 🔑 **The verdict is said either way**: over a
          // graph it is a strip above the documents, and with nothing to draw the
          // named verdict REPLACES the document area — one of ten sentences, never
          // a blank page and never one sentence standing in for ten.
          //
          // ⚠️ **The findings render in BOTH shapes.** A held document and a
          // disagreeing export-version stamp arrive over a full graph, but an
          // attention block the server attaches to an empty verdict would be
          // silently dropped if this list lived inside the documents branch — and
          // dropping a finding is the one thing this ticket exists to stop.
          <div className="flex flex-col gap-3">
            {verdict.showsDocuments && (
              <VerdictStrip
                reading={verdict}
                // 🔑 **The download hangs off the verdict strip and nowhere else**
                // (ticket 299) — one button per IDoc TYPE present, never per line
                // and never per document. `appliedKey` is non-null in this branch
                // by construction: the query only runs once it is set.
                actions={
                  appliedKey && (
                    <DownloadStrip
                      // 🚩 Keyed on the ANSWER, so a fresh one mounts a fresh
                      // strip. Pressing Look up on the same key takes the refetch
                      // path — `isPending` never flips and nothing unmounts — so
                      // without this a failure from the previous answer would sit
                      // under a graph that has just come back clean, possibly
                      // naming a type this answer no longer has a button for.
                      key={lookup.dataUpdatedAt}
                      lookupKey={appliedKey}
                      documents={documents}
                    />
                  )
                }
              />
            )}
            {findings.map((banner) => (
              <AttentionBanner key={banner.kind} banner={banner} />
            ))}
            {!verdict.showsDocuments ? (
              <VerdictEmptyState reading={verdict} />
            ) : (
              <>
                <div className="rounded-lg border border-border/60 bg-card p-2.5">
                  <DocumentRail
                    documents={documents}
                    selected={selected}
                    onSelect={onSelectDocument}
                  />
                </div>
                {doc && (
                  <DocumentPane
                    // 🚩 Keyed by the selected document, so switching cards mounts
                    // a fresh pane rather than reconciling one document's rows
                    // onto another's.
                    key={`${doc.pharmacyId}/${doc.receiptNumber}/${selected}`}
                    doc={doc}
                    openItemNumbers={openItemNumbers}
                    filterTag={filterTag}
                    onToggleLine={onToggleLine}
                    onFilter={setFilterTag}
                  />
                )}
              </>
            )}
          </div>
        )}
      </LegendProvider>
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

/** The landing state — nothing has been asked yet. ⚠️ Drawn in the same chrome as
 *  the named empty result deliberately, and it is the SENTENCE that tells them
 *  apart: "you have not asked" and "the rail produced nothing, and here is why"
 *  are different facts, and this screen exists because the second used to look
 *  like the first. Kept separate from `VerdictEmptyState` because a landing state
 *  has no verdict to read — collapsing them would need a fake one. */
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
