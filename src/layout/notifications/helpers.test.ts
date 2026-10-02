/**
 * `unreadItems` — the bell panel's "N new" chip and its Mark all as read (spec 380 F17,
 * ticket 389; 377 §3).
 *
 * The chip counts what is still unread in the panel, and Mark all as read targets exactly
 * that set, so the two can never disagree. It is the badge's own rule (Active ∧ not
 * expired ∧ not read), so the chip and the badge say the same number.
 */
import { describe, expect, it } from 'vitest'
import type { NotificationItem } from '@/core/models/notifications'
import { unreadCount, unreadItems } from './helpers'

const NOW = Date.parse('2026-10-02T12:00:00Z')

const item = (id: string, over: Partial<NotificationItem> = {}): NotificationItem => ({
  notificationId: id,
  typeCode: 'BROADCAST',
  title: 'Store 1017 closes at 21:00',
  body: 'Route late orders to 1001.',
  createdAt: '2026-10-02T11:40:00Z',
  expiresAt: '2026-10-02T18:00:00Z',
  status: 'Active',
  isRead: false,
  displayStyle: 'Banner',
  readScope: 'Device',
  ...over,
})

describe('new count chip counts unread items only', () => {
  it('counts the unread items and leaves the read ones out', () => {
    const items = [item('a'), item('b', { isRead: true }), item('c', { typeCode: 'JOB_DONE' })]
    expect(unreadItems(items, NOW).map((i) => i.notificationId)).toEqual(['a', 'c'])
  })

  it('leaves out an item that is no longer Active, read or not', () => {
    const items = [item('a', { status: 'Resolved' }), item('b', { status: 'Cancelled' }), item('c')]
    expect(unreadItems(items, NOW).map((i) => i.notificationId)).toEqual(['c'])
  })

  it('leaves out an item that has expired by now', () => {
    const items = [item('a', { expiresAt: '2026-10-02T11:59:59Z' }), item('b')]
    expect(unreadItems(items, NOW).map((i) => i.notificationId)).toEqual(['b'])
  })

  it('is empty when everything is read, so the chip hides', () => {
    expect(unreadItems([item('a', { isRead: true })], NOW)).toEqual([])
  })

  it('says the same number as the badge', () => {
    const items = [item('a'), item('b', { isRead: true }), item('c', { status: 'Claimed' }), item('d')]
    expect(unreadItems(items, NOW)).toHaveLength(unreadCount(items, NOW))
  })

  it('keeps the order it was given', () => {
    const items = [item('z'), item('a'), item('m')]
    expect(unreadItems(items, NOW).map((i) => i.notificationId)).toEqual(['z', 'a', 'm'])
  })
})
