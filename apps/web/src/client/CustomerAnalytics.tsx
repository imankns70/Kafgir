'use client'

import { useEffect } from 'react'
import { startCustomerAnalytics } from './services/customerAnalytics'

export function CustomerAnalytics() {
  useEffect(() => startCustomerAnalytics(), [])
  return null
}
