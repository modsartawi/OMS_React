import { Trans, useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'
import Ltr from '@/core/ui/Ltr'
import type { FailedLine } from './failed-line'

/**
 * The confirmation in front of a re-run (ticket 435, spec 430 D12): the app's modal, never a
 * browser dialog, naming the request whose transfer it posts. Escape, the backdrop and Cancel all
 * cancel; running takes the one deliberate click. While the run is in flight the dialog holds,
 * because the run settles either way and the toast says how.
 */
export default function ReRunConfirm({
  line,
  busy,
  onConfirm,
  onCancel,
}: {
  /** `null` closes the dialog — the line IS the open state. */
  line: FailedLine | null
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation('failed-donor-transfers')
  return (
    <Modal
      open={line !== null}
      onClose={() => !busy && onCancel()}
      title={t('reRun.title')}
      width="28rem"
      footer={
        <>
          <Button variant="text" onClick={onCancel} disabled={busy} data-rerun-cancel="">
            {t('reRun.cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={busy} data-rerun-confirm="">
            {busy ? t('reRun.running') : t('reRun.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm" data-rerun-dialog="">
        <p>
          <Trans t={t} i18nKey="reRun.question" values={{ no: line?.row.requestNo ?? '' }} components={{ no: <Ltr /> }} />
        </p>
        <p className="text-muted-foreground">{t('reRun.stock')}</p>
      </div>
    </Modal>
  )
}
