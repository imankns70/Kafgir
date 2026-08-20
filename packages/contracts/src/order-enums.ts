export enum PaymentMethod {
  Cash = 1,
  CardToCard = 2,
  Online = 3,
  Pos = 4,
}

export enum DeliveryMethod {
  Pickup = 1,
  Delivery = 2,
}

export enum OrderStatus {
  PendingConfirmation = 1,
  Confirmed = 2,
  Preparing = 3,
  Ready = 4,
  Delivered = 5,
  Cancelled = 6,
}

export enum NotificationChannel {
  Telegram = 1,
}

export enum NotificationType {
  NewOrderForAdmin = 1,
  OrderStatusForCustomer = 2,
  OrderInvoiceForCustomer = 3,
}

export enum NotificationStatus {
  Pending = 1,
  Sent = 2,
  Failed = 3,
}

/**
 * The life of a payment attached to an order. Customer-facing: the order detail shows this back to
 * the person who paid, so it is part of the ordering vocabulary rather than of any accounting system.
 */
export enum PaymentStatus {
  Pending = 1,
  AwaitingVerification = 2,
  Paid = 3,
  Failed = 4,
  Rejected = 5,
  Cancelled = 6,
  Refunded = 7,
}
