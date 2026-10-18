import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Coins, Loader2, Pencil, Plus, Receipt, Store, Ticket, Trash2, User, type LucideIcon } from 'lucide-react'
import type { RuleBudgetScope, RuleBudgetView, RuleCampaignBudget, RuleDraft } from '@/core/models/rule-campaign'
import { rememberSavedDraft, ruleBudgetsKey, ruleBudgetsQuery, ruleCampaignApi } from '@/core/rules/api'
import { BUDGET_SCOPES, budgetCount, budgetFigure, budgetSentence } from '@/core/rules/budget'
import { campaignCurrency } from '@/core/rules/sentence'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatCount } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
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
  /**
   * Whether Save changes the LIVE limit (`Budgets/SetLimit`) rather than the draft: an existing
   * budget of a live campaign that the live version declares (or, while the counts are not read,
   * any existing one: HQ refuses a budget it does not declare). Fixed when the drawer opens, so a
   * read landing meanwhile never switches what Save does.
   */
  live: boolean
}

/**
 * Settings ▸ Budgets (ticket 510; the prototype's `BudgetsSet`): the campaign's budgets as
 * sentences, grouped by scope (ADR 0091). "+ Budget", a section's Add, a sentence or its pencil open
 * the drawer; its Save saves the budgets at once, as a delete does once confirmed.
 *
 * On a live campaign each budget the live version declares shows HQ's count of it this period
 * (`Rules/Authoring/Budgets`, ticket 523): used and held against the limit in force, and the
 * overshoot once a key went past. A budget's limit changes on its own door (`Budgets/SetLimit`),
 * without republishing: limits are live settings outside the version pin (ADR 0091).
 */
export default function BudgetsSettings() {
  const { t } = useTranslation('campaign-workspace')
  const { draft: d } = useWorkspace()
  const c = d.campaign
  const budgets: RuleCampaignBudget[] = c.budgets ?? []
  const queryClient = useQueryClient()
  const currency = campaignCurrency(c.audience)
  const live = d.campaignStatus === 'Published'
  const usage = useQuery({ ...ruleBudgetsQuery(d.code), enabled: live })
  const [open, setOpen] = useState<Open | null>(null)
  const [deleting, setDeleting] = useState<RuleCampaignBudget | null>(null)

  const closed = (words: string) => {
    notify.success(t(words))
    setOpen(null)
    setDeleting(null)
  }
  const done = (saved: RuleDraft, words: string) => {
    rememberSavedDraft(queryClient, saved)
    closed(words)
  }
  const saveList = useMutation({
    // The budgets are part of the draft: the whole draft is saved at its revision (ticket 522).
    mutationFn: (next: RuleCampaignBudget[]) => ruleCampaignApi.save(draftSave(d, { budgets: next })),
    onSuccess: (saved) => done(saved, 'settings.budgets.saved'),
  })
  const changeLimit = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) => ruleCampaignApi.setLimit(d.code, id, value),
    // HQ answers the limit, not the campaign: the counts are read afresh (the draft is unchanged).
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ruleBudgetsKey(d.code) })
      closed('settings.budgets.limitChanged')
    },
  })
  const resetSaves = () => {
    saveList.reset()
    changeLimit.reset()
  }
  const pending = saveList.isPending || changeLimit.isPending
  const failed = saveList.error ?? changeLimit.error

  const add = (scope: RuleBudgetScope) => {
    resetSaves()
    setOpen({ id: null, form: newBudgetForm(scope), live: false })
  }
  /** HQ's count of a budget the live version declares; null for one it does not (yet). */
  const viewOf = (id: string): RuleBudgetView | null => usage.data?.find((v) => v.budget === id) ?? null
  const edit = (b: RuleCampaignBudget) => {
    resetSaves()
    // A live budget's drawer changes its limit: it starts from the limit in force, not the declared one.
    const inForce = live ? viewOf(b.id)?.limitValue : undefined
    setOpen({ id: b.id, form: budgetForm(inForce === undefined ? b : { ...b, value: inForce }), live: live && (!usage.data || viewOf(b.id) !== null) })
  }
  const liveLimit = !!open?.live

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
                    usage={!live || usage.isError ? null : usage.data && viewOf(b.id)}
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
          onReload={() => {
            resetSaves()
            setOpen(null)
          }}
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

