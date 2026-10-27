import { useTranslation } from 'react-i18next'
import { saysIn } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { blankWord, type TemplateBlank } from './templates'

/**
 * A template blank named for the author (609): HQ's label in the reader's language when it has one (a phase-1
 * template's), else the word for its path's last key with the path itself, an LTR machine value, after it.
 */
export default function BlankLabel({ blank }: { blank: TemplateBlank }) {
  const { t, i18n } = useTranslation('insurance-rules')
  if (blank.label) return <bdi data-blank-label="">{saysIn(blank.label, i18n.language)}</bdi>
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5" data-blank-label="">
      <span>{t(`template.blank.${blankWord(blank.path)}`)}</span>
      <code className="font-mono text-[11px] text-muted-foreground">
        <Ltr>{blank.path}</Ltr>
      </code>
    </span>
  )
}
