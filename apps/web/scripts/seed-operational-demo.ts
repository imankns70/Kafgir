import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import postgres from 'postgres'
import {
  PaymentMethod,
  FinancialAccountType,
  PaymentStatus,
  PurchasePaymentMethod,
  type PurchaseWriteRequest,
} from '../../../packages/contracts/src/index'

const envPath = resolve(process.cwd(), '.env.local')
if (existsSync(envPath)) loadEnvFile(envPath)

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required.')
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_OPERATIONAL_DEMO_SEED !== 'true') {
  throw new Error('Operational demo seed is disabled in production.')
}

const sql = postgres(connectionString, { max: 1, prepare: false })
const day = (offset: number) => new Intl.DateTimeFormat('en-CA-u-nu-latn', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(Date.now() + offset * 86_400_000))
const atNoon = (offset: number) => `${day(offset)}T08:30:00.000Z`
const now = new Date()
const required = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`Missing required demo reference: ${label}.`)
  return value
}

const ingredientDefinitions = [
  { code: 'KFG-RICE-01', name: 'برنج هاشمی ایرانی', category: 'برنج و غلات', unit: 'گرم', minimum: '20000', target: '70000', notes: 'برنج اصلی سرو؛ در محیط خشک و دور از رطوبت نگهداری شود.' },
  { code: 'KFG-CHICKEN-01', name: 'مرغ کامل تازه', category: 'مواد پروتئینی', unit: 'کیلوگرم', minimum: '15', target: '45', notes: 'تحویل روزانه با زنجیره سرد؛ دمای دریافت کنترل شود.' },
  { code: 'KFG-BEEF-01', name: 'گوشت خورشتی گوساله', category: 'مواد پروتئینی', unit: 'کیلوگرم', minimum: '8', target: '25', notes: 'قطعه‌بندی خورشتی، تازه و دارای تاریخ کشتار.' },
  { code: 'KFG-ONION-01', name: 'پیاز زرد', category: 'سبزیجات', unit: 'کیلوگرم', minimum: '10', target: '35', notes: 'گردش مصرف بر اساس FIFO.' },
  { code: 'KFG-POTATO-01', name: 'سیب‌زمینی', category: 'سبزیجات', unit: 'کیلوگرم', minimum: '12', target: '40', notes: 'بدون جوانه و لکه سبز.' },
  { code: 'KFG-HERB-01', name: 'سبزی قورمه سرخ‌شده', category: 'سبزیجات', unit: 'کیلوگرم', minimum: '6', target: '20', notes: 'بسته‌های تاریخ‌دار؛ نگهداری منجمد.' },
  { code: 'KFG-BEAN-01', name: 'لوبیا قرمز', category: 'حبوبات', unit: 'کیلوگرم', minimum: '3', target: '12', notes: 'سورت‌شده و یکدست.' },
  { code: 'KFG-PEA-01', name: 'لپه آذرشهر', category: 'حبوبات', unit: 'کیلوگرم', minimum: '3', target: '10', notes: 'قبل از مصرف کنترل کیفیت پخت انجام شود.' },
  { code: 'KFG-PASTE-01', name: 'رب گوجه‌فرنگی', category: 'ادویه و چاشنی', unit: 'کیلوگرم', minimum: '4', target: '15', notes: 'پس از بازشدن در سردخانه نگهداری شود.' },
  { code: 'KFG-OIL-01', name: 'روغن سرخ‌کردنی', category: 'روغن و افزودنی', unit: 'لیتر', minimum: '8', target: '30', notes: 'تاریخ بازشدن روی ظرف ثبت شود.' },
  { code: 'KFG-BARBERRY-01', name: 'زرشک پلویی', category: 'سایر', unit: 'کیلوگرم', minimum: '2', target: '7', notes: 'پاک‌شده و نگهداری در سردخانه.' },
  { code: 'KFG-SAFFRON-01', name: 'زعفران سرگل', category: 'ادویه و چاشنی', unit: 'گرم', minimum: '20', target: '60', notes: 'تحویل به مسئول شیفت و ثبت مصرف روزانه.' },
  { code: 'KFG-LIME-01', name: 'لیموعمانی', category: 'ادویه و چاشنی', unit: 'کیلوگرم', minimum: '1', target: '5', notes: 'خشک و بدون کپک.' },
  { code: 'KFG-CONTAINER-01', name: 'ظرف آلومینیومی یک‌پرس', category: 'بسته‌بندی', unit: 'عدد', minimum: '120', target: '600', notes: 'مناسب غذای گرم، همراه درب سالم.' },
  { code: 'KFG-BAG-01', name: 'پاکت حمل غذا', category: 'بسته‌بندی', unit: 'عدد', minimum: '100', target: '500', notes: 'هر سفارش بیرون‌بر یک پاکت.' },
  { code: 'KFG-DOOGH-01', name: 'دوغ بطری تک‌نفره', category: 'نوشیدنی', unit: 'بطری', minimum: '24', target: '96', notes: 'نگهداری یخچالی؛ کنترل تاریخ مصرف.' },
] as const

