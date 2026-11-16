// The base-map file in development (ticket 879, BackOffice spec 3630 M30; the file and its fixed path are BackOffice
// 3634's). The file is not in git and must not land in `dist/`, so it is not under `public/`: this middleware serves it
// at the one fixed path, `/basemap/ksa-bh.pmtiles`, from the development file BackOffice's
// `Analytics/basemap/build_basemap.py --dev` writes. `OMS_BASEMAP_FILE` points it at another file (the release file,
// say). MapLibre reads the file by byte range, so a range is answered `206`, as IIS answers it in production.
//
// Wired into `vite.config.ts` for `vite` (dev) and `vite preview`. Never part of a build.

import { createReadStream, existsSync, statSync } from 'node:fs'

export const BASEMAP_URL_PATH = '/basemap/ksa-bh.pmtiles'
export const DEFAULT_DEV_BASEMAP_FILE = 'C:/Work/DMSCO/analytics-release/basemap-dev-riyadh-20261116.pmtiles'

/**
 * The bytes a `Range` header asks for, of a file of `size` bytes: `{ start, end }` (inclusive), `'whole'` with no
 * range, or `'unsatisfiable'` (answered 416). One range only, which is all the pmtiles reader sends.
 */
export function byteRange(header, size) {
  if (!header) return 'whole'
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '')) return 'unsatisfiable'
  if (m[1] === '') {
    const n = Math.min(Number(m[2]), size)
    return n === 0 ? 'unsatisfiable' : { start: size - n, end: size - 1 }
  }
  const start = Number(m[1])
  if (start >= size) return 'unsatisfiable'
  const end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  return end < start ? 'unsatisfiable' : { start, end }
}

/** A connect middleware serving the base-map file at its fixed path. */
export function basemapDevMiddleware(file = process.env.OMS_BASEMAP_FILE || DEFAULT_DEV_BASEMAP_FILE) {
  return (req, res, next) => {
    if ((req.url ?? '').split('?')[0] !== BASEMAP_URL_PATH) return next()
    if (!existsSync(file)) {
      res.statusCode = 404
      res.end(`base-map file not found: ${file} (build it with BackOffice Analytics/basemap/build_basemap.py --dev, or set OMS_BASEMAP_FILE)`)
      return
    }
    const size = statSync(file).size
    const range = byteRange(req.headers.range, size)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Type', 'application/octet-stream')
    if (range === 'unsatisfiable') {
      res.statusCode = 416
      res.setHeader('Content-Range', `bytes */${size}`)
      res.end()
      return
    }
    const { start, end } = range === 'whole' ? { start: 0, end: size - 1 } : range
    if (range !== 'whole') {
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
    }
    res.setHeader('Content-Length', String(end - start + 1))
    if (req.method === 'HEAD') return res.end()
    createReadStream(file, { start, end }).pipe(res)
  }
}
