/**
 * The offer sheet (spec 995 B, ticket 997) — one offer at full size, opened from its pitch card's
 * title or *Open*, docked over the summary column (a full-height overlay below 1280 px). Escape
 * closes it and focus goes back to the card that opened it (D1).
 *
 * 🚩 **Not modal**, so not core's `SideSheet`: the sheet opens BESIDE the basket (spec 995 B) and
 * the agent may still change the basket with it open — which is exactly the case D5's
 * version-keyed re-read exists for. A modal would make the basket inert and that case unreachable.
 * At 1280 px and up it covers only the summary column; below, it is a full-height overlay.
 *
 * - **Header:** *Offer · phone orders only*, the headline and the item.
 * - **Saves · Each works out · Ends.** The money is the engine's what-if (C3), read when the sheet
 *   opens and again once per basket change (`offer-sheet.ts`). Until it answers the sheet shows the
 *   definition (*100% off 1*); if it fails, the definition and *Couldn't price this right now*.
 *   🚩 A client figure never appears: *Each works out* is the server's `unitAfter`, and where
 *   there is none (an offer over several items) the sheet says the total it becomes instead.
 * - **How it works:** the buy and the get side in words, and a bar in units.
 * - **Add to the order:** a material offer is one row, *Add N* (the what-if's `adds`, or the
 *   card's own add before it answers); a grouping is `ResolvePrereq`'s ranked, stock-checked rows,
 *   added one at a time — both through the console's ordinary add and its refusals (D6).
 * - **Who gets it**, **What to say** (the longer script, in English and Arabic), and the offer's
 *   number (`offerId`: in production the BbyNumber) as a copyable chip *for support* (D8).
 *
 * When the offer fires, the near-miss is gone: the sheet says *Applied* with the engine's amount
 * (ex-VAT, and labelled so: not the same figure as *Saves*) and closes to card D.
 *
 * An Add for an item already on the order is that line's `changeQty` (the page's `guidanceAddPlan`),
 * because a repeat `addItem` is refused and the what-if priced the line growing (4459).
 */
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Copy, Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage, ApiError } from '@/core/api'
import { takesEscape } from '@/core/commands/key-layer'
import type { NearMiss, SessionLine } from '@/core/models/callcenter'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { formatPair, fsi } from '@/core/util/bidi'
import { copyText } from '@/core/util/copy-text'
import { formatMoney } from '@/core/util/number-format'
import { callCenterApi, sessionKey } from './api'
import type { GuidanceActions } from './GuidanceStrip'
import { Qualifying } from './GuidanceStrip'
import type { GuidanceCard, GuidancePhrase } from './guidance-view'
import Money from './Money'
import { formatOfferDay, tierPhrase } from './offer-badges'
import { TopRowStock } from './OfferCard'
import {
  addRows,
  howItWorks,
  offerEnds,
  sheetFigures,
  sheetSay,
  whatIfQuery,
  whoGetsIt,
  type SheetFigures,
  type WhatIfRead,
} from './offer-sheet'
import type { OfferPitch } from './promotions-panel'
import SayLine from './SayLine'

/** How long the sheet says *Applied* before it closes to card D. */
export const APPLIED_CLOSE_MS = 1500

export interface OfferSheetOffer {
  card: GuidanceCard
  pitch: OfferPitch
  miss: NearMiss
  /** The item's name as the basket holds it, where the offer is one material already on a line. */
  itemName: string | null
  /** The basket's lines, so each add row names its own item. */
  basket: readonly Pick<SessionLine, 'itemNumber' | 'description'>[]
}

