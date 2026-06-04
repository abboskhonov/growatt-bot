# Growatt API Reference

> **Status:** Reverse-engineered from web application traffic. Not officially documented by Growatt.
>
> **Last Updated:** 2026-06-04
>
> **Tested On:** `mqtt.growatt.com`, `server.growatt.com`, `openapi.growatt.com`

---

## Table of Contents

1. [Base URLs](#base-urls)
2. [Authentication](#authentication)
3. [Password Hashing](#password-hashing)
4. [Session Management](#session-management)
5. [Plant Endpoints](#plant-endpoints)
6. [Energy Data Endpoints](#energy-data-endpoints)
7. [Inverter Endpoints](#inverter-endpoints)
8. [Device & Storage Endpoints](#device--storage-endpoints)
9. [Error Codes](#error-codes)
10. [Rate Limiting & Headers](#rate-limiting--headers)
11. [Security Notes](#security-notes)

---

## Base URLs

| Environment | URL | Notes |
|-------------|-----|-------|
| **Web Portal** | `https://mqtt.growatt.com` | Primary web portal |
| **Server API** | `https://server.growatt.com` | Alternative API host |
| **Open API** | `https://openapi.growatt.com` | Mobile app / unofficial API |
| **Server API v2** | `https://server-api.growatt.com` | Returns 405 for some endpoints |

> **Tip:** All endpoints return identical data across `mqtt.growatt.com`, `server.growatt.com`, and `openapi.growatt.com`. Use whichever is closest to your region.

---

## Authentication

### 1. Login (Primary)

```http
POST /newTwoLoginAPI.do
Content-Type: application/x-www-form-urlencoded
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userName` | string | ✅ | Username (email or phone) |
| `password` | string | ✅ | MD5-hashed password (see [Password Hashing](#password-hashing)) |

**Response:**
```json
{
  "back": {
    "success": true,
    "msg": "",
    "data": [
      {
        "plantId": "10506247",
        "plantName": "solar alisher uy"
      }
    ],
    "deviceCount": "3",
    "user": {
      "id": 3591151,
      "accountName": "alisher2099",
      "email": "berkino2099@gmail.com",
      "phoneNum": "998971015020",
      "timeZone": 8,
      "counrty": "Uzbekistan",
      "area": "Asia",
      "token": "5j6v4m12h015764770gw9199p435tk54",
      "cpowerAuth": "eyJhbGciOiJIUzI1NiIs...",
      "lastLoginTime": "2026-06-04 21:16:26"
    }
  }
}
```

**Key Fields in Response:**

| Field | Description |
|-------|-------------|
| `back.success` | `true` = login successful |
| `back.user.id` | User ID (needed for `PlantListAPI.do`) |
| `back.user.token` | Session token |
| `back.data[].plantId` | Plant ID for subsequent requests |
| `back.data[].plantName` | Human-readable plant name |
| `back.deviceCount` | Number of devices in the plant |

---

### 2. Legacy Login (Web Portal)

```http
POST /login
Content-Type: application/x-www-form-urlencoded
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `account` | string | ✅ | Username |
| `password` | string | ✅ | Plain text password |
| `passwordCrc` | string | ✅ | MD5 hash of password |
| `validateCode` | string | ❌ | 3-char captcha (if required) |
| `isReadPact` | int | ✅ | `1` = agreed to privacy policy |

**Response Codes:**

| Code | Meaning |
|------|---------|
| `1` | ✅ Success |
| `-1` | ❌ Invalid captcha |
| `-2` | ❌ Wrong username/password |
| `-3` | ⚠️ Redirect required |
| `-4` | ⚠️ Privacy policy update required |
| `-5` | ❌ Sanctioned country blocked |
| `8` | ⚠️ MD5 mismatch — retry with plain text |

---

### 3. OSS Login (Server Selection)

```http
POST https://oss.growatt.com/login
```

**Request Body:**

| Field | Value |
|-------|-------|
| `userName` | Username |
| `password` | Password (or MD5) |
| `passwordCrc` | MD5 hash (if password is empty) |
| `lang` | `en` |
| `loginTime` | `YYYY-MM-DD HH:MM:SS` |
| `noRecord` | `true` |
| `type` | `1` |

**OSS Response Codes:**

| Code | Meaning |
|------|---------|
| `1` | ✅ Account exists on this server |
| `3` | ⚠️ Account exists on multiple servers |
| `6` | ❌ Account not found on this server |
| `8` | ⚠️ MD5 password mismatch |

---

## Password Hashing

### Method 1: PyPi_GrowattServer Style (Recommended)

```python
import hashlib

def hash_password(password: str) -> str:
    """Growatt MD5 hash with 'c' substitution."""
    password_md5 = hashlib.md5(password.encode("utf-8")).hexdigest()
    for i in range(0, len(password_md5), 2):
        if password_md5[i] == "0":
            password_md5 = password_md5[0:i] + "c" + password_md5[i + 1:]
    return password_md5
```

**Example:**
```
Input:    "berkino2099"
Output:   "3acbf369e65ddd2e4288e5f333309c35"
```

### Method 2: Go Client Style (skoef/growatt)

```python
import hashlib

def hash_password_go(password: str) -> str:
    """Growatt MD5 with byte-level modification."""
    hash_bytes = hashlib.md5(password.encode()).digest()
    result = bytearray()
    for b in hash_bytes:
        if b <= 0x0f:
            b += 0xc0
        result.append(b)
    return result.hex()
```

> **Note:** Both methods produce different hashes. The PyPi style is the one that works with `newTwoLoginAPI.do`. The Go style is for older endpoints.

---

## Session Management

After successful login, the server sets cookies:

| Cookie | Purpose | Duration |
|--------|---------|----------|
| `JSESSIONID` | Session identifier | ~24 hours |
| `SERVERID` | Load balancer stickiness | Session |
| `token` | Alternative auth token | ~24 hours |

**Send these cookies on every subsequent request:**

```python
import requests

session = requests.Session()

# After login, cookies are auto-saved in session.cookies
# Include them in all requests:
resp = session.get("https://mqtt.growatt.com/PlantListAPI.do", params={"userId": user_id})
```

**Session Expiry:**
- Sessions typically last **24 hours**
- After expiry, API returns **login redirect** (HTML page instead of JSON)
- Re-authenticate when you detect a redirect or JSON parse error

---

## Plant Endpoints

### 1. Plant List

```http
GET /PlantListAPI.do
```

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `userId` | ✅ | User ID from login response |

**Response:**
```json
{
  "back": {
    "success": true,
    "totalData": {
      "CO2Sum": "41.16 KT",
      "currentPowerSum": "0 W",
      "isHaveStorage": "false",
      "todayEnergySum": "931.9 kWh",
      "eTotalMoneyText": "1.029064E8 ",
      "totalEnergySum": "102.91 MWh"
    },
    "data": [
      {
        "plantId": "10506247",
        "plantName": "solar alisher uy",
        "todayEnergy": "931.9 kWh",
        "totalEnergy": "102.91 MWh",
        "currentPower": "0 W",
        "plantMoneyText": "1.029064E8 ",
        "isHaveStorage": "false"
      }
    ]
  }
}
```

**Key Fields:**

| Field | Description | Example |
|-------|-------------|---------|
| `todayEnergy` | Today's production | `"931.9 kWh"` |
| `totalEnergy` | Lifetime production | `"102.91 MWh"` |
| `currentPower` | Current output | `"0 W"` |
| `CO2Sum` | Total CO₂ reduction | `"41.16 KT"` |
| `currentPowerSum` | Combined current power | `"0 W"` |
| `todayEnergySum` | Combined today's energy | `"931.9 kWh"` |
| `totalEnergySum` | Combined total energy | `"102.91 MWh"` |
| `eTotalMoneyText` | Estimated revenue | `"1.029064E8 "` |

---

### 2. Plant Detail (Energy Data)

```http
GET /PlantDetailAPI.do
```

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `plantId` | ✅ | Plant ID |
| `type` | ✅ | Time range: `1`=day, `2`=month, `3`=year |
| `date` | ✅ | Date format depends on `type` |

**Date Format by Type:**

| `type` | Date Format | Example | Granularity |
|--------|-------------|---------|-------------|
| `1` | Day | `2026-06-04` | 30-minute intervals |
| `2` | Month | `2026-06` | Daily totals |
| `3` | Year | `2026` | Monthly totals |
| `4` | Total | ` ` (empty) | Yearly totals |

**Response (type=1, day view):**
```json
{
  "back": {
    "success": true,
    "plantData": {
      "plantId": "10506247",
      "plantName": "solar alisher uy",
      "currentEnergy": "931.9 kWh",
      "plantMoneyText": "931900.0 "
    },
    "data": {
      "05:40": "3428",
      "05:45": "3566.57",
      "06:00": "6131.44",
      "08:00": "21207.09",
      "12:20": "132058.44",
      "14:30": "116151.97",
      "18:00": "20360.5"
    }
  }
}
```

**Data Format Notes:**
- Keys are **time strings** (format depends on `type`)
- Values are **power in Watts** (not kWh!)
- To get kWh: sum the values and divide by `(60/interval_minutes) * 1000`
  - For 30-min intervals: divide by 2000 to get kWh per point
  - Sum all points to get total kWh

---

### 3. New Plant Detail (Higher Resolution)

```http
GET /newPlantDetailAPI.do
```

Same parameters as `PlantDetailAPI.do`, but returns **timestamp-level data**:

```json
{
  "back": {
    "data": {
      "2026-06-04 12:10": "146029.44",
      "2026-06-04 12:15": "137133.95",
      "2026-06-04 12:20": "132058.44"
    }
  }
}
```

- Keys are full timestamps: `YYYY-MM-DD HH:MM`
- Values are power in **Watts**
- Interval is roughly **5-10 minutes** (more granular than `PlantDetailAPI.do`)

---

### 4. Plant Energy Overview (Rich Metadata)

```http
POST /newTwoPlantAPI.do
```

**Query Parameters:**
```
op=getUserCenterEnertyDataByPlantid
```

**Request Body:**
```
language=1
plantId=10506247
```

**Response:**
```json
{
  "yearStr": "0kWh",
  "weatherMap": {
    "tmp": "21",
    "cond_txt": "Sunny",
    "cond_code": "100"
  },
  "powerValueStr": "20.4kW",
  "alarmValue": 0,
  "plantBean": {
    "id": 10506247,
    "plantName": "solar alisher uy",
    "nominalPower": 177500,
    "country": "Turkey",
    "city": "Namangan",
    "timezone": 5.0,
    "plant_lat": "38.759798",
    "plant_lng": "35.411619",
    "formulaMoney": 1000.0,
    "formulaMoneyUnitId": "UZS",
    "eToday": 0.0,
    "eTotal": 102906.4,
    "energyMonth": 0.0,
    "energyYear": 0.0,
    "plantAddress": "Hurdacılar, Şeker, 38070 Kocasinan/Kayseri",
    "hasDeviceOnLine": 0,
    "hasStorage": 0,
    "createDateText": "2026-02-20"
  }
}
```

**Key Fields:**

| Field | Description |
|-------|-------------|
| `weatherMap.tmp` | Current temperature (°C) |
| `weatherMap.cond_txt` | Weather condition (Sunny, Cloudy, etc.) |
| `powerValueStr` | Current/nominal power display |
| `alarmValue` | Number of active alarms |
| `nominalPower` | System capacity (W) |
| `eToday` | Today's energy (kWh) |
| `eTotal` | Total energy (kWh) |
| `formulaMoney` | Revenue per kWh |
| `formulaMoneyUnitId` | Currency (UZS, USD, EUR) |
| `hasDeviceOnLine` | Devices online (0 = none, 2 = some) |
| `hasStorage` | Battery storage present (0 = no) |

---

### 5. Plant List with Full Details

```http
POST /newTwoPlantAPI.do
```

**Query Parameters:**
```
op=getAllPlantListTwo
```

**Request Body:**
```
language=1
nominalPower=
order=1
pageSize=15
plantName=
plantStatus=
toPageNum=1
```

**Response:**
```json
{
  "PlantList": [
    {
      "id": 10506247,
      "plantName": "solar alisher uy",
      "userAccount": "alisher2099",
      "nominalPower": 177500,
      "country": "Turkey",
      "city": "Namangan",
      "timezone": 5.0,
      "plantAddress": "Hurdacılar, Şeker, 38070 Kocasinan/Kayseri",
      "currentPac": 20360.5,
      "deviceCount": 3,
      "hasDeviceOnLine": 2,
      "hasStorage": 0,
      "status": 0,
      "etodayMoney": 931900,
      "etotalMoney": 102906400.0,
      "formulaMoneyUnitId": "UZS",
      "createDateText": "2026-02-20"
    }
  ]
}
```

---

## Energy Data Endpoints

### 1. Energy Data by Time Range

```http
GET /newPlantDetailAPI.do
```

**Time Range Mapping:**

| `type` | Range | Date Format | Use Case |
|--------|-------|-------------|----------|
| `1` | Day | `2026-06-04` | Hourly production chart |
| `2` | Month | `2026-06` | Daily totals for the month |
| `3` | Year | `2026` | Monthly totals for the year |
| `4` | Total | `` (empty) | Yearly totals for all years |

**Example: Monthly Data (type=2)**
```json
{
  "back": {
    "data": {
      "2026-06-01": "850.5",
      "2026-06-02": "920.3",
      "2026-06-03": "832.4",
      "2026-06-04": "931.9"
    }
  }
}
```

**Example: Yearly Data (type=3)**
```json
{
  "back": {
    "data": {
      "2026-01": "24500.5",
      "2026-02": "28000.3",
      "2026-03": "32000.0",
      "2026-04": "35000.1",
      "2026-05": "38000.2",
      "2026-06": "15300.0"
    }
  }
}
```

**Example: Total Data (type=4)**
```json
{
  "back": {
    "data": {
      "2026": "84655.41",
      "2025": "18251",
      "2024": "0",
      "2023": "0",
      "2022": "0",
      "2021": "0"
    }
  }
}
```

---

### 2. Plant Dashboard Data (Storage Systems)

```http
POST /newPlantAPI.do
```

**Query Parameters:**
```
action=getEnergyStorageData
```

**Request Body:**
```
date=2026-06-04
type=1
plantId=10506247
```

Returns energy breakdown for **Mix/TLX storage systems**:
- Solar production
- Battery charge/discharge
- Grid import/export
- Load consumption

---

## Inverter Endpoints

### 1. Inverter Data

```http
GET /newInverterAPI.do
```

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `op` | ✅ | `getInverterData` |
| `id` | ✅ | Inverter serial number |
| `type` | ✅ | `1` |
| `date` | ✅ | `YYYY-MM-DD` |

**Response:**
```json
{
  "invPacData": {
    "2026-06-04 08:00": 12500.5,
    "2026-06-04 09:00": 35000.0,
    "2026-06-04 12:00": 142000.0
  }
}
```

---

### 2. Inverter Detail

```http
GET /newInverterAPI.do
```

**Query Parameters:**
```
op=getInverterDetailData
inverterId=<serial_number>
```

Returns detailed inverter parameters:
- Voltage (PV1, PV2, grid)
- Current
- Power (input, output)
- Frequency
- Temperature
- Status

---

### 3. Device List

```http
GET /newTwoPlantAPI.do
```

**Query Parameters:**
```
op=getAllDeviceList
plantId=<plant_id>
language=1
```

Returns all devices in the plant:
- Inverters
- Data loggers
- Storage units
- Smart meters

---

## Device & Storage Endpoints

### 1. Storage Info

```http
GET /newStorageAPI.do
```

**Query Parameters:**
```
op=getStorageInfo_sacolar
storageId=<serial_number>
```

---

### 2. Storage Energy Overview

```http
POST /newStorageAPI.do
```

**Query Parameters:**
```
op=getEnergyOverviewData_sacolar
```

**Request Body:**
```
plantId=<plant_id>
storageSn=<serial_number>
```

---

### 3. TLX Inverter Data

```http
GET /newTlxApi.do
```

**Query Parameters:**
```
op=getTlxData
id=<serial_number>
type=1
date=YYYY-MM-DD
```

---

### 4. TLX System Status

```http
POST /newTlxApi.do
```

**Query Parameters:**
```
op=getSystemStatus_KW
```

**Request Body:**
```
plantId=<plant_id>
id=<serial_number>
```

---

### 5. Mix Inverter Info

```http
GET /newMixApi.do
```

**Query Parameters:**
```
op=getMixInfo
mixId=<serial_number>
plantId=<plant_id>
```

Returns:
- `epvToday` — PV energy today
- `epvTotal` — PV energy total
- `eBatChargeToday` — Battery charged today
- `eBatDisChargeToday` — Battery discharged today
- `soc` — Battery state of charge (%)
- `vpv1`, `vpv2` — PV voltages

---

### 6. Mix Totals

```http
POST /newMixApi.do
```

**Query Parameters:**
```
op=getEnergyOverview
mixId=<serial_number>
plantId=<plant_id>
```

Returns:
- `epvToday` / `epvTotal`
- `echargetoday` / `echargetotal`
- `edischarge1Today` / `edischarge1Total`
- `elocalLoadToday` / `elocalLoadTotal`
- `etoGridToday` / `etogridTotal`
- `photovoltaicRevenueToday`

---

### 7. Noah Battery System

```http
POST /noahDeviceApi/noah/getSystemStatus
```

**Request Body:**
```
deviceSn=<serial_number>
```

Returns:
- `chargePower` / `disChargePower`
- `soc` — Battery %
- `ppv` — Solar generation
- `pac` — Export to grid
- `eacToday` / `eacTotal`
- `profitToday` / `profitTotal`

---

## Error Codes

### Login Errors

| Code | Meaning | Action |
|------|---------|--------|
| `1` | ✅ Success | Continue |
| `-1` | Invalid captcha | Get captcha from `/getValidateCode.do` |
| `-2` | Wrong credentials | Check username/password |
| `-3` | Redirect required | Follow redirect to `/index` |
| `-4` | Privacy policy update | Login via browser first |
| `-5` | Country blocked | Use different server region |
| `8` | MD5 mismatch | Retry with plain text password |

### API Errors

| Code | Meaning | Action |
|------|---------|--------|
| `502` | Session expired | Re-login |
| `400` | Bad request | Check parameters |
| `403` | Forbidden | Check User-Agent header |
| `405` | Method not allowed | Use POST instead of GET or vice versa |
| `500` | Server error | Retry after delay |
| HTML redirect | Session expired | Re-login |

---

## Rate Limiting & Headers

### Required Headers

```http
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
Accept: application/json, text/javascript, */*; q=0.01
X-Requested-With: XMLHttpRequest
Referer: https://mqtt.growatt.com/
```

> **Important:** Some endpoints (especially `openapi.growatt.com`) reject the `Dalvik/...` user-agent. Use a standard browser user-agent instead.

### Rate Limits

| Endpoint | Recommended Interval | Daily Calls (5 min) | Daily Calls (10 min) |
|----------|---------------------|---------------------|---------------------|
| `PlantListAPI.do` | 5-10 min | 288 | 144 |
| `PlantDetailAPI.do` | 5-10 min | 288 | 144 |
| `newTwoLoginAPI.do` | Only on expiry | 1-2 | 1-2 |
| `newInverterAPI.do` | 10-15 min | 144 | 72 |
| `newMixApi.do` | 10-15 min | 144 | 72 |

**Best Practices:**
- **Cache session cookies** — don't re-login every request
- **Exponential backoff** on 500 errors
- **Don't poll faster than 5 minutes** — you'll get blocked
- **Batch requests** — fetch all plants in one call

---

## Security Notes

### ⚠️ Credentials

- **Never store plaintext passwords** in code or config
- **Store session cookies** instead (JSESSIONID, SERVERID)
- **Session cookies last ~24 hours** — re-login when expired
- **Use environment variables** for credentials

### ⚠️ HTTPS Only

- All endpoints **must** use HTTPS
- Never send credentials over HTTP
- Certificate is valid for `*.growatt.com`

### ⚠️ Data Sensitivity

- Plant data includes **location coordinates** (lat/lng)
- Revenue data uses **your actual currency** (UZS, USD, EUR)
- **Don't share plant IDs publicly** — they're semi-private

### ⚠️ Legal

- This is **reverse-engineered** — not officially supported
- Growatt may change endpoints without notice
- Use at your own risk
- **Don't abuse the API** — excessive polling may get your IP banned

---

## Quick Reference: Common API Calls

### Login + Get Today's Production

```python
import requests
import hashlib

BASE = "https://mqtt.growatt.com"

# Hash password
def hash_password(pwd):
    md5 = hashlib.md5(pwd.encode("utf-8")).hexdigest()
    for i in range(0, len(md5), 2):
        if md5[i] == "0":
            md5 = md5[:i] + "c" + md5[i+1:]
    return md5

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest",
    "Referer": BASE + "/",
})

# 1. Login
resp = session.post(f"{BASE}/newTwoLoginAPI.do", data={
    "userName": "alisher2099",
    "password": hash_password("berkino2099"),
})
login = resp.json()["back"]
user_id = login["user"]["id"]

# 2. Get plant list
resp = session.get(f"{BASE}/PlantListAPI.do", params={"userId": user_id})
plants = resp.json()["back"]["data"]

for plant in plants:
    print(f"{plant['plantName']}: {plant['todayEnergy']} today, {plant['totalEnergy']} total")

# 3. Get hourly data
plant_id = plants[0]["plantId"]
resp = session.get(f"{BASE}/PlantDetailAPI.do", params={
    "plantId": plant_id,
    "type": 1,
    "date": "2026-06-04",
})
hourly = resp.json()["back"]["data"]
print(hourly)
```

---

## Related Resources

- [PyPi_GrowattServer](https://github.com/indykoning/PyPi_GrowattServer) — Python library (most complete)
- [skoef/growatt](https://github.com/skoef/growatt) — Go client
- [ealse/GrowattApi](https://github.com/ealse/GrowattApi) — .NET client
- [Grott](https://github.com/johanmeijer/grott) — Local data logger (proxy)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-04 | Initial documentation based on live testing |
| 2026-06-04 | Verified endpoints: `mqtt.growatt.com`, `server.growatt.com`, `openapi.growatt.com` |
| 2026-06-04 | Tested with live account: `alisher2099` |

---

> **Disclaimer:** This documentation is based on reverse-engineering the Growatt web application. Growatt has not officially published this API. Endpoints, formats, and behavior may change without notice.
