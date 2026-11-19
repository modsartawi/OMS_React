import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, ShieldBan } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { PatternCaseDetail } from '@/core/models/insurance-patterns'
import { usePermissions } from '@/core/permissions'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { localToday } from '@/core/util/date-window'
import { CASE_READS_KEY, PATTERNS_KEY } from './api'
import { BLOCK_PAYER_MAX, BLOCK_REASON_KINDS, blockProblems, canOfferBlock, EMPTY_BLOCK, type BlockForm, type BlockProblem } from './block'
import { managerApi, REVEALS_KEY } from './manager-api'

/**
 * **"Add to blocked-patient list"** in a case's header (oms 924; BackOffice spec 4050 story 22, door 4056 — STUBBED, the
 * door is not built). Offered only on a CONFIRMED case to a user holding both the investigator grant and the
 * blocked-patient list's Change grant (`./block`'s `canOfferBlock`); otherwise it renders nothing at all.
 *
 * The dialog asks for the kind of finding (required: abuse or fraud), an optional reporting payer, and a start and an
 * end, and posts `…/Cases/{caseId}/Block`. The server adds the CASE's patient through the list's own change path, with
 * the case in the entry's reference, and writes a reveal-log row — the dialog says both before it is confirmed. It is
 * never automatic.
 *
 * 🔒 The patient is never read here: the body names no patient, and the door's answer is dropped by `managerApi.block`,
 * so the mutation holds no data. A refusal renders in the dialog (a toast would sit under the modal's scrim).
 */
export default function CaseBlockAction({ detail }: { detail: PatternCaseDetail }) {
  const permissions = usePermissions()
  if (!canOfferBlock(detail.status, permissions)) return null
  return <BlockAction detail={detail} />
}

function BlockAction({ detail }: { detail: PatternCaseDetail }) {
  const { t } = useTranslation('insurance-patterns')
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<BlockForm>(EMPTY_BLOCK)
  // The kind's problem shows once a confirm was tried; a payer or a date shows its own as it is typed.
  const [tried, setTried] = useState(false)
  const today = localToday()
  const problems = blockProblems(form, today)

  const block = useMutation({
    mutationFn: (sent: BlockForm) => managerApi.block(detail.caseId, sent, today),
    onSuccess: () => {
      setOpen(false)
      toast.success(t('block.added'), { description: fsi(detail.caseNumber) })
      // Whatever the server recorded on the case, and the reveal-log row the block wrote, are read again. The case reads
      // by prefix: the screen's read is keyed by the id as the route spelled it (review 10).
      void queryClient.invalidateQueries({ queryKey: CASE_READS_KEY })
      void queryClient.invalidateQueries({ queryKey: [...PATTERNS_KEY, 'cases'] })
      void queryClient.invalidateQueries({ queryKey: REVEALS_KEY })
    },
  })

  const close = () => {
    if (!block.isPending) setOpen(false)
  }
  const confirm = () => {
    setTried(true)
    if (problems.length > 0 || block.isPending) return
    block.mutate(form)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    confirm()
  }

  const text = (p: BlockProblem) => (p === 'payerTooLong' ? t('block.problem.payerTooLong', { max: fsi(BLOCK_PAYER_MAX) }) : t(`block.problem.${p}`))
  const shown = (...which: BlockProblem[]) => {
    const p = problems.find((x) => which.includes(x))
    return p ? text(p) : undefined
  }
  const caseNumber = fsi(detail.caseNumber)

  return (
    <>
      <Button variant="danger-outlined" onClick={() => setOpen(true)} data-testid="pattern-block-open">
        <ShieldBan className="h-3.5 w-3.5" aria-hidden />
        {t('block.action')}
      </Button>
      <Modal
        open={open}
        onClose={close}
        title={t('block.title')}
        // Every open starts blank: a block is decided afresh each time.
        onShow={() => {
          setForm(EMPTY_BLOCK)
          setTried(false)
          block.reset()
        }}
        width="34rem"
        dismissable={!block.isPending}
        footer={
          <>
            <Button variant="text" onClick={close} disabled={block.isPending}>
              {t('block.cancel')}
            </Button>
            <Button
              variant="danger"
              aria-disabled={problems.length > 0 || block.isPending}
              title={problems.length > 0 ? text(problems[0]) : undefined}
              onClick={confirm}
              data-testid="pattern-block-confirm"
            >
              {block.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ShieldBan className="h-3.5 w-3.5" aria-hidden />}
              {t(block.isPending ? 'block.adding' : 'block.confirm')}
            </Button>
          </>
        }
      >
        <form className="flex flex-col gap-3 text-sm" onSubmit={submit} noValidate data-testid="pattern-block-dialog">
          <p>{t('block.body', { caseNumber })}</p>
          <p className="text-muted-foreground">{t('block.recorded', { caseNumber })}</p>

          {block.isError && <ErrorBanner title={t('block.refused')} message={apiErrorMessage(block.error, t('block.refused'))} className="p-2" />}

          <Field label={t('block.reasonKind')} error={tried ? shown('reasonKind') : undefined}>
            <Select
              value={form.reasonKind}
              onChange={(e) => setForm((f) => ({ ...f, reasonKind: e.target.value as BlockForm['reasonKind'] }))}
              data-testid="pattern-block-kind"
            >
              <option value="" disabled>
                {t('block.choose')}
              </option>
              {BLOCK_REASON_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`block.kind.${k}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('block.payer')} hint={t('block.payerHint')} error={shown('payerTooLong')}>
            <Input dir="ltr" value={form.payer} onChange={(e) => setForm((f) => ({ ...f, payer: e.target.value }))} data-testid="pattern-block-payer" />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('block.startsOn')} hint={t('block.startsHint')} error={shown('startInvalid', 'startAfterEnd')}>
              <Input
                type="date"
                dir="ltr"
                value={form.startsOn}
                max={form.endsOn || undefined}
                onChange={(e) => setForm((f) => ({ ...f, startsOn: e.target.value }))}
                data-testid="pattern-block-starts"
              />
            </Field>
            <Field label={t('block.endsOn')} hint={t('block.endsHint')} error={shown('endInvalid', 'endPast')}>
              <Input
                type="date"
                dir="ltr"
                value={form.endsOn}
                min={form.startsOn > today ? form.startsOn : today}
                onChange={(e) => setForm((f) => ({ ...f, endsOn: e.target.value }))}
                data-testid="pattern-block-ends"
              />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  )
}
