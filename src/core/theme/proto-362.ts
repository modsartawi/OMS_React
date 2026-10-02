/* PROTOTYPE 362 — throwaway (branch prototype/362-ops-console-tokens).
 *
 * Question: which exact Ops Console tokens, row height and grid text size?
 * Three palettes on the REAL app, switched by `html[data-palette]`:
 *   steel — today's POS system (baseline, no attribute)
 *   far   — A, "Far as drawn": neutral greys, cobalt accent, gold cursor bar
 *   navy  — B, "Navy-led": navy-tinted neutrals, navy-lifted accent, navy bar in light
 * plus rows 24/26/28 and grid text 12/12.5/13. Light/dark is the app's own toggle.
 *
 * Every setting lives in localStorage and a change RELOADS, because the grid
 * theme + row height are read once at module load (as production reads them).
 * `?palette=&rows=&size=&stub=` in the URL override and persist — so a capture
 * script can drive it.
 *
 * `stub=1` installs a fetch shim with fictional envelopes, because SIS.Api was
 * down when this was built. It patches window.fetch — prototype only.
 */
export type Palette = 'steel' | 'far' | 'navy'
export type ProtoSettings = { palette: Palette; rows: number; size: number; stub: boolean }

const KEY = 'proto362'
const DEFAULTS: ProtoSettings = { palette: 'far', rows: 26, size: 12, stub: false }

function read(): ProtoSettings {
  let s: ProtoSettings = { ...DEFAULTS }
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) s = { ...s, ...(JSON.parse(stored) as Partial<ProtoSettings>) }
  } catch {
    /* prototype: ignore */
  }
  const q = new URLSearchParams(location.search)
  const palette = q.get('palette')
  if (palette === 'steel' || palette === 'far' || palette === 'navy') s.palette = palette
  if (q.get('rows')) s.rows = Number(q.get('rows'))
  if (q.get('size')) s.size = Number(q.get('size'))
  if (q.get('stub')) s.stub = q.get('stub') === '1'
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* prototype: ignore */
  }
  return s
}

export const proto: ProtoSettings = import.meta.env.DEV ? read() : { ...DEFAULTS, palette: 'steel' }

if (proto.palette === 'steel') delete document.documentElement.dataset.palette
else document.documentElement.dataset.palette = proto.palette

export function setProto(next: Partial<ProtoSettings>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...proto, ...next }))
  } catch {
    /* prototype: ignore */
  }
  const url = new URL(location.href)
  for (const k of ['palette', 'rows', 'size', 'stub']) url.searchParams.delete(k)
  location.replace(url.toString())
}

// --- stub data (fictional) ----------------------------------------------------

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

const NAMES = ['Noura Al-Harbi', 'Faisal Qahtani', 'Reem Al-Otaibi', 'Omar Zahrani', 'Lama Shehri', 'Sultan Dosari']
const SLOTS = ['08:00 - 10:00', '10:00 - 12:00', '12:00 - 14:00', '16:00 - 18:00', '18:00 - 20:00']
const CITIES = ['Riyadh', 'Jeddah', 'Dammam', 'Khobar']
const DISTRICTS = ['Al Olaya', 'Al Malaz', 'An Nakheel', 'Ar Rawdah']

function delivery(i: number) {
  const net = Math.round((35 + ((i * 73.37) % 900)) * 100) / 100
  const paid = i % 4 === 0 ? 0 : net
  const day = String(1 + (i % 28)).padStart(2, '0')
  return {
    deliveryNo: String(80001240 - i),
    documentNo: String(1000000393 + i * 7),
    deliveryDocumentType: i % 5 === 0 ? 'LR' : 'LF',
    orderNo: String(900120 + i * 3),
    storeCode: ['1001', '1002', '1017', '2040'][i % 4],
    documentDate: `2026-09-${day}T00:00:00`,
    deliveryType: i % 3 === 0 ? 'E' : 'P',
    documentType: ['CLCN', 'WEBO', 'APPO'][i % 3],
    documentSource: ['W', 'A', 'C'][i % 3],
    entryTime: `2026-09-${day}T${String(8 + (i % 12)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00`,
    isActiveInStore: i % 7 !== 0,
    timeSlotDescription: SLOTS[i % SLOTS.length],
    customerName: NAMES[i % NAMES.length],
    customerPhone: `05${String(10000000 + i * 1373).slice(0, 8)}`,
    netTotal: net,
    paidAmount: paid,
    deliveryFees: i % 3 === 0 ? 25 : 10,
    amountDue: Math.round((net - paid) * 100) / 100,
    failedJobsCount: i % 9 === 2 ? 1 + (i % 3) : 0,
    rescheduled: i % 6 === 1,
    courierCode: ['JAH', 'MRS', 'CAR'][i % 3],
    courierDriverName: i % 2 ? 'Driver ' + (100 + i) : '',
    lastAction: ['X', 'R', 'D', 'C'][i % 4],
    readyStatus: i % 2 ? 'Y' : 'N',
    deliveryStatus: ['A', 'B', 'C'][i % 3],
    cityName: CITIES[i % CITIES.length],
    districtName: DISTRICTS[i % DISTRICTS.length],
    isExpressDelivery: i % 3 === 0,
    note: i % 5 === 0 ? 'Call before arrival' : '',
  }
}

