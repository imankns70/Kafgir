import mssql from 'mssql'
import postgres from 'postgres'

type SourceRow = Record<string, unknown>
type Mapping = {
  source: string
  target: string
  idColumn?: string
  columns: Record<string, string>
  transform?: (row: SourceRow) => SourceRow
}

let migrationDefaultCategoryId = 0

const mergeAddressText = (line: unknown, description: unknown) => {
  const addressLine = typeof line === 'string' ? line.trim() : ''
  const addressDescription = typeof description === 'string' ? description.trim() : ''
  if (!addressDescription || addressLine.includes(addressDescription)) return addressLine
  return `${addressLine}\n${addressDescription}`.trim().slice(0, 1000)
}

const mappings: Mapping[] = [
  {
    source: 'AspNetRoles', target: 'roles', idColumn: 'id',
    columns: { Id: 'id', Name: 'name', NormalizedName: 'normalized_name', ConcurrencyStamp: 'concurrency_stamp' },
  },
  {
    source: 'AspNetUsers', target: 'users', idColumn: 'id',
    columns: {
      Id: 'id', UserName: 'username', NormalizedUserName: 'normalized_username',
      Email: 'email', NormalizedEmail: 'normalized_email', EmailConfirmed: 'email_confirmed',
      PasswordHash: 'password_hash', SecurityStamp: 'security_stamp',
      ConcurrencyStamp: 'concurrency_stamp', PhoneNumber: 'phone_number',
      PhoneNumberConfirmed: 'phone_number_confirmed', TwoFactorEnabled: 'two_factor_enabled',
      LockoutEnd: 'lockout_end', LockoutEnabled: 'lockout_enabled',
      AccessFailedCount: 'access_failed_count', TelegramUserId: 'telegram_user_id',
      TelegramFirstName: 'telegram_first_name', TelegramLastName: 'telegram_last_name',
      TelegramLanguageCode: 'telegram_language_code', AllowsWriteToPm: 'allows_write_to_pm',
      FullName: 'full_name', IsActive: 'is_active', CreatedAt: 'created_at',
      LastSeenAt: 'last_seen_at', LastOrderAt: 'last_order_at',
    },
    transform: (row) => ({
      ...row,
      PasswordHashScheme: row.PasswordHash ? 'aspnet-identity-v3' : 'none',
    }),
  },
  {
    source: 'AspNetUserRoles', target: 'user_roles',
    columns: { UserId: 'user_id', RoleId: 'role_id' },
  },
  {
    source: 'AspNetUserClaims', target: 'user_claims', idColumn: 'id',
    columns: { Id: 'id', UserId: 'user_id', ClaimType: 'claim_type', ClaimValue: 'claim_value' },
  },
  {
    source: 'AspNetRoleClaims', target: 'role_claims', idColumn: 'id',
    columns: { Id: 'id', RoleId: 'role_id', ClaimType: 'claim_type', ClaimValue: 'claim_value' },
  },
  {
    source: 'AspNetUserLogins', target: 'user_logins',
    columns: { LoginProvider: 'login_provider', ProviderKey: 'provider_key', ProviderDisplayName: 'provider_display_name', UserId: 'user_id' },
  },
  {
    source: 'AspNetUserTokens', target: 'user_tokens',
    columns: { UserId: 'user_id', LoginProvider: 'login_provider', Name: 'name', Value: 'value' },
  },
  {
    source: 'TelegramAccounts', target: 'telegram_accounts', idColumn: 'id',
    columns: {
      Id: 'id', UserId: 'user_id', TelegramUserId: 'telegram_user_id',
      Username: 'username', FirstName: 'first_name', LastName: 'last_name',
      LanguageCode: 'language_code', AllowsWriteToPm: 'allows_write_to_pm',
      ChatId: 'chat_id', CreatedAt: 'created_at', LastSeenAt: 'last_seen_at',
    },
  },
  {
    source: 'CustomerProfiles', target: 'customer_profiles', idColumn: 'id',
    columns: { Id: 'id', UserId: 'user_id', PreferredName: 'preferred_name', DefaultPhoneNumber: 'default_phone_number', CreatedAt: 'created_at', LastOrderAt: 'last_order_at' },
  },
  {
    source: 'CustomerAddresses', target: 'customer_addresses', idColumn: 'id',
    columns: {
      Id: 'id', CustomerProfileId: 'customer_profile_id', Title: 'title', City: 'city',
      AddressLine: 'address_line', IsDefault: 'is_default',
      IsActive: 'is_active', CreatedAt: 'created_at', LastUsedAt: 'last_used_at',
    },
    transform: (row) => ({
      ...row,
      AddressLine: mergeAddressText(row.AddressLine, row.Description),
    }),
  },
  {
    source: 'Foods', target: 'foods', idColumn: 'id',
    columns: {
      Id: 'id', Name: 'name', Slug: 'slug', Description: 'description',
      CategoryId: 'category_id', DefaultPrice: 'default_price', ImageUrl: 'image_url',
      IsActive: 'is_active', CreatedAt: 'created_at', UpdatedAt: 'updated_at',
    },
    transform: (row) => ({
      ...row,
      Slug: `legacy-food-${row.Id}`,
      CategoryId: migrationDefaultCategoryId,
      UpdatedAt: row.CreatedAt,
    }),
  },
  {
    source: 'DailyMenus', target: 'daily_menus', idColumn: 'id',
    columns: { Id: 'id', MenuDate: 'menu_date', IsOpen: 'is_open', Note: 'note', CreatedAt: 'created_at' },
  },
  {
    source: 'DailyMenuItems', target: 'daily_menu_items', idColumn: 'id',
    columns: {
      Id: 'id', DailyMenuId: 'daily_menu_id', FoodId: 'food_id', Price: 'price',
      CapacityPortions: 'capacity_portions', SoldPortions: 'sold_portions',
      IsAvailable: 'is_available', CreatedAt: 'created_at',
    },
  },
  {
    source: 'Orders', target: 'orders', idColumn: 'id',
    columns: {
      Id: 'id', OrderNumber: 'order_number', CustomerProfileId: 'customer_profile_id',
      CustomerAddressId: 'customer_address_id', DeliveryFullName: 'delivery_full_name',
      DeliveryPhoneNumber: 'delivery_phone_number', DeliveryCity: 'delivery_city',
      DeliveryAddressLine: 'delivery_address_line', Status: 'status',
      PaymentMethod: 'payment_method', DeliveryMethod: 'delivery_method',
      SubtotalAmount: 'subtotal_amount', DeliveryFee: 'delivery_fee',
      TotalAmount: 'total_amount', CustomerNote: 'customer_note', AdminNote: 'admin_note',
      CreatedAt: 'created_at', ConfirmedAt: 'confirmed_at', DeliveredAt: 'delivered_at',
      CancelledAt: 'cancelled_at',
    },
    transform: (row) => ({
      ...row,
      DeliveryAddressLine: mergeAddressText(row.DeliveryAddressLine, row.DeliveryAddressDescription),
    }),
  },
  {
    source: 'OrderItems', target: 'order_items', idColumn: 'id',
    columns: {
      Id: 'id', OrderId: 'order_id', DailyMenuItemId: 'daily_menu_item_id',
      FoodName: 'food_name', UnitPrice: 'unit_price', Quantity: 'quantity',
      TotalPrice: 'total_price',
    },
  },
  {
    source: 'OrderStatusHistories', target: 'order_status_histories', idColumn: 'id',
    columns: { Id: 'id', OrderId: 'order_id', FromStatus: 'from_status', ToStatus: 'to_status', Note: 'note', ChangedAt: 'changed_at' },
  },
  {
    source: 'NotificationMessages', target: 'notification_messages', idColumn: 'id',
    columns: {
      Id: 'id', Channel: 'channel', Type: 'type', Status: 'status', Target: 'target',
      Text: 'text', OrderId: 'order_id', OrderNumber: 'order_number',
      RetryCount: 'retry_count', CreatedAt: 'created_at', NextAttemptAt: 'next_attempt_at',
      SentAt: 'sent_at', LastAttemptAt: 'last_attempt_at', LastError: 'last_error',
    },
  },
  {
    source: 'AppSettings', target: 'app_settings', idColumn: 'id',
    columns: { Id: 'id', Key: 'key', Value: 'value', Description: 'description' },
  },
]

