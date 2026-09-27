import { useTranslation } from 'react-i18next'

import type { AttachmentSource } from './rules'

/**
 * Where a file came from: the device as sent (a till, or a partner's `KEY:<UserId>`),
 * or "Web · <uploadedBy>" for a web upload (BackOffice 2035). One component, so the
 * list, Withdrawn (n) and the withdraw dialog cannot name a source two ways.
 */
export default function AttachmentSourceText({ source }: { source: AttachmentSource }) {
  const { t } = useTranslation('attachments')
  if (source.kind === 'device') return <span className="font-mono">{source.device}</span>
  return <>{source.uploadedBy ? t('source.webBy', { uploadedBy: source.uploadedBy }) : t('source.web')}</>
}
