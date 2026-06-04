import { createHash } from 'crypto'
import { BASE_URL, HEADERS, MESSAGES, STATUS_MAP, TYPE_EMOJIS } from '../config'
import type { LoginResult, PlantListResponse } from '../types'

// --- Password hashing ---

export function hashPassword(password: string): string {
  let md5 = createHash('md5').update(password).digest('hex')
  let result = ''
  for (let i = 0; i < md5.length; i += 2) {
    result += md5[i] === '0' ? 'c' : md5[i]
    result += md5[i + 1]
  }
  return result
}

// --- Cookie handling ---

function collectCookies(response: Response): string {
  const cookies: string[] = []
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      cookies.push(value.split(';')[0])
    }
  })
  return cookies.join('; ')
}

// --- API calls ---

export async function login(userName: string, password: string): Promise<LoginResult> {
  const hashedPassword = hashPassword(password)

  const response = await fetch(`${BASE_URL}/newTwoLoginAPI.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...HEADERS,
    },
    body: new URLSearchParams({ userName, password: hashedPassword }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }

  const cookies = collectCookies(response)
  const data = await response.json()

  return { data, cookies }
}

export async function getPlantList(userId: number, cookies: string): Promise<PlantListResponse> {
  const response = await fetch(`${BASE_URL}/PlantListAPI.do?userId=${userId}`, {
    method: 'GET',
    headers: {
      ...HEADERS,
      'Cookie': cookies,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }

  return response.json()
}

export async function getDeviceList(plantId: string, cookies: string): Promise<unknown> {
  const response = await fetch(
    `${BASE_URL}/newTwoPlantAPI.do?op=getAllDeviceList&plantId=${plantId}&language=1`,
    {
      method: 'GET',
      headers: {
        ...HEADERS,
        'Cookie': cookies,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }

  return response.json()
}

// --- Energy data (week/month) ---

export async function getPlantEnergyData(
  plantId: string,
  type: number,
  date: string,
  cookies: string
): Promise<any> {
  const response = await fetch(
    `${BASE_URL}/PlantDetailAPI.do?plantId=${plantId}&type=${type}&date=${date}`,
    {
      method: 'GET',
      headers: {
        ...HEADERS,
        'Cookie': cookies,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }

  return response.json()
}

function getCurrentMonthDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getCurrentYear(): string {
  return String(new Date().getFullYear())
}

export function getTodayDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const MONTHS_UZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']

export function formatUzbekDate(dateStr: string): string {
  console.log('[formatUzbekDate] input:', dateStr, typeof dateStr)
  if (!dateStr || typeof dateStr !== 'string') {
    console.log('[formatUzbekDate] invalid input, returning Bugun')
    return 'Bugun'
  }
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3) {
    console.log('[formatUzbekDate] wrong parts count:', parts.length)
    return 'Bugun'
  }
  const [year, month, day] = parts
  if (!year || !month || !day || month < 1 || month > 12) {
    console.log('[formatUzbekDate] invalid values:', { year, month, day })
    return 'Bugun'
  }
  const result = `${day} ${MONTHS_UZ[month - 1]}, ${year}`
  console.log('[formatUzbekDate] result:', result)
  return result
}

function parseEnergyData(data: Record<string, string>): number[] {
  return Object.values(data).map((v) => parseFloat(v) || 0)
}

function parseEnergyEntries(data: any): { date: string; value: number }[] {
  if (!data) return []

  // Array of strings/numbers: generate dates from month + index
  if (Array.isArray(data)) {
    const [year, month] = getCurrentMonthDate().split('-')
    return data.map((v, i) => ({
      date: `${year}-${month}-${String(i + 1).padStart(2, '0')}`,
      value: parseFloat(v) || 0,
    }))
  }

  // Object with date keys: { "2026-06-01": "850.5" }
  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([date, value]) => ({
        date: date.includes('-') ? date : `${getCurrentMonthDate()}-${String(date).padStart(2, '0')}`,
        value: parseFloat(value as string) || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  return []
}

export async function getWeekData(plantId: string, cookies: string): Promise<{ plantName: string; total: number; days: number; entries: { date: string; value: number }[] }> {
  const monthDate = getCurrentMonthDate()
  const today = getTodayDate()
  const result = await getPlantEnergyData(plantId, 2, monthDate, cookies)
  const rawData = result?.back?.data

  console.log('Week API response:', JSON.stringify(rawData).slice(0, 500))

  const entries = parseEnergyEntries(rawData).filter((e) => e.date <= today)

  // Last 7 days
  const last7 = entries.slice(-7)
  const total = last7.reduce((sum, e) => sum + e.value, 0)

  return { plantName: result?.back?.plantData?.plantName || '', total, days: last7.length, entries: last7 }
}

export async function getMonthData(plantId: string, cookies: string): Promise<{ plantName: string; total: number; days: number; entries: { date: string; value: number }[] }> {
  const monthDate = getCurrentMonthDate()
  const result = await getPlantEnergyData(plantId, 2, monthDate, cookies)
  const rawData = result?.back?.data

  console.log('Month API response:', JSON.stringify(rawData).slice(0, 500))

  const entries = parseEnergyEntries(rawData)
  const total = entries.reduce((sum, e) => sum + e.value, 0)

  return { plantName: result?.back?.plantData?.plantName || '', total, days: entries.length, entries }
}

export async function getYearData(plantId: string, cookies: string): Promise<{ plantName: string; total: number; months: number; entries: { month: string; value: number }[] }> {
  const year = getCurrentYear()
  const result = await getPlantEnergyData(plantId, 3, year, cookies)
  const rawData = result?.back?.data

  const entries = Object.entries(rawData || {})
    .map(([month, value]) => ({ month, value: parseFloat(value as string) || 0 }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const total = entries.reduce((sum, e) => sum + e.value, 0)

  return { plantName: result?.back?.plantData?.plantName || '', total, months: entries.length, entries }
}

// --- Formatters ---

export async function getTodayHourlyData(plantId: string, cookies: string, date: string) {
  const result = await getPlantEnergyData(plantId, 1, date, cookies)
  const rawData = result?.back?.data

  const entries = Object.entries(rawData || {})
    .map(([time, value]) => ({
      time: time.includes(':') ? time.slice(0, 5) : time.padStart(5, '0'),
      value: parseFloat(value as string) || 0,
    }))
    .sort((a, b) => a.time.localeCompare(b.time))

  return { entries, plantName: result?.back?.plantData?.plantName || '' }
}

export function buildTodayChartUrl(entries: { time: string; value: number }[], dateStr?: string): string | null {
  if (entries.length === 0) return null

  console.log('[buildTodayChartUrl] dateStr:', dateStr, typeof dateStr)
  const titleText = dateStr ? `☀️ ${formatUzbekDate(dateStr)}` : '☀️ Bugun'
  console.log('[buildTodayChartUrl] title:', titleText)

  const labels = entries.map((e) => e.time)
  const data = entries.map((e) => e.value)
  const maxVal = Math.max(...data, 0.1)

  const bg = data.map((v) => {
    const i = Math.min(1, 0.3 + (v / maxVal) * 0.7)
    const r = Math.round(255)
    const g = Math.round(160 + 95 * i)
    const b = Math.round(30)
    return `rgba(${r},${g},${b},0.85)`
  })

  const chartConfig = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: bg,
          borderRadius: 3,
          barPercentage: 0.85,
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: titleText,
          color: '#1a1a2e',
          font: { size: 16, weight: 'bold' },
        },
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'W (Quvvat)',
            color: '#666',
            font: { size: 11 },
          },
          grid: { color: '#f5f5f5' },
          ticks: { color: '#888', font: { size: 10 } },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: '#888',
            font: { size: 9 },
            maxTicksLimit: 8,
          },
        },
      },
    },
  }

  const encoded = encodeURIComponent(JSON.stringify(chartConfig))
  console.log('[buildTodayChartUrl] encoded length:', encoded.length)
  if (encoded.length > 8000) return null
  const cacheBuster = Math.random().toString(36).slice(2, 8)
  return `https://quickchart.io/chart?w=700&h=400&c=${encoded}&_cb=${cacheBuster}`
}

export function formatLoginResult(data: LoginResult['data']): string {
  const { user, data: plants, deviceCount } = data.back

  let text = `<b>${MESSAGES.loginSuccess}</b>\n\n`
  text += `👤 ${user.accountName}\n`
  text += `📧 ${user.email}\n`
  text += `📱 ${user.phoneNum}\n`
  text += `🌍 ${user.counrty || '—'}\n`
  text += `🔐 ${deviceCount} ta qurilma\n\n`

  if (plants.length > 0) {
    text += `<b>🏭 Stansiyalar:</b>\n`
    for (const plant of plants) {
      text += `  • ${plant.plantName}\n`
    }
  }

  return text
}

export function formatTodayResult(
  plantList: PlantListResponse,
  deviceMap: Record<string, unknown>
): string {
  const { data: plants } = plantList.back

  if (plants.length === 0) {
    return `<b>☀️ Bugun</b>\n\n${MESSAGES.noPlants}`
  }

  let text = ''

  for (const plant of plants) {
    text += `<b>☀️ ${plant.plantName}</b>\n\n`
    text += `⚡ Bugun: ${plant.todayEnergy || '—'}\n`
    text += `📊 Hozir: ${plant.currentPower || '—'}\n\n`

    const devices = deviceMap[plant.plantId]
    if (devices) {
      const deviceText = formatDevices(devices)
      if (deviceText) {
        text += `<b>Qurilmalar</b>\n\n`
        text += deviceText
      }
    }

    text += `\n`
  }

  return text
}

export function formatWeekResult(
  weekData: { plantName: string; total: number; days: number; entries: { date: string; value: number }[] }[]
): string {
  if (weekData.length === 0) {
    return `<b>📅 Hafta</b>\n\n${MESSAGES.noPlants}`
  }

  let text = `<b>📅 Hafta</b>\n\n`

  for (const data of weekData) {
    text += `<b>☀️ ${data.plantName}</b>\n\n`
    text += `⚡ Jami: ${data.total.toFixed(1)} kWh\n`
    text += `📊 ${data.days} kun\n\n`

    for (const entry of data.entries) {
      const day = entry.date.length > 5 ? entry.date.slice(5) : entry.date
      text += `  ${day}: ${entry.value.toFixed(1)} kWh\n`
    }

    text += `\n`
  }

  return text
}

export function formatMonthResult(
  monthData: { plantName: string; total: number; days: number; entries: { date: string; value: number }[] }[]
): string {
  if (monthData.length === 0) {
    return `<b>📆 Oy</b>\n\n${MESSAGES.noPlants}`
  }

  let text = `<b>📆 Oy</b>\n\n`

  for (const data of monthData) {
    text += `<b>☀️ ${data.plantName}</b>\n\n`
    text += `⚡ Jami: ${data.total.toFixed(1)} kWh\n`
    text += `📊 ${data.days} kun\n\n`

    for (const entry of data.entries) {
      const day = entry.date.length > 5 ? entry.date.slice(5) : entry.date
      text += `  ${day}: ${entry.value.toFixed(1)} kWh\n`
    }

    text += `\n`
  }

  return text
}

function formatDevices(devices: any): string {
  if (devices?.deviceList) {
    let text = ''
    for (const device of devices.deviceList) {
      text += formatDevice(device)
    }
    return text
  }

  if (devices?.back?.data) {
    const data = devices.back.data
    let text = ''

    for (const [type, list] of Object.entries(data)) {
      if (Array.isArray(list)) {
        for (const device of list) {
          text += formatDevice(device, TYPE_EMOJIS[type] || '🔌')
        }
      }
    }
    return text
  }

  return ''
}

function formatDevice(device: any, emoji = '🔌'): string {
  const name = device.deviceAilas || device.deviceName || device.deviceSn || device.serialNum || device.datalogSn || `Noma'lum`

  // Status emoji for the device line
  const statusEmoji = device.deviceStatus !== undefined
    ? (STATUS_MAP[String(device.deviceStatus)]?.split(' ')[0] || '⚪')
    : emoji

  let text = `${statusEmoji} <b>${name}</b>\n`

  if (device.eToday || device.epvToday || device.eacToday || device.ppvToday) {
    const energyStr = device.eTodayStr || device.epvTodayStr
    const energy = device.eToday || device.epvToday || device.eacToday || device.ppvToday
    text += `   ${energyStr || energy} kWh bugun\n`
  }

  return text + '\n'
}
