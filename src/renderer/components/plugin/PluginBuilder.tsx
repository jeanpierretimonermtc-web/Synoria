import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { PluginDefinition, PluginSection, PluginField, PluginFieldType } from '../../../shared/pluginTypes'
import PluginFormRenderer from './PluginFormRenderer'

// ── Emojis catégorisés ────────────────────────────────────────────────────────

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Corps & Anatomie',   emojis: ['🧠', '🫀', '🫁', '🦴', '🦷', '👁️', '👂', '👃', '🤲', '🦵', '🦶', '🫶', '🩻', '🧬'] },
  { label: 'Santé & Soin',       emojis: ['🩺', '💊', '🩹', '💉', '🌡️', '🔬', '🏥', '⚕️', '🩸', '🧪', '💆', '🧘', '🛁', '🪷'] },
  { label: 'Thérapie & MTC',     emojis: ['🌿', '🍃', '🌱', '☯️', '🌀', '⚡', '💫', '🌸', '🌺', '🌻', '🍀', '🌾', '🌊', '🔥'] },
  { label: 'Formulaire & Notes', emojis: ['📋', '📝', '✍️', '📊', '📈', '📌', '🗂️', '📁', '🔖', '🔍', '📏', '🖊️', '📐', '💬'] },
  { label: 'Évaluation',         emojis: ['⭐', '🎯', '✅', '❌', '⚠️', '💡', '🔑', '🏆', '❤️', '💙', '🟢', '🟡', '🔴', '⚖️'] },
]

// ── Types de champs ───────────────────────────────────────────────────────────

const FIELD_TYPES: { type: PluginFieldType; label: string; icon: string; desc: string; color: string }[] = [
  { type: 'text',          label: 'Texte court',              icon: '📝', color: '#3B82F6', desc: 'Une ligne — ex : Nom, Médicament, Localisation'         },
  { type: 'textarea',      label: 'Zone de texte',            icon: '📄', color: '#3B82F6', desc: 'Plusieurs lignes — ex : Anamnèse, Observations'          },
  { type: 'richtext',      label: 'Texte enrichi',            icon: '✍️', color: '#3B82F6', desc: 'Avec mise en forme (gras, italique, couleurs)'           },
  { type: 'number',        label: 'Nombre',                   icon: '🔢', color: '#D97706', desc: 'Valeur numérique — ex : Poids, Tension artérielle'       },
  { type: 'date',          label: 'Date',                     icon: '📅', color: '#D97706', desc: 'Sélecteur de date — ex : Début des douleurs'             },
  { type: 'select',        label: 'Liste déroulante',         icon: '▼',  color: '#7C3AED', desc: 'Menu avec un seul choix — ex : Côté, Intensité'          },
  { type: 'radio',         label: 'Choix unique (boutons)',   icon: '⚪', color: '#7C3AED', desc: 'Options cliquables, un seul choix — ex : Oui / Non'      },
  { type: 'checkbox',      label: 'Case à cocher (oui/non)',  icon: '☑️', color: '#7C3AED', desc: 'Booléen — ex : Fumeur, Allergie, Contre-indication'       },
  { type: 'checkboxgroup', label: 'Cases à cocher multiples', icon: '☑',  color: '#7C3AED', desc: 'Plusieurs réponses — ex : Symptômes présents, Zones'     },
  { type: 'tags',          label: 'Étiquettes libres',        icon: '🏷️', color: '#0D9488', desc: 'Saisie + Entrée — ex : Mots-clés, Points traités'        },
  { type: 'rating',        label: 'Échelle numérique',        icon: '⭐', color: '#0D9488', desc: 'Clic sur une valeur dans une plage — ex : Douleur 0 à 10' },
  { type: 'bodychart',     label: 'Schéma corporel',          icon: '🫀', color: '#6F7F8F', desc: 'Schéma du corps humain — annoter des zones anatomiques'       },
  { type: 'separator',     label: 'Séparateur visuel',        icon: '—',  color: '#9CA3AF', desc: 'Ligne de séparation sans donnée — pour aérer le formulaire' },
]

const WIDTH_OPTIONS: { value: 'full' | 'half' | 'third'; label: string; cols: number }[] = [
  { value: 'full',  label: 'Pleine largeur', cols: 1 },
  { value: 'half',  label: '½ largeur',      cols: 2 },
  { value: 'third', label: '⅓ largeur',      cols: 3 },
]

const ACCENT_COLORS = [
  { label: 'Vert sauge',  value: '#4a7b3c' },
  { label: 'Bleu',        value: '#3B82F6' },
  { label: 'Violet',      value: '#7C3AED' },
  { label: 'Orange',      value: '#D97706' },
  { label: 'Rouge',       value: '#DC2626' },
  { label: 'Rose',        value: '#DB2777' },
  { label: 'Sarcelle',    value: '#0D9488' },
  { label: 'Indigo',      value: '#4F46E5' },
  { label: 'Ardoise',     value: '#475569' },
  { label: 'Ambre foncé', value: '#92400E' },
]

function hasOptions(t: PluginFieldType) { return t === 'select' || t === 'radio' || t === 'checkboxgroup' }
function hasRange(t: PluginFieldType)   { return t === 'number' || t === 'rating' }
function typeColor(t: PluginFieldType)  { return FIELD_TYPES.find(f => f.type === t)?.color ?? '#9CA3AF' }

function genId(): string {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
}

function validate(name: string, specialty: string, sections: PluginSection[]): string[] {
  const errs: string[] = []
  if (!name.trim())      errs.push('Le nom du formulaire est requis.')
  if (!specialty.trim()) errs.push('La spécialité est requise.')
  if (sections.length === 0) errs.push('Ajoutez au moins une section.')
  for (const sec of sections) {
    if (!sec.title.trim()) errs.push('Toutes les sections doivent avoir un titre.')
    const real = sec.fields.filter(f => f.type !== 'separator')
    if (real.length === 0) errs.push(`La section "${sec.title || 'sans titre'}" doit contenir au moins un champ.`)
    for (const f of sec.fields) {
      if (f.type === 'separator') continue
      if (!f.label.trim()) errs.push(`Un champ de "${sec.title || 'sans titre'}" n'a pas d'intitulé.`)
      if (hasOptions(f.type) && (f.options || []).filter(o => o.trim()).length < 2)
        errs.push(`"${f.label || 'Un champ'}" (${sec.title}) nécessite au moins 2 options.`)
    }
  }
  return [...new Set(errs)]
}

