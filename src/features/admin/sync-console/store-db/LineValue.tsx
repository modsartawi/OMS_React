import { Fragment, type ReactElement, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { formatParts } from '@/core/util/bidi'
import { figure } from '../helpers'
import type { ReadingLine } from './reading-helpers'
import { bitnessText } from './fleet-helpers'
import { sizeText } from './size'

/**
 * The reading's lines as a definition list (oms 916): the Readings panel draws them all, the Space panel (918) the
 * ones about space. `data` names the line attribute the drives read (`data-reading-line` / `data-space-line`).
 */
export function ReadingLineList({ lines, data }: { lines: readonly ReadingLine[]; data: 'reading' | 'space' }) {
  const { t } = useTranslation('sync-console')
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      {lines.map((line) => (
        <div key={line.key} className="contents" {...{ [`data-${data}-line`]: line.key }}>
          <dt className="text-muted-foreground">{t(`storeDb.readings.lines.${line.key}`)}</dt>
          <dd className="min-w-0 tabular-nums">
            <LineValue line={line} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * One reading line's value. A machine value is isolated whole (`Ltr`); a word (bitness, "No cap", "None open") takes
 * the text's own direction (bidi rule). The Backup panel (918) reuses it for the last full backup.
 */
export default function LineValue({ line }: { line: ReadingLine }) {
  const { t } = useTranslation('sync-console')
  const missing = <span className="text-muted-foreground">{t('storeDb.readings.values.missing')}</span>
  const slotted = (i18nKey: string, values: Record<string, string>, slots: Record<string, ReactElement>) => (
    <Trans t={t} i18nKey={i18nKey} values={values} components={slots} />
  )
  switch (line.kind) {
    case 'engine': {
      // The server's engine label (`SQL Server 2008 R2`) leads the version: one machine value, isolated once.
      const machine = formatParts([line.engine, line.version].filter((p): p is string => !!p))
      const bitness = bitnessText(t, line.bitness)
      const parts: ReactNode[] = [
        machine ? <Ltr>{machine}</Ltr> : null,
        line.edition ? <bdi>{line.edition}</bdi> : null,
        bitness ? <bdi>{bitness}</bdi> : null,
      ].filter((p) => p != null)
      // Independent facts, each isolated by its kind and listed in the text's direction ("SQL Server 2008 R2 · 10.50… · Express Edition · 64-bit").
      return (
        <>
          {parts.map((p, i) => (
            <Fragment key={i}>
              {i > 0 && ' · '}
              {p}
            </Fragment>
          ))}
        </>
      )
    }
    case 'size':
      return line.size ? <Ltr>{sizeText(t, line.size)}</Ltr> : missing
    case 'noCap':
      return <>{t('storeDb.readings.values.noCap')}</>
    case 'used':
      if (!line.size) return missing
      return line.share === null ? (
        <Ltr>{sizeText(t, line.size)}</Ltr>
      ) : (
        slotted('storeDb.readings.values.usedOfCap', { size: sizeText(t, line.size), share: line.share }, { size: <Ltr />, share: <Ltr /> })
      )
    case 'log':
      if (!line.size) return missing
      return line.used
        ? slotted('storeDb.readings.values.logUsed', { used: sizeText(t, line.used), size: sizeText(t, line.size) }, { used: <Ltr />, size: <Ltr /> })
        : <Ltr>{sizeText(t, line.size)}</Ltr>
    case 'text':
      return line.text ? <Ltr>{line.text}</Ltr> : missing
    case 'drive':
      if (!line.size) return missing
      return line.drive
        ? slotted('storeDb.readings.values.driveOn', { size: sizeText(t, line.size), drive: line.drive }, { size: <Ltr />, drive: <Ltr /> })
        : <Ltr>{sizeText(t, line.size)}</Ltr>
    case 'uptime':
      return slotted('storeDb.readings.values.uptime', { days: figure(line.days), hours: figure(line.hours) }, { days: <Ltr />, hours: <Ltr /> })
    case 'count':
      return <Ltr>{figure(line.n)}</Ltr>
    case 'age':
      if (line.hours > 0)
        return slotted('storeDb.readings.values.ageHours', { h: figure(line.hours), m: figure(line.minutes) }, { h: <Ltr />, m: <Ltr /> })
      if (line.minutes > 0)
        return slotted('storeDb.readings.values.ageMinutes', { m: figure(line.minutes), s: figure(line.seconds) }, { m: <Ltr />, s: <Ltr /> })
      return slotted('storeDb.readings.values.ageSeconds', { s: figure(line.seconds) }, { s: <Ltr /> })
    case 'noTransaction':
      return <>{t('storeDb.readings.values.noTransaction')}</>
    case 'backup':
      return <Ltr>{formatDateTime(line.at)}</Ltr>
    case 'missing':
      return missing
  }
}
