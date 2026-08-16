'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { BrandedState } from '../../design-system/BrandedState'
import { ButtonLoading } from '../../design-system/ButtonLoading'
import { Icon } from '../../design-system/Icon'
import {
  createCustomerSupportConversation,
  getCustomerOrders,
  getCustomerSession,
  getCustomerSupportConversation,
  getCustomerSupportConversations,
  getSupportSubjects,
  sendCustomerSupportMessage,
  setCustomerSupportConversationClosed,
} from '../../services/customerApi'
import {
  SupportConversationStatus,
  SupportSenderType,
  type CustomerOrderSummaryDto,
  type CustomerSupportConversationDto,
  type SupportConversationSummaryDto,
  type SupportSubjectDto,
} from '../../types'
import { formatPersianDateTime } from '../../utils/format'

type Props = { onBack: () => void; onAccount: () => void }

const contacts = [
  { label: 'پشتیبانی سفارش', phone: '09166450262' },
  { label: 'پیگیری و هماهنگی', phone: '09163442440' },
]

const statusLabels: Record<SupportConversationStatus, string> = {
  [SupportConversationStatus.AwaitingAdmin]: 'در انتظار پاسخ کفگیر',
  [SupportConversationStatus.AwaitingCustomer]: 'پاسخ داده شده',
  [SupportConversationStatus.Closed]: 'بسته شده',
}

