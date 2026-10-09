# Runs /implement + /standards-review for the BackOffice spec 2544 Materials tickets ("material search & detail, stock check, GS1 check") in fresh Claude Code sessions,
# sequentially, fully AFK.
#
#   .\run-implements-spec2544.ps1                  (451, 453, 454, 452)
#   .\run-implements-spec2544.ps1 -Tickets 454,452
#   .\run-implements-spec2544.ps1 -DryRun          (pre-flight + plan only, starts nothing)
#   .\run-implements-spec2544.ps1 -SkipReview      (implement rounds only)
#   .\run-implements-spec2544.ps1 -SmokeTest       (one trivial session through the real harness)
#
# ASCII only, on purpose: Windows PowerShell 5.1 reads a BOM-less .ps1 as ANSI, so a stray
# em dash silently becomes mojibake and can break the parse. Keep every character 7-bit.
#
# ---------------------------------------------------------------------------------------
# WHY THIS RUNNER CANNOT WEDGE
#
# Piping `claude ... | ForEach-Object` straight into the console has three ways to look
# "stuck" forever. This runner closes all of them:
#
#  1. The child never inherits your console. It is launched with Start-Process, stdout and
#     stderr redirected to FILES, and stdin redirected from an EMPTY FILE - so it reads EOF
#     instantly and can never block waiting for input, and it can never emit an escape
#     sequence that clears or repaints your terminal. This script does all the printing,
#     from the parsed stream.
#  2. A STALL WATCHDOG. If no new stream line arrives for -StallMinutes (default 25), the
#     whole process TREE is killed with taskkill /T /F and the loop stops with a named
#     verdict. A hard per-session ceiling of -MaxHours (default 5) does the same.
#  3. A HEARTBEAT. Every 60 seconds of silence prints one line naming the tool still
#     running and how long it has been quiet, so the terminal is never blank-and-ambiguous.
#     A long quiet stretch under a "-> Bash npm run build" line is a build, not a hang.
#
# Also deliberate: no `2>&1` on a native exe (in PS 5.1 that wraps stderr in ErrorRecords
# and sets $? false on a clean exit 0), and the giant AFK system prompt travels as a FILE,
# never as a quoted command-line argument. The child still hands it to claude as ONE native
# arg, so it escapes every embedded double quote first (see the child runner below).
#
# ---------------------------------------------------------------------------------------
# WHAT EACH ROUND DOES
#
#   round A   claude -p "/implement <t>"                 -> commits the slice
#   round B   claude -p "/standards-review since <sha>"  -> read-only, writes
#             .afk\REVIEW-<t>.md and prints its verdict in this terminal
#
# <sha> is HEAD as it stood BEFORE round A, so the review sees exactly that ticket's diff.
# Round B never edits or commits; a failure there WARNS and the loop continues (the report
# is morning triage, not a gate). Round A failing stops the loop immediately.
#
# ---------------------------------------------------------------------------------------
# Dependency map (BackOffice spec 2544, governing spec in the C# repo; nothing landed yet; 455 is live-only and excluded from this run):
#   451 --+--> 452 --+
#         +--> 453 --+--> 455  (live doors on staging + owner walk - NOT in this run)
#         \--> 454 --+
#
# Running order:
#   * 451 first: it registers the whole area (route tree, menu group, the MaterialWeb/Access probe,
#     src\core\models\materials.ts). Everything after it extends what it settles.
#   * 453 BEFORE 452 although they are siblings: both call POST MaterialWeb/Stock and both must show
#     the MAT-00004 "Stock Visibility unavailable" state. 453 builds that call, its request builder
#     and the unavailable panel in src\core\materials\ (two consumers -> core); 452's Stock tab
#     reuses them. The other way round, 452 ships a feature-local copy and 453 has to graduate it.
#   * 452 LAST: it is the only slice that touches a SHIPPED screen outside the Materials area
#     (features\pricing\simulation reads ?material=). If it blocks, 451/453/454 are already done.
#     It also retires 451's placeholder route for /materials/:no.
#   * 455 is NOT in this run: it swaps the stubs for the live doors and holds the owner's staging
#     walk; BackOffice 2545-2549 are open and unbuilt. Its own ticket says an AFK runner stops there.
#   * Resume after a failure by dropping the finished tickets: 453, 454 and 452 depend only on 451.
#
# Preconditions (the script checks 1, 2 and 4 - you own 3 and 5):
#   1. Nothing outside this wave blocks it (BackOffice doors 2545-2549 are unbuilt; every slice is stubbed).
#   2. No TRACKED modifications in the tree (untracked files are fine and only warn).
#   3. YOU ARE ON THE RIGHT BRANCH. This runner never switches branches - it commits onto
#      whatever is checked out now. Waves here are often built on a feature branch rather
#      than main, and the tickets themselves may only exist on that branch.
#      Expected for this wave: spec/2544-materials (worktree C:\Playground\oms-react-spec2544)
#   4. node_modules is installed (npm ci / npm install) - checked, because a missing install
#      turns every slice's typecheck into a wall of phantom errors at 3am.
#   5. Run it FROM the worktree C:\Playground\oms-react-spec2544 (npm ci done there 2026-10-09).
#      A live SIS.Api is NOT required and must NOT be used - every slice stubs the MaterialWeb/*
#      doors at Playwright. Ticket 455 (live doors + staging walk) is deliberately left out of -Tickets.
param(
    [int[]]$Tickets = @(451,453,454,452),
    [string]$Model = "opus",
    # No stream output for this long => the session is wedged; kill the tree and stop.
    [int]$StallMinutes = 25,
    # Absolute ceiling for one session, however chatty it is.
    [int]$MaxHours = 5,
    [switch]$SkipReview,
    [switch]$DryRun,
    # Drive ONE trivial session through the exact same harness (start, stream, parse, exit) and
    # report. Run this once before you go to bed: it proves the plumbing without touching a ticket.
    [switch]$SmokeTest
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Tickets that must ALREADY be 'status: done' before this wave may start. Empty is fine.
$BlockingTickets = @()

$script:runStart = Get-Date
function Stamp {
    $s = [int]((Get-Date) - $script:runStart).TotalSeconds
    return "[{0:d2}:{1:d2}]" -f [int]($s / 60), ($s % 60)
}
function Say([string]$text, [string]$color = "Gray") {
    Write-Host ("{0} {1}" -f (Stamp), $text) -ForegroundColor $color
}

if (-not (Test-Path ".afk")) { New-Item -ItemType Directory ".afk" | Out-Null }
$afkDir = (Resolve-Path ".afk").Path

# --- pre-flight ------------------------------------------------------------------------
# -SmokeTest touches nothing in the tree, so it skips every gate below on purpose: you must be
# able to prove the plumbing while a previous session is still finishing.
if (-not $SmokeTest) {

if (-not (Test-Path "node_modules")) {
    Say "node_modules is missing - run 'npm ci' first. Without it every slice's typecheck fails for the wrong reason." "Red"
    exit 1
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Say "Branch: $branch   (expected for this wave: spec/2544-materials (worktree C:\Playground\oms-react-spec2544))" "DarkGray"

foreach ($b in $BlockingTickets) {
    $bf = Get-ChildItem ".issues\$b-*.md" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $bf) { Say "Blocking ticket $b : no .issues\$b-*.md found." "Red"; exit 1 }
    $bh = (Get-Content $bf.FullName -TotalCount 8) -join "`n"
    if ($bh -notmatch '(?m)^status:\s*done') {
        Say "Ticket $b is not 'status: done'. It blocks this wave - let it finish and commit before starting the loop." "Red"
        exit 1
    }
}

# Tracked modifications only: an untracked scratch file must not stop a midnight run, but a
# half-finished tracked edit would land inside the first ticket's commit and its review.
$dirtyTracked = git status --porcelain --untracked-files=no
if ($dirtyTracked) {
    Say "Working tree has TRACKED modifications - commit or stash them first, or ticket 1's diff and review will include them:" "Red"
    $dirtyTracked | Write-Host
    exit 1
}
$untracked = git status --porcelain --untracked-files=normal | Where-Object { $_ -like '?? *' }
if ($untracked) {
    Say "Untracked files present (allowed, but a session could sweep them into a commit - the AFK prompt tells it to stage narrowly):" "DarkYellow"
    $untracked | Write-Host
}

foreach ($t in $Tickets) {
    $file = Get-ChildItem ".issues\$t-*.md" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $file) { Say "Ticket $t : no .issues\$t-*.md found (wrong branch? the tickets may live on a feature branch)." "Red"; exit 1 }
    $head = (Get-Content $file.FullName -TotalCount 8) -join "`n"
    if ($head -notmatch '(?m)^status:\s*open') {
        $st = ""
        if ($head -match '(?m)^status:\s*(\S+)') { $st = $Matches[1] }
        Say "Ticket $t : status is '$st', expected 'open'. Drop it from -Tickets or reopen it." "Red"
        exit 1
    }
}

Say ("Plan: " + ($Tickets -join " -> ") + "   model=$Model  stall-watchdog=${StallMinutes}m  ceiling=${MaxHours}h  review=" + (-not $SkipReview)) "Cyan"

}   # end pre-flight (skipped for -SmokeTest)

