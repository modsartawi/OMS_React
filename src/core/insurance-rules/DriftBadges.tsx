import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { badgesOnField, badgesOnRule, driftItemPath, driftSignalType, signalReading, type DriftBadge, type DriftSignal } from './drift'
import { driftBadgesQuery } from './registry-api'

/** A drift signal in words, each rate, URL and version in its own isolate (the words carry the order). */
export function DriftSignalWords({ signal }: { signal: DriftSignal }) {
  const { t } = useTranslation('insurance-rules')
  const { words, values } = signalReading(signal)
  return <Trans t={t} i18nKey={words} values={values} components={{ v: <Ltr /> }} />
}

function DriftLink({ badge, word, newTab }: { badge: DriftBadge; word: string; newTab?: boolean }) {
  const { t } = useTranslation('insurance-rules')
  return (
    <Link
      to={driftItemPath(badge.itemId)}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener' : undefined}
      className="inline-flex hover:underline"
      title={t('drift.hint', { payer: fsi(badge.payer), signal: t(`drift.type.${driftSignalType(badge.signal)}`) })}
      data-drift-badge={badge.itemId}
      data-drift-payer={badge.payer}
    >
      <StatusBadge sev="warn">{word}</StatusBadge>
    </Link>
  )
}

/**
 * A catalog row's drift. `newTab` is for the picker: it sits over an editor whose unsaved draft must survive the link.
 * A denied or failed read shows no badge: the catalog stays usable.
 */
export function FieldDriftBadges({ fieldKey, newTab }: { fieldKey: string; newTab?: boolean }) {
  const { t } = useTranslation('insurance-rules')
  const { data } = useQuery(driftBadgesQuery())
  return (
    <>
      {badgesOnField(data ?? [], fieldKey).map((b) => (
        <DriftLink key={b.itemId} badge={b} word={t('drift.badge')} newTab={newTab} />
      ))}
    </>
  )
}

/** A published rule's drift, saying the rule is still running: drift stops nothing (D5). */
export function RuleDriftBadges({ ruleId }: { ruleId: string }) {
  const { t } = useTranslation('insurance-rules')
  const { data } = useQuery(driftBadgesQuery())
  return (
    <>
      {badgesOnRule(data ?? [], ruleId).map((b) => (
        <DriftLink key={b.itemId} badge={b} word={t('drift.ruleBadge')} />
      ))}
    </>
  )
}
