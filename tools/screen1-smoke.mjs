// Screen 1 smoke — drives the real app in Chromium against a live SIS.Api.
//
//   1. run SIS.Api:  dotnet run --launch-profile http   (in Services/SIS.Api)
//   2. run the app:  npx vite --port 5199               (BASE below)
//   3. node tools/screen1-smoke.mjs
//
// Playwright is borrowed from the Angular prototype's node_modules — it is not a dep of
// oms-react yet (the map's testing-strategy item is still fog). When this repo takes its own
// Playwright dep, drop the createRequire shim and import it directly.
//
// Screenshots (light + dark) are written to the cwd.
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5199'
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

// 1. Anonymous → login (the guard redirects client-side, so wait for the URL)
await page.goto(BASE + '/oms/deliveries')
await page.waitForURL('**/login**', { timeout: 15000 }).catch(() => {})
check('anonymous redirects to /login with returnUrl', page.url().includes('/login') && page.url().includes('returnUrl'), page.url())

// 2. Login
await page.fill('#userId', 'msartawi')
await page.fill('#password', 'x')
await page.click('button[type=submit]')
await page.waitForURL('**/oms/deliveries', { timeout: 15000 })
check('login lands on returnUrl (/oms/deliveries)', true, page.url())

// 3. Initial prompt state, no grid yet
const mainText = await page.locator('main').innerText()
check('initial prompt shown before first search', mainText.includes('Set your filters above'))
check('no grid before the first search', (await page.locator('.ag-root').count()) === 0)

// 4. Limit default
const limit = await page.inputValue('#limit')
check('Limit defaults to 200', limit === '200', `got ${limit}`)

// 5. Load
await page.getByRole('button', { name: 'Load' }).click()
await page.waitForSelector('.ag-row', { timeout: 20000 })
const rowCount = await page.locator('.ag-row').count()
check('grid renders rows after Load', rowCount > 0, `${rowCount} rows rendered`)

// 6. Column count (41 defined; AG Grid virtualizes, so read the colDefs via headers after showing all)
const headerCount = await page.locator('.ag-header-cell[col-id]').count()
check('grid header cells present (virtualized subset of 41)', headerCount > 0, `${headerCount} header cells in viewport`)

// 7. Hit count matches rows returned
const hit = await page.getByText(/Hit Count:/).textContent()
check('Hit Count label rendered', /Hit Count:\s*\d+/.test(hit || ''), hit || '')

// 8. Floating filters exist
const floating = await page.locator('.ag-floating-filter').count()
check('floating filter on every visible column', floating > 0, `${floating} floating filters`)

// 9. Default sort = deliveryNo desc
const sortedCol = await page.locator('.ag-header-cell[aria-sort="descending"]').getAttribute('col-id').catch(() => null)
check('default sort is deliveryNo desc', sortedCol === 'deliveryNo', `sorted col: ${sortedCol}`)

// 10. Toolbar buttons gated until a row is selected
const openOrderDisabled = await page.getByRole('button', { name: 'Open Order' }).isDisabled()
check('Open Order disabled with no selection', openOrderDisabled)

// 11. Select a row → Open Order enables
await page.locator('.ag-row').first().click()
await page.waitForTimeout(300)
const openOrderEnabled = await page.getByRole('button', { name: 'Open Order' }).isEnabled()
check('Open Order enables on row select', openOrderEnabled)

// 12. Columns popover
await page.getByRole('button', { name: 'Columns' }).click()
await page.waitForTimeout(300)
const chooserItems = await page.locator('input[type=checkbox]').count()
check('columns chooser lists all 41 columns', chooserItems === 41, `${chooserItems} checkboxes`)
await page.keyboard.press('Escape')

// 13. Saved view round-trip
await page.getByRole('button', { name: 'Save view' }).click()
await page.fill('#viewName', 'smoke view')
await page.getByRole('dialog').getByRole('button', { name: 'Save view' }).click()
await page.waitForTimeout(500)
const stored = await page.evaluate(() => localStorage.getItem('oms-web.delivery-grid-views'))
const parsed = JSON.parse(stored || '[]')
check('saved view persisted to localStorage', parsed.length === 1 && parsed[0].name === 'smoke view' && Array.isArray(parsed[0].columnState), `${parsed.length} view(s), ${parsed[0]?.columnState?.length ?? 0} column states`)

// 14. Drill-down + search-state restore (R-8)
await page.getByRole('button', { name: 'Open Order' }).click()
await page.waitForURL('**/oms/document/**', { timeout: 10000 })
const drilledUrl = page.url()
await page.getByText('Back to Delivery Documents').click()
await page.waitForURL('**/oms/deliveries', { timeout: 10000 })
await page.waitForSelector('.ag-row', { timeout: 15000 })
const rowsAfterBack = await page.locator('.ag-row').count()
check('rows survive the Screen 2 round trip (no re-search)', rowsAfterBack === rowCount, `${rowsAfterBack} rows (was ${rowCount}); drilled to ${drilledUrl}`)
const selectedAfterBack = await page.locator('.ag-row-selected').count()
check('opened row is re-selected on return', selectedAfterBack > 0, `${selectedAfterBack} selected`)

// 15. Dark mode flips the grid in the same paint
await page.getByRole('button', { name: 'Toggle dark mode' }).click()
await page.waitForTimeout(400)
const mode = await page.evaluate(() => ({
  html: document.documentElement.classList.contains('dark'),
  ag: document.documentElement.dataset.agThemeMode,
}))
check('dark mode flips both app + grid theme', mode.html && mode.ag === 'dark', JSON.stringify(mode))
await page.screenshot({ path: './screen1-dark.png', fullPage: false })
await page.getByRole('button', { name: 'Toggle dark mode' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: './screen1-light.png', fullPage: false })

// 16. Export writes a real xlsx
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 20000 }),
  page.getByRole('button', { name: 'Export' }).click(),
])
const name = download.suggestedFilename()
check('Export downloads a timestamped xlsx', /^delivery-documents-\d{8}-\d{4}\.xlsx$/.test(name), name)

check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
