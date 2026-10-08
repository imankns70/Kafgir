import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { adminRoleLabels, adminRoleSchema, type AdminRole, type StaffUserDto } from '@kafgir/contracts'
import { adminApi } from './api'
import { ListState, Message, PageFrame, useAsyncAction } from './admin-ui'
import { formatNumber, formatPersianDateTime } from './number-format'

const errorText = (reason: unknown) => reason instanceof Error ? reason.message : String(reason)
const roles = adminRoleSchema.options

const roleHint: Record<AdminRole, string> = {
  Owner: 'همه بخش‌ها، از جمله پول، کدهای تخفیف و کاربران',
  OrderManager: 'سفارش‌ها، مشتریان، پرداخت‌ها و پیک',
  KitchenAdmin: 'منو، غذاها، برگه آشپزخانه و سفارش‌ها',
}

type Draft = { id: number | null; username: string; fullName: string; password: string; roles: AdminRole[]; isActive: boolean }

const emptyDraft = (): Draft => ({ id: null, username: '', fullName: '', password: '', roles: ['OrderManager'], isActive: true })

/** A password a person can read aloud over the phone: no look-alike letters. */
export function generatePassword(length = 12, random: (max: number) => number = (max) => crypto.getRandomValues(new Uint32Array(1))[0]! % max) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => alphabet[random(alphabet.length)]).join('')
}

function RolePicker({ value, onChange }: { value: AdminRole[]; onChange: (roles: AdminRole[]) => void }) {
  return <fieldset className="staff-roles">
    <legend>نقش‌ها</legend>
    {roles.map((role) => <label key={role} className="staff-role">
      <input type="checkbox" checked={value.includes(role)}
        onChange={() => onChange(value.includes(role) ? value.filter((item) => item !== role) : [...value, role])} />
      <span><strong>{adminRoleLabels[role]}</strong><small>{roleHint[role]}</small></span>
    </label>)}
  </fieldset>
}

