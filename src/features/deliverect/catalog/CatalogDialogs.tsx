import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, FileSpreadsheet, Loader2, Send } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { deliverectAccountsQuery, deliverectPlatformsQuery } from '@/core/deliverect/api'
import ReasonDialog, { InlineRefusal } from '@/core/deliverect/ReasonDialog'
import { fieldRefusal } from '@/core/deliverect/reason'
import {
  DELIVERECT_ERRORS,
  type DeliverectCatalogPushResult,
  type DeliverectWhitelistImportResult,
  type DeliverectWhitelistRow,
} from '@/core/models/deliverect'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { xlsxRows } from '@/core/util/xlsx-read'
import { WHITELIST_KEY, catalogApi } from './api'
import PlatformChip from './PlatformChip'
import { exclusionEditor, exclusionSet, sameExclusions } from './exclusion-set'
import ImportAnswerDialog from '@/core/import/ImportAnswerDialog'
import { WHITELIST_IMPORT_MAX, parseMaterialList, type MaterialList } from '@/core/import/material-list'
import { figure, updateBody, type WhitelistAction } from './whitelist-state'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import Textarea from '@/core/ui/Textarea'



/** What the last picked file did, said under the list. */
interface FileNote {
  tone: 'info' | 'error'
  text: string
}

/**
 * **Import into the whitelist** (ticket 479; `POST Whitelist/Import`): paste material numbers, or
 * pick a one-column `.xlsx`, and send them with a reason. The list shown is the list sent —
 * `parseMaterialList` trims, drops blanks, collapses duplicates and skips a header — and more than
 * 5000 is refused HERE: a file over the cap is not loaded, a paste over it cannot be sent.
 * DLV-00012 (the door's own refusal) shows inline under the list. On success the page shows the
 * answer: added, re-activated, and the unknown material numbers.
 */
export function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: (result: DeliverectWhitelistImportResult) => void }) {
  const { t } = useTranslation('deliverect-catalog')
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [fileNote, setFileNote] = useState<FileNote | null>(null)
  // What the picked sheet dropped on its way into the list — its header and its repeats — so a file
  // says what a paste says. Cleared the moment the list is edited.
  const [fromFile, setFromFile] = useState<Pick<MaterialList, 'header' | 'duplicates'> | null>(null)
  // The latest pick (or edit) wins: an older file still being read never overwrites the list.
  const pickSeq = useRef(0)
  const list = useMemo(() => parseMaterialList(text), [text])
  const header = list.header ?? fromFile?.header ?? null
  const duplicates = list.duplicates + (fromFile?.duplicates ?? 0)
  const send = useMutation({
    mutationFn: (reason: string) => catalogApi.import({ materialNumbers: list.materials, reason }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: WHITELIST_KEY })
      onDone(result)
    },
  })
  const listRefusal = fieldRefusal(send.error, [DELIVERECT_ERRORS.importInvalid], t('dialog.failedHint'))

  async function pick(file: File | null) {
    if (!file) return
    const fileName = fsi(file.name)
    const seq = ++pickSeq.current
    send.reset()
    try {
      const sheet = parseMaterialList(await xlsxRows(new Uint8Array(await file.arrayBuffer())))
      if (seq !== pickSeq.current) return
      if (sheet.otherColumns)
        return setFileNote({
          tone: 'error',
          text: t('import.file.otherColumns', { fileName }),
        })
      // The ticket's "over 5000 rows": the sheet's entries, repeats included — not only the distinct ones.
      if (sheet.entries > WHITELIST_IMPORT_MAX)
        return setFileNote({
          tone: 'error',
          text: t('import.file.overCap', {
            count: sheet.entries,
            n: fsi(figure(sheet.entries)),
            max: fsi(figure(WHITELIST_IMPORT_MAX)),
            fileName,
          }),
        })
      if (sheet.materials.length === 0)
        return setFileNote({
          tone: 'error',
          text: t('import.file.empty', { fileName }),
        })
      // The file REPLACES the list: one source, so what is shown is what is sent.
      setText(sheet.materials.join('\n'))
      setFromFile({ header: sheet.header, duplicates: sheet.duplicates })
      setFileNote({
        tone: 'info',
        text: t('import.file.read', {
          count: sheet.materials.length,
          n: fsi(figure(sheet.materials.length)),
          fileName,
        }),
      })
    } catch {
      if (seq !== pickSeq.current) return
      setFileNote({
        tone: 'error',
        text: t('import.file.unreadable', { fileName }),
      })
    }
  }

  return (
    <ReasonDialog
      open
      title={t('import.title')}
      note={t('import.note')}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('import.confirm')}
      confirmDisabled={list.materials.length === 0 || list.overBy > 0}
      handledCodes={[DELIVERECT_ERRORS.importInvalid]}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1.5" data-import-dialog="">
        <Field label={t('import.list')}>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setFileNote(null)
              setFromFile(null)
              pickSeq.current++
              send.reset()
            }}
            rows={7}
            disabled={send.isPending}
            dir="ltr"
            autoFocus
            placeholder={t('import.placeholder')}
            className="font-mono"
            data-import-text=""
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            data-import-file=""
            onChange={(e) => {
              void pick(e.target.files?.[0] ?? null)
              // Reset so the same file can be picked again.
              e.target.value = ''
            }}
          />
          <Button variant="outlined" disabled={send.isPending} onClick={() => fileInput.current?.click()} data-import-pick="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('import.file.pick')}
          </Button>
          <span className="text-xs text-muted-foreground" data-import-count={list.materials.length}>
            <Trans
              t={t}
              i18nKey="import.count"
              count={list.materials.length}
              values={{ n: figure(list.materials.length) }}
              components={{ n: <Ltr /> }}
            />
            {duplicates > 0 && (
              <>
                {' '}
                <Trans
                  t={t}
                  i18nKey="import.duplicates"
                  count={duplicates}
                  values={{ n: figure(duplicates) }}
                  components={{ n: <Ltr /> }}
                />
              </>
            )}
          </span>
        </div>
        {fileNote && (
          <p
            role={fileNote.tone === 'error' ? 'alert' : 'status'}
            className={'text-xs ' + (fileNote.tone === 'error' ? 'text-danger-800' : 'text-muted-foreground')}
            data-import-file-note={fileNote.tone}
          >
            {fileNote.text}
          </p>
        )}
        {header !== null && (
          <p className="text-xs text-muted-foreground" data-import-header="">
            <Trans t={t} i18nKey="import.headerSkipped" values={{ header }} components={{ header: <bdi /> }} />
          </p>
        )}
        {list.overBy > 0 && (
          <p role="alert" className="flex items-center gap-1.5 text-xs text-danger-800" data-import-over-cap="">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('import.overCap', {
              count: list.overBy,
              max: fsi(figure(WHITELIST_IMPORT_MAX)),
              overBy: fsi(figure(list.overBy)),
            })}
          </p>
        )}
        {listRefusal && <InlineRefusal message={listRefusal.message} code={listRefusal.code} />}
      </div>
    </ReasonDialog>
  )
}

