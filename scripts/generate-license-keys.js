#!/usr/bin/env node
/**
 * Génère une paire de clés Ed25519 pour le système de licence Synoria.
 *
 * Usage :
 *   node scripts/generate-license-keys.js
 *
 * Résultat :
 *   - Affiche la clé privée (à copier dans Supabase → Settings → Edge Functions secrets, clé : LICENSE_PRIVATE_KEY)
 *   - Affiche la clé publique (à copier dans src/main/services/licenseService.ts)
 *
 * NE JAMAIS commiter la clé privée dans le dépôt.
 */

const { generateKeyPairSync } = require('node:crypto')

const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
})

console.log('='.repeat(60))
console.log('CLÉ PRIVÉE — À mettre dans Supabase Edge Functions secrets')
console.log('Variable : LICENSE_PRIVATE_KEY')
console.log('NE JAMAIS mettre dans Electron ni commiter dans git !')
console.log('='.repeat(60))
console.log(privateKey)

console.log('='.repeat(60))
console.log('CLÉ PUBLIQUE — À copier dans licenseService.ts')
console.log('Constante : LICENSE_PUBLIC_KEY_PEM')
console.log('(Sans risque — peut être dans le code source)')
console.log('='.repeat(60))
console.log(publicKey)