// ── Groupage des champs (même algorithme que PluginFormRenderer) ─────────────

function groupFieldsIntoRows(fields: PluginField[]): PluginField[][] {
  const rows: PluginField[][] = []
  let row: PluginField[] = []
  let rowWidth: 'half' | 'third' | null = null

  const flush = () => {
    if (row.length > 0) { rows.push(row); row = []; rowWidth = null }
  }

  for (const f of fields) {
    const w = (f.width || 'full') as 'full' | 'half' | 'third'
    if (w === 'full') { flush(); rows.push([f]); continue }
    if (rowWidth !== null && rowWidth !== w) flush()
    rowWidth = w
    row.push(f)
    if ((w === 'half' && row.length >= 2) || (w === 'third' && row.length >= 3)) flush()
  }
  flush()
  return rows
}

// ── Types DnD ─────────────────────────────────────────────────────────────────

type DropZone =
  | { type: 'new-row-before'; anchorFieldId: string | null }
  | { type: 'new-row-after-all' }
  | { type: 'join-row'; anchorFieldId: string }

// ── RowDropZone — bande de dépôt "nouvelle ligne" ─────────────────────────────

function RowDropZone({ isDragging, active, label, onDragOver, onDrop }: {
  isDragging: boolean; active: boolean; label: string
  onDragOver: () => void; onDrop: () => void
}) {
  if (!isDragging) return <div style={{ height: 5 }} />
  return (
    <div
      style={{
        height: active ? 36 : 10, borderRadius: 7, transition: 'all .12s',
        border: `2px dashed ${active ? 'var(--accent)' : 'var(--border-soft)'}`,
        background: active ? 'rgba(74,123,60,.1)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'copy',
      }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOver() }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop() }}
    >
      {active && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>{label}</span>}
    </div>
  )
}

// ── Aperçu disposition en temps réel (drag & drop) ───────────────────────────

