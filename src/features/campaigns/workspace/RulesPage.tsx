import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, Redo2, Undo2 } from 'lucide-react'
import { apiErrorCode } from '@/core/api'
import type { CampaignRule } from '@/core/models/rule-campaign'
import { rememberSavedDraft, ruleCampaignApi, ruleCampaignKey, ruleCatalogueQuery, ruleReadingCatalogueQuery, ruleValidateQuery } from '@/core/rules/api'
import type { SentenceContext } from '@/core/rules/sentence'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { mintRequestId } from '@/core/util/request-id'
import { useDebounced } from '@/core/util/use-debounced'
import { mintKey } from './block-keys'
import { builderHistory, canRedo, canUndo, initialHistory, isDirty, sameRules } from './builder-history'
import { focusTarget, indexChecks, locateChecks, type CheckPlace } from './checks'
import ChecksPill from './ChecksPill'
import LeaveGuard from './LeaveGuard'
import { useWorkspace } from './context'
import { newRule } from './palette'
import { addRule } from './rule-edit'
import RuleCard, { type Builder } from './RuleCard'
import { draftSave } from './settings-form'
import { DRAFT_PENDING, DRAFT_STALE, refusalText } from './settings-ui'

/**
 * The Rule builder (tickets 504, 505): the campaign's rules top to bottom, each a collapsible card
 * read as sentences from the block catalogue (fetched once and kept, `ruleCatalogueQuery`), and
 * editable — the palette adds blocks, a sentence opens its panel, rules and blocks are added,
 * renamed, reordered and deleted.
 *
 * Every edit is a step of a pure history (`./builder-history`): Undo / Redo walk it, Cancel goes
 * back to the rules as HQ last saved them, Save sends the WHOLE draft at its revision
 * (`Drafts/Save`, ticket 522). A save over a newer revision is refused (`RULES_DRAFT_STALE`) and
 * the page offers to reload; a draft waiting for approval is frozen (`RULES_DRAFT_PENDING`). Leaving
 * the page — in the app or by closing the tab — with unsaved changes asks first.
 *
 * The checks pill (ticket 508) reads HQ's checks of the rules on screen: the saved draft's validation
 * while nothing is changed, and once the edits settle, `Rules/Authoring/Validate` of the unsaved
 * campaign (ticket 523; nothing is stored). Each issue is found by its path in the rules it was made
 * of and, through the block's builder key, on the rules as they are on screen; a click on one expands
 * its rule, opens its panel and focuses the field.
 */
