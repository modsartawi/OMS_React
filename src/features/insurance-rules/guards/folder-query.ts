/** The Guards list's address: `?folder=<path>` (607). Module-level, as `useUrlQuery` needs. */
export const folderFromParams = (p: URLSearchParams): string => p.get('folder') ?? ''
export const folderToParams = (folder: string): URLSearchParams => new URLSearchParams(folder ? { folder } : {})
