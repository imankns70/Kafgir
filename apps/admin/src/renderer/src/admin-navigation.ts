export type Page = 'dashboard' | 'orders' | 'manual' | 'foods' | 'food-editor' | 'food-photos' | 'food-tags'
  | 'categories' | 'tags' | 'menu' | 'report' | 'ingredients' | 'inventory' | 'purchases'
  | 'suppliers' | 'recipes' | 'finance' | 'shopping' | 'payments' | 'v15-reports' | 'delivery-slots' | 'delivery-days' | 'logs'
  | 'social-dashboard' | 'social-channels' | 'social-publish' | 'social-templates'
  | 'social-rules' | 'social-suggestions' | 'social-history' | 'customer-communication'

export type NavigationGroupId = 'orders' | 'products' | 'kitchen' | 'finance' | 'social' | 'system'

export interface NavigationGroup {
  id: NavigationGroupId
  label: string
  items: Array<{ page: Page; label: string }>
}

export const navigationGroups: NavigationGroup[] = [
  {
    id: 'orders',
    label: 'سفارش‌ها',
    items: [
      { page: 'orders', label: 'سفارش‌ها' },
      { page: 'manual', label: 'سفارش دستی' },
      { page: 'customer-communication', label: 'ارتباط با مشتری' },
      { page: 'menu', label: 'منوی امروز' },
      { page: 'report', label: 'گزارش کل' },
    ],
  },
  {
    id: 'products',
    label: 'محصولات',
    items: [
      { page: 'foods', label: 'غذاها' },
      { page: 'categories', label: 'دسته‌بندی‌ها' },
      { page: 'tags', label: 'برچسب‌ها' },
      { page: 'recipes', label: 'دستور پخت' },
    ],
  },
  {
    id: 'kitchen',
    label: 'آشپزخانه و انبار',
    items: [
      { page: 'ingredients', label: 'مواد اولیه' },
      { page: 'inventory', label: 'انبار' },
      { page: 'purchases', label: 'خریدها' },
      { page: 'suppliers', label: 'تأمین‌کنندگان' },
      { page: 'shopping', label: 'لیست خرید' },
    ],
  },
  {
    id: 'finance',
    label: 'مالی',
    items: [
      { page: 'finance', label: 'مدیریت مالی' },
      { page: 'payments', label: 'پرداخت‌ها' },
      { page: 'v15-reports', label: 'گزارش‌های مالی' },
    ],
  },
  {
    id: 'social',
    label: 'شبکه‌های اجتماعی',
    items: [
      { page: 'social-dashboard', label: 'داشبورد انتشار' },
      { page: 'social-channels', label: 'کانال‌ها' },
      { page: 'social-publish', label: 'انتشار جدید' },
      { page: 'social-templates', label: 'قالب‌های پیام' },
      { page: 'social-rules', label: 'قوانین خودکارسازی' },
      { page: 'social-suggestions', label: 'پیشنهادهای انتشار' },
      { page: 'social-history', label: 'تاریخچه ارسال' },
    ],
  },
  {
    id: 'system',
    label: 'سیستم',
    items: [
      { page: 'delivery-slots', label: 'بازه‌های ارسال' },
      { page: 'delivery-days', label: 'ظرفیت ارسال روزانه' },
      { page: 'logs', label: 'گزارش رویدادها' },
    ],
  },
]

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