function SectionLayoutPreview({ fields, onReorder }: {
  fields: PluginField[]
  onReorder: (fields: PluginField[]) => void
}) {
  if (fields.length === 0) return null
  const rows = groupFieldsIntoRows(fields)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropZone, setDropZone] = useState<DropZone | null>(null)

  const getAnchor = (rowIdx: number): string | null =>
    rows[rowIdx]?.find(f => f.id !== draggingId)?.id ?? null

  const canJoin = (rowIdx: number): boolean => {
    if (!draggingId) return false
    const row = rows[rowIdx]
    if (!row) return false
    if (row.some(f => f.type === 'separator')) return false
    if (fields.find(f => f.id === draggingId)?.type === 'separator') return false
    return row.filter(f => f.id !== draggingId).length < 3
  }

  const applyDrop = (zone: DropZone) => {
    if (!draggingId) return
    const draggedField = fields.find(f => f.id === draggingId)
    if (!draggedField) return

    // Lignes sans le champ déplacé
    const otherRows = rows
      .map(row => row.filter(f => f.id !== draggingId))
      .filter(r => r.length > 0)

    let resultRows: PluginField[][]

    if (zone.type === 'new-row-after-all') {
      resultRows = [...otherRows, [draggedField]]
    } else if (zone.type === 'new-row-before') {
      const anchorId = zone.anchorFieldId
      if (!anchorId) {
        resultRows = [...otherRows, [draggedField]]
      } else {
        const ri = otherRows.findIndex(r => r.some(f => f.id === anchorId))
        resultRows = ri < 0
          ? [...otherRows, [draggedField]]
          : [...otherRows.slice(0, ri), [draggedField], ...otherRows.slice(ri)]
      }
    } else { // join-row
      const ri = otherRows.findIndex(r => r.some(f => f.id === zone.anchorFieldId))
      resultRows = ri < 0
        ? [...otherRows, [draggedField]]
        : otherRows.map((r, i) => i === ri ? [...r, draggedField] : r)
    }

    // Largeur automatique selon la taille de la ligne
    const newFields = resultRows.flatMap(row => {
      const w: 'full' | 'half' | 'third' =
        row.length === 1 ? 'full' : row.length === 2 ? 'half' : 'third'
      return row.map(f => ({ ...f, width: w }))
    })

    onReorder(newFields)
    setDraggingId(null)
    setDropZone(null)
  }

  const isDragging = draggingId !== null

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-soft)', background: 'var(--accent-light)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>
        {isDragging
          ? '→ Glissez vers une ligne (rejoindre) ou entre deux lignes (pleine largeur)'
          : 'Disposition en temps réel — glissez les blocs pour réorganiser'}
      </div>

      <div>
        {rows.map((rowFields, rowIdx) => {
          const anchor = getAnchor(rowIdx)
          const joinable = canJoin(rowIdx)
          const isJoinTarget = dropZone?.type === 'join-row' && anchor !== null && dropZone.anchorFieldId === anchor
          const isSepRow = rowFields.length === 1 && rowFields[0].type === 'separator'

          // Taille effective si on ajoute un champ en hover
          const effectiveCount = isJoinTarget
            ? rowFields.filter(f => f.id !== draggingId).length + 1
            : rowFields.length
          const badgeLabel = effectiveCount === 2 ? '½' : effectiveCount === 3 ? '⅓' : null

          return (
            <React.Fragment key={rowIdx}>
              <RowDropZone
                isDragging={isDragging}
                active={dropZone?.type === 'new-row-before' && dropZone.anchorFieldId === anchor}
                label="↓ Insérer ici — pleine largeur"
                onDragOver={() => setDropZone({ type: 'new-row-before', anchorFieldId: anchor })}
                onDrop={() => applyDrop({ type: 'new-row-before', anchorFieldId: anchor })}
              />

              {isSepRow ? (
                /* Séparateur */
                <div
                  draggable
                  onDragStart={e => { setDraggingId(rowFields[0].id); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation() }}
                  onDragEnd={() => { setDraggingId(null); setDropZone(null) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, cursor: 'grab', opacity: rowFields[0].id === draggingId ? .3 : 1 }}
                >
                  <div style={{ flex: 1, height: 2, background: 'var(--border)', borderRadius: 1 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, userSelect: 'none' }}>⠿ séparateur</span>
                  <div style={{ flex: 1, height: 2, background: 'var(--border)', borderRadius: 1 }} />
                </div>
              ) : (
                /* Ligne de champs */
                <div
                  style={{
                    display: 'flex', gap: 5, marginBottom: 5, borderRadius: 8, padding: '3px',
                    border: `2px ${isJoinTarget ? 'dashed' : 'solid'} ${isJoinTarget ? 'var(--accent)' : 'transparent'}`,
                    background: isJoinTarget ? 'rgba(74,123,60,.07)' : 'transparent',
                    transition: 'all .12s',
                  }}
                  onDragOver={e => {
                    if (isDragging && joinable) {
                      e.preventDefault(); e.stopPropagation()
                      const anch = rowFields.find(f => f.id !== draggingId)?.id
                      if (anch) setDropZone({ type: 'join-row', anchorFieldId: anch })
                    }
                  }}
                  onDrop={e => {
                    e.preventDefault(); e.stopPropagation()
                    if (dropZone?.type === 'join-row') applyDrop(dropZone)
                  }}
                >
                  {rowFields.map(f => {
                    const c = typeColor(f.type)
                    const meta = FIELD_TYPES.find(ft => ft.type === f.type)
                    const fading = f.id === draggingId
                    return (
                      <div
                        key={f.id}
                        draggable
                        onDragStart={e => { setDraggingId(f.id); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation() }}
                        onDragEnd={() => { setDraggingId(null); setDropZone(null) }}
                        style={{
                          flex: 1, minWidth: 0, padding: '6px 10px',
                          background: c + (fading ? '0a' : '18'),
                          border: `1.5px solid ${c}${fading ? '22' : '44'}`,
                          borderRadius: 6, fontSize: 11, fontWeight: 600, color: fading ? c + '66' : c,
                          display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden',
                          cursor: 'grab', userSelect: 'none', transition: 'all .12s',
                        }}
                      >
                        <span style={{ fontSize: 11, opacity: .5, flexShrink: 0 }}>⠿</span>
                        <span style={{ fontSize: 13, flexShrink: 0 }}>{meta?.icon}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {f.label.trim() || <em style={{ opacity: .4, fontWeight: 400 }}>sans titre</em>}
                        </span>
                        {badgeLabel && !fading && (
                          <span style={{ fontSize: 9, opacity: .6, flexShrink: 0 }}>{badgeLabel}</span>
                        )}
                      </div>
                    )
                  })}

                  {/* Placeholder visible quand on survole pour rejoindre */}
                  {isJoinTarget && (
                    <div style={{
                      flex: 1, minWidth: 0, padding: '6px 10px',
                      background: 'rgba(74,123,60,.12)', border: '2px dashed var(--accent)',
                      borderRadius: 6, fontSize: 11, color: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700,
                    }}>
                      + déposer ici {badgeLabel && `(${badgeLabel})`}
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          )
        })}

        <RowDropZone
          isDragging={isDragging}
          active={dropZone?.type === 'new-row-after-all'}
          label="↓ Ajouter à la fin — pleine largeur"
          onDragOver={() => setDropZone({ type: 'new-row-after-all' })}
          onDrop={() => applyDrop({ type: 'new-row-after-all' })}
        />
      </div>
    </div>
  )
}

// ── ColorPicker — palette + roue couleur libre ───────────────────────────────

function ColorPicker({ value, onChange }: { value?: string; onChange: (c: string | undefined) => void }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Réinitialiser */}
      <button
        type="button"
        onClick={() => onChange(undefined)}
        title="Couleur par défaut"
        style={{
          width: 24, height: 24, borderRadius: '50%', border: `2px solid ${!value ? 'var(--text)' : 'var(--border)'}`,
          background: 'var(--surface)', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >×</button>
      {/* Palette preset */}
      {ACCENT_COLORS.map(c => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          title={c.label}
          style={{
            width: 24, height: 24, borderRadius: '50%', background: c.value, cursor: 'pointer',
            border: `3px solid ${value === c.value ? 'var(--text)' : 'transparent'}`,
            outline: value === c.value ? `2px solid ${c.value}88` : 'none',
            outlineOffset: 1, transition: 'transform .1s, outline .1s', flexShrink: 0,
          }}
          onMouseEnter={ev => { ev.currentTarget.style.transform = 'scale(1.2)' }}
          onMouseLeave={ev => { ev.currentTarget.style.transform = 'scale(1)' }}
        />
      ))}
      {/* Roue libre */}
      <input
        type="color"
        value={value || '#4a7b3c'}
        onChange={e => onChange(e.target.value)}
        title="Couleur personnalisée"
        style={{
          width: 24, height: 24, borderRadius: '50%', border: `2px solid ${value && !ACCENT_COLORS.some(c => c.value === value) ? 'var(--text)' : 'var(--border)'}`,
          padding: 0, cursor: 'pointer', flexShrink: 0,
          outline: value && !ACCENT_COLORS.some(c => c.value === value) ? `2px solid ${value}88` : 'none',
          outlineOffset: 1,
        }}
      />
    </div>
  )
}

// ── EmojiPicker ───────────────────────────────────────────────────────────────

function EmojiPicker({ value, onChange, size = 28 }: { value: string; onChange: (e: string) => void; size?: number }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Choisir une icône"
        style={{
          fontSize: size, width: size + 16, height: size + 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1.5px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 10, background: open ? 'var(--accent-light)' : 'var(--surface)',
          cursor: 'pointer', transition: 'all .15s',
        }}
      >{value || '📋'}</button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,.2)', padding: 14, width: 310,
        }}>
          {EMOJI_GROUPS.map(g => (
            <div key={g.label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>{g.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {g.emojis.map(e => (
                  <button
                    key={e} type="button"
                    onClick={() => { onChange(e); setOpen(false) }}
                    style={{
                      fontSize: 20, width: 36, height: 36, border: `1.5px solid ${value === e ? 'var(--accent)' : 'transparent'}`,
                      borderRadius: 7, background: value === e ? 'var(--accent-light)' : 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .1s',
                    }}
                    onMouseEnter={ev => { ev.currentTarget.style.background = 'var(--accent-light)'; ev.currentTarget.style.borderColor = 'var(--border-soft)' }}
                    onMouseLeave={ev => { ev.currentTarget.style.background = value === e ? 'var(--accent-light)' : 'transparent'; ev.currentTarget.style.borderColor = value === e ? 'var(--accent)' : 'transparent' }}
                  >{e}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TypePicker (popup grille pour choisir le type d'un champ) ────────────────

function TypePicker({ current, onSelect }: { current: PluginFieldType; onSelect: (t: PluginFieldType) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const meta = FIELD_TYPES.find(f => f.type === current) ?? { icon: '?', label: current, color: '#9CA3AF', desc: '' }

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Changer le type de champ"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 20,
          background: meta.color + '18', border: `1.5px solid ${meta.color}55`,
          color: meta.color, fontWeight: 700, fontSize: 11, cursor: 'pointer',
          whiteSpace: 'nowrap', transition: 'all .15s',
          ...(open ? { borderColor: meta.color } : {}),
        }}
      >
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
        <span style={{ fontSize: 9, opacity: .7 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,.18)',
          padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, width: 420,
        }}>
          {FIELD_TYPES.map(ft => (
            <button
              key={ft.type}
              type="button"
              onClick={() => { onSelect(ft.type); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 11px',
                border: `1.5px solid ${ft.type === current ? ft.color + '55' : 'transparent'}`,
                borderRadius: 8, background: ft.type === current ? ft.color + '10' : 'transparent',
                cursor: 'pointer', textAlign: 'left', transition: 'all .1s',
              }}
              onMouseEnter={ev => { ev.currentTarget.style.background = ft.color + '12'; ev.currentTarget.style.borderColor = ft.color + '44' }}
              onMouseLeave={ev => { ev.currentTarget.style.background = ft.type === current ? ft.color + '10' : 'transparent'; ev.currentTarget.style.borderColor = ft.type === current ? ft.color + '55' : 'transparent' }}
            >
              <span style={{ fontSize: 17, flexShrink: 0, width: 22, textAlign: 'center', marginTop: 1 }}>{ft.icon}</span>
              <span>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{ft.label}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 1 }}>{ft.desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AddFieldPicker ────────────────────────────────────────────────────────────

function AddFieldPicker({ onAdd }: { onAdd: (t: PluginFieldType) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(v => !v)}
        style={{ borderStyle: 'dashed', gap: 6 }}
      >
        + Ajouter un champ
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, zIndex: 50, marginBottom: 6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 -8px 40px rgba(0,0,0,.18)',
          padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, width: 420,
        }}>
          {FIELD_TYPES.map(ft => (
            <button
              key={ft.type}
              type="button"
              onClick={() => { onAdd(ft.type); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 11px',
                border: '1.5px solid transparent', borderRadius: 8,
                background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all .1s',
              }}
              onMouseEnter={ev => { ev.currentTarget.style.background = ft.color + '12'; ev.currentTarget.style.borderColor = ft.color + '44' }}
              onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent'; ev.currentTarget.style.borderColor = 'transparent' }}
            >
              <span style={{ fontSize: 17, flexShrink: 0, width: 22, textAlign: 'center', marginTop: 1 }}>{ft.icon}</span>
              <span>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{ft.label}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 1 }}>{ft.desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  initial?:          PluginDefinition
  onSave:            (p: PluginDefinition) => Promise<void>
  onCancel:          () => void
  onSaveToLibrary?:  (p: PluginDefinition) => Promise<void>
}

export default function PluginBuilder({ initial, onSave, onCancel, onSaveToLibrary }: Props) {
  const [name,      setName]      = useState(initial?.name      || '')
  const [specialty, setSpecialty] = useState(initial?.specialty || '')
  const [icon,      setIcon]      = useState(initial?.icon      || '📋')
  const [sections,  setSections]  = useState<PluginSection[]>(() =>
    (initial?.sections || []).map(s => ({
      ...s, fields: s.fields.map(f => ({ ...f, options: f.options ? [...f.options] : [] })),
    }))
  )
  const [errors,          setErrors]          = useState<string[]>([])
  const [saving,          setSaving]          = useState(false)
  const [savingLib,       setSavingLib]       = useState(false)
  const [view,            setView]            = useState<'editor' | 'preview'>('editor')
  const [libraryEntries,  setLibraryEntries]  = useState<{ plugin: PluginDefinition; savedAt: string }[]>([])
  const [showImportPanel, setShowImportPanel] = useState(false)
  const importPanelRef = useRef<HTMLDivElement>(null)
  const [previewData, setPreviewData] = useState<Record<string, any>>({})

  const buildPlugin = useCallback((): PluginDefinition => ({
    id:        initial?.id || ('custom_' + Date.now().toString(36)),
    name:      name.trim(),
    specialty: specialty.trim(),
    version:   initial?.version || '1.0.0',
    icon:      icon || '📋',
    sections:  sections.map(s => ({
      ...s,
      title:  s.title.trim(),
      fields: s.fields.map(f => ({
        ...f,
        label:       f.label.trim(),
        options:     hasOptions(f.type) ? (f.options || []).map(o => o.trim()).filter(Boolean) : undefined,
        min:         hasRange(f.type) ? (f.min ?? (f.type === 'rating' ? 0  : undefined)) : undefined,
        max:         hasRange(f.type) ? (f.max ?? (f.type === 'rating' ? 10 : undefined)) : undefined,
        placeholder: f.placeholder?.trim() || undefined,
      })),
    })),
  }), [name, specialty, icon, sections, initial])

  // ── Ops sections ──────────────────────────────────────────────────────────
  const addSection = () =>
    setSections(prev => [...prev, { id: genId(), title: '', icon: '🗂️', fields: [] }])
  const removeSection = (id: string) =>
    setSections(prev => prev.filter(s => s.id !== id))
  const updateSection = (id: string, patch: Partial<Pick<PluginSection, 'title' | 'icon' | 'accentColor'>>) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  const moveSection = (id: string, dir: -1 | 1) =>
    setSections(prev => {
      const i = prev.findIndex(s => s.id === id)
      if (i < 0 || i + dir < 0 || i + dir >= prev.length) return prev
      const a = [...prev]; [a[i], a[i + dir]] = [a[i + dir], a[i]]; return a
    })

  // ── Ops champs ────────────────────────────────────────────────────────────
  const addField = (sectionId: string, type: PluginFieldType) => {
    const field: PluginField = {
      id: genId(), type, label: '', width: 'full',
      options: hasOptions(type) ? ['', ''] : undefined,
      min: type === 'rating' ? 0 : undefined,
      max: type === 'rating' ? 10 : undefined,
    }
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, fields: [...s.fields, field] } : s))
  }
  const removeField = (sectionId: string, fid: string) =>
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, fields: s.fields.filter(f => f.id !== fid) } : s))
  const updateField = (sectionId: string, fid: string, patch: Partial<PluginField>) =>
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, fields: s.fields.map(f => f.id === fid ? { ...f, ...patch } : f) } : s
    ))
  const moveField = (sectionId: string, fid: string, dir: -1 | 1) =>
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      const i = s.fields.findIndex(f => f.id === fid)
      if (i < 0 || i + dir < 0 || i + dir >= s.fields.length) return s
      const a = [...s.fields]; [a[i], a[i + dir]] = [a[i + dir], a[i]]; return { ...s, fields: a }
    }))

  const duplicateField = (sectionId: string, fieldId: string) =>
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      const idx = s.fields.findIndex(f => f.id === fieldId)
      if (idx < 0) return s
      const orig = s.fields[idx]
      const copy: PluginField = {
        ...orig, id: genId(), label: orig.label ? orig.label + ' (copie)' : '',
        options: orig.options ? [...orig.options] : undefined,
      }
      const fields = [...s.fields]
      fields.splice(idx + 1, 0, copy)
      return { ...s, fields }
    }))

  const reorderSectionFields = (sectionId: string, newFields: PluginField[]) =>
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, fields: newFields } : s))

  // ── Ops options ───────────────────────────────────────────────────────────
  const setOption = (sid: string, fid: string, idx: number, val: string) =>
    setSections(prev => prev.map(s => s.id !== sid ? s : {
      ...s, fields: s.fields.map(f => {
        if (f.id !== fid) return f
        const o = [...(f.options || [])]; o[idx] = val; return { ...f, options: o }
      })
    }))
  const addOption = (sid: string, fid: string) =>
    setSections(prev => prev.map(s => s.id !== sid ? s : {
      ...s, fields: s.fields.map(f => f.id !== fid ? f : { ...f, options: [...(f.options || []), ''] })
    }))
  const removeOption = (sid: string, fid: string, idx: number) =>
    setSections(prev => prev.map(s => s.id !== sid ? s : {
      ...s, fields: s.fields.map(f => f.id !== fid ? f : { ...f, options: (f.options || []).filter((_, i) => i !== idx) })
    }))

  useEffect(() => {
    window.mtcApi.pluginLibraryGet().then(lib => setLibraryEntries(lib)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!showImportPanel) return
    const handler = (e: MouseEvent) => {
      if (importPanelRef.current && !importPanelRef.current.contains(e.target as Node)) {
        setShowImportPanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showImportPanel])

  const importSection = useCallback((section: PluginSection) => {
    const newSection: PluginSection = {
      ...section,
      id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      fields: section.fields.map(f => ({ ...f, id: genId(), options: f.options ? [...f.options] : [] })),
    }
    setSections(prev => [...prev, newSection])
    setShowImportPanel(false)
  }, [])

  const handleSave = async () => {
    const errs = validate(name, specialty, sections)
    if (errs.length > 0) { setErrors(errs); return }
    setErrors([])
    setSaving(true)
    try { await onSave(buildPlugin()) } finally { setSaving(false) }
  }

  const handleSaveToLib = async () => {
    if (!onSaveToLibrary) return
    const errs = validate(name, specialty, sections)
    if (errs.length > 0) { setErrors(errs); return }
    setErrors([])
    setSavingLib(true)
    try { await onSaveToLibrary(buildPlugin()) } finally { setSavingLib(false) }
  }

  const previewPlugin = buildPlugin()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Titre + onglets */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
            {initial ? '✏️ Modifier le formulaire' : '✏️ Créer un formulaire de spécialité'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            Les séances existantes conservent leur propre schéma et ne sont pas affectées.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['editor', 'preview'] as const).map(v => (
            <button
              key={v}
              className="btn btn-secondary btn-sm"
              style={view === v ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 700 } : {}}
              onClick={() => setView(v)}
            >{v === 'editor' ? '✏️ Éditeur' : '👁️ Aperçu'}</button>
          ))}
        </div>
      </div>

      {view === 'editor' ? (
        <>
          {/* ── Étape 1 : Identité du formulaire ── */}
          <div className="card" style={{ padding: '20px 22px' }}>
            <StepHeader num={1} title="Identité du formulaire" />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, marginTop: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 7 }}>Icône</div>
                <EmojiPicker value={icon} onChange={setIcon} size={30} />
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5, textAlign: 'center' }}>Cliquez</div>
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="field">
                  <label>Nom du formulaire *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ex : Kinésiologie, Naturopathie…" autoFocus={!initial} />
                </div>
                <div className="field">
                  <label>Spécialité *</label>
                  <input type="text" value={specialty} onChange={e => setSpecialty(e.target.value)}
                    placeholder="Ex : Médecine Douce, Thérapie manuelle…" />
                </div>
              </div>
            </div>
          </div>

          {/* ── Étape 2 : Sections & champs ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <StepHeader num={2} title="Sections et champs" inline />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— Organisez votre formulaire par groupes thématiques</span>
          </div>

          {sections.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '32px 20px',
              border: '2px dashed var(--border)', borderRadius: 12,
              color: 'var(--text-muted)',
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🗂️</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: 'var(--text)' }}>Aucune section pour l'instant</div>
              <div style={{ fontSize: 12, lineHeight: 1.7, maxWidth: 400, margin: '0 auto' }}>
                Une <strong>section</strong> regroupe des champs liés.<br />
                Exemples : <em>"Anamnèse"</em>, <em>"Examen clinique"</em>, <em>"Bilan postural"</em>, <em>"Traitement"</em>
              </div>
            </div>
          )}

          {sections.map((sec, si) => (
            <SectionEditor
              key={sec.id}
              section={sec}
              index={si}
              total={sections.length}
              onUpdate={p => updateSection(sec.id, p)}
              onRemove={() => removeSection(sec.id)}
              onMoveUp={() => moveSection(sec.id, -1)}
              onMoveDown={() => moveSection(sec.id, 1)}
              onAddField={t => addField(sec.id, t)}
              onRemoveField={fid => removeField(sec.id, fid)}
              onUpdateField={(fid, p) => updateField(sec.id, fid, p)}
              onMoveField={(fid, d) => moveField(sec.id, fid, d)}
              onReorder={newFields => reorderSectionFields(sec.id, newFields)}
              onDuplicateField={fid => duplicateField(sec.id, fid)}
              onSetOption={(fid, i, v) => setOption(sec.id, fid, i, v)}
              onAddOption={fid => addOption(sec.id, fid)}
              onRemoveOption={(fid, i) => removeOption(sec.id, fid, i)}
            />
          ))}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', position: 'relative' }} ref={importPanelRef}>
            <button className="btn btn-secondary" onClick={addSection}
              style={{ borderStyle: 'dashed' }}>
              + Ajouter une section
            </button>
            {libraryEntries.some(e => e.plugin.sections.length > 0) && (
              <button className="btn btn-secondary" onClick={() => setShowImportPanel(v => !v)}>
                📚 Importer depuis la bibliothèque
              </button>
            )}
            {showImportPanel && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: 4,
                minWidth: 280, maxWidth: 380,
                border: '1px solid var(--border)', borderRadius: 10,
                background: 'var(--bg)', boxShadow: '0 4px 20px rgba(0,0,0,.13)',
                maxHeight: 320, overflowY: 'auto',
              }}>
                {libraryEntries.filter(e => e.plugin.sections.length > 0).map(entry => (
                  <div key={entry.plugin.id}>
                    <div style={{
                      padding: '8px 14px 4px', fontSize: 11, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '.05em',
                      color: entry.plugin.accentColor || 'var(--accent)',
                      borderBottom: '1px solid var(--border-soft)',
                    }}>
                      {entry.plugin.icon} {entry.plugin.name}
                    </div>
                    {entry.plugin.sections.map(section => {
                      const fieldCount = section.fields.filter(f => f.type !== 'separator').length
                      return (
                        <button
                          key={section.id}
                          onMouseDown={() => importSection(section)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            width: '100%', textAlign: 'left', padding: '8px 14px 8px 24px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 13, color: 'var(--text)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{section.icon || '📋'}</span>
                          <div>
                            <div style={{ fontWeight: 600 }}>{section.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {fieldCount} champ{fieldCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div style={{ background: '#FEF0F0', border: '1px solid #FCCDD0', borderRadius: 8, padding: '12px 16px' }}>
              <div style={{ fontWeight: 700, color: 'var(--red)', fontSize: 13, marginBottom: 6 }}>⚠️ Veuillez corriger avant d'enregistrer :</div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {errors.map((e, i) => <li key={i} style={{ fontSize: 13, color: 'var(--red)', lineHeight: 1.8 }}>{e}</li>)}
              </ul>
            </div>
          )}

          <FooterActions saving={saving} onCancel={onCancel} onSave={handleSave} savingLib={savingLib} onSaveToLibrary={onSaveToLibrary ? handleSaveToLib : undefined} />
        </>
      ) : (
        <>
          {!previewPlugin.name || previewPlugin.sections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '52px 24px', color: 'var(--text-muted)', fontSize: 14 }}>
              Remplissez l'éditeur pour voir l'aperçu ici.
            </div>
          ) : (
            <PluginFormRenderer
              plugin={previewPlugin}
              data={previewData}
              onChange={(id, val) => setPreviewData(prev => ({ ...prev, [id]: val }))}
            />
          )}
          <FooterActions saving={saving} onCancel={onCancel} onSave={handleSave} savingLib={savingLib} onSaveToLibrary={onSaveToLibrary ? handleSaveToLib : undefined} />
        </>
      )}
    </div>
  )
}

// ── StepHeader ────────────────────────────────────────────────────────────────

function StepHeader({ num, title, inline }: { num: number; title: string; inline?: boolean }) {
  const badge = (
    <div style={{
      width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)',
      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 800, flexShrink: 0,
    }}>{num}</div>
  )
  if (inline) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {badge}
      <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {badge}
      <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
    </div>
  )
}

// ── FooterActions ─────────────────────────────────────────────────────────────

function FooterActions({ saving, onCancel, onSave, savingLib, onSaveToLibrary }: {
  saving: boolean; onCancel: () => void; onSave: () => void
  savingLib?: boolean; onSaveToLibrary?: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border-soft)', marginTop: 4 }}>
      <button className="btn btn-secondary" onClick={onCancel}>Annuler</button>
      {onSaveToLibrary && (
        <button className="btn btn-secondary" onClick={onSaveToLibrary} disabled={savingLib}>
          {savingLib ? '⏳…' : '📚 Bibliothèque'}
        </button>
      )}
      <button className="btn btn-primary" onClick={onSave} disabled={saving}>
        {saving ? '⏳ Enregistrement…' : '✅ Enregistrer le formulaire'}
      </button>
    </div>
  )
}

// ── SectionEditor ─────────────────────────────────────────────────────────────

interface SectionEditorProps {
  section: PluginSection; index: number; total: number
  onUpdate:         (p: Partial<Pick<PluginSection, 'title' | 'icon' | 'accentColor'>>) => void
  onRemove:         () => void
  onMoveUp:         () => void
  onMoveDown:       () => void
  onAddField:       (t: PluginFieldType) => void
  onRemoveField:    (id: string) => void
  onUpdateField:    (id: string, p: Partial<PluginField>) => void
  onMoveField:      (id: string, dir: -1 | 1) => void
  onReorder:        (fields: PluginField[]) => void
  onDuplicateField: (id: string) => void
  onSetOption:      (fid: string, idx: number, val: string) => void
  onAddOption:      (fid: string) => void
  onRemoveOption:   (fid: string, idx: number) => void
}

function SectionEditor({ section, index, total, onUpdate, onRemove, onMoveUp, onMoveDown,
  onAddField, onRemoveField, onUpdateField, onMoveField, onReorder, onDuplicateField,
  onSetOption, onAddOption, onRemoveOption }: SectionEditorProps) {

  const [colorOpen, setColorOpen] = useState(false)
  const ac = section.accentColor

  return (
    <div style={{ border: `1.5px solid ${ac ?? 'var(--border)'}`, borderRadius: 12, transition: 'border-color .2s' }}>

      {/* En-tête section */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '12px 16px',
        background: ac ? ac + '18' : 'var(--accent-light)',
        borderRadius: '11px 11px 0 0',
        borderBottom: '1px solid var(--border-soft)',
        borderLeft: ac ? `4px solid ${ac}` : '4px solid transparent',
        transition: 'background .2s, border-left-color .2s',
      }}>
        {/* Ligne titre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EmojiPicker value={section.icon || '🗂️'} onChange={v => onUpdate({ icon: v })} size={18} />
          <input
            type="text"
            value={section.title}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder={`Nom de la section ${index + 1} — ex : Anamnèse, Examen clinique…`}
            style={{ flex: 1, fontWeight: 700, fontSize: 14, background: 'rgba(255,255,255,0.6)', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 6, padding: '4px 10px', color: 'var(--text)', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>
              {section.fields.length} champ{section.fields.length !== 1 ? 's' : ''}
            </span>
            <button className="btn btn-secondary btn-sm" style={{ padding: '2px 7px' }}
              onClick={onMoveUp} disabled={index === 0} title="Monter la section">▲</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '2px 7px' }}
              onClick={onMoveDown} disabled={index === total - 1} title="Descendre la section">▼</button>
            <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', color: 'var(--red)' }}
              onClick={onRemove} title="Supprimer la section">✕</button>
          </div>
        </div>

        {/* Ligne couleur (réduite/expandable) */}
        <div>
          <button
            type="button"
            onClick={() => setColorOpen(o => !o)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, color: ac ? ac : 'var(--text-muted)', fontWeight: 600, padding: 0,
            }}
          >
            {ac
              ? <><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: ac, flexShrink: 0 }} /> Couleur d'en-tête {colorOpen ? '▲' : '▼'}</>
              : <><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '1px solid var(--border)', flexShrink: 0 }} /> Ajouter une couleur d'en-tête {colorOpen ? '▲' : '▼'}</>
            }
          </button>
          {colorOpen && (
            <div style={{ marginTop: 8 }}>
              <ColorPicker value={ac} onChange={v => onUpdate({ accentColor: v })} />
            </div>
          )}
        </div>
      </div>

      {/* Champs */}
      {section.fields.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--surface)' }}>
          {section.fields.map((field, fi) => (
            <FieldEditor
              key={field.id}
              field={field}
              index={fi}
              total={section.fields.length}
              onUpdate={p => onUpdateField(field.id, p)}
              onRemove={() => onRemoveField(field.id)}
              onDuplicate={() => onDuplicateField(field.id)}
              onMoveUp={() => onMoveField(field.id, -1)}
              onMoveDown={() => onMoveField(field.id, 1)}
              onSetOption={(i, v) => onSetOption(field.id, i, v)}
              onAddOption={() => onAddOption(field.id)}
              onRemoveOption={i => onRemoveOption(field.id, i)}
            />
          ))}
        </div>
      )}

      {section.fields.length === 0 && (
        <div style={{ padding: '16px 20px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
          Aucun champ dans cette section — ajoutez-en un ci-dessous.
        </div>
      )}

      {/* Aperçu disposition */}
      <SectionLayoutPreview fields={section.fields} onReorder={onReorder} />

      {/* Ajout champ */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-soft)', background: 'var(--bg)', borderRadius: '0 0 11px 11px', position: 'relative' }}>
        <AddFieldPicker onAdd={onAddField} />
      </div>
    </div>
  )
}

