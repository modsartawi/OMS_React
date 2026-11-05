/**
 * 3389 hotfix — the two doors Document / Delivery Details read for an insurance order answer the shapes
 * BackOffice built (branch pricing2), not the shapes the client guessed:
 * - `GET SdDocumentWeb/Document/{no}/Insurance` answers `SdInsuranceReadModel` (`received` / `current` /
 *   `engine` money in the engine's `InsuranceSummary` shape, `amounts`, `timeline.entries`, `intake.isKept`),
 *   and refuses a document that is not an insurance order with `SDD-02220`;
 * - `GET SdDocumentWeb/OrderDocumentList?DocumentNo=…` answers `{ rows, limited }`.
 * The network is stubbed at the `@/core/api` boundary with payloads in the real shapes (`./__fixtures__`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import insuranceWire from './__fixtures__/insurance-1006358459.json'
import changedWire from './__fixtures__/insurance-1006358461-changed.json'
import orderSearch from './__fixtures__/order-search-1006358459.json'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/core/api')>()), api }))

const { ApiError } = await import('@/core/api')
const { documentApi } = await import('./api')
const { moneyTable, lineView } = await import('./insurance-section')
const { planView } = await import('./insurance-plan')
const { timelineRows } = await import('./insurance-timeline')
const { receivedView } = await import('./received-section')
const { deliveryMoneyStrip, orderRowOf } = await import('./delivery-money-strip')

const refusal = (code: string) =>
  new ApiError('business', 'Order 1 is not an insurance order: it has no insurance to read.', 400, [
    { errorCode: code, internalErrorCode: '', errorMessage: 'Order 1 is not an insurance order: it has no insurance to read.' },
  ])

beforeEach(() => {
  api.get.mockReset()
})

describe('the insurance read door: SdInsuranceReadModel, read through the api boundary', () => {
  it('asks the route and draws the three moneys side by side', async () => {
    api.get.mockResolvedValue(insuranceWire)
    const read = (await documentApi.getInsurance('1006358459'))!
    expect(api.get).toHaveBeenCalledWith('SdDocumentWeb/Document/1006358459/Insurance')
    const table = moneyTable(read)
    const row = (figure: string) => table.rows.find((r) => r.figure === figure)!
    expect(row('patient')).toEqual({
      figure: 'patient',
      channel: { kind: 'amount', text: '63.65' },
      current: { kind: 'amount', text: '63.65' },
      engine: { kind: 'amount', text: '13.26' },
      gap: true,
    })
    expect(row('insurer').engine).toEqual({ kind: 'amount', text: '53.05' })
    // The channel sends only its four header figures: uncovered is "not sent", never 0.00.
    expect(row('uncovered').channel).toEqual({ kind: 'none' })
    expect(row('uncovered').current).toEqual({ kind: 'amount', text: '0.00' })
    // Amount due: the order's own (amounts.amountDue) and the engine's; the channel sends none.
    expect([row('amountDue').channel, row('amountDue').current, row('amountDue').engine]).toEqual([
      { kind: 'none' },
      { kind: 'amount', text: '63.65' },
      { kind: 'amount', text: '13.26' },
    ])
    expect(read.moneySource).toBe('CHANNEL')
    expect([read.amountDue, read.onAccountAmount, read.paidAmount]).toEqual([63.65, 2.66, 0])
  })

  it('reads a line: what was sent, what is dispensed, its current, channel and engine money', async () => {
    api.get.mockResolvedValue(insuranceWire)
    const read = (await documentApi.getInsurance('1006358459'))!
    const [line] = read.lines
    expect(line.sent).toEqual({ sfdaCode: '0507230119', text: 'Augmentin 1g tablets', itemNumber: '', quantity: 1, unit: 'BOX' })
    expect([line.dispensedItemNumber, line.dispensedQuantity, line.dispensedUnit]).toEqual(['100245', 1, 'BOX'])
    expect([line.originalItemNumber, line.pharmacistReason, line.unresolvedReason, line.guardDecision]).toEqual([null, null, null, null])
    const view = lineView(line, read.currency)
    expect(view.engineDeductible).toEqual({ kind: 'amount', text: '13.26' })
    expect(view.appliedDeductible).toEqual({ kind: 'amount', text: '63.65' })
    expect(view.deductibleGap).toBe(true)
    expect(view.received?.patient).toEqual({ kind: 'amount', text: '63.65' })
    expect(view.ceiling).toEqual({ kind: 'none' })
    expect(line.conditions.map((c) => [c.lineNumber, c.condType, c.value])).toEqual([
      [10, 'ZDED', 63.65],
      [10, 'PR00', 66.31],
      [10, 'MWST', 0],
    ])
    expect(read.headerConditions.map((c) => [c.lineNumber, c.condType, c.rate])).toEqual([[0, 'DFEE', 15]])
  })

  it('reads the plan from its real field names', async () => {
    api.get.mockResolvedValue(insuranceWire)
    const read = (await documentApi.getInsurance('1006358459'))!
    const facts = Object.fromEntries(planView(read.plan, read.currency).facts.map((f) => [f.field, f.value]))
    expect(facts).toMatchObject({
      policyNumber: 'POL-55120',
      eligibilityReference: 'ELG-99812',
      authorizationId: 'AUTH-55410',
      chiefComplaint: 'Fever and sore throat for three days',
      daysSupply: '7',
      insurerCustomer: 'C100230',
      payer: 'P-BUPA',
    })
    expect(planView(read.plan, read.currency).groups).toEqual([{ group: 'G1', percentage: '20%', cap: { kind: 'amount', text: '30.00' } }])
  })

  it('reads timeline.entries (ACT / LOG) and intake.isKept', async () => {
    api.get.mockResolvedValue(insuranceWire)
    const read = (await documentApi.getInsurance('1006358459'))!
    expect(timelineRows(read.timeline, [], read.currency).map((r) => [r.kind, r.kind === 'log' ? r.action : r.act])).toEqual([
      ['log', 'OADD'],
      ['change', 'PICK'],
      ['log', 'DRDY'],
    ])
    expect(receivedView(read.intake).kind).toBe('kept')

    api.get.mockResolvedValue(changedWire)
    const changed = (await documentApi.getInsurance('1006358461'))!
    const rows = timelineRows(changed.timeline, [], changed.currency)
    expect(rows.map((r) => (r.kind === 'change' ? [r.act, r.before.kind, r.channelToEngine] : null))).toEqual([
      ['QUANTITY', 'notRecorded', false],
      ['SWAP', 'recorded', true],
    ])
    expect(receivedView(changed.intake)).toEqual({ kind: 'notKept', textKey: 'insurance.received.notKeptBefore', since: '2026-11-04' })
  })

  it("a document that is not an insurance order is SDD-02220, read as no section", async () => {
    api.get.mockRejectedValue(refusal('SDD-02220'))
    expect(await documentApi.getInsurance('1')).toBeNull()
  })

  it('any other refusal is thrown for the page to say', async () => {
    api.get.mockRejectedValue(refusal('NOT_INSURANCE_ORDER'))
    await expect(documentApi.getInsurance('1')).rejects.toBeInstanceOf(ApiError)
  })
})

describe("the delivery money strip's door: { rows, limited }", () => {
  it('finds the order row inside the page and draws the strip', async () => {
    api.get.mockResolvedValue(orderSearch)
    const rows = await documentApi.getOrderRows(' 1006358459 ')
    expect(api.get).toHaveBeenCalledWith('SdDocumentWeb/OrderDocumentList', { DocumentNo: '1006358459' })
    const strip = deliveryMoneyStrip(orderRowOf(rows, '1006358459'), { refDocumentNo: '1006358459', amountDue: 40.5 }, { canOpenList: true })
    expect(strip).not.toBeNull()
    expect([strip!.source.code, strip!.patient, strip!.insurer, strip!.amountDue]).toEqual([
      'CHANNEL',
      { kind: 'amount', text: '63.65' },
      { kind: 'amount', text: '2.66' },
      { kind: 'amount', text: '40.50' },
    ])
  })
})
