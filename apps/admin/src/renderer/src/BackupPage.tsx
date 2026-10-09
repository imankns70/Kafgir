import { useState } from 'react'
import type { BackupExportResult } from '../../preload'
import { Message, PageFrame } from './admin-ui'
import { formatNumber } from './number-format'

/** «۲٫۴ مگابایت» — the saved file's size, readable. */
export function fileSizeText(bytes: number) {
  if (bytes < 1024) return `${formatNumber(bytes)} بایت`
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 1)} کیلوبایت`
  return `${formatNumber(bytes / (1024 * 1024), 1)} مگابایت`
}

export function BackupPage() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BackupExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const saved = await window.kafgir.exportBackup()
      if (saved) setResult(saved)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally { setBusy(false) }
  }

  return <PageFrame title="پشتیبان‌گیری"
    description="یک نسخه کامل و خوانا از داده‌های کفگیر (منوها، سفارش‌ها، مشتریان، پرداخت‌ها، خریدها و …) در یک فایل روی همین رایانه.">
    <Message error={error} />
    <section className="panel backup-panel">
      <ul className="backup-points">
        <li>همه جدول‌ها در یک لحظه خوانده می‌شوند، پس فایل حتی وسط کار روزانه هم یکدست است.</li>
        <li>رمزها، کدهای یک‌بارمصرف و اطلاعات ورود شبکه‌های اجتماعی در فایل نیستند.</li>
        <li>فایل را جایی امن نگه دارید (مثلاً حافظه جدا یا فضای ابری شخصی)؛ اطلاعات تماس مشتریان در آن هست.</li>
        <li>پیشنهاد: هفته‌ای یک بار، و همیشه پیش از تغییر بزرگ.</li>
      </ul>
      <div className="action-row">
        <button type="button" className="primary" disabled={busy} onClick={() => void run()}>
          {busy ? 'در حال تهیه نسخه…' : 'تهیه و ذخیره نسخه پشتیبان'}
        </button>
      </div>
      {result && <div className="message backup-result" role="status">
        نسخه پشتیبان ذخیره شد: {formatNumber(result.tables)} جدول، {formatNumber(result.rows)} سطر، {fileSizeText(result.bytes)}.
        <bdi dir="ltr" className="backup-path">{result.filePath}</bdi>
      </div>}
    </section>
  </PageFrame>
}
