/**
 * **Add slip** (ticket 322, BackOffice 2035's `## Web contract`) — the pure half of
 * a slip finance files from the drawer: the browser's own check, the multipart form
 * `POST AttachmentWeb/Upload` takes, and when a refusal is worth a retry.
 *
 * Pure: no React, no network, no i18n. The words are the drawer's `t()`; the store
 * that sends lives in `./slip-upload-store`.
 */
import { apiErrorCode, apiErrorKind } from '@/core/api'
import { CASH_CLOSE, STORE_DAY } from './slips'

/** The File Server's cap, 10 MiB. Exactly this many bytes passes; one more is refused. */
export const SLIP_MAX_BYTES = 10_485_760

/** What the picker offers. The check below is what decides; this only narrows the dialog. */
export const SLIP_ACCEPT = '.jpg,.jpeg,.png,.pdf'

/** The kind a day close's slip is filed as. A machine code, never shown. */
export const ECR_SLIP = 'ECR_SLIP'

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf']
const TYPES = ['image/jpeg', 'image/png', 'application/pdf']

/** Why the browser refused a file before sending it: not a slip's type, or over the cap. */
export type SlipFileRefusal = 'type' | 'size'

/**
 * The browser's check, before anything is sent (the server checks both again and
 * answers 415 / 413): the extension **or** the type is jpg/jpeg/png/pdf, and the
 * size is at most `SLIP_MAX_BYTES`. `null` when the file may go.
 *
 * Either one admits the type, because each is sometimes missing: Windows leaves a
 * file's `type` empty for an extension it has no mapping for, and a phone's photo
 * can arrive named without one.
 */
export function slipFileRefusal(file: { name: string; type: string; size: number }): SlipFileRefusal | null {
  const dot = file.name.lastIndexOf('.')
  const extension = dot < 0 ? '' : file.name.slice(dot + 1).trim().toLowerCase()
  const type = file.type.split(';')[0].trim().toLowerCase()
  if (!EXTENSIONS.includes(extension) && !TYPES.includes(type)) return 'type'
  if (!(file.size <= SLIP_MAX_BYTES)) return 'size'
  return null
}

/**
 * Where one picked file stands:
 * - `local-refused`: the browser's check said no. Never sent.
 * - `queued`: passed the check, not yet sent.
 * - `sending`: a request is in flight. It cannot be sent again until it settles.
 * - `stored`: the server answered 200.
 * - `refused`: the server (or the network) said no. `retryable` says whether a retry can help.
 */
export type SlipUploadStatus = 'local-refused' | 'queued' | 'sending' | 'stored' | 'refused'

export interface SlipUpload {
  /**
   * Minted **once per picked file** and reused on every retry of it, so a retry
   * whose first attempt did land is recognised by the server rather than filed
   * twice. Also the item's key on screen.
   */
  clientRequestId: string
  file: File
  status: SlipUploadStatus
  /** Why the browser refused it (`local-refused` only). */
  localRefusal: SlipFileRefusal | null
  /** The failure a `refused` item carries — shown through `apiErrorMessage`, as sent. */
  error: unknown
  /** May a `refused` item be sent again (`isRetryableUpload`)? */
  retryable: boolean
}

/**
 * The files one pick brings in, each with a **new** `ClientRequestId`, checked in
 * the browser. A refused file is kept (it is named with its reason) but never sent;
 * the others still go. No count cap (C9).
 */
export function pickSlipFiles(files: Iterable<File>, mintId: () => string): SlipUpload[] {
  return Array.from(files, (file) => {
    const localRefusal = slipFileRefusal(file)
    return {
      clientRequestId: mintId(),
      file,
      status: localRefusal ? 'local-refused' : 'queued',
      localRefusal,
      error: null,
      retryable: false,
    }
  })
}

/** May this item be sent now? A first send, or a retry the refusal said could help — never one in flight. */
export function canSendSlip(item: SlipUpload): boolean {
  return item.status === 'queued' || (item.status === 'refused' && item.retryable)
}

/**
 * Does this item still need its `ClientRequestId` once its drawer closes? A file in
 * flight (its answer is still to come), and a refusal a retry can still help (the
 * retry must be the same capture). Everything else is settled and is forgotten.
 */
export function keepsIdOnClose(item: SlipUpload): boolean {
  return item.status === 'sending' || (item.status === 'refused' && item.retryable)
}

/**
 * The multipart body of `POST AttachmentWeb/Upload`: exactly the six parts the
 * contract names (`AttachmentFormFields` on pricing2), one file per request.
 *
 * 🔑 **No `SourceDevice`.** A web row names no device, and the server records the
 * session's Ua user as `uploadedBy`. `ownerKey` is the drawer's day's, which
 * `storeDayOwnerKey` built — never re-spelled here.
 */
export function slipUploadForm(item: Pick<SlipUpload, 'clientRequestId' | 'file'>, ownerKey: string): FormData {
  const form = new FormData()
  form.append('ClientRequestId', item.clientRequestId)
  form.append('OwnerKind', STORE_DAY)
  form.append('OwnerKey', ownerKey)
  form.append('Category', CASH_CLOSE)
  form.append('Kind', ECR_SLIP)
  form.append('File', item.file, item.file.name)
  return form
}

/** The one refusal code a retry can cure: the File Server was not reached, and the row stays PENDING. */
export const FILE_SERVER_UNREACHABLE = 'FILE_SERVER_UNREACHABLE'

/**
 * Can a retry (with the same `ClientRequestId`) help? Only when:
 * - the request got no answer — the `network` arm (fetch threw);
 * - the answer was not a JSON envelope — the `server` arm, which `core/api` gives a
 *   codeless 5xx and never gives a code;
 * - the envelope's code is `FILE_SERVER_UNREACHABLE`.
 *
 * 🚩 **The code, never the status.** `NOT_SET_UP` is a 503 too, and a coded 5xx
 * arrives as `business` with its code, so the two differ only by it — a status
 * test would offer a retry for a server that has no File Server at all. Every
 * other refusal (`TOO_LARGE`, `UNSUPPORTED_TYPE`, `CATEGORY_NOT_HELD`,
 * `FILE_SERVER_REFUSED`, `STILL_UPLOADING`, `CAPTURE_REUSED`, `WITHDRAWN`, a field
 * name) says why and offers none.
 *
 * ⚠ The `unknown` arm is **not** retryable. It is where a bare 403 with no body
 * lands (no code, no envelope) — an auth refusal, not a flaky transport, and a
 * retry would only be refused again.
 */
export function isRetryableUpload(err: unknown): boolean {
  const kind = apiErrorKind(err)
  if (kind === 'network' || kind === 'server') return true
  return kind === 'business' && apiErrorCode(err) === FILE_SERVER_UNREACHABLE
}