/**
 * The import's answer (ticket 479): how many were added, how many re-activated, and the material
 * numbers the server did not know, with a Copy — the core answer dialog (graduated by ticket 555).
 */
export function ImportResultDialog({ result, onClose }: { result: DeliverectWhitelistImportResult; onClose: () => void }) {
  const { t } = useTranslation('deliverect-catalog')
  return (
    <ImportAnswerDialog
      ns="deliverect-catalog"
      counts={[
        { label: t('result.added'), value: result.added, attr: 'added' },
        { label: t('result.reactivated'), value: result.reactivated, attr: 'reactivated' },
      ]}
      unknown={result.unknown ?? []}
      onClose={onClose}
    />
  )
}

/** The material a dialog is about — its number and both names, each isolated by its kind. */
function MaterialLine({ row }: { row: DeliverectWhitelistRow }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm" data-dialog-material={row.materialNumber}>
      <span className="font-mono">
        <Ltr>{row.materialNumber}</Ltr>
      </span>
      <bdi>{row.nameEn}</bdi>
      <bdi>{row.nameAr}</bdi>
    </p>
  )
}

/**
 * **Disable, delete or restore a whitelisted material**, with a reason (ticket 479;
 * `PUT Whitelist/{material}`). The note says what the write does on every delivery platform.
 */
export function RowActionDialog({ row, action, onClose }: { row: DeliverectWhitelistRow; action: WhitelistAction; onClose: () => void }) {
  const { t } = useTranslation('deliverect-catalog')
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: (reason: string) => catalogApi.update(row.materialNumber, updateBody(action, row, reason)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: WHITELIST_KEY })
      notify.success(t(`${action}.done`), t(`${action}.doneDetail`, { material: fsi(row.materialNumber) }))
      onClose()
    },
  })

  return (
    <ReasonDialog
      open
      title={t(`${action}.title`)}
      note={<span data-action-note={action}>{t(`${action}.note`)}</span>}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t(`${action}.confirm`)}
      danger={action === 'delete'}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <MaterialLine row={row} />
    </ReasonDialog>
  )
}

