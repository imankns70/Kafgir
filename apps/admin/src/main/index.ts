import { app, BrowserWindow, ipcMain } from 'electron'
import { join, resolve } from 'node:path'
import {
  authenticateAdmin,
  currentAdminRoles,
  assertReferenceDataSchemaReady,
  closeDatabase,
  configureDatabase,
  configureManagedImageDeleter,
  testDatabaseConnection,
  recoverInterruptedSocialPublications,
  type AdminPrincipal,
} from '@kafgir/server-core'
import type {
  AdminOperationRequest,
  SecureConnectionConfiguration,
} from '../shared/admin-operations'
import { parseInvoicePrintRequest, thermalPageHeightMicrons } from '../shared/invoice-print'
import { dispatchAdminOperation } from './admin-dispatcher'
import { desktopLogger, readDesktopLogs } from './logger'
import {
  configureFoodImageStorage,
  deleteManagedFoodImage,
  hasConfiguredFoodImageStorage,
  uploadFoodImage,
} from './object-storage'
import {
  clearSecureConfiguration,
  connectionConfigurationStatus,
  readSecureConfiguration,
  saveSecureConfiguration,
} from './secure-configuration'

let mainWindow: BrowserWindow | null = null
let principal: AdminPrincipal | null = null
/** When the signed-in account was last re-read, so deactivation or a role change ends the session. */
let principalCheckedAt = 0
const principalRecheckMs = 60_000

async function refreshPrincipal() {
  if (!principal || Date.now() - principalCheckedAt < principalRecheckMs) return
  const roles = await currentAdminRoles(principal.userId)
  principalCheckedAt = Date.now()
  if (!roles) {
    desktopLogger().warn({ event: 'auth.session.revoked', userId: principal.userId }, 'حساب مدیریت غیرفعال شد')
    principal = null
    throw new Error('حساب شما غیرفعال شده یا دسترسی آن تغییر کرده است. دوباره وارد شوید.')
  }
  principal = { ...principal, roles }
}
let configuredFingerprint: string | null = null
let runtimeConfigurationPromise: Promise<void> | null = null
let databaseClosedForQuit = false
let socialAutomationTimer: ReturnType<typeof setInterval> | null = null

function developmentUploadRoot() {
  return app.isPackaged
    ? null
    : resolve(process.env.FOOD_UPLOAD_ROOT?.trim() || join(app.getAppPath(), '../..', '.data', 'uploads'))
}

function ensureFoodImageStorage(value: SecureConnectionConfiguration) {
  if (value.cloudinary || hasConfiguredFoodImageStorage()) return
  const root = developmentUploadRoot()
  configureFoodImageStorage(null, root)
  configureManagedImageDeleter(root ? deleteManagedFoodImage : null)
}

async function configureRuntime(value: SecureConnectionConfiguration) {
  const uploadRoot = developmentUploadRoot()
  const fingerprint = `${value.databaseUrl}\n${value.cloudinary?.cloudName ?? ''}\n${value.cloudinary?.apiKey ?? ''}\n${uploadRoot ?? 'packaged'}`
  if (configuredFingerprint === fingerprint) return
  if (runtimeConfigurationPromise) {
    await runtimeConfigurationPromise
    if (configuredFingerprint === fingerprint) return
  }
  runtimeConfigurationPromise = (async () => {
    await configureDatabase(value.databaseUrl, Number(process.env.ELECTRON_DATABASE_POOL_SIZE ?? 3))
    // Catches "this DATABASE_URL was never migrated" once at connect time, before it surfaces as a
    // raw PostgresError from whichever screen happens to query a missing table first.
    await assertReferenceDataSchemaReady()
    configureFoodImageStorage(value.cloudinary, uploadRoot)
    configureManagedImageDeleter(value.cloudinary || uploadRoot ? deleteManagedFoodImage : null)
    await recoverInterruptedSocialPublications()
    configuredFingerprint = fingerprint
  })().finally(() => {
    runtimeConfigurationPromise = null
  })
  await runtimeConfigurationPromise
}

