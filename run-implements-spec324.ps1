# Runs /implement + /standards-review for the spec 324 prescriptions-on-the-order-page tickets (325-331: lift the slip drawer into core/attachments, then the order page's Attachments tab) in fresh Claude Code sessions,
# sequentially, fully AFK.
#
#   .\run-implements-spec324.ps1                  (325, 326, 327, 330, 331, 328, 329)
#   .\run-implements-spec324.ps1 -Tickets 330,331
#   .\run-implements-spec324.ps1 -DryRun          (pre-flight + plan only, starts nothing)
#   .\run-implements-spec324.ps1 -SkipReview      (implement rounds only)
#   .\run-implements-spec324.ps1 -SmokeTest       (one trivial session through the real harness)
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
# Dependency map (324 spec; nothing of this wave has landed; BackOffice 2061/2062/2063 are DONE (merged dfda68dab on pricing2), BackOffice 2077 is OPEN and stubbed):
#   325 --> 326 --> 327 --+-- 328
#                         +-- 329
#                         +-- 330
#                         \-- 331   (soft: 331 reuses the ONE caption/note clamp 330 generalises)
#   BackOffice 2063 + 2077 feed 327 (model fields); 2061 feeds 330 (Upload); 2062 feeds 331 (reasons, grant)
#
# Running order:
#   * 325 then 326, exactly topological and on purpose FIRST: the lift is the shared surface every later
#     slice renders through, and it must land with the four slip drives untouched before anything new
#     rides on it.
#   * 327 next: Slice 0 (the gate, the badge number, the audited first-selection read). 328-331 block on it.
#   * 330 before 331 (siblings): 330 generalises the withdraw-note clamp into the ONE caption/note clamp and
#     adds the caption mode to the shared panel's Add; 331 then reads that clamp instead of re-deciding it.
#   * 330 and 331 before 328 and 329: they change the SHARED core panel that the slip drawer also renders
#     (shared-surface changes run early); 328 (fields.ts + SummaryRail) and 329 (one heading) are page-local.
#   * Nothing is pushed to the end for a backend reason: BackOffice 2077 is unbuilt, but every slice
#     proves against its Web contract stub at Playwright, as spec 324 directs.
#
# Preconditions (the script checks 1, 2 and 4 - you own 3 and 5):
#   1. Nothing in this repo blocks it. (BackOffice 2061/2062/2063 are done; 2077 is open and stubbed - each session checks.)
#   2. No TRACKED modifications in the tree (untracked files are fine and only warn).
#   3. YOU ARE ON THE RIGHT BRANCH. This runner never switches branches - it commits onto
#      whatever is checked out now. Waves here are often built on a feature branch rather
#      than main, and the tickets themselves may only exist on that branch.
#      Expected for this wave: spec324 (worktree C:\Playground\oms-react-spec324)
#   4. node_modules is installed (npm ci / npm install) - checked, because a missing install
#      turns every slice's typecheck into a wall of phantom errors at 3am.
#   5. A live SIS.Api on :5111 is NOT required - every slice stubs the network at Playwright against the BackOffice Web contracts (2077's included). Run it FROM the worktree C:\Playground\oms-react-spec324 (branch spec324), with npm ci done there. Playwright is borrowed from C:\Playground\frontend.
param(
    [int[]]$Tickets = @(325,326,327,330,331,328,329),
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
Say "Branch: $branch   (expected for this wave: spec324 (worktree C:\Playground\oms-react-spec324))" "DarkGray"

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
   - The spec is .issues\324-prescriptions-on-the-order-page-web-half-spec.md and the wayfinder map is
     C:\Work\DMSCO\BackOffice\.issues\2054-attachments-on-oms-sales-documents-spec.md (the governing BackOffice spec; its decision ticket 2050 section G; there is no wayfinder map). Read the spec AND your ticket.
     No ticket of this wave had landed when this run began; read the committed diffs of the
     ones that ran before yours in THIS run (git log on spec324) before re-deciding anything they settled.
     The code being lifted is spec 319's slip wave (tickets 320-323, on main): read those tickets'
     Comments for the rulings already baked into it.
   - SCOPE WALLS. No npm dependency (a slice that needs one is a BLOCKER), no route, no menu leaf, no grant,
     no new area or feature folder. The wave touches exactly: src\core\attachments\ (NEW, 325), src\core\models\
     (shared attachment types, the sd-document fields), src\core\i18n.ts + src\locales\en\attachments.json (NEW
     namespace, 326), features\collection\inquiry (the slip drawer becomes a CALLER), features\oms\document (the
     order page becomes a caller), and tools\order-attachments-drive.mjs (NEW in 327; 328-331 extend it).
   - THE LIFT IS A MOVE, NOT A COPY (325, 326). When a module moves into core\attachments the old file in
     collection\inquiry is deleted or shrinks to its slip-only remainder - never two copies of one rule. Prefer
     git mv where a file moves whole. oms\document reaches the panel ONLY through @/core/attachments (features
     never import features), and nothing under core\attachments imports @/features/* (the lint boundary gate).
   - NO BEHAVIOUR CHANGE IN 325/326, AND THE PROOF IS FROZEN. The slip vitest suites move with their modules,
     re-pointed at the new paths with ASSERTIONS UNCHANGED (re-pointing an import is fine; changing an expected
     value is not). tools\slip-count-drive.mjs, slip-drawer-drive.mjs, slip-add-drive.mjs and slip-withdraw-drive.mjs
     must pass WITHOUT A SINGLE EDIT - in 325, in 326, and in EVERY later ticket of this wave (330 and 331 change
     the shared panel too). Run all four every ticket. A drive that seems to need an edit means the code changed
     behaviour: fix the code, never the drive; if you truly cannot, that is a finding for HITL, not a quiet edit.
   - ONE PROBE ENTRY. GET AttachmentWeb/Access stays ONE shared TanStack query: 325 moves SLIP_ACCESS_KEY under the
     new 'attachments' key head, and the slip grids, the drawer and the order page all read that same key. Read it
     through holdsCategory (Array.isArray + includes): a bare string 'P2E' must read FALSE. Pending, refused (503
     NOT_SET_UP, 403, network) or malformed = hidden.
   - FRESHNESS IS A PARAMETER, NOT A CONSTANT (325 introduces it, 327 uses it). The slip drawer keeps today's
     behaviour exactly (a new ByOwner read on every drawer opening). The order tab: staleTime Infinity, no refetch
     on focus or reconnect, gcTime 0. EVERY ByOwner and /Content fetch writes an AUDIT ROW on the server, so an
     extra fetch is a correctness bug, not a performance nit.
   - THE AUDITED READ (327) IS THE HEART OF THE WAVE. ByOwner is fetched on the tab's FIRST SELECTION - never on
     page load and never on the panel's mount. The page's tab panels STAY MOUNTED (hidden) by the page's own rule,
     so a query enabled on mount is exactly the bug: latch an 'opened' flag on first selection and gate enabled on
     it. The page's Refresh re-reads ByOwner only once that flag is set. No file is ever auto-selected, so no
     /Content before a click. The drive COUNTS requests and asserts ZERO ByOwner on load - that count is the proof.
   - THE GATE AND THE NUMBER (327). The tab shows only with attachmentOwnerNo present AND attachmentCategory
     present AND the probe's categories holding that category. The badge is ONE pure function: before the list
     loads, the model's attachmentCount (0 shown as 0); after, the STORED list's length; absent count and no list
     => NO badge, never 0. 328's Files row uses the SAME function - never a second count.
   - REASONS ARE DATA (326 makes them a parameter, 331 feeds the server's). Panel shape:
     { code, label, labelArabic?, noteRequired }[]. The slip drawer KEEPS its client five-code list resolved from its
     bundle keys (OTHER is noteRequired) even though ByOwner now also answers withdrawReasons for STORE_DAY
     (BackOffice 2062): moving slips onto the server's list is OUT OF SCOPE, ruled. The order tab uses ONLY the
     response's withdrawReasons, in the order sent; absent or empty => Withdraw hidden; never copy 2062's reason
     table into the web and never add a client fallback list.
   - THE UPLOAD FORM (330). One builder serves both callers. The slip form stays BYTE-IDENTICAL: the same six parts
     in the same order, no Caption, no SourceDevice - the existing slip-upload test pins it and passes unchanged.
     SD_DOCUMENT parts: ClientRequestId, OwnerKind=SD_DOCUMENT, OwnerKey=<attachmentOwnerNo>,
     Category=<attachmentCategory>, Kind=PRESCRIPTION, Caption ONLY when non-empty after the clamp, then the file.
     OwnerKey is ALWAYS attachmentOwnerNo - on a delivery's page too, never the route's number.
   - ONE CLAMP (330). Caption and withdraw note share ONE pure function: trim, then cut to 200 without splitting a
     surrogate pair. Generalise the withdraw-note rule 325 moved; do not write a second one. Its existing cases
     still pass through it.
   - RETRY BY CODE, NEVER BY STATUS (330) - the slip rule, unchanged. Network, a codeless 5xx, or
     FILE_SERVER_UNREACHABLE retry and keep the file's ClientRequestId (the lifted zustand store, keyed by owner
     kind + owner key). NOT_SET_UP (a coded 503) does not; a bare 403 (no body => core kind unknown, no code) does
     not. There is NO client file cap: ATTACHMENT_TOO_MANY is the server's answer, shown as sent, no retry.
   - THE UNKNOWN-DOCUMENT REFUSAL (330's open question): BackOffice 2061 names it DOCUMENT_NOT_FOUND (404) (2061's
     ticket, around its line 94). Confirm it in AttachmentRefusal.cs, record it in 330's comments, show it as sent
     with no retry. It shares 404 with /Content's NOT_FOUND - which is why every branch here is by CODE.
   - THE WITHDRAW GATE (331). withdrawCategories must hold attachmentCategory, by holdsCategory. Per 2062 only P2E
     and ALTIBBI have withdraw grants, so an ERX order never offers Withdraw - correct, not a bug. A bare 403 on the
     withdraw POST removes Withdraw for the rest of the page visit: the ONE place a status branch is right.
   - THE CARD ROW (328). fields.ts stays pure: the page hands it N and a 'files row allowed' flag; fields.ts never
     reads the probe. The card row type gains an optional action (SummaryRail renders it as a button) beside href;
     a row has one or the other. The Rx document link row is unchanged; existing fields.test.ts cases pass unchanged.
   - NO DEEP LINK. Add no tab query parameter and change no URL (HQ WPF's link-out opens on Items - ruled).
   - TIMESTAMPS go through wallClockText, never Date. Source line: sourceDevice when set, else the slip's
     'Web <sep> uploadedBy' label, unchanged; a partner row's 'KEY:<UserId>' device is shown as sent.
   - WORDING. The panel's own words move into the NEW attachments namespace (326) with their VALUES UNCHANGED,
     byte for byte (copy them from collection.json as UTF-8 - they contain a middle dot). Caller words: the slip's
     stay in collection; the order tab's (the tab name, Add prescription, the caption label, the 'Filed on order'
     sentence with the number as a NAMED interpolation param, the Files row) go in document. Server text (refusal
     messages English-then-Arabic, reason label/labelArabic) is shown as sent, never re-translated. All new wording
     waits on the owner's read: choose plain words, log them in HITL, move on.
   - THE ARABIC LAYOUT. document-rtl-drive must also cover the new tab (327), and an Arabic caption (330) must
     round-trip exactly - assert the posted Caption part, not just the rendered text.
   - THE DOCUMENT DRIVES. document-detail, -cards, -rail, -rtl, -band, -items and -actions must stay green from 327
     on. Their stubs do not answer AttachmentWeb/Access or carry attachmentOwnerNo, so the tab must stay HIDDEN
     there and they should pass unmodified; if one breaks, the fail-closed path is wrong - fix the code.
   - THE CONTRACTS LIVE IN THE OTHER REPOSITORY: C:\Work\DMSCO\BackOffice (branch pricing2; spec 2054 merged
     as dfda68dab). The shapes are under '## Web contract' in .issues\2063-the-document-read-names-the-files-owner-
     and-counts-them.md (attachmentOwnerNo, attachmentCount) and .issues\2062-head-office-withdraws-a-wrong-
     prescription.md (withdrawReasons, withdrawCategories), and in the What to build of .issues\2061-a-file-is-
     attached-to-an-order-after-it-is-created.md (Upload's parts, cap and refusal codes - it has no Web contract
     heading). If that checkout is not on pricing2, read with git -C <repo> show pricing2:<path>. You may READ its
     .issues and source. You may NOT edit, stage, commit, switch branch, build, test or run anything there - it has
     its own loop and reviewer. If you think something there is wrong, log it to HITL and carry on.
   - FIRST ACT OF EVERY TICKET from 327 on: confirm BackOffice 2061, 2062 and 2063 are 'status: done'. If not, that
     is a BLOCKER: log it and stop with AFK-BLOCKED.
   - BACKOFFICE 2077 IS NOT BUILT, AND THAT IS EXPECTED - it is NOT a blocker. It adds attachmentCategory to the
     document read (filed 2026-09-27, status open, on disk in the BackOffice .issues folder but not yet committed,
     so read the file directly rather than via git show). 327-331 build against its Web contract STUB, exactly:
       GET SdDocumentWeb/Document/{no} and SdDocumentWeb/Delivery/{no}: data (SdDocumentHeaderModel) gains
       attachmentCategory (string) = P2E, ERX or ALTIBBI, the category of the attachmentOwnerNo document's
       accept-list line. ABSENT (not null, not empty) when the owner's pair takes no attachments or the read could
       not answer. The web fails closed on absent (no tab) and sends it as Upload's Category.
     Invent no fallback for it: no mirror of the accept list, no reading of the page's documentType/documentSource,
     no use of attachmentOwnerDocument - spec 324 ruled all three out. If 2077's ticket has renamed the field since,
     follow the ticket and log the drift.
   - Cross-check each contract against the committed BackOffice code spec 324 names (SdDocumentHeaderModel.cs,
     SdDocumentAttachmentReads.cs, AttachmentWebEndpoints.cs, AttachmentDto.cs, WithdrawnAttachmentDto.cs,
     AttachmentRefusal.cs). If ticket and code disagree, follow the CODE (it is what will be served), log it to
     HITL and record the drift in your ticket's comments. Stub EXACTLY that shape; never invent a field or a part.
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
   - One Bash call may carry MANY reads. `cat a.tsx b.tsx; sed -n '1,80p' c.ts; grep -n X d.ts`
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
   - `npm run typecheck` is the fast inner loop; run it continuously.
   - `npm test` is vitest (node environment, src/**/*.test.ts). React Testing Library is
     deliberately NOT installed: pure modules are where regression is silent, components are thin
     renderers. So do NOT add RTL or reach for a component-rendering test - that is a separate
     hardening ticket's call, not yours at 3am.
   - `npm run lint` runs three gates: import boundaries, token contrast, colour literals. Run it
     before you commit; it is what catches a stray literal or a raw hex colour.
   - `npm run build` once at the end.
   - A UI slice is proven by DRIVING THE APP with a Playwright script under tools\*-drive.mjs.
     That needs a vite server: start one on port 5199 (NOT the default 5173, so you cannot collide
     with a dev server the human left running), run the drive against it, then KILL the server you
     started. Playwright is borrowed from C:/Playground/frontend/node_modules via a createRequire
     shim in the drive files - it is not a dependency of this repo. Follow an existing drive file
     rather than inventing a new harness.
   - If a drive genuinely cannot run (it needs a live SIS.Api that is not up, or Playwright does
     not resolve), that is an OUTSTANDING PROOF, not a blocker and never something to fake: stub
     the network at Playwright where the ticket allows it, otherwise leave the Proof box unticked,
     say exactly why in the ticket, and finish the rest of the slice.
   - Pre-existing baseline for this wave, measured when this runner was generated -
     anything at or below this is NOT yours to fix:
     * npm run typecheck: CLEAN. Any error you see is yours.
     * npm test: CLEAN - 147 files, 2571 tests, all passing. Any failure is yours.
     * npm run lint: all three gates CLEAN (boundaries 657 files, contrast 129 pairs, palette 662 files).
     * The four slip drives and the seven document-* drives were green when their tickets closed (not
       re-run for this baseline); treat any red among them as yours until proven otherwise.
