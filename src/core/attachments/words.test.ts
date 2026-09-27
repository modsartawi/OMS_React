/**
 * The attachments panel's own words (ticket 326): the `attachments` namespace is
 * registered centrally, and every key the panel's components ask for is in the bundle.
 *
 * 🔑 No gate catches a raw key: a `t()` call with no backing key renders the key
 * itself to users (`.claude/rules/i18n-zero-literal.md`). So this reads the panel's
 * sources and checks each literal key against `attachments.json`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import i18n from '@/core/i18n'
import en from '@/locales/en/attachments.json'
import type { AttachmentUploadStatus } from './upload'

const DIR = join(__dirname)
const SOURCES = readdirSync(DIR).filter((f) => f.endsWith('.tsx'))

/** Read a dotted key out of the attachments bundle. */
const bundle = (key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en)

describe('the attachments namespace', () => {
  it('is registered, so t("attachments:…") resolves rather than rendering the key', () => {
    expect(i18n.options.ns).toContain('attachments')
    expect(i18n.hasResourceBundle('en', 'attachments')).toBe(true)
    expect(i18n.t('attachments:source.webBy', { uploadedBy: 'U123' })).toBe('Web · U123')
  })

  it('backs every literal key the panel components ask for with a string', () => {
    expect(SOURCES.length).toBeGreaterThan(0)
    const keys = SOURCES.flatMap((file) =>
      [...readFileSync(join(DIR, file), 'utf8').matchAll(/\bt\(\s*'([^']+)'/g)].map((m) => ({ file, key: m[1] })),
    )
    expect(keys.length).toBeGreaterThan(0)
    const missing = keys.filter(({ key }) => typeof bundle(key) !== 'string')
    expect(missing).toEqual([])
  })

  it('has a label for every upload status (the one key built from a value)', () => {
    const statuses: AttachmentUploadStatus[] = ['local-refused', 'queued', 'sending', 'stored', 'refused']
    for (const status of statuses) expect(typeof bundle(`add.status.${status}`)).toBe('string')
  })
})
