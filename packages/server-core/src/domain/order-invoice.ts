import { DeliveryMethod, PaymentMethod } from '@kafgir/contracts'

export type InvoiceMessageLine = {
  foodName: string
  unitPrice: number
  quantity: number
}

export type InvoiceMessageInput = {
  orderNumber: string
  createdAt: Date
  customerFullName: string
  customerPhoneNumber: string
  addressLine: string | null
  deliveryMethod: DeliveryMethod
  paymentMethod: PaymentMethod
  subtotalAmount: number
  deliveryFee: number
  totalAmount: number
  items: InvoiceMessageLine[]
}

const money = (value: number) => `${value.toLocaleString('en-US')} تومان`
const dateTime = (value: Date) => new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Tehran',
}).format(value).replace(/[\u200e\u200f]/g, '')

const paymentLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.Cash]: 'نقدی',
  [PaymentMethod.Online]: 'پرداخت آنلاین',
  [PaymentMethod.Pos]: 'کارت‌خوان',
}

const deliveryLabels: Record<DeliveryMethod, string> = {
  [DeliveryMethod.Pickup]: 'تحویل حضوری',
  [DeliveryMethod.Delivery]: 'ارسال',
}

export function formatTelegramOrderInvoice(input: InvoiceMessageInput): string {
  const header = [
    '🍽 فاکتور سفارش کفگیر',
    '━━━━━━━━━━━━━━',
    `شماره سفارش: ${input.orderNumber}`,
    `زمان ثبت: ${dateTime(input.createdAt)}`,
    `مشتری: ${input.customerFullName}`,
    `موبایل: ${input.customerPhoneNumber}`,
    `روش دریافت: ${deliveryLabels[input.deliveryMethod]}`,
    `روش پرداخت: ${paymentLabels[input.paymentMethod]}`,
    input.deliveryMethod === DeliveryMethod.Delivery && input.addressLine
      ? `آدرس: ${input.addressLine}`
      : null,
    '',
    'اقلام سفارش:',
  ].filter((line): line is string => line !== null)

  const footer = [
    '━━━━━━━━━━━━━━',
    `جمع اقلام: ${money(input.subtotalAmount)}`,
    `هزینه ارسال: ${money(input.deliveryFee)}`,
    `مبلغ نهایی: ${money(input.totalAmount)}`,
    '',
    'وضعیت: در انتظار تایید',
    'از خرید شما سپاسگزاریم 🌿',
  ]

  const itemLines: string[] = []
  let omitted = 0
  for (const [index, item] of input.items.entries()) {
    const line = `${index + 1}) ${item.foodName}\n   ${item.quantity} × ${money(item.unitPrice)} = ${money(item.unitPrice * item.quantity)}`
    const candidate = [...header, ...itemLines, line, '', ...footer].join('\n')
    if (candidate.length > 3_900) {
      omitted = input.items.length - index
      break
    }
    itemLines.push(line)
  }
  if (omitted > 0) itemLines.push(`… و ${omitted} قلم دیگر`)

  return [...header, ...itemLines, '', ...footer].join('\n').slice(0, 4_000)
}
