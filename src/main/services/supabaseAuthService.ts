import { createClient, SupabaseClient, Session as SupabaseSession, User } from '@supabase/supabase-js'
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { DeviceInfo, ReleaseCheckResult } from '../../shared/types'

// ── Config ──────────────────────────────────────────────────────────────────
// Injectées au build par vite.config.ts depuis .env.local (git-ignoré).
// SUPABASE_SERVICE_ROLE_KEY ne vit JAMAIS ici.

const SUPABASE_URL  = process.env.SUPABASE_URL  as string
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY as string

// ── Types publics ────────────────────────────────────────────────────────────

export interface AccountInfo {
  userId:    string
  email:     string
  createdAt: string
}

export interface SubscriptionInfo {
  status:             string
  currentPeriodEnd:   string | null
  cancelAtPeriodEnd:  boolean
  trialEnd:           string | null
  priceId:            string | null
}

export interface FullAccountState {
  isLoggedIn:  boolean
  account:     AccountInfo | null
  subscription: SubscriptionInfo | null
  licenseStatus: string
}

// ── Client Supabase ──────────────────────────────────────────────────────────
// Pas de localStorage en Electron — on persiste manuellement la session ci-dessous.

let _client: SupabaseClient | null = null
let _session: SupabaseSession | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    // Electron 28 embarque Node.js 20 qui n'expose pas WebSocket globalement.
    // ws est une dépendance transitive de @supabase/realtime-js — pas d'install supplémentaire.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WS = require('ws') as typeof WebSocket
    _client = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        persistSession:     false,
        autoRefreshToken:   true,
        detectSessionInUrl: false,
      },
      realtime: {
        transport: WS as any,
      },
    })
  }
  return _client
}

// ── Persistance de session dans userData ────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { getDeviceIdHash } from './licenseService'

function sessionFilePath(): string {
  const base = process.env.PORTABLE_EXECUTABLE_DIR
    ? join(process.env.PORTABLE_EXECUTABLE_DIR, 'data')
    : app.getPath('userData')
  return join(base, 'supabase.session.enc')
}

// ── Chiffrement de la session (AES-256-GCM, même pattern que licenseService) ──
// Clé dérivée du device_id_hash — le refresh_token ne transite jamais en clair sur disque.

function sessionDerivedKey(): Buffer {
  return createHash('sha256')
    .update('synoria-session-v1:' + getDeviceIdHash())
    .digest()
}

function encryptSession(json: string): string {
  const key    = sessionDerivedKey()
  const iv     = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct     = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), ct.toString('hex')].join('\n')
}

function decryptSession(stored: string): string {
  const [ivHex, tagHex, ctHex] = stored.split('\n')
  const key      = sessionDerivedKey()
  const iv       = Buffer.from(ivHex, 'hex')
  const tag      = Buffer.from(tagHex, 'hex')
  const ct       = Buffer.from(ctHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

function persistSession(session: SupabaseSession | null): void {
  try {
    writeFileSync(sessionFilePath(), encryptSession(JSON.stringify(session ?? null)), 'utf8')
  } catch { /* best-effort */ }
}

function loadPersistedSession(): SupabaseSession | null {
  try {
    const raw  = readFileSync(sessionFilePath(), 'utf8')
    const json = decryptSession(raw)
    return JSON.parse(json) as SupabaseSession
  } catch {
    // Fichier absent, corrompu, ou ancienne version en clair → re-login silencieux
    return null
  }
}

// ── Initialisation ───────────────────────────────────────────────────────────

export async function initSupabaseAuth(): Promise<void> {
  const client = getClient()
  const saved = loadPersistedSession()

  if (saved) {
    const { data, error } = await client.auth.setSession({
      access_token:  saved.access_token,
      refresh_token: saved.refresh_token,
    })
    if (!error && data.session) {
      _session = data.session
      persistSession(_session)
    } else {
      _session = null
      persistSession(null)
    }
  }

  client.auth.onAuthStateChange((_event, session) => {
    _session = session
    persistSession(session)
  })
}

// ── Authentification ─────────────────────────────────────────────────────────

export async function signUp(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await getClient().auth.signUp({ email, password })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('email address is already')) {
      return { ok: false, error: 'EMAIL_EXISTS' }
    }
    return { ok: false, error: error.message }
  }
  // Quand la confirmation email est activée, Supabase retourne ok sans error
  // mais data.user.identities === [] pour signaler que l'email est déjà utilisé
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, error: 'EMAIL_EXISTS' }
  }
  return { ok: true }
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: error.message }
  _session = data.session
  persistSession(_session)
  return { ok: true }
}

export async function signOut(): Promise<void> {
  await getClient().auth.signOut()
  _session = null
  persistSession(null)
}

