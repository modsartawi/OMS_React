import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { TFunction } from 'i18next'

import AttachmentsPanel from '@/core/attachments/AttachmentsPanel'
import { READ_ONCE_PER_VISIT, rereadAttachments } from '@/core/attachments/api'
import type { AttachmentsPanelWords } from '@/core/attachments/panel-words'
import { CAPTION_MAX, type AttachmentTarget } from '@/core/attachments/upload'
import { useAttachmentUploads } from '@/core/attachments/upload-store'
import type { WithdrawReason } from '@/core/attachments/withdraw'

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
 * - Captions are shown, and **+ Add prescription** (330) files one file at a time with an
 *   optional caption, onto `target` — the owner, never the route's number. It is offered
 *   whenever the tab is drawn: on the web the read grant is the upload grant, and the
 *   web attaches to an ended order too (BackOffice 2061). There is no client cap: the
 *   eleventh file is the server's `ATTACHMENT_TOO_MANY`, shown as sent.
 * - After a 200 the list is re-read (`onChanged`), and the badge follows it.
 * - The tab's files in the upload store outlive a tab switch (this stays mounted) and
 *   a page left mid-send (the store keeps a file in flight, under its id). Leaving
 *   forgets only the settled ones, as the slip drawer's close does.
 * - **Withdraw…** (331) sits beside Download on the previewed file when `withdrawOffered`
 *   (`canWithdrawOn`: the grant for the category, and a reason list). The reasons are
 *   ByOwner's `withdrawReasons` as sent, `label` beside `labelArabic` — never a client
 *   list. A 200 or a 404 re-reads the list (`onChanged`), so the file moves under
 *   Withdrawn (n) and the badge follows; a bare 403 takes Withdraw away for the rest of
 *   the visit (the panel holds that, and this stays mounted until the page is left).
 *   The order's `ATWD` history line is the server's: nothing is sent for it.
 * - **"Filed on order \<no\>"** (329) heads the panel when `filedOnOrderNo` is set — on a
 *   delivery's page, whose files are its order's (`filedOnOrder`). The number opens that
 *   order. It is this caller's word, handed in through the panel's `words`.
 */
export default function AttachmentsTab({
  target,
  opened,
  withdrawReasons,
  withdrawOffered,
  filedOnOrderNo,
}: {
  target: AttachmentTarget
  opened: boolean
  /** The order a delivery's files are filed on, or `null` on the order's own page (`filedOnOrder`). */
  filedOnOrderNo: string | null
  withdrawReasons: readonly WithdrawReason[]
  withdrawOffered: boolean
}) {
  const { t } = useTranslation('document')
  const queryClient = useQueryClient()
  const words = useMemo(
    () => ({ ...orderPanelWords(t), heading: filedOnOrderNo ? <FiledOnOrder documentNo={filedOnOrderNo} /> : undefined }),
    [t, filedOnOrderNo],
  )
  const clearSettled = useAttachmentUploads((s) => s.clearSettled)
  const { ownerKind, ownerKey } = target
  useEffect(() => () => clearSettled({ ownerKind, ownerKey }), [clearSettled, ownerKind, ownerKey])
  return (
    <AttachmentsPanel
      target={target}
      freshness={READ_ONCE_PER_VISIT}
      enabled={opened}
      captioned
      reasons={withdrawReasons}
      words={words}
      addOffered
      withdrawOffered={withdrawOffered}
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
    addCaptionLabel: t('attachments.add.captionLabel'),
    addCaptionHint: t('attachments.add.captionHint', { max: CAPTION_MAX }),
    withdrawTitle: t('attachments.withdraw.title'),
    withdrawFinal: t('attachments.withdraw.final'),
    withdrawNoteRequired: t('attachments.withdraw.noteRequired'),
    withdrawConfirm: t('attachments.withdraw.confirm'),
    withdrawFailed: t('attachments.withdraw.failed'),
    withdrawGone: (fileName) => t('attachments.withdraw.gone', { fileName }),
    withdrawForbidden: t('attachments.withdraw.forbidden'),
  }
}

/** "Filed on order \<no\>" (329): the number, a named param, is the link to that order's page. */
function FiledOnOrder({ documentNo }: { documentNo: string }) {
  const { t } = useTranslation('document')
  return (
    <p className="text-sm text-muted-foreground" data-testid="order-filed-on">
      <Trans
        t={t}
        i18nKey="attachments.filedOnOrder"
        values={{ documentNo }}
        components={{
          order: (
            <Link
              to={`/oms/document/${encodeURIComponent(documentNo)}`}
              className="font-medium text-primary underline-offset-2 hover:underline"
              data-testid="order-filed-on-link"
            />
          ),
        }}
      />
    </p>
  )
}
