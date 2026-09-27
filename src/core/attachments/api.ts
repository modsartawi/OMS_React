/**
 * The attachment register's web door (`AttachmentWeb/*`) — **graduated to `core/` by
 * ticket 325**, on the road `@/core/collection/api` (268) took.
 *
 * 🚩 Why it moved. The ECR-slip drawer (spec 319) was its one reader, in
 * `features/collection/inquiry`. Spec 324 adds a second — the order page's
 * Attachments tab in `features/oms/document` — and a feature may not import another
 * feature (`.claude/rules/feature-structure.md`, BackOffice 2050 G3). So the probe,
 * ByOwner, `/Content`, Upload and Withdraw live here, parameterised by owner kind and
 * key, and each caller passes its own constants.
 *
 * Every call goes through `@/core/api` (`.claude/rules/api-envelope.md`). Every
 * key sits under ONE `attachments` head, spelled once below; invalidate by the exact
 * key, never by the head, or the probe re-asks too.
 */
import { api, type FileResponse } from '@/core/api'
import type {
  AttachmentAccess,
  AttachmentOwner,
  AttachmentOwnerSiblings,
  StoredAttachment,
  WithdrawnAttachment,
} from '@/core/models/attachment'
import { attachmentOwnerList, type AttachmentOwnerList } from './rules'
import type { WithdrawBody } from './withdraw'

/**
 * The ONE cache key and options for `GET AttachmentWeb/Access` (ticket 320, lifted
 * by 325) — the attachment probe. The Ready and Cash Collections grids read it for
 * the Slips column and the filter, the slip drawer, its Add and its Withdraw read
 * the **same** entry, and so does the order page (327): one request per page life,
 * never a second fetch or a per-component copy.
 *
 * Kept with `assignmentOptionsQuery`'s pattern and for its reasons: react-query
 * merges concurrent observers' options, so the key and its options travel together.
 * `staleTime: Infinity` because a grant does not change inside a page life;
 * `retry: false` because a 503 `NOT_SET_UP` or a 403 is an answer, and what it
 * gates stays hidden on the first no rather than after three.
 *
 * 🚩 Read what it answers through `holdsCategory` (`./rules`), never by truthiness.
 */
export const ATTACHMENT_ACCESS_KEY = ['attachments', 'access'] as const