/**
 * **Platform exclusions** for one material (ticket 479; `PUT Exclusions/{material}`; glossary
 * **Platform exclusion**): a box per delivery platform from the Platforms read — ticked is sold
 * there, unticked is excluded, which the note says means out of stock on that platform only.
 * Saving REPLACES the material's set.
 *
 * 🚩 Two traps, both guarded:
 * - The Platforms read rides `canManageTerms` (contract gap, HITL-479). While it is loading or when
 *   it is refused there are NO boxes and Save is disabled: an empty box list would send `[]` and put
 *   the material back on every platform.
 * - A key the material is excluded on that the read does not list stays excluded: it is shown as a
 *   read-only chip and always sent back (`exclusionSet`).
 */
export function ExclusionsDialog({ row, onClose }: { row: DeliverectWhitelistRow; onClose: () => void }) {
  const { t } = useTranslation('deliverect-catalog')
  const qc = useQueryClient()
  const platforms = useQuery(deliverectPlatformsQuery())
  // The contract always sends the array; `?? []` so a row that came without it opens rather than throws.
  const current = useMemo(() => row.excludedPlatforms ?? [], [row.excludedPlatforms])
  const editor = useMemo(
    () => (platforms.isSuccess ? exclusionEditor(current, platforms.data ?? []) : null),
    [platforms.isSuccess, platforms.data, current],
  )
  // The ticked boxes as the user left them; `null` until touched, so they start from the row.
  const [touched, setTouched] = useState<string[] | null>(null)
  const ticked = touched ?? editor?.boxes.filter((b) => b.ticked).map((b) => b.platformKey) ?? []
  const sent = editor
    ? exclusionSet(
        editor.boxes.map((b) => b.platformKey),
        ticked,
        editor.unlisted,
      )
    : null
  const unchanged = sent === null || sameExclusions(sent, current)

  const send = useMutation({
    mutationFn: (reason: string) =>
      catalogApi.setExclusions(row.materialNumber, {
        platforms: sent ?? [],
        reason,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: WHITELIST_KEY })
      notify.success(t('exclusions.done'), t('exclusions.doneDetail', { material: fsi(row.materialNumber) }))
      onClose()
    },
  })

  const toggle = (key: string) => {
    send.reset()
    setTouched(ticked.includes(key) ? ticked.filter((k) => k !== key) : [...ticked, key])
  }

  return (
    <ReasonDialog
      open
      title={t('exclusions.title')}
      note={<span data-exclusions-note="">{t('exclusions.note')}</span>}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('exclusions.confirm')}
      confirmDisabled={editor === null || unchanged}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <MaterialLine row={row} />
      {editor === null ? (
        platforms.isPending ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-exclusions-loading="">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('exclusions.loading')}
          </p>
        ) : (
          <div data-exclusions-unavailable="">
            <ErrorBanner className="p-2" title={t('exclusions.unavailable')} message={t('exclusions.unavailableHint')} />
          </div>
        )
      ) : (
        <fieldset className="flex flex-col gap-1.5" data-exclusions-boxes="">
          <legend className="mb-1 text-xs font-medium">{t('exclusions.legend')}</legend>
          {editor.boxes.length === 0 && <p className="text-xs text-muted-foreground">{t('exclusions.noPlatforms')}</p>}
          {editor.boxes.map((b) => (
            <label key={b.platformKey} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ticked.includes(b.platformKey)}
                onChange={() => toggle(b.platformKey)}
                disabled={send.isPending}
                data-exclusion-box={b.platformKey}
              />
              <bdi>{b.displayName}</bdi>
              <span className="font-mono text-xs text-muted-foreground">
                <Ltr>{b.platformKey}</Ltr>
              </span>
              {!b.active && <span className="text-xs text-muted-foreground">{t('exclusions.inactive')}</span>}
              {!ticked.includes(b.platformKey) && (
                <span className="text-xs text-attention-800" data-exclusion-excluded={b.platformKey}>
                  {t('exclusions.excluded')}
                </span>
              )}
            </label>
          ))}
          {editor.unlisted.length > 0 && (
            <div className="mt-1 flex flex-col gap-1" data-exclusions-unlisted="">
              <span className="text-xs text-muted-foreground">{t('exclusions.unlisted')}</span>
              <span className="flex flex-wrap gap-1">
                {editor.unlisted.map((k) => (
                  <PlatformChip key={k} platformKey={k} muted />
                ))}
              </span>
            </div>
          )}
        </fieldset>
      )}
    </ReasonDialog>
  )
}

