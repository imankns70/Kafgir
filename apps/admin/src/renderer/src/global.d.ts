import type { AdminBridge } from '../../preload'

declare global {
  interface Window {
    kafgir: AdminBridge
  }
}

export {}
