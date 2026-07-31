import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  FinancialAccountType,
  InventoryTransactionType,
  PurchaseStatus,
  type FinancialAccountDto,
  type IngredientDto,
  type InventoryMovementDto,
  type PurchaseDto,
  type SupplierDto,
  type UnitDto,
} from '@kafgir/contracts'
import { adminApi } from './api'
import { formatMoney as money, formatNumber, persianDateWithLatinDigitsLocale } from './number-format'

const number = (value: string | number) => formatNumber(value, 6)
const date = (value: string) => new Intl.DateTimeFormat(persianDateWithLatinDigitsLocale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
const today = () => new Date().toISOString().slice(0, 10)

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return <section className="page v15-page"><header className="page-header"><h1>{title}</h1></header>{children}</section>
}
function Feedback({ value }: { value: string | null }) {
  return value ? <div className="message" role="status">{value}</div> : null
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
      preferredStockLevel: null, isInventoryTracked: true,
      isActive: form.get('isActive') === 'on', notes: String(form.get('notes') ?? '') || null,
    }
    try {
      if (editing) await adminApi.updateIngredient(editing.id, request)
      else await adminApi.createIngredient(request)
      setEditing(null); event.currentTarget.reset(); setMessage('ماده اولیه ذخیره شد.'); await load()
    } catch (e) { setMessage(submitError(e)) }
  }
  return <Frame title="مواد اولیه">
    <form className="panel v15-form" onSubmit={submit}>
      <label>نام<input name="name" required defaultValue={editing?.name} key={`name-${editing?.id ?? 0}`} /></label>
      <label>کد<input name="code" dir="ltr" defaultValue={editing?.code ?? ''} key={`code-${editing?.id ?? 0}`} /></label>
      <label>واحد پایه<select name="baseUnitId" required defaultValue={editing?.baseUnitId} key={`unit-${editing?.id ?? 0}`}>
        <option value="">انتخاب کنید</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
      </select></label>
      <label>حداقل موجودی<input name="minimumStockLevel" inputMode="decimal" required defaultValue={editing?.minimumStockLevel ?? '0'} key={`min-${editing?.id ?? 0}`} /></label>
      <label>یادداشت<input name="notes" defaultValue={editing?.notes ?? ''} key={`notes-${editing?.id ?? 0}`} /></label>
      <label className="switch"><input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} key={`active-${editing?.id ?? 0}`} />فعال</label>
      <button className="primary">{editing ? 'ذخیره تغییرات' : 'افزودن ماده'}</button>
      {editing && <button type="button" onClick={() => setEditing(null)}>انصراف</button>}
    </form>
    <Feedback value={message} />
    <div className="panel table-wrap"><table><thead><tr><th>ماده</th><th>واحد</th><th>موجودی</th><th>حداقل</th><th>میانگین موزون</th><th>وضعیت</th><th /></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id} className={Number(item.currentStock) <= Number(item.minimumStockLevel) ? 'low-stock-row' : ''}>
        <td>{item.name}</td><td>{item.baseUnitName}</td><td>{number(item.currentStock)}</td><td>{number(item.minimumStockLevel)}</td>
        <td>{money(item.weightedAverageCost)}</td><td>{item.isActive ? 'فعال' : 'غیرفعال'}</td>
        <td><button type="button" onClick={() => setEditing(item)}>ویرایش</button></td>
      </tr>)}</tbody></table></div>
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
  return <Frame title="تأمین‌کنندگان"><form className="panel v15-form" onSubmit={submit}>
    <label>نام<input name="name" required defaultValue={editing?.name} key={`sname-${editing?.id ?? 0}`} /></label>
    <label>شخص تماس<input name="contactName" defaultValue={editing?.contactName ?? ''} key={`sc-${editing?.id ?? 0}`} /></label>
    <label>موبایل<input name="mobile" dir="ltr" defaultValue={editing?.mobile ?? ''} key={`sm-${editing?.id ?? 0}`} /></label>
    <label>آدرس<input name="address" defaultValue={editing?.address ?? ''} key={`sa-${editing?.id ?? 0}`} /></label>
    <button className="primary">{editing ? 'ذخیره' : 'افزودن'}</button></form><Feedback value={message} />
    <div className="panel table-wrap"><table><thead><tr><th>نام</th><th>شخص تماس</th><th>موبایل</th><th>آدرس</th><th /></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.contactName ?? '—'}</td><td dir="ltr">{item.mobile ?? '—'}</td><td>{item.address ?? '—'}</td><td><button onClick={() => setEditing(item)}>ویرایش</button></td></tr>)}</tbody>
    </table></div></Frame>
}

