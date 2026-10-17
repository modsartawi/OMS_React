import { useState } from 'react'
import { useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { RuleCampaignRoles, RuleDraft } from '@/core/models/rule-campaign'
import { forgetDeleted, rememberTransition, ruleCampaignApi } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import { ruleSummary } from '@/core/rules/sentence'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { actionGate, actionsFor, type ApprovalAction, type ChecksGate } from './approval'

/** A note's longest length — a sentence or two for the approver, the author or the version history. */
const NOTE_MAX = 500

/** The acts taken in a dialog (asking for approval is inline, under the State). */
type DialogAction = Exclude<ApprovalAction, 'askForApproval'>

/** Which dialog acts take a note, and whether it is required. */
const NOTE: Record<DialogAction, 'required' | 'optional' | null> = {
  activate: 'optional',
  sendBack: 'required',
  disable: null,
  deleteDraft: null,
}

/**
 * The State cell's approval acts (ticket 511): an author asks for approval, with a note, or deletes
 * a never-published draft; an approver reads the pending changes and activates, sends back with a
 * note, or disables. Which acts show is `actionsFor` (the reader's roles × the campaign's state);
 * the server's refusal is the backstop and shows with its envelope message and code. Asking and
 * activating wait for HQ's checks of the saved draft (508), and an error blocks them.
 */
export default function ApprovalPanel({
  draft: d,
  roles,
  gate,
}: {
  draft: RuleDraft
  roles: UseQueryResult<RuleCampaignRoles>
  gate: ChecksGate
}) {
  const { t } = useTranslation('campaign-workspace')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [dialog, setDialog] = useState<DialogAction | null>(null)

  const ask = useMutation({
    mutationFn: () => ruleCampaignApi.askForApproval(d.code, { note: note.trim() }),
    onSuccess: (next) => {
      rememberTransition(queryClient, next)
      setNote('')
      notify.success(t('approval.asked'))
    },
  })

  if (roles.isPending) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" data-approval="loading">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {t('approval.rolesLoading')}
      </p>
    )
  }
  if (roles.isError) {
    return (
      <div className="flex w-full flex-col items-start gap-2">
        <Refusal title={t('approval.rolesFailed')} error={roles.error} data="roles" />
        <Button variant="outlined" disabled={roles.isFetching} onClick={() => void roles.refetch()} data-approval-roles-retry="">
          {t('approval.retry')}
        </Button>
      </div>
    )
  }

  const acts = actionsFor(d, roles.data)
  const offers = (a: ApprovalAction) => acts.includes(a)
  const askGate = actionGate('askForApproval', gate)
  const author = roles.data.author
  const approver = roles.data.approver
  const hint = hintFor(d, roles.data)
  const pending = d.source === 'draft' && d.state === 'pending'

  return (
    <div className="flex w-full flex-col gap-2" data-approval="" data-approval-role={approver ? (author ? 'both' : 'approver') : author ? 'author' : 'none'}>
      {approver && pending && <PendingChanges d={d} />}

      {offers('askForApproval') && (
        <div className="flex w-full flex-col gap-1.5" data-ask="">
          <label htmlFor="approval-note" className="text-xs font-medium text-muted-foreground">
            {t('approval.askNote')}
          </label>
          <textarea
            id="approval-note"
            dir="auto"
            rows={2}
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('approval.askNotePlaceholder')}
            disabled={ask.isPending}
            className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            data-ask-note=""
          />
        </div>
      )}

      {acts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-approval-actions="">
          {offers('askForApproval') && (
            <Button
              variant="primary"
              disabled={!!askGate || ask.isPending}
              aria-describedby={askGate ? 'approval-gate' : undefined}
              onClick={() => ask.mutate()}
              data-approval-action="askForApproval"
            >
              {ask.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t('approval.action.askForApproval')}
            </Button>
          )}
          {offers('activate') && (
            <Button
              variant="primary"
              disabled={!!actionGate('activate', gate)}
              aria-describedby={actionGate('activate', gate) ? 'approval-gate' : undefined}
              onClick={() => setDialog('activate')}
              data-approval-action="activate"
            >
              {t('approval.action.activate')}
            </Button>
          )}
          {offers('sendBack') && (
            <Button variant="secondary" onClick={() => setDialog('sendBack')} data-approval-action="sendBack">
              {t('approval.action.sendBack')}
            </Button>
          )}
          {offers('disable') && (
            <Button variant="danger-outlined" onClick={() => setDialog('disable')} data-approval-action="disable">
              {t('approval.action.disable')}
            </Button>
          )}
          {offers('deleteDraft') && (
            <Button variant="danger-outlined" onClick={() => setDialog('deleteDraft')} data-approval-action="deleteDraft">
              {t('approval.action.deleteDraft')}
            </Button>
          )}
        </div>
      )}

      {(offers('askForApproval') || offers('activate')) && gate && (
        <p id="approval-gate" className="text-xs text-muted-foreground" data-approval-gate={gate}>
          {t(`approval.gate.${gate}`)}{' '}
          {gate !== 'checking' && gate !== 'unavailable' && (
            <Link to={`${campaignPath(d.code)}/rules`} className="font-medium text-primary-800 hover:underline" data-approval-gate-link="">
              {t('approval.gate.open')}
            </Link>
          )}
        </p>
      )}

      {ask.isError && <Refusal title={t('approval.refused.askForApproval')} error={ask.error} data="askForApproval" />}

      {hint && (
        <p className="text-xs text-muted-foreground" data-approval-hint={hint}>
          {t(`approval.hint.${hint}`)}
        </p>
      )}

      {dialog && (
        <ActionDialog
          key={dialog}
          draft={d}
          action={dialog}
          gate={actionGate(dialog, gate)}
          onClose={() => setDialog(null)}
          onDone={(next) => {
            setDialog(null)
            notify.success(t(`approval.done.${dialog}`))
            if (next) rememberTransition(queryClient, next)
            else {
              // Leave first: the shell still watches this campaign's queries, and forgetting them
              // under it would read the deleted campaign again.
              navigate('/campaigns')
              forgetDeleted(queryClient, d.code)
            }
          }}
        />
      )}
    </div>
  )
}

