import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileSearch } from 'lucide-react'

import ScreenGate from '@/core/ui/ScreenGate'
import { canOpenIDocInspector, idocInspectorAccessQuery } from './api'
import LookupToolbar from './LookupToolbar'
import {
  buildLookupKey,
  landingCriteria,
  missingParts,
  type LookupCriteria,
  type MissingParts,
} from './lookup-key'

/**
 * IDoc Inspector (`/reports/idoc-inspector`) — the second screen of the
 * **Reports** area (spec 1386). **Ticket 296 is the access spine**: the feature
 * exists, has a route, appears in the nav only for a grant holder, and guards
 * itself for anyone who reaches the URL directly.
 *
 * The body here is deliberately a **shell** — the lookup form and one empty
 * state. The documents, the verdicts, the downloads and the code legend are
 * 297–300's, and each lands inside this frame.
 *
 * 🔑 **Denied is a 200, not a failure.** `IDocInspector/Access` answers a session
 * that holds nothing with `{ screenAllowed: false }` precisely so that session
 * can *learn* it is denied. `ScreenGate` renders that as a shut door — the
 * administrator sentence — and never as "try again in a moment", which against a
 * permanently closed door is advice that can only be followed forever. The
 * distinction lives in the gate: a refusal is `screenAllowed: false` with no
 * error at all; an *unreachable* probe is the other sentence.
 *
 * ⚠️ **The gate is not the security boundary** — `Transaction`, `Download` and
 * `Metadata` re-evaluate the grant server-side, fail-closed. This exists so a
 * hand-typed URL renders a sentence instead of a broken screen.
 */
export default function IDocInspectorPage() {
  const { t } = useTranslation('reports')

  // The live draft. Nothing is issued in this slice — 297 promotes it to a
  // `LookupKey` and hangs the query off it — but the refusal is here already,
  // because a form that accepts a blank key is the thing that makes the server's
  // 400 branch reachable.
  const [criteria, setCriteria] = useState<LookupCriteria>(landingCriteria)
  const [invalid, setInvalid] = useState<MissingParts | null>(null)

  const onChange = useCallback((patch: Partial<LookupCriteria>) => {
    setCriteria((c) => ({ ...c, ...patch }))
    setInvalid(null)
  }, [])

  const onLookup = useCallback(() => {
    // 🔑 The BUILDER decides whether this may be sent — one reading of that rule,
    // the same one 297 will hang its query off — and `missingParts` only says
    // WHICH half to mark. Marking off the builder's `null` rather than off a
    // second predicate is what stops the form and the request disagreeing.
    //
    // 🚩 The refusal is the ONLY outcome this slice has. A complete key clears
    // the marking and does nothing else — 297 is what makes it ask the server,
    // and until then the empty state below is the honest answer rather than a
    // spinner that never resolves.
    setInvalid(buildLookupKey(criteria) === null ? missingParts(criteria) : null)
  }, [criteria])

  const onReset = useCallback(() => {
    setCriteria(landingCriteria())
    setInvalid(null)
  }, [])

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

      {/* The landing state — "nothing has been asked yet", which on this screen
          is emphatically NOT the same as "this transaction produced nothing".
          That second one is a named verdict with its own sentence (298), and
          collapsing the two would tell a consultant their transaction is empty
          before they had typed it. */}
      <div className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-2 text-center">
        <FileSearch className="h-8 w-8 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">
          {t('idocInspector.landing.title')}
        </div>
        <p className="text-sm text-muted-foreground">{t('idocInspector.landing.hint')}</p>
      </div>
    </ScreenGate>
  )
}
