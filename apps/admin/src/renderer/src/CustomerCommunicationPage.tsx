import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  OrderReviewHandlingStatus,
  SupportConversationStatus,
  SupportSenderType,
  type AdminOrderReviewDto,
  type AdminSupportConversationDto,
  type AdminSupportConversationSummaryDto,
} from '@kafgir/contracts'
import { adminApi } from './api'
import { useAsyncAction } from './admin-ui'
import { formatPersianDateTime } from './number-format'

const conversationStatusLabels: Record<SupportConversationStatus, string> = {
  [SupportConversationStatus.AwaitingAdmin]: 'منتظر پاسخ مدیریت',
  [SupportConversationStatus.AwaitingCustomer]: 'منتظر پاسخ مشتری',
  [SupportConversationStatus.Closed]: 'بسته‌شده',
}
const reviewStatusLabels: Record<OrderReviewHandlingStatus, string> = {
  [OrderReviewHandlingStatus.New]: 'جدید',
  [OrderReviewHandlingStatus.Seen]: 'بررسی‌شده',
  [OrderReviewHandlingStatus.Resolved]: 'رسیدگی‌شده',
}
export function CustomerCommunicationPage() {
  const [tab, setTab] = useState<'chat' | 'reviews'>('chat')
  const [conversations, setConversations] = useState<AdminSupportConversationSummaryDto[]>([])
  const [reviews, setReviews] = useState<AdminOrderReviewDto[]>([])
  const [selected, setSelected] = useState<AdminSupportConversationDto | null>(null)
  const [reply, setReply] = useState('')
  const [reviewReplyId, setReviewReplyId] = useState<number | null>(null)
  const [reviewReply, setReviewReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const openAction = useAsyncAction()
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [chatItems, reviewItems] = await Promise.all([adminApi.supportConversations(), adminApi.orderReviews()])
      setConversations(chatItems); setReviews(reviewItems)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'دریافت ارتباطات مشتریان ممکن نشد.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  // The opening row is tracked by id so it can show its own pending state; `loading` alone only
  // drives the inbox placeholder, which is already replaced by the list once conversations exist.
  const openConversation = (id: number) => {
    setOpeningId(id); setError('')
    void openAction.run(async () => {
      try {
        const detail = await adminApi.supportConversation(id)
        setSelected(detail)
        setConversations((items) => items.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'باز کردن گفتگو ممکن نشد.')
      } finally { setOpeningId(null) }
    })
  }

  const sendReply = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    setSubmitting(true); setError('')
    try {
      setSelected(await adminApi.replySupportConversation(selected.id, reply))
      setReply(''); await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ارسال پاسخ ممکن نشد.')
    } finally { setSubmitting(false) }
  }

  const toggleClosed = async () => {
    if (!selected) return
    setSubmitting(true); setError('')
    try {
      setSelected(await adminApi.setSupportConversationClosed(selected.id, selected.status !== SupportConversationStatus.Closed))
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تغییر وضعیت گفتگو ممکن نشد.')
    } finally { setSubmitting(false) }
  }

  const updateReviewStatus = async (id: number, status: OrderReviewHandlingStatus) => {
    setSubmitting(true); setError('')
    try { await adminApi.setOrderReviewStatus(id, status); await load() }
    catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'ثبت وضعیت نظر ممکن نشد.') }
    finally { setSubmitting(false) }
  }

  const answerReview = async (event: FormEvent, id: number) => {
    event.preventDefault(); setSubmitting(true); setError('')
    try {
      const detail = await adminApi.replyToOrderReview(id, reviewReply)
      setReviewReply(''); setReviewReplyId(null); setSelected(detail); setTab('chat'); await load()
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'پاسخ به نظر ممکن نشد.') }
    finally { setSubmitting(false) }
  }

  return <section className="page customer-communication-page">
    <header className="page-header">
      <div><h1>ارتباط با مشتری</h1><p className="communication-lead">گفتگوها و نظرها خصوصی‌اند و در وب عمومی نمایش داده نمی‌شوند.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "در حال دریافت…" : "بروزرسانی"}</button>
    </header>
    <div className="communication-tabs" role="tablist" aria-label="نوع ارتباط">
      <button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>گفتگوها {conversations.some((item) => item.unreadCount > 0) && <b>{conversations.reduce((sum, item) => sum + item.unreadCount, 0)}</b>}</button>
      <button className={tab === 'reviews' ? 'active' : ''} onClick={() => setTab('reviews')}>نظرهای سفارش</button>
    </div>
    {error && <p className="message error" role="alert">{error}</p>}

    {tab === 'chat' && <div className="communication-grid">
      <section className="panel communication-inbox">
        <h2>صندوق گفتگوها</h2>
        {loading && conversations.length === 0 ? <p className="communication-empty">در حال دریافت…</p> : conversations.length === 0 ? <p className="communication-empty">هنوز پیامی ثبت نشده است.</p> : <div className="communication-list">
          {conversations.map((item) => <button className={`${selected?.id === item.id ? "active" : ""}${openingId === item.id ? " opening" : ""}`} disabled={openAction.busy} onClick={() => openConversation(item.id)} key={item.id}>
            <span><strong>{item.customerName}</strong>{item.unreadCount > 0 && <b>{item.unreadCount}</b>}</span>
            <em>{item.subjectTitle}{item.orderNumber ? ` · سفارش #${item.orderNumber}` : ''}</em>
            <small>{item.lastMessage}</small>
            <time>{conversationStatusLabels[item.status]} · {formatPersianDateTime(item.lastMessageAt)}</time>
          </button>)}
        </div>}
      </section>
      <section className="panel communication-thread">
        {!selected ? <p className="communication-empty">برای مشاهده پیام‌ها یک گفتگو را انتخاب کنید.</p> : <>
          <header><div><h2>{selected.customerName}</h2><bdi dir="ltr">{selected.customerPhoneNumber}</bdi><p>{selected.subjectTitle}{selected.orderNumber ? ` · سفارش #${selected.orderNumber}` : ''}</p></div><span className={`communication-status status-${selected.status}`}>{conversationStatusLabels[selected.status]}</span></header>
          <div className="communication-messages">
            {selected.messages.map((message) => <article className={message.senderType === SupportSenderType.Admin ? 'mine' : 'customer'} key={message.id}>
              <strong>{message.senderType === SupportSenderType.Admin ? 'مدیریت' : message.senderName}</strong><p>{message.message}</p><time>{formatPersianDateTime(message.createdAt)}</time>
            </article>)}
          </div>
          {selected.status === SupportConversationStatus.Closed ? <button onClick={() => void toggleClosed()} disabled={submitting}>{submitting ? "در حال تغییر…" : "باز کردن دوباره گفتگو"}</button> : <form onSubmit={sendReply} className="communication-reply">
            <label>پاسخ<textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={2000} required /></label>
            <div><button className="primary" disabled={submitting || reply.trim().length < 2}>{submitting ? "در حال ارسال…" : "ارسال پاسخ"}</button><button type="button" onClick={() => void toggleClosed()} disabled={submitting}>{submitting ? "در حال تغییر…" : "بستن گفتگو"}</button></div>
          </form>}
        </>}
      </section>
    </div>}

    {tab === 'reviews' && <section className="communication-review-list">
      {loading && reviews.length === 0 ? <p className="panel communication-empty">در حال دریافت…</p> : reviews.length === 0 ? <p className="panel communication-empty">هنوز نظری ثبت نشده است.</p> : reviews.map((review) => <article className="panel communication-review" key={review.id}>
        <header><div><h2>{review.customerName}</h2><bdi dir="ltr">{review.customerPhoneNumber}</bdi></div><span className={`review-status review-status-${review.handlingStatus}`}>{reviewStatusLabels[review.handlingStatus]}</span></header>
        <div className="review-meta"><span>سفارش #{review.orderNumber}</span><span className="review-stars" aria-label={`${review.rating} از ۵`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><time>{formatPersianDateTime(review.updatedAt ?? review.createdAt)}</time></div>
        <p>{review.comment || 'مشتری فقط امتیاز ثبت کرده است.'}</p>
        <div className="review-actions">
          {review.handlingStatus === OrderReviewHandlingStatus.New && <button onClick={() => void updateReviewStatus(review.id, OrderReviewHandlingStatus.Seen)} disabled={submitting}>{submitting ? "در حال ثبت…" : "بررسی شد"}</button>}
          {review.handlingStatus !== OrderReviewHandlingStatus.Resolved && <button onClick={() => void updateReviewStatus(review.id, OrderReviewHandlingStatus.Resolved)} disabled={submitting}>{submitting ? "در حال ثبت…" : "رسیدگی شد"}</button>}
          {review.conversationId && <button onClick={() => { setTab('chat'); void openConversation(review.conversationId!) }}>مشاهده گفتگو</button>}
          <button className="primary" onClick={() => setReviewReplyId(reviewReplyId === review.id ? null : review.id)}>پاسخ خصوصی</button>
        </div>
        {reviewReplyId === review.id && <form className="review-reply-form" onSubmit={(event) => void answerReview(event, review.id)}>
          <label>پیام خصوصی به مشتری<textarea value={reviewReply} onChange={(event) => setReviewReply(event.target.value)} maxLength={2000} required /></label>
          <button className="primary" disabled={submitting || reviewReply.trim().length < 2}>{submitting ? "در حال ارسال…" : "ارسال و ایجاد گفتگو"}</button>
        </form>}
      </article>)}
    </section>}
  </section>
}