export default function RulesPage() {
  const { t, i18n } = useTranslation('campaign-workspace')
  const { draft } = useWorkspace()
  const c = draft.campaign
  const queryClient = useQueryClient()
  // A block is read through the catalogue with every feature on; the palette offers what HQ lists
  // for the draft's own features.
  const catalogue = useQuery(ruleReadingCatalogueQuery())
  const palette = useQuery(ruleCatalogueQuery(draft.features))
  const [history, dispatch] = useReducer(builderHistory, c.rules, initialHistory)
  const frozen = draft.state === 'pending'
  /** The rules the reader closed; every rule opens expanded. */
  const [shut, setShut] = useState<ReadonlySet<string>>(() => new Set())
  const [openId, setOpenId] = useState<string | null>(null)
  const rules = history.present
  // HQ's checks of the rules on screen, once the edits settle for a moment; the saved draft's own
  // validation while they are the saved ones (Drafts/Load and Save answer it).
  const settled = useDebounced(rules, VALIDATE_AFTER_MS)
  const changed = useMemo(() => !sameRules(settled, history.saved), [settled, history.saved])
  const asked = useMemo(() => ({ campaign: { ...c, rules: settled }, ...(draft.tree ? { tree: draft.tree } : {}) }), [c, settled, draft.tree])
  const validateOptions = useMemo(() => ruleValidateQuery(asked), [asked])
  const validate = useQuery({ ...validateOptions, enabled: changed })
  const checked = changed ? { rules: settled, validation: validate.data } : { rules: history.saved, validation: draft.validation }
  const validation = checked.validation
  const located = useMemo(() => locateChecks(checked.rules, rules, validation), [checked.rules, rules, validation])
  /** The checks are of rules other than those on screen: an edit since, not yet checked. */
  const checksBehind = useMemo(() => !sameRules(checked.rules, rules), [checked.rules, rules])
  const checksIndex = useMemo(() => indexChecks(located), [located])
  /** The control a click in the pill asked for; focused once the rule and the panel have opened. */
  const [focusAsk, setFocusAsk] = useState<{ ids: string[]; within: string | null } | null>(null)
  // Serialises the rules: once per history change, not on every render (a panel opening, a toggle).
  const dirty = useMemo(() => isDirty(history), [history])

  // A re-read of the campaign (after a Save, or by another page) reaches the builder; an unsaved
  // edit is never dropped by one (the reducer's `load`).
  useEffect(() => dispatch({ type: 'load', rules: c.rules }), [c.rules])

  const save = useMutation({
    // The whole draft at the revision loaded; the builder's keys are symbols, which JSON drops.
    mutationFn: (next: CampaignRule[]) => ruleCampaignApi.save(draftSave(draft, { rules: next })),
    onSuccess: (saved, sent) => {
      // An edit made while the save was in flight stays, unsaved (the reducer compares `sent`).
      dispatch({ type: 'saved', rules: saved.campaign.rules, sent })
      rememberSavedDraft(queryClient, saved)
      notify.success(t('builder.saved'))
    },
  })
  const refusal = save.isError ? apiErrorCode(save.error) : null
  const stale = refusal === DRAFT_STALE
  /** Reads the draft afresh — the reader's own press: the unsaved rules go with it. */
  const reload = () => {
    save.reset()
    setOpenId(null)
    dispatch({ type: 'cancel' })
    void queryClient.invalidateQueries({ queryKey: ruleCampaignKey(draft.code) })
  }

  // Focus after the render that expanded the rule and opened the panel; scrolled into view.
  useEffect(() => {
    if (!focusAsk) return
    const el = focusAsk.ids.map((id) => document.getElementById(id)).find((x) => x) ?? (focusAsk.within ? document.querySelector(focusAsk.within) : null)
    const control = el?.matches(FOCUSABLE) ? el : el?.querySelector<HTMLElement>(FOCUSABLE)
    if (control instanceof HTMLElement) {
      control.scrollIntoView({ block: 'center' })
      control.focus({ preventScroll: true })
    }
    setFocusAsk(null)
  }, [focusAsk])

  const goTo = (place: CheckPlace) => {
    const target = focusTarget(place)
    if (!target) return
    setShut((prev) => {
      if (!prev.has(target.ruleId)) return prev
      const next = new Set(prev)
      next.delete(target.ruleId)
      return next
    })
    if (target.open !== null) {
      dispatch({ type: 'seal' })
      setOpenId(target.open)
    }
    setFocusAsk({ ids: target.ids, within: target.within })
  }

  const toggle = (id: string) =>
    setShut((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const builder: Builder | null =
    catalogue.data && palette.data
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
        features: draft.features,
        catalogue: catalogue.data,
        palette: palette.data,
        newId: mintRequestId,
        newKey: mintKey,
        checks: checksIndex,
      }
    : null

  const addNewRule = () => {
    const rule = newRule(mintRequestId())
    builder?.edit((r) => addRule(r, rule))
  }

  let body: ReactNode
  const failedCatalogue = catalogue.isError ? catalogue : palette.isError ? palette : null
  /** Reads again whichever catalogue failed — both, when both did. */
  const retryCatalogues = () => {
    if (catalogue.isError) void catalogue.refetch()
    if (palette.isError) void palette.refetch()
  }
  if (failedCatalogue) {
    body = (
      <ErrorBanner className="p-3" title={t('rules.catalogueFailedTitle')} message={refusalText(t, failedCatalogue.error, t('rules.catalogueFailed'))}>
        <Button variant="outlined" className="mt-2" onClick={retryCatalogues} disabled={catalogue.isFetching || palette.isFetching} data-catalogue-retry="">
          {t('rules.retry')}
        </Button>
      </ErrorBanner>
    )
  } else if (!builder) {
    body = (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('rules.catalogueLoading')}
      </div>
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
            <ChecksPill
              checks={validation}
              fetching={changed && validate.isFetching}
              error={changed ? validate.error : null}
              onRetry={() => void validate.refetch()}
              located={located}
              dirty={checksBehind}
              rules={rules}
              catalogue={builder.catalogue}
              onGo={goTo}
            />
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
            <Button variant="primary" disabled={!dirty || busy || frozen} onClick={() => save.mutate(rules)} data-save="">
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
      {frozen && (
        <p className="rounded-md border border-attention-border bg-attention-050 p-3 text-sm text-attention-800" data-builder-frozen="">
          {t('builder.frozen')}
        </p>
      )}
      {save.isError &&
        (stale ? (
          <div data-save-stale="">
            <ErrorBanner className="p-3" title={t('builder.staleTitle')} message={t('builder.stale')}>
              <Button variant="outlined" className="mt-2" onClick={reload} data-save-reload="">
                {t('builder.reload')}
              </Button>
            </ErrorBanner>
          </div>
        ) : (
          <div data-save-refused={refusal ?? ''}>
            <ErrorBanner
              className="p-3"
              title={t('builder.saveFailedTitle')}
              message={refusal === DRAFT_PENDING ? t('builder.pending') : refusalText(t, save.error, t('builder.saveFailed'))}
            />
          </div>
        ))}
      {body}

      <LeaveGuard dirty={dirty} words="builder.leave" />
    </section>
  )
}

/** How long the rules stay unchanged before HQ checks them. */
const VALIDATE_AFTER_MS = 600

/** What a jump from the pill may focus inside the place it lands on. */
const FOCUSABLE = 'input, select, textarea, button'