async function runSocialAutomation() {
  if (!principal) return
  try {
    await dispatchAdminOperation('social.automation.evaluate', undefined, principal)
  } catch (error) {
    desktopLogger().warn({ event: 'social.automation.skipped', err: error }, 'ارزیابی خودکار شبکه‌های اجتماعی انجام نشد')
  }
}

function startSocialAutomationTimer() {
  if (socialAutomationTimer) clearInterval(socialAutomationTimer)
  if (!principal?.roles.includes('Owner')) return
  socialAutomationTimer = setInterval(() => void runSocialAutomation(), 60_000)
  void runSocialAutomation()
}

async function ensureConfigured() {
  const value = await readSecureConfiguration()
  if (!value?.databaseUrl) {
    throw new Error('ابتدا اتصال پایگاه داده را در تنظیمات برنامه ثبت کنید.')
  }
  await configureRuntime(value)
  return value
}

function assertTrustedSender(event: Electron.IpcMainInvokeEvent) {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('Untrusted IPC sender.')
  }
}

function registerIpc() {
  ipcMain.handle('configuration:status', async (event) => {
    assertTrustedSender(event)
    return connectionConfigurationStatus()
  })
  ipcMain.handle(
    'configuration:save',
    async (event, value: SecureConnectionConfiguration) => {
      assertTrustedSender(event)
      await testDatabaseConnection(value.databaseUrl)
      await saveSecureConfiguration(value)
      configuredFingerprint = null
      await configureRuntime(value)
      principal = null
      desktopLogger().info({ event: 'configuration.saved' }, 'پیکربندی امن اتصال ذخیره شد')
      return connectionConfigurationStatus()
    },
  )
  ipcMain.handle('configuration:clear', async (event) => {
    assertTrustedSender(event)
    principal = null
    configuredFingerprint = null
    runtimeConfigurationPromise = null
    configureFoodImageStorage(null, null)
    configureManagedImageDeleter(null)
    await closeDatabase()
    await clearSecureConfiguration()
    desktopLogger().info({ event: 'configuration.cleared' }, 'پیکربندی اتصال حذف شد')
  })
  ipcMain.handle('auth:login', async (
    event,
    request: { username: string; password: string },
  ) => {
    assertTrustedSender(event)
    await ensureConfigured()
    principal = await authenticateAdmin(request)
    principalCheckedAt = Date.now()
    startSocialAutomationTimer()
    return {
      fullName: principal.fullName,
      username: principal.username,
      roles: principal.roles,
    }
  })
  ipcMain.handle('auth:logout', (event) => {
    assertTrustedSender(event)
    principal = null
    if (socialAutomationTimer) clearInterval(socialAutomationTimer)
    socialAutomationTimer = null
    desktopLogger().info({ event: 'auth.logout' }, 'خروج از حساب مدیریت')
  })
  ipcMain.handle('admin:invoke', async (event, request: AdminOperationRequest) => {
    assertTrustedSender(event)
    await ensureConfigured()
    const startedAt = Date.now()
    try {
      await refreshPrincipal()
      const result = await dispatchAdminOperation(request.operation, request.payload, principal)
      desktopLogger().info({
        event: 'database.operation.succeeded',
        operation: request.operation,
        durationMs: Date.now() - startedAt,
      }, 'عملیات مستقیم پایگاه داده موفق بود')
      return result
    } catch (error) {
      desktopLogger().error({
        event: 'database.operation.failed',
        operation: request.operation,
        durationMs: Date.now() - startedAt,
        err: error,
      }, 'عملیات مستقیم پایگاه داده ناموفق بود')
      throw error
    }
  })
  ipcMain.handle('foods:upload-image', async (
    event,
    request: { name: string; type: string; bytes: ArrayBuffer },
  ) => {
    assertTrustedSender(event)
    const value = await ensureConfigured()
    if (!principal) throw new Error('ابتدا وارد حساب مدیریت شوید.')
    ensureFoodImageStorage(value)
    const result = await uploadFoodImage(request)
    desktopLogger().info({
      event: 'food.image.uploaded',
      mimeType: request.type,
      sizeBytes: request.bytes.byteLength,
    }, 'تصویر غذا در فضای ذخیره‌سازی بارگذاری شد')
    return result
  })
  ipcMain.handle('foods:delete-image', async (event, imageUrl: string) => {
    assertTrustedSender(event)
    await ensureConfigured()
    if (!principal) throw new Error('ابتدا وارد حساب مدیریت شوید.')
    await deleteManagedFoodImage(imageUrl)
  })
  ipcMain.handle('media:resolve-url', (event, imageUrl: string) => {
    assertTrustedSender(event)
    if (/^https:\/\//iu.test(imageUrl)) return imageUrl
    if (imageUrl.startsWith('/api/media/foods/')) {
      const webBase = (process.env.KAFGIR_WEB_BASE_URL ?? 'http://localhost:3000').replace(/\/$/u, '')
      return `${webBase}${imageUrl}`
    }
    throw new Error('Invalid media URL.')
  })
  ipcMain.handle('logs:desktop', (event, limit?: number) => {
    assertTrustedSender(event)
    return readDesktopLogs(limit)
  })
  ipcMain.handle('print:invoice', async (event, value: unknown) => {
    assertTrustedSender(event)
    if (!mainWindow || !principal) throw new Error('ابتدا وارد حساب مدیریت شوید.')
    const request = parseInvoicePrintRequest(value)
    const printOptions = request.layout === 'thermal'
      ? {
          silent: false,
          printBackground: false,
          color: false,
          margins: { marginType: 'none' as const },
          pageSize: {
            width: 80_000,
            height: thermalPageHeightMicrons(request.contentHeightPx),
          },
        }
      : {
          silent: false,
          printBackground: true,
          color: true,
          margins: { marginType: 'custom' as const, top: 45, bottom: 45, left: 45, right: 45 },
          pageSize: 'A4' as const,
        }
    await new Promise<void>((resolvePrint, rejectPrint) => {
      mainWindow!.webContents.print(printOptions, (success, failureReason) => {
        if (success) resolvePrint()
        else rejectPrint(new Error(failureReason || 'باز کردن پنجره چاپ ممکن نشد.'))
      })
    })
  })
}

function createWindow() {
  const icon = app.isPackaged
    ? join(process.resourcesPath, 'kafgir.ico')
    : join(__dirname, '../../build/kafgir.ico')
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    title: 'کفگیر',
    icon,
    backgroundColor: '#FFF3E2',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  if (process.env.ELECTRON_RENDERER_URL) {
    void loadDevelopmentRenderer(mainWindow, process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function loadDevelopmentRenderer(window: BrowserWindow, url: string) {
  // electron-vite starts the renderer server alongside the main process. On a cold
  // `npm run dev`, the main bundle can be ready a few hundred milliseconds first.
  // Retry the initial navigation so the combined web/admin command is reliable.
  for (let attempt = 0; attempt < 20 && !window.isDestroyed(); attempt += 1) {
    try {
      await window.loadURL(url)
      return
    } catch (error) {
      if (attempt === 19 || window.isDestroyed()) {
        desktopLogger().error({ event: 'renderer.load.failed', attempts: attempt + 1, error }, 'رابط پنل مدیریت بارگذاری نشد')
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
}

app.whenReady().then(() => {
  desktopLogger().info({ event: 'app.started', version: app.getVersion() }, 'برنامه مدیریت کفگیر اجرا شد')
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', (event) => {
  if (databaseClosedForQuit) return
  event.preventDefault()
  principal = null
  if (socialAutomationTimer) clearInterval(socialAutomationTimer)
  void closeDatabase().finally(() => {
    databaseClosedForQuit = true
    app.quit()
  })
})

app.on('window-all-closed', () => {
  desktopLogger().info({ event: 'app.closed' }, 'برنامه مدیریت کفگیر بسته شد')
  if (process.platform !== 'darwin') app.quit()
})
