import React, { useState } from 'react'

export interface OrthoTest {
  id: string
  name: string
  result: 'positif' | 'negatif' | 'non_concluant' | ''
  note: string
}

export type OrthoTestsValue = OrthoTest[]

function genId(): string {
  return 'ot' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
}

const RESULTS: { key: OrthoTest['result']; label: string; color: string }[] = [
  { key: 'positif',       label: 'Positif',       color: '#c94040' },
  { key: 'negatif',       label: 'Négatif',        color: '#4e8a5e' },
  { key: 'non_concluant', label: 'Non concluant', color: '#b8841e' },
]

export default function OsteoOrthoTestsModule({ value, onChange }: {
  value: OrthoTestsValue | null | undefined
  onChange: (v: OrthoTestsValue) => void
}) {
  const tests: OrthoTestsValue = Array.isArray(value) ? value : []
  const [newName, setNewName]       = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const addTest = () => {
    const name = newName.trim()
    if (!name) return
    onChange([...tests, { id: genId(), name, result: '', note: '' }])
    setNewName('')
  }

  const update = (id: string, patch: Partial<OrthoTest>) =>
    onChange(tests.map(t => t.id === id ? { ...t, ...patch } : t))

  const remove = (id: string) =>
    onChange(tests.filter(t => t.id !== id))

  const toggleNote = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const positifs = tests.filter(t => t.result === 'positif').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

      {/* Stats */}
      {tests.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 4, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>{tests.length} test{tests.length > 1 ? 's' : ''}</span>
          {positifs > 0 && (
            <span style={{ color: '#c94040', fontWeight: 600 }}>
              {positifs} positif{positifs > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Liste */}
      {tests.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '20px 16px',
          color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic',
          border: '2px dashed var(--border)', borderRadius: 10,
        }}>
          Aucun test saisi — ajoutez le premier ci-dessous
        </div>
      )}

      {tests.map(test => {
        const resultMeta = RESULTS.find(r => r.key === test.result)
        const expanded = expandedIds.has(test.id)

        return (
          <div
            key={test.id}
            style={{
              border: `1.5px solid ${resultMeta ? resultMeta.color + '55' : 'var(--border)'}`,
              borderRadius: 10, overflow: 'hidden',
              background: resultMeta ? resultMeta.color + '07' : 'var(--surface)',
              transition: 'all .15s',
            }}
          >
            {/* Ligne principale */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexWrap: 'wrap' }}>
              {/* Nom */}
              <input
                type="text"
                value={test.name}
                onChange={e => update(test.id, { name: e.target.value })}
                style={{
                  flex: 1, minWidth: 120, fontWeight: 600, fontSize: 13,
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text)',
                }}
                placeholder="Nom du test…"
              />

              {/* Résultat */}
              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                {RESULTS.map(r => {
                  const active = test.result === r.key
                  return (
                    <button
                      key={r.key}
                      onClick={() => update(test.id, { result: active ? '' : r.key })}
                      style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        border: `1.5px solid ${active ? r.color : r.color + '55'}`,
                        background: active ? r.color : 'transparent',
                        color: active ? '#fff' : r.color,
                        cursor: 'pointer', transition: 'all .12s', whiteSpace: 'nowrap',
                      }}
                    >{r.label}</button>
                  )
                })}
              </div>

              {/* Note toggle */}
              <button
                onClick={() => toggleNote(test.id)}
                title="Ajouter une note"
                style={{
                  fontSize: 13, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                  border: `1.5px solid ${expanded ? 'var(--accent)' : 'var(--border)'}`,
                  background: expanded ? 'var(--accent-light)' : 'transparent',
                  color: expanded ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >💬</button>

              {/* Supprimer */}
              <button
                onClick={() => remove(test.id)}
                style={{
                  fontSize: 12, padding: '3px 7px', borderRadius: 6, flexShrink: 0,
                  border: '1.5px solid var(--border)', background: 'transparent',
                  color: 'var(--red)', cursor: 'pointer',
                }}
              >✕</button>
            </div>

            {/* Note expandable */}
            {expanded && (
              <div style={{ padding: '0 12px 10px', borderTop: '1px solid var(--border-soft)' }}>
                <textarea
                  value={test.note}
                  onChange={e => update(test.id, { note: e.target.value })}
                  placeholder="Notes sur ce test (conditions, variante, observation clinique…)"
                  style={{ width: '100%', minHeight: 52, fontSize: 12, marginTop: 8, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Ajout */}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTest() } }}
          placeholder="Nom du test (ex : Lasègue, Jobe, Spurling, Patrick, Neer…)"
          style={{ flex: 1, fontSize: 13 }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={addTest}
          disabled={!newName.trim()}
          style={{ flexShrink: 0 }}
        >+ Ajouter</button>
      </div>
    </div>
  )
}