7. Proof checkboxes marked OWNER, manual-smoke, or needing a live backend are NOT yours: leave them
   unchecked, list them as outstanding in the ticket, and never fake or simulate them. In this wave
   that is the owner's hand walk against a live SIS.Api (2071's Proof: P2E read only, then read + withdraw - the tab, Add with an Arabic caption, Withdraw as WRONG_ORDER, the trail, a delivery's page), anything that needs BackOffice 2077 actually served, and the owner's read of every new or moved string. The ticket may still complete AFK with those open; every OTHER
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
        Say "    .\run-implements-spec324.ps1 -Tickets $(($Tickets | Where-Object { $_ -ne $t }) -join ',')" "Yellow"
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

You are reviewing ONLY the diff introduced by ticket $t of spec 324: git diff $baseSha...HEAD.
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
- The wave's own rules to check against:
  no new npm dependency, route, menu leaf, grant or feature folder; the lift is a MOVE (no rule left in two
  places) and nothing under core/attachments imports a feature; the four slip drives and the moved slip vitest
  assertions are UNCHANGED (any edit to them is SERIOUS); the Access probe is ONE shared query read through
  holdsCategory (a bare string fails); the tab gate fails closed on an absent owner, an absent category, and a
  pending/refused/malformed probe; ByOwner is NEVER fetched on page load or panel mount - only on the tab's first
  selection, with staleTime Infinity / gcTime 0 for the order tab while the slip drawer keeps its per-open read;
  no /Content before a click; one pure badge number feeds both the badge and the Files row, and absent means no
  badge (never 0); the slip upload form is byte-identical and the SD_DOCUMENT form sends Caption only when
  non-empty and never SourceDevice, with OwnerKey always attachmentOwnerNo; one caption/note clamp; retry by
  code, never by status; the order tab's reasons are the response's withdrawReasons only (no copied table, no
  fallback) while the slip drawer keeps its client list; Withdraw needs withdrawCategories and a bare 403 removes
  it; fields.ts stays pure; no deep-link parameter; moved i18n values are byte-identical and new keys land in
  attachments (panel) or document (order tab); every server field used appears in BackOffice 2061/2062/2063 or
  2077's Web contract or the committed SIS.Api code - an invented field is SERIOUS; nothing in the BackOffice repo
  was touched; stubbed Proof boxes are honest.

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
Say "Spec 324 wave complete. Read .afk\REVIEW-*.md and .afk\HITL-*.md before trusting the results." "Green"
Say ">>> BackOffice 2077 (attachmentCategory on the document read) is still to BUILD - until it ships the order tab stays hidden on a live SIS.Api (fails closed); tonight 327-331 were proven against its Web contract stub. <<<" "Yellow"
Say ">>> Nothing is live until OMS DB script 004, the grant seed, SIS.Api (with 2077), the till and HQ WPF deploy; until the File Server key exists (BackOffice 1962) the probe answers 503 NOT_SET_UP and the tab stays hidden - correct, not a bug. <<<" "Yellow"
Say ">>> Owner hand walk (2071 Proof) against a live SIS.Api: P2E read only, then read + withdraw - the tab, Add with an Arabic caption, Withdraw as WRONG_ORDER, the trail, a delivery page. <<<" "Yellow"
Say ">>> The owner still owes a read of every new or moved string (attachments + document bundles) and of the drafted Arabic reason labels served by 2062. <<<" "Yellow"
Say ">>> Merge back: from C:\Playground\oms-react run git merge --ff-only spec324 (rebase spec324 onto main first if main moved). Copy .afk\REVIEW-*.md and .afk\HITL-*.md out BEFORE any git worktree remove. <<<" "Yellow"
