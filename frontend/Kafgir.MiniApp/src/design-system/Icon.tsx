import type { SVGProps } from 'react'

export type IconName =
  | 'home' | 'food' | 'menu' | 'categories' | 'orders' | 'cart' | 'favorite' | 'profile'
  | 'search' | 'notification' | 'location' | 'calendar' | 'clock' | 'kitchen' | 'homeCook'
  | 'freshIngredients' | 'healthyFood' | 'packaging' | 'delivery' | 'discount' | 'rating'
  | 'customerSatisfaction' | 'support' | 'hygiene' | 'add' | 'edit' | 'delete' | 'save'
  | 'confirm' | 'cancel' | 'back' | 'forward' | 'filter' | 'sort' | 'more' | 'settings'
  | 'logout' | 'refresh' | 'minus' | 'info'

const paths: Record<IconName, string> = {
  home: 'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7',
  food: 'M5 11a7 7 0 0 1 14 0M3 11h18M6 15h12M9 4V2m6 2V2',
  menu: 'M4 6h16M4 12h16M4 18h16',
  categories: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  orders: 'M6 3h12l2 3v15H4V6zM4 7h16M8 11h8M8 15h8',
  cart: 'M3 4h2l2 11h11l3-8H6m3 13h.01M18 20h.01',
  favorite: 'M12 20S4 15 4 9a4 4 0 0 1 7-2l1 1 1-1a4 4 0 0 1 7 2c0 6-8 11-8 11Z',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm5 11.5L21 21',
  notification: 'M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9Zm4 11h4',
  location: 'M12 22s7-6 7-13a7 7 0 1 0-14 0c0 7 7 13 7 13Zm0-10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM7 2v4m10-4v4M3 9h18',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l4 2',
  kitchen: 'M5 9h14v10H5zM8 9V6h8v3M3 12h2m14 0h2M8 19v2m8-2v2',
  homeCook: 'M3 11 12 3l9 8M6 10v11h12V10M9 15h6m-3-3v6',
  freshIngredients: 'M20 4C11 4 6 9 6 17c8 0 13-5 14-13ZM5 20c3-7 7-10 13-13',
  healthyFood: 'M12 21s-8-5-8-11a4 4 0 0 1 7-2l1 1 1-1a4 4 0 0 1 7 2c0 6-7 11-7 11Zm0-8v4m-2-2h4',
  packaging: 'm4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7m-8 4v10',
  delivery: 'M3 6h11v11H3zM14 10h4l3 4v3h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  discount: 'm4 4 9 1 7 7-8 8-7-7-1-9Zm5 5h.01m6 6h.01M9 15l6-6',
  rating: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.5-2.9-5.5 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z',
  customerSatisfaction: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM8 10h.01M16 10h.01M8 15c2.5 2 5.5 2 8 0',
  support: 'M4 13v-2a8 8 0 0 1 16 0v2M4 13v5h4v-6H4m16 1v5h-4v-6h4m0 6c0 2-2 3-5 3',
  hygiene: 'm12 3 7 3v5c0 5-3 9-7 11-4-2-7-6-7-11V6l7-3Zm-3 9 2 2 4-5',
  add: 'M12 5v14M5 12h14',
  edit: 'm4 20 4-1L19 8l-3-3L5 16l-1 4Zm10-13 3 3',
  delete: 'M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14m-7 4v6m4-6v6',
  save: 'M5 3h12l4 4v14H3V3h2Zm2 0v6h9V3M7 21v-7h10v7',
  confirm: 'm4 12 5 5L20 6',
  cancel: 'M5 5l14 14M19 5 5 19',
  back: 'm15 5-7 7 7 7',
  forward: 'm9 5 7 7-7 7',
  filter: 'M3 5h18l-7 8v7l-4-2v-5L3 5Z',
  sort: 'M8 4v16m0 0-4-4m4 4 4-4m4-12v16m0-16-4 4m4-4 4 4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm0-6 1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3H8l-1-3-3-1-3 1-2-4 2-2v-3l-2-2 2-4 3 1 3-1 1-3h4Z',
  logout: 'M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5m4-12 4 4-4 4m4-4H8',
  refresh: 'M20 6v5h-5M4 18v-5h5m9.5-3A7 7 0 0 0 6 7m-.5 7A7 7 0 0 0 18 17',
  minus: 'M5 12h14',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10v.2',
}

type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const iconSizes: Record<IconSize, string> = {
  xs: 'var(--kafgir-icon-xs)',
  sm: 'var(--kafgir-icon-sm)',
  md: 'var(--kafgir-icon-md)',
  lg: 'var(--kafgir-icon-lg)',
  xl: 'var(--kafgir-icon-xl)',
}

type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: IconSize }

export function Icon({ name, size = 'md', ...props }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={iconSizes[size]} height={iconSizes[size]} fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      focusable="false" {...props}>
      <path d={paths[name]} />
    </svg>
  )
}
