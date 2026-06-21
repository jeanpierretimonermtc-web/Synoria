import { app, shell } from 'electron'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import type { Session } from '../../shared/types'

const REDIRECT_HOST = '127.0.0.1'
const REDIRECT_PATH = '/oauth2callback'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

const SYNORIA_CALENDAR_NAME = 'Synoria'
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

interface Tokens {
  access_token: string
  refresh_token: string
  expiry_date: number
}

interface GCalConfig {
  client_id: string
  client_secret: string
  calendar_id: string
  calendar_name: string
  import_calendars?: GCalImportCalendar[]
  email?: string
  tokens?: Tokens
}

interface CalendarListEntry {
  id: string
  summary: string
  primary?: boolean
  deleted?: boolean
}

export interface GCalImportCalendar {
  id: string
  summary: string
  color?: string
}

const EXTERNAL_EVENT_PREFIX = 'gcalExternal:'

function configPath(): string {
  return path.join(app.getPath('userData'), 'google_calendar.json')
}

function loadConfig(): GCalConfig | null {
  try {
    const p = configPath()
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, 'utf8')) as GCalConfig
  } catch {
    return null
  }
}

function saveConfig(cfg: GCalConfig): void {
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf8')
}

function googleErrorMessage(payload: any): string | null {
  if (!payload) return null
  if (typeof payload.error === 'string') {
    return payload.error_description || payload.error
  }
  if (payload.error?.message) return payload.error.message
  if (payload.error?.status) return payload.error.status
  return null
}

function formatGoogleError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  if (
    message.includes('insufficient') ||
    message.includes('Insufficient') ||
    message.includes('forbidden') ||
    message.includes('Forbidden')
  ) {
    return new Error(
      'Autorisation Google insuffisante. Deconnectez puis reconnectez Google Calendar dans Synoria pour accepter les nouveaux droits.'
    )
  }
  return error instanceof Error ? error : new Error(message)
}