const supplierDefinitions = [
  { name: 'بازرگانی برنج کارون', contact: 'واحد فروش', mobile: '09000001001', address: 'اهواز، بازار عمده‌فروشان', notes: 'تحویل هفتگی برنج و اقلام خشک؛ تسویه بانکی.' },
  { name: 'پخش پروتئین جنوب', contact: 'مسئول سفارش', mobile: '09000001002', address: 'اندیمشک، شهرک صنعتی', notes: 'تحویل صبحگاهی با خودروی سردخانه‌دار.' },
  { name: 'بازار سبزی و صیفی اندیمشک', contact: 'واحد تأمین روزانه', mobile: '09000001003', address: 'اندیمشک، میدان میوه و تره‌بار', notes: 'خرید روزانه سبزیجات با کنترل وزن هنگام تحویل.' },
  { name: 'پخش مواد غذایی زاگرس', contact: 'واحد عمده', mobile: '09000001004', address: 'دزفول، انبار مرکزی پخش', notes: 'حبوبات، روغن، رب و چاشنی‌ها.' },
  { name: 'بسته‌بندی اروند', contact: 'فروش سازمانی', mobile: '09000001005', address: 'خوزستان، شهرک صنعتی', notes: 'ظروف و پاکت؛ کنترل تعداد و سلامت درب‌ها.' },
] as const

