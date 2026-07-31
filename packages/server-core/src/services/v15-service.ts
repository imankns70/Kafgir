import {
  CustomerPaymentMethod,
  FinancialTransactionType,
  InventoryTransactionType,
  PaymentStatus,
  PurchasePaymentStatus,
  PurchaseStatus,
  type AccountTransferRequest,
  type FinancialAccountWriteRequest,
  type FinancialEntryRequest,
  type IngredientWriteRequest,
  type InventoryAdjustmentRequest,
  type PaymentStatusWriteRequest,
  type PaymentWriteRequest,
  type PosTerminalWriteRequest,
  type PurchaseWriteRequest,
  type RecipeWriteRequest,
  type StockCountRequest,
  type SupplierWriteRequest,
  type UnitWriteRequest,
  type WasteWriteRequest,
  type PurchasePaymentWriteRequest,
  type ShoppingListCreateRequest,
} from '@kafgir/contracts'
import type { TransactionSql } from 'postgres'
import { sqlClient } from '../db/client'
import { AppError, NotFoundError } from '../errors'
import { logger } from '../logging/logger'

type Tx = TransactionSql<Record<string, unknown>>
const nowIso = () => new Date().toISOString()
const nullable = (value: string | null | undefined) => value?.trim() || null

export async function listUnits() {
  return sqlClient`SELECT id, name, symbol, is_active AS "isActive",
    created_at AS "createdAt", updated_at AS "updatedAt" FROM units ORDER BY name`
}
export async function saveUnit(id: number | null, input: UnitWriteRequest) {
  const now = nowIso()
  if (id) {
    const rows = await sqlClient`UPDATE units SET name=${input.name}, symbol=${input.symbol},
      is_active=${input.isActive}, updated_at=${now} WHERE id=${id} RETURNING *`
    if (!rows[0]) throw new NotFoundError('واحد اندازه‌گیری یافت نشد.')
  } else {
    await sqlClient`INSERT INTO units (name,symbol,is_active,created_at,updated_at)
      VALUES (${input.name},${input.symbol},${input.isActive},${now},${now})`
  }
}

export async function listIngredientCategories() {
  return sqlClient`SELECT id,name,is_active AS "isActive",created_at AS "createdAt",updated_at AS "updatedAt"
    FROM ingredient_categories ORDER BY name`
}
export async function saveIngredientCategory(id: number | null, name: string, isActive: boolean) {
  const now = nowIso()
  if (id) {
    await sqlClient`UPDATE ingredient_categories SET name=${name},is_active=${isActive},updated_at=${now} WHERE id=${id}`
  } else {
    await sqlClient`INSERT INTO ingredient_categories (name,is_active,created_at,updated_at)
      VALUES (${name},${isActive},${now},${now})`
  }
}

export async function listIngredients(search = '', active?: boolean) {
  const value = search.trim() || null
  return sqlClient`
    SELECT i.id,i.name,i.code,i.category_id AS "categoryId",c.name AS "categoryName",
      i.base_unit_id AS "baseUnitId",u.name AS "baseUnitName",
      i.minimum_stock_level::text AS "minimumStockLevel",
      i.preferred_stock_level::text AS "preferredStockLevel",
      i.is_inventory_tracked AS "isInventoryTracked",i.is_active AS "isActive",i.notes,
      COALESCE(SUM(t.quantity_in_base_unit),0)::text AS "currentStock",
      (SELECT pi.unit_price::float8 FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id
       WHERE pi.ingredient_id=i.id AND p.status=${PurchaseStatus.Confirmed}
       ORDER BY p.confirmed_at DESC LIMIT 1) AS "latestPurchasePrice",
      COALESCE((SELECT SUM(it.total_cost)/NULLIF(SUM(it.quantity_in_base_unit),0)
        FROM inventory_transactions it WHERE it.ingredient_id=i.id
        AND it.transaction_type IN (${InventoryTransactionType.PurchaseIn},${InventoryTransactionType.PurchaseReversal})),0)::float8
        AS "weightedAverageCost",
      i.created_at AS "createdAt",i.updated_at AS "updatedAt"
    FROM ingredients i JOIN units u ON u.id=i.base_unit_id
    LEFT JOIN ingredient_categories c ON c.id=i.category_id
    LEFT JOIN inventory_transactions t ON t.ingredient_id=i.id
    WHERE (${value}::text IS NULL OR i.name ILIKE '%'||${value}||'%' OR i.code ILIKE '%'||${value}||'%')
      AND (${active ?? null}::boolean IS NULL OR i.is_active=${active ?? null})
    GROUP BY i.id,c.name,u.name ORDER BY i.name`
}
export async function saveIngredient(id: number | null, input: IngredientWriteRequest) {
  const now = nowIso()
  await sqlClient.begin(async (tx) => {
    if (id) {
      const movements = await tx<{ count: number }[]>`
        SELECT COUNT(*)::int count FROM inventory_transactions WHERE ingredient_id=${id}`
      const current = await tx<{ baseUnitId: number }[]>`
        SELECT base_unit_id AS "baseUnitId" FROM ingredients WHERE id=${id} FOR UPDATE`
      if (!current[0]) throw new NotFoundError('ماده اولیه یافت نشد.')
      if (movements[0]!.count > 0 && current[0].baseUnitId !== input.baseUnitId) {
        throw new AppError('پس از ثبت گردش انبار، واحد پایه قابل تغییر نیست.')
      }
      await tx`UPDATE ingredients SET name=${input.name},code=${nullable(input.code)},
        category_id=${input.categoryId ?? null},base_unit_id=${input.baseUnitId},
        minimum_stock_level=${input.minimumStockLevel}::numeric,
        preferred_stock_level=${input.preferredStockLevel ?? null}::numeric,
        is_inventory_tracked=${input.isInventoryTracked},is_active=${input.isActive},
        notes=${nullable(input.notes)},updated_at=${now} WHERE id=${id}`
    } else {
      await tx`INSERT INTO ingredients
        (name,code,category_id,base_unit_id,minimum_stock_level,preferred_stock_level,
         is_inventory_tracked,is_active,notes,created_at,updated_at)
        VALUES (${input.name},${nullable(input.code)},${input.categoryId ?? null},${input.baseUnitId},
          ${input.minimumStockLevel}::numeric,${input.preferredStockLevel ?? null}::numeric,
          ${input.isInventoryTracked},${input.isActive},${nullable(input.notes)},${now},${now})`
    }
  })
}

