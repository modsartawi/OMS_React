import { describe, expect, it } from 'vitest'
import type { StockConsoleScan } from '@/core/models/stock-console'
import { applyScan, expiryMark, scanCode, scanFrameRead, scannedList, type ScanRead } from './scan'
import { frameView, searchFromParams, wireParams, type ListSpec } from './search'

const LIST: ListSpec = { filters: ['all', 'withStock'], keep: ['tab'] }
const shown = (qs: string) => searchFromParams(new URLSearchParams(qs), LIST)

const scan = (over: Partial<StockConsoleScan> = {}): StockConsoleScan => ({
  kind: 'Gs1',
  itemFound: true,
  item: '1001',
  nameEn: 'Panadol 500',
  nameAr: 'بنادول ٥٠٠',
  gtin: '06281100012345',
  lot: 'L77',
  expiry: '2027-06-30',
  expiryDayKnown: true,
  serial: 'S123',
  ...over,
})

describe('a scan answer read into the search', () => {
  it('a GS1 code with a known item fills the item and batch boxes and builds the chips', () => {
    expect(applyScan(scan())).toEqual({
      search: true,
      item: '1001',
      batch: 'L77',
      note: null,
      chips: [
        { kind: 'item', value: '1001', nameEn: 'Panadol 500', nameAr: 'بنادول ٥٠٠' },
        { kind: 'gtin', value: '06281100012345' },
        { kind: 'lot', value: 'L77' },
        { kind: 'expiry', value: '2027-06-30' },
        { kind: 'serial', value: 'S123' },
      ],
    })
  })

  it('an unknown GTIN searches the lot alone as a vendor batch and says the item was not found', () => {
    const read = applyScan(scan({ itemFound: false, item: null, nameEn: null, nameAr: null }))
    expect(read).toEqual({
      search: true,
      item: '',
      batch: 'L77',
      note: 'itemNotFound',
      chips: [
        { kind: 'gtin', value: '06281100012345' },
        { kind: 'lot', value: 'L77' },
        { kind: 'expiry', value: '2027-06-30' },
        { kind: 'serial', value: 'S123' },
      ],
    })
  })

  it('an unknown GTIN with no lot has nothing to search, and says the item was not found and nothing searched', () => {
    const read = applyScan(scan({ itemFound: false, item: null, lot: null }))
    expect([read.search, read.item, read.batch, read.note]).toEqual([false, '', '', 'itemNotFoundNoLot'])
  })

  it('a plain barcode fills the item only, with no batch', () => {
    const read = applyScan(scan({ kind: 'Barcode', gtin: null, lot: null, expiry: null, serial: null }))
    expect(read).toEqual({
      search: true,
      item: '1001',
      batch: '',
      note: null,
      chips: [{ kind: 'item', value: '1001', nameEn: 'Panadol 500', nameAr: 'بنادول ٥٠٠' }],
    })
  })

  it('a plain barcode never searches a batch, whatever else the answer carries', () => {
    expect(applyScan(scan({ kind: 'Barcode' })).batch).toBe('')
  })

  it('a code we do not know searches nothing and says so', () => {
    const blank = { itemFound: false, item: null, nameEn: null, nameAr: null, gtin: null, lot: null, expiry: null, serial: null }
    expect(applyScan(scan({ kind: 'Unknown', ...blank }))).toEqual({
      search: false,
      item: '',
      batch: '',
      note: 'unknownCode',
      chips: [],
    })
  })

  it('an expiry whose day the code does not know (day 00) shows as its month', () => {
    const read = applyScan(scan({ expiry: '2027-06-01', expiryDayKnown: false }))
    expect(read.chips.find((c) => c.kind === 'expiry')).toEqual({ kind: 'expiry', value: '2027-06' })
  })

  it('an expiry sent with a midnight time shows as its day', () => {
    const read = applyScan(scan({ expiry: '2027-06-30T00:00:00' }))
    expect(read.chips.find((c) => c.kind === 'expiry')).toEqual({ kind: 'expiry', value: '2027-06-30' })
  })

  it('a kind we have not heard of is a code we do not know', () => {
    expect(applyScan(scan({ kind: 'Qr' })).note).toBe('unknownCode')
    expect(applyScan(scan({ kind: 'Qr' })).search).toBe(false)
  })
})

