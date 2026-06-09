export function fmtDate(d?: string): string {
  if (!d) return '—'
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return d }
}

export function getInitials(first: string, last: string): string {
  return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase()
}

export function getEvolBadgeClass(evol: string): string {
  if (!evol) return 'badge-gray'
  if (evol.includes('nette') || evol.includes('Légère')) return 'badge-green'
  if (evol.includes('Aggravation')) return 'badge-red'
  return 'badge-amber'
}

export function calcAge(birthDate?: string): string {
  if (!birthDate) return ''
  const age = Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000)
  return `${age} ans`
}
