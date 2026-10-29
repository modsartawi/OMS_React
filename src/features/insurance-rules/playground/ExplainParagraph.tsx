import { useTranslation } from 'react-i18next'
import { fsi } from '@/core/util/bidi'
import type { ExplainSentence } from './explain'

/**
 * "Explain this result" on Outcome tab A (ticket 686): the sentences `explain()` built, read as one paragraph. Every
 * value is data interpolated into a `t()` sentence — a string-only sink — so each is wrapped whole in `fsi`.
 */
export default function ExplainParagraph({ sentences }: { sentences: ExplainSentence[] }) {
  const { t } = useTranslation('insurance-playground')
  if (!sentences.length) return null
  return (
    <section className="flex flex-col gap-1 border-t border-border/60 pt-3" data-explain="">
      <h3 className="text-sm font-semibold">{t('explain.title')}</h3>
      <p className="text-sm leading-relaxed">
        {sentences.map((s, i) => (
          <span key={i} data-explain-sentence={s.key}>
            {i > 0 && ' '}
            {t(s.key, Object.fromEntries(Object.entries(s.values).map(([k, v]) => [k, fsi(v)])))}
          </span>
        ))}
      </p>
    </section>
  )
}
