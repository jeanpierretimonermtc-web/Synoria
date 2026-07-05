import { createHash, createHmac, randomUUID, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { saveLastSuccessfulCheck, saveClockCheckData } from './localLicenseStore'

// ── Types ──────────────────────────────────────────────────────────────────

export type LicenseStatus = 'active' | 'trialing' | 'past_due_grace' | 'restricted' | 'unknown'

export interface LicenseTokenPayload {
  iss:  string
  sub:  string          // organization_id (JWT subject)
  iat:  number
  exp:  number
  // Champs Synoria (license-check v2)
  uid:  string          // user_id
  oid:  string          // organization_id
  lid:  string          // license_id
  duid: string          // device UUID (devices.id)
  did:  string          // device_id_hash — utilisé pour vérification locale
  pln:  string          // plan_code (synoria_annual | synoria_6_months)
  sta:  LicenseStatus
  mod:  'full' | 'restricted'
  fts:  string[]        // features accordées
  mxd:  number          // max_active_devices
  grc:  string | null   // grace_until ISO
}

export interface LicenseState {
  status:         LicenseStatus
  mode:           'full' | 'restricted'
  organizationId: string | null
  licenseId:      string | null
  deviceId:       string | null   // devices.id UUID (pour identifier l'appareil courant)
  planCode:       string | null
  features:       string[]
  maxDevices:     number
  graceUntil:     Date | null
  tokenExpiry:    Date | null
  isOffline:      boolean
}

// ── Constantes ─────────────────────────────────────────────────────────────

// Clé publique Ed25519 (PEM SubjectPublicKeyInfo) — injectée au build via vite.config.ts.
// Valeur dans .env.local → LICENSE_PUBLIC_KEY (git-ignoré).
// La clé privée correspondante est dans les secrets Supabase de la Edge Function license-check.
const LICENSE_PUBLIC_KEY_PEM = process.env.LICENSE_PUBLIC_KEY as string
if (!LICENSE_PUBLIC_KEY_PEM) {
  throw new Error('[licenseService] LICENSE_PUBLIC_KEY non défini au build. Créer .env.local avec la vraie clé publique Ed25519.')
}

// Tolérance maximale d'avance d'horloge locale vs timestamp du jeton (5 min)
const CLOCK_SKEW_TOLERANCE_SEC = 5 * 60

const TOKEN_FILENAME   = 'license.token.enc'
const DEVICE_ID_FILENAME = 'device.id'

// ── Utilitaires chemin ─────────────────────────────────────────────────────

function getUserDataPath(): string {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return join(process.env.PORTABLE_EXECUTABLE_DIR, 'data')
  }
  return app.getPath('userData')
}

function tokenPath(): string  { return join(getUserDataPath(), TOKEN_FILENAME) }
function deviceIdPath(): string { return join(getUserDataPath(), DEVICE_ID_FILENAME) }

// ── Device ID ──────────────────────────────────────────────────────────────

// Crée ou lit un UUID persistant, puis en dérive un hash non-réversible.
// Pas d'identifiant matériel brut pour limiter l'empreinte de données.
export function getDeviceIdHash(): string {
  const idFile = deviceIdPath()
  let rawId: string

  if (existsSync(idFile)) {
    rawId = readFileSync(idFile, 'utf8').trim()
  } else {
    rawId = randomUUID()
    const dir = getUserDataPath()
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(idFile, rawId, 'utf8')
  }

  // HMAC-SHA256 avec un sel applicatif fixe — le résultat identifie l'appareil
  // sans révéler le UUID brut côté serveur
  return createHmac('sha256', 'synoria-device-id-v1')
    .update(rawId)
    .digest('hex')
}

// ── Chiffrement du jeton local ─────────────────────────────────────────────
// AES-256-GCM, clé dérivée du device_id_hash (pas du mot de passe utilisateur)

function getDerivedKey(deviceIdHash: string): Buffer {
  return createHash('sha256').update('synoria-license-key-v1:' + deviceIdHash).digest()
}

function encryptToken(jwt: string, deviceIdHash: string): string {
  const key  = getDerivedKey(deviceIdHash)
  const iv   = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct   = Buffer.concat([cipher.update(jwt, 'utf8'), cipher.final()])
  const tag  = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), ct.toString('hex')].join('\n')
}

