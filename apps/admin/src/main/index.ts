import { app, BrowserWindow, ipcMain } from 'electron'
import { join, resolve } from 'node:path'
import {
  authenticateAdmin,
  closeDatabase,
  configureDatabase,
  configureManagedImageDeleter,
  testDatabaseConnection,
  type AdminPrincipal,
} from '@kafgir/server-core'
import type {
  AdminOperationRequest,
  SecureConnectionConfiguration,
} from '../shared/admin-operations'
import { dispatchAdminOperation } from './admin-dispatcher'
import { desktopLogger, readDesktopLogs } from './logger'
import {
  configureObjectStorage,
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
let configuredFingerprint: string | null = null
let runtimeConfigurationPromise: Promise<void> | null = null
let databaseClosedForQuit = false

function developmentUploadRoot() {
  return app.isPackaged
    ? null
    : resolve(process.env.FOOD_UPLOAD_ROOT?.trim() || join(app.getAppPath(), '../..', '.data', 'uploads'))
}

function ensureFoodImageStorage(value: SecureConnectionConfiguration) {
  if (value.storage || hasConfiguredFoodImageStorage()) return
  const root = developmentUploadRoot()
  configureObjectStorage(null, root)
  configureManagedImageDeleter(root ? deleteManagedFoodImage : null)
}

async function configureRuntime(value: SecureConnectionConfiguration) {
  const uploadRoot = developmentUploadRoot()
  const fingerprint = `${value.databaseUrl}\n${value.storage?.endpoint ?? ''}\n${value.storage?.bucket ?? ''}\n${uploadRoot ?? 'packaged'}`
  if (configuredFingerprint === fingerprint) return
  if (runtimeConfigurationPromise) {
    await runtimeConfigurationPromise
    if (configuredFingerprint === fingerprint) return
  }
  runtimeConfigurationPromise = (async () => {
    await configureDatabase(value.databaseUrl, Number(process.env.ELECTRON_DATABASE_POOL_SIZE ?? 3))
    configureObjectStorage(value.storage, uploadRoot)
    configureManagedImageDeleter(value.storage || uploadRoot ? deleteManagedFoodImage : null)
    configuredFingerprint = fingerprint
  })().finally(() => {
    runtimeConfigurationPromise = null
  })
  await runtimeConfigurationPromise
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
    configureObjectStorage(null, null)
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
    return {
      fullName: principal.fullName,
      username: principal.username,
      roles: principal.roles,
    }
  })
  ipcMain.handle('auth:logout', (event) => {
    assertTrustedSender(event)
    principal = null
    desktopLogger().info({ event: 'auth.logout' }, 'خروج از حساب مدیریت')
  })
  ipcMain.handle('admin:invoke', async (event, request: AdminOperationRequest) => {
    assertTrustedSender(event)
    await ensureConfigured()
    const startedAt = Date.now()
    try {
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
  ipcMain.handle('print:invoice', async (event) => {
    assertTrustedSender(event)
    if (!mainWindow || !principal) throw new Error('ابتدا وارد حساب مدیریت شوید.')
    await new Promise<void>((resolvePrint, rejectPrint) => {
      mainWindow!.webContents.print({
        silent: false,
        printBackground: true,
      }, (success, failureReason) => {
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
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
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
  void closeDatabase().finally(() => {
    databaseClosedForQuit = true
    app.quit()
  })
})

app.on('window-all-closed', () => {
  desktopLogger().info({ event: 'app.closed' }, 'برنامه مدیریت کفگیر بسته شد')
  if (process.platform !== 'darwin') app.quit()
})
