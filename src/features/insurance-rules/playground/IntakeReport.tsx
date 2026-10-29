import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { IntakeView } from './intake'

/**
 * The intake report on Outcome tab A (ticket 684, Raw experiments only): the keys the engine **read**, the keys it
 * **ignored** with their near-miss ("did you mean quantity?") and the values it **refused** for the wrong type. Paths
 * are machine values (`Ltr`); a section with nothing in it is not drawn. Draws an `IntakeView` (`./intake`) only.
 */
export default function IntakeReport({ view }: { view: IntakeView }) {
  const { t } = useTranslation('insurance-playground')
  return (
    <section className="flex flex-col gap-2 border-t border-border/60 pt-3 text-sm" data-intake="">
      <h3 className="font-medium">{t('intake.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('intake.hint')}</p>
      {view.ignored.length > 0 && (
        <div className="flex flex-col gap-1" data-intake-section="ignored">
          <h4 className="text-xs font-medium text-warning-800">{t('intake.ignored')}</h4>
          <ul className="flex flex-col gap-1">
            {view.ignored.map((e) => (
              <li key={e.path} className="flex flex-wrap items-center gap-2" data-intake-ignored={e.path}>
                <code className="font-mono text-xs">
                  <Ltr>{e.path}</Ltr>
                </code>
                {e.hint && (
                  <span className="text-xs" data-intake-hint={e.hint}>
                    {t('intake.didYouMean', { hint: fsi(e.hint) })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {view.refused.length > 0 && (
        <div className="flex flex-col gap-1" data-intake-section="refused">
          <h4 className="text-xs font-medium text-danger-800">{t('intake.refused')}</h4>
          <ul className="flex flex-col gap-1">
            {view.refused.map((e) => (
              <li key={e.path} className="flex flex-wrap items-center gap-2" data-intake-refused={e.path}>
                <code className="font-mono text-xs">
                  <Ltr>{e.path}</Ltr>
                </code>
                <span className="text-xs" data-intake-expected={e.expected}>
                  {t('intake.expected', { type: fsi(e.expected) })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {view.read.length > 0 && (
        <div className="flex flex-col gap-1" data-intake-section="read">
          <h4 className="text-xs font-medium">{t('intake.read')}</h4>
          <ul className="flex flex-wrap gap-2">
            {view.read.map((p) => (
              <li key={p} data-intake-read={p}>
                <code className="font-mono text-xs">
                  <Ltr>{p}</Ltr>
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
