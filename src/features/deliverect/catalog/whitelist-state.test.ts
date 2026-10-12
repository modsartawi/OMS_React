/**
 * Ticket 479 — a whitelist row's state, the writes it offers, and the grid's URL query.
 */
import { describe, expect, it } from 'vitest'
import type { DeliverectWhitelistRow } from '@/core/models/deliverect'
import {
  WHITELIST_PAGE_SIZE,
  rowActions,
  rowState,
  updateBody,
  whitelistFromParams,
  whitelistToParams,
} from './whitelist-state'

const row = (over: Partial<DeliverectWhitelistRow> = {}): DeliverectWhitelistRow => ({
  materialNumber: '101234',
  nameEn: 'Panadol',
  nameAr: 'بنادول',
  gtins: ['6281234567890'],
  disabled: false,
  deleted: false,
  excludedPlatforms: [],
  updatedAt: '2026-10-12T10:00:00',
  updatedBy: 'HSADMIN',
  ...over,
})

describe('rowState', () => {
  it('deleted wins over disabled; else disabled; else active', () => {
    expect(rowState(row())).toBe('active')
    expect(rowState(row({ disabled: true }))).toBe('disabled')
    expect(rowState(row({ deleted: true }))).toBe('deleted')
    expect(rowState(row({ deleted: true, disabled: true }))).toBe('deleted')
  })
})

describe('rowActions', () => {
  it('an active row can be disabled or deleted', () => {
    expect(rowActions(row())).toEqual(['disable', 'delete'])
  })
  it('a disabled row can be restored or deleted', () => {
    expect(rowActions(row({ disabled: true }))).toEqual(['restore', 'delete'])
  })
  it('a deleted row can only be restored', () => {
    expect(rowActions(row({ deleted: true, disabled: true }))).toEqual(['restore'])
  })
})

describe('updateBody — PUT Whitelist/{material}', () => {
  it('disable sends disabled true, deleted false', () => {
    expect(updateBody('disable', row(), 'r')).toEqual({ disabled: true, deleted: false, reason: 'r' })
  })
  it('delete keeps the disabled flag and sends deleted true', () => {
    expect(updateBody('delete', row(), 'r')).toEqual({ disabled: false, deleted: true, reason: 'r' })
    expect(updateBody('delete', row({ disabled: true }), 'r')).toEqual({ disabled: true, deleted: true, reason: 'r' })
  })
  it('restoring a disabled row enables it', () => {
    expect(updateBody('restore', row({ disabled: true }), 'r')).toEqual({ disabled: false, deleted: false, reason: 'r' })
  })
  it('restoring a deleted row undoes the delete ONLY — a row disabled before it stays disabled (one step at a time)', () => {
    expect(updateBody('restore', row({ disabled: true, deleted: true }), 'r')).toEqual({ disabled: true, deleted: false, reason: 'r' })
    expect(updateBody('restore', row({ deleted: true }), 'r')).toEqual({ disabled: false, deleted: false, reason: 'r' })
  })
})

describe('the URL query', () => {
  it('a bare URL is the door’s default: active, no text, the first page of 500', () => {
    expect(WHITELIST_PAGE_SIZE).toBe(500)
    expect(whitelistFromParams(new URLSearchParams())).toEqual({ q: null, state: 'active', skip: 0, take: 500 })
  })

  it('reads state, text and skip', () => {
    expect(whitelistFromParams(new URLSearchParams('state=deleted&q=%20pana%20&skip=500'))).toEqual({
      q: 'pana',
      state: 'deleted',
      skip: 500,
      take: 500,
    })
  })

  it('an unknown state or a bad skip falls back to the default', () => {
    expect(whitelistFromParams(new URLSearchParams('state=gone&skip=-3')).state).toBe('active')
    expect(whitelistFromParams(new URLSearchParams('state=gone&skip=-3')).skip).toBe(0)
    expect(whitelistFromParams(new URLSearchParams('skip=abc')).skip).toBe(0)
    expect(whitelistFromParams(new URLSearchParams('skip=12.5')).skip).toBe(0)
  })

  it('writes only what differs from the default', () => {
    expect(whitelistToParams({ q: null, state: 'active', skip: 0, take: 500 }).toString()).toBe('')
    expect(whitelistToParams({ q: 'pana', state: 'any', skip: 500, take: 500 }).toString()).toBe('state=any&q=pana&skip=500')
  })

  it('round-trips', () => {
    const q = { q: 'بنادول', state: 'disabled' as const, skip: 1000, take: 500 }
    expect(whitelistFromParams(whitelistToParams(q))).toEqual(q)
  })
})
