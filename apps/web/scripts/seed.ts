import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import postgres from 'postgres'
import { hashPassword } from '../src/server/auth/password'

const localEnvPath = resolve(process.cwd(), '.env.local')
if (existsSync(localEnvPath)) loadEnvFile(localEnvPath)

const localAdmin = {
  username: 'admin',
  password: 'Admin@123456',
  fullName: 'مدیر کفگیر',
} as const

const seedCategories = [
  ['برنجی', 'rice', '🍚'],
  ['نانی', 'bread', '🫓'],
  ['کباب و گریل', 'grill', '🍢'],
  ['خوراک و سوپ', 'stew-and-soup', '🥣'],
  ['سالاد و مخلفات', 'salad-and-sides', '🥗'],
  ['دسر', 'dessert', '🍰'],
  ['نوشیدنی', 'beverage', '🥤'],
  ['افزودنی و تک‌پرس', 'extras', '🍽️'],
] as const

const seedTags = [
  ['پرفروش', 'best-seller', 'status'],
  ['جدید', 'new', 'status'],
  ['پیشنهاد امروز', 'today-special', 'status'],
  ['ویژه', 'special', 'status'],
  ['ظرفیت محدود', 'limited-capacity', 'status'],
  ['گوشت', 'beef', 'protein'],
  ['مرغ', 'chicken', 'protein'],
  ['ماهی', 'fish', 'protein'],
  ['میگو', 'shrimp', 'protein'],
  ['بدون گوشت', 'meatless', 'protein'],
  ['گیاهی', 'vegetarian', 'diet'],
  ['وگان', 'vegan', 'diet'],
  ['رژیمی', 'diet', 'diet'],
  ['کم‌چرب', 'low-fat', 'diet'],
  ['پروتئین بالا', 'high-protein', 'diet'],
  ['تند', 'spicy', 'taste'],
  ['ملایم', 'mild', 'taste'],
  ['شیرین', 'sweet', 'taste'],
  ['ترش', 'sour', 'taste'],
  ['تک‌نفره', 'single-serving', 'serving'],
  ['دونفره', 'two-serving', 'serving'],
  ['خانوادگی', 'family-serving', 'serving'],
  ['مناسب کودکان', 'kids-friendly', 'serving'],
  ['آماده ارسال', 'ready-to-send', 'service'],
  ['پخت روز', 'daily-cooked', 'service'],
  ['سفارش ویژه', 'special-order', 'service'],
  ['خانگی', 'homemade', 'style'],
  ['محلی', 'local', 'style'],
  ['سنتی', 'traditional', 'style'],
  ['فصلی', 'seasonal', 'style'],
  ['تخفیف', 'discount', 'marketing'],
  ['محبوب', 'popular', 'marketing'],
  ['انتخاب سرآشپز', 'chef-choice', 'marketing'],
] as const

const seedUnits = [
  ['گرم', 'g'], ['کیلوگرم', 'kg'], ['میلی‌لیتر', 'ml'], ['لیتر', 'l'],
  ['عدد', 'عدد'], ['بسته', 'بسته'], ['قوطی', 'قوطی'], ['بطری', 'بطری'],
] as const
const seedIngredientCategories = [
  'مواد پروتئینی', 'برنج و غلات', 'حبوبات', 'سبزیجات', 'ادویه و چاشنی',
  'روغن و افزودنی', 'بسته‌بندی', 'نوشیدنی', 'سایر',
] as const
const seedExpenseCategories = [
  'مواد اولیه', 'بسته‌بندی', 'ارسال', 'تبلیغات', 'حقوق و دستمزد',
  'آب، برق و گاز', 'اجاره', 'تعمیرات', 'تجهیزات', 'متفرقه',
] as const