export function StaffPage() {
  const [staff, setStaff] = useState<StaffUserDto[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [resetting, setResetting] = useState<{ user: StaffUserDto; password: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const save = useAsyncAction()

  const load = useCallback(async () => {
    try { setStaff(await adminApi.staff()); setError(null) }
    catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const patch = (value: Partial<Draft>) => setDraft((current) => ({ ...current, ...value }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (draft.roles.length === 0) { setError('دست‌کم یک نقش انتخاب کنید.'); return }
    void save.run(async () => {
      try {
        if (draft.id) {
          await adminApi.updateStaff(draft.id, { fullName: draft.fullName, roles: draft.roles, isActive: draft.isActive })
          setNotice('کاربر ویرایش شد.')
        } else {
          await adminApi.createStaff({ username: draft.username, fullName: draft.fullName, password: draft.password, roles: draft.roles })
          setNotice(`کاربر «${draft.username}» ساخته شد. رمز را جداگانه و امن به او بدهید.`)
        }
        setDraft(emptyDraft())
        setError(null)
        await load()
      } catch (reason) { setError(errorText(reason)) }
    })
  }

  const resetPassword = (event: FormEvent) => {
    event.preventDefault()
    if (!resetting) return
    void save.run(async () => {
      try {
        await adminApi.resetStaffPassword(resetting.user.id, { password: resetting.password })
        setNotice(`رمز «${resetting.user.username}» عوض شد. در ورود بعدی از رمز تازه استفاده کند.`)
        setResetting(null)
        setError(null)
      } catch (reason) { setError(errorText(reason)) }
    })
  }

  const editing = draft.id != null
  return <PageFrame title="کاربران و نقش‌ها"
    description="هر نفر حساب خودش را داشته باشد تا گزارش تغییرات نشان دهد چه کسی چه کرد. غیرفعال کردن، ورود او را حداکثر پس از یک دقیقه می‌بندد.">
    <Message error={error} />
    {notice && <Message>{notice}</Message>}

    <section className="panel admin-controls">
      <form className="staff-form" onSubmit={submit}>
        <h2>{editing ? `ویرایش ${draft.username}` : 'کاربر تازه'}</h2>
        <div className="form-grid staff-fields">
          <label>نام کاربری<input dir="ltr" value={draft.username} disabled={editing} autoComplete="off"
            onChange={(event) => patch({ username: event.target.value.trim() })} placeholder="sara.k" /></label>
          <label>نام و نام خانوادگی<input value={draft.fullName} onChange={(event) => patch({ fullName: event.target.value })} /></label>
          {!editing && <label>رمز عبور
            <span className="staff-password">
              <input dir="ltr" value={draft.password} autoComplete="new-password" minLength={8}
                onChange={(event) => patch({ password: event.target.value })} />
              <button type="button" onClick={() => patch({ password: generatePassword() })}>ساخت رمز</button>
            </span>
          </label>}
          {editing && <label className="switch staff-active"><input type="checkbox" checked={draft.isActive}
            onChange={(event) => patch({ isActive: event.target.checked })} />حساب فعال است</label>}
        </div>
        <RolePicker value={draft.roles} onChange={(next) => patch({ roles: next })} />
        <div className="action-row">
          <button className="primary" disabled={save.busy}>{save.busy ? 'در حال ذخیره…' : editing ? 'ذخیره تغییرات' : 'ساخت کاربر'}</button>
          {editing && <button type="button" onClick={() => setDraft(emptyDraft())}>انصراف</button>}
        </div>
      </form>
    </section>

    {resetting && <section className="panel">
      <form className="staff-reset" onSubmit={resetPassword}>
        <h2>رمز تازه برای {resetting.user.fullName}</h2>
        <span className="staff-password">
          <input dir="ltr" value={resetting.password} minLength={8} autoComplete="new-password" aria-label="رمز تازه"
            onChange={(event) => setResetting({ ...resetting, password: event.target.value })} />
          <button type="button" onClick={() => setResetting({ ...resetting, password: generatePassword() })}>ساخت رمز</button>
        </span>
        <div className="action-row">
          <button className="primary" disabled={save.busy || resetting.password.length < 8}>ثبت رمز تازه</button>
          <button type="button" onClick={() => setResetting(null)}>انصراف</button>
        </div>
      </form>
    </section>}

    <section className="panel table-panel">
      <div className="table-panel-head"><h2>کاربران</h2><span>{formatNumber(staff.filter((user) => user.isActive).length)} فعال</span></div>
      <ListState loading={loading} error={null} isEmpty={!loading && staff.length === 0} emptyText="کاربری پیدا نشد." />
      {staff.length > 0 && <div className="table-wrap"><table>
        <thead><tr><th>نام</th><th>نام کاربری</th><th>نقش‌ها</th><th>آخرین ورود</th><th>وضعیت</th><th /></tr></thead>
        <tbody>{staff.map((user) => <tr key={user.id} className={user.id === draft.id ? 'selected-row' : undefined}>
          <td className="text-cell">{user.fullName}</td>
          <td><bdi dir="ltr">{user.username}</bdi></td>
          <td>{user.roles.map((role) => <span key={role} className="customer-tag small">{adminRoleLabels[role]}</span>)}</td>
          <td>{user.lastSeenAt ? formatPersianDateTime(user.lastSeenAt) : '—'}</td>
          <td><span className={`badge ${user.isActive ? 'open' : 'closed'}`}>{user.isActive ? 'فعال' : 'غیرفعال'}</span></td>
          <td><div className="action-row">
            <button type="button" onClick={() => { setDraft({ id: user.id, username: user.username, fullName: user.fullName, password: '', roles: user.roles, isActive: user.isActive }); setNotice(null) }}>ویرایش</button>
            <button type="button" onClick={() => { setResetting({ user, password: generatePassword() }); setNotice(null) }}>رمز تازه</button>
          </div></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </PageFrame>
}