function decryptToken(stored: string, deviceIdHash: string): string {
  const [ivHex, tagHex, ctHex] = stored.split('\n')
  const key    = getDerivedKey(deviceIdHash)
  const iv     = Buffer.from(ivHex, 'hex')
  const tag    = Buffer.from(tagHex, 'hex')
  const ct     = Buffer.from(ctHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

// ── Persistance du jeton ───────────────────────────────────────────────────

export function saveToken(jwt: string): void {
  const deviceIdHash = getDeviceIdHash()
  const encrypted = encryptToken(jwt, deviceIdHash)
  writeFileSync(tokenPath(), encrypted, 'utf8')
}

export function loadToken(): string | null {
  const path = tokenPath()
  if (!existsSync(path)) return null
  try {
    const stored = readFileSync(path, 'utf8')
    const deviceIdHash = getDeviceIdHash()
    return decryptToken(stored, deviceIdHash)
  } catch {
    return null
  }
}

export function clearToken(): void {
  const path = tokenPath()
  if (existsSync(path)) {
    // Écraser avec des zéros avant de supprimer (best-effort)
    writeFileSync(path, '0'.repeat(256), 'utf8')
    writeFileSync(path, '', 'utf8')
  }
}

// ── Vérification de signature Ed25519 ─────────────────────────────────────

export function verifyJwtSignature(jwt: string): boolean {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return false

    const [headerB64, payloadB64, signatureB64] = parts
    const signingInput = `${headerB64}.${payloadB64}`

    const publicKey = LICENSE_PUBLIC_KEY_PEM
    const signature = Buffer.from(fromBase64url(signatureB64), 'base64')
    const data      = Buffer.from(signingInput)

    // crypto.verify avec Ed25519 natif (Node.js 18+ / Electron 28+)
    return (require('node:crypto') as typeof import('node:crypto')).verify(
      null,
      data,
      { key: publicKey, format: 'pem', type: 'spki' },
      signature,
    )
  } catch {
    return false
  }
}

function fromBase64url(b64url: string): string {
  return b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b64url.length % 4) % 4)
}

// ── Décodage du payload ────────────────────────────────────────────────────

function decodePayload(jwt: string): LicenseTokenPayload | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const json = Buffer.from(fromBase64url(parts[1]), 'base64').toString('utf8')
    return JSON.parse(json) as LicenseTokenPayload
  } catch {
    return null
  }
}

// ── Validation du jeton local ──────────────────────────────────────────────

export interface TokenValidationResult {
  valid: boolean
  payload: LicenseTokenPayload | null
  reason?: 'invalid_signature' | 'expired' | 'wrong_device' | 'clock_skew' | 'malformed'
}

export function validateLocalToken(jwt: string): TokenValidationResult {
  if (!verifyJwtSignature(jwt)) {
    return { valid: false, payload: null, reason: 'invalid_signature' }
  }

  const payload = decodePayload(jwt)
  if (!payload) {
    return { valid: false, payload: null, reason: 'malformed' }
  }

  const nowSec = Math.floor(Date.now() / 1000)

  // Détection de recul d'horloge : iat ne doit pas être dans le futur (tolérance 5 min)
  if (payload.iat > nowSec + CLOCK_SKEW_TOLERANCE_SEC) {
    return { valid: false, payload, reason: 'clock_skew' }
  }

  if (payload.exp < nowSec) {
    return { valid: false, payload, reason: 'expired' }
  }

  // Vérifier que ce jeton est bien pour cet appareil
  const deviceIdHash = getDeviceIdHash()
  if (payload.did !== deviceIdHash) {
    return { valid: false, payload, reason: 'wrong_device' }
  }

  return { valid: true, payload }
}

// ── État de licence courant ────────────────────────────────────────────────