# --- the child runner --------------------------------------------------------------------
# A tiny script that Start-Process launches under powershell.exe. It exists so the enormous
# system prompt travels as a FILE and `claude` is invoked NATIVELY (PowerShell then does the
# argument quoting correctly), while we still get a PassThru process object to watch and kill.
$runnerPath = Join-Path $afkDir "_afk-run-claude.ps1"
@'
param(
    [string]$Prompt,
    [string]$SysPromptFile,
    [string]$Model,
    [string]$WorkDir
)
Set-Location $WorkDir
# Escape embedded double quotes. PS 5.1 wraps a whitespace-bearing native arg in quotes but does NOT
# escape the quotes inside it, so the prompt shatters into many argv entries and claude dies on the
# first fragment that starts with a dash ('error: unknown option'). -SmokeTest cannot catch it: its
# own prompt has no quotes. Reproduced 2026-09-26 on BackOffice's spec 2030 runner before this fix.
$sys = (Get-Content $SysPromptFile -Raw) -replace '"', '\"'
claude -p $Prompt --model $Model --output-format stream-json --verbose --dangerously-skip-permissions --append-system-prompt $sys
exit $LASTEXITCODE
'@ | Out-File $runnerPath -Encoding utf8

$emptyStdin = Join-Path $afkDir "_empty-stdin.txt"
Set-Content -Path $emptyStdin -Value "" -Encoding ascii

