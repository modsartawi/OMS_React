import { describe, expect, it } from 'vitest'

import type { IDocInspectorDocument } from '@/core/models/idoc-inspector'
import { fallbackFileName, idocTypesPresent } from './download'

const doc = (over: Partial<IDocInspectorDocument> = {}): IDocInspectorDocument => ({
  iDocType: 'AGG',
  receiptNumber: '4211900771',
  pharmacyId: '0421',
  exportState: 'exported',
  isHeld: false,
  batch: null,
  lines: [],
  payments: [],
  fiItems: [],
  ...over,
})

describe('idocTypesPresent', () => {
  it('oneDownloadButtonAppearsPerIDocTypePresent — one entry per DISTINCT type', () => {
    expect(
      idocTypesPresent([doc({ iDocType: 'AGG' }), doc({ iDocType: 'FI' })]),
    ).toEqual(['AGG', 'FI'])
  })

  it('collapses two documents of the SAME type into one download', () => {
    // 🔑 The rail is per DOCUMENT and the download is per TYPE. A transaction
    // that split into two aggregated documents still hands over one file, so two
    // buttons here would offer the same file twice under one name.
    expect(
      idocTypesPresent([
        doc({ iDocType: 'AGG', receiptNumber: '1' }),
        doc({ iDocType: 'AGG', receiptNumber: '2' }),
        doc({ iDocType: 'FI' }),
      ]),
    ).toEqual(['AGG', 'FI'])
  })

  it('keeps the order the documents arrived in', () => {
    expect(idocTypesPresent([doc({ iDocType: 'FI' }), doc({ iDocType: 'AGG' })])).toEqual([
      'FI',
      'AGG',
    ])
  })

  it('noDownloadButtonAppearsWhenNoDocumentsExist', () => {
    expect(idocTypesPresent([])).toEqual([])
    expect(idocTypesPresent(null)).toEqual([])
    expect(idocTypesPresent(undefined)).toEqual([])
  })

  it('anUnbatchedDocumentStillOffersItsDownload — export state is not a filter', () => {
    // Export state changes what the consultant is TOLD, not what they can take:
    // all three states yield the same file and there is no refusal.
    const types = idocTypesPresent([
      doc({ iDocType: 'AGG', exportState: 'exported' }),
      doc({ iDocType: 'SAPR', exportState: 'not-batched', batch: null }),
      doc({ iDocType: 'FI', exportState: 'batched-not-exported' }),
    ])
    expect(types).toEqual(['AGG', 'SAPR', 'FI'])
  })

  it('a HELD document still offers its download', () => {
    expect(idocTypesPresent([doc({ iDocType: 'AGG', isHeld: true })])).toEqual(['AGG'])
  })

  it('drops a blank type rather than offering a button the server must refuse', () => {
    // ⚠️ `idocType` is REQUIRED on the wire, so a blank one is `IDOC_TYPE_REQUIRED`
    // — an enveloped failure the screen would have offered the user itself.
    expect(idocTypesPresent([doc({ iDocType: '' }), doc({ iDocType: '  ' }), doc()])).toEqual([
      'AGG',
    ])
  })

  it('trims a padded type so it cannot split one type into two buttons', () => {
    expect(idocTypesPresent([doc({ iDocType: ' AGG ' }), doc({ iDocType: 'AGG' })])).toEqual(['AGG'])
  })
})

describe('fallbackFileName', () => {
  const key = { storeCode: 'S042', trxNumber: 'TRX99881' }

  it('mirrors the server name — type, store, transaction and a LOCAL stamp', () => {
    // Constructed from local parts, so the expectation is the local clock's own
    // reading rather than a UTC string this test would have to convert.
    const takenAt = new Date(2026, 7, 30, 14, 32)
    expect(fallbackFileName(key, 'AGG', takenAt)).toBe('idoc_AGG_S042_TRX99881_20260830-1432.xml')
  })

  it('pads every part of the stamp to its width', () => {
    expect(fallbackFileName(key, 'FI', new Date(2026, 0, 2, 3, 4))).toBe(
      'idoc_FI_S042_TRX99881_20260102-0304.xml',
    )
  })

  it('replaces anything a file name cannot hold', () => {
    expect(
      fallbackFileName({ storeCode: 'S/042', trxNumber: 'A B' }, 'AG G', new Date(2026, 7, 30, 14, 32)),
    ).toBe('idoc_AG_G_S_042_A_B_20260830-1432.xml')
  })

  it('⚠️ passes a NON-ASCII letter, because the server’s rule is IsLetterOrDigit', () => {
    // An ASCII-only class here would sanitise a non-Latin key differently from
    // the server and produce the two-different-looking-files outcome the mirror
    // exists to prevent.
    expect(
      fallbackFileName({ storeCode: 'مكة', trxNumber: '٠٠١' }, 'AGG', new Date(2026, 7, 30, 14, 32)),
    ).toBe('idoc_AGG_مكة_٠٠١_20260830-1432.xml')
  })

  it('keeps a dot and a hyphen, which a store code may legitimately carry', () => {
    expect(
      fallbackFileName({ storeCode: 'S-042.1', trxNumber: '001' }, 'AGG', new Date(2026, 7, 30, 14, 32)),
    ).toBe('idoc_AGG_S-042.1_001_20260830-1432.xml')
  })
})
