import { describe, expect, it } from 'vitest'
import {
  socialChannelWriteSchema,
  socialPostWriteSchema,
  socialRuleWriteSchema,
  socialTemplateWriteSchema,
} from './social'

describe('social publishing contracts', () => {
  it('accepts one generic channel model for all supported platforms', () => {
    for (const platform of ['Telegram', 'Bale', 'Eitaa'] as const) {
      expect(socialChannelWriteSchema.parse({
        platform, title: `کانال ${platform}`, externalChannelId: 'channel', credential: 'secure-token', isActive: true,
      }).platform).toBe(platform)
    }
  })

  it('rejects capacity placeholders in public templates', () => {
    expect(() => socialTemplateWriteSchema.parse({
      templateType: 'LimitedAvailability', title: 'محدود', pattern: '{{remainingCapacity}} پرس', isActive: true,
    })).toThrow(/ظرفیت/u)
  })

  it('requires unique destinations for a post', () => {
    expect(() => socialPostWriteSchema.parse({
      templateType: 'Custom', defaultText: 'سلام',
      targets: [{ channelId: 1 }, { channelId: 1 }], origin: 'Manual',
    })).toThrow(/تکراری/u)
  })

  it('requires threshold only for limited availability rule', () => {
    expect(() => socialRuleWriteSchema.parse({
      title: 'محدود', templateType: 'LimitedAvailability', triggerType: 'LimitedAvailability',
      isEnabled: true, executionMode: 'Suggestion', priority: 10, targetChannelIds: [],
    })).toThrow(/آستانه/u)
  })
})
