import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, CircleCheck, Loader2, Redo2, Undo2 } from 'lucide-react'

import { ApiError, apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { GUARD_DRAFT_KEY, INSURANCE_RULES_KEY, STALE_REVISION, guardDraftQuery, guardDraftStateQuery, insuranceRulesApi } from '@/core/insurance-rules/api'
import { GuardSeverityBadge, GuardStateBadge, RuleId } from '@/core/insurance-rules/badges'
import { checksVerdict, indexChecks, type GuardIssue } from '@/core/insurance-rules/checks'
import { canRedo, canUndo, editorHistory, initialEditorHistory, isDirty, sameDoc, type EditorHistory, type EditorAction } from '@/core/insurance-rules/editor-history'
import { editGuard, newGuardRule, nextGuardId } from '@/core/insurance-rules/guard-edit'
import { guardRuleOut } from '@/core/insurance-rules/guard-wire'
import { codesHoldSave, sameNamedRules } from '@/core/insurance-rules/rule-checks'
import JsonButton from '@/core/insurance-rules/JsonButton'
import { ConditionTree } from '@/core/insurance-rules/GuardSentenceView'
import { guardEditPath, guardRulePath, guardsPath, ruleSeverity, type GuardRule, type GuardRuleset } from '@/core/insurance-rules/model'
import { guardSentence } from '@/core/insurance-rules/sentence'
import { fieldsQuery } from '@/core/insurance-rules/registry-api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import LeaveGuard from '@/core/ui/LeaveGuard'
import { fsi } from '@/core/util/bidi'
import ConditionEditor, { type RuleEdit } from './ConditionEditor'
import AudienceEditor from './AudienceEditor'
import EffectEditor from './EffectEditor'
import { DeniedCard } from '@/core/insurance-rules/parts'
import { Issues } from '@/core/insurance-rules/controls'

/**
 * Insurance rules ▸ Guards ▸ edit a guard (oms ticket 608; doors 3130 / 3131 shapes, Validate 3139). The rule's
 * conditions from a palette — All of / Any of groups nested up to three levels, NOT on any condition, typed
 * fields with units — and what it does: severity, the EN + AR message with placeholder chips, codes defaulted
 * from the first block, a suggestion, what an unknown fact does. The draft is ONE document saved whole
 * (`PUT InsuranceRules/Guards/Draft` with its `revision`; a stale one is a 409): Undo / Redo / Cancel / Save
 * act on it. The checks pill asks HQ's Validate about the draft on screen and pins each issue on the rule, a
 * block or a field.
 *
 * 🚩 UNGATED: no access probe until 618; a bare 403 on the read is "You do not have access".
 */
export default function GuardEditorPage() {
  const { t } = useTranslation('insurance-guards')
  const { ruleId } = useParams()
  const draft = useQuery(guardDraftQuery())
  // The draft's own state (same cache entry): a submitted draft is frozen until approved or sent back (3139).
  const pending = useQuery(guardDraftStateQuery()).data?.state === 'pending'
  // A new rule's first save moves to its edit URL: the SAME editor carries on (its history, a stale banner),
  // so the id it created keeps the key it was mounted with.
  const [created, setCreated] = useState<string | null>(null)
  const editorKey = ruleId && ruleId !== created ? ruleId : 'new'

  let body: ReactNode
  if (draft.isError && isBareDenial(draft.error)) body = <DeniedCard ns="insurance-guards" hook="editor-denied" />
  else if (draft.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(draft.error, t('rule.failed'))} />
  else if (!draft.data)
    body = (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('rule.loading')}
      </div>
    )
  else body = <Editor
        key={editorKey}
        doc={draft.data}
        ruleId={ruleId ?? null}
        onCreated={setCreated}
        pending={pending}
        refetch={async () => (await draft.refetch()).data}
      />

  return (
    <section className="flex w-full max-w-6xl flex-col gap-4" data-guard-editor="">
      {body}
    </section>
  )
}

type Checks = { issues: GuardIssue[]; against: GuardRuleset } | null

