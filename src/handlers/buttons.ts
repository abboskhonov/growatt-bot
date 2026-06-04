import { MESSAGES, BTN, loggedInKeyboard, loggedOutKeyboard, settingsKeyboard, removeKeyboardMarkup } from '../config'
import { UserDB } from '../db'
import {
  getPlantList,
  getDeviceList,
  getWeekData,
  getMonthData,
  formatTodayResult,
  formatWeekResult,
  formatMonthResult,
} from '../services/growatt'
import type { Bot } from 'grammy'

export function registerButtons(bot: Bot, db: UserDB) {
  // ☀️ Bugun
  bot.hears(BTN.today, async (ctx) => {
    const chatId = ctx.chat.id
    const user = await db.getUser(chatId)

    if (!user?.growatt_user_id || !user.cookies) {
      await ctx.reply(MESSAGES.notLoggedIn, {
        parse_mode: 'HTML',
        reply_markup: loggedOutKeyboard(),
      })
      return
    }

    await ctx.reply(MESSAGES.loadingData)

    try {
      const plantList = await getPlantList(user.growatt_user_id, user.cookies)
      if (!plantList.back.success) {
        await ctx.reply(MESSAGES.sessionExpired, {
          parse_mode: 'HTML',
          reply_markup: loggedOutKeyboard(),
        })
        return
      }

      const deviceMap: Record<string, unknown> = {}
      for (const plant of plantList.back.data) {
        try {
          deviceMap[plant.plantId] = await getDeviceList(plant.plantId, user.cookies)
        } catch (err) {
          console.error(`Plant ${plant.plantId} qurilmalari olinmadi:`, err)
        }
      }

      const reply = formatTodayResult(plantList, deviceMap)
      await ctx.reply(reply, {
        parse_mode: 'HTML',
        reply_markup: loggedInKeyboard(),
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await ctx.reply(MESSAGES.error(error), { parse_mode: 'HTML' })
    }
  })

  // ⚙️ Sozlamalar
  bot.hears(BTN.settings, async (ctx) => {
    const chatId = ctx.chat.id
    const user = await db.getUser(chatId)

    if (!user?.growatt_user_id || !user.cookies) {
      await ctx.reply(MESSAGES.notLoggedIn, {
        parse_mode: 'HTML',
        reply_markup: loggedOutKeyboard(),
      })
      return
    }

    await ctx.reply(
      MESSAGES.settings(user.username),
      { parse_mode: 'HTML', reply_markup: settingsKeyboard() }
    )
  })

  // 🚪 Chiqish
  bot.hears(BTN.logout, async (ctx) => {
    await db.deleteUser(ctx.chat.id)
    await ctx.reply(MESSAGES.logout, {
      parse_mode: 'HTML',
      reply_markup: loggedOutKeyboard(),
    })
  })

  // 🔐 Kirish
  bot.hears(BTN.login, async (ctx) => {
    const chatId = ctx.chat.id
    const user = await db.getUser(chatId)

    if (user?.growatt_user_id && user.cookies) {
      await ctx.reply(
        MESSAGES.alreadyLoggedIn(user.username),
        { parse_mode: 'HTML', reply_markup: loggedInKeyboard() }
      )
      return
    }

    await db.saveUser(chatId, '', 0, '')
    await ctx.reply(MESSAGES.askUsername, {
      parse_mode: 'HTML',
      reply_markup: removeKeyboardMarkup(),
    })
  })

  // 📅 Hafta
  bot.hears(BTN.week, async (ctx) => {
    const chatId = ctx.chat.id
    const user = await db.getUser(chatId)

    if (!user?.growatt_user_id || !user.cookies) {
      await ctx.reply(MESSAGES.notLoggedIn, {
        parse_mode: 'HTML',
        reply_markup: loggedOutKeyboard(),
      })
      return
    }

    await ctx.reply(MESSAGES.loadingData)

    try {
      const plantList = await getPlantList(user.growatt_user_id, user.cookies)
      if (!plantList.back.success) {
        await ctx.reply(MESSAGES.sessionExpired, {
          parse_mode: 'HTML',
          reply_markup: loggedOutKeyboard(),
        })
        return
      }

      const weekData = []
      for (const plant of plantList.back.data) {
        try {
          weekData.push(await getWeekData(plant.plantId, user.cookies))
        } catch (err) {
          console.error(`Plant ${plant.plantId} hafta ma'lumoti olinmadi:`, err)
        }
      }

      const reply = formatWeekResult(weekData)
      await ctx.reply(reply, {
        parse_mode: 'HTML',
        reply_markup: loggedInKeyboard(),
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await ctx.reply(MESSAGES.error(error), { parse_mode: 'HTML' })
    }
  })

  // 📆 Oy
  bot.hears(BTN.month, async (ctx) => {
    const chatId = ctx.chat.id
    const user = await db.getUser(chatId)

    if (!user?.growatt_user_id || !user.cookies) {
      await ctx.reply(MESSAGES.notLoggedIn, {
        parse_mode: 'HTML',
        reply_markup: loggedOutKeyboard(),
      })
      return
    }

    await ctx.reply(MESSAGES.loadingData)

    try {
      const plantList = await getPlantList(user.growatt_user_id, user.cookies)
      if (!plantList.back.success) {
        await ctx.reply(MESSAGES.sessionExpired, {
          parse_mode: 'HTML',
          reply_markup: loggedOutKeyboard(),
        })
        return
      }

      const monthData = []
      for (const plant of plantList.back.data) {
        try {
          monthData.push(await getMonthData(plant.plantId, user.cookies))
        } catch (err) {
          console.error(`Plant ${plant.plantId} oy ma'lumoti olinmadi:`, err)
        }
      }

      const reply = formatMonthResult(monthData)
      await ctx.reply(reply, {
        parse_mode: 'HTML',
        reply_markup: loggedInKeyboard(),
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await ctx.reply(MESSAGES.error(error), { parse_mode: 'HTML' })
    }
  })

  // ℹ️ Yordam
  bot.hears(BTN.help, async (ctx) => {
    await ctx.reply(MESSAGES.help, { parse_mode: 'HTML' })
  })

  // ◀️ Orqaga
  bot.hears(BTN.back, async (ctx) => {
    await ctx.reply(
      `Quyidagi amallarni bajaring:`,
      { parse_mode: 'HTML', reply_markup: loggedInKeyboard() }
    )
  })
}
