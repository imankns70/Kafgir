import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type {
  FoodTagGroupDto,
  FoodTagGroupWriteRequest,
  SupportSubjectDto,
  SupportSubjectWriteRequest,
  UnitDto,
  UnitWriteRequest,
} from '@kafgir/contracts'
import { adminApi } from './api'
import {
  ListState, Message, PageFrame, Pager, RowNumberCell, RowNumberHead, StatusPill, SystemPill, usePagination,
} from './admin-ui'

/**
 * Master data screens: lookup lists that other records point at.
 *
 * Each entity gets its own screen rather than sharing one «اطلاعات پایه» page. A combined page reads
 * as a settings dump, hides each list behind scrolling, and cannot express permissions — the tag
 * groups belong to the kitchen while support subjects belong to whoever answers customers.
 *
 * None of these support deletion: every one is referenced by a foreign key with `ON DELETE RESTRICT`,
 * so retiring a row means deactivating it, which keeps historical records readable.
 */

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)

const emptyGroup: FoodTagGroupWriteRequest = { code: '', title: '', displayOrder: 0, isActive: true }
const emptySubject: SupportSubjectWriteRequest = { title: '', displayOrder: 0, isActive: true }
const emptyUnit: UnitWriteRequest = { name: '', symbol: '', isActive: true }

export function FoodTagGroupsPage() {
  const [rows, setRows] = useState<FoodTagGroupDto[]>([])
  const [form, setForm] = useState<FoodTagGroupWriteRequest>(emptyGroup)
  const [editCode, setEditCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paged = usePagination(rows)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await adminApi.foodTagGroups()); setError(null) }
    catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const reset = () => { setEditCode(null); setForm(emptyGroup) }
  const editing = editCode === null ? null : rows.find((row) => row.code === editCode) ?? null

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      if (editCode) await adminApi.updateFoodTagGroup(editCode, form)
      else await adminApi.createFoodTagGroup(form)
      reset(); setError(null); await load()
    } catch (reason) { setError(errorText(reason)) }
    finally { setBusy(false) }
  }

  return <PageFrame
    title="گروه‌های برچسب غذا"
    description="برچسب‌های غذا در این گروه‌ها دسته‌بندی می‌شوند و مشتری آن‌ها را با همین ترتیب می‌بیند."
    actions={<button onClick={reset}>گروه جدید</button>}
  >
    <Message error={error} />
    <form className="panel form-grid catalog-form" onSubmit={save}>
      <label>عنوان<input value={form.title} required
        onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label>کد انگلیسی<input dir="ltr" value={form.code} required
        disabled={Boolean(editing?.isSystem)}
        onChange={(event) => setForm({ ...form, code: event.target.value.toLowerCase() })} /></label>
      <label>ترتیب<input type="number" min="0" value={form.displayOrder}
        onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })} /></label>
      <label className="switch"><input type="checkbox" checked={form.isActive}
        onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />فعال</label>
      <button className="primary" disabled={busy}>{editCode ? 'ذخیره گروه' : 'افزودن گروه'}</button>
      {editCode && <button type="button" onClick={reset} disabled={busy}>انصراف</button>}
    </form>
    {editing?.isSystem && <Message>کد گروه‌های سیستمی ثابت است؛ فقط عنوان، ترتیب و وضعیت را می‌توان تغییر داد.</Message>}
    <ListState loading={loading} error={error} isEmpty={rows.length === 0} emptyText="هنوز گروهی ثبت نشده است." />
    {rows.length > 0 && <><div className="panel table-wrap"><table>
      <thead><tr><RowNumberHead /><th>ترتیب</th><th>عنوان</th><th>کد</th><th>نوع</th><th>وضعیت</th><th /></tr></thead>
      <tbody>{paged.visible.map((row, index) => <tr key={row.code}><RowNumberCell offset={paged.rowOffset} index={index} />
        <td>{row.displayOrder}</td><td>{row.title}</td><td dir="ltr">{row.code}</td>
        <td><SystemPill isSystem={row.isSystem} /></td><td><StatusPill active={row.isActive} /></td>
        <td><button onClick={() => {
          setEditCode(row.code)
          setForm({ code: row.code, title: row.title, displayOrder: row.displayOrder, isActive: row.isActive })
        }}>ویرایش</button></td>
      </tr>)}</tbody>
    </table></div><Pager {...paged} /></>}
  </PageFrame>
}

