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
 * full standalone portion for stews, sandwiches and other dishes that need rice on the side. Both
 * recipes consume the same tracked ingredient, but each gets its own daily-menu price and capacity.
 * This seed deliberately does NOT put either product on a daily menu and does not flag any dish.
 */
const persianRice = {
  code: 'KFG-RICE-01',
  name: 'برنج ایرانی', slug: 'iranian-rice',
  // The dish price already includes foreign rice, so this is the upgrade difference only.
  price: 55_000,
  description: 'ارتقای برنج غذا از خارجی به ایرانی',
  gramsPerPortion: '250', minimum: 20_000, preferred: 70_000,
} as const

const standalonePersianRice = {
  name: 'یک پرس برنج ایرانی', slug: 'persian-rice-side',
  price: 150_000,
  description: 'یک پرس کامل برنج ایرانی برای سفارش کنار خورشت، خوراک یا غذای نونی',
  fullDescription: 'برنج ایرانی دم‌کشیده در ظرف جدا؛ قابل سفارش به‌عنوان غذای جانبی مستقل.',
  ingredients: 'برنج ایرانی، روغن و نمک',
  portionDescription: 'یک پرس کامل برنج پخته در ظرف جداگانه',
  gramsPerPortion: '180',
} as const

async function main() {
  try {
    await sql.begin(async (tx) => {
      const category = await tx<{ id: number }[]>`SELECT id FROM ingredient_categories WHERE name='برنج و غلات' LIMIT 1`
      const unit = await tx<{ id: number }[]>`SELECT id FROM units WHERE name='گرم' OR symbol='g' ORDER BY id LIMIT 1`
      if (!category[0] || !unit[0]) throw new Error('Rice ingredient category and gram unit are required.')

      const foodCategory = await tx<{ id: number }[]>`
        INSERT INTO food_categories (title,slug,icon,display_order,is_active,created_at,updated_at)
        VALUES ('افزودنی و تک‌پرس','extras','🍽️',8,true,NOW(),NOW())
        ON CONFLICT (slug) DO UPDATE SET is_active=true, updated_at=NOW()
        RETURNING id`
      const foodCategoryId = foodCategory[0]!.id

      {
        const option = persianRice
        const existingIngredient = await tx<{ id: number; baseUnitId: number }[]>`
          SELECT id, base_unit_id AS "baseUnitId" FROM ingredients WHERE code=${option.code} LIMIT 1`
        if (existingIngredient[0] && existingIngredient[0].baseUnitId !== unit[0].id) {
          await tx`
            UPDATE inventory_transactions
            SET quantity_in_base_unit = quantity_in_base_unit * 1000,
                unit_cost = unit_cost / 1000
            WHERE ingredient_id = ${existingIngredient[0].id}`
          await tx`
            UPDATE purchase_items
            SET base_unit_quantity = base_unit_quantity * 1000,
                conversion_factor_to_base_unit = conversion_factor_to_base_unit * 1000
            WHERE ingredient_id = ${existingIngredient[0].id}`
        }
        const ingredientRows = existingIngredient[0] ? await tx<{ id: number }[]>`
          UPDATE ingredients SET name=${option.name},base_unit_id=${unit[0].id},minimum_stock_level=${option.minimum},
            preferred_stock_level=${option.preferred},is_active=TRUE,updated_at=NOW()
          WHERE id=${existingIngredient[0].id} RETURNING id` : await tx<{ id: number }[]>`
          INSERT INTO ingredients
            (name,code,category_id,base_unit_id,minimum_stock_level,preferred_stock_level,
             is_inventory_tracked,is_active,notes,created_at,updated_at)
          VALUES (${option.name},${option.code},${category[0].id},${unit[0].id},${option.minimum},
            ${option.preferred},TRUE,TRUE,'ماده اولیه غذای مستقل برنج',NOW(),NOW())
          RETURNING id`
        const ingredientId = ingredientRows[0]!.id

        // Hidden upgrade: its menu price is only the difference between foreign and Persian rice.
        const existingUpgradeFood = await tx<{ id: number }[]>`
          SELECT id FROM foods
          WHERE slug=${option.slug} OR is_persian_rice=TRUE
            OR lower(btrim(name))=lower(btrim(${option.name}))
          ORDER BY CASE WHEN is_persian_rice=TRUE THEN 0 WHEN slug=${option.slug} THEN 1 ELSE 2 END, id
          LIMIT 1`
        const foodRows = existingUpgradeFood[0] ? await tx<{ id: number }[]>`
          UPDATE foods SET name=${option.name},slug=${option.slug},description=${option.description},
            category_id=${foodCategoryId},default_price=${option.price},allows_persian_rice=FALSE,
            is_persian_rice=TRUE,is_active=TRUE,updated_at=NOW()
          WHERE id=${existingUpgradeFood[0].id}
          RETURNING id` : await tx<{ id: number }[]>`
          INSERT INTO foods
            (name,slug,description,category_id,default_price,allows_persian_rice,is_persian_rice,
             is_active,created_at,updated_at)
          VALUES (${option.name},${option.slug},${option.description},${foodCategoryId},${option.price},
            FALSE,TRUE,TRUE,NOW(),NOW())
          RETURNING id`
        const foodId = foodRows[0]!.id

        const existingRecipe = await tx<{ id: number }[]>`
          SELECT id FROM recipes WHERE food_id=${foodId} AND is_active=TRUE LIMIT 1`
        if (!existingRecipe[0]) {
          const recipeRows = await tx<{ id: number }[]>`
            INSERT INTO recipes (food_id,yield_quantity,preparation_loss_percent,overhead_per_portion,
              notes,is_active,created_at,updated_at)
            VALUES (${foodId},1,0,0,'مصرف برنج هر پرس؛ هنگام تأیید سفارش از انبار کم می‌شود.',TRUE,NOW(),NOW())
            RETURNING id`
          await tx`
            INSERT INTO recipe_items (recipe_id,ingredient_id,quantity_in_base_unit,waste_percent,notes)
            VALUES (${recipeRows[0]!.id},${ingredientId},${option.gramsPerPortion}::numeric,0,NULL)`
        }

        // Standalone side dish: an ordinary customer-visible food with a full-portion price. It uses
        // the same rice ingredient as the hidden upgrade, so confirmed orders share real stock.
        const side = standalonePersianRice
        const existingSideFood = await tx<{ id: number }[]>`
          SELECT id FROM foods
          WHERE slug=${side.slug} OR lower(btrim(name))=lower(btrim(${side.name}))
          ORDER BY CASE WHEN slug=${side.slug} THEN 0 ELSE 1 END, id
          LIMIT 1`
        const sideFoodRows = existingSideFood[0] ? await tx<{ id: number }[]>`
          UPDATE foods SET name=${side.name},slug=${side.slug},description=${side.description},
            full_description=${side.fullDescription},ingredients=${side.ingredients},
            portion_description=${side.portionDescription},category_id=${foodCategoryId},
            allows_persian_rice=FALSE,is_persian_rice=FALSE,is_active=TRUE,updated_at=NOW()
          WHERE id=${existingSideFood[0].id}
          RETURNING id` : await tx<{ id: number }[]>`
          INSERT INTO foods
            (name,slug,description,full_description,ingredients,portion_description,category_id,
             default_price,allows_persian_rice,is_persian_rice,is_active,created_at,updated_at)
          VALUES (${side.name},${side.slug},${side.description},${side.fullDescription},
            ${side.ingredients},${side.portionDescription},${foodCategoryId},${side.price},
            FALSE,FALSE,TRUE,NOW(),NOW())
          RETURNING id`
        const sideFoodId = sideFoodRows[0]!.id
        const existingSideRecipe = await tx<{ id: number }[]>`
          SELECT id FROM recipes WHERE food_id=${sideFoodId} AND is_active=TRUE LIMIT 1`
        if (!existingSideRecipe[0]) {
          const recipeRows = await tx<{ id: number }[]>`
            INSERT INTO recipes (food_id,yield_quantity,preparation_loss_percent,overhead_per_portion,
              notes,is_active,created_at,updated_at)
            VALUES (${sideFoodId},1,0,0,'مصرف یک پرس مستقل برنج از موجودی مشترک.',TRUE,NOW(),NOW())
            RETURNING id`
          await tx`
            INSERT INTO recipe_items (recipe_id,ingredient_id,quantity_in_base_unit,waste_percent,notes)
            VALUES (${recipeRows[0]!.id},${ingredientId},${side.gramsPerPortion}::numeric,0,NULL)`
        }
      }
    })
    console.log([
      'Two Persian-rice products are ready and share the same inventory ingredient:',
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