export async function listSuppliers() {
  return sqlClient`SELECT id,name,contact_name AS "contactName",mobile,phone,address,notes,
    is_active AS "isActive",created_at AS "createdAt",updated_at AS "updatedAt" FROM suppliers ORDER BY name`
}
export async function saveSupplier(id: number | null, input: SupplierWriteRequest) {
  const now = nowIso()
  if (id) {
    await sqlClient`UPDATE suppliers SET name=${input.name},contact_name=${nullable(input.contactName)},
      mobile=${nullable(input.mobile)},phone=${nullable(input.phone)},address=${nullable(input.address)},
      notes=${nullable(input.notes)},is_active=${input.isActive},updated_at=${now} WHERE id=${id}`
  } else {
    await sqlClient`INSERT INTO suppliers
      (name,contact_name,mobile,phone,address,notes,is_active,created_at,updated_at)
      VALUES (${input.name},${nullable(input.contactName)},${nullable(input.mobile)},${nullable(input.phone)},
        ${nullable(input.address)},${nullable(input.notes)},${input.isActive},${now},${now})`
  }
}

async function purchaseNumber(tx: Tx) {
  await tx`SELECT pg_advisory_xact_lock(15001)`
  const rows = await tx<{ number: number }[]>`SELECT COALESCE(MAX(id),0)+1 AS number FROM purchases`
  return `KHP-${new Date().getFullYear()}-${String(rows[0]!.number).padStart(6, '0')}`
}
export async function createPurchase(input: PurchaseWriteRequest, userId: number) {
  return sqlClient.begin(async (tx) => {
    const now = nowIso()
    const number = await purchaseNumber(tx)
    const purchase = await tx<{ id: number }[]>`
      INSERT INTO purchases
        (purchase_number,supplier_id,invoice_number,purchase_date,status,subtotal_amount,
         discount_amount,additional_cost_amount,total_amount,paid_amount,payment_status,notes,
         attachment_url,created_by_user_id,created_at,updated_at)
      VALUES (${number},${input.supplierId ?? null},${nullable(input.invoiceNumber)},${input.purchaseDate},
        ${PurchaseStatus.Draft},0,${input.discountAmount},${input.additionalCostAmount},0,0,
        ${PurchasePaymentStatus.Unpaid},${nullable(input.notes)},${nullable(input.attachmentUrl)},${userId},${now},${now})
      RETURNING id`
    for (const item of input.items) {
      const ingredient = await tx<{ isActive: boolean }[]>`
        SELECT is_active AS "isActive" FROM ingredients WHERE id=${item.ingredientId}`
      if (!ingredient[0]?.isActive) throw new AppError('ماده اولیه غیرفعال یا نامعتبر است.')
      await tx`INSERT INTO purchase_items
        (purchase_id,ingredient_id,purchase_unit_id,quantity,conversion_factor_to_base_unit,
         base_unit_quantity,unit_price,line_discount_amount,line_total_amount,expiration_date,batch_number,notes)
        VALUES (${purchase[0]!.id},${item.ingredientId},${item.purchaseUnitId},${item.quantity}::numeric,
          ${item.conversionFactorToBaseUnit}::numeric,
          (${item.quantity}::numeric*${item.conversionFactorToBaseUnit}::numeric),
          ${item.unitPrice},${item.lineDiscountAmount},
          (${item.quantity}::numeric*${item.unitPrice}::numeric-${item.lineDiscountAmount}::numeric),
          ${item.expirationDate ?? null},${nullable(item.batchNumber)},${nullable(item.notes)})`
    }
    await tx`UPDATE purchases p SET
      subtotal_amount=x.subtotal,total_amount=x.subtotal-p.discount_amount+p.additional_cost_amount
      FROM (SELECT purchase_id,SUM(line_total_amount) subtotal FROM purchase_items
        WHERE purchase_id=${purchase[0]!.id} GROUP BY purchase_id) x
      WHERE p.id=x.purchase_id`
    const valid = await tx<{ total: number }[]>`SELECT total_amount::float8 total FROM purchases WHERE id=${purchase[0]!.id}`
    if (valid[0]!.total < 0) throw new AppError('مبلغ نهایی خرید نمی‌تواند منفی باشد.')
    return purchase[0]!.id
  })
}
export async function listPurchases(status?: number) {
  return sqlClient`SELECT p.id,p.purchase_number AS "purchaseNumber",p.purchase_date AS "purchaseDate",
    p.status,p.total_amount::float8 AS "totalAmount",p.paid_amount::float8 AS "paidAmount",
    p.payment_status AS "paymentStatus",p.supplier_id AS "supplierId",s.name AS "supplierName",
    p.created_at AS "createdAt",p.confirmed_at AS "confirmedAt"
    FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id
    WHERE (${status ?? null}::int IS NULL OR p.status=${status ?? null}) ORDER BY p.purchase_date DESC,p.id DESC`
}
export async function confirmPurchase(id: number, userId: number) {
  await sqlClient.begin(async (tx) => {
    const purchase = await tx<{ status: number }[]>`SELECT status FROM purchases WHERE id=${id} FOR UPDATE`
    if (!purchase[0]) throw new NotFoundError('خرید یافت نشد.')
    if (purchase[0].status === PurchaseStatus.Confirmed) return
    if (purchase[0].status !== PurchaseStatus.Draft) throw new AppError('فقط خرید پیش‌نویس قابل تأیید است.')
    const now = nowIso()
    await tx`
      INSERT INTO inventory_transactions
        (ingredient_id,transaction_type,quantity_in_base_unit,unit_cost,total_cost,reference_type,
         reference_id,transaction_group,transaction_date,created_by_user_id,created_at)
      SELECT ingredient_id,${InventoryTransactionType.PurchaseIn},base_unit_quantity,
        CASE WHEN base_unit_quantity=0 THEN 0 ELSE line_total_amount/base_unit_quantity END,
        line_total_amount,'purchase',${id},${`purchase:${id}`},${now},${userId},${now}
      FROM purchase_items WHERE purchase_id=${id}`
    await tx`UPDATE purchases SET status=${PurchaseStatus.Confirmed},confirmed_by_user_id=${userId},
      confirmed_at=${now},updated_at=${now} WHERE id=${id}`
    await audit(tx, userId, 'purchase.confirm', 'purchase', id)
  })
}
export async function cancelPurchase(id: number, userId: number) {
  await sqlClient.begin(async (tx) => {
    const purchase = await tx<{ status: number; paidAmount: number }[]>`
      SELECT status,paid_amount::float8 AS "paidAmount" FROM purchases WHERE id=${id} FOR UPDATE`
    if (!purchase[0]) throw new NotFoundError('خرید یافت نشد.')
    if (purchase[0].status === PurchaseStatus.Cancelled) return
    if (purchase[0].paidAmount > 0) throw new AppError('خرید دارای پرداخت است و ابتدا باید پرداخت آن اصلاح شود.')
    const now = nowIso()
    if (purchase[0].status === PurchaseStatus.Confirmed) {
      const source = await tx<{ id: number; ingredientId: number; quantity: string; unitCost: number; totalCost: number }[]>`
        SELECT id,ingredient_id AS "ingredientId",quantity_in_base_unit::text quantity,
          unit_cost::float8 AS "unitCost",total_cost::float8 AS "totalCost"
        FROM inventory_transactions WHERE reference_type='purchase' AND reference_id=${id}
          AND transaction_type=${InventoryTransactionType.PurchaseIn} FOR UPDATE`
      for (const movement of source) {
        const stock = await currentStock(tx, movement.ingredientId)
        if (Number(stock) < Number(movement.quantity)) throw new AppError('به دلیل مصرف شدن موجودی، برگشت این خرید امن نیست.')
        await tx`INSERT INTO inventory_transactions
          (ingredient_id,transaction_type,quantity_in_base_unit,unit_cost,total_cost,reference_type,
           reference_id,transaction_group,transaction_date,created_by_user_id,reversed_transaction_id,created_at)
          VALUES (${movement.ingredientId},${InventoryTransactionType.PurchaseReversal},
            -${movement.quantity}::numeric,${movement.unitCost},-${movement.totalCost},'purchase',${id},
            ${`purchase-reversal:${id}`},${now},${userId},${movement.id},${now})`
      }
    }
    await tx`UPDATE purchases SET status=${PurchaseStatus.Cancelled},updated_at=${now} WHERE id=${id}`
    await audit(tx, userId, 'purchase.cancel', 'purchase', id)
  })
}

