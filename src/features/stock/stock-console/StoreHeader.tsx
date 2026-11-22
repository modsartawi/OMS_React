import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { StockConsoleStoreRow } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { FreeCell, ReservedCell } from './figure-cells'
import { flagLines, type FlagLine } from './figures'
import { flagHref } from './flags'
import HowRead from './HowRead'
import { HOW_STORE } from './how-sections'
import StatusPill, { FlagSentence } from './StatusPill'

const KNOWN_STAGES = ['Shadow', 'Seeding', 'Seeded', 'Blocking']

/**
 * A store's header (oms 941, spec 4157 stories 12–13), from `StockConsole/Stores/{store}` read fresh on opening: the
 * store, its city, stage, status and flags; six figures — SAP stock, till-side stock, held with its two parts, reserved,
 * free, last update; then where the SAP feed stands (the last SAP document applied) and the last till read, each with
 * its last attempt. Each flag opens its list: the right tab, its filter set and the search run (942, `./flags`).
 */
export default function StoreHeader({ row }: { row: StockConsoleStoreRow }) {
  const { t } = useTranslation('stock-console')
  const lines = flagLines(row.flags)
  const stage = KNOWN_STAGES.includes(row.stage) ? t(`stage.${row.stage}`) : row.stage

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-store-header={row.plant}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-mono text-2xl">
          <Ltr>{row.plant}</Ltr>
        </h2>
        {row.city && (
          <span className="text-sm text-muted-foreground">
            <bdi>{row.city}</bdi>
          </span>
        )}
        <span data-store-stage={row.stage}>
          <StatusBadge sev="mute">{KNOWN_STAGES.includes(row.stage) ? stage : <bdi>{stage}</bdi>}</StatusBadge>
        </span>
        <StatusPill store={row.plant} status={row.status} flags={row.flags} />
        <span className="ms-auto text-xs text-muted-foreground">{t('stores.baseUnits')}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm" data-store-flags={lines.length}>
        <span className="text-xs font-medium text-muted-foreground">{t('store.flags')}</span>
        {lines.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t('store.noFlags')}</span>
        ) : (
          lines.map((line, i) => <FlagChip key={`${line.code}-${i}`} store={row.plant} line={line} />)
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label={t('store.figures.label')}>
        <Figure label={t('store.figures.sapStock')} name="sapStock">
          <Ltr>{formatFigure(row.sapStock)}</Ltr>
        </Figure>
        <Figure label={t('store.figures.tillStock')} name="tillStock">
          <Ltr>{formatFigure(row.tillStock)}</Ltr>
        </Figure>
        <Figure
          label={t('store.figures.held')}
          name="held"
          sub={
            <Trans
              t={t}
              i18nKey="store.heldParts"
              values={{ standing: formatFigure(row.heldStanding), sold: formatFigure(row.heldSold) }}
              components={{ v: <Ltr /> }}
            />
          }
        >
          <Ltr>{formatFigure(row.held)}</Ltr>
        </Figure>
        <Figure label={t('store.figures.reserved')} name="reserved">
          <ReservedCell row={row} t={t} />
        </Figure>
        <Figure label={t('store.figures.free')} name="free">
          <FreeCell row={row} t={t} />
        </Figure>
        <Figure label={t('store.figures.lastUpdate')} name="lastUpdate">
          <span className="font-mono text-sm">
            {row.lastUpdate ? <Ltr>{formatDateTime(row.lastUpdate)}</Ltr> : t('store.never')}
          </span>
        </Figure>
      </dl>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground" data-store-feeds="">
        <FeedLine sentence="store.sapPlace" at={row.sapPlace} attempt={row.sapLastAttempt} />
        <FeedLine sentence="store.tillPlace" at={row.tillPlace} attempt={row.tillLastAttempt} />
      </div>

      <HowRead section="store" paragraphs={HOW_STORE} />
    </section>
  )
}

const CHIP = 'inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5 text-xs'

/**
 * A flag on the header: its level and its sentence. A flag the console knows is a link to its list — a click counts as
 * asking, so the list opens searched; an unknown one stays a plain chip.
 */
function FlagChip({ store, line }: { store: string; line: FlagLine }) {
  const { t } = useTranslation('stock-console')
  const href = flagHref(store, line.code)
  const body = (
    <>
      <StatusBadge sev={line.sev}>{t(line.sev === 'bad' ? 'level.Problem' : 'level.Watch')}</StatusBadge>
      <FlagSentence line={line} />
    </>
  )
  return href ? (
    <Link
      to={href}
      title={t('flagLink.open')}
      className={`${CHIP} text-foreground underline-offset-2 hover:border-primary hover:underline`}
      data-store-flag={line.code}
      data-flag-link={href}
    >
      {body}
    </Link>
  ) : (
    <span className={CHIP} data-store-flag={line.code}>
      {body}
    </span>
  )
}

function Figure({ label, name, sub, children }: { label: string; name: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border/60 px-3 py-2" data-store-figure={name}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{children}</dd>
      {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
    </div>
  )
}

/** "Last SAP document applied: <time> · last attempt <time>" — "never" for a feed with no place yet. */
function FeedLine({ sentence, at, attempt }: { sentence: string; at: string | null; attempt: string | null }) {
  const { t } = useTranslation('stock-console')
  const time = (value: string | null) => (value ? formatDateTime(value) : t('store.never'))
  return (
    <span className="inline-flex flex-wrap gap-x-2">
      <span>
        <Trans t={t} i18nKey={sentence} values={{ at: time(at) }} components={{ at: <Ltr /> }} />
      </span>
      <span>
        <Trans t={t} i18nKey="store.lastAttempt" values={{ at: time(attempt) }} components={{ at: <Ltr /> }} />
      </span>
    </span>
  )
}
