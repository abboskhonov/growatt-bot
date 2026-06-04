export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1ExecResult>
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  run<T = unknown>(): Promise<D1Result<T>>
  all<T = unknown>(): Promise<D1Result<T>>
  raw<T = unknown>(): Promise<T[]>
}

export interface D1Result<T> {
  results: T[]
  success: boolean
  error?: string
  meta?: {
    duration: number
    last_row_id?: number
    changes?: number
  }
}

export interface D1ExecResult {
  count: number
  duration: number
}

export interface UserRecord {
  chat_id: number
  username: string
  growatt_user_id: number
  cookies: string
  created_at: number
  updated_at: number
}

export interface Plant {
  plantId: string
  plantName: string
}

export interface UserInfo {
  id: number
  accountName: string
  email: string
  phoneNum: string
  counrty: string
  timeZone: number
  token: string
  lastLoginTime: string
}

export interface LoginResponse {
  back: {
    success: boolean
    msg: string
    data: Plant[]
    deviceCount: string
    user: UserInfo
  }
}

export interface LoginResult {
  data: LoginResponse
  cookies: string
}

export interface PlantListResponse {
  back: {
    success: boolean
    data: Array<{
      plantId: string
      plantName: string
      todayEnergy: string
      totalEnergy: string
      currentPower: string
      status: string
    }>
    totalData: {
      todayEnergySum: string
      totalEnergySum: string
      currentPowerSum: string
      CO2Sum: string
    }
  }
}
