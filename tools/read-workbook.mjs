// Shared by the export drives: press an Export button, take the download, and read the real
// .xlsx back. Copied from collection-drive's readers, with no dependency beyond node.
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'

function unzipText(buf) {
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  const entries = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const out = {}
  for (let i = 0; i < entries; i++) {
    const method = buf.readUInt16LE(at + 10)
    const size = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const local = buf.readUInt32LE(at + 42)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(dataAt, dataAt + size)
    out[name] = (method === 8 ? inflateRawSync(raw) : raw).toString('utf8')
    at += 46 + nameLen + extraLen + commentLen
  }
  return out
}

const unXml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

function sheetCells(files) {
  const shared = [...(files['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    unXml(m[1].replace(/<[^>]+>/g, '')),
  )
  const xml = files['xl/worksheets/sheet1.xml'] ?? ''
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
    const row = []
    for (const [, attrs, body] of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const letters = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1] ?? 'A'
      const index = [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? 'n'
      const v = /<v>([\s\S]*?)<\/v>/.exec(body ?? '')?.[1]
      const text =
        type === 's' ? (shared[Number(v)] ?? '') : v !== undefined ? unXml(v) : unXml((body ?? '').replace(/<[^>]+>/g, ''))
      row[index] = { text, numeric: type === 'n' && v !== undefined }
    }
    return row
  })
}

/** Today as the export's file name writes it, in local parts. */
export function todayStamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Press `button` and read back what it downloads. */
export async function exportWorkbook(page, button) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), button.click()])
  const grid = sheetCells(unzipText(readFileSync(await download.path())))
  const head = (grid[0] ?? []).map((c) => c?.text ?? '')
  const body = grid.slice(1)
  /** One body cell by its header; `undefined` when the column is not in the file. */
  const at = (row, name) => (head.indexOf(name) < 0 ? undefined : row[head.indexOf(name)])
  return { name: download.suggestedFilename(), head, body, at }
}
