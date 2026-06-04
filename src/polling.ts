import 'dotenv/config'
import { createApp, registerMenuCommands } from './app'
import { checkAndNotify, CHECK_INTERVAL } from './services/notifications'

const token = Bun.env.BOT_TOKEN
if (!token) {
  throw new Error('BOT_TOKEN is not set in .env')
}

const { bot, db } = createApp(token)

console.log('🚀 Bot ishga tushdi...')
console.log('To\'xtatish uchun Ctrl+C')

bot.start()

registerMenuCommands(bot)

// Start notification polling
setTimeout(() => checkAndNotify(bot, db).catch(console.error), 3000)
setInterval(() => {
  checkAndNotify(bot, db).catch(console.error)
}, CHECK_INTERVAL)

console.log('🔔 Sun tracking polling started (every 5 min)')

process.on('SIGTERM', async () => {
  console.log('\n🛑 To\'xtatilmoqda...')
  await bot.stop()
  process.exit(0)
})
