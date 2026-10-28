/**
 * Ticket 619 (reconciled by 628) — an IDF master row reads its scope (insurer + its customer id, kept exactly as sent, store + store list, or an insurer master scoped
 * to a store list showing both), its name in the reader's language, and its thresholds ("hard above N, reminder
 * above M", defaulting to 4 and 1). A master with no live version yet says so (`live: null`).
 */
import { describe, expect, it } from 'vitest'
import { masterRow, rankedMasters, type IdfMaster } from './masters'

const insurer: IdfMaster = {
  masterId: 'M-1',
  kind: 'insurer',
  insurerCustomerId: '0001100336',
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
  insurerCustomerId: '0001100412',
  storeListId: 'SL-PILOT',
  nameEn: 'Tawuniya pilot',
  nameAr: '',
  hardThreshold: 4,
  reminderThreshold: 0,
  liveVersion: null,
}

describe('idf master row reads its scope and thresholds', () => {
  it('an insurer master: its customer id (leading zeros kept), no store list, its own thresholds and live version', () => {
    expect(masterRow(insurer, 'en')).toEqual({
      masterId: 'M-1',
      kind: 'insurer',
      insurerCustomerId: '0001100336',
      storeListId: null,
      name: 'Bupa general',
      hard: 5,
      reminder: 2,
      live: { number: 3, by: 'nalharbi', at: '2026-10-20T09:15:00', note: 'October refresh' },
      editable: true,
      href: '/insurance-rules/idf/masters/M-1',
    })
  })

  it('a store master: its store list, no insurer, thresholds default to 4 and 1, no live version', () => {
    expect(masterRow(store, 'en')).toEqual({
      masterId: 'M-2',
      kind: 'store',
      insurerCustomerId: null,
      storeListId: 'SL-OPS',
      name: 'Operation pharmacies',
      hard: 4,
      reminder: 1,
      live: null,
      editable: true,
      href: '/insurance-rules/idf/masters/M-2',
    })
  })

  it('an insurer master scoped to a store list shows both; a zero reminder threshold is kept', () => {
    const row = masterRow(insurerOnList, 'en')
    expect([row.insurerCustomerId, row.storeListId, row.hard, row.reminder]).toEqual(['0001100412', 'SL-PILOT', 4, 0])
  })

  it('the name in the reader\'s language, falling back to English when Arabic is blank', () => {
    expect(masterRow(insurer, 'ar').name).toBe('بوبا العام')
    expect(masterRow(store, 'ar-SA').name).toBe('صيدليات التشغيل')
    expect(masterRow(insurerOnList, 'ar').name).toBe('Tawuniya pilot')
  })
})

/** Ticket 647 — the general master (tier 4) is listed but is not a ranking the list edits. */
const general: IdfMaster = { masterId: 'general', kind: 'general', nameEn: 'General', nameAr: 'عام', liveVersion: null }

describe('the general master in the masters list (647)', () => {
  it('the list renders a general row without version, thresholds or edit', () => {
    expect(masterRow(general, 'ar')).toEqual({
      masterId: 'general',
      kind: 'general',
      insurerCustomerId: null,
      storeListId: null,
      name: 'عام',
      hard: null,
      reminder: null,
      live: null,
      editable: false,
      href: '/insurance-rules/idf/general',
    })
  })
  it('even a general row sent with thresholds or a version draws none', () => {
    const row = masterRow({ ...general, hardThreshold: 4, reminderThreshold: 1, liveVersion: insurer.liveVersion }, 'en')
    expect([row.hard, row.reminder, row.live, row.editable]).toEqual([null, null, null, false])
  })
  it('a master id with a slash is encoded in its link', () => {
    expect(masterRow({ ...store, masterId: 'M/2 x' }, 'en').href).toBe('/insurance-rules/idf/masters/M%2F2%20x')
  })
  it('pickers of a ranking (events, exceptions) leave the general master out', () => {
    expect(rankedMasters([insurer, general, store]).map((m) => m.masterId)).toEqual(['M-1', 'M-2'])
  })
})
