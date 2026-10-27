import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { INSURANCE_RULES_KEY, rulesetApprovalDoors, rulesetDraftDoors } from './api'
import { actionsFor, type ApprovalAction } from './approval'
import { checksVerdict } from './checks'
import { ByAt, TD, TH } from './parts'

type Kind = 'Categories' | 'Coverage'

/**
 * Submit / Approve / Send back and the Versions of a category or coverage ruleset (review 3126 P6b; 617's rulesets on
 * "the same authoring doors" as 611's guards). An author asks for approval of the SAVED draft once HQ's checks of
 * that revision show no error (no back-test: that is the guards'); a different user approves or sends it back;
 * Restore makes a version the new draft. Speaks in the area namespace (`insurance-rules:approval.*`).
 */
export default function RulesetApproval({ kind, doc, dirty, draftKey }: { kind: Kind; doc: { revision: number }; dirty: boolean; draftKey: readonly unknown[] }) {
  const { t } = useTranslation('insurance-rules')
  const qc = useQueryClient()
  const userId = useSession((s) => s.userId)
  const doors = rulesetApprovalDoors<{ revision: number }>(kind)
  const key = [...INSURANCE_RULES_KEY, kind, 'approval'] as const
  const approval = useQuery({ queryKey: key, queryFn: () => doors.approval(), retry: false })
  const checks = useQuery({ queryKey: [...INSURANCE_RULES_KEY, kind, 'checks', doc.revision], queryFn: () => rulesetDraftDoors(kind).validate(doc), retry: false })
  const versions = useQuery({ queryKey: [...INSURANCE_RULES_KEY, kind, 'versions'], queryFn: () => doors.versions(), retry: false })
  const [note, setNote] = useState('')
  const act = useMutation({
    mutationFn: (a: ApprovalAction['kind']) => (a === 'submit' ? doors.submit(note.trim()) : a === 'approve' ? doors.approve(note.trim()) : doors.sendBack(note.trim())),
    onSuccess: async (next, a) => {
      setNote('')
      qc.setQueryData(key, next)
      notify.success(t(`approval.done.${a}`))
      await qc.invalidateQueries({ queryKey: draftKey })
      await qc.invalidateQueries({ queryKey: [...INSURANCE_RULES_KEY, kind, 'versions'] })
    },
  })
  const restore = useMutation({
    mutationFn: (v: number) => doors.restore(v),
    onSuccess: async (d, v) => {
      qc.setQueryData(draftKey, d)
      notify.success(t('approval.versions.restored', { version: fsi(v), revision: fsi(d.revision) }))
      await qc.invalidateQueries({ queryKey: key })
    },
    onError: (err) => notify.apiError(t('approval.versions.restoreFailed'), err, t('approval.versions.restoreFailed')),
  })

  if (!approval.data) {
    return approval.isError ? <ErrorBanner className="p-2" message={apiErrorMessage(approval.error, t('approval.failed'))} /> : null
  }
  const a = approval.data
  const verdict = checks.data ? checksVerdict(checks.data) : null
  const actions = actionsFor({ approval: a, userId, backtest: null, checks: verdict, needsBacktest: false, dirty })
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3 text-sm" data-ruleset-approval={a.state}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">{t('approval.title')}</h2>
        <span className="text-xs text-muted-foreground" data-approval-state={a.state}>
          {t(`approval.state.${a.state}`)}
        </span>
        {a.submittedBy && (
          <span className="text-xs text-muted-foreground">
            {t('approval.submittedBy')} <ByAt by={a.submittedBy} at={a.submittedAt} />
          </span>
        )}
      </div>
      {a.note && (
        <p className="text-xs" data-approval-note="">
          <bdi>{a.note}</bdi>
        </p>
      )}
      {a.sentBack && (
        <p className="text-xs text-attention-800" data-sent-back="">
          {t('approval.sentBackBy')} <ByAt by={a.sentBack.by} at={a.sentBack.at} /> <bdi>{a.sentBack.note}</bdi>
        </p>
      )}
      {actions.length > 0 && (
        <div className="flex flex-col gap-2" data-approval-actions="">
          <Field label={t(a.state === 'draft' ? 'approval.noteToApprover' : 'approval.noteToAuthor')}>
            <Textarea rows={2} dir="auto" value={note} onChange={(e) => setNote(e.target.value)} data-note="" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((x) => (
              <Button
                key={x.kind}
                variant={x.kind === 'sendBack' ? 'secondary' : 'primary'}
                disabled={!x.enabled || act.isPending}
                title={x.why ? t(`approval.why.${x.why}`) : undefined}
                onClick={() => x.enabled && act.mutate(x.kind)}
                data-action={x.kind}
              >
                {act.isPending && act.variables === x.kind && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {t(`approval.action.${x.kind}`)}
              </Button>
            ))}
            {actions[0].why && (
              <span className="text-xs text-muted-foreground" data-why={actions[0].why}>
                {t(`approval.why.${actions[0].why}`)}
              </span>
            )}
          </div>
          {act.isError && (
            <div data-action-refused="">
              <ErrorBanner message={apiErrorMessage(act.error, t('approval.failedAction'))} />
            </div>
          )}
        </div>
      )}
      <details data-ruleset-versions="">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{t('approval.versions.title')}</summary>
        {versions.isError ? (
          <ErrorBanner className="mt-2 p-2" message={apiErrorMessage(versions.error, t('approval.versions.failed'))} />
        ) : !versions.data ? null : versions.data.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground" data-versions-empty="">
            {t('approval.versions.empty')}
          </p>
        ) : (
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr>
                <th className={TH}>{t('approval.versions.version')}</th>
                <th className={TH}>{t('approval.versions.byAt')}</th>
                <th className={TH}>{t('approval.versions.note')}</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {versions.data.map((v) => (
                <tr key={v.version} className="border-t border-border/60" data-version={v.version}>
                  <td className={TD}>
                    <Ltr>{v.version}</Ltr>
                  </td>
                  <td className={TD}>
                    <ByAt by={v.by} at={v.at} />
                  </td>
                  <td className={TD}>{v.note ? <bdi>{v.note}</bdi> : <span className="text-muted-foreground">{t('approval.versions.noNote')}</span>}</td>
                  <td className={`${TD} text-end`}>
                    <Button
                      variant="text"
                      disabled={restore.isPending}
                      data-restore={v.version}
                      onClick={async () => {
                        if (await confirmAction(t('approval.versions.confirmBody', { version: fsi(v.version) }), t('approval.versions.confirmTitle'))) restore.mutate(v.version)
                      }}
                    >
                      {t('approval.versions.restore')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </section>
  )
}
