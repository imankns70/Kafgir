export {
  DeliveryMethod,
  OrderReviewHandlingStatus,
  OrderStatus,
  PaymentMethod,
  SupportConversationStatus,
  SupportSenderType,
} from '@kafgir/contracts'
import type { CartItem as ContractCartItem } from '@kafgir/contracts'

export type CartAvailability = 'available' | 'sold-out' | 'unavailable' | 'menu-closed' | 'not-on-menu'
export type CartItem = ContractCartItem & {
  /**
   * The Tehran business date this line belongs to. Cart contents must never roll over into the next
   * day's menu, even when the same food appears again with a new daily-menu row.
   */
  menuDate?: string | null
  availability?: CartAvailability
  availabilityMessage?: string | null
}

export type {
  CreateOrderRequest,
  CustomerAddressDto,
  CustomerAddressWriteRequest,
  CustomerOrderDetailDto,
  CustomerOrderSummaryDto,
  CustomerOrdersPageDto,
  CustomerProfileDto,
  CustomerProfileLookupRequest,
  CustomerSessionDto,
  CustomerSupportConversationCreateRequest,
  CustomerSupportConversationDto,
  DailyMenuDto,
  DailyMenuItemDto,
  MenuCartSnapshotDto,
  OrderDto,
  OrderReviewDto,
  PendingOrderReviewDto,
  OrderReviewWriteRequest,
  OrderSummaryDto,
  DeliveryPricingDto,
  PublicDailyMenuPageDto,
  PublicOrderOptionsDto,
  PersianRiceDto,
  SupportConversationSummaryDto,
  SupportMessageWriteRequest,
  SupportSubjectDto,
} from '@kafgir/contracts'
