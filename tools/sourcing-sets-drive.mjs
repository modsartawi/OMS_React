// Weight sets drive (ticket 967, BackOffice spec 4354 §10, §18, §19) — drives the REAL app against a STUBBED wire. The
// weight-set doors (BackOffice 4360) and the marking door (BackOffice 4395) are not built and not specified: the stub
// serves the page's PROVISIONAL shapes (`src/core/models/sourcing-sets.ts`, `WeightSetListItem` in `sourcing-run.ts`)
// from `src/features/oms/sourcing-sets/stub-sets.json`, the same replies the model tests read.
//
// Left to right and right to left (`oms.locale = 'ar'` sets dir="rtl"), asserts:
//   1. the page opens to the run, save or mark grant, and says no access to the view grant alone; without the marking
//      grant there is no marking tab and no "Mark…";
//   2. the list: owner, note, versions, the candidate version, retired / trial set / baseline, figures isolated LTR;
//      the set holding the candidate opens first onto its versions, newest first;
//   3. compare two versions: tick version 5 then 4 of one set, read what differs (changed settings only, grouped,
//      older → newer), then every setting; a third tick drops the oldest pick;
//   4. try to mark without a trial: "Mark…" on a version with no kept trial opens the marking screen, which shows the
//      refusal and its reason, and Mark stays off with the reason box closed;
//   5. mark with a clean trial: the trial's figures (plans changed, orders refused by reason, the promise check per
//      mode), the shelf chance figures that differ with their readings; Mark waits for a reason and a tick on each
//      "too few" / "not steady"; a refusal by the server at the mark shows its reason; marked, the body sent names the
//      version, the reason and the figures spoken to, and the candidate log opens on the new row;
//   6. the candidate log: who, when, before and after, the trial's number and figures, the reason; the seed row;
//   7. no page error and no raw key.
//
//   1. run the app:  npx vite --port 5204 --strictPort
//   2. DRIVE_PORT=5204 node tools/sourcing-sets-drive.mjs
//      (PLAYWRIGHT_CHANNEL=msedge to use the installed Edge when Playwright's own Chromium is not installed)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5204}`
const SHOTS = 'tools/.sourcing-sets-shots'
mkdirSync(SHOTS, { recursive: true })

const STUB = JSON.parse(readFileSync('src/features/oms/sourcing-sets/stub-sets.json', 'utf8'))
const ALL_GRANTS = ['SourcingAdvisorRun:06', 'SourcingAdvisorSave:01', 'SourcingAdvisorMark:06']

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

const isLtrIsolate = (locator) => locator.evaluate((el) => !!el.closest('bdi[dir="ltr"]') || !!el.querySelector('bdi[dir="ltr"]'))
/** Text with its isolates (FSI…PDI) taken out, to match words around a figure. */
const plain = (text) => text.replace(/[⁦-⁩]/g, '')
const RAW_KEY =
  /\b(list|log|mark|diff|why|whyFigure|state|shelf|promise|check|exception|exceptionShort|refusal|kind|settings|groups|reading|tabs|access|value)\.[A-Za-z_]+/

