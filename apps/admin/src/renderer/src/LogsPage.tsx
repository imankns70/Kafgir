import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi, type LogEntry } from './api'
import { Pager, RowNumberCell, RowNumberHead, usePagination } from './admin-ui'
import { formatNumber, persianDateWithLatinDigitsLocale } from './number-format'

const levels: Record<number, { label: string; className: string }> = {
  10: { label: 'ردیابی', className: 'log-trace' },
  20: { label: 'اشکال‌زدایی', className: 'log-debug' },
  30: { label: 'اطلاعات', className: 'log-info' },
  40: { label: 'هشدار', className: 'log-warn' },
  50: { label: 'خطا', className: 'log-error' },
  60: { label: 'بحرانی', className: 'log-fatal' },
}
const time = (value?: number) => value
  ? new Intl.DateTimeFormat(persianDateWithLatinDigitsLocale, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
  : '—'

export function LogsPage() {
  const [server, setServer] = useState<LogEntry[]>([])
  const [desktop, setDesktop] = useState<LogEntry[]>([])
  const [source, setSource] = useState<'all' | 'server' | 'desktop'>('all')
  const [minimumLevel, setMinimumLevel] = useState(30)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setBusy(true); setError(null)
    const [serverResult, desktopResult] = await Promise.allSettled([
      adminApi.serverLogs(), adminApi.desktopLogs(),
    ])
    if (serverResult.status === 'fulfilled') setServer(serverResult.value)
    if (desktopResult.status === 'fulfilled') setDesktop(desktopResult.value)
    const failures = [serverResult, desktopResult].filter((item) => item.status === 'rejected')
    if (failures.length) setError('دریافت بخشی از گزارش‌ها ممکن نشد.')
    setBusy(false)
  }, [])
  useEffect(() => { void load() }, [load])
  const entries = useMemo(() => {
    const combined = [
      ...(source !== 'desktop' ? server.map((entry) => ({ ...entry, source: 'server' })) : []),
      ...(source !== 'server' ? desktop.map((entry) => ({ ...entry, source: 'desktop' })) : []),
    ]
    const needle = search.trim().toLocaleLowerCase('fa-IR')
    return combined.filter((entry) => (entry.level ?? 0) >= minimumLevel)
      .filter((entry) => !needle || JSON.stringify(entry).toLocaleLowerCase('fa-IR').includes(needle))
      .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
  }, [desktop, minimumLevel, search, server, source])
  const paged = usePagination(entries)
  return <section className="page logs-page">
    <header className="page-header"><h1>گزارش رویدادها</h1><button onClick={() => void load()} disabled={busy}>{busy ? 'در حال دریافت…' : 'تازه‌سازی'}</button></header>
    {error && <div className="message error">{error}</div>}
    <div className="toolbar logs-toolbar">
      <label>منبع<select value={source} onChange={(event) => setSource(event.target.value as typeof source)}>
        <option value="all">همه</option><option value="server">سرور</option><option value="desktop">برنامه مدیریت</option>
      </select></label>
      <label>حداقل سطح<select value={minimumLevel} onChange={(event) => setMinimumLevel(Number(event.target.value))}>
        <option value="20">اشکال‌زدایی</option><option value="30">اطلاعات</option>
        <option value="40">هشدار</option><option value="50">خطا</option>
      </select></label>
      <label>جستجو<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="رویداد، سفارش، پیام…" /></label>
      <span className="logs-count">{formatNumber(entries.length)} رویداد</span>
    </div>
    <div className="panel table-wrap logs-table"><table><thead><tr><RowNumberHead /><th>زمان</th><th>منبع</th><th>سطح</th><th>رویداد</th><th>پیام</th><th>شناسه مرتبط</th></tr></thead>
      <tbody>{paged.visible.map((entry, index) => {
        const level = levels[entry.level ?? 30] ?? levels[30]!
        const related = entry.orderId ? `سفارش ${entry.orderId}` : entry.purchaseId ? `خرید ${entry.purchaseId}` : entry.userId ? `کاربر ${entry.userId}` : entry.requestId ?? '—'
        return <tr key={`${entry.source}-${entry.time}-${index}`}><RowNumberCell offset={paged.rowOffset} index={index} /><td>{time(entry.time)}</td><td>{entry.source === 'server' ? 'سرور' : 'دسکتاپ'}</td>
          <td><span className={`badge ${level.className}`}>{level.label}</span></td><td dir="ltr">{entry.event ?? '—'}</td>
          <td className="log-message">{entry.msg ?? entry.errorMessage ?? '—'}</td><td dir="ltr">{related}</td></tr>
      })}</tbody></table></div>
    <Pager {...paged} />
  </section>
}