function httpsPostForm(url: string, body: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString()
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
      },
    }, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        try {
          const parsed = raw ? JSON.parse(raw) : null
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(googleErrorMessage(parsed) || `Google HTTP ${res.statusCode}`))
            return
          }
          resolve(parsed)
        } catch {
          reject(new Error(`JSON parse error: ${raw.slice(0, 200)}`))
        }
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
    const u = new URL(url)
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }, res => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        if (res.statusCode === 204 || !raw) {
          if ((res.statusCode ?? 500) >= 400) reject(new Error(`Google HTTP ${res.statusCode}`))
          else resolve(null)
          return
        }
        try {
          const parsed = JSON.parse(raw)
          if ((res.statusCode ?? 500) >= 400 || parsed?.error) {
            reject(new Error(googleErrorMessage(parsed) || `Google HTTP ${res.statusCode}`))
            return
          }
          resolve(parsed)
        } catch {
          reject(new Error(`JSON parse error: ${raw.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

async function getAccessToken(): Promise<string> {
  const cfg = loadConfig()
  if (!cfg?.tokens?.refresh_token) throw new Error('Non connecte a Google Calendar')

  if (cfg.tokens.expiry_date > Date.now() + 60_000) {
    return cfg.tokens.access_token
  }

  const res = await httpsPostForm(TOKEN_URL, {
    client_id: cfg.client_id,
    client_secret: cfg.client_secret,
    refresh_token: cfg.tokens.refresh_token,
    grant_type: 'refresh_token',
  })

  cfg.tokens.access_token = res.access_token
  cfg.tokens.expiry_date = Date.now() + (res.expires_in as number) * 1000
  saveConfig(cfg)
  return res.access_token
}

async function ensureSynoriaCalendar(tokenOverride?: string): Promise<GCalConfig> {
  const cfg = loadConfig()
  if (!cfg?.tokens) throw new Error('Non connecte a Google Calendar')

  try {
    const token = tokenOverride || await getAccessToken()
    const list = await httpsReq('GET', `${CALENDAR_BASE}/users/me/calendarList`, token)
    const calendars = (list?.items ?? []) as CalendarListEntry[]
    const existing = calendars.find(c =>
      !c.deleted && c.summary.trim().toLowerCase() === SYNORIA_CALENDAR_NAME.toLowerCase()
    )

    let calendarId = existing?.id
    if (!calendarId) {
      const created = await httpsReq('POST', `${CALENDAR_BASE}/calendars`, token, {
        summary: SYNORIA_CALENDAR_NAME,
        description: 'Calendrier cree automatiquement par Synoria pour les consultations.',
        timeZone: 'Europe/Paris',
      })
      calendarId = created?.id as string | undefined
    }

    if (!calendarId) throw new Error('Impossible de creer le calendrier Synoria')

    cfg.calendar_id = calendarId
    cfg.calendar_name = SYNORIA_CALENDAR_NAME
    saveConfig(cfg)
    return cfg
  } catch (e) {
    throw formatGoogleError(e)
  }
}

export function getStatus() {
  const cfg = loadConfig()
  return {
    connected: !!(cfg?.tokens?.refresh_token),
    email: cfg?.email,
    calendarId: cfg?.calendar_id,
    calendarName: cfg?.calendar_name,
    importCalendars: cfg?.import_calendars ?? [],
  }
}

export async function connect(clientId: string, clientSecret: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    let server: http.Server | null = null

    const finish = (err?: unknown) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      if (server) server.close()
      if (err) reject(formatGoogleError(err))
      else resolve()
    }

    server = http.createServer((req, res) => {
      const requestUrl = new URL(req.url || '/', `http://${req.headers.host || REDIRECT_HOST}`)
      if (requestUrl.pathname !== REDIRECT_PATH) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Not found')
        return
      }

      const oauthError = requestUrl.searchParams.get('error')
      if (oauthError) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h2>Connexion Google Calendar annulee</h2><p>Vous pouvez fermer cette fenetre.</p>')
        finish(new Error(requestUrl.searchParams.get('error_description') || oauthError))
        return
      }

      const code = requestUrl.searchParams.get('code')
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<h2>Code OAuth manquant</h2><p>Vous pouvez fermer cette fenetre.</p>')
        finish(new Error('Code OAuth manquant'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h2>Connexion Google Calendar reussie</h2><p>Vous pouvez fermer cette fenetre et revenir dans Synoria.</p>')

      const address = server?.address()
      const port = typeof address === 'object' && address ? address.port : null
      const redirectUri = port ? `http://${REDIRECT_HOST}:${port}${REDIRECT_PATH}` : ''

      ;(async () => {
        const tok = await httpsPostForm(TOKEN_URL, {
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        })

        const tokens: Tokens = {
          access_token: tok.access_token,
          refresh_token: tok.refresh_token,
          expiry_date: Date.now() + (tok.expires_in as number) * 1000,
        }

        let email: string | undefined
        try {
          const info = await httpsReq('GET', 'https://www.googleapis.com/oauth2/v2/userinfo', tokens.access_token)
          email = info?.email
        } catch {
          // Non blocking.
        }

        saveConfig({
          client_id: clientId,
          client_secret: clientSecret,
          calendar_id: 'primary',
          calendar_name: 'Calendrier principal',
          import_calendars: [],
          email,
          tokens,
        })

        await ensureSynoriaCalendar(tokens.access_token)
        finish()
      })().catch(finish)
    })

    server.on('error', finish)
    server.listen(0, REDIRECT_HOST, async () => {
      const address = server?.address()
      const port = typeof address === 'object' && address ? address.port : null
      if (!port) {
        finish(new Error('Impossible de demarrer le serveur OAuth local'))
        return
      }

      const redirectUri = `http://${REDIRECT_HOST}:${port}${REDIRECT_PATH}`
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
      })

      try {
        await shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
      } catch (e) {
        finish(e)
      }
    })

    timeout = setTimeout(() => {
      finish(new Error('Authentification Google annulee ou expiree'))
    }, 3 * 60 * 1000)
  })
}

