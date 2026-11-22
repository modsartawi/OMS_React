import { CC_LANGS, type CcLang } from '@/core/models/command-center'
import Chip from '@/core/ui/Chip'
import type { CcT } from './lang'

/**
 * English or Arabic (oms 946, spec 4165 story 7): two chips, the page's language pressed. Choosing one hands it to the
 * page (`useCcLang().setLang`), which moves the URL to it (`langSwitchTarget`) — nowhere for the pressed one — so the
 * page asks the server for the brief in that language and lays itself out in its direction.
 */
export default function LanguageSwitch({ lang, onChange, t }: { lang: CcLang; onChange: (lang: CcLang) => void; t: CcT }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('lang.label')}>
      {CC_LANGS.map((option) => (
        <Chip key={option} on={option === lang} lang={option} onClick={() => onChange(option)} data-cc-lang={option}>
          {t(`lang.${option}`)}
        </Chip>
      ))}
    </div>
  )
}