async function currentStock(tx: Tx, ingredientId: number) {
  const rows = await tx<{ stock: string }[]>`
    SELECT COALESCE(SUM(quantity_in_base_unit),0)::text stock FROM inventory_transactions
    WHERE ingredient_id=${ingredientId}`
  return rows[0]!.stock
}
async function weightedCost(tx: Tx, ingredientId: number) {
  const rows = await tx<{ cost: number }[]>`
    SELECT COALESCE(SUM(total_cost)/NULLIF(SUM(quantity_in_base_unit),0),0)::float8 cost
    FROM inventory_transactions WHERE ingredient_id=${ingredientId}
      AND transaction_type IN (${InventoryTransactionType.PurchaseIn},${InventoryTransactionType.PurchaseReversal})`
  return rows[0]!.cost
}
async function insertMovement(tx: Tx, input: {
  ingredientId: number; type: InventoryTransactionType; quantity: string; userId: number;
  referenceType: string; referenceId?: number; notes?: string | null; date?: string; group?: string;
}) {
  const cost = await weightedCost(tx, input.ingredientId)
  await tx`INSERT INTO inventory_transactions
    (ingredient_id,transaction_type,quantity_in_base_unit,unit_cost,total_cost,reference_type,reference_id,
     transaction_group,transaction_date,notes,created_by_user_id,created_at)
    VALUES (${input.ingredientId},${input.type},${input.quantity}::numeric,${cost},
      (${input.quantity}::numeric*${cost}::numeric),${input.referenceType},${input.referenceId ?? null},
      ${input.group ?? null},${input.date ?? nowIso()},${nullable(input.notes)},${input.userId},${nowIso()})`
}
export async function listInventoryMovements(ingredientId?: number) {
  return sqlClient`SELECT t.id,t.ingredient_id AS "ingredientId",i.name AS "ingredientName",
    t.transaction_type AS "transactionType",t.quantity_in_base_unit::text AS "quantityInBaseUnit",
    t.unit_cost::float8 AS "unitCost",t.total_cost::float8 AS "totalCost",
    t.reference_type AS "referenceType",t.reference_id AS "referenceId",
    t.transaction_date AS "transactionDate",t.notes,t.reversed_transaction_id AS "reversedTransactionId",
    t.created_at AS "createdAt" FROM inventory_transactions t JOIN ingredients i ON i.id=t.ingredient_id
    WHERE (${ingredientId ?? null}::int IS NULL OR t.ingredient_id=${ingredientId ?? null})
    ORDER BY t.transaction_date DESC,t.id DESC LIMIT 500`
}
export async function adjustInventory(input: InventoryAdjustmentRequest, userId: number) {
  await sqlClient.begin(async (tx) => {
    const signed = input.type === 'increase' ? input.quantity : `-${input.quantity}`
    if (input.type === 'decrease' && Number(await currentStock(tx, input.ingredientId)) < Number(input.quantity)) {
      throw new AppError('موجودی برای این کاهش کافی نیست.')
    }
    await insertMovement(tx, { ingredientId: input.ingredientId,
      type: input.type === 'increase' ? InventoryTransactionType.ManualIncrease : InventoryTransactionType.ManualDecrease,
      quantity: signed, userId, referenceType: 'manual-adjustment',
      notes: `${input.reason}${input.notes ? ` - ${input.notes}` : ''}`, date: input.transactionDate })
    await audit(tx, userId, 'inventory.adjust', 'ingredient', input.ingredientId)
  })
}
export async function registerWaste(input: WasteWriteRequest, userId: number) {
  await sqlClient.begin(async (tx) => {
    if (Number(await currentStock(tx, input.ingredientId)) < Number(input.quantity)) throw new AppError('موجودی کافی نیست.')
    await insertMovement(tx, { ingredientId: input.ingredientId, type: InventoryTransactionType.WasteOut,
      quantity: `-${input.quantity}`, userId, referenceType: 'waste',
      notes: `${input.reason}${input.notes ? ` - ${input.notes}` : ''}`, date: input.transactionDate })
    await audit(tx, userId, 'inventory.waste', 'ingredient', input.ingredientId)
  })
}
export async function confirmStockCount(input: StockCountRequest, userId: number) {
  await sqlClient.begin(async (tx) => {
    const group = `stock-count:${crypto.randomUUID()}`
    for (const item of input.items) {
      const current = await currentStock(tx, item.ingredientId)
      const difference = await tx<{ value: string }[]>`SELECT (${item.countedQuantity}::numeric-${current}::numeric)::text value`
      if (difference[0]!.value !== '0.000000') await insertMovement(tx, {
        ingredientId: item.ingredientId, type: InventoryTransactionType.StockCountAdjustment,
        quantity: difference[0]!.value, userId, referenceType: 'stock-count', notes: input.notes, group,
      })
    }
    await audit(tx, userId, 'inventory.stock-count', 'stock-count', null)
  })
}

