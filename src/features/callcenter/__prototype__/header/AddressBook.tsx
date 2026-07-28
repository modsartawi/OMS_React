/* PROTOTYPE — throwaway. Ticket 175, the delivery side, corrected against CC2.
 *
 * 🚩 THE DELIVERY PICKER IS THE CALLER'S ADDRESS BOOK — addresses belong to the
 * LOYALTY CUSTOMER, and no address anywhere carries a store. Picking one takes
 * its `DistrictCode`, finds that district, and reads `TempStoreCode ?? StoreCode`
 * off the DISTRICT (`StoreSelectionVM:457-524`). The store is a property of the
 * geography, resolved at pick time — which is why a saved address can derive a
 * different store next week, and why `console/address-book.ts` refuses to derive
 * one client-side at all.
 *
 * 🚩 THE LOCATION PICKER IS ONE SEARCH BOX, NOT A CASCADE. CC2 loads
 * `AllDistricts` once — every district across every city — and searches district
 * name EN/AR **or** city name EN/AR; picking one row commits BOTH
 * (`AddressSectionVM:693-745`). Its own comment: "one upfront fetch for
 * type-anything-anytime UX". The city→district cascade is the older path beside it.
 *
 * 🚩 AN ADDRESS IS NINE CAPTURED FIELDS, not two. `BuildBusinessAddress`
 * (`AddressSectionVM:1007`) writes city, district, street 1, street 2, building,
 * two phones, the national short address and GPS — plus three constants. The
 * other sixteen `BusinessAddress` fields CC2 never fills, and neither should we.
 *
 * Full reading: `.issues/assets/175-cc2-inventory/CC2-INVENTORY.md`.
 */
import { useState } from 'react'
import {
  ADDRESS_BOOK,
  ADDRESS_LABELS,
  ALL_LOCATIONS,
  SHORT_ADDRESS_RE,
  STORES,
  addressLine,
  deriveStore,
  districtOf,
  type Location,
} from './header-mock'

