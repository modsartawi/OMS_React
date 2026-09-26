import { useTranslation } from 'react-i18next'

import type { SlipTill } from './slips'

/**
 * A slip's till: the device, or "Web · <uploadedBy>" for a web upload (BackOffice
 * 2035). One component, so the list, Withdrawn (n) and the withdraw dialog cannot
 * name a till two ways.
 */
export default function SlipTillText({ till }: { till: SlipTill }) {
  const { t } = useTranslation('collection')
  if (till.kind === 'device') return <span className="font-mono">{till.device}</span>
  return <>{till.uploadedBy ? t('slips.drawer.webTill', { uploadedBy: till.uploadedBy }) : t('slips.drawer.web')}</>
}
