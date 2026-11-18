/**
 * The order page's Attachments tab (spec 324, ticket 327): whether it is drawn at all,
 * and the number on its badge (which 328's Files row reuses).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import i18n from '@/core/i18n'
import documentEn from '@/locales/en/document.json'
import { permissionsOf } from '@/core/permissions'
import {
  PRESCRIPTION,
  SD_DOCUMENT,
  attachmentsBadgeCount,
  attachmentsTabGate,
  canWithdrawOn,
  filedOnOrder,
  orderAttachmentTarget,
} from './attachments-tab'

const ORDER = { attachmentOwnerNo: '2000000551', attachmentCategory: 'P2E' }
const EXTRAS = { fileServerReady: true, notificationCenterOn: false, nphiesContractVersion: '1.3', canManageRoles: false, canManageUsers: false }
/** The one permissions answer (oms 909): read and withdraw categories become `Attachments:03:*` / `:04:*` keys. */
const grants = (read: string[], withdraw: string[] = [], fileServerReady = true) =>
  permissionsOf({
    screens: [...read.map((c) => `Attachments:03:${c}`), ...withdraw.map((c) => `Attachments:04:${c}`)],
    extras: { ...EXTRAS, fileServerReady },
  })
const HOLDER = grants(['P2E'])

describe('attachmentsTabGate — admits only with an owner, a category and the category held', () => {
  it('admits an order whose category the session reads', () => {
    expect(attachmentsTabGate(ORDER, HOLDER)).toBe(true)
    expect(attachmentsTabGate({ ...ORDER, attachmentCategory: 'ALTIBBI' }, grants(['P2E', 'ALTIBBI']))).toBe(true)
  })

  it('refuses with no owner — absent, empty or blank', () => {
    expect(attachmentsTabGate({ attachmentCategory: 'P2E' }, HOLDER)).toBe(false)
    expect(attachmentsTabGate({ ...ORDER, attachmentOwnerNo: '' }, HOLDER)).toBe(false)
    expect(attachmentsTabGate({ ...ORDER, attachmentOwnerNo: '  ' }, HOLDER)).toBe(false)
  })

  it('refuses with no category — absent, empty or blank (BackOffice 2077 not served yet)', () => {
    expect(attachmentsTabGate({ attachmentOwnerNo: '2000000551' }, HOLDER)).toBe(false)
    expect(attachmentsTabGate({ ...ORDER, attachmentCategory: '' }, HOLDER)).toBe(false)
    expect(attachmentsTabGate({ ...ORDER, attachmentCategory: ' ' }, HOLDER)).toBe(false)
  })

  it('refuses with no document at all', () => {
    expect(attachmentsTabGate(null, HOLDER)).toBe(false)
    expect(attachmentsTabGate(undefined, HOLDER)).toBe(false)
  })

  it('refuses an unanswered or failed permissions answer', () => {
    expect(attachmentsTabGate(ORDER, permissionsOf(null))).toBe(false)
  })

  it('refuses when the File Server is not set up, even with the category held', () => {
    expect(attachmentsTabGate(ORDER, grants(['P2E'], [], false))).toBe(false)
  })

  it('refuses a category the session does not read, and matches it exactly', () => {
    expect(attachmentsTabGate({ ...ORDER, attachmentCategory: 'ERX' }, HOLDER)).toBe(false)
    expect(attachmentsTabGate({ ...ORDER, attachmentCategory: 'p2e' }, HOLDER)).toBe(false)
    expect(attachmentsTabGate(ORDER, grants(['CASH_CLOSE']))).toBe(false)
  })

  it('reads the READ key, never the withdraw one', () => {
    expect(attachmentsTabGate(ORDER, grants([], ['P2E']))).toBe(false)
  })
})

