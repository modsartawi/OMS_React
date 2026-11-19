import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, CameraOff, Flashlight, FlashlightOff } from 'lucide-react'
import Button from '@/core/ui/Button'
import { createScanner, type BarcodeScanner, type ScanFormat, type ScanRead } from './scanner'

/**
 * The camera, behind the scanner adapter: start and stop, the torch when the phone has one, and which reader the
 * adapter chose. Each read goes to `onRead` with its reader, format, value and time-to-read.
 */
export default function ScannerView({
  formats,
  onRead,
  autoStart = false,
  paused = false,
}: {
  formats: readonly ScanFormat[]
  onRead: (read: ScanRead) => void
  autoStart?: boolean
  /** While a verb is running, reads are dropped rather than queued behind it. */
  paused?: boolean
}) {
  const { t } = useTranslation('minipos')
  const video = useRef<HTMLVideoElement>(null)
  const scanner = useRef<BarcodeScanner | null>(null)
  const latest = useRef({ onRead, paused })
  latest.current = { onRead, paused }
  const [running, setRunning] = useState(false)
  const [reader, setReader] = useState<'native' | 'zxing' | null>(null)
  const [torch, setTorch] = useState<'off' | 'on' | 'none'>('off')
  const [refused, setRefused] = useState(false)

  const start = async () => {
    if (!video.current) return
    setRefused(false)
    try {
      if (!scanner.current) {
        const made = await createScanner(formats)
        made.onRead((read) => {
          if (!latest.current.paused) latest.current.onRead(read)
        })
        scanner.current = made
        setReader(made.reader)
      }
      await scanner.current.start(video.current)
      setRunning(true)
      setTorch('off')
    } catch {
      setRefused(true)
      setRunning(false)
    }
  }

  const stop = () => {
    scanner.current?.stop()
    setRunning(false)
  }

  const toggleTorch = async () => {
    const on = torch !== 'on'
    const ok = (await scanner.current?.torch?.(on)) ?? false
    setTorch(ok ? (on ? 'on' : 'off') : 'none')
  }

  useEffect(() => {
    if (autoStart) void start()
    return () => scanner.current?.stop()
    // Started once per mount; the formats of a mounted view do not change.
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
        <video ref={video} aria-label={t('scanner.video')} playsInline muted className="size-full object-cover" />
        {running && <div className="pointer-events-none absolute inset-x-[12%] inset-y-[22%] rounded-md border-2 border-primary-foreground/70" />}
      </div>
      {refused && <p className="text-sm text-danger-800">{t('scanner.cameraRefused')}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {running ? (
          <Button variant="secondary" className="h-10 flex-1 justify-center" onClick={stop}>
            <CameraOff className="size-4" aria-hidden />
            {t('scanner.stop')}
          </Button>
        ) : (
          <Button className="h-10 flex-1 justify-center" onClick={() => void start()}>
            <Camera className="size-4" aria-hidden />
            {t('scanner.start')}
          </Button>
        )}
        {running && torch !== 'none' && (
          <Button variant="outlined" className="h-10" onClick={() => void toggleTorch()}>
            {torch === 'on' ? <FlashlightOff className="size-4" aria-hidden /> : <Flashlight className="size-4" aria-hidden />}
            {torch === 'on' ? t('scanner.torchOff') : t('scanner.torchOn')}
          </Button>
        )}
        {reader && (
          <span className="text-xs text-muted-foreground">{reader === 'native' ? t('scanner.readerNative') : t('scanner.readerZxing')}</span>
        )}
      </div>
    </div>
  )
}
