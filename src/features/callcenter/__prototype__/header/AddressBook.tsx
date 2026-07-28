/* PROTOTYPE — throwaway. Ticket 175, the delivery side.
 *
 * 🚩 THE DELIVERY PICKER IS THE CALLER'S ADDRESS BOOK. Not a geography picker —
 * that was this prototype's own mistake, corrected against CC2 and against what
 * tickets 165/166 already shipped.
 *
 * CC2's `AddressSectionVM` holds the customer's saved addresses sorted
 * `IsDefault desc, LastUsedOn desc`, surfaced as tiles with a Manage-Addresses
 * overflow. The city/district cascade is `AddressEditingForm` — the ADD path,
 * reached only when the caller's address is not already on file. An agent on a
 * repeat caller should never see a city list at all.
 *
 * The derived store is shown as the CONSEQUENCE of a row, never computed here:
 * `console/address-book.ts` is explicit that the district→store rule is the
 * server's, and a second client-side derivation is how the console and the
 * engine start to disagree. What this draws is what the projection would answer.
 */
import { useState } from 'react'
import {
  ADDRESS_BOOK,
  CITY_COUNT,
  DELIVERY_CITIES,
  STORES,
  deriveStore,
  districtOf,
  type City,
} from './header-mock'

export function AddressBook({ selected }: { selected?: string }) {
  const [adding, setAdding] = useState(false)
  const rows = [...ADDRESS_BOOK].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault) || b.lastUsedOn.localeCompare(a.lastUsedOn),
  )

  if (adding) return <NewAddressCascade onBack={() => setAdding(false)} />

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">The caller&rsquo;s saved addresses</span>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-xs font-medium text-primary-800 hover:underline"
        >
          + Add a new address
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {rows.map((e) => {
          const d = districtOf(e)
          const store = d ? deriveStore(d) : null
          // OWNER RULING, 2026-07-28: no store AND no temp store is a HARD
          // BLOCK. The row stays visible and unpickable — a caller asking
          // "what about my office?" needs an answer, and a hidden row gives
          // them none.
          const blocked = !store
          const named = STORES.find((x) => x.code === store)
          return (
            <button
              key={e.addressNumber}
              type="button"
              disabled={blocked}
              className={`rounded-md border p-3 text-start ${
                blocked
                  ? 'cursor-not-allowed border-danger-border bg-danger-050'
                  : selected === e.addressNumber
                    ? 'border-primary-border bg-primary-050 ring-1 ring-primary-border'
                    : 'border-input bg-card hover:bg-accent'
              }`}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-sm font-medium">{e.label ?? 'Address'}</span>
                {e.isDefault && <span className="text-[11px] text-muted-foreground">default</span>}
              </div>
              <div className="text-xs text-muted-foreground">{e.line}</div>
              <div className="text-xs text-muted-foreground">
                {e.districtName} · {e.cityName}
              </div>

              {blocked ? (
                <div className="mt-2 text-[11px] font-medium text-danger-800">
                  We do not deliver to {e.districtName} — no store covers it
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  delivers from{' '}
                  <span data-numeric className="font-medium text-foreground">
                    {named?.name ?? 'store'} ({store})
                  </span>
                  {d?.tempStoreCode && <span className="text-attention-800"> · temporarily, normally {d.storeCode}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The ADD path — and the reason the city step is a typeahead rather than a
 * dropdown: production carries ~112 cities, which fills the screen and cannot be
 * eyeballed. Same control as the store search, for the same reason.
 */
function NewAddressCascade({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState('')
  const [city, setCity] = useState<City | null>(null)

  const hits = q.trim()
    ? DELIVERY_CITIES.filter((c) => c.cityName.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : []

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-2 text-xs text-primary-800 hover:underline">
        &larr; Back to saved addresses
      </button>

      {!city ? (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            City <span className="text-ink-3">&mdash; {CITY_COUNT} of them, so type rather than scroll</span>
          </label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Start typing a city"
            className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm outline-none"
          />
          {q.trim() && (
            <div className="mt-1 overflow-hidden rounded-md border border-border-strong bg-card">
              {hits.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No city matches that.</p>
              ) : (
                hits.map((c) => (
                  <button
                    key={c.cityCode}
                    type="button"
                    onClick={() => setCity(c)}
                    className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-accent"
                  >
                    <span>{c.cityName}</span>
                    <span data-numeric className="text-xs text-muted-foreground">
                      {c.districts.length} districts
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium">{city.cityName}</span>
            <button type="button" onClick={() => setCity(null)} className="text-primary-800 hover:underline">
              change city
            </button>
          </div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">District</label>
          <div className="overflow-hidden rounded-md border border-border">
            {city.districts.map((d) => {
              const store = deriveStore(d)
              const named = STORES.find((x) => x.code === store)
              return (
                <button
                  key={d.districtCode}
                  type="button"
                  disabled={!store}
                  className={`flex w-full items-center justify-between gap-3 border-b border-divider px-3 py-2 text-start last:border-b-0 ${
                    store ? 'hover:bg-accent' : 'cursor-not-allowed bg-danger-050'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm">{d.districtName}</span>
                    <span data-numeric className="block text-xs text-muted-foreground">
                      {d.districtCode}
                    </span>
                  </span>
                  {store ? (
                    <span className="text-end text-[11px] text-muted-foreground">
                      delivers from{' '}
                      <span data-numeric className="font-medium text-foreground">
                        {named?.name ?? 'store'} ({store})
                      </span>
                    </span>
                  ) : (
                    // The hard block, stated when the agent is choosing rather
                    // than discovered at submit.
                    <span className="text-end text-[11px] font-medium text-danger-800">No store covers this district</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
