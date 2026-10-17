import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Coins, Loader2, Pencil, Plus, Receipt, Store, Ticket, Trash2, User, type LucideIcon } from 'lucide-react'
import type { RuleBudgetScope, RuleBudgetUsage, RuleCampaignBudget, RuleDraft } from '@/core/models/rule-campaign'
import { rememberSavedDraft, ruleBudgetUsageQuery, ruleCampaignApi } from '@/core/rules/api'
import { BUDGET_SCOPES, budgetFigure, budgetSentence, budgetUsage } from '@/core/rules/budget'
import { campaignCurrency } from '@/core/rules/sentence'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatCount } from '@/core/util/bidi'
import { mintRequestId } from '@/core/util/request-id'
import BudgetDrawer from './BudgetDrawer'
import { budgetForm, budgetsWith, budgetsWithout, newBudgetForm, toBudget, type BudgetForm } from './budget-form'
import { useWorkspace } from './context'
import { draftSave } from './settings-form'
import SentenceView from './SentenceView'
import { Refusal, SettingsFrame } from './settings-ui'

const SCOPE_ICON: Record<RuleBudgetScope, LucideIcon> = { campaign: Coins, profile: User, coupon: Ticket, store: Store, session: Receipt }

/** The drawer open: a new budget (`id` null), or one of the campaign's. */
interface Open {
  id: string | null
  form: BudgetForm
}

/**
 * Settings ▸ Budgets (ticket 510; the prototype's `BudgetsSet`): the campaign's budgets as
 * sentences, grouped by scope (ADR 0091). "+ Budget", a section's Add, a sentence or its pencil open
 * the drawer; its Save saves the budgets at once, as a delete does once confirmed.
 *
 * On a live campaign each budget shows its counter — used / limit, and the overshoot once it went
 * past (BackOffice 2744) — and a budget's limit changes on its own door, without republishing:
 * limits are live settings outside the version pin.
 */
