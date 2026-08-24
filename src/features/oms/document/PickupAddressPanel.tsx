import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { lookupQueries } from '@/core/services/lookups'
import { apiErrorMessage } from '@/core/api'
import type { SdDistrictModel } from '@/core/models/lookups'
import {
  applyPickupDistrict,
  districtLabel,
  pickupAddressSummary,
  reconcilePickupDistrict,
  restorePickupDistrict,
  type PickupAddress,
} from './return-order'

/**
 * A district's identity for the picker.
 *
 * `districtCode` alone is NOT it: the lookup carries ~1.7k rows across every
 * city, and two cities may spell the same code. The pair is what makes an
 * `<option>` map back to exactly the row that was chosen.
 */
const districtKey = (district: { districtCode: string; cityCode: string }) =>
  `${district.cityCode}|${district.districtCode}`

/** The editable text fields, in the order the carrier reads them. */
const ADDRESS_FIELDS = ['street1', 'buildingNumber', 'postalCode', 'shortAddress', 'street2'] as const

/**
 * The pickup address — where the courier collects (spec 289 D6, ticket 292).
 *
 * ⚠ **It is mounted only under `RTRF`.** Under Refund Only nothing collects, so
 * there is nothing to address, and its ABSENCE — rather than a greyed-out
 * region — is what makes the two reasons read as different screens. The caller
 * owns that decision; this component assumes a collection is being booked.
 *
 * The draft is the caller's, so an edit survives the panel being closed and
 * reopened and is discarded with the dialog. **The address on the delivery is
 * never touched** — only the one that will post with the return.
 */