describe('attachmentsBadgeCount — one number for the badge and the Files row', () => {
  it('before the list loads: the model count', () => {
    expect(attachmentsBadgeCount(3, undefined)).toBe(3)
    expect(attachmentsBadgeCount(3, null)).toBe(3)
  })

  it('0 is shown as 0, never hidden', () => {
    expect(attachmentsBadgeCount(0, undefined)).toBe(0)
  })

  it('an absent count and no list: no badge — never 0', () => {
    expect(attachmentsBadgeCount(undefined, undefined)).toBeNull()
    expect(attachmentsBadgeCount(null, undefined)).toBeNull()
  })

  it('a count that is not a whole, non-negative number is no count', () => {
    expect(attachmentsBadgeCount('3', undefined)).toBeNull()
    expect(attachmentsBadgeCount(-1, undefined)).toBeNull()
    expect(attachmentsBadgeCount(1.5, undefined)).toBeNull()
    expect(attachmentsBadgeCount(Number.NaN, undefined)).toBeNull()
  })

  it('after the list loads: the STORED list’s length, which wins over a stale model count', () => {
    expect(attachmentsBadgeCount(3, [{}, {}])).toBe(2)
    expect(attachmentsBadgeCount(0, [{}, {}, {}, {}])).toBe(4)
    expect(attachmentsBadgeCount(5, [])).toBe(0)
  })

  it('a loaded list counts even when the model had no count', () => {
    expect(attachmentsBadgeCount(undefined, [{}])).toBe(1)
    expect(attachmentsBadgeCount(undefined, [])).toBe(0)
  })
})

describe('canWithdrawOn — the tab’s gate, the withdraw grant for the category, and the server’s reasons (331)', () => {
  const WITHDRAWER = grants(['P2E', 'ALTIBBI'], ['P2E', 'ALTIBBI'])
  const REASONS = [
    { code: 'WRONG_ORDER', label: 'Wrong order or customer', labelArabic: 'طلب أو عميل غير صحيح', noteRequired: false },
    { code: 'OTHER', label: 'Other', labelArabic: 'سبب آخر', noteRequired: true },
  ]

  it('offers Withdraw when all three hold', () => {
    expect(canWithdrawOn(ORDER, WITHDRAWER, REASONS)).toBe(true)
    expect(canWithdrawOn({ ...ORDER, attachmentCategory: 'ALTIBBI' }, WITHDRAWER, REASONS)).toBe(true)
  })

  it('needs the withdraw key for the category — read alone is not enough', () => {
    expect(canWithdrawOn(ORDER, HOLDER, REASONS)).toBe(false)
    expect(canWithdrawOn(ORDER, grants(['P2E'], ['ALTIBBI']), REASONS)).toBe(false)
    expect(canWithdrawOn(ORDER, grants(['P2E'], ['p2e']), REASONS)).toBe(false)
  })

  it('half grant: the withdraw key without the read key offers nothing', () => {
    expect(canWithdrawOn(ORDER, grants([], ['P2E']), REASONS)).toBe(false)
  })

  it('an ERX order never offers Withdraw — 2062 seeds withdraw grants for P2E and ALTIBBI only', () => {
    const erx = { ...ORDER, attachmentCategory: 'ERX' }
    expect(canWithdrawOn(erx, grants(['ERX'], ['P2E', 'ALTIBBI']), REASONS)).toBe(false)
  })

  it('needs the tab gate: an owner, a category, and the READ grant too', () => {
    expect(canWithdrawOn({ attachmentCategory: 'P2E' }, WITHDRAWER, REASONS)).toBe(false)
    expect(canWithdrawOn({ attachmentOwnerNo: '2000000551' }, WITHDRAWER, REASONS)).toBe(false)
    expect(canWithdrawOn(null, WITHDRAWER, REASONS)).toBe(false)
  })

  it('an unanswered or failed permissions answer offers nothing', () => {
    expect(canWithdrawOn(ORDER, permissionsOf(null), REASONS)).toBe(false)
  })

  it('needs a non-empty reason list — absent (an older SIS.Api, or not read yet) or empty hides it', () => {
    expect(canWithdrawOn(ORDER, WITHDRAWER, [])).toBe(false)
    expect(canWithdrawOn(ORDER, WITHDRAWER, undefined)).toBe(false)
    expect(canWithdrawOn(ORDER, WITHDRAWER, null)).toBe(false)
  })
})