function Invoke-ClaudeSession {
    param(
        [string]$Prompt,
        [string]$SysPrompt,
        [string]$Tag,
        [int]$StallMinutes,
        [int]$MaxMinutes
    )

    $jsonl   = Join-Path $afkDir "session-$Tag.jsonl"
    $errPath = Join-Path $afkDir "session-$Tag.err.log"
    $sysPath = Join-Path $afkDir "session-$Tag.sys.txt"
    foreach ($p in @($jsonl, $errPath)) { if (Test-Path $p) { Remove-Item $p -Force } }
    $SysPrompt | Out-File $sysPath -Encoding utf8

    # Start-Process does NOT quote ArgumentList members for you - quote them here. Every value
    # below is a path or a short literal with no embedded quote, so this is safe.
    # NOT $args - that is an automatic variable, and writing to it inside a function is a trap.
    $psArgs = @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$runnerPath`"",
        "-Prompt", "`"$Prompt`"",
        "-SysPromptFile", "`"$sysPath`"",
        "-Model", "`"$Model`"",
        "-WorkDir", "`"$PSScriptRoot`""
    )

    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList $psArgs `
        -RedirectStandardOutput $jsonl -RedirectStandardError $errPath `
        -RedirectStandardInput $emptyStdin -NoNewWindow -PassThru

    $fs = New-Object System.IO.FileStream($jsonl, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    $sr = New-Object System.IO.StreamReader($fs)

    $buffer     = ""
    $started    = Get-Date
    $lastData   = Get-Date
    $lastBeat   = Get-Date
    $lastTool   = "(session starting)"
    $result     = [pscustomobject]@{
        SawResult = $false; ResultText = ""; IsError = $false; Subtype = "";
        ExitCode = -1; Stalled = $false; TimedOut = $false; Jsonl = $jsonl; Err = $errPath
    }
    $drainedAfterExit = $false

    try {
        while ($true) {
            $chunk = $sr.ReadToEnd()
            if ($chunk) {
                $lastData = Get-Date
                $lastBeat = Get-Date
                $buffer += $chunk
                $parts = $buffer -split "`n"
                $buffer = $parts[$parts.Count - 1]      # keep the (possibly partial) tail
                for ($i = 0; $i -lt $parts.Count - 1; $i++) {
                    $line = $parts[$i].TrimEnd("`r")
                    if (-not $line.Trim()) { continue }

                    $evt = $null
                    try { $evt = $line | ConvertFrom-Json } catch { }
                    if ($null -eq $evt) {
                        $raw = $line.Substring(0, [Math]::Min(200, $line.Length))
                        Say ("  | " + $raw) "DarkGray"
                        continue
                    }

                    switch ($evt.type) {
                        "system" {
                            if ($evt.subtype -eq "init") { Say ("session " + $evt.session_id) "DarkGray" }
                        }
                        "rate_limit_event" {
                            if ($evt.rate_limit_info.status -ne "allowed") {
                                Say ("RATE LIMIT: " + $evt.rate_limit_info.status + " - waiting it out, not a hang") "Yellow"
                                $lastData = Get-Date   # a rate-limit wait must not trip the watchdog
                            }
                        }
                        "assistant" {
                            foreach ($block in $evt.message.content) {
                                if ($block.type -eq "text" -and $block.text -and $block.text.Trim()) {
                                    $txt = ($block.text -split "`n" | Where-Object { $_.Trim() } | Select-Object -First 1)
                                    if ($txt.Length -gt 150) { $txt = $txt.Substring(0, 150) + "..." }
                                    Say ("  . " + $txt) "White"
                                }
                                elseif ($block.type -eq "tool_use") {
                                    $hint = ""
                                    foreach ($key in @("description", "command", "file_path", "pattern", "prompt", "skill")) {
                                        $val = $block.input.$key
                                        if ($val) {
                                            $hint = ($val.ToString() -split "`n")[0]
                                            if ($hint.Length -gt 90) { $hint = $hint.Substring(0, 90) + "..." }
                                            break
                                        }
                                    }
                                    $lastTool = $block.name + " " + $hint
                                    Say ("  -> " + $lastTool) "DarkCyan"
                                }
                            }
                        }
                        "user" {
                            foreach ($block in $evt.message.content) {
                                if ($block.type -eq "tool_result" -and $block.is_error) {
                                    Say "     ! tool returned an error" "DarkYellow"
                                }
                            }
                        }
                        "result" {
                            $result.SawResult  = $true
                            $result.ResultText = [string]$evt.result
                            $result.IsError    = [bool]$evt.is_error
                            $result.Subtype    = [string]$evt.subtype
                            $mins = [math]::Round($evt.duration_ms / 60000, 1)
                            $cost = "{0:N2}" -f $evt.total_cost_usd
                            Say ("=== session ended: " + $evt.subtype + ", " + $mins + " min, " + $evt.num_turns + " turns, USD " + $cost + " ===") "Cyan"
                        }
                    }
                }
                continue    # more may be waiting; drain before sleeping
            }

            if ($proc.HasExited) {
                if ($drainedAfterExit) { break }
                Start-Sleep -Milliseconds 400     # let the last buffered write land
                $drainedAfterExit = $true
                continue
            }

            $silent = (Get-Date) - $lastData
            if ($silent.TotalMinutes -ge $StallMinutes) {
                Say ("=== NO OUTPUT for " + [int]$silent.TotalMinutes + " min (last: " + $lastTool + ") - killing the process tree ===") "Red"
                try { & taskkill /T /F /PID $proc.Id | Out-Null } catch { }
                $result.Stalled = $true
                break
            }
            if (((Get-Date) - $started).TotalMinutes -ge $MaxMinutes) {
                Say ("=== session passed the " + $MaxMinutes + "-minute ceiling - killing the process tree ===") "Red"
                try { & taskkill /T /F /PID $proc.Id | Out-Null } catch { }
                $result.TimedOut = $true
                break
            }
            if (((Get-Date) - $lastBeat).TotalSeconds -ge 60) {
                $lastBeat = Get-Date
                Say ("  ... alive, quiet " + [int]$silent.TotalMinutes + "m" + ($silent.Seconds) + "s; still on: " + $lastTool) "DarkGray"
            }

            Start-Sleep -Milliseconds 500
        }
    }
    finally {
        $sr.Close(); $fs.Close()
    }

    # ALWAYS WaitForExit + Refresh before reading ExitCode. A -PassThru process object hands back
    # a NULL ExitCode if you only ever asked HasExited - which reads as "not 0" and fails a round
    # that actually succeeded (caught by -SmokeTest).
    try { $proc.WaitForExit(10000) | Out-Null } catch { }
    try { $proc.Refresh() } catch { }
    $code = $null
    try { if ($proc.HasExited) { $code = $proc.ExitCode } } catch { }
    if ($null -eq $code) { if ($result.SawResult -and -not $result.Stalled -and -not $result.TimedOut) { $code = 0 } else { $code = 99 } }
    $result.ExitCode = [int]$code

    $errText = ""
    if (Test-Path $errPath) { $errText = (Get-Content $errPath -Raw) }
    if ($errText -and $errText.Trim()) {
        Say ("  stderr: " + (($errText -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 3) -join " | ")) "DarkYellow"
    }

    return $result
}

