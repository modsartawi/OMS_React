/**
 * oms 927 (BackOffice spec 4063, doors 4074) — the Mini POS pharmacies screen: enable, trial role, print and the reprint
 * confirm, each drawn only with `MiniPosAdmin:06`, and the printed sheet's QR drawn from the server's signed code.
 * Components are rendered as static markup through a real i18next instance (en and ar); the network is stubbed at the
 * `@/core/api` boundary.
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MiniPosStore } from '@/core/models/mini-pos'
import en from '@/locales/en/mini-pos-stores.json'
import ar from '@/locales/ar/mini-pos-stores.json'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { miniPosStoresApi } = await import('./api')
const { addSteps, asTrialRole, canPrint, nextVersion, printPath, storesShown, trialRoleKey } = await import('./stores')
const { QrSheet, ReprintConfirm, StoresTable } = await import('./StoreViews')

const NS = 'mini-pos-stores'
const draw = (element: ReactElement, lng: 'en' | 'ar' = 'en') => {
  const i18n = i18next.createInstance()
  i18n.init({ lng, resources: { [lng]: { [NS]: lng === 'en' ? en : ar } }, ns: [NS], defaultNS: NS, initAsync: false })
  return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, element))
}

const store = (over: Partial<MiniPosStore> = {}): MiniPosStore => ({
  storeCode: 'R101',
  isEnabled: true,
  trialRole: 'Trial',
  printedCodeVersion: 2,
  hasKey: true,
  updatedBy: 'lead1',
  updatedAt: '2026-11-18T10:00:00',
  ...over,
})
const noop = () => {}
const actions = (canManage: boolean) => ({ canManage, onEnable: noop, onDisable: noop, onTrialRole: noop, onReprint: noop })

describe('the pharmacies list', () => {
  const stores = [store(), store({ storeCode: 'R050', isEnabled: false, trialRole: 'Control', printedCodeVersion: 0, hasKey: false })]

  it('shows enabled pharmacies first, then by code', () => {
    expect(storesShown([store({ storeCode: 'R900' }), stores[1], store({ storeCode: 'R100' })]).map((s) => s.storeCode)).toEqual([
      'R100',
      'R900',
      'R050',
    ])
  })

  it('without MiniPosAdmin:06: the state and the trial role as words, and not one control', () => {
    const html = draw(createElement(StoresTable, { stores, ...actions(false) }))
    expect(html).toContain('data-minipos-store="R101"')
    expect(html).toContain('Enabled')
    expect(html).toContain('Control')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('<select')
    expect(html).not.toContain('data-minipos-print')
  })

  it('with MiniPosAdmin:06: disable or enable, the trial role select, and print + reprint on a printable pharmacy only', () => {
    const html = draw(createElement(StoresTable, { stores, ...actions(true) }))
    expect(html).toContain('data-minipos-disable="R101"')
    expect(html).toContain('data-minipos-enable="R050"')
    expect(html).toContain('data-minipos-trial-role="R101"')
    expect(html).toContain('data-minipos-print="R101"')
    expect(html).toContain(`href="${printPath('R101')}"`)
    expect(html).toContain('data-minipos-reprint="R101"')
    // A disabled (control) pharmacy has no code to print.
    expect(html).not.toContain('data-minipos-print="R050"')
    expect(html).not.toContain('data-minipos-reprint="R050"')
  })

  it('draws in Arabic', () => {
    const html = draw(createElement(StoresTable, { stores, ...actions(true) }), 'ar')
    expect(html).toContain('إعادة الطباعة')
    expect(html).toContain('<bdi dir="ltr">R101</bdi>')
  })

  it('says so when no pharmacy runs Mini POS', () => {
    expect(draw(createElement(StoresTable, { stores: [], ...actions(true) }))).toContain('No pharmacy runs Mini POS yet.')
  })
})

describe('trial role, print and add', () => {
  it('words each role, and reads a select back to a role', () => {
    expect([trialRoleKey('Trial'), trialRoleKey('Control'), trialRoleKey(''), trialRoleKey('odd')]).toEqual(['trial', 'control', 'none', 'none'])
    expect([asTrialRole('Trial'), asTrialRole('Control'), asTrialRole(''), asTrialRole('x')]).toEqual(['Trial', 'Control', '', ''])
  })

  it('prints only an enabled pharmacy with a key', () => {
    expect(canPrint({ isEnabled: true, hasKey: true })).toBe(true)
    expect(canPrint({ isEnabled: false, hasKey: true })).toBe(false)
    expect(canPrint({ isEnabled: true, hasKey: false })).toBe(false)
    expect(printPath('R 1')).toBe('/mini-pos/print/R%201')
  })

  it('a control pharmacy is only marked; a trial one is enabled then marked; a plain one enabled', () => {
    expect(addSteps('Control')).toEqual(['trialRole'])
    expect(addSteps('Trial')).toEqual(['enable', 'trialRole'])
    expect(addSteps('')).toEqual(['enable'])
  })
})

describe('the reprint confirm', () => {
  it('names the pharmacy and both versions, and warns that every older print stops working', () => {
    expect(nextVersion(store())).toBe(3)
    const html = draw(createElement(ReprintConfirm, { store: store(), pending: false, error: '', onConfirm: noop, onClose: noop }))
    expect(html).toContain('Reprint the QR?')
    expect(html).toContain('data-minipos-reprint-body="R101"')
    expect(html).toContain('version ⁨3⁩ replaces version ⁨2⁩')
    expect(html).toContain('Every older print stops working at once.')
    expect(html).toContain('data-minipos-reprint-confirm=""')
    expect(html).not.toContain('role="alert"')
  })

  it('is closed with no pharmacy chosen', () => {
    expect(draw(createElement(ReprintConfirm, { store: null, pending: false, error: '', onConfirm: noop, onClose: noop }))).toBe('')
  })

  it('waits while the reprint is in flight, and shows a refusal', () => {
    const html = draw(createElement(ReprintConfirm, { store: store(), pending: true, error: 'Pharmacy R101 is not enabled.', onConfirm: noop, onClose: noop }))
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-minipos-reprint-confirm/)
    expect(html).toContain('<bdi>Pharmacy R101 is not enabled.</bdi>')
  })

  it('in Arabic', () => {
    const html = draw(createElement(ReprintConfirm, { store: store(), pending: false, error: '', onConfirm: noop, onClose: noop }), 'ar')
    expect(html).toContain('إعادة طباعة الرمز؟')
    expect(html).toContain('تتوقف كل النسخ المطبوعة السابقة فورًا')
  })
})

describe('the printed sheet', () => {
  it('draws the QR client-side from the signed code, with the pharmacy and the version', () => {
    const html = draw(createElement(QrSheet, { storeCode: 'R101', version: 3, code: 'MP1.R101.3.c2lnbmVk' }))
    expect(html).toContain('data-minipos-qr-sheet="R101"')
    expect(html).toMatch(/<svg[^>]*>/)
    expect(html).toContain('<bdi dir="ltr">R101</bdi>')
    expect(html).toContain('QR version ⁨3⁩')
  })

  it('a different code draws a different QR', () => {
    const a = draw(createElement(QrSheet, { storeCode: 'R101', version: 3, code: 'code-one' }))
    const b = draw(createElement(QrSheet, { storeCode: 'R101', version: 3, code: 'code-two' }))
    expect(a).not.toBe(b)
  })
})

describe('the doors', () => {
  beforeEach(() => {
    api.get.mockReset()
    api.post.mockReset()
  })

  it('list, enable, disable, trial role, printed code and reprint', async () => {
    api.get.mockResolvedValue(null)
    api.post.mockResolvedValue({})
    expect(await miniPosStoresApi.list()).toEqual([])
    expect(api.get).toHaveBeenLastCalledWith('MiniPosAdmin/Stores')
    await miniPosStoresApi.enable('R101')
    expect(api.post).toHaveBeenLastCalledWith('MiniPosAdmin/Stores/R101/Enable', {})
    await miniPosStoresApi.disable('R101')
    expect(api.post).toHaveBeenLastCalledWith('MiniPosAdmin/Stores/R101/Disable', {})
    await miniPosStoresApi.setTrialRole('R101', '')
    expect(api.post).toHaveBeenLastCalledWith('MiniPosAdmin/Stores/R101/TrialRole', { trialRole: '' })
    await miniPosStoresApi.printedCode('R101')
    expect(api.get).toHaveBeenLastCalledWith('MiniPosAdmin/Stores/R101/PrintedCode')
    await miniPosStoresApi.reprint('R101')
    expect(api.post).toHaveBeenLastCalledWith('MiniPosAdmin/Stores/R101/Reprint', {})
  })
})
