/**
 * The attachment grants off the one permissions answer (oms 914, BackOffice spec 4002 row 3): categories derived from
 * the three-field keys, withdraw needs read too, and nothing draws without the File Server.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { attachmentReadCategories, canOpenAttachments, canReadAttachmentCategory, canWithdrawAttachment } from './access'

const READY = { fileServerReady: true, notificationCenterOn: false, nphiesContractVersion: '1.3', canManageRoles: false, canManageUsers: false }
const answer = (screens: string[], fileServerReady = true) => permissionsOf({ screens, extras: { ...READY, fileServerReady } })

describe('read categories', () => {
  it('are the suffixes of the Attachments:03:* keys held, and nothing else', () => {
    const p = answer(['Attachments:03:NPHIES', 'Attachments:04:WASFATY', 'Attachments:03:P2E', 'DocumentList:03', 'Attachments:03:'])
    expect(attachmentReadCategories(p)).toEqual(['NPHIES', 'P2E'])
  })

  it('an ADMIN-shaped answer (every two-field key, no three-field one) reads none', () => {
    expect(attachmentReadCategories(answer(['AuthzAdmin:03', 'DocumentList:03']))).toEqual([])
    expect(canOpenAttachments(answer(['AuthzAdmin:03', 'DocumentList:03']))).toBe(false)
  })
})

describe('the screen', () => {
  it('opens on the File Server AND a readable category', () => {
    expect(canOpenAttachments(answer(['Attachments:03:CASH_CLOSE']))).toBe(true)
  })

  it('half grant: a category without the File Server (NotSetUp) stays shut', () => {
    expect(canOpenAttachments(answer(['Attachments:03:CASH_CLOSE'], false))).toBe(false)
    expect(canReadAttachmentCategory(answer(['Attachments:03:CASH_CLOSE'], false), 'CASH_CLOSE')).toBe(false)
  })

  it('half grant: the File Server without a category stays shut', () => {
    expect(canOpenAttachments(answer([]))).toBe(false)
  })

  it('a category reads by its exact spelling only', () => {
    const p = answer(['Attachments:03:P2E'])
    expect(canReadAttachmentCategory(p, 'P2E')).toBe(true)
    expect(canReadAttachmentCategory(p, 'p2e')).toBe(false)
    expect(canReadAttachmentCategory(p, 'ALTIBBI')).toBe(false)
  })
})

describe('withdraw', () => {
  it('needs 04 AND 03 on the same category', () => {
    expect(canWithdrawAttachment(answer(['Attachments:03:P2E', 'Attachments:04:P2E']), 'P2E')).toBe(true)
  })

  it('half grant: 04 without 03 withdraws nothing', () => {
    expect(canWithdrawAttachment(answer(['Attachments:04:P2E']), 'P2E')).toBe(false)
  })

  it('03 alone, or 04 on another category, withdraws nothing', () => {
    expect(canWithdrawAttachment(answer(['Attachments:03:P2E']), 'P2E')).toBe(false)
    expect(canWithdrawAttachment(answer(['Attachments:03:P2E', 'Attachments:04:ALTIBBI']), 'P2E')).toBe(false)
  })
})