function Editor({
  doc,
  ruleId,
  onCreated,
  refetch,
  pending,
}: {
  doc: GuardRuleset
  ruleId: string | null
  onCreated: (id: string) => void
  /** The draft waits for approval: HQ refuses a save (409 `GUARDS_DRAFT_PENDING`), so none is offered. */
  pending: boolean
  refetch: () => Promise<GuardRuleset | undefined>
}) {
  const { t } = useTranslation('insurance-guards')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = ruleId === null
  const [id] = useState(() => ruleId ?? nextGuardId(doc.rules))
  const [h, dispatch] = useReducer(
    editorHistory as (h: EditorHistory<GuardRuleset>, a: EditorAction<GuardRuleset>) => EditorHistory<GuardRuleset>,
    null,
    () => initialEditorHistory(doc, isNew ? { ...doc, rules: [...doc.rules, newGuardRule(id)] } : doc),
  )
  const [checks, setChecks] = useState<Checks>(null)
  const [stale, setStale] = useState<string | null>(null)
  // A new rule's first save moves to its edit URL once the saved state is on screen — not inside the
  // mutation's callback, where the leave guard still sees the unsaved draft and would hold the move.
  const [moveTo, setMoveTo] = useState<string | null>(null)

  // A re-read of the draft (another tab's save) moves what Cancel returns to; an unsaved edit is kept.
  useEffect(() => {
    if (doc !== h.saved && !sameDoc(doc, h.saved)) dispatch({ type: 'load', doc })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc])

  const rule = h.present.rules.find((r) => r.id === id)
  const dirty = isDirty(h)
  useEffect(() => {
    if (moveTo && !dirty) {
      setMoveTo(null)
      navigate(moveTo, { replace: true })
    }
  }, [moveTo, dirty, navigate])
  const edit: RuleEdit = (fn, coalesce) => dispatch({ type: 'edit', edit: (d) => editGuard(d, id, fn), coalesce })

  const validate = useMutation({
    mutationFn: (d: GuardRuleset) => insuranceRulesApi.validateGuardDraft(d).then((issues) => ({ issues, against: d })),
    onSuccess: setChecks,
    onError: (err) => notify.apiError(t('editor.checks.failed'), err, t('editor.checks.failed')),
  })

  const save = useMutation({
    mutationFn: (d: GuardRuleset) => insuranceRulesApi.saveGuardDraft(d),
    onSuccess: (draftNow) => {
      const saved = draftNow.document
      setStale(null)
      dispatch({ type: 'saved', doc: saved })
      queryClient.setQueryData(GUARD_DRAFT_KEY, draftNow)
      void queryClient.invalidateQueries({ queryKey: [...INSURANCE_RULES_KEY, 'guards', 'list'] })
      notify.success(t('editor.saved'))
      validate.mutate(saved)
      if (isNew) {
        onCreated(id)
        setMoveTo(guardEditPath(id))
      }
    },
    onError: (err) => {
      if ((err instanceof ApiError && err.statusCode === 409) || apiErrorCode(err) === STALE_REVISION) setStale(apiErrorMessage(err, t('editor.stale')))
      else notify.apiError(t('editor.saveFailed'), err, t('editor.saveFailed'))
    },
  })

  const reload = async () => {
    const fresh = await refetch()
    if (!fresh) return
    setStale(null)
    setChecks(null)
    dispatch({ type: 'saved', doc: fresh })
    if (!fresh.rules.some((r) => r.id === id)) navigate(guardsPath(), { replace: true })
  }

  const cancel = () => {
    dispatch({ type: 'cancel' })
    if (isNew) navigate(guardsPath())
  }

  const index = useMemo(() => (rule ? indexChecks(checks?.issues ?? [], rule) : null), [checks, rule])

  if (!rule || !index)
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" role="alert" data-rule-not-found="">
        {t('rule.notFound')} <RuleId id={id} />
      </p>
    )

  const checksStale = checks !== null && !sameDoc(checks.against, h.present)
  const severity = ruleSeverity(rule)
  const busy = save.isPending

  return (
    <>
      <LeaveGuard
        dirty={dirty}
        words={{ title: t('editor.leave.title'), body: t('editor.leave.body'), stay: t('editor.leave.stay'), go: t('editor.leave.go') }}
      />
      <Link to={isNew ? guardsPath() : guardRulePath(id)} className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline" data-back="">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        {t(isNew ? 'rule.back' : 'editor.back')}
      </Link>

      {pending && (
        <p className="rounded-md border border-border bg-attention-050 p-2 text-sm text-attention-800" role="status" data-draft-pending="">
          {t('editor.pending')}
        </p>
      )}
      <header className="flex flex-col gap-2" data-editor-header="">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight" data-mode={isNew ? 'new' : 'edit'}>
            {t(isNew ? 'editor.titleNew' : 'editor.titleEdit')}
          </h1>
          <RuleId id={rule.id} />
          <GuardStateBadge state={rule.state} />
          {severity && <GuardSeverityBadge severity={severity} />}
          {dirty && (
            <span className="text-xs text-attention-800" data-unsaved="">
              {t('editor.unsaved')}
            </span>
          )}
          <div className="ms-auto flex flex-wrap items-center gap-2" data-toolbar="">
            <JsonButton title={t('editor.json', { id: fsi(rule.id) })} value={guardRuleOut(rule)} hook="editor" />
            <Button variant="ghost" onClick={() => dispatch({ type: 'undo' })} disabled={!canUndo(h) || busy} data-undo="">
              <Undo2 className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
              {t('editor.undo')}
            </Button>
            <Button variant="ghost" onClick={() => dispatch({ type: 'redo' })} disabled={!canRedo(h) || busy} data-redo="">
              <Redo2 className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
              {t('editor.redo')}
            </Button>
            <Button variant="text" onClick={cancel} disabled={(!dirty && !isNew) || busy} data-cancel="">
              {t('editor.cancel')}
            </Button>
            <ChecksPill checks={checks} stale={checksStale} pending={validate.isPending} elsewhere={index.elsewhere.length} onCheck={() => validate.mutate(h.present)} />
            <Button variant="primary" onClick={() => save.mutate(h.present)} disabled={!dirty || busy || pending || codesHoldSave(rule)} data-save="">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {t(busy ? 'editor.saving' : 'editor.save')}
            </Button>
          </div>
        </div>
        {stale && (
          <ErrorBanner className="p-3" title={t('editor.staleTitle')} message={stale}>
            <p className="mt-1 text-sm">{t('editor.stale')}</p>
            <Button variant="secondary" className="mt-2" onClick={() => void reload()} data-reload="">
              {t('editor.reload')}
            </Button>
          </ErrorBanner>
        )}
        <div className="grid gap-2 md:grid-cols-2">
          <Field label={t('editor.nameEn')}>
            <Input
              dir="ltr"
              lang="en"
              value={rule.name.en}
              aria-invalid={index.rule.some((i) => i.field === 'name.en') || undefined}
              onChange={(e) => edit((r) => ({ ...r, name: { ...r.name, en: e.target.value } }), 'name.en')}
              data-input="name.en"
            />
          </Field>
          <Field label={t('editor.nameAr')}>
            <Input
              dir="rtl"
              lang="ar"
              value={rule.name.ar}
              aria-invalid={index.rule.some((i) => i.field === 'name.ar') || undefined}
              onChange={(e) => edit((r) => ({ ...r, name: { ...r.name, ar: e.target.value } }), 'name.ar')}
              data-input="name.ar"
            />
          </Field>
        </div>
        <SameNames rule={rule} rules={h.present.rules} />
        <Issues issues={index.rule} hook="rule" />
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]" onBlur={() => dispatch({ type: 'seal' })}>
        <div className="flex flex-col gap-4">
          <Block kw={t('rule.when')} hint={t('rule.whenHint')} hook="when">
            <AudienceEditor rule={rule} edit={edit} />
          </Block>
          <Block kw={t('rule.if')} hint={t('rule.ifHint')} hook="if">
            <ConditionEditor rule={rule} lists={h.present.lists} edit={edit} checks={index} />
            <fieldset className="mt-3 flex flex-wrap items-center gap-3 text-xs" data-on-unknown-editor="">
              <legend className="sr-only">{t('editor.onUnknown.label')}</legend>
              <span className="text-muted-foreground">{t('editor.onUnknown.label')}</span>
              {(['none', 'warn'] as const).map((v) => (
                <label key={v} className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name="onUnknown"
                    value={v}
                    checked={rule.onUnknown === v}
                    onChange={() => edit((r) => (r.onUnknown === v ? r : { ...r, onUnknown: v }))}
                    data-on-unknown={v}
                  />
                  {t(`editor.onUnknown.${v}`)}
                </label>
              ))}
            </fieldset>
          </Block>
          <Block kw={t('rule.then')} hint={t('rule.thenHint')} hook="then">
            <EffectEditor rule={rule} edit={edit} checks={index} />
          </Block>
        </div>
        <aside className="flex flex-col gap-4">
          <ReadsAs rule={rule} doc={h.present} />
        </aside>
      </div>
    </>
  )
}

