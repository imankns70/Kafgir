import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  FinancialAccountType,
  CustomerPaymentMethod,
  InventoryTransactionType,
  PaymentStatus,
  PurchasePaymentMethod,
  PurchaseStatus,
  ShoppingListStatus,
  type FinancialAccountDto,
  type ExpenseCategoryDto,
  type IngredientDto,
  type InventoryMovementDto,
  type PurchaseSummaryDto,
  type PosTerminalDto,
  type SupplierDto,
  type UnitDto,
} from '@kafgir/contracts'
import { adminApi } from './api'
import { formatMoney as money, formatNumber, persianDateWithLatinDigitsLocale } from './number-format'

const number = (value: string | number) => formatNumber(value, 6)
const date = (value: string) => new Intl.DateTimeFormat(persianDateWithLatinDigitsLocale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const today = () => new Intl.DateTimeFormat('en-CA-u-nu-latn', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())
const normalizeDecimalInput = (value: FormDataEntryValue | null) => String(value ?? '')
  .trim()
  .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  .replace(/[٬،,\s]/g, '')
  .replace(/٫/g, '.')
const moneyInput = (value: FormDataEntryValue | string | null) => Number(normalizeDecimalInput(value)) || 0
const dateOnly = (value: string | Date) => typeof value === 'string' ? value : new Intl.DateTimeFormat('en-CA-u-nu-latn', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(value)

type PurchaseLineDraft = {
  key: string; ingredientId: string; unitId: string; quantity: string; factor: string;
  unitPrice: string; discount: string; expirationDate: string; batchNumber: string;
}
const emptyPurchaseLine = (): PurchaseLineDraft => ({
  key: crypto.randomUUID(), ingredientId: '', unitId: '', quantity: '', factor: '1',
  unitPrice: '', discount: '0', expirationDate: '', batchNumber: '',
})

type RecipeLineDraft = { key: string; ingredientId: string; quantity: string; waste: string }
const emptyRecipeLine = (): RecipeLineDraft => ({ key: crypto.randomUUID(), ingredientId: '', quantity: '', waste: '' })

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return <section className="page v15-page"><header className="page-header"><h1>{title}</h1></header>{children}</section>
}
type PageGuideContent = {
  purpose: string
  steps: string[]
  example: string
  notes: string[]
}
function PageGuide({ content }: { content: PageGuideContent }) {
  return <details className="panel page-guide" open>
    <summary>
      <span className="page-guide-heading"><strong>راهنمای کاربردی این صفحه</strong><small>{content.purpose}</small></span>
      <span className="page-guide-chevron" aria-hidden="true" />
    </summary>
    <div className="page-guide-body">
      <section><h2>روش استفاده</h2><ol>{content.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>
      <aside className="page-guide-example"><h2>مثال واقعی</h2><p>{content.example}</p></aside>
      <section className="page-guide-notes"><h2>نکات مهم</h2><ul>{content.notes.map((note) => <li key={note}>{note}</li>)}</ul></section>
    </div>
  </details>
}
function DataPanel({ title, description, count, emptyText, children }: {
  title: string; description: string; count: number; emptyText: string; children: ReactNode
}) {
  return <section className="panel v15-table-panel">
    <header className="v15-table-heading">
      <div><h2>{title}</h2><p>{description}</p></div>
      <span>{number(count)} مورد</span>
    </header>
    {count > 0 ? <div className="table-wrap">{children}</div> : <div className="v15-empty-state">{emptyText}</div>}
  </section>
}
function Feedback({ value }: { value: string | null }) {
  return value ? <div className="message" role="status">{value}</div> : null
}

const ingredientGuide: PageGuideContent = {
  purpose: 'تعریف شناسنامه هر ماده پیش از خرید، دستور پخت و کنترل موجودی.',
  steps: [
    'نام ماده و واحد پایه‌ای را انتخاب کنید که همیشه موجودی با آن سنجیده می‌شود؛ مانند گرم، عدد یا لیتر.',
    'حداقل موجودی را برای هشدار کمبود ثبت کنید. «سطح هدف انبار» مقدار دلخواهی است که ترجیح می‌دهید بعد از خرید در انبار بماند و وارد کردنش اختیاری است.',
    'برای موادی که باید ورود، مصرف و ضایعاتشان ثبت شود، گزینه «ثبت گردش انبار» را روشن نگه دارید.',
    'پس از ذخیره، ماده را در خریدها و دستور پخت غذاها استفاده کنید.',
  ],
  example: 'برای برنج، واحد پایه را «گرم»، حداقل را 5000 و موجودی هدف را 15000 ثبت کنید. خرید یک کیسه 10 کیلویی بعداً با ضریب 10000، ده‌هزار گرم به انبار اضافه می‌کند.',
  notes: [
    'پس از ثبت اولین گردش انبار، واحد پایه قابل تغییر نیست؛ چون تمام سابقه موجودی با همان واحد ثبت شده است.',
    'سطح هدف، موجودی فعلی نیست و فعلاً فقط یک مرجع برنامه‌ریزی است؛ محاسبه لیست خرید بر اساس نیاز سفارش‌ها و موجودی واقعی انجام می‌شود.',
    'ردیف زرد یعنی موجودی ماده به حداقل تعیین‌شده رسیده یا از آن کمتر است.',
  ],
}

const supplierGuide: PageGuideContent = {
  purpose: 'نگهداری اطلاعات فروشنده‌هایی که خرید مواد اولیه از آن‌ها انجام می‌شود.',
  steps: [
    'نام فروشگاه یا تأمین‌کننده را ثبت کنید.',
    'نام شخص تماس، موبایل و آدرس را برای پیگیری خرید و فاکتور وارد کنید.',
    'در زمان ثبت خرید، تأمین‌کننده را انتخاب کنید تا سابقه خریدهای او قابل پیگیری باشد.',
    'برای اصلاح اطلاعات، از دکمه «ویرایش» همان ردیف استفاده کنید.',
  ],
  example: 'تأمین‌کننده «برنج جنوب»، شخص تماس «آقای احمدی» و شماره تماس او را ثبت کنید؛ سپس هنگام ثبت فاکتور برنج، همین تأمین‌کننده را انتخاب کنید.',
  notes: [
    'برای خریدهای بدون فروشنده مشخص می‌توانید در صفحه خریدها گزینه «خرید متفرقه» را انتخاب کنید.',
    'شماره تماس و آدرس فقط برای مدیریت داخلی هستند و به مشتری نمایش داده نمی‌شوند.',
  ],
}

const inventoryGuide: PageGuideContent = {
  purpose: 'ثبت اصلاحات دستی، ضایعات و انبارگردانی و مشاهده دفتر گردش مواد.',
  steps: [
    'ماده و نوع ثبت را انتخاب کنید.',
    'برای افزایش، کاهش یا ضایعات مقدار تغییر را وارد کنید؛ برای انبارگردانی مقدار واقعی شمارش‌شده را بنویسید.',
    'دلیل قابل پیگیری ثبت کنید و گردش را ذخیره کنید.',
    'نتیجه را در جدول گردش‌ها و موجودی جدید را در صفحه مواد اولیه بررسی کنید.',
  ],
  example: 'اگر سیستم 25 کیلو برنج نشان می‌دهد اما شمارش واقعی 23 کیلو است، عملیات «انبارگردانی» و مقدار 23000 گرم را ثبت کنید؛ سیستم فقط کاهش 2000 گرم را ثبت می‌کند.',
  notes: [
    'خرید تأییدشده به‌صورت خودکار ورود انبار ایجاد می‌کند؛ آن را دوباره با «افزایش دستی» ثبت نکنید.',
    'تأیید سفارش دارای دستور پخت نیز مصرف مواد را خودکار ثبت می‌کند.',
    'برای ضایعات حتماً دلیل درست را انتخاب کنید تا گزارش هزینه ضایعات قابل اتکا باشد.',
  ],
}

const purchaseGuide: PageGuideContent = {
  purpose: 'ثبت فاکتور مواد اولیه، ورود کنترل‌شده به انبار و پرداخت بدهی خرید.',
  steps: [
    'اطلاعات فاکتور و یک یا چند ردیف ماده را وارد و «پیش‌نویس» را ثبت کنید.',
    'مبلغ، تعداد، واحد خرید و ضریب تبدیل به واحد پایه را بازبینی کنید.',
    'خرید را تأیید کنید تا موجودی و میانگین بهای مواد به‌روزرسانی شود.',
    'پس از پرداخت وجه، در بخش «پرداخت خرید» حساب، روش، مبلغ و شماره پیگیری را ثبت کنید.',
  ],
  example: 'برای یک کیسه 10 کیلویی برنج با واحد پایه گرم: تعداد 1، واحد خرید «کیسه»، ضریب تبدیل 10000 و قیمت واحد را مبلغ کل همان کیسه وارد کنید.',
  notes: [
    'پیش‌نویس هیچ تغییری در موجودی ایجاد نمی‌کند؛ ورود انبار فقط هنگام تأیید انجام می‌شود.',
    'تخفیف ردیف از همان ردیف کم می‌شود؛ تخفیف کل و هزینه جانبی روی کل فاکتور اعمال می‌شوند.',
    'خرید پرداخت‌شده قابل لغو نیست و خریدی که موجودی آن مصرف شده فقط در صورت امکان برگشت امن لغو می‌شود.',
  ],
}

const shoppingGuide: PageGuideContent = {
  purpose: 'محاسبه مواد موردنیاز سفارش‌های یک روز و تبدیل کسری‌ها به فهرست قابل پیگیری.',
  steps: [
    'تاریخ هدف را انتخاب کنید؛ سفارش‌ها و دستور پخت فعال همان روز مبنای محاسبه هستند.',
    '«محاسبه نیاز خرید» را بزنید و مقدار نیاز، موجودی فعلی و کسری را کنترل کنید.',
    'اگر کسری وجود داشت، «تبدیل به لیست خرید» را بزنید تا یک تصویر ثابت از نیاز آن روز ذخیره شود.',
    'پس از خرید واقعی، فاکتور را در صفحه خریدها ثبت و تأیید کنید.',
  ],
  example: 'اگر سفارش‌های فردا به 8 کیلو برنج نیاز دارند و موجودی 5 کیلو است، جدول کسری 3 کیلو را پیشنهاد می‌دهد؛ هزینه برآوردی با میانگین بهای ثبت‌شده محاسبه می‌شود.',
  notes: [
    'غذا بدون دستور پخت، در محاسبه مواد موردنیاز سهمی ندارد.',
    'سفارش لغوشده و مصرف انباری که قبلاً ثبت شده دوباره محاسبه نمی‌شود.',
    'ساخت لیست خرید، موجودی یا حساب مالی را تغییر نمی‌دهد و جای ثبت فاکتور خرید نیست.',
  ],
}

const financeGuide: PageGuideContent = {
  purpose: 'تعریف صندوق و حساب‌ها، ثبت هزینه و درآمد دستی، انتقال وجه و مدیریت دستگاه‌های پوز.',
  steps: [
    'ابتدا حساب‌های واقعی مانند صندوق، بانک یا تنخواه را با مانده افتتاحیه صحیح تعریف کنید.',
    'درآمد یا هزینه‌ای را که از مسیر سفارش و خرید ثبت نشده، در فرم تراکنش دستی وارد کنید.',
    'برای جابه‌جایی پول بین دو حساب فقط از «انتقال بین حساب‌ها» استفاده کنید.',
    'هر دستگاه پوز را به همان حساب بانکی متصل کنید که مبالغ آن را دریافت می‌کند.',
  ],
  example: 'برای پرداخت 450 هزار تومان هزینه پیک از صندوق: نوع «هزینه»، حساب «صندوق»، دسته «حمل‌ونقل»، مبلغ و شرح را ثبت کنید. خرید مواد را اینجا دوباره ثبت نکنید.',
  notes: [
    'پرداخت خرید از صفحه خریدها و دریافت سفارش از صفحه پرداخت‌ها، گردش مالی متناظر را خودکار ایجاد می‌کنند.',
    'مانده افتتاحیه پس از ایجاد اولین گردش حساب قابل تغییر نیست.',
    'انتقال وجه دو گردش متوازن ایجاد می‌کند؛ یک برداشت از مبدأ و یک واریز به مقصد.',
    'سیستم اجازه هزینه، انتقال یا استرداد بیشتر از مانده حساب را نمی‌دهد.',
  ],
}

const paymentGuide: PageGuideContent = {
  purpose: 'ثبت و تعیین تکلیف پرداخت هر سفارش و انعکاس قطعی آن در حساب مالی.',
  steps: [
    'تاریخ سفارش را انتخاب و سفارش موردنظر را پیدا کنید.',
    'روش پرداخت، حساب مقصد، مبلغ و در صورت وجود شماره پیگیری را وارد کنید.',
    'پرداخت ثبت‌شده را پس از کنترل واقعی وجه «تأیید» یا «رد» کنید.',
    'در صورت بازگرداندن وجه یک پرداخت تأییدشده، از «استرداد» استفاده کنید.',
  ],
  example: 'برای کارت‌به‌کارت 830 هزار تومانی، سفارش و حساب بانک را انتخاب و شماره پیگیری را ثبت کنید. پس از مشاهده واریز در بانک، دکمه «تأیید» را بزنید تا درآمد در گردش مالی ثبت شود.',
  notes: [
    'ثبت اولیه پرداخت به معنی دریافت قطعی وجه نیست؛ درآمد فقط پس از تأیید وارد حساب می‌شود.',
    'مجموع پرداخت‌های باز و تأییدشده نمی‌تواند از مبلغ کل سفارش بیشتر شود.',
    'برای روش پوز، دستگاه باید به همان حساب انتخاب‌شده متصل باشد.',
    'استرداد، مبلغ را از حساب کم می‌کند و فقط برای پرداخت تأییدشده ممکن است.',
  ],
}
function submitError(reason: unknown) {
  return reason instanceof Error ? reason.message : 'عملیات انجام نشد.'
}

export function IngredientsPage() {
  const [items, setItems] = useState<IngredientDto[]>([])
  const [units, setUnits] = useState<UnitDto[]>([])
  const [editing, setEditing] = useState<IngredientDto | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const [ingredientRows, unitRows] = await Promise.all([adminApi.ingredients(), adminApi.units()])
      setItems(ingredientRows); setUnits(unitRows)
    } catch (e) { setMessage(submitError(e)) }
  }, [])
  useEffect(() => { void load() }, [load])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setMessage(null)
    const form = new FormData(event.currentTarget)
    const request = {
      name: String(form.get('name') ?? ''), code: String(form.get('code') ?? '') || null,
      categoryId: null, baseUnitId: Number(form.get('baseUnitId')),
      minimumStockLevel: String(form.get('minimumStockLevel') ?? '0'),
      preferredStockLevel: String(form.get('preferredStockLevel') ?? '') || null,
      isInventoryTracked: form.get('isInventoryTracked') === 'on',
      isActive: form.get('isActive') === 'on', notes: String(form.get('notes') ?? '') || null,
    }
    try {
      if (editing) await adminApi.updateIngredient(editing.id, request)
      else await adminApi.createIngredient(request)
      setEditing(null); event.currentTarget.reset(); setMessage('ماده اولیه ذخیره شد.'); await load()
    } catch (e) { setMessage(submitError(e)) }
  }
  return <Frame title="مواد اولیه">
    <PageGuide content={ingredientGuide} />
    <form className="panel v15-form ingredients-form" onSubmit={submit}>
      <h2>{editing ? 'ویرایش ماده اولیه' : 'تعریف ماده اولیه'}</h2>
      <label className="ingredient-name-field">نام<input name="name" required defaultValue={editing?.name} key={`name-${editing?.id ?? 0}`} /></label>
      <label className="ingredient-code-field">کد<input name="code" dir="ltr" defaultValue={editing?.code ?? ''} key={`code-${editing?.id ?? 0}`} /></label>
      <label className="ingredient-unit-field">واحد پایه<select name="baseUnitId" required defaultValue={editing?.baseUnitId} key={`unit-${editing?.id ?? 0}`}>
        <option value="">انتخاب کنید</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
      </select></label>
      <label className="ingredient-minimum-field">حداقل موجودی<input name="minimumStockLevel" inputMode="decimal" required defaultValue={editing?.minimumStockLevel ?? '0'} key={`min-${editing?.id ?? 0}`} /></label>
      <label className="ingredient-target-field" title="مقدار دلخواه موجودی پس از خرید؛ این عدد موجودی فعلی نیست.">
        سطح هدف انبار (اختیاری)
        <input name="preferredStockLevel" inputMode="decimal" placeholder="مثلاً 15000" defaultValue={editing?.preferredStockLevel ?? ''} key={`preferred-${editing?.id ?? 0}`} />
      </label>
      <label className="ingredient-notes-field">یادداشت<input name="notes" defaultValue={editing?.notes ?? ''} key={`notes-${editing?.id ?? 0}`} /></label>
      <div className="v15-switches" role="group" aria-label="تنظیمات ماده اولیه">
        <label className="switch" title="ورود، مصرف، ضایعات و انبارگردانی این ماده ثبت و کنترل می‌شود.">
          <input name="isInventoryTracked" type="checkbox" defaultChecked={editing?.isInventoryTracked ?? true} key={`tracked-${editing?.id ?? 0}`} />
          ثبت گردش انبار
        </label>
        <label className="switch">
          <input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} key={`active-${editing?.id ?? 0}`} />
          فعال
        </label>
      </div>
      <div className="ingredient-form-actions">
        <button className="primary">{editing ? 'ذخیره تغییرات' : 'افزودن ماده'}</button>
        {editing && <button type="button" onClick={() => setEditing(null)}>انصراف</button>}
      </div>
    </form>
    <Feedback value={message} />
    <DataPanel title="فهرست مواد اولیه" description="موجودی، نقطه هشدار و میانگین بهای هر ماده" count={items.length} emptyText="هنوز ماده اولیه‌ای تعریف نشده است.">
      <table><thead><tr><th>ماده</th><th>واحد</th><th>موجودی</th><th>حداقل</th><th>سطح هدف</th><th>میانگین موزون</th><th>وضعیت</th><th>عملیات</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id} className={Number(item.currentStock) <= Number(item.minimumStockLevel) ? 'low-stock-row' : ''}>
        <td>{item.name}</td><td>{item.baseUnitName}</td><td>{number(item.currentStock)}</td><td>{number(item.minimumStockLevel)}</td>
        <td>{item.preferredStockLevel ? number(item.preferredStockLevel) : '—'}</td><td>{money(item.weightedAverageCost)}</td><td>{item.isActive ? 'فعال' : 'غیرفعال'}</td>
        <td><button type="button" onClick={() => setEditing(item)}>ویرایش</button></td>
      </tr>)}</tbody></table>
    </DataPanel>
  </Frame>
}

