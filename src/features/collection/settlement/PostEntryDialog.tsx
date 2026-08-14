import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { TriangleAlert } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { formatMoneyIn } from '@/core/money'
import type {
  SettlementEntryKind,
  SettlementFleetRow,
  SettlementPostResult,
} from '@/core/models/settlement'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import { amountInWords, type AmountWords } from './amount-words'
import { settlementApi } from './api'
// 🔑 The in-words sentence is SHARED with 273's upload, which reads the same guard
// back over a whole file's total. One definition, so the two cannot drift on a
// plural or a currency noun — see `in-words.ts`.
import { inWordsSentence } from './in-words'
import { ACCOUNT_LIMIT, isCapReached } from './cap'
import {
  parseAmount,
  REASON_MAX,
  resolveBranch,
  standingPosition,
  type BranchResolution,
} from './posting'
import ReasonField, { invalidateSettlement } from './ReasonField'

/** The two kinds, in the order the toggle draws them. */
const KINDS: readonly SettlementEntryKind[] = ['SHORTAGE', 'SURPLUS']

/**
 * **Posting** — one entry onto one branch's ledger (ticket 271, spec 267 D4), and
 * the screen's first real write into the account.
 *
 * 🔑 **One form with a kind toggle, never two forms.** Two would make the kind a
 * *navigation choice taken before the accountant has the figures in front of them* —
 * the moment it is easiest to get wrong, and the one mistake the model cannot
 * absorb: the server makes kind a hard constraint, so a shortage is only ever
 * settled by a receipt and a surplus only ever by a close. The toggle therefore
 * states the **consequence** rather than the word: *the branch must hand this money
 * over* · *the branch may keep this money back*.
 *
 * 🔑 **Two guards, against two different mistakes, and both are required:**
 *
 * 1. The amount is **read back grouped and in words** before commit. *50,000.000 ·
 *    fifty thousand riyals* is a different sentence from *five hundred riyals*, while
 *    the two digit strings are one keystroke apart. It is a **review step, not a
 *    cap** — a numeric threshold was rejected twice, because approval limits are
 *    deliberately unsettled (so any number is invented) and a cap refuses the
 *    legitimate large entry while doing nothing about a plausible wrong one.
 * 2. The resolved branch's **standing open position of the same kind** is shown
 *    *before* the review step, naming each existing entry and its remaining. A
 *    monthly audit reposting the same shortage onto a branch that already carries one
 *    is permitted by design — so only this screen can catch it. It **warns; it never
 *    refuses.**
 *
 * ⚠️ **The branch is typed, not picked**, and resolved to exactly one match before
 * anything can be posted: a 1394-option `<select>` is not a control.
 *
 * 🚩 **No client-side rounding and no numeric cap.** The words are drawn at the
 * branch's own precision (D10, the rule `formatMoneyIn` already applies everywhere on
 * this screen), and the confirmation reads back **the server's** returned amount —
 * so the sentence an accountant approved and the figure in the ledger cannot disagree.
 */
