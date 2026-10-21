import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import type { CampaignRule, RuleDraft } from '@/core/models/rule-campaign'
import { forgetDeleted, rememberPublished, rememberTransition, ruleApprovalsQuery, ruleCampaignApi, ruleCampaignKey } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import { ruleSummary } from '@/core/rules/sentence'
import { notify } from '@/core/services/notify'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import {
  APPROVAL_NOTE,
  APPROVAL_NOTE_MAX,
  actionGate,
  actionsFor,
  approvalRefusal,
  dialogBodyKey,
  grantOf,
  isSelfApprover,
  noteReady,
  refusalAddsMessage,
  type ApprovalAction,
  type ChecksGate,
} from './approval'
import { useWorkspace } from './context'

/** The acts taken in a dialog (asking for approval is inline, under the State). */
type DialogAction = Exclude<ApprovalAction, 'askForApproval'>

/**
 * The State cell's approval acts (tickets 511, 524; BackOffice 2759's Approvals doors): an author
 * asks for approval with a note (required), or deletes the draft; an approver reads the pending
 * changes beside the live campaign (`Approvals/List`) and activates, sends back with a note, or
 * disables a live campaign with a note. Which acts show follows the campaign's state
 * (`actionsFor`): HQ has no roles door (BO ask B), so each door's grant is HQ's to refuse, and a
 * refusal is said by its code (`approvalRefusal`). Asking and activating wait for HQ's checks of the
 * saved draft (508), and an error blocks them.
 */
export default function ApprovalPanel({ draft: d, gate }: { draft: RuleDraft; gate: ChecksGate }) {
  const { t } = useTranslation('campaign-workspace')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { back, link } = useWorkspace()
  const [note, setNote] = useState('')
  const [dialog, setDialog] = useState<DialogAction | null>(null)

  const ask = useMutation({
    mutationFn: () => ruleCampaignApi.requestApproval({ campaign: d.code, revision: d.revision, note: note.trim() }),
    onSuccess: (next) => {
      rememberTransition(queryClient, next)
      setNote('')
      notify.success(t('approval.asked'))
    },
  })

  const userId = useSession((s) => s.userId)
  const acts = actionsFor(d)
  const offers = (a: ApprovalAction) => acts.includes(a)
  const askGate = actionGate('askForApproval', gate)
  const noted = noteReady('askForApproval', note)
  const pending = d.source === 'draft' && d.state === 'pending'
  const hint = pending ? 'waiting' : d.source === 'draft' ? 'draft' : d.campaignStatus === 'Published' ? 'live' : null
  const reload = () => void queryClient.invalidateQueries({ queryKey: ruleCampaignKey(d.code) })
  // HQ refuses the reader's own activation (RULES_SELF_APPROVAL): hold the button and say why first.
  const self = pending && isSelfApprover(d, userId)
  const activateGate = actionGate('activate', gate)

  return (
    <div className="flex w-full flex-col gap-2" data-approval="">
      {pending && <PendingChanges d={d} />}

      {offers('askForApproval') && (
        <div className="flex w-full flex-col gap-1.5" data-ask="">
          <label htmlFor="approval-note" className="text-xs font-medium text-muted-foreground">
            {t('approval.askNote')}
          </label>
          <textarea
            id="approval-note"
            dir="auto"
            rows={2}
            maxLength={APPROVAL_NOTE_MAX}
            value={note}
            required
            onChange={(e) => {
              setNote(e.target.value)
              if (ask.isError) ask.reset()
            }}
            placeholder={t('approval.askNotePlaceholder')}
            disabled={ask.isPending}
            aria-describedby="approval-note-hint"
            className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            data-ask-note=""
          />
          <p id="approval-note-hint" className="text-xs text-muted-foreground" data-ask-note-hint="">
            {t('approval.askNoteRequired')}
          </p>
        </div>
      )}

      {acts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-approval-actions="">
          {offers('askForApproval') && (
            <Button
              variant="primary"
              disabled={!!askGate || ask.isPending || !noted}
              aria-describedby={askGate ? 'approval-gate' : 'approval-note-hint'}
              onClick={() => noted && ask.mutate()}
              data-approval-action="askForApproval"
            >
              {ask.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t('approval.action.askForApproval')}
            </Button>
          )}
          {offers('activate') && (
            <Button
              variant="primary"
              disabled={self || !!activateGate}
              aria-describedby={self ? 'approval-self' : activateGate ? 'approval-gate' : undefined}
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
            <Link to={link(`${campaignPath(d.code)}/rules`)} className="font-medium text-primary-800 hover:underline" data-approval-gate-link="">
              {t('approval.gate.open')}
            </Link>
          )}
        </p>
      )}

      {self && offers('activate') && (
        <p id="approval-self" className="text-xs text-muted-foreground" data-approval-self="">
          {t('approval.refusal.selfApproval')}
        </p>
      )}

      {ask.isError && <Refusal action="askForApproval" error={ask.error} onReload={reload} />}

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
          onSendBack={() => setDialog('sendBack')}
          onReload={() => {
            setDialog(null)
            reload()
          }}
          onDone={(next) => {
            setDialog(null)
            notify.success(t(`approval.done.${dialog}`))
            if (next === 'deleted') {
              // Leave first: the shell still watches this campaign's queries, and forgetting them
              // under it would read the deleted campaign again.
              navigate(back)
              forgetDeleted(queryClient, d.code)
            } else if (next === 'activated' || next === 'disabled') rememberPublished(queryClient, d.code, next)
            else rememberTransition(queryClient, next)
          }}
        />
      )}
    </div>
  )
}

