# Runs /implement + /standards-review for the spec 261 retail-invoice-download frontend wave
# (one prefactor, one new area, one search screen, one download action) in fresh Claude Code
# sessions, sequentially, fully AFK.
#
#   .\run-implements-spec261.ps1                  (262, 263, 264, 265)
#   .\run-implements-spec261.ps1 -Tickets 264,265
#   .\run-implements-spec261.ps1 -DryRun          (pre-flight + plan only, starts nothing)
#   .\run-implements-spec261.ps1 -SkipReview      (implement rounds only)
#   .\run-implements-spec261.ps1 -SmokeTest       (one trivial session through the real harness)
#
# ASCII only, on purpose: Windows PowerShell 5.1 reads a BOM-less .ps1 as ANSI, so a stray
# em dash silently becomes mojibake and can break the parse. Keep every character 7-bit.
# NOTE FOR THIS WAVE: the ONE Arabic fact in it (that Store.Description reads as the company
# name plus the store code) is stated in the SPEC, in Arabic, and sessions read it there.
# Nothing in this file needs a non-ASCII character; do not add one.
#
# ---------------------------------------------------------------------------------------
# WHY THIS RUNNER CANNOT WEDGE
#
# Identical machinery to run-implements-spec249.ps1, which drove nine slices to completion.
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
# never as a quoted command-line argument.
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
# Dependency map (261 spec, out of BackOffice map 984 / spec 1042; nothing here has landed):
#
#   262 (core: api.blob + attemptId + download-file) --+
#                                                       \
#   263 (reports area + nav + gate + namespace) --> 264 (search screen) --> 265 (download)
#                                                                             ^
#                                                                             |
#                                             262 also blocks 265 ------------+
#
#   Excluded from this run on purpose:
#     266 (the real door) - needs a live SIS.Api AND a live render host, which is a
#     two-process manual setup. A session cannot stand up the render host reliably: it is a
#     verb of a net472 WPF exe, takes ~31 seconds to bind its port, and reads its database
#     from a Config.xml next to the exe. Everything 262-265 builds runs on fixtures.
#
# Running order:
#   * 262 runs FIRST and alone. It is a pure prefactor and it touches TWO SHIPPED features
#     (admin/ua-admin and collection/inquiry both lose their local downloadCsv), so it lands
#     before anything consumes it rather than being tangled into a screen's diff. This is
#     250's pattern at spec 249 (money.ts) and 232's (pager.ts).
#   * 263 runs second even though the graph allows it first. It mints the shared surface
#     every later slice extends: the new src\features\reports\retail-invoice\ folder, the
#     `reports` i18n namespace and its registration in core\i18n.ts, the router entry and the
#     Reports menu group. If it ran later, two sessions would each invent the namespace and
#     collide in core\i18n.ts, and the earlier one would carry a doomed folder shape through
#     its whole diff. (253 is the precedent AND the cautionary tale - see the folder-shape
#     warning in the protocol below.)
#   * 264 then 265 is forced by the graph: 265 needs rows to act on.
#   * NOTHING in 262-265 is backend-blocked. Every slice is proven against stubs and
#     checked-in fixtures, which is why 266 is the only ticket that needed excluding.
#
# Preconditions (the script checks 1, 2 and 4 - you own 3 and 5):
#   1. Nothing outside this wave blocks it - 262-265 are the whole runnable frontend wave and
#      none of them has landed yet.
#   2. No TRACKED modifications in the tree (untracked files are fine and only warn).
#      HEADS UP: as generated, this repo HAS a tracked modification - .issues\INDEX.md was
#      edited to add the 261-266 lines. Commit it (with the six new ticket files) before you
#      run, or pre-flight will stop you at exit 1.
#   3. YOU ARE ON THE RIGHT BRANCH. This runner never switches branches - it commits onto
#      whatever is checked out now.
#      Expected for this wave: main
#   4. node_modules is installed (npm ci / npm install) - checked, because a missing install
#      turns every slice's typecheck into a wall of phantom errors at 3am.
#   5. No live SIS.Api and no render host are required. Every slice in this wave is proven on
#      stubs, by ruling: 266 is the joining event and it is not in this run. You do NOT need
#      to leave anything running overnight.
param(
    [int[]]$Tickets = @(262,263,264,265),
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
Say "Branch: $branch   (expected for this wave: main)" "DarkGray"

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
$sys = Get-Content $SysPromptFile -Raw
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
   - The spec is .issues\261-retail-invoice-download-web-spec.md. Read the spec AND your ticket.
     There is NO wayfinder map in this repo for this effort: the charting happened in the OTHER
     repository, as BackOffice map 984, and its conclusions reach you as a settled WIRE CONTRACT.
   - THE CONTRACT IS THE AUTHORITY ON EVERY WIRE SHAPE, and it is not in this repo:
       C:\Work\DMSCO\BackOffice\.issues\assets\988-search-download-contract.md
     Read it before you write a model. Its section 2 carries the TypeScript interfaces to paste
     VERBATIM (InvoiceCandidate, InvoiceSearchResult, RetailInvoiceKey) and its section 4 is the
     error table. Do NOT add a field, rename one, or soften a type to whatever is convenient. A
     model that drifts from the contract produces a screen that fails the day it meets the real
     endpoint, silently, on exactly the fields you changed.
   - THE BACKEND IS ALREADY BUILT AND LIVE. This is not a mock-first wave because the server is
     missing; it is stub-first because ticket 266 (NOT in this run) is the joining event and it
     needs two processes no session can stand up. Do not try to start SIS.Api or the render host.
     Do not treat a stub as a workaround for something unfinished.
   - You may READ anything under C:\Work\DMSCO\BackOffice. You may NOT edit, stage, commit or run
     anything there - it has its own tracker, its own loop and its own reviewer. If you believe
     something there is wrong (an endpoint shape, a field), log it to the HITL doc and carry on.
   - THE BIGGEST TRAP IN THIS WAVE, and it cost ticket 253 its stated folder shape: a FLAT
     features\reports\ folder trips tools\check-boundaries.mjs, because every sibling file becomes
     its own feature. The folder is features\reports\retail-invoice\ from the first commit and
     EVERYTHING in this wave goes inside it. Do not create a documents\ or download\ sibling under
     features\reports\ - a sibling folder is a DIFFERENT FEATURE to the boundary gate.
   - THE SECOND TRAP: the i18n namespace for this wave is 'reports' - the AREA's name, not the
     feature's. This is the one deliberate departure from 'namespace == feature name' in the repo,
     and the spec says why (the second report screen joins it rather than minting another). 263
     creates src\locales\en\reports.json AND registers it in src\core\i18n.ts (import, ns array,
     resources). Every later slice ADDS KEYS to that file and must not re-register the namespace.
     An unregistered namespace renders raw keys to users and no gate catches it.
   - core\api.ts CANNOT FETCH A NON-JSON BODY, and this is the reason 262 exists. Its single
     request<T> always calls res.json() and unwraps the envelope; hand it application/pdf and it
     throws ApiError('unknown'). 262 adds api.blob(). Ticket 265 MUST go through it. The
     api-envelope rule forbids hand-rolling a fetch, and a hand-rolled one would also drop the
     X-Web-Client CSRF header, which is the whole reason a plain <a href> download is impossible.
   - 262's downloadCsv graduation is PRE-AUTHORIZED BY THE CODE ITSELF. The docblock in
     features\collection\inquiry\export.ts says it graduates to @/core when a THIRD consumer
     lands. This wave is that consumer. Repoint BOTH existing call sites (admin\ua-admin\export.ts
     and collection\inquiry\export.ts) in the SAME commit - a graduation that leaves two copies
     behind is worse than the duplication it set out to fix. Their existing tests MOVE UNEDITED
     and are the whole regression net (following money.ts at 250 and pager.ts at 232).
   - 503 AND 504 ARE DIFFERENT SENTENCES AND MUST NOT BE COLLAPSED. 503 means a render host is
     recycling and a retry one second later works, so it gets a retry button. 504 means a render
     HUNG and a watchdog is about to kill the host - different advice, different alert. Collapsing
     them, or mapping either to the generic server message, is the specific mistake ticket 265
     exists to prevent, and it must have its own explicit test.
   - THE CLIENT ADDS NO AUTOMATIC RETRY. SIS.Api already retries the internal call twice (250ms,
     then 1s) on connect-refused/503 only. By the time a 503 reaches the browser three attempts
     have failed; a client retry loop would triple a recycling host's load at the worst moment.
     The retry BUTTON is a user action, which is different.
   - A 403 ON THIS RAIL CARRIES NO BODY AT ALL - no envelope, no errorCode. So apiErrorCode(err)
     is null and the message is the generic fallback, and you must branch on err.status === 403.
     Every OTHER row of the error table branches on the code. An empty grid on a 403 is a lie.
   - THE SEARCH RETURNS ROWS THAT CANNOT BE RENDERED, ON PURPOSE (owner ruling, BackOffice 988).
     RetailTrx also holds cash clearances (trxTypeCode 700), training receipts and suspended
     sales. They come back unfiltered and unflagged; trxType/trxStatus on the row are the only
     signal. So: DO NOT filter them out, DO NOT disable the download action, and DO NOT derive a
     'renderable' flag. The sanctioned mitigation is a CONFIRM step on anything that is not Sales
     or Return, and nothing more.
   - THE ENUM LISTS ARE NOT CLOSED. RetailDocumentType has 18+ members and grows, and when no
     member carries a stored code the SERVER SENDS THE NUMBER AS THE NAME. An unknown value must
     render as itself. Rendering it blank hides exactly the case the field exists for.
   - THE KEY IS THREE PARTS. RetailTrx's primary key is four (Client + StoreCode + MachineCode +
     TrxNumber) but Client is a fixed '000' estate-wide and slated for removal, so it is not a
     request parameter, not a response field, and not on the wire. Do not add a fourth part.
   - IDENTITY IS NEVER SENT BY THE CLIENT. SIS.Api reads the user from the session row and passes
     it to the renderer as requestedBy for the audit journal. staffid/storecode headers are
     IGNORED on the cookie path - do not send them, do not add a 'who' parameter.
   - storeName IS NOT A BRANCH NAME, and this was measured against the live database, not guessed:
     Store.Description reads as the company name with the store code appended (1508 distinct
     values over 1540 stores). The spec states the exact Arabic; COPY it from there if you need it
     in a fixture, never retype it. Consequence for your slice: storeCode is the store's identity
     column, storeName is secondary, and this is NOT a server change to raise.
   - THE CLIENT DOES NOT FORMAT DATES INTO INSTANTS. trxDate and trxTime cross the wire as two
     raw strings (yyyy-MM-dd and HH:mm:ss) by estate convention, and they sort lexically. Join
     them for DISPLAY via @/core/util/date-format. Do NOT build a Date from them, in the screen or
     in a test helper - reconstructing an instant to compare against is how a client starts
     formatting, which is the drift the convention exists to prevent.
   - Money formats through @/core/money (it graduated at ticket 250 and already knows BHD is 3dp).
     itemLinesCount is a COUNT, not money - do not send it through the money formatter.
   - NO PAGING, NO EXPORT, NO FLOATING FILTER ROW, AND THE SCREEN LANDS EMPTY. All four INVERT
     what collection's spec-249 screens do, and each is argued in the spec: a full transaction
     number is near-unique by construction, so expect ONE row, and the 50-row cap is a TRIPWIRE
     rather than a page size (capReached true on an exact-match search means the DATA is wrong).
     The screen cannot guess a transaction number, so an auto-fired search on mount would be a
     guaranteed empty grid. Copying collection's defaults here is the easy mistake.
   - Do NOT reuse collection's CapBanner, GridStates or ScreenGate by importing them - A FEATURE
     MAY NOT IMPORT A FEATURE. Copy the shape. And do NOT graduate them to core\ either: the cap
     warning here is one t() string on a path that should never fire, and ScreenGate's third
     consumer is the graduation trigger, not its second.
   - This wave adds NO npm dependency. Specifically: no file-saver, no content-disposition parser,
     no PDF library, no date library, no AG Grid Enterprise. If a slice looks like it needs one,
     that is a BLOCKER, not a decision you take at 3am.
   - AG Grid is COMMUNITY here (36.0.1). Enterprise APIs do not exist.
