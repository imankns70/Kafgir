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