/** Starting delivery windows. Plain editable defaults, not a business commitment. */
const seedDeliverySlots = [
  ['ظهر', '12:00', '14:00'],
  ['بعدازظهر', '14:00', '16:00'],
  ['عصر', '16:00', '18:00'],
] as const

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required.')

  const sql = postgres(connectionString, { max: 1 })
  const now = new Date()

  try {
  for (const [name, symbol] of seedUnits) {
    await sql`INSERT INTO units (name,symbol,is_active,created_at,updated_at)
      VALUES (${name},${symbol},true,${now},${now})
      ON CONFLICT (name) DO UPDATE SET symbol=EXCLUDED.symbol,is_active=true,updated_at=EXCLUDED.updated_at`
  }
  for (const name of seedIngredientCategories) {
    await sql`INSERT INTO ingredient_categories (name,is_active,created_at,updated_at)
      VALUES (${name},true,${now},${now})
      ON CONFLICT (name) DO UPDATE SET is_active=true,updated_at=EXCLUDED.updated_at`
  }
  for (const name of seedExpenseCategories) {
    await sql`INSERT INTO expense_categories (name,is_active,created_at)
      VALUES (${name},true,${now}) ON CONFLICT (name) DO UPDATE SET is_active=true`
  }
  // Starting delivery windows, seeded only into an empty table. Existing rows are the operator's,
  // so re-running the seed never resurrects a window they deleted or overwrites edited hours.
  const existingSlots = await sql<{ value: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM delivery_time_slots) AS value
  `
  if (!existingSlots[0]?.value) {
    for (const [index, [title, startTime, endTime]] of seedDeliverySlots.entries()) {
      await sql`
        INSERT INTO delivery_time_slots
          (title, start_time, end_time, sort_order, order_cutoff_minutes_before_start, is_active, created_at)
        VALUES (${title}, ${startTime}::time, ${endTime}::time, ${index + 1}, 60, true, ${now})
      `
    }
  }
  for (const [index, [title, slug, icon]] of seedCategories.entries()) {
    await sql`
      INSERT INTO food_categories
        (title, slug, icon, display_order, is_active, created_at, updated_at)
      VALUES (${title}, ${slug}, ${icon}, ${index + 1}, true, ${now}, ${now})
      ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title, icon = EXCLUDED.icon,
            display_order = EXCLUDED.display_order, updated_at = EXCLUDED.updated_at
    `
  }

  for (const [index, [title, slug, group]] of seedTags.entries()) {
    await sql`
      INSERT INTO food_tags
        (title, slug, icon, group_name, display_order, is_active,
         is_customer_visible, created_at, updated_at)
      VALUES (${title}, ${slug}, NULL, ${group}, ${index + 1}, true, true, ${now}, ${now})
      ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title, group_name = EXCLUDED.group_name,
            display_order = EXCLUDED.display_order, updated_at = EXCLUDED.updated_at
    `
  }

  const roleNames = ['Customer', 'Owner', 'KitchenAdmin', 'OrderManager']
  for (const name of roleNames) {
    await sql`
      INSERT INTO roles (name, normalized_name, concurrency_stamp)
      VALUES (${name}, ${name.toUpperCase()}, ${crypto.randomUUID()})
      ON CONFLICT (normalized_name) DO NOTHING
    `
  }

  const seedFoods = [
    ['زرشک‌پلو با مرغ', 'zereshk-polo-ba-morgh', 'زرشک‌پلو خانگی با مرغ مزه‌دار شده'],
    ['قورمه‌سبزی', 'ghormeh-sabzi', 'قورمه‌سبزی خانگی با سبزی تازه، لوبیا، لیموعمانی و گوشت'],
    ['ماکارونی', 'makaroni', 'ماکارونی خانگی با مایه گوشتی و ته‌دیگ'],
    ['قیمه', 'gheymeh', 'خورشت قیمه خانگی با لپه، لیموعمانی و سیب‌زمینی'],
  ] as const
  const defaultCategory = await sql<{ id: number }[]>`
    SELECT id FROM food_categories WHERE slug = 'rice' LIMIT 1
  `
  const existingFoodCount = await sql<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM foods`
  if (existingFoodCount[0]!.count === 0) {
    for (const [name, slug, description] of seedFoods) {
      await sql`
        INSERT INTO foods
          (name, slug, description, category_id, default_price, is_active, created_at, updated_at)
        VALUES
          (${name}, ${slug}, ${description}, ${defaultCategory[0]!.id}, 0, true, ${now}, ${now})
        ON CONFLICT (slug) DO UPDATE
          SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = EXCLUDED.updated_at
      `
    }
  }

  const users = await sql<{ id: number }[]>`
    INSERT INTO users
      (username, normalized_username, password_hash, password_hash_scheme,
       full_name, is_active, created_at, email_confirmed, phone_number_confirmed,
       two_factor_enabled, lockout_enabled, access_failed_count, allows_write_to_pm)
    VALUES
      (${localAdmin.username}, ${localAdmin.username.toUpperCase()}, ${hashPassword(localAdmin.password)}, 'scrypt',
       ${localAdmin.fullName}, true, ${now}, false, false, false, true, 0, false)
    ON CONFLICT (normalized_username) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          password_hash = EXCLUDED.password_hash,
          password_hash_scheme = EXCLUDED.password_hash_scheme,
          is_active = true
    RETURNING id
  `
  const owner = await sql<{ id: number }[]>`SELECT id FROM roles WHERE normalized_name = 'OWNER' LIMIT 1`
  await sql`
    INSERT INTO user_roles (user_id, role_id)
    VALUES (${users[0]!.id}, ${owner[0]!.id})
    ON CONFLICT DO NOTHING
  `
  console.log('Kafgir PostgreSQL seed completed.')
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
