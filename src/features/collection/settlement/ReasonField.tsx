import { REASON_MAX } from './posting'

/**
 * **The reason box**, wherever this feature asks for one.
 *
 * 🚩 Extracted at its **third copy** — the posting form's (271), the repair
 * dialog's (270) and the correction panel's (272) — which is this repo's documented
 * escalation trigger rather than a judgement call taken fresh
 * ([feature-structure](../../../../.claude/rules/feature-structure.md), and the road
 * `ScreenGate`, `distinctCurrencies` and `roundMoney` each took). It stays **inside
 * the feature** rather than graduating to `@/core/ui`, because that rule's ladder is
 * *copy → extract within the feature → graduate on a second feature wanting it*, and
 * no other feature does.
 *
 * ⚠️ **The drift had already started, which is the argument.** All three carried the
 * same `maxLength={REASON_MAX}` and the same three-row shape, but only the posting
 * form's had `dir="auto"` — so a reason typed in Arabic rendered right-to-left in one
 * box and left-to-right in the other two, on one screen, for one accountant. Three
 * boxes that must agree are three boxes that eventually will not.
 *
 * 🔑 **`dir="auto"` is not decoration**: these reasons are routinely Arabic, and a
 * right-to-left sentence laid out left-to-right is a different sentence to read.
 *
 * The label and the hint stay the **caller's**, because they are not the same
 * sentence: the posting form's reason is *what the branch reads at a till*, while
 * the repair's and the correction's are *what the audit reads months later*. Only
 * the control is shared, and only the parts of it that must not differ.
 */
export default function ReasonField({
  value,
  onValue,
  label,
  hint,
  testId,
}: {
  value: string
  onValue: (next: string) => void
  label: string
  hint: string
  /** The drive addresses these boxes by name; each caller keeps its own. */
  testId: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onValue(e.target.value)}
        maxLength={REASON_MAX}
        rows={3}
        dir="auto"
        data-testid={testId}
        className="rounded-md border border-border bg-card p-2 text-sm outline-none focus:border-primary/60"
      />
      <span className="text-xs text-muted-foreground">{hint}</span>
    </label>
  )
}

/**
 * The five query keys a settlement **write** must invalidate — one call, so the
 * three writers cannot drift apart on which lists go stale.
 *
 * 🚩 Extracted at its third copy too (post, cancel, close-out). The set is not
 * obvious and each member earns its place: the **account** because the entry's own
 * status and remaining changed; the **fleet** and the **ledger** because a branch's
 * open count did; and the **orphans** lane because it is a *separate door* from the
 * fleet (270) — invalidating only the fleet would leave the wrong-money lane drawn
 * from an estate that no longer matches the one beside it. And the **open lane**
 * (285), because an entry cancelled or written
 * off has left the estate's open position — a lane that kept listing it would send an
 * accountant to ring a branch about money nobody is owed any more.
 *
 * ⚠️ A stale door is not cosmetic here: it invites the accountant to post or correct
 * the same figure a second time.
 */
export function invalidateSettlement(
  queryClient: { invalidateQueries: (filters: { queryKey: unknown[] }) => Promise<void> },
  storeId: string,
): void {
  void queryClient.invalidateQueries({ queryKey: ['settlement', 'account', storeId] })
  void queryClient.invalidateQueries({ queryKey: ['settlement', 'fleet'] })
  void queryClient.invalidateQueries({ queryKey: ['settlement', 'ledger'] })
  // ⚠️ **`['settlement','worklist']` stood here and matched NOTHING** — 270 named the
  // door `Settlement/Worklist`, 274 found it live as `Settlement/Orphans` and renamed
  // the query key, and this line kept invalidating the old spelling. So every post,
  // cancel and close-out left the wrong-money lane serving cache for up to a minute.
  // Found by 288's `/code-review`; the two bulk writers already say `orphans`.
  void queryClient.invalidateQueries({ queryKey: ['settlement', 'orphans'] })
  void queryClient.invalidateQueries({ queryKey: ['settlement', 'open-lane'] })
}
