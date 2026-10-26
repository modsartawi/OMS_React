/* PROTOTYPE — throwaway (map 580, ticket 587). Never merge to main.
 * The rail head's mark, per the switcher's scenario. Copy is the app's own keys.
 */
import { useTranslation } from 'react-i18next'
import BrandMark from '@/core/ui/BrandMark'
import lockupUrl from '@/assets/prototype-dmsco/dmsco-lockup-white.svg'
import symbolUrl from '@/assets/prototype-dmsco/dmsco-symbol.svg'
import { useShellProto } from './shell-proto'

function Wordmark() {
  const { t } = useTranslation()
  return <span className="truncate text-sm font-semibold tracking-tight text-rail-accent-foreground">{t('brandName')}</span>
}

export default function ShellMarkPrototype({ expanded }: { expanded: boolean }) {
  const mark = useShellProto((s) => s.mark)

  if (mark === 'aldawaa')
    return (
      <>
        <BrandMark size={26} />
        {expanded && <Wordmark />}
      </>
    )

  if (!expanded) return <img src={symbolUrl} alt="DMSCO" width={22} height={29} />

  if (mark === 'dmsco')
    return (
      <span className="flex items-center gap-2.5 py-1">
        <img src={lockupUrl} alt="DMSCO" width={77} height={41} />
        <span aria-hidden className="h-7 w-px bg-rail-accent-foreground/20" />
        <Wordmark />
      </span>
    )

  return (
    <span className="flex flex-col items-start gap-2 py-1">
      <img src={lockupUrl} alt="DMSCO" width={90} height={48} />
      <span className="flex items-center gap-2">
        <BrandMark size={20} />
        <Wordmark />
      </span>
    </span>
  )
}