// ── FieldEditor ───────────────────────────────────────────────────────────────

interface FieldEditorProps {
  field: PluginField; index: number; total: number
  onUpdate:      (p: Partial<PluginField>) => void
  onRemove:      () => void
  onDuplicate:   () => void
  onMoveUp:      () => void
  onMoveDown:    () => void
  onSetOption:   (idx: number, val: string) => void
  onAddOption:   () => void
  onRemoveOption:(idx: number) => void
}

function FieldEditor({ field, index, total, onUpdate, onRemove, onDuplicate, onMoveUp, onMoveDown,
  onSetOption, onAddOption, onRemoveOption }: FieldEditorProps) {

  const isSep = field.type === 'separator'
  const color = typeColor(field.type)

  return (
    <div style={{ background: 'var(--bg)', borderTop: index > 0 ? '1px solid var(--border-soft)' : 'none' }}>

      {/* ── Ligne principale ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
        {/* Déplacement */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" style={{ padding: '1px 5px', opacity: index === 0 ? .3 : 1 }}
            onClick={onMoveUp} disabled={index === 0} title="Monter">▲</button>
          <button className="btn btn-secondary btn-sm" style={{ padding: '1px 5px', opacity: index === total - 1 ? .3 : 1 }}
            onClick={onMoveDown} disabled={index === total - 1} title="Descendre">▼</button>
        </div>

        {/* Badge type (cliquable = picker) */}
        <TypePicker
          current={field.type}
          onSelect={t => onUpdate({
            type: t,
            options: hasOptions(t) ? (field.options?.length ? field.options : ['', '']) : undefined,
            min: t === 'rating' ? (field.min ?? 0) : undefined,
            max: t === 'rating' ? (field.max ?? 10) : undefined,
          })}
        />

        {/* Intitulé du champ */}
        {isSep ? (
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Ligne de séparation — aucune donnée enregistrée
          </span>
        ) : (
          <input
            type="text"
            value={field.label}
            onChange={e => onUpdate({ label: e.target.value })}
            placeholder="Intitulé du champ — ex : Localisation de la douleur, Intensité (0-10)…"
            style={{
              flex: 1, border: '1.5px solid var(--border)', background: 'var(--input-bg)',
              borderRadius: 6, padding: '5px 10px', fontWeight: 600,
              fontSize: 13, outline: 'none', color: 'var(--text)',
            }}
          />
        )}

        {/* Dupliquer + Supprimer */}
        <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0, padding: '2px 8px', fontSize: 12 }}
          onClick={onDuplicate} title="Dupliquer ce champ">⧉</button>
        <button className="btn btn-secondary btn-sm" style={{ color: 'var(--red)', flexShrink: 0, padding: '2px 8px' }}
          onClick={onRemove} title="Supprimer ce champ">✕</button>
      </div>

      {/* ── Détails (mise en page + placeholder + options) ── */}
      {!isSep && (
        <div style={{ padding: '0 16px 12px', paddingLeft: 80, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Mise en page */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>Mise en page :</span>
            {WIDTH_OPTIONS.map(w => {
              const active = (field.width || 'full') === w.value
              return (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => onUpdate({ width: w.value })}
                  title={w.cols === 1 ? '1 champ par ligne' : `${w.cols} champs côte à côte (si consécutifs)`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px',
                    border: `1.5px solid ${active ? color : 'var(--border)'}`,
                    borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: active ? 700 : 400,
                    background: active ? color + '15' : 'var(--surface)',
                    color: active ? color : 'var(--text-muted)', transition: 'all .15s',
                  }}
                >
                  {/* mini grille visuelle */}
                  <span style={{ display: 'inline-flex', gap: 2 }}>
                    {Array.from({ length: w.cols }).map((_, i) => (
                      <span key={i} style={{ display: 'inline-block', height: 8, width: w.cols === 1 ? 28 : w.cols === 2 ? 12 : 8, borderRadius: 2, background: active ? color : 'var(--border)' }} />
                    ))}
                  </span>
                  {w.label}
                </button>
              )
            })}
            {(field.width === 'half' || field.width === 'third') && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                ↳ {field.width === 'half' ? '2' : '3'} champs consécutifs de même largeur se mettent côte à côte
              </span>
            )}
          </div>

          {/* Requis + Placeholder */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            {field.type !== 'checkbox' && field.type !== 'separator' && (
              <input
                type="text"
                value={field.placeholder || ''}
                onChange={e => onUpdate({ placeholder: e.target.value })}
                placeholder="Texte dans le champ vide (optionnel) — ex : Précisez la zone…"
                style={{ flex: 1, minWidth: 200, fontSize: 12, color: 'var(--text-muted)', background: 'var(--input-bg)', border: '1.5px solid var(--border)', borderRadius: 6, padding: '5px 10px' }}
              />
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none', flexShrink: 0, padding: '5px 0' }}>
              <input
                type="checkbox"
                checked={field.required || false}
                onChange={e => onUpdate({ required: e.target.checked || undefined })}
                style={{ accentColor: color, width: 14, height: 14 }}
              />
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Champ obligatoire *</span>
            </label>
          </div>

          {/* Texte d'aide (hint) */}
          <input
            type="text"
            value={field.hint || ''}
            onChange={e => onUpdate({ hint: e.target.value || undefined })}
            placeholder="💬 Texte d'aide affiché sous le champ rempli — ex : Évaluez de 0 (aucune douleur) à 10 (insupportable)"
            style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--input-bg)', border: '1.5px dashed var(--border)', borderRadius: 6, padding: '5px 10px', fontStyle: 'italic' }}
          />

          {/* Min / Max */}
          {hasRange(field.type) && (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Valeur min
                <input type="number" value={field.min ?? (field.type === 'rating' ? 0 : '')}
                  onChange={e => onUpdate({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
                  style={{ width: 68 }} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Valeur max
                <input type="number" value={field.max ?? (field.type === 'rating' ? 10 : '')}
                  onChange={e => onUpdate({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
                  style={{ width: 68 }} />
              </label>
            </div>
          )}

          {/* Options pour select / radio / checkboxgroup */}
          {hasOptions(field.type) && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Options de sélection
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(field.options || []).map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                    <input
                      type="text"
                      value={opt}
                      onChange={e => onSetOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}…`}
                      style={{ flex: 1, fontSize: 13 }}
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--red)', padding: '2px 7px' }}
                      onClick={() => onRemoveOption(i)}
                      disabled={(field.options || []).length <= 2}
                      title="Supprimer"
                    >✕</button>
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, fontSize: 12 }} onClick={onAddOption}>
                + Ajouter une option
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