4. This repo's standing rules are non-negotiable - a violation is a review finding, not a taste
   difference. Read the rule file when your slice touches its area (.claude\rules\):
   - feature-structure: features/<area>/<feature>/ layout; features NEVER import features - only
     app and layout reach in. Adding a feature has a checklist; follow it rather than improvising
     a folder. THIS WAVE CREATES A NEW AREA - re-read the Areas section.
   - i18n-zero-literal: NO user-visible string literal anywhere. Every one goes through t(), with
     its key added to the en bundle. This is the single most common AFK slip, because a literal
     renders perfectly and only the lint gate catches it.
   - logical-tailwind: logical utilities only - ms/me/ps/pe/text-start/text-end - never
     ml/mr/pl/pr/left/right. The app renders RTL; a physical utility is silently wrong in Arabic
     and looks perfect in English.
   - api-envelope: every server call goes through src/core/api.ts. Do not hand-roll a fetch. Wire
     models live in core/models/.
   - Path alias @/ maps to src/. Do not add deep relative import chains.
   - THERE IS NO DOCUMENTED EXCEPTION ANYWHERE IN THIS WAVE. Spec 249's facsimile carve-outs were
     specific to two Arabic paper forms; nothing here is a facsimile. Every rule applies to every
     file you write, unexceptionally.
