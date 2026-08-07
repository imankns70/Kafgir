import { contextBridge, ipcRenderer } from 'electron'
import type {
  AdminOperation,
  ConnectionConfigurationStatus,
  SecureConnectionConfiguration,
} from '../shared/admin-operations'

export interface AdminBridge {
  login(request: { username: string; password: string }): Promise<{
    fullName: string
    username: string
    roles: string[]
  }>
  logout(): Promise<void>
  invoke<T>(operation: AdminOperation, payload?: unknown): Promise<T>
  configurationStatus(): Promise<ConnectionConfigurationStatus>
  saveConfiguration(value: SecureConnectionConfiguration): Promise<ConnectionConfigurationStatus>
  clearConfiguration(): Promise<void>
  uploadFoodImage(request: { name: string; type: string; bytes: ArrayBuffer }): Promise<{ imageUrl: string }>
  deleteFoodImage(imageUrl: string): Promise<void>
  resolveMediaUrl(imageUrl: string): Promise<string>
  desktopLogs(limit?: number): Promise<Array<Record<string, unknown>>>
  printInvoice(): Promise<void>
}

const bridge: AdminBridge = {
  login: (request) => ipcRenderer.invoke('auth:login', request),
  logout: () => ipcRenderer.invoke('auth:logout'),
  invoke: (operation, payload) => ipcRenderer.invoke('admin:invoke', { operation, payload }),
  configurationStatus: () => ipcRenderer.invoke('configuration:status'),
  saveConfiguration: (value) => ipcRenderer.invoke('configuration:save', value),
  clearConfiguration: () => ipcRenderer.invoke('configuration:clear'),
  uploadFoodImage: (request) => ipcRenderer.invoke('foods:upload-image', request),
  deleteFoodImage: (imageUrl) => ipcRenderer.invoke('foods:delete-image', imageUrl),
  resolveMediaUrl: (imageUrl) => ipcRenderer.invoke('media:resolve-url', imageUrl),
  desktopLogs: (limit) => ipcRenderer.invoke('logs:desktop', limit),
  printInvoice: () => ipcRenderer.invoke('print:invoice'),
}

contextBridge.exposeInMainWorld('kafgir', bridge)