if ($SmokeTest) {
    # Pass -StallMinutes explicitly to exercise the watchdog itself: '-SmokeTest -StallMinutes 0'
    # must kill the tree and report a STALL. That is how you prove the kill path, not just the
    # happy path.
    $smokeStall = 3
    if ($PSBoundParameters.ContainsKey('StallMinutes')) { $smokeStall = $StallMinutes }
    Say "SmokeTest: one trivial session through the real harness (watchdog ${smokeStall}m)." "Cyan"
    $s = Invoke-ClaudeSession -Prompt "Reply with exactly SMOKE-OK and nothing else. Do not use any tool." `
                              -SysPrompt "You are running unattended. Never call AskUserQuestion. Answer in one line." `
                              -Tag "smoke" -StallMinutes $smokeStall -MaxMinutes 5
    if ($s.Stalled -or $s.TimedOut) { Say "SmokeTest FAILED: the watchdog had to kill the session - the harness cannot see output." "Red"; exit 6 }
    if ($s.ExitCode -ne 0)          { Say "SmokeTest FAILED: exit $($s.ExitCode) - see $($s.Err)" "Red"; exit $s.ExitCode }
    if (-not $s.SawResult)          { Say "SmokeTest FAILED: no result event - see $($s.Jsonl)" "Red"; exit 4 }
    if ($s.ResultText -notmatch 'SMOKE-OK') { Say "SmokeTest ODD: session ran but said '$($s.ResultText)'. Plumbing is fine; the model just answered differently." "Yellow"; exit 0 }
    Say "SmokeTest PASSED: start, live stream, result parse, clean exit. The loop is safe to launch." "Green"
    exit 0
}

if ($DryRun) {
    Say "DryRun: pre-flight passed for every ticket above. Nothing started." "Green"
    exit 0
}

