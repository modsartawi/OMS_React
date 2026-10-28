/**
 * Ticket 619 — an IDF master row reads its scope (insurer + payer, store + store list, or an insurer master scoped
 * to a store list showing both), its name in the reader's language, and its thresholds ("hard above N, reminder
 * above M", defaulting to 4 and 1). A master with no live version yet says so (`live: null`).
 */
import { describe, expect, it } from 'vitest'
import { masterRow, type IdfMaster } from './masters'

const insurer: IdfMaster = {
  masterId: 'M-1',
  kind: 'insurer',
  payerCode: 'BUPA',
  nameEn: 'Bupa general',
  nameAr: 'بوبا العام',
  hardThreshold: 5,
  reminderThreshold: 2,
  liveVersion: { versionId: 'V-11', number: 3, by: 'nalharbi', at: '2026-10-20T09:15:00', note: 'October refresh' },
}
const store: IdfMaster = {
  masterId: 'M-2',
  kind: 'store',
  storeListId: 'SL-OPS',
  nameEn: 'Operation pharmacies',
  nameAr: 'صيدليات التشغيل',
  hardThreshold: null,
  reminderThreshold: null,
  liveVersion: null,
}
const insurerOnList: IdfMaster = {
  masterId: 'M-3',
  kind: 'insurer',
  payerCode: 'TAWUNIYA',
  storeListId: 'SL-PILOT',
  nameEn: 'Tawuniya pilot',
  nameAr: '',
  hardThreshold: 4,
  reminderThreshold: 0,
  liveVersion: null,
}

describe('idf master row reads its scope and thresholds', () => {
  it('an insurer master: its payer, no store list, its own thresholds and live version', () => {
    expect(masterRow(insurer, 'en')).toEqual({
      masterId: 'M-1',
      kind: 'insurer',
      payerCode: 'BUPA',
      storeListId: null,
      name: 'Bupa general',
      hard: 5,
      reminder: 2,
      live: { number: 3, by: 'nalharbi', at: '2026-10-20T09:15:00', note: 'October refresh' },
    })
  })

  it('a store master: its store list, no payer, thresholds default to 4 and 1, no live version', () => {
    expect(masterRow(store, 'en')).toEqual({
      masterId: 'M-2',
      kind: 'store',
      payerCode: null,
      storeListId: 'SL-OPS',
      name: 'Operation pharmacies',
      hard: 4,
      reminder: 1,
      live: null,
    })
  })

  it('an insurer master scoped to a store list shows both; a zero reminder threshold is kept', () => {
    const row = masterRow(insurerOnList, 'en')
    expect([row.payerCode, row.storeListId, row.hard, row.reminder]).toEqual(['TAWUNIYA', 'SL-PILOT', 4, 0])
  })

  it('the name in the reader\'s language, falling back to English when Arabic is blank', () => {
    expect(masterRow(insurer, 'ar').name).toBe('بوبا العام')
    expect(masterRow(store, 'ar-SA').name).toBe('صيدليات التشغيل')
    expect(masterRow(insurerOnList, 'ar').name).toBe('Tawuniya pilot')
  })
})