export default function OfferSheet({
  offerId,
  offer,
  appliedAmount,
  transactionId,
  version,
  actions,
  now,
  onClose,
}: {
  offerId: string
  /** `null` once the offer is no longer one step away. */
  offer: OfferSheetOffer | null
  /** The fired promotion's engine amount, once the offer fired (a primitive: it gates the close timer). */
  appliedAmount: number | null
  transactionId: string
  version: number
  actions: GuidanceActions
  now: Date
  onClose: (reason: 'closed' | 'applied') => void
}) {
  const { t } = useTranslation('callcenter')
  const titleId = useId()
  // The dialog is the copy fallback's container: a modal makes everything outside it unselectable.
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (offer || appliedAmount === null) return
    const timer = window.setTimeout(() => onClose('applied'), APPLIED_CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [offer, appliedAmount, onClose])

  // Escape closes it — when the press is the sheet's: focus is in it (or nowhere), and no modal
  // (the below-ATP confirm an add can raise) is over it. Not modal, so the basket keeps its own
  // Escape: abandoning a quantity edit there leaves the sheet open.
  const frame = useRef<HTMLElement>(null)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!takesEscape(event, frame.current)) return
      const target = event.target instanceof Node ? event.target : null
      if (target && target !== document.body && !frame.current?.contains(target)) return
      event.preventDefault()
      onClose('closed')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  // Focus moves into the sheet when it opens, so Escape and Tab start there.
  useEffect(() => {
    frame.current?.focus()
  }, [])

  const phoneOnly = offer?.miss.audience?.channelOnly === true
  return (
    <section
      ref={frame}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-cc-offer-sheet={offerId}
      className="fixed inset-0 z-40 flex flex-col border-s border-border-strong bg-card text-foreground shadow-lg outline-none xl:absolute xl:inset-y-0 xl:start-auto xl:end-0 xl:w-80"
    >
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t(phoneOnly ? 'offer.sheet.eyebrowPhone' : 'offer.sheet.eyebrow')}
        title={offer ? <SheetHeadline offer={offer} /> : null}
        hint={offer ? <SheetItem offer={offer} /> : undefined}
        closeLabel={t('offer.sheet.close')}
        onClose={() => onClose('closed')}
        closeData={{ 'data-cc-offer-sheet-close': '' }}
      />
      <div ref={body} className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-3 text-sm">
        {offer ? (
          <OfferBody
            offerId={offerId}
            offer={offer}
            transactionId={transactionId}
            version={version}
            actions={actions}
            now={now}
          />
        ) : appliedAmount !== null ? (
          <p
            className="rounded-md border border-success-border bg-success-050 px-3 py-2 text-success-800"
            role="status"
            data-cc-offer-sheet-applied
          >
            <span className="font-semibold">{t('offer.sheet.applied')}</span>{' '}
            <Ltr>
              <Money value={appliedAmount} />
            </Ltr>{' '}
            {/* 🚩 The engine's fired amount is EX-VAT; *Saves* above was VAT-inclusive (§3.9 rule 4). */}
            <span className="text-[11px]" data-cc-offer-sheet-applied-basis>
              {t('offer.sheet.appliedBasis')}
            </span>
          </p>
        ) : null}
      </div>
      {offerId !== '' && <SupportChip offerId={offerId} container={body} />}
    </section>
  )
}