export async function getRecipe(foodId: number) {
  const recipe = await sqlClient`
    SELECT r.id,r.food_id AS "foodId",f.name AS "foodName",r.yield_quantity AS "yieldQuantity",
      r.preparation_loss_percent::float8 AS "preparationLossPercent",
      r.overhead_per_portion::float8 AS "overheadPerPortion",r.notes,r.is_active AS "isActive"
    FROM recipes r JOIN foods f ON f.id=r.food_id WHERE r.food_id=${foodId} AND r.is_active=true`
  if (!recipe[0]) return null
  const items = await sqlClient`
    SELECT ri.id,ri.ingredient_id AS "ingredientId",i.name AS "ingredientName",u.name AS "unitName",
      ri.quantity_in_base_unit::text AS "quantityInBaseUnit",
      (ri.quantity_in_base_unit/r.yield_quantity)::text AS "quantityPerPortion",
      ri.waste_percent::float8 AS "wastePercent",
      COALESCE(c.cost,0)::float8 AS "weightedAverageCost",
      (ri.quantity_in_base_unit*COALESCE(c.cost,0)*(1+COALESCE(ri.waste_percent,0)/100))::float8 AS "ingredientCost",
      ri.notes
    FROM recipe_items ri JOIN recipes r ON r.id=ri.recipe_id
    JOIN ingredients i ON i.id=ri.ingredient_id JOIN units u ON u.id=i.base_unit_id
    LEFT JOIN LATERAL (SELECT SUM(total_cost)/NULLIF(SUM(quantity_in_base_unit),0) cost
      FROM inventory_transactions WHERE ingredient_id=i.id
      AND transaction_type IN (${InventoryTransactionType.PurchaseIn},${InventoryTransactionType.PurchaseReversal})) c ON true
    WHERE ri.recipe_id=${recipe[0].id} ORDER BY ri.id`
  const total = items.reduce((sum, item) => sum + Number(item.ingredientCost), 0)
  const row = recipe[0] as { yieldQuantity: number; overheadPerPortion: number }
  const costPerPortion = total / row.yieldQuantity + row.overheadPerPortion
  const price = await sqlClient<{ price: number | null }[]>`
    SELECT price::float8 FROM daily_menu_items WHERE food_id=${foodId} ORDER BY id DESC LIMIT 1`
  const salePrice = price[0]?.price ?? null
  return { ...recipe[0], items, totalRecipeCost: total, costPerPortion, salePrice,
    estimatedGrossProfit: salePrice === null ? null : salePrice - costPerPortion,
    marginPercent: salePrice ? ((salePrice - costPerPortion) / salePrice) * 100 : null }
}
export async function saveRecipe(foodId: number, input: RecipeWriteRequest, userId: number) {
  await sqlClient.begin(async (tx) => {
    const now = nowIso()
    const existing = await tx<{ id: number }[]>`SELECT id FROM recipes WHERE food_id=${foodId} AND is_active=true FOR UPDATE`
    const recipeId = existing[0]?.id ?? (await tx<{ id: number }[]>`
      INSERT INTO recipes (food_id,yield_quantity,preparation_loss_percent,overhead_per_portion,
        notes,is_active,created_at,updated_at)
      VALUES (${foodId},${input.yieldQuantity},${input.preparationLossPercent ?? null},
        ${input.overheadPerPortion},${nullable(input.notes)},${input.isActive},${now},${now}) RETURNING id`)[0]!.id
    if (existing[0]) {
      await tx`UPDATE recipes SET yield_quantity=${input.yieldQuantity},
        preparation_loss_percent=${input.preparationLossPercent ?? null},
        overhead_per_portion=${input.overheadPerPortion},notes=${nullable(input.notes)},
        is_active=${input.isActive},updated_at=${now} WHERE id=${recipeId}`
      await tx`DELETE FROM recipe_items WHERE recipe_id=${recipeId}`
    }
    for (const item of input.items) {
      const active = await tx<{ active: boolean }[]>`SELECT is_active active FROM ingredients WHERE id=${item.ingredientId}`
      if (!active[0]?.active) throw new AppError('ماده اولیه غیرفعال را نمی‌توان به دستور پخت افزود.')
      await tx`INSERT INTO recipe_items (recipe_id,ingredient_id,quantity_in_base_unit,waste_percent,notes)
        VALUES (${recipeId},${item.ingredientId},${item.quantityInBaseUnit}::numeric,
          ${item.wastePercent ?? null},${nullable(item.notes)})`
    }
    await audit(tx, userId, 'recipe.save', 'food', foodId)
  })
}

