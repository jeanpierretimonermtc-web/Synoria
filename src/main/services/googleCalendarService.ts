import { BrowserWindow, app } from 'electron'
import * as https from 'https'
import * as fs   from 'fs'
import * as path from 'path'

// ─── Constantes ───────────────────────────────────────────────────────────────

const REDIRECT_URI  = 'http://127.0.0.1:42813/oauth2callback'
const TOKEN_URL     = 'https://oauth2.googleapis.com/token'
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'
const SCOPES        = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tokens {
  access_token:  string
  refresh_token: string
  expiry_date:   number  // ms timestamp
}

interface GCalConfig {
  client_id:     string
  client_secret: string
  calendar_id:   string
  calendar_name: string
  email?:        string
  tokens?:       Tokens
}

// ─── Helpers fichier config ───────────────────────────────────────────────────

function configPath(): string {
  return path.join(app.getPath('userData'), 'google_calendar.json')
}

function loadConfig(): GCalConfig | null {
  try {
    const p = configPath()
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, 'utf8')) as GCalConfig
  } catch { return null }
}

function saveConfig(cfg: GCalConfig): void {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8')
}

// ─── Helpers HTTP ─────────────────────────────────────────────────────────────

function httpsPost(url: string, body: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString()
    const u    = new URL(url)
    const req  = https.request({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        try { resolve(JSON.parse(raw)) }
        catch { reject(new Error(`JSON parse error: ${raw.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function httpsReq(method: string, url: string, token: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined
    const u       = new URL(url)
    const req     = https.request({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        if (res.statusCode === 204 || !raw) { resolve(null); return }
        try { resolve(JSON.parse(raw)) }
        catch { reject(new Error(`JSON parse error: ${raw.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// ─── Gestion du token (refresh automatique) ───────────────────────────────────

async function getAccessToken(): Promise<string> {
  const cfg = loadConfig()
  if (!cfg?.tokens?.refresh_token) throw new Error('Non connecté à Google Calendar')

  // Token encore valide (marge 60s)
  if (cfg.tokens.expiry_date > Date.now() + 60_000) {
    return cfg.tokens.access_token
  }

  // Refresh
  const res = await httpsPost(TOKEN_URL, {
    client_id:     cfg.client_id,
    client_secret: cfg.client_secret,
    refresh_token: cfg.tokens.refresh_token,
    grant_type:    'refresh_token',
  })
  if (res.error) throw new Error(res.error_description || res.error)

  cfg.tokens.access_token = res.access_token
  cfg.tokens.expiry_date  = Date.now() + (res.expires_in as number) * 1000
  saveConfig(cfg)
  return res.access_token
}

// ─── API publique ─────────────────────────────────────────────────────────────

export function getStatus() {
  const cfg = loadConfig()
  return {
    connected:    !!(cfg?.tokens?.refresh_token),
    email:        cfg?.email,
    calendarId:   cfg?.calendar_id,
    calendarName: cfg?.calendar_name,
  }
}

export async function connect(clientId: string, clientSecret: string): Promise<void> {
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',   // force refresh_token à chaque connexion
  })
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`

  return new Promise((resolve, reject) => {
    let settled = false

    const win = new BrowserWindow({
      width:  520,
      height: 680,
      title:  'Connexion Google Calendar',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    const handleUrl = async (url: string) => {
      if (!url.startsWith('http://127.0.0.1:42813')) return
      if (settled) return
      settled = true
      win.close()

      const code = new URL(url).searchParams.get('code')
      if (!code) { reject(new Error('Code OAuth manquant')); return }

      try {
        const tok = await httpsPost(TOKEN_URL, {
          code,
          client_id:     clientId,
          client_secret: clientSecret,
          redirect_uri:  REDIRECT_URI,
          grant_type:    'authorization_code',
        })
        if (tok.error) throw new Error(tok.error_description || tok.error)

        const tokens: Tokens = {
          access_token:  tok.access_token,
          refresh_token: tok.refresh_token,
          expiry_date:   Date.now() + (tok.expires_in as number) * 1000,
        }

        // Récupère l'email pour l'affichage
        let email: string | undefined
        try {
          const info = await httpsReq('GET', 'https://www.googleapis.com/oauth2/v2/userinfo', tokens.access_token)
          email = info?.email
        } catch { /* non bloquant */ }

        saveConfig({
          client_id:     clientId,
          client_secret: clientSecret,
          calendar_id:   'primary',
          calendar_name: 'Calendrier principal',
          email,
          tokens,
        })
        resolve()
      } catch (e) { reject(e) }
    }

    win.webContents.on('will-redirect', (_e, url) => handleUrl(url))
    win.webContents.on('will-navigate',  (_e, url) => handleUrl(url))

    win.on('closed', () => {
      if (!settled) { settled = true; reject(new Error('Authentification annulée')) }
    })

    win.loadURL(authUrl)
  })
}

export function disconnect(): void {
  const p = configPath()
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

export async function listCalendars(): Promise<{ id: string; summary: string; primary?: boolean }[]> {
  const token = await getAccessToken()
  const res   = await httpsReq('GET', `${CALENDAR_BASE}/users/me/calendarList`, token)
  return (res?.items ?? []).map((c: any) => ({
    id:      c.id as string,
    summary: (c.summary as string) || 'Calendrier',
    primary: !!c.primary,
  }))
}

export function setCalendar(calendarId: string, calendarName: string): void {
  const cfg = loadConfig()
  if (!cfg) throw new Error('Non connecté')
  cfg.calendar_id   = calendarId
  cfg.calendar_name = calendarName
  saveConfig(cfg)
}

// ─── Sync RDV ─────────────────────────────────────────────────────────────────

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const total  = h * 60 + m + 60
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function makeEvent(appt: { date: string; heure_debut: string; heure_fin?: string | null; note?: string | null }) {
  const end = appt.heure_fin || addOneHour(appt.heure_debut)
  return {
    summary:     'Consultation',
    description: appt.note || '',
    start: { dateTime: `${appt.date}T${appt.heure_debut}:00`, timeZone: 'Europe/Paris' },
    end:   { dateTime: `${appt.date}T${end}:00`,              timeZone: 'Europe/Paris' },
  }
}

export async function createGCalEvent(appt: {
  date: string; heure_debut: string; heure_fin?: string | null; note?: string | null
}): Promise<string | null> {
  const cfg = loadConfig()
  if (!cfg?.tokens) return null
  try {
    const token = await getAccessToken()
    const calId = encodeURIComponent(cfg.calendar_id)
    const res   = await httpsReq('POST', `${CALENDAR_BASE}/calendars/${calId}/events`, token, makeEvent(appt))
    return (res?.id as string) || null
  } catch (e) {
    console.error('[GCal] createEvent:', e)
    return null
  }
}

export async function updateGCalEvent(eventId: string, appt: {
  date: string; heure_debut: string; heure_fin?: string | null; note?: string | null
}): Promise<void> {
  const cfg = loadConfig()
  if (!cfg?.tokens) return
  try {
    const token = await getAccessToken()
    const calId = encodeURIComponent(cfg.calendar_id)
    await httpsReq('PATCH', `${CALENDAR_BASE}/calendars/${calId}/events/${eventId}`, token, makeEvent(appt))
  } catch (e) {
    console.error('[GCal] updateEvent:', e)
  }
}

export async function deleteGCalEvent(eventId: string): Promise<void> {
  const cfg = loadConfig()
  if (!cfg?.tokens) return
  try {
    const token = await getAccessToken()
    const calId = encodeURIComponent(cfg.calendar_id)
    await httpsReq('DELETE', `${CALENDAR_BASE}/calendars/${calId}/events/${eventId}`, token)
  } catch (e) {
    console.error('[GCal] deleteEvent:', e)
  }
}
