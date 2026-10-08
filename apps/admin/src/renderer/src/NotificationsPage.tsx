import { useCallback, useEffect, useState } from 'react'
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  OrderStatus,
  smsNotifiableStatuses,
  type CustomerNotificationSettings,
  type NotificationLogItemDto,
} from '@kafgir/contracts'
import { adminApi } from './api'
import { ListState, Message, PageFrame, useAsyncAction } from './admin-ui'
import { formatNumber, formatPersianDateTime } from './number-format'

const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)

const statusName: Record<number, string> = {
  [OrderStatus.Confirmed]: 'تأیید سفارش',
  [OrderStatus.Preparing]: 'شروع آماده‌سازی',
  [OrderStatus.Ready]: 'آماده تحویل / ارسال',
  [OrderStatus.Delivered]: 'تحویل',
  [OrderStatus.Cancelled]: 'لغو',
}

const typeName: Record<number, string> = {
  [NotificationType.NewOrderForAdmin]: 'سفارش تازه (مدیر)',
  [NotificationType.OrderStatusForCustomer]: 'وضعیت سفارش',
  [NotificationType.OrderInvoiceForCustomer]: 'فاکتور',
}

const deliveryState: Record<number, { label: string; className: string }> = {
  [NotificationStatus.Pending]: { label: 'در صف', className: 'status-1' },
  [NotificationStatus.Sent]: { label: 'ارسال شد', className: 'status-5' },
  [NotificationStatus.Failed]: { label: 'ناموفق', className: 'status-6' },
}

/** SMS are charged per 70-character part of Persian text. */
export const smsParts = (text: string) => Math.max(1, Math.ceil(text.length / 70))

export function NotificationsPage() {
  const [settings, setSettings] = useState<CustomerNotificationSettings | null>(null)
  const [log, setLog] = useState<NotificationLogItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const save = useAsyncAction()

  const load = useCallback(async () => {
    try {
      const [current, recent] = await Promise.all([adminApi.notificationSettings(), adminApi.notifications()])
      setSettings(current)
      setLog(recent)
      setError(null)
    } catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const toggleStatus = (status: OrderStatus) => setSettings((current) => current && {
    ...current,
    smsStatuses: current.smsStatuses.includes(status)
      ? current.smsStatuses.filter((item) => item !== status)
      : [...current.smsStatuses, status],
  })

  const submit = () => {
    if (!settings) return
    void save.run(async () => {
      try {
        setSettings(await adminApi.saveNotificationSettings(settings))
        setNotice('تنظیمات اطلاع‌رسانی ذخیره شد.')
        setError(null)
      } catch (reason) { setError(errorText(reason)) }
    })
  }

  const failed = log.filter((item) => item.status === NotificationStatus.Failed).length
  const smsSent = log.filter((item) => item.channel === NotificationChannel.Sms && item.status === NotificationStatus.Sent)

  return <PageFrame title="اطلاع‌رسانی به مشتری"
    description="مشتریانی که ربات تلگرام کفگیر را دارند پیام تلگرام می‌گیرند. برای بقیه می‌توانید پیامک وضعیت سفارش بفرستید.">
    <Message error={error} />
    {notice && <Message>{notice}</Message>}

    {settings && <section className="panel notification-settings">
      <label className="switch notification-master">
        <input type="checkbox" checked={settings.smsEnabled}
          onChange={(event) => setSettings({ ...settings, smsEnabled: event.target.checked })} />
        ارسال پیامک وضعیت سفارش برای مشتریان بدون تلگرام
      </label>
      <fieldset disabled={!settings.smsEnabled} className="notification-statuses">
        <legend>برای این تغییرها پیامک برود:</legend>
        {smsNotifiableStatuses.map((status) => <label className="switch" key={status}>
          <input type="checkbox" checked={settings.smsStatuses.includes(status)} onChange={() => toggleStatus(status)} />
          {statusName[status]}
        </label>)}
      </fieldset>
      <p className="muted notification-hint">
        هر پیامک یک بخش ۷۰ نویسه‌ای است؛ متن پیامک‌ها کوتاه نوشته شده‌اند. ارسال با سرویس SMS.ir و خط اختصاصی
        (<bdi dir="ltr">SMSIR_LINE_NUMBER</bdi>) انجام می‌شود و پیامک ناموفق چند بار دوباره تلاش می‌شود.
      </p>
      <div className="action-row">
        <button type="button" className="primary" disabled={save.busy} onClick={submit}>{save.busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
      </div>
    </section>}

    <section className="panel table-panel">
      <div className="table-panel-head">
        <h2>پیام‌های اخیر</h2>
        <span>{formatNumber(smsSent.length)} پیامک ارسال‌شده ({formatNumber(smsSent.reduce((sum, item) => sum + smsParts(item.text), 0))} بخش)
          {failed > 0 && <> · <strong className="notification-failed">{formatNumber(failed)} ناموفق</strong></>}</span>
        <button type="button" onClick={() => void load()}>تازه‌سازی</button>
      </div>
      <ListState loading={loading} error={null} isEmpty={!loading && log.length === 0} emptyText="هنوز پیامی ثبت نشده است." />
      {log.length > 0 && <div className="table-wrap"><table className="notification-table">
        <thead><tr><th>زمان</th><th>کانال</th><th>گیرنده</th><th>نوع</th><th>سفارش</th><th>متن</th><th>وضعیت</th></tr></thead>
        <tbody>{log.map((item) => <tr key={item.id}>
          <td>{formatPersianDateTime(item.createdAt)}</td>
          <td>{item.channel === NotificationChannel.Sms ? 'پیامک' : 'تلگرام'}</td>
          <td><bdi dir="ltr">{item.target}</bdi></td>
          <td>{typeName[item.type] ?? item.type}</td>
          <td><bdi dir="ltr">{item.orderNumber ?? '—'}</bdi></td>
          <td className="text-cell notification-text" title={item.text}>{item.text.split('\n')[0]}</td>
          <td><span className={`badge ${deliveryState[item.status]?.className ?? ''}`}
            title={item.lastError ?? undefined}>{deliveryState[item.status]?.label ?? item.status}</span>
            {item.retryCount > 0 && item.status !== NotificationStatus.Sent && <small> ({formatNumber(item.retryCount)} تلاش)</small>}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </PageFrame>
}