export function attachmentAccessQuery() {
  return {
    queryKey: ATTACHMENT_ACCESS_KEY,
    queryFn: () => attachmentsApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The ONE cache key for an owner's file list (ticket 321, lifted by 325), by owner
 * kind and key. The panel reads it; an Add and a Withdraw re-read the same entry, so
 * nothing re-spells it.
 *
 * ⚠️ It shares the `['attachments']` head with the probe. Invalidate by THIS key,
 * never by the head, or the probe re-asks too.
 */
export const attachmentsByOwnerKey = ({ ownerKind, ownerKey }: AttachmentOwner) =>
  ['attachments', 'by-owner', ownerKind, ownerKey] as const

/**
 * How fresh a caller keeps an owner's list — a **parameter**, not a constant of the
 * read, because every ByOwner writes an audit row on the server and the two callers
 * need different things:
 * - the slip drawer reads on every opening (`READ_ON_EVERY_OPENING`): a slip filed at
 *   a till a minute ago must be there;
 * - the order tab (327) reads once per page visit, on the tab's first selection.
 *
 * Only these four options: the key and `retry` are the read's own. Whether the read
 * runs at all (327's first-selection latch) is `enabled`, which the caller sets beside.
 */
export type AttachmentFreshness = {
  staleTime?: number
  gcTime?: number
  refetchOnWindowFocus?: boolean
  refetchOnReconnect?: boolean
}

/**
 * The slip drawer's freshness: nothing over the app's defaults. `staleTime` 0, so each
 * opening of a drawer (a new mount of its body) reads the owner again.
 */
export const READ_ON_EVERY_OPENING: AttachmentFreshness = {}

/**
 * `ByOwner`'s query options, fresh as the caller says.
 *
 * `retry: false`, as the probe: a 503 `NOT_SET_UP` or a bare 403 is an answer, and
 * the panel says so on the first no rather than after a retry.
 */
export function attachmentsByOwnerQuery(owner: AttachmentOwner, freshness: AttachmentFreshness) {
  return {
    ...freshness,
    queryKey: attachmentsByOwnerKey(owner),
    queryFn: () => attachmentsApi.byOwner(owner),
    retry: false,
  } as const
}

/**
 * One file's bytes for the preview (ticket 321, lifted by 325), fetched once per
 * selection. The same blob is what Download saves, so a download never fetches a
 * second time.
 *
 * `gcTime: 0`: the bytes leave the cache the moment nothing previews them — a file
 * withdrawn meanwhile must not stay readable out of a cache, and a reselection reads
 * the door again. `retry: false`: a 404 or a 502 is an answer, and a 502
 * `FILE_SERVER_MISSING` is not the user's fault and has no retry.
 */
export const attachmentContentKey = (attachmentId: string) => ['attachments', 'content', attachmentId] as const

export function attachmentContentQuery(attachmentId: string) {
  return {
    queryKey: attachmentContentKey(attachmentId),
    queryFn: () => attachmentsApi.content(attachmentId),
    gcTime: 0,
    retry: false,
  } as const
}

export const attachmentsApi = {
  /**
   * `GET AttachmentWeb/Access` → the attachment categories the session holds, and
   * the ones it may withdraw from (BackOffice 2034, 2035). Cookie-only and **not**
   * grant-gated; a 503 `NOT_SET_UP` until the File Server key exists.
   *
   * ⚠️ **Fails closed**: no catch here. A refusal leaves the query without data, and
   * `holdsCategory(undefined, …)` is false. Read it through `attachmentAccessQuery()`,
   * never directly.
   */
  access(): Promise<AttachmentAccess> {
    return api.get<AttachmentAccess>('AttachmentWeb/Access')
  },

  /**
   * `GET AttachmentWeb/ByOwner?ownerKind=<kind>&ownerKey=<key>` → an owner's files
   * (BackOffice 2034 + 2035): `data` is the STORED files, newest first, and
   * `withdrawn` rides BESIDE it.
   *
   * 🔑 Through `getEnvelope`, not `get`, for that sibling. `ownerKey` is the
   * caller's (a store day's is `storeDayOwnerKey`'s), never re-spelled here;
   * `buildQuery` encodes its `/`.
   */
  byOwner({ ownerKind, ownerKey }: AttachmentOwner): Promise<AttachmentOwnerList> {
    return api
      .getEnvelope<StoredAttachment[], AttachmentOwnerSiblings>('AttachmentWeb/ByOwner', { ownerKind, ownerKey })
      .then(attachmentOwnerList)
  },

  /**
   * `GET AttachmentWeb/{attachmentId}/Content` → one file's bytes, through
   * `api.blob` (ticket 321). The blob's `type` is the row's content type, which is
   * what picks the preview. The route's `Content-Disposition: attachment` means
   * nothing to a fetch.
   *
   * ⚠️ Every refusal is enveloped and coded: 404 `NOT_FOUND` (not a stored file any
   * more), 502 `FILE_SERVER_MISSING` (the File Server lost the file), and the 503s.
   * Read them with `attachmentContentFailure`, by code.
   */
  content(attachmentId: string): Promise<FileResponse> {
    return api.blob(`AttachmentWeb/${encodeURIComponent(attachmentId)}/Content`)
  },

  /**
   * `POST AttachmentWeb/Upload` → one file filed (ticket 322, BackOffice 2035),
   * answered with the stored attachment. One request per file, through `api.upload`.
   *
   * ⚠ `./upload` builds the form (`attachmentUploadForm`): the part names are this
   * door's contract, and `core/api` never learns them. Every refusal is enveloped and
   * coded, except a bare 403; read it with `isRetryableUpload`, by code.
   */
  upload(form: FormData): Promise<StoredAttachment> {
    return api.upload<StoredAttachment>('AttachmentWeb/Upload', form)
  },

  /**
   * `POST AttachmentWeb/{attachmentId}/Withdraw`, body `{ reasonCode, note }` →
   * the withdrawn file (ticket 323, BackOffice 2035). Final: there is no restore.
   * A file already withdrawn answers 200 with its row unchanged.
   *
   * ⚠ Its refusals are coded (400 `reasonCode` / `note`, 404 `NOT_FOUND`, 503
   * `NOT_SET_UP`) except the grant filter's 403, which has no body. Read them with
   * `withdrawAnswer`. The id rides as a path segment, `encodeURIComponent`'d as
   * `/Content`'s is.
   */
  withdraw(attachmentId: string, body: WithdrawBody): Promise<WithdrawnAttachment> {
    return api.post<WithdrawnAttachment>(`AttachmentWeb/${encodeURIComponent(attachmentId)}/Withdraw`, body)
  },
}
