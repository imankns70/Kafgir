import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { CustomerDetailDto } from '@kafgir/contracts'
import { adminApi } from './api'
import { formatPersianDateTime } from './number-format'

/** Splits what the operator typed into clean tags: «وفادار، بدقول» → ['وفادار', 'بدقول']. */
export function parseTags(text: string): string[] {
  return [...new Set(text.split(/[,،\n]/u).map((tag) => tag.trim().replace(/\s+/gu, ' ')).filter(Boolean))]
}

/**
 * The business's own record of one customer: a private note, tags, and a block that stops them
 * ordering from the customer app. Staff can still place an order for a blocked customer by hand.
 */
export function CustomerCrmPanel({ customer, knownTags, onSaved }: {
  customer: CustomerDetailDto
  knownTags: string[]
  onSaved: (customer: CustomerDetailDto) => void
}) {
  const [note, setNote] = useState(customer.adminNote ?? '')
  const [tags, setTags] = useState<string[]>(customer.tags)
  const [tagText, setTagText] = useState('')
  const [blocked, setBlocked] = useState(Boolean(customer.blockedAt))
  const [reason, setReason] = useState(customer.blockedReason ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setNote(customer.adminNote ?? '')
    setTags(customer.tags)
    setBlocked(Boolean(customer.blockedAt))
    setReason(customer.blockedReason ?? '')
    setTagText('')
    setError(null)
  }, [customer])

  const addTags = (text: string) => {
    const next = parseTags(text)
    if (next.length) setTags((current) => [...new Set([...current, ...next])].slice(0, 12))
    setTagText('')
  }
  const onTagKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === '،') {
      event.preventDefault()
      addTags(tagText)
    }
  }
  const suggestions = knownTags.filter((tag) => !tags.includes(tag)).slice(0, 8)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const allTags = [...new Set([...tags, ...parseTags(tagText)])]
    if (blocked && !reason.trim()) { setError('برای مسدود کردن، دلیل را بنویسید.'); return }
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      onSaved(await adminApi.updateCustomer(customer.customerProfileId, {
        adminNote: note.trim() || null, tags: allTags, blocked, blockedReason: blocked ? reason.trim() : null,
      }))
      setSaved(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally { setBusy(false) }
  }

  return <form className={`customer-detail-section customer-crm${blocked ? ' is-blocked' : ''}`} onSubmit={(event) => void save(event)}>
    <h3>یادداشت و برچسب</h3>
    {customer.blockedAt && <p className="customer-blocked-note">
      مسدود از {formatPersianDateTime(customer.blockedAt)}{customer.blockedReason ? ` — ${customer.blockedReason}` : ''}
    </p>}
    <label>یادداشت داخلی (فقط برای تیم کفگیر)
      <textarea rows={3} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)}
        placeholder="مثلاً: زنگ واحد خراب است، تماس بگیرید" />
    </label>
    <div className="customer-tag-editor">
      <span className="customer-tag-label">برچسب‌ها</span>
      <div className="customer-tags">
        {tags.map((tag) => <span className="customer-tag" key={tag}>{tag}
          <button type="button" aria-label={`حذف برچسب ${tag}`} onClick={() => setTags((current) => current.filter((item) => item !== tag))}>×</button>
        </span>)}
        <input value={tagText} maxLength={60} placeholder={tags.length ? 'برچسب دیگر…' : 'مثلاً وفادار، شرکتی'}
          aria-label="برچسب تازه" onChange={(event) => setTagText(event.target.value)} onKeyDown={onTagKey}
          onBlur={() => tagText.trim() && addTags(tagText)} />
      </div>
      {suggestions.length > 0 && <div className="customer-tag-suggestions">
        {suggestions.map((tag) => <button type="button" key={tag} onClick={() => addTags(tag)}>+ {tag}</button>)}
      </div>}
    </div>
    <label className="switch customer-block-switch">
      <input type="checkbox" checked={blocked} onChange={(event) => setBlocked(event.target.checked)} />
      مسدود کردن سفارش از اپ مشتری
    </label>
    {blocked && <label>دلیل مسدودی (الزامی)
      <input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)}
        placeholder="مثلاً سه سفارش پرداخت‌نشده" />
    </label>}
    {error && <div className="message error">{error}</div>}
    <div className="customer-crm-actions">
      <button className="primary" disabled={busy}>{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
      {saved && !busy && <span className="muted">ذخیره شد.</span>}
    </div>
  </form>
}