async function scenario(browser, lang) {
  const tag = `[${lang}]`
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1000 },
  })
  await context.addInitScript((l) => {
    localStorage.setItem('oms.locale', l)
    localStorage.setItem('oms.railExpanded', 'false')
  }, lang)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))

  const wire = {
    grants: ALL_GRANTS,
    sets: structuredClone(STUB.sets),
    log: structuredClone(STUB.log),
    versionAsks: [],
    markingAsks: [],
    marks: [],
    refuseNext: false,
  }
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    const q = Object.fromEntries(url.searchParams)
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({
          authenticated: true,
          userId: 'msartawi',
          currentStoreCode: 'P001',
        }),
      )
    if (p === 'Auth/Permissions') return route.fulfill(permissions(wire.grants))
    if (p === 'SourcingAdvisor/WeightSets') return route.fulfill(envelope(wire.sets))
    if (p === 'SourcingAdvisor/WeightSets/Version') {
      wire.versionAsks.push(`${q.name}|${q.version}`)
      const v = STUB.versions.find((x) => x.name === q.name && String(x.version) === q.version)
      return route.fulfill(
        v
          ? envelope(v)
          : envelope(null, {
              status: 404,
              success: false,
              message: 'Not found',
              errors: [{ errorCode: 'ADVISE-404', errorMessage: 'Not found' }],
            }),
      )
    }
    if (p === 'SourcingAdvisor/WeightSets/CandidateLog') return route.fulfill(envelope(wire.log))
    if (p === 'SourcingAdvisor/WeightSets/Marking') {
      wire.markingAsks.push(`${q.name}|${q.version}`)
      return route.fulfill(envelope(STUB.marking[`${q.name}|${q.version}`]))
    }
    if (p === 'SourcingAdvisor/WeightSets/Mark') {
      const body = JSON.parse(route.request().postData() || '{}')
      wire.marks.push(body)
      if (wire.refuseNext) {
        wire.refuseNext = false
        // The server checks again at the mark: the trial aged past 7 days since the screen was read.
        return route.fulfill(
          envelope(null, {
            status: 422,
            success: false,
            message: 'Marking refused',
            errors: [
              {
                errorCode: 'TRIAL_TOO_OLD',
                internalErrorCode: '',
                errorMessage: 'The trial ended 8 days ago.',
              },
            ],
          }),
        )
      }
      const before = { name: 'Express margin', version: 4 }
      const entry = {
        at: '2026-11-27 10:00:00',
        by: 'msartawi',
        before,
        after: { name: body.name, version: body.version },
        reason: body.reason,
        exception: null,
        trial: STUB.marking[`${body.name}|${body.version}`].trial,
        barDay: 20,
      }
      wire.log = [entry, ...wire.log]
      wire.sets = wire.sets.map((s) => ({
        ...s,
        candidateVersion: s.name === body.name ? body.version : null,
      }))
      return route.fulfill(envelope(entry))
    }
    return route.fulfill(envelope({}))
  })

  // 1. the gate
  if (lang === 'en') {
    wire.grants = ['SourcingAdvisor:01']
    await page.goto(`${BASE}/oms/sourcing-sets`)
    await page.getByRole('alert').first().waitFor({ timeout: 15000 })
    const denied = await page.getByRole('alert').first().innerText()
    check(`${tag} the view grant alone opens no weight sets`, /No access to the weight sets/.test(denied), denied.slice(0, 80))

    wire.grants = ['SourcingAdvisorRun:06']
    await page.goto(`${BASE}/oms/sourcing-sets?tab=mark&set=Express%20margin&version=5`)
    await page.locator('[data-sets]').waitFor({ timeout: 15000 })
    check(
      `${tag} the run grant opens the list; no marking tab without the marking grant`,
      (await page.locator('[data-sets-tab]').count()) === 2 && (await page.locator('[data-sets-tab="mark"]').count()) === 0,
    )
    check(
      `${tag} a link to the marking screen without the grant says so, and opens the list`,
      (await page.locator('[data-mark-needs-grant]').count()) === 1 && (await page.locator('[data-mark-version]').count()) === 0,
    )
    wire.grants = ALL_GRANTS
  }

  // 2. the list
  await page.goto(`${BASE}/oms/sourcing-sets`)
  await page.locator('[data-sets]').waitFor({ timeout: 15000 })
  check(
    `${tag} the page is ${lang === 'ar' ? 'right to left' : 'left to right'}`,
    (await page.evaluate(() => document.documentElement.dir)) === (lang === 'ar' ? 'rtl' : 'ltr'),
  )
  check(
    `${tag} three tabs under the marking grant, the list open`,
    (await page.locator('[data-sets-tab]').count()) === 3 && (await page.locator('[data-sourcing-sets]').getAttribute('data-tab')) === 'list',
  )
  check(`${tag} one row per set`, (await page.locator('tr[data-set]').count()) === STUB.sets.length)
  const em = page.locator('tr[data-set="Express margin"]')
  check(
    `${tag} the owner, isolated LTR`,
    (await em.locator('td').nth(1).innerText()).includes('nalharbi') && (await isLtrIsolate(em.locator('td').nth(1).locator('bdi'))),
  )
  check(`${tag} the note as free text`, (await em.locator('td').nth(2).innerText()).includes("November's deliveries"))
  check(`${tag} the candidate version`, plain(await em.locator('[data-candidate-cell]').innerText()).includes('version 4 is the candidate set'))
  const retired = page.locator('tr[data-set="تجربة سجل الصيدلية"]')
  check(
    `${tag} a retired set is shown retired`,
    (await retired.getAttribute('data-retired')) === '' && (await retired.locator('[data-state="retired"]').innerText()).trim() === 'retired',
  )
  check(
    `${tag} the trial set and the baseline are marked`,
    (await page.locator('tr[data-set="Carrier pilot"] [data-state="trial"]').count()) === 1 &&
      (await page.locator('tr[data-set="Baseline"] [data-state="baseline"]').count()) === 1,
  )
  check(`${tag} the baseline belongs to nobody`, (await page.locator('tr[data-set="Baseline"] td').nth(1).innerText()).trim() === 'nobody')
  const versions = await page.locator('tr[data-version^="Express margin|"]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-version')))
  check(
    `${tag} the candidate's set opens first onto its versions, newest first`,
    versions.join(',') === 'Express margin|5,Express margin|4,Express margin|3,Express margin|2,Express margin|1',
    versions.join(','),
  )
  const v4 = page.locator('tr[data-version="Express margin|4"]')
  check(
    `${tag} version 4 is the candidate set, with no "Mark…"`,
    (await v4.locator('[data-is-candidate]').count()) === 1 && (await v4.locator('[data-mark-version]').count()) === 0,
  )
  const v5 = page.locator('tr[data-version="Express margin|5"]')
  check(
    `${tag} a version's saver, time and change line, the time isolated`,
    (await v5.innerText()).includes('Fee weight 0.75') && (await isLtrIsolate(v5.locator('td').nth(3).locator('bdi'))),
  )
  check(
    `${tag} the retired set opens with the retired note and no "Mark…"`,
    await (async () => {
      await page.locator('[data-set-toggle="تجربة سجل الصيدلية"]').click()
      const ok =
        (await page.locator('tr[data-version^="تجربة سجل الصيدلية|"]').count()) === 3 &&
        (await page.locator('[data-mark-version^="تجربة سجل الصيدلية|"]').count()) === 0
      await page.locator('[data-set-toggle="تجربة سجل الصيدلية"]').click()
      return ok
    })(),
  )

  // 3. compare two versions
  check(`${tag} with nothing ticked, the diff asks for two versions`, (await page.locator('[data-diff]').getAttribute('data-diff-state')) === 'pick')
  await page.locator('[data-pick="Express margin|5"]').check()
  await page.locator('[data-pick="Express margin|4"]').check()
  await page.locator('[data-diff][data-diff-state="shown"]').waitFor({ timeout: 10000 })
  const groups = await page.locator('[data-diff-group]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-diff-group')))
  check(`${tag} what differs: the changed settings only, grouped`, groups.join(',') === 'weights,shelf', groups.join(','))
  const diffRows = await page.locator('[data-diff-row]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-diff-row')))
  check(`${tag} the fee weight and five shelf chance figures`, diffRows.length === 6 && diffRows[0] === 'feeWeight', diffRows.join(','))
  const head = plain(await page.locator('[data-diff] thead').innerText())
  check(`${tag} older → newer, whatever order they were ticked`, head.indexOf('version 4') < head.indexOf('version 5') && head.indexOf('version 4') >= 0, head)
  const fee = page.locator('[data-diff-row="feeWeight"] td')
  check(
    `${tag} both values, isolated`,
    (await fee.nth(1).innerText()).trim() === '1' && (await fee.nth(2).innerText()).trim() === '0.75' && (await isLtrIsolate(fee.nth(2).locator('bdi'))),
  )
  const cell = plain(await page.locator('[data-diff-row="shelfChance.DAWAA_NOW.1.L1"] td').first().innerText())
  check(`${tag} a shelf chance figure named by mode, units asked and left over`, /Dawaa Now, 1 asked, 1 left over/.test(cell), cell)
  check(`${tag} its value as a percent`, (await page.locator('[data-diff-row="shelfChance.DAWAA_NOW.1.L1"] td').nth(2).innerText()).trim() === '78.50%')
  check(
    `${tag} both versions read through the version door`,
    wire.versionAsks.includes('Express margin|4') && wire.versionAsks.includes('Express margin|5'),
    wire.versionAsks.join(','),
  )
  await page.locator('[data-diff-every]').click()
  const everyGroups = await page.locator('[data-diff-group]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-diff-group')))
  check(
    `${tag} "Show every setting": every group, the unknown key under "other"`,
    everyGroups.join(',') === 'weights,factors,reach,shelf,other' && (await page.locator('[data-diff-row="pairCap"]').count()) === 1,
    everyGroups.join(','),
  )
  check(
    `${tag} a setting version 5 does not hold reads at its start: no difference`,
    (await page.locator('[data-diff-row="pickUpInDeliveryPlan"]').getAttribute('data-changed')) === 'false',
  )
  check(`${tag} riyals to three decimals`, plain(await page.locator('[data-diff-row="waitingPerHour"] td').nth(2).innerText()).includes('6.500'))
  await page.locator('[data-diff-every]').click()
  await page.screenshot({
    path: `${SHOTS}/${lang}-list-diff.png`,
    fullPage: true,
  })
  await page.locator('[data-set-toggle="Baseline"]').click()
  await page.locator('[data-pick="Baseline|1"]').check()
  check(
    `${tag} a third tick keeps the last two`,
    !(await page.locator('[data-pick="Express margin|5"]').isChecked()) && (await page.locator('[data-pick="Express margin|4"]').isChecked()),
  )
  await page.locator('[data-diff][data-diff-state="shown"]').waitFor({ timeout: 10000 })
  const crossHead = plain(await page.locator('[data-diff] thead').innerText())
  check(`${tag} two sets compare in the order ticked`, crossHead.indexOf('Express margin') < crossHead.indexOf('Baseline'), crossHead)

  // 4. try to mark without a trial
  await page.locator('[data-set-toggle="Wider slot reach"]').click()
  await page.locator('[data-mark-version="Wider slot reach|2"]').click()
  await page.locator('[data-mark-head]').waitFor({ timeout: 10000 })
  const url = new URL(page.url())
  check(
    `${tag} "Mark…" opens the marking screen on that version, in the URL`,
    url.searchParams.get('tab') === 'mark' && url.searchParams.get('set') === 'Wider slot reach' && url.searchParams.get('version') === '2',
    url.search,
  )
  check(`${tag} the marking door read for it`, wire.markingAsks.includes('Wider slot reach|2'))
  const refused = page.locator('[data-mark-refused]')
  check(`${tag} the refusal shows`, (await refused.count()) === 1 && /This marking is refused/.test(await refused.innerText()))
  check(
    `${tag} …with its reason: no kept trial on this version`,
    (await refused.locator('[data-refusal="NO_TRIAL"]').innerText()).includes('No kept trial ran on this version'),
  )
  check(
    `${tag} the fourth check fails, the other three pass`,
    (await page.locator('[data-check="KEPT_TRIAL"]').getAttribute('data-passed')) === 'false' &&
      (await page.locator('[data-check][data-passed="true"]').count()) === 3,
  )
  check(
    `${tag} Mark stays off, the reason box closed`,
    (await page.locator('[data-mark-button]').isDisabled()) &&
      (await page.locator('[data-mark-reason-text]').isDisabled()) &&
      (await page.locator('[data-mark-state]').getAttribute('data-mark-state')) === 'checks',
  )
  await page.screenshot({
    path: `${SHOTS}/${lang}-mark-refused.png`,
    fullPage: true,
  })

  // 5. mark with a clean trial
  await page.locator('[data-mark-pick]').selectOption('Express margin|5')
  await page.locator('[data-mark-trial="T-0036"]').waitFor({ timeout: 10000 })
  check(`${tag} the picker moves the URL`, new URL(page.url()).searchParams.get('version') === '5')
  check(
    `${tag} no refusal: every check passes`,
    (await page.locator('[data-mark-refused]').count()) === 0 && (await page.locator('[data-check][data-passed="true"]').count()) === 4,
  )
  check(`${tag} in place of the candidate set`, plain(await page.locator('[data-mark-head]').innerText()).includes('in place of Express margin, version 4'))
  const trialLine = plain(await page.locator('[data-mark-trial]').innerText())
  check(
    `${tag} the trial's number, period, days and orders`,
    /T-0036/.test(trialLine) && /2026-11-10 – 2026-11-23/.test(trialLine) && /14 whole days/.test(trialLine) && /43,118 orders/.test(trialLine),
    trialLine,
  )
  const plans = plain(await page.locator('[data-mark-plans-changed]').innerText())
  check(`${tag} plans changed against the candidate set, as sent`, plans.includes('5.0%') && plans.includes('2,116 / 42,401'), plans.replace(/\s+/g, ' '))
  const refusedBy = await page.locator('[data-mark-refused-orders] [data-count-row]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-count-row')))
  check(
    `${tag} orders refused by reason, in the spec order`,
    refusedBy.join(',') === 'REACH_WIDER_THAN_READ,HIGHER_PAIR_CAP_ON_CUT_RUN,STORE_NEVER_READ',
    refusedBy.join(','),
  )
  const promise = await page.locator('[data-mark-promise] [data-promise-row]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-promise-row')))
  check(
    `${tag} the promise check per mode under the new version`,
    promise.join(',') === 'DAWAA_NOW,SLOT,PICK_UP-APP_SITE,PICK_UP-CALL_CENTRE',
    promise.join(','),
  )
  const dn = page.locator('[data-mark-promise] [data-promise-row="DAWAA_NOW"] td')
  check(
    `${tag} Dawaa Now: this version beside the candidate, the band isolated`,
    (await dn.nth(2).innerText()).trim() === '91.8%' && (await dn.nth(3).innerText()).trim() === '90.4%' && (await isLtrIsolate(dn.nth(4).locator('bdi'))),
  )
  const shelf = await page
    .locator('[data-shelf-row]')
    .evaluateAll((rows) => rows.map((r) => r.getAttribute('data-shelf-row') + ':' + r.querySelector('[data-reading]').getAttribute('data-reading')))
  check(
    `${tag} every shelf chance figure that differs, with its reading`,
    shelf.join(',') === 'DAWAA_NOW.1.L0:ENOUGH_TO_CHANGE,DAWAA_NOW.1.L1:TOO_FEW,SLOT.1.L2:ENOUGH_TO_CHANGE,SLOT.2.L0:NOT_STEADY,PICK_UP.1.L0:TOO_FEW',
    shelf.join(','),
  )
  check(`${tag} a half with no line reads as a dash`, (await page.locator('[data-shelf-row="PICK_UP.1.L0"] td').nth(8).innerText()).trim() === '—')
  const ticks = await page.locator('[data-speaks-to]').evaluateAll((els) => els.map((e) => e.getAttribute('data-speaks-to')))
  check(`${tag} a tick for each "too few" and "not steady" figure`, ticks.join(',') === 'DAWAA_NOW.1.L1,SLOT.2.L0,PICK_UP.1.L0', ticks.join(','))
  check(
    `${tag} Mark waits for a reason`,
    (await page.locator('[data-mark-button]').isDisabled()) && (await page.locator('[data-mark-state]').getAttribute('data-mark-state')) === 'reason',
  )
  await page.locator('[data-mark-reason-text]').fill('The 4 to 6 km band reads better; the thin cells were read by hand against the counts.')
  await page.locator('[data-speaks-to="DAWAA_NOW.1.L1"]').check()
  await page.locator('[data-speaks-to="SLOT.2.L0"]').check()
  const waiting = plain(await page.locator('[data-mark-state]').innerText())
  check(
    `${tag} …then for every such figure: 2 / 3`,
    (await page.locator('[data-mark-button]').isDisabled()) &&
      (await page.locator('[data-mark-state]').getAttribute('data-mark-state')) === 'figures' &&
      waiting.includes('2 / 3'),
    waiting,
  )
  await page.locator('[data-speaks-to="PICK_UP.1.L0"]').check()
  check(
    `${tag} Mark is on with a reason and every figure spoken to`,
    !(await page.locator('[data-mark-button]').isDisabled()) && (await page.locator('[data-mark-state]').getAttribute('data-mark-state')) === 'ready',
  )

  wire.refuseNext = true
  await page.locator('[data-mark-button]').click()
  await page.locator('[data-mark-server-refused]').waitFor({ timeout: 10000 })
  check(
    `${tag} a refusal at the mark shows its reason in the screen's words`,
    (await page.locator('[data-server-refusal="TRIAL_TOO_OLD"]').innerText()).includes('The trial ended more than 7 days ago'),
  )
  check(`${tag} …and nothing is marked`, (await page.locator('[data-marked]').count()) === 0)

  await page.locator('[data-mark-button]').click()
  await page.locator('[data-marked]').waitFor({ timeout: 10000 })
  const sent = wire.marks.at(-1)
  check(
    `${tag} the body names the version, the reason and the figures spoken to`,
    sent?.name === 'Express margin' &&
      sent?.version === 5 &&
      sent?.reason.startsWith('The 4 to 6 km band') &&
      sent?.spokenTo.join(',') === 'DAWAA_NOW.1.L1,SLOT.2.L0,PICK_UP.1.L0',
    JSON.stringify(sent),
  )
  check(
    `${tag} marked: the screen says so`,
    plain(await page.locator('[data-marked]').innerText()).includes('Express margin, version 5 is now the candidate set'),
  )
  // The list is read again after the mark; the version leaves the picker once the new candidate is read.
  await page
    .locator('[data-mark-pick] option[value="Express margin|5"]')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {})
  check(
    `${tag} …and the form closes: the version is no longer offered`,
    (await page.locator('[data-mark-empty]').count()) === 1 && (await page.locator('[data-mark-pick] option[value="Express margin|5"]').count()) === 0,
  )
  await page.screenshot({
    path: `${SHOTS}/${lang}-marked.png`,
    fullPage: true,
  })

  // 6. the candidate log
  await page.locator('[data-sets-tab="log"]').click()
  await page.locator('[data-log]').waitFor({ timeout: 10000 })
  const first = page.locator('tr[data-log-row]').first()
  check(
    `${tag} the log opens on the new row, newest first`,
    (await first.getAttribute('data-log-row')) === '2026-11-27 10:00:00' &&
      plain(await first.locator('[data-log-after]').innerText()).includes('Express margin, version 5'),
  )
  check(`${tag} who and when, isolated`, (await first.innerText()).includes('msartawi') && (await isLtrIsolate(first.locator('td').first().locator('bdi'))))
  check(
    `${tag} the trial's number and its figures`,
    (await first.locator('[data-log-trial]').innerText()).trim() === 'T-0036' &&
      (await first.innerText()).includes('5.0%') &&
      (await first.innerText()).includes('1.7%'),
  )
  check(`${tag} the bar was counting, and started again`, plain(await first.locator('[data-log-bar]').innerText()).includes('day 20'))
  const detail = page.locator('[data-log-detail="2026-11-27 10:00:00"]')
  check(`${tag} the open row shows the written reason`, (await detail.locator('[data-log-reason]').innerText()).startsWith('The 4 to 6 km band'))
  check(`${tag} …and the promise check per mode`, (await detail.locator('[data-promise-row]').count()) === 4)
  await page.locator('[data-log-toggle="2026-11-18 10:42:05"]').click()
  const older = page.locator('[data-log-detail="2026-11-18 10:42:05"]')
  check(
    `${tag} another row opens: its reason, trial period and refusals in the spec order`,
    (await older.count()) === 1 &&
      plain(await older.innerText()).includes('T-0031') &&
      (await older.locator('[data-count-row]').first().getAttribute('data-count-row')) === 'REACH_WIDER_THAN_READ',
  )
  const seed = page.locator('tr[data-log-row="2026-10-01 00:00:00"]')
  check(
    `${tag} the seed row: nobody marked it, no trial, the first candidate set`,
    (await seed.innerText()).includes('seed') && (await seed.locator('[data-log-trial]').innerText()).trim() === 'first candidate set',
  )
  await page.screenshot({ path: `${SHOTS}/${lang}-log.png`, fullPage: true })

  // back to the list: the new candidate shows
  await page.locator('[data-sets-tab="list"]').click()
  await page.locator('[data-sets]').waitFor({ timeout: 10000 })
  check(
    `${tag} the list reads the new candidate version`,
    plain(await page.locator('tr[data-set="Express margin"] [data-candidate-cell]').innerText()).includes('version 5'),
  )

  // 7. hygiene
  for (const t of ['list', 'log', 'mark']) {
    await page.locator(`[data-sets-tab="${t}"]`).click()
    await page.waitForTimeout(200)
    const text = await page.locator('main').innerText()
    const m = text.match(RAW_KEY)
    if (m) check(`${tag} no raw key on ${t}`, false, m[0])
  }
  check(`${tag} no raw key on the three tabs`, !results.some((r) => r.name.startsWith(`${tag} no raw key on `) && !r.pass))
  check(`${tag} no page error`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

async function run() {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})
  try {
    for (const lang of ['en', 'ar']) await scenario(browser, lang)
  } finally {
    await browser.close()
  }
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
