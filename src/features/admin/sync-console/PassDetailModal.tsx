import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import type { StorePass } from '@/core/models/sync-console'
import { fsi } from '@/core/util/bidi'
import { passDetailQuery } from './api'
import { buildPassDetailColumns } from './store-columns'
import TabGrid from './TabGrid'

/**
 * One pass's rows (ticket 446), from `Store/PassDetail`, on the app modal: one
 * success row per object and chunk, one row per failure.
 */
export default function PassDetailModal({ pass, onClose }: { pass: StorePass | null; onClose: () => void }) {
  const { t } = useTranslation('sync-console')
  return (
    <Modal
      open={pass !== null}
      onClose={onClose}
      // A modal title is a string-only sink: the id is isolated as one value.
      title={pass ? t('passDetail.title', { id: fsi(pass.processId) }) : ''}
      width="72rem"
      footer={
        <Button variant="outlined" onClick={onClose} data-pass-detail-close="">
          {t('passDetail.close')}
        </Button>
      }
    >
      {pass && <Detail processId={pass.processId} />}
    </Modal>
  )
}

function Detail({ processId }: { processId: string }) {
  const { t } = useTranslation('sync-console')
  const detail = useQuery(passDetailQuery(processId))
  const columns = useMemo(() => buildPassDetailColumns(t), [t])
  return (
    <div data-pass-detail={processId}>
      <TabGrid
        rows={detail.data?.items}
        columns={columns}
        // No row id: a pass writes one row per object AND chunk, so a line number repeats.
        pending={detail.isPending}
        error={detail.error}
        failed={t('passDetail.failed')}
        empty={t('passDetail.empty')}
        loading={t('passDetail.loading')}
        data="pass-detail"
      />
    </div>
  )
}