export function SuppliersPage() {
  const [items, setItems] = useState<SupplierDto[]>([])
  const [editing, setEditing] = useState<SupplierDto | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => { try { setItems(await adminApi.suppliers()) } catch (e) { setMessage(submitError(e)) } }, [])
  useEffect(() => { void load() }, [load])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    const value = { name: String(data.get('name') ?? ''), contactName: String(data.get('contactName') ?? '') || null,
      mobile: String(data.get('mobile') ?? '') || null, phone: null, address: String(data.get('address') ?? '') || null,
      notes: null, isActive: true }
    try { editing ? await adminApi.updateSupplier(editing.id, value) : await adminApi.createSupplier(value)
      setEditing(null); event.currentTarget.reset(); setMessage('تأمین‌کننده ذخیره شد.'); await load()
    } catch (e) { setMessage(submitError(e)) }
  }
  return <Frame title="تأمین‌کنندگان"><PageGuide content={supplierGuide} /><form className="panel v15-form" onSubmit={submit}>
    <h2>{editing ? 'ویرایش تأمین‌کننده' : 'تعریف تأمین‌کننده'}</h2>
    <label>نام<input name="name" required defaultValue={editing?.name} key={`sname-${editing?.id ?? 0}`} /></label>
    <label>شخص تماس<input name="contactName" defaultValue={editing?.contactName ?? ''} key={`sc-${editing?.id ?? 0}`} /></label>
    <label>موبایل<input name="mobile" dir="ltr" defaultValue={editing?.mobile ?? ''} key={`sm-${editing?.id ?? 0}`} /></label>
    <label>آدرس<input name="address" defaultValue={editing?.address ?? ''} key={`sa-${editing?.id ?? 0}`} /></label>
    <button className="primary">{editing ? 'ذخیره' : 'افزودن'}</button></form><Feedback value={message} />
    <DataPanel title="تأمین‌کنندگان ثبت‌شده" description="اطلاعات تماس مورد استفاده در فاکتورهای خرید" count={items.length} emptyText="هنوز تأمین‌کننده‌ای ثبت نشده است.">
      <table><thead><tr><th>نام</th><th>شخص تماس</th><th>موبایل</th><th>آدرس</th><th>عملیات</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.contactName ?? '—'}</td><td dir="ltr">{item.mobile ?? '—'}</td><td>{item.address ?? '—'}</td><td><button onClick={() => setEditing(item)}>ویرایش</button></td></tr>)}</tbody>
    </table></DataPanel></Frame>
}