export function disconnect(): void {
  const p = configPath()
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

export async function listCalendars(): Promise<{ id: string; summary: string; primary?: boolean; color?: string }[]> {
  const token = await getAccessToken()
  const res = await httpsReq('GET', `${CALENDAR_BASE}/users/me/calendarList`, token)
  return (res?.items ?? []).map((c: any) => ({
    id: c.id as string,
    summary: (c.summary as string) || 'Calendrier',
    primary: !!c.primary,
    color: c.backgroundColor as string | undefined,
  }))
}

export function setCalendar(calendarId: string, calendarName: string): void {
  const cfg = loadConfig()
  if (!cfg) throw new Error('Non connecte')
  cfg.calendar_id = calendarId
  cfg.calendar_name = calendarName
  saveConfig(cfg)
}

export function setImportCalendars(calendars: GCalImportCalendar[]): void {
  const cfg = loadConfig()
  if (!cfg) throw new Error('Non connecte')
  const existing = new Map((cfg.import_calendars ?? []).map(cal => [cal.id, cal.color]))
  cfg.import_calendars = calendars
    .filter(cal => !!cal.id)
    .map(cal => ({
      id: cal.id,
      summary: cal.summary || 'Calendrier',
      color: cal.color || existing.get(cal.id) || '#2A5A8A',
    }))
  saveConfig(cfg)
}

export function isExternalGCalEventId(eventId?: string | null): boolean {
  return !!eventId?.startsWith(EXTERNAL_EVENT_PREFIX)
}

export function isSelectedImportGCalEventId(eventId?: string | null): boolean {
  if (!isExternalGCalEventId(eventId)) return false
  const cfg = loadConfig()
  const encodedCalendarId = eventId!.slice(EXTERNAL_EVENT_PREFIX.length).split(':')[0]
  return (cfg?.import_calendars ?? []).some(cal => encodeURIComponent(cal.id) === encodedCalendarId)
}

function storageEventId(calendarId: string, eventId: string, ownCalendarId: string): string {
  if (calendarId === ownCalendarId) return eventId
  return `${EXTERNAL_EVENT_PREFIX}${encodeURIComponent(calendarId)}:${eventId}`
}

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + 60
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function addOneDay(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function makeEvent(appt: { date: string; heure_debut: string; heure_fin?: string | null; note?: string | null }) {
  const end = appt.heure_fin || addOneHour(appt.heure_debut)
  return {
    summary: 'Consultation',
    description: appt.note || '',
    start: { dateTime: `${appt.date}T${appt.heure_debut}:00`, timeZone: 'Europe/Paris' },
    end: { dateTime: `${appt.date}T${end}:00`, timeZone: 'Europe/Paris' },
  }
}

function makeSessionEvent(session: Pick<Session, 'id' | 'date' | 'motif'>) {
  return {
    summary: 'Consultation',
    description: '',
    start: { date: session.date },
    end: { date: addOneDay(session.date) },
    extendedProperties: {
      private: {
        synoriaType: 'session',
        synoriaSessionId: session.id,
      },
    },
  }
}

async function findEventByPrivateProperty(token: string, calendarId: string, key: string, value: string): Promise<string | null> {
  const calId = encodeURIComponent(calendarId)
  const params = new URLSearchParams({
    privateExtendedProperty: `${key}=${value}`,
    showDeleted: 'false',
    singleEvents: 'false',
    maxResults: '1',
  })
  const res = await httpsReq('GET', `${CALENDAR_BASE}/calendars/${calId}/events?${params}`, token)
  const item = (res?.items ?? []).find((e: any) => e.status !== 'cancelled')
  return item?.id || null
}

export async function createGCalEvent(appt: {
  date: string; heure_debut: string; heure_fin?: string | null; note?: string | null
}): Promise<string | null> {
  const cfg = loadConfig()
  if (!cfg?.tokens) return null
  const ensured = await ensureSynoriaCalendar()
  const token = await getAccessToken()
  const calId = encodeURIComponent(ensured.calendar_id)
  const res = await httpsReq('POST', `${CALENDAR_BASE}/calendars/${calId}/events`, token, makeEvent(appt))
  return (res?.id as string) || null
}

export async function updateGCalEvent(eventId: string, appt: {
  date: string; heure_debut: string; heure_fin?: string | null; note?: string | null
}): Promise<boolean> {
  const cfg = loadConfig()
  if (!cfg?.tokens) return false
  try {
    const ensured = await ensureSynoriaCalendar()
    const token = await getAccessToken()
    const calId = encodeURIComponent(ensured.calendar_id)
    await httpsReq('PATCH', `${CALENDAR_BASE}/calendars/${calId}/events/${eventId}`, token, makeEvent(appt))
    return true
  } catch (e) {
    console.error('[GCal] updateEvent:', e)
    return false
  }
}

export async function deleteGCalEvent(eventId: string): Promise<void> {
  const cfg = loadConfig()
  if (!cfg?.tokens) return
  try {
    const ensured = await ensureSynoriaCalendar()
    const token = await getAccessToken()
    const calId = encodeURIComponent(ensured.calendar_id)
    await httpsReq('DELETE', `${CALENDAR_BASE}/calendars/${calId}/events/${eventId}`, token)
  } catch (e) {
    console.error('[GCal] deleteEvent:', e)
  }
}

export async function syncSessionToGCal(session: Pick<Session, 'id' | 'date' | 'motif'>): Promise<'created' | 'updated' | null> {
  const cfg = loadConfig()
  if (!cfg?.tokens || !session.date) return null

  const ensured = await ensureSynoriaCalendar()
  const token = await getAccessToken()
  const calId = encodeURIComponent(ensured.calendar_id)
  const body = makeSessionEvent(session)
  const existingId = await findEventByPrivateProperty(token, ensured.calendar_id, 'synoriaSessionId', session.id)

  if (existingId) {
    await httpsReq('PATCH', `${CALENDAR_BASE}/calendars/${calId}/events/${existingId}`, token, body)
    return 'updated'
  }

  await httpsReq('POST', `${CALENDAR_BASE}/calendars/${calId}/events`, token, body)
  return 'created'
}

export interface GCalEvent {
  id: string
  summary: string
  description: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  status: string
  calendarId?: string
  calendarSummary?: string
  storageId?: string
}

export async function listGCalEvents(timeMin: string, timeMax: string): Promise<GCalEvent[]> {
  const cfg = loadConfig()
  if (!cfg?.tokens) throw new Error('Non connecte a Google Calendar')
  const ensured = await ensureSynoriaCalendar()
  const token = await getAccessToken()
  const calId = encodeURIComponent(ensured.calendar_id)
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '500',
  })
  const res = await httpsReq('GET', `${CALENDAR_BASE}/calendars/${calId}/events?${params}`, token)
  return ((res?.items ?? []) as GCalEvent[])
    .filter(e => e.status !== 'cancelled')
    .map(e => ({
      ...e,
      calendarId: ensured.calendar_id,
      calendarSummary: ensured.calendar_name,
      storageId: e.id,
    }))
}

export async function listSelectedImportEvents(timeMin: string, timeMax: string): Promise<GCalEvent[]> {
  const cfg = loadConfig()
  if (!cfg?.tokens) throw new Error('Non connecte a Google Calendar')
  const ensured = await ensureSynoriaCalendar()
  const token = await getAccessToken()
  const calendars = [
    { id: ensured.calendar_id, summary: ensured.calendar_name },
    ...(cfg.import_calendars ?? []),
  ]
  const unique = calendars.filter((cal, index, arr) => arr.findIndex(c => c.id === cal.id) === index)
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '500',
  })

  const all: GCalEvent[] = []
  for (const cal of unique) {
    const calId = encodeURIComponent(cal.id)
    const res = await httpsReq('GET', `${CALENDAR_BASE}/calendars/${calId}/events?${params}`, token)
    const items = ((res?.items ?? []) as GCalEvent[])
      .filter(e => e.status !== 'cancelled')
      .map(e => ({
        ...e,
        calendarId: cal.id,
        calendarSummary: cal.summary,
        storageId: storageEventId(cal.id, e.id, ensured.calendar_id),
      }))
    all.push(...items)
  }
  return all
}
