/**
 * The Delivery inspector's sections (ticket 397, spec 380 L13; ruling 367 §1–§2): built from the
 * list row alone, in 367's order, and never the handover OTP.
 */
import { describe, expect, it } from 'vitest'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { inspectorView } from './inspector-model'

const OTP = '482913'

const ROW: DeliveryDocumentModel = {
  deliveryNo: '80001294 ',
  documentNo: '1000000435',
  deliveryDocumentType: 'Forward',
  orderNo: '900155',
  storeCode: '1017',
  documentDate: '2026-10-02T00:00:00',
  deliveryType: 'Delivery  ',
  documentType: 'CLCN ',
  documentSource: 'Web ',
  entryTime: '2026-10-02T14:42:00',
  isActiveInStore: false,
  timeSlotDescription: '10am - 12 pm',
  timeSlotDay: 'Thursday',
  deliveryScheduleFromTime: '2026-10-02T10:00:00',
  deliveryScheduleToTime: '2026-10-02T12:00:00',
  customerPhone: '0510008238',
  customerName: 'Noura Al-Harbi',
  rescheduled: true,
  rescheduledUser: 'msartawi',
  rescheduledTime: '2026-10-02T15:30:00',
  rescheduledReason: 'Customer asked',
  rescheduledReasonCategory: 'C',
  netTotal: 475.2,
  paidAmount: 400,
  deliveryFees: 25,
  amountDue: 72.5,
  courierCode: 'JAH',
  courierDriverId: 'D-118',
  courierDriverName: 'Khalid N.',
  courierDriverPhone: '0559990000',
  customerOtp: OTP,
  lastAction: 'DRSC',
  readyStatus: 'R',
  clearStatus: '',
  deliveryStatus: '',
  closeStatus: '',
  reasonDescription: '',
  outForDeliveryTime: '',
  actualDeliveryTime: '',
  validTo: '',
  cityName: 'Riyadh',
  districtName: 'Al Olaya',
  street1: 'King Fahd Rd 12',
  note: 'Gate 3, call on arrival',
  isExpressDelivery: true,
  expressCourierId: '',
  documentReason: '',
  failedJobsCount: 2,
}

const row = (over: Partial<DeliveryDocumentModel> = {}): DeliveryDocumentModel => ({ ...ROW, ...over })

describe('inspectorSectionsFromRowOnly', () => {
  it('the header: the three numbers, where it stands, its tags and the due tag', () => {
    const view = inspectorView(row())
    expect(view.header).toEqual({
      deliveryNo: '80001294',
      orderNo: '900155',
      documentNo: '1000000435',
      status: 'ready',
      documentType: 'CLCN',
      deliveryType: 'Delivery',
      dawaaNow: true,
      due: { paid: false, amount: '72.50' },
    })
    expect(inspectorView(row({ amountDue: 0, isExpressDelivery: false })).header).toMatchObject({
      dawaaNow: false,
      due: { paid: true },
    })
  })

  it('the timeline is the shared derivation’s, with the slot window on the next step', () => {
    const { steps } = inspectorView(row())
    expect(steps.map((s) => [s.key, s.state, s.time, s.expectedWindow])).toEqual([
      ['created', 'done', '2026-10-02T14:42:00', null],
      ['ready', 'current', null, null],
      ['out', 'next', null, '10:00–12:00'],
      ['delivered', 'later', null, null],
    ])
    expect(steps[0].marker).toEqual({ kind: 'rescheduled', time: '2026-10-02T15:30:00' })
  })

  it('the failed-jobs banner only when failedJobsCount > 0, and it carries nothing but the count', () => {
    expect(inspectorView(row()).failedJobs).toBe(2)
    expect(inspectorView(row({ failedJobsCount: 0 })).failedJobs).toBeNull()
    expect(inspectorView(row({ failedJobsCount: -1 })).failedJobs).toBeNull()
    expect(inspectorView(row({ failedJobsCount: undefined as unknown as number })).failedJobs).toBeNull()
  })

  it('the customer: name, mobile and the address as street, district, city', () => {
    expect(inspectorView(row()).customer).toEqual({
      name: 'Noura Al-Harbi',
      mobile: '0510008238',
      address: 'King Fahd Rd 12, Al Olaya, Riyadh',
    })
    expect(inspectorView(row({ street1: ' ', districtName: '' })).customer.address).toBe('Riyadh')
  })

  it('fulfilment: store, not active, the slot as one value, the reschedule, source and courier', () => {
    expect(inspectorView(row()).fulfilment).toEqual({
      storeCode: '1017',
      notActiveInStore: true,
      slot: { text: '02 Oct 2026 · 10:00–12:00', machine: true },
      rescheduled: { reason: 'Customer asked', by: '2026-10-02 15:30 · msartawi' },
      source: 'Web',
      courier: { text: 'JAH · Khalid N.', machine: true },
    })
  })

  it('a slot whose schedule is no window reads the slot’s own day and text', () => {
    const capture = row({ deliveryScheduleToTime: '2026-10-02T10:00:00' })
    // Free text now, so the pane isolates it as such — the expectation with it.
    expect(inspectorView(capture).fulfilment.slot).toEqual({ text: 'Thursday · 10am - 12 pm', machine: false })
    expect(inspectorView(capture).steps.find((s) => s.state === 'next')?.expectedWindow).toBe('Thursday, 10am - 12 pm')
  })

  it('no reschedule row unless the row is rescheduled; active in store says nothing', () => {
    const fulfilment = inspectorView(row({ rescheduled: false, isActiveInStore: true })).fulfilment
    expect(fulfilment.rescheduled).toBeNull()
    expect(fulfilment.notActiveInStore).toBe(false)
  })

  it('a courier with no driver yet is the code alone; a driver with no code is free text', () => {
    expect(inspectorView(row({ courierDriverName: '' })).fulfilment.courier).toEqual({ text: 'JAH', machine: true })
    expect(inspectorView(row({ courierCode: ' ' })).fulfilment.courier).toEqual({ text: 'Khalid N.', machine: false })
    expect(inspectorView(row({ courierCode: '', courierDriverName: '' })).fulfilment.courier.text).toBe('')
  })

  it('money · SAR: net, paid, fees and the amount due, formatted', () => {
    expect(inspectorView(row()).money).toEqual({
      net: '475.20',
      paid: '400.00',
      fees: '25.00',
      due: '72.50',
      owing: true,
    })
    expect(inspectorView(row({ amountDue: 0 })).money.owing).toBe(false)
  })

  it('the note, trimmed; blank is none', () => {
    expect(inspectorView(row()).note).toBe('Gate 3, call on arrival')
    expect(inspectorView(row({ note: '  ' })).note).toBe('')
  })

  it('opens the delivery no.; a row without one has nothing to open', () => {
    expect(inspectorView(row()).openTo).toBe('/oms/delivery/80001294')
    expect(inspectorView(row({ deliveryNo: ' ' })).openTo).toBeNull()
  })

  it('never carries the handover OTP, anywhere', () => {
    const view = inspectorView(row())
    expect(JSON.stringify(view)).not.toContain(OTP)
    expect(JSON.stringify(view)).not.toMatch(/otp/i)
  })
})
