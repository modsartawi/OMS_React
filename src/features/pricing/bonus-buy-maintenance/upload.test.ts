/**
 * Ticket 418 — the upload dialog's pure seam (BackOffice spec 2374, doors 2381/2382).
 */
import { describe, expect, it } from 'vitest'
import type {
  BbyUploadBonusBuy,
  BbyUploadRefusal,
  BbyUploadResult,
} from '@/core/models/bonus-buy-upload'
import { UPLOAD_MAX_BYTES, readUpload, uploadFileProblem, uploadForm } from './upload'

const bby = (row: number, serial: string, bbyNumber: string | null, bbyStatus = '1'): BbyUploadBonusBuy => ({
  row,
  serial,
  buyGroup: 'VICHY',
  getGroup: 'VICHY',
  bbyNumber,
  bbyStatus,
})
const refusal = (row: number, serial: string, code: string): BbyUploadRefusal => ({
  row,
  serial,
  code,
  english: `${code} in English`,
  arabic: `${code} بالعربية`,
})
const result = (over: Partial<BbyUploadResult>): BbyUploadResult => ({
  status: 'saved',
  promoNumber: 'P000000047',
  promotionCreated: false,
  created: [],
  updated: [],
  refusals: [],
  warnings: [],
  ...over,
})
const LOAD = { validateOnly: false, activate: false }
const CHECK = { validateOnly: true, activate: false }

describe('upload result lists created, updated and refused rows', () => {
  it('a load lists the created and the updated numbers, in the server’s order', () => {
    const view = readUpload(
      result({
        created: [bby(1, '1', 'OMS000000101'), bby(9, '2', 'OMS000000102')],
        updated: [bby(14, '3', 'OMS000000090', '')],
      }),
      LOAD,
    )
    expect(view.outcome).toBe('loaded')
    expect(view.created.map((r) => r.bbyNumber)).toEqual(['OMS000000101', 'OMS000000102'])
    expect(view.updated.map((r) => r.bbyNumber)).toEqual(['OMS000000090'])
    expect(view.refused).toEqual([])
  })

  it('a refusal lists every bad row with its row number, serial, code and both texts', () => {
    const view = readUpload(
      result({
        status: 'refused',
        refusals: [refusal(0, '', 'BBY-UPLOAD-PROMOTION'), refusal(3, '1', 'BBY-MATERIAL'), refusal(7, '2', 'BBY-QTY')],
      }),
      LOAD,
    )
    expect(view.outcome).toBe('refused')
    expect(view.refused).toHaveLength(3)
    expect(view.refused[1]).toEqual(refusal(3, '1', 'BBY-MATERIAL'))
    // Row 0 is the whole file, not a row.
    expect(view.refused[0].row).toBe(0)
    expect(view.created).toEqual([])
    expect(view.updated).toEqual([])
  })

  it('missing arrays read as empty, never as a crash', () => {
    const view = readUpload({ status: 'saved', promoNumber: 'P000000047' } as BbyUploadResult, LOAD)
    expect(view.created).toEqual([])
    expect(view.updated).toEqual([])
    expect(view.refused).toEqual([])
    expect(view.warnings).toEqual([])
  })

  it('a check-only pass lists what WOULD be created and updated', () => {
    const view = readUpload(
      result({ status: 'valid', created: [bby(1, '1', null)], updated: [bby(5, '2', 'OMS000000090')] }),
      CHECK,
    )
    expect(view.outcome).toBe('checked')
    expect(view.created).toHaveLength(1)
    expect(view.created[0].bbyNumber).toBeNull()
    expect(view.updated).toHaveLength(1)
  })
})

describe('a refused file says nothing was written', () => {
  it('refused → nothing written', () => {
    const view = readUpload(result({ status: 'refused', refusals: [refusal(2, '1', 'BBY-X')] }), LOAD)
    expect(view.nothingWritten).toBe(true)
  })

  it('a refused file carries no created or updated rows even if the server sent some', () => {
    const view = readUpload(
      result({ status: 'refused', created: [bby(1, '1', 'OMS1')], refusals: [refusal(2, '1', 'BBY-X')] }),
      LOAD,
    )
    expect(view.created).toEqual([])
    expect(view.updated).toEqual([])
  })

  it('a check-only pass wrote nothing too', () => {
    expect(readUpload(result({ status: 'valid' }), CHECK).nothingWritten).toBe(true)
  })

  it('a load is NOT reported as nothing written', () => {
    expect(readUpload(result({ status: 'saved', created: [bby(1, '1', 'OMS1')] }), LOAD).nothingWritten).toBe(false)
  })

  it('an unreadable status claims nothing either way', () => {
    const view = readUpload(result({ status: 'weird' as BbyUploadResult['status'] }), LOAD)
    expect(view.outcome).toBe('unknown')
    expect(view.nothingWritten).toBe(false)
  })
})

describe('a check-only run never refreshes the overview', () => {
  it('a check-only pass does not refresh', () => {
    expect(readUpload(result({ status: 'valid' }), CHECK).refreshOverview).toBe(false)
  })

  it('a check-only run does not refresh even if the server answered saved', () => {
    expect(readUpload(result({ status: 'saved' }), CHECK).refreshOverview).toBe(false)
  })

  it('a check-only refusal does not refresh', () => {
    expect(readUpload(result({ status: 'refused' }), CHECK).refreshOverview).toBe(false)
  })

  it('a refused load does not refresh', () => {
    expect(readUpload(result({ status: 'refused' }), LOAD).refreshOverview).toBe(false)
  })

  it('a successful load refreshes', () => {
    expect(readUpload(result({ status: 'saved' }), LOAD).refreshOverview).toBe(true)
  })

  it('an unreadable answer to a load refreshes — re-reading is harmless, a stale overview is not', () => {
    expect(readUpload(result({ status: 'weird' as BbyUploadResult['status'] }), LOAD).refreshOverview).toBe(true)
  })
})

describe('the multipart form', () => {
  it('names the parts as the door reads them', async () => {
    const file = new File(['1\tP000000047\n'], 'Vichy 2nd p - 20 SR.txt', { type: 'text/plain' })
    const form = uploadForm(file, { validateOnly: true, activate: false })
    const sent = form.get('file') as File
    expect(sent.name).toBe('Vichy 2nd p - 20 SR.txt')
    expect(await sent.text()).toBe('1\tP000000047\n')
    expect(form.get('validateOnly')).toBe('true')
    expect(form.get('activate')).toBe('false')
  })
})

describe('the file is checked for size before it goes up', () => {
  it('an empty file is refused', () => {
    expect(uploadFileProblem({ size: 0 })).toBe('empty')
  })
  it('a file over the door’s cap is refused', () => {
    expect(uploadFileProblem({ size: UPLOAD_MAX_BYTES + 1 })).toBe('tooLarge')
  })
  it('a file at the cap goes up', () => {
    expect(uploadFileProblem({ size: UPLOAD_MAX_BYTES })).toBeNull()
  })
})
