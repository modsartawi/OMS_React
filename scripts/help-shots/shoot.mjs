// The help-shots capture run (oms 954, BackOffice spec 4182 §D). Development tooling only — not part of the build or CI.
//
//   SIS_USER=<seed user> SIS_PASS=<password> node scripts/help-shots/shoot.mjs <BackOffice>/Services/SIS.Api/Help/analytics/images
//
// Shoots every entry of shots.json once in English and once in Arabic from the LOCAL app (Vite :5173 → SIS.Api :5111)
// into `<name>.en.png` / `<name>.ar.png`, and rewrites src/features/help/screens.snapshot.json from the table of
// contents. Everything is checked (shots-config.mjs) before a browser starts. See README.md.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { planRun, screensSnapshot } from './shots-config.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const SNAPSHOT = path.resolve(here, '../../src/features/help/screens.snapshot.json')
const AREA = 'analytics'
const WEB = { 'X-Web-Client': '1' }

let plan
try {
  plan = planRun({ argv: process.argv.slice(2), env: process.env, shotsText: readFileSync(path.join(here, 'shots.json'), 'utf8') })
  if (!existsSync(plan.imagesDir) || !statSync(plan.imagesDir).isDirectory()) {
    throw new Error(`The images folder does not exist: ${plan.imagesDir}`)
  }
} catch (err) {
  console.error(err.message)
  process.exit(2)
}
const { base, imagesDir, shots, langs } = plan

const { chromium } = await import('playwright')
const browser = await chromium.launch()
const failed = []
try {
  // ── Sign in once (the secret is read from the environment and never printed or written) ──
  const signIn = await browser.newContext()
  if (process.env.SIS_COOKIE) {
    await signIn.addCookies([{ name: 'sis_session', value: process.env.SIS_COOKIE, url: base }])
  } else {
    await signIn.request.post(`${base}/api/Auth/Login`, {
      headers: { 'Content-Type': 'application/json', ...WEB },
      data: { userId: process.env.SIS_USER, password: process.env.SIS_PASS ?? '' },
    })
  }
  const probe = await signIn.request.get(`${base}/api/Auth/Permissions`, { headers: WEB }).catch(() => null)
  if (probe?.status() !== 200) throw new Error(`Sign-in failed: Auth/Permissions answered ${probe?.status() ?? 'nothing'} at ${base}. Is SIS.Api up?`)
  const session = await signIn.storageState()
  await signIn.close()

  // ── The screens snapshot, from the table of contents ──
  const toc = await browser.newContext({ storageState: session })
  const answer = await toc.request.get(`${base}/api/Help/${AREA}?lang=en`, { headers: WEB })
  if (answer.status() !== 200) throw new Error(`GET Help/${AREA} answered ${answer.status()}: is SIS.Api's help endpoint (BO 4183) running?`)
  const snapshot = screensSnapshot(AREA, (await answer.json()).data)
  writeFileSync(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`wrote ${path.relative(process.cwd(), SNAPSHOT)} (${snapshot.screens.length} screens)`)
  await toc.close()

  // ── Every shot, once per language ──
  for (const lang of langs) {
    const context = await browser.newContext({ storageState: session, viewport: shots[0].viewport })
    // The app's language switch: `oms.locale` read before first paint (decision 9; help follows it through helpLang()).
    await context.addInitScript((locale) => {
      localStorage.setItem('oms.locale', locale)
      localStorage.setItem('oms.railExpanded', 'true')
      localStorage.setItem('oms.darkMode', 'false')
    }, lang)
    const page = await context.newPage()
    for (const shot of shots) {
      const file = path.join(imagesDir, `${shot.name}.${lang}.png`)
      try {
        await page.setViewportSize(shot.viewport)
        await page.goto(`${base}${shot.route}`, { waitUntil: 'networkidle' })
        for (const step of shot.steps) {
          if (step.click) await page.locator(step.click).first().click()
          else if (step.type) await page.locator(step.type.selector).first().fill(step.type.text)
          else if (step.waitFor) await page.locator(step.waitFor).first().waitFor({ state: 'visible' })
        }
        await page.waitForLoadState('networkidle')
        await page.evaluate(() => document.fonts.ready)
        if (shot.crop) await page.locator(shot.crop).first().screenshot({ path: file, animations: 'disabled' })
        else await page.screenshot({ path: file, fullPage: true, animations: 'disabled' })
        console.log(`shot  ${shot.name}.${lang}.png`)
      } catch (err) {
        failed.push(`${shot.name}.${lang}`)
        console.error(`FAIL  ${shot.name}.${lang}.png — ${err.message.split('\n')[0]}`)
      }
    }
    await context.close()
  }
} catch (err) {
  console.error(err.message)
  failed.push('run')
} finally {
  await browser.close()
}
if (failed.length) {
  console.error(`${failed.length} failed: ${failed.join(', ')}`)
  process.exit(1)
}
console.log(`${shots.length * langs.length} images in ${imagesDir}`)
