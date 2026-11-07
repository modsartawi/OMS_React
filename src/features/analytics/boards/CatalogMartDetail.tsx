import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import type { AnalyticsCatalogMart } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { analyticsAccessQuery } from './access'
import { rawOffer, type RawOffer } from './catalog-raw'
import { DetailShell, Fact, KeyList, ServerText } from './CatalogDetailParts'
import CatalogRawPreview from './CatalogRawPreview'

/**
 * A mart / fact / dim node's detail (ticket 841, spec 3437 story 27): kind, description, grain and the source tables
 * it is built from. Description and grain are the dbt's English text (`<bdi>`, not keyed).
 *
 * 844 (§G, stories 39–41, 47–48): a curator also sees the mart's row count and size, how many of its columns are
 * hidden from previews, and the **Raw preview (top 200)** action. Everyone else sees none of these (ruling 7) — the
 * server nulls the fields for them, and `rawOffer` also asks the probe.
 */
export default function CatalogMartDetail({ martKey, mart }: { martKey: string; mart: AnalyticsCatalogMart | null }) {
  const { t } = useTranslation('boards')
  const probe = useQuery(analyticsAccessQuery())
  const offer = rawOffer(mart, probe.data)
  // Which mart's preview is open: moving to another mart closes it.
  const [previewing, setPreviewing] = useState<string | null>(null)
  const open = offer !== null && previewing === martKey
  const actions = offer ? (
    <Button variant={open ? 'outlined' : 'secondary'} onClick={() => setPreviewing(open ? null : martKey)} aria-expanded={open} data-catalog-raw-action="">
      {open ? t('catalog.raw.close') : t('catalog.raw.action')}
    </Button>
  ) : null
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DetailShell kind={t(`catalog.martKind.${mart?.kind ?? 'mart'}`)} title={null} machineKey={martKey} actions={actions} data="mart">
        {!mart ? (
          <Fact label={t('catalog.fact.description')}>
            <span className="text-muted-foreground">{t('catalog.notDescribed')}</span>
          </Fact>
        ) : (
          <>
            <Fact label={t('catalog.fact.description')}>
              <ServerText text={mart.description} />
            </Fact>
            <Fact label={t('catalog.fact.grain')} data="grain">
              <ServerText text={mart.grain} />
            </Fact>
            <Fact label={t('catalog.fact.sources')} data="sources">
              <KeyList keys={mart.sources} empty={t('catalog.noSources')} data="sources" />
            </Fact>
            {offer && <CuratorFacts offer={offer} />}
          </>
        )}
      </DetailShell>
      {open && <CatalogRawPreview key={martKey} martKey={martKey} offer={offer} />}
    </div>
  )
}

/** Latin digits with grouping, as every machine value (isolated by `Ltr` at the call). */
const grouped = (n: number, fraction = 0) => n.toLocaleString('en-US', { maximumFractionDigits: fraction })

/** The curator-only facts: row count and size (a view stores neither) and the hidden-column count. */
function CuratorFacts({ offer }: { offer: RawOffer }) {
  const { t } = useTranslation('boards')
  return (
    <>
      <Fact label={t('catalog.raw.rows')} data="rows">
        {offer.rows == null ? <span className="text-muted-foreground">{t('catalog.raw.notStored')}</span> : <Ltr>{grouped(offer.rows)}</Ltr>}
      </Fact>
      <Fact label={t('catalog.raw.size')} data="size">
        {offer.sizeMb == null ? (
          <span className="text-muted-foreground">{t('catalog.raw.notStored')}</span>
        ) : (
          <Trans t={t} i18nKey="catalog.raw.sizeValue" components={{ n: <Ltr /> }} values={{ size: grouped(offer.sizeMb, 1) }} />
        )}
      </Fact>
      <Fact label={t('catalog.raw.hidden')} data="hidden">
        <Ltr>{offer.hiddenColumns}</Ltr>
      </Fact>
    </>
  )
}
