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

/** Chiffre une chaîne et l'écrit dans un fichier */
export function encryptToFile(plaintext: string, outputPath: string): void {
  const key = getOrCreateKey()
  const iv  = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload = [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join('\n')
  writeFileSync(outputPath, payload, 'utf-8')
}

/** Lit et déchiffre un fichier .json.enc */
export function decryptFromFile(inputPath: string): string {
  const key = getOrCreateKey()
  const payload = readFileSync(inputPath, 'utf-8').trim()
  const parts = payload.split('\n')
  if (parts.length !== 3) throw new Error('Fichier chiffré corrompu ou format invalide')
  const [ivHex, tagHex, encHex] = parts
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(encHex, 'hex')).toString('utf-8') + decipher.final('utf-8')
}
