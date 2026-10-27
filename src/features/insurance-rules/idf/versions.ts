/**
 * An IDF master's version history, pure (BackOffice spec 3157, door 3161; oms ticket 623).
 * `GET IdfPriority/masters/{id}/versions` lists every version (number, by, at, note); `POST …/versions/{versionId}/
 * restore { note }` makes a NEW version from an earlier one, now live. **Restore never overwrites**: the restored
 * version stays in the list as it was. The live version offers no Restore.
 *
 * Which one is live: the server's `isLive` when it sends one, else the master's `liveVersion.versionId`.
 */
import type { IdfMasterVersion } from './masters'

/** A row of `GET …/versions`. `isLive` is optional — the brief only says the live one is marked. */
export interface IdfVersion extends IdfMasterVersion {
  isLive?: boolean | null
}

export interface IdfVersionRow extends IdfVersion {
  live: boolean
  restorable: boolean
}

function isLive(v: IdfVersion, liveVersionId: string | null | undefined): boolean {
  if (typeof v.isLive === 'boolean') return v.isLive
  return !!liveVersionId && v.versionId === liveVersionId
}

/** Only a version that is not live may be restored. */
export function canRestore(v: IdfVersion, liveVersionId: string | null | undefined): boolean {
  return !isLive(v, liveVersionId)
}

/** The history newest first (by number), each row marked live and restorable. */
export function versionRows(versions: IdfVersion[] | null | undefined, liveVersionId: string | null | undefined): IdfVersionRow[] {
  return [...(versions ?? [])]
    .sort((a, b) => b.number - a.number)
    .map((v) => ({ ...v, live: isLive(v, liveVersionId), restorable: canRestore(v, liveVersionId) }))
}