async function main() {
  const core = await import('@kafgir/server-core')
  const marker = await sql<{ value: string }[]>`SELECT value FROM app_settings WHERE key='demo.operational.seed.version'`
  if (marker[0]?.value === '2') {
    console.log('Operational demo data already exists; nothing changed.')
    return
  }

  const admin = await sql<{ id: number }[]>`SELECT id FROM users WHERE normalized_username='ADMIN' AND is_active=true LIMIT 1`
  if (!admin[0]) throw new Error('Run npm run db:seed before the operational demo seed.')
  const userId = admin[0].id

  const references = await sql<{ unitName: string; unitId: number; categoryName: string; categoryId: number }[]>`
    SELECT u.name AS "unitName",u.id AS "unitId",c.name AS "categoryName",c.id AS "categoryId"
    FROM units u CROSS JOIN ingredient_categories c
  `
  const unitIds = new Map(references.map((item) => [item.unitName, item.unitId]))
  const categoryIds = new Map(references.map((item) => [item.categoryName, item.categoryId]))
  const ingredientIds: Record<string, number> = {}

  for (const item of ingredientDefinitions) {
    const baseUnitId = unitIds.get(item.unit)
    const categoryId = categoryIds.get(item.category)
    if (!baseUnitId || !categoryId) throw new Error(`Missing base reference for ${item.name}.`)
    const existing = await sql<{ id: number }[]>`
      SELECT id FROM ingredients WHERE code=${item.code} OR lower(trim(name))=lower(trim(${item.name})) LIMIT 1
    `
    const rows = existing[0]
      ? await sql<{ id: number }[]>`UPDATE ingredients SET name=${item.name},code=${item.code},category_id=${categoryId},
          base_unit_id=${baseUnitId},minimum_stock_level=${item.minimum}::numeric,
          preferred_stock_level=${item.target}::numeric,is_inventory_tracked=true,is_active=true,
          notes=${item.notes},updated_at=${now} WHERE id=${existing[0].id} RETURNING id`
      : await sql<{ id: number }[]>`INSERT INTO ingredients
          (name,code,category_id,base_unit_id,minimum_stock_level,preferred_stock_level,
           is_inventory_tracked,is_active,notes,created_at,updated_at)
          VALUES (${item.name},${item.code},${categoryId},${baseUnitId},${item.minimum}::numeric,
            ${item.target}::numeric,true,true,${item.notes},${now},${now}) RETURNING id`
    ingredientIds[item.code] = required(rows[0], item.code).id
  }

  const supplierIds: Record<string, number> = {}
  for (const item of supplierDefinitions) {
    const existing = await sql<{ id: number }[]>`SELECT id FROM suppliers WHERE lower(trim(name))=lower(trim(${item.name})) LIMIT 1`
    const rows = existing[0]
      ? await sql<{ id: number }[]>`UPDATE suppliers SET contact_name=${item.contact},mobile=${item.mobile},
          address=${item.address},notes=${item.notes},is_active=true,updated_at=${now} WHERE id=${existing[0].id} RETURNING id`
      : await sql<{ id: number }[]>`INSERT INTO suppliers
          (name,contact_name,mobile,address,notes,is_active,created_at,updated_at)
          VALUES (${item.name},${item.contact},${item.mobile},${item.address},${item.notes},true,${now},${now}) RETURNING id`
    supplierIds[item.name] = required(rows[0], item.name).id
  }

  const accounts = [
    { name: 'حساب جاری ملت کفگیر', type: FinancialAccountType.Bank, bank: 'ملت', card: '6104-****-****-4821', account: '****7314', iban: 'IR**0120********7314', opening: 150_000_000, notes: 'حساب اصلی دریافت فروش و پرداخت خریدها.' },
    { name: 'صندوق نقدی شعبه', type: FinancialAccountType.Cash, bank: null, card: null, account: null, iban: null, opening: 20_000_000, notes: 'وجه نقد ابتدای شیفت؛ شمارش پایان روز الزامی است.' },
    { name: 'تنخواه خرید روزانه', type: FinancialAccountType.PettyCash, bank: null, card: null, account: null, iban: null, opening: 8_000_000, notes: 'خرید سبزی، اقلام فوری و هزینه‌های کوچک.' },
  ] as const
  const accountIds: Record<string, number> = {}
  for (const item of accounts) {
    const rows = await sql<{ id: number }[]>`INSERT INTO financial_accounts
      (name,type,bank_name,card_number_masked,account_number_masked,iban_masked,opening_balance,is_active,notes,created_at,updated_at)
      VALUES (${item.name},${item.type},${item.bank},${item.card},${item.account},${item.iban},${item.opening},true,${item.notes},${now},${now})
      ON CONFLICT (name) DO UPDATE SET type=EXCLUDED.type,bank_name=EXCLUDED.bank_name,
        card_number_masked=EXCLUDED.card_number_masked,account_number_masked=EXCLUDED.account_number_masked,
        iban_masked=EXCLUDED.iban_masked,is_active=true,notes=EXCLUDED.notes,updated_at=EXCLUDED.updated_at RETURNING id`
    accountIds[item.name] = required(rows[0], item.name).id
  }
  const bankId = required(accountIds['حساب جاری ملت کفگیر'], 'bank account')
  const cashId = required(accountIds['صندوق نقدی شعبه'], 'cash account')
  const pettyCashId = required(accountIds['تنخواه خرید روزانه'], 'petty cash account')

  await sql`INSERT INTO pos_terminals
    (title,terminal_number,merchant_number,financial_account_id,is_active,notes,created_at,updated_at)
    VALUES ('کارت‌خوان صندوق','DEMO-POS-1001','DEMO-MERCHANT-2001',${bankId},true,
      'پایانه نمونه متصل به حساب جاری کفگیر.',${now},${now})
    ON CONFLICT (terminal_number) DO UPDATE SET title=EXCLUDED.title,financial_account_id=EXCLUDED.financial_account_id,
      is_active=true,notes=EXCLUDED.notes,updated_at=EXCLUDED.updated_at`
  const terminal = await sql<{ id: number }[]>`SELECT id FROM pos_terminals WHERE terminal_number='DEMO-POS-1001'`
  const terminalId = required(terminal[0], 'POS terminal').id

  const kg = unitIds.get('کیلوگرم')!
  const gram = unitIds.get('گرم')!
  const liter = unitIds.get('لیتر')!
  const piece = unitIds.get('عدد')!
  const bottle = unitIds.get('بطری')!
  const ingredientId = (code: string) => required(ingredientIds[code], code)
  const supplierId = (name: string) => required(supplierIds[name], name)
  const purchaseDefinitions: Array<{
    invoice: string; supplier: string; date: number; confirmed: boolean; pay: number; items: PurchaseWriteRequest['items']; notes: string
  }> = [
    { invoice: 'DEMO-1405-1001', supplier: 'بازرگانی برنج کارون', date: -5, confirmed: true, pay: 24_400_000, notes: 'خرید دوره‌ای برنج و مخلفات پلویی؛ کنترل کیفیت هنگام تحویل انجام شد.', items: [
      { ingredientId: ingredientId('KFG-RICE-01'), purchaseUnitId: kg, quantity: '60', conversionFactorToBaseUnit: '1000', unitPrice: 185_000, lineDiscountAmount: 100_000, expirationDate: day(180), batchNumber: 'RICE-1405-05', notes: 'کیسه‌های 10 کیلویی' },
      { ingredientId: ingredientId('KFG-BARBERRY-01'), purchaseUnitId: kg, quantity: '6', conversionFactorToBaseUnit: '1', unitPrice: 840_000, lineDiscountAmount: 0, expirationDate: day(120), batchNumber: 'BAR-1405-05', notes: null },
      { ingredientId: ingredientId('KFG-SAFFRON-01'), purchaseUnitId: gram, quantity: '50', conversionFactorToBaseUnit: '1', unitPrice: 165_000, lineDiscountAmount: 0, expirationDate: day(365), batchNumber: 'SAF-1405-02', notes: 'پلمب تحویل مسئول شیفت' },
    ] },
    { invoice: 'DEMO-1405-1002', supplier: 'پخش پروتئین جنوب', date: -3, confirmed: true, pay: 15_000_000, notes: 'خرید پروتئین با ثبت دمای تحویل؛ بخشی از مبلغ به‌صورت اعتباری باقی مانده است.', items: [
      { ingredientId: ingredientId('KFG-CHICKEN-01'), purchaseUnitId: kg, quantity: '45', conversionFactorToBaseUnit: '1', unitPrice: 215_000, lineDiscountAmount: 0, expirationDate: day(3), batchNumber: 'CHK-0801', notes: 'دمای تحویل 3 درجه' },
      { ingredientId: ingredientId('KFG-BEEF-01'), purchaseUnitId: kg, quantity: '25', conversionFactorToBaseUnit: '1', unitPrice: 690_000, lineDiscountAmount: 0, expirationDate: day(4), batchNumber: 'BEF-0801', notes: 'قطعه‌بندی خورشتی' },
    ] },
    { invoice: 'DEMO-1405-1003', supplier: 'بازار سبزی و صیفی اندیمشک', date: -2, confirmed: true, pay: 0, notes: 'خرید سبزیجات و صیفی برای تولید سه روز؛ تسویه در پایان هفته.', items: [
      { ingredientId: ingredientId('KFG-ONION-01'), purchaseUnitId: kg, quantity: '35', conversionFactorToBaseUnit: '1', unitPrice: 42_000, lineDiscountAmount: 0, expirationDate: day(14), batchNumber: null, notes: null },
      { ingredientId: ingredientId('KFG-POTATO-01'), purchaseUnitId: kg, quantity: '40', conversionFactorToBaseUnit: '1', unitPrice: 48_000, lineDiscountAmount: 0, expirationDate: day(20), batchNumber: null, notes: null },
      { ingredientId: ingredientId('KFG-HERB-01'), purchaseUnitId: kg, quantity: '18', conversionFactorToBaseUnit: '1', unitPrice: 185_000, lineDiscountAmount: 0, expirationDate: day(90), batchNumber: 'HERB-0801', notes: 'تحویل منجمد' },
    ] },
    { invoice: 'DEMO-1405-1004', supplier: 'پخش مواد غذایی زاگرس', date: -1, confirmed: true, pay: 5_000_000, notes: 'تکمیل موجودی حبوبات، رب، روغن و چاشنی‌ها.', items: [
      { ingredientId: ingredientId('KFG-BEAN-01'), purchaseUnitId: kg, quantity: '10', conversionFactorToBaseUnit: '1', unitPrice: 175_000, lineDiscountAmount: 0, expirationDate: day(240), batchNumber: 'BEAN-502', notes: null },
      { ingredientId: ingredientId('KFG-PEA-01'), purchaseUnitId: kg, quantity: '8', conversionFactorToBaseUnit: '1', unitPrice: 160_000, lineDiscountAmount: 0, expirationDate: day(240), batchNumber: 'PEA-322', notes: null },
      { ingredientId: ingredientId('KFG-PASTE-01'), purchaseUnitId: kg, quantity: '12', conversionFactorToBaseUnit: '1', unitPrice: 145_000, lineDiscountAmount: 0, expirationDate: day(180), batchNumber: 'PST-714', notes: null },
      { ingredientId: ingredientId('KFG-OIL-01'), purchaseUnitId: liter, quantity: '30', conversionFactorToBaseUnit: '1', unitPrice: 98_000, lineDiscountAmount: 0, expirationDate: day(240), batchNumber: 'OIL-902', notes: null },
      { ingredientId: ingredientId('KFG-LIME-01'), purchaseUnitId: kg, quantity: '4', conversionFactorToBaseUnit: '1', unitPrice: 350_000, lineDiscountAmount: 0, expirationDate: day(300), batchNumber: 'LIM-120', notes: null },
    ] },
    { invoice: 'DEMO-1405-1005', supplier: 'بسته‌بندی اروند', date: -1, confirmed: true, pay: 6_000_000, notes: 'خرید ماهانه ظروف و پاکت بیرون‌بر؛ تعداد هنگام تحویل شمارش شد.', items: [
      { ingredientId: ingredientId('KFG-CONTAINER-01'), purchaseUnitId: piece, quantity: '500', conversionFactorToBaseUnit: '1', unitPrice: 9_000, lineDiscountAmount: 0, expirationDate: null, batchNumber: 'PKG-AL-081', notes: null },
      { ingredientId: ingredientId('KFG-BAG-01'), purchaseUnitId: piece, quantity: '500', conversionFactorToBaseUnit: '1', unitPrice: 3_000, lineDiscountAmount: 0, expirationDate: null, batchNumber: 'PKG-BG-081', notes: null },
    ] },
    { invoice: 'DEMO-1405-1006', supplier: 'پخش مواد غذایی زاگرس', date: 0, confirmed: false, pay: 0, notes: 'پیش‌نویس خرید نوشیدنی برای تمرین بررسی و تأیید خرید.', items: [
      { ingredientId: ingredientId('KFG-DOOGH-01'), purchaseUnitId: bottle, quantity: '96', conversionFactorToBaseUnit: '1', unitPrice: 22_000, lineDiscountAmount: 0, expirationDate: day(20), batchNumber: null, notes: 'قبل از تأیید، تاریخ مصرف کنترل شود.' },
    ] },
  ]

  for (const definition of purchaseDefinitions) {
    let purchase = await sql<{ id: number; status: number; total: number; paid: number }[]>`
      SELECT id,status,total_amount::float8 total,paid_amount::float8 paid FROM purchases WHERE invoice_number=${definition.invoice} LIMIT 1
    `
    if (!purchase[0]) {
      const id = await core.createPurchase({ supplierId: supplierId(definition.supplier), invoiceNumber: definition.invoice,
        purchaseDate: day(definition.date), discountAmount: 0, additionalCostAmount: 0,
        notes: definition.notes, attachmentUrl: null, items: definition.items }, userId)
      purchase = await sql<{ id: number; status: number; total: number; paid: number }[]>`
        SELECT id,status,total_amount::float8 total,paid_amount::float8 paid FROM purchases WHERE id=${id}`
    }
    let currentPurchase = required(purchase[0], definition.invoice)
    if (definition.confirmed && currentPurchase.status === 1) {
      await core.confirmPurchase(currentPurchase.id, userId)
      purchase = await sql<{ id: number; status: number; total: number; paid: number }[]>`
        SELECT id,status,total_amount::float8 total,paid_amount::float8 paid FROM purchases WHERE id=${currentPurchase.id}`
      currentPurchase = required(purchase[0], definition.invoice)
    }
    const remainingDemoPayment = Math.min(definition.pay, currentPurchase.total) - currentPurchase.paid
    if (definition.confirmed && remainingDemoPayment > 0) {
      await core.registerPurchasePayment({ purchaseId: currentPurchase.id, financialAccountId: bankId,
        amount: remainingDemoPayment, paymentMethod: PurchasePaymentMethod.Bank,
        paidAt: atNoon(definition.date), trackingNumber: `DEMO-PAY-${definition.invoice}`,
        notes: 'پرداخت نمونه ثبت‌شده توسط Seed آموزشی.' }, userId)
    }
  }

  const inventoryExamples = await sql<{ referenceType: string; notes: string | null }[]>`
    SELECT reference_type AS "referenceType",notes FROM inventory_transactions
    WHERE notes LIKE '%DEMO-OPERATIONAL%'
  `
  if (!inventoryExamples.some((item) => item.notes?.includes('DEMO-OPERATIONAL-WASTE'))) {
    await core.registerWaste({ ingredientId: ingredientId('KFG-ONION-01'), quantity: '1.2', reason: 'فساد',
      notes: 'DEMO-OPERATIONAL-WASTE؛ جداسازی پیاز آسیب‌دیده هنگام آماده‌سازی', transactionDate: atNoon(-1) }, userId)
  }
  if (!inventoryExamples.some((item) => item.notes?.includes('DEMO-OPERATIONAL-PACKAGING'))) {
    await core.adjustInventory({ ingredientId: ingredientId('KFG-CONTAINER-01'), type: 'decrease', quantity: '12',
      reason: 'اصلاح موجودی', notes: 'DEMO-OPERATIONAL-PACKAGING؛ ظروف آسیب‌دیده هنگام تحویل', transactionDate: atNoon(0) }, userId)
  }
  if (!inventoryExamples.some((item) => item.notes?.includes('DEMO-OPERATIONAL-COUNT'))) {
    await core.confirmStockCount({ items: [{ ingredientId: ingredientId('KFG-RICE-01'), countedQuantity: '58000' }],
      notes: 'DEMO-OPERATIONAL-COUNT؛ انبارگردانی پایان شیفت' }, userId)
  }

  const expenseCategory = async (name: string) => required((await sql<{ id: number }[]>`SELECT id FROM expense_categories WHERE name=${name}`)[0], name).id
  const entries = [
    { description: 'DEMO-OPERATIONAL؛ هزینه گاز و انرژی آشپزخانه', accountId: bankId, amount: 2_800_000, categoryId: await expenseCategory('آب، برق و گاز'), kind: 'expense' as const, date: -2 },
    { description: 'DEMO-OPERATIONAL؛ تبلیغ محلی منوی هفتگی', accountId: bankId, amount: 1_200_000, categoryId: await expenseCategory('تبلیغات'), kind: 'expense' as const, date: -1 },
    { description: 'DEMO-OPERATIONAL؛ فروش حضوری خارج از سامانه سفارش', accountId: cashId, amount: 1_450_000, categoryId: null, kind: 'income' as const, date: 0 },
  ]
  for (const entry of entries) {
    const exists = await sql`SELECT 1 FROM financial_transactions WHERE description=${entry.description} LIMIT 1`
    if (!exists[0]) await core.createFinancialEntry({ financialAccountId: entry.accountId, amount: entry.amount,
      transactionDate: atNoon(entry.date), categoryId: entry.categoryId, description: entry.description }, entry.kind, userId)
  }
  const transferExists = await sql`SELECT 1 FROM financial_transactions WHERE description='DEMO-OPERATIONAL؛ شارژ تنخواه خرید روزانه' LIMIT 1`
  if (!transferExists[0]) await core.transfer({ fromAccountId: bankId, toAccountId: pettyCashId, amount: 5_000_000,
    transactionDate: atNoon(-2), description: 'DEMO-OPERATIONAL؛ شارژ تنخواه خرید روزانه' }, userId)

  const order = await sql<{ id: number; total: number }[]>`
    SELECT o.id,o.total_amount::float8 total FROM orders o
    WHERE o.status<>6 ORDER BY o.created_at DESC,o.id DESC LIMIT 1
  `
  if (order[0]) {
    const selectedOrder = order[0]
    const allocated = await sql<{ amount: number }[]>`SELECT COALESCE(SUM(amount),0)::float8 amount FROM payments
      WHERE order_id=${selectedOrder.id} AND status IN (1,2,3)`
    let available = Math.max(0, selectedOrder.total - required(allocated[0], 'allocated payments').amount)
    const posExists = await sql`SELECT 1 FROM payments WHERE tracking_number='DEMO-POS-001'`
    if (!posExists[0] && available > 0) {
      const amount = Math.min(500_000, available)
      const id = await core.createPayment({ orderId: selectedOrder.id, paymentMethod: PaymentMethod.Pos,
        financialAccountId: bankId, posTerminalId: terminalId, amount, trackingNumber: 'DEMO-POS-001',
        referenceNumber: 'DEMO-REF-POS', receiptImageUrl: null, description: 'پرداخت حضوری با کارت‌خوان صندوق' }, userId)
      await core.changePaymentStatus(id, { status: PaymentStatus.Paid, description: 'تراکنش پوز با موفقیت تأیید شد.' }, userId)
      available -= amount
    }
  }

  const listTitle = `لیست خرید آموزشی ${day(1)}`
  const existingList = await sql`SELECT 1 FROM shopping_lists WHERE title=${listTitle}`
  if (!existingList[0]) {
    const stock = async (id: number) => required((await sql<{ value: string }[]>`
      SELECT COALESCE(SUM(quantity_in_base_unit),0)::text value FROM inventory_transactions WHERE ingredient_id=${id}`)[0], 'stock').value
    await core.createShoppingList({ title: listTitle, targetDate: day(1),
      notes: 'نمونه برنامه خرید برای آشنایی با مقایسه نیاز تولید، موجودی لحظه‌ای و مقدار پیشنهادی خرید.',
      items: [
        { ingredientId: ingredientId('KFG-CHICKEN-01'), requiredQuantity: '60', currentStockSnapshot: await stock(ingredientId('KFG-CHICKEN-01')), suggestedPurchaseQuantity: '15', estimatedUnitCost: 215_000 },
      { ingredientId: ingredientId('KFG-RICE-01'), requiredQuantity: '70000', currentStockSnapshot: await stock(ingredientId('KFG-RICE-01')), suggestedPurchaseQuantity: '12000', estimatedUnitCost: 185 },
        { ingredientId: ingredientId('KFG-CONTAINER-01'), requiredQuantity: '620', currentStockSnapshot: await stock(ingredientId('KFG-CONTAINER-01')), suggestedPurchaseQuantity: '132', estimatedUnitCost: 9_000 },
        { ingredientId: ingredientId('KFG-HERB-01'), requiredQuantity: '24', currentStockSnapshot: await stock(ingredientId('KFG-HERB-01')), suggestedPurchaseQuantity: '6', estimatedUnitCost: 185_000 },
      ] }, userId)
  }

  const extraCategory = await sql<{ id: number }[]>`INSERT INTO food_categories
    (title,slug,icon,display_order,is_active,created_at,updated_at)
    VALUES ('افزودنی و تک‌پرس','extras','🍽️',8,true,${now},${now})
    ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title,icon=EXCLUDED.icon,
      display_order=EXCLUDED.display_order,is_active=true,updated_at=EXCLUDED.updated_at RETURNING id`
  const extraCategoryId = required(extraCategory[0], 'extras category').id
  const tagRows = await sql<{ id: number; slug: string }[]>`SELECT id,slug FROM food_tags WHERE is_active=true`
  const tagIds = new Map(tagRows.map((tag) => [tag.slug, tag.id]))
  const tags = (...slugs: string[]) => slugs.map((slug) => tagIds.get(slug)).filter((id): id is number => id !== undefined)
  const extraFoods = [
    {
      name: 'برنج ایرانی زعفرانی اضافه', slug: 'extra-saffron-rice', price: 140_000, capacity: 20,
      description: 'یک پرس برنج ایرانی زعفرانی برای اضافه‌کردن کنار غذای اصلی',
      fullDescription: 'برنج ایرانی دم‌کشیده با ته‌دیگ و رویه زعفرانی؛ مناسب وقتی یک پرس برنج بیشتر نیاز دارید.',
      ingredients: 'برنج هاشمی ایرانی، زعفران، روغن و نمک', portion: 'حدود ۳۵۰ گرم برنج پخته در ظرف جداگانه',
      allergy: 'فاقد ماده حساسیت‌زای شناخته‌شده؛ در آشپزخانه مشترک آماده می‌شود.',
      tags: tags('single-serving', 'daily-cooked', 'meatless'),
      overhead: 9_000, recipe: [{ code: 'KFG-RICE-01', quantity: '180' }, { code: 'KFG-SAFFRON-01', quantity: '0.12' }, { code: 'KFG-OIL-01', quantity: '0.015' }],
    },
    {
      name: 'خورشت قورمه‌سبزی بدون برنج', slug: 'extra-ghormeh-sabzi', price: 260_000, capacity: 8,
      description: 'یک پرس خورشت قورمه‌سبزی خانگی در ظرف جدا و بدون برنج',
      fullDescription: 'خورشت اضافه قورمه‌سبزی با گوشت گوساله، سبزی سرخ‌شده، لوبیا و لیموعمانی؛ مناسب سفارش کنار برنج اضافه.',
      ingredients: 'سبزی قورمه، گوشت گوساله، لوبیا قرمز، پیاز، لیموعمانی و روغن', portion: 'حدود ۳۰۰ گرم خورشت؛ بدون برنج',
      allergy: 'حبوبات دارد؛ در آشپزخانه مشترک آماده می‌شود.',
      tags: tags('single-serving', 'daily-cooked', 'beef', 'homemade'),
      overhead: 12_000, recipe: [{ code: 'KFG-HERB-01', quantity: '0.12' }, { code: 'KFG-BEEF-01', quantity: '0.08' }, { code: 'KFG-BEAN-01', quantity: '0.035' }, { code: 'KFG-ONION-01', quantity: '0.04' }, { code: 'KFG-LIME-01', quantity: '0.005' }, { code: 'KFG-OIL-01', quantity: '0.015' }],
    },
    {
      name: 'خورشت قیمه بدون برنج', slug: 'extra-gheymeh', price: 250_000, capacity: 8,
      description: 'یک پرس خورشت قیمه خانگی با سیب‌زمینی و بدون برنج',
      fullDescription: 'خورشت اضافه قیمه با گوشت گوساله، لپه، رب، لیموعمانی و سیب‌زمینی؛ در ظرف مستقل سرو می‌شود.',
      ingredients: 'گوشت گوساله، لپه، رب گوجه، پیاز، سیب‌زمینی، لیموعمانی و روغن', portion: 'حدود ۳۰۰ گرم خورشت؛ بدون برنج',
      allergy: 'حبوبات دارد؛ در آشپزخانه مشترک آماده می‌شود.',
      tags: tags('single-serving', 'daily-cooked', 'beef', 'homemade'),
      overhead: 12_000, recipe: [{ code: 'KFG-BEEF-01', quantity: '0.08' }, { code: 'KFG-PEA-01', quantity: '0.04' }, { code: 'KFG-PASTE-01', quantity: '0.03' }, { code: 'KFG-ONION-01', quantity: '0.04' }, { code: 'KFG-POTATO-01', quantity: '0.12' }, { code: 'KFG-LIME-01', quantity: '0.005' }, { code: 'KFG-OIL-01', quantity: '0.015' }],
    },
    {
      name: 'ران مرغ زعفرانی بدون برنج', slug: 'extra-saffron-chicken-thigh', price: 260_000, capacity: 6,
      description: 'یک تکه ران مرغ زعفرانی پخته‌شده، بدون برنج و در ظرف جدا',
      fullDescription: 'ران مرغ مزه‌دارشده با پیاز و زعفران، پخته‌شده با سس مخصوص کفگیر؛ مناسب افزودن به غذای اصلی.',
      ingredients: 'ران مرغ، پیاز، زعفران، روغن و ادویه', portion: 'یک تکه ران مرغ پخته؛ حدود ۳۵۰ گرم پیش از پخت',
      allergy: 'در آشپزخانه مشترک آماده می‌شود.',
      tags: tags('single-serving', 'daily-cooked', 'chicken', 'high-protein'),
      overhead: 10_000, recipe: [{ code: 'KFG-CHICKEN-01', quantity: '0.35' }, { code: 'KFG-ONION-01', quantity: '0.04' }, { code: 'KFG-SAFFRON-01', quantity: '0.1' }, { code: 'KFG-OIL-01', quantity: '0.01' }],
    },
    {
      name: 'سینه مرغ زعفرانی بدون برنج', slug: 'extra-saffron-chicken-breast', price: 280_000, capacity: 6,
      description: 'یک تکه سینه مرغ زعفرانی پخته‌شده، بدون برنج و در ظرف جدا',
      fullDescription: 'سینه مرغ مزه‌دارشده با پیاز و زعفران و پخته‌شده با سس مخصوص؛ انتخابی پرپروتئین بدون برنج.',
      ingredients: 'سینه مرغ، پیاز، زعفران، روغن و ادویه', portion: 'یک تکه سینه مرغ پخته؛ حدود ۳۰۰ گرم پیش از پخت',
      allergy: 'در آشپزخانه مشترک آماده می‌شود.',
      tags: tags('single-serving', 'daily-cooked', 'chicken', 'high-protein'),
      overhead: 10_000, recipe: [{ code: 'KFG-CHICKEN-01', quantity: '0.3' }, { code: 'KFG-ONION-01', quantity: '0.04' }, { code: 'KFG-SAFFRON-01', quantity: '0.1' }, { code: 'KFG-OIL-01', quantity: '0.01' }],
    },
  ] as const

  for (const extra of extraFoods) {
    const food = await sql<{ id: number }[]>`SELECT id FROM foods
      WHERE slug=${extra.slug} OR lower(trim(name))=lower(trim(${extra.name})) LIMIT 1`
    let foodId = food[0]?.id
    if (!foodId) {
      const created = await core.createFood({
        name: extra.name, slug: extra.slug, description: extra.description,
        fullDescription: extra.fullDescription, ingredients: extra.ingredients,
        portionDescription: extra.portion, allergyInformation: extra.allergy,
        preparationTimeMinutes: null, categoryId: extraCategoryId, tagIds: [...extra.tags],
        primaryBadgeTagId: null, images: [], defaultPrice: extra.price, imageUrl: null,
        allowsPersianRice: false, isPersianRice: false, isActive: true,
      })
      foodId = created.id
    }
    foodId = required(foodId, extra.slug)
    const existingRecipe = await sql`SELECT 1 FROM recipes WHERE food_id=${foodId} AND is_active=true LIMIT 1`
    if (!existingRecipe[0]) {
      await core.saveRecipe(foodId, {
        yieldQuantity: 1, preparationLossPercent: 0, overheadPerPortion: extra.overhead,
        notes: 'دستور نمونه آموزشی برای کنترل مصرف افزودنی مستقل.', isActive: true,
        items: extra.recipe.map((item) => ({ ingredientId: ingredientId(item.code), quantityInBaseUnit: item.quantity, wastePercent: 0, notes: null })),
      }, userId)
    }
    const existingMenuItem = await sql`SELECT 1 FROM daily_menu_items dmi
      JOIN daily_menus dm ON dm.id=dmi.daily_menu_id
      WHERE dm.menu_date=${day(0)}::date AND dmi.food_id=${foodId} LIMIT 1`
    if (!existingMenuItem[0]) {
      await core.addMenuItem(day(0), { foodId, price: extra.price, discountPrice: null,
        capacityPortions: extra.capacity, isAvailable: true })
    }
  }

  await sql`INSERT INTO app_settings (key,value,description)
    VALUES ('demo.operational.seed.version','2','Realistic fictional restaurant operations sample with independent extras for local learning.')
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,description=EXCLUDED.description`

  const counts = await sql<{ ingredients: number; suppliers: number; purchases: number; movements: number; lists: number; accounts: number; payments: number }[]>`
    SELECT (SELECT COUNT(*)::int FROM ingredients) ingredients,
      (SELECT COUNT(*)::int FROM suppliers) suppliers,(SELECT COUNT(*)::int FROM purchases) purchases,
      (SELECT COUNT(*)::int FROM inventory_transactions) movements,(SELECT COUNT(*)::int FROM shopping_lists) lists,
      (SELECT COUNT(*)::int FROM financial_accounts) accounts,(SELECT COUNT(*)::int FROM payments) payments
  `
  console.log('Operational demo data created:', { ...counts[0], extras: extraFoods.length })
  await core.closeDatabase()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
}).finally(async () => {
  await sql.end({ timeout: 5 })
})