5. How to verify - a green typecheck is NOT proof a screen works:
   - `npm run typecheck` is the fast inner loop; run it continuously.
   - `npm test` is vitest (node environment, src/**/*.test.ts). React Testing Library is
     deliberately NOT installed: pure modules are where regression is silent, components are thin
     renderers. So do NOT add RTL or reach for a component-rendering test - that is a separate
     hardening ticket's call, not yours at 3am. Push logic into pure modules instead; on this wave
     that means invoice-criteria.ts, invoice-columns.ts and download-outcome.ts carry nearly all
     of it, modelled on collection\inquiry\print-outcome.ts.
   - `npm run lint` runs three gates: import boundaries, token contrast, colour literals. Run it
     before you commit; on THIS wave the boundaries gate is the one that matters most, because a
     mis-shaped new area folder is exactly what it catches.
   - `npm run build` once at the end.
   - A UI slice is proven by DRIVING THE APP with a Playwright script under tools\*-drive.mjs.
     That needs a vite server: start one on port 5199 (NOT the default 5173, so you cannot collide
     with a dev server the human left running), run the drive against it, then KILL the server you
     started. Playwright is borrowed from C:/Playground/frontend/node_modules via a createRequire
     shim in the drive files - it is not a dependency of this repo. Follow an existing drive file
     rather than inventing a new harness; tools\bby-inquiry-drive.mjs is the nearest prior art.
   - THIS WAVE BUILDS ONE DRIVE FILE: tools\invoice-drive.mjs. Ticket 263 CREATES it; 264 and 265
     EXTEND the same file rather than starting a second one.
   - Pre-existing baseline for this wave, measured when this runner was generated -
     anything at or below this is NOT yours to fix:
     * npm run typecheck: CLEAN. Any error you see is yours.
     * npm test: CLEAN - 91 files, 1450 tests, all passing. Any failure you see is yours.
     * npm run lint: all three gates CLEAN (461 files for boundaries, 117 contrast pairs,
       466 files for colour literals with 4 documented exclusions). Those 4 exclusions are spec
       249's facsimiles; this wave must NOT add a fifth.
