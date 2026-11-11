import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BadgeCheck, Play, Save, ShieldOff } from 'lucide-react'
import { sqlEditHref } from '@/core/analytics-routes'
import i18n from '@/core/i18n'
import type { AnalyticsLabel } from '@/core/models/analytics'
import type { AnalyticsSqlEditorSeed, AnalyticsSqlItem, AnalyticsSqlRefusal, AnalyticsSqlResult } from '@/core/models/analytics-sql'
import { saysIn } from '@/core/rules/sentence'
import { fsi } from '@/core/util/bidi'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import Textarea from '@/core/ui/Textarea'
import { analyticsAccessQuery, canCurateAnalytics, canEditSql, canViewAnalytics } from './access'
import { ANALYTICS_ITEMS_KEY, analyticsApi, analyticsItemKey, analyticsRevisionsKey, analyticsSqlItemKey } from './api'
import ItemHistory from './ItemHistory'
import Refused from './Refused'
import { SqlRefusalNote, SqlResultTable } from './SqlResult'
import { removesVerified, sqlItemActions, sqlRunRefusal, sqlSaveBody } from './sql-editor'
import { analyticsErrorWords } from './wire'

/**
 * The SQL editor (ticket 890, BackOffice spec 3632 Q44, Q45) at `/analytics/sql/:id`, and at `/analytics/sql/new` on a
 * statement handed over in route state (the copilot's SQL answer's Edit).
 *
 * The statement; Run (`POST Analytics/Sql/Run`, the one SQL door) and its rows, or its refusal's reason at its line and
 * column; Save, a new revision (`PUT Analytics/Item/{id}`, run first by the server) or, for a new statement, a new
 * Personal SQL item; the revisions with their authors and Restore (`ItemHistory`, `…/Revert`); a curator's Verify and
 * Unverify. A save that changes a verified statement removes the mark: the editor says so before Save.
 *
 * Behind `canViewAnalytics`: a reader without the SQL grant sees the statement and its kept result, read only.
 */
export default function AnalyticsSqlEditorPage({ isNew = false }: { isNew?: boolean }) {
  const { t } = useTranslation('boards')
  return (
    <ScreenGate query={analyticsAccessQuery()} can={canViewAnalytics} ns="boards" title={t('sqlEditor.title')} subtitle={t('sqlEditor.subtitle')}>
      {isNew ? <NewSqlBody /> : <ItemSqlBody />}
    </ScreenGate>
  )
}

function ItemSqlBody() {
  const { t } = useTranslation('boards')
  const { id = '' } = useParams()
  const item = useQuery({ queryKey: analyticsSqlItemKey(id), queryFn: () => analyticsApi.sqlItem(id), retry: false })
  if (item.error) return <Refused err={item.error} fallbackKey="sqlEditor.loadFailed" />
  if (!item.data) {
    return (
      <div className="text-sm text-muted-foreground" role="status">
        {t('sqlEditor.loading')}
      </div>
    )
  }
  // A new revision (a save or a restore) starts the editor again from what the server holds.
  return <SqlEditor key={`${item.data.id}:${item.data.revision}`} item={item.data} seed={null} />
}

function NewSqlBody() {
  const state = useLocation().state as Partial<AnalyticsSqlEditorSeed> | null
  const seed: AnalyticsSqlEditorSeed = {
    statement: typeof state?.statement === 'string' ? state.statement : '',
    ...(typeof state?.question === 'string' ? { question: state.question } : {}),
  }
  return <SqlEditor item={null} seed={seed} />
}

/** The last Run's answer: its rows, or its refusal and the statement it was about (the place is in that text). */
type LastRun = { result: AnalyticsSqlResult } | { refusal: AnalyticsSqlRefusal; statement: string }

