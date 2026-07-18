import { useTranslation } from 'react-i18next'
import { TONE_CLASS, type DerivedStatus } from './helpers'

/** The one status pill, shared by the grid and the detail pane. */
export default function StatusPill({ status }: { status: DerivedStatus }) {
  const { t } = useTranslation('ua-admin')
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[status.tone]}`}>
      {t(`status.${status.key}`)}
    </span>
  )
}
