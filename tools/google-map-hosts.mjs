// Google's hosts a map on Google reaches (oms-react 908-911, BackOffice spec 3630, ADR 0139): the one named list the
// map drives let through (910: `report-map-print-drive.mjs`, `copilot-map-drive.mjs`), the map build gate allows (911)
// and BackOffice 3987's PDF proof allows. Measured on 2026-11-17 with Google 3.66: a drawn map reached these four and
// no other host. Every other outside request in a drive is aborted and counted.
export const GOOGLE_MAP_HOSTS = Object.freeze([
  'maps.googleapis.com', // the Maps JavaScript script, its libraries and the raster tiles
  'maps.gstatic.com', // Google's map images: the logo, the controls, the markers' sprites
  'fonts.googleapis.com', // the Roboto stylesheet Google's controls ask for
  'fonts.gstatic.com', // the Roboto font files
])

/** Whether a request's host is one of Google's map hosts (exactly: no sub-domain or look-alike passes). */
export const isGoogleMapHost = (hostname) => GOOGLE_MAP_HOSTS.includes(hostname)

/** A drive's text with the key taken out: the key is passed in an environment variable and never printed. */
export const withoutKey = (text, key) => (key ? String(text).split(key).join('<key>') : String(text)).replace(/([?&]key=)[^&\s"]+/g, '$1<key>')