export async function resetPassword(email: string): Promise<{ ok: boolean; error?: string }> {
  // L'email de reset Supabase redirige vers cette URL avec #access_token=...&type=recovery.
  // L'utilisateur atterrit sur la page abonnement qui lui indique de rouvrir l'application.
  const redirectTo = 'https://logiciel-synoria.fr/abonnement'
  const { error } = await getClient().auth.resetPasswordForEmail(email, { redirectTo })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Session courante ─────────────────────────────────────────────────────────

export function getCurrentSession(): SupabaseSession | null {
  return _session
}

export function getAccessToken(): string | null {
  return _session?.access_token ?? null
}

export function getCurrentUser(): User | null {
  return _session?.user ?? null
}

// ── Données compte & abonnement ──────────────────────────────────────────────

export async function getFullAccountState(): Promise<FullAccountState> {
  const user = getCurrentUser()
  if (!user) {
    return { isLoggedIn: false, account: null, subscription: null, licenseStatus: 'unknown' }
  }

  const client = getClient()

  const { data: subData } = await client
    .from('subscriptions')
    .select('status, current_period_end, cancel_at_period_end, trial_end, stripe_price_id')
    .single()

  const { data: licData } = await client
    .from('licenses')
    .select('status')
    .single()

  return {
    isLoggedIn: true,
    account: {
      userId:    user.id,
      email:     user.email ?? '',
      createdAt: user.created_at,
    },
    subscription: subData
      ? {
          status:            subData.status,
          currentPeriodEnd:  subData.current_period_end,
          cancelAtPeriodEnd: subData.cancel_at_period_end,
          trialEnd:          subData.trial_end,
          priceId:           subData.stripe_price_id,
        }
      : null,
    licenseStatus: licData?.status ?? 'restricted',
  }
}

// ── URL portail de facturation / checkout ────────────────────────────────────

export async function createCheckoutUrl(priceCode: string): Promise<string> {
  const token = getAccessToken()
  if (!token) throw new Error('Non connecté')

  const siteUrl = 'https://logiciel-synoria.fr'

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price_code:  priceCode,
      success_url: `${siteUrl}/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${siteUrl}/paiement-annule`,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error((err.message as string) ?? (err.error as string) ?? `HTTP ${res.status}`)
  }
  const { url } = await res.json() as { url: string }
  return url
}

export async function createBillingPortalUrl(): Promise<string> {
  const token = getAccessToken()
  if (!token) throw new Error('Non connecté')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-customer-portal-session`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ return_url: 'https://logiciel-synoria.fr/abonnement' }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error((err.message as string) ?? (err.error as string) ?? `HTTP ${res.status}`)
  }
  const { url } = await res.json() as { url: string }
  return url
}

// ── Désactivation d'un appareil ──────────────────────────────────────────────

export async function deactivateDevice(
  deviceId: string,
  reason: string = 'autre',
): Promise<{ activeDevices: DeviceInfo[]; deactivationsRemaining30d: number }> {
  const token = getAccessToken()
  if (!token) throw new Error('Non connecté')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/device-deactivate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, reason }),
  })

  const data = await res.json() as Record<string, unknown>

  if (!res.ok) {
    throw new Error((data['message'] as string) ?? (data['error'] as string) ?? `HTTP ${res.status}`)
  }

  const rawDevices = (data['active_devices'] as RawDevice[] | undefined) ?? []
  return {
    activeDevices:             rawDevices.map(normalizeDevice),
    deactivationsRemaining30d: (data['deactivations_remaining_30_days'] as number) ?? 0,
  }
}

// ── Types internes ───────────────────────────────────────────────────────────

interface RawDevice {
  id:           string
  label:        string | null
  platform:     string | null
  app_version:  string | null
  is_active:    boolean
  last_seen_at: string
  first_seen_at: string
}

function normalizeDevice(d: RawDevice): DeviceInfo {
  return {
    id:           d.id,
    label:        d.label        ?? 'Appareil inconnu',
    platform:     d.platform     ?? 'unknown',
    app_version:  d.app_version  ?? '',
    is_active:    d.is_active,
    last_seen_at: d.last_seen_at,
    first_seen_at: d.first_seen_at,
  }
}

// ── Vérification de mise à jour ──────────────────────────────────────────────

export async function checkRelease(currentVersion: string): Promise<ReleaseCheckResult | null> {
  const token = getAccessToken()
  if (!token) return null  // Non connecté → pas de vérification

  const platform = getPlatformName()

  const res = await fetch(`${SUPABASE_URL}/functions/v1/release-check`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, current_version: currentVersion, channel: 'stable' }),
  })

  if (!res.ok) return null  // Erreur réseau ou serveur → on ignore silencieusement

  return res.json() as Promise<ReleaseCheckResult>
}

function getPlatformName(): 'windows' | 'macos' | 'linux' {
  switch (process.platform) {
    case 'win32':  return 'windows'
    case 'darwin': return 'macos'
    default:       return 'linux'
  }
}

// ── Appareils enregistrés ────────────────────────────────────────────────────

export async function getDevices(): Promise<DeviceInfo[]> {
  const client = getClient()
  const { data, error } = await client
    .from('devices')
    .select('id, label, platform, app_version, is_active, last_seen_at, first_seen_at')
    .eq('is_active', true)
    .order('last_seen_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(normalizeDevice)
}
