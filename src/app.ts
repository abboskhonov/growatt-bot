import { Bot } from 'grammy'
import { BOT_COMMANDS } from './config'
import { UserDB } from './db'
import { registerCommands } from './handlers/commands'
import { registerButtons } from './handlers/buttons'
import { registerMessages } from './handlers/messages'
import type { D1Database } from './types'

export function createApp(token: string, d1?: D1Database) {
  const db = new UserDB(d1)
  const bot = new Bot(token)

  // Order matters: more specific handlers first
  registerCommands(bot, db)
  registerButtons(bot, db)
  registerMessages(bot, db)

  bot.catch((err) => {
    console.error('Bot xatosi:', err)
  })

  return { bot, db }
}

export async function registerMenuCommands(bot: Bot) {
  try {
    await bot.api.setMyCommands(
      BOT_COMMANDS.map((cmd) => ({
        command: cmd.command,
        description: cmd.description,
      }))
    )
    console.log('✅ Telegram menu commands registered')
  } catch (err) {
    console.error('❌ Failed to register menu commands:', err)
  }
}
