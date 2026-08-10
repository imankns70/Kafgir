import nextEnv from '@next/env'
import {
  closeDatabase,
  getSocialSettings,
  generateSocialDraft,
  listSocialRules,
  listSocialTemplates,
  sqlClient,
} from '@kafgir/server-core'

async function main() {
  nextEnv.loadEnvConfig(process.cwd())
  try {
    const [templates, rules, settings] = await Promise.all([
      listSocialTemplates(),
      listSocialRules(),
      getSocialSettings(),
    ])
    if (templates.length !== 5) throw new Error('Expected five initial social templates.')
    if (rules.length < 4) throw new Error('Expected four initial social automation rules.')
    if (rules.some((rule) => rule.executionMode !== 'Suggestion')) {
      throw new Error('Initial social automation rules must use Suggestion mode.')
    }
    const sources = await sqlClient<Array<{ menuDate: string; itemId: number; hasDiscount: boolean }>>`
      SELECT dm.menu_date::text AS "menuDate", dmi.id AS "itemId",
             dmi.discount_price IS NOT NULL AS "hasDiscount"
      FROM daily_menus dm JOIN daily_menu_items dmi ON dmi.daily_menu_id = dm.id
      ORDER BY dm.menu_date DESC, dmi.id LIMIT 20
    `
    if (sources.length === 0) throw new Error('No menu data exists for social draft verification.')
    const source = sources[0]!
    const dailyMenu = await generateSocialDraft({ templateType: 'DailyMenu', menuDate: source.menuDate })
    const promotion = await generateSocialDraft({ templateType: 'FoodPromotion', sourceId: source.itemId })
    const limited = await generateSocialDraft({ templateType: 'LimitedAvailability', sourceId: source.itemId })
    if (/\d+\s*(?:پرس|درصد|%|٪)/u.test(limited.defaultText)) {
      throw new Error('LimitedAvailability draft leaked an exact capacity value.')
    }
    const discounted = sources.find((item) => item.hasDiscount)
    const discount = discounted
      ? await generateSocialDraft({ templateType: 'Discount', sourceId: discounted.itemId })
      : null
    console.log(JSON.stringify({
      templates: templates.map((template) => template.templateType),
      rules: rules.map((rule) => ({ title: rule.title, mode: rule.executionMode, enabled: rule.isEnabled })),
      settings: {
        minimumIntervalMinutes: settings.minimumIntervalMinutes,
        maximumPostsPerDay: settings.maximumPostsPerDay,
      },
      drafts: {
        dailyMenu: dailyMenu.defaultText.length,
        promotion: promotion.defaultText.length,
        discount: discount?.defaultText.length ?? 'no-active-discount',
        limitedAvailability: limited.availabilityState,
      },
    }))
  } finally {
    await closeDatabase()
  }
}

void main()
