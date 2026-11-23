/**
 * The help-shots capture run's pure core (oms 954, BackOffice spec 4182 §D): everything the run checks before a
 * browser starts. `shoot.mjs` is the thin Playwright shell around it; this file imports nothing but the standard
 * library so vitest proves it in node.
 */

/** The hosts the run will shoot — the local app only (the ticket's "never points at a hosted environment"). */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * The base URL the run will drive, without a trailing slash — or a throw when it is not the local app. Local seeded
 * data only: staging and production hold real stores and real people.
 */
export function localBase(raw) {
  let url
  try {
    url = new URL(String(raw))
  } catch {
    throw new Error(`HELP_SHOTS_BASE must be the local app on localhost (got ${JSON.stringify(raw)}).`)
  }
  if (!['http:', 'https:'].includes(url.protocol) || !LOCAL_HOSTS.has(url.hostname) || url.username || url.password) {
    throw new Error(`HELP_SHOTS_BASE must be the local app on localhost, never a hosted environment (got ${url.origin}).`)
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

/** The ticket's default screen: a laptop-sized window. */
export const DEFAULT_VIEWPORT = Object.freeze({ width: 1440, height: 900 })

/** Each screen is shot once per help language, English first. */
export const HELP_LANGS = Object.freeze(['en', 'ar'])

/** A shot's name becomes `<name>.en.png` / `<name>.ar.png`, which the articles reference — so lower-case and dashes. */
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const isText = (v) => typeof v === 'string' && v.trim() !== ''
const isSize = (v) => Number.isInteger(v) && v > 0

/** One setup step: `{ click: selector }`, `{ waitFor: selector }` or `{ type: { selector, text } }`. */
function stepProblem(step) {
  if (typeof step !== 'object' || step === null || Object.keys(step).length !== 1) return 'is not one of click, type, waitFor'
  if ('click' in step) return isText(step.click) ? null : 'click needs a selector'
  if ('waitFor' in step) return isText(step.waitFor) ? null : 'waitFor needs a selector'
  if ('type' in step) return isText(step.type?.selector) && typeof step.type?.text === 'string' ? null : 'type needs { selector, text }'
  return 'is not one of click, type, waitFor'
}

/**
 * The shot list (`shots.json`) read and checked whole, with the defaults filled in — or one throw naming every problem,
 * so a broken list is fixed in one pass and never half-shot.
 */
export function parseShots(text) {
  let doc
  try {
    doc = JSON.parse(text)
  } catch {
    throw new Error('shots.json is not JSON: it must be { "shots": [ … ] }.')
  }
  const list = doc?.shots
  if (!Array.isArray(list) || list.length === 0) throw new Error('shots.json must be { "shots": [ … ] } with at least one shot.')

  const problems = []
  const seen = new Set()
  const shots = list.map((shot, i) => {
    const at = `shots[${i}]`
    if (typeof shot !== 'object' || shot === null) {
      problems.push(`${at} is not an object`)
      return null
    }
    const { name, route, crop, fullPage = false, viewport = DEFAULT_VIEWPORT, steps = [], hide = [], maxHeight = null, pad = 12 } = shot
    if (typeof name !== 'string' || !NAME.test(name)) problems.push(`${at} name ${JSON.stringify(name)} must be lower-case words joined by dashes`)
    else if (seen.has(name)) problems.push(`${at} name "${name}" is used twice`)
    else seen.add(name)
    if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//')) problems.push(`${at} route must be an app path starting with "/"`)
    const hasCrop = crop !== undefined && crop !== null
    // A tight crop (owner 2026-11-23): one selector, or a list shot as the one box around them all.
    if (hasCrop && !isText(crop) && !(Array.isArray(crop) && crop.length > 0 && crop.every(isText))) {
      problems.push(`${at} crop must be a selector or a list of selectors`)
    }
    if (maxHeight !== null && !isSize(maxHeight)) problems.push(`${at} maxHeight must be whole pixels`)
    if (!Array.isArray(hide) || !hide.every(isText)) problems.push(`${at} hide must be a list of selectors`)
    if (!Number.isInteger(pad) || pad < 0) problems.push(`${at} pad must be whole pixels, 0 or more`)
    if (typeof fullPage !== 'boolean') problems.push(`${at} fullPage must be true or false`)
    if (hasCrop && fullPage === true) problems.push(`${at} takes a crop or fullPage, not both`)
    if (!hasCrop && fullPage !== true) problems.push(`${at} takes a crop or fullPage: true`)
    if (!isSize(viewport?.width) || !isSize(viewport?.height)) problems.push(`${at} viewport must be { width, height } in whole pixels`)
    if (!Array.isArray(steps)) problems.push(`${at} steps must be a list`)
    else steps.forEach((step, j) => {
      const problem = stepProblem(step)
      if (problem) problems.push(`${at} steps[${j}] ${problem}`)
    })
    return {
      name,
      route,
      crop: hasCrop ? crop : null,
      fullPage,
      viewport: { width: viewport?.width, height: viewport?.height },
      steps,
      hide,
      maxHeight,
      pad,
    }
  })
  if (problems.length) throw new Error(`shots.json has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`)
  return shots
}

/**
 * Where the Arabic guide's pictures come from (`"arabic"` at the top of shots.json): `"shoot"` (the default) shoots
 * each language; `"english"` shoots once in English and writes the same picture as `<name>.ar.png`. The owner's ruling
 * of 2026-11-23: while the app's own labels are English only, an Arabic shot is English text mirrored, so the Arabic
 * guide shows the English shots. Switch back to `"shoot"` once the labels are in Arabic, and re-run.
 */
function arabicSource(text) {
  const value = JSON.parse(text)?.arabic ?? 'shoot'
  if (value !== 'shoot' && value !== 'english') throw new Error(`shots.json arabic must be "shoot" or "english" (got ${JSON.stringify(value)}).`)
  return value
}

/**
 * Everything the run needs, checked before a browser starts: the BackOffice images folder (the one argument), the
 * local base (`HELP_SHOTS_BASE`, default the Vite dev server), a sign-in in the environment (`SIS_USER` + `SIS_PASS`,
 * or `SIS_COOKIE`) and a valid shot list. The secrets stay in `env`; nothing here repeats them.
 */
export function planRun({ argv, env, shotsText }) {
  const imagesDir = argv[0]
  if (!isText(imagesDir)) {
    throw new Error('Give the BackOffice images folder: node scripts/help-shots/shoot.mjs <BackOffice>/Services/SIS.Api/Help/analytics/images')
  }
  const base = localBase(env.HELP_SHOTS_BASE || 'http://localhost:5173')
  if (!isText(env.SIS_USER) && !isText(env.SIS_COOKIE) && !isText(env.SIS_STATE)) {
    throw new Error('No sign-in: set SIS_USER and SIS_PASS (the seed test user), SIS_COOKIE, or SIS_STATE (a saved browser session file) in the environment.')
  }
  const shots = parseShots(shotsText)
  const arabicFromEnglish = arabicSource(shotsText) === 'english'
  return { base, imagesDir, shots, langs: arabicFromEnglish ? ['en'] : [...HELP_LANGS], arabicFromEnglish }
}

/**
 * `src/features/help/screens.snapshot.json` (951's format) from the table of contents the server answered: every
 * article's `screens`, once each, in reading order. 951's test checks each against `router.tsx`. An answer with no
 * screens at all is refused — it would empty the guard rather than refresh it.
 */
export function screensSnapshot(area, contents) {
  const screens = [...new Set((contents?.articles ?? []).flatMap((a) => (Array.isArray(a.screens) ? a.screens : [])))]
  if (screens.length === 0) throw new Error(`The ${area} table of contents names no screens; the snapshot is left as it was.`)
  return {
    note: `Every \`screens\` route of the ${area} help's table of contents. Written by the capture script (oms 954, scripts/help-shots) from GET Help/${area}; do not edit by hand.`,
    area,
    screens,
  }
}