export default function BudgetsSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { draft: d } = useWorkspace()
  const c = d.campaign
  const budgets: RuleCampaignBudget[] = c.budgets ?? []
  const queryClient = useQueryClient()
  const currency = campaignCurrency(c.audience)
  const live = d.campaignStatus === 'Published'
  const usage = useQuery({ ...ruleBudgetUsageQuery(d.code), enabled: live })
  const [open, setOpen] = useState<Open | null>(null)
  const [deleting, setDeleting] = useState<RuleCampaignBudget | null>(null)

  const done = (saved: RuleDraft, words: string) => {
    rememberSavedDraft(queryClient, saved)
    notify.success(t(words))
    setOpen(null)
    setDeleting(null)
  }
  const saveList = useMutation({
    // The budgets are part of the draft: the whole draft is saved at its revision (ticket 522).
    mutationFn: (next: RuleCampaignBudget[]) => ruleCampaignApi.save(draftSave(d, { budgets: next })),
    onSuccess: (saved) => done(saved, 'settings.budgets.saved'),
  })
  const changeLimit = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) => ruleCampaignApi.changeLimit(d.code, id, { value }),
    onSuccess: (saved) => done(saved, 'settings.budgets.limitChanged'),
  })
  const resetSaves = () => {
    saveList.reset()
    changeLimit.reset()
  }
  const pending = saveList.isPending || changeLimit.isPending
  const failed = saveList.error ?? changeLimit.error

  const add = (scope: RuleBudgetScope) => {
    resetSaves()
    setOpen({ id: null, form: newBudgetForm(scope) })
  }
  const edit = (b: RuleCampaignBudget) => {
    resetSaves()
    setOpen({ id: b.id, form: budgetForm(b) })
  }
  const liveLimit = live && open?.id != null

  /** Coupon is offered only with the coupons feature, or where a coupon budget is already there. */
  const offered = (also: (s: RuleBudgetScope) => boolean) => BUDGET_SCOPES.filter((s) => s !== 'coupon' || d.features.includes('coupons') || also(s))
  const scopes = offered((s) => budgets.some((b) => b.scope === s))

  return (
    <SettingsFrame page="budgets">
      <div className="flex flex-wrap items-center gap-3">
        <p className="me-auto max-w-2xl text-xs text-muted-foreground" data-budgets-live={live ? 'live' : 'draft'}>
          {t(live ? 'settings.budgets.liveNote' : 'settings.budgets.draftNote')}
        </p>
        <Button variant="secondary" onClick={() => add('campaign')} data-budget-add="">
          <Plus className="size-3.5" aria-hidden />
          {t('settings.budgets.add')}
        </Button>
      </div>
      {live && usage.isError && (
        <div className="flex flex-col gap-2" data-budget-usage-refusal="">
          <Refusal title={t('settings.budgets.usageFailedTitle')} fallback={t('settings.budgets.usageFailed')} error={usage.error} />
          <div>
            <Button variant="text" onClick={() => void usage.refetch()} data-budget-usage-retry="">
              {t('settings.budgets.retry')}
            </Button>
          </div>
        </div>
      )}
      {saveList.isError && !open && !deleting && (
        <div data-budget-refusal="">
          <Refusal title={t('settings.refusedTitle')} fallback={t('settings.refused')} error={saveList.error} onReload={resetSaves} />
        </div>
      )}
      {scopes.map((scope) => {
        const Icon = SCOPE_ICON[scope]
        const list = budgets.filter((b) => b.scope === scope)
        return (
          <section key={scope} className="flex flex-col gap-2" data-budget-scope={scope}>
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
              <Icon className="size-4 self-center text-muted-foreground" aria-hidden />
              {t(`settings.budgets.scopes.${scope}.title`)}
              <span className="text-xs font-normal text-muted-foreground">{t(`settings.budgets.scopes.${scope}.hint`)}</span>
            </h3>
            {list.length > 0 && (
              <ul className="flex flex-col gap-2">
                {list.map((b) => (
                  <BudgetLine
                    key={b.id}
                    budget={b}
                    currency={currency}
                    usage={!live || usage.isError ? null : usage.data && usedOf(usage.data, b.id)}
                    onEdit={() => edit(b)}
                    onDelete={() => {
                      resetSaves()
                      setDeleting(b)
                    }}
                  />
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => add(scope)}
              className="flex items-center gap-2 rounded-md border border-dashed border-border-strong px-3 py-2 text-start text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-accent"
              data-budget-add-scope={scope}
            >
              <Plus className="size-4" aria-hidden />
              {t(`settings.budgets.scopes.${scope}.add`)}
            </button>
          </section>
        )
      })}
      {open && (
        <BudgetDrawer
          initial={open.form}
          adding={open.id == null}
          liveLimit={liveLimit}
          scopes={offered((s) => open.form.scope === s)}
          currency={currency}
          pending={pending}
          error={failed}
          onEdit={() => failed != null && resetSaves()}
          onClose={() => {
            resetSaves()
            setOpen(null)
          }}
          onSave={(form) => {
            if (liveLimit && open.id) changeLimit.mutate({ id: open.id, value: toBudget(form, open.id).value })
            else saveList.mutate(budgetsWith(budgets, toBudget(form, open.id ?? mintRequestId())))
          }}
        />
      )}
      {deleting && (
        <Modal
          open
          onClose={() => {
            if (pending) return
            resetSaves()
            setDeleting(null)
          }}
          title={t('settings.budgets.delete.title')}
          width="32rem"
          footer={
            <>
              <Button
                variant="text"
                onClick={() => {
                  resetSaves()
                  setDeleting(null)
                }}
                disabled={pending}
                data-budget-delete-cancel=""
              >
                {t('settings.cancel')}
              </Button>
              <Button variant="danger" disabled={pending} onClick={() => saveList.mutate(budgetsWithout(budgets, deleting.id))} data-budget-delete-confirm="">
                {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                {t('settings.budgets.delete.confirm')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm" data-budget-delete-dialog={deleting.id}>
            <p>
              <SentenceView s={budgetSentence(deleting, currency)} />
            </p>
            <p className="text-muted-foreground">{t(live ? 'settings.budgets.delete.bodyLive' : 'settings.budgets.delete.body')}</p>
            {saveList.isError && <Refusal title={t('settings.refusedTitle')} fallback={t('settings.refused')} error={saveList.error} onReload={resetSaves} />}
          </div>
        </Modal>
      )}
    </SettingsFrame>
  )
}

/** A budget's counter; one HQ has not started yet is at zero (ADR 0091: a counter starts from zero). */
const usedOf = (usage: readonly RuleBudgetUsage[], budgetId: string): RuleBudgetUsage =>
  usage.find((u) => u.budgetId === budgetId) ?? { budgetId, used: 0 }

/**
 * One budget: its sentence (a click opens the drawer), its name, and — on a live campaign — its
 * counter. `usage` is undefined while the counters are read, null when there are none to show (a
 * draft, or a read that failed — said once, above the sections).
 */
function BudgetLine({
  budget: b,
  currency,
  usage,
  onEdit,
  onDelete,
}: {
  budget: RuleCampaignBudget
  currency: string | null
  usage: RuleBudgetUsage | null | undefined
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-2" data-budget={b.id}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-start text-sm hover:underline" data-budget-sentence={b.id}>
          <SentenceView s={budgetSentence(b, currency)} />
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('settings.budgets.edit')}
          title={t('settings.budgets.edit')}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          data-budget-edit={b.id}
        >
          <Pencil className="size-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('settings.budgets.delete.action')}
          title={t('settings.budgets.delete.action')}
          className="rounded-md p-1 text-muted-foreground hover:bg-danger-050 hover:text-danger-800"
          data-budget-delete={b.id}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>
      {(b.name?.en || b.name?.ar) && (
        <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground" data-budget-name="">
          <bdi lang="en">{b.name.en}</bdi>
          {b.name.ar && (
            <bdi dir="rtl" lang="ar">
              {b.name.ar}
            </bdi>
          )}
        </p>
      )}
      {usage === undefined && <p className="text-xs text-muted-foreground">{t('settings.budgets.usageLoading')}</p>}
      {usage !== undefined && usage !== null && (
        <UsageBar budget={b} used={usage.used} figure={(n) => budgetFigure(b.limit, n, currency)} />
      )}
    </li>
  )
}

/** Used / limit as one isolated count, a bar, and the overshoot once the counter went past. */
function UsageBar({ budget: b, used, figure }: { budget: RuleCampaignBudget; used: number; figure: (n: number) => string }) {
  const { t } = useTranslation('campaign-workspace')
  const u = budgetUsage(used, b.value)
  return (
    <div className="flex flex-col gap-1" data-budget-usage={b.id}>
      <div className="flex flex-wrap items-center gap-x-2 text-xs">
        <span className="text-muted-foreground">{t(`settings.budgets.usage.${b.scope}`)}</span>
        <span className="font-medium" data-budget-used="">
          <Ltr>{formatCount(figure(u.used), figure(u.limit))}</Ltr>
        </span>
        {u.overshoot != null && (
          <span className="rounded-full border border-danger-border bg-danger-050 px-2 py-0.5 font-medium text-danger-800" data-budget-overshoot="">
            <Trans t={t} i18nKey="settings.budgets.overshoot" values={{ amount: figure(u.overshoot) }} components={{ amount: <Ltr /> }} />
          </span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={`h-full rounded-full ${u.overshoot != null ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${u.share * 100}%` }} />
      </div>
      {u.overshoot != null && <p className="text-xs text-muted-foreground">{t('settings.budgets.overshootWhy')}</p>}
    </div>
  )
}
