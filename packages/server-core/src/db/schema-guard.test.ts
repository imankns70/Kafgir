import { describe, expect, it } from 'vitest'
import { missingTablesMessage, referenceDataTables } from './schema-guard'

describe('missingTablesMessage', () => {
  it('returns null when nothing is missing', () => {
    expect(missingTablesMessage([])).toBeNull()
  })

  it('names every missing table and points to the fix', () => {
    const message = missingTablesMessage(['food_tag_groups', 'support_subjects'])
    expect(message).toContain('food_tag_groups')
    expect(message).toContain('support_subjects')
    expect(message).toContain('npm run db:migrate')
    expect(message).toContain('DATABASE_URL')
  })

  it('covers every table the reference-data screens depend on', () => {
    expect(referenceDataTables).toEqual([
      'food_tag_groups', 'support_subjects', 'payment_method_settings', 'delivery_method_settings',
      'couriers', 'courier_delivery_days', 'courier_settlements',
    ])
  })
})
