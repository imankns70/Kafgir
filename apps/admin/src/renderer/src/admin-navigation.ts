import type { AdminOperation } from '../../shared/admin-operations'
import { isAdminOperationAllowed } from '../../shared/admin-permissions'

export type Page = 'dashboard' | 'orders' | 'manual' | 'foods' | 'food-editor' | 'food-photos' | 'food-tags'
  | 'categories' | 'tags' | 'menu' | 'report' | 'purchases' | 'months' | 'payments'
  | 'delivery-slots' | 'delivery-days' | 'logs'
  | 'social-dashboard' | 'social-channels' | 'social-publish' | 'social-templates'
  | 'social-rules' | 'social-suggestions' | 'social-history' | 'customer-communication'
  | 'food-tag-groups' | 'support-subjects'
  | 'payment-methods' | 'delivery-methods' | 'customer-report' | 'customers' | 'site-analytics'
  | 'couriers' | 'courier-days' | 'courier-accounting'

export type NavigationGroupId =
  'sales' | 'catalog' | 'finance' | 'social' | 'reference' | 'settings'

/** Keys into the sidebar icon set. One per group, so the collapsed rail stays navigable. */
export type NavigationIcon =
  'sales' | 'catalog' | 'finance' | 'social' | 'reference' | 'settings'

export interface NavigationItem {
  page: Page
  label: string
  /**
   * The operation this destination cannot work without. The sidebar hides items the signed-in roles
   * may not perform, so a menu entry never leads to a permission error.
   */
  operation: AdminOperation
}

export interface NavigationGroup {
  id: NavigationGroupId
  label: string
  icon: NavigationIcon
  /** One line explaining what belongs in the group. Shown as the header tooltip. */
  hint: string
  items: NavigationItem[]
}

/**
 * Kafgir's admin information architecture.
 *
 * Groups follow the business, not the schema. The organising question for every destination is "what
 * is the operator doing?", and the sharpest line runs between records that change during a working
 * day and lists that are configured once and then referenced:
 *
 * - `sales` is the working day: today's menu, the capacity behind it, the orders it produces, and the
 *   customer conversations attached to those orders. Website-visitor statistics live at the end of
 *   this group rather than on the dashboard: they describe the same audience, but nothing about them
 *   needs acting on before lunch.
 * - `catalog` is what the kitchen can sell, independent of any one day.
 * - `finance` is money: what was bought, how each month compares, what customers paid, and what the
 *   couriers are owed. Four destinations, not a subsystem — Kafgir does not run an accounting
 *   system, and the screens that implied it did are gone.
 * - `social` is outbound publishing.
 * - `reference` is master data: lookup lists other records point at. Every entry here is a title,
 *   an order and an active flag, edited rarely, and referenced by a foreign key somewhere.
 * - `settings` configures how the system behaves, plus operational visibility.
 *
 * Payment and delivery methods are deliberately NOT reference data: their membership is fixed by an
 * enum (an operator cannot invent a payment method), and what they carry — channel availability,
 * delivery fee, minimum order value — is commercial configuration of checkout. See
 * `.ai/docs/reference-data.md`.
 */
