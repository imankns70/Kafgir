import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type {
  DailyMenuDto,
  SocialChannelDto,
  SocialChannelWriteRequest,
  SocialDraftDto,
  SocialExecutionMode,
  SocialHistoryQuery,
  SocialPlatform,
  SocialPostTemplateType,
  SocialPostWriteRequest,
  SocialPreviewDto,
  SocialRuleDto,
  SocialRuleWriteRequest,
  SocialSettingsDto,
  SocialSuggestionDto,
  SocialTargetStatus,
  SocialTemplateDto,
} from '@kafgir/contracts'
import { adminApi } from './api'
import {
  DateField, Pager, RowNumberCell, RowNumberHead, TimeField, defaultPageSize, rowOffsetOf,
  useAsyncAction, usePagination,
} from './admin-ui'
import { formatMoney, formatNumber, formatPersianDateTime } from './number-format'

const today = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

const platformLabel: Record<SocialPlatform, string> = {
  Telegram: 'تلگرام', Bale: 'بله', Eitaa: 'ایتا',
}
const templateLabel: Record<SocialPostTemplateType, string> = {
  DailyMenu: 'منوی امروز', FoodPromotion: 'تبلیغ غذا', Discount: 'تخفیف',
  LimitedAvailability: 'ظرفیت محدود', Custom: 'پیام آزاد',
}
const modeLabel: Record<SocialExecutionMode, string> = {
  Manual: 'دستی', Suggestion: 'پیشنهاد', AutoPublish: 'انتشار خودکار',
}

