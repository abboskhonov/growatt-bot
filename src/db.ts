import type { D1Database, UserRecord } from './types'

// --- Local SQLite (Bun) ---

let localDb: any = null

function getLocalDb(): any {
  if (!localDb) {
    const { Database } = (globalThis as any).Bun ? require('bun:sqlite') : { Database: class {} }
    localDb = new Database('growatt.db', { create: true })
    localDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        chat_id INTEGER PRIMARY KEY,
        username TEXT,
        growatt_user_id INTEGER,
        cookies TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `)
  }
  return localDb
}

// --- Unified DB ---

export class UserDB {
  private d1?: D1Database
  private local?: Database
  private isLocal: boolean

  constructor(db?: D1Database) {
    if (db) {
      this.d1 = db
      this.isLocal = false
    } else {
      this.local = getLocalDb()
      this.isLocal = true
    }
  }

  async getUser(chatId: number): Promise<UserRecord | null> {
    if (this.isLocal) {
      const row = this.local!.query('SELECT * FROM users WHERE chat_id = ?').get(chatId) as UserRecord | undefined
      return row ?? null
    }

    const stmt = this.d1!.prepare('SELECT * FROM users WHERE chat_id = ?').bind(chatId)
    return stmt.first<UserRecord>()
  }

  async saveUser(chatId: number, username: string, growattUserId: number, cookies: string): Promise<void> {
    if (this.isLocal) {
      this.local!.query(
        `INSERT INTO users (chat_id, username, growatt_user_id, cookies, updated_at)
         VALUES (?, ?, ?, ?, unixepoch())
         ON CONFLICT(chat_id) DO UPDATE SET
           username = excluded.username,
           growatt_user_id = excluded.growatt_user_id,
           cookies = excluded.cookies,
           updated_at = excluded.updated_at`
      ).run(chatId, username, growattUserId, cookies)
      return
    }

    const stmt = this.d1!.prepare(
      `INSERT INTO users (chat_id, username, growatt_user_id, cookies, updated_at)
       VALUES (?, ?, ?, ?, strftime('%s', 'now'))
       ON CONFLICT(chat_id) DO UPDATE SET
         username = excluded.username,
         growatt_user_id = excluded.growatt_user_id,
         cookies = excluded.cookies,
         updated_at = excluded.updated_at`
    ).bind(chatId, username, growattUserId, cookies)
    await stmt.run()
  }

  async deleteUser(chatId: number): Promise<void> {
    if (this.isLocal) {
      this.local!.query('DELETE FROM users WHERE chat_id = ?').run(chatId)
      return
    }

    const stmt = this.d1!.prepare('DELETE FROM users WHERE chat_id = ?').bind(chatId)
    await stmt.run()
  }

  async getAllUsers(): Promise<UserRecord[]> {
    if (this.isLocal) {
      return this.local!.query('SELECT * FROM users').all() as UserRecord[]
    }

    const stmt = this.d1!.prepare('SELECT * FROM users')
    const result = await stmt.all<UserRecord>()
    return result.results ?? []
  }

  // --- Power state tracking (notifications) ---

  async getPowerState(chatId: number): Promise<{ isGenerating: boolean; lastPower: string; lastUpdated: number } | null> {
    const createTable = `
      CREATE TABLE IF NOT EXISTS power_states (
        chat_id INTEGER PRIMARY KEY,
        is_generating INTEGER DEFAULT 0,
        last_power TEXT DEFAULT '0',
        last_updated INTEGER DEFAULT 0
      )
    `
    if (this.isLocal) {
      this.local!.exec(createTable)
      const row = this.local!.query('SELECT * FROM power_states WHERE chat_id = ?').get(chatId) as any
      if (!row) return null
      return { isGenerating: !!row.is_generating, lastPower: row.last_power, lastUpdated: row.last_updated }
    }

    await this.d1!.exec(createTable)
    const stmt = this.d1!.prepare('SELECT * FROM power_states WHERE chat_id = ?').bind(chatId)
    const row = await stmt.first<any>()
    if (!row) return null
    return { isGenerating: !!row.is_generating, lastPower: row.last_power, lastUpdated: row.last_updated }
  }

  async setPowerState(chatId: number, isGenerating: boolean, lastPower: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000)
    const createTable = `
      CREATE TABLE IF NOT EXISTS power_states (
        chat_id INTEGER PRIMARY KEY,
        is_generating INTEGER DEFAULT 0,
        last_power TEXT DEFAULT '0',
        last_updated INTEGER DEFAULT 0
      )
    `
    if (this.isLocal) {
      this.local!.exec(createTable)
      this.local!.query(
        `INSERT INTO power_states (chat_id, is_generating, last_power, last_updated)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(chat_id) DO UPDATE SET
           is_generating = excluded.is_generating,
           last_power = excluded.last_power,
           last_updated = excluded.last_updated`
      ).run(chatId, isGenerating ? 1 : 0, lastPower, now)
      return
    }

    await this.d1!.exec(createTable)
    const stmt = this.d1!.prepare(
      `INSERT INTO power_states (chat_id, is_generating, last_power, last_updated)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         is_generating = excluded.is_generating,
         last_power = excluded.last_power,
         last_updated = excluded.last_updated`
    ).bind(chatId, isGenerating ? 1 : 0, lastPower, now)
    await stmt.run()
  }
}
