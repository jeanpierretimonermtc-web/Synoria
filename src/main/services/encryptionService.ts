/**
 * Service de chiffrement AES-256-GCM
 *
 * Clé de 32 octets aléatoires générée au premier lancement,
 * stockée dans userData/encryption.key (accès protégé par l'OS).
 *
 * Format d'un fichier .json.enc :
 *   IV_HEX (32 car.) + '\n' + AUTHTAG_HEX (32 car.) + '\n' + DATA_HEX
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const ALGORITHM = 'aes-256-gcm'

function keyPath(): string {
  return join(app.getPath('userData'), 'encryption.key')
}

/** Récupère ou génère la clé de chiffrement */
export function getOrCreateKey(): Buffer {
  const p = keyPath()
  if (existsSync(p)) {
    const hex = readFileSync(p, 'utf-8').trim()
    if (hex.length === 64) return Buffer.from(hex, 'hex')   // 32 octets
  }
  const key = randomBytes(32)
  writeFileSync(p, key.toString('hex'), 'utf-8')
  return key
}

/** Chiffre une chaîne et l'écrit dans un fichier (format v2, clé machine) */
export function encryptToFile(plaintext: string, outputPath: string): void {
  const key = getOrCreateKey()
  const iv  = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join('\n')
  writeFileSync(outputPath, payload, 'utf-8')
}

/**
 * Chiffre avec la clé de session (PBKDF2 du mot de passe utilisateur).
 * Format v3 : "V3\n<auth_salt_hex>\n<iv_hex>\n<tag_hex>\n<data_hex>"
 * Le sel PBKDF2 est embarqué → importable sur n'importe quelle machine
 * en connaissant uniquement le mot de passe Synoria.
 */
export function encryptToFileV3(plaintext: string, outputPath: string, sessionKey: Buffer, authSaltHex: string): void {
  const iv     = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, sessionKey, iv)
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag    = cipher.getAuthTag()
  const payload = ['V3', authSaltHex, iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join('\n')
  writeFileSync(outputPath, payload, 'utf-8')
}

/** Détecte si un fichier .enc est au format v3 (mot de passe) */
export function isV3Format(inputPath: string): boolean {
  try {
    const firstLine = readFileSync(inputPath, 'utf-8').split('\n')[0].trim()
    return firstLine === 'V3'
  } catch { return false }
}

/** Retourne le sel embarqué dans un fichier v3 */
export function getV3Salt(inputPath: string): string {
  const parts = readFileSync(inputPath, 'utf-8').trim().split('\n')
  if (parts[0] !== 'V3' || parts.length !== 5) throw new Error('Format v3 invalide')
  return parts[1]
}

/** Déchiffre un fichier v3 avec une clé dérivée du mot de passe */
export function decryptFromFileV3(inputPath: string, derivedKey: Buffer): string {
  const parts = readFileSync(inputPath, 'utf-8').trim().split('\n')
  if (parts[0] !== 'V3' || parts.length !== 5) throw new Error('Format v3 invalide')
  const [, , ivHex, tagHex, encHex] = parts
  const decipher = createDecipheriv(ALGORITHM, derivedKey, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  try {
    return decipher.update(Buffer.from(encHex, 'hex')).toString('utf-8') + decipher.final('utf-8')
  } catch {
    throw new Error('WRONG_PASSWORD:Mot de passe incorrect ou fichier corrompu.')
  }
}

/** Lit et déchiffre un fichier .json.enc avec la clé locale ou une clé fournie */
export function decryptFromFile(inputPath: string, customKeyPath?: string): string {
  let key: Buffer
  if (customKeyPath) {
    const hex = readFileSync(customKeyPath, 'utf-8').trim()
    if (hex.length !== 64) throw new Error('Fichier encryption.key invalide (doit contenir 64 caractères hexadécimaux)')
    key = Buffer.from(hex, 'hex')
  } else {
    key = getOrCreateKey()
  }
  const payload = readFileSync(inputPath, 'utf-8').trim()
  const parts   = payload.split('\n')
  if (parts.length !== 3) throw new Error('Fichier chiffré corrompu ou format invalide')
  const [ivHex, tagHex, encHex] = parts
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  try {
    return decipher.update(Buffer.from(encHex, 'hex')).toString('utf-8') + decipher.final('utf-8')
  } catch (e: any) {
    if (e.message?.includes('Unsupported state') || e.message?.includes('unable to authenticate')) {
      throw new Error(
        'WRONG_KEY:La clé de chiffrement ne correspond pas à cette sauvegarde. ' +
        'Si la sauvegarde a été créée sur une autre machine, vous devez fournir le fichier encryption.key de cette machine.'
      )
    }
    throw e
  }
}
