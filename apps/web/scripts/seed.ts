import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import postgres from 'postgres'
import { hashPassword } from '../src/server/auth/password'

const localEnvPath = resolve(process.cwd(), '.env.local')
if (existsSync(localEnvPath)) loadEnvFile(localEnvPath)

function productionSeedSetting(name: string, localDefault: string) {
  const value = process.env[name]?.trim()
  if (value) return value
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is required when seeding production.`)
  }
  return localDefault
}

const seedAdmin = {
  username: productionSeedSetting('ADMIN_SEED_USERNAME', 'admin'),
  password: productionSeedSetting('ADMIN_SEED_PASSWORD', 'Admin@123456'),
  fullName: productionSeedSetting('ADMIN_SEED_FULL_NAME', 'مدیر کفگیر'),
} as const

if (seedAdmin.password.length < 12) {
  throw new Error('ADMIN_SEED_PASSWORD must contain at least 12 characters.')
}

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

  // Snapshot of the real food catalog. Image columns and food_images are intentionally omitted so
  // every environment keeps its own uploaded image addresses when this idempotent seed is rerun.
  const seedFoods = [
    {
      name: 'زرشک‌پلو با مرغ (ران)', slug: 'zereshk-polo-ba-morgh', categorySlug: 'rice', defaultPrice: 0,
      description: 'زرشک‌پلو با ران مرغ؛ برنج ایرانی یا خارجی خوش‌عطر با زرشک و زعفران، همراه ران مرغ نرم و خوش‌طعم، پخته‌شده به سبک خانگی.',
      fullDescription: 'زرشک‌پلو با ران مرغ یکی از غذاهای محبوب و مجلسی ایرانی است که با برنج ایرانی، زرشک، زعفران و ران مرغ تهیه می‌شود. ران مرغ با پیاز و ادویه پخته می‌شود تا کاملاً نرم و خوش‌طعم شود و در کنار برنج زعفرانی و زرشک تفت‌داده‌شده سرو می‌شود.',
      ingredients: 'برنج ایرانی یا خارجی، ران مرغ، زرشک، زعفران، پیاز، روغن یا کره، نمک، فلفل و زردچوبه.',
      portionDescription: 'برنج پخته حدود ۳۵۰ تا ۴۰۰ گرم، یک عدد ران مرغ کامل حدود ۲۲۰ تا ۲۸۰ گرم، زرشک حدود ۲۰ تا ۳۰ گرم، زعفران، پیاز و ادویه. وزن تقریبی هر پرس حدود ۶۰۰ تا ۷۰۰ گرم است.',
      allergyInformation: 'لبنیات و مغزها', preparationTimeMinutes: null,
      allowsPersianRice: true, isPersianRice: false, isActive: true,
      primaryBadgeTagSlug: null, tagSlugs: [],
    },
    {
      name: 'قورمه‌سبزی', slug: 'ghormeh-sabzi', categorySlug: 'rice', defaultPrice: 0,
      description: 'قورمه‌سبزی خانگی با سبزی تازه، لوبیا، لیموعمانی و گوشت',
      fullDescription: 'قورمه‌سبزی یکی از محبوب‌ترین غذاهای سنتی ایرانی است که با سبزی قورمه تازه و معطر، تکه‌های گوشت خورشتی و لوبیا تهیه می‌شود. مواد با حرارت ملایم و زمان کافی پخته می‌شوند تا خورش کاملاً جاافتاده، غلیظ و خوش‌عطر شود. این غذا همراه برنج ایرانی سرو می‌شود و انتخابی مناسب برای دوستداران طعم اصیل غذای خانگی است.',
      ingredients: null, portionDescription: null, allergyInformation: null, preparationTimeMinutes: null,
      allowsPersianRice: true, isPersianRice: false, isActive: true,
      primaryBadgeTagSlug: null, tagSlugs: [],
    },
    {
      name: 'ماکارونی', slug: 'makaroni', categorySlug: 'rice', defaultPrice: 0,
      description: 'ماکارونی خانگی با گوشت چرخ‌کرده، پیاز و سس گوجه‌فرنگی، دم‌کشیده و خوش‌طعم. و ته‌دیگ',
      fullDescription: 'ماکارونی به سبک خانگی با ترکیب پاستا، گوشت چرخ‌کرده، پیاز و سس گوجه‌فرنگی تهیه می‌شود. مواد پس از آماده‌سازی با ماکارونی ترکیب شده و به روش ایرانی دم می‌کشد تا طعم مواد کاملاً به خورد پاستا برود و بافتی خوش‌طعم و یکدست پیدا کند.',
      ingredients: 'ماکارونی، گوشت چرخ‌کرده، پیاز، رب گوجه‌فرنگی، روغن، نمک، فلفل و زردچوبه.',
      portionDescription: 'حدود ۴۰۰ تا ۵۰۰ گرم ماکارونی پخته و دم‌کشیده به همراه مخلوط گوشت چرخ‌کرده و سس.',
      allergyInformation: 'حاوی گلوتن (گندم) است. ممکن است حاوی تخم‌مرغ نیز باشد.', preparationTimeMinutes: null,
      allowsPersianRice: false, isPersianRice: false, isActive: true,
      primaryBadgeTagSlug: null, tagSlugs: [],
    },
    {
      name: 'خورشت قیمه', slug: 'gheymeh', categorySlug: 'rice', defaultPrice: 0,
      description: 'خورشت قیمه؛ خورش اصیل و جاافتاده ایرانی با گوشت خورشتی، لپه و سس خوش‌رنگ گوجه، همراه سیب‌زمینی خلالی.',
      fullDescription: 'خورشت قیمه یکی از غذاهای سنتی و محبوب ایرانی است که با گوشت خورشتی، لپه، پیاز، رب گوجه‌فرنگی و ادویه تهیه می‌شود. خورش با حرارت ملایم پخته می‌شود تا کاملاً جاافتاده و خوش‌طعم شود و در پایان با سیب‌زمینی خلالی سرو می‌شود.',
      ingredients: 'گوشت خورشتی، لپه، پیاز، رب گوجه‌فرنگی، سیب‌زمینی، روغن، نمک، فلفل و زردچوبه.',
      portionDescription: 'حدود ۲۵۰ تا ۳۰۰ گرم خورشت قیمه شامل گوشت، لپه و سس خورش، به همراه سیب‌زمینی خلالی. اگر به‌صورت غذای کامل سرو شود، همراه حدود ۳۵۰ تا ۴۰۰ گرم برنج پخته ارائه می‌شود.',
      allergyInformation: null, preparationTimeMinutes: null,
      allowsPersianRice: true, isPersianRice: false, isActive: true,
      primaryBadgeTagSlug: 'traditional',
      tagSlugs: ['beef', 'daily-cooked', 'homemade', 'local', 'ready-to-send', 'single-serving', 'traditional'],
    },
    {
      name: 'زرشک‌پلو با مرغ (سینه)', slug: 'gg', categorySlug: 'rice', defaultPrice: 0,
      description: 'زرشک‌پلو با سینه مرغ؛ ترکیب خوش‌عطر برنج ایرانی، زرشک و زعفران به همراه سینه مرغ نرم و خوش‌طعم، تهیه‌شده به سبک خانگی و مناسب یک وعده کامل و لذیذ.',
      fullDescription: 'زرشک‌پلو با سینه مرغ یکی از غذاهای محبوب و مجلسی ایرانی است که از برنج ایرانی، زرشک، زعفران و سینه مرغ تهیه می‌شود. در این غذا، سینه مرغ معمولاً با پیاز، ادویه و زعفران پخته یا مزه‌دار می‌شود تا بافتی نرم، خوش‌عطر و طعمی دلپذیر داشته باشد. برنج هم به‌صورت سفید و زعفرانی سرو می‌شود و زرشک تفت‌داده‌شده، طعم ملس و خوش‌رنگی به آن می‌دهد.',
      ingredients: 'زرشک‌پلو با سینه مرغ یکی از غذاهای اصیل و پرطرفدار ایرانی است که با برنج ایرانی، زرشک تازه و زعفران تهیه می‌شود. سینه مرغ با پیاز و ادویه‌ها پخته یا طعم‌دار می‌شود تا بافتی نرم و طعمی دلنشین داشته باشد. زرشک تفت‌داده‌شده در کنار عطر زعفران، به این غذا ظاهر و مزه‌ای مجلسی می‌دهد. این غذا انتخابی مناسب برای کسانی است که طعم اصیل، ظاهر اشتهابرانگیز و یک غذای خانگی کامل را دوست دارند',
      portionDescription: 'برنج پخته: حدود ۳۵۰ تا ۴۰۰ گرم\nسینه مرغ پخته: یک تکه کامل، حدود ۱۸۰ تا ۲۲۰ گرم\nزرشک: حدود ۲۰ تا ۳۰ گرم\nزعفران دم‌کرده: به مقدار لازم\nپیاز و ادویه برای پخت مرغ\nمقدار کمی روغن یا کره برای برنج و زرشک\nوزن تقریبی هر پرس: حدود ۵۵۰ تا ۶۵۰ گرم.',
      allergyInformation: 'حاوی احتمالی لبنیات و مغزها', preparationTimeMinutes: null,
      allowsPersianRice: true, isPersianRice: false, isActive: true,
      primaryBadgeTagSlug: null, tagSlugs: [],
    },
    {
      name: 'کبه عربی', slug: 'arabikobe', categorySlug: 'rice', defaultPrice: 0,
      description: 'کوبه عربی؛ پوسته‌ای ترد از بلغور و گوشت با مغز گوشت چرخ‌کرده، پیاز و ادویه‌های معطر، سرخ‌شده و خوش‌طعم',
      fullDescription: 'کوبه عربی یک غذای محبوب و خوش‌عطر خاورمیانه‌ای است که معمولاً با پوسته‌ای از بلغور گندم و گوشت تهیه می‌شود و داخل آن با گوشت چرخ‌کرده، پیاز و ادویه پر می‌شود. بعد به شکل بیضی یا گرد فرم داده شده و سرخ می‌شود تا بیرون آن ترد و داخلش آبدار و خوش‌طعم بماند.',
      ingredients: 'بلغور ریز، گوشت چرخ‌کرده، پیاز، روغن، نمک، فلفل، دارچین یا ادویه عربی و در صورت استفاده گردو یا خلال بادام.',
      portionDescription: 'حدود ۴ تا ۵ عدد کبه متوسط، مجموعاً حدود ۲۵۰ تا ۳۵۰ گرم.',
      allergyInformation: 'حاوی گندم و گلوتن است. در صورت استفاده از گردو یا بادام، ممکن است حاوی مغزها نیز باشد.', preparationTimeMinutes: null,
      allowsPersianRice: false, isPersianRice: false, isActive: true,
      primaryBadgeTagSlug: null, tagSlugs: [],
    },
    {
      name: 'برنج هندی', slug: 'berenjhindi', categorySlug: 'extras', defaultPrice: 0,
      description: 'برنج هندی ساده و خوش‌پخت، مناسب سرو در کنار انواع خورشت و غذاهای ایرانی.',
      fullDescription: 'برنج هندی سفید با دانه‌های بلند و بافت سبک که به‌صورت ساده پخته و بدون خورشت یا مخلفات اصلی سرو می‌شود. گزینه‌ای مناسب برای کسانی که می‌خواهند برنج را جداگانه در کنار غذای دلخواهشان سفارش دهند.',
      ingredients: 'برنج هندی، آب، نمک و مقدار کمی روغن یا کره',
      portionDescription: 'حدود ۳۵۰ تا ۴۰۰ گرم برنج پخته.',
      allergyInformation: 'کره ممکن است حاوی لبنیات باشد', preparationTimeMinutes: null,
      allowsPersianRice: false, isPersianRice: false, isActive: true,
      primaryBadgeTagSlug: null, tagSlugs: [],
    },
    {
      name: 'برنج ایرانی', slug: 'iranian-rice', categorySlug: 'extras', defaultPrice: 55_000,
      description: 'ارتقای برنج غذا از خارجی به ایرانی',
      fullDescription: 'برنج ایرانی با عطر طبیعی و بافت نرم و دانه‌های نسبتاً کوتاه‌تر، به‌صورت ساده پخته و بدون خورشت یا مخلفات اصلی سرو می‌شود. انتخابی مناسب برای سفارش جداگانه در کنار غذای دلخواه.',
      ingredients: 'برنج ایرانی، آب، نمک و مقدار کمی روغن یا کره',
      portionDescription: 'حدود ۳۵۰ تا ۴۰۰ گرم برنج پخته.',
      allergyInformation: 'کره، ممکن است حاوی لبنیات', preparationTimeMinutes: null,
      allowsPersianRice: false, isPersianRice: true, isActive: true,
      primaryBadgeTagSlug: 'daily-cooked',
      tagSlugs: ['daily-cooked', 'diet', 'kids-friendly', 'limited-capacity', 'low-fat', 'popular', 'single-serving', 'traditional', 'vegetarian'],
    },
    {
      name: 'یک پرس برنج ایرانی', slug: 'persian-rice-side', categorySlug: 'extras', defaultPrice: 150_000,
      description: 'یک پرس کامل برنج ایرانی برای سفارش کنار خورشت، خوراک یا غذای نونی',
      fullDescription: 'برنج ایرانی دم‌کشیده در ظرف جدا؛ قابل سفارش به‌عنوان غذای جانبی مستقل.',
      ingredients: 'برنج ایرانی، روغن و نمک',
      portionDescription: 'یک پرس کامل برنج پخته در ظرف جداگانه',
      allergyInformation: null, preparationTimeMinutes: null,
      allowsPersianRice: false, isPersianRice: false, isActive: true,
      primaryBadgeTagSlug: null, tagSlugs: [],
    },
  ] as const

  for (const food of seedFoods) {
    const category = await sql<{ id: number }[]>`
      SELECT id FROM food_categories WHERE slug=${food.categorySlug} LIMIT 1`
    if (!category[0]) throw new Error(`Food category ${food.categorySlug} is required.`)
    const primaryBadge = food.primaryBadgeTagSlug
      ? await sql<{ id: number }[]>`SELECT id FROM food_tags WHERE slug=${food.primaryBadgeTagSlug} LIMIT 1`
      : []
    const rows = await sql<{ id: number }[]>`
      INSERT INTO foods
        (name,slug,description,full_description,ingredients,portion_description,
         allergy_information,preparation_time_minutes,category_id,primary_badge_tag_id,
         default_price,allows_persian_rice,is_persian_rice,is_active,created_at,updated_at)
      VALUES
        (${food.name},${food.slug},${food.description},${food.fullDescription},${food.ingredients},
         ${food.portionDescription},${food.allergyInformation},${food.preparationTimeMinutes},
         ${category[0].id},${primaryBadge[0]?.id ?? null},${food.defaultPrice},
         ${food.allowsPersianRice},${food.isPersianRice},${food.isActive},${now},${now})
      ON CONFLICT (slug) DO UPDATE SET
        name=EXCLUDED.name,description=EXCLUDED.description,full_description=EXCLUDED.full_description,
        ingredients=EXCLUDED.ingredients,portion_description=EXCLUDED.portion_description,
        allergy_information=EXCLUDED.allergy_information,
        preparation_time_minutes=EXCLUDED.preparation_time_minutes,category_id=EXCLUDED.category_id,
        primary_badge_tag_id=EXCLUDED.primary_badge_tag_id,default_price=EXCLUDED.default_price,
        allows_persian_rice=EXCLUDED.allows_persian_rice,is_persian_rice=EXCLUDED.is_persian_rice,
        is_active=EXCLUDED.is_active,updated_at=EXCLUDED.updated_at
      RETURNING id`
    await sql`DELETE FROM food_to_tags WHERE food_id=${rows[0]!.id}`
    for (const tagSlug of food.tagSlugs) {
      await sql`
        INSERT INTO food_to_tags (food_id,tag_id,created_at)
        SELECT ${rows[0]!.id},id,${now} FROM food_tags WHERE slug=${tagSlug}
        ON CONFLICT DO NOTHING`
    }
  }

  const users = await sql<{ id: number }[]>`
    INSERT INTO users
      (username, normalized_username, password_hash, password_hash_scheme,
       full_name, is_active, created_at, email_confirmed, phone_number_confirmed,
       two_factor_enabled, lockout_enabled, access_failed_count, allows_write_to_pm)
    VALUES
      (${seedAdmin.username}, ${seedAdmin.username.toUpperCase()}, ${hashPassword(seedAdmin.password)}, 'scrypt',
       ${seedAdmin.fullName}, true, ${now}, false, false, false, true, 0, false)
    ON CONFLICT (normalized_username) DO UPDATE
      SET full_name = EXCLUDED.full_name,
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