function mapRow(mapping: Mapping, row: SourceRow) {
  const transformed = mapping.transform?.(row) ?? row
  const result: SourceRow = {}
  for (const [source, target] of Object.entries(mapping.columns)) {
    result[target] = transformed[source] ?? null
  }
  if (mapping.source === 'AspNetUsers') {
    result.password_hash_scheme = transformed.PasswordHashScheme
  }
  return result
}

async function main() {
  const sourceConnection = process.env.SQLSERVER_CONNECTION_STRING
  const targetConnection = process.env.DATABASE_URL
  if (!sourceConnection || !targetConnection) {
    throw new Error('SQLSERVER_CONNECTION_STRING and DATABASE_URL are required.')
  }

  const target = postgres(targetConnection, { max: 1 })
  const source = await mssql.connect(sourceConnection)

  try {
  const existing = await target<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM users`
  if ((existing[0]?.count ?? 0) > 0 && !process.argv.includes('--reset-target')) {
    throw new Error('Target database is not empty. Use --reset-target only for an approved rehearsal database.')
  }
  if (process.argv.includes('--reset-target')) {
    const tables = [...mappings].reverse().map((mapping) => `"${mapping.target}"`).join(', ')
    await target.unsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`)
  }

  const counts: Array<{ source: string; target: string; count: number }> = []
  await target.begin(async (tx) => {
    const categories = await tx<{ id: number }[]>`
      INSERT INTO food_categories
        (title, slug, icon, display_order, is_active, created_at, updated_at)
      VALUES ('برنجی', 'rice', '🍚', 1, true, NOW(), NOW())
      ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
      RETURNING id
    `
    migrationDefaultCategoryId = categories[0]!.id
    for (const mapping of mappings) {
      const result = await source.request().query<SourceRow>(`SELECT * FROM [dbo].[${mapping.source}]`)
      const rows = result.recordset.map((row) => mapRow(mapping, row))
      if (rows.length > 0) {
        const columns = Object.values(mapping.columns)
        if (mapping.source === 'AspNetUsers') columns.push('password_hash_scheme')
        await tx`INSERT INTO ${tx(mapping.target)} ${tx(rows, ...columns)}`
      }
      counts.push({ source: mapping.source, target: mapping.target, count: rows.length })
    }
    await tx`
      INSERT INTO food_images
        (food_id, image_url, alt_text, display_order, is_primary, created_at)
      SELECT id, image_url, name, 0, true, created_at
      FROM foods
      WHERE image_url IS NOT NULL AND BTRIM(image_url) <> ''
      ON CONFLICT DO NOTHING
    `
    for (const mapping of mappings.filter((item) => item.idColumn)) {
      await tx.unsafe(`
        SELECT setval(
          pg_get_serial_sequence('${mapping.target}', '${mapping.idColumn}'),
          COALESCE((SELECT MAX(${mapping.idColumn}) FROM ${mapping.target}), 1),
          EXISTS(SELECT 1 FROM ${mapping.target})
        )
      `)
    }
  })

  for (const item of counts) {
    const targetCount = await target<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM ${target(item.target)}`
    if (targetCount[0]?.count !== item.count) {
      throw new Error(`Count mismatch: ${item.source}=${item.count}, ${item.target}=${targetCount[0]?.count}`)
    }
  }
  const invalidTotals = await target<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM orders o
    WHERE o.subtotal_amount <> COALESCE((SELECT SUM(total_price) FROM order_items WHERE order_id = o.id), 0)
       OR o.total_amount <> o.subtotal_amount + o.delivery_fee
  `
  if (invalidTotals[0]?.count) throw new Error(`${invalidTotals[0].count} migrated orders have invalid totals.`)
  const duplicateOrderNumbers = await target<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT order_number
      FROM orders
      GROUP BY order_number
      HAVING COUNT(*) > 1
    ) duplicates
  `
  if (duplicateOrderNumbers[0]?.count) {
    throw new Error(`${duplicateOrderNumbers[0].count} duplicate order numbers were migrated.`)
  }
  const invalidCapacities = await target<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM daily_menu_items
    WHERE sold_portions < 0 OR capacity_portions < sold_portions
  `
  if (invalidCapacities[0]?.count) {
    throw new Error(`${invalidCapacities[0].count} daily-menu items have invalid capacity totals.`)
  }
  const sourceMoney = await source.request().query<{
    OrderCount: number
    TotalAmount: number
    ItemTotal: number
  }>(`
    SELECT
      (SELECT COUNT(*) FROM [dbo].[Orders]) AS OrderCount,
      COALESCE((SELECT SUM(TotalAmount) FROM [dbo].[Orders]), 0) AS TotalAmount,
      COALESCE((SELECT SUM(TotalPrice) FROM [dbo].[OrderItems]), 0) AS ItemTotal
  `)
  const targetMoney = await target<{ orderCount: number; totalAmount: string; itemTotal: string }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM orders) AS "orderCount",
      COALESCE((SELECT SUM(total_amount) FROM orders), 0)::text AS "totalAmount",
      COALESCE((SELECT SUM(total_price) FROM order_items), 0)::text AS "itemTotal"
  `
  const sourceSummary = sourceMoney.recordset[0]!
  const targetSummary = targetMoney[0]!
  if (
    Number(sourceSummary.OrderCount) !== targetSummary.orderCount ||
    Number(sourceSummary.TotalAmount) !== Number(targetSummary.totalAmount) ||
    Number(sourceSummary.ItemTotal) !== Number(targetSummary.itemTotal)
  ) {
    throw new Error(`Aggregate mismatch: SQL Server ${JSON.stringify(sourceSummary)}, PostgreSQL ${JSON.stringify(targetSummary)}.`)
  }
  console.table(counts)
  console.table([{ ...targetSummary, duplicateOrderNumbers: 0, invalidCapacities: 0, invalidTotals: 0 }])
  console.log('SQL Server to PostgreSQL migration and validation completed.')
  } finally {
    await source.close()
    await target.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