export function InventoryPage() {
  const [ingredients, setIngredients] = useState<IngredientDto[]>([])
  const [movements, setMovements] = useState<InventoryMovementDto[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [operation, setOperation] = useState<'increase' | 'decrease' | 'waste' | 'count'>('increase')
  const load = useCallback(async () => {
    try { const [i, m] = await Promise.all([adminApi.ingredients(), adminApi.inventoryMovements()]); setIngredients(i); setMovements(m) }
    catch (e) { setMessage(submitError(e)) }
  }, [])
  useEffect(() => { void load() }, [load])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try {
      const kind = String(data.get('operation') ?? operation) as typeof operation
      const quantity = normalizeDecimalInput(data.get('quantity'))
      const reason = String(data.get('reason') ?? '').trim()
      if (kind === 'waste') await adminApi.registerWaste({ ingredientId: Number(data.get('ingredientId')),
        quantity, reason: reason as 'سایر', notes: null })
      else if (kind === 'count') await adminApi.confirmStockCount({
        items: [{ ingredientId: Number(data.get('ingredientId')), countedQuantity: quantity }],
        notes: reason || null,
      })
      else await adminApi.adjustInventory({ ingredientId: Number(data.get('ingredientId')),
        quantity, type: kind as 'increase' | 'decrease',
        reason, notes: null })
      setMessage('گردش انبار ثبت شد.'); event.currentTarget.reset(); setOperation('increase'); await load()
    } catch (e) { setMessage(submitError(e)) }
  }
  const typeLabel: Record<number, string> = {
    [InventoryTransactionType.PurchaseIn]:'ورود از خرید',[InventoryTransactionType.ProductionConsumption]:'مصرف تولید',
    [InventoryTransactionType.WasteOut]:'ضایعات',[InventoryTransactionType.ManualIncrease]:'افزایش دستی',
    [InventoryTransactionType.ManualDecrease]:'کاهش دستی',[InventoryTransactionType.StockCountAdjustment]:'اصلاح انبارگردانی',
    [InventoryTransactionType.PurchaseReversal]:'برگشت خرید',[InventoryTransactionType.OrderCancellationReversal]:'برگشت مصرف',
  }
  const movementDirectionLabel = (item: InventoryMovementDto) => {
    const quantity = Number(item.quantityInBaseUnit)
    if (item.transactionType === InventoryTransactionType.StockCountAdjustment) {
      return quantity > 0 ? 'اصلاح افزایشی' : 'اصلاح کاهشی'
    }
    return quantity > 0 ? 'ورود به انبار' : 'خروج از انبار'
  }
  return <Frame title="انبار"><PageGuide content={inventoryGuide} /><form className="panel v15-form" onSubmit={submit}>
    <h2>ثبت گردش انبار</h2>
    <label>ماده<select name="ingredientId" required><option value="">انتخاب کنید</option>{ingredients.filter((x) => x.isActive && x.isInventoryTracked).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>نوع ثبت<select name="operation" value={operation} onChange={(event) => setOperation(event.target.value as typeof operation)}><option value="increase">افزایش دستی</option><option value="decrease">کاهش دستی</option><option value="waste">ضایعات</option><option value="count">انبارگردانی</option></select></label>
    <label>{operation === 'count' ? 'موجودی شمارش‌شده' : 'مقدار'}<input name="quantity" inputMode="decimal" required /></label>
    {operation === 'waste' ? <label>دلیل<select name="reason" required><option value="">انتخاب کنید</option>{['فساد','سوختگی','ریزش','اشتباه در پخت','مصرف شخصی','بسته‌بندی آسیب‌دیده','سایر'].map((reason) => <option key={reason}>{reason}</option>)}</select></label>
      : <label>{operation === 'count' ? 'یادداشت' : 'دلیل'}<input name="reason" required={operation !== 'count'} /></label>}
    <button className="primary">ثبت گردش</button></form><Feedback value={message} />
    <DataPanel title="دفتر گردش انبار" description="نوع ثبت، جهت اثر روی موجودی و مقدار هر گردش" count={movements.length} emptyText="هنوز گردش انباری ثبت نشده است.">
      <table><thead><tr><th>زمان</th><th>ماده</th><th>نوع ثبت</th><th>نوع گردش</th><th>مقدار</th><th>هزینه واحد</th><th>یادداشت</th></tr></thead>
      <tbody>{movements.map((item) => <tr key={item.id}><td>{date(item.transactionDate)}</td><td>{item.ingredientName}</td>
        <td>{typeLabel[item.transactionType] ?? 'نامشخص'}</td><td>{movementDirectionLabel(item)}</td><td dir="ltr">{number(item.quantityInBaseUnit)}</td><td>{money(item.unitCost)}</td><td>{item.notes ?? '—'}</td></tr>)}</tbody></table>
    </DataPanel>
  </Frame>
}

export function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseSummaryDto[]>([])
  const [ingredients, setIngredients] = useState<IngredientDto[]>([])
  const [units, setUnits] = useState<UnitDto[]>([])
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [accounts, setAccounts] = useState<FinancialAccountDto[]>([])
  const [lines, setLines] = useState<PurchaseLineDraft[]>([emptyPurchaseLine()])
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { const [p,i,u,s,a]=await Promise.all([adminApi.purchases(),adminApi.ingredients(),adminApi.units(),adminApi.suppliers(),adminApi.financialAccounts()])
      setPurchases(p);setIngredients(i);setUnits(u);setSuppliers(s);setAccounts(a) } catch(e){setMessage(submitError(e))}
  },[])
  useEffect(()=>{void load()},[load])
  const updateLine = (key:string, field:keyof Omit<PurchaseLineDraft,'key'>, value:string) =>
    setLines((current)=>current.map((line)=>line.key===key?{...line,[field]:value}:line))
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const d=new FormData(event.currentTarget)
    try{await adminApi.createPurchase({supplierId:Number(d.get('supplierId'))||null,invoiceNumber:String(d.get('invoiceNumber')??'')||null,
      purchaseDate:String(d.get('purchaseDate')),discountAmount:moneyInput(d.get('discountAmount')),
      additionalCostAmount:moneyInput(d.get('additionalCostAmount')),notes:String(d.get('notes')??'')||null,attachmentUrl:null,
      items:lines.map((line)=>({ingredientId:Number(line.ingredientId),purchaseUnitId:Number(line.unitId),quantity:normalizeDecimalInput(line.quantity),
        conversionFactorToBaseUnit:normalizeDecimalInput(line.factor),unitPrice:moneyInput(line.unitPrice),lineDiscountAmount:moneyInput(line.discount),
        expirationDate:line.expirationDate||null,batchNumber:line.batchNumber||null,notes:null}))});
      setMessage('پیش‌نویس خرید ثبت شد.');event.currentTarget.reset();setLines([emptyPurchaseLine()]);await load()}
    catch(e){setMessage(submitError(e))}
  }
  const pay=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const d=new FormData(event.currentTarget)
    try{await adminApi.registerPurchasePayment({purchaseId:Number(d.get('purchaseId')),financialAccountId:Number(d.get('accountId')),
      amount:moneyInput(d.get('amount')),paymentMethod:Number(d.get('paymentMethod')) as PurchasePaymentMethod,
      trackingNumber:String(d.get('trackingNumber')??'')||null,notes:null});event.currentTarget.reset();setMessage('پرداخت خرید ثبت شد.');await load()}
    catch(e){setMessage(submitError(e))}}
  const action=async(id:number,kind:'confirm'|'cancel')=>{if(!confirm(kind==='confirm'?'خرید تأیید و وارد انبار شود؟':'خرید لغو یا برگشت داده شود؟'))return
    try{kind==='confirm'?await adminApi.confirmPurchase(id):await adminApi.cancelPurchase(id);setMessage('وضعیت خرید به‌روزرسانی شد.');await load()}catch(e){setMessage(submitError(e))}}
  const status:Record<number,string>={[PurchaseStatus.Draft]:'پیش‌نویس',[PurchaseStatus.Confirmed]:'تأییدشده',[PurchaseStatus.Cancelled]:'لغوشده'}
  return <Frame title="خریدها"><PageGuide content={purchaseGuide} /><form className="panel v15-form purchase-form" onSubmit={submit}><h2>پیش‌نویس خرید</h2>
    <label>تأمین‌کننده<select name="supplierId"><option value="">خرید متفرقه</option>{suppliers.filter(x=>x.isActive).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
    <label>تاریخ<input name="purchaseDate" type="date" defaultValue={today()} required /></label>
    <label>شماره فاکتور<input name="invoiceNumber" /></label>
    <label>تخفیف کل<input name="discountAmount" inputMode="numeric" defaultValue="0" /></label>
    <label>هزینه جانبی<input name="additionalCostAmount" inputMode="numeric" defaultValue="0" /></label>
    <label>یادداشت<input name="notes" /></label>
    <div className="v15-lines"><h3>اقلام خرید</h3>{lines.map((line,index)=><div className="v15-line" key={line.key}>
      <label>ماده<select required value={line.ingredientId} onChange={(e)=>updateLine(line.key,'ingredientId',e.target.value)}><option value="">انتخاب</option>{ingredients.filter(x=>x.isActive).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
      <label>واحد خرید<select required value={line.unitId} onChange={(e)=>updateLine(line.key,'unitId',e.target.value)}><option value="">انتخاب</option>{units.filter(x=>x.isActive).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
      <label>تعداد<input required inputMode="decimal" value={line.quantity} onChange={(e)=>updateLine(line.key,'quantity',e.target.value)}/></label>
      <label>ضریب به پایه<input required inputMode="decimal" value={line.factor} onChange={(e)=>updateLine(line.key,'factor',e.target.value)}/></label>
      <label>قیمت واحد<input required inputMode="numeric" value={line.unitPrice} onChange={(e)=>updateLine(line.key,'unitPrice',e.target.value)}/></label>
      <label>تخفیف ردیف<input inputMode="numeric" value={line.discount} onChange={(e)=>updateLine(line.key,'discount',e.target.value)}/></label>
      <label>انقضا<input type="date" value={line.expirationDate} onChange={(e)=>updateLine(line.key,'expirationDate',e.target.value)}/></label>
      <label>بچ/سری<input value={line.batchNumber} onChange={(e)=>updateLine(line.key,'batchNumber',e.target.value)}/></label>
      <button type="button" className="danger" disabled={lines.length===1} onClick={()=>setLines((current)=>current.filter((item)=>item.key!==line.key))}>حذف ردیف {index+1}</button>
    </div>)}</div>
    <button type="button" onClick={()=>setLines((current)=>[...current,emptyPurchaseLine()])}>افزودن ردیف</button>
    <button className="primary">ثبت پیش‌نویس</button>
  </form><Feedback value={message}/><DataPanel title="فاکتورهای خرید" description="پیش‌نویس‌ها، خریدهای واردشده به انبار و خریدهای لغوشده" count={purchases.length} emptyText="هنوز فاکتور خریدی ثبت نشده است.">
    <table><thead><tr><th>شماره خرید</th><th>تاریخ</th><th>تأمین‌کننده</th><th>مبلغ کل</th><th>پرداخت‌شده</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>{purchases.map(x=><tr key={x.id}><td dir="ltr">{x.purchaseNumber}</td><td>{dateOnly(x.purchaseDate)}</td><td>{x.supplierName??'متفرقه'}</td><td>{money(x.totalAmount)}</td><td>{money(x.paidAmount)}</td><td>{status[x.status]}</td>
      <td className="actions">{x.status===PurchaseStatus.Draft&&<button type="button" className="primary" onClick={()=>void action(x.id,'confirm')}>تأیید</button>}
        {x.status!==PurchaseStatus.Cancelled&&<button type="button" className="danger" onClick={()=>void action(x.id,'cancel')}>لغو/برگشت</button>}</td></tr>)}</tbody></table>
    </DataPanel>
    <form className="panel v15-form" onSubmit={pay}><h2>پرداخت خرید</h2>
      <label>خرید<select name="purchaseId" required><option value="">انتخاب</option>{purchases.filter(x=>x.status===PurchaseStatus.Confirmed&&x.paidAmount<x.totalAmount).map(x=><option key={x.id} value={x.id}>{x.purchaseNumber} — {money(x.totalAmount-x.paidAmount)}</option>)}</select></label>
      <label>حساب<select name="accountId" required><option value="">انتخاب</option>{accounts.filter(x=>x.isActive).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>روش<select name="paymentMethod"><option value={PurchasePaymentMethod.Cash}>نقدی</option><option value={PurchasePaymentMethod.Bank}>بانکی</option><option value={PurchasePaymentMethod.Card}>کارت</option><option value={PurchasePaymentMethod.Other}>سایر</option></select></label>
      <label>مبلغ<input name="amount" inputMode="numeric" required /></label><label>شماره پیگیری<input name="trackingNumber" /></label>
      <button className="primary">ثبت پرداخت خرید</button>
    </form></Frame>
}

export function RecipesPage() {
  const [foods,setFoods]=useState<Array<{id:number;name:string}>>([])
  const [ingredients,setIngredients]=useState<IngredientDto[]>([])
  const [foodId,setFoodId]=useState(0)
  const [recipe,setRecipe]=useState<Awaited<ReturnType<typeof adminApi.recipe>>>(null)
  const [yieldQuantity,setYieldQuantity]=useState('10')
  const [preparationLoss,setPreparationLoss]=useState('')
  const [overhead,setOverhead]=useState('0')
  const [recipeNotes,setRecipeNotes]=useState('')
  const [lines,setLines]=useState<RecipeLineDraft[]>([emptyRecipeLine()])
  const [message,setMessage]=useState<string|null>(null)
  useEffect(()=>{void Promise.all([adminApi.foods(),adminApi.ingredients()]).then(([f,i])=>{setFoods(f);setIngredients(i)})},[])
  useEffect(()=>{if(!foodId){setRecipe(null);setLines([emptyRecipeLine()]);return}
    void adminApi.recipe(foodId).then((value)=>{setRecipe(value);setYieldQuantity(String(value?.yieldQuantity??10));setPreparationLoss(value?.preparationLossPercent===null||value?.preparationLossPercent===undefined?'':String(value.preparationLossPercent));setOverhead(String(value?.overheadPerPortion??0));setRecipeNotes(value?.notes??'');
      setLines(value?.items.length?value.items.map((item)=>({key:crypto.randomUUID(),ingredientId:String(item.ingredientId),quantity:item.quantityInBaseUnit,waste:item.wastePercent===null?'':String(item.wastePercent)})):[emptyRecipeLine()])
    }).catch(e=>setMessage(submitError(e)))},[foodId])
  const updateLine=(key:string,field:keyof Omit<RecipeLineDraft,'key'>,value:string)=>setLines((current)=>current.map((line)=>line.key===key?{...line,[field]:value}:line))
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault()
    try{await adminApi.saveRecipe(foodId,{yieldQuantity:Number(yieldQuantity),preparationLossPercent:preparationLoss?Number(preparationLoss):null,overheadPerPortion:Number(overhead)||0,notes:recipeNotes||null,isActive:true,
      items:lines.map((line)=>({ingredientId:Number(line.ingredientId),quantityInBaseUnit:line.quantity,wastePercent:line.waste?Number(line.waste):null,notes:null}))})
      setMessage('دستور پخت ذخیره شد.');setRecipe(await adminApi.recipe(foodId))}catch(e){setMessage(submitError(e))}}
  return <Frame title="دستور پخت"><div className="panel"><label>غذا<select value={foodId} onChange={e=>setFoodId(Number(e.target.value))}><option value="0">انتخاب غذا</option>{foods.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
    {foodId>0&&<form className="panel v15-form" onSubmit={submit}><label>بازده (پرس)<input type="number" min="1" value={yieldQuantity} onChange={(e)=>setYieldQuantity(e.target.value)}/></label>
      <label>افت آماده‌سازی درصد<input type="number" min="0" max="99.99" step="0.01" value={preparationLoss} onChange={(e)=>setPreparationLoss(e.target.value)}/></label>
      <label>سربار هر پرس<input inputMode="numeric" value={overhead} onChange={(e)=>setOverhead(e.target.value)}/></label>
      <label>یادداشت<input value={recipeNotes} onChange={(e)=>setRecipeNotes(e.target.value)}/></label>
      <div className="v15-lines"><h3>مواد دستور</h3>{lines.map((line,index)=><div className="v15-line recipe-line" key={line.key}>
        <label>ماده اولیه<select required value={line.ingredientId} onChange={(e)=>updateLine(line.key,'ingredientId',e.target.value)}><option value="">انتخاب</option>{ingredients.filter(x=>x.isActive).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
        <label>مقدار کل<input inputMode="decimal" required value={line.quantity} onChange={(e)=>updateLine(line.key,'quantity',e.target.value)}/></label>
        <label>ضایعات درصد<input type="number" min="0" max="99.99" step="0.01" value={line.waste} onChange={(e)=>updateLine(line.key,'waste',e.target.value)}/></label>
        <button type="button" className="danger" disabled={lines.length===1} onClick={()=>setLines((current)=>current.filter((item)=>item.key!==line.key))}>حذف ردیف {index+1}</button>
      </div>)}</div>
      <button type="button" onClick={()=>setLines((current)=>[...current,emptyRecipeLine()])}>افزودن ماده</button><button className="primary">ذخیره دستور</button></form>}
    <Feedback value={message}/>{recipe&&<div className="metric-grid"><article className="metric"><span>هزینه کل دستور</span><strong>{money(recipe.totalRecipeCost)}</strong></article>
      <article className="metric"><span>بهای هر پرس</span><strong>{money(recipe.costPerPortion)}</strong></article><article className="metric"><span>سود ناخالص تقریبی</span><strong>{recipe.estimatedGrossProfit===null?'—':money(recipe.estimatedGrossProfit)}</strong></article></div>}
    {recipe&&<div className="panel table-wrap"><table><thead><tr><th>ماده</th><th>مقدار کل</th><th>هر پرس</th><th>هزینه</th></tr></thead><tbody>{recipe.items.map(x=><tr key={x.id}><td>{x.ingredientName}</td><td>{number(x.quantityInBaseUnit)} {x.unitName}</td><td>{number(x.quantityPerPortion)}</td><td>{money(x.ingredientCost)}</td></tr>)}</tbody></table></div>}
  </Frame>
}

export function FinancePage() {
  const [accounts, setAccounts] = useState<FinancialAccountDto[]>([])
  const [categories, setCategories] = useState<ExpenseCategoryDto[]>([])
  const [terminals, setTerminals] = useState<PosTerminalDto[]>([])
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof adminApi.financialTransactions>>>([])
  const [editingAccount, setEditingAccount] = useState<FinancialAccountDto | null>(null)
  const [editingTerminal, setEditingTerminal] = useState<PosTerminalDto | null>(null)
  const [entryKind, setEntryKind] = useState<'income' | 'expense'>('expense')
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const [accountRows, transactionRows, terminalRows, categoryRows] = await Promise.all([
        adminApi.financialAccounts(), adminApi.financialTransactions(),
        adminApi.posTerminals(), adminApi.expenseCategories(),
      ])
      setAccounts(accountRows); setTransactions(transactionRows)
      setTerminals(terminalRows); setCategories(categoryRows)
    } catch (error) { setMessage(submitError(error)) }
  }, [])
  useEffect(() => { void load() }, [load])
  const account = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    const value = {
      name: String(data.get('name')), type: Number(data.get('type')) as FinancialAccountType,
      bankName: String(data.get('bankName') ?? '') || null,
      cardNumberMasked: String(data.get('cardNumberMasked') ?? '') || null,
      accountNumberMasked: String(data.get('accountNumberMasked') ?? '') || null,
      ibanMasked: String(data.get('ibanMasked') ?? '') || null,
      openingBalance: Number(data.get('opening')) || 0,
      isActive: data.get('isActive') === 'on', notes: String(data.get('notes') ?? '') || null,
    }
    try {
      if (editingAccount) await adminApi.updateFinancialAccount(editingAccount.id, value)
      else await adminApi.createFinancialAccount(value)
      event.currentTarget.reset(); setEditingAccount(null); setMessage('حساب ذخیره شد.'); await load()
    } catch (error) { setMessage(submitError(error)) }
  }
  const entry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try {
      await adminApi.createFinancialEntry(entryKind, {
        financialAccountId: Number(data.get('accountId')), amount: Number(data.get('amount')),
        categoryId: entryKind === 'expense' ? Number(data.get('categoryId')) || null : null,
        description: String(data.get('description')),
      })
      event.currentTarget.reset(); setMessage('تراکنش ثبت شد.'); await load()
    } catch (error) { setMessage(submitError(error)) }
  }
  const move = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try {
      await adminApi.transferFinancialAmount({
        fromAccountId: Number(data.get('fromAccountId')), toAccountId: Number(data.get('toAccountId')),
        amount: Number(data.get('amount')), description: String(data.get('description')),
      })
      event.currentTarget.reset(); setMessage('انتقال بین حساب‌ها ثبت شد.'); await load()
    } catch (error) { setMessage(submitError(error)) }
  }
  const terminal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    const value = {
      title: String(data.get('title')), terminalNumber: String(data.get('terminalNumber')),
      merchantNumber: String(data.get('merchantNumber') ?? '') || null,
      financialAccountId: Number(data.get('accountId')), isActive: data.get('isActive') === 'on',
      notes: String(data.get('notes') ?? '') || null,
    }
    try {
      if (editingTerminal) await adminApi.updatePosTerminal(editingTerminal.id, value)
      else await adminApi.createPosTerminal(value)
      event.currentTarget.reset(); setEditingTerminal(null); setMessage('دستگاه پوز ذخیره شد.'); await load()
    } catch (error) { setMessage(submitError(error)) }
  }
  const activeAccounts = accounts.filter((item) => item.isActive)
  const accountType: Record<number, string> = {
    [FinancialAccountType.Cash]: 'صندوق نقدی', [FinancialAccountType.Bank]: 'بانک',
    [FinancialAccountType.GatewaySettlement]: 'تسویه درگاه', [FinancialAccountType.PettyCash]: 'تنخواه',
    [FinancialAccountType.Other]: 'سایر',
  }
  return <Frame title="مدیریت مالی">
    <PageGuide content={financeGuide} />
    <div className="v15-two-column">
      <form className="panel v15-form" key={`account-${editingAccount?.id ?? 0}`} onSubmit={account}>
        <h2>{editingAccount ? 'ویرایش حساب' : 'حساب جدید'}</h2>
        <label>نام<input name="name" required defaultValue={editingAccount?.name} /></label>
        <label>نوع<select name="type" defaultValue={editingAccount?.type ?? FinancialAccountType.Cash}>
          <option value={FinancialAccountType.Cash}>صندوق نقدی</option><option value={FinancialAccountType.Bank}>بانک</option>
          <option value={FinancialAccountType.GatewaySettlement}>تسویه درگاه</option>
          <option value={FinancialAccountType.PettyCash}>تنخواه</option><option value={FinancialAccountType.Other}>سایر</option>
        </select></label>
        <label>نام بانک<input name="bankName" defaultValue={editingAccount?.bankName ?? ''} /></label>
        <label>شماره کارت نمایشی<input name="cardNumberMasked" dir="ltr" defaultValue={editingAccount?.cardNumberMasked ?? ''} /></label>
        <label>شماره حساب نمایشی<input name="accountNumberMasked" dir="ltr" defaultValue={editingAccount?.accountNumberMasked ?? ''} /></label>
        <label>شبا نمایشی<input name="ibanMasked" dir="ltr" defaultValue={editingAccount?.ibanMasked ?? ''} /></label>
        <label>مانده افتتاحیه<input name="opening" inputMode="numeric" defaultValue={editingAccount?.openingBalance ?? 0} /></label>
        <label>یادداشت<input name="notes" defaultValue={editingAccount?.notes ?? ''} /></label>
        <label className="switch"><input name="isActive" type="checkbox" defaultChecked={editingAccount?.isActive ?? true} />فعال</label>
        <button className="primary">{editingAccount ? 'ذخیره تغییرات' : 'ثبت حساب'}</button>
        {editingAccount && <button type="button" onClick={() => setEditingAccount(null)}>انصراف</button>}
      </form>
      <form className="panel v15-form" onSubmit={entry}>
        <h2>درآمد یا هزینه</h2>
        <label>نوع<select name="kind" value={entryKind} onChange={(event) => setEntryKind(event.target.value as typeof entryKind)}>
          <option value="expense">هزینه</option><option value="income">درآمد</option>
        </select></label>
        <label>حساب<select name="accountId" required><option value="">انتخاب</option>{activeAccounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        {entryKind === 'expense' && <label>دسته هزینه<select name="categoryId"><option value="">بدون دسته</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
        <label>مبلغ<input name="amount" inputMode="numeric" required /></label>
        <label>شرح<input name="description" required /></label><button className="primary">ثبت تراکنش</button>
      </form>
    </div>
    <div className="v15-two-column">
      <form className="panel v15-form" onSubmit={move}><h2>انتقال بین حساب‌ها</h2>
        <label>از حساب<select name="fromAccountId" required><option value="">انتخاب</option>{activeAccounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>به حساب<select name="toAccountId" required><option value="">انتخاب</option>{activeAccounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>مبلغ<input name="amount" inputMode="numeric" required /></label><label>شرح<input name="description" required /></label>
        <button className="primary">ثبت انتقال</button>
      </form>
      <form className="panel v15-form" key={`terminal-${editingTerminal?.id ?? 0}`} onSubmit={terminal}>
        <h2>{editingTerminal ? 'ویرایش دستگاه پوز' : 'دستگاه پوز'}</h2>
        <label>عنوان<input name="title" required defaultValue={editingTerminal?.title} /></label>
        <label>شماره پایانه<input name="terminalNumber" dir="ltr" required defaultValue={editingTerminal?.terminalNumber} /></label>
        <label>شماره پذیرنده<input name="merchantNumber" dir="ltr" defaultValue={editingTerminal?.merchantNumber ?? ''} /></label>
        <label>حساب واریز<select name="accountId" required defaultValue={editingTerminal?.financialAccountId}><option value="">انتخاب</option>{activeAccounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>یادداشت<input name="notes" defaultValue={editingTerminal?.notes ?? ''} /></label>
        <label className="switch"><input name="isActive" type="checkbox" defaultChecked={editingTerminal?.isActive ?? true} />فعال</label>
        <button className="primary">{editingTerminal ? 'ذخیره تغییرات' : 'ثبت دستگاه'}</button>
        {editingTerminal && <button type="button" onClick={() => setEditingTerminal(null)}>انصراف</button>}
      </form>
    </div>
    <Feedback value={message} />
    <DataPanel title="حساب‌های مالی" description="مانده جاری صندوق‌ها، بانک‌ها و تنخواه" count={accounts.length} emptyText="هنوز حساب مالی‌ای تعریف نشده است.">
      <table><thead><tr><th>حساب</th><th>نوع</th><th>مانده</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>
      {accounts.map((item) => <tr key={item.id}><td>{item.name}</td><td>{accountType[item.type]}</td><td>{money(item.currentBalance)}</td><td>{item.isActive ? 'فعال' : 'غیرفعال'}</td><td><button type="button" onClick={() => setEditingAccount(item)}>ویرایش</button></td></tr>)}
    </tbody></table>
    </DataPanel>
    <DataPanel title="دستگاه‌های پوز" description="ارتباط هر پایانه با حساب دریافت‌کننده" count={terminals.length} emptyText="هنوز دستگاه پوزی تعریف نشده است.">
      <table><thead><tr><th>دستگاه پوز</th><th>شماره پایانه</th><th>حساب</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>
      {terminals.map((item) => <tr key={item.id}><td>{item.title}</td><td dir="ltr">{item.terminalNumber}</td><td>{item.financialAccountName}</td><td>{item.isActive ? 'فعال' : 'غیرفعال'}</td><td><button type="button" onClick={() => setEditingTerminal(item)}>ویرایش</button></td></tr>)}
    </tbody></table>
    </DataPanel>
    <DataPanel title="گردش مالی" description="آخرین درآمدها، هزینه‌ها، انتقال‌ها، دریافت‌ها و استردادها" count={transactions.length} emptyText="هنوز گردش مالی‌ای ثبت نشده است.">
      <table><thead><tr><th>زمان</th><th>حساب</th><th>دسته</th><th>شرح</th><th>مبلغ</th></tr></thead><tbody>
      {transactions.map((item) => <tr key={item.id}><td>{date(item.transactionDate)}</td><td>{item.financialAccountName}</td><td>{item.categoryName ?? '—'}</td><td>{item.description}</td><td className={item.amount < 0 ? 'negative-amount' : 'positive-amount'}>{money(item.amount)}</td></tr>)}
    </tbody></table>
    </DataPanel>
  </Frame>
}

export function ShoppingPage() {
  const [target,setTarget]=useState(today());const [items,setItems]=useState<Awaited<ReturnType<typeof adminApi.shoppingRequirements>>>([])
  const [lists,setLists]=useState<Awaited<ReturnType<typeof adminApi.shoppingLists>>>([])
  const [message,setMessage]=useState<string|null>(null)
  const loadLists=useCallback(async()=>{try{setLists(await adminApi.shoppingLists())}catch(e){setMessage(submitError(e))}},[])
  useEffect(()=>{void loadLists()},[loadLists])
  const calculate=async()=>{try{setItems(await adminApi.shoppingRequirements(target,target));setMessage(null)}catch(e){setMessage(submitError(e))}}
  const create=async()=>{try{const result=await adminApi.createShoppingList({title:`لیست خرید ${target}`,targetDate:target,
    items:items.filter(x=>Number(x.shortageQuantity)>0).map(x=>({ingredientId:x.ingredientId,requiredQuantity:x.requiredQuantity,
      currentStockSnapshot:x.currentStock,suggestedPurchaseQuantity:x.shortageQuantity,estimatedUnitCost:x.estimatedUnitCost}))})
    setMessage(`لیست خرید شماره ${number(result.id)} ساخته شد.`);await loadLists()}catch(e){setMessage(submitError(e))}}
  const status:Record<number,string>={[ShoppingListStatus.Draft]:'پیش‌نویس',[ShoppingListStatus.InProgress]:'در حال خرید',[ShoppingListStatus.Completed]:'تکمیل‌شده',[ShoppingListStatus.Cancelled]:'لغوشده'}
  return <Frame title="لیست خرید"><PageGuide content={shoppingGuide} /><div className="panel v15-form"><h2>محاسبه کسری مواد</h2><label>تاریخ هدف<input type="date" value={target} onChange={e=>setTarget(e.target.value)}/></label>
    <button className="primary" onClick={()=>void calculate()}>محاسبه نیاز خرید</button><button disabled={!items.some(x=>Number(x.shortageQuantity)>0)} onClick={()=>void create()}>تبدیل به لیست خرید</button></div>
    <Feedback value={message}/><DataPanel title="نیاز و کسری مواد" description="نتیجه محاسبه بر پایه سفارش‌ها، دستور پخت و موجودی فعلی" count={items.length} emptyText="برای مشاهده نیازها، تاریخ را انتخاب و محاسبه را اجرا کنید.">
      <table><thead><tr><th>ماده</th><th>نیاز</th><th>موجودی</th><th>کسری</th><th>هزینه برآوردی</th></tr></thead>
      <tbody>{items.map(x=><tr key={x.ingredientId}><td>{x.ingredientName}</td><td>{number(x.requiredQuantity)} {x.unitName}</td><td>{number(x.currentStock)}</td><td className={Number(x.shortageQuantity)>0?'negative-amount':undefined}>{number(x.shortageQuantity)}</td><td>{money(x.estimatedPurchaseCost)}</td></tr>)}</tbody></table>
    </DataPanel>
    <DataPanel title="لیست‌های ذخیره‌شده" description="خروجی‌های ثبت‌شده برای پیگیری خرید آشپزخانه" count={lists.length} emptyText="هنوز لیست خریدی ذخیره نشده است.">
      <table><thead><tr><th>شماره</th><th>عنوان</th><th>تاریخ هدف</th><th>وضعیت</th><th>تعداد اقلام</th><th>برآورد خرید</th><th>مواد</th></tr></thead>
      <tbody>{lists.map(x=><tr key={x.id}><td>{number(x.id)}</td><td>{x.title}</td><td dir="ltr">{x.targetDate}</td><td>{status[x.status]}</td><td>{number(x.itemCount)}</td><td>{money(x.estimatedTotal)}</td><td title={x.itemSummary}>{x.itemSummary||'—'}</td></tr>)}</tbody></table>
    </DataPanel></Frame>
}

export function PaymentsPage() {
  const [items,setItems]=useState<Awaited<ReturnType<typeof adminApi.payments>>>([]);const[message,setMessage]=useState<string|null>(null)
  const [accounts,setAccounts]=useState<FinancialAccountDto[]>([])
  const [terminals,setTerminals]=useState<PosTerminalDto[]>([])
  const [orders,setOrders]=useState<Awaited<ReturnType<typeof adminApi.orders>>>([])
  const [orderDate,setOrderDate]=useState(today())
  const [methodValue,setMethodValue]=useState<CustomerPaymentMethod>(CustomerPaymentMethod.CardToCard)
  const [paymentAccountId,setPaymentAccountId]=useState(0)
  const [paymentFilter,setPaymentFilter]=useState<'all'|'pending'|'successful'|'failed'|'refunded'>('all')
  const load=useCallback(async()=>{try{const[p,a,t,o]=await Promise.all([adminApi.payments(),adminApi.financialAccounts(),adminApi.posTerminals(),adminApi.orders({date:orderDate})]);setItems(p);setAccounts(a);setTerminals(t);setOrders(o)}catch(e){setMessage(submitError(e))}},[orderDate])
  useEffect(()=>{void load()},[load])
  const status:Record<number,string>={[PaymentStatus.Pending]:'در انتظار',[PaymentStatus.AwaitingVerification]:'در انتظار تأیید',[PaymentStatus.Paid]:'پرداخت‌شده',[PaymentStatus.Failed]:'ناموفق',[PaymentStatus.Rejected]:'ردشده',[PaymentStatus.Cancelled]:'لغوشده',[PaymentStatus.Refunded]:'مستردشده'}
  const method:Record<number,string>={[CustomerPaymentMethod.Cash]:'نقدی',[CustomerPaymentMethod.CardToCard]:'کارت‌به‌کارت',[CustomerPaymentMethod.OnlineGateway]:'آنلاین',[CustomerPaymentMethod.Pos]:'پوز'}
  const successful=items.filter(x=>x.status===PaymentStatus.Paid)
  const failed=items.filter(x=>[PaymentStatus.Failed,PaymentStatus.Rejected,PaymentStatus.Cancelled].includes(x.status))
  const pending=items.filter(x=>[PaymentStatus.Pending,PaymentStatus.AwaitingVerification].includes(x.status))
  const refunded=items.filter(x=>x.status===PaymentStatus.Refunded)
  const visiblePayments=paymentFilter==='successful'?successful:paymentFilter==='failed'?failed:paymentFilter==='pending'?pending:paymentFilter==='refunded'?refunded:items
  const create=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const d=new FormData(event.currentTarget);try{await adminApi.createPayment({orderId:Number(d.get('orderId')),paymentMethod:methodValue,financialAccountId:Number(d.get('accountId')),posTerminalId:methodValue===CustomerPaymentMethod.Pos?Number(d.get('posTerminalId')):null,amount:Number(d.get('amount')),trackingNumber:String(d.get('trackingNumber')??'')||null,referenceNumber:null,receiptImageUrl:null,description:String(d.get('description')??'')||null});event.currentTarget.reset();setMessage('پرداخت سفارش ثبت شد.');await load()}catch(e){setMessage(submitError(e))}}
  const change=async(id:number,next:number)=>{try{await adminApi.changePaymentStatus(id,next);setMessage('وضعیت پرداخت ثبت شد.');await load()}catch(e){setMessage(submitError(e))}}
  return <Frame title="پرداخت‌ها"><PageGuide content={paymentGuide} /><form className="panel v15-form" onSubmit={create}><h2>پرداخت جدید</h2>
    <label>تاریخ سفارش<input type="date" value={orderDate} onChange={(e)=>setOrderDate(e.target.value)}/></label>
    <label>سفارش<select name="orderId" required><option value="">انتخاب</option>{orders.map(x=><option key={x.id} value={x.id}>{x.orderNumber} — {x.customerFullName} — {money(x.totalAmount)}</option>)}</select></label>
    <label>روش<select value={methodValue} onChange={(e)=>setMethodValue(Number(e.target.value) as CustomerPaymentMethod)}><option value={CustomerPaymentMethod.Cash}>نقدی</option><option value={CustomerPaymentMethod.CardToCard}>کارت‌به‌کارت</option><option value={CustomerPaymentMethod.OnlineGateway}>آنلاین</option><option value={CustomerPaymentMethod.Pos}>پوز</option></select></label>
    <label>حساب<select name="accountId" required value={paymentAccountId||''} onChange={(event)=>setPaymentAccountId(Number(event.target.value))}><option value="">انتخاب</option>{accounts.filter(x=>x.isActive).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    {methodValue===CustomerPaymentMethod.Pos&&<label>دستگاه پوز<select name="posTerminalId" required><option value="">انتخاب</option>{terminals.filter(x=>x.isActive&&x.financialAccountId===paymentAccountId).map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>}
    <label>مبلغ<input name="amount" inputMode="numeric" required/></label><label>شماره پیگیری<input name="trackingNumber" dir="ltr"/></label><label>شرح<input name="description"/></label><button className="primary">ثبت پرداخت</button>
  </form><Feedback value={message}/>
  <section className="payment-status-overview" aria-label="خلاصه پرداخت مشتریان">
    <button type="button" className={paymentFilter==='successful'?'payment-metric success active':'payment-metric success'} onClick={()=>setPaymentFilter('successful')}><span>پرداخت موفق</span><strong>{number(successful.length)}</strong><small>{money(successful.reduce((sum,item)=>sum+item.amount,0))}</small></button>
    <button type="button" className={paymentFilter==='failed'?'payment-metric failed active':'payment-metric failed'} onClick={()=>setPaymentFilter('failed')}><span>پرداخت ناموفق</span><strong>{number(failed.length)}</strong><small>{money(failed.reduce((sum,item)=>sum+item.amount,0))}</small></button>
    <button type="button" className={paymentFilter==='pending'?'payment-metric pending active':'payment-metric pending'} onClick={()=>setPaymentFilter('pending')}><span>نیازمند بررسی</span><strong>{number(pending.length)}</strong><small>{money(pending.reduce((sum,item)=>sum+item.amount,0))}</small></button>
    <button type="button" className={paymentFilter==='refunded'?'payment-metric refunded active':'payment-metric refunded'} onClick={()=>setPaymentFilter('refunded')}><span>برگشت وجه</span><strong>{number(refunded.length)}</strong><small>{money(refunded.reduce((sum,item)=>sum+item.amount,0))}</small></button>
  </section>
  <div className="payment-filter-bar" role="group" aria-label="فیلتر وضعیت پرداخت">
    <button type="button" className={paymentFilter==='all'?'active':''} onClick={()=>setPaymentFilter('all')}>همه</button>
    <button type="button" className={paymentFilter==='successful'?'active':''} onClick={()=>setPaymentFilter('successful')}>موفق</button>
    <button type="button" className={paymentFilter==='failed'?'active':''} onClick={()=>setPaymentFilter('failed')}>ناموفق</button>
    <button type="button" className={paymentFilter==='pending'?'active':''} onClick={()=>setPaymentFilter('pending')}>در انتظار بررسی</button>
    <button type="button" className={paymentFilter==='refunded'?'active':''} onClick={()=>setPaymentFilter('refunded')}>مستردشده</button>
  </div>
  <DataPanel title="پرداخت‌های مشتریان" description="پرداخت‌های موفق، ناموفق و نیازمند بررسی به همراه سفارش و مشخصات مشتری" count={visiblePayments.length} emptyText="در این وضعیت پرداختی وجود ندارد.">
    <table><thead><tr><th>سفارش</th><th>مشتری</th><th>موبایل</th><th>روش</th><th>حساب</th><th>مبلغ</th><th>پیگیری</th><th>زمان ثبت</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>{visiblePayments.map(x=><tr key={x.id}><td dir="ltr">{x.orderNumber}</td><td>{x.customerFullName}</td><td dir="ltr">{x.customerPhoneNumber}</td><td>{method[x.paymentMethod]}</td><td>{x.financialAccountName}</td><td>{money(x.amount)}</td><td dir="ltr">{x.trackingNumber||x.referenceNumber||'—'}</td><td>{date(x.createdAt)}</td><td><span className={`payment-status payment-status-${x.status}`}>{status[x.status]}</span></td><td className="actions">
      {[PaymentStatus.Pending,PaymentStatus.AwaitingVerification].includes(x.status)&&<><button className="primary" onClick={()=>void change(x.id,PaymentStatus.Paid)}>تأیید</button><button className="danger" onClick={()=>void change(x.id,PaymentStatus.Rejected)}>رد</button></>}
      {x.status===PaymentStatus.Paid&&<button className="danger" onClick={()=>confirm('وجه مسترد شود؟')&&void adminApi.refundPayment(x.id).then(()=>{setMessage('وجه مسترد شد.');return load()}).catch(e=>setMessage(submitError(e)))}>استرداد</button>}</td></tr>)}</tbody></table>
    </DataPanel></Frame>
}

export function V15ReportsPage() {
  const [from,setFrom]=useState(today()),[to,setTo]=useState(today());const[data,setData]=useState<Awaited<ReturnType<typeof adminApi.v15Reports>>|null>(null)
  const[message,setMessage]=useState<string|null>(null)
  const load=async()=>{try{setData(await adminApi.v15Reports(from,to));setMessage(null)}catch(e){setMessage(submitError(e))}}
  const paymentMethod: Record<number, string> = {
    [CustomerPaymentMethod.Cash]: 'نقدی', [CustomerPaymentMethod.CardToCard]: 'کارت‌به‌کارت',
    [CustomerPaymentMethod.OnlineGateway]: 'آنلاین', [CustomerPaymentMethod.Pos]: 'پوز',
  }
  return <Frame title="گزارش‌های مدیریتی"><div className="panel v15-form"><label>از<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>تا<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="primary" onClick={()=>void load()}>نمایش گزارش</button></div><Feedback value={message}/>
    {data&&<><div className="metric-grid"><article className="metric"><span>دریافتی خالص</span><strong>{money(data.profit.income)}</strong></article><article className="metric"><span>هزینه</span><strong>{money(data.profit.expense)}</strong></article><article className="metric"><span>سود مدیریتی برآوردی</span><strong>{money(data.profit.income-data.profit.expense)}</strong></article></div>
    <div className="v15-two-column"><div className="panel table-wrap"><h2>دریافت و استرداد</h2><table><thead><tr><th>روش</th><th>تعداد</th><th>دریافتی</th><th>استرداد</th><th>خالص</th></tr></thead><tbody>{data.sales.map((item)=><tr key={item.paymentMethod}><td>{paymentMethod[item.paymentMethod]??'سایر'}</td><td>{number(item.count)}</td><td>{money(item.paidAmount)}</td><td>{money(item.refundedAmount)}</td><td>{money(item.paidAmount-item.refundedAmount)}</td></tr>)}</tbody></table></div>
      <div className="panel table-wrap"><h2>هزینه‌ها</h2><table><thead><tr><th>دسته</th><th>مبلغ</th></tr></thead><tbody>{data.expenses.map((item)=><tr key={item.category}><td>{item.category}</td><td>{money(item.amount)}</td></tr>)}</tbody></table></div></div>
    <div className="panel table-wrap"><h2>گردش مواد اولیه</h2><table><thead><tr><th>ماده</th><th>خرید</th><th>مصرف تولید</th><th>ضایعات</th><th>مانده</th></tr></thead><tbody>{data.usage.map(x=><tr key={x.name}><td>{x.name}</td><td>{number(x.purchase??0)}</td><td>{number(x.consumption??0)}</td><td>{number(x.waste??0)}</td><td>{number(x.closing)} {x.unit}</td></tr>)}</tbody></table></div>
    <div className="panel table-wrap"><h2>جزئیات ضایعات</h2><table><thead><tr><th>ماده</th><th>مقدار</th><th>بهای ضایعات</th></tr></thead><tbody>{data.waste.map((item)=><tr key={item.name}><td>{item.name}</td><td>{number(item.quantity)}</td><td>{money(item.cost)}</td></tr>)}</tbody></table></div></>}</Frame>
}