export default function PickupAddressPanel({
  delivered,
  address,
  onChange,
}: {
  /** The delivery's own address: what the draft started from, and its way back. */
  delivered: PickupAddress
  address: PickupAddress
  onChange: (next: (prev: PickupAddress) => PickupAddress) => void
}) {
  const { t } = useTranslation('document')
  /** Collapsed by default: the address is pre-filled and right nearly always. */
  const [expanded, setExpanded] = useState(false)

  /**
   * The SAME cached `SdDocument/Districts` read the Change Store picker uses, so
   * the control costs nothing and no feature imports another feature. It is
   * fetched only once a collection is actually being booked, because that is the
   * only time this component exists.
   */
  const districts = useQuery(lookupQueries.districts())
  const rows = useMemo(() => districts.data ?? [], [districts.data])

  /**
   * The lookup row an address is standing on, matched on the pair and then on
   * the code alone — a delivery whose `cityCode` is blank or stale still names a
   * district the lookup carries, and pinning a second copy of it would draw two
   * identical options.
   */
  const matchDistrict = (of: PickupAddress): SdDistrictModel | null => {
    if (!of.districtCode) return null
    return (
      rows.find((row) => districtKey(row) === districtKey(of)) ??
      rows.find((row) => row.districtCode === of.districtCode) ??
      null
    )
  }

  /**
   * The picker's rows, with the delivery's OWN district kept visible when the
   * lookup does not carry it (or has not arrived yet) — dropping it would make
   * the panel claim the pickup has no district while the delivery plainly names
   * one. Pinned off the DELIVERY, not off the current draft: a row that came and
   * went with the selection would make an accidental change unrepairable without
   * cancelling the dialog and losing every ticked line.
   */
  const districtOptions = useMemo(() => {
    const options = rows.map((row) => ({
      key: districtKey(row),
      label: districtLabel(row),
      district: row as SdDistrictModel | null,
    }))
    if (delivered.districtCode && !matchDistrict(delivered)) {
      options.unshift({
        key: districtKey(delivered),
        label: delivered.districtName || delivered.districtCode,
        district: null,
      })
    }
    return options
  }, [rows, delivered])

  /** What the `<select>` is showing: the matched row, or the pinned delivery row. */
  const selected = matchDistrict(address)
  const selectedKey = selected
    ? districtKey(selected)
    : address.districtCode
      ? districtKey(address)
      : ''

  /**
   * A code-only match is a DISPLAY fallback, and the draft is made to agree with
   * it as soon as the lookup lands.
   *
   * Without this the panel shows the matched district beside an empty City with
   * no one-step way to fill it — the picker is already showing that row, so
   * re-choosing it is not a change the `<select>` can even fire — and 294 posts
   * the `districtCode` with a blank `cityCode`. The write is exactly the one
   * re-picking the row would make, so nothing lands here that the operator
   * could not have done by hand.
   *
   * `reconcilePickupDistrict` returns the same object when the pair already
   * agrees, so the common case sets state to its own value and React bails out
   * — the effect can run on every render without a loop. The delivery's own
   * pinned row is never reconciled: `selected` is `null` there, and that row is
   * the way BACK to what arrived, not a mismatch to repair.
   */
  useEffect(() => {
    if (!selected) return
    onChange((prev) => reconcilePickupDistrict(prev, selected))
  }, [selected, onChange])

  /**
   * Choosing a row: a lookup district derives its city; the pinned delivery row
   * puts the delivery's own district and city back exactly as they arrived — it
   * is a way BACK, not a dead option.
   */
  function chooseDistrict(key: string) {
    const chosen = districtOptions.find((row) => row.key === key)
    if (!chosen) return
    onChange((prev) =>
      chosen.district
        ? applyPickupDistrict(prev, chosen.district)
        : restorePickupDistrict(prev, delivered),
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-border p-3" data-return-address-panel>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-start text-[0.8125rem] font-semibold"
        onClick={() => setExpanded((was) => !was)}
        aria-expanded={expanded}
        data-return-address-toggle
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        )}
        {t('returnDocument.address.title')}
        {/*
          Collapsed, the whole address is ONE line: it is pre-filled and right
          nearly always, and an open six-field form implies it needs attention it
          usually does not.
        */}
        {!expanded && (
          <span className="truncate font-normal text-muted-foreground" data-return-address-summary>
            {pickupAddressSummary(address).join(' · ') || t('returnDocument.address.none')}
          </span>
        )}
        <span className="ms-auto shrink-0 text-[0.6875rem] font-semibold text-muted-foreground">
          {t(expanded ? 'returnDocument.address.collapse' : 'returnDocument.address.change')}
        </span>
      </button>

      {expanded && (
        <>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
            {/*
              A PICKER, never free text: a district the courier cannot route to
              is a collection that fails. The city beside it is derived and
              read-only, so the pair can never disagree.
            */}
            <label className="flex flex-col gap-1 text-[0.6875rem] text-muted-foreground">
              {t('returnDocument.address.district')}
              <select
                className="h-7 rounded-md border border-border bg-card px-1 text-[0.8125rem] text-foreground"
                value={selectedKey}
                onChange={(e) => chooseDistrict(e.target.value)}
                data-return-district
              >
                {!selectedKey && (
                  <option value="">{t('returnDocument.address.districtChoose')}</option>
                )}
                {districtOptions.map((row) => (
                  <option key={row.key} value={row.key}>
                    {row.label}
                  </option>
                ))}
              </select>
              {/*
                A picker with nothing in it must SAY why: a list that is merely
                loading, or one whose read was refused, otherwise reads as *this
                address has no districts to choose*. The server's own sentence,
                through `apiErrorMessage`.
              */}
              {districts.isPending && <span>{t('grid.loading')}</span>}
              {districts.error && (
                <span className="text-danger-800">
                  {apiErrorMessage(districts.error, t('returnDocument.address.districtsFailed'))}
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-[0.6875rem] text-muted-foreground">
              {t('returnDocument.address.city')}
              <input
                className="h-7 rounded-md border border-border bg-muted px-1.5 text-[0.8125rem] text-foreground"
                value={address.cityName}
                readOnly
                data-return-city
              />
            </label>
            {ADDRESS_FIELDS.map((field) => (
              <label
                key={field}
                className={
                  'flex flex-col gap-1 text-[0.6875rem] text-muted-foreground ' +
                  // The street is the wide field in 1270's build target, and it
                  // is the longest thing the carrier reads.
                  (field === 'street1' ? 'sm:col-span-2' : '')
                }
              >
                {t(`returnDocument.address.${field}`)}
                <input
                  className="h-7 rounded-md border border-border bg-card px-1.5 text-[0.8125rem] text-foreground"
                  value={address[field]}
                  onChange={(e) => {
                    const typed = e.target.value
                    onChange((prev) => ({ ...prev, [field]: typed }))
                  }}
                  data-return-addr={field}
                />
              </label>
            ))}
          </div>
          {/*
            The one control on this screen with a PHYSICAL consequence, so it
            says what it decides: the customer may not be where the parcel was
            delivered — often that is why it is coming back.
          */}
          <p className="mt-2 mb-0 text-[0.6875rem] text-muted-foreground">
            {t('returnDocument.address.hint')}
          </p>
        </>
      )}
    </div>
  )
}