export function SupportSubjectsPage() {
  const [rows, setRows] = useState<SupportSubjectDto[]>([])
  const [form, setForm] = useState<SupportSubjectWriteRequest>(emptySubject)
  const [editId, setEditId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paged = usePagination(rows)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await adminApi.supportSubjects()); setError(null) }
    catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const reset = () => { setEditId(null); setForm(emptySubject) }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      if (editId) await adminApi.updateSupportSubject(editId, form)
      else await adminApi.createSupportSubject(form)
      reset(); setError(null); await load()
    } catch (reason) { setError(errorText(reason)) }
    finally { setBusy(false) }
  }

  return <PageFrame
    title="موضوعات پشتیبانی"
    description="فهرستی که مشتری هنگام شروع گفتگوی جدید از آن انتخاب می‌کند."
    actions={<button onClick={reset}>موضوع جدید</button>}
  >
    <Message error={error} />
    <form className="panel form-grid catalog-form" onSubmit={save}>
      <label>عنوان<input value={form.title} required
        onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label>ترتیب<input type="number" min="0" value={form.displayOrder}
        onChange={(event) => setForm({ ...form, displayOrder: Number(event.target.value) })} /></label>
      <label className="switch"><input type="checkbox" checked={form.isActive}
        onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />قابل انتخاب برای گفتگوی جدید</label>
      <button className="primary" disabled={busy}>{editId ? 'ذخیره موضوع' : 'افزودن موضوع'}</button>
      {editId && <button type="button" onClick={reset} disabled={busy}>انصراف</button>}
    </form>
    <Message>غیرفعال کردن یک موضوع، گفتگوهای ثبت‌شده با آن را تغییر نمی‌دهد؛ فقط از فهرست انتخاب مشتری حذف می‌شود.</Message>
    <ListState loading={loading} error={error} isEmpty={rows.length === 0} emptyText="هنوز موضوعی ثبت نشده است." />
    {rows.length > 0 && <><div className="panel table-wrap"><table>
      <thead><tr><RowNumberHead /><th>ترتیب</th><th>عنوان</th><th>نوع</th><th>وضعیت</th><th /></tr></thead>
      <tbody>{paged.visible.map((row, index) => <tr key={row.id}><RowNumberCell offset={paged.rowOffset} index={index} />
        <td>{row.displayOrder}</td><td>{row.title}</td>
        <td><SystemPill isSystem={row.isSystem} /></td><td><StatusPill active={row.isActive} /></td>
        <td><button onClick={() => {
          setEditId(row.id)
          setForm({ title: row.title, displayOrder: row.displayOrder, isActive: row.isActive })
        }}>ویرایش</button></td>
      </tr>)}</tbody>
    </table></div><Pager {...paged} /></>}
  </PageFrame>
}

export function UnitsPage() {
  const [rows, setRows] = useState<UnitDto[]>([])
  const [form, setForm] = useState<UnitWriteRequest>(emptyUnit)
  const [editId, setEditId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paged = usePagination(rows)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRows(await adminApi.units()); setError(null) }
    catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const reset = () => { setEditId(null); setForm(emptyUnit) }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await adminApi.saveUnit(editId, form)
      reset(); setError(null); await load()
    } catch (reason) { setError(errorText(reason)) }
    finally { setBusy(false) }
  }

  return <PageFrame
    title="واحدهای اندازه‌گیری"
    description="واحدهایی که مواد اولیه و اقلام خرید با آن‌ها شمرده می‌شوند."
    actions={<button onClick={reset}>واحد جدید</button>}
  >
    <Message error={error} />
    <form className="panel form-grid catalog-form" onSubmit={save}>
      <label>نام<input value={form.name} required
        onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>نماد<input value={form.symbol} required
        onChange={(event) => setForm({ ...form, symbol: event.target.value })} /></label>
      <label className="switch"><input type="checkbox" checked={form.isActive}
        onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />فعال</label>
      <button className="primary" disabled={busy}>{editId ? 'ذخیره واحد' : 'افزودن واحد'}</button>
      {editId && <button type="button" onClick={reset} disabled={busy}>انصراف</button>}
    </form>
    <ListState loading={loading} error={error} isEmpty={rows.length === 0} emptyText="هنوز واحدی ثبت نشده است." />
    {rows.length > 0 && <><div className="panel table-wrap"><table>
      <thead><tr><RowNumberHead /><th>نام</th><th>نماد</th><th>وضعیت</th><th /></tr></thead>
      <tbody>{paged.visible.map((row, index) => <tr key={row.id}><RowNumberCell offset={paged.rowOffset} index={index} />
        <td>{row.name}</td><td>{row.symbol}</td><td><StatusPill active={row.isActive} /></td>
        <td><button onClick={() => {
          setEditId(row.id)
          setForm({ name: row.name, symbol: row.symbol, isActive: row.isActive })
        }}>ویرایش</button></td>
      </tr>)}</tbody>
    </table></div><Pager {...paged} /></>}
  </PageFrame>
}