export function AddressBook({ selected }: { selected?: string }) {
  const [adding, setAdding] = useState(false)
  // CC2's `ApplyAddresses`: default first, then most recently used.
  const rows = [...ADDRESS_BOOK].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault) || b.lastUsedOn.localeCompare(a.lastUsedOn),
  )

  if (adding) return <AddressEditor onBack={() => setAdding(false)} />

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
                <span className="text-sm font-medium">{e.label ?? e.labelCode}</span>
                {e.isDefault && <span className="text-[11px] text-muted-foreground">default</span>}
              </div>
              <div className="text-xs text-muted-foreground">{addressLine(e)}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                {/* The DELIVERY phone — not the loyalty mobile. A driver rings this. */}
                <span data-numeric>{e.phone1}</span>
                {e.shortAddress && (
                  <span data-numeric className="rounded bg-muted px-1.5 py-0.5 font-medium">
                    {e.shortAddress}
                  </span>
                )}
              </div>

              {blocked ? (
                <div className="mt-2 text-[11px] font-medium text-danger-800">
                  We do not deliver to {e.districtName} &mdash; no store covers it
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  delivers from{' '}
                  <span data-numeric className="font-medium text-foreground">
                    {named?.name ?? 'store'} ({store})
                  </span>
                  {d?.tempStoreCode && <span className="text-attention-800"> &middot; temporarily, normally {d.storeCode}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------ the add/edit form --- */

function AddressEditor({ onBack }: { onBack: () => void }) {
  const [loc, setLoc] = useState<Location | null>(null)
  const [picking, setPicking] = useState(true)
  const [labelCode, setLabelCode] = useState('HOME')
  const [short, setShort] = useState('')

  // CC2's rule, format-only: empty is valid, malformed is an inline error. Live
  // SPL verification is a separate integration and is not wired there either.
  const shortBad = short.trim().length > 0 && !SHORT_ADDRESS_RE.test(short.trim().toUpperCase())

  const store = loc ? (loc.tempStoreCode ?? loc.storeCode) : null
  const named = STORES.find((x) => x.code === store)

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 text-xs text-primary-800 hover:underline">
        &larr; Back to saved addresses
      </button>

      <div className="space-y-3">
        <Field label="Label">
          <div className="flex gap-1.5">
            {ADDRESS_LABELS.map((l) => (
              <button
                key={l.labelCode}
                type="button"
                onClick={() => setLabelCode(l.labelCode)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  l.labelCode === labelCode
                    ? 'border-primary-border bg-primary-050 text-primary-800'
                    : 'border-input bg-card hover:bg-accent'
                }`}
              >
                {l.en} <span className="text-muted-foreground">{l.ar}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Location" hint="one search — district or city, English or Arabic">
          {picking ? <LocationSearch onPick={(l) => { setLoc(l); setPicking(false) }} /> : null}
          {loc && !picking && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
              <div>
                <div className="text-sm">
                  {loc.districtNameEn} &middot; {loc.districtNameAr}
                </div>
                <div className="text-xs text-muted-foreground">
                  {loc.cityNameEn} &middot; {loc.cityNameAr}
                </div>
                {store ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    delivers from{' '}
                    <span data-numeric className="font-medium text-foreground">
                      {named?.name ?? 'store'} ({store})
                    </span>
                  </div>
                ) : (
                  // The hard block, at the moment of choosing.
                  <div className="mt-1 text-[11px] font-medium text-danger-800">
                    No store covers this district &mdash; we cannot deliver here
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setPicking(true)} className="text-xs text-primary-800 hover:underline">
                Change
              </button>
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Street">
            <Input placeholder="Anas Ibn Malik Rd" />
          </Field>
          <Field label="Street 2">
            <Input placeholder="Villa 22" />
          </Field>
          <Field label="Building number">
            <Input placeholder="22" />
          </Field>
          <Field label="National address" hint="4 letters + 4 digits, optional">
            <input
              value={short}
              onChange={(e) => setShort(e.target.value.toUpperCase())}
              placeholder="RIMA6904"
              data-numeric
              className={`w-full rounded-md border bg-card px-3 py-1.5 text-sm outline-none ${
                shortBad ? 'border-danger-border' : 'border-input'
              }`}
            />
            {shortBad && (
              <p className="mt-1 text-[11px] text-danger-800">
                National Address must be 4 letters followed by 4 digits (e.g. RIMA6904).
              </p>
            )}
          </Field>
          <Field label="Delivery phone" hint="the driver rings this, not the loyalty mobile">
            <Input placeholder="+966 55 214 8890" />
          </Field>
          <Field label="Second phone" hint="optional">
            <Input placeholder="—" />
          </Field>
        </div>

        <button
          type="button"
          disabled={!store || shortBad}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Save address
        </button>
      </div>
    </div>
  )
}

/**
 * CC2's unified location picker. One box, four matched fields, and picking
 * commits city AND district. Nothing renders until the agent types — the real
 * list is ~1,000 rows across ~112 cities.
 */
function LocationSearch({ onPick }: { onPick: (l: Location) => void }) {
  const [q, setQ] = useState('')
  const term = q.trim()
  const hits = term
    ? ALL_LOCATIONS.filter(
        (l) =>
          l.districtNameEn.toLowerCase().includes(term.toLowerCase()) ||
          l.districtNameAr.includes(term) ||
          l.cityNameEn.toLowerCase().includes(term.toLowerCase()) ||
          l.cityNameAr.includes(term),
      ).slice(0, 8)
    : []

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="District or city — Malqa, الملقا, Riyadh, الرياض"
        className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm outline-none"
      />
      {term && (
        <div className="mt-1 overflow-hidden rounded-md border border-border-strong bg-card">
          {hits.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nothing matches that.</p>
          ) : (
            hits.map((l) => {
              const store = l.tempStoreCode ?? l.storeCode
              return (
                <button
                  key={l.districtCode}
                  type="button"
                  onClick={() => onPick(l)}
                  className="flex w-full items-center justify-between gap-3 border-b border-divider px-3 py-2 text-start last:border-b-0 hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block text-sm">
                      {l.districtNameEn} <span className="text-muted-foreground">{l.districtNameAr}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {l.cityNameEn} &middot; {l.cityNameAr}
                    </span>
                  </span>
                  {!store && (
                    <span className="shrink-0 text-[11px] font-medium text-danger-800">no delivery store</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
        {hint && <span className="ms-1.5 font-normal text-ink-3">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Input({ placeholder }: { placeholder: string }) {
  return (
    <input
      placeholder={placeholder}
      className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm outline-none"
    />
  )
}