/** One rule as a line: its name (or number), its conditions and effects counted. */
function RuleLine({ rule: r, index: i, side }: { rule: CampaignRule; index: number; side: 'draft' | 'live' }) {
  const { t } = useTranslation('campaign-workspace')
  const sum = ruleSummary(r)
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 text-xs" data-pending-rule={side === 'draft' ? r.id : undefined} data-live-rule={side === 'live' ? r.id : undefined}>
      <b className="font-medium">{r.name ? <bdi>{r.name}</bdi> : <Trans t={t} i18nKey="rules.ruleNumber" values={{ n: i + 1 }} components={{ n: <Ltr /> }} />}</b>
      <span className="text-muted-foreground">
        {sum.conditions ? <Trans t={t} i18nKey="rules.summary.conditions" count={sum.conditions} components={{ n: <Ltr /> }} /> : t('rules.summary.always')}
      </span>
      <span className="text-muted-foreground">
        <Trans t={t} i18nKey="rules.summary.effects" count={sum.effects} components={{ n: <Ltr /> }} />
      </span>
    </li>
  )
}

/**
 * What an approver is asked to publish: the draft's rules, beside the campaign as the live version
 * holds it (`Approvals/List`'s `live`; none when it is not live).
 */
function PendingChanges({ d }: { d: RuleDraft }) {
  const { link } = useWorkspace()
  const { t } = useTranslation('campaign-workspace')
  // Beside the live campaign only while one runs: a disabled campaign is in no version.
  const overLive = d.campaignStatus === 'Published'
  const approvals = useQuery({ ...ruleApprovalsQuery(), enabled: overLive })
  const live = approvals.data?.find((x) => x.draft.code === d.code)?.live ?? null
  return (
    <section className="flex w-full flex-col gap-1.5 rounded-md border border-border/60 p-2.5" data-pending-changes="">
      <h3 className="text-xs font-semibold">{t('approval.pending.title')}</h3>
      <p className="text-xs text-muted-foreground">
        {overLive ? (
          <Trans t={t} i18nKey="approval.pending.overLive" values={{ version: d.publishedVersionNo }} components={{ version: <Ltr /> }} />
        ) : (
          t(d.campaignStatus === 'Disabled' ? 'approval.pending.overDisabled' : 'approval.pending.first')
        )}
      </p>
      <div className={'grid gap-2 ' + (overLive ? 'sm:grid-cols-2' : '')}>
        <div className="flex flex-col gap-1" data-pending-side="draft">
          {overLive && <h4 className="text-xs font-medium">{t('approval.pending.draft')}</h4>}
          {d.campaign.rules.length ? (
            <ul className="flex flex-col gap-1">
              {d.campaign.rules.map((r, i) => (
                <RuleLine key={r.id} rule={r} index={i} side="draft" />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{t('approval.pending.noRules')}</p>
          )}
        </div>
        {overLive && (
          <div className="flex flex-col gap-1" data-pending-side="live">
            <h4 className="text-xs font-medium">{t('approval.pending.live')}</h4>
            {approvals.isPending ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {t('approval.pending.liveLoading')}
              </p>
            ) : approvals.isError ? (
              <p className="text-xs text-danger-800" data-pending-live-failed="">
                {isBareDenial(approvals.error) ? t('approval.pending.liveDenied') : <bdi>{apiErrorMessage(approvals.error, t('approval.pending.liveFailed'))}</bdi>}
              </p>
            ) : !live ? (
              <p className="text-xs text-muted-foreground" data-pending-live-none="">
                {t('approval.pending.liveNone')}
              </p>
            ) : live.rules.length ? (
              <ul className="flex flex-col gap-1">
                {live.rules.map((r, i) => (
                  <RuleLine key={r.id} rule={r} index={i} side="live" />
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{t('approval.pending.noRules')}</p>
            )}
          </div>
        )}
      </div>
      <Link to={link(`${campaignPath(d.code)}/rules`)} className="text-xs font-medium text-primary-800 hover:underline" data-pending-open="">
        {t('approval.pending.open')}
      </Link>
    </section>
  )
}

/** What a dialog act leaves: the draft in its new state, a version made (by an activation or a
 *  disable), or the draft deleted. */
type DialogOutcome = RuleDraft | 'activated' | 'disabled' | 'deleted'

/** A dialog act: confirm it, with a note where it takes one; a refusal shows inside, kept open. */
function ActionDialog({
  draft: d,
  action,
  gate,
  onClose,
  onSendBack,
  onReload,
  onDone,
}: {
  draft: RuleDraft
  action: DialogAction
  /** What holds the act back now — the checks can change while the dialog is open. */
  gate: ChecksGate
  onClose: () => void
  /** A refused activation that must go back to its author: the Send back dialog instead. */
  onSendBack: () => void
  /** A refusal that says the campaign moved: read it again. */
  onReload: () => void
  onDone: (next: DialogOutcome) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const [note, setNote] = useState('')
  const wants = APPROVAL_NOTE[action]
  const run = useMutation({
    mutationFn: async (): Promise<DialogOutcome> => {
      const body = { campaign: d.code, revision: d.revision, note: note.trim() }
      switch (action) {
        case 'activate':
          // The publish answers the version it made, not the draft (which goes).
          await ruleCampaignApi.activate(body)
          return 'activated'
        case 'sendBack':
          return ruleCampaignApi.sendBack(body)
        case 'disable':
          await ruleCampaignApi.disable({ campaign: d.code, note: note.trim() })
          return 'disabled'
        case 'deleteDraft':
          // Drafts/Delete at the revision read (409 RULES_DRAFT_STALE when it moved since).
          await ruleCampaignApi.deleteDraft(d.code, d.revision)
          return 'deleted'
      }
    },
    onSuccess: onDone,
  })
  const ready = !run.isPending && !gate && noteReady(action, note)
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
            i18nKey={`approval.dialog.${action}.${dialogBodyKey(action, d.campaignStatus)}`}
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
              maxLength={APPROVAL_NOTE_MAX}
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
        {run.isError && <Refusal action={action} error={run.error} onReload={onReload} onSendBack={onSendBack} />}
      </div>
    </Modal>
  )
}

/**
 * HQ's refusal of an approval act, by its code (`approvalRefusal`): in our words where the dashboard
 * has them, with HQ's own message under them where it says more (`refusalAddsMessage`), and what to do next (read the campaign again, or send
 * the draft back); otherwise HQ's message as it is. Its code is shown either way.
 */
function Refusal({ action, error, onReload, onSendBack }: { action: ApprovalAction; error: unknown; onReload: () => void; onSendBack?: () => void }) {
  const { t } = useTranslation('campaign-workspace')
  const code = apiErrorCode(error)
  const bare = isBareDenial(error)
  const known = approvalRefusal(action, code, bare)
  const said = known
    ? t(known.reason === 'denied' ? `approval.refusal.denied.${grantOf(action)}` : `approval.refusal.${known.reason}`)
    : apiErrorMessage(error, t('approval.refused.fallback'))
  return (
    <div data-approval-refusal={action} data-approval-refusal-reason={known?.reason} className="w-full">
      <ErrorBanner className="p-2.5" title={t(`approval.refused.${action}`)} message={said}>
        {known && !bare && refusalAddsMessage(known.reason) && (
          <p className="mt-1 text-xs" data-refusal-message="">
            <bdi>{apiErrorMessage(error, t('approval.refused.fallback'))}</bdi>
          </p>
        )}
        {code && (
          <p className="mt-1 text-xs" data-refusal-code={code}>
            {t('approval.refused.code')}{' '}
            <span className="font-mono">
              <Ltr>{code}</Ltr>
            </span>
          </p>
        )}
        {known?.offer === 'reload' && (
          <Button variant="outlined" className="mt-2" onClick={onReload} data-approval-refusal-reload="">
            {t('approval.refusal.reload')}
          </Button>
        )}
        {known?.offer === 'sendBack' && onSendBack && (
          <Button variant="outlined" className="mt-2" onClick={onSendBack} data-approval-refusal-send-back="">
            {t('approval.refusal.sendBack')}
          </Button>
        )}
      </ErrorBanner>
    </div>
  )
}