function SocialPage({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="page social-page">
    <header className="page-header"><div><h1>{title}</h1><p className="social-page-lead">مدیریت انتشار کفگیر در شبکه‌های اجتماعی</p></div><div className="page-actions">{actions}</div></header>
    {children}
  </section>
}

function Feedback({ error, children }: { error?: string | null; children?: ReactNode }) {
  if (!error && !children) return null
  return <div className={`message ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{error || children}</div>
}

function ChannelChecks({ channels, selected, onChange }: {
  channels: SocialChannelDto[]; selected: number[]; onChange: (ids: number[]) => void
}) {
  return <div className="social-channel-checks">
    {channels.filter((channel) => channel.isActive).map((channel) => <label key={channel.id}>
      <input type="checkbox" checked={selected.includes(channel.id)} onChange={(event) => onChange(
        event.target.checked ? [...selected, channel.id] : selected.filter((id) => id !== channel.id),
      )} />
      <span>{platformLabel[channel.platform]}</span><small>{channel.title}</small>
    </label>)}
    {channels.every((channel) => !channel.isActive) && <span className="empty-inline">کانال فعالی ثبت نشده است.</span>}
  </div>
}

export function SocialDashboardPage() {
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof adminApi.socialDashboard>> | null>(null)
  const [suggestions, setSuggestions] = useState<SocialSuggestionDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setBusy(true)
    try {
      const [summary, items] = await Promise.all([adminApi.socialDashboard(), adminApi.socialSuggestions(today())])
      setDashboard(summary); setSuggestions(items.filter((item) => item.status === 'Pending')); setError(null)
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const evaluate = async () => {
    setBusy(true)
    try { await adminApi.evaluateSocialAutomation(); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false) }
  }
  const cards = dashboard ? [
    ['پیشنهادهای امروز', dashboard.suggestionsToday], ['منتشرشده امروز', dashboard.publishedToday],
    ['در انتظار انتشار', dashboard.pendingTargets], ['ارسال‌های ناموفق', dashboard.failedTargets],
    ['کانال‌های فعال', dashboard.activeChannels],
  ] : []
  return <SocialPage title="داشبورد انتشار" actions={<button disabled={busy} onClick={() => void evaluate()}>{busy ? "در حال بررسی…" : "بررسی فرصت‌های انتشار"}</button>}>
    <Feedback error={error} />
    <div className="social-runtime-note">انتشار خودکار تنها زمانی اجرا می‌شود که برنامه مدیریت باز و کاربر مجاز وارد شده باشد.</div>
    <div className="metric-grid social-metrics">{cards.map(([label, value]) => <article className="metric" key={label}><span>{label}</span><strong>{formatNumber(Number(value))}</strong></article>)}</div>
    <div className="social-dashboard-grid">
      <section className="panel"><h2>پیشنهادهای انتشار امروز</h2><div className="social-list">
        {suggestions.slice(0, 5).map((item) => <article className="social-list-row" key={item.id}>
          <div><strong>{templateLabel[item.templateType]}{item.sourceTitle ? `؛ ${item.sourceTitle}` : ''}</strong><span>{item.reason}</span></div>
          <time>{formatPersianDateTime(item.createdAt)}</time>
        </article>)}
        {!busy && suggestions.length === 0 && <div className="social-empty">پیشنهاد تازه‌ای وجود ندارد.</div>}
      </div></section>
      <section className="panel"><h2>خط زمانی امروز</h2><div className="social-list">
        {dashboard?.timeline.map((item) => <article className="social-list-row" key={item.id}>
          <span className={`social-dot social-dot-${item.status.toLowerCase()}`} /><div><strong>{item.title}</strong><span>{item.platform ? platformLabel[item.platform] : 'سیستم'} · {item.status}</span></div><time>{formatPersianDateTime(item.occurredAt)}</time>
        </article>)}
        {!busy && dashboard?.timeline.length === 0 && <div className="social-empty">هنوز ارسالی ثبت نشده است.</div>}
      </div></section>
    </div>
  </SocialPage>
}

const emptyChannel: SocialChannelWriteRequest = {
  platform: 'Telegram', title: '', externalChannelId: '', username: null, credential: '', isActive: true,
}

export function SocialChannelsPage() {
  const [channels, setChannels] = useState<SocialChannelDto[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<SocialChannelWriteRequest>(emptyChannel)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pagedChannels = usePagination(channels)
  const load = useCallback(() => adminApi.socialChannels().then(setChannels).catch((reason) => setError(String(reason))), [])
  useEffect(() => { void load() }, [load])
  const edit = (channel: SocialChannelDto) => {
    setEditingId(channel.id)
    setForm({ platform: channel.platform, title: channel.title, externalChannelId: channel.externalChannelId, username: channel.username, isActive: channel.isActive })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(null)
    try {
      await adminApi.saveSocialChannel(editingId, form)
      setEditingId(null); setForm(emptyChannel); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  const test = async (id: number) => {
    setBusy(true); setError(null)
    try { const result = await adminApi.testSocialChannel(id); if (!result.supported) setError(result.detail); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  return <SocialPage title="کانال‌ها">
    <Feedback error={error} />
    <form className="panel social-channel-form" onSubmit={submit}>
      <h2>{editingId ? 'ویرایش کانال' : 'افزودن کانال'}</h2>
      <label>پلتفرم<select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value as SocialPlatform })}><option value="Telegram">تلگرام</option><option value="Bale">بله</option><option value="Eitaa">ایتا</option></select></label>
      <label>عنوان<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
      <label>شناسه کانال<input dir="ltr" value={form.externalChannelId} onChange={(event) => setForm({ ...form, externalChannelId: event.target.value })} placeholder="@channel یا chat id" required /></label>
      <label>نام کاربری (اختیاری)<input dir="ltr" value={form.username ?? ''} onChange={(event) => setForm({ ...form, username: event.target.value || null })} /></label>
      <label>توکن {editingId && '(برای حفظ توکن فعلی خالی بگذارید)'}<input dir="ltr" type="password" value={form.credential ?? ''} onChange={(event) => setForm({ ...form, credential: event.target.value || undefined })} required={!editingId} autoComplete="new-password" /></label>
      <label className="switch"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />فعال</label>
      <div className="actions"><button className="primary" disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیره"}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyChannel) }}>انصراف</button>}</div>
    </form>
    <section className="panel table-wrap"><table><thead><tr><RowNumberHead /><th>پلتفرم</th><th>عنوان</th><th>شناسه</th><th>وضعیت اتصال</th><th>آخرین ارسال موفق</th><th>خطای آخر</th><th>عملیات</th></tr></thead><tbody>
      {pagedChannels.visible.map((channel, index) => <tr key={channel.id}><RowNumberCell offset={pagedChannels.rowOffset} index={index} /><td>{platformLabel[channel.platform]}</td><td>{channel.title}</td><td dir="ltr">{channel.externalChannelId}</td><td><span className={`badge social-connection-${channel.connectionStatus.toLowerCase()}`}>{channel.connectionStatus === 'Connected' ? 'متصل' : channel.connectionStatus === 'Failed' ? 'خطا' : 'بررسی نشده'}</span></td><td>{formatPersianDateTime(channel.lastSuccessfulPublicationAt)}</td><td className="social-error-cell">{channel.lastPublicationError || '—'}</td><td className="actions"><button onClick={() => edit(channel)}>ویرایش</button><button disabled={busy || !channel.credentialConfigured} onClick={() => void test(channel.id)}>{busy ? "در حال آزمون…" : "آزمون اتصال"}</button></td></tr>)}
      {channels.length === 0 && <tr><td colSpan={8}>هنوز کانالی ثبت نشده است.</td></tr>}
    </tbody></table></section><Pager {...pagedChannels} />
  </SocialPage>
}

function PlatformPreview({ items }: { items: SocialPreviewDto[] }) {
  const [active, setActive] = useState(items[0]?.channelId ?? 0)
  useEffect(() => setActive(items[0]?.channelId ?? 0), [items])
  const preview = items.find((item) => item.channelId === active) ?? items[0]
  if (!preview) return null
  return <section className="social-preview-panel">
    <div className="social-preview-tabs" role="tablist">{items.map((item) => <button type="button" role="tab" aria-selected={item.channelId === preview.channelId} className={item.channelId === preview.channelId ? 'active' : ''} key={item.channelId} onClick={() => setActive(item.channelId)}>{platformLabel[item.platform]} · {item.channelTitle}</button>)}</div>
    <article className={`social-message-preview platform-${preview.platform.toLowerCase()}`}>
      {preview.mediaUrl && <img src={preview.mediaUrl} alt="تصویر پیش‌نمایش انتشار" />}
      <p>{preview.text}</p>
      {preview.destinationUrl && (preview.actionStyle === 'InlineButton'
        ? <span className="social-action-preview">مشاهده منو و ثبت سفارش</span>
        : <a href={preview.destinationUrl}>{preview.destinationUrl}</a>)}
    </article>
  </section>
}

export function SocialComposerPage() {
  const [channels, setChannels] = useState<SocialChannelDto[]>([])
  const [menu, setMenu] = useState<DailyMenuDto | null>(null)
  const [templateType, setTemplateType] = useState<SocialPostTemplateType>('DailyMenu')
  const [sourceId, setSourceId] = useState('')
  const [customText, setCustomText] = useState('')
  const [draft, setDraft] = useState<SocialDraftDto | null>(null)
  const [selectedChannels, setSelectedChannels] = useState<number[]>([])
  const [overrides, setOverrides] = useState<Record<number, string>>({})
  const [previews, setPreviews] = useState<SocialPreviewDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { void Promise.all([adminApi.socialChannels(), adminApi.menu(today())]).then(([channelRows, menuRow]) => {
    setChannels(channelRows); setMenu(menuRow); setSelectedChannels(channelRows.filter((row) => row.isActive).map((row) => row.id))
  }).catch((reason) => setError(String(reason))) }, [])
  const resetDraft = (type: SocialPostTemplateType) => { setTemplateType(type); setDraft(null); setPreviews([]); setSourceId(''); setOverrides({}) }
  const generate = async () => {
    setBusy(true); setError(null); setPreviews([])
    try {
      setDraft(await adminApi.generateSocialDraft({
        templateType, sourceId: sourceId ? Number(sourceId) : null, menuDate: today(),
        customText: templateType === 'Custom' ? customText : null,
      }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  const postValue = (): SocialPostWriteRequest => ({
    templateType, title: draft?.title ?? null, sourceType: draft?.sourceType ?? null,
    sourceId: draft?.sourceId ?? null, defaultText: draft?.defaultText ?? '', mediaUrl: draft?.mediaUrl ?? null,
    destinationUrl: draft?.destinationUrl ?? null, origin: 'Manual',
    targets: selectedChannels.map((channelId) => ({ channelId, textOverride: overrides[channelId] || null })),
  })
  const preview = async () => {
    if (!draft) return
    setBusy(true); setError(null)
    try { setPreviews(await adminApi.previewSocialPost(postValue())) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  const publish = async () => {
    if (!draft || !window.confirm('انتشار برای کانال‌های انتخابی انجام شود؟')) return
    setBusy(true); setError(null)
    try {
      const post = await adminApi.createSocialPost(postValue())
      await adminApi.publishSocialPost(post.id)
      setDraft(null); setPreviews([]); setCustomText(''); setSourceId('')
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  const sourceItems = menu?.items.filter((item) => templateType !== 'Discount' || item.originalPrice != null) ?? []
  return <SocialPage title="انتشار جدید">
    <Feedback error={error} />
    <div className="social-compose-grid">
      <section className="panel social-compose-form"><h2>ساخت پیش‌نویس</h2>
        <label>نوع محتوا<select value={templateType} onChange={(event) => resetDraft(event.target.value as SocialPostTemplateType)}>{Object.entries(templateLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {templateType !== 'DailyMenu' && templateType !== 'Custom' && <label>غذای منوی امروز<select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setDraft(null) }}><option value="">انتخاب کنید</option>{sourceItems.map((item) => <option key={item.id} value={item.id}>{item.foodName} · {formatMoney(item.price)}</option>)}</select></label>}
        {templateType === 'Custom' && <label>متن پیام<textarea rows={7} value={customText} onChange={(event) => setCustomText(event.target.value)} /></label>}
        <button type="button" className="secondary" disabled={busy || (templateType !== 'DailyMenu' && templateType !== 'Custom' && !sourceId)} onClick={() => void generate()}>{busy ? "در حال تولید…" : "تولید پیش‌نویس از اطلاعات واقعی"}</button>
        {draft && <><label>متن نهایی<textarea rows={12} value={draft.defaultText} onChange={(event) => setDraft({ ...draft, defaultText: event.target.value })} /></label>
          <label>آدرس تصویر<input dir="ltr" value={draft.mediaUrl ?? ''} onChange={(event) => setDraft({ ...draft, mediaUrl: event.target.value || null })} /></label>
          <label>لینک سفارش<input dir="ltr" value={draft.destinationUrl ?? ''} onChange={(event) => setDraft({ ...draft, destinationUrl: event.target.value || null })} /></label></>}
      </section>
      <section className="panel social-target-form"><h2>مقصد و نسخه پلتفرم</h2>
        <ChannelChecks channels={channels} selected={selectedChannels} onChange={(ids) => { setSelectedChannels(ids); setPreviews([]) }} />
        {draft && selectedChannels.map((channelId) => {
          const channel = channels.find((item) => item.id === channelId)!
          return <details key={channelId}><summary>متن اختصاصی {platformLabel[channel.platform]} (اختیاری)</summary><textarea rows={8} placeholder="خالی بگذارید تا متن پیش‌فرض استفاده شود" value={overrides[channelId] ?? ''} onChange={(event) => { setOverrides({ ...overrides, [channelId]: event.target.value }); setPreviews([]) }} /></details>
        })}
        <div className="actions"><button type="button" disabled={!draft || selectedChannels.length === 0 || busy} onClick={() => void preview()}>{busy ? "در حال آماده‌سازی…" : "پیش‌نمایش نهایی"}</button><button type="button" className="primary" disabled={previews.length === 0 || busy} onClick={() => void publish()}>{busy ? "در حال انتشار…" : "انتشار"}</button></div>
      </section>
    </div>
    {previews.length > 0 && <PlatformPreview items={previews} />}
  </SocialPage>
}

export function SocialTemplatesPage() {
  const [templates, setTemplates] = useState<SocialTemplateDto[]>([])
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const saveAction = useAsyncAction()
  const pagedTemplates = usePagination(templates)
  const load = useCallback(() => adminApi.socialTemplates().then(setTemplates).catch((reason) => setError(String(reason))), [])
  useEffect(() => { void load() }, [load])
  // Each card saves independently, so the pending row is tracked by id rather than disabling the grid.
  const save = (template: SocialTemplateDto) => {
    setSavingId(template.id)
    void saveAction.run(async () => {
      try { await adminApi.saveSocialTemplate(template); await load(); setError(null) }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
      finally { setSavingId(null) }
    })
  }
  return <SocialPage title="قالب‌های پیام"><Feedback error={error} />
    <div className="social-template-grid">{pagedTemplates.visible.map((template) => <article className="panel social-template-card" key={template.id}>
      <header><div><strong>{template.title}</strong><span>{templateLabel[template.templateType]}</span></div><label className="switch"><input type="checkbox" checked={template.isActive} onChange={(event) => setTemplates((items) => items.map((item) => item.id === template.id ? { ...item, isActive: event.target.checked } : item))} />فعال</label></header>
      <textarea rows={10} value={template.pattern} onChange={(event) => setTemplates((items) => items.map((item) => item.id === template.id ? { ...item, pattern: event.target.value } : item))} />
      <small>متغیرهای مجاز: foodName، description، price، originalPrice، discountPrice، menuItems، orderUrl، customText</small>
      {template.templateType === 'LimitedAvailability' && <small className="privacy-note">اعداد ظرفیت و متغیرهای موجودی در محتوای عمومی ممنوع‌اند.</small>}
      <button className="primary" disabled={saveAction.busy} onClick={() => save(template)}>
        {savingId === template.id ? 'در حال ذخیره…' : 'ذخیره قالب'}
      </button>
    </article>)}</div><Pager {...pagedTemplates} />
  </SocialPage>
}

const defaultRule = (channels: SocialChannelDto[]): SocialRuleWriteRequest => ({
  title: '', templateType: 'DailyMenu', triggerType: 'DailyMenu', isEnabled: false,
  executionMode: 'Suggestion', startTime: '08:00', endTime: '09:30', thresholdPercentage: null,
  cooldownMinutes: 90, maxExecutionsPerDay: 1, maxExecutionsPerFoodPerDay: 1,
  priority: 100, targetChannelIds: channels.filter((item) => item.isActive).map((item) => item.id),
})

export function SocialRulesPage() {
  const [rules, setRules] = useState<SocialRuleDto[]>([])
  const [channels, setChannels] = useState<SocialChannelDto[]>([])
  const [settings, setSettings] = useState<SocialSettingsDto | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<SocialRuleWriteRequest>(defaultRule([]))
  const [error, setError] = useState<string | null>(null)
  const ruleAction = useAsyncAction()
  const settingsAction = useAsyncAction()
  const pagedRules = usePagination(rules)
  const load = useCallback(async () => {
    try { const [ruleRows, channelRows, setting] = await Promise.all([adminApi.socialRules(), adminApi.socialChannels(), adminApi.socialSettings()]); setRules(ruleRows); setChannels(channelRows); setSettings(setting); setError(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }, [])
  useEffect(() => { void load() }, [load])
  const edit = (rule: SocialRuleDto) => { setEditingId(rule.id); setForm({ ...rule }) }
  const saveRule = (event: FormEvent) => {
    event.preventDefault()
    void ruleAction.run(async () => {
      try { await adminApi.saveSocialRule(editingId, form); setEditingId(null); setForm(defaultRule(channels)); await load() }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    })
  }
  const saveSettings = () => {
    if (!settings) return
    void settingsAction.run(async () => {
      try { await adminApi.saveSocialSettings(settings); await load() }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    })
  }
  return <SocialPage title="قوانین خودکارسازی"><Feedback error={error} />
    <div className="social-runtime-note">حالت اولیه قوانین «پیشنهاد» است. انتشار خودکار فقط هنگام بازبودن برنامه مدیریت اجرا می‌شود.</div>
    {settings && <section className="panel social-settings-form"><h2>کنترل دفعات انتشار</h2>
      <label>حداقل فاصله پست‌ها (دقیقه)<input type="number" min="0" value={settings.minimumIntervalMinutes} onChange={(event) => setSettings({ ...settings, minimumIntervalMinutes: Number(event.target.value) })} /></label>
      <label>حداکثر پست روزانه<input type="number" min="1" value={settings.maximumPostsPerDay} onChange={(event) => setSettings({ ...settings, maximumPostsPerDay: Number(event.target.value) })} /></label>
      <label>حداکثر تبلیغ هر غذا در روز<input type="number" min="1" value={settings.maximumFoodPromotionPerFoodPerDay} onChange={(event) => setSettings({ ...settings, maximumFoodPromotionPerFoodPerDay: Number(event.target.value) })} /></label>
      <label>حداکثر هشدار محدودیت هر غذا<input type="number" min="1" value={settings.maximumLimitedAvailabilityPerFoodPerDay} onChange={(event) => setSettings({ ...settings, maximumLimitedAvailabilityPerFoodPerDay: Number(event.target.value) })} /></label>
      <TimeField label="سکوت از" allowClear value={settings.quietHoursStart ?? ''} onChange={(value) => setSettings({ ...settings, quietHoursStart: value || null })} />
      <TimeField label="سکوت تا" allowClear value={settings.quietHoursEnd ?? ''} onChange={(value) => setSettings({ ...settings, quietHoursEnd: value || null })} />
      <label>حالت پیش‌فرض<select value={settings.defaultExecutionMode} onChange={(event) => setSettings({ ...settings, defaultExecutionMode: event.target.value as SocialExecutionMode })}>{Object.entries(modeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="social-settings-targets"><span>کانال‌های پیش‌فرض</span><ChannelChecks channels={channels} selected={settings.defaultTargetChannelIds} onChange={(ids) => setSettings({ ...settings, defaultTargetChannelIds: ids })} /></div>
      <button className="secondary" disabled={settingsAction.busy} onClick={saveSettings}>{settingsAction.busy ? "در حال ذخیره…" : "ذخیره تنظیمات"}</button>
    </section>}
    <form className="panel social-rule-form" onSubmit={saveRule}><h2>{editingId ? 'ویرایش قانون' : 'قانون جدید'}</h2>
      <label>عنوان<input value={form.title} required onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label>نوع<select value={form.templateType} onChange={(event) => { const type = event.target.value as Exclude<SocialPostTemplateType, 'Custom'>; setForm({ ...form, templateType: type, triggerType: type }) }}>{Object.entries(templateLabel).filter(([key]) => key !== 'Custom').map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>حالت اجرا<select value={form.executionMode} onChange={(event) => setForm({ ...form, executionMode: event.target.value as SocialExecutionMode })}>{Object.entries(modeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <TimeField label="از ساعت" allowClear value={form.startTime ?? ''} onChange={(value) => setForm({ ...form, startTime: value || null })} /><TimeField label="تا ساعت" allowClear value={form.endTime ?? ''} onChange={(value) => setForm({ ...form, endTime: value || null })} />
      {form.templateType === 'LimitedAvailability' && <label>آستانه داخلی درصد<input type="number" min="1" max="99" value={form.thresholdPercentage ?? 35} onChange={(event) => setForm({ ...form, thresholdPercentage: Number(event.target.value) })} /><small>این عدد فقط در مدیریت استفاده می‌شود و هرگز وارد متن عمومی نمی‌شود.</small></label>}
      <label>فاصله اجرای همین قانون (دقیقه)<input type="number" min="0" value={form.cooldownMinutes ?? 0} onChange={(event) => setForm({ ...form, cooldownMinutes: Number(event.target.value) })} /></label>
      <label>حداکثر اجرا در روز<input type="number" min="1" value={form.maxExecutionsPerDay ?? 1} onChange={(event) => setForm({ ...form, maxExecutionsPerDay: Number(event.target.value) })} /></label>
      <label>حداکثر اجرا برای هر غذا<input type="number" min="1" value={form.maxExecutionsPerFoodPerDay ?? 1} onChange={(event) => setForm({ ...form, maxExecutionsPerFoodPerDay: Number(event.target.value) })} /></label>
      <label>اولویت<input type="number" min="1" value={form.priority} onChange={(event) => setForm({ ...form, priority: Number(event.target.value) })} /></label>
      <label className="switch"><input type="checkbox" checked={form.isEnabled} onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })} />فعال</label>
      <ChannelChecks channels={channels} selected={form.targetChannelIds} onChange={(ids) => setForm({ ...form, targetChannelIds: ids })} />
      <div className="actions"><button className="primary" disabled={ruleAction.busy}>{ruleAction.busy ? "در حال ذخیره…" : "ذخیره قانون"}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(defaultRule(channels)) }}>انصراف</button>}</div>
    </form>
    <section className="panel table-wrap"><table><thead><tr><RowNumberHead /><th>اولویت</th><th>قانون</th><th>نوع</th><th>حالت</th><th>بازه</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{pagedRules.visible.map((rule, index) => <tr key={rule.id}><RowNumberCell offset={pagedRules.rowOffset} index={index} /><td>{formatNumber(rule.priority)}</td><td>{rule.title}</td><td>{templateLabel[rule.templateType]}</td><td>{modeLabel[rule.executionMode]}</td><td dir="ltr">{rule.startTime || '—'} - {rule.endTime || '—'}</td><td>{rule.isEnabled ? 'فعال' : 'غیرفعال'}</td><td><button onClick={() => edit(rule)}>ویرایش</button></td></tr>)}</tbody></table></section><Pager {...pagedRules} />
  </SocialPage>
}

export function SocialSuggestionsPage() {
  const [items, setItems] = useState<SocialSuggestionDto[]>([])
  const [channels, setChannels] = useState<SocialChannelDto[]>([])
  const [settings, setSettings] = useState<SocialSettingsDto | null>(null)
  const [preview, setPreview] = useState<{ suggestion: SocialSuggestionDto; items: SocialPreviewDto[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const rowAction = useAsyncAction()
  const publishAction = useAsyncAction()
  const pagedSuggestions = usePagination(items)
  const load = useCallback(async () => { try { const [suggestions, channelRows, setting] = await Promise.all([adminApi.socialSuggestions(today()), adminApi.socialChannels(), adminApi.socialSettings()]); setItems(suggestions); setChannels(channelRows); setSettings(setting); setError(null) } catch (reason) { setError(String(reason)) } }, [])
  useEffect(() => { void load() }, [load])
  const valueFor = (suggestion: SocialSuggestionDto): SocialPostWriteRequest => ({
    ...suggestion.draft, origin: 'Suggestion', suggestionId: suggestion.id,
    targets: (settings?.defaultTargetChannelIds.length ? settings.defaultTargetChannelIds : channels.filter((channel) => channel.isActive).map((channel) => channel.id)).map((channelId) => ({ channelId })),
  })
  const showPreview = (suggestion: SocialSuggestionDto) => {
    setPendingId(suggestion.id)
    void rowAction.run(async () => {
      try { setPreview({ suggestion, items: await adminApi.previewSocialPost(valueFor(suggestion)) }) }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
      finally { setPendingId(null) }
    })
  }
  // Publishing reaches external channels, so a second click while the first is in flight would post
  // twice. `useAsyncAction` closes that window synchronously, before the disabled state renders.
  const publish = () => {
    if (!preview || !window.confirm('این پیشنهاد منتشر شود؟')) return
    void publishAction.run(async () => {
      try {
        const post = await adminApi.createSocialPost(valueFor(preview.suggestion))
        await adminApi.publishSocialPost(post.id)
        setPreview(null); await load()
      } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    })
  }
  const dismiss = (id: number) => {
    setPendingId(id)
    void rowAction.run(async () => {
      try { await adminApi.dismissSocialSuggestion(id); await load() }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
      finally { setPendingId(null) }
    })
  }
  return <SocialPage title="پیشنهادهای انتشار"><Feedback error={error} />
    <div className="social-suggestion-grid">{pagedSuggestions.visible.map((item) => <article className={`panel social-suggestion status-${item.status.toLowerCase()}`} key={item.id}><header><span>{templateLabel[item.templateType]}</span><time>{formatPersianDateTime(item.createdAt)}</time></header><h2>{item.sourceTitle || item.draft.title}</h2><p>{item.reason}</p><div className="actions">{item.status === 'Pending' && <><button className="danger" disabled={rowAction.busy} onClick={() => dismiss(item.id)}>{pendingId === item.id ? "در حال انجام…" : "رد کردن"}</button><button className="primary" disabled={rowAction.busy} onClick={() => showPreview(item)}>{pendingId === item.id ? "در حال آماده‌سازی…" : "پیش‌نمایش"}</button></>}<span>{item.status === 'Dismissed' ? 'رد شده' : item.status === 'Published' ? 'منتشر شده' : ''}</span></div></article>)}
      {items.length === 0 && <div className="panel social-empty">پیشنهادی برای امروز وجود ندارد.</div>}
    </div>
    <Pager {...pagedSuggestions} />
    {preview && <div className="social-preview-dialog" role="dialog" aria-modal="true"><div className="social-preview-dialog-card"><header><h2>پیش‌نمایش مشتری</h2><button onClick={() => setPreview(null)}>بستن</button></header><PlatformPreview items={preview.items} /><button className="primary" disabled={publishAction.busy} onClick={publish}>{publishAction.busy ? "در حال انتشار…" : "تأیید و انتشار"}</button></div></div>}
  </SocialPage>
}

export function SocialHistoryPage() {
  const [query, setQuery] = useState<SocialHistoryQuery>({ page: 1, pageSize: defaultPageSize })
  const [data, setData] = useState<Awaited<ReturnType<typeof adminApi.socialHistory>> | null>(null)
  const [channels, setChannels] = useState<SocialChannelDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<number | null>(null)
  const searchAction = useAsyncAction()
  const retryAction = useAsyncAction()
  const load = useCallback(async (next = query) => { try { setData(await adminApi.socialHistory(next)); setError(null) } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } }, [query])
  useEffect(() => { void adminApi.socialChannels().then(setChannels); void load() }, [])
  const submit = (event: FormEvent) => { event.preventDefault(); void searchAction.run(() => load({ ...query, page: 1 })) }
  // Re-sending publishes to a live channel; without the in-flight guard an impatient second click
  // posts the same message twice.
  const retry = (id: number) => {
    if (!window.confirm('فقط همین مقصد دوباره ارسال شود؟')) return
    setRetryingId(id)
    void retryAction.run(async () => {
      try { await adminApi.retrySocialTarget(id); await load() }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
      finally { setRetryingId(null) }
    })
  }
  return <SocialPage title="تاریخچه ارسال"><Feedback error={error} />
    <form className="toolbar social-history-filters" onSubmit={submit}><DateField label="از" allowClear value={query.from ?? ''} onChange={(value) => setQuery({ ...query, from: value || null })} /><DateField label="تا" allowClear value={query.to ?? ''} onChange={(value) => setQuery({ ...query, to: value || null })} /><label>پلتفرم<select value={query.platform ?? ''} onChange={(event) => setQuery({ ...query, platform: event.target.value as SocialPlatform || null })}><option value="">همه</option>{Object.entries(platformLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>کانال<select value={query.channelId ?? ''} onChange={(event) => setQuery({ ...query, channelId: event.target.value ? Number(event.target.value) : null })}><option value="">همه</option>{channels.map((channel) => <option value={channel.id} key={channel.id}>{channel.title}</option>)}</select></label><label>نوع<select value={query.templateType ?? ''} onChange={(event) => setQuery({ ...query, templateType: event.target.value as SocialPostTemplateType || null })}><option value="">همه</option>{Object.entries(templateLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>نتیجه<select value={query.status ?? ''} onChange={(event) => setQuery({ ...query, status: event.target.value as SocialTargetStatus || null })}><option value="">همه</option><option value="Pending">در انتظار</option><option value="Publishing">در حال ارسال</option><option value="Published">موفق</option><option value="Failed">ناموفق</option><option value="Unknown">نامشخص</option></select></label><label>مبدأ<select value={query.origin ?? ''} onChange={(event) => setQuery({ ...query, origin: event.target.value as SocialHistoryQuery['origin'] || null })}><option value="">همه</option><option value="Manual">دستی</option><option value="Suggestion">پیشنهاد</option><option value="Automation">خودکار</option></select></label><label>منبع<input value={query.source ?? ''} onChange={(event) => setQuery({ ...query, source: event.target.value || null })} placeholder="نام غذا یا منبع" /></label><button className="primary" disabled={searchAction.busy}>{searchAction.busy ? "در حال جستجو…" : "جستجو"}</button></form>
    <section className="panel table-wrap"><table><thead><tr><RowNumberHead /><th>پست</th><th>نوع</th><th>منبع</th><th>زمان ایجاد</th><th>مقصدها</th><th>نتیجه</th><th>خطا/تلاش مجدد</th></tr></thead><tbody>{data?.items.map((post, index) => <tr key={post.id}><RowNumberCell offset={rowOffsetOf(data.page, data.pageSize)} index={index} /><td className="social-post-title"><strong>{post.title || 'بدون عنوان'}</strong><small>{post.defaultText.slice(0, 100)}</small></td><td>{templateLabel[post.templateType]}</td><td>{post.origin}</td><td>{formatPersianDateTime(post.createdAt)}</td><td>{post.targets.map((target) => <span className="social-target-chip" key={target.id}>{platformLabel[target.platform]} · {target.channelTitle}</span>)}</td><td>{post.status}</td><td>{post.targets.filter((target) => ['Failed', 'Unknown'].includes(target.status)).map((target) => <div className="social-retry" key={target.id}><span>{target.lastError || 'نتیجه نامشخص'}</span><button disabled={retryAction.busy} onClick={() => retry(target.id)}>{retryingId === target.id ? "در حال ارسال…" : "تلاش مجدد همین مقصد"}</button></div>)}</td></tr>)}{data?.items.length === 0 && <tr><td colSpan={8}>سابقه‌ای با این فیلترها وجود ندارد.</td></tr>}</tbody></table></section>
    {data && <Pager page={data.page} pageSize={data.pageSize} totalItems={data.totalItems} totalPages={data.totalPages} rowOffset={rowOffsetOf(data.page, data.pageSize)} busy={searchAction.busy} setPage={(next) => { const q = { ...query, page: next }; setQuery(q); void load(q) }} setPageSize={(size) => { const q = { ...query, pageSize: size, page: 1 }; setQuery(q); void load(q) }} />}
  </SocialPage>
}
