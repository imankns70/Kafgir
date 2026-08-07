import {
  PurchasePaymentMethod,
  PurchasePaymentStatus,
  PurchaseStatus,
  FinancialTransactionType,
  CustomerPaymentMethod,
  OrderStatus,
  PaymentStatus,
} from '@kafgir/contracts'
import {
  adjustInventory,
  closeDatabase,
  configureDatabase,
  confirmPurchase,
  confirmStockCount,
  createPayment,
  createPurchase,
  changePaymentStatus,
  refundPayment,
  registerPurchasePayment,
  transfer,
} from '@kafgir/server-core'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const connectionString = process.env.TEST_DATABASE_URL
const integration = describe.skipIf(!connectionString)
let sql: ReturnType<typeof postgres>
let userId = 0
let unitId = 0
let ingredientId = 0
let accountId = 0
let secondAccountId = 0
let purchaseId = 0
let profileId = 0
let orderId = 0
let paymentId = 0
const suffix = crypto.randomUUID()

integration.sequential('Kafgir 1.5 inventory and finance services', () => {
  beforeAll(async () => {
    const databaseName = new URL(connectionString!).pathname.toLowerCase()
    if (!databaseName.includes('test')) {
      throw new Error('TEST_DATABASE_URL must point to a database whose name contains "test".')
    }
    sql = postgres(connectionString!, { max: 2, prepare: false })
    await configureDatabase(connectionString!, 5)
    userId = (await sql<{ id: number }[]>`
      INSERT INTO users (username,normalized_username,full_name,is_active,created_at)
      VALUES (${`v15-${suffix}`},${`V15-${suffix}`},'V15 integration',true,NOW()) RETURNING id`)[0]!.id
    unitId = (await sql<{ id: number }[]>`
      INSERT INTO units (name,symbol,is_active,created_at,updated_at)
      VALUES (${`unit-${suffix}`},'u',true,NOW(),NOW()) RETURNING id`)[0]!.id
    ingredientId = (await sql<{ id: number }[]>`
      INSERT INTO ingredients
        (name,base_unit_id,minimum_stock_level,is_inventory_tracked,is_active,created_at,updated_at)
      VALUES (${`ingredient-${suffix}`},${unitId},0,true,true,NOW(),NOW()) RETURNING id`)[0]!.id
    accountId = (await sql<{ id: number }[]>`
      INSERT INTO financial_accounts
        (name,type,opening_balance,is_active,created_at,updated_at)
      VALUES (${`account-${suffix}`},2,1000,true,NOW(),NOW()) RETURNING id`)[0]!.id
    secondAccountId = (await sql<{ id: number }[]>`
      INSERT INTO financial_accounts
        (name,type,opening_balance,is_active,created_at,updated_at)
      VALUES (${`account-destination-${suffix}`},2,0,true,NOW(),NOW()) RETURNING id`)[0]!.id
    profileId = (await sql<{ id: number }[]>`
      INSERT INTO customer_profiles (user_id,preferred_name,default_phone_number,created_at)
      VALUES (${userId},'Integration customer','09000000000',NOW()) RETURNING id`)[0]!.id
    orderId = (await sql<{ id: number }[]>`
      INSERT INTO orders
        (order_number,customer_profile_id,delivery_full_name,delivery_phone_number,delivery_city,
         delivery_address_line,status,payment_method,delivery_method,subtotal_amount,delivery_fee,
         total_amount,created_at)
      VALUES (${`IT-${suffix}`},${profileId},'Integration customer','09000000000','اندیمشک','آدرس تست',
        ${OrderStatus.PendingConfirmation},${CustomerPaymentMethod.CardToCard},1,100,0,100,NOW()) RETURNING id`)[0]!.id
  })

  afterAll(async () => {
    if (!sql) return
    await sql`DELETE FROM audit_logs WHERE user_id=${userId}`
    await sql`DELETE FROM financial_transactions WHERE financial_account_id IN (${accountId},${secondAccountId})`
    await sql`DELETE FROM payments WHERE id=${paymentId}`
    await sql`DELETE FROM purchase_payments WHERE financial_account_id=${accountId}`
    await sql`DELETE FROM inventory_transactions WHERE ingredient_id=${ingredientId}`
    await sql`DELETE FROM purchases WHERE id=${purchaseId}`
    await sql`DELETE FROM financial_accounts WHERE id IN (${accountId},${secondAccountId})`
    await sql`DELETE FROM orders WHERE id=${orderId}`
    await sql`DELETE FROM customer_profiles WHERE id=${profileId}`
    await sql`DELETE FROM ingredients WHERE id=${ingredientId}`
    await sql`DELETE FROM units WHERE id=${unitId}`
    await sql`DELETE FROM users WHERE id=${userId}`
    await closeDatabase()
    await sql.end()
  })

  it('confirms a purchase once and allocates the final header total to inventory', async () => {
    purchaseId = await createPurchase({
      supplierId: null,
      invoiceNumber: null,
      purchaseDate: '2099-02-01',
      discountAmount: 10,
      additionalCostAmount: 20,
      notes: null,
      attachmentUrl: null,
      items: [{
        ingredientId,
        purchaseUnitId: unitId,
        quantity: '10',
        conversionFactorToBaseUnit: '1',
        unitPrice: 20,
        lineDiscountAmount: 0,
        expirationDate: null,
        batchNumber: null,
        notes: null,
      }],
    }, userId)
    await confirmPurchase(purchaseId, userId)
    await confirmPurchase(purchaseId, userId)
    const rows = await sql<{ status: number; stock: string; cost: string; movements: number }[]>`
      SELECT p.status,COALESCE(SUM(t.quantity_in_base_unit),0)::text stock,
        COALESCE(SUM(t.total_cost),0)::text cost,COUNT(t.id)::int movements
      FROM purchases p LEFT JOIN inventory_transactions t
        ON t.reference_type='purchase' AND t.reference_id=p.id
      WHERE p.id=${purchaseId} GROUP BY p.id`
    expect(rows[0]).toMatchObject({ status: PurchaseStatus.Confirmed, stock: '10.000000', cost: '210.00', movements: 1 })
  })

  it('serializes competing decrements and does not create a zero stock-count adjustment', async () => {
    const results = await Promise.allSettled([
      adjustInventory({ ingredientId, type: 'decrease', quantity: '8', reason: 'test' }, userId),
      adjustInventory({ ingredientId, type: 'decrease', quantity: '8', reason: 'test' }, userId),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const before = (await sql<{ count: number }[]>`
      SELECT COUNT(*)::int count FROM inventory_transactions WHERE ingredient_id=${ingredientId}`)[0]!.count
    await confirmStockCount({ items: [{ ingredientId, countedQuantity: '2' }], notes: 'no-op' }, userId)
    const after = (await sql<{ count: number; stock: string }[]>`
      SELECT COUNT(*)::int count,COALESCE(SUM(quantity_in_base_unit),0)::text stock
      FROM inventory_transactions WHERE ingredient_id=${ingredientId}`)[0]!
    expect(after.count).toBe(before)
    expect(after.stock).toBe('2.000000')
  })

  it('registers the selected purchase-payment method and its matching ledger expense', async () => {
    await registerPurchasePayment({
      purchaseId,
      financialAccountId: accountId,
      amount: 210,
      paymentMethod: PurchasePaymentMethod.Bank,
      trackingNumber: 'integration',
      notes: null,
    }, userId)
    const rows = await sql<{ paymentMethod: number; paymentStatus: number; paid: string; ledger: string }[]>`
      SELECT pp.payment_method AS "paymentMethod",p.payment_status AS "paymentStatus",
        p.paid_amount::text paid,ft.amount::text ledger
      FROM purchase_payments pp JOIN purchases p ON p.id=pp.purchase_id
      JOIN financial_transactions ft ON ft.reference_type='purchase-payment' AND ft.reference_id=pp.id
      WHERE pp.purchase_id=${purchaseId}`
    expect(rows[0]).toEqual({
      paymentMethod: PurchasePaymentMethod.Bank,
      paymentStatus: PurchasePaymentStatus.Paid,
      paid: '210.00',
      ledger: '-210.00',
    })
  })

  it('creates a balanced two-sided transfer and prevents overdrawing the source', async () => {
    await transfer({
      fromAccountId: accountId,
      toAccountId: secondAccountId,
      amount: 100,
      description: 'integration transfer',
    }, userId)
    const rows = await sql<{ type: number; accountId: number; amount: string }[]>`
      SELECT transaction_type AS type,financial_account_id AS "accountId",amount::text
      FROM financial_transactions WHERE reference_type='transfer' ORDER BY transaction_type`
    expect(rows).toEqual([
      { type: FinancialTransactionType.TransferIn, accountId: secondAccountId, amount: '100.00' },
      { type: FinancialTransactionType.TransferOut, accountId, amount: '-100.00' },
    ])
    await expect(transfer({
      fromAccountId: accountId,
      toAccountId: secondAccountId,
      amount: 1000,
      description: 'overdraw',
    }, userId)).rejects.toThrow('مانده حساب مبدأ')
  })

  it('creates, verifies, and refunds one customer payment with matching ledger rows', async () => {
    paymentId = await createPayment({
      orderId,
      paymentMethod: CustomerPaymentMethod.CardToCard,
      financialAccountId: accountId,
      posTerminalId: null,
      amount: 100,
      trackingNumber: 'customer-payment',
      referenceNumber: null,
      receiptImageUrl: null,
      description: null,
    }, userId)
    const created = await sql<{ status: number }[]>`SELECT status FROM payments WHERE id=${paymentId}`
    expect(created[0]!.status).toBe(PaymentStatus.AwaitingVerification)
    await changePaymentStatus(paymentId, { status: PaymentStatus.Paid, description: null }, userId)
    await changePaymentStatus(paymentId, { status: PaymentStatus.Paid, description: null }, userId)
    await refundPayment(paymentId, userId)
    await refundPayment(paymentId, userId)
    const rows = await sql<{ status: number; type: number; amount: string }[]>`
      SELECT p.status,t.transaction_type AS type,t.amount::text
      FROM payments p JOIN financial_transactions t ON t.reference_id=p.id
      WHERE p.id=${paymentId} AND t.reference_type IN ('payment','payment-refund')
      ORDER BY t.transaction_type`
    expect(rows).toEqual([
      { status: PaymentStatus.Refunded, type: FinancialTransactionType.SalesIncome, amount: '100.00' },
      { status: PaymentStatus.Refunded, type: FinancialTransactionType.Refund, amount: '-100.00' },
    ])
  })
})