export function ContactPage({ onBack, onAccount }: Props) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [orders, setOrders] = useState<CustomerOrderSummaryDto[]>([])
  const [conversations, setConversations] = useState<SupportConversationSummaryDto[]>([])
  const [selected, setSelected] = useState<CustomerSupportConversationDto | null>(null)
  const [subjects, setSubjects] = useState<SupportSubjectDto[]>([])
  const [subject, setSubject] = useState(0)
  const [orderId, setOrderId] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [reply, setReply] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadInbox = useCallback(async () => {
    setError(null)
    try {
      const items = await getCustomerSupportConversations()
      setConversations(items)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'دریافت گفتگوها ممکن نشد.')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const session = await getCustomerSession()
        if (cancelled) return
        setAuthenticated(session.authenticated)
        if (session.authenticated) {
          const [inbox, orderPage, availableSubjects] = await Promise.all([
            getCustomerSupportConversations(), getCustomerOrders(1), getSupportSubjects(),
          ])
          if (!cancelled) {
            setConversations(inbox); setOrders(orderPage.items); setSubjects(availableSubjects)
            setSubject(availableSubjects[0]?.id ?? 0)
          }
        } else {
          const availableSubjects = await getSupportSubjects()
          if (!cancelled) { setSubjects(availableSubjects); setSubject(availableSubjects[0]?.id ?? 0) }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'ارتباط با پشتیبانی ممکن نشد.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const openConversation = async (id: number) => {
    setIsLoading(true); setError(null)
    try {
      const detail = await getCustomerSupportConversation(id)
      setSelected(detail)
      setConversations((items) => items.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'باز کردن گفتگو ممکن نشد.')
    } finally { setIsLoading(false) }
  }

  const createConversation = async (event: FormEvent) => {
    event.preventDefault(); setIsSubmitting(true); setError(null)
    try {
      const detail = await createCustomerSupportConversation({
        subject, orderId: orderId ? Number(orderId) : null, message: newMessage,
      })
      setNewMessage(''); setOrderId(''); setSelected(detail)
      await loadInbox()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ارسال پیام ممکن نشد.')
    } finally { setIsSubmitting(false) }
  }

  const sendReply = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setIsSubmitting(true); setError(null)
    try {
      const detail = await sendCustomerSupportMessage(selected.id, { message: reply })
      setReply(''); setSelected(detail); await loadInbox()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ارسال پاسخ ممکن نشد.')
    } finally { setIsSubmitting(false) }
  }

  const toggleClosed = async () => {
    if (!selected) return
    setIsSubmitting(true); setError(null)
    try {
      const detail = await setCustomerSupportConversationClosed(selected.id, selected.status !== SupportConversationStatus.Closed)
      setSelected(detail); await loadInbox()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تغییر وضعیت گفتگو ممکن نشد.')
    } finally { setIsSubmitting(false) }
  }

  return (
    <main className="contact-page">
      <div className="page-actions">
        <div><p className="eyebrow"><Icon name="support" size="sm" /> ارتباط با ما</p><h1 className="section-title">پشتیبانی خصوصی کفگیر</h1></div>
        <button className="checkout-back-link" onClick={onBack}>منوی امروز <Icon name="back" size="sm" /></button>
      </div>

      <section className="panel contact-card" aria-label="شماره‌های تماس کفگیر">
        <div><h2>تماس تلفنی</h2><p className="muted">برای موارد فوری در ساعت کاری با ما تماس بگیرید.</p></div>
        <div className="contact-list">
          {contacts.map((item) => <a className="contact-link" href={`tel:${item.phone}`} key={item.phone}>
            <span><Icon name="phone" size="md" /> {item.label}</span><bdi dir="ltr">{item.phone}</bdi>
          </a>)}
        </div>
      </section>

      {isLoading && authenticated === null && <BrandedState title="در حال آماده‌سازی پشتیبانی" message="کمی صبر کنید…" icon="support" animated />}

      {authenticated === false && <section className="panel support-login-gate">
        <span className="support-login-icon"><Icon name="profile" size="lg" /></span>
        <div><h2>گفتگوی خصوصی با پشتیبانی</h2><p className="muted">برای ثبت پیام و دیدن پاسخ‌ها ابتدا وارد حساب خود شوید.</p></div>
        <button className="primary-button" type="button" onClick={onAccount}>ورود به حساب</button>
      </section>}

      {authenticated && <section className="support-workspace" aria-label="گفتگوی آفلاین با پشتیبانی">
        <div className="panel support-compose-card">
          <div className="support-section-heading"><div><h2>پیام جدید</h2><p className="muted">پیام شما محرمانه است و فقط تیم کفگیر آن را می‌بیند.</p></div></div>
          <form className="form-grid" onSubmit={createConversation}>
            <label className="field">موضوع
              <select value={subject} onChange={(event) => setSubject(Number(event.target.value))} required>
                {subjects.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="field">سفارش مرتبط (اختیاری)
              <select value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                <option value="">بدون سفارش مشخص</option>
                {orders.map((order) => <option value={order.id} key={order.id}>سفارش #{order.orderNumber}</option>)}
              </select>
            </label>
            <label className="field">متن پیام
              <textarea value={newMessage} onChange={(event) => setNewMessage(event.target.value)} maxLength={2000} placeholder="موضوع را با جزئیات برای ما بنویسید…" required />
            </label>
            <button className="primary-button" disabled={isSubmitting || subject <= 0 || newMessage.trim().length < 2}>
              {isSubmitting ? <ButtonLoading label="در حال ارسال" /> : 'ارسال پیام'}
            </button>
          </form>
        </div>

        <div className="panel support-inbox-card">
          <div className="support-section-heading">
            <div><h2>گفتگوهای من</h2><p className="muted">پاسخ‌ها برای مراجعات بعدی ذخیره می‌شوند.</p></div>
            <button type="button" className="outline-button support-refresh" onClick={() => void loadInbox()} disabled={isLoading}><Icon name="refresh" size="sm" /> بروزرسانی</button>
          </div>
          {conversations.length === 0 ? <p className="support-empty">هنوز گفتگویی ندارید.</p> : <div className="support-conversation-list">
            {conversations.map((item) => <button type="button" className={`support-conversation-row${selected?.id === item.id ? ' active' : ''}`} onClick={() => void openConversation(item.id)} key={item.id}>
              <span className="support-row-title"><strong>{item.subjectTitle}</strong>{item.unreadCount > 0 && <b className="support-unread">{item.unreadCount}</b>}</span>
              <span>{item.lastMessage}</span><small>{statusLabels[item.status]} · {formatPersianDateTime(item.lastMessageAt)}</small>
            </button>)}
          </div>}
        </div>

        {selected && <div className="panel support-thread-card">
          <div className="support-thread-head">
            <div><h2>{selected.subjectTitle}</h2><p>{selected.orderNumber ? `سفارش #${selected.orderNumber}` : 'گفتگوی عمومی'}</p></div>
            <span className={`support-status status-${selected.status}`}>{statusLabels[selected.status]}</span>
          </div>
          <div className="support-messages" aria-live="polite">
            {selected.messages.map((message) => <article className={`support-bubble ${message.senderType === SupportSenderType.Customer ? 'mine' : 'admin'}`} key={message.id}>
              <strong>{message.senderType === SupportSenderType.Customer ? 'شما' : message.senderName}</strong><p>{message.message}</p><time dateTime={message.createdAt}>{formatPersianDateTime(message.createdAt)}</time>
            </article>)}
          </div>
          {selected.status === SupportConversationStatus.Closed
            ? <button type="button" className="outline-button" onClick={() => void toggleClosed()} disabled={isSubmitting}>باز کردن دوباره گفتگو</button>
            : <form className="support-reply-form" onSubmit={sendReply}>
              <label className="field">پاسخ شما<textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={2000} required /></label>
              <div className="support-reply-actions">
                <button className="primary-button" disabled={isSubmitting || reply.trim().length < 2}>{isSubmitting ? <ButtonLoading label="در حال ارسال" /> : 'ارسال پاسخ'}</button>
                <button type="button" className="outline-button" onClick={() => void toggleClosed()} disabled={isSubmitting}>بستن گفتگو</button>
              </div>
            </form>}
        </div>}
      </section>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </main>
  )
}
