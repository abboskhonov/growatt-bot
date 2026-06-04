import { MESSAGES, loggedInKeyboard, loggedOutKeyboard } from '../config'
import { UserDB } from '../db'
import {
  getPlantList,
  getDeviceList,
  getTodayDate,
  getTodayHourlyData,
  buildTodayChartUrl,
  getWeekData,
  getMonthData,
  formatTodayResult,
  formatWeekResult,
  formatMonthResult,
} from '../services/growatt'
import { InputFile } from 'grammy'
import type { Bot } from 'grammy'

export function registerCommands(bot: Bot, db: UserDB) {
  // /start
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id
    const user = await db.getUser(chatId)
    const isLoggedIn = !!user?.growatt_user_id && !!user.cookies
    const name = ctx.from?.first_name || 'do\'st'

    if (isLoggedIn) {
      await ctx.reply(
        MESSAGES.startLoggedIn(name),
        { parse_mode: 'HTML', reply_markup: loggedInKeyboard() }
      )
      return
    }

    await ctx.reply(
      MESSAGES.start(name),
      { parse_mode: 'HTML', reply_markup: loggedOutKeyboard() }
    )
  })

  // /help
  bot.command('help', async (ctx) => {
    await ctx.reply(MESSAGES.help, { parse_mode: 'HTML' })
  })

  // /status
  bot.command('status', async (ctx) => {
    await ctx.reply(MESSAGES.status)
  })

  // /login
  bot.command('login', async (ctx) => {
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
    await ctx.reply(MESSAGES.askUsername, { parse_mode: 'HTML' })
  })

  // /logout
  bot.command('logout', async (ctx) => {
    await db.deleteUser(ctx.chat.id)
    await ctx.reply(MESSAGES.logout, {
      parse_mode: 'HTML',
      reply_markup: loggedOutKeyboard(),
    })
  })

  // /settings
  bot.command('settings', async (ctx) => {
    const chatId = ctx.chat.id
    const user = await db.getUser(chatId)

    if (!user?.growatt_user_id || !user.cookies) {
      await ctx.reply(MESSAGES.notLoggedIn, { parse_mode: 'HTML' })
      return
    }

    await ctx.reply(
      MESSAGES.settings(user.username),
      { parse_mode: 'HTML', reply_markup: loggedInKeyboard() }
    )
  })

  // /today
  bot.command('today', async (ctx) => {
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
      const today = getTodayDate()
      console.log('[today] today date:', today)

      for (const plant of plantList.back.data) {
        try {
          deviceMap[plant.plantId] = await getDeviceList(plant.plantId, user.cookies)
        } catch (err) {
          console.error(`Plant ${plant.plantId} qurilmalari olinmadi:`, err)
        }
      }

      // Build text summary
      const reply = formatTodayResult(plantList, deviceMap)

      // Send chart + summary merged as one message
      if (plantList.back.data.length > 0) {
        const firstPlant = plantList.back.data[0]
        console.log('[today] Generating chart for plant:', firstPlant.plantId, 'date:', today)
        try {
          const hourlyData = await getTodayHourlyData(firstPlant.plantId, user.cookies, today)
          console.log('[today] Hourly data entries:', hourlyData.entries.length, 'plantName:', hourlyData.plantName)
          if (hourlyData.entries.length > 0) {
            const chartUrl = buildTodayChartUrl(hourlyData.entries, today)
            console.log('[today] Chart URL length:', chartUrl?.length || 0)
            if (chartUrl) {
              console.log('[today] Fetching chart image...')
              const imgResp = await fetch(chartUrl)
              if (!imgResp.ok) {
                console.error('[today] Chart fetch failed:', imgResp.status)
                throw new Error(`Chart fetch failed: ${imgResp.status}`)
              }
              const imgBlob = await imgResp.blob()
              console.log('[today] Chart image size:', imgBlob.size)
              
              const arrayBuffer = await imgBlob.arrayBuffer()
              const inputFile = new InputFile(new Uint8Array(arrayBuffer), 'chart.png')
              
              console.log('[today] Sending photo with merged caption...')
              await ctx.api.sendPhoto(ctx.chat.id, inputFile, {
                caption: reply,
                parse_mode: 'HTML',
                reply_markup: loggedInKeyboard(),
              })
              console.log('[today] Photo sent successfully')
              return  // ✅ merged — don't send separate text
            }
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          console.error('[today] Chart generation error:', error)
        }
      }

      // Fallback: send text only if chart failed
      await ctx.reply(reply, {
        parse_mode: 'HTML',
        reply_markup: loggedInKeyboard(),
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await ctx.reply(MESSAGES.error(error), { parse_mode: 'HTML' })
    }
  })

  // /week
  bot.command('week', async (ctx) => {
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

  // /month
  bot.command('month', async (ctx) => {
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
}