6. Proof checkboxes marked OWNER, manual-smoke, or needing a live backend are NOT yours: leave them
   unchecked, list them as outstanding in the ticket, and never fake or simulate them. In this wave
   that is all of ticket 266 (NOT in this run - it needs a live SIS.Api and a live render host, and
   a human to open the PDF in a viewer). Every OTHER Proof box on 262-265 must be real, written,
   and green - they were all written to be closable on stubs.
7. Several Proof boxes ask you to prove a gate is LOAD-BEARING by breaking something once and
   watching it fail (a fixture field's type, the i18n registration, a join). Actually do it, and
   say in the ticket what you saw. A mutation check that is only asserted is not a check.
8. Finish the /implement skill's own review step (built-in /code-review, then /standards-review)
   before you close the ticket. An INDEPENDENT /standards-review runs in a separate session right
   after this one against $baseSha, and its report lands in .afk\REVIEW-$t.md - so leave the commit
   in a state you would be happy to have reviewed cold.
9. Stage NARROWLY when you commit: your slice's files only. Do not commit .afk\ artifacts, drive
   screenshots, dist\, or anything you did not write for this ticket. Commit onto the CURRENT
   branch; never switch or create a branch.
10. BLOCKER = you cannot proceed safely at all: the spec contradicts itself, a required file or
    dependency is missing or unfetchable, the wire contract is unreadable, a slice would need a new
    npm dependency, or any choice risks breaking unrelated shipped behavior. Ticket 262 touches TWO
    SHIPPED features, so treat a broken existing CSV export as a blocker rather than something to
    push through. On a blocker:
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
        Say "    .\run-implements-spec261.ps1 -Tickets $(($Tickets | Where-Object { $_ -ne $t }) -join ',')" "Yellow"
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

You are reviewing ONLY the diff introduced by ticket $t of spec 261: git diff $baseSha...HEAD.
The fixed point is $baseSha - do not ask for one, do not widen the range.

This session is READ-ONLY with exactly one exception (the report file):
- Do NOT edit source, tests, .issues tickets or INDEX.md. Do NOT commit, stage, stash, revert or
  push ANYTHING. Do not run a drive that writes screenshots into the tree; reading the code and
  the diff is the job. `npm run typecheck` and `npm run lint` are fine - they write nothing.
- Write your full two-axis report (Standards and Spec) to $reviewDoc, overwriting it if present.
  Head it with the ticket number, the fixed point, and a one-line VERDICT: CLEAN, MINOR, or
  SERIOUS.
- Findings must be concrete: file:line, the rule or the spec line it violates, and what the fix
  would be. Say plainly when an axis is clean rather than manufacturing findings.
- Check every standing rule in .claude\rules\, and pay particular attention to the two that pass
  a human's eye: a user-visible string that never reached t(), and a physical Tailwind utility
  (ml/pr/left) where a logical one was required. Both render perfectly in English.
- THERE IS NO DOCUMENTED EXCEPTION IN THIS WAVE. Spec 249's facsimile carve-outs do not extend
  here; nothing in spec 261 is a facsimile. A literal, a physical utility or a colour literal
  anywhere in this diff IS a finding, and the count of documented palette exclusions must still
  be 4.
- The wave's own rules to check against, worst-first:
  The wire models must match the contract at
  C:\Work\DMSCO\BackOffice\.issues\assets\988-search-download-contract.md section 2
  FIELD-FOR-FIELD - a renamed, added, dropped or softened field is a SERIOUS finding.
  503 and 504 mapping to the same sentence or the same retry-ability is a SERIOUS finding, as is
  mapping either to the generic server message. A client-side automatic retry loop is a SERIOUS
  finding (SIS.Api already retried twice). Branching a 403 on the error CODE rather than on
  err.status is a finding - that response carries no body at all. A hand-rolled fetch anywhere
  outside core/api.ts is a SERIOUS finding (api-envelope), as is a second createObjectURL copy
  after 262 was supposed to consolidate them - after 262, `git grep createObjectURL` must match
  core\util\download-file.ts and NOTHING else. A fourth key part (Client) on any request, or a
  staffid/storecode header, is a SERIOUS finding. Filtering unrenderable rows out of the search,
  disabling their download action, or deriving a 'renderable' flag CONTRADICTS AN OWNER RULING -
  SERIOUS; the confirm step is the only sanctioned mitigation. An unknown enum code rendering as
  a blank rather than as its number is a finding. Building a Date from trxDate+trxTime, in the
  screen OR in a test helper, is a finding. Money not going through @/core/money, or a count
  going through it, is a finding. A flat features\reports\ folder, or any sibling folder beside
  retail-invoice\ under it, is a SERIOUS finding (the boundary gate treats siblings as separate
  features). An i18n namespace that is registered twice, or not at all, is a finding. Any new npm
  dependency is a SERIOUS finding. Importing anything from features\collection\ or
  features\pricing\ is a SERIOUS finding. Backend-blocked or owner-only Proof boxes must be
  honest, not faked green - all of ticket 266's are legitimately outstanding and are not in this
  run.

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
Say "Spec 261 frontend wave complete. Read .afk\REVIEW-*.md and .afk\HITL-*.md before trusting the results." "Green"
Say ">>> Ticket 266 (the screen calls the real door) was NOT in this run. It needs a live SIS.Api AND a live render host - the render host is a verb of the net472 WPF exe, binds 127.0.0.1:8971 LAST after ~31s of eager template compiles, and reads its database from the Config.xml beside it. Assets are at C:\dev\renderhost-test\ (Postman collection, renderhost.config, web-leg.ps1). <<<" "Yellow"
Say ">>> Everything built tonight runs on stubs and fixtures. A screen that is perfect against a stub can still be wrong against the wire - 266 is where that is found out, and it also settles contract section 6.2 (whether 'amount' is the number a person recognises) by comparing the grid row against the PDF it just downloaded. <<<" "Yellow"
Say ">>> Check .afk\HITL-*.md for wording decisions taken unattended - the error sentences in ticket 265 are user-facing copy and were chosen from the contract's suggestions, not from a designer. <<<" "Yellow"
Say ">>> 262 touched TWO SHIPPED features (admin\ua-admin and collection\inquiry both lost their local downloadCsv). Before trusting the wave, run tools\collection-drive.mjs and export a CSV from the UA Admin screen by hand - a broken export there is the one regression this wave could have caused. <<<" "Yellow"
