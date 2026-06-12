import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SearchResult } from '../../../shared/types'

interface Props { onClose: () => void }

export default function GlobalSearch({ onClose }: Props) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => { inputRef.current?.focus() }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setLoading(true)
    try { setResults(await window.mtcApi.searchGlobal(q.trim())) }
    catch { setResults([]) }
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 250)
    return () => clearTimeout(t)
  }, [query, search])

  useEffect(() => { setSelected(0) }, [results])

  const go = (r: SearchResult) => {
    onClose()
    if (r.type === 'patient') navigate(`/patients`)
    else if (r.type === 'session' && r.patientId) navigate(`/seances?patient=${r.patientId}`)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape')    { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) go(results[selected])
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--surface)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', width: 560, maxWidth: '90vw', overflow: 'hidden', border: '1px solid var(--border)' }}>

        {/* Champ de recherche */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid var(--border)` }}>
          <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Rechercher un patient, une note de séance…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, background: 'transparent', color: 'var(--text)', fontFamily: 'inherit' }}
          />
          {loading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>…</span>}
          <kbd style={{ fontSize: 11, color: 'var(--text-hint)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px' }}>Échap</kbd>
        </div>

        {/* Résultats */}
        {results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {results.map((r, i) => (
              <div
                key={r.id}
                onClick={() => go(r)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 18px', cursor: 'pointer',
                  background: i === selected ? 'var(--accent-light)' : 'transparent',
                  borderLeft: i === selected ? '3px solid var(--accent)' : '3px solid transparent',
                  transition: 'background .1s',
                }}
                onMouseEnter={() => setSelected(i)}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{r.type === 'patient' ? '👤' : '📋'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subtitle}</div>
                </div>
                {r.date && <span style={{ fontSize: 11, color: 'var(--text-hint)', flexShrink: 0 }}>{new Date(r.date).toLocaleDateString('fr-FR')}</span>}
              </div>
            ))}
          </div>
        )}

        {query.length >= 2 && !loading && results.length === 0 && (
          <div style={{ padding: '20px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Aucun résultat pour « {query} »
          </div>
        )}

        {/* Aide */}
        <div style={{ padding: '8px 18px', borderTop: `1px solid var(--border-soft)`, display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-hint)' }}>
          <span><kbd style={{ border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px' }}>↑↓</kbd> Naviguer</span>
          <span><kbd style={{ border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px' }}>Entrée</kbd> Ouvrir</span>
          <span><kbd style={{ border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px' }}>Ctrl+K</kbd> Fermer</span>
        </div>
      </div>
    </div>
  )
}