describe('orderAttachmentTarget — what the tab lists (and, from 330, files onto)', () => {
  it('is SD_DOCUMENT under attachmentOwnerNo, in attachmentCategory, as a PRESCRIPTION', () => {
    expect(orderAttachmentTarget({ attachmentOwnerNo: '2000000551', attachmentCategory: 'ALTIBBI' })).toEqual({
      ownerKind: SD_DOCUMENT,
      ownerKey: '2000000551',
      category: 'ALTIBBI',
      kind: PRESCRIPTION,
    })
    expect(SD_DOCUMENT).toBe('SD_DOCUMENT')
    expect(PRESCRIPTION).toBe('PRESCRIPTION')
  })

  it('is null without an owner or a category — never the route’s number, never a guessed category', () => {
    expect(orderAttachmentTarget({ attachmentCategory: 'P2E' })).toBeNull()
    expect(orderAttachmentTarget({ attachmentOwnerNo: '2000000551' })).toBeNull()
    expect(orderAttachmentTarget(null)).toBeNull()
  })
})

describe('filedOnOrder — a delivery’s page heads its order’s files (329)', () => {
  it('names the owner when it differs from the route’s number', () => {
    expect(filedOnOrder('2000000551', '8000000253')).toBe('2000000551')
  })

  it('reads an ATBI owner the same — it is an order document too', () => {
    expect(filedOnOrder('3000000017', '8000000253')).toBe('3000000017')
  })

  it('has no heading on the order’s own page', () => {
    expect(filedOnOrder('2000000551', '2000000551')).toBeNull()
  })

  it('compares the two numbers trimmed, and names the owner trimmed', () => {
    expect(filedOnOrder(' 2000000551 ', '2000000551')).toBeNull()
    expect(filedOnOrder('2000000551', ' 2000000551	')).toBeNull()
    expect(filedOnOrder(' 2000000551 ', '8000000253')).toBe('2000000551')
  })

  it('has no heading for an absent owner — absent, empty, blank or not a string', () => {
    expect(filedOnOrder(undefined, '8000000253')).toBeNull()
    expect(filedOnOrder(null, '8000000253')).toBeNull()
    expect(filedOnOrder('', '8000000253')).toBeNull()
    expect(filedOnOrder('   ', '8000000253')).toBeNull()
    expect(filedOnOrder(2000000551, '8000000253')).toBeNull()
  })
})

describe('the tab’s words live in the document namespace', () => {
  /** Read a dotted key out of the document bundle. */
  const bundle = (key: string): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], documentEn)

  it('backs every literal key the tab asks for with a string (a missing key renders raw)', () => {
    const source = readFileSync(join(__dirname, 'AttachmentsTab.tsx'), 'utf8')
    const keys = [...source.matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => m[1])
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter((key) => typeof bundle(key) !== 'string')).toEqual([])
  })

  it('names the disclosure, with its file count only once one is known (ticket 404)', () => {
    expect(i18n.t('document:attachments.headingUncounted')).toBe('Attachments')
    expect(i18n.t('document:attachments.heading', { count: 1 })).toBe('Attachments · <n>1</n>')
    expect(i18n.t('document:attachments.heading', { count: 6 })).toBe('Attachments · <n>6</n>')
    expect(i18n.t('document:attachments.empty')).toBe('No file is attached to this order.')
  })

  it('says "Filed on order <no>" with the number as a named param, marked for its link (329)', () => {
    expect(i18n.t('document:attachments.filedOnOrder', { documentNo: '2000000551' })).toBe(
      'Filed on order <order>2000000551</order>',
    )
    const source = readFileSync(join(__dirname, 'AttachmentsTab.tsx'), 'utf8')
    expect(source).toContain('i18nKey="attachments.filedOnOrder"')
  })
})
