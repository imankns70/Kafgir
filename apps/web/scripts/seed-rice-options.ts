import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import postgres from 'postgres'

const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) loadEnvFile(envPath)
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })

/**
 * Foreign rice is what every dish already comes with, priced into the dish. Persian rice is the one
 * paid upgrade, modelled as a hidden food carrying `is_persian_rice`. A second, ordinary food is a
 * full standalone portion for stews, sandwiches and other dishes that need rice on the side. Each
 * gets its own daily-menu price and capacity.
 *
 * This seed creates the two products and nothing else: it deliberately does NOT put either on a
 * daily menu and does not flag any dish. It used to also create ingredients and costing recipes;
 * that inventory model was removed, and rice is now simply two foods.
 */
const persianRice = {
  name: 'برنج ایرانی', slug: 'iranian-rice',
  // The dish price already includes foreign rice, so this is the upgrade difference only.
  price: 55_000,
  description: 'ارتقای برنج غذا از خارجی به ایرانی',
} as const

const standalonePersianRice = {
  name: 'یک پرس برنج ایرانی', slug: 'persian-rice-side',
  price: 150_000,
  description: 'یک پرس کامل برنج ایرانی برای سفارش کنار خورشت، خوراک یا غذای نونی',
  fullDescription: 'برنج ایرانی دم‌کشیده در ظرف جدا؛ قابل سفارش به‌عنوان غذای جانبی مستقل.',
  ingredients: 'برنج ایرانی، روغن و نمک',
  portionDescription: 'یک پرس کامل برنج پخته در ظرف جداگانه',
} as const

async function main() {
  try {
    await sql.begin(async (tx) => {
      const foodCategory = await tx<{ id: number }[]>`
        INSERT INTO food_categories (title,slug,icon,display_order,is_active,created_at,updated_at)
        VALUES ('افزودنی و تک‌پرس','extras','🍽️',8,true,NOW(),NOW())
        ON CONFLICT (slug) DO UPDATE SET is_active=true, updated_at=NOW()
        RETURNING id`
      const foodCategoryId = foodCategory[0]!.id

      // The hidden upgrade. Matched on slug or name so re-running the seed never creates a second one.
      const existingUpgradeFood = await tx<{ id: number }[]>`
        SELECT id FROM foods
        WHERE slug=${persianRice.slug} OR lower(btrim(name))=lower(btrim(${persianRice.name}))
        ORDER BY CASE WHEN slug=${persianRice.slug} THEN 0 ELSE 1 END, id
        LIMIT 1`
      if (existingUpgradeFood[0]) {
        await tx`
          UPDATE foods SET name=${persianRice.name},slug=${persianRice.slug},
            description=${persianRice.description},category_id=${foodCategoryId},
            default_price=${persianRice.price},allows_persian_rice=FALSE,is_persian_rice=TRUE,
            is_active=TRUE,updated_at=NOW()
          WHERE id=${existingUpgradeFood[0].id}`
      } else {
        await tx`
          INSERT INTO foods
            (name,slug,description,category_id,default_price,allows_persian_rice,is_persian_rice,
             is_active,created_at,updated_at)
          VALUES (${persianRice.name},${persianRice.slug},${persianRice.description},
            ${foodCategoryId},${persianRice.price},FALSE,TRUE,TRUE,NOW(),NOW())`
      }

      // The standalone side dish: an ordinary customer-visible food with a full-portion price.
      const side = standalonePersianRice
      const existingSideFood = await tx<{ id: number }[]>`
        SELECT id FROM foods
        WHERE slug=${side.slug} OR lower(btrim(name))=lower(btrim(${side.name}))
        ORDER BY CASE WHEN slug=${side.slug} THEN 0 ELSE 1 END, id
        LIMIT 1`
      if (existingSideFood[0]) {
        await tx`
          UPDATE foods SET name=${side.name},slug=${side.slug},description=${side.description},
            full_description=${side.fullDescription},ingredients=${side.ingredients},
            portion_description=${side.portionDescription},category_id=${foodCategoryId},
            allows_persian_rice=FALSE,is_persian_rice=FALSE,is_active=TRUE,updated_at=NOW()
          WHERE id=${existingSideFood[0].id}`
      } else {
        await tx`
          INSERT INTO foods
            (name,slug,description,full_description,ingredients,portion_description,category_id,
             default_price,allows_persian_rice,is_persian_rice,is_active,created_at,updated_at)
          VALUES (${side.name},${side.slug},${side.description},${side.fullDescription},
            ${side.ingredients},${side.portionDescription},${foodCategoryId},${side.price},
            FALSE,FALSE,TRUE,NOW(),NOW())`
      }
    })
    console.log([
      'Two Persian-rice products are ready:',
      '1) «برنج ایرانی» is the hidden upgrade; its daily price is the upgrade difference.',
      '2) «یک پرس برنج ایرانی» is customer-visible; its daily price is the full portion price.',
      "Next, from Admin: add either or both to today's menu with separate prices and capacities, then tick",
      '«امکان افزودن برنج ایرانی به این غذا» on every dish that should offer the upgrade.',
    ].join('\n'))
  } finally {
    await sql.end()
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