export default function PostEntryDialog({
  open,
  seedStoreId = '',
  onClose,
}: {
  open: boolean
  /** The branch already on screen, when the form is opened from an account. It is a
   *  **seed for the typed box**, not a bypass of it — the resolution runs over it
   *  exactly as over anything typed, and the accountant can retype it. */
  seedStoreId?: string
  onClose: () => void
}) {
  const { t } = useTranslation('settlement')
  const queryClient = useQueryClient()

  const [kind, setKind] = useState<SettlementEntryKind>('SHORTAGE')
  const [branchQuery, setBranchQuery] = useState(seedStoreId)
  const [amountText, setAmountText] = useState('')
  const [reason, setReason] = useState('')
  /** 🔑 The review step is a **phase**, not a checkbox: the commit button does not
   *  exist until the amount has been read back in words. */
  const [reviewing, setReviewing] = useState(false)
  const [posted, setPosted] = useState<SettlementPostResult | null>(null)

  // A fresh form per opening, seeded with whatever branch the screen was on. A
  // half-typed 50,000 left over from a dialog someone dismissed is the one piece of
  // state on this screen that must never survive.
  useEffect(() => {
    if (!open) return
    setKind('SHORTAGE')
    setBranchQuery(seedStoreId)
    setAmountText('')
    setReason('')
    setReviewing(false)
    setPosted(null)
  }, [open, seedStoreId])

  // The estate, for resolving the typed branch. Same query key as the door's, so
  // opening this from an account costs a request only if the door never ran.
  const fleet = useQuery({
    queryKey: ['settlement', 'fleet'],
    queryFn: () => settlementApi.fleet(),
    staleTime: 60_000,
    enabled: open,
  })

  const resolution = useMemo(
    () => resolveBranch(fleet.data, branchQuery),
    [fleet.data, branchQuery],
  )
  const branch = resolution.kind === 'one' ? resolution.row : null
  const currencyKey = branch?.currencyKey ?? ''

  // The resolved branch's account — read for ONE reason: the standing position of
  // the kind about to be posted. Same query key as `BranchAccount`'s, so posting
  // from an account is free and the refresh below serves both.
  const account = useQuery({
    queryKey: ['settlement', 'account', branch?.storeId ?? ''],
    queryFn: () => settlementApi.account(branch!.storeId),
    enabled: open && !!branch,
  })
  const standing = useMemo(
    () => standingPosition(account.data?.entries, kind),
    [account.data, kind],
  )

  const amount = parseAmount(amountText)
  const words = useMemo(() => amountInWords(amount, currencyKey), [amount, currencyKey])
  const trimmedReason = reason.trim()
  // ⚠️ **A figure below the branch's smallest countable unit is not an amount.**
  // `0.004` at a SAR branch parses, and reads back as *zero riyals* — an entry no
  // till could ever consume and nobody could hand over. The refusal is measured
  // against the same precision the read-back uses, so the sentence and the rule
  // cannot part company.
  const countable = amount !== null && words.value > 0
  const ready = !!branch && countable && trimmedReason.length > 0

  const post = useMutation({
    mutationFn: () =>
      settlementApi.post({
        storeId: branch!.storeId,
        entryKind: kind,
        amount: amount!,
        reason: trimmedReason,
      }),
    onSuccess: (result) => {
      setPosted(result)
      toast.success(t('post.done.toast', { number: result?.entryNumber ?? '' }))
      // 🚩 The account refreshes, and so do the door's lists: a posted entry changes
      // the branch's open count and its ageing, and a stale door would invite the
      // accountant to post the same figure again. Which keys that means is the shared
      // helper's to know — this is the third writer, and it must not carry its own
      // reading of the set.
      invalidateSettlement(queryClient, branch!.storeId)
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('post.errors.failed'))),
  })

  if (!open) return null

  return (
    <Modal
      open
      onClose={onClose}
      title={t('post.title')}
      width="40rem"
      footer={
        posted ? (
          <Button variant="primary" onClick={onClose} data-testid="post-close">
            {t('post.done.close')}
          </Button>
        ) : reviewing ? (
          <>
            <Button variant="text" onClick={() => setReviewing(false)} data-testid="post-back">
              {t('post.review.back')}
            </Button>
            <Button
              variant="primary"
              onClick={() => !post.isPending && post.mutate()}
              aria-disabled={post.isPending || undefined}
              data-testid="post-commit"
            >
              {t('post.review.commit')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="text" onClick={onClose}>
              {t('post.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => ready && setReviewing(true)}
              aria-disabled={!ready || undefined}
              data-testid="post-review"
            >
              {t('post.form.review')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4 text-sm" data-region="post-entry">
        {posted ? (
          <PostedPanel result={posted} branch={branch} kind={kind} reviewed={words.value} />
        ) : reviewing ? (
          <ReviewStep
            branch={branch!}
            kind={kind}
            words={words}
            reason={trimmedReason}
            currencyKey={currencyKey}
          />
        ) : (
          <>
            <KindToggle kind={kind} onKind={setKind} />
            <BranchField
              query={branchQuery}
              onQuery={setBranchQuery}
              resolution={resolution}
              loading={fleet.isPending}
              failed={fleet.isError}
              onPick={(row) => setBranchQuery(row.storeId)}
            />
            {/* ⚠️ The standing position is drawn HERE — before the review step, as
                D4 requires — because it is a fact about the branch that should change
                what the accountant types, not a last-second interruption. */}
            {branch && (
              <StandingPosition
                kind={kind}
                standing={standing}
                currencyKey={currencyKey}
                loading={account.isPending}
                failed={account.isError}
                // ⚠️ The account door applies a 500-row `TOP` (D3). On a branch that
                // reached it, *"carries no open shortage"* would be a claim about
                // rows the answer does not contain.
                capped={isCapReached(account.data?.entries?.length ?? 0, ACCOUNT_LIMIT)}
              />
            )}
            <AmountField
              value={amountText}
              onValue={setAmountText}
              words={words}
              amount={amount}
              currencyKey={currencyKey}
              hasBranch={!!branch}
            />
            <PostReasonField value={reason} onValue={setReason} />
          </>
        )}
      </div>
    </Modal>
  )
}

/**
 * The kind toggle — 🔑 **it states the consequence, not the word.**
 *
 * *"The branch must hand this money over"* is a sentence an accountant can check
 * against the figures in front of them; *"Shortage"* is a term they have to have
 * translated correctly in their head first. The domain words ride along beneath, in
 * both scripts (D9), because they are what the phone call will use.
 */
function KindToggle({
  kind,
  onKind,
}: {
  kind: SettlementEntryKind
  onKind: (next: SettlementEntryKind) => void
}) {
  const { t } = useTranslation('settlement')

  return (
    <fieldset className="flex flex-col gap-2" data-region="post-kind">
      <legend className="text-xs font-medium">{t('post.kind.legend')}</legend>
      <div role="group" aria-label={t('post.kind.legend')} className="grid gap-2 sm:grid-cols-2">
        {KINDS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onKind(key)}
            aria-pressed={kind === key}
            data-kind={key}
            className={
              'flex flex-col items-start gap-0.5 rounded-lg border p-3 text-start transition-colors ' +
              (kind === key
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:bg-muted')
            }
          >
            <span className="text-sm font-medium">{t(`post.kind.${key}.consequence`)}</span>
            <span className="text-xs text-muted-foreground">{t(`account.kind.${key}`)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * The branch — ⚠️ **typed, and resolved to exactly one match.**
 *
 * A 1394-option `<select>` is not a control, and a box that resolved to the
 * best-ranked of twelve matches would post the right amount onto the wrong branch,
 * silently. So the three states are drawn as three different things: a resolved
 * branch (with the currency its figures will be drawn in), a list of near misses that
 * is **not** postable until one is picked, and nothing found.
 */
function BranchField({
  query,
  onQuery,
  resolution,
  loading,
  failed,
  onPick,
}: {
  query: string
  onQuery: (next: string) => void
  resolution: BranchResolution
  loading: boolean
  failed: boolean
  onPick: (row: SettlementFleetRow) => void
}) {
  const { t } = useTranslation('settlement')
  // 🚩 **Nothing is said about a typed branch until the estate has arrived.**
  // `resolveBranch` over an absent fleet answers *none*, which is the truth about
  // the data and a lie about the branch — a form that read *"no branch matches
  // that"* while the estate was still loading, or after the door that lists it
  // failed, would be telling an accountant their own branch does not exist.
  const unresolvable = loading || failed

  return (
    <label className="flex flex-col gap-1" data-region="post-branch">
      <span className="text-xs font-medium">{t('post.branch.label')}</span>
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={t('post.branch.placeholder')}
        data-testid="post-branch"
        autoComplete="off"
        className="h-9 rounded-md border border-border bg-card px-2 text-sm outline-none focus:border-primary/60"
      />

      {loading && <span className="text-xs text-muted-foreground">{t('post.branch.loading')}</span>}
      {failed && (
        <span className="text-xs text-attention-800" data-testid="post-branch-unavailable">
          {t('post.branch.unavailable')}
        </span>
      )}

      {!unresolvable && resolution.kind === 'one' && (
        <span
          data-testid="post-branch-resolved"
          data-store={resolution.row.storeId}
          className="flex flex-wrap items-baseline gap-x-2 text-xs"
        >
          <span className="font-mono text-muted-foreground">{resolution.row.storeId}</span>
          <span className="font-medium">{resolution.row.storeName}</span>
          <span className="text-muted-foreground">{resolution.row.city}</span>
          {/* The currency the amount will be counted in, named rather than implied:
              a BHD branch takes three decimals and a SAR branch two (D10). */}
          <span className="text-muted-foreground">{resolution.row.currencyKey}</span>
        </span>
      )}

      {!unresolvable && resolution.kind === 'many' && (
        <span className="flex flex-col gap-1" data-testid="post-branch-ambiguous">
          <span className="text-xs text-attention-800">
            {t('post.branch.ambiguous', { count: resolution.total })}
          </span>
          <span className="flex flex-wrap gap-1">
            {resolution.matches.map((row) => (
              <button
                key={row.storeId}
                type="button"
                onClick={() => onPick(row)}
                data-match={row.storeId}
                className="rounded-full border border-border bg-card px-2 py-0.5 text-xs hover:bg-muted"
              >
                {row.storeId} · {row.storeName}
              </button>
            ))}
          </span>
        </span>
      )}

      {!unresolvable && resolution.kind === 'none' && (
        <span className="text-xs text-attention-800" data-testid="post-branch-none">
          {t('post.branch.none')}
        </span>
      )}
    </label>
  )
}

/**
 * 🔑 **What this branch already carries of the same kind** — the second guard.
 *
 * It **names each entry and its remaining** rather than showing a total alone,
 * because *"this branch already owes 500.00 on entry 143"* is a fact an accountant
 * can reconcile against their sheet and *"1 open entry"* is not.
 *
 * 🚩 It warns; it never refuses. There is no path from this component to a disabled
 * commit button, and there must not be one — a genuine second shortage months later
 * is a real entry, and the duplicate is permitted by design.
 */
function StandingPosition({
  kind,
  standing,
  currencyKey,
  loading,
  failed,
  capped,
}: {
  kind: SettlementEntryKind
  standing: ReturnType<typeof standingPosition>
  currencyKey: string
  loading: boolean
  failed: boolean
  /** The account answer reached the door's `TOP` — so *what this branch carries* is
   *  a statement about the rows that arrived, not about the branch. */
  capped: boolean
}) {
  const { t } = useTranslation('settlement')

  if (loading)
    return <p className="text-xs text-muted-foreground">{t('post.standing.loading')}</p>

  // ⚠️ Said, rather than passed over in silence. *"Nothing standing"* would be a
  // claim about the branch's ledger made by a screen that failed to read it.
  if (failed) return <p className="text-xs text-muted-foreground">{t('post.standing.unknown')}</p>

  if (standing.entries.length === 0)
    return (
      <p className="text-xs text-muted-foreground" data-testid="post-standing-clear">
        {/* ⚠️ …and the same rule one notch weaker: a capped answer may simply not
            contain the open entry this branch carries, so the sentence says what it
            read rather than what the branch holds. */}
        {capped ? t('post.standing.capped') : t(`post.standing.clear.${kind}`)}
      </p>
    )

  return (
    <section
      data-testid="post-standing"
      data-standing-count={standing.entries.length}
      className="flex flex-col gap-1 rounded-lg border border-attention-border bg-attention-050 p-3"
    >
      {capped && <p className="text-xs text-muted-foreground">{t('post.standing.capped')}</p>}
      <p className="flex items-start gap-1.5 text-xs font-medium text-attention-800">
        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        {t(`post.standing.warning.${kind}`, {
          count: standing.entries.length,
          total: formatMoneyIn(standing.total, currencyKey),
        })}
      </p>
      <ul className="flex flex-col gap-0.5 text-xs">
        {standing.entries.map((e) => (
          <li key={e.settlementEntryId} data-standing-entry={e.entryNumber} className="tabular-nums">
            {t('post.standing.entry', {
              number: e.entryNumber,
              remaining: formatMoneyIn(e.remainingAmount, currencyKey),
              posted: e.postedAt.slice(0, 10),
            })}
          </li>
        ))}
      </ul>
      {/* 🚩 The permission is stated on the warning itself, so nobody reads it as a
          refusal and goes looking for an override. */}
      <p className="text-xs text-muted-foreground">{t('post.standing.permitted')}</p>
    </section>
  )
}

/**
 * The amount — and the live read-back beneath it.
 *
 * ⚠️ **The words follow the branch's precision, not the keyboard's.** A third
 * decimal typed at a SAR branch is not money that branch can count, and the sentence
 * says the countable figure — which is also what the server will store. Drawing the
 * typed figure here instead would be a read-back of something that is never posted.
 */
function AmountField({
  value,
  onValue,
  words,
  amount,
  currencyKey,
  hasBranch,
}: {
  value: string
  onValue: (next: string) => void
  words: AmountWords
  amount: number | null
  currencyKey: string
  hasBranch: boolean
}) {
  const { t } = useTranslation('settlement')

  return (
    <label className="flex flex-col gap-1" data-region="post-amount">
      <span className="text-xs font-medium">{t('post.amount.label')}</span>
      <input
        value={value}
        onChange={(e) => onValue(e.target.value)}
        inputMode="decimal"
        data-testid="post-amount"
        autoComplete="off"
        className="h-9 rounded-md border border-border bg-card px-2 text-sm tabular-nums outline-none focus:border-primary/60"
      />
      {hasBranch ? (
        amount === null ? (
          <span className="text-xs text-muted-foreground">{t('post.amount.hint')}</span>
        ) : words.value === 0 ? (
          // A figure the branch cannot count is not an amount — `0.004` at a SAR
          // branch would post as zero and read back as *zero riyals*.
          <span className="text-xs text-attention-800" data-testid="post-amount-too-small">
            {t('post.amount.tooSmall', { decimals: words.decimals, currency: currencyKey })}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground" data-testid="post-amount-words">
            {t('post.amount.readBack', {
              grouped: words.grouped,
              currency: currencyKey,
              words: inWordsSentence(t, words, currencyKey),
            })}
          </span>
        )
      ) : (
        <span className="text-xs text-muted-foreground">{t('post.amount.needsBranch')}</span>
      )}
    </label>
  )
}

/**
 * The reason — free text the **branch reads verbatim**, with what they will see
 * rendered beside it.
 *
 * ⚠️ This is not a filing act: it is a message a manager reads at a till at 23:00.
 * The preview is `dir="auto"` because the reason is routinely Arabic and a
 * right-to-left sentence rendered left-to-right is a different sentence to read.
 */
function PostReasonField({ value, onValue }: { value: string; onValue: (next: string) => void }) {
  const { t } = useTranslation('settlement')

  return (
    <div className="flex flex-col gap-2" data-region="post-reason">
      <ReasonField
        value={value}
        onValue={onValue}
        label={t('post.reason.label')}
        hint={t('post.reason.hint', { max: REASON_MAX, used: value.length })}
        testId="post-reason"
      />

      <div className="rounded-lg border border-border/60 bg-card/40 p-3">
        <p className="text-xs font-medium text-muted-foreground">{t('post.reason.previewLabel')}</p>
        <p dir="auto" data-testid="post-reason-preview" className="mt-1 text-sm">
          {value.trim() || t('post.reason.previewEmpty')}
        </p>
      </div>
    </div>
  )
}

/**
 * 🔑 **The review step** — the ticket's first guard, and the reason there is no
 * numeric cap anywhere on this form.
 *
 * The amount is read back **grouped and in words**, beside the branch it lands on,
 * the consequence of the kind, and what the branch will read. Then the commit
 * **names the immutability**: once posted the amount cannot be changed, only
 * cancelled while untouched or written off once partly consumed. Immutability is a
 * thing to be chosen, not discovered (user story 19).
 */
function ReviewStep({
  branch,
  kind,
  words,
  reason,
  currencyKey,
}: {
  branch: SettlementFleetRow
  kind: SettlementEntryKind
  words: AmountWords
  reason: string
  currencyKey: string
}) {
  const { t } = useTranslation('settlement')

  return (
    <section className="flex flex-col gap-3" data-region="post-review">
      <p className="text-sm">
        {t(`post.review.consequence.${kind}`, {
          store: branch.storeId,
          storeName: branch.storeName,
        })}
      </p>

      <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3">
        <p className="text-2xl font-semibold tabular-nums" data-testid="post-review-figure">
          {words.grouped} <span className="text-sm text-muted-foreground">{currencyKey}</span>
        </p>
        {/* 🔑 The sentence is the guard. `50,000.00` and `500.00` are one keystroke
            apart; *fifty thousand riyals* and *five hundred riyals* are not. */}
        <p className="text-sm" data-testid="post-review-words">
          {inWordsSentence(t, words, currencyKey)}
        </p>
      </div>

      <div className="rounded-lg border border-border/60 bg-card/40 p-3">
        <p className="text-xs font-medium text-muted-foreground">{t('post.reason.previewLabel')}</p>
        <p dir="auto" data-testid="post-review-reason" className="mt-1 text-sm">
          {reason}
        </p>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="post-immutability">
        {t('post.review.immutable')}
      </p>
    </section>
  )
}

/**
 * The confirmation — 🔑 **the entry's number, and the amount the SERVER stored.**
 *
 * The number is the handle finance and the branch settle by on the phone, so it is
 * the headline rather than a tick. And the figure is read back off the answer, not
 * echoed off the form: the server owns the rounding (D4), so this is the one place
 * the two could have disagreed, and it is closed by construction.
 */
function PostedPanel({
  result,
  branch,
  kind,
  reviewed,
}: {
  result: SettlementPostResult
  branch: SettlementFleetRow | null
  kind: SettlementEntryKind
  /** The figure the accountant approved on the review step, at the branch's own
   *  precision — kept only to be compared with what came back. */
  reviewed: number
}) {
  const { t } = useTranslation('settlement')
  const currencyKey = branch?.currencyKey ?? ''
  const stored = amountInWords(result?.amount, currencyKey)
  // 🔑 **If the server's figure is not the one that was reviewed, the screen says
  // so.** The client rounds nothing on the way out (the typed amount goes up
  // verbatim) and the read-back is drawn at the branch's own precision — which is
  // the server's rule as this wave understands it, and 274's to confirm. If the two
  // ever part company, the honest outcome is a sentence naming both figures, not a
  // confirmation quietly showing a number nobody approved.
  const adjusted = typeof result?.amount === 'number' && stored.value !== reviewed

  return (
    <section className="flex flex-col gap-2" data-region="post-done" data-entry={result?.entryNumber}>
      <p className="text-lg font-semibold" data-testid="post-done-number">
        {t('post.done.number', { number: result?.entryNumber ?? '' })}
      </p>
      <p className="text-sm tabular-nums">
        {t(`post.done.summary.${kind}`, {
          amount: stored.grouped,
          currency: currencyKey,
          store: branch?.storeId ?? '',
          storeName: branch?.storeName ?? '',
        })}
      </p>
      <p className="text-sm">{inWordsSentence(t, stored, currencyKey)}</p>
      {adjusted && (
        <p className="text-xs text-attention-800" data-testid="post-done-adjusted">
          {t('post.done.adjusted', {
            stored: stored.grouped,
            reviewed: formatMoneyIn(reviewed, currencyKey),
            currency: currencyKey,
          })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('post.done.immutable')}</p>
    </section>
  )
}