export async function consumeOrderInventory(tx: Tx, orderId: number, userId: number) {
  const lines = await tx<{ orderItemId: number; foodId: number; quantity: number; recipeId: number | null }[]>`
    SELECT oi.id AS "orderItemId",d.food_id AS "foodId",oi.quantity,r.id AS "recipeId"
    FROM order_items oi JOIN daily_menu_items d ON d.id=oi.daily_menu_item_id
    LEFT JOIN recipes r ON r.food_id=d.food_id AND r.is_active=true WHERE oi.order_id=${orderId}`
  for (const line of lines) {
    const existing = await tx`SELECT id FROM order_inventory_consumptions WHERE order_item_id=${line.orderItemId}`
    if (existing[0]) continue
    const group = `order:${orderId}:item:${line.orderItemId}`
    const consumption = await tx<{ id: number }[]>`
      INSERT INTO order_inventory_consumptions
        (order_id,order_item_id,food_id,recipe_id,quantity_produced,transaction_group,recipe_missing,consumed_at)
      VALUES (${orderId},${line.orderItemId},${line.foodId},${line.recipeId},${line.quantity},${group},
        ${line.recipeId === null},${nowIso()}) RETURNING id`
    if (!line.recipeId) continue
    const recipeItems = await tx<{ ingredientId: number; needed: string }[]>`
      SELECT ri.ingredient_id AS "ingredientId",
        (ri.quantity_in_base_unit*${line.quantity}::numeric/r.yield_quantity*
          (1+COALESCE(ri.waste_percent,0)/100))::numeric(20,6)::text needed
      FROM recipe_items ri JOIN recipes r ON r.id=ri.recipe_id WHERE ri.recipe_id=${line.recipeId}`
    for (const item of recipeItems) {
      await insertMovement(tx, { ingredientId: item.ingredientId,
        type: InventoryTransactionType.ProductionConsumption, quantity: `-${item.needed}`, userId,
        referenceType: 'order-consumption', referenceId: consumption[0]!.id, group })
    }
  }
}
export async function reverseOrderInventory(tx: Tx, orderId: number, userId: number) {
  const consumptions = await tx<{ id: number }[]>`
    SELECT id FROM order_inventory_consumptions WHERE order_id=${orderId} AND reversed_at IS NULL FOR UPDATE`
  for (const consumption of consumptions) {
    const sources = await tx<{ id: number; ingredientId: number; quantity: string; unitCost: number; totalCost: number }[]>`
      SELECT id,ingredient_id AS "ingredientId",quantity_in_base_unit::text quantity,
        unit_cost::float8 AS "unitCost",total_cost::float8 AS "totalCost"
      FROM inventory_transactions WHERE reference_type='order-consumption' AND reference_id=${consumption.id}`
    for (const source of sources) {
      await tx`INSERT INTO inventory_transactions
        (ingredient_id,transaction_type,quantity_in_base_unit,unit_cost,total_cost,reference_type,
         reference_id,transaction_group,transaction_date,created_by_user_id,reversed_transaction_id,created_at)
        VALUES (${source.ingredientId},${InventoryTransactionType.OrderCancellationReversal},
          -${source.quantity}::numeric,${source.unitCost},-${source.totalCost},'order-consumption',
          ${consumption.id},${`order-reversal:${orderId}`},${nowIso()},${userId},${source.id},${nowIso()})`
    }
    await tx`UPDATE order_inventory_consumptions SET reversed_at=${nowIso()} WHERE id=${consumption.id}`
  }
}