# --- the loop ----------------------------------------------------------------------------
foreach ($t in $Tickets) {
    # Reset per iteration: PowerShell scopes these to the whole foreach, and a statement-
    # terminating error below SKIPS an assignment rather than nulling it - without this the
    # verdict could fall through to the previous ticket's value and pass a broken round.
    $lastLine = ''
    $sawDone  = $false
    $sawBlock = $false
    $hitlDoc  = ".afk\HITL-$t.md"

    $baseSha = (git rev-parse HEAD).Trim()

    $afkProtocol = @"
You are running unattended (AFK) - there is no human available to answer questions.
Follow this protocol strictly:

1. NEVER call AskUserQuestion or wait for user input. It will hang the run.
2. When you hit a decision a human would normally weigh in on (naming, UX wording, copy,
   ambiguous spec detail, choice between reasonable approaches):
   - Pick the most conservative option consistent with the ticket/spec and repo conventions.
   - Log it to $hitlDoc (create the file if missing, append if it exists) as:
     ## Q: <the question>
     **Decision taken:** <what you chose>
     **Why:** <one line>
     **Revisit if:** <what would make this wrong>
   - Then continue working.
3. Wave-specific facts - read these before you code:
   - The spec is C:\Work\DMSCO\BackOffice\.issues\2544-material-master-on-the-web-spec.md and the wayfinder map is
     (none - spec 2544 was grilled straight to a spec, there is no wayfinder map; its
     door contract C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md
     is the second document you MUST read in full). Read the spec AND your ticket.
     No ticket of this wave has landed yet; once one has (451 first), read its committed
     diff before re-deciding anything it settled - above all the model file, the access probe,
     the route tree, the menu group, the 50-material cap and the shared stock pieces.
   - This wave adds NO npm dependency. A slice that seems to need one (ag-grid-enterprise above
     all) is a BLOCKER.
   - A NEW top-level area: src\features\materials\ with four features - search (451), detail
     (452), stock-check (453), gs1-check (454). Routes: /materials, /materials/:no,
     /materials/stock, /materials/gs1. React Router ranks the static /materials/stock and
     /materials/gs1 above /materials/:no - keep them static, and prove it in your drive.
   - Namespaces, one per feature, EN AND AR (src\locales\en\ and src\locales\ar\, both
     registered in src\core\i18n.ts under en AND ar): materials-search, materials-detail,
     materials-stock-check, materials-gs1-check. 451 owns the menu group and ALL THREE leaf labels
     under materials-search:menu.* ; 453 and 454 re-point their leaf at their own page and do NOT
     move or rename those label keys. AR files mirror the EN keys exactly. Arabic plurals need ALL
     SIX suffixes (_zero _one _two _few _many _other) - ticket 433 was reviewed SERIOUS for shipping
     only _one/_other (see src\locales\ar\coupons.json for the right shape). Drives stay lng=en.
   - Vocabulary is RULED: the word is "Material" in every label, key, route, type and message -
     never "item" or "product" (those survive only as the table names Item / ItemInfo).
   - 451 OWNS the registration: the menu group, the routes, src\core\models\materials.ts (types for
     EVERY door in the contract, written once), and the probe in src\core\materials\api.ts (one
     query key, one call, a per-leaf predicate per flag - the src\core\oms\api.ts + access.ts
     shape, so the group costs ONE call). The probe FAILS CLOSED (no 404-tolerant catch - the
     src\features\reports\idoc-inspector\api.ts precedent): the door is deployed nowhere yet.
     Older drives that do not stub MaterialWeb/Access therefore see no new group; no existing
     menu count changes. The Materials group goes AFTER the Pricing group.
   - Placeholder routes: 451 registers /materials/:no, /materials/stock and /materials/gs1 at once
     (so its menu leaves never 404), all three rendering ONE small placeholder page inside
     features\materials\search\. 453 and 454 point their route at their own Page; 452 points
     :no at its Page and DELETES the placeholder (it runs last). No new feature imports the
     placeholder.
   - Each page also guards itself on its flag (canSearchMaterials / canCheckStock / canCheckGs1),
     the in-page denied backstop the other gated screens use. 452's Stock tab needs BOTH flags.
   - The door contract is the ONLY source of wire shapes. Model types mirror it field for field,
     camelCase, string unions for its enums (resolvedAs, batch, status, materialReason, trxType,
     issue category, StoreSets kind, Facets kind). Invent no field, rename none, drop none you render.
     Material numbers and store codes are STRINGS - leading zeros kept; never Number() them.
   - KNOWN CONTRACT DRIFT - the envelope's error entries. The contract abbreviates them as
     errors: [{ code, message }]; the real SIS.Api envelope src\core\api.ts reads is
     errors: [{ errorCode, errorMessage, internalErrorCode }]. Stub the REAL shape (copy the
     envelope() helper of tools\coupon-import-delete-drive.mjs), branch on MAT-0000x only through
     apiErrorCode, show text only through apiErrorMessage, and log the drift ONCE in the HITL doc.
   - Shared constants and helpers live in src\core\materials\ because two features use them: the
     50-material cap (451's "check stock for selected" and 453's input refuse the 51st through ONE
     constant and ONE refusal key), and - built by 453 - the POST MaterialWeb/Stock call, its
     stockRequest builder and the MAT-00004 "Stock Visibility unavailable" panel that 452's Stock
     tab reuses. MAT-00004 is NEVER rendered as an empty grid, in either screen.
   - Money: unitPriceExVat shows 3 decimals and is labelled ex VAT. src\core\util\number-format's
     formatMoney is FIXED at 2 decimals - do not use it for this column and do not change it (every
     money screen depends on it); add a 3-decimal formatter beside it or format in the column.
     Quantities (atp, sapUnrestricted, pos, oms) can be NEGATIVE (pos: -2 in the contract) - signed,
     machine values.
   - Bidi, the specific traps: "code - description" for the A-E levels is a PAIR led by a machine
     value - build it with formatPair (its separator is " . " with a middle dot, which REPLACES the
     ticket's en dash) and isolate it once; in a native option/placeholder/title use
     fsi(formatPair(...)); never fsi in a grid cell, valueFormatter or export. The resolved chip
     ("Barcode 628... -> 101234") is a SENTENCE with each value isolated (Trans slots or fsi), not an
     arrow glued between two values. EN and AR descriptions and store names are free text (<bdi>).
   - Time: updatedAt is local wall-clock with NO offset; history date + time come as separate
     fields. Never append Z, never toISOString() a server value, never shift by timezone. Format
     through src\core\util\date-format (joinDayAndTime exists).
   - Search URL state (451): the URL is the single source of truth; repeated params exactly as
     the contract (aLevel=A006&aLevel=A008); blocked/serialised absent means "any"; the searchQuery
     helper must round-trip URL -> state -> URL unchanged. MAT-00006 shows INLINE beside the box,
     never a toast. Facets typeahead per kind; vendor's value is its number.
   - Level cascade (451): changing a level re-asks MaterialWeb/Levels for the levels BELOW it with
     the levels above as filters, and drops any lower choice no longer offered; it never touches the
     levels above. The empty code is never offered.
   - Excel export everywhere goes through src\core\util\grid-xlsx (gridSheet / writeWorkbook /
     xlsxFileName). TRAP for 454: a raw GS1 scan can carry the GS control character (0x1D, FNC1),
     which is ILLEGAL in xlsx XML. Check what grid-xlsx does with it; if it does not sanitise, map
     it to a visible marker in the EXPORT cell only (never in the stored scan or the request) and
     log the choice in the HITL doc. Do not change grid-xlsx's behaviour for its existing callers.
   - AG Grid is COMMUNITY: there is no master/detail and the repo has no full-width-row precedent.
     454's "expand a row to load its history" must be built without enterprise features - e.g. a
     history pane under the grid or a full-width row on the Community API. Pick the conservative one,
     and keep the request on demand: no history call until a row is expanded, one per unit after
     that (TanStack Query keyed on material+serial+lot, enabled only when expanded).
   - GS1 (454): the page NEVER judges validity itself - it shows the server's verdict as given.
     The raw scan is kept byte for byte (GS and # preserved) in the list AND the request. A scan
     equal to one already in the list is flagged duplicate on its own row (and server duplicate:true
     is honoured too) - never merged. List cap 500, refused on the client on the 501st. Statuses
     SELLABLE / SOLD / HELD map to a label key and a severity token (no hex - lint gate); the note
     "History only covers invoices already synced to HQ" stands beside SELLABLE. lotMismatch rows
     are highlighted through a token, not a colour literal.
   - Stock check (453): stores come from lookupQueries.storeDetails() in src\core\services\lookups
     (ungated, session-cached) plus MaterialWeb/StoreSets/{kind}/{value}; "All stores" sends
     stores: null; includeClosed and includeZero both default OFF and must reach the request body.
     ?material= prefill is repeatable and goes through the same parse/dedupe/cap as typed input.
   - Detail (452): hasInfo:false shows "not in material info" in place of the info groups (not
     empty groups); the Batches tab only for serialised; the Stock tab makes NO request without
     canCheckStock (prove it in vitest). MAT-00001 -> a not-found page with a link back to search.
   - Simulator link (452) - the ONE edit outside features\materials\: link to
     /pricing/simulation?material=<no> as a plain path string (no import from the simulation
     feature). Inside features\pricing\simulation, a pure simulationMaterialParam helper turns
     ?material= into ONE pre-filled item row (qty 1, EA) at the initial state; it does NOT
     auto-process. Without the param the page is byte-for-byte unchanged in behaviour. The simulator
     guards itself (PosSimulation grant), so the link is shown whenever the detail is - ruled; do
     not probe the simulator's grant from the materials feature. If you add any key to the
     simulation namespace, also run node tools\check-sim-keys.mjs (a manual gate, NOT in lint) and
     the feature's own i18n-keys.test.ts.
   - Drive files are named by the tickets: tools\materials-search-drive.mjs,
     materials-detail-drive.mjs, materials-stock-drive.mjs, materials-gs1-drive.mjs. Every door
     stubbed from the contract's own example values (material 101234, store 1001, etc.).
   - The governing spec AND the door contract live in the OTHER repository (C:\Work\DMSCO\BackOffice).
     You may READ them and any BackOffice ticket they name (2545-2549). You may NOT edit, stage,
     commit or run anything in that repository - it has its own branch, its own loop and its own
     reviewer. If you believe the contract is wrong or missing a field, log it to the HITL doc as
     '## Contract gap: <title>' and build against the contract AS WRITTEN.
   - None of the MaterialWeb/* doors is built. Their agreed shapes are exactly the JSON in
     C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md (Access, Search,
     Levels, Facets, Material, Stock, StoreSets, StoreSets/{kind}/{value}, Gs1/Check, Gs1/History,
     and the MAT-00001..00006 error table). Stub those shapes at Playwright to prove each screen. Do
     not invent fields, do not soften a shape to whatever is convenient - a screen built against a
     guessed shape fails the day the door lands, and it fails silently on the fields you guessed.
4. This repo's standing rules are non-negotiable - a violation is a review finding, not a taste
   difference. Read the rule file when your slice touches its area (.claude\rules\):
   - feature-structure: features/<area>/<feature>/ layout; features NEVER import features - only
     app and layout reach in. Adding a feature has a checklist; follow it rather than improvising
     a folder.
   - i18n-zero-literal: NO user-visible string literal anywhere. Every one goes through t(), with
     its key added to the en bundle. This is the single most common AFK slip, because a literal
     renders perfectly and only the lint gate catches it.
   - logical-tailwind: logical utilities only - ms/me/ps/pe/text-start/text-end - never
     ml/mr/pl/pr/left/right. The app renders RTL; a physical utility is silently wrong in Arabic
     and looks perfect in English.
   - api-envelope: every server call goes through src/core/api.ts. Do not hand-roll a fetch.
   - Path alias @/ maps to src/. Do not add deep relative import chains.
5. BATCH EXPLORATION - BUDGET THE ROUND TRIPS, NOT THE READING. Read as much of the repo as
   you need; under-reading is a worse failure than a slow session, and nothing here caps how
   much you look at. What is capped is the number of CALLS you spend looking.
   - One Bash call may carry MANY reads. ``cat a.tsx b.tsx; sed -n '1,80p' c.ts; grep -n X d.ts``
     is ONE call, and it puts MORE context in front of you in a single view than four calls do -
     usually the better read, not just the faster one. Batch by DEFAULT; a lone single-file read
     is the exception.
   - Before a third consecutive single-file read, stop and batch the next ten into one call.
   - Genuinely sequential reads are fine: when file A tells you which file B to open, you could
     not have batched them. Never GUESS at B just to save a call.
   - DELEGATE WIDE SEARCHES, KEEP JUDGEMENT. If a question means sweeping many files or guessing
     at naming conventions ("where is this route registered", "what else uses this hook"), spawn
     ONE Explore subagent and keep its conclusion instead of walking the tree file by file. Do
     NOT delegate a question you must reason over in detail - a subagent returns a summary and
     the raw detail is lost. Correctness judgements, rules compliance and diff review stay yours.
   - Measured on a comparable wave: ~93 one-line reads per session, ~15 of every ~40 minutes of
     wall-clock, nearly all batchable. Round trips - not builds, not tests - dominate a long slice.
6. How to verify - a green typecheck is NOT proof a screen works:
   - ``npm run typecheck`` is the fast inner loop; run it continuously.
   - ``npm test`` is vitest (node environment, src/**/*.test.ts). React Testing Library is
     deliberately NOT installed: pure modules are where regression is silent, components are thin
     renderers. So do NOT add RTL or reach for a component-rendering test - that is a separate
     hardening ticket's call, not yours at 3am.
   - ``npm run lint`` runs three gates: import boundaries, token contrast, colour literals. Run it
     before you commit; it is what catches a stray literal or a raw hex colour.
   - ``npm run build`` once at the end.
   - A UI slice is proven by DRIVING THE APP with a Playwright script under tools\*-drive.mjs.
     That needs a vite server: start one on port 5244 (``npx vite --port 5244 --strictPort``) - NOT
     the default 5173 and NOT 5199, which other worktrees' waves hold - and run the drive with
     DRIVE_PORT=5244 (drives default to 5199; a drive you write must read DRIVE_PORT the same way).
     Then KILL the server you started, by the PID that owns the port:
     ``Get-NetTCPConnection -LocalPort 5244 -State Listen | % { Stop-Process -Id `$_.OwningProcess -Force }``.
     NEVER kill by command-line match (``*vite*5244*``): your own claude.exe command line contains this
     brief, so that kills your own session. Playwright is borrowed from C:/Playground/frontend/node_modules via a createRequire
     shim in the drive files - it is not a dependency of this repo. Follow an existing drive file
     rather than inventing a new harness.
   - If a drive genuinely cannot run (it needs a live SIS.Api that is not up, or Playwright does
     not resolve), that is an OUTSTANDING PROOF, not a blocker and never something to fake: stub
     the network at Playwright where the ticket allows it, otherwise leave the Proof box unticked,
     say exactly why in the ticket, and finish the rest of the slice.
   - Pre-existing baseline for this wave, measured when this runner was generated -
     anything at or below this is NOT yours to fix:
     * npm run typecheck: CLEAN. Any error you see is yours.
     * npm test: CLEAN - 228 files, 4162 tests, all passing. Any failure you see is yours.
     * npm run lint: all four gates CLEAN (boundaries 899 files, grid base 32 mounts, contrast
       170 pairs, colour literals 904 files).
7. Proof checkboxes marked OWNER, manual-smoke, or needing a live backend are NOT yours: leave them
   unchecked, list them as outstanding in the ticket, and never fake or simulate them. In this wave
   that is nothing in 451-454 needs a live SIS.Api (all doors are stubbed - every drive Proof box IS yours and must be real); the live drives, the owner walk against real data and the Arabic read-through belong to ticket 455, which is not in this run. The ticket may still complete AFK with those open; every OTHER
   Proof box must be real, written, and green.
8. Finish the /implement skill's own review step (built-in /code-review, then /standards-review)
   before you close the ticket. An INDEPENDENT /standards-review runs in a separate session right
   after this one against $baseSha, and its report lands in .afk\REVIEW-$t.md - so leave the commit
   in a state you would be happy to have reviewed cold.
9. Stage NARROWLY when you commit: your slice's files only. Do not commit .afk\ artifacts, drive
   screenshots, dist\, or anything you did not write for this ticket. Commit onto the CURRENT
   branch; never switch or create a branch.
10. BLOCKER = you cannot proceed safely at all: the spec contradicts itself, a required file or
    dependency is missing or unfetchable, the tickets are not on this branch, a slice would need a
    new npm dependency, or any choice risks breaking unrelated shipped behavior. On a blocker:
    - Log it to $hitlDoc under '## BLOCKER: <title>' with what you tried and what a human must
      decide.
    - STOP: do not complete the ticket, do not commit, leave the working tree in a clean
      understandable state, and end your final message with the exact line: AFK-BLOCKED
11. On success, the VERY LAST line of your final message must be exactly: AFK-DONE
    Nothing after it - no closing thought, no note for the next slice, no sign-off. Write whatever
    summary you like ABOVE it, then that line alone.
12. Do not push and do not open a PR. Committing is allowed only if the /implement skill itself
    says to commit.
"@

    Write-Host ""
    Say "=== ROUND A: fresh session /implement $t   (base $($baseSha.Substring(0,8))) ===" "Cyan"
    Say "    live stream below; a quiet stretch under a '->' line is that tool still running, and the ${StallMinutes}m watchdog is armed" "DarkGray"

    $r = Invoke-ClaudeSession -Prompt "/implement $t" -SysPrompt $afkProtocol -Tag "$t" `
                              -StallMinutes $StallMinutes -MaxMinutes ($MaxHours * 60)

    if ($r.Stalled)  { Say "=== /implement $t STALLED (no output for $StallMinutes min) - inspect $($r.Jsonl) - stopping loop ===" "Red"; exit 6 }
    if ($r.TimedOut) { Say "=== /implement $t hit the $MaxHours-hour ceiling - inspect $($r.Jsonl) - stopping loop ===" "Red"; exit 7 }
    if ($r.ExitCode -ne 0) { Say "=== /implement $t FAILED (exit $($r.ExitCode)) - inspect $($r.Err) - stopping loop ===" "Red"; exit $r.ExitCode }
    if (-not $r.SawResult) { Say "=== /implement $t produced no result event - inspect $($r.Jsonl) - stopping loop ===" "Red"; exit 4 }
    if ($r.IsError) { Say "=== /implement $t returned is_error ($($r.Subtype)) - inspect .afk\session-$t.jsonl - stopping loop ===" "Red"; exit 5 }

    $r.ResultText | Out-File ".afk\session-$t.log" -Encoding utf8

    # Marker scan over the WHOLE result text, anchored per line - NOT just the last line. A session
    # that finishes its slice correctly and then adds one line of helpful prose after the marker is
    # a clean success, and a last-line-only test reads it as a failure and costs the whole rest of
    # the wave. -match on a single string is a real boolean; never test a string[] this way - arrays
    # FILTER and a non-empty array is truthy.
    $lastLine = ($r.ResultText -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 1)
    if ($lastLine) { $lastLine = $lastLine.Trim() } else { $lastLine = '' }
    $sawBlock = ([string]$r.ResultText) -match '(?m)^\s*[*`_]*AFK-BLOCKED[*`_]*\s*$'
    $sawDone  = ([string]$r.ResultText) -match '(?m)^\s*[*`_]*AFK-DONE[*`_]*\s*$'

    # AFK-BLOCKED is the one marker that still stops the loop on its own: the session is telling us
    # it deliberately did NOT finish, and the checks below would only confirm that more slowly.
    if ($sawBlock) { Say "=== /implement $t BLOCKED - see $hitlDoc - stopping loop ===" "Yellow"; exit 2 }

    # EVIDENCE OUTRANKS THE MARKER. git and the tracker are what actually happened; AFK-DONE is only
    # the session's claim about it. So the objective checks run FIRST and are the real gate - a
    # missing marker on an otherwise-clean slice WARNS and the wave carries on.
    $ticketFile = Get-ChildItem ".issues\$t-*.md" | Select-Object -First 1
    $nowHead = (Get-Content $ticketFile.FullName -TotalCount 8) -join "`n"
    if ($nowHead -notmatch '(?m)^status:\s*done') {
        Say "=== /implement $t ended but the ticket is not 'status: done' (marker seen: $sawDone) - inspect .afk\session-$t.log - stopping loop ===" "Yellow"
        exit 3
    }
    $headSha = (git rev-parse HEAD).Trim()
    if ($headSha -eq $baseSha) {
        Say "=== /implement $t ended but HEAD did not move - nothing was committed (marker seen: $sawDone) - stopping loop ===" "Yellow"
        exit 3
    }
    # A session can commit and STILL leave files behind (a new i18n key never staged, a drive file
    # written but not added). HEAD moving is not proof the slice landed whole: the review below
    # would then review an incomplete diff, and the NEXT ticket would sweep the orphan into its own
    # commit. So this is a stop, not a warning - and it names the round that caused it.
    $leftBehind = git status --porcelain --untracked-files=no
    if ($leftBehind) {
        Say "=== /implement $t committed, but LEFT TRACKED MODIFICATIONS UNCOMMITTED - the slice did not land whole - stopping loop ===" "Red"
        $leftBehind | Write-Host
        Say "    Inspect, then either commit them onto $t yourself or reset them, and re-run from the next ticket:" "Yellow"
        Say "    .\run-implements-spec2544.ps1 -Tickets $(($Tickets | Where-Object { $_ -ne $t }) -join ',')" "Yellow"
        exit 9
    }
    $strayUntracked = git status --porcelain --untracked-files=normal | Where-Object { $_ -like '?? *' -and $_ -notlike '*.afk*' }
    if ($strayUntracked) {
        Say "    NOTE: untracked files exist after $t - check none of them belong to the slice (a new feature folder, an i18n bundle, a drive script):" "DarkYellow"
        $strayUntracked | Write-Host
    }

    # Every objective check above passed, so the slice landed whole whatever the session said last.
    # Name the missing marker so morning triage can see it, then carry on - this is a note, not a gate.
    if (-not $sawDone) {
        Say "    NOTE: $t never printed the AFK-DONE marker (last line: '$lastLine'), but the ticket is 'status: done', HEAD moved and the tree is clean - continuing on the evidence." "DarkYellow"
    }

    Say ("=== /implement $t DONE - " + ((git log --oneline "$baseSha..HEAD" | Measure-Object).Count) + " commit(s), tree clean ===") "Green"
    if (Test-Path $hitlDoc) { Say "    HITL decisions were logged: $hitlDoc" "Yellow" }

    if ($SkipReview) { continue }

    # --- ROUND B: independent standards + spec review of exactly this ticket's diff --------
    $reviewDoc = ".afk\REVIEW-$t.md"
    $reviewProtocol = @"
You are running unattended (AFK) - there is no human available to answer questions. NEVER call
AskUserQuestion.

You are reviewing ONLY the diff introduced by ticket $t of BackOffice spec 2544 (the Materials screens): git diff $baseSha...HEAD.
The fixed point is $baseSha - do not ask for one, do not widen the range.

This session is READ-ONLY with exactly one exception (the report file):
- Do NOT edit source, tests, .issues tickets or INDEX.md. Do NOT commit, stage, stash, revert or
  push ANYTHING. Do not run a drive that writes screenshots into the tree; reading the code and
  the diff is the job. ``npm run typecheck`` and ``npm run lint`` are fine - they write nothing.
- Write your full two-axis report (Standards and Spec) to $reviewDoc, overwriting it if present.
  Head it with the ticket number, the fixed point, and a one-line VERDICT: CLEAN, MINOR, or
  SERIOUS.
- Findings must be concrete: file:line, the rule or the spec line it violates, and what the fix
  would be. Say plainly when an axis is clean rather than manufacturing findings.
- Check every standing rule in .claude\rules\, and pay particular attention to the two that pass
  a human's eye: a user-visible string that never reached t(), and a physical Tailwind utility
  (ml/pr/left) where a logical one was required. Both render perfectly in English.
- The wave's own rules to check against:
  no new npm dependency and no ag-grid-enterprise; new area src\features\materials\ with features
  search / detail / stock-check / gs1-check and namespaces materials-search / -detail / -stock-check /
  -gs1-check, each with EN AND AR bundles registered in core\i18n.ts and AR plurals carrying all six
  suffixes; the word "Material" everywhere, never item/product; MaterialWeb/Access lives in core,
  FAILS CLOSED, one call for the whole group, and every page also guards itself; model types match
  C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md field for field with
  nothing invented, material numbers and store codes kept as strings; error codes read only via
  apiErrorCode/apiErrorMessage and stubs use the real errorCode/errorMessage envelope; the 50 cap is
  one shared constant; MAT-00004 never renders as an empty grid; MAT-00006 inline not a toast;
  price ex VAT at 3 decimals without changing formatMoney; level pairs via formatPair, no fsi in
  grids/exports; server timestamps never treated as UTC; GS1 scans kept byte for byte and the page
  never judges validity; history fetched on demand only; the simulation change is additive (no
  param = unchanged, no auto-process) and is the only edit outside features\materials\.

Then in your FINAL message print, in under 15 lines: the VERDICT word, the count of findings per
axis, and one line per SERIOUS finding. End your final message with the exact line:
AFK-REVIEW-DONE
"@

    Write-Host ""
    Say "=== ROUND B: /standards-review since $($baseSha.Substring(0,8))  (read-only, report -> $reviewDoc) ===" "Cyan"

    $rev = Invoke-ClaudeSession -Prompt "/standards-review since $baseSha" -SysPrompt $reviewProtocol -Tag "$t-review" `
                                -StallMinutes $StallMinutes -MaxMinutes 90

    # A review is morning triage, not a gate: warn and carry on so one bad review round cannot
    # cost the rest of the night's tickets.
    if ($rev.Stalled -or $rev.TimedOut) {
        Say "    WARN: review round for $t was killed by the watchdog - $reviewDoc may be missing. Continuing." "Yellow"
    }
    elseif ($rev.ExitCode -ne 0 -or -not $rev.SawResult -or $rev.IsError) {
        Say "    WARN: review round for $t did not complete cleanly (exit $($rev.ExitCode)). Continuing." "Yellow"
    }
    else {
        $rev.ResultText | Out-File ".afk\session-$t-review.log" -Encoding utf8
        Write-Host ""
        Say "--- review verdict for $t ---" "Magenta"
        ($rev.ResultText -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 15) |
            ForEach-Object { Say ("    " + $_.Trim()) "Magenta" }
        if (Test-Path $reviewDoc) { Say "    full report: $reviewDoc" "Magenta" } else { Say "    WARN: $reviewDoc was not written." "Yellow" }
    }

    # The reviewer is told not to touch the tree; verify, because the next ticket's diff depends
    # on it. The tree was PROVEN clean above, so anything here is unambiguously the reviewer's.
    # Its own report file is untracked and expected.
    $revDirty = git status --porcelain --untracked-files=no
    if ($revDirty) {
        Say "=== the REVIEW round for $t edited tracked files - it was told to be read-only. Revert its edits before continuing - stopping loop ===" "Red"
        $revDirty | Write-Host
        exit 8
    }
}

Write-Host ""
Say "Spec 2544 Materials wave complete. Read .afk\REVIEW-*.md and .afk\HITL-*.md before trusting the results." "Green"
Say ">>> Ticket 455 is NOT done: live doors on staging + the owner walk, once BackOffice 2545-2549 deploy, the Gs1SerialInquiry seed runs on OMS-HQ and StockV2:* is set. <<<" "Yellow"
Say ">>> Every drive in this wave is STUBBED against the 2544 door contract - nothing has touched a live SIS.Api. <<<" "Yellow"
Say ">>> Read .afk\HITL-*.md for the envelope-errors drift, the GS1 control-character export choice and any 'Contract gap' - contract first, then both repos. <<<" "Yellow"
Say ">>> 452 changed the shipped pricing simulator (?material= prefill) - check it opens unchanged without the param before merging. <<<" "Yellow"
Say ">>> Branch spec/2544-materials is unmerged and unpushed. <<<" "Yellow"
