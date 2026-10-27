import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import type { RuleBudgetScope } from '@/core/models/rule-campaign'
import { BUDGET_LIMITS, BUDGET_PERIODS, budgetSentence } from '@/core/rules/budget'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { SHEET } from '@/core/ui/overlay'
import { budgetProblem, sameBudget, type BudgetForm } from './budget-form'
import SentenceView from './SentenceView'
import { Refusal } from './settings-ui'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import IconButton from '@/core/ui/IconButton'
import Field from '@/core/ui/Field'

/**
 * The Budgets drawer (ticket 510; the prototype's `BudgetDrawer`): "Limit the … to … per … (per
 * period)", an optional name, and the sentence the answers make. A native `<dialog>` docked to the
 * inline end, on the overlay recipe's `SHEET`.
 *
 * `liveLimit`: an existing budget of a live campaign. Only its limit changes here — on its own door,
 * at once, without republishing (ADR 0091) — so what it counts, per what and its name are shown
 * but not edited.
 */
export default function BudgetDrawer({
  initial,
  adding,
  liveLimit,
  scopes,
  currency,
  pending,
  error,
  onEdit,
  onReload,
  onClose,
  onSave,
}: {
  initial: BudgetForm
  adding: boolean
  liveLimit: boolean
  /** The scopes it offers — Coupon only with the coupons feature, as the page's sections. */
  scopes: readonly RuleBudgetScope[]
  currency: string | null
  pending: boolean
  error: unknown
  /** The form changed — a refusal shown for the last Save goes. */
  onEdit: () => void
  /** A stale draft's Reload: the drawer and its unsaved budget go, as the refusal's words say. */
  onReload: () => void
  onClose: () => void
  onSave: (form: BudgetForm) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [form, setForm] = useState(initial)
  const [tried, setTried] = useState(false)
  const problem = budgetProblem(form, currency)
  const unchanged = !adding && sameBudget(form, initial)
  // Said once the marketer tried to save or changed anything — a new limit kind can make the figure wrong.
  const shown = tried || JSON.stringify(form) !== JSON.stringify(initial) ? problem : null
  const close = () => !pending && onClose()

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  const set = (change: Partial<BudgetForm>) => {
    setForm((f) => ({ ...f, ...change }))
    onEdit()
  }
  const id = (k: string) => `${titleId}-${k}`
  const money = form.limit !== 'uses'
  const mode = adding ? 'add' : liveLimit ? 'live' : 'edit'

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-budget-drawer={mode}
      onCancel={(e) => {
        e.preventDefault()
        // As core's Modal: Escape belongs to the top dialog, never to one that holds it too.
        e.stopPropagation()
        close()
      }}
      // The backdrop reports the dialog itself as the target; content never does.
      onClick={(e) => {
        if (e.target === ref.current) close()
      }}
      className={'end-0 my-0 me-0 ms-auto h-dvh max-h-dvh w-[30rem] max-w-[96vw] border-0 border-s p-0 ' + SHEET}
    >
      <form
        className="flex h-full flex-col"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (problem || unchanged || pending) return
          onSave(form)
        }}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold tracking-tight">
            {t(`settings.budgets.drawer.title.${mode}`)}
          </h2>
          <IconButton label={t('settings.budgets.drawer.close')} onClick={close} data-budget-drawer-close="">
            <X className="size-4" aria-hidden />
          </IconButton>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          {liveLimit && (
            <p className="rounded-md border border-primary-border bg-primary-050 p-2.5 text-xs text-primary-800" data-budget-live-note="">
              {t('settings.budgets.drawer.liveNote')}
            </p>
          )}
          <Field id={id('limit')} label={t('settings.budgets.drawer.limit')}>
            <Select id={id('limit')} value={form.limit} disabled={liveLimit} onChange={(e) => set({ limit: e.target.value as BudgetForm['limit'] })} data-budget-field="limit">
              {BUDGET_LIMITS.map((l) => (
                <option key={l} value={l}>
                  {t(`settings.budgets.drawer.limits.${l}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id={id('value')}
            label={t('settings.budgets.drawer.value')}
            error={shown ? <span data-budget-problem={shown}>{t(`settings.budgets.drawer.problem.${shown}`)}</span> : undefined}
          >
            <span className="flex items-center gap-2">
              <Input
                id={id('value')}
                dir="ltr"
                inputMode="decimal"
                className="w-40"
                value={form.value}
                onChange={(e) => set({ value: e.target.value })}
                data-budget-field="value"
              />
              {money && currency && (
                <span className="font-mono text-xs text-muted-foreground" data-budget-currency="">
                  <Ltr>{currency}</Ltr>
                </span>
              )}
            </span>
          </Field>
          <Field id={id('scope')} label={t('settings.budgets.drawer.scope')}>
            <Select id={id('scope')} value={form.scope} disabled={liveLimit} onChange={(e) => set({ scope: e.target.value as BudgetForm['scope'] })} data-budget-field="scope">
              {scopes.map((s) => (
                <option key={s} value={s}>
                  {t(`settings.budgets.drawer.scopes.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id('period')} label={t('settings.budgets.drawer.period')}>
            <Select id={id('period')} value={form.period} disabled={liveLimit} onChange={(e) => set({ period: e.target.value as BudgetForm['period'] })} data-budget-field="period">
              {BUDGET_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {t(`settings.budgets.drawer.periods.${p}`)}
                </option>
              ))}
            </Select>
          </Field>
          {(['nameEn', 'nameAr'] as const).map((k) => (
            <Field key={k} id={id(k)} label={t(`settings.budgets.drawer.${k}`)}>
              <Input
                id={id(k)}
                dir={k === 'nameAr' ? 'rtl' : 'ltr'}
                className="w-full max-w-md"
                value={form[k]}
                disabled={liveLimit}
                placeholder={t('settings.budgets.drawer.namePlaceholder')}
                onChange={(e) => set({ [k]: e.target.value })}
                data-budget-field={k}
              />
            </Field>
          ))}
          <div className="rounded-md border border-border/60 bg-muted/40 p-2.5 text-sm" data-budget-preview="">
            {problem ? (
              <span className="text-muted-foreground">{t('settings.budgets.drawer.previewWaiting')}</span>
            ) : (
              <SentenceView s={budgetSentence({ ...form, value: Number(form.value.trim()) }, currency)} />
            )}
          </div>
          {error != null && (
            <div data-budget-refusal="">
              <Refusal title={t('settings.refusedTitle')} fallback={t('settings.refused')} error={error} onReload={onReload} />
            </div>
          )}
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-border/60 px-4 py-3">
          <Button variant="text" onClick={close} disabled={pending} data-budget-cancel="">
            {t('settings.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={pending || unchanged || (tried && problem != null)} data-budget-save="">
            {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t(`settings.budgets.drawer.save.${mode}`)}
          </Button>
        </footer>
      </form>
    </dialog>
  )
}
