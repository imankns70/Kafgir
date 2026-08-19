/**
 * Derived figures for the customer report.
 *
 * The database does the grouping; these turn the raw counters into the ratios the report shows. They
 * live here rather than inline in SQL so the divide-by-zero cases — an empty range, a range with
 * customers but no delivered orders — are covered by tests instead of discovered in production as
 * `NaN` rendered into a Persian number formatter.
 */

/** Money is rounded to whole Toman: Kafgir does not price in fractions. */
export function averageOrderValue(totalRevenue: number, orderCount: number): number {
  if (orderCount <= 0) return 0
  return Math.round(totalRevenue / orderCount)
}

/** Orders per active customer, to one decimal so "1.4 orders each" stays readable. */
export function averageOrdersPerCustomer(orderCount: number, customerCount: number): number {
  if (customerCount <= 0) return 0
  return Math.round((orderCount / customerCount) * 10) / 10
}

/**
 * Share of active customers that had ordered before the range began.
 *
 * Reported as a percentage with one decimal, matching the analytics dashboard's conversion rate so
 * the two screens read alike.
 */
export function returningShare(returningCustomers: number, activeCustomers: number): number {
  if (activeCustomers <= 0) return 0
  return Math.round((returningCustomers / activeCustomers) * 1000) / 10
}
