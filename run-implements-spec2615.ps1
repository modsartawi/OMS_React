# Runs /implement + /standards-review for the Deliverect screens (oms-react 477-482, web half of BackOffice spec 2615 - "Deliverect: orders, catalog, stock and store status for every delivery platform") in fresh Claude Code sessions,
# sequentially, fully AFK.
#
#   .\run-implements-spec2615.ps1                  (477, 480, 481, 478, 479, 482)
#   .\run-implements-spec2615.ps1 -Tickets 479,482
#   .\run-implements-spec2615.ps1 -DryRun          (pre-flight + plan only, starts nothing)
#   .\run-implements-spec2615.ps1 -SkipReview      (implement rounds only)
#   .\run-implements-spec2615.ps1 -SmokeTest       (one trivial session through the real harness)
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
# Dependency map (BackOffice spec 2615; the spec lives in the C# repo, hence this file's name; nothing of this wave has landed yet; 483 is live-only and excluded):
#   477 --+-- 478 --+
#         +-- 479 --+
#         +-- 480 --+--> 483  (live doors on staging + owner walk - NOT in this run)
#         +-- 481 --+
#         \-- 482 --+
#
# Running order:
#   * 477 FIRST (it blocks everything): it creates the deliverect area, the menu group, the access
#     probe, src\core\models\deliverect.ts for EVERY door, the shared reason rule, and the Stores page.
#   * 480 and 481 NEXT, back to back, ahead of the other siblings: both EXTEND 477's Stores page, its
#     grid, its namespace and tools\deliverect-stores-drive.mjs. Building them while 477's page is
#     the newest thing on the branch keeps that one page and one drive coherent.
#   * Then 478, 479, 482 - each a new feature folder + route + menu leaf + namespace. Sequential
#     anyway (all three touch router.tsx, menu-model.ts and i18n.ts). 479 before 482 so the shared
#     Platforms read lands in core once and 482 reuses it.
#   * 483 is EXCLUDED: its Done-when is a green live drive on staging plus the owner's walk.
#   * No slice is more backend-blocked than another: every BackOffice door (2616, 2623-2627) is
#     unbuilt, so every slice stubs the network at Playwright against the door contract.
#
# Preconditions (the script checks 1, 2 and 4 - you own 3 and 5):
#   1. Nothing outside this wave blocks it.
#   2. No TRACKED modifications in the tree (untracked files are fine and only warn).
#   3. YOU ARE ON THE RIGHT BRANCH. This runner never switches branches - it commits onto
#      whatever is checked out now. Waves here are often built on a feature branch rather
#      than main, and the tickets themselves may only exist on that branch.
#      Expected for this wave: spec/2615-deliverect (worktree C:\Playground\oms-react-spec2615)
#   4. node_modules is installed (npm ci / npm install) - checked, because a missing install
#      turns every slice's typecheck into a wall of phantom errors at 3am.
#   5. A live SIS.Api is NOT required - BackOffice 2616 and 2623-2627 are unbuilt, and every slice stubs the network at Playwright. Drives run on port 5196, NOT 5199 (the sibling spec 470 wave in C:\Playground\oms-react-spec470 uses 5199). Playwright resolves from C:/Playground/frontend/node_modules (the drives' createRequire shim).
param(
    [int[]]$Tickets = @(477,480,481,478,479,482),
    [string]$Model = "opus",
    # No stream output for this long => the session is wedged; kill the tree and stop.
    [int]$StallMinutes = 25,
    # Absolute ceiling for one session, however chatty it is.
    [double]$MaxHours = 5,
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
Say "Branch: $branch   (expected for this wave: spec/2615-deliverect (worktree C:\Playground\oms-react-spec2615))" "DarkGray"

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
   - The spec is C:\Work\DMSCO\BackOffice\.issues\2615-deliverect-delivery-platforms-spec.md and the wayfinder map is
     (none - spec 2615 was grilled directly, 2026-10-12; its ADRs are C:\Work\DMSCO\BackOffice\docs\adr\0078-*, 0079-*, 0080-*). Read the spec AND your ticket.
     No ticket of this wave has landed before tonight. Every ticket landed earlier in THIS run is on
     this branch - read its committed diff before re-deciding anything it settled.
   - THE WIRE: C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md is
     the ONLY source of request and response shapes. Read it IN FULL (Common, Error codes, Access and
     your section) before coding. Invent no field, rename none, drop none you render. Stubs emit
     EXACTLY the contract's fields, on the real envelope { statusCode, success, message,
     errors: [{ errorCode, internalErrorCode, errorMessage }], data } - a refusal's code is in
     errors[].errorCode and its errorMessage is "<English> / <Arabic>" (show it as server text,
     <bdi>, through apiErrorMessage; branch on apiErrorCode). Copy the envelope helper from an
     existing drive (tools\materials-search-drive.mjs) rather than writing a new one.
   - Glossary: the Deliverect sections of C:\Work\DMSCO\BackOffice\CONTEXT.md (Deliverect,
     Delivery platform, Deliverect account, Deliverect store, Platform exclusion, Stock sync
     (paused), Material). Those are the words in code and copy. Never "chain", never an unqualified
     "channel" in copy (channelId / channel display id are field names, fine as column labels).
   - NEW AREA: src\features\deliverect\ (new nav group + new URL prefix /deliverect/*). Features:
     stores (477, extended by 480 + 481), orders (478), catalog (479), terms (482). The Materials
     area is the precedent to copy for every registration point: src\core\materials\api.ts +
     access.ts (one probe, one key, per-leaf predicate, FAILS CLOSED, materialAccessQuery shape),
     the materialProbe helper + group in src\layout\menu-model.ts, and the en+ar imports in
     src\core\i18n.ts. The Deliverect group goes LAST in MENU (after Materials).
   - CORE OWNS THE SHARED PIECES (features never import features). 477 creates, later slices
     EXTEND, never fork:
     * src\core\models\deliverect.ts - 477 writes the types for EVERY door in the contract, field
       for field (Stores incl. the sync and status blocks, Catalog, Stock sync, Store status, Orders
       incl. detail lines/statuses, Accounts, Platforms, Terms, Access). Later slices fix a drift
       they can show against the contract and log it; they do not re-model.
     * src\core\deliverect\api.ts + access.ts - GET DeliverectWeb/Access, DELIVERECT_ACCESS_KEY,
       four predicates (canManageStores / canManageCatalog / canViewOrders / canManageTerms).
       Every page also gates itself on its flag (in-page denied backstop, the Materials pattern).
     * The reason rule (reasonField: trimmed length 1-200, unicode kept, DLV-00009 inline) lives in
       src\core\deliverect\ because EVERY write in 477-482 carries a reason. If 477 builds a
       shared reason field/dialog component, it goes there too, and later slices reuse it.
     * Reads used by two features live in src\core\deliverect\ too: GET DeliverectWeb/Accounts
       (477 onboard/move + filter, 482 list) and GET DeliverectWeb/Platforms (479 exclusions, 482).
   - MENU, RULED (overrulable by the owner): the ticket's "placeholders that 478-482 fill in" means
     LABELS, not dead links. 477 adds the group label and all four leaf labels to deliverect-stores
     (the area's first namespace, the Materials precedent) and only the Stores leaf. 478, 479, 482
     each add their own leaf + route in the same commit as their page. A leaf never routes to a
     page that does not exist yet.
   - I18N, RULED: four namespaces == feature names: deliverect-stores, deliverect-orders,
     deliverect-catalog, deliverect-terms. Each ships en AND ar (477 and 481 require Arabic; the
     area is bilingual), registered in core\i18n.ts with its ar import. 480 and 481 add keys to
     deliverect-stores, no new namespace. Arabic plurals: any count key needs _zero/_one/_two/_few/
     _many/_other in ar (ticket 433 shipped SERIOUS for missing them). Every drive runs LTR AND RTL.
   - CONTRACT GAP, RULED - the grant table puts Accounts and Platforms/* behind canManageTerms
     (DeliverectTerms), but 477 (canManageStores) needs the account list and 479
     (canManageCatalog) needs the platform list. Build both against the doors as specified, and
     handle a 403 deliberately:
     * 477: if Accounts is refused, the account field falls back to a free-text key with the
       distinct accountKey values from the loaded store rows as suggestions; DLV-00003 catches a
       wrong key. The account FILTER uses the same distinct values.
     * 479: if Platforms is refused or still loading, the exclusion editor shows a "platform list
       unavailable" state and Save is DISABLED. Never render an empty checkbox list that can be
       saved: excluded = (all platform keys) minus (ticked), so an empty list would send [] and
       silently re-enable every platform for that material.
     * Both: one line each under '## Contract gap' in the HITL doc (ask: let those reads ride any
       Deliverect grant). Stub drives cover the 200 path AND the 403 path.
   - EXCLUSION TRAP (479): a key in a row's excludedPlatforms that is NOT in the Platforms read
     (inactive or retired platform) is KEPT in the set sent and shown as a read-only chip -
     exclusionSet must never drop what it cannot display. Saving REPLACES the set (contract).
   - XLSX IMPORT (479): no new npm dependency. The app's only xlsx READER is
     src\features\oms\central-invoice\xlsx.ts (xlsxRows) - a feature file 479 may not import.
     RULED: 479 graduates it to src\core\util\xlsx-read.ts with git mv (its xlsx.test.ts and the
     __fixtures__\deliveries.xlsx it reads move with it), repoints CentralInvoicePage.tsx, and
     changes NO behaviour; central-invoice's tests stay green unchanged. Pasted text goes through
     the same parseMaterialList (trim, de-duplicate, drop blanks, 5000 cap refused client-side
     before sending). Show added / reactivated / the unknown list with a Copy action.
   - STORES PAGE (477 -> 480 -> 481): sync and status are null until BackOffice 2624/2625 ship.
     477 renders those columns only when the data carries them; its drive's null-fixture
     assertions stay green UNCHANGED when 480/481 add populated fixtures and new sections to the
     SAME tools\deliverect-stores-drive.mjs (append sections; header note per slice). Linked =
     deliverectLocationId non-null; else "Onboarded, not linked". The onboard warning
     (onDirectHungerStation true + envelope message) is a WARNING tone, never an error, and the
     dialog still succeeds. Move and remove confirm that the link will be cleared.
   - SYNC HEALTH (480): the contract does not enumerate lastStatus beyond "S". RULED: "S" is ok,
     any other non-null value is failed; null (never ran) is neutral. Overdue: no full run since
     today's 07:00 once it is past 07:30 local, or no delta run in the last 60 minutes (twice the
     30-min cadence) while active. A paused store (active false) is never overdue - it shows
     Paused instead. Put both thresholds in named constants with a comment pointing at spec 2615
     "Cadence". The pause dialog says in words that pausing stops stock pushes only; the store stays
     listed and still receives orders.
   - STORE STATUS (481): action busy|close|reopen; delayMinutes sent for busy ONLY (a positive whole
     number). Hours rows are { day, open, close, overnight }: hoursLabel builds ONE string with
     formatRange and appends a "next day" key when overnight, isolated once (Ltr) - never two
     isolates around the ends. DLV-00010 and DLV-00011 inline in the action dialog.
   - ORDERS (478): from/to are date-only, both always written to the URL and always sent. The
     31-day cap, RULED: inclusive day count from..to <= 31, one named constant; log the
     inclusive reading under '## Contract gap'. "Today" is the browser's LOCAL date built from
     getFullYear/getMonth/getDate - NEVER toISOString(). Repeatable platform/outcome = repeated
     query keys (check what buildQuery in src\core\api.ts does with an array before relying on
     it). outcome values: created, refused, droppedLines, cancelled, statusFailed. statusLabel
     maps 20/90/110/120/126 to keys; an unknown code shows its raw number, neutral. A 126 status
     (cancel after invoicing) is the alert row - danger token + "needs a person" wording. Retry is
     offered ONLY for outcome refused or statusFailed. Export via gridSheet + writeWorkbook
     (@/core/util/grid-xlsx). The drawer follows the SHEET recipe in src\core\ui\overlay.ts;
     src\features\admin\sync-console\SnapshotDrawer.tsx is the precedent for the drawer AND
     the read-only JSON view - copy the pattern, never import it.
   - RAW DOOR GAP (478): the contract says Orders/{id}/Raw returns "the raw body (text/plain JSON),
     plus receivedAt" and does not name the data fields. RULED: read BackOffice 2626 first; if it
     pins the shape, follow it. If not, treat it as an enveloped data object, name its two fields
     in ONE place in core\models\deliverect.ts with a "contract gap" comment, and log it under
     '## Contract gap'. Display the body verbatim (pretty-print only if it parses; never alter it).
   - TERMS (482): rows are never edited or deleted - no edit or delete affordance. Add terms
     creates from a date; the dialog says the previous open row closes the day before. termsTimeline
     sorts by validFrom, marks the row with validTo null as current, and flags a proposed validFrom
     inside an existing row (client hint; DLV-00008 from the server stays authoritative, inline).
     Platform edit: active cannot be ticked without a creditCustomer, and the UI says why (its
     orders would be refused).
   - MONEY + TIME: money is formatMoney3 (@/core/util/number-format) with its currencyKey, in Ltr
     (grids: valueFormatter, no fsi). Times are local "yyyy-MM-ddTHH:mm:ss" strings - format with
     existing helpers, never append Z, never new Date(...).toISOString().
   - PORT, overrides the standing verification section below: run vite on 5196
     (npx vite --port 5196 --strictPort) and every drive with DRIVE_PORT=5196 (drives read
     process.env.DRIVE_PORT; give each new drive the same line). A sibling wave (spec 470,
     worktree C:\Playground\oms-react-spec470) drives on 5199, and a drive that reaches the OTHER
     worktree's server proves the wrong code. If 5196 is taken, use 5195; never kill a node or
     vite process you did not start. To stop YOUR vite, kill ONLY the PID that owns the port:
     Get-NetTCPConnection -LocalPort 5196 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }.
     NEVER match processes by CommandLine (no Get-CimInstance Win32_Process | Where CommandLine -like '*vite*'):
     your own claude.exe command line contains this briefing, including the words vite and 5196, so a
     CommandLine match kills you mid-slice and the slice is lost uncommitted. That sibling also edits router.tsx, menu-model.ts and
     i18n.ts on its own branch - keep your hunks there small and appended, it eases the merge.
   - This wave adds NO npm dependency. A slice that seems to need one is a BLOCKER.
   - The governing spec, the door contract and the BackOffice tickets (2616, 2623-2627) live in
     the OTHER repository (C:\Work\DMSCO\BackOffice). You may READ them and any file they name.
     You may NOT edit, stage, commit or run anything in that repository - it has its own branch,
     its own loop and its own reviewer. If you believe something there is wrong (including the
     contract), log it to the HITL doc under '## Contract gap' and carry on with your slice.
   - Every door this wave calls is NOT built yet. Stub the contract's shapes at Playwright to prove
     the screen. Do not invent fields, and do not soften a shape to whatever is convenient - a
     screen built against a guessed shape fails the day the door lands, and it fails silently on
     the fields you guessed. Each BackOffice ticket carries a ..._ResponsesMatchDoorContract test,
     so the contract, not your stub, is what will be on the wire.
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
     * npm test: CLEAN - 266 files, 4734 tests, all passing. Any failure you see is yours.
     * npm run lint: all four gates CLEAN (boundaries, grid base, contrast, palette).
7. Proof checkboxes marked OWNER, manual-smoke, or needing a live backend are NOT yours: leave them
   unchecked, list them as outstanding in the ticket, and never fake or simulate them. In this wave
   that is anything needing the live BackOffice doors on staging (all of 483), an owner's eye on the Arabic rendering, and the owner's sign-off on the rulings this briefing took for them (menu labels-not-leaves, Arabic for all four namespaces, the 403 fallbacks for Accounts/Platforms, the sync overdue thresholds, the inclusive 31-day window, the Raw door's field names). The ticket may still complete AFK with those open; every OTHER
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
        Say "    .\run-implements-spec2615.ps1 -Tickets $(($Tickets | Where-Object { $_ -ne $t }) -join ',')" "Yellow"
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

You are reviewing ONLY the diff introduced by ticket $t of BackOffice spec 2615 (Deliverect): git diff $baseSha...HEAD.
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
  wire shapes come ONLY from the BackOffice 2615 door contract (no invented, renamed or dropped
  field; stubs on the real envelope with errors[].errorCode); new area features/deliverect/ with
  the Materials-area shape (probe in core/deliverect, fails closed, per-leaf predicate, in-page
  backstop); core/models/deliverect.ts is the one model file; the reason rule and the Accounts /
  Platforms reads live in core/deliverect, never duplicated per feature; a menu leaf only with its
  page; four namespaces deliverect-stores/-orders/-catalog/-terms, each en+ar with Arabic plural
  forms; the exclusion editor can never save while the platform list is unknown and never drops
  an excluded key it cannot display; 479's xlsx reader is a pure git mv to core with central-invoice
  unchanged; 477's stores-drive assertions stay green unchanged under 480/481; terms rows have no
  edit/delete; retry only for refused/statusFailed; local dates never via toISOString; money via
  formatMoney3 + currencyKey; drives on port 5196; no new npm dependency; backend-blocked Proof
  boxes honest, not faked green; every ruling the briefing took is logged in the HITL doc.

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
Say "Spec 2615 (Deliverect) wave complete. Read .afk\REVIEW-*.md and .afk\HITL-*.md before trusting the results." "Green"
Say ">>> 483 (live doors on staging + owner walk) is NOT in this run - it needs BackOffice 2616 and 2623-2627 deployed, the four grants seeded, and a linked Deliverect staging test location. <<<" "Yellow"
Say ">>> Read every '## Contract gap' in .afk\HITL-*.md (Accounts/Platforms grants, the 31-day window, the Raw door's fields) and take them to the contract in BackOffice before 2616-2627 freeze their shapes. <<<" "Yellow"
Say ">>> Branch spec/2615-deliverect (worktree C:\Playground\oms-react-spec2615) is unmerged and unpushed; the sibling spec 470 branch also edits router.tsx, menu-model.ts and i18n.ts - expect a small merge. <<<" "Yellow"
Say ">>> Eyeball the four Deliverect screens in Arabic before merging; no gate catches a value read backwards. <<<" "Yellow"
