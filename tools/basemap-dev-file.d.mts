import type { IncomingMessage, ServerResponse } from 'node:http'

export declare const BASEMAP_URL_PATH: string
export declare const DEFAULT_DEV_BASEMAP_FILE: string
export declare function byteRange(header: string | undefined, size: number): { start: number; end: number } | 'whole' | 'unsatisfiable'
export declare function basemapDevMiddleware(file?: string): (req: IncomingMessage, res: ServerResponse, next: () => void) => void
