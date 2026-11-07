import { useTranslation } from 'react-i18next'
import i18n from '@/core/i18n'
import type { AnalyticsModel } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { fsi } from '@/core/util/bidi'
import type { EditorRefusal } from './editor-refusal'
import { periodPhraseKey } from './periods'
import { analyticsRefusal, measureOf, refusalWords } from './wire'

/** 406 names the field, 407 offers the shorter window, 410 shows the area's reason; else the server's words. */
export default function EditorRefusalNote({
  refusal,
  err,
  fallbackKey,
  model,
  onShorten,
}: {
  refusal: EditorRefusal | null
  err: unknown
  fallbackKey: string
  model: AnalyticsModel
  onShorten: (period: string) => void
}) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  if (!refusal) {
    const r = analyticsRefusal(err, t(fallbackKey))
    return <ErrorBanner title={t(fallbackKey)} message={refusalWords(r, t)} />
  }
  if (refusal.kind === 'window') {
    const measure = saysIn(measureOf(model, refusal.measure)?.label, lang) || refusal.measure
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-sm text-attention-800" role="alert" data-analytics-refusal="window">
        <span className="min-w-0 flex-1">{t('editor.refused.window', { measure: fsi(measure), days: fsi(refusal.days) })}</span>
        {refusal.shorter && (
          <Button variant="secondary" onClick={() => onShorten(refusal.shorter!)} data-analytics-shorten={refusal.shorter}>
            {t('editor.refused.shorten', { period: t(periodPhraseKey(refusal.shorter)) })}
          </Button>
        )}
      </div>
    )
  }
  const words =
    refusal.kind === 'invalid'
      ? refusal.field
        ? t('editor.refused.invalidField', { field: fsi(refusal.field) })
        : refusal.message || t('refusal.invalid')
      : refusal.kind === 'declaration'
        ? // 825: 411's series problems are listed on the series fields; any other problem has the server's words.
          refusal.message || t('refusal.declaration')
        : t('editor.refused.area', { reason: fsi(saysIn(refusal.reason, lang) || refusal.message) })
  return (
    <div className="rounded-lg border border-danger-border bg-danger-050 p-3 text-sm text-danger-800" role="alert" data-analytics-refusal={refusal.kind}>
      <bdi>{words}</bdi>
    </div>
  )
}