export function getCurrentLicenseState(): LicenseState {
  const jwt = loadToken()
  if (!jwt) {
    return {
      status: 'unknown', mode: 'restricted',
      organizationId: null, licenseId: null, deviceId: null, planCode: null,
      features: [], maxDevices: 2, graceUntil: null, tokenExpiry: null, isOffline: true,
    }
  }

  const result = validateLocalToken(jwt)
  if (!result.valid || !result.payload) {
    return {
      status: 'restricted', mode: 'restricted',
      organizationId: null, licenseId: null, deviceId: null, planCode: null,
      features: [], maxDevices: 2, graceUntil: null, tokenExpiry: null, isOffline: true,
    }
  }

  const p = result.payload

  // Enregistrer l'empreinte d'horloge à chaque lecture de jeton valide
  saveClockCheckData()

  return {
    status:         p.sta,
    mode:           p.mod ?? (p.sta === 'active' || p.sta === 'trialing' ? 'full' : 'restricted'),
    organizationId: p.oid ?? p.sub,
    licenseId:      p.lid,
    deviceId:       p.duid ?? null,
    planCode:       p.pln ?? null,
    features:       p.fts ?? [],
    maxDevices:     p.mxd,
    graceUntil:     p.grc ? new Date(p.grc) : null,
    tokenExpiry:    new Date(p.exp * 1000),
    isOffline:      false,
  }
}

// ── Vérification en ligne (appelée par le scheduler) ──────────────────────

export async function verifyLicenseOnline(supabaseAccessToken: string): Promise<LicenseState> {
  const supabaseUrl = process.env.SUPABASE_URL as string

  const deviceIdHash = getDeviceIdHash()
  const os = require('node:os') as typeof import('node:os')

  const response = await fetch(`${supabaseUrl}/functions/v1/license-check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAccessToken}`,
    },
    body: JSON.stringify({
      device_id_hash: deviceIdHash,
      device_name:    os.hostname(),
      platform:       getPlatform(),
      os_version:     `${os.type()} ${os.release()}`,
      app_version:    require('electron').app.getVersion(),
    }),
  })

  const data = await response.json() as Record<string, unknown>

  if (!response.ok) {
    if (response.status === 403 && data['reason'] === 'device_limit_exceeded') {
      throw new DeviceLimitError(
        data['message'] as string,
        data['max_active_devices'] as number ?? 2,
      )
    }
    throw new Error(
      `license-check: ${response.status} — ${(data['reason'] as string) ?? (data['error'] as string) ?? response.statusText}`,
    )
  }

  // Réponse de restriction sans jeton (allowed=false)
  if (!data['allowed']) {
    clearToken()
    return {
      status: 'restricted', mode: 'restricted',
      organizationId: null, licenseId: null, deviceId: null, planCode: null,
      features: [], maxDevices: 2, graceUntil: null, tokenExpiry: null, isOffline: false,
    }
  }

  // Réponse OK : sauvegarder le jeton offline et lire l'état depuis le jeton
  const token = data['license_token'] as string | undefined
  if (token) {
    saveToken(token)
  }

  const state = getCurrentLicenseState()
  _cachedState = state

  // Mémoriser le dernier contrôle réussi et l'empreinte d'horloge
  saveLastSuccessfulCheck(state.status)
  saveClockCheckData()

  return state
}

function getPlatform(): 'windows' | 'macos' | 'linux' | 'unknown' {
  switch (process.platform) {
    case 'win32':  return 'windows'
    case 'darwin': return 'macos'
    case 'linux':  return 'linux'
    default:       return 'unknown'
  }
}

export class DeviceLimitError extends Error {
  constructor(message: string, public readonly maxDevices: number) {
    super(message)
    this.name = 'DeviceLimitError'
  }
}

// ── Guard mode restreint ───────────────────────────────────────────────────

let _cachedState: LicenseState | null = null

export function setCachedLicenseState(state: LicenseState): void {
  _cachedState = state
}

export function isWriteAllowed(): boolean {
  if (!_cachedState) {
    // Si l'état n'est pas encore chargé, vérifier le jeton local
    const state = getCurrentLicenseState()
    _cachedState = state
  }
  return _cachedState.status !== 'restricted' && _cachedState.status !== 'unknown'
}

export function assertNotRestricted(): void {
  if (!isWriteAllowed()) {
    throw new Error('mode_restreint: cette action nécessite un abonnement actif.')
  }
}

export function getCachedLicenseState(): LicenseState {
  if (!_cachedState) {
    _cachedState = getCurrentLicenseState()
  }
  return _cachedState
}
