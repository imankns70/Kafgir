export type Page = 'dashboard' | 'orders' | 'manual' | 'foods' | 'food-editor' | 'food-photos' | 'food-tags'
  | 'categories' | 'tags' | 'menu' | 'report' | 'ingredients' | 'inventory' | 'purchases'
  | 'suppliers' | 'recipes' | 'finance' | 'shopping' | 'payments' | 'v15-reports' | 'logs'

export type NavigationGroupId = 'orders' | 'products' | 'kitchen' | 'finance' | 'system'

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
    id: 'system',
    label: 'سیستم',
    items: [{ page: 'logs', label: 'گزارش رویدادها' }],
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
