# Runs /implement + /standards-review for the spec 470 receipt replay tickets ("paste a receipt JSON, replay it into a store") in fresh Claude Code sessions,
# sequentially, fully AFK.
#
#   .\run-implements-spec470.ps1                  (471, 472, 473, 474, 475)
#   .\run-implements-spec470.ps1 -Tickets 474,475
#   .\run-implements-spec470.ps1 -DryRun          (pre-flight + plan only, starts nothing)
#   .\run-implements-spec470.ps1 -SkipReview      (implement rounds only)
#   .\run-implements-spec470.ps1 -SmokeTest       (one trivial session through the real harness)
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
# Dependency map (spec 470; nothing landed yet):
#   471 (independent)
#   472 --+-- 473
#         +-- 474
#         \-- 475
#   476 (live walk, NOT in this run: needs the unwritten BackOffice half on staging)
#
# Running order:
#   * 471 runs FIRST although 472 is the tracer bullet: 471 creates core copyText, which 472's
#     result-panel copy uses, and it rewrites the drawer's copy feedback that 474 builds beside.
#     Running it second would have 472 ship a raw navigator.clipboard copy for 471 to migrate.
#   * Then 472 (Slice 0), then its three children in number order (473, 474, 475) - siblings with
#     no shared surface beyond the page, which 472 owns.
#
# Preconditions (the script checks 1, 2 and 4 - you own 3 and 5):
#   1. Nothing outside this wave blocks it.
#   2. No TRACKED modifications in the tree (untracked files are fine and only warn).
#   3. YOU ARE ON THE RIGHT BRANCH. This runner never switches branches - it commits onto
#      whatever is checked out now. Waves here are often built on a feature branch rather
#      than main, and the tickets themselves may only exist on that branch.
#      Expected for this wave: spec/470-receipt-replay (worktree C:\Playground\oms-react-spec470)
#   4. node_modules is installed (npm ci / npm install) - checked, because a missing install
#      turns every slice's typecheck into a wall of phantom errors at 3am.
#   5. A live SIS.Api is NOT required - the BackOffice half has no spec yet and every slice stubs the network at Playwright. Drives run on port 5199 (no sibling worktree is open). Playwright resolves from C:/Playground/frontend/node_modules (the drives' createRequire shim).
param(
    [int[]]$Tickets = @(471,472,473,474,475),
    [string]$Model = "opus",
    # No stream output for this long => the session is wedged; kill the tree and stop.
    [int]$StallMinutes = 25,
    # Absolute ceiling for one session, however chatty it is.
    [int]$MaxHours = 5,
    [switch]$SkipReview,
    [switch]$DryRun,
    # Keep the tracked edits a KILLED session left behind: the first ticket continues from them.
    [switch]$ResumeDirty,
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
Say "Branch: $branch   (expected for this wave: spec/470-receipt-replay (worktree C:\Playground\oms-react-spec470))" "DarkGray"

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
if ($dirtyTracked -and $ResumeDirty) {
    Say "ResumeDirty: tracked modifications kept - ticket $($Tickets[0]) continues from them:" "DarkYellow"
    $dirtyTracked | Write-Host
} elseif ($dirtyTracked) {
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
   - The spec is .issues\470-a-tester-replays-a-receipt-s-json-into-a-store-spec.md and the wayfinder map is
     (none - the spec came from a grilling; its decision record is C:\Work\DMSCO\BackOffice\docs\adr\0076-a-replayed-sale-stays-out-of-sap-by-its-counter-and-its-returns-inherit-the-mark.md). Read the spec AND your ticket.
     No ticket of this wave has landed yet; if an earlier ticket of this run has, read its committed
     diff before re-deciding anything it settled. Also read 467/468's code (TransactionsTab, SnapshotDrawer).
   - THE FEATURE: a **receipt replay** (glossary in CONTEXT.md: receipt snapshot, receipt replay).
     A tester pastes a NewPos receipt snapshot JSON, picks a target store + register, and pushes;
     the SERVER (BackOffice, NOT built, no spec yet) writes it into that store's DB as a sale with a
     fresh receipt number, kept out of HQ/SAP. This wave is the WEB HALF only, built on stubs.
     Read BackOffice ADR 0076 for the why:
     C:\Work\DMSCO\BackOffice\docs\adr\0076-a-replayed-sale-stays-out-of-sap-by-its-counter-and-its-returns-inherit-the-mark.md
   - SCOPE: everything lives in src\features\admin\sync-console (the Replay page is a PAGE OF THE
     CONSOLE, not a new feature - REVERSAL: the grilling first said 'admin/receipt-replay'; spec 470
     overrode it so the drawer can hand the JSON over in memory). Types go in
     src\core\models\sync-console.ts. Keys go in src\locales\en\sync-console.json ('replay.*',
     'nav.replay', 'transactionsTab.snapshot.replay'). NO new feature folder, NO new namespace, NO
     src\locales\ar file (the console is English-only by ruling; the bidi rule still applies).
     NO new menu leaf in src\layout\menu-model.ts. 472 adds exactly ONE route to src\app\router.tsx:
     'admin/sync/replay', beside the other 'admin/sync/*' entries, same lazy shape. 471's copy helper
     is the ONLY new core file: src\core\util\copy-text.ts (+ .test.ts).
   - This wave adds NO npm dependency. A slice that seems to need one is a BLOCKER.
   - THE CONTRACT (spec 470 section "Contract (proposed; owned by the BackOffice spec)") is the ONLY
     source of wire shapes. Exactly:
       GET ActionSync/Access -> existing { screenAllowed, canOperate, canOnboard } PLUS canReplay: boolean
       GET ActionSync/Replay/Registers?code= -> { storeCode, registers: [{ registerId, name }] }
           refusals: NO_STORE, NOT_NEWPOS_STORE, STORE_UNREACHABLE
       POST ActionSync/Replay  body { targetStoreCode, registerId, snapshot }  (snapshot = the PARSED
           object, never a string) -> { storeCode, registerId, transactionId, receiptNumber,
           replayedAt, replayOf: { storeCode, receiptNumber, transactionId },
           removed: ('tenderCapture' | 'loyaltyMember' | 'insuranceClaim')[] }
           refusals: NO_STORE, NOT_NEWPOS_STORE, STORE_UNREACHABLE, NO_REGISTER, BAD_SNAPSHOT,
           NOT_A_SALE, NOT_COMPLETED, TRAINING, UNBALANCED; a codeless 500 = the console's failure
       GET ActionSync/Replays?page= -> paged { rows: [{ at, who, sourceStoreCode,
           sourceReceiptNumber, storeCode, registerId, receiptNumber, transactionId }], total }
           (follow the console's existing Paged<T> / page-param convention for the paging fields)
     Invent no field, rename none. A gap -> log it under '## Contract gap' in the HITL doc and build
     to the contract as written.
   - THE SNAPSHOT'S REAL SHAPE (read off SIS.Pos 26.4.136 by reflection when this runner was made -
     the store drive's FAKE_SNAPSHOT is invented and must NOT be used as the model for the
     preflight): PosTransactionSnapshot { SchemaVersion, Header, Lines[], Conditions[], Tenders[],
     Coupons[], Loyalty, DocumentType, Insurance, Order, ... }. Header (TransactionHeader) has
     TransactionId, StoreId, RegisterId, ReceiptNumber, Status (string), IsReturn, IsTraining,
     GrandTotal, TotalTendered, TotalApplied, TotalChange, CompletedAt, OpenedAt, LoyaltyId, ...
     Tenders[] (TenderEntry) have TenderType, Amount, ChangeAmount, AppliedAmount, IsRefund,
     ProviderTransactionId, WalletProvider, EntryMode, ...
     RULED for replayPreflight:
       * Keys are read CASE-INSENSITIVELY (the door serializes with Newtonsoft; whether it arrives
         PascalCase or camelCase is not pinned). One small helper, used for every read.
       * kind: Header.IsReturn true -> 'return'; Status 'Voided' (case-insensitive) -> 'void';
         else 'sale'. completed = Status is 'Completed' (case-insensitive). training = IsTraining.
       * total = Header.GrandTotal; tenderTotal = sum of Tenders[].AppliedAmount;
         balanced = both equal when rounded to the cent (Math.round(x * 100)). Missing numbers are
         NOT zero: a snapshot with no Header or no GrandTotal is 'invalid' with a reason, not a
         summary.
       * The summary's source fields: Header.StoreId, Header.ReceiptNumber, Header.TransactionId.
     If a real staging snapshot disagrees with this, it is a contract gap - log it, do not guess.
   - 472 SLICE 0: Push needs only a valid, completed sale in 472 (473 adds the warnings and the
     refusal words; 472 shows every refusal as the console's shared failure via failureLabelKey /
     apiErrorMessage). Don't build 473's words early.
   - ACCESS: canReplay is INDEPENDENT of canOperate. The nav link (ConsoleNav PAGES, filtered like
     newStore) and the page read canReplay. The page without it renders the console's in-page denied
     backstop - copy how the other console pages handle !screenAllowed; the server grant stays the
     guard. 474's Replay... button in the drawer needs BOTH canOperate and canReplay - ABSENT, not
     disabled, otherwise.
   - CONFIRM: use core's Modal (src\core\ui\Modal.tsx). No new dialog primitive.
   - 474 DRAFT, RULED: a feature-local zustand store (pattern only from
     src\features\oms\deliveries\search-store.ts - never import it), IN MEMORY: no 'persist'
     middleware, no localStorage/sessionStorage, NO router state / location.state / URL param.
     Survives moving between console pages; a reload empties it; a successful push KEEPS it.
   - PRIVACY, not negotiable: a snapshot carries customer, loyalty and tender data. No console.* of
     it, no storage, nothing in the URL. Drive stubs use obviously fake values (but in the REAL
     shape above).
   - 471 COPY, RULED: copyText(text, { container? }) in src\core\util\copy-text.ts. Uses
     navigator.clipboard.writeText only when it exists AND window.isSecureContext; otherwise (or
     after the API rejects) a hidden textarea appended to 'container' (default document.body) +
     document.execCommand('copy'), removed afterwards. Resolves 'copied' | 'failed', never throws.
     Pass the open <dialog> as container from inside a modal - a showModal() dialog makes outside
     nodes unselectable. Make the env injectable so vitest (node) can test path choice with no DOM.
     The snapshot drawer shows the outcome as a status line INSIDE the drawer (a toast renders
     beneath the top-layer dialog - that is half of the reported bug), cleared after a few seconds.
     The central invoice retry copy and the retail invoice attempt-id copy (DownloadDialogs) move to
     the helper and KEEP their own feedback style.
   - 472's result copy button uses copyText (471 runs first in this wave).
   - BIDI: receipt numbers, store codes, register ids, transactionIds, money (formatMoney3) and
     times -> Ltr. The JSON box is dir="ltr", monospace. A 'replay of <receipt>'-style sentence
     gets fsi() on the value. The recent list is a TabGrid spreading OMS_GRID_BASE_COL_DEF (the base
     isolates cells - no fsi in valueFormatters).
   - 475: ReceiptReplay joins AuditAction in src\core\models\sync-console.ts. AUDIT_ACTIONS is a
     Record<AuditAction, ...> so the label is forced: 'Replayed a receipt', plus the existing
     auditActionKey test list in control-helpers.test.ts. The recent list re-reads after a push
     (invalidate its key). Paged at 50 by the door, like MirrorTab.
   - DESIGN: no prototype covers the Replay page. Use the console's vocabulary (TabGrid, ErrorBanner,
     Loading, TextField, CodeBadgeView, the drawer's JSON block styling, figure()). Colours only from
     the severity tokens. Do not invent a visual system.
   - PROOF per slice = vitest on the named helpers (a new replay-helpers.ts + .test.ts beside the
     console's *-helpers is fine) + Playwright: a NEW tools\sync-console-replay-drive.mjs for the
     page (copy the store drive's harness: its route handler, envelope helper, check(), DRIVE_PORT,
     the createRequire Playwright shim), and NEW numbered sections in
     tools\sync-console-store-drive.mjs for the drawer (471 copy, 474 Replay...). Every existing
     assertion in the store drive stays green UNCHANGED, except ConsoleNav link-list checks that the
     new Replay link legitimately changes - flag each such change in the drive and the ticket.
     NEVER touch tools\sync-console-live-drive.mjs (476's).
   - 471's drive must prove the NON-secure path: http://localhost IS a secure context, so force it
     (addInitScript deleting navigator.clipboard or overriding isSecureContext) and assert the
     copied text through a stubbed document.execCommand / a selection read. Also prove the in-drawer
     status line, and a forced failure.
   - ADR 0076 and every file named under C:\Work\DMSCO\BackOffice live in the OTHER repository. You
     may READ them. You may NOT edit, stage, commit or run anything there - it has its own branch
     (other people's work is uncommitted on it right now) and its own loop. The BackOffice half of
     this feature has NO spec and NO tickets yet: every door is stubbed, never pointed at a live
     SIS.Api.
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
   - One Bash call may carry MANY reads. 'cat a.tsx b.tsx; sed -n '1,80p' c.ts; grep -n X d.ts'
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
   - 'npm run typecheck' is the fast inner loop; run it continuously.
   - 'npm test' is vitest (node environment, src/**/*.test.ts). React Testing Library is
     deliberately NOT installed: pure modules are where regression is silent, components are thin
     renderers. So do NOT add RTL or reach for a component-rendering test - that is a separate
     hardening ticket's call, not yours at 3am.
   - 'npm run lint' runs three gates: import boundaries, token contrast, colour literals. Run it
     before you commit; it is what catches a stray literal or a raw hex colour.
   - 'npm run build' once at the end.
   - A UI slice is proven by DRIVING THE APP with a Playwright script under tools\*-drive.mjs.
     That needs a vite server: start one on port 5199 (NOT the default 5173, so you cannot collide
     with a dev server the human left running), run the drive against it, then KILL the server you
     started. Kill it ONLY by the PID that owns the port:
       Stop-Process -Id (Get-NetTCPConnection -LocalPort 5199 -State Listen).OwningProcess -Force
     NEVER select processes by CommandLine (no Win32_Process | Where CommandLine -match 'vite' /
     '5199'): your own claude.exe's command line carries this prompt, which names vite and 5199, so
     such a match kills YOU and the slice dies uncommitted. That is exactly how ticket 471's first
     run ended. Playwright is borrowed from C:/Playground/frontend/node_modules via a createRequire
     shim in the drive files - it is not a dependency of this repo. Follow an existing drive file
     rather than inventing a new harness.
   - If a drive genuinely cannot run (it needs a live SIS.Api that is not up, or Playwright does
     not resolve), that is an OUTSTANDING PROOF, not a blocker and never something to fake: stub
     the network at Playwright where the ticket allows it, otherwise leave the Proof box unticked,
     say exactly why in the ticket, and finish the rest of the slice.
   - Pre-existing baseline for this wave, measured when this runner was generated -
     anything at or below this is NOT yours to fix:
     * npm run typecheck: CLEAN. Any error you see is yours.
     * npm test: 266 files / 4734 tests, ALL PASSING. Any failure is yours.
     * npm run lint: all four gates CLEAN (boundaries, grid base, contrast, palette).
     * Drives on port 5199: sync-console-store 283/283 and sync-console-controls 110/110 green.
       central-invoice 64/65 (pre-existing FAIL 'A: no Document reload after a send'),
       central-invoice-list 49/50 (pre-existing timeout at the end), invoice 77/79 (pre-existing
       FAILs on the Invoices menu leaf). Those pre-existing failures are NOT yours; 471 must only
       keep their COPY assertions green.
7. Proof checkboxes marked OWNER, manual-smoke, or needing a live backend are NOT yours: leave them
   unchecked, list them as outstanding in the ticket, and never fake or simulate them. In this wave
   that is everything in ticket 476 (excluded from this run), any call against a live SIS.Api (the BackOffice half is unwritten - every proof here is stubbed), and a human's eye on the Replay page and the drawer's copy status line (no prototype covers them). The ticket may still complete AFK with those open; every OTHER
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

    if ($ResumeDirty -and $t -eq $Tickets[0]) {
        $afkProtocol += @"

13. RESUME: a previous AFK session for ticket $t was KILLED at its very end (it matched its own
    claude.exe while stopping vite by CommandLine - not a failure of the work). Its slice is still in
    the working tree - tracked edits and new untracked files (see git status; a backup is in
    .afk\partial-$t.patch). By its log it had finished building, all gates were green, the drives
    matched baseline, /code-review and /standards-review found nothing hard, its smell fixes were
    applied and the store drive re-run green. What it had NOT done: close the ticket (Proof boxes,
    status, INDEX line) and commit. Continue FROM it: read the diff and new files, check them against
    the ticket, re-run the gates (and the drives if you doubt them), then close and commit. Do not
    start over and do not discard it unless it is clearly wrong.
"@
    }

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
        Say "    .\run-implements-spec470.ps1 -Tickets $(($Tickets | Where-Object { $_ -ne $t }) -join ',')" "Yellow"
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

You are reviewing ONLY the diff introduced by ticket $t of spec 470: git diff $baseSha...HEAD.
The fixed point is $baseSha - do not ask for one, do not widen the range.

This session is READ-ONLY with exactly one exception (the report file):
- Do NOT edit source, tests, .issues tickets or INDEX.md. Do NOT commit, stage, stash, revert or
  push ANYTHING. Do not run a drive that writes screenshots into the tree; reading the code and
  the diff is the job. 'npm run typecheck' and 'npm run lint' are fine - they write nothing.
- Write your full two-axis report (Standards and Spec) to $reviewDoc, overwriting it if present.
  Head it with the ticket number, the fixed point, and a one-line VERDICT: CLEAN, MINOR, or
  SERIOUS.
- Findings must be concrete: file:line, the rule or the spec line it violates, and what the fix
  would be. Say plainly when an axis is clean rather than manufacturing findings.
- Check every standing rule in .claude\rules\, and pay particular attention to the two that pass
  a human's eye: a user-visible string that never reached t(), and a physical Tailwind utility
  (ml/pr/left) where a logical one was required. Both render perfectly in English.
- The wave's own rules to check against:
  no new npm dependency; everything in features/admin/sync-console except core copy-text.ts and
  ONE router entry (admin/sync/replay); no new namespace, no ar file, no menu leaf; wire shapes
  exactly as spec 470's contract section (no invented fields; snapshot posted as an object);
  replayPreflight reads the REAL SIS.Pos snapshot shape case-insensitively (Header.Status /
  IsReturn / IsTraining / GrandTotal, Tenders[].AppliedAmount), never the drive's fake shape;
  canReplay independent of canOperate, drawer button needs both and is absent otherwise; the
  replay draft is in-memory only (no persist, storage, URL or router state); no console.* of
  snapshot data; copy feedback inside the drawer, not a toast; copyText never throws and uses the
  fallback on a non-secure context; Ltr/fsi per the bidi rule; backend-blocked Proof boxes honest,
  never faked green; tools/sync-console-live-drive.mjs untouched.

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
Say "Spec 470 wave complete. Read .afk\REVIEW-*.md and .afk\HITL-*.md before trusting the results." "Green"
Say ">>> 476 (live walk) is NOT in this run: it needs the BackOffice receipt replay half, which has no spec yet - write it in C:\Work\DMSCO\BackOffice. <<<" "Yellow"
Say ">>> Every replay door was STUBBED. Check .afk\HITL-*.md for Contract gap entries before the BackOffice spec is written - they belong in it. <<<" "Yellow"
Say ">>> Eyeball the Replay page and the drawer copy status line; no prototype covers them. Then merge spec/470-receipt-replay into main. <<<" "Yellow"
