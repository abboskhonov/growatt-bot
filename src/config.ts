import { Keyboard } from 'grammy'

export const BASE_URL = 'https://mqtt.growatt.com'

export const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': 'https://mqtt.growatt.com/',
}

export const BOT_COMMANDS = [
  { command: 'start', description: 'Botni ishga tushirish' },
  { command: 'login', description: 'Growatt hisobiga kirish' },
  { command: 'today', description: 'Bugungi ishlab chiqarish' },
  { command: 'week', description: 'Haftalik ishlab chiqarish' },
  { command: 'month', description: 'Oylik ishlab chiqarish' },
  { command: 'logout', description: 'Hisobdan chiqish' },
  { command: 'settings', description: 'Sozlamalar' },
  { command: 'help', description: 'Yordam' },
  { command: 'status', description: 'Holat' },
] as const

// --- Button labels ---
export const BTN = {
  today: '☀️ Bugun',
  week: '📅 Hafta',
  month: '📆 Oy',
  settings: '⚙️ Sozlamalar',
  logout: '🚪 Chiqish',
  login: '🔐 Kirish',
  help: 'ℹ️ Yordam',
  back: '◀️ Orqaga',
} as const



// --- Reply keyboards ---

export const loggedOutKeyboard = () =>
  new Keyboard()
    .text(BTN.login).text(BTN.help)
    .resized()

export const loggedInKeyboard = () =>
  new Keyboard()
    .text(BTN.today)
    .row()
    .text(BTN.week).text(BTN.month)
    .row()
    .text(BTN.settings).text(BTN.logout)
    .resized()

export const settingsKeyboard = () =>
  new Keyboard()
    .text(BTN.today)
    .row()
    .text(BTN.logout).text(BTN.back)
    .resized()

export function removeKeyboardMarkup() {
  return { remove_keyboard: true } as any
}



// --- Messages ---

export const MESSAGES = {
  start: (name: string) =>
    `👋 Salom, ${name}!

` +
    `Bu <b>Growatt</b> bot — quyosh energiyasi monitoringi.

` +
    `Hisobingizni ulang va panelingizni kuzating.`,

  startLoggedIn: (name: string) =>
    `👋 Salom, ${name}!

` +
    `Siz kirdingiz. Quyosh energiyasi monitoringi tayyor.`,

  help:
    `<b>📋 Buyruqlar:</b>

` +
    `/start — Botni ishga tushirish
` +
    `/login — Growatt hisobiga kirish
` +
    `/today — Bugungi ishlab chiqarish
` +
    `/week — Haftalik ishlab chiqarish
` +
    `/month — Oylik ishlab chiqarish
` +
    `/logout — Hisobdan chiqish
` +
    `/settings — Sozlamalar
` +
    `/help — Yordam
` +
    `/status — Holat`,

  askUsername:
    `🔐 <b>Growatt hisobiga kirish</b>

` +
    `Username ni kiriting:`,

  askPassword: (username: string) =>
    `✅ Username: <code>${username}</code>

` +
    `Endi parolni kiriting:`,

  alreadyLoggedIn: (username: string) =>
    `✅ Siz allaqachon kirdingiz: <code>${username}</code>

` +
    `Quyidagi amallarni bajaring:`,

  settings: (username: string) =>
    `⚙️ <b>Sozlamalar</b>

` +
    `👤 Hisob: <code>${username}</code>

` +
    `Ma'lumotlarni o'chirish yoki yangilash uchun chiqing va qayta kiring.`,

  loggingIn: '⏳ Kirilmoqda...',
  loadingData: '⏳ Ma\'lumotlar yuklanmoqda...',
  loginSuccess: '✅ Kirdik!',
  loginFailed: (msg: string) => `❌ Xato: ${msg || 'Login yoki parol noto\'g\'ri'}\n\nQayta /login bilan urinib ko'ring.`,
  notLoggedIn: '⚠️ Avval /login bilan hisobingizga kiring.',
  startFirst: '⚠️ Avval /login bilan kiring.',
  sessionExpired: '❌ Sessiya tugagan. /login bilan qayta kiring.',
  logout: '👋 Chiqildi. Ma\'lumotlar o\'chirildi.',
  status: '✅ Bot ishlayapti!',
  statusWorkers: '✅ Bot ishlayapti! (Cloudflare Workers)',
  error: (msg: string) => `❌ Xato: ${msg}\n\n/login bilan qayta kiring.`,
  defaultReply: (text: string) => `Siz: ${text}`,
  noPlants: 'Stansiya topilmadi.',
  noDevices: '      (qurilma yo\'q)',
  noData: '      (ma\'lumot yo\'q)',
} as const

export const STATUS_MAP: Record<string, string> = {
  '0': '⚪ Oflayn',
  '1': '🟢 Onlayn',
  '2': '🔴 Xato',
  '5': '🟢 Onlayn',
}

export const TYPE_EMOJIS: Record<string, string> = {
  inverters: '⚡',
  dataLoggers: '📡',
  storageDevices: '🔋',
  smartMeters: '📊',
  tlxDevices: '⚡',
  mixDevices: '🔋',
}
