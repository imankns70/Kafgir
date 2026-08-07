export {
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
} from '@kafgir/contracts'
import type { CartItem as ContractCartItem } from '@kafgir/contracts'

export type CartAvailability = 'available' | 'sold-out' | 'unavailable' | 'menu-closed' | 'not-on-menu'
export type CartItem = ContractCartItem & {
  availability?: CartAvailability
  availabilityMessage?: string | null
}

export type {
  CreateOrderRequest,
  CustomerAddressDto,
  CustomerAddressWriteRequest,
  CustomerOrdersPageDto,
  CustomerProfileDto,
  CustomerProfileLookupRequest,
  CustomerSessionDto,
  DailyMenuDto,
  DailyMenuItemDto,
  MenuCartSnapshotDto,
  OrderDto,
  OrderSummaryDto,
  PublicDailyMenuPageDto,
  PersianRiceDto,
} from '@kafgir/contracts'