const DOCUMENT = {
  documentNo: '1000000393',
  deliveryNo: '80001240',
  storeCode: '1001',
  documentType: 'CLCN',
  documentTypeDescription: 'Call Center',
  documentCategory: 'O',
  deliveryType: 'P',
  customerName: 'Noura Al-Harbi',
  lines: [
    { itemNumber: '000010', materialCode: '100234', materialDescription: 'Panadol Extra 500mg 24s', quantity: 2, netValue: 30 },
    { itemNumber: '000020', materialCode: '100877', materialDescription: 'Vitamin C 1000mg Effervescent', quantity: 1, netValue: 90.5 },
  ],
  conditions: [],
  status: { overallStatus: 'A', lastAction: 'X', lastActionDescription: 'Created' },
}

function stubFor(path: string): Response {
  if (path === 'Auth/Me')
    return envelope({ authenticated: true, userId: 'proto', displayName: 'Prototype 362', currentStoreCode: '1001' })
  if (path === 'SdDocumentWeb/DeliveryDocumentList') return envelope(Array.from({ length: 40 }, (_, i) => delivery(i)))
  if (/^SdDocumentWeb\/Document\/[^/]+\/(Outbox|Logs)$/.test(path)) return envelope([])
  if (/^SdDocumentWeb\/(Document|Delivery)\/[^/]+$/.test(path)) return envelope(DOCUMENT)
  if (/^SdDocument\/(DocumentTypes|DocumentSources|DeliveryDocumentTypes)$/.test(path)) return envelope([])
  if (/Access$/.test(path)) return envelope({ screenAllowed: true, allowed: true, canOpenList: true, canOpenDetail: true })
  // PROTOTYPE 373 — the three header-section reads, so the REAL StorePicker,
  // SlotPicker and SourceForm open inside the sentence prototype.
  if (path === 'SdDocument/StoreDetails')
    return envelope([
      ['1001', 'Hail', 'King AbdelAziz Road'],
      ['1101', 'Riyadh', 'Al Malqa · Anas Ibn Malik Rd'],
      ['1204', 'Riyadh', 'Al Yasmin · Al Thumamah Rd'],
      ['2040', 'Jeddah', 'Ar Rawdah · Prince Sultan St'],
    ].map(([storeCode, city, storeAddress]) => ({
      storeCode, city, region: city, storeAddress, deliveryStore: true, latitude: '', longitude: '', wasfatyRefill: false,
    })))
  if (path.startsWith('Slots/AvailableSlots/'))
    return envelope({
      slots: [['2026/10/02', 'FRIDAY'], ['2026/10/03', 'SATURDAY']].map(([date, day], d) => ({
        day, date, fullDay: `${date} ${day}`,
        times: [['15:00', '18:00'], ['18:00', '21:00'], ['21:00', '23:00']].map(([f, t], i) => ({
          time: `${f} - ${t}`, status: !(d === 0 && i === 0), slotId: `2026-10-0${2 + d}#S${i + 2}`,
          slotFrom: `${date.replace(/\//g, '-')}T${f}:00`, slotTo: `${date.replace(/\//g, '-')}T${t}:00`,
        })),
      })),
    })
  if (path === 'CallCenterWeb/MyDocumentSources')
    return envelope([
      { documentSource: 'CLCN', description: 'Call center', documentSourceCategory: 'C', isDefault: true },
      { documentSource: 'WHTS', description: 'WhatsApp', documentSourceCategory: 'C', isDefault: false },
    ])
  // PROTOTYPE 379 — the caller lookup + signup, so the rail and the caller bar
  // can find, miss, enrol and attach offline. A number ending 0000 is a miss.
  if (path.startsWith('CallCenterWeb/MemberByMobile/')) {
    const mobile = decodeURIComponent(path.slice('CallCenterWeb/MemberByMobile/'.length))
    return envelope(mobile.endsWith('0000') ? null : PROTO_MEMBER(mobile))
  }
  if (path === 'CallCenterWeb/SignUpByBranch') return envelope(null)
  if (path === 'CallCenterWeb/ConfirmSignUpByBranch')
    return envelope({ loyId: 'C-1000000991', mobile: '966500000000', fullName: 'New member', tier: 'Blue', pointsBalance: 0, email: null })
  return envelope({})
}

const PROTO_MEMBER = (mobile: string) => ({
  loyId: 'C-1000000034',
  mobile,
  fullName: 'Fatimah Al-Otaibi',
  tier: 'Gold',
  pointsBalance: 4120,
  email: 'f.otaibi@example.com',
})

if (import.meta.env.DEV && proto.stub) {
  const real = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const at = url.indexOf('/api/')
    if (at === -1) return real(input, init)
    return stubFor(url.slice(at + 5).split('?')[0])
  }
}
