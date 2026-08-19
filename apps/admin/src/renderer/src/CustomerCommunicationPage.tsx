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
import {
  AdminControls, DateField, Pager, RowNumberCell, RowNumberHead, useAsyncAction, useServerPagedGrid,
} from './admin-ui'
import { formatPersianDateTime } from './number-format'

/** Server-side filters for the review grid; every one narrows the total, not just the page. */
type ReviewFilters = {
  search?: string | null
  status: OrderReviewHandlingStatus | null
  rating: number | null
  from: string | null
  to: string | null
}

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
  // Reviews page in the database; the grid holds only the page being shown.
  const pagedReviews = useServerPagedGrid<AdminOrderReviewDto, ReviewFilters>(
    ({ page, pageSize, search, status, rating, from, to }) =>
      adminApi.orderReviews({ status, rating, from, to, search }, { page, pageSize }),
    { status: null, rating: null, from: null, to: null },
  )
  const reviews = pagedReviews.items
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
      const [chatItems] = await Promise.all([adminApi.supportConversations(), pagedReviews.refresh()])
      setConversations(chatItems)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'دریافت ارتباطات مشتریان ممکن نشد.')
    } finally { setLoading(false) }
  }, [pagedReviews.refresh])

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

    {tab === 'reviews' && <>
    <AdminControls>
      <div className="toolbar">
        <label>جست‌وجو<input type="search" value={pagedReviews.search}
          onChange={(event) => pagedReviews.setSearch(event.target.value)}
          placeholder="شماره سفارش، نام یا موبایل مشتری" /></label>
        <label>امتیاز<select value={pagedReviews.filters.rating ?? ''}
          onChange={(event) => pagedReviews.setFilters({ rating: event.target.value ? Number(event.target.value) : null })}>
          <option value="">همه امتیازها</option>
          {[1, 2, 3, 4, 5].map((star) => <option key={star} value={star}>{star} ستاره</option>)}
        </select></label>
        <label>وضعیت رسیدگی<select value={pagedReviews.filters.status ?? ''}
          onChange={(event) => pagedReviews.setFilters({ status: event.target.value ? Number(event.target.value) as OrderReviewHandlingStatus : null })}>
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(reviewStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <DateField label="از" allowClear value={pagedReviews.filters.from ?? ''}
          onChange={(value) => pagedReviews.setFilters({ from: value || null })} />
        <DateField label="تا" allowClear value={pagedReviews.filters.to ?? ''}
          onChange={(value) => pagedReviews.setFilters({ to: value || null })} />
        <button type="button" onClick={() => pagedReviews.resetFilters()}>پاک کردن</button>
      </div>
    </AdminControls>
    <section className="panel table-wrap">
      <table><thead><tr>
        <RowNumberHead /><th>سفارش</th><th>مشتری</th><th>امتیاز</th><th>نظر</th>
        <th>زمان ثبت</th><th>وضعیت رسیدگی</th><th>عملیات</th>
      </tr></thead>
      <tbody>{reviews.map((review, index) => <tr key={review.id}>
        <RowNumberCell offset={pagedReviews.rowOffset} index={index} />
        <td><bdi dir="ltr">#{review.orderNumber}</bdi></td>
        <td>{review.customerName}<br /><bdi dir="ltr">{review.customerPhoneNumber}</bdi></td>
        <td><span className="review-stars" aria-label={`${review.rating} از ۵`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></td>
        <td className="review-comment-cell">{review.comment || '—'}</td>
        <td>{formatPersianDateTime(review.createdAt)}</td>
        <td><span className={`review-status review-status-${review.handlingStatus}`}>{reviewStatusLabels[review.handlingStatus]}</span></td>
        <td className="actions">
          {review.handlingStatus === OrderReviewHandlingStatus.New && <button disabled={submitting} onClick={() => void updateReviewStatus(review.id, OrderReviewHandlingStatus.Seen)}>بررسی شد</button>}
          {review.handlingStatus !== OrderReviewHandlingStatus.Resolved && <button disabled={submitting} onClick={() => void updateReviewStatus(review.id, OrderReviewHandlingStatus.Resolved)}>رسیدگی شد</button>}
          {review.conversationId && <button onClick={() => { setTab('chat'); void openConversation(review.conversationId!) }}>گفتگو</button>}
          <button className="primary" onClick={() => setReviewReplyId(reviewReplyId === review.id ? null : review.id)}>پاسخ خصوصی</button>
        </td>
      </tr>)}</tbody></table>
      {reviews.length === 0 && <p className="communication-empty">{
        pagedReviews.loading ? 'در حال دریافت…'
          : pagedReviews.filtered ? 'نظری با این فیلترها پیدا نشد.'
            : 'هنوز نظری ثبت نشده است.'
      }</p>}
    </section>
    <Pager {...pagedReviews} />
    {reviewReplyId !== null && <form className="panel review-reply-form" onSubmit={(event) => void answerReview(event, reviewReplyId)}>
      <label>پیام خصوصی به مشتری<textarea value={reviewReply} onChange={(event) => setReviewReply(event.target.value)} maxLength={2000} required /></label>
      <div className="actions">
        <button className="primary" disabled={submitting || reviewReply.trim().length < 2}>{submitting ? 'در حال ارسال…' : 'ارسال و ایجاد گفتگو'}</button>
        <button type="button" onClick={() => { setReviewReplyId(null); setReviewReply('') }}>انصراف</button>
      </div>
    </form>}
    </>}
  </section>
}
