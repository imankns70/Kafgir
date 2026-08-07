import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import postgres from 'postgres'

const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) loadEnvFile(envPath)
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_OPERATIONAL_DEMO_SEED !== 'true') {
  throw new Error('Rice option demo seed is disabled in production.')
}
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })

/**
 * Foreign rice is what every dish already comes with, priced into the dish. Persian rice is the one
 * paid upgrade, modelled as a standalone food carrying `is_persian_rice`. This seed prepares its
 * ingredient, the food and its recipe. It deliberately does NOT put it on any daily menu and does not
 * flag any dish: price, capacity and which dishes offer the upgrade stay the owner's decisions.
 */
const persianRice = {
  code: 'KFG-RICE-01',
  name: 'برنج ایرانی', slug: 'iranian-rice',
  // The dish price already includes foreign rice, so this is the upgrade difference only.
  price: 55_000,
  description: 'ارتقای برنج غذا از خارجی به ایرانی',
  gramsPerPortion: '250', minimum: 20_000, preferred: 70_000, unitCost: 185,
} as const

async function main() {
  try {
    await sql.begin(async (tx) => {
      const category = await tx<{ id: number }[]>`SELECT id FROM ingredient_categories WHERE name='برنج و غلات' LIMIT 1`
      const unit = await tx<{ id: number }[]>`SELECT id FROM units WHERE name='گرم' OR symbol='g' ORDER BY id LIMIT 1`
      const user = await tx<{ id: number }[]>`SELECT id FROM users WHERE is_active=TRUE ORDER BY id LIMIT 1`
      if (!category[0] || !unit[0] || !user[0]) throw new Error('Seed operational demo data first (category, gram unit and admin user are required).')

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

        const stock = await tx<{ value: number }[]>`
          SELECT COALESCE(SUM(quantity_in_base_unit),0)::float8 value
          FROM inventory_transactions WHERE ingredient_id=${ingredientId}`
        if ((stock[0]?.value ?? 0) <= 0) {
          await tx`INSERT INTO inventory_transactions
            (ingredient_id,transaction_type,quantity_in_base_unit,unit_cost,total_cost,reference_type,
             transaction_group,transaction_date,notes,created_by_user_id,created_at)
            VALUES (${ingredientId},6,50000,${option.unitCost},${50000 * option.unitCost},'rice-option-demo',
              'rice-option-demo',NOW(),'موجودی نمونه برای آموزش انتخاب برنج',${user[0].id},NOW())`
        }

        // The Persian rice food: hidden from the customer grid, offered only as the upgrade.
        const foodRows = await tx<{ id: number }[]>`
          INSERT INTO foods
            (name,slug,description,category_id,default_price,allows_persian_rice,is_persian_rice,
             is_active,created_at,updated_at)
          VALUES (${option.name},${option.slug},${option.description},${foodCategoryId},${option.price},
            FALSE,TRUE,TRUE,NOW(),NOW())
          ON CONFLICT (slug) DO UPDATE SET
            name=EXCLUDED.name, description=EXCLUDED.description, category_id=EXCLUDED.category_id,
            default_price=EXCLUDED.default_price, allows_persian_rice=FALSE,
            is_persian_rice=TRUE, is_active=TRUE, updated_at=NOW()
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
      }
    })
    console.log([
      'The «برنج ایرانی» upgrade food is ready with its ingredient and recipe.',
      "Next, from Admin: add it to today's menu with its price and capacity, then tick",
      '«امکان افزودن برنج ایرانی به این غذا» on every dish that should offer the upgrade.',
      'Its menu price is the upgrade DIFFERENCE — dish prices already include foreign rice.',
    ].join('\n'))
  } finally {
    await sql.end()
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
