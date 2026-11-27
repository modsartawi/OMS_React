/**
 * The period picker's pure half (oms 948, 949; BO 4177/4178): what a chip or Apply chooses. The page moves the URL to
 * the choice (`withPeriod`, `@/core/command-center-routes`), so the server is asked again for it.
 */
import type { CcPeriodChoice } from '@/core/command-center-routes'
import type { CcPeriodKind } from '@/core/models/command-center'

/** A chip: the rolling 4 weeks and year-to-date apply at once; dates wait for their two ends (null). */
export const chipChoice = (kind: CcPeriodKind): CcPeriodChoice | null => (kind === 'dates' ? null : { period: kind })

/** Apply: both ends typed and in order, or nothing to apply (null). */
export const datesChoice = (from: string, to: string): CcPeriodChoice | null =>
  from !== '' && to !== '' && from <= to ? { period: 'dates', from, to } : null

/** The picker remounts on a new period, so its typed dates follow the URL. */
export const periodKey = (period: CcPeriodChoice): string => (period.period === 'dates' ? `dates:${period.from}:${period.to}` : period.period)
