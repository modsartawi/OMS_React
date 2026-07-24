import { describe, expect, it } from 'vitest'
import { isCodeEcho, statusSeverity } from './status-severity'
import { PAYLOADS } from './__fixtures__/payloads'

describe('perStatusSeverity', () => {
  it("resolves 'R' as ok on readyStatus and warn on closeStatus — from one document", () => {
    // 8000000174 is the whole argument for keying the map (status, code): the
    // same letter is a milestone reached and an outstanding request to abandon.
    const status = PAYLOADS['8000000174'].status
    expect(status.readyStatus).toBe('R')
    expect(status.closeStatus).toBe('R')
    expect(statusSeverity('readyStatus', status.readyStatus)).toBe('ok')
    expect(statusSeverity('closeStatus', status.closeStatus)).toBe('warn')
  })

  it('resolves the other two observed codes as ok', () => {
    expect(statusSeverity('approvalStatus', PAYLOADS['2000000551'].status.approvalStatus)).toBe('ok')
    expect(statusSeverity('deliveryStatus', PAYLOADS['8000000253'].status.deliveryStatus)).toBe('ok')
  })

  it('mutes an unobserved code rather than crying wolf', () => {
    expect(statusSeverity('readyStatus', 'Z')).toBe('mute')
    expect(statusSeverity('paymentStatus', 'PND')).toBe('mute')
    expect(statusSeverity('deliveryStatus', '')).toBe('mute')
    expect(statusSeverity('closeStatus', null)).toBe('mute')
  })

  it('reads a code regardless of padding or case', () => {
    expect(statusSeverity('readyStatus', ' r ')).toBe('ok')
  })
})

describe('descriptionEcho', () => {
  it("marks 9000000003's lastAction as a code — its description echoes TRDY", () => {
    const status = PAYLOADS['9000000003'].status
    expect(status.lastActionDescription).toBe('TRDY')
    expect(isCodeEcho(status.lastActionDescription, status.lastAction)).toBe(true)
  })

  it('leaves a real description alone', () => {
    const status = PAYLOADS['8000000253'].status
    expect(isCodeEcho(status.lastActionDescription, status.lastAction)).toBe(false)
    expect(isCodeEcho(status.readyStatusDescription, status.readyStatus)).toBe(false)
  })

  it('treats a blank companion as an echo — the code is all there is to show', () => {
    expect(isCodeEcho('', 'DFEE')).toBe(true)
    expect(isCodeEcho(null, 'DFEE')).toBe(true)
  })
})