export const navigationGroups: NavigationGroup[] = [
  {
    id: 'sales',
    label: 'فروش و مشتریان',
    icon: 'sales',
    hint: 'کارهای هر روز: منو، ظرفیت، سفارش‌ها و گفتگو با مشتری',
    items: [
      { page: 'menu', label: 'منوی امروز', operation: 'menus.get' },
      { page: 'delivery-days', label: 'ظرفیت ارسال روزانه', operation: 'deliveryDays.get' },
      { page: 'courier-days', label: 'پیک و هزینه ارسال روزانه', operation: 'courierDays.get' },
      { page: 'orders', label: 'سفارش‌ها', operation: 'orders.search' },
      { page: 'manual', label: 'سفارش دستی', operation: 'orders.create' },
      { page: 'customers', label: 'مشتریان', operation: 'customers.search' },
      { page: 'customer-communication', label: 'پشتیبانی و نظرها', operation: 'support.conversations.list' },
      { page: 'report', label: 'گزارش سفارش‌ها', operation: 'orders.search' },
      { page: 'customer-report', label: 'گزارش مشتریان', operation: 'reports.customers' },
      { page: 'site-analytics', label: 'آمار کاربران سایت', operation: 'dashboard.analytics' },
    ],
  },
  {
    id: 'catalog',
    label: 'کاتالوگ غذا',
    icon: 'catalog',
    hint: 'غذاهایی که می‌توان فروخت',
    items: [
      { page: 'foods', label: 'غذاها', operation: 'foods.list' },
    ],
  },
  {
    id: 'finance',
    label: 'مالی',
    icon: 'finance',
    hint: 'خریدها، وضعیت هر ماه، پرداخت مشتری و حساب پیک‌ها',
    items: [
      { page: 'purchases', label: 'خریدها', operation: 'purchases.month' },
      { page: 'months', label: 'ماه‌ها', operation: 'months.list' },
      { page: 'payments', label: 'پرداخت‌های سفارش', operation: 'payments.list' },
      { page: 'courier-accounting', label: 'کارکرد و تسویه پیک‌ها', operation: 'courierAccounting.summary' },
    ],
  },
  {
    id: 'social',
    label: 'شبکه‌های اجتماعی',
    icon: 'social',
    hint: 'انتشار محتوا در کانال‌های بیرونی',
    items: [
      { page: 'social-dashboard', label: 'داشبورد انتشار', operation: 'social.dashboard' },
      { page: 'social-channels', label: 'کانال‌ها', operation: 'social.channels.list' },
      { page: 'social-publish', label: 'انتشار جدید', operation: 'social.posts.create' },
      { page: 'social-templates', label: 'قالب‌های پیام', operation: 'social.templates.list' },
      { page: 'social-rules', label: 'قوانین خودکارسازی', operation: 'social.rules.list' },
      { page: 'social-suggestions', label: 'پیشنهادهای انتشار', operation: 'social.suggestions.list' },
      { page: 'social-history', label: 'تاریخچه ارسال', operation: 'social.history' },
    ],
  },
  {
    id: 'reference',
    label: 'اطلاعات پایه',
    icon: 'reference',
    hint: 'فهرست‌های پایه‌ای که رکوردهای دیگر به آن‌ها ارجاع می‌دهند',
    items: [
      { page: 'categories', label: 'دسته‌بندی غذا', operation: 'foodCategories.list' },
      { page: 'tags', label: 'برچسب‌های غذا', operation: 'foodTags.list' },
      { page: 'food-tag-groups', label: 'گروه‌های برچسب', operation: 'foodTagGroups.list' },
      { page: 'delivery-slots', label: 'بازه‌های ارسال', operation: 'deliverySlots.list' },
      { page: 'couriers', label: 'پیک‌ها', operation: 'couriers.list' },
      { page: 'support-subjects', label: 'موضوعات پشتیبانی', operation: 'supportSubjects.list' },
    ],
  },
  {
    id: 'settings',
    label: 'تنظیمات',
    icon: 'settings',
    hint: 'پیکربندی سفارش‌گیری و سلامت سامانه',
    items: [
      { page: 'payment-methods', label: 'روش‌های پرداخت', operation: 'paymentMethods.list' },
      { page: 'delivery-methods', label: 'روش‌های دریافت', operation: 'deliveryMethods.list' },
      { page: 'logs', label: 'گزارش رویدادها', operation: 'logs.server' },
    ],
  },
]

/** Detail screens reached from a list keep their parent highlighted in the sidebar. */
export const navigationPage = (page: Page): Page =>
  ['food-editor', 'food-photos', 'food-tags'].includes(page) ? 'foods' : page

export const navigationGroupForPage = (page: Page): NavigationGroupId | null => {
  const visiblePage = navigationPage(page)
  return navigationGroups.find((group) => group.items.some((item) => item.page === visiblePage))?.id ?? null
}

export const toggleNavigationGroup = (
  currentGroup: NavigationGroupId | null,
  selectedGroup: NavigationGroupId,
): NavigationGroupId | null => currentGroup === selectedGroup ? null : selectedGroup

/**
 * The sidebar as the signed-in roles may actually use it. Groups left with no permitted item are
 * dropped entirely, so an operator is never shown a heading that opens onto nothing.
 */
export function visibleNavigationGroups(roles: readonly string[]): NavigationGroup[] {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isAdminOperationAllowed(item.operation, roles)),
    }))
    .filter((group) => group.items.length > 0)
}

/** The first destination the given roles may open, used when the current page becomes unreachable. */
export function firstAllowedPage(roles: readonly string[]): Page | null {
  return visibleNavigationGroups(roles)[0]?.items[0]?.page ?? null
}

export function isPageAllowed(page: Page, roles: readonly string[]): boolean {
  if (page === 'dashboard') return true
  const visiblePage = navigationPage(page)
  return navigationGroups.some((group) =>
    group.items.some((item) => item.page === visiblePage && isAdminOperationAllowed(item.operation, roles)))
}
