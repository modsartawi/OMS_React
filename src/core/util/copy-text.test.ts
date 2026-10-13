import { describe, expect, it } from 'vitest'
import { copyText, type CopyEnv } from './copy-text'

/** An environment that records which path was taken and what each was handed. */
function env(over: Partial<CopyEnv> & { api?: 'ok' | 'reject' | 'throw' | 'none'; exec?: 'ok' | 'false' | 'throw' } = {}) {
  const seen = { api: [] as string[], exec: [] as { text: string; container: unknown }[] }
  const { api = 'ok', exec = 'ok', ...rest } = over
  const e: CopyEnv = {
    secure: true,
    clipboard:
      api === 'none'
        ? undefined
        : {
            writeText: (text: string) => {
              seen.api.push(text)
              if (api === 'throw') throw new Error('no')
              return api === 'ok' ? Promise.resolve() : Promise.reject(new Error('denied'))
            },
          },
    execCopy: (text, container) => {
      seen.exec.push({ text, container })
      if (exec === 'throw') throw new Error('no')
      return exec === 'ok'
    },
    ...rest,
  }
  return { e, seen }
}

describe('copyText', () => {
  it('uses the clipboard API in a secure context, and never the fallback', async () => {
    const { e, seen } = env()
    expect(await copyText('abc', {}, e)).toBe('copied')
    expect(seen.api).toEqual(['abc'])
    expect(seen.exec).toEqual([])
  })

  it('falls back when there is no clipboard API (plain http has none)', async () => {
    const { e, seen } = env({ api: 'none' })
    expect(await copyText('abc', {}, e)).toBe('copied')
    expect(seen.exec).toEqual([{ text: 'abc', container: undefined }])
  })

  it('falls back when the context is not secure, even if the API is there', async () => {
    const { e, seen } = env({ secure: false })
    expect(await copyText('abc', {}, e)).toBe('copied')
    expect(seen.api).toEqual([])
    expect(seen.exec).toHaveLength(1)
  })

  it('falls back after the API rejects', async () => {
    const { e, seen } = env({ api: 'reject' })
    expect(await copyText('abc', {}, e)).toBe('copied')
    expect(seen.api).toEqual(['abc'])
    expect(seen.exec).toHaveLength(1)
  })

  it('falls back when the API throws instead of rejecting', async () => {
    const { e, seen } = env({ api: 'throw' })
    expect(await copyText('abc', {}, e)).toBe('copied')
    expect(seen.exec).toHaveLength(1)
  })

  it('hands the fallback the container a dialog passes', async () => {
    const dialog = { tag: 'dialog' }
    const { e, seen } = env({ api: 'none' })
    await copyText('abc', { container: dialog as unknown as HTMLElement }, e)
    expect(seen.exec[0].container).toBe(dialog)
  })

  it('is failed when both paths fail, and never throws', async () => {
    expect(await copyText('abc', {}, env({ api: 'reject', exec: 'false' }).e)).toBe('failed')
    expect(await copyText('abc', {}, env({ api: 'none', exec: 'throw' }).e)).toBe('failed')
    expect(await copyText('abc', {}, env({ api: 'throw', exec: 'throw' }).e)).toBe('failed')
  })

  it('is failed in an environment with no DOM at all (the default env under node)', async () => {
    expect(await copyText('abc')).toBe('failed')
  })
})