/**
 * **Push the catalog now** to one Deliverect account (ticket 479; `POST Catalog/Push?account=`),
 * confirmed on the app modal. The contract names no reason for this write, so none is asked. The
 * account comes from the Accounts read; that read rides `canManageTerms` (contract gap), so when it
 * is refused the account is typed. The answer — the file id, its status and the rows pushed — is
 * shown in the dialog. DLV-00011 shows Deliverect's own answer inline.
 */
export function PushDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('deliverect-catalog')
  const accounts = useQuery(deliverectAccountsQuery())
  const [account, setAccount] = useState('')
  const [result, setResult] = useState<{
    account: string
    answer: DeliverectCatalogPushResult
  } | null>(null)
  const target = account.trim()
  // Typed when the read is refused (403 — contract gap), and when it holds no active account to choose.
  const typed = accounts.isError || (accounts.isSuccess && !(accounts.data ?? []).some((a) => a.active))
  const send = useMutation({
    mutationFn: (key: string) => catalogApi.push(key),
    // A new push clears the last answer, so a failure never stands beside an older success.
    onMutate: () => setResult(null),
    onSuccess: (answer, key) => {
      setResult({ account: key, answer })
      notify.success(t('push.done'), t('push.doneDetail', { account: fsi(key) }))
    },
  })
  const deliverectRefusal = fieldRefusal(send.error, [DELIVERECT_ERRORS.deliverectFailed], t('push.failedHint'))
  const code = apiErrorCode(send.error)

  return (
    <Modal
      open
      onClose={() => !send.isPending && onClose()}
      title={t('push.title')}
      width="32rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={send.isPending} data-push-cancel="">
            {result ? t('push.close') : t('dialog.cancel')}
          </Button>
          {/* Once pushed, the same account is not pushed again by a second click: choose another, or close. */}
          <Button
            variant="primary"
            disabled={send.isPending || target === '' || result?.account === target}
            onClick={() => send.mutate(target)}
            data-push-confirm=""
          >
            {send.isPending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
            {send.isPending ? t('dialog.sending') : t('push.confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-push-dialog="">
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t('push.note')}</p>
        <Field label={t('push.account')}>
          {typed ? (
            <Input
              type="text"
              value={account}
              onChange={(e) => {
                setAccount(e.target.value)
                send.reset()
              }}
              disabled={send.isPending}
              dir="ltr"
              placeholder={t('push.typePlaceholder')}
              className="font-mono"
              data-push-account-input=""
            />
          ) : (
            <Select
              value={account}
              onChange={(e) => {
                setAccount(e.target.value)
                send.reset()
              }}
              disabled={send.isPending || accounts.isPending}
              data-push-account-select=""
            >
              <option value="">{accounts.isPending ? t('push.loading') : t('push.choose')}</option>
              {(accounts.data ?? []).map((a) => (
                <option key={a.accountKey} value={a.accountKey} disabled={!a.active}>
                  {a.active ? fsi(a.accountKey) : t('push.inactive', { key: fsi(a.accountKey) })}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {typed && (
          <span className="text-xs text-muted-foreground" data-push-account-fallback="">
            {t('push.fallbackHint')}
          </span>
        )}
        {result && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-border/60 p-2 text-sm" data-push-result="">
            <dt className="text-muted-foreground">{t('push.resultAccount')}</dt>
            <dd className="font-mono">
              <Ltr>{result.account}</Ltr>
            </dd>
            <dt className="text-muted-foreground">{t('push.fileId')}</dt>
            <dd className="font-mono" data-push-file-id="">
              <Ltr>{result.answer.fileId}</Ltr>
            </dd>
            <dt className="text-muted-foreground">{t('push.status')}</dt>
            <dd data-push-status="">
              <bdi>{result.answer.status}</bdi>
            </dd>
            <dt className="text-muted-foreground">{t('push.rows')}</dt>
            <dd className="tabular-nums" data-push-rows="">
              <Ltr>{figure(result.answer.rows)}</Ltr>
            </dd>
          </dl>
        )}
        {deliverectRefusal && (
          <div className="flex flex-col gap-1" data-push-refusal={deliverectRefusal.code}>
            <p className="text-xs text-danger-800">{t('push.deliverectAnswer')}</p>
            <InlineRefusal message={deliverectRefusal.message} code={deliverectRefusal.code} />
          </div>
        )}
        {send.isError && !deliverectRefusal && (
          <ErrorBanner className="p-2" title={t('push.failed')} message={apiErrorMessage(send.error, t('push.failedHint'))}>
            {code && (
              <span className="font-mono text-xs" data-push-error={code}>
                <Ltr>{code}</Ltr>
              </span>
            )}
          </ErrorBanner>
        )}
      </div>
    </Modal>
  )
}
