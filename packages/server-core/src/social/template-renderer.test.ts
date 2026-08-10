import { describe, expect, it } from 'vitest'
import { assertSafePublicTemplate, renderSocialTemplate } from './template-renderer'

describe('social public template privacy', () => {
  it('renders qualitative limited availability without capacity values', () => {
    expect(renderSocialTemplate('LimitedAvailability', '{{foodName}} رو به اتمام است', {
      foodName: 'زرشک‌پلو',
    })).toBe('زرشک‌پلو رو به اتمام است')
  })

  it('rejects internal capacity placeholders', () => {
    expect(() => assertSafePublicTemplate('LimitedAvailability', '{{remainingCapacity}} پرس مانده'))
      .toThrow(/ظرفیت/u)
  })

  it('rejects exact capacity copy in limited content', () => {
    expect(() => renderSocialTemplate('LimitedAvailability', 'فقط 2 پرس باقی مانده', {}))
      .toThrow(/مقدار دقیق/u)
  })
})
