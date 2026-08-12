import { OrderStatus } from '../types'
import { Icon, type IconName } from './Icon'

const presentation: Record<OrderStatus, { label: string; tone: string; icon: IconName }> = {
  [OrderStatus.PendingConfirmation]: { label: 'در انتظار تأیید', tone: 'warning', icon: 'clock' },
  [OrderStatus.Confirmed]: { label: 'تأیید شده', tone: 'primary', icon: 'confirm' },
  [OrderStatus.Preparing]: { label: 'در حال آماده‌سازی', tone: 'accent', icon: 'kitchen' },
  [OrderStatus.Ready]: { label: 'آماده تحویل', tone: 'info', icon: 'packaging' },
  [OrderStatus.Delivered]: { label: 'تحویل شده', tone: 'success', icon: 'delivery' },
  [OrderStatus.Cancelled]: { label: 'لغو شده', tone: 'error', icon: 'cancel' },
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const item = presentation[status]
  return <span className={`status-badge status-${item.tone}`}><Icon name={item.icon} size="xs" /><span>{item.label}</span></span>
}
