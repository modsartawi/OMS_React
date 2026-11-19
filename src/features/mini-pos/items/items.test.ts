/**
 * oms 915 (BackOffice spec 4032, doors 4043) — the Mini POS items screen: the A-level allow-list and the refusal list with
 * its reason — the add forms' checks, each list after an add and a removal, and Remove drawn only with `MiniPosAdmin:06`.
 * Components are rendered as static markup through a real i18next instance (en and ar); the network is stubbed at the
 * `@/core/api` boundary.
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MiniPosAllowedCategory, MiniPosRefusedItem } from '@/core/models/mini-pos'
import en from '@/locales/en/mini-pos-items.json'
import ar from '@/locales/ar/mini-pos-items.json'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { miniPosItemsApi } = await import('./api')
const { categoryKey, categoryProblem, refusalProblem, refusedKey, withRow, withoutRow } = await import('./items')
const { CategoryList, RefusedList } = await import('./ItemViews')

const NS = 'mini-pos-items'
const draw = (element: ReactElement, lng: 'en' | 'ar' = 'en') => {
  const i18n = i18next.createInstance()
  i18n.init({ lng, resources: { [lng]: { [NS]: lng === 'en' ? en : ar } }, ns: [NS], defaultNS: NS, initAsync: false })
  return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, element))
}

const cat = (aCode: string): MiniPosAllowedCategory => ({ aCode, enteredBy: 'lead1', enteredAt: '2026-11-18T10:00:00' })
const refused = (itemNumber: string, reasonNote = 'Cold chain'): MiniPosRefusedItem => ({
  itemNumber,
  reasonNote,
  enteredBy: 'lead1',
  enteredAt: '2026-11-18T10:00:00',
})
const noop = () => {}

describe('the allow-list: add and remove', () => {
  it('checks the code before it is sent', () => {
    expect(categoryProblem('  ')).toBe('required')
    expect(categoryProblem('A'.repeat(31))).toBe('tooLong')
    expect(categoryProblem(' A001 ')).toBeNull()
  })

  it('an added category joins the list in code order; adding it again does not duplicate it', () => {
    const list = [cat('A001'), cat('A005')]
    expect(withRow(list, cat('A003'), categoryKey).map(categoryKey)).toEqual(['A001', 'A003', 'A005'])
    expect(withRow(list, cat('A005'), categoryKey).map(categoryKey)).toEqual(['A001', 'A005'])
  })

  it('a removed category leaves the list', () => {
    expect(withoutRow([cat('A001'), cat('A005')], 'A001', categoryKey).map(categoryKey)).toEqual(['A005'])
    expect(withoutRow([cat('A001')], 'A999', categoryKey).map(categoryKey)).toEqual(['A001'])
  })

  it('draws Remove on each row only with MiniPosAdmin:06', () => {
    const rows = [cat('A001'), cat('A002')]
    const viewer = draw(createElement(CategoryList, { rows, canManage: false, onRemove: noop }))
    expect(viewer).toContain('data-minipos-category="A001"')
    expect(viewer).not.toContain('<button')
    const manager = draw(createElement(CategoryList, { rows, canManage: true, onRemove: noop }))
    expect(manager).toContain('data-minipos-category-remove="A001"')
    expect(manager).toContain('data-minipos-category-remove="A002"')
  })

  it('a removal in flight disables its own row only', () => {
    const html = draw(createElement(CategoryList, { rows: [cat('A001'), cat('A002')], canManage: true, busyKey: 'A002', onRemove: noop }))
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-minipos-category-remove="A002"/)
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*data-minipos-category-remove="A001"/)
  })

  it('says an empty allow-list sells nothing', () => {
    expect(draw(createElement(CategoryList, { rows: [], canManage: true, onRemove: noop }))).toContain('Mini POS sells nothing')
  })
})

describe('the refusal list: add with a reason, and remove', () => {
  it('requires the item and a reason, within their widths', () => {
    expect(refusalProblem('', 'x')).toBe('item')
    expect(refusalProblem('1'.repeat(31), 'x')).toBe('itemTooLong')
    expect(refusalProblem('100200', '  ')).toBe('reason')
    expect(refusalProblem('100200', 'x'.repeat(201))).toBe('reasonTooLong')
    expect(refusalProblem(' 100200 ', ' Cold chain ')).toBeNull()
  })

  it('an item refused again takes its new reason, in place', () => {
    const list = [refused('100'), refused('300')]
    const after = withRow(list, refused('300', 'Recalled'), refusedKey)
    expect(after.map((r) => [r.itemNumber, r.reasonNote])).toEqual([
      ['100', 'Cold chain'],
      ['300', 'Recalled'],
    ])
    expect(withoutRow(after, '100', refusedKey).map(refusedKey)).toEqual(['300'])
  })

  it('shows each item with its reason, Remove only with MiniPosAdmin:06', () => {
    const rows = [refused('100200', 'Needs a pharmacist')]
    const viewer = draw(createElement(RefusedList, { rows, canManage: false, onRemove: noop }))
    expect(viewer).toContain('<bdi>Needs a pharmacist</bdi>')
    expect(viewer).not.toContain('<button')
    expect(draw(createElement(RefusedList, { rows, canManage: true, onRemove: noop }))).toContain('data-minipos-refused-remove="100200"')
  })

  it('draws an Arabic reason isolated, in Arabic', () => {
    const html = draw(createElement(RefusedList, { rows: [refused('100200', 'يحتاج إلى صيدلي')], canManage: true, onRemove: noop }), 'ar')
    expect(html).toContain('<bdi>يحتاج إلى صيدلي</bdi>')
    expect(html).toContain('إزالة')
    expect(html).toContain('<bdi dir="ltr">100200</bdi>')
  })
})

describe('the doors', () => {
  beforeEach(() => {
    api.get.mockReset()
    api.post.mockReset()
  })

  it('list, add and remove on both lists', async () => {
    api.get.mockResolvedValue(null)
    api.post.mockResolvedValue(true)
    expect(await miniPosItemsApi.categories()).toEqual([])
    expect(api.get).toHaveBeenLastCalledWith('MiniPosAdmin/AllowedCategories')
    await miniPosItemsApi.addCategory('A001')
    expect(api.post).toHaveBeenLastCalledWith('MiniPosAdmin/AllowedCategories', { aCode: 'A001' })
    await miniPosItemsApi.removeCategory('A001')
    expect(api.post).toHaveBeenLastCalledWith('MiniPosAdmin/AllowedCategories/A001/Remove', {})
    expect(await miniPosItemsApi.refusedItems()).toEqual([])
    expect(api.get).toHaveBeenLastCalledWith('MiniPosAdmin/RefusedItems')
    await miniPosItemsApi.addRefusedItem('100200', 'Cold chain')
    expect(api.post).toHaveBeenLastCalledWith('MiniPosAdmin/RefusedItems', { itemNumber: '100200', reasonNote: 'Cold chain' })
    await miniPosItemsApi.removeRefusedItem('100200')
    expect(api.post).toHaveBeenLastCalledWith('MiniPosAdmin/RefusedItems/100200/Remove', {})
  })
})
