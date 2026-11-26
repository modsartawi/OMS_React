import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import {
  INQUIRY_EXPORT_JOBS_KEY,
  MY_EXPORTS_PATH,
  inquiryExportApi,
  type InquiryExportJob,
  type InquiryExportScreen,
} from './api'
import { MAX_RANGE_DAYS, planExportMonth, type ExportMonthProblem, type ExportMonthSource } from './export-month'

/**
 * **Export month…** (BackOffice spec 4314, ticket 4318): the date range — pre-filled from the screen's filter when it
 * is set — checked against the 31-day rule before anything is sent (`planExportMonth`), then one
 * `POST InquiryExport/Jobs` carrying the screen's applied filters, its visible columns in order with their shown
 * headers, and the UI language. On success it says the job is queued and points to My exports; the user does not wait
 * here (story 10).
 */
export default function ExportMonthDialog({
  screen,
  source,
  onClose,
}: {
  screen: InquiryExportScreen
  source: ExportMonthSource
  onClose: () => void
}) {
  const { t, i18n } = useTranslation('inquiry-export')
  const client = useQueryClient()
  const [from, setFrom] = useState(source.range.from)
  const [to, setTo] = useState(source.range.to)
  const [problem, setProblem] = useState<ExportMonthProblem | null>(null)
  const send = useMutation({
    mutationFn: inquiryExportApi.request,
    onSuccess: () => void client.invalidateQueries({ queryKey: INQUIRY_EXPORT_JOBS_KEY }),
  })
  const queued: InquiryExportJob | undefined = send.data

  const onSend = () => {
    const plan = planExportMonth({
      screen,
      from,
      to,
      source,
      language: i18n.language?.startsWith('ar') ? 'ar' : 'en',
    })
    if (!plan.ok) {
      setProblem(plan.problem)
      return
    }
    setProblem(null)
    send.mutate(plan.request)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('dialog.title')}
      width="28rem"
      dismissable={!send.isPending}
      footer={
        queued ? (
          <Button variant="primary" onClick={onClose}>
            {t('dialog.close')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={send.isPending}>
              {t('dialog.cancel')}
            </Button>
            <Button variant="primary" onClick={onSend} disabled={send.isPending} data-export-month-send="">
              {send.isPending ? t('dialog.sending') : t('dialog.send')}
            </Button>
          </>
        )
      }
    >
      {queued ? (
        <div className="flex flex-col gap-3 text-sm" data-export-month-queued={queued.jobId}>
          <p>{t('dialog.queued')}</p>
          <p className="text-muted-foreground">
            {t('dialog.jobNumber')} <Ltr>{queued.jobNumber}</Ltr>
          </p>
          <Link to={MY_EXPORTS_PATH[screen]} className={buttonClass('secondary', 'self-start')} onClick={onClose}>
            {t('dialog.openMyExports')}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t('dialog.intro', { days: MAX_RANGE_DAYS })}</p>
          <div className="flex flex-wrap gap-3">
            <Field label={t('dialog.from')} className="w-40">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t('dialog.to')} className="w-40">
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          {problem && (
            <p role="alert" className="text-sm text-danger-800" data-export-month-problem={problem}>
              {t(`dialog.problem.${problem}`, { days: MAX_RANGE_DAYS })}
            </p>
          )}
          {send.isError && <ErrorBanner message={apiErrorMessage(send.error, t('dialog.failed'))} className="p-3" />}
        </div>
      )}
    </Modal>
  )
}
