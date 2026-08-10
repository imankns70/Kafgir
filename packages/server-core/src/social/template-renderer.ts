import type { SocialPostTemplateType } from '@kafgir/contracts'

const forbiddenCapacityPlaceholder = /\{\{\s*(remainingCapacity|initialCapacity|capacity|soldQuantity|remainingPercentage|productionQuantity)\s*\}\}/iu
const suspiciousPublicCapacity = /(?:[0-9۰-۹٠-٩]+\s*(?:پرس|درصد|٪|%)|(?:ظرفیت|تولید|باقی.?مانده)\s*[:：]?\s*[0-9۰-۹٠-٩]+)/iu

export function assertSafePublicTemplate(templateType: SocialPostTemplateType, pattern: string) {
  if (forbiddenCapacityPlaceholder.test(pattern)) {
    throw new Error('قالب عمومی اجازه استفاده از مقدار عددی ظرفیت را ندارد.')
  }
  if (templateType === 'LimitedAvailability' && suspiciousPublicCapacity.test(pattern)) {
    throw new Error('متن ظرفیت محدود نباید مقدار دقیق تولید یا موجودی را نمایش دهد.')
  }
}

export function renderSocialTemplate(
  templateType: SocialPostTemplateType,
  pattern: string,
  variables: Readonly<Record<string, string>>,
) {
  assertSafePublicTemplate(templateType, pattern)
  const rendered = pattern.replace(/\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/gu, (_match, key: string) =>
    variables[key] ?? '')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()
  if (templateType === 'LimitedAvailability' && suspiciousPublicCapacity.test(rendered)) {
    throw new Error('پیش‌نمایش ظرفیت محدود حاوی مقدار عددی داخلی است.')
  }
  return rendered
}

export const formatSocialMoney = (value: number) =>
  `${new Intl.NumberFormat('fa-IR-u-nu-latn', { maximumFractionDigits: 0 }).format(value)} تومان`
