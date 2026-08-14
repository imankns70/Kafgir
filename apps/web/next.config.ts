import type { NextConfig } from 'next'
import { resolve } from 'node:path'

const nextConfig: NextConfig = {
  cacheComponents: true,
  output: 'standalone',
  devIndicators: false,
  allowedDevOrigins: ['192.168.70.176',
    '*.loca.lt',
    '*.trycloudflare.com',
    '*.pinggy.net',
    '*.pinggy.link',
    '*.run.pinggy-free.link',
    '*.free.pinggy.net'],
  transpilePackages: ['@kafgir/contracts'],
  poweredByHeader: false,
  turbopack: {
    root: resolve(process.cwd(), '../..'),
  },
}

export default nextConfig