/**
 * One budget: its sentence (a click opens the drawer), its name, and — on a live campaign — HQ's
 * count of it. `usage` is undefined while the counts are read, null when there is none to show (a
 * draft, a budget the live version does not declare yet, or a read that failed — said once, above
 * the sections).
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
  usage: RuleBudgetView | null | undefined
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-2" data-budget={b.id}>
      <div className="flex items-start gap-2">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-start text-sm hover:underline" data-budget-sentence={b.id}>
          {/* A live budget reads the limit in force (a live limit changes on its own door, ADR 0091) —
              while the draft still counts what the live version counts. */}
          <SentenceView s={budgetSentence(usage && sameCount(b, usage) ? { ...b, value: usage.limitValue } : b, currency)} />
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
        <UsageBar budget={b} view={usage} figure={(n) => budgetFigure(usage.limit, n, currency)} />
      )}
    </li>
  )
}

/** Whether the draft's budget counts what the live version's does: the same limit, scope and period. */
const sameCount = (b: RuleCampaignBudget, v: RuleBudgetView) => b.limit === v.limit && b.scope === v.scope && b.period === v.period

/**
 * HQ's count of a live budget, in the live version's own terms (its limit kind and scope: the draft
 * may have changed them since). A campaign-wide budget reads used / limit as one isolated count with
 * a bar; a per-key budget (a member, a code, a store, a sale) reads what its keys used together and
 * the limit each key has — a sum no one limit measures, so it has no bar. Held (by sales still
 * paying) is shown beside used, and the overshoot once a key went past its limit.
 */
function UsageBar({ budget: b, view, figure }: { budget: RuleCampaignBudget; view: RuleBudgetView; figure: (n: number) => string }) {
  const { t } = useTranslation('campaign-workspace')
  const u = budgetCount(view)
  return (
    <div className="flex flex-col gap-1" data-budget-usage={b.id}>
      <div className="flex flex-wrap items-center gap-x-2 text-xs">
        <span className="text-muted-foreground">{t(`settings.budgets.usage.${view.scope}`)}</span>
        {u.bar ? (
          <span className="font-medium" data-budget-used="">
            <Ltr>{formatCount(figure(u.used), figure(u.limit))}</Ltr>
          </span>
        ) : (
          <span className="font-medium" data-budget-used="">
            <Trans
              t={t}
              i18nKey="settings.budgets.usedPerKey"
              values={{ used: figure(u.used), limit: figure(u.limit), n: formatNumber(u.counters) }}
              components={{ used: <Ltr />, limit: <Ltr />, n: <Ltr /> }}
            />
          </span>
        )}
        {u.held > 0 && (
          <span className="text-muted-foreground" data-budget-held="">
            <Trans t={t} i18nKey="settings.budgets.held" values={{ amount: figure(u.held) }} components={{ amount: <Ltr /> }} />
          </span>
        )}
        {u.overshoot != null && (
          <span className="rounded-full border border-danger-border bg-danger-050 px-2 py-0.5 font-medium text-danger-800" data-budget-overshoot="">
            <Trans t={t} i18nKey="settings.budgets.overshoot" values={{ amount: figure(u.overshoot) }} components={{ amount: <Ltr /> }} />
          </span>
        )}
      </div>
      {u.bar && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className={`h-full rounded-full ${u.overshoot != null ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${u.bar.share * 100}%` }} />
        </div>
      )}
      {u.overshoot != null && <p className="text-xs text-muted-foreground">{t('settings.budgets.overshootWhy')}</p>}
    </div>
  )
}
