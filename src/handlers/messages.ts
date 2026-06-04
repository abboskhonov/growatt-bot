import { MESSAGES, loggedInKeyboard, removeKeyboardMarkup } from '../config'
import { UserDB } from '../db'
import { login, formatLoginResult } from '../services/growatt'
import type { Bot } from 'grammy'

export function registerMessages(bot: Bot, db: UserDB) {
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim()
    const chatId = ctx.chat.id

    if (text.startsWith('/')) return

    const user = await db.getUser(chatId)
    if (!user) {
      await ctx.reply(MESSAGES.startFirst)
      return
    }

    // Step 1: waiting for username
    if (!user.username) {
      await db.saveUser(chatId, text, 0, '')
      await ctx.reply(MESSAGES.askPassword(text), {
        parse_mode: 'HTML',
        reply_markup: removeKeyboardMarkup(),
      })
      return
    }

    // Step 2: waiting for password
    if (user.cookies === '') {
      await handleLogin(ctx, db, user.username, text)
      return
    }

    // Default
    await ctx.reply(MESSAGES.defaultReply(text))
  })
}

async function handleLogin(
  ctx: any,
  db: UserDB,
  username: string,
  password: string
) {
  await ctx.reply(MESSAGES.loggingIn)

  try {
    const { data: result, cookies } = await login(username, password)

    if (result.back.success) {
      await db.saveUser(ctx.chat.id, username, result.back.user.id, cookies)
      await ctx.reply(formatLoginResult(result), {
        parse_mode: 'HTML',
        reply_markup: loggedInKeyboard(),
      })
    } else {
      await ctx.reply(MESSAGES.loginFailed(result.back.msg), {
        parse_mode: 'HTML',
        reply_markup: removeKeyboardMarkup(),
      })
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await ctx.reply(MESSAGES.error(error), { parse_mode: 'HTML' })
  }
}
