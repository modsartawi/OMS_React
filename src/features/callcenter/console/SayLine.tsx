/**
 * A sentence the agent can say to the caller (spec 983 D7, ticket 987) — labelled, quiet, and
 * filled only from server facts.
 *
 * 🚩 Bidi: the offer's description is free server text, so it takes a `<bdi>` through the
 * `<Trans>` slot `<offer>` (and is marked `data-cc-server-text`, like every description in the
 * guidance region). Every other value (an amount, a list of line numbers) is isolated whole with
 * `fsi`. A count stays a number so the plural still resolves.
 */
import { Trans, useTranslation } from 'react-i18next'
import { fsi } from '@/core/util/bidi'
import type { GuidancePhrase } from './guidance-view'

export default function SayLine({ phrases }: { phrases: GuidancePhrase[] }) {
  const { t } = useTranslation('callcenter')
  if (phrases.length === 0) return null
  return (
    <p className="mt-1.5 text-xs text-foreground" data-cc-say>
      <span className="me-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {t('promotions.say.label')}
      </span>
      {phrases.map((phrase) => (
        <span key={phrase.key} className="me-1">
          <Trans
            t={t}
            i18nKey={phrase.key}
            values={isolated(phrase.params)}
            components={{ offer: <bdi data-cc-server-text /> }}
          />
        </span>
      ))}
    </p>
  )
}

const WORDS = new Set(['offer', 'currency'])

function isolated(params: GuidancePhrase['params']): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) =>
      // The offer is isolated by its slot; isolating it again would put FSI inside the <bdi>.
      // The currency is the locale's own word, not a data value.
      [key, typeof value === 'string' && !WORDS.has(key) ? fsi(value) : value],
    ),
  )
}