describe('the list a scan searches', () => {
  it('a link that carries the code and says a search ran reads the scan again', () => {
    expect(scanCode(shown('tab=batches&gs1=%2801%2906281100012345%2810%29L77&ran=1'))).toBe('(01)06281100012345(10)L77')
  })

  it('no scan is read before a search ran, or with the GS1 box empty', () => {
    expect(scanCode(shown('gs1=0101'))).toBe('')
    expect(scanCode(shown('item=1001&ran=1'))).toBe('')
  })

  it('with the GS1 box empty the list reads its own boxes', () => {
    const state = shown('item=1001&batch=B1&ran=1')
    expect(scannedList(state, undefined)).toBe(state)
  })

  it('the list waits for the scan’s answer', () => {
    expect(scannedList(shown('gs1=0101&ran=1'), undefined).ran).toBe(false)
  })

  it('the GS1 box wins: the list searches the scan’s item and lot, not the typed boxes', () => {
    const list = scannedList(shown('item=9999&batch=X&gs1=0101&filter=withStock&ran=1'), scan())
    expect(wireParams(list)).toEqual({ item: '1001', batch: 'L77', filter: 'withStock', page: 1, size: 25 })
    expect(list.ran).toBe(true)
  })

  it('an unknown GTIN searches the lot alone', () => {
    const list = scannedList(shown('item=9999&gs1=0101&ran=1'), scan({ itemFound: false, item: null }))
    expect([list.item, list.batch, list.ran]).toEqual(['', 'L77', true])
  })

  it('a code we do not know reads no list', () => {
    expect(scannedList(shown('gs1=zzz&ran=1'), scan({ kind: 'Unknown' })).ran).toBe(false)
  })
})

describe('what the frame draws while a scan is read', () => {
  const refetchList = () => 'list'
  const refetchScan = () => 'scan'
  const list = { isPending: false, isError: false, error: null, data: { total: 3 }, isFetching: false, isPlaceholderData: false, refetch: refetchList }
  const scanRead = (over: Partial<ScanRead> = {}): ScanRead => ({
    isError: false,
    error: null,
    data: scan(),
    isFetching: false,
    refetch: refetchScan,
    ...over,
  })
  const view = (qs: string, s: ScanRead) => {
    const read = scanFrameRead(shown(qs), s, list)
    return [frameView(shown(qs), read), read.stopped]
  }

  it('with the GS1 box empty the list’s read is drawn as it is', () => {
    expect(scanFrameRead(shown('item=1&ran=1'), scanRead({ data: undefined }), list)).toEqual({ ...list, stopped: false })
  })

  it('while the scan reads, the frame is loading', () => {
    expect(view('gs1=0101&ran=1', scanRead({ data: undefined, isFetching: true }))).toEqual(['loading', false])
  })

  it('a refused scan is drawn as the refusal, and Search again reads the scan again', () => {
    const err = new Error('busy')
    const read = scanFrameRead(shown('gs1=0101&ran=1'), scanRead({ data: undefined, isError: true, error: err }), list)
    expect([frameView(shown('gs1=0101&ran=1'), read), read.error, read.refetch()]).toEqual(['refused', err, 'scan'])
  })

  it('a code we do not know stops the frame: no rows, no empty sentence, only its line', () => {
    expect(view('gs1=zzz&ran=1', scanRead({ data: scan({ kind: 'Unknown' }) }))).toEqual(['loading', true])
  })

  it('once the scan answered, the list’s read is drawn', () => {
    expect(view('gs1=0101&ran=1', scanRead())).toEqual(['rows', false])
  })
})

describe('a batch row’s expiry against the scan’s', () => {
  it('the same day matches the scan', () => {
    expect(expiryMark('2027-06-30', scan())).toEqual({ mark: 'matches', scan: '2027-06-30' })
  })

  it('a different day says what the scan says', () => {
    expect(expiryMark('2027-07-31', scan())).toEqual({ mark: 'differs', scan: '2027-06-30' })
  })

  it('a row expiry sent with a midnight time is compared as its day', () => {
    expect(expiryMark('2027-06-30T00:00:00', scan()).mark).toBe('matches')
  })

  it('when the code’s day is not known (day 00), any day of the same month matches', () => {
    const month = scan({ expiry: '2027-06-01', expiryDayKnown: false })
    expect(expiryMark('2027-06-30', month)).toEqual({ mark: 'matches', scan: '2027-06' })
    expect(expiryMark('2027-07-01', month)).toEqual({ mark: 'differs', scan: '2027-06' })
  })

  it('no mark when the row or the scan has no expiry, or there is no scan', () => {
    expect(expiryMark(null, scan()).mark).toBe('none')
    expect(expiryMark('2027-06-30', scan({ expiry: null })).mark).toBe('none')
    expect(expiryMark('2027-06-30', null).mark).toBe('none')
  })
})
