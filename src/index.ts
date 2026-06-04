import { Hono } from 'hono'
import { webhookCallback } from 'grammy'
import { createApp, registerMenuCommands } from './app'
import { checkAndNotify } from './services/notifications'
import type { D1Database } from './types'

export interface Env {
  BOT_TOKEN: string
  DB: D1Database
}

const app = new Hono<{ Bindings: Env }>()

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', bot: 'growatt-bot', hasToken: !!c.env.BOT_TOKEN, tokenLen: c.env.BOT_TOKEN?.length })
})

// Webhook
app.post('/webhook', async (c) => {
  try {
    const { bot } = createApp(c.env.BOT_TOKEN, c.env.DB)
    return webhookCallback(bot, 'hono')(c)
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('Webhook error:', error)
    return c.json({ error: error }, 500)
  }
})

// Setup webhook
app.get('/setup-webhook', async (c) => {
  const { bot } = createApp(c.env.BOT_TOKEN, c.env.DB)
  const webhookUrl = new URL(c.req.url)
  webhookUrl.pathname = '/webhook'

  try {
    await bot.api.setWebhook(webhookUrl.toString())
    await registerMenuCommands(bot)
    return c.json({
      ok: true,
      message: 'Webhook va menu commands sozlandi',
      url: webhookUrl.toString(),
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return c.json({ ok: false, error }, 500)
  }
})

// Delete webhook
app.get('/delete-webhook', async (c) => {
  const { bot } = createApp(c.env.BOT_TOKEN, c.env.DB)
  try {
    await bot.api.deleteWebhook()
    return c.json({ ok: true, message: 'Webhook o\'chirildi' })
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return c.json({ ok: false, error }, 500)
  }
})

export default app

// Cron job for Cloudflare Workers (webhook mode)
export const scheduled = async (event: any, env: Env, ctx: any) => {
  console.log('🔔 Cron job triggered:', event.cron)
  const { bot, db } = createApp(env.BOT_TOKEN, env.DB)
  ctx.waitUntil(checkAndNotify(bot, db))
}
