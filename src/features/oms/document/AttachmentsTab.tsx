import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

import AttachmentsPanel from '@/core/attachments/AttachmentsPanel'
import { READ_ONCE_PER_VISIT, rereadAttachments } from '@/core/attachments/api'
import type { AttachmentsPanelWords } from '@/core/attachments/panel-words'
import type { AttachmentTarget } from '@/core/attachments/upload'
import type { WithdrawReason } from '@/core/attachments/withdraw'

/** No reasons yet: Withdraw arrives with the server's list in 331. */
const NO_REASONS: readonly WithdrawReason[] = []

/**
 * **The order's files** (spec 324, ticket 327) — the Attachments tab's body: the shared
 * attachments panel (`@/core/attachments`, the ECR-slip drawer's body) with the order's
 * parameters.
 *
 * - `target` is `orderAttachmentTarget`'s — `SD_DOCUMENT` under `attachmentOwnerNo`.
 * - The list is read **once per page visit** (`READ_ONCE_PER_VISIT`), and only once
 *   `opened`: the page keeps this mounted while the tab is hidden, and every ByOwner
 *   writes an audit row, so neither the page load nor this mount may read it. The page
 *   latches `opened` on the tab's first selection.
 * - Captions are shown. Add (330) and Withdraw (331) are not offered yet.
 */
export default function AttachmentsTab({ target, opened }: { target: AttachmentTarget; opened: boolean }) {
  const { t } = useTranslation('document')
  const queryClient = useQueryClient()
  const words = useMemo(() => orderPanelWords(t), [t])
  return (
    <AttachmentsPanel
      target={target}
      freshness={READ_ONCE_PER_VISIT}
      enabled={opened}
      captioned
      reasons={NO_REASONS}
      words={words}
      addOffered={false}
      withdrawOffered={false}
      onChanged={() => void rereadAttachments(queryClient, target)}
    />
  )
}

/** The order's words for the panel — every sentence that says "order", "file" or "prescription". */
function orderPanelWords(t: TFunction<'document'>): AttachmentsPanelWords {
  return {
    loading: t('attachments.loading'),
    empty: t('attachments.empty'),
    listRefused: t('attachments.errors.refused'),
    listFailed: t('attachments.errors.loadFailed'),
    sourceColumn: t('attachments.columns.source'),
    previewRegion: t('attachments.preview.region'),
    noSelection: t('attachments.preview.pick'),
    previewLoading: t('attachments.preview.loading'),
    previewAlt: (fileName) => t('attachments.preview.alt', { fileName }),
    previewFailed: t('attachments.preview.failed'),
    addRegion: t('attachments.add.region'),
    addButton: t('attachments.add.button'),
    addFailed: t('attachments.add.failed'),
    withdrawTitle: t('attachments.withdraw.title'),
    withdrawFinal: t('attachments.withdraw.final'),
    withdrawNoteRequired: t('attachments.withdraw.noteRequired'),
    withdrawConfirm: t('attachments.withdraw.confirm'),
    withdrawFailed: t('attachments.withdraw.failed'),
    withdrawGone: (fileName) => t('attachments.withdraw.gone', { fileName }),
    withdrawForbidden: t('attachments.withdraw.forbidden'),
  }
}
