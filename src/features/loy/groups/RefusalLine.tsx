import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'

/** A group door's refusal code under its sentence (support quotes the code); nothing when none came. */
export default function RefusalLine({ code }: { code: string | null }) {
  const { t } = useTranslation('loy-groups')
  if (!code) return null
  return (
    <p className="mt-1 text-xs" data-loy-group-refusal-code={code}>
      {t('refusal.code')}{' '}
      <span className="font-mono">
        <Ltr>{code}</Ltr>
      </span>
    </p>
  )
}
