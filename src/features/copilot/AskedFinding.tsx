import { useTranslation } from 'react-i18next'
import { targetHref } from '@/core/command-center-routes'
import type { CopilotFinding } from '@/core/copilot-panel'
import FindingCard from '@/core/findings/FindingCard'

/**
 * oms 950 (BackOffice spec 4165 "The brief and the copilot's opening screen show the same stored finding through one
 * shared card"; decisions §4 — the owner's OK on this reading is owed): the finding "Ask" opened the conversation on,
 * drawn at the top of the panel by the same card the brief draws (`@/core/findings/FindingCard`), with the same words
 * in the language the brief was read in, and the same links (a pharmacy code opens its scorecard on the command center).
 * A pharmacy's scorecard asks with no line: nothing is drawn, the question itself opens the thread.
 */
export default function AskedFinding({ finding }: { finding: CopilotFinding }) {
  const { t } = useTranslation('copilot')
  if (!finding.line) return null
  const lang = finding.lang
  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card p-3" data-copilot-finding={finding.findingId}>
      <div className="text-xs font-medium text-muted-foreground">{t('finding.askingAbout')}</div>
      <div lang={lang} dir={lang === 'ar' ? 'rtl' : undefined}>
        <FindingCard line={finding.line} hrefOf={(target) => targetHref(target, { lang, store: 'scorecard' })} />
      </div>
    </section>
  )
}
