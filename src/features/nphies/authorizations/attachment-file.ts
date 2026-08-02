/**
 * **The browser half of preparing an attachment** (ticket 219, contract v1.0
 * §3.5) — the file reader and the canvas, and nothing else.
 *
 * Every *decision* lives next door in `./attachment-prepare`, which is pure and
 * tested. What is left here is the part a test could tell you nothing about: read
 * the file, redraw it smaller, hand back the data URL. It is separated so that
 * "which files are downscaled" and "a PDF over the cap is refused" are node-
 * testable statements rather than things buried in a DOM call.
 *
 * 🚩 **No library.** `FileReader` and `<canvas>` are native, and an image
 * pipeline dependency for one `drawImage` would be a package to keep patched for
 * the life of the portal.
 */

import {
  IMAGE_CONTENT_TYPE,
  IMAGE_JPEG_QUALITY,
  IMAGE_MAX_EDGE,
  planAttachment,
  type AttachmentRefusal,
  type AttachmentTitle,
  type PreparedAttachment,
} from './attachment-prepare'

/** The base64 out of a `data:<mime>;base64,<payload>` URL — what §3.5's
 *  `attachment` field carries, with the prefix the wire has no use for removed. */
function base64Of(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  return comma === -1 ? '' : dataUrl.slice(comma + 1)
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('decode failed'))
    image.src = dataUrl
  })
}

/**
 * Redraw an image at `IMAGE_MAX_EDGE` and re-encode it as JPEG (§3.5).
 *
 * 🚩 An image **smaller** than the cap is still re-encoded, not passed through:
 * the point is not only the pixels but the format — a PNG that stayed a PNG would
 * leave the service's hardcoded `image/jpeg` a lie for the web's traffic too.
 */
async function downscale(file: File): Promise<{ dataUrl: string }> {
  const original = await readDataUrl(file)
  const image = await loadImage(original)
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  // No canvas, no downscale — and the original is NOT sent in its place: the
  // derived content type says `image/jpeg`, and quietly shipping a PNG under it
  // is the mislabelling this whole path exists to stop. The picker says the file
  // could not be read, which is recoverable in one act.
  if (!context) throw new Error('no canvas context')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return { dataUrl: canvas.toDataURL(IMAGE_CONTENT_TYPE, IMAGE_JPEG_QUALITY) }
}

/**
 * Turn a picked file into a row the form holds until `submit` carries it — or
 * into the picker's refusal.
 *
 * `id` is supplied by the caller so this module mints nothing: the row identity
 * is the screen's business, and a generated one here would be a second source of
 * it.
 */
export async function prepareAttachment(
  file: File,
  title: AttachmentTitle,
  id: string,
): Promise<{ ok: true; attachment: PreparedAttachment } | { ok: false; refusal: AttachmentRefusal }> {
  const planned = planAttachment({ type: file.type, size: file.size })
  if (!planned.ok) return planned

  const { dataUrl } = planned.plan.downscale
    ? await downscale(file)
    : { dataUrl: await readDataUrl(file) }
  const attachment = base64Of(dataUrl)

  return {
    ok: true,
    attachment: {
      id,
      title,
      fileName: file.name,
      contentType: planned.plan.contentType,
      attachment,
      // 🚩 The preview reads THIS url — the one the base64 came out of — so what
      // the lightbox shows is exactly what will be sent.
      dataUrl,
      originalBytes: file.size,
      bytes: attachment.length,
    },
  }
}
