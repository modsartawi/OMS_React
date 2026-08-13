import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Landmark } from 'lucide-react'
import ScreenGate from '@/core/ui/ScreenGate'
import { collectionAccessQuery } from '@/core/collection/api'
import { canOpenSettlement } from './api'
import BranchAccount from './BranchAccount'

/**
 * Settlement account (`/collection/settlement`) — the accountant's screen, spec
 * 267. **268 lands the surface**: the area's fifth route, its namespace, its menu
 * leaf and its gate. It fetches nothing.
 *
 * **269 added the destination** — `?store=` opens one branch's account (see
 * `BranchAccount`). What arrives on top of it: 270 makes the door real (the search
 * box and the triaged worklist, and the scope control below stops being inert), 271
 * posts an entry, 272 corrects one and draws the audit column, 273 uploads a month's
 * audit sheet.
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
 * The screen's body — the shell until a branch is named, the branch account once one
 * is.
 *
 * 🚩 **`?store=` is where a branch comes from, and the URL is its only home.** The
 * same idiom `?acr=` established on `CashCollectionsPage` (257): no `selectedStore`
 * state beside it, so a reload, a paste into a ticket and the Back button all
 * reproduce the view, and a copy could not drift from it because there is no copy.
 *
 * ⚠️ **269 must not grow a branch picker to test itself** (the ticket's own
 * Boundaries). Reaching a branch is 270's job — its search hit and its worklist rows
 * become ordinary links to this param — and until then the drive and a pasted
 * address are how an account is opened. That is the whole of why there is no
 * dropdown here, and adding one would be building 270 badly a slice early.
 *
 * A child component rather than inlined markup: `BranchAccount` holds the query, and
 * an element that is never rendered is never mounted — so a session the gate is
 * about to refuse issues no account call.
 */
function SettlementBody() {
  const { t } = useTranslation('settlement')
  const [searchParams] = useSearchParams()
  const storeId = searchParams.get('store')?.trim() || ''

  return (
    <>
      <ScopeControl />

      {storeId ? (
        <BranchAccount storeId={storeId} />
      ) : (
        // The shell's body, unchanged from 268 apart from its sentence. Deliberately
        // NOT an "empty result": nothing has been asked of the server, so the words
        // say which slice fills this space rather than implying the estate holds no
        // settlement entries.
        <div className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-2 text-center">
          <Landmark className="h-8 w-8 text-muted-foreground" aria-hidden />
          <div className="text-base font-semibold tracking-tight">{t('shell.title')}</div>
          <p className="text-sm text-muted-foreground">{t('shell.hint')}</p>
        </div>
      )}
    </>
  )
}

/**
 * The scope control — **rendered, and inert until 270** (this ticket's own words).
 *
 * Three states and their order are spec 267 D2's: **mine** (the default, and shown
 * selected here so the shell states the default rather than leaving it to be
 * inferred), **unassigned**, **all**. It is a convenience and 🚩 **never a
 * permission** — widening to the whole estate is one click and is never locked,
 * which is why nothing here is styled as a privilege.
 *
 * ⚠️ And when 270 wires it, the asymmetry D2 calls "the first thing to break if
 * someone tidies the scope handling" comes with it: **wrong money and cash waiting
 * are always estate-wide whatever this control says.** Only the ageing count and
 * the search ranking honour it.
 *
 * `aria-disabled` rather than `disabled`, per `core/ui/Button`: a control that is
 * unavailable *with a reason* stays focusable so a screen reader can reach the
 * reason. `aria-describedby` is what carries it.
 */
function ScopeControl() {
  const { t } = useTranslation('settlement')
  const SCOPES = [
    { key: 'mine', selected: true },
    { key: 'unassigned', selected: false },
    { key: 'all', selected: false },
  ] as const

  return (
    <div className="flex items-center justify-end gap-2">
      <span id="settlement-scope-inert" className="text-xs text-muted-foreground">
        {t('scope.inert')}
      </span>
      <div
        role="group"
        aria-label={t('scope.label')}
        aria-describedby="settlement-scope-inert"
        className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-0.5"
      >
        {SCOPES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-disabled
            aria-pressed={s.selected}
            className={
              'h-6 rounded-full px-3 text-xs font-medium aria-disabled:cursor-not-allowed ' +
              'aria-disabled:opacity-50 ' +
              (s.selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')
            }
          >
            {t(`scope.${s.key}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