export async function listFinancialAccounts() {
  return sqlClient`SELECT a.id,a.name,a.type,a.bank_name AS "bankName",a.card_number_masked AS "cardNumberMasked",
    a.account_number_masked AS "accountNumberMasked",a.iban_masked AS "ibanMasked",
    a.opening_balance::float8 AS "openingBalance",
    (a.opening_balance+COALESCE(SUM(t.amount),0))::float8 AS "currentBalance",
    a.is_active AS "isActive",a.notes,a.created_at AS "createdAt",a.updated_at AS "updatedAt"
    FROM financial_accounts a LEFT JOIN financial_transactions t ON t.financial_account_id=a.id
    GROUP BY a.id ORDER BY a.name`
}
export async function saveFinancialAccount(id: number | null, input: FinancialAccountWriteRequest) {
  const now = nowIso()
  if (id) await sqlClient`UPDATE financial_accounts SET name=${input.name},type=${input.type},
    bank_name=${nullable(input.bankName)},card_number_masked=${nullable(input.cardNumberMasked)},
    account_number_masked=${nullable(input.accountNumberMasked)},iban_masked=${nullable(input.ibanMasked)},
    opening_balance=${input.openingBalance},is_active=${input.isActive},notes=${nullable(input.notes)},
    updated_at=${now} WHERE id=${id}`
  else await sqlClient`INSERT INTO financial_accounts
    (name,type,bank_name,card_number_masked,account_number_masked,iban_masked,opening_balance,
     is_active,notes,created_at,updated_at)
    VALUES (${input.name},${input.type},${nullable(input.bankName)},${nullable(input.cardNumberMasked)},
      ${nullable(input.accountNumberMasked)},${nullable(input.ibanMasked)},${input.openingBalance},
      ${input.isActive},${nullable(input.notes)},${now},${now})`
}
export async function listPosTerminals() {
  return sqlClient`SELECT p.id,p.title,p.terminal_number AS "terminalNumber",
    p.merchant_number AS "merchantNumber",p.financial_account_id AS "financialAccountId",
    a.name AS "financialAccountName",p.is_active AS "isActive",p.notes
    FROM pos_terminals p JOIN financial_accounts a ON a.id=p.financial_account_id ORDER BY p.title`
}
export async function savePosTerminal(id: number | null, input: PosTerminalWriteRequest) {
  const now = nowIso()
  if (id) await sqlClient`UPDATE pos_terminals SET title=${input.title},terminal_number=${input.terminalNumber},
    merchant_number=${nullable(input.merchantNumber)},financial_account_id=${input.financialAccountId},
    is_active=${input.isActive},notes=${nullable(input.notes)},updated_at=${now} WHERE id=${id}`
  else await sqlClient`INSERT INTO pos_terminals
    (title,terminal_number,merchant_number,financial_account_id,is_active,notes,created_at,updated_at)
    VALUES (${input.title},${input.terminalNumber},${nullable(input.merchantNumber)},${input.financialAccountId},
      ${input.isActive},${nullable(input.notes)},${now},${now})`
}
export async function createPayment(input: PaymentWriteRequest, userId: number) {
  return sqlClient.begin(async (tx) => {
    if (input.paymentMethod === CustomerPaymentMethod.Pos && !input.posTerminalId) {
      throw new AppError('برای پرداخت پوز، انتخاب دستگاه الزامی است.')
    }
    const status = input.paymentMethod === CustomerPaymentMethod.CardToCard
      ? PaymentStatus.AwaitingVerification : PaymentStatus.Pending
    const rows = await tx<{ id: number }[]>`INSERT INTO payments
      (order_id,payment_method,financial_account_id,pos_terminal_id,amount,status,tracking_number,
       reference_number,receipt_image_url,description,created_at,updated_at)
      VALUES (${input.orderId},${input.paymentMethod},${input.financialAccountId},${input.posTerminalId ?? null},
        ${input.amount},${status},${nullable(input.trackingNumber)},${nullable(input.referenceNumber)},
        ${nullable(input.receiptImageUrl)},${nullable(input.description)},${nowIso()},${nowIso()}) RETURNING id`
    return rows[0]!.id
  })
}
export async function changePaymentStatus(id: number, input: PaymentStatusWriteRequest, userId: number) {
  await sqlClient.begin(async (tx) => {
    const payment = await tx<{ status: number; amount: number; accountId: number }[]>`
      SELECT status,amount::float8 amount,financial_account_id AS "accountId" FROM payments WHERE id=${id} FOR UPDATE`
    if (!payment[0]) throw new NotFoundError('پرداخت یافت نشد.')
    if (payment[0].status === input.status) return
    if (input.status === PaymentStatus.Paid) {
      await tx`INSERT INTO financial_transactions
        (transaction_type,financial_account_id,amount,transaction_date,reference_type,reference_id,
         description,created_by_user_id,created_at)
        VALUES (${FinancialTransactionType.SalesIncome},${payment[0].accountId},${payment[0].amount},
          ${nowIso()},'payment',${id},'دریافت وجه سفارش',${userId},${nowIso()}) ON CONFLICT DO NOTHING`
    }
    await tx`UPDATE payments SET status=${input.status},description=COALESCE(${nullable(input.description)},description),
      paid_at=CASE WHEN ${input.status}=${PaymentStatus.Paid} THEN ${nowIso()} ELSE paid_at END,
      confirmed_at=CASE WHEN ${input.status}=${PaymentStatus.Paid} THEN ${nowIso()} ELSE confirmed_at END,
      confirmed_by_user_id=CASE WHEN ${input.status}=${PaymentStatus.Paid} THEN ${userId} ELSE confirmed_by_user_id END,
      updated_at=${nowIso()} WHERE id=${id}`
    await audit(tx, userId, 'payment.status', 'payment', id, String(input.status))
  })
}
export async function createFinancialEntry(input: FinancialEntryRequest, kind: 'income' | 'expense', userId: number) {
  await sqlClient.begin(async (tx) => {
    const signed = kind === 'income' ? input.amount : -input.amount
    await tx`INSERT INTO financial_transactions
      (transaction_type,financial_account_id,amount,transaction_date,category_id,reference_type,
       description,created_by_user_id,created_at)
      VALUES (${kind === 'income' ? FinancialTransactionType.ManualIncome : FinancialTransactionType.ManualExpense},
        ${input.financialAccountId},${signed},${input.transactionDate ?? nowIso()},${input.categoryId ?? null},
        ${kind === 'income' ? 'manual-income' : 'manual-expense'},${input.description},${userId},${nowIso()})`
    await audit(tx, userId, `finance.${kind}`, 'financial-account', input.financialAccountId)
  })
}
export async function transfer(input: AccountTransferRequest, userId: number) {
  await sqlClient.begin(async (tx) => {
    const group = `transfer:${crypto.randomUUID()}`
    const date = input.transactionDate ?? nowIso()
    await tx`INSERT INTO financial_transactions
      (transaction_type,financial_account_id,amount,transaction_date,reference_type,transaction_group,
       description,created_by_user_id,created_at)
      VALUES
      (${FinancialTransactionType.TransferOut},${input.fromAccountId},-${input.amount},${date},'transfer',${group},
       ${input.description},${userId},${nowIso()}),
      (${FinancialTransactionType.TransferIn},${input.toAccountId},${input.amount},${date},'transfer',${group},
       ${input.description},${userId},${nowIso()})`
    await audit(tx, userId, 'finance.transfer', 'financial-account', input.fromAccountId, group)
  })
}
export async function listFinancialTransactions(from?: string, to?: string) {
  return sqlClient`SELECT t.id,t.transaction_type AS "transactionType",t.financial_account_id AS "financialAccountId",
    a.name AS "financialAccountName",t.amount::float8 amount,t.transaction_date AS "transactionDate",
    c.name AS "categoryName",t.reference_type AS "referenceType",t.reference_id AS "referenceId",t.description
    FROM financial_transactions t JOIN financial_accounts a ON a.id=t.financial_account_id
    LEFT JOIN expense_categories c ON c.id=t.category_id
    WHERE (${from ?? null}::date IS NULL OR t.transaction_date>=${from ?? null}::date)
      AND (${to ?? null}::date IS NULL OR t.transaction_date<(${to ?? null}::date+1))
    ORDER BY t.transaction_date DESC,t.id DESC LIMIT 1000`
}
export async function registerPurchasePayment(input: PurchasePaymentWriteRequest, userId: number) {
  await sqlClient.begin(async (tx) => {
    const purchase = await tx<{ status: number; total: number; paid: number }[]>`
      SELECT status,total_amount::float8 total,paid_amount::float8 paid FROM purchases
      WHERE id=${input.purchaseId} FOR UPDATE`
    if (!purchase[0]) throw new NotFoundError('خرید یافت نشد.')
    if (purchase[0].status !== PurchaseStatus.Confirmed) throw new AppError('پرداخت فقط برای خرید تأییدشده ثبت می‌شود.')
    if (purchase[0].paid + input.amount > purchase[0].total) throw new AppError('مبلغ پرداخت از مانده خرید بیشتر است.')
    const now = nowIso()
    const row = await tx<{ id: number }[]>`INSERT INTO purchase_payments
      (purchase_id,financial_account_id,amount,payment_method,paid_at,tracking_number,notes,
       created_by_user_id,created_at)
      VALUES (${input.purchaseId},${input.financialAccountId},${input.amount},1,${input.paidAt ?? now},
        ${nullable(input.trackingNumber)},${nullable(input.notes)},${userId},${now}) RETURNING id`
    await tx`INSERT INTO financial_transactions
      (transaction_type,financial_account_id,amount,transaction_date,reference_type,reference_id,
       description,created_by_user_id,created_at)
      VALUES (${FinancialTransactionType.PurchaseExpense},${input.financialAccountId},-${input.amount},
        ${input.paidAt ?? now},'purchase-payment',${row[0]!.id},'پرداخت خرید',${userId},${now})`
    await tx`UPDATE purchases SET paid_amount=paid_amount+${input.amount},
      payment_status=CASE WHEN paid_amount+${input.amount}>=total_amount THEN ${PurchasePaymentStatus.Paid}
        ELSE ${PurchasePaymentStatus.PartiallyPaid} END,updated_at=${now} WHERE id=${input.purchaseId}`
    await audit(tx,userId,'purchase.payment','purchase',input.purchaseId)
  })
}
export async function listPayments() {
  return sqlClient`SELECT p.id,p.order_id AS "orderId",o.order_number AS "orderNumber",
    p.payment_method AS "paymentMethod",p.amount::float8 amount,p.status,
    p.financial_account_id AS "financialAccountId",a.name AS "financialAccountName",
    p.pos_terminal_id AS "posTerminalId",p.tracking_number AS "trackingNumber",
    p.receipt_image_url AS "receiptImageUrl",p.created_at AS "createdAt"
    FROM payments p JOIN orders o ON o.id=p.order_id JOIN financial_accounts a ON a.id=p.financial_account_id
    ORDER BY p.created_at DESC LIMIT 500`
}
export async function refundPayment(id: number, userId: number) {
  await sqlClient.begin(async (tx) => {
    const p=await tx<{status:number;amount:number;accountId:number}[]>`
      SELECT status,amount::float8 amount,financial_account_id AS "accountId" FROM payments WHERE id=${id} FOR UPDATE`
    if(!p[0])throw new NotFoundError('پرداخت یافت نشد.')
    if(p[0].status===PaymentStatus.Refunded)return
    if(p[0].status!==PaymentStatus.Paid)throw new AppError('فقط پرداخت تأییدشده قابل استرداد است.')
    await tx`INSERT INTO financial_transactions
      (transaction_type,financial_account_id,amount,transaction_date,reference_type,reference_id,
       description,created_by_user_id,created_at)
      VALUES (${FinancialTransactionType.Refund},${p[0].accountId},-${p[0].amount},${nowIso()},
        'payment-refund',${id},'استرداد وجه سفارش',${userId},${nowIso()}) ON CONFLICT DO NOTHING`
    await tx`UPDATE payments SET status=${PaymentStatus.Refunded},updated_at=${nowIso()} WHERE id=${id}`
    await audit(tx,userId,'payment.refund','payment',id)
  })
}
export async function shoppingRequirements(from: string, to: string) {
  return sqlClient`
    WITH demand AS (
      SELECT ri.ingredient_id,
        SUM(ri.quantity_in_base_unit*oi.quantity::numeric/r.yield_quantity*
          (1+COALESCE(ri.waste_percent,0)/100)) required
      FROM orders o JOIN order_items oi ON oi.order_id=o.id
      JOIN daily_menu_items dmi ON dmi.id=oi.daily_menu_item_id
      JOIN daily_menus dm ON dm.id=dmi.daily_menu_id
      JOIN recipes r ON r.food_id=dmi.food_id AND r.is_active=true
      JOIN recipe_items ri ON ri.recipe_id=r.id
      WHERE dm.menu_date BETWEEN ${from}::date AND ${to}::date AND o.status<>6
      GROUP BY ri.ingredient_id
    ), stock AS (
      SELECT ingredient_id,COALESCE(SUM(quantity_in_base_unit),0) quantity
      FROM inventory_transactions GROUP BY ingredient_id
    ), costs AS (
      SELECT ingredient_id,COALESCE(SUM(total_cost)/NULLIF(SUM(quantity_in_base_unit),0),0) cost
      FROM inventory_transactions WHERE transaction_type IN
        (${InventoryTransactionType.PurchaseIn},${InventoryTransactionType.PurchaseReversal})
      GROUP BY ingredient_id
    )
    SELECT i.id AS "ingredientId",i.name AS "ingredientName",u.name AS "unitName",
      d.required::numeric(20,6)::text AS "requiredQuantity",
      COALESCE(s.quantity,0)::numeric(20,6)::text AS "currentStock",
      GREATEST(d.required-COALESCE(s.quantity,0),0)::numeric(20,6)::text AS "shortageQuantity",
      COALESCE(c.cost,0)::float8 AS "estimatedUnitCost",
      (GREATEST(d.required-COALESCE(s.quantity,0),0)*COALESCE(c.cost,0))::float8 AS "estimatedPurchaseCost"
    FROM demand d JOIN ingredients i ON i.id=d.ingredient_id JOIN units u ON u.id=i.base_unit_id
    LEFT JOIN stock s ON s.ingredient_id=i.id LEFT JOIN costs c ON c.ingredient_id=i.id ORDER BY i.name`
}
export async function createShoppingList(input: ShoppingListCreateRequest,userId:number){
  return sqlClient.begin(async tx=>{
    const now=nowIso()
    const list=await tx<{id:number}[]>`INSERT INTO shopping_lists
      (title,target_date,status,notes,created_by_user_id,created_at,updated_at)
      VALUES (${input.title},${input.targetDate},1,${nullable(input.notes)},${userId},${now},${now}) RETURNING id`
    for(const item of input.items)await tx`INSERT INTO shopping_list_items
      (shopping_list_id,ingredient_id,required_quantity,current_stock_snapshot,suggested_purchase_quantity,
       estimated_unit_cost,is_purchased)
      VALUES (${list[0]!.id},${item.ingredientId},${item.requiredQuantity}::numeric,
        ${item.currentStockSnapshot}::numeric,${item.suggestedPurchaseQuantity}::numeric,
        ${item.estimatedUnitCost},false)`
    return list[0]!.id
  })
}
export async function managerialReports(from:string,to:string){
  const [sales,expenses,profit,usage,waste]=await Promise.all([
    sqlClient`SELECT payment_method AS "paymentMethod",COUNT(*)::int count,
      COALESCE(SUM(amount) FILTER(WHERE status=${PaymentStatus.Paid}),0)::float8 AS "paidAmount",
      COALESCE(SUM(amount) FILTER(WHERE status=${PaymentStatus.Refunded}),0)::float8 AS "refundedAmount"
      FROM payments WHERE created_at>=${from}::date AND created_at<(${to}::date+1) GROUP BY payment_method`,
    sqlClient`SELECT COALESCE(c.name,'بدون دسته') category,COALESCE(-SUM(t.amount),0)::float8 amount
      FROM financial_transactions t LEFT JOIN expense_categories c ON c.id=t.category_id
      WHERE t.amount<0 AND t.transaction_type IN (2,4) AND t.transaction_date>=${from}::date
      AND t.transaction_date<(${to}::date+1) GROUP BY c.name`,
    sqlClient`SELECT COALESCE(SUM(CASE WHEN transaction_type=1 THEN amount WHEN transaction_type=7 THEN amount ELSE 0 END),0)::float8 income,
      COALESCE(-SUM(CASE WHEN transaction_type IN (2,4) THEN amount ELSE 0 END),0)::float8 expense
      FROM financial_transactions WHERE transaction_date>=${from}::date AND transaction_date<(${to}::date+1)`,
    sqlClient`SELECT i.name,u.name unit,SUM(t.quantity_in_base_unit) FILTER(WHERE t.transaction_type=1)::text purchase,
      SUM(t.quantity_in_base_unit) FILTER(WHERE t.transaction_type=2)::text consumption,
      SUM(t.quantity_in_base_unit) FILTER(WHERE t.transaction_type=3)::text waste,
      SUM(t.quantity_in_base_unit)::text closing FROM inventory_transactions t
      JOIN ingredients i ON i.id=t.ingredient_id JOIN units u ON u.id=i.base_unit_id
      WHERE t.transaction_date<(${to}::date+1) GROUP BY i.id,u.name ORDER BY i.name`,
    sqlClient`SELECT i.name,SUM(-t.quantity_in_base_unit)::text quantity,SUM(-t.total_cost)::float8 cost
      FROM inventory_transactions t JOIN ingredients i ON i.id=t.ingredient_id
      WHERE t.transaction_type=3 AND t.transaction_date>=${from}::date AND t.transaction_date<(${to}::date+1)
      GROUP BY i.id ORDER BY cost DESC`,
  ])
  return {sales,expenses,profit:profit[0],usage,waste}
}
export async function v15Dashboard() {
  const rows = await sqlClient`
    SELECT
      COALESCE((SELECT SUM(total_amount) FROM orders WHERE created_at>=(CURRENT_DATE AT TIME ZONE 'Asia/Tehran')
        AND status<>6),0)::float8 AS "todaySales",
      (SELECT COUNT(*)::int FROM payments WHERE status IN (1,2)) AS "unverifiedPayments",
      COALESCE(-(SELECT SUM(amount) FROM financial_transactions WHERE amount<0
        AND transaction_date>=(CURRENT_DATE AT TIME ZONE 'Asia/Tehran')),0)::float8 AS "todayExpense",
      (SELECT COUNT(*)::int FROM ingredients i WHERE i.is_active AND
        COALESCE((SELECT SUM(quantity_in_base_unit) FROM inventory_transactions t WHERE t.ingredient_id=i.id),0)
        <=i.minimum_stock_level) AS "lowStockCount",
      (SELECT COUNT(*)::int FROM purchases WHERE status=2 AND payment_status<>3) AS "unpaidPurchases",
      (SELECT COUNT(*)::int FROM order_inventory_consumptions WHERE recipe_missing AND reversed_at IS NULL) AS "missingRecipeOrders",
      COALESCE(-(SELECT SUM(total_cost) FROM inventory_transactions WHERE transaction_type=3
        AND transaction_date>=(CURRENT_DATE AT TIME ZONE 'Asia/Tehran')),0)::float8 AS "todayWasteCost"`
  return rows[0]
}

async function audit(tx: Tx, userId: number, action: string, entityType: string, entityId: number | null, details?: string) {
  await tx`INSERT INTO audit_logs (action,entity_type,entity_id,user_id,details,created_at)
    VALUES (${action},${entityType},${entityId},${userId},${details ?? null},${nowIso()})`
  logger.info({ event: action, userId, entityType, entityId, details }, 'عملیات مدیریتی ثبت شد')
}