/** The one line under the acts that says who does what next. */
type Hint = 'approverWaiting' | 'authorWaiting' | 'authorDraft' | 'approverLive' | 'readOnly'

function hintFor(d: RuleDraft, roles: RuleCampaignRoles): Hint | null {
  const pending = d.source === 'draft' && d.state === 'pending'
  if (roles.approver && pending) return 'approverWaiting'
  if (roles.author && pending) return 'authorWaiting'
  if (roles.author && d.source === 'draft') return 'authorDraft'
  if (roles.approver && d.campaignStatus === 'Published') return 'approverLive'
  if (!roles.author && !roles.approver) return 'readOnly'
  return null
}

/** What an approver is asked to publish: the draft's rules, read in the rule builder. */
function PendingChanges({ d }: { d: RuleDraft }) {
  const { t } = useTranslation('campaign-workspace')
  const c = d.campaign
  return (
    <section className="flex w-full flex-col gap-1.5 rounded-md border border-border/60 p-2.5" data-pending-changes="">
      <h3 className="text-xs font-semibold">{t('approval.pending.title')}</h3>
      <p className="text-xs text-muted-foreground">
        {d.publishedVersionNo > 0 ? (
          <Trans t={t} i18nKey="approval.pending.overLive" values={{ version: d.publishedVersionNo }} components={{ version: <Ltr /> }} />
        ) : (
          t('approval.pending.first')
        )}
      </p>
      {c.rules.length ? (
        <ul className="flex flex-col gap-1">
          {c.rules.map((r, i) => {
            const sum = ruleSummary(r)
            return (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 text-xs" data-pending-rule={r.id}>
                <b className="font-medium">
                  {r.name ? <bdi>{r.name}</bdi> : <Trans t={t} i18nKey="rules.ruleNumber" values={{ n: i + 1 }} components={{ n: <Ltr /> }} />}
                </b>
                <span className="text-muted-foreground">
                  {sum.conditions ? (
                    <Trans t={t} i18nKey="rules.summary.conditions" count={sum.conditions} components={{ n: <Ltr /> }} />
                  ) : (
                    t('rules.summary.always')
                  )}
                </span>
                <span className="text-muted-foreground">
                  <Trans t={t} i18nKey="rules.summary.effects" count={sum.effects} components={{ n: <Ltr /> }} />
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{t('approval.pending.noRules')}</p>
      )}
      <Link to={`${campaignPath(d.code)}/rules`} className="text-xs font-medium text-primary-800 hover:underline" data-pending-open="">
        {t('approval.pending.open')}
      </Link>
    </section>
  )
}

/** A dialog act: confirm it, with a note where it takes one; a refusal shows inside, kept open. */
function ActionDialog({
  draft: d,
  action,
  gate,
  onClose,
  onDone,
}: {
  draft: RuleDraft
  action: DialogAction
  /** What holds the act back now — the checks can change while the dialog is open. */
  gate: ChecksGate
  onClose: () => void
  /** HQ's answer: the draft in its new state, or null for a deleted draft. */
  onDone: (next: RuleDraft | null) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const [note, setNote] = useState('')
  const wants = NOTE[action]
  const run = useMutation({
    mutationFn: async (): Promise<RuleDraft | null> => {
      const body = { note: note.trim() }
      switch (action) {
        case 'activate':
          return ruleCampaignApi.activate(d.code, body)
        case 'sendBack':
          return ruleCampaignApi.sendBack(d.code, body)
        case 'disable':
          return ruleCampaignApi.disable(d.code, body)
        case 'deleteDraft':
          // Drafts/Delete at the revision read (409 RULES_DRAFT_STALE when it moved since).
          await ruleCampaignApi.deleteDraft(d.code, d.revision)
          return null
      }
    },
    onSuccess: onDone,
  })
  const ready = !run.isPending && !gate && (wants !== 'required' || note.trim().length > 0)
  const danger = action === 'disable' || action === 'deleteDraft'

  return (
    <Modal
      open
      onClose={() => !run.isPending && onClose()}
      title={t(`approval.dialog.${action}.title`)}
      width="32rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={run.isPending} data-approval-cancel="">
            {t('approval.dialog.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} disabled={!ready} onClick={() => ready && run.mutate()} data-approval-confirm="">
            {run.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t(`approval.dialog.${action}.confirm`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-approval-dialog={action}>
        <p className="text-sm">
          <Trans
            t={t}
            i18nKey={`approval.dialog.${action}.body`}
            values={{ name: d.campaign.name.en || t('untitled'), code: d.code }}
            components={{ name: <bdi className="font-semibold" />, code: <Ltr /> }}
          />
        </p>
        {d.campaign.name.ar && (
          <p className="-mt-2 text-sm text-muted-foreground" data-approval-dialog-name-ar="">
            <bdi>{d.campaign.name.ar}</bdi>
          </p>
        )}
        {wants && (
          <div className="flex flex-col gap-1">
            <label htmlFor="approval-dialog-note" className="text-xs font-medium text-muted-foreground">
              {t(`approval.dialog.${action}.note`)}
            </label>
            <textarea
              id="approval-dialog-note"
              dir="auto"
              rows={3}
              maxLength={NOTE_MAX}
              value={note}
              required={wants === 'required'}
              onChange={(e) => setNote(e.target.value)}
              disabled={run.isPending}
              className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
              data-approval-dialog-note=""
            />
          </div>
        )}
        {gate && (
          <p className="text-xs text-muted-foreground" data-approval-dialog-gate={gate}>
            {t(`approval.gate.${gate}`)}
          </p>
        )}
        {run.isError && <Refusal title={t(`approval.refused.${action}`)} error={run.error} data={action} />}
      </div>
    </Modal>
  )
}

/** The server's refusal: its own envelope message, and its code. */
function Refusal({ title, error, data }: { title: string; error: unknown; data: string }) {
  const { t } = useTranslation('campaign-workspace')
  const code = apiErrorCode(error)
  return (
    <div data-approval-refusal={data} className="w-full">
      <ErrorBanner className="p-2.5" title={title} message={apiErrorMessage(error, t('approval.refused.fallback'))}>
        {code && (
          <p className="mt-1 text-xs" data-refusal-code={code}>
            {t('approval.refused.code')}{' '}
            <span className="font-mono">
              <Ltr>{code}</Ltr>
            </span>
          </p>
        )}
      </ErrorBanner>
    </div>
  )
}