function OfferBody({
  offerId,
  offer,
  transactionId,
  version,
  actions,
  now,
}: {
  offerId: string
  offer: OfferSheetOffer
  transactionId: string
  version: number
  actions: GuidanceActions
  now: Date
}) {
  const { t, i18n } = useTranslation('callcenter')
  const { miss, pitch, card } = offer
  // 🚩 Asked only here, while the sheet is open (D5): a closed card never reads it.
  const query = whatIfQuery({ transactionId, offerId, version, open: true })
  const whatIf = useQuery({
    ...query,
    queryFn: () => callCenterApi.offerWhatIf(transactionId, offerId),
    // The key moves with the basket version, so a re-read is a new key, never a refetch of this one.
    staleTime: Infinity,
    retry: false,
  })
  const read: WhatIfRead = whatIf.isSuccess
    ? { status: 'success', data: whatIf.data }
    : whatIf.isError
      ? { status: 'error', code: apiErrorCode(whatIf.error) }
      : !query.enabled
        ? { status: 'error' }
        : { status: 'pending' }
  const figures = sheetFigures(read, miss.definition)
  // 🚩 `ITEM_NOT_FOUND` says the card is stale: the order is re-read once, and the sheet closes on
  // its own when the near-miss is gone from it (ConsoleShell's `sheetGone`).
  const queryClient = useQueryClient()
  const stale = figures.kind === 'stale'
  useEffect(() => {
    if (stale) void queryClient.invalidateQueries({ queryKey: sessionKey(transactionId) })
  }, [stale, queryClient, transactionId])
  const how = howItWorks(miss.definition, miss.progress, miss.prereq?.kind)
  const who = whoGetsIt(miss.audience)
  const ends = offerEnds(miss.endsOn, now)
  const say = sheetSay({
    pitch: pitch.say,
    who,
    priced: figures.kind === 'priced' ? { saving: formatMoney(figures.saving), after: formatMoney(figures.payableAfter) } : null,
  })
  // A material offer adds what the engine priced (`adds`), or the card's own add until it answers.
  const adds =
    whatIf.isSuccess && whatIf.data.adds.length > 0
      ? whatIf.data.adds
      : pitch.add
        ? [{ itemNumber: pitch.add.itemNumber, qty: pitch.add.qty, uom: pitch.add.uom }]
        : []
  const material = pitch.add !== null
  const prereqMaterial = miss.prereq?.kind === 'material' ? (miss.prereq.materialNumber ?? '') : ''
  // A bundle's missing item is not on a line yet: its name comes from the near-miss (4462).
  const named = [
    ...offer.basket,
    ...(how.bundle ?? []).flatMap((item) => (item.name ? [{ itemNumber: item.itemNumber, description: item.name }] : [])),
  ]
  const rows = addRows(adds, named, prereqMaterial)

  return (
    <>
      <section data-cc-offer-sheet-figures={figures.kind}>
        <dl className="grid grid-cols-3 gap-2">
          {/* VAT-inclusive, the what-if's basis — not the fired promotion's ex-VAT amount (§3.9 rule 4). */}
          <Figure label={t('offer.sheet.saves')} data="saves">
            <SavesValue figures={figures} />
          </Figure>
          <Figure label={figures.kind === 'priced' && figures.eachAfter === null ? t('offer.sheet.total') : t('offer.sheet.each')} data="each">
            {figures.kind === 'priced' ? (
              <Ltr>
                <Money value={figures.eachAfter ?? figures.payableAfter} />
              </Ltr>
            ) : (
              <span className="text-muted-foreground" aria-hidden>
                —
              </span>
            )}
          </Figure>
          <Figure label={t('offer.sheet.ends')} data="ends">
            {ends ? (
              <span className="block">
                <span className="block font-medium">
                  <Ltr>{formatOfferDay(ends.date, i18n.language)}</Ltr>
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {ends.days === 0 ? t('offer.sheet.endsToday') : t('offer.sheet.daysLeft', { count: ends.days })}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground" aria-hidden>
                —
              </span>
            )}
          </Figure>
        </dl>
        {figures.kind === 'pending' && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground" data-cc-offer-sheet-pricing>
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('offer.sheet.pricing')}
          </p>
        )}
        {figures.kind === 'stale' && (
          <p className="mt-1.5 text-xs text-attention-800" role="status" data-cc-offer-sheet-stale>
            {t('offer.sheet.stale')}
          </p>
        )}
        {figures.kind === 'failed' && (
          <p className="mt-1.5 text-xs text-danger-800" role="status" data-cc-offer-sheet-failed>
            {t('offer.sheet.priceFailed')}
            {/* A business refusal says why in the server's words (`NO_PRICE_AT_PLANT`, `ITEM_NOT_SELLABLE`). */}
            {whatIf.error instanceof ApiError && whatIf.error.kind === 'business' && (
              <span className="block text-[11px]" data-cc-server-text>
                <bdi>{apiErrorMessage(whatIf.error, t('offer.sheet.priceFailed'))}</bdi>
              </span>
            )}
          </p>
        )}
        {figures.kind === 'priced' && (
          <p className="mt-1.5 text-[11px] text-muted-foreground" data-cc-offer-sheet-total>
            {t('offer.sheet.totalBecomes', {
              before: fsi(formatMoney(figures.payableBefore)),
              after: fsi(formatMoney(figures.payableAfter)),
            })}
            {!figures.fires && (
              <span className="block text-attention-800" data-cc-offer-sheet-not-fire>
                {t('offer.sheet.wouldNotFire')}
              </span>
            )}
          </p>
        )}
      </section>

      {(how.buy || how.get || how.progress) && (
        <Section title={t('offer.sheet.how.heading')} data="how">
          {how.buy && <p>{phrase(t, how.buy)}</p>}
          {how.get && <p>{phrase(t, how.get)}</p>}
          {how.bundle && (
            <ul className="mt-1 space-y-0.5" data-cc-offer-sheet-bundle>
              {how.bundle.map((item) => (
                <li key={item.itemNumber} className="flex items-center gap-2 text-xs" data-cc-offer-bundle-item={item.itemNumber}>
                  <span className={item.held ? 'text-success' : 'text-muted-foreground'} aria-hidden>
                    {item.held ? '✓' : '+'}
                  </span>
                  <span className="min-w-0 flex-1 truncate" data-cc-server-text title={item.name ?? item.itemNumber}>
                    {item.name ?? item.itemNumber}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{item.itemNumber}</span>
                  <span className={item.held ? 'text-success' : 'font-medium'} data-cc-offer-bundle-held={item.held}>
                    {item.held ? t('offer.bundle.held') : t('offer.bundle.missing', { count: item.missing })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {how.progress && (
            <div className="mt-1.5" data-cc-offer-sheet-progress>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={how.progress.total}
                aria-valuenow={how.progress.have}
                aria-label={t('offer.strip.label', { have: how.progress.have, total: how.progress.total })}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${(how.progress.have / how.progress.total) * 100}%` }} />
              </div>
              <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                {t('offer.strip.label', { have: how.progress.have, total: how.progress.total })}
              </p>
            </div>
          )}
        </Section>
      )}

      <Section title={t('offer.sheet.addHeading')} data="add">
        {material ? (
          rows.map((add) => (
            <div key={add.itemNumber} className="flex flex-wrap items-center gap-2" data-cc-offer-sheet-add-row={add.itemNumber}>
              {/* Each row is its own item: a get item that is not the buy item has its own name. */}
              <span className="min-w-0 flex-1 text-xs">
                {add.name !== null && (
                  <span className="block truncate" data-cc-server-text data-cc-offer-sheet-add-name>
                    <bdi>{add.name}</bdi>
                  </span>
                )}
                <span className={add.name !== null ? 'block text-[11px] text-muted-foreground' : 'block'} data-numeric>
                  <Ltr>{add.itemNumber}</Ltr>
                </span>
              </span>
              {/* `ResolvePrereq`'s top row is the prerequisite's stock: on its own row only. */}
              {add.stock && <TopRowStock offerId={offerId} transactionId={transactionId} />}
              {actions.onAdd && (
                <Button
                  variant="primary"
                  className="min-h-10 tabular-nums"
                  disabled={actions.pending !== null}
                  onClick={() =>
                    actions.onAdd?.({ offerId, itemNumber: add.itemNumber, itemName: add.name ?? add.itemNumber, qty: add.qty, uom: add.uom })
                  }
                  data-cc-offer-sheet-add={add.qty}
                >
                  {actions.pending?.offerId === offerId && actions.pending.itemNumber === add.itemNumber
                    ? t('search.adding')
                    : t('offer.sheet.add', { count: add.qty })}
                </Button>
              )}
            </div>
          ))
        ) : (
          <Qualifying card={card} transactionId={transactionId} actions={actions} />
        )}
      </Section>

      {who && (
        <Section title={t('offer.sheet.who.heading')} data="who">
          <ul className="space-y-0.5 text-xs">
            {who.tiers.length > 0 ? (
              <li data-cc-offer-sheet-tiers data-cc-offer-qualifies={who.qualifies ? 'yes' : 'no'}>
                {(() => {
                  const tiers = tierPhrase(who.tiers, i18n.getFixedT(i18n.language), i18n.language)
                  return t(tiers.key, tiers.params)
                })()}{' '}
                <span className={who.qualifies ? 'text-success-800' : 'text-danger-800'}>
                  <span aria-hidden>{who.qualifies ? '✓ ' : '✗ '}</span>
                  {t(who.qualifies ? 'offer.badge.qualifies' : 'offer.badge.notQualifies')}
                </span>
              </li>
            ) : (
              <li data-cc-offer-sheet-tiers="">{t('offer.sheet.who.everyone')}</li>
            )}
            <li data-cc-offer-sheet-channel={who.phoneOnly ? 'phone' : 'any'}>
              {t(who.phoneOnly ? 'offer.sheet.who.phone' : 'offer.sheet.who.anyChannel')}
            </li>
          </ul>
        </Section>
      )}

      <Section title={t('offer.sheet.sayHeading')} data="say">
        <SayLine phrases={say} bilingual />
      </Section>
    </>
  )
}

function SavesValue({ figures }: { figures: SheetFigures }) {
  const { t } = useTranslation('callcenter')
  if (figures.kind === 'priced')
    return (
      <>
        <span className="text-success-800" data-cc-offer-sheet-saving>
          <Ltr>
            <Money value={figures.saving} size="lg" />
          </Ltr>
        </span>
        <span className="block text-[11px] text-muted-foreground" data-cc-offer-sheet-saving-basis>
          {t('offer.sheet.savesBasis')}
        </span>
      </>
    )
  // 🚩 Not a figure: the definition, until (or instead of) the engine's answer.
  return figures.definition ? (
    <span className="font-semibold" data-cc-offer-sheet-definition>
      <Ltr>{phrase(t, figures.definition)}</Ltr>
    </span>
  ) : (
    <span className="text-muted-foreground" aria-hidden>
      —
    </span>
  )
}

function Figure({ label, data, children }: { label: string; data: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-divider bg-card px-2 py-1.5 tabular-nums" data-cc-offer-sheet-figure={data}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

function Section({ title, data, children }: { title: string; data: string; children: ReactNode }) {
  return (
    <section data-cc-offer-sheet-section={data}>
      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function SheetHeadline({ offer }: { offer: OfferSheetOffer }) {
  const { t } = useTranslation('callcenter')
  const headline = offer.pitch.headline
  return (
    <span className="block text-base leading-tight text-primary-800" data-cc-offer-sheet-headline>
      {headline.kind === 'phrase' ? phrase(t, headline.phrase) : <bdi data-cc-server-text>{headline.text}</bdi>}
    </span>
  )
}

function SheetItem({ offer }: { offer: OfferSheetOffer }) {
  const { t } = useTranslation('callcenter')
  const material = offer.miss.prereq?.kind === 'material' ? (offer.miss.prereq.materialNumber ?? '') : ''
  if (material !== '')
    return (
      <span data-cc-offer-sheet-item={material}>
        {/* A pair led by a machine value: formatted once, isolated once. */}
        <Ltr>{offer.itemName ? formatPair(material, offer.itemName) : material}</Ltr>
      </span>
    )
  return offer.card.set ? <span data-cc-offer-sheet-item="">{t(offer.card.set.key, offer.card.set.params)}</span> : null
}

/**
 * The offer's address, for support (D8): copied, never navigated to. It is `offerId` — the marketing
 * `OfferId` when set, else the BbyNumber (859); the BbyNumber itself is not on the wire, so the chip
 * says *offer number*, not *bonus buy*.
 */
function SupportChip({ offerId, container }: { offerId: string; container: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation('callcenter')
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null)
  return (
    <footer className="flex shrink-0 items-center gap-2 border-t border-divider px-4 py-2">
      <Button
        variant="outlined"
        className="min-h-10"
        onClick={() => void copyText(offerId, { container: container.current }).then(setCopied)}
        aria-label={t('offer.sheet.copyBby', { number: fsi(offerId) })}
        data-cc-offer-sheet-bby={offerId}
      >
        <Copy className="h-3.5 w-3.5" aria-hidden />
        <Ltr>{offerId}</Ltr>
        <span className="text-muted-foreground">{t('offer.sheet.forSupport')}</span>
      </Button>
      {copied && (
        <span className="text-[11px] text-muted-foreground" role="status" data-cc-offer-sheet-copied={copied}>
          {t(copied === 'copied' ? 'offer.sheet.copied' : 'offer.sheet.copyFailed')}
        </span>
      )}
    </footer>
  )
}

/** A phrase whose figures are isolated whole; a count stays a number for the plural. */
function phrase(t: (key: string, params?: Record<string, unknown>) => string, value: GuidancePhrase): string {
  return t(
    value.key,
    Object.fromEntries(
      Object.entries(value.params).map(([key, param]) => [key, key === 'count' || typeof param === 'boolean' ? param : fsi(String(param))]),
    ),
  )
}