/** The rule on screen, read as sentences (the rule page's words). */
function ReadsAs({ rule, doc }: { rule: GuardRule; doc: GuardRuleset }) {
  const { t } = useTranslation('insurance-guards')
  // 617: a fact reads by its registry label (610's Fields).
  const fields = useQuery(fieldsQuery()).data
  const s = guardSentence(rule, doc.lists, fields)
  return (
    <section className="rounded-lg border border-border/60 bg-card p-3 text-sm" data-reads-as="">
      <h2 className="mb-2 text-xs font-semibold text-muted-foreground">{t('editor.readsAs')}</h2>
      {s.conditions.length ? <ConditionTree nodes={s.conditions} /> : <p className="text-xs text-muted-foreground">{t('editor.group.empty')}</p>}
    </section>
  )
}

/** "Check the draft": HQ's Validate on the draft as it is on screen — errors, warnings, or all pass. */
function ChecksPill({
  checks,
  stale,
  pending,
  elsewhere,
  onCheck,
}: {
  checks: Checks
  stale: boolean
  pending: boolean
  elsewhere: number
  onCheck: () => void
}) {
  const { t } = useTranslation('insurance-guards')
  const verdict = checks ? checksVerdict(checks.issues) : null
  const state = pending ? 'pending' : !verdict ? 'none' : stale ? 'stale' : verdict.errors ? 'errors' : verdict.warnings ? 'warnings' : 'pass'
  const tone =
    state === 'errors' ? 'border-danger-border bg-danger-050 text-danger-800' : state === 'warnings' || state === 'stale' ? 'border-border bg-attention-050 text-attention-800' : state === 'pass' ? 'border-border bg-success-050' : 'border-border'
  return (
    <button
      type="button"
      onClick={onCheck}
      disabled={pending}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${tone}`}
      data-checks-pill={state}
      title={stale ? t('editor.checks.stale') : t('editor.checks.validate')}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {state === 'pass' && <CircleCheck className="h-3.5 w-3.5" aria-hidden />}
      {state === 'none' && t('editor.checks.validate')}
      {state === 'pending' && t('editor.checks.checking')}
      {state === 'pass' && t('editor.checks.pass')}
      {verdict && !pending && (verdict.errors > 0 || verdict.warnings > 0) && (
        <>
          {verdict.errors > 0 && <span data-errors={verdict.errors}>{t('editor.checks.errors', { count: verdict.errors, n: fsi(String(verdict.errors)) })}</span>}
          {verdict.warnings > 0 && <span data-warnings={verdict.warnings}>{t('editor.checks.warnings', { count: verdict.warnings, n: fsi(String(verdict.warnings)) })}</span>}
        </>
      )}
      {verdict && !pending && elsewhere > 0 && (
        <span className="text-muted-foreground" data-elsewhere={elsewhere}>
          {t('editor.checks.elsewhere', { count: elsewhere, n: fsi(String(elsewhere)) })}
        </span>
      )}
      {state === 'stale' && <span data-checks-stale="">{t('editor.checks.again')}</span>}
    </button>
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

/** 659 — another rule of the draft already carries this name: a warning, so two rules are not mixed up while editing. */
function SameNames({ rule, rules }: { rule: GuardRule; rules: readonly GuardRule[] }) {
  const { t } = useTranslation('insurance-guards')
  const same = sameNamedRules(rule, rules)
  const ids = [...new Set([...same.en, ...same.ar])]
  if (ids.length === 0) return null
  return (
    <p className="text-xs text-attention-800" role="status" data-same-name={ids.join(' ')}>
      {t('editor.sameName', { count: ids.length, ids: ids.map((id) => fsi(id)).join(', ') })}
    </p>
  )
}
