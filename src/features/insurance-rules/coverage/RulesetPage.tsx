import { useEffect, useId, useMemo, useReducer, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ArrowDown, ArrowUp, ChevronDown, CircleCheck, Folder, Loader2, Plus, Redo2, Undo2 } from 'lucide-react'

import { ApiError, apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { GuardStateBadge, RuleId } from '@/core/insurance-rules/badges'
import { checksVerdict, type GuardIssue } from '@/core/insurance-rules/checks'
import type { CategoryRule, CoverageRule, InsuranceRule, InsuranceRuleKind, InsuranceRuleset } from '@/core/insurance-rules/coverage-model'
import type { GuardList } from '@/core/insurance-rules/model'
import { canRedo, canUndo, editorHistory, initialEditorHistory, isDirty, sameDoc, type EditorAction, type EditorHistory } from '@/core/insurance-rules/editor-history'
import RulesetApproval from '@/core/insurance-rules/RulesetApproval'
import { DRAFT_PENDING, DRAFT_STALE, draftDocument, type RulesetDraft } from '@/core/insurance-rules/ruleset-draft'
import { ConditionTree } from '@/core/insurance-rules/GuardSentenceView'
import { otherRuleOut } from '@/core/insurance-rules/guard-wire'
import JsonButton from '@/core/insurance-rules/JsonButton'
import { fieldsQuery } from '@/core/insurance-rules/registry-api'
import { conditionSentence } from '@/core/insurance-rules/sentence'
import { saysIn } from '@/core/rules/sentence'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import LeaveGuard from '@/core/ui/LeaveGuard'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { formatRange, fsi } from '@/core/util/bidi'
import { doorKind, rulesetDoors, rulesetDraftKey, rulesetDraftQuery } from './api'
import { CategoryEffectEditor, CoverageEffectEditor, CoverageEffectLine, GroupName } from '@/core/insurance-rules/editors/Effects'
import RuleConditions from '@/core/insurance-rules/editors/RuleConditions'
import { addRule, editRuleIn, moveRule, newRule, nextRuleId } from './ruleset-edit'
import { folderOptions, folderPath, folderRuns, ruleFolder, type FolderRun } from './rule-folders'
import { DeniedCard, Loading } from '@/core/insurance-rules/parts'
import { Issues } from '@/core/insurance-rules/controls'

/**
 * Insurance rules ▸ Categories and ▸ Coverage (oms ticket 617; BackOffice 3145 / 3146). One ORDERED ruleset per
 * page: a category is set by the FIRST rule that matches (over the item master's default), and a coverage rule
 * sees what the rules before it changed — so the order on screen is the order HQ runs, and moving a rule is an
 * edit saved with the draft. Folders are shown INSIDE that one ordered list (oms 675, `./rule-folders`). The draft is ONE document saved whole through the guards' draft doors
 * (`PUT InsuranceRules/{Categories|Coverage}/Draft` with its `revision`; a stale one is a 409); Undo / Redo /
 * Cancel / Save act on it, and "Check" asks HQ's Validate about the draft on screen. `?rule=` is the rule open.
 *
 * 🚩 UNGATED: no access probe until 618; a bare 403 on the read is "You do not have access".
 */
export default function RulesetPage({ kind }: { kind: InsuranceRuleKind }) {
  const { t } = useTranslation('insurance-coverage')
  const draft = useQuery(rulesetDraftQuery(kind))
  let body: ReactNode
  if (draft.isError && isBareDenial(draft.error)) body = <DeniedCard ns="insurance-coverage" hook="ruleset-denied" />
  else if (draft.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(draft.error, t('ruleset.failed'))} />
  else if (!draft.data) body = <Loading text={t('loading')} />
  else body = <Editor kind={kind} draft={draft.data} refetch={async () => (await draft.refetch()).data} />
  return (
    <section className="flex w-full max-w-7xl flex-col gap-4" data-ruleset-page={kind}>
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{t(`${kind}.title`)}</h1>
      </header>
      {body}
    </section>
  )
}

const NO_LISTS: readonly GuardList[] = []

type Checks = { issues: GuardIssue[]; against: InsuranceRuleset } | null

function Editor({ kind, draft, refetch }: { kind: InsuranceRuleKind; draft: RulesetDraft<InsuranceRuleset>; refetch: () => Promise<RulesetDraft<InsuranceRuleset> | undefined> }) {
  const { t } = useTranslation('insurance-coverage')
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const doc = useMemo(() => draftDocument(draft), [draft])
  const [h, dispatch] = useReducer(
    editorHistory as (h: EditorHistory<InsuranceRuleset>, a: EditorAction<InsuranceRuleset>) => EditorHistory<InsuranceRuleset>,
    doc,
    (d) => initialEditorHistory(d),
  )
  const [checks, setChecks] = useState<Checks>(null)
  const [stale, setStale] = useState<string | null>(null)

  useEffect(() => {
    if (doc !== h.saved && !sameDoc(doc, h.saved)) dispatch({ type: 'load', doc })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc])

  const rules = h.present.rules as InsuranceRule[]
  const folders = useMemo(() => folderOptions(rules), [rules])
  const openId = params.get('rule') ?? rules[0]?.id ?? null
  const rule = rules.find((r) => r.id === openId) ?? null
  const dirty = isDirty(h)
  const open = (id: string) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        next.set('rule', id)
        return next
      },
      { replace: true },
    )

  const editDoc = (fn: (d: InsuranceRuleset) => InsuranceRuleset, coalesce?: string) => dispatch({ type: 'edit', edit: fn, coalesce })
  const editRule = (fn: (r: InsuranceRule) => InsuranceRule, coalesce?: string) =>
    rule && editDoc((d) => editRuleIn(d, rule.id, fn as (r: InsuranceRuleset['rules'][number]) => InsuranceRuleset['rules'][number]), coalesce)

  const validate = useMutation({
    mutationFn: (d: InsuranceRuleset) => rulesetDoors(kind).validate(d).then((issues) => ({ issues, against: d })),
    onSuccess: setChecks,
    onError: (err) => notify.apiError(t('checks.failed'), err, t('checks.failed')),
  })
  const save = useMutation({
    mutationFn: (d: InsuranceRuleset) => rulesetDoors(kind).save(d),
    onSuccess: (next) => {
      const saved = draftDocument(next)
      setStale(null)
      dispatch({ type: 'saved', doc: saved })
      queryClient.setQueryData(rulesetDraftKey(kind), next)
      notify.success(t('ruleset.saved'))
      validate.mutate(saved)
    },
    onError: (err) => {
      const code = apiErrorCode(err)
      if (code === DRAFT_STALE || (err instanceof ApiError && err.statusCode === 409 && code !== DRAFT_PENDING)) setStale(apiErrorMessage(err, t('ruleset.stale')))
      else notify.apiError(t('ruleset.saveFailed'), err, t('ruleset.saveFailed'))
    },
  })
  const reload = async () => {
    const fresh = await refetch()
    if (!fresh) return
    setStale(null)
    setChecks(null)
    dispatch({ type: 'saved', doc: draftDocument(fresh) })
  }
  const addNew = () => {
    const id = nextRuleId(rules, kind)
    editDoc((d) => addRule(d, newRule(id, kind) as InsuranceRuleset['rules'][number]))
    open(id)
  }

  const issuesOf = (id: string) => (checks?.issues ?? []).filter((i) => i.ruleId === id)
  const checksStale = checks !== null && !sameDoc(checks.against, h.present)
  const verdict = checks ? checksVerdict(checks.issues) : null
  const busy = save.isPending
  const locked = draft.state === 'pending'

  return (
    <>
      <LeaveGuard dirty={dirty} words={{ title: t('leave.title'), body: t('leave.body'), stay: t('leave.stay'), go: t('leave.go') }} />
      <RulesetApproval kind={doorKind(kind)} draft={draft} dirty={dirty} draftKey={rulesetDraftKey(kind)} />
      <div className="flex flex-wrap items-center gap-2" data-toolbar="">
        <Button variant="secondary" onClick={addNew} disabled={busy} data-new-rule="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('ruleset.new')}
        </Button>
        {dirty && (
          <span className="text-xs text-attention-800" data-unsaved="">
            {t('ruleset.unsaved')}
          </span>
        )}
        {locked && (
          <span className="text-xs text-muted-foreground" data-draft-locked="">
            {t('ruleset.pendingLocked')}
          </span>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => dispatch({ type: 'undo' })} disabled={!canUndo(h) || busy} data-undo="">
            <Undo2 className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
            {t('ruleset.undo')}
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: 'redo' })} disabled={!canRedo(h) || busy} data-redo="">
            <Redo2 className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
            {t('ruleset.redo')}
          </Button>
          <Button variant="text" onClick={() => dispatch({ type: 'cancel' })} disabled={!dirty || busy} data-cancel="">
            {t('ruleset.cancel')}
          </Button>
          <button
            type="button"
            onClick={() => validate.mutate(h.present)}
            disabled={validate.isPending}
            className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
              verdict?.errors ? 'border-danger-border bg-danger-050 text-danger-800' : verdict && !checksStale ? 'border-border bg-success-050' : 'border-border'
            }`}
            data-checks-pill={validate.isPending ? 'pending' : !verdict ? 'none' : checksStale ? 'stale' : verdict.errors ? 'errors' : verdict.warnings ? 'warnings' : 'pass'}
          >
            {validate.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {verdict && !verdict.errors && !verdict.warnings && !checksStale && <CircleCheck className="h-3.5 w-3.5" aria-hidden />}
            {!verdict
              ? t('checks.validate')
              : checksStale
                ? t('checks.again')
                : verdict.errors || verdict.warnings
                  ? t('checks.found', { errors: fsi(String(verdict.errors)), warnings: fsi(String(verdict.warnings)) })
                  : t('checks.pass')}
          </button>
          <Button variant="primary" onClick={() => save.mutate(h.present)} disabled={!dirty || busy || locked} title={locked ? t('ruleset.pendingLocked') : undefined} data-save="">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {t(busy ? 'ruleset.saving' : 'ruleset.save')}
          </Button>
        </div>
      </div>
      {stale && (
        <ErrorBanner className="p-3" title={t('ruleset.staleTitle')} message={stale}>
          <p className="mt-1 text-sm">{t('ruleset.stale')}</p>
          <Button variant="secondary" className="mt-2" onClick={() => void reload()} data-reload="">
            {t('ruleset.reload')}
          </Button>
        </ErrorBanner>
      )}

      <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]" onBlur={() => dispatch({ type: 'seal' })}>
        <div className="flex flex-col gap-2">
          <p className="rounded-md border border-primary-border bg-primary-050 px-3 py-2 text-sm" data-ruleset-order="">
            {t(`${kind}.order`)}
          </p>
          {rules.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-rules-empty="">
              {t('ruleset.empty')}
            </p>
          ) : (
            <RuleList
              kind={kind}
              rules={rules}
              folders={folders}
              openId={openId}
              onOpen={open}
              onMove={(id, delta) => editDoc((d) => moveRule(d, id, delta))}
              busy={busy}
              issuesOf={issuesOf}
            />
          )}
          {checks && !checksStale && checks.issues.some((i) => !i.ruleId) && <Issues issues={checks.issues.filter((i) => !i.ruleId)} hook="ruleset" />}
        </div>

        {rule ? (
          <RuleEditor
            key={rule.id}
            kind={kind}
            rule={rule}
            lists={h.present.lists ?? NO_LISTS}
            folders={folders.folders}
            edit={editRule}
            issues={checksStale ? [] : issuesOf(rule.id)}
          />
        ) : (
          <p className="text-sm text-muted-foreground" data-rule-none="">
            {t('ruleset.pick')}
          </p>
        )}
      </div>
    </>
  )
}

/** The folder filter's values: every folder, the rules in none, or one folder (`in:` + its name). */
const ALL_FOLDERS = 'all'
const NO_FOLDER = 'none'
const IN_FOLDER = 'in:'

/** A run's key: its folder and which of the folder's runs it is, so a re-cut elsewhere keeps it (and its collapse). */
const runKey = (run: FolderRun<unknown>) => JSON.stringify([run.folder, run.nth])

/**
 * The ruleset's rules in the order HQ runs them, cut into folder runs (oms 675): each run under a heading with its
 * folder, positions and count; a folder the order splits shows again, marked "continued". Positions are the rule's
 * place in the WHOLE ruleset everywhere. A heading collapses its run (kept here, never saved); the open rule's run
 * stays open. The filter shows one folder's runs, and turns the arrows off: one step in the whole order could pass a
 * rule it hides.
 */
function RuleList({
  kind,
  rules,
  folders: { folders, hasNone },
  openId,
  onOpen,
  onMove,
  busy,
  issuesOf,
}: {
  kind: InsuranceRuleKind
  rules: readonly InsuranceRule[]
  folders: ReturnType<typeof folderOptions>
  openId: string | null
  onOpen: (id: string) => void
  onMove: (id: string, delta: number) => void
  busy: boolean
  issuesOf: (id: string) => GuardIssue[]
}) {
  const { t, i18n } = useTranslation('insurance-coverage')
  const [picked, setPicked] = useState(ALL_FOLDERS)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const runs = useMemo(() => folderRuns(rules), [rules])
  const filter = picked === NO_FOLDER && hasNone ? '' : picked.startsWith(IN_FOLDER) && folders.includes(picked.slice(IN_FOLDER.length)) ? picked.slice(IN_FOLDER.length) : null
  const filtered = filter !== null
  // A picked folder no rule is in any more (moved, renamed, undone) is dropped, so it never comes back on its own.
  if (picked !== ALL_FOLDERS && !filtered) setPicked(ALL_FOLDERS)
  const toggle = (key: string) =>
    setCollapsed((c) => {
      const next = new Set(c)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const issueCount = new Map(rules.map((r) => [r.id, issuesOf(r.id).length]))
  /** One step in the whole order; while filtered the arrow only says why it is off. A rule moved into another run is
   * drawn under that run's list, so the keyboard is put back on the arrow it pressed. */
  const move = (id: string, delta: -1 | 1, hadFocus: boolean) => {
    if (filtered || busy) return
    onMove(id, delta)
    if (hadFocus) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-move-${delta < 0 ? 'up' : 'down'}="${CSS.escape(id)}"]`)?.focus())
  }
  const arrowWhy = filtered ? t('folders.reorderFiltered') : undefined
  return (
    <div className="flex flex-col gap-2" data-rule-list="">
      {folders.length > 0 && (
        <Field label={t('folders.filter')}>
          <Select value={filtered ? picked : ALL_FOLDERS} onChange={(e) => setPicked(e.target.value)} data-folder-filter="">
            <option value={ALL_FOLDERS}>{t('folders.all')}</option>
            {folders.map((f) => (
              <option key={f} value={IN_FOLDER + f}>
                {fsi(f)}
              </option>
            ))}
            {hasNone && <option value={NO_FOLDER}>{t('folders.none')}</option>}
          </Select>
        </Field>
      )}
      <ul className="flex flex-col gap-2">
        {runs
          .filter((run) => !filtered || run.folder === filter)
          .map((run) => {
            const key = runKey(run)
            const shut = collapsed.has(key) && !run.rules.some((x) => x.rule.id === openId)
            return (
              <li key={key} className="flex flex-col gap-1.5" data-folder-run={run.folder} data-continued={run.continued} data-positions={`${run.first}-${run.last}`}>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={!shut}
                  className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-start text-xs font-semibold text-muted-foreground hover:bg-muted"
                  data-folder-toggle={run.folder}
                >
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${shut ? '-rotate-90 rtl:rotate-90' : ''}`} aria-hidden />
                  <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {run.folder ? <bdi data-folder-name="">{run.folder}</bdi> : <span data-folder-name="">{t('folders.none')}</span>}
                  {run.continued && (
                    <span className="font-normal" data-folder-continued="">
                      {t('folders.continued')}
                    </span>
                  )}
                  <span className="ms-auto flex shrink-0 items-center gap-1 font-normal" data-folder-summary="">
                    {t('folders.positions')} <Ltr>{run.first === run.last ? String(run.first) : formatRange(run.first, run.last)}</Ltr>
                    <span aria-hidden>·</span>
                    {t('folders.count', { n: fsi(String(run.rules.length)) })}
                  </span>
                </button>
                {!shut && (
                  <ol className="flex flex-col gap-1.5">
                    {run.rules.map(({ rule: r, position }) => (
                      <li
                        key={r.id}
                        className={`flex items-start gap-2 rounded-md border p-2 ${r.id === openId ? 'border-primary bg-primary-050' : 'border-border bg-card'}`}
                        data-rule-row={r.id}
                        data-position={position}
                      >
                        <span className="mt-0.5 w-5 shrink-0 text-end text-xs text-muted-foreground" data-rule-position="">
                          <Ltr>{String(position)}</Ltr>
                        </span>
                        <button type="button" onClick={() => onOpen(r.id)} aria-current={r.id === openId || undefined} className="flex min-w-0 flex-1 flex-col items-start gap-1 text-start" data-rule-open={r.id}>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <RuleId id={r.id} />
                            <GuardStateBadge state={r.state} />
                            {issueCount.get(r.id)! > 0 && (
                              <span className="text-xs text-danger-800" data-rule-issues={issueCount.get(r.id)}>
                                {t('checks.onRule', { n: fsi(String(issueCount.get(r.id))) })}
                              </span>
                            )}
                          </span>
                          <span className="text-sm font-medium" data-rule-name="">
                            {r.name.en || r.name.ar ? <bdi>{saysIn(r.name, i18n.language)}</bdi> : <span className="text-muted-foreground">{t('ruleset.unnamed')}</span>}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5 text-xs" data-rule-does="">
                            <RuleDoes kind={kind} rule={r} />
                          </span>
                        </button>
                        <span className="flex flex-col gap-0.5">
                          <IconButton
                            label={t('ruleset.moveUp')}
                            title={arrowWhy}
                            size="compact"
                            disabled={position === 1 || busy}
                            aria-disabled={filtered || undefined}
                            onClick={(e) => move(r.id, -1, document.activeElement === e.currentTarget)}
                            data-move-up={r.id}
                          >
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                          </IconButton>
                          <IconButton
                            label={t('ruleset.moveDown')}
                            title={arrowWhy}
                            size="compact"
                            disabled={position === rules.length || busy}
                            aria-disabled={filtered || undefined}
                            onClick={(e) => move(r.id, 1, document.activeElement === e.currentTarget)}
                            data-move-down={r.id}
                          >
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                          </IconButton>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            )
          })}
      </ul>
    </div>
  )
}

/** What a rule does, in a line: the category it sets, or each coverage value with its payer mark. */
function RuleDoes({ kind, rule }: { kind: InsuranceRuleKind; rule: InsuranceRule }) {
  const { t } = useTranslation('insurance-coverage')
  if (kind === 'category') {
    const e = (rule as CategoryRule).then[0]
    return e ? (
      <>
        {t('reads.setsCategory')} <GroupName group={e.group} />
      </>
    ) : null
  }
  const effects = (rule as CoverageRule).then
  if (!effects.length) return <span className="text-muted-foreground">{t('effect.none')}</span>
  return (
    <>
      {effects.map((e) => (
        <CoverageEffectLine key={e.effect} e={e} />
      ))}
    </>
  )
}

function RuleEditor({
  kind,
  rule,
  lists,
  folders,
  edit,
  issues,
}: {
  kind: InsuranceRuleKind
  rule: InsuranceRule
  /** The document's own item lists (oms 674): the item-list rows pick from them, the reads-as names them. */
  lists: readonly GuardList[]
  /** The document's folders (oms 675): the folder box offers them, and takes a new name. */
  folders: readonly string[]
  edit: (fn: (r: InsuranceRule) => InsuranceRule, coalesce?: string) => void
  issues: GuardIssue[]
}) {
  const { t } = useTranslation('insurance-coverage')
  const fields = useQuery(fieldsQuery()).data
  const folderListId = useId()
  const reads = useMemo(() => rule.when.map((c) => conditionSentence(c, { rule: { filters: [] }, lists, fields })), [rule.when, lists, fields])
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]" data-rule-editor={rule.id}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <RuleId id={rule.id} />
          <GuardStateBadge state={rule.state} />
          {/* oms 674: the rule exactly as the engine reads it, unsaved edits included. */}
          <span className="ms-auto">
            <JsonButton title={t('rule.json', { id: fsi(rule.id) })} value={otherRuleOut(rule)} hook="rule" />
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <Field label={t('rule.nameEn')}>
            <Input dir="ltr" lang="en" value={rule.name.en} onChange={(e) => edit((r) => ({ ...r, name: { ...r.name, en: e.target.value } }), 'name.en')} data-input="name.en" />
          </Field>
          <Field label={t('rule.nameAr')}>
            <Input dir="rtl" lang="ar" value={rule.name.ar} onChange={(e) => edit((r) => ({ ...r, name: { ...r.name, ar: e.target.value } }), 'name.ar')} data-input="name.ar" />
          </Field>
          <Field label={t('rule.folder')}>
            <Input
              list={folderListId}
              value={rule.folder ?? ''}
              onChange={(e) => edit((r) => withFolder(r, e.target.value), 'folder')}
              onBlur={() => (rule.folder ?? '') !== ruleFolder(rule) && edit((r) => withFolder(r, folderPath(r.folder)), 'folder')}
              data-input="folder"
            />
            {/* A datalist option's value is what lands in the box, so a folder goes in as written (no isolates). */}
            <datalist id={folderListId} data-folder-options="">
              {folders.filter((f) => f !== ruleFolder(rule)).map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </Field>
        </div>
        <Issues issues={issues} hook="rule" />
        <Block kw={t('rule.if')} hint={t(`${kind}.ifHint`)} hook="if">
          <RuleConditions when={rule.when} lists={lists} edit={(fn, coalesce) => edit((r) => {
            const when = fn(r.when)
            return when === r.when ? r : { ...r, when }
          }, coalesce)} />
        </Block>
        <Block kw={t('rule.then')} hint={t(`${kind}.thenHint`)} hook="then">
          {kind === 'category' ? (
            <CategoryEffectEditor
              effect={(rule as CategoryRule).then[0] ?? { effect: 'setCategory', group: 'G2' }}
              onChange={(e) => edit((r) => ({ ...(r as CategoryRule), then: [e] }))}
            />
          ) : (
            <CoverageEffectEditor rule={rule as CoverageRule} onChange={(then, coalesce) => edit((r) => ({ ...(r as CoverageRule), then }), coalesce)} />
          )}
        </Block>
      </div>
      <aside className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 text-sm" data-reads-as="">
        <h2 className="text-xs font-semibold text-muted-foreground">{t('rule.readsAs')}</h2>
        {reads.length ? <ConditionTree nodes={reads} /> : <p className="text-xs text-muted-foreground">{t('rule.everyLine')}</p>}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2" data-reads-then="">
          <RuleDoes kind={kind} rule={rule} />
        </div>
      </aside>
    </div>
  )
}

function Block({ kw, hint, hook, children }: { kw: string; hint: string; hook: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border/60 bg-card" {...{ [`data-editor-${hook}`]: '' }}>
      <div className="flex items-baseline gap-2 border-b border-border/60 px-3 py-2">
        <span className="font-mono text-xs font-semibold tracking-wider text-primary">{kw}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="p-3 text-sm">{children}</div>
    </section>
  )
}

/** The rule moved to a folder; a blank folder drops the key (`folder` is optional in the document). */
function withFolder(r: InsuranceRule, folder: string): InsuranceRule {
  const next: InsuranceRule = { ...r, folder }
  if (!folder) delete next.folder
  return next
}
