import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MINIPOS_PUBLIC_FILES, miniPosServiceWorker, serviceWorkerSource, shellFiles } from './minipos-sw.mjs'

// oms 928: the Mini POS app installs (its manifest) and reopens with no connection (its worker caches the shell and the
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

// Review 4063 #8: the cache name must change whenever any shell file changes, not only when the list of paths does. The
// page (`index.html`), the manifest and the icons keep their names across builds; with a name hashed from the paths
// alone, a change to any of them never reached an installed phone (same worker bytes: no update, the old cache kept).
describe('the cache is named for the shell’s contents', () => {
  const cacheName = (src) => /const CACHE = '(minipos-[0-9a-f]+)'/.exec(src)[1]
  const shell = ['/minipos/', '/minipos/index.html', '/assets/a.js']

  it('same paths, a file’s content changed: a new cache', () => {
    const v1 = { '/minipos/index.html': '<html>1</html>', '/assets/a.js': 'a' }
    const v2 = { '/minipos/index.html': '<html>2</html>', '/assets/a.js': 'a' }
    expect(cacheName(serviceWorkerSource(shell, (p) => v1[p]))).not.toBe(cacheName(serviceWorkerSource(shell, (p) => v2[p])))
    expect(cacheName(serviceWorkerSource(shell, (p) => v1[p]))).toBe(cacheName(serviceWorkerSource(shell, (p) => ({ ...v1 })[p])))
  })

  const emitted = (htmlSource, manifest) => {
    let sw = null
    const plugin = miniPosServiceWorker({ readPublic: (f) => (f === 'manifest.webmanifest' ? manifest : 'png') })
    const withHtml = { ...bundle, 'minipos/index.html': { type: 'asset', fileName: 'minipos/index.html', source: htmlSource } }
    plugin.generateBundle.call({ emitFile: (f) => (sw = f.source) }, {}, withHtml)
    return cacheName(sw)
  }

  it('the build’s worker: a changed page or a changed manifest is a new cache, an identical build the same one', () => {
    const base = emitted('<html>1</html>', '{"name":"Mini POS"}')
    expect(emitted('<html>1</html>', '{"name":"Mini POS"}')).toBe(base)
    expect(emitted('<html>2</html>', '{"name":"Mini POS"}')).not.toBe(base)
    expect(emitted('<html>1</html>', '{"name":"Mini POS 2"}')).not.toBe(base)
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
