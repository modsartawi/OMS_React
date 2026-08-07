# Runs /implement + /standards-review for the spec 249 collection-documents frontend wave
# (four inquiry screens, two paper facsimiles, print and CSV export) in fresh Claude Code
# sessions, sequentially, fully AFK.
#
#   .\run-implements-spec249.ps1                  (253, 250, 251, 252, 254, 255, 256, 257, 258)
#   .\run-implements-spec249.ps1 -Tickets 255,256
#   .\run-implements-spec249.ps1 -DryRun          (pre-flight + plan only, starts nothing)
#   .\run-implements-spec249.ps1 -SkipReview      (implement rounds only)
#   .\run-implements-spec249.ps1 -SmokeTest       (one trivial session through the real harness)
#
# ASCII only, on purpose: Windows PowerShell 5.1 reads a BOM-less .ps1 as ANSI, so a stray
# em dash silently becomes mojibake and can break the parse. Keep every character 7-bit.
# NOTE FOR THIS WAVE: that is also why no Arabic appears anywhere in this file. The two
# documents are Arabic forms; their exact strings live in the tickets and the recovered
# fixtures, and sessions are told to COPY them from there, never to retype them.
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
# Dependency map (249 spec, out of wayfinder map 240; nothing in this wave has landed yet):
#
#   250 (money -> core) --+
#                          \
#   253 (area + nav) -------+-- 254 (Cash Collections, THE TEMPLATE) --+-- 255 (ACRs+Attempts) --+
#                                                                      \-- 256 (Deposits) -------+
#                                                                                                |
#   251 (receipt doc) --> 252 (ACR doc) ------------------------------------------------------+  |
#                                                                                             |  |
#                                                                     257 (row actions) <-----+--+
#                                                                     258 (CSV export)  <--------+
#
#   Excluded from this run on purpose:
#     259 (go live) - needs the whole BackOffice wave (1089-1093) deployed and a live SIS.Api.
#     260 (paper proof) - a human, a printer, real Chrome AND real Edge. No session can close it.
#
# Running order:
#   * 253 runs FIRST, ahead of the prefactor and ahead of Slice 0, even though the graph
#     allows any of the three. It mints the shared surface every other slice extends: the new
#     src\features\collection\ folder, the `collection` i18n namespace and its registration in
#     core\i18n.ts, and the router entries. 251 and 252 put their document components INSIDE
#     that folder. If 253 ran later, two sessions would each invent the namespace and collide
#     in core\i18n.ts, and the earlier one would carry a doomed folder shape through its diff.
#   * 250 runs second. It is a pure prefactor (Loy's money module moves up to core\) and it
#     touches a SHIPPED feature, so it lands before anything consumes it rather than being
#     tangled into 254's diff.
#   * 251 -> 252 keep their graph order and run before the screens: 252 is blocked by 251, and
#     257 is blocked by both. They cannot be deferred to the end without stranding 257.
#   * 257 before 258 is arbitrary (both unblock after 256); ticket order kept so the run order
#     reads the same as the tracker.
#   * NOTHING in this wave is backend-blocked. Every slice is proven against checked-in
#     fixtures, which is why 259 is the only ticket that needed excluding for that reason.
#
# Preconditions (the script checks 1, 2 and 4 - you own 3 and 5):
#   1. Nothing outside this wave blocks it - 250-258 are the whole frontend wave and none of
#      them has landed yet.
#   2. No TRACKED modifications in the tree (untracked files are fine and only warn).
#      HEADS UP: as generated, this repo HAS tracked modifications - the map, tickets 244/245/
#      248, INDEX.md and CONTEXT.md were all edited while charting. Commit them before you run,
#      or pre-flight will stop you at exit 1.
#   3. YOU ARE ON THE RIGHT BRANCH. This runner never switches branches - it commits onto
#      whatever is checked out now. Waves here are often built on a feature branch rather
#      than main, and the tickets themselves may only exist on that branch.
#      Expected for this wave: main
#   4. node_modules is installed (npm ci / npm install) - checked, because a missing install
#      turns every slice's typecheck into a wall of phantom errors at 3am.
#   5. No live SIS.Api is required - every slice in this wave runs on checked-in fixtures, and
#      that is by ruling, not by convenience (every collection route answers a browser 403
#      today, so mocking is REQUIRED). You do need the two prototype branches to be fetchable
#      locally - prototype/246-collection-voucher and prototype/247-acr-form - because 251 and
#      252 recover their fixtures and image assets from them with git show. Verify with:
#      git rev-parse --verify prototype/246-collection-voucher
param(
    [int[]]$Tickets = @(253,250,251,252,254,255,256,257,258),
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
   - The spec is .issues\249-collection-documents-web-spec.md and the wayfinder map is
     .issues\240-the-collection-documents-come-to-the-web.md. Read the spec AND your ticket.
     No ticket in this wave has landed yet, so there are no sibling diffs to read - but the
     map's eight RESOLVED wayfinder tickets (241-248) carry the reasoning behind every ruling
     your ticket states, and 242's asset .issues\assets\242-fidelity-inventory.RESEARCH.md is
     the mark-by-mark inventory the two documents are built from. Read the ones your ticket
     names rather than re-deriving their conclusions.
   - THE BIGGEST TRAP IN THIS WAVE, and it will cost you the whole slice if you miss it: the
     two document prototypes are NOT on main. Ticket 244 says they "move" from
     src\features\oms\collection\__prototype__\ - that wording is STALE and that folder does
     not exist. They were captured off-main. Recover them with git show:
       git show prototype/246-collection-voucher:src/features/oms/collection/__prototype__/voucher/voucher-mock.ts
       git show prototype/247-acr-form:src/features/oms/collection/__prototype__/acr/acr-mock.ts
     plus VariantC.tsx, Sheet.tsx, logo-aldawaa.png and the paper scans on the same branches.
     RECOVER the fixtures and the image assets; REWRITE the components. Variant C was written
     under prototype constraints (inline styles standing in for XAML setters, a hard-coded
     model, no i18n, no tests, and an excused lint gate) - what it settles is every mark's
     RULING, not its implementation. If you cannot resolve a prototype branch, that is a
     BLOCKER, not a cue to invent the form from the ticket text.
   - THE SECOND TRAP, and it directly contradicts rule 4 below, so read both: the two
     facsimiles are a DOCUMENTED THREE-RULE EXCEPTION - i18n-zero-literal, logical-tailwind,
     and the colour-literal gate. The Arabic IS the form; the geometry is physical and mirrors
     nothing; the reds and greys ARE the form. Do NOT put the documents' Arabic through t().
     Do NOT convert their physical CSS to logical utilities. DO add each facsimile file to the
     COLOUR_SOURCES map in tools\check-palette.mjs as a whole-file exclusion with its reason
     inline (it currently holds exactly two files; the wave adds four or more). Verify the
     exclusion is load-bearing by removing it once and watching the gate fire.
     SCREEN CHROME AROUND THE DOCUMENTS OBEYS EVERY RULE, UNEXCEPTIONALLY. The exception is the
     document sheet itself and nothing else.
   - NEVER RETYPE ARABIC. Copy every Arabic string from the ticket, the fidelity inventory or
     the recovered fixture. A retyped Arabic string looks right and is silently wrong, and no
     gate in this repo catches it.
   - THE RULE THE WHOLE CONTRACT EXISTS TO ENFORCE: the client CANNOT format. Every displayed
     value on both documents crosses the wire as a string already formatted server-side - money,
     dates, the amount-in-words, the tri-state match mark, the page stamp, the weekday, the
     Hijri date. There is no number, no Date and no currency code on the wire at all. So: no
     toFixed, no Intl.NumberFormat, no date formatting, no amount-in-words, no page chunking,
     no deriving the match mark. If a string you need is not on the wire, the answer is a SERVER
     change (log it to the HITL doc), never a client one. Do not "helpfully" compute it.
   - Pagination is the server's arithmetic. rowsPerPage: 22 rides on the ACR contract as
     DOCUMENTATION of the break rule - the client never applies it. A reviewer should be able to
     grep the client for chunking logic and find none.
   - This wave adds NO npm dependency. Specifically: no xlsx/SheetJS/exceljs (258 is CSV by
     ruling), no date library, no PDF library, no AG Grid Enterprise. If a slice looks like it
     needs one, that is a BLOCKER, not a decision you take at 3am.
   - AG Grid is COMMUNITY here (36.0.1). exportDataAsExcel and master-detail rows are Enterprise
     and do not exist. Client-side pagination and exportDataAsCsv do.
   - 253 owns the `collection` i18n namespace: it creates src\locales\en\collection.json AND
     registers it in src\core\i18n.ts (import, ns array, resources). Every later slice ADDS keys
     to that file and must not re-register the namespace. An unregistered namespace renders raw
     keys to users and no gate catches it.
   - 254 is THE TEMPLATE for 255 and 256, modelled on features\pricing\bonus-buy-inquiry.
     It is COPIED, NOT EXTRACTED - do not create a shared inquiry shell in core\. The
     abstraction would be designed before four screens exist to prove it, and a feature may not
     import a feature. Literal duplication of a SHAPE is the ruling here, and it was argued.
   - The floating per-column filter row is ON BY DEFAULT on all four screens. This deliberately
     INVERTS bonus-buy-inquiry's default (off, behind a toggle), so copying BBY's default is the
     easy mistake. Every WPF grid in the suite ships it on, and with an HQ-wide result and only
     four server filters it is how you find one store's variance without re-querying.
   - The WPF's `Limit` box is DELETED and must not be reinstated as a user-facing field. Scope is
     HQ-wide and a normal day is hundreds of rows, so 200 truncates daily and silently. The client
     asks for ~2,000 and pages 50 at a time IN THE BROWSER, which is what keeps sort, per-column
     filter and export operating over the whole result set. `Limit` is a system cap now, surfaced
     only by an amber banner that fires when the result ACTUALLY REACHED it - not when it is
     merely large. Do not add server paging; no endpoint has Skip/Offset/a count.
   - Collection Attempts has NO row action, deliberately. The WPF withholds one on purpose: an
     attempt is immutable evidence, not a voucher. Do NOT add one for symmetry with the other
     three screens.
   - The ?acr= chip on Cash Collections OVERRIDES AND DISABLES From/To/Store/Collector. That is
     HONESTY, not clumsy UX to improve: the server treats AcrId as an EXCLUSIVE filter and ignores
     store, collector and period entirely when one is set. Leaving those inputs live would let a
     user set a date range that silently does nothing.
   - Deposits renders its detail STACKED IN PLACE, not in a modal, and everything arrives in ONE
     response - do not add a second fetch for the lines or the balances. A deposit whose banked
     total no longer matches is exactly what the accountant opens that screen to find, so drift
     must be visible without a click.
   - 258's CSV has TWO ESCAPING RULES SPLIT BY COLUMN, and this is the one thing that looks right
     while being wrong: MONEY leaves as a bare unformatted number (no separator, no symbol, no
     wrapper) because the accountant SUMS it - features\admin\ua-admin\csv.ts wraps every cell in
     an Excel text formula, and doing that to a money column makes the cell TEXT so SUM silently
     reads zero. IDENTITY columns (receipt no., ACR no., store code) DO keep that wrapper, because
     the reconciliation workbook keys on them. Free text keeps the formula-injection guard.
   - 258 has an OPEN QUESTION you must settle first, and the ticket says so: ag-grid-community
     36.0.1 has no suppressBom and never emits a BOM, which is what makes Arabic mojibake on an
     Excel double-click. Try exportDataAsCsv with allColumns plus a prependContent carrying the
     BOM and the sep line FIRST; only fall back to a bespoke writer if the BOM will not land as
     the first bytes. Note which you chose in the HITL doc. (The spec's stated reason for a
     bespoke writer - that AG Grid is visible-columns-only - is WRONG: allColumns exists.)
   - REVERSALS, because the older wording still sits in earlier tickets and a fresh session will
     find it: (a) the receipt's print-ready model carries NO reconciliation data at all - no
     posted flag, no variance, no rounding flags - ticket 243 assumed otherwise and 246 removed
     them; (b) the ACR carries NO deposit fields at all, meta or summary, so its summary box has
     exactly ONE row - 242 asked whether to bind two of them and 247 answered OUT, wider than
     asked; (c) there is NO green POSTED banner on the receipt - taking a number IS the posted
     state; (d) the overage box on the receipt is ALWAYS EMPTY, a hand-fill slot, never an output
     field.
   - A negative money figure must render as an LTR island (minus on the LEFT). The minus is
     bidi-neutral and otherwise resolves to the RTL paragraph direction and prints on the right.
     The WPF has this same bug and the fidelity inventory's list of required LTR islands was one
     short, so do not treat matching the WPF as sufficient here. core\ui\Ltr.tsx already exists.
   - The logo is a KNOWN UNRESOLVED item on 251 and 252 and it is a FILE, not a decision you can
     take: the paper original prints a DMSCO mark, the WPF prints the al-dawaa one, and the pad's
     horizontal al-dawaa lockup exists in NEITHER repo. Render the stacked al-dawaa the WPF ships
     (recovered from the prototype branch) as the interim, note it in the HITL doc, and move on.
     Do not fake the DMSCO mark and do not block on it.
   - The screens use OUR design language (the existing inquiry-screen shape, AG Grid, the app's
     tokens). The two documents deliberately do NOT - they are paper facsimiles and their
     geometry is the WPF's. Do not harmonise the documents toward the app's look.
   - The two document contracts are the frontend half of a seam the BackOffice wave builds to.
     Their exact field lists are in ticket 251 (VoucherPage) and ticket 252 (AcrForm/AcrPage/
     AcrRow) - use them VERBATIM for the fixture types. Do not add a field, do not rename one,
     do not soften a type to whatever is convenient. A fixture that drifts from the contract
     produces a screen that fails the day the endpoint lands, silently, on the fields you changed.
   - The governing spec for this wave lives in THIS repo (.issues\249-...), but the backend half
     of the effort lives in the OTHER repository (C:\Work\DMSCO\BackOffice, tickets 1089-1093).
     You may READ anything there. You may NOT edit, stage, commit or run anything in that
     repository - it has its own tracker, its own loop and its own reviewer. If you believe
     something there is wrong (a builder field, an endpoint shape), log it to the HITL doc and
     carry on with your slice.
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
   - REMINDER: the two facsimile sheets are the documented exception to the first three of these,
     as spelled out in section 3. Everything else in this wave, including all four screens and all
     chrome around the documents, obeys them without exception.
5. How to verify - a green typecheck is NOT proof a screen works:
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
   - This wave builds TWO drive files, both new: tools\collection-drive.mjs (the four screens) and
     tools\collection-print-drive.mjs (the two documents). Whichever slice needs one first CREATES
     it; later slices EXTEND the existing file rather than starting a third.
     tools\bby-inquiry-drive.mjs is the nearest prior art for the screens.
   - The document slices have NOTHING to unit-test in the renderer, and that is by design, not an
     omission: the client cannot compute any displayed value, so there is no logic to assert. A
     test that reimplemented a server string in order to compare against it would manufacture the
     very drift this whole design exists to prevent. Prove those slices with the print drive plus
     typecheck against the contract types, and say so in the ticket.
   - If a drive genuinely cannot run (it needs a live SIS.Api that is not up, or Playwright does
     not resolve), that is an OUTSTANDING PROOF, not a blocker and never something to fake: stub
     the network at Playwright where the ticket allows it, otherwise leave the Proof box unticked,
     say exactly why in the ticket, and finish the rest of the slice.
   - Pre-existing baseline for this wave, measured when this runner was generated -
     anything at or below this is NOT yours to fix:
     * npm run typecheck: CLEAN. Any error you see is yours.
     * npm test: CLEAN - 76 files, 1215 tests, all passing. Any failure you see is yours.
     * npm run lint: all three gates CLEAN (407 files for boundaries, 117 contrast pairs,
       409 files for colour literals with 4 documented exclusions). If the colour count of
       documented exclusions goes UP, that is your facsimile exclusion and it is expected.
6. Proof checkboxes marked OWNER, manual-smoke, or needing a live backend are NOT yours: leave them
   unchecked, list them as outstanding in the ticket, and never fake or simulate them. In this wave
   that is anything needing a printer or a human's eye (all of ticket 260, which is NOT in this run),
   anything needing a live SIS.Api (all of ticket 259, also NOT in this run), and the unresolved
   logo lockup on 251 and 252. The ticket may still complete AFK with those open; every OTHER
   Proof box must be real, written, and green.
7. Finish the /implement skill's own review step (built-in /code-review, then /standards-review)
   before you close the ticket. An INDEPENDENT /standards-review runs in a separate session right
   after this one against $baseSha, and its report lands in .afk\REVIEW-$t.md - so leave the commit
   in a state you would be happy to have reviewed cold.
8. Stage NARROWLY when you commit: your slice's files only. Do not commit .afk\ artifacts, drive
   screenshots, dist\, or anything you did not write for this ticket. Commit onto the CURRENT
   branch; never switch or create a branch. NOTE for 251 and 252: the recovered PNG and JPG assets
   ARE part of your slice and must be staged - a facsimile that references a missing image passes
   typecheck and renders broken.
9. BLOCKER = you cannot proceed safely at all: the spec contradicts itself, a required file or
   dependency is missing or unfetchable, the tickets are not on this branch, a slice would need a
   new npm dependency, or any choice risks breaking unrelated shipped behavior. On a blocker:
   - Log it to $hitlDoc under '## BLOCKER: <title>' with what you tried and what a human must
     decide.
   - STOP: do not complete the ticket, do not commit, leave the working tree in a clean
     understandable state, and end your final message with the exact line: AFK-BLOCKED
10. On success, the VERY LAST line of your final message must be exactly: AFK-DONE
    Nothing after it - no closing thought, no note for the next slice, no sign-off. Write whatever
    summary you like ABOVE it, then that line alone.
11. Do not push and do not open a PR. Committing is allowed only if the /implement skill itself
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
        Say "    .\run-implements-spec249.ps1 -Tickets $(($Tickets | Where-Object { $_ -ne $t }) -join ',')" "Yellow"
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

You are reviewing ONLY the diff introduced by ticket $t of spec 249: git diff $baseSha...HEAD.
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
  The two facsimile SHEETS are a documented exception to i18n-zero-literal, logical-tailwind AND
  the colour-literal gate - do not raise findings against Arabic literals, physical geometry or
  hex colours inside a document sheet, and DO check that each such file was added to
  COLOUR_SOURCES in tools\check-palette.mjs with a reason. The exception stops at the sheet:
  all four screens and every piece of chrome around the documents obey all three rules, and a
  literal there IS a finding. The client must compute NO displayed document value - a toFixed,
  an Intl.NumberFormat, a Date format, an amount-in-words, a page-chunking loop or a derived
  match mark anywhere in the document path is a SERIOUS finding, because it is exactly the drift
  the contract exists to prevent. No new npm dependency, and no AG Grid Enterprise API
  (exportDataAsExcel, master-detail). The document fixture types must match ticket 251's
  VoucherPage and ticket 252's AcrForm/AcrPage/AcrRow field-for-field - a renamed, added or
  softened field is a SERIOUS finding. On the CSV slice: money cells must be bare unformatted
  numbers and identity cells must keep the Excel text wrapper - the two rules inverted is the
  defect to hunt, since it looks correct and makes SUM read zero. The Limit box must not be
  user-facing; the floating filter row must default ON; Collection Attempts must have no row
  action; the ?acr= chip must disable the four filters it overrides. Backend-blocked or
  owner-only Proof boxes must be honest, not faked green.

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
Say "Spec 249 frontend wave complete. Read .afk\REVIEW-*.md and .afk\HITL-*.md before trusting the results." "Green"
Say ">>> Ticket 259 (go live against the real CollectionWeb door) was NOT in this run - it needs the whole BackOffice wave 1089-1093 deployed and a live SIS.Api. Everything built tonight runs on fixtures. <<<" "Yellow"
Say ">>> Ticket 260 (the paper proof) was NOT in this run and no session can close it: both documents on real Chrome AND real Edge, on actual paper, beside their WPF originals. It is the wave's closing gate. <<<" "Yellow"
Say ">>> The BackOffice half (tickets 1089-1093) runs from its own loop in C:\Work\DMSCO\BackOffice - this runner did not touch that repo. <<<" "Yellow"
Say ">>> Check .afk\HITL-258.md for which CSV implementation was chosen - AG Grid's exporter with a prepended BOM, or a bespoke writer. The BOM question was left open on purpose. <<<" "Yellow"
Say ">>> The logo is still unresolved on both documents (horizontal al-dawaa lockup exists in neither repo; the paper original prints DMSCO). Sessions were told to ship the stacked al-dawaa as an interim. <<<" "Yellow"
Say ">>> Eyeball both facsimiles before shipping. No gate catches a mark that is present, correctly coloured and in the wrong place - that is exactly what ticket 260 exists for. <<<" "Yellow"
