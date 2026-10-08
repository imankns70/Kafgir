'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { BrandedState } from '../../design-system/BrandedState'
import { ButtonLoading } from '../../design-system/ButtonLoading'
import { Icon, type IconName } from '../../design-system/Icon'
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
import { formatNumber, formatPersianDay } from '../../utils/format'

// `onBack` stays in the props for the app shell; the logo and the tab bar already lead home.
type Props = { onBack: () => void; onAccount: () => void }
type View = 'inbox' | 'new' | 'thread'

const contacts = [
  { label: 'پشتیبانی سفارش', hint: 'مشکل یا سوال درباره سفارش', phone: '09166450262' },
  { label: 'پیگیری و هماهنگی', hint: 'هماهنگی تحویل و سفارش‌های ویژه', phone: '09163442440' },
]

const statusLabels: Record<SupportConversationStatus, string> = {
  [SupportConversationStatus.AwaitingAdmin]: 'در انتظار پاسخ',
  [SupportConversationStatus.AwaitingCustomer]: 'پاسخ داده شد',
  [SupportConversationStatus.Closed]: 'بسته شده',
}

const threadRefreshMs = 20_000
const tehranDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' })
const tehranTime = new Intl.DateTimeFormat('fa-IR-u-nu-latn', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit' })

/** Subjects are admin-editable text, so the icon is a best guess from the title with a neutral fallback. */
export function subjectIcon(title: string): IconName {
  if (/سفارش|پیگیری/u.test(title)) return 'orders'
  if (/پرداخت|مالی/u.test(title)) return 'discount'
  if (/ارسال|تحویل|پیک/u.test(title)) return 'delivery'
  if (/غذا|کیفیت|طعم/u.test(title)) return 'food'
  if (/پیشنهاد|انتقاد|نظر/u.test(title)) return 'rating'
  return 'support'
}

/** «امروز ۱۴:۰۲», «دیروز», or the day's name for older messages — how a chat list reads time. */
export function formatConversationTime(value: string, now = new Date()): string {
  const date = new Date(value)
  const day = tehranDay.format(date)
  const today = tehranDay.format(now)
  const yesterday = tehranDay.format(new Date(now.getTime() - 86_400_000))
  if (day === today) return tehranTime.format(date)
  if (day === yesterday) return 'دیروز'
  return formatPersianDay(day)
}

function dayLabel(value: string, now = new Date()) {
  const day = tehranDay.format(new Date(value))
  if (day === tehranDay.format(now)) return 'امروز'
  if (day === tehranDay.format(new Date(now.getTime() - 86_400_000))) return 'دیروز'
  return formatPersianDay(day)
}

export function ContactPage({ onAccount }: Props) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [orders, setOrders] = useState<CustomerOrderSummaryDto[]>([])
  const [conversations, setConversations] = useState<SupportConversationSummaryDto[]>([])
  const [selected, setSelected] = useState<CustomerSupportConversationDto | null>(null)
  const [view, setView] = useState<View>('inbox')
  const [subjects, setSubjects] = useState<SupportSubjectDto[]>([])
  const [subject, setSubject] = useState(0)
  const [orderId, setOrderId] = useState<number | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [reply, setReply] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEnd = useRef<HTMLDivElement>(null)

  const loadInbox = useCallback(async () => {
    setError(null)
    setIsRefreshing(true)
    try {
      setConversations(await getCustomerSupportConversations())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'دریافت گفتگوها ممکن نشد.')
    } finally {
      setIsRefreshing(false)
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

  // A reply from the team should appear while the customer is looking at the thread.
  useEffect(() => {
    if (view !== 'thread' || !selected) return
    const id = selected.id
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void getCustomerSupportConversation(id).then((detail) => {
        setSelected((current) => current?.id === id ? detail : current)
      }).catch(() => { /* keep the thread as it is; the next tick tries again */ })
    }, threadRefreshMs)
    return () => window.clearInterval(timer)
  }, [view, selected?.id])

  useEffect(() => {
    if (view === 'thread') messagesEnd.current?.scrollIntoView({ block: 'end' })
  }, [view, selected?.messages.length])

  const showInbox = () => { setView('inbox'); setSelected(null); setError(null) }

  const openConversation = async (id: number) => {
    if (openingId != null) return
    setOpeningId(id); setError(null)
    try {
      const detail = await getCustomerSupportConversation(id)
      setSelected(detail)
      setView('thread')
      setConversations((items) => items.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'باز کردن گفتگو ممکن نشد.')
    } finally {
      setOpeningId(null)
    }
  }

  const startConversation = (preset?: { orderId?: number }) => {
    setSelected(null)
    setOrderId(preset?.orderId ?? null)
    setView('new')
    setError(null)
  }

  const createConversation = async (event: FormEvent) => {
    event.preventDefault(); setIsSubmitting(true); setError(null)
    try {
      const detail = await createCustomerSupportConversation({ subject, orderId, message: newMessage })
      setNewMessage(''); setOrderId(null); setSelected(detail); setView('thread')
      await loadInbox()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ارسال پیام ممکن نشد.')
    } finally { setIsSubmitting(false) }
  }

  const sendReply = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!selected || reply.trim().length < 2 || isSubmitting) return
    setIsSubmitting(true); setError(null)
    try {
      const detail = await sendCustomerSupportMessage(selected.id, { message: reply })
      setReply(''); setSelected(detail); await loadInbox()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ارسال پاسخ ممکن نشد.')
    } finally { setIsSubmitting(false) }
  }

  const onReplyKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on a keyboard; Shift+Enter keeps a line break. Phones keep Enter as a new line.
    if (event.key === 'Enter' && !event.shiftKey && window.matchMedia('(hover: hover)').matches) {
      event.preventDefault()
      void sendReply()
    }
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

  const unreadTotal = conversations.reduce((sum, item) => sum + item.unreadCount, 0)

  const hero = <section className="contact-hero">
    <span className="contact-hero-icon" aria-hidden="true"><Icon name="support" size="lg" /></span>
    <div className="contact-hero-copy">
      <h1>چطور می‌توانیم کمک کنیم؟</h1>
      <p>برای کارهای فوری تماس بگیرید؛ برای بقیه پیام بگذارید تا تیم کفگیر همین‌جا پاسخ دهد.</p>
    </div>
    <div className="contact-phones" aria-label="شماره‌های تماس کفگیر">
      {contacts.map((item) => <a className="contact-phone" href={`tel:${item.phone}`} key={item.phone}>
        <span className="contact-phone-icon" aria-hidden="true"><Icon name="phone" size="md" /></span>
        <span className="contact-phone-copy"><strong>{item.label}</strong><small>{item.hint}</small></span>
        <bdi dir="ltr">{item.phone}</bdi>
      </a>)}
    </div>
  </section>

  if (isLoading && authenticated === null) return <main className="contact-page">
    {hero}
    <BrandedState title="در حال آماده‌سازی پشتیبانی" message="کمی صبر کنید…" icon="support" animated />
  </main>

  if (!authenticated) return <main className="contact-page">
    {hero}
    <section className="contact-login">
      <span className="contact-login-icon" aria-hidden="true"><Icon name="profile" size="lg" /></span>
      <div>
        <h2>گفتگوی خصوصی با پشتیبانی</h2>
        <p>با ورود به حساب، پیام بگذارید و پاسخ‌ها را همیشه همین‌جا ببینید.</p>
      </div>
      <button className="primary-button" type="button" onClick={onAccount}>ورود به حساب</button>
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
  </main>

  const relatedOrders = orders.slice(0, 6)
  const selectedSubjectTitle = subjects.find((item) => item.id === subject)?.title ?? ''

  return (
    <main className={`contact-page contact-view-${view}`}>
      <div className="contact-layout">
        <aside className="contact-sidebar">
          {hero}
          <section className="contact-inbox" aria-labelledby="contact-inbox-title">
            <header className="contact-inbox-head">
              <h2 id="contact-inbox-title">گفتگوهای من {unreadTotal > 0 && <span className="contact-unread-total">{formatNumber(unreadTotal)} پیام تازه</span>}</h2>
              <button type="button" className="contact-icon-button" onClick={() => void loadInbox()} disabled={isRefreshing} aria-label="به‌روزرسانی گفتگوها">
                {isRefreshing ? <span className="menu-load-spinner" aria-hidden="true" /> : <Icon name="refresh" size="sm" />}
              </button>
            </header>
            <button type="button" className={`contact-new-button${view === 'new' ? ' active' : ''}`} onClick={() => startConversation()}>
              <Icon name="add" size="sm" /> پیام جدید به پشتیبانی
            </button>
            {conversations.length === 0
              ? <div className="contact-empty">
                  <span aria-hidden="true"><Icon name="support" size="lg" /></span>
                  <p>هنوز گفتگویی ندارید. اولین پیامتان را بفرستید؛ معمولاً در ساعت کاری پاسخ می‌دهیم.</p>
                </div>
              : <ul className="contact-conversations">
                  {conversations.map((item) => <li key={item.id}>
                    <button type="button" className={`contact-conversation${selected?.id === item.id ? ' active' : ''}${item.unreadCount > 0 ? ' unread' : ''}${item.status === SupportConversationStatus.Closed ? ' closed' : ''}`}
                      disabled={openingId != null} onClick={() => void openConversation(item.id)} aria-busy={openingId === item.id}>
                      <span className="contact-conversation-icon" aria-hidden="true"><Icon name={subjectIcon(item.subjectTitle)} size="md" /></span>
                      <span className="contact-conversation-copy">
                        <span className="contact-conversation-top">
                          <strong>{item.subjectTitle}</strong>
                          <time dateTime={item.lastMessageAt}>{openingId === item.id ? 'در حال باز کردن…' : formatConversationTime(item.lastMessageAt)}</time>
                        </span>
                        <span className="contact-conversation-preview">{item.lastMessage}</span>
                        <span className="contact-conversation-meta">
                          <span className={`contact-status status-${item.status}`}>{statusLabels[item.status]}</span>
                          {item.orderNumber && <span className="contact-order-tag" dir="ltr">#{item.orderNumber}</span>}
                          {item.unreadCount > 0 && <b className="contact-unread">{formatNumber(item.unreadCount)}</b>}
                        </span>
                      </span>
                    </button>
                  </li>)}
                </ul>}
          </section>
        </aside>

        <section className="contact-pane" aria-live="polite">
          {view === 'inbox' && <div className="contact-placeholder">
            <span aria-hidden="true"><Icon name="support" size="xl" /></span>
            <h2>یک گفتگو را انتخاب کنید</h2>
            <p>یا پیام تازه‌ای برای تیم کفگیر بفرستید.</p>
            <button type="button" className="primary-button" onClick={() => startConversation()}><Icon name="add" size="sm" /> پیام جدید</button>
          </div>}

          {view === 'new' && <form className="contact-compose" onSubmit={createConversation}>
            <header className="contact-pane-head">
              <button type="button" className="contact-back" onClick={showInbox} aria-label="بازگشت به گفتگوها"><Icon name="back" size="sm" /></button>
              <div><h2>پیام جدید</h2><p>پیام شما خصوصی است و فقط تیم کفگیر آن را می‌بیند.</p></div>
            </header>
            <fieldset className="contact-choice">
              <legend>موضوع پیام</legend>
              <div>{subjects.map((item) => <button type="button" key={item.id} className={subject === item.id ? 'active' : ''} aria-pressed={subject === item.id} onClick={() => setSubject(item.id)}>
                <Icon name={subjectIcon(item.title)} size="sm" /> {item.title}
              </button>)}</div>
            </fieldset>
            {relatedOrders.length > 0 && <fieldset className="contact-choice">
              <legend>درباره کدام سفارش؟ <small>اختیاری</small></legend>
              <div>
                <button type="button" className={orderId == null ? 'active' : ''} aria-pressed={orderId == null} onClick={() => setOrderId(null)}>سفارش خاصی نیست</button>
                {relatedOrders.map((order) => <button type="button" key={order.id} className={orderId === order.id ? 'active' : ''} aria-pressed={orderId === order.id} onClick={() => setOrderId(order.id)}>
                  <bdi dir="ltr">#{order.orderNumber}</bdi>
                </button>)}
              </div>
            </fieldset>}
            <label className="contact-message-field">
              <span>پیام شما</span>
              <textarea value={newMessage} onChange={(event) => setNewMessage(event.target.value)} maxLength={2000} rows={6}
                placeholder={selectedSubjectTitle ? `درباره «${selectedSubjectTitle}» برای ما بنویسید…` : 'موضوع را با جزئیات برای ما بنویسید…'} required />
              <small>{formatNumber(newMessage.length)} / ۲۰۰۰</small>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button contact-send" disabled={isSubmitting || subject <= 0 || newMessage.trim().length < 2}>
              {isSubmitting ? <ButtonLoading label="در حال ارسال" /> : <><Icon name="forward" size="sm" /> ارسال پیام</>}
            </button>
          </form>}

          {view === 'thread' && selected && <div className="contact-thread">
            <header className="contact-pane-head">
              <button type="button" className="contact-back" onClick={showInbox} aria-label="بازگشت به گفتگوها"><Icon name="back" size="sm" /></button>
              <span className="contact-conversation-icon" aria-hidden="true"><Icon name={subjectIcon(selected.subjectTitle)} size="md" /></span>
              <div>
                <h2>{selected.subjectTitle}</h2>
                <p><span>{selected.orderNumber ? <>سفارش <bdi dir="ltr">#{selected.orderNumber}</bdi></> : 'گفتگوی عمومی'}</span><span className={`contact-status status-${selected.status}`}>{statusLabels[selected.status]}</span></p>
              </div>
              {selected.status !== SupportConversationStatus.Closed && <button type="button" className="contact-close-thread" onClick={() => void toggleClosed()} disabled={isSubmitting}>بستن گفتگو</button>}
            </header>

            <div className="contact-messages">
              {selected.messages.map((message, index) => {
                const label = dayLabel(message.createdAt)
                const previous = selected.messages[index - 1]
                const showDay = !previous || dayLabel(previous.createdAt) !== label
                const mine = message.senderType === SupportSenderType.Customer
                return <div className="contact-message-row" key={message.id}>
                  {showDay && <span className="contact-day">{label}</span>}
                  <article className={`contact-bubble ${mine ? 'mine' : 'theirs'}`}>
                    {!mine && <strong>{message.senderName || 'پشتیبانی کفگیر'}</strong>}
                    <p>{message.message}</p>
                    <time dateTime={message.createdAt}>{tehranTime.format(new Date(message.createdAt))}{mine && message.readAt && <Icon name="confirm" size="xs" />}</time>
                  </article>
                </div>
              })}
              {selected.status === SupportConversationStatus.AwaitingAdmin && <p className="contact-waiting">پیامتان رسید؛ پاسخ تیم کفگیر همین‌جا نمایش داده می‌شود.</p>}
              <div ref={messagesEnd} />
            </div>

            {error && <p className="form-error" role="alert">{error}</p>}
            {selected.status === SupportConversationStatus.Closed
              ? <div className="contact-closed">
                  <span>این گفتگو بسته شده است.</span>
                  <button type="button" className="outline-button" onClick={() => void toggleClosed()} disabled={isSubmitting}>{isSubmitting ? <ButtonLoading label="در حال ثبت…" /> : 'باز کردن دوباره'}</button>
                </div>
              : <form className="contact-composer" onSubmit={sendReply}>
                  <textarea value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={onReplyKey} maxLength={2000} rows={1}
                    placeholder="پیام خود را بنویسید…" aria-label="پاسخ شما" />
                  <button className="contact-composer-send" disabled={isSubmitting || reply.trim().length < 2} aria-label="ارسال پاسخ">
                    {isSubmitting ? <span className="menu-load-spinner" aria-hidden="true" /> : <Icon name="forward" size="md" />}
                  </button>
                </form>}
          </div>}
        </section>
      </div>
      {view === 'inbox' && error && <p className="form-error" role="alert">{error}</p>}
    </main>
  )
}