export function InventoryPage() {
  const [ingredients, setIngredients] = useState<IngredientDto[]>([])
  const [movements, setMovements] = useState<InventoryMovementDto[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { const [i, m] = await Promise.all([adminApi.ingredients(), adminApi.inventoryMovements()]); setIngredients(i); setMovements(m) }
    catch (e) { setMessage(submitError(e)) }
  }, [])
  useEffect(() => { void load() }, [load])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    try {
      const kind = String(data.get('operation'))
      if (kind === 'waste') await adminApi.registerWaste({ ingredientId: Number(data.get('ingredientId')),
        quantity: String(data.get('quantity')), reason: String(data.get('reason')) as 'سایر', notes: null })
      else await adminApi.adjustInventory({ ingredientId: Number(data.get('ingredientId')),
        quantity: String(data.get('quantity')), type: kind as 'increase' | 'decrease',
        reason: String(data.get('reason')), notes: null })
      setMessage('گردش انبار ثبت شد.'); event.currentTarget.reset(); await load()
    } catch (e) { setMessage(submitError(e)) }
  }
  const typeLabel: Record<number, string> = {
    [InventoryTransactionType.PurchaseIn]:'ورود از خرید',[InventoryTransactionType.ProductionConsumption]:'مصرف تولید',
    [InventoryTransactionType.WasteOut]:'ضایعات',[InventoryTransactionType.ManualIncrease]:'افزایش دستی',
    [InventoryTransactionType.ManualDecrease]:'کاهش دستی',[InventoryTransactionType.StockCountAdjustment]:'اصلاح انبارگردانی',
    [InventoryTransactionType.PurchaseReversal]:'برگشت خرید',[InventoryTransactionType.OrderCancellationReversal]:'برگشت مصرف',
  }
  return <Frame title="انبار"><form className="panel v15-form" onSubmit={submit}>
    <label>ماده<select name="ingredientId" required><option value="">انتخاب کنید</option>{ingredients.filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label>عملیات<select name="operation"><option value="increase">افزایش دستی</option><option value="decrease">کاهش دستی</option><option value="waste">ضایعات</option></select></label>
    <label>مقدار<input name="quantity" inputMode="decimal" required /></label><label>دلیل<input name="reason" required /></label>
    <button className="primary">ثبت گردش</button></form><Feedback value={message} />
    <div className="panel table-wrap"><table><thead><tr><th>زمان</th><th>ماده</th><th>نوع</th><th>مقدار</th><th>هزینه واحد</th><th>یادداشت</th></tr></thead>
      <tbody>{movements.map((item) => <tr key={item.id}><td>{date(item.transactionDate)}</td><td>{item.ingredientName}</td>
        <td>{typeLabel[item.transactionType]}</td><td dir="ltr">{number(item.quantityInBaseUnit)}</td><td>{money(item.unitCost)}</td><td>{item.notes ?? '—'}</td></tr>)}</tbody></table></div>
  </Frame>
}

