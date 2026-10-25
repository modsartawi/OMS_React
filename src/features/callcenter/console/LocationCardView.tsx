/**
 * The location card (575, BackOffice spec 2482; rows and rules: BackOffice 2468) — what the
 * customer sent, one row per field with its tick, and **Apply**. It replaces the waiting
 * strip in the same place. A thin renderer: every row, tick and note is `location-card.ts`'s,
 * proved there; the Apply call and its refusals are `LocationLinkPanel`'s.
 *
 * Bidi: the coordinates, the accuracy and the Short Addresses are machine values (`Ltr`, the
 * coordinates as ONE string); the customer's details are free text (`<bdi>`); the prose lines
 * read in their own language's direction (`dir="auto"`, the header sentence's rule).
 */
import { useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import type { LocationCard, LocationTicks } from './location-card'

export default function LocationCardView({
  card,
  ticks,
  onTick,
  applying,
  onApply,
  error,
  saveError,
}: {
  card: LocationCard
  ticks: LocationTicks
  onTick: (next: LocationTicks) => void
  applying: boolean
  onApply: () => void
  /** A refusal drawn on the card (already worded). */
  error: string | null
  /** A save-to-customer refusal, drawn on that tick (already worded). */
  saveError: string | null
}) {
  const { t } = useTranslation('callcenter')
  const [copied, setCopied] = useState(false)
  const tick = (field: keyof LocationTicks) => (checked: boolean) => onTick({ ...ticks, [field]: checked })

  const copyDetails = () => {
    const text = card.details.text ?? ''
    // Inside the promise, so a page with no clipboard (plain http) fails quietly, not by throwing.
    void Promise.resolve()
      .then(() => navigator.clipboard.writeText(text))
      .then(() => setCopied(true))
      .catch(() => setCopied(false))
  }

  return (
    <section
      className="flex flex-col gap-2 rounded-md border border-border bg-card px-3 py-2 text-[12.5px]"
      aria-labelledby="cc-location-card-title"
      data-cc-location-card
    >
      <h3 id="cc-location-card-title" className="flex items-center gap-2 text-sm font-semibold">
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span dir="auto">{t('location.card.title')}</span>
      </h3>

      <Row
        field="pin"
        label={t('location.card.row.pin')}
        checked={ticks.pin}
        onChange={tick('pin')}
        note={card.pin.replacesEarlier ? t('location.card.pin.replaces') : null}
      >
        <span dir="auto" data-cc-location-source={card.pin.source}>
          {card.pin.source === 'DEVICE' ? (
            <Trans
              t={t}
              ns="callcenter"
              i18nKey="location.card.pin.device"
              values={{ meters: card.pin.accuracyMeters }}
              components={{ accuracy: <Ltr /> }}
            />
          ) : (
            t('location.card.pin.manual')
          )}
        </span>
        <span className="select-all font-mono tabular-nums" data-cc-location-coords>
          <Ltr>{card.pin.coordinates}</Ltr>
        </span>
        <a
          href={card.pin.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline-offset-2 hover:underline"
          data-cc-location-maps
        >
          {t('location.card.openMaps')}
        </a>
      </Row>

      <Row
        field="shortAddress"
        label={t('location.card.row.shortAddress')}
        checked={card.shortAddress.tickable ? ticks.shortAddress : null}
        onChange={tick('shortAddress')}
        note={
          card.shortAddress.code === null ? (
            t('location.card.shortAddress.notGiven')
          ) : card.shortAddress.orderHas ? (
            <Trans
              t={t}
              ns="callcenter"
              i18nKey="location.card.shortAddress.orderHas"
              values={{ code: card.shortAddress.orderHas }}
              components={{ code: <Ltr /> }}
            />
          ) : null
        }
      >
        {card.shortAddress.code && (
          <span className="font-mono" data-cc-location-short>
            <Ltr>{card.shortAddress.code}</Ltr>
          </span>
        )}
      </Row>

      <Row
        field="details"
        label={card.details.mode === 'tick' ? t('location.card.row.detailsInto') : t('location.card.row.details')}
        checked={card.details.mode === 'tick' ? ticks.details : null}
        onChange={tick('details')}
        note={
          card.details.mode === 'copy'
            ? t('location.card.details.filled')
            : card.details.mode === 'none'
              ? t('location.card.details.none')
              : null
        }
      >
        {card.details.text !== null && (
          <span className="min-w-0 break-words" data-cc-location-details>
            <bdi>{card.details.text}</bdi>
          </span>
        )}
        {card.details.mode === 'copy' && (
          <Button variant="outlined" onClick={copyDetails} data-cc-location-copy>
            {copied ? t('location.card.details.copied') : t('location.card.details.copy')}
          </Button>
        )}
      </Row>

      {card.saveToCustomer && (
        <div className="flex flex-col gap-1" data-cc-location-row="saveToCustomer">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ticks.saveToCustomer}
              onChange={(e) => tick('saveToCustomer')(e.target.checked)}
              aria-invalid={saveError !== null}
              data-cc-location-tick="saveToCustomer"
            />
            <span dir="auto">{t('location.card.saveToCustomer')}</span>
          </label>
          {saveError && (
            <p className="ps-6 text-danger-800" data-cc-location-save-error>
              <bdi>{saveError}</bdi>
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md border border-danger-border bg-danger-050 p-2 text-danger-800" data-cc-location-card-error>
          <bdi>{error}</bdi>
        </p>
      )}

      <div className="flex justify-end">
        <Button variant="primary" onClick={onApply} disabled={applying} data-cc-location-apply>
          {applying ? t('location.card.applying') : t('location.card.apply')}
        </Button>
      </div>
    </section>
  )
}

/**
 * One field's row: its tick (or none, when there is nothing it could apply — `checked`
 * `null`), its label, what the customer sent, and its note.
 */
function Row({
  field,
  label,
  checked,
  onChange,
  note,
  children,
}: {
  field: string
  label: string
  checked: boolean | null
  onChange: (checked: boolean) => void
  note: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5" data-cc-location-row={field}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex min-w-[9rem] items-center gap-2 font-medium">
          {checked !== null ? (
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
              data-cc-location-tick={field}
            />
          ) : (
            // Keeps the label in line with the ticked rows'.
            <span className="inline-block w-[13px]" aria-hidden />
          )}
          <span dir="auto">{label}</span>
        </label>
        {children}
      </div>
      {note && (
        // The PARAGRAPH keeps the page's direction, so the note sits under its row on either
        // side; only its prose reads in its own language's direction.
        <p className="ps-6 text-start text-muted-foreground" data-cc-location-note={field}>
          <span dir="auto">{note}</span>
        </p>
      )}
    </div>
  )
}
