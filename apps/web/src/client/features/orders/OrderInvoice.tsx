import { DeliveryMethod, PaymentMethod, type OrderDto } from '../../types'
import { BrandLogo } from '../../design-system/BrandLogo'
import { Icon } from '../../design-system/Icon'
import { StatusBadge } from '../../design-system/StatusBadge'
import { formatDeliveryWindow, formatMoney, formatNumber, formatPersianDateTime, formatPersianDay } from '../../utils/format'

const deliveryLabels = {
  [DeliveryMethod.Pickup]: 'تحویل حضوری',
  [DeliveryMethod.Delivery]: 'ارسال',
}

const paymentLabels = {
  [PaymentMethod.Cash]: 'نقدی',
  [PaymentMethod.CardToCard]: 'کارت به کارت',
  [PaymentMethod.Online]: 'پرداخت آنلاین',
  [PaymentMethod.Pos]: 'کارت‌خوان',
}

export function OrderInvoice({ order, allowPrint = true }: { order: OrderDto; allowPrint?: boolean }) {
  return <section className="customer-invoice" aria-labelledby={`invoice-title-${order.id}`}>
    <header className="invoice-heading">
      <BrandLogo variant="compact" />
      <div>
        <span>فاکتور سفارش</span>
        <h2 id={`invoice-title-${order.id}`}>شماره <bdi dir="ltr">{formatNumber(order.orderNumber)}</bdi></h2>
      </div>
      <StatusBadge status={order.status} />
    </header>

    <div className="invoice-meta">
      <div><span>زمان ثبت</span><strong>{formatPersianDateTime(order.createdAt)}</strong></div>
      <div><span>نام مشتری</span><strong>{order.customerFullName}</strong></div>
      <div><span>شماره تماس</span><strong><bdi dir="ltr">{order.customerPhoneNumber}</bdi></strong></div>
      <div><span>روش دریافت</span><strong>{deliveryLabels[order.deliveryMethod]}</strong></div>
      {/* Rendered from the order's own snapshot, so later edits to the window never rewrite history.
          Orders placed before delivery windows existed say so instead of showing an invented time. */}
      <div><span>زمان تحویل</span><strong>{order.deliveryDate && order.deliveryStartTime && order.deliveryEndTime
        ? `${formatPersianDay(order.deliveryDate)}، ${formatDeliveryWindow(order.deliveryStartTime, order.deliveryEndTime)}`
        : 'زمان تحویل ثبت نشده'}</strong></div>
      <div><span>روش پرداخت</span><strong>{paymentLabels[order.paymentMethod]}</strong></div>
      {order.addressLine && <div className="invoice-address"><span>آدرس</span><strong>{order.addressLine}</strong></div>}
    </div>

    <div className="invoice-lines-wrap">
      <table className="invoice-lines">
        <thead><tr><th>ردیف</th><th>شرح</th><th>تعداد</th><th>قیمت واحد</th><th>جمع</th></tr></thead>
        <tbody>{order.items.map((item, index) => <tr key={item.id}>
          <td>{formatNumber(index + 1)}</td>
          <td>{item.foodName}</td>
          <td>{formatNumber(item.quantity)}</td>
          <td>{formatMoney(item.unitPrice)}</td>
          <td>{formatMoney(item.totalPrice)}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <div className="invoice-summary">
      <div><span>جمع اقلام</span><strong>{formatMoney(order.subtotalAmount)}</strong></div>
      <div><span>هزینه ارسال</span><strong>{formatMoney(order.deliveryFee)}</strong></div>
      <div className="invoice-grand-total"><span>مبلغ نهایی</span><strong>{formatMoney(order.totalAmount)}</strong></div>
    </div>
    {order.customerNote && <div className="invoice-note"><span>یادداشت مشتری</span><p>{order.customerNote}</p></div>}

    <footer className="invoice-footer">
      <span>کفگیر؛ غذای خانگی با مهر</span>
      <span><bdi dir="ltr">09166450262</bdi> • <bdi dir="ltr">09163442440</bdi></span>
    </footer>
    {allowPrint && <div className="invoice-actions">
      <button type="button" className="outline-button" onClick={() => window.print()}>
        <Icon name="save" size="sm" /> چاپ یا ذخیره فاکتور
      </button>
    </div>}
  </section>
}
