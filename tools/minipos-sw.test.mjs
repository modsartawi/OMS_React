import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MINIPOS_PUBLIC_FILES, serviceWorkerSource, shellFiles } from './minipos-sw.mjs'

// oms 916: the Mini POS app installs (its manifest) and reopens with no connection (its worker caches the shell and the
// scanner library). The worker's list is read off the bundle; these prove what it takes and what it leaves.

const chunk = (fileName, over = {}) => ({ type: 'chunk', fileName, isEntry: false, moduleIds: [], imports: [], dynamicImports: [], ...over })

const bundle = {
  'assets/index-a1.js': chunk('assets/index-a1.js', { isEntry: true, moduleIds: ['E:/x/src/app/main.tsx'], imports: ['assets/shared-c3.js', 'assets/grid-d4.js'] }),
  'assets/minipos-b2.js': chunk('assets/minipos-b2.js', {
    isEntry: true,
    moduleIds: ['E:\\x\\src\\app\\minipos-main.tsx', 'E:\\x\\src\\features\\minipos\\phone\\MiniPosPhonePage.tsx'],
    imports: ['assets/shared-c3.js'],
    dynamicImports: ['assets/zxing-e5.js'],
    viteMetadata: { importedCss: new Set(['assets/minipos-f6.css']), importedAssets: new Set() },
  }),
  'assets/shared-c3.js': chunk('assets/shared-c3.js', { viteMetadata: { importedCss: new Set(['assets/shared-g7.css']), importedAssets: new Set() } }),
  'assets/grid-d4.js': chunk('assets/grid-d4.js'),
  'assets/zxing-e5.js': chunk('assets/zxing-e5.js'),
  'minipos/index.html': { type: 'asset', fileName: 'minipos/index.html' },
}

describe('the worker precaches the phone app’s shell', () => {
  it('its entry, the chunks it reaches (the scanner library by its dynamic import), and their styles; not OMS’s', () => {
    expect(shellFiles(bundle)).toEqual([
      '/assets/minipos-b2.js',
      '/assets/minipos-f6.css',
      '/assets/shared-c3.js',
      '/assets/shared-g7.css',
      '/assets/zxing-e5.js',
    ])
  })

  it('a build without the phone app’s entry emits no worker', () => {
    const { ['assets/minipos-b2.js']: _gone, ...omsOnly } = bundle
    expect(shellFiles(omsOnly)).toBeNull()
  })

  it('the cache is named for the shell, so a new build replaces it, and API calls are never cached', () => {
    const a = serviceWorkerSource(['/minipos/', '/assets/a.js'])
    const b = serviceWorkerSource(['/minipos/', '/assets/b.js'])
    const cacheName = (src) => /const CACHE = '(minipos-[0-9a-f]+)'/.exec(src)[1]
    expect(cacheName(a)).not.toBe(cacheName(b))
    expect(cacheName(a)).toBe(cacheName(serviceWorkerSource(['/minipos/', '/assets/a.js'])))
    expect(() => new Function(a)).not.toThrow()
    expect(a).toContain("if (request.method !== 'GET') return")
  })
})

// The installability check, as far as a file can be checked: Chrome's install criteria on the manifest, and icons
// whose pixels are the sizes the manifest claims. The phone itself proves the rest (the 3709 trial).
describe('the web manifest meets the install criteria', () => {
  const manifest = JSON.parse(readFileSync('public/minipos/manifest.webmanifest', 'utf8'))

  it('names, a start URL inside its scope, standalone display', () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true)
    expect(manifest.scope).toBe('/minipos/')
    expect(manifest.display).toBe('standalone')
  })

  it('a 192 and a 512 PNG icon, and a maskable one, each the size it says', () => {
    const png = (src) => {
      const bytes = readFileSync(`public${src}`)
      expect(bytes.subarray(1, 4).toString('latin1')).toBe('PNG')
      return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`
    }
    for (const icon of manifest.icons) expect(png(icon.src)).toBe(icon.sizes)
    const sizes = manifest.icons.filter((i) => i.purpose !== 'maskable').map((i) => i.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)
  })

  it('every icon is in the worker’s shell', () => {
    for (const icon of manifest.icons) expect(MINIPOS_PUBLIC_FILES.map((f) => '/minipos/' + f)).toContain(icon.src)
  })
})
