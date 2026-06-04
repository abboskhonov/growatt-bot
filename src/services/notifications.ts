import { getPlantList } from './growatt'
import { UserDB } from '../db'
import type { Bot } from 'grammy'

// Thresholds
const START_THRESHOLD = 50  // W - above this = started generating
const STOP_THRESHOLD = 10   // W - below this = stopped generating

// Check interval (5 minutes)
export const CHECK_INTERVAL = 5 * 60 * 1000

export async function checkAndNotify(bot: Bot, db: UserDB): Promise<void> {
  const users = await db.getAllUsers()

  for (const user of users) {
    if (!user.growatt_user_id || !user.cookies) continue

    try {
      const plantList = await getPlantList(user.growatt_user_id, user.cookies)
      if (!plantList.back.success) continue

      const plants = plantList.back.data
      const totalPower = parseFloat(plantList.back.totalData?.currentPowerSum || '0')
      const totalEnergy = plantList.back.totalData?.todayEnergySum || '—'

      // Get previous state
      const prevState = await db.getPowerState(user.chat_id)
      const isGenerating = totalPower > START_THRESHOLD
      const isStopped = totalPower < STOP_THRESHOLD

      // First check: just save state, don't notify
      if (!prevState) {
        await db.setPowerState(user.chat_id, isGenerating, String(totalPower))
        continue
      }

      const wasGenerating = prevState.isGenerating

      // State change: started generating
      if (!wasGenerating && isGenerating) {
        await bot.api.sendMessage(
          user.chat_id,
          `☀️ <b>Quyosh ishga tushdi!</b>\n\n` +
          `⚡ Hozir: ${totalPower} W\n` +
          `📍 ${plants[0]?.plantName || 'Stansiya'}`,
          { parse_mode: 'HTML' }
        )
      }

      // State change: stopped generating
      if (wasGenerating && isStopped) {
        await bot.api.sendMessage(
          user.chat_id,
          `🌙 <b>Quyosh botdi</b>\n\n` +
          `⚡ Bugun: ${totalEnergy}\n` +
          `📍 ${plants[0]?.plantName || 'Stansiya'}`,
          { parse_mode: 'HTML' }
        )
      }

      // Save current state
      if (isGenerating || isStopped) {
        await db.setPowerState(user.chat_id, isGenerating, String(totalPower))
      }
    } catch (err) {
      console.error(`[notify] User ${user.chat_id} xatosi:`, err)
    }
  }
}
