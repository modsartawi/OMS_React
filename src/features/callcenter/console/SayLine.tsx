/**
 * A sentence the agent can say to the caller (spec 983 D7, ticket 987) — labelled, quiet, and
 * filled only from server facts.
 *
 * 🚩 Bidi: the offer's description is free server text, so it takes a `<bdi>` through the
 * `<Trans>` slot `<offer>` (and is marked `data-cc-server-text`, like every description in the
 * guidance region). Every other value (an amount, a list of line numbers) is isolated whole with
 * `fsi`. A count stays a number so the plural still resolves.
 *
 * 996 (spec 995 D7): `bilingual` adds the same sentence in Arabic under it, its own sentence from
 * `locales/ar` and not a word-order translation, unless the console is already in Arabic. A
 * `date` param is the offer's day (`yyyy-mm-dd`), formatted in each language it is said in.
 */
import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { fsi } from '@/core/util/bidi'
import type { GuidancePhrase } from './guidance-view'
import { formatOfferDay } from './offer-badges'

export default function SayLine({ phrases, bilingual = false }: { phrases: GuidancePhrase[]; bilingual?: boolean }) {
  const { t, i18n } = useTranslation('callcenter')
  if (phrases.length === 0) return null
  const arabic = bilingual && !i18n.language.startsWith('ar')
  return (
    <div className="mt-1.5" data-cc-say-block>
      <p className="text-xs text-foreground" data-cc-say>
        <span className="me-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {t('promotions.say.label')}
        </span>
        <Phrases phrases={phrases} t={t} lang={i18n.language} />
      </p>
      {arabic && (
        <p className="mt-0.5 text-xs text-foreground" lang="ar" dir="rtl" data-cc-say-ar>
          <span className="me-1 text-[11px] font-medium text-muted-foreground">{t('offer.say.arabic')}</span>
          <Phrases phrases={phrases} t={i18n.getFixedT('ar', 'callcenter')} lang="ar" />
        </p>
      )}
    </div>
  )
}

function Phrases({ phrases, t, lang }: { phrases: GuidancePhrase[]; t: TFunction; lang: string }) {
  return phrases.map((phrase) => (
    <span key={phrase.key} className="me-1">
      <Trans
        t={t}
        i18nKey={phrase.key}
        values={isolated(phrase.params, lang, t)}
        components={{ offer: <bdi data-cc-server-text /> }}
      />
    </span>
  ))
}

const WORDS = new Set(['offer'])

function isolated(params: GuidancePhrase['params'], lang: string, t: TFunction): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      // The offer's day, in this sentence's language, isolated whole.
      if (key === 'date' && typeof value === 'string') return [key, fsi(formatOfferDay(value, lang, 'long'))]
      // The currency is a word, said in this sentence's own language.
      if (key === 'currency') return [key, t('money.currency')]
      // The offer is isolated by its slot; isolating it again would put FSI inside the <bdi>.
      return [key, typeof value === 'string' && !WORDS.has(key) ? fsi(value) : value]
    }),
  )
}
