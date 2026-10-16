import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useBlocker } from 'react-router'
import { Loader2, Plus, Redo2, Undo2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { CampaignRule } from '@/core/models/rule-campaign'
import { rememberSavedDraft, ruleCampaignApi, ruleCatalogueQuery } from '@/core/rules/api'
import type { SentenceContext } from '@/core/rules/sentence'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import { mintRequestId } from '@/core/util/request-id'
import { builderHistory, canRedo, canUndo, initialHistory, isDirty } from './builder-history'
import { useWorkspace } from './context'
import { newRule } from './palette'
import { addRule } from './rule-edit'
import RuleCard, { type Builder } from './RuleCard'

/**
 * The Rule builder (tickets 504, 505): the campaign's rules top to bottom, each a collapsible card
 * read as sentences from the block catalogue (fetched once and kept, `ruleCatalogueQuery`), and
 * editable — the palette adds blocks, a sentence opens its panel, rules and blocks are added,
 * renamed, reordered and deleted.
 *
 * Every edit is a step of a pure history (`./builder-history`): Undo / Redo walk it, Cancel goes
 * back to the rules as HQ last saved them, Save sends them to the draft door. Leaving the page — in
 * the app or by closing the tab — with unsaved changes asks first.
 */
export default function RulesPage() {
  const { t, i18n } = useTranslation('campaign-workspace')
  const { campaign: c } = useWorkspace()
  const queryClient = useQueryClient()
  const catalogue = useQuery(ruleCatalogueQuery())
  const [history, dispatch] = useReducer(builderHistory, c.rules, initialHistory)
  /** The rules the reader closed; every rule opens expanded. */
  const [shut, setShut] = useState<ReadonlySet<string>>(() => new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const rules = history.present
  // Serialises the rules: once per history change, not on every render (a panel opening, a toggle).
  const dirty = useMemo(() => isDirty(history), [history])

  // A re-read of the campaign (after a Save, or by another page) reaches the builder; an unsaved
  // edit is never dropped by one (the reducer's `load`).
  useEffect(() => dispatch({ type: 'load', rules: c.rules }), [c.rules])

  const save = useMutation({
    mutationFn: (next: CampaignRule[]) => ruleCampaignApi.saveDraft(c.id, { rules: next }),
    onSuccess: (campaign, sent) => {
      // An edit made while the save was in flight stays, unsaved (the reducer compares `sent`).
      dispatch({ type: 'saved', rules: campaign.rules, sent })
      rememberSavedDraft(queryClient, campaign)
      notify.success(t('builder.saved'))
    },
  })

  // Closing or reloading the tab with unsaved changes: the browser's own question.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  // Leaving in the app: ours. The login bounce is core/api's and is never held.
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => dirty && nextLocation.pathname !== '/login' && currentLocation.pathname !== nextLocation.pathname,
      [dirty],
    ),
  )

  const toggle = (id: string) =>
    setShut((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const builder: Builder | null = catalogue.data
    ? {
        edit: (fn, coalesce) => {
          if (save.isError) save.reset()
          dispatch({ type: 'edit', edit: fn, coalesce })
        },
        openId,
        setOpenId: (id) => {
          // Opening or closing a panel ends a run of typing: the next one is an Undo step of its own.
          dispatch({ type: 'seal' })
          setOpenId(id)
        },
        campaign: c,
        catalogue: catalogue.data,
        newId: mintRequestId,
      }
    : null

  const addNewRule = () => {
    const rule = newRule(mintRequestId())
    builder?.edit((r) => addRule(r, rule))
  }

  let body: ReactNode
  if (catalogue.isPending) {
    body = (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('rules.catalogueLoading')}
      </div>
    )
  } else if (catalogue.isError || !builder) {
    body = (
      <ErrorBanner className="p-3" title={t('rules.catalogueFailedTitle')} message={apiErrorMessage(catalogue.error, t('rules.catalogueFailed'))}>
        <Button variant="outlined" className="mt-2" onClick={() => void catalogue.refetch()} disabled={catalogue.isFetching} data-catalogue-retry="">
          {t('rules.retry')}
        </Button>
      </ErrorBanner>
    )
  } else {
    const has = (key: string, count?: number) => i18n.exists(key, { ns: 'campaign-workspace', ...(count === undefined ? {} : { count }) })
    body = (
      <div className="flex flex-col gap-3" data-rules="">
        {rules.length ? (
          rules.map((rule, i) => {
            const ctx: SentenceContext = { campaign: c, rule, catalogue: builder.catalogue, has }
            return <RuleCard key={rule.id} rule={rule} rules={rules} index={i} open={!shut.has(rule.id)} onToggle={() => toggle(rule.id)} ctx={ctx} b={builder} />
          })
        ) : (
          <p className="text-sm text-muted-foreground" data-no-rules="">
            {t('builder.noRules')}
          </p>
        )}
        <span>
          <Button variant="outlined" onClick={addNewRule} data-add-rule="">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t('builder.addRule')}
          </Button>
        </span>
      </div>
    )
  }

  const busy = save.isPending
  return (
    <section className="flex flex-col gap-4" data-rule-builder="" data-dirty={dirty ? '' : undefined}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-lg font-semibold tracking-tight">{t('rules.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('rules.intro')}</p>
        </div>
        {builder && (
          <div className="flex flex-wrap items-center gap-2" data-builder-bar="">
            {dirty && (
              <span className="rounded-full bg-attention-050 px-2 py-0.5 text-xs font-medium text-attention-800" data-unsaved="">
                {t('builder.unsaved')}
              </span>
            )}
            <Button variant="ghost" disabled={!canUndo(history) || busy} onClick={() => dispatch({ type: 'undo' })} data-undo="">
              <Undo2 className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
              {t('builder.undo')}
            </Button>
            <Button variant="ghost" disabled={!canRedo(history) || busy} onClick={() => dispatch({ type: 'redo' })} data-redo="">
              <Redo2 className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
              {t('builder.redo')}
            </Button>
            <Button
              variant="text"
              disabled={!dirty || busy}
              onClick={() => {
                save.reset()
                setOpenId(null)
                dispatch({ type: 'cancel' })
              }}
              data-cancel=""
            >
              {t('builder.cancel')}
            </Button>
            <Button variant="primary" disabled={!dirty || busy} onClick={() => save.mutate(rules)} data-save="">
              {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t('builder.save')}
            </Button>
          </div>
        )}
      </header>
      {rules.length > 1 && builder && (
        <div className="flex gap-2">
          <Button variant="outlined" onClick={() => setShut(new Set(rules.map((r) => r.id)))} data-rules-collapse-all="">
            {t('rules.collapseAll')}
          </Button>
          <Button variant="outlined" onClick={() => setShut(new Set())} data-rules-expand-all="">
            {t('rules.expandAll')}
          </Button>
        </div>
      )}
      {save.isError && <ErrorBanner className="p-3" title={t('builder.saveFailedTitle')} message={apiErrorMessage(save.error, t('builder.saveFailed'))} />}
      {body}

      <Modal
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        title={t('builder.leave.title')}
        footer={
          <>
            <Button variant="text" onClick={() => blocker.reset?.()} data-leave-stay="">
              {t('builder.leave.stay')}
            </Button>
            <Button variant="danger" onClick={() => blocker.proceed?.()} data-leave-go="">
              {t('builder.leave.go')}
            </Button>
          </>
        }
      >
        <p className="text-sm" data-leave-dialog="">
          {t('builder.leave.body')}
        </p>
      </Modal>
    </section>
  )
}
