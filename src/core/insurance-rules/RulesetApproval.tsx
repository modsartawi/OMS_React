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
import { INSURANCE_RULES_KEY } from './api'
import { checksVerdict } from './checks'
import { ByAt, TD, TH } from './parts'
import { draftDocument, rulesetActions, rulesetDoors, type RulesetAction, type RulesetDoorKind, type RulesetDraft } from './ruleset-draft'

/**
 * Submit / Approve / Send back and the Versions of a category or coverage ruleset (617 on BackOffice 3145 / 3146, the
 * guard doors as built). An author asks for approval of the SAVED draft once HQ's checks of that revision show no
 * error — no back-test; a different user approves it or sends it back. An approved document publishes LIVE (no
 * shadow, no promote). Restore makes a version the new draft. Speaks in the area namespace (`insurance-rules:approval.*`).
 */
export default function RulesetApproval<T extends { revision: number }>({
  kind,
  draft,
  dirty,
  draftKey,
}: {
  kind: RulesetDoorKind
  draft: RulesetDraft<T>
  dirty: boolean
  draftKey: readonly unknown[]
}) {
  const { t } = useTranslation('insurance-rules')
  const qc = useQueryClient()
  const userId = useSession((s) => s.userId)
  const doors = rulesetDoors<T>(kind)
  const doc = draftDocument(draft)
  const versionsKey = [...INSURANCE_RULES_KEY, kind, 'versions'] as const
  const checks = useQuery({
    queryKey: [...INSURANCE_RULES_KEY, kind, 'checks', draft.revision],
    queryFn: () => doors.validate(doc),
    retry: false,
    enabled: draft.state !== 'none',
  })
  const versions = useQuery({ queryKey: versionsKey, queryFn: () => doors.versions(), retry: false })
  const [note, setNote] = useState('')
  const act = useMutation({
    mutationFn: async (a: RulesetAction['kind']) => {
      if (a === 'submit') return doors.submit(draft.revision, note.trim())
      if (a === 'approve') return doors.approve(draft.revision, note.trim())
      return doors.sendBack(note.trim())
    },
    onSuccess: async (_next, a) => {
      setNote('')
      notify.success(t(`approval.done.${a}`))
      await qc.invalidateQueries({ queryKey: draftKey })
      await qc.invalidateQueries({ queryKey: versionsKey })
    },
  })
  const restore = useMutation({
    mutationFn: (v: number) => doors.restore(v),
    onSuccess: async (d, v) => {
      qc.setQueryData(draftKey, d)
      notify.success(t('approval.versions.restored', { version: fsi(v), revision: fsi(d.revision) }))
    },
    onError: (err) => notify.apiError(t('approval.versions.restoreFailed'), err, t('approval.versions.restoreFailed')),
  })

  const verdict = checks.data ? checksVerdict(checks.data) : null
  const actions = rulesetActions({ draft, userId, checks: verdict, dirty })
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3 text-sm" data-ruleset-approval={draft.state}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">{t('approval.title')}</h2>
        <span className="text-xs text-muted-foreground" data-approval-state={draft.state}>
          {t(`approval.draftState.${draft.state}`)}
        </span>
        {draft.requestedBy && draft.state === 'pending' && (
          <span className="text-xs text-muted-foreground">
            {t('approval.submittedBy')} <ByAt by={draft.requestedBy} at={draft.requestedAt} />
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground" data-publishes-live="">
        {t('approval.publishesLive')}
      </p>
      {draft.requestNote && draft.state === 'pending' && (
        <p className="text-xs" data-approval-note="">
          <bdi>{draft.requestNote}</bdi>
        </p>
      )}
      {draft.state === 'sentBack' && draft.reviewedBy && (
        <p className="text-xs text-attention-800" data-sent-back="">
          {t('approval.sentBackBy')} <Ltr>{draft.reviewedBy}</Ltr> {draft.reviewNote && <bdi>{draft.reviewNote}</bdi>}
        </p>
      )}
      {actions.length > 0 && (
        <div className="flex flex-col gap-2" data-approval-actions="">
          <Field label={t(draft.state === 'pending' ? 'approval.noteToAuthor' : 'approval.noteToApprover')}>
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
                <tr key={v.versionNo} className="border-t border-border/60" data-version={v.versionNo}>
                  <td className={TD}>
                    <Ltr>{v.versionNo}</Ltr>
                  </td>
                  <td className={TD}>
                    <ByAt by={v.publishedBy} at={v.publishedAt} />
                  </td>
                  <td className={TD}>{v.note ? <bdi>{v.note}</bdi> : <span className="text-muted-foreground">{t('approval.versions.noNote')}</span>}</td>
                  <td className={`${TD} text-end`}>
                    <Button
                      variant="text"
                      disabled={restore.isPending}
                      data-restore={v.versionNo}
                      onClick={async () => {
                        if (await confirmAction(t('approval.versions.confirmBody', { version: fsi(v.versionNo) }), t('approval.versions.confirmTitle'))) restore.mutate(v.versionNo)
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
