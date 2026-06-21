/**
 * Service d'authentification et de chiffrement de la base SQLite.
 *
 * Fonctionnement :
 *   - Le mot de passe utilisateur est transformé en clé AES-256 via PBKDF2
 *     (600 000 itérations, SHA-256) avec un sel aléatoire de 32 octets.
 *   - Un "vérificateur" chiffré avec cette clé est stocké dans auth.json.
 *     Déchiffrer le vérificateur avec succès prouve que le mot de passe est correct.
 *   - La base SQLite (mtc.sqlite) est chiffrée avec AES-256-GCM au format
 *     IV_HEX\nTAG_HEX\nCT_HEX dans le fichier mtc.sqlite.enc.
 *   - Pendant la session, mtc.sqlite (déchiffré) est le fichier de travail.
 *   - À la fermeture, mtc.sqlite est rechiffré → mtc.sqlite.enc puis supprimé.
 */

import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'

const AUTH_MAGIC  = 'dossier-patient-mtc-auth-v1'
const PBKDF2_ITER = 600_000
const ALGORITHM   = 'aes-256-gcm'

let _key: Buffer | null = null

// ── Chemins ────────────────────────────────────────────────────────────────
export function authFilePath(): string {
  return join(app.getPath('userData'), 'auth.json')
}
export function dbPath(): string {
  return join(app.getPath('userData'), 'database', 'mtc.sqlite')
}
export function dbEncPath(): string {
  return join(app.getPath('userData'), 'database', 'mtc.sqlite.enc')
}

// ── Chiffrement AES-256-GCM ────────────────────────────────────────────────
function aesEncrypt(data: Buffer, key: Buffer): string {
  const iv     = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ct     = Buffer.concat([cipher.update(data), cipher.final()])
  const tag    = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), ct.toString('hex')].join('\n')
}

function aesDecrypt(payload: string, key: Buffer): Buffer {
  const parts = payload.trim().split('\n')
  if (parts.length !== 3) throw new Error('Format chiffré invalide')
  const [ivHex, tagHex, ctHex] = parts
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex, 'hex')),
    decipher.final(),
  ])
}

// ── Dérivation de clé ──────────────────────────────────────────────────────
function deriveKey(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITER, 32, 'sha256')
}

// ── API publique ───────────────────────────────────────────────────────────

/** Retourne true si un mot de passe a été configuré. */
export function hasPassword(): boolean {
  return existsSync(authFilePath())
}

/** Retourne la clé dérivée en mémoire (session active) ou null. */
export function getSessionKey(): Buffer | null {
  return _key
}

/** Retourne le sel PBKDF2 stocké dans auth.json (hex), ou null. */
export function getAuthSalt(): string | null {
  try {
    const path = authFilePath()
    if (!existsSync(path)) return null
    const auth = JSON.parse(readFileSync(path, 'utf8'))
    return typeof auth.salt === 'string' ? auth.salt : null
  } catch { return null }
}

/** Dérive une clé depuis un mot de passe et un sel (hex). */
export function deriveKeyFromPassword(password: string, saltHex: string): Buffer {
  return pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), PBKDF2_ITER, 32, 'sha256')
}

/** Retourne true si la clé dérivée est en mémoire (session active). */
export function isKeyLoaded(): boolean {
  return _key !== null
}

/**
 * Vérifie le mot de passe et charge la clé dérivée en mémoire.
 * Retourne false si le mot de passe est incorrect.
 */
export function verifyPassword(password: string): boolean {
  if (!existsSync(authFilePath())) return false
  try {
    const auth = JSON.parse(readFileSync(authFilePath(), 'utf8'))
    const salt = Buffer.from(auth.salt, 'hex')
    const key  = deriveKey(password, salt)
    const plain = aesDecrypt(auth.verifier, key)
    if (plain.toString() !== AUTH_MAGIC) return false
    _key = key
    return true
  } catch {
    return false
  }
}

/**
 * Configure un nouveau mot de passe (première fois ou changement).
 * Suppose que la clé actuelle est déjà en mémoire si changement.
 */
export function setupPassword(password: string): void {
  const salt     = randomBytes(32)
  const key      = deriveKey(password, salt)
  const verifier = aesEncrypt(Buffer.from(AUTH_MAGIC), key)
  writeFileSync(
    authFilePath(),
    JSON.stringify({ salt: salt.toString('hex'), verifier }),
    'utf8',
  )
  _key = key
}

/**
 * Chiffre mtc.sqlite → mtc.sqlite.enc avec la clé en mémoire.
 * Le fichier source n'est PAS supprimé (à faire explicitement après closeDatabase).
 */
export function encryptDb(): void {
  if (!_key) throw new Error('Non authentifié')
  const src = dbPath()
  if (!existsSync(src)) return
  mkdirSync(dirname(dbEncPath()), { recursive: true })
  writeFileSync(dbEncPath(), aesEncrypt(readFileSync(src), _key), 'utf8')
}

/**
 * Déchiffre mtc.sqlite.enc → mtc.sqlite avec la clé en mémoire.
 * Appeler uniquement après verifyPassword.
 */
export function decryptDb(): void {
  if (!_key) throw new Error('Non authentifié')
  const enc = dbEncPath()
  if (!existsSync(enc)) return  // pas encore de fichier enc (première mise en place)
  mkdirSync(dirname(dbPath()), { recursive: true })
  writeFileSync(dbPath(), aesDecrypt(readFileSync(enc, 'utf8'), _key))
}

/**
 * Supprime la clé dérivée de la mémoire (verrou de session).
 * La base reste ouverte mais aucune nouvelle clé ne peut être dérivée.
 */
export function clearKey(): void {
  _key = null
}

/**
 * Supprime le fichier de travail déchiffré (à appeler après closeDatabase).
 */
export function deleteWorkingDb(): void {
  const p = dbPath()
  if (existsSync(p)) unlinkSync(p)
}
