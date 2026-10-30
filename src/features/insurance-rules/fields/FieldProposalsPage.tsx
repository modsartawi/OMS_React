import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, X } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { ByAt, DeniedCard, Loading, TD, TH } from '@/core/insurance-rules/parts'
import { FIELDS_KEY } from '@/core/insurance-rules/registry-api'
import SaysBoth from '@/core/rules/SaysBoth'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import StatusBadge from '@/core/ui/StatusBadge'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { FIELD_PROPOSALS_KEY, fieldsApi } from './api'
import { inboxOrder, proposalStanding, rejectBody, type FieldProposal, type FieldProposalState, type ProposalViewer } from './field-proposal'
import { ProbeTable } from './RawPathDialog'

const STATE_SEV: Record<FieldProposalState, 'warn' | 'ok' | 'mute'> = { proposed: 'warn', approved: 'ok', rejected: 'mute' }

/**
 * Insurance rules ▸ Field proposals — `/insurance-rules/field-proposals` (BackOffice spec 3271 story 21, 3262 V6, door
 * 3282; oms 696). A proposed FHIR field, with its path, Probe per payer, labels and any Patient warning. A grant holder
 * who is not its author approves or rejects it, and an approved field is in the catalog and the picker at once.
 */
export default function FieldProposalsPage() {
  const { t } = useTranslation('insurance-fields')
  const inbox = useQuery({ queryKey: FIELD_PROPOSALS_KEY, queryFn: () => fieldsApi.proposals(), retry: false })
  const [openId, setOpenId] = useState<string | null>(null)
  // Read from the list on every render, so a refreshed row (someone else decided it) shows at once.
  const opened = inbox.data?.proposals.find((p) => p.id === openId) ?? null

  let body
  if (inbox.isError && isBareDenial(inbox.error)) body = <DeniedCard ns="insurance-fields" hook="proposals-denied" />
  else if (inbox.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(inbox.error, t('proposals.failed'))} />
  else if (!inbox.data) body = <Loading text={t('proposals.loading')} />
  else if (inbox.data.proposals.length === 0)
    body = (
      <p className="text-sm text-muted-foreground" data-proposals-empty="">
        {t('proposals.empty')}
      </p>
    )
  else body = <ProposalTable rows={inbox.data.proposals} onOpen={setOpenId} />

  return (
    <section className="flex w-full max-w-6xl flex-col gap-5" data-proposals-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('proposals.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('proposals.lede')}</p>
      </header>
      {body}
      {opened && inbox.data && <ProposalDialog key={opened.id} proposal={opened} viewer={inbox.data.viewer} onClose={() => setOpenId(null)} />}
    </section>
  )
}

function ProposalTable({ rows, onOpen }: { rows: FieldProposal[]; onOpen: (id: string) => void }) {
  const { t } = useTranslation('insurance-fields')
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <th className={TH}>{t('proposals.col.field')}</th>
            <th className={TH}>{t('proposals.col.key')}</th>
            <th className={TH}>{t('proposals.col.where')}</th>
            <th className={TH}>{t('proposals.col.state')}</th>
            <th className={TH}>{t('proposals.col.proposedBy')}</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {inboxOrder(rows).map((p) => (
            <tr key={p.id} className="border-t border-border/60" data-proposal-row={p.id} data-proposal-state={p.state}>
              <td className={TD}>
                <SaysBoth says={p.label} />
              </td>
              <td className={`${TD} font-mono text-xs`}>
                <Ltr>{p.key}</Ltr>
              </td>
              <td className={`${TD} text-xs`}>
                <Where proposal={p} />
              </td>
              <td className={TD}>
                <StatusBadge sev={STATE_SEV[p.state]}>{t(`proposals.state.${p.state}`)}</StatusBadge>
              </td>
              <td className={`${TD} text-xs`}>
                <ByAt by={p.proposedBy} at={p.proposedAt} />
              </td>
              <td className={`${TD} text-end`}>
                <Button variant="secondary" onClick={() => onOpen(p.id)} data-proposal-open={p.id}>
                  {t('proposals.open')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Where({ proposal }: { proposal: Pick<FieldProposal, 'moment' | 'level'> }) {
  const { t } = useTranslation('insurance-rules')
  return (
    <span className="flex flex-col">
      <span>{t(`catalog.message.${proposal.moment}`)}</span>
      <span className="text-muted-foreground">{t(`catalog.level.${proposal.level}`)}</span>
    </span>
  )
}

function ProposalDialog({ proposal: p, viewer, onClose }: { proposal: FieldProposal; viewer: ProposalViewer; onClose: () => void }) {
  const { t } = useTranslation('insurance-fields')
  const qc = useQueryClient()
  const userId = useSession((s) => s.userId)
  const standing = proposalStanding(p, userId, viewer)
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)

  const approve = useMutation({
    mutationFn: () => fieldsApi.approve(p.id),
    onSuccess: () => {
      notify.success(t('proposals.approved'), fsi(p.key))
      onClose()
      // The whole fields prefix: the approved field joins the catalog and the picker with no reload.
      return qc.invalidateQueries({ queryKey: FIELDS_KEY })
    },
    // A refusal may mean someone else has just decided it: the refreshed row says so.
    onError: () => qc.invalidateQueries({ queryKey: FIELD_PROPOSALS_KEY }),
  })
  const reject = useMutation({
    mutationFn: (body: { reason: string }) => fieldsApi.reject(p.id, body),
    onSuccess: () => {
      notify.success(t('proposals.rejected'), fsi(p.key))
      onClose()
      return qc.invalidateQueries({ queryKey: FIELD_PROPOSALS_KEY })
    },
    onError: () => qc.invalidateQueries({ queryKey: FIELD_PROPOSALS_KEY }),
  })
  const busy = approve.isPending || reject.isPending
  const refusal = approve.error ?? reject.error
  const refusalCode = apiErrorCode(refusal)

  // A reason already written is not lost to a stray click on the backdrop.
  const dismiss = async () => {
    if (!reason.trim() || (await confirmAction(t('proposals.discard.message'), t('proposals.discard.title')))) onClose()
  }

  return (
    <Modal
      open
      onClose={dismiss}
      title={t('proposals.detailTitle')}
      width="48rem"
      footer={
        <>
          <Button variant="secondary" onClick={dismiss} data-proposal-close="">
            {t('proposals.close')}
          </Button>
          {standing === 'may' && (
            <>
              <Button
                variant="secondary"
                aria-disabled={busy}
                onClick={() => {
                  setTried(true)
                  const body = rejectBody(reason)
                  if (body && !busy) reject.mutate(body)
                }}
                data-proposal-reject=""
              >
                {reject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                {t('proposals.reject')}
              </Button>
              <Button variant="primary" aria-disabled={busy} onClick={() => !busy && approve.mutate()} data-proposal-approve="">
                {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
                {t('proposals.approve')}
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-proposal-detail={p.id} data-proposal-standing={standing}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SaysBoth says={p.label} />
          <StatusBadge sev={STATE_SEV[p.state]}>{t(`proposals.state.${p.state}`)}</StatusBadge>
        </div>

        {p.patientWarning && (
          <p className="rounded-md border border-border/60 bg-attention-050 p-2 text-xs text-attention-800" role="note" data-proposal-patient-warning="">
            {t('proposals.patientWarning', { path: fsi(p.fhirPath) })}
          </p>
        )}

        <dl className="grid gap-x-4 gap-y-2 text-xs md:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">{t('proposals.path')}</dt>
          <dd className="font-mono break-all" data-proposal-path="">
            <Ltr>{p.fhirPath}</Ltr>
          </dd>
          <dt className="text-muted-foreground">{t('proposals.col.key')}</dt>
          <dd className="font-mono" data-proposal-key="">
            <Ltr>{p.key}</Ltr>
          </dd>
          <dt className="text-muted-foreground">{t('proposals.col.where')}</dt>
          <dd>
            <Where proposal={p} />
          </dd>
          <dt className="text-muted-foreground">{t('rawPath.type')}</dt>
          <dd>
            <span className="flex flex-wrap gap-2">
              <span>{t(`insurance-rules:catalog.type.${p.type}`)}</span>
              <span className="text-muted-foreground">{t(p.cardinality === 'list' ? 'rawPath.list' : 'rawPath.single')}</span>
            </span>
          </dd>
          {p.system && (
            <>
              <dt className="text-muted-foreground">{t('rawPath.system')}</dt>
              <dd className="font-mono break-all">
                <Ltr>{p.system}</Ltr>
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">{t('proposals.col.proposedBy')}</dt>
          <dd data-proposal-by="">
            <ByAt by={p.proposedBy} at={p.proposedAt} />
          </dd>
          {p.decidedBy && (
            <>
              <dt className="text-muted-foreground">{t('proposals.decidedBy')}</dt>
              <dd data-proposal-decided-by="">
                <ByAt by={p.decidedBy} at={p.decidedAt} />
              </dd>
            </>
          )}
          {p.rejectReason && (
            <>
              <dt className="text-muted-foreground">{t('proposals.reason')}</dt>
              <dd data-proposal-reason="">
                <bdi>{p.rejectReason}</bdi>
              </dd>
            </>
          )}
        </dl>

        <div className="flex flex-col gap-1">
          <h3 className="text-xs font-semibold">{t('proposals.probe')}</h3>
          {p.probe ? (
            <ProbeTable reply={p.probe} />
          ) : (
            <p className="text-xs text-muted-foreground" data-proposal-no-probe="">
              {t('proposals.noProbe')}
            </p>
          )}
        </div>

        {standing === 'ownProposal' && (
          <p className="text-xs text-muted-foreground" data-proposal-why="ownProposal">
            {t('proposals.why.ownProposal')}
          </p>
        )}
        {standing === 'reader' && (
          <p className="text-xs text-muted-foreground" data-proposal-why="reader">
            {t('proposals.why.reader')}
          </p>
        )}
        {standing === 'may' && (
          <Field label={t('proposals.reason')} hint={t('proposals.reasonHint')}>
            <Textarea rows={2} dir="auto" value={reason} onChange={(e) => setReason(e.target.value)} data-proposal-reason-input="" />
          </Field>
        )}
        {standing === 'may' && tried && !rejectBody(reason) && (
          <p className="text-xs text-danger-800" role="alert" data-proposal-reason-missing="">
            {t('proposals.reasonMissing')}
          </p>
        )}
        {refusal && (
          <div data-proposal-refused="">
            <ErrorBanner className="p-2" message={isBareDenial(refusal) ? t('rawPath.denied') : apiErrorMessage(refusal, t('proposals.actionFailed'))} />
            {refusalCode && (
              <p className="mt-1 font-mono text-xs text-muted-foreground" data-proposal-refused-code={refusalCode}>
                <Ltr>{refusalCode}</Ltr>
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
