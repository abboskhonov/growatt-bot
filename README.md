# Growatt Bot

Telegram bot for Growatt solar monitoring — Uzbek language. Built with [grammY](https://grammy.dev) + [Hono](https://hono.dev) on Cloudflare Workers.

## Setup

```bash
bun install
```

Get a bot token from [@BotFather](https://t.me/botfather), then:

**Local dev:**
```bash
cp .env.example .env
# Edit .env: BOT_TOKEN=your_token
```

**Production:**
```bash
bun run secret
# or: wrangler secret put BOT_TOKEN
```

## Development

```bash
bun run dev
```

Hot reload with `bun --watch`. No Wrangler needed.

## Deploy

```bash
bun run deploy
```

## Register Webhook

After deploy, visit:
```
https://your-worker.workers.dev/setup-webhook
```

Remove:
```
https://your-worker.workers.dev/delete-webhook
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot |
| `/login` | Connect Growatt account |
| `/today` | Today's solar production |
| `/week` | This week's solar production |
| `/month` | This month's solar production |
| `/logout` | Disconnect account |
| `/settings` | Account settings |
| `/help` | Help |
| `/status` | Bot status |

## Data Storage

| Environment | Database |
|-------------|----------|
| Local dev | `bun:sqlite` (`growatt.db`) |
| Production | Cloudflare D1 |

### D1 Setup

```bash
wrangler d1 create growatt-bot
wrangler d1 execute growatt-bot --command "CREATE TABLE IF NOT EXISTS users (chat_id INTEGER PRIMARY KEY, username TEXT, growatt_user_id INTEGER, cookies TEXT, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()));"
# Copy database_id into wrangler.jsonc
```

## Notifications

The bot automatically monitors your solar panels and sends notifications:

- **☀️ Morning**: When panels start generating (power > 50W)
- **🌙 Evening**: When panels stop generating (power < 10W)

Notifications are checked every 5 minutes. You don't need to do anything — just log in and the bot will start monitoring.

## Project Structure

```
src/
  config.ts              # Constants, messages, headers
  types.ts               # Shared TypeScript interfaces
  db.ts                  # Unified DB (SQLite / D1)
  app.ts                 # Bot setup, registers all handlers
  polling.ts             # Local dev entry (Bun)
  index.ts               # Cloudflare Workers entry (Hono)
  services/
    growatt.ts           # Growatt API client + formatters
    notifications.ts     # Sun tracking notifications
  handlers/
    buttons.ts           # Reply keyboard handlers
    commands.ts          # /start, /help, /login, /today, etc.
    messages.ts          # Text message flow (login steps)
```

## Scripts

| Script | Purpose |
|--------|---------|
| `dev` | Local dev with hot reload |
| `deploy` | Deploy to Cloudflare |
| `webhook` | Test webhook mode locally |
| `secret` | Set production token |
| `cf-typegen` | Generate Cloudflare types |