function SqlEditor({ item, seed }: { item: AnalyticsSqlItem | null; seed: AnalyticsSqlEditorSeed | null }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const access = useQuery(analyticsAccessQuery()).data
  const userId = useSession((s) => s.userId)
  const acts = item
    ? sqlItemActions(item, { userId, canView: canViewAnalytics(access), canSql: canEditSql(access), canCurate: canCurateAnalytics(access) })
    : { edit: canEditSql(access), verify: null }

  const [statement, setStatement] = useState(item?.definition.statement ?? seed?.statement ?? '')
  const [title, setTitle] = useState<AnalyticsLabel>({ en: '', ar: '' })
  const [last, setLast] = useState<LastRun | null>(null)

  // Until a Run, an item shows its kept run (Q47) or its kept refusal (Q49).
  const shown: LastRun | null =
    last ??
    (item?.sql?.result ? { result: item.sql.result } : item?.sql?.refusal ? { refusal: item.sql.refusal, statement: item.definition.statement } : null)

  const refusedOr = (err: unknown, fallback: string, ran: string) => {
    const refusal = sqlRunRefusal(err)
    if (refusal) setLast({ refusal, statement: ran })
    else toast.error(analyticsErrorWords(err, t(fallback), t))
  }

  const landed = (saved: AnalyticsSqlItem) => {
    queryClient.setQueryData(analyticsSqlItemKey(saved.id), saved)
    void queryClient.invalidateQueries({ queryKey: analyticsItemKey(saved.id) })
    void queryClient.invalidateQueries({ queryKey: analyticsRevisionsKey(saved.id) })
    void queryClient.invalidateQueries({ queryKey: ANALYTICS_ITEMS_KEY })
  }

  const run = useMutation({
    mutationFn: (s: string) => analyticsApi.sqlRun(s),
    onSuccess: (result) => setLast({ result }),
    onError: (err, s) => refusedOr(err, 'sqlEditor.runFailed', s),
  })

  const save = useMutation({
    mutationFn: (s: string) =>
      item
        ? analyticsApi.saveSqlItem(item.id, sqlSaveBody(item, s))
        : analyticsApi.createSqlItem({ statement: s, question: seed?.question ?? '', title: { en: title.en.trim(), ar: title.ar.trim() } }),
    onSuccess: (saved) => {
      landed(saved)
      toast.success(t('sqlEditor.saved', { revision: fsi(String(saved.revision)) }))
      if (!item) navigate(sqlEditHref(saved.id), { replace: true })
    },
    onError: (err, s) => refusedOr(err, 'sqlEditor.saveFailed', s),
  })

  const verify = useMutation({
    mutationFn: (on: boolean) => (item ? (on ? analyticsApi.sqlVerify(item.id) : analyticsApi.sqlUnverify(item.id)) : Promise.reject(new Error('no item'))),
    onSuccess: (saved, on) => {
      landed(saved)
      toast.success(t(on ? 'sqlEditor.verifiedDone' : 'sqlEditor.unverifiedDone'))
    },
    onError: (err) => toast.error(sqlRunRefusal(err)?.message || analyticsErrorWords(err, t('sqlEditor.verifyFailed'), t)),
  })

  const blank = statement.trim() === ''
  const untitled = !item && title.en.trim() === '' && title.ar.trim() === ''
  const busy = run.isPending || save.isPending
  const heading = item ? saysIn(item.title, lang) : ''
  const warnMark = item ? removesVerified(item, statement) : false

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-4" data-analytics-sql-editor={item?.id ?? 'new'}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight">{heading ? <bdi>{heading}</bdi> : t('sqlEditor.newTitle')}</h2>
          <StatusBadge sev={item?.verified ? 'ok' : 'warn'}>
            <span data-analytics-sql-mark={item?.verified ? 'verified' : 'sql'}>{t(item?.verified ? 'sqlEditor.markVerified' : 'sqlEditor.mark')}</span>
          </StatusBadge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item && acts.verify && (
            <Button
              variant="secondary"
              onClick={() => verify.mutate(acts.verify === 'verify')}
              disabled={verify.isPending}
              data-analytics-sql-verify={acts.verify}
            >
              {acts.verify === 'verify' ? <BadgeCheck className="size-3.5" aria-hidden /> : <ShieldOff className="size-3.5" aria-hidden />}
              {t(acts.verify === 'verify' ? 'sqlEditor.verify' : 'sqlEditor.unverify')}
            </Button>
          )}
          {item && (
            <ItemHistory
              item={item}
              kind="view"
              may={acts.edit}
              onReverted={() => void queryClient.invalidateQueries({ queryKey: analyticsSqlItemKey(item.id) })}
            />
          )}
        </div>
      </header>

      {item?.definition.question && (
        <p className="text-sm text-muted-foreground">
          {t('sqlEditor.question')} <bdi>{item.definition.question}</bdi>
        </p>
      )}

      {!item && acts.edit && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('sqlEditor.titleEn')}>
            <Input value={title.en} maxLength={200} onChange={(e) => setTitle((x) => ({ ...x, en: e.target.value }))} data-analytics-sql-title="en" />
          </Field>
          <Field label={t('sqlEditor.titleAr')}>
            <Input value={title.ar} maxLength={200} dir="rtl" onChange={(e) => setTitle((x) => ({ ...x, ar: e.target.value }))} data-analytics-sql-title="ar" />
          </Field>
        </div>
      )}

      <Field label={t('sqlEditor.statement')} hint={acts.edit ? undefined : t('sqlEditor.readOnly')}>
        <Textarea
          dir="ltr"
          rows={12}
          spellCheck={false}
          className="w-full text-start font-mono text-xs"
          value={statement}
          readOnly={!acts.edit}
          onChange={(e) => setStatement(e.target.value)}
          data-analytics-sql-statement
        />
      </Field>

      {acts.edit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => run.mutate(statement)} disabled={blank || busy} data-analytics-sql-run>
            <Play className="size-3.5" aria-hidden />
            {t(run.isPending ? 'sqlEditor.running' : 'sqlEditor.run')}
          </Button>
          <Button variant="primary" onClick={() => save.mutate(statement)} disabled={blank || untitled || busy} data-analytics-sql-save>
            <Save className="size-3.5" aria-hidden />
            {t(save.isPending ? 'sqlEditor.saving' : 'sqlEditor.save')}
          </Button>
          {untitled && <span className="text-xs text-muted-foreground">{t('sqlEditor.needsTitle')}</span>}
        </div>
      )}

      {warnMark && (
        <p role="note" className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm" data-analytics-sql-removes-verified>
          {t('sqlEditor.removesVerified')}
        </p>
      )}

      {shown && ('result' in shown ? <SqlResultTable result={shown.result} /> : <SqlRefusalNote refusal={shown.refusal} statement={shown.statement} />)}
    </article>
  )
}

