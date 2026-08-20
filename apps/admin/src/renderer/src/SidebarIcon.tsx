import type { NavigationIcon } from './admin-navigation'

/**
 * One glyph per sidebar group.
 *
 * These exist so the collapsed sidebar stays usable: before, collapsing hid the navigation entirely
 * and left an empty rail, which made the toggle a way to lose the menu rather than to reclaim width.
 */
const paths: Record<NavigationIcon | 'dashboard', string> = {
  // Gauge: the at-a-glance view.
  dashboard: 'M3 13a9 9 0 0 1 18 0M12 13l4-4M3 13h2m14 0h2M12 20h.01',
  // Receipt: the working day's orders.
  sales: 'M6 2h12v20l-3-2-3 2-3-2-3 2V2Zm3 6h6M9 12h6',
  // Bowl with steam: the food catalog.
  catalog: 'M3 12h18a9 9 0 0 1-18 0Zm6-4c0-1 1-1.5 1-2.5S9 4 9 4m6 4c0-1 1-1.5 1-2.5S15 4 15 4',
  // Crate: stock and procurement.
  // Banknote: money that moved.
  finance: 'M2 6h20v12H2V6Zm10 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM5 9h.01M19 15h.01',
  // Share nodes: outbound publishing.
  social: 'M6 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm17-6a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm0 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM5.8 10.9l12.5-3.6M5.8 13.1l12.5 3.6',
  // Stacked layers: lookup lists other records point at.
  reference: 'm12 3 9 4.5-9 4.5-9-4.5L12 3Zm9 9-9 4.5L3 12m18 4.5L12 21l-9-4.5',
  // Sliders: configuration.
  settings: 'M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M7 16v4',
}

export function SidebarIcon({ name }: { name: NavigationIcon | 'dashboard' }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={paths[name]} fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
}
