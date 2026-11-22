// oms 953 (BackOffice spec 4182 §D): drive the whole help's print page against a stubbed help endpoint (BO 4183 is
// not built — the shapes are the guessed ones in src/core/models/help.ts).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/help-print-drive.mjs
//
// Proves in a real browser what vitest cannot: `data-print-ready` waits for the slow pictures (one loads late, one
// is missing), the contents gets page numbers, the page never opens the print dialog itself, Arabic turns the paper
// right to left, and the help center's "Print the guide" opens the route in the help language.
import { createRequire } from 'node:module'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: status < 400, message: status < 400 ? '' : 'Not found', errors: [], data }),
})
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const SLOW_MS = 1500

const meta = (slug, title, order, access = 'viewer') => ({ slug, title, order, access, screens: [], questions: [], checkedAgainst: 'oms 9f07388 · SIS.Api 4.12' })
const TITLES = { en: ['Start here', 'Boards', "What's new"], ar: ['ابدأ هنا', 'اللوحات', 'ما الجديد'] }
const contentsOf = (lang) => ({
  draft: true,
  articles: [meta('whats-new', TITLES[lang][2], 99), meta('start', TITLES[lang][0], 0), meta('boards', TITLES[lang][1], 10, 'author')],
})
const long = Array.from({ length: 60 }, (_, i) => `Paragraph ${i + 1}: a long line of words so the article runs past one page of paper.`).join('\n\n')
const bodies = {
  start: '## Welcome\n\nOpen [My boards](screen:/analytics/boards), then read [sharing](help:boards#share).\n\n![The home](images/home.en.png)',
  boards: `## Share\n\n${long}\n\n![The editor](images/editor.en.png)\n\n![Gone](images/missing.en.png)`,
  'whats-new': '## Lately\n\nNothing yet.',
}

const browser = await chromium.launch()
const errors = []
async function open(lang) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(() => {
    window.__printCalls = 0
    window.print = () => window.__printCalls++
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    const l = url.searchParams.get('lang') === 'ar' ? 'ar' : 'en'
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'drive', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['Analytics:03']))
    if (p === 'help/analytics') return route.fulfill(envelope(contentsOf(l)))
    const img = p.match(/^help\/analytics\/images\/(.+)$/)
    if (img) {
      if (img[1].startsWith('missing')) return route.fulfill(envelope(null, 404))
      if (img[1].startsWith('editor')) await new Promise((r) => setTimeout(r, SLOW_MS))
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG })
    }
    const art = p.match(/^help\/analytics\/([^/]+)$/)
    if (art) {
      const m = contentsOf(l).articles.find((a) => a.slug === art[1])
      return m ? route.fulfill(envelope({ ...m, markdown: bodies[m.slug] })) : route.fulfill(envelope(null, 404))
    }
    return route.fulfill(envelope({}))
  })
  return page
}

// English: readiness waits for the slow picture.
{
  const page = await open('en')
  await page.goto(`${BASE}/analytics/print/help?lang=en`)
  await page.waitForSelector('[data-help-print-article="whats-new"]')
  await page.waitForTimeout(400)
  check('not ready while a picture is still loading', (await page.locator('[data-print-ready]').count()) === 0)
  await page.waitForSelector('[data-print-ready]', { timeout: 10_000 })
  check('ready once every picture settled (one loaded late, one missing)', true)
  const order = await page.locator('[data-help-print-article]').evaluateAll((els) => els.map((e) => e.getAttribute('data-help-print-article')))
  check('articles print in reading order', order.join() === 'start,boards,whats-new', order.join())
  const pages = await page.locator('[data-help-print-page]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-help-print-page'))))
  check('the contents numbers each article (start on 3, boards after it, the long one spans pages)', pages[0] === 3 && pages[1] === 4 && pages[2] > 5, pages.join())
  check('links print as text', (await page.locator('[data-help-print] a, [data-help-print] button').count()) === 0)
  check('the Draft watermark is on the cover', (await page.locator('[data-help-print-cover] [data-help-print-draft]').count()) === 1)
  check('the footer numbers pages with a CSS counter', (await page.locator('style[data-print-page="help"]').textContent()).includes('counter(page)'))
  check('never opens the print dialog itself', (await page.evaluate(() => window.__printCalls)) === 0)
  await page.screenshot({ path: process.env.SHOT_EN || 'help-print-en.png', fullPage: false })
  await page.close()
}

// Arabic: right to left, Arabic words.
{
  const page = await open('ar')
  await page.goto(`${BASE}/analytics/print/help?lang=ar`)
  await page.waitForSelector('[data-print-ready]', { timeout: 10_000 })
  check('Arabic: the document is right to left', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('Arabic: the cover is in Arabic', (await page.locator('[data-help-print-cover] h1').textContent()).includes('دليل المستخدم'))
  check('Arabic: the paper body font includes IBM Plex Sans Arabic', (await page.evaluate(() => getComputedStyle(document.body).fontFamily)).includes('Plex Sans Arabic'))
  await page.close()
}

// The help center's "Print the guide".
{
  const page = await open('en')
  await page.goto(`${BASE}/analytics/help`)
  const link = page.locator('[data-help-print-open]')
  await link.waitFor()
  check('"Print the guide" opens the print route in the help language, in a new tab', (await link.getAttribute('href')) === '/analytics/print/help?lang=en' && (await link.getAttribute('target')) === '_blank')
  await page.close()
}

await browser.close()
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
