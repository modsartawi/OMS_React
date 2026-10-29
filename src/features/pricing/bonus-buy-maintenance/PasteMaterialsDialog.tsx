import { useTranslation } from 'react-i18next'
import PasteCodesDialog from '@/core/ui/PasteCodesDialog'
import { fsi } from '@/core/util/bidi'

/**
 * A multi-line box to paste a list of materials into (a column from Excel, or codes separated by
 * commas, spaces or new lines) — the core paste box in this feature's words. OK hands back the
 * materials to add as text; the caller turns it into lines or grouping rows. The box says how many
 * materials it will add, and how many it skips because the target already holds them or the paste
 * repeats them.
 */
export default function PasteMaterialsDialog({
  open,
  title,
  existing,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  /** The materials the target already holds; a pasted one of these is skipped. */
  existing: readonly string[]
  onClose: () => void
  onConfirm: (text: string) => void
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  return (
    <PasteCodesDialog
      open={open}
      existing={existing}
      testId="bby-paste"
      labels={{
        title,
        hint: t('paste.hint'),
        added: (count) => t('paste.added', { count, n: fsi(String(count)) }),
        skipped: (count) => t('paste.skipped', { count, n: fsi(String(count)) }),
        ok: t('paste.ok'),
        cancel: t('paste.cancel'),
      }}
      onClose={onClose}
      onConfirm={(codes) => onConfirm(codes.join('\n'))}
    />
  )
}
