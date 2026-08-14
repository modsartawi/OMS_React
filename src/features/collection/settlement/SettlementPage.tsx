import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import type { SettlementScope } from '@/core/models/settlement'
import ScreenGate from '@/core/ui/ScreenGate'
import { collectionAccessQuery } from '@/core/collection/api'
import { canOpenSettlement } from './api'
import BatchWithdraw from './BatchWithdraw'
import BranchAccount from './BranchAccount'
import {
  doorSearch,
  readBatchView,
  readEntryNumber,
  readStore,
  scopeSearch,
} from './addresses'
import { SCOPE_PARAM, readScope } from './scope'
import SettlementDoor from './SettlementDoor'

/**
 * Settlement account (`/collection/settlement`) — the accountant's screen, spec
 * 267. **268 lands the surface**: the area's fifth route, its namespace, its menu
 * leaf and its gate. It fetches nothing.
 *
 * **269 added the destination** — `?store=` opens one branch's account (see
 * `BranchAccount`). **270 made the door real**: the search box, the triaged worklist
 * and the cross-estate ledger, with the scope control below no longer inert. What
 * arrives on top: 271 posts an entry, 272 corrects one and draws the audit column,
 * 273 uploads a month's audit sheet.
 *
 * 🚩 **The grant is the only off-switch** (D1). There is no feature flag here and
 * there must not be one — the menu leaf and this gate read the same
 * `canOpenSettlement` off the same one `CollectionWeb/Access` call, and both fail
 * closed. ⚠️ Which means that **today the screen is shut for everyone**: the fifth
 * flag is BackOffice spec 1173's and has not shipped, so a live probe answers four
 * booleans and the fifth reads as a denial. That is the designed posture for an
 * unbuilt grant, not a defect — 274 is the joining event, and until then the two
 * gates are proven by driving the app against a stubbed envelope
 * (`tools/settlement-drive.mjs`), exactly as 253 proved the other four.
 */
export default function SettlementPage() {
  const { t } = useTranslation('settlement')

  return (
    <ScreenGate
      query={collectionAccessQuery()}
      can={canOpenSettlement}
      ns="settlement"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <SettlementBody />
    </ScreenGate>
  )
}

/**
 * The screen's body — **four views on one address**: the door, one branch's
 * account, the cross-estate ledger, and 273's batch withdrawal.
 *
 * 🚩 **The URL is the only home of every piece of state.** `?store=` opens an
 * account (269, the `?acr=` idiom 257 established), `?q=` holds a search, `?scope=`
 * the scope, `?view=ledger` the support view and `?view=batch&batch=` an uploaded
 * batch's withdrawal (273). Nothing is mirrored into component
 * state beside them, so a reload, a paste into a ticket and the Back button all
 * reproduce what the accountant was looking at — and no copy can drift from the
 * URL, because there is no copy.
 *
 * Which is what makes 270 *a door onto an address* rather than a rewiring of 269: a
 * search hit and a worklist row are ordinary links to `?store=`.
 *
 * Each view is a child component rather than inlined markup, for the reason 254
 * gives: each holds its own query, and an element that is never rendered is never
 * mounted — so a session the gate is about to refuse issues no call at all, and the
 * fleet is not fetched while an account is on screen.
 */
function SettlementBody() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const storeId = readStore(searchParams)
  const scope = readScope(searchParams.get(SCOPE_PARAM))
  // 273's fourth view: one uploaded batch, withdrawn as one act. It is an address
  // rather than dialog state, so *"finance sent the wrong file"* is still one repair
  // an hour and a reload after the commit.
  const batchId = readBatchView(searchParams)

  return (
    <>
      {/* ⚠️ The scope belongs to the DOOR, so it is drawn with the door and nowhere
          else. A branch's account is the same account whoever is assigned to it, and
          a scope control above one would imply the position on screen depended on
          who was looking. */}
      {!storeId && !batchId && (
        <ScopeControl scope={scope} onScope={(next) => navigate(scopeSearch(searchParams, next))} />
      )}

      {(storeId || batchId) && <BackToDoor searchParams={searchParams} />}

      {storeId ? (
        <BranchAccount storeId={storeId} entryNumber={readEntryNumber(searchParams)} />
      ) : batchId ? (
        <BatchWithdraw batchId={batchId} />
      ) : (
        <SettlementDoor scope={scope} />
      )}
    </>
  )
}

/**
 * The way back to the door from either destination.
 *
 * 🚩 **It drops what took the reader away and keeps the scope.** A bare `to="."`
 * throws the whole query string away, which would quietly reset a widened
 * `?scope=all` to *mine* — an accountant who deliberately widened to the estate,
 * opened a branch and came back would find the ageing count had fallen from 140 to
 * 47 with nothing on screen to explain it.
 */
function BackToDoor({ searchParams }: { searchParams: URLSearchParams }) {
  const { t } = useTranslation('settlement')

  return (
    <Link
      to={doorSearch(searchParams)}
      className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground hover:underline"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      {t('door.back')}
    </Link>
  )
}

/**
 * The scope control — **live as of 270**, and the one control on this screen whose
 * misreading would be expensive.
 *
 * Three states and their order are spec 267 D2's: **mine** (the default),
 * **unassigned**, **all**. It is a convenience and 🚩 **never a permission** —
 * widening to the whole estate is one click and is never locked, which is why
 * nothing here is styled as a privilege and why nothing about it can be disabled.
 *
 * 🔑 **What it does NOT touch is the load-bearing half.** Wrong money and cash
 * waiting are estate-wide whatever this control says (`worklist.ts`); the search
 * *ranks* by it and never refuses a branch outside it (`search.ts`). Only the
 * ageing count and that ranking honour it — which is why the worklist says so on
 * its own face rather than leaving a reader to infer it from an empty lane.
 *
 * ⚠️ And a session with **no staff row** stays on *mine* while the screen behaves
 * as *all* (`scope.ts`): the pressed state below is what the accountant chose, not
 * what the resolution did with it, and the screen deliberately does not announce
 * the difference as an error.
 */
function ScopeControl({
  scope,
  onScope,
}: {
  scope: SettlementScope
  onScope: (next: SettlementScope) => void
}) {
  const { t } = useTranslation('settlement')
  const SCOPES: SettlementScope[] = ['mine', 'unassigned', 'all']

  return (
    <div className="flex items-center justify-end gap-2">
      <div
        role="group"
        aria-label={t('scope.label')}
        data-region="settlement-scope"
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-0.5"
      >
        {SCOPES.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onScope(key)}
            aria-pressed={scope === key}
            data-scope={key}
            className={
              'h-6 rounded-full px-3 text-xs font-medium transition-colors ' +
              (scope === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted')
            }
          >
            {t(`scope.${key}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