export function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseDto[]>([])
  const [ingredients, setIngredients] = useState<IngredientDto[]>([])
  const [units, setUnits] = useState<UnitDto[]>([])
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const load = useCallback(async () => {
    try { const [p,i,u,s]=await Promise.all([adminApi.purchases(),adminApi.ingredients(),adminApi.units(),adminApi.suppliers()])
      setPurchases(p);setIngredients(i);setUnits(u);setSuppliers(s) } catch(e){setMessage(submitError(e))}
  },[])
  useEffect(()=>{void load()},[load])
  const submit=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();const d=new FormData(event.currentTarget)
    try{await adminApi.createPurchase({supplierId:Number(d.get('supplierId'))||null,invoiceNumber:String(d.get('invoiceNumber')??'')||null,
      purchaseDate:String(d.get('purchaseDate')),discountAmount:0,additionalCostAmount:0,notes:null,attachmentUrl:null,
      items:[{ingredientId:Number(d.get('ingredientId')),purchaseUnitId:Number(d.get('unitId')),quantity:String(d.get('quantity')),
        conversionFactorToBaseUnit:String(d.get('factor')),unitPrice:Number(d.get('unitPrice')),lineDiscountAmount:0,
        expirationDate:null,batchNumber:null,notes:null}]});setMessage('پیش‌نویس خرید ثبت شد.');event.currentTarget.reset();await load()}
    catch(e){setMessage(submitError(e))}
  }
  const action=async(id:number,kind:'confirm'|'cancel')=>{if(!confirm(kind==='confirm'?'خرید تأیید و وارد انبار شود؟':'خرید لغو یا برگشت داده شود؟'))return
    try{kind==='confirm'?await adminApi.confirmPurchase(id):await adminApi.cancelPurchase(id);setMessage('وضعیت خرید به‌روزرسانی شد.');await load()}catch(e){setMessage(submitError(e))}}
  const status:Record<number,string>={[PurchaseStatus.Draft]:'پیش‌نویس',[PurchaseStatus.Confirmed]:'تأییدشده',[PurchaseStatus.Cancelled]:'لغوشده'}
  return <Frame title="خریدها"><form className="panel v15-form purchase-form" onSubmit={submit}>
    <label>تأمین‌کننده<select name="supplierId"><option value="">خرید متفرقه</option>{suppliers.filter(x=>x.isActive).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
    <label>تاریخ<input name="purchaseDate" type="date" defaultValue={today()} required /></label>
    <label>شماره فاکتور<input name="invoiceNumber" /></label>
    <label>ماده<select name="ingredientId" required><option value="">انتخاب</option>{ingredients.filter(x=>x.isActive).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
    <label>واحد خرید<select name="unitId" required><option value="">انتخاب</option>{units.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
    <label>تعداد<input name="quantity" inputMode="decimal" required /></label><label>ضریب به واحد پایه<input name="factor" inputMode="decimal" defaultValue="1" required /></label>
    <label>قیمت واحد<input name="unitPrice" inputMode="numeric" required /></label><button className="primary">ثبت پیش‌نویس</button>
  </form><Feedback value={message}/><div className="panel table-wrap"><table><thead><tr><th>شماره خرید</th><th>تاریخ</th><th>تأمین‌کننده</th><th>مبلغ</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>{purchases.map(x=><tr key={x.id}><td dir="ltr">{x.purchaseNumber}</td><td>{x.purchaseDate}</td><td>{x.supplierName??'متفرقه'}</td><td>{money(x.totalAmount)}</td><td>{status[x.status]}</td>
      <td className="actions">{x.status===PurchaseStatus.Draft&&<button className="primary" onClick={()=>void action(x.id,'confirm')}>تأیید</button>}
        {x.status!==PurchaseStatus.Cancelled&&<button className="danger" onClick={()=>void action(x.id,'cancel')}>لغو/برگشت</button>}</td></tr>)}</tbody></table></div></Frame>
}

export function RecipesPage() {
  const [foods,setFoods]=useState<Array<{id:number;name:string}>>([])
  const [ingredients,setIngredients]=useState<IngredientDto[]>([])
  const [foodId,setFoodId]=useState(0)
  const [recipe,setRecipe]=useState<Awaited<ReturnType<typeof adminApi.recipe>>>(null)
  const [message,setMessage]=useState<string|null>(null)
  useEffect(()=>{void Promise.all([adminApi.foods(),adminApi.ingredients()]).then(([f,i])=>{setFoods(f);setIngredients(i)})},[])
  useEffect(()=>{if(foodId)void adminApi.recipe(foodId).then(setRecipe).catch(e=>setMessage(submitError(e)))},[foodId])
  const submit=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const d=new FormData(event.currentTarget)
    try{await adminApi.saveRecipe(foodId,{yieldQuantity:Number(d.get('yield')),preparationLossPercent:null,overheadPerPortion:Number(d.get('overhead'))||0,notes:null,isActive:true,
      items:[{ingredientId:Number(d.get('ingredientId')),quantityInBaseUnit:String(d.get('quantity')),wastePercent:Number(d.get('waste'))||null,notes:null}]})
      setMessage('دستور پخت ذخیره شد.');setRecipe(await adminApi.recipe(foodId))}catch(e){setMessage(submitError(e))}}
  return <Frame title="دستور پخت"><div className="panel"><label>غذا<select value={foodId} onChange={e=>setFoodId(Number(e.target.value))}><option value="0">انتخاب غذا</option>{foods.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div>
    {foodId>0&&<form className="panel v15-form" onSubmit={submit}><label>بازده (پرس)<input name="yield" type="number" min="1" defaultValue={recipe?.yieldQuantity??10}/></label>
      <label>ماده اولیه<select name="ingredientId" required><option value="">انتخاب</option>{ingredients.filter(x=>x.isActive).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
      <label>مقدار کل دستور<input name="quantity" inputMode="decimal" required/></label><label>درصد ضایعات<input name="waste" type="number" min="0" max="100"/></label>
      <label>سربار هر پرس<input name="overhead" inputMode="numeric" defaultValue={recipe?.overheadPerPortion??0}/></label><button className="primary">ذخیره دستور</button></form>}
    <Feedback value={message}/>{recipe&&<div className="metric-grid"><article className="metric"><span>هزینه کل دستور</span><strong>{money(recipe.totalRecipeCost)}</strong></article>
      <article className="metric"><span>بهای هر پرس</span><strong>{money(recipe.costPerPortion)}</strong></article><article className="metric"><span>سود ناخالص تقریبی</span><strong>{recipe.estimatedGrossProfit===null?'—':money(recipe.estimatedGrossProfit)}</strong></article></div>}
    {recipe&&<div className="panel table-wrap"><table><thead><tr><th>ماده</th><th>مقدار کل</th><th>هر پرس</th><th>هزینه</th></tr></thead><tbody>{recipe.items.map(x=><tr key={x.id}><td>{x.ingredientName}</td><td>{number(x.quantityInBaseUnit)} {x.unitName}</td><td>{number(x.quantityPerPortion)}</td><td>{money(x.ingredientCost)}</td></tr>)}</tbody></table></div>}
  </Frame>
}

export function FinancePage() {
  const [accounts,setAccounts]=useState<FinancialAccountDto[]>([])
  const [transactions,setTransactions]=useState<Awaited<ReturnType<typeof adminApi.financialTransactions>>>([])
  const [message,setMessage]=useState<string|null>(null)
  const load=useCallback(async()=>{try{const[a,t]=await Promise.all([adminApi.financialAccounts(),adminApi.financialTransactions()]);setAccounts(a);setTransactions(t)}catch(e){setMessage(submitError(e))}},[])
  useEffect(()=>{void load()},[load])
  const account=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const d=new FormData(event.currentTarget);try{await adminApi.createFinancialAccount({name:String(d.get('name')),type:Number(d.get('type')) as FinancialAccountType,bankName:null,cardNumberMasked:null,accountNumberMasked:null,ibanMasked:null,openingBalance:Number(d.get('opening'))||0,isActive:true,notes:null});event.currentTarget.reset();setMessage('حساب ذخیره شد.');await load()}catch(e){setMessage(submitError(e))}}
  const entry=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const d=new FormData(event.currentTarget);try{await adminApi.createFinancialEntry(String(d.get('kind')) as 'income'|'expense',{financialAccountId:Number(d.get('accountId')),amount:Number(d.get('amount')),description:String(d.get('description'))});event.currentTarget.reset();setMessage('تراکنش ثبت شد.');await load()}catch(e){setMessage(submitError(e))}}
  return <Frame title="مدیریت مالی"><div className="v15-two-column"><form className="panel v15-form" onSubmit={account}><h2>حساب جدید</h2><label>نام<input name="name" required/></label><label>نوع<select name="type"><option value={FinancialAccountType.Cash}>صندوق نقدی</option><option value={FinancialAccountType.Bank}>بانک</option><option value={FinancialAccountType.GatewaySettlement}>تسویه درگاه</option><option value={FinancialAccountType.PettyCash}>تنخواه</option></select></label><label>مانده افتتاحیه<input name="opening" inputMode="numeric"/></label><button className="primary">ثبت حساب</button></form>
    <form className="panel v15-form" onSubmit={entry}><h2>درآمد یا هزینه</h2><label>نوع<select name="kind"><option value="expense">هزینه</option><option value="income">درآمد</option></select></label><label>حساب<select name="accountId" required><option value="">انتخاب</option>{accounts.filter(x=>x.isActive).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label><label>مبلغ<input name="amount" inputMode="numeric" required/></label><label>شرح<input name="description" required/></label><button className="primary">ثبت تراکنش</button></form></div><Feedback value={message}/>
    <div className="metric-grid">{accounts.map(x=><article className="metric" key={x.id}><span>{x.name}</span><strong>{money(x.currentBalance)}</strong></article>)}</div>
    <div className="panel table-wrap"><table><thead><tr><th>زمان</th><th>حساب</th><th>شرح</th><th>مبلغ</th></tr></thead><tbody>{transactions.map(x=><tr key={x.id}><td>{date(x.transactionDate)}</td><td>{x.financialAccountName}</td><td>{x.description}</td><td className={x.amount<0?'negative-amount':'positive-amount'}>{money(x.amount)}</td></tr>)}</tbody></table></div>
  </Frame>
}

export function ShoppingPage() {
  const [target,setTarget]=useState(today());const [items,setItems]=useState<Awaited<ReturnType<typeof adminApi.shoppingRequirements>>>([])
  const [message,setMessage]=useState<string|null>(null)
  const calculate=async()=>{try{setItems(await adminApi.shoppingRequirements(target,target));setMessage(null)}catch(e){setMessage(submitError(e))}}
  const create=async()=>{try{const result=await adminApi.createShoppingList({title:`لیست خرید ${target}`,targetDate:target,
    items:items.filter(x=>Number(x.shortageQuantity)>0).map(x=>({ingredientId:x.ingredientId,requiredQuantity:x.requiredQuantity,
      currentStockSnapshot:x.currentStock,suggestedPurchaseQuantity:x.shortageQuantity,estimatedUnitCost:x.estimatedUnitCost}))})
    setMessage(`لیست خرید شماره ${number(result.id)} ساخته شد.`)}catch(e){setMessage(submitError(e))}}
  return <Frame title="لیست خرید"><div className="panel v15-form"><label>تاریخ هدف<input type="date" value={target} onChange={e=>setTarget(e.target.value)}/></label>
    <button className="primary" onClick={()=>void calculate()}>محاسبه نیاز خرید</button><button disabled={!items.some(x=>Number(x.shortageQuantity)>0)} onClick={()=>void create()}>تبدیل به لیست خرید</button></div>
    <Feedback value={message}/><div className="panel table-wrap"><table><thead><tr><th>ماده</th><th>نیاز</th><th>موجودی</th><th>کسری</th><th>هزینه برآوردی</th></tr></thead>
      <tbody>{items.map(x=><tr key={x.ingredientId}><td>{x.ingredientName}</td><td>{number(x.requiredQuantity)} {x.unitName}</td><td>{number(x.currentStock)}</td><td>{number(x.shortageQuantity)}</td><td>{money(x.estimatedPurchaseCost)}</td></tr>)}</tbody></table></div></Frame>
}

export function PaymentsPage() {
  const [items,setItems]=useState<Awaited<ReturnType<typeof adminApi.payments>>>([]);const[message,setMessage]=useState<string|null>(null)
  const load=useCallback(async()=>{try{setItems(await adminApi.payments())}catch(e){setMessage(submitError(e))}},[])
  useEffect(()=>{void load()},[load])
  const status:Record<number,string>={1:'در انتظار',2:'در انتظار تأیید',3:'پرداخت‌شده',4:'ناموفق',5:'ردشده',6:'لغوشده',7:'مستردشده'}
  const method:Record<number,string>={1:'نقدی',2:'پوز',3:'کارت‌به‌کارت',4:'آنلاین'}
  const change=async(id:number,next:number)=>{try{await adminApi.changePaymentStatus(id,next);setMessage('وضعیت پرداخت ثبت شد.');await load()}catch(e){setMessage(submitError(e))}}
  return <Frame title="پرداخت‌ها"><Feedback value={message}/><div className="panel table-wrap"><table><thead><tr><th>سفارش</th><th>روش</th><th>حساب</th><th>مبلغ</th><th>وضعیت</th><th>عملیات</th></tr></thead>
    <tbody>{items.map(x=><tr key={x.id}><td dir="ltr">{x.orderNumber}</td><td>{method[x.paymentMethod]}</td><td>{x.financialAccountName}</td><td>{money(x.amount)}</td><td>{status[x.status]}</td><td className="actions">
      {[1,2].includes(x.status)&&<><button className="primary" onClick={()=>void change(x.id,3)}>تأیید</button><button className="danger" onClick={()=>void change(x.id,5)}>رد</button></>}
      {x.status===3&&<button className="danger" onClick={()=>confirm('وجه مسترد شود؟')&&void adminApi.refundPayment(x.id).then(load)}>استرداد</button>}</td></tr>)}</tbody></table></div></Frame>
}

export function V15ReportsPage() {
  const [from,setFrom]=useState(today()),[to,setTo]=useState(today());const[data,setData]=useState<Awaited<ReturnType<typeof adminApi.v15Reports>>|null>(null)
  const[message,setMessage]=useState<string|null>(null)
  const load=async()=>{try{setData(await adminApi.v15Reports(from,to));setMessage(null)}catch(e){setMessage(submitError(e))}}
  return <Frame title="گزارش‌های مدیریتی"><div className="panel v15-form"><label>از<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>تا<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="primary" onClick={()=>void load()}>نمایش گزارش</button></div><Feedback value={message}/>
    {data&&<><div className="metric-grid"><article className="metric"><span>دریافتی خالص</span><strong>{money(data.profit.income)}</strong></article><article className="metric"><span>هزینه</span><strong>{money(data.profit.expense)}</strong></article><article className="metric"><span>سود مدیریتی برآوردی</span><strong>{money(data.profit.income-data.profit.expense)}</strong></article></div>
    <div className="panel table-wrap"><table><thead><tr><th>ماده</th><th>خرید</th><th>مصرف تولید</th><th>ضایعات</th><th>مانده</th></tr></thead><tbody>{data.usage.map(x=><tr key={x.name}><td>{x.name}</td><td>{number(x.purchase??0)}</td><td>{number(x.consumption??0)}</td><td>{number(x.waste??0)}</td><td>{number(x.closing)} {x.unit}</td></tr>)}</tbody></table></div></>}</Frame>
}
