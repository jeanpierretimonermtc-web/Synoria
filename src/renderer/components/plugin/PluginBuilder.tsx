import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import type { PluginDefinition, PluginSection, PluginField, PluginFieldType, PluginCondition, PluginConditionOperator } from '../../../shared/pluginTypes'
import {
  PLUGIN_TYPE_REGISTRY,
  getTypeEntry,
  isPluginModule,
  pluginTypeHasOptions,
  pluginTypeHasRange,
  pluginTypeColor,
} from '../../../shared/pluginRegistry'
import { validatePluginDefinition } from '../../../shared/pluginValidator'
import {
  PLUGIN_BLOCK_REGISTRY,
  BLOCK_CATEGORY_META,
  BLOCK_CATEGORY_ORDER,
  getBlocksByCategory,
  type BlockCategory,
  type PluginBlock,
} from '../../../shared/pluginBlockRegistry'
import PluginFormRenderer from './PluginFormRenderer'
import { PluginFieldSummary } from './PluginFieldSummary'

// ── Emojis catégorisés ────────────────────────────────────────────────────────

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Corps & Anatomie',   emojis: ['🧠', '🫀', '🫁', '🦴', '🦷', '👁️', '👂', '👃', '🤲', '🦵', '🦶', '🫶', '🩻', '🧬'] },
  { label: 'Santé & Soin',       emojis: ['🩺', '💊', '🩹', '💉', '🌡️', '🔬', '🏥', '⚕️', '🩸', '🧪', '💆', '🧘', '🛁', '🪷'] },
  { label: 'Thérapie & MTC',     emojis: ['🌿', '🍃', '🌱', '☯️', '🌀', '⚡', '💫', '🌸', '🌺', '🌻', '🍀', '🌾', '🌊', '🔥'] },
  { label: 'Formulaire & Notes', emojis: ['📋', '📝', '✍️', '📊', '📈', '📌', '🗂️', '📁', '🔖', '🔍', '📏', '🖊️', '📐', '💬'] },
  { label: 'Évaluation',         emojis: ['⭐', '🎯', '✅', '❌', '⚠️', '💡', '🔑', '🏆', '❤️', '💙', '🟢', '🟡', '🔴', '⚖️'] },
]

// ── Listes dérivées du registre ───────────────────────────────────────────────

const FIELD_TYPES  = PLUGIN_TYPE_REGISTRY.filter(e => !e.isModule)
const MODULE_TYPES = PLUGIN_TYPE_REGISTRY.filter(e => e.isModule)

function isModule(t: PluginFieldType): boolean { return isPluginModule(t) }

// ── Aperçus statiques des modules ─────────────────────────────────────────────

function ModulePreviewSystemes() {
  const cards = [
    { l: 'Cœur / IG',    c: '#c94040' },
    { l: 'Poumon / GI',  c: '#6a7f94' },
    { l: 'Foie / VB',    c: '#4e8a5e' },
    { l: 'Rein / Vess.', c: '#2e6ca8' },
    { l: 'Rate / Esto.', c: '#b8841e' },
    { l: 'Mental / SJ',  c: '#7C3AED' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Interrogatoire clinique complet — 14 systèmes
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {cards.map(c => (
          <div key={c.l} style={{ background: c.c + '12', border: `1px solid ${c.c}44`, borderRadius: 6, padding: '5px 7px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: c.c }}>{c.l}</div>
            <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
              {[0,1,2].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: c.c + '30' }} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ModulePreviewFiveElements() {
  const els = [
    { l: 'Bois', e: '🌿', c: '#4e8a5e' },
    { l: 'Feu',  e: '🔥', c: '#c94040' },
    { l: 'Terre',e: '🌍', c: '#b8841e' },
    { l: 'Métal',e: '⚙️', c: '#6a7f94' },
    { l: 'Eau',  e: '💧', c: '#2e6ca8' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        Tableau de correspondances · cliquer pour annoter
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {els.map(el => (
          <div key={el.l} style={{ flex: 1, borderRadius: 7, padding: '6px 4px', textAlign: 'center', border: `1.5px solid ${el.c}44`, background: el.c + '10' }}>
            <div style={{ fontSize: 14 }}>{el.e}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: el.c, marginTop: 2 }}>{el.l}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
              {[0,1,2].map(i => <div key={i} style={{ height: 3, borderRadius: 1, background: el.c + '30' }} />)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 26, borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', padding: '0 8px' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Synthèse générale…</span>
      </div>
    </div>
  )
}

function ModulePreviewTonguePulse() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '7px 8px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6a47c4', marginBottom: 5 }}>👅 Langue</div>
        <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
          {['#d4a78c','#d48090','#c94040','#8b4a8b','#4a6a9b'].map(c => (
            <div key={c} style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: '2px solid var(--border)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {['Blanc','Jaune','Épais','Sèche','Fissurée'].map(l => (
            <div key={l} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{l}</div>
          ))}
        </div>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 7, padding: '7px 8px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6a47c4', marginBottom: 5 }}>💓 Pouls — 6 positions</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          {['Cun / Cœur','Cun / Poumon','Guan / Foie','Guan / Rate','Chi / Reins Yin','Chi / Reins Yang'].map(l => (
            <div key={l} style={{ fontSize: 9, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'var(--surface)' }}>{l}</div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 5 }}>
          29 qualités · Flottant · Profond · Glissant…
        </div>
      </div>
    </div>
  )
}

function ModulePreviewOrthoTests() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, lineHeight: 1.4 }}>
        Liste dynamique — le praticien saisit ses propres tests
      </div>
      {[
        { name: 'Lasègue',  c: '#c94040', label: 'Positif'       },
        { name: 'Jobe',     c: '#4e8a5e', label: 'Négatif'       },
        { name: 'Patrick',  c: '#b8841e', label: 'Non concluant' },
      ].map(t => (
        <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 6, border: `1px solid ${t.c}44`, background: t.c + '08' }}>
          <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{t.name}</span>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: t.c + '22', color: t.c }}>{t.label}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>💬</span>
        </div>
      ))}
      <div style={{ height: 24, borderRadius: 5, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+ Ajouter un test (Neer, Spurling, Finkelstein…)</span>
      </div>
    </div>
  )
}

function ModulePreviewPosture() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 2 }}>
        {['ANT','POST','GAU','DRO'].map((v, i) => (
          <div key={v} style={{
            flex: 1, textAlign: 'center', fontSize: 9, fontWeight: 700, padding: '3px 0', borderRadius: 4,
            border: `1px solid ${i === 0 ? 'var(--accent)' : 'var(--border)'}`,
            background: i === 0 ? 'var(--accent-light)' : 'transparent',
            color: i === 0 ? 'var(--accent)' : 'var(--text-muted)',
          }}>{v}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{
          width: 48, flexShrink: 0, borderRadius: 6, overflow: 'hidden',
          border: '1px solid var(--border)', background: 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80,
        }}>
          <span style={{ fontSize: 34, opacity: 0.55 }}>🧍</span>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {['Tête inclinée droite','Épaule droite plus haute','Bassin incliné droite','Genou valgum droit'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, border: '1.5px solid var(--border)', flexShrink: 0 }} />
              {f}
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Image anatomique 3D · 4 vues</div>
    </div>
  )
}

const MODULE_PREVIEW_MAP: Partial<Record<PluginFieldType, () => React.ReactElement>> = {
  mtc_systemes:      () => <ModulePreviewSystemes />,
  mtc_five_elements: () => <ModulePreviewFiveElements />,
  mtc_tongue_pulse:  () => <ModulePreviewTonguePulse />,
  osteo_ortho_tests: () => <ModulePreviewOrthoTests />,
  osteo_posture:     () => <ModulePreviewPosture />,
}

// ── Panneau preview module ─────────────────────────────────────────────────────

function ModulePreviewPanel({ modType, offsetTop }: { modType: PluginFieldType; offsetTop?: number }) {
  const m = MODULE_TYPES.find(x => x.type === modType)
  const renderFn = MODULE_PREVIEW_MAP[modType]
  if (!m || !renderFn) return null
  return (
    <div style={{
      position: 'absolute', left: 'calc(100% + 8px)', top: offsetTop ?? 0, zIndex: 201,
      width: 270, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.18)', padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-soft)' }}>
        <span style={{ fontSize: 20 }}>{m.icon}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{m.label}</div>
          <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: m.color + '22', color: m.color }}>{m.specialty}</span>
        </div>
      </div>
      {renderFn()}
    </div>
  )
}

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

function hasOptions(t: PluginFieldType) { return pluginTypeHasOptions(t) }
function hasRange(t: PluginFieldType)   { return pluginTypeHasRange(t) }
function typeColor(t: PluginFieldType)  { return pluginTypeColor(t) }
function typeMeta(t: PluginFieldType)   { return getTypeEntry(t) ?? { icon: '?', label: t, color: '#9CA3AF', desc: '', isModule: false, isSeparator: false, hasOptions: false, hasRange: false } }

function genId(): string {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
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
    if (row.some(f => f.type === 'separator' || isModule(f.type))) return false
    const draggedType = fields.find(f => f.id === draggingId)?.type
    if (!draggedType) return false
    if (draggedType === 'separator' || isModule(draggedType)) return false
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
          const isModRow = rowFields.length === 1 && isModule(rowFields[0].type)

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
              ) : isModRow ? (
                /* Module pré-conçu — bloc pleine largeur */
                (() => {
                  const f = rowFields[0]
                  const m = MODULE_TYPES.find(mt => mt.type === f.type)
                  const c = m?.color ?? '#9CA3AF'
                  const fading = f.id === draggingId
                  return (
                    <div
                      draggable
                      onDragStart={e => { setDraggingId(f.id); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation() }}
                      onDragEnd={() => { setDraggingId(null); setDropZone(null) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5,
                        padding: '6px 12px', borderRadius: 8, cursor: 'grab',
                        border: `1.5px solid ${c}44`,
                        background: c + '10', opacity: fading ? .3 : 1,
                        userSelect: 'none', transition: 'all .12s',
                      }}
                    >
                      <span style={{ fontSize: 11, opacity: .5, flexShrink: 0 }}>⠿</span>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{m?.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c, flex: 1 }}>{f.label || m?.label}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: c + '22', color: c }}>
                        {m?.specialty}
                      </span>
                    </div>
                  )
                })()
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
  const [hoveredModType, setHoveredModType] = useState<PluginFieldType | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const meta = typeMeta(current)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const renderBtn = (ft: { type: PluginFieldType; icon: string; label: string; desc: string; color: string }, badge?: string) => (
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
      <span style={{ flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{ft.label}</span>
          {badge && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: ft.color + '22', color: ft.color }}>{badge}</span>}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 1 }}>{ft.desc}</span>
      </span>
    </button>
  )

  const renderModuleBtn = (m: typeof MODULE_TYPES[0]) => (
    <div key={m.type} onMouseEnter={() => setHoveredModType(m.type)} onMouseLeave={() => setHoveredModType(null)}>
      {renderBtn(m, m.specialty)}
    </div>
  )

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Changer le type"
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
          padding: 8, width: 440, maxHeight: 520, overflowY: 'auto',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            {FIELD_TYPES.map(ft => renderBtn(ft))}
          </div>
          <div style={{ margin: '8px 0 4px', padding: '6px 8px 2px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-muted)', borderTop: '1px solid var(--border-soft)' }}>
            Blocs spécialisés — survolez pour aperçu
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {MODULE_TYPES.map(renderModuleBtn)}
          </div>
          {hoveredModType && <ModulePreviewPanel modType={hoveredModType} />}
        </div>
      )}
    </div>
  )
}

// ── AddFieldPicker ────────────────────────────────────────────────────────────

function AddFieldPicker({ onAdd }: { onAdd: (t: PluginFieldType) => void }) {
  const [open, setOpen] = useState(false)
  const [hoveredModType, setHoveredModType] = useState<PluginFieldType | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const renderBtn = (ft: { type: PluginFieldType; icon: string; label: string; desc: string; color: string }, badge?: string) => (
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
      <span style={{ flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{ft.label}</span>
          {badge && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: ft.color + '22', color: ft.color }}>{badge}</span>}
        </span>
        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 1 }}>{ft.desc}</span>
      </span>
    </button>
  )

  const renderModuleBtn = (m: typeof MODULE_TYPES[0]) => (
    <div key={m.type} onMouseEnter={() => setHoveredModType(m.type)} onMouseLeave={() => setHoveredModType(null)}>
      {renderBtn(m, m.specialty)}
    </div>
  )

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(v => !v)}
        style={{ borderStyle: 'dashed', gap: 6 }}
      >
        + Ajouter une question ou un bloc
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, zIndex: 50, marginBottom: 6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 -8px 40px rgba(0,0,0,.18)',
          padding: 8, width: 440, maxHeight: 520, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-muted)', padding: '2px 8px 6px' }}>
            Champs
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            {FIELD_TYPES.map(ft => renderBtn(ft))}
          </div>
          <div style={{ margin: '8px 0 4px', padding: '6px 8px 2px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-muted)', borderTop: '1px solid var(--border-soft)' }}>
            Blocs spécialisés — survolez pour aperçu
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {MODULE_TYPES.map(renderModuleBtn)}
          </div>
          {hoveredModType && <ModulePreviewPanel modType={hoveredModType} offsetTop={-80} />}
        </div>
      )}
    </div>
  )
}

// ── Templates de départ ───────────────────────────────────────────────────────

interface PluginTemplate {
  name: string; icon: string; desc: string; specialty: string
  sections: Omit<PluginSection, 'id'>[]
}

const PLUGIN_TEMPLATES: PluginTemplate[] = [
  {
    name: 'Formulaire simple', icon: '📋', specialty: 'Généraliste',
    desc: 'Une section libre avec un champ de texte enrichi — idéal comme point de départ.',
    sections: [
      { title: 'Anamnèse', icon: '📝', fields: [
        { id: '', type: 'richtext', label: 'Notes de consultation', width: 'full' },
      ]},
    ],
  },
  {
    name: 'Bilan ostéo standard', icon: '🦴', specialty: 'Ostéopathie',
    desc: 'Anamnèse, examen, tests orthopédiques (module), bilan postural (module) et traitement.',
    sections: [
      { title: 'Anamnèse', icon: '📝', fields: [
        { id: '', type: 'richtext',  label: 'Motif de consultation', width: 'full' },
        { id: '', type: 'richtext',  label: 'Antécédents', width: 'half' },
        { id: '', type: 'richtext',  label: 'Traitements en cours', width: 'half' },
      ]},
      { title: 'Examen clinique', icon: '🔍', fields: [
        { id: '', type: 'textarea',  label: 'Examen général', width: 'full' },
        { id: '', type: 'rating',    label: 'Intensité de la douleur', min: 0, max: 10, width: 'half' },
        { id: '', type: 'tags',      label: 'Zones douloureuses', width: 'half' },
      ]},
      { title: 'Tests orthopédiques', icon: '🦴', fields: [
        { id: '', type: 'osteo_ortho_tests', label: 'Tests orthopédiques', width: 'full' },
      ]},
      { title: 'Bilan postural', icon: '🧍', fields: [
        { id: '', type: 'osteo_posture', label: 'Bilan postural', width: 'full' },
      ]},
      { title: 'Traitement', icon: '🩺', fields: [
        { id: '', type: 'richtext',  label: 'Techniques utilisées', width: 'full' },
        { id: '', type: 'textarea',  label: 'Conseils & exercices', width: 'full' },
      ]},
    ],
  },
  {
    name: 'Suivi nutrition', icon: '🥦', specialty: 'Nutrition',
    desc: 'Mode de vie, alimentation, compléments et objectifs. Idéal pour un suivi nutritionnel.',
    sections: [
      { title: 'Mode de vie', icon: '🌿', fields: [
        { id: '', type: 'rating',       label: 'Qualité du sommeil', min: 0, max: 10, width: 'third' },
        { id: '', type: 'rating',       label: 'Niveau de stress', min: 0, max: 10, width: 'third' },
        { id: '', type: 'rating',       label: 'Activité physique', min: 0, max: 10, width: 'third' },
        { id: '', type: 'textarea',     label: 'Observations', width: 'full' },
      ]},
      { title: 'Alimentation & Habitudes', icon: '🍽️', fields: [
        { id: '', type: 'checkboxgroup', label: 'Régimes / intolérances', width: 'full',
          options: ['Sans gluten','Sans lactose','Végétarien','Végétalien','Sans sucre','Faible en sel'] },
        { id: '', type: 'richtext',     label: 'Journal alimentaire', width: 'full' },
        { id: '', type: 'number',       label: 'Poids (kg)', width: 'third' },
        { id: '', type: 'number',       label: 'Taille (cm)', width: 'third' },
        { id: '', type: 'number',       label: 'IMC', width: 'third' },
      ]},
      { title: 'Compléments & Suppléments', icon: '💊', fields: [
        { id: '', type: 'tags',     label: 'Compléments actuels', width: 'full' },
        { id: '', type: 'textarea', label: 'Protocole recommandé', width: 'full' },
      ]},
      { title: 'Objectifs & Plan', icon: '🎯', fields: [
        { id: '', type: 'richtext', label: 'Objectifs du patient', width: 'full' },
        { id: '', type: 'richtext', label: 'Plan alimentaire proposé', width: 'full' },
        { id: '', type: 'date',     label: 'Prochain bilan', width: 'half' },
        { id: '', type: 'rating',   label: 'Motivation (auto-évaluation)', min: 0, max: 10, width: 'half' },
      ]},
    ],
  },
  {
    name: 'Psychologie / Coaching', icon: '🧠', specialty: 'Psychologie',
    desc: 'Motif, ressources, objectifs SMART et suivi de séance pour un accompagnement psychologique.',
    sections: [
      { title: 'Motif & Contexte', icon: '🗣️', fields: [
        { id: '', type: 'richtext', label: 'Motif de consultation', width: 'full' },
        { id: '', type: 'textarea', label: 'Contexte de vie actuel', width: 'full' },
        { id: '', type: 'rating',   label: 'Niveau de détresse (0–10)', min: 0, max: 10, width: 'half' },
        { id: '', type: 'rating',   label: 'Ressources ressenties (0–10)', min: 0, max: 10, width: 'half' },
      ]},
      { title: 'Ressources & Freins', icon: '⚖️', fields: [
        { id: '', type: 'tags',     label: 'Ressources identifiées', width: 'half' },
        { id: '', type: 'tags',     label: 'Freins / obstacles', width: 'half' },
        { id: '', type: 'richtext', label: 'Observations cliniques', width: 'full' },
      ]},
      { title: 'Objectifs', icon: '🎯', fields: [
        { id: '', type: 'richtext', label: 'Objectifs de la séance', width: 'full' },
        { id: '', type: 'richtext', label: 'Objectifs à long terme', width: 'full' },
        { id: '', type: 'checkboxgroup', label: 'Outils utilisés', width: 'full',
          options: ['TCC','EMDR','Pleine conscience','ACT','Hypnose','PNL','Thérapie narrative','Autre'] },
      ]},
      { title: 'Bilan de séance', icon: '📊', fields: [
        { id: '', type: 'richtext', label: 'Ce qui a émergé', width: 'full' },
        { id: '', type: 'textarea', label: 'Travail entre les séances (homework)', width: 'full' },
        { id: '', type: 'rating',   label: 'Qualité de la séance (ressenti praticien)', min: 0, max: 10, width: 'half' },
      ]},
    ],
  },
]

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  initial?:          PluginDefinition
  onSave:            (p: PluginDefinition) => Promise<void>
  onCancel:          () => void
  onSaveToLibrary?:  (p: PluginDefinition) => Promise<void>
  onPreviewChange?:  (p: PluginDefinition) => void
}

export default function PluginBuilder({ initial, onSave, onCancel, onSaveToLibrary, onPreviewChange }: Props) {
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
  const [previewMode,     setPreviewMode]     = useState<'form' | 'summary'>('form')
  const [libraryEntries,  setLibraryEntries]  = useState<{ plugin: PluginDefinition; savedAt: string }[]>([])
  const [showImportPanel,    setShowImportPanel]    = useState(false)
  const [showTemplates,      setShowTemplates]      = useState(false)
  const [showBlockPicker,    setShowBlockPicker]    = useState(false)
  const [blockPickerCategory, setBlockPickerCategory] = useState<BlockCategory>('general')
  const importPanelRef  = useRef<HTMLDivElement>(null)
  const blockPickerRef  = useRef<HTMLDivElement>(null)
  const [previewData,       setPreviewData]       = useState<Record<string, any>>({})
  const [showCopyModal,     setShowCopyModal]     = useState(false)
  const [copyName,          setCopyName]          = useState('')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    () => initial?.sections?.[0]?.id ?? null
  )
  const [narrowScreen, setNarrowScreen] = useState(window.innerWidth < 900)

  const isNativePlugin = !!initial?.isNative

  // ── Historique undo/redo ─────────────────────────────────────────────────
  const historyRef    = useRef<PluginSection[][]>([])
  const futureRef     = useRef<PluginSection[][]>([])
  const [historyTick, setHistoryTick] = useState(0)

  const push = useCallback((updater: PluginSection[] | ((prev: PluginSection[]) => PluginSection[])) => {
    setSections(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      historyRef.current = [...historyRef.current.slice(-99), prev]
      futureRef.current  = []
      return next
    })
    setHistoryTick(t => t + 1)
  }, [])

  const undo = useCallback(() => {
    const history = historyRef.current
    if (!history.length) return
    const prev = history[history.length - 1]
    historyRef.current = history.slice(0, -1)
    setSections(cur => { futureRef.current = [cur, ...futureRef.current.slice(0, 99)]; return prev })
    setHistoryTick(t => t + 1)
  }, [])

  const redo = useCallback(() => {
    const future = futureRef.current
    if (!future.length) return
    const next = future[0]
    futureRef.current = future.slice(1)
    setSections(cur => { historyRef.current = [...historyRef.current.slice(-99), cur]; return next })
    setHistoryTick(t => t + 1)
  }, [])

  const canUndo = historyTick >= 0 && historyRef.current.length > 0
  const canRedo = historyTick >= 0 && futureRef.current.length > 0

  const buildPlugin = useCallback((): PluginDefinition => ({
    id:            initial?.id || ('custom_' + Date.now().toString(36)),
    name:          name.trim(),
    specialty:     specialty.trim(),
    version:       initial?.version || '1.0.0',
    icon:          icon || '📋',
    schemaVersion: 1,
    ...(initial?.category          && { category:          initial.category }),
    ...(initial?.tags?.length      && { tags:              initial.tags }),
    ...(initial?.status            && { status:            initial.status }),
    ...(initial?.synoriaMinVersion && { synoriaMinVersion: initial.synoriaMinVersion }),
    createdAt:     initial?.createdAt || new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
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
  const addSection = () => {
    const newId = genId()
    push(prev => [...prev, { id: newId, title: '', icon: '🗂️', fields: [] }])
    setSelectedSectionId(newId)
  }
  const removeSection = (id: string) =>
    push(prev => prev.filter(s => s.id !== id))
  const updateSection = (id: string, patch: Partial<Pick<PluginSection, 'title' | 'icon' | 'accentColor'>>) =>
    push(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  const moveSection = (id: string, dir: -1 | 1) =>
    push(prev => {
      const i = prev.findIndex(s => s.id === id)
      if (i < 0 || i + dir < 0 || i + dir >= prev.length) return prev
      const a = [...prev]; [a[i], a[i + dir]] = [a[i + dir], a[i]]; return a
    })

  // ── Ops champs ────────────────────────────────────────────────────────────
  const addField = (sectionId: string, type: PluginFieldType) => {
    const moduleMeta = MODULE_TYPES.find(m => m.type === type)
    const field: PluginField = {
      id: genId(), type,
      label: moduleMeta ? moduleMeta.label : '',
      width: type === 'mtc_aide_interrogatoire' ? 'half' : 'full',
      options: hasOptions(type) ? ['', ''] : undefined,
      min: type === 'rating' ? 0 : undefined,
      max: type === 'rating' ? 10 : undefined,
    }
    push(prev => prev.map(s => s.id === sectionId ? { ...s, fields: [...s.fields, field] } : s))
  }
  const removeField = (sectionId: string, fid: string) =>
    push(prev => prev.map(s => s.id === sectionId ? { ...s, fields: s.fields.filter(f => f.id !== fid) } : s))
  const updateField = (sectionId: string, fid: string, patch: Partial<PluginField>) =>
    push(prev => prev.map(s =>
      s.id === sectionId ? { ...s, fields: s.fields.map(f => f.id === fid ? { ...f, ...patch } : f) } : s
    ))
  const moveField = (sectionId: string, fid: string, dir: -1 | 1) =>
    push(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      const i = s.fields.findIndex(f => f.id === fid)
      if (i < 0 || i + dir < 0 || i + dir >= s.fields.length) return s
      const a = [...s.fields]; [a[i], a[i + dir]] = [a[i + dir], a[i]]; return { ...s, fields: a }
    }))

  const duplicateField = (sectionId: string, fieldId: string) =>
    push(prev => prev.map(s => {
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
    push(prev => prev.map(s => s.id === sectionId ? { ...s, fields: newFields } : s))

  // ── Ops options ───────────────────────────────────────────────────────────
  const setOption = (sid: string, fid: string, idx: number, val: string) =>
    push(prev => prev.map(s => s.id !== sid ? s : {
      ...s, fields: s.fields.map(f => {
        if (f.id !== fid) return f
        const o = [...(f.options || [])]; o[idx] = val; return { ...f, options: o }
      })
    }))
  const addOption = (sid: string, fid: string) =>
    push(prev => prev.map(s => s.id !== sid ? s : {
      ...s, fields: s.fields.map(f => f.id !== fid ? f : { ...f, options: [...(f.options || []), ''] })
    }))
  const removeOption = (sid: string, fid: string, idx: number) =>
    push(prev => prev.map(s => s.id !== sid ? s : {
      ...s, fields: s.fields.map(f => f.id !== fid ? f : { ...f, options: (f.options || []).filter((_, i) => i !== idx) })
    }))

  useEffect(() => {
    window.mtcApi.pluginLibraryGet().then(lib => setLibraryEntries(lib)).catch(() => {})
  }, [])

  // Raccourcis clavier undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [undo, redo])

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

  useEffect(() => {
    if (!showBlockPicker) return
    const handler = (e: MouseEvent) => {
      if (blockPickerRef.current && !blockPickerRef.current.contains(e.target as Node)) {
        setShowBlockPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showBlockPicker])

  const importSection = useCallback((section: PluginSection) => {
    const newSection: PluginSection = {
      ...section,
      id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      fields: section.fields.map(f => ({ ...f, id: genId(), options: f.options ? [...f.options] : [] })),
    }
    push(prev => [...prev, newSection])
    setShowImportPanel(false)
    setSelectedSectionId(newSection.id)
  }, [push])

  const insertBlock = useCallback((block: PluginBlock, targetSectionId?: string) => {
    const newFields: PluginField[] = block.fields.map(f => ({
      ...f as any,
      id:      genId(),
      options: (f as any).options ? [...(f as any).options] : undefined,
    }))
    if (targetSectionId) {
      push(prev => prev.map(s =>
        s.id === targetSectionId ? { ...s, fields: [...s.fields, ...newFields] } : s
      ))
    } else {
      const newId = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4)
      push(prev => [...prev, {
        id:     newId,
        title:  block.title,
        icon:   block.icon,
        fields: newFields,
      }])
      setSelectedSectionId(newId)
    }
    setShowBlockPicker(false)
  }, [push])

  const loadTemplate = useCallback((tpl: PluginTemplate) => {
    const newSections: PluginSection[] = tpl.sections.map(s => ({
      ...s,
      id: genId(),
      fields: s.fields.map(f => ({ ...f, id: genId() })),
    }))
    push(newSections)
    if (!name.trim()) setName(tpl.name)
    if (!specialty.trim()) setSpecialty(tpl.specialty)
    if (!icon || icon === '📋') setIcon(tpl.icon)
    setShowTemplates(false)
    if (newSections.length > 0) setSelectedSectionId(newSections[0].id)
  }, [push, name, specialty, icon])

  // Liste plate de tous les champs non-séparateur du plugin (pour conditions)
  const allPluginFields = sections.flatMap(s =>
    s.fields.filter(f => f.type !== 'separator' && !isModule(f.type))
  )

  const handleSave = async () => {
    // Formulaire natif → forcer la copie sous un nouveau nom
    if (isNativePlugin) {
      setCopyName(name + ' (copie)')
      setShowCopyModal(true)
      return
    }
    if (!validationResult.valid) { setErrors(validationResult.errors); return }
    setErrors([])
    const built = buildPlugin()
    setSaving(true)
    try { await onSave(built) } finally { setSaving(false) }
  }

  const handleSaveAsCopy = async () => {
    const trimmed = copyName.trim()
    if (!trimmed) return
    const built  = buildPlugin()
    const copy   = {
      ...built,
      id:       'custom_' + Date.now().toString(36),
      name:     trimmed,
      isNative: undefined,
    }
    const result = validatePluginDefinition(copy as unknown)
    if (!result.valid) { setErrors(result.errors); setShowCopyModal(false); return }
    setErrors([])
    setSaving(true)
    setShowCopyModal(false)
    try { await onSave(copy as typeof built) } finally { setSaving(false) }
  }

  const handleSaveToLib = async () => {
    if (!onSaveToLibrary) return
    const built  = buildPlugin()
    const result = validatePluginDefinition(built as unknown)
    if (!result.valid) { setErrors(result.errors); return }
    setErrors([])
    setSavingLib(true)
    try { await onSaveToLibrary(built) } finally { setSavingLib(false) }
  }

  const previewPlugin = useMemo(() => buildPlugin(), [buildPlugin])
  const validationResult = useMemo(() => validatePluginDefinition(previewPlugin as unknown), [previewPlugin])

  const selectedSection = sections.find(s => s.id === selectedSectionId) ?? null

  useEffect(() => {
    onPreviewChange?.(previewPlugin)
  }, [previewPlugin, onPreviewChange])

  // Narrow screen — masquer le panneau droit sous 900px
  useEffect(() => {
    const handler = () => setNarrowScreen(window.innerWidth < 900)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const isDirty = historyRef.current.length > 0
  const handleCancel = () => {
    if (isDirty && !window.confirm('Des modifications non enregistrées seront perdues. Continuer ?')) return
    onCancel()
  }

  const handleRemoveSection = (id: string) => {
    if (selectedSectionId === id) {
      const idx = sections.findIndex(s => s.id === id)
      const remaining = sections.filter(s => s.id !== id)
      setSelectedSectionId(remaining.length > 0 ? (remaining[Math.min(idx, remaining.length - 1)]?.id ?? null) : null)
    }
    removeSection(id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Modal : enregistrer une copie du formulaire natif ── */}
      {showCopyModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowCopyModal(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: 12, padding: '28px 32px',
            width: 420, boxShadow: '0 8px 40px rgba(0,0,0,.25)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, color: 'var(--text)' }}>
              📋 Enregistrer une copie
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
              Ce formulaire est un modèle natif <strong>Synoria</strong> — il ne peut pas être modifié directement.
              Donnez un nom à votre copie pour la personnaliser librement.
            </div>
            <input
              className="input"
              autoFocus
              value={copyName}
              onChange={e => setCopyName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveAsCopy(); if (e.key === 'Escape') setShowCopyModal(false) }}
              placeholder="Nom de votre formulaire personnalisé…"
              style={{ width: '100%', marginBottom: 18 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowCopyModal(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSaveAsCopy} disabled={!copyName.trim() || saving}>
                {saving ? '⏳…' : '✅ Créer ma copie'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header sticky : identité + undo/redo + save ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--surface)',
        borderBottom: '2px solid var(--border)',
        boxShadow: '0 3px 10px rgba(0,0,0,.10)',
        borderRadius: '0 0 8px 8px',
        padding: '10px 14px',
        margin: '-10px -14px 0',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        {/* Identité formulaire */}
        <EmojiPicker value={icon} onChange={setIcon} size={22} />
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nom du formulaire *"
          autoFocus={!initial}
          style={{ fontWeight: 700, fontSize: 14, width: 200, borderRadius: 6, padding: '5px 10px', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
        />
        <input
          type="text"
          value={specialty}
          onChange={e => setSpecialty(e.target.value)}
          placeholder="Spécialité *"
          style={{ fontSize: 13, width: 160, borderRadius: 6, padding: '5px 10px', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', outline: 'none' }}
        />
        {isNativePlugin && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'color-mix(in srgb, var(--amber) 12%, var(--surface))',
            border: '1px solid color-mix(in srgb, var(--amber) 40%, transparent)',
            borderRadius: 6, padding: '3px 9px', fontSize: 11, color: 'var(--amber)',
          }}>
            🔒 Formulaire natif Synoria — vos modifications seront enregistrées sous un nouveau nom
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Undo / Redo */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={undo} disabled={!canUndo}
          title="Annuler (Ctrl+Z)"
          style={{ padding: '3px 9px', opacity: canUndo ? 1 : .4 }}
        >↩</button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={redo} disabled={!canRedo}
          title="Rétablir (Ctrl+Y)"
          style={{ padding: '3px 9px', opacity: canRedo ? 1 : .4 }}
        >↪</button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px' }} />
        <button className="btn btn-secondary btn-sm" onClick={handleCancel}>Annuler</button>
        {onSaveToLibrary && (
          <button className="btn btn-secondary btn-sm" onClick={handleSaveToLib} disabled={savingLib}>
            {savingLib ? '⏳…' : '📚 Biblio'}
          </button>
        )}
        {isNativePlugin ? (
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}
            title="Ce formulaire est natif Synoria — il sera enregistré sous un nouveau nom"
          >
            {saving ? '⏳…' : '📋 Enregistrer une copie'}
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? '⏳…' : '✅ Enregistrer'}
          </button>
        )}
      </div>

      {/* ── Layout 3 colonnes ── */}
      <div style={{ display: 'flex', height: 'calc(100vh - 120px)', overflow: 'hidden', marginTop: 8 }}>

        {/* ── Colonne gauche : navigation sections ── */}
        <div style={{
          width: 220, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg)',
        }}>
          <div style={{ padding: '10px 10px 6px', flex: 1 }}>
            {sections.length === 0 ? (
              <div style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Aucune section<br />Commencez par en créer une
              </div>
            ) : (
              sections.map((sec, si) => {
                const isSelected = sec.id === selectedSectionId
                const hasErrors = sec.title
                  ? validationResult.errors.some(e => e.toLowerCase().includes(sec.title!.toLowerCase()))
                  : false
                return (
                  <button
                    key={sec.id}
                    onClick={() => setSelectedSectionId(sec.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 12px', borderRadius: 8, marginBottom: 2,
                      border: 'none',
                      borderLeft: isSelected ? `3px solid var(--accent)` : '3px solid transparent',
                      background: isSelected ? 'var(--accent-light, rgba(99,102,241,.08))' : 'transparent',
                      color: isSelected ? 'var(--accent)' : 'var(--text)',
                      cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: isSelected ? 700 : 400,
                      transition: 'background .12s, border-color .12s',
                    }}
                  >
                    <span style={{ fontSize: 17, flexShrink: 0, lineHeight: 1 }}>{sec.icon || '🗂️'}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                      {sec.title || <em style={{ opacity: .5 }}>Sans titre</em>}
                    </span>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 10, flexShrink: 0,
                      background: isSelected ? 'var(--accent)' : 'var(--border)',
                      color: isSelected ? '#fff' : 'var(--text-muted)',
                      fontWeight: 600, minWidth: 18, textAlign: 'center',
                    }}>{sec.fields.length}</span>
                    {hasErrors && <span style={{ color: 'var(--red)', fontSize: 12, flexShrink: 0 }}>⚠</span>}
                  </button>
                )
              })
            )}
          </div>
          <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-soft)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <button
              className="btn btn-secondary"
              onClick={addSection}
              style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
            >
              + Nouvelle section
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowTemplates(v => !v)}
              style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
            >
              ⚡ Modèles
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setShowBlockPicker(v => !v)}
              style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
            >
              📦 Blocs métier
            </button>
            {libraryEntries.some(e => e.plugin.sections.length > 0) && (
              <button
                className="btn btn-secondary"
                onClick={() => { setShowImportPanel(v => !v); setShowBlockPicker(false) }}
                style={{ width: '100%', fontSize: 12, padding: '6px 8px' }}
              >
                📚 Bibliothèque
              </button>
            )}
          </div>
          {validationResult.errors.length > 0 && (
            <div style={{ margin: '0 8px 8px', background: '#FEF0F0', border: '1px solid #FCCDD0', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ fontWeight: 700, color: 'var(--red)', fontSize: 11, marginBottom: 4 }}>Erreurs :</div>
              <ul style={{ margin: 0, paddingLeft: 14 }}>
                {validationResult.errors.map((e, i) => (
                  <li key={i} style={{ fontSize: 11, color: 'var(--red)', lineHeight: 1.6 }}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {showImportPanel && (
            <div ref={importPanelRef} style={{
              margin: '0 8px 8px',
              border: '1px solid var(--border)', borderRadius: 10,
              background: 'var(--bg)', boxShadow: '0 4px 20px rgba(0,0,0,.13)',
              maxHeight: 280, overflowY: 'auto',
            }}>
              {libraryEntries.filter(e => e.plugin.sections.length > 0).map(entry => (
                <div key={entry.plugin.id}>
                  <div style={{
                    padding: '6px 12px 3px', fontSize: 10, fontWeight: 700,
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
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', textAlign: 'left', padding: '7px 12px 7px 20px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 12, color: 'var(--text)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{section.icon || '📋'}</span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{section.title}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
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

        {/* ── Colonne centrale : éditeur section sélectionnée ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {selectedSection ? (
            <SectionEditor
              section={selectedSection}
              index={sections.findIndex(s => s.id === selectedSectionId)}
              total={sections.length}
              allPluginFields={allPluginFields}
              onUpdate={p => updateSection(selectedSection.id, p)}
              onRemove={() => handleRemoveSection(selectedSection.id)}
              onMoveUp={() => moveSection(selectedSection.id, -1)}
              onMoveDown={() => moveSection(selectedSection.id, 1)}
              onAddField={t => addField(selectedSection.id, t)}
              onRemoveField={fid => removeField(selectedSection.id, fid)}
              onUpdateField={(fid, p) => updateField(selectedSection.id, fid, p)}
              onMoveField={(fid, d) => moveField(selectedSection.id, fid, d)}
              onReorder={newFields => reorderSectionFields(selectedSection.id, newFields)}
              onDuplicateField={fid => duplicateField(selectedSection.id, fid)}
              onSetOption={(fid, i, v) => setOption(selectedSection.id, fid, i, v)}
              onAddOption={fid => addOption(selectedSection.id, fid)}
              onRemoveOption={(fid, i) => removeOption(selectedSection.id, fid, i)}
            />
          ) : sections.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              border: '2px dashed var(--border)', borderRadius: 12,
              color: 'var(--text-muted)',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗂️</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: 'var(--text)' }}>
                Aucune section pour l'instant
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.7, maxWidth: 340, margin: '0 auto 16px' }}>
                Créez votre première section via le panneau gauche, ou partez d'un modèle.
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setShowTemplates(v => !v)}
                style={{ fontSize: 13 }}
              >
                ⚡ Partir d'un modèle
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
              Sélectionnez une section dans le panneau gauche pour l'éditer.
            </div>
          )}

          {/* Picker de modèles */}
          {showTemplates && (
            <div style={{
              border: '1.5px solid var(--accent)', borderRadius: 12,
              background: 'var(--bg)', padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>⚡ Choisir un modèle de départ</div>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowTemplates(false)} style={{ padding: '2px 8px' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {PLUGIN_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.name}
                    onClick={() => loadTemplate(tpl)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
                      padding: '12px 14px', border: '1.5px solid var(--border)', borderRadius: 10,
                      background: 'var(--surface)', cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color .15s, background .15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-light, rgba(99,102,241,.06))' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)' }}
                  >
                    <div style={{ fontSize: 22 }}>{tpl.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{tpl.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tpl.specialty} · {tpl.sections.length} section{tpl.sections.length > 1 ? 's' : ''}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Picker de blocs métier */}
          {showBlockPicker && (
            <div ref={blockPickerRef} style={{
              border: '1px solid var(--border)', borderRadius: 10,
              background: 'var(--bg)', boxShadow: '0 4px 24px rgba(0,0,0,.12)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 14px', borderBottom: '1px solid var(--border-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>📦 Blocs métier prêts à l'emploi</span>
                <button
                  onClick={() => setShowBlockPicker(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)', lineHeight: 1 }}
                >✕</button>
              </div>
              <div style={{ padding: '8px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border-soft)' }}>
                {BLOCK_CATEGORY_ORDER.map(cat => {
                  const meta = BLOCK_CATEGORY_META[cat]
                  const active = blockPickerCategory === cat
                  return (
                    <button
                      key={cat}
                      onClick={() => setBlockPickerCategory(cat)}
                      style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400,
                        border: `1.5px solid ${active ? meta.color : 'var(--border)'}`,
                        background: active ? meta.color + '18' : 'transparent',
                        color: active ? meta.color : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      {meta.icon} {meta.label}
                    </button>
                  )
                })}
              </div>
              <div style={{
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 10,
                maxHeight: 380,
                overflowY: 'auto',
              }}>
                {getBlocksByCategory(blockPickerCategory).map(block => (
                  <BlockCard key={block.id} block={block} sections={sections} onInsert={insertBlock} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne droite : aperçu en direct ── */}
        {!narrowScreen && (
          <div style={{
            width: 280, flexShrink: 0,
            borderLeft: '1px solid var(--border)',
            overflowY: 'auto',
            background: 'var(--bg)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '8px 12px', borderBottom: '1px solid var(--border-soft)',
              display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap',
            }}>
              {(['form', 'summary'] as const).map(m => (
                <button
                  key={m}
                  className="btn btn-secondary btn-sm"
                  style={previewMode === m ? { borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 700 } : {}}
                  onClick={() => setPreviewMode(m)}
                >
                  {m === 'form' ? '📝 Formulaire' : '📄 Résumé'}
                </button>
              ))}
              {previewMode === 'form' && Object.keys(previewData).length > 0 && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: 'auto', fontSize: 10 }}
                  onClick={() => setPreviewData({})}
                >
                  🔄
                </button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
              {!previewPlugin.name || previewPlugin.sections.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
                  Remplissez l'éditeur pour voir l'aperçu ici.
                </div>
              ) : previewMode === 'form' ? (
                <PluginFormRenderer
                  plugin={previewPlugin}
                  data={previewData}
                  onChange={(id, val) => setPreviewData(prev => ({ ...prev, [id]: val }))}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {previewPlugin.sections.map(section => {
                    const fields = section.fields.filter(f => f.type !== 'separator')
                    const hasData = fields.some(f => {
                      const v = previewData[f.id]
                      if (v === null || v === undefined || v === '') return false
                      if (Array.isArray(v)) return v.length > 0
                      return true
                    })
                    return (
                      <div key={section.id} className="card" style={{ padding: '12px 14px' }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700, marginBottom: hasData ? 10 : 0,
                          color: section.accentColor || 'var(--accent)',
                          paddingBottom: hasData ? 8 : 0,
                          borderBottom: hasData ? '1px solid var(--border-soft)' : 'none',
                        }}>
                          {section.icon && <span style={{ marginRight: 5 }}>{section.icon}</span>}
                          {section.title || <em style={{ opacity: .5 }}>Section sans titre</em>}
                        </div>
                        {hasData ? (
                          <div className="summary-grid">
                            {fields.map(field => (
                              <PluginFieldSummary key={field.id} field={field} value={previewData[field.id]} />
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', paddingTop: 4 }}>
                            Aucune donnée saisie dans cette section.
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── BlockCard ─────────────────────────────────────────────────────────────────

interface BlockCardProps {
  block:    PluginBlock
  sections: PluginSection[]
  onInsert: (block: PluginBlock, targetSectionId?: string) => void
}

function BlockCard({ block, sections, onInsert }: BlockCardProps) {
  const meta       = BLOCK_CATEGORY_META[block.category]
  const fieldCount = block.fields.length
  return (
    <div style={{
      border: `1.5px solid ${meta.color}30`,
      borderRadius: 9,
      background: meta.color + '0a',
      padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{block.icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{block.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {fieldCount} champ{fieldCount !== 1 ? 's' : ''}
            {block.specialty && <span style={{ marginLeft: 6, color: meta.color, fontWeight: 600 }}>{block.specialty}</span>}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, flexGrow: 1 }}>
        {block.description}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => onInsert(block)}
        >
          📑 Nouvelle section
        </button>
        {sections.length > 0 && (
          <select
            value=""
            onChange={e => { if (e.target.value) onInsert(block, e.target.value) }}
            style={{
              padding: '3px 7px', borderRadius: 6, fontSize: 12,
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', cursor: 'pointer', maxWidth: 160,
            }}
          >
            <option value="">↓ Dans une section…</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>
                {s.icon ? s.icon + ' ' : ''}{s.title || 'Section sans titre'}
              </option>
            ))}
          </select>
        )}
      </div>
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

// ── SectionEditor ─────────────────────────────────────────────────────────────

interface SectionEditorProps {
  section: PluginSection; index: number; total: number
  allPluginFields:  PluginField[]
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

function SectionEditor({ section, index, total, allPluginFields, onUpdate, onRemove, onMoveUp, onMoveDown,
  onAddField, onRemoveField, onUpdateField, onMoveField, onReorder, onDuplicateField,
  onSetOption, onAddOption, onRemoveOption }: SectionEditorProps) {

  const [colorOpen, setColorOpen] = useState(false)
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)
  const prevFieldCount = useRef(section.fields.length)
  const ac = section.accentColor

  // Auto-expand le dernier champ ajouté
  useEffect(() => {
    if (section.fields.length > prevFieldCount.current) {
      const last = section.fields[section.fields.length - 1]
      if (last) setExpandedFieldId(last.id)
    }
    prevFieldCount.current = section.fields.length
  }, [section.fields.length, section.fields])

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
          <EmojiPicker value={section.icon || '🗂️'} onChange={v => onUpdate({ icon: v })} size={20} />
          <input
            type="text"
            value={section.title}
            onChange={e => onUpdate({ title: e.target.value })}
            placeholder={`Nom de la section ${index + 1} — ex : Anamnèse, Examen clinique…`}
            style={{ flex: 1, fontWeight: 800, fontSize: 16, background: 'rgba(255,255,255,0.6)', border: '1.5px solid rgba(0,0,0,0.12)', borderRadius: 6, padding: '5px 12px', color: 'var(--text)', outline: 'none' }}
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
              allPluginFields={allPluginFields.filter(f => f.id !== field.id)}
              isExpanded={expandedFieldId === field.id}
              onToggleExpand={() => setExpandedFieldId(p => p === field.id ? null : field.id)}
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

      {/* Aperçu disposition (optionnel) */}
      {section.fields.length > 1 && (
        <SectionLayoutPreview fields={section.fields} onReorder={onReorder} />
      )}

      {/* Ajout champ */}
      <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-soft)', background: 'var(--bg)', borderRadius: '0 0 11px 11px', position: 'relative' }}>
        <AddFieldPicker onAdd={onAddField} />
      </div>
    </div>
  )
}

// ── FieldEditor ───────────────────────────────────────────────────────────────

// ── VisibleWhenEditor ─────────────────────────────────────────────────────────

const OPERATORS: { value: PluginConditionOperator; label: string; needsValue: boolean }[] = [
  { value: 'truthy',   label: 'est rempli',         needsValue: false },
  { value: 'falsy',    label: 'est vide',            needsValue: false },
  { value: 'eq',       label: 'est égal à',          needsValue: true  },
  { value: 'neq',      label: 'est différent de',    needsValue: true  },
  { value: 'includes', label: 'contient',            needsValue: true  },
  { value: 'excludes', label: 'ne contient pas',     needsValue: true  },
]

function VisibleWhenEditor({ conditions, allFields, onChange }: {
  conditions: PluginCondition[] | undefined
  allFields: PluginField[]
  onChange: (conds: PluginCondition[] | undefined) => void
}) {
  const active = conditions && conditions.length > 0

  const addCond = () => onChange([...(conditions || []), { fieldId: allFields[0]?.id || '', operator: 'truthy' }])
  const removeCond = (i: number) => {
    const next = (conditions || []).filter((_, j) => j !== i)
    onChange(next.length ? next : undefined)
  }
  const updateCond = (i: number, patch: Partial<PluginCondition>) => {
    const next = (conditions || []).map((c, j) => j === i ? { ...c, ...patch } : c)
    onChange(next)
  }

  return (
    <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 8, marginTop: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: active ? 8 : 0 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={active || false}
            onChange={e => e.target.checked ? addCond() : onChange(undefined)}
            style={{ width: 13, height: 13 }}
          />
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Affichage conditionnel</span>
        </label>
        {active && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>— visible seulement si :</span>
        )}
        {active && allFields.length > 0 && (conditions?.length ?? 0) < 3 && (
          <button className="btn btn-secondary btn-sm" onClick={addCond} style={{ fontSize: 11, padding: '1px 7px' }}>
            + Condition
          </button>
        )}
      </div>
      {active && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
          {allFields.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Ajoutez d'autres champs dans le formulaire pour créer des conditions.
            </span>
          ) : (conditions || []).map((cond, i) => {
            const op = OPERATORS.find(o => o.value === (cond.operator || 'truthy')) ?? OPERATORS[0]
            return (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {i > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', minWidth: 20 }}>ET</span>
                )}
                <select
                  value={cond.fieldId}
                  onChange={e => updateCond(i, { fieldId: e.target.value })}
                  style={{ fontSize: 12, flex: 1, minWidth: 100 }}
                >
                  {allFields.map(f => <option key={f.id} value={f.id}>{f.label || f.id}</option>)}
                </select>
                <select
                  value={cond.operator || 'truthy'}
                  onChange={e => updateCond(i, { operator: e.target.value as PluginConditionOperator, value: undefined })}
                  style={{ fontSize: 12, minWidth: 140 }}
                >
                  {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {op.needsValue && (
                  <input
                    type="text"
                    value={cond.value !== undefined ? String(cond.value) : ''}
                    onChange={e => updateCond(i, { value: e.target.value })}
                    placeholder="valeur…"
                    style={{ fontSize: 12, minWidth: 80, flex: 1 }}
                  />
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => removeCond(i)} style={{ color: 'var(--red)', padding: '1px 7px' }}>✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── FieldEditor ───────────────────────────────────────────────────────────────

interface FieldEditorProps {
  field: PluginField; index: number; total: number
  allPluginFields: PluginField[]
  isExpanded:     boolean
  onToggleExpand: () => void
  onUpdate:      (p: Partial<PluginField>) => void
  onRemove:      () => void
  onDuplicate:   () => void
  onMoveUp:      () => void
  onMoveDown:    () => void
  onSetOption:   (idx: number, val: string) => void
  onAddOption:   () => void
  onRemoveOption:(idx: number) => void
}

function FieldEditor({ field, index, total, allPluginFields, isExpanded, onToggleExpand, onUpdate, onRemove, onDuplicate, onMoveUp, onMoveDown,
  onSetOption, onAddOption, onRemoveOption }: FieldEditorProps) {

  const [showExportOpts, setShowExportOpts] = useState(false)

  const isSep = field.type === 'separator'
  const isMod = isModule(field.type)
  const color = typeColor(field.type)
  const modMeta = MODULE_TYPES.find(m => m.type === field.type)

  return (
    <div style={{
      background: isExpanded ? 'var(--surface)' : 'var(--bg)',
      borderTop: index > 0 ? '1px solid var(--border-soft)' : 'none',
      borderLeft: isExpanded ? `3px solid ${color}` : '3px solid transparent',
      transition: 'border-left-color .15s, background .15s',
    }}>

      {/* ── Ligne principale (toujours visible, compacte) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px' }}>

        {/* Déplacement vertical compact */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm"
            style={{ padding: '1px 4px', fontSize: 9, lineHeight: 1.3, opacity: index === 0 ? .3 : 1 }}
            onClick={onMoveUp} disabled={index === 0} title="Monter">▲</button>
          <button className="btn btn-secondary btn-sm"
            style={{ padding: '1px 4px', fontSize: 9, lineHeight: 1.3, opacity: index === total - 1 ? .3 : 1 }}
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

        {/* Intitulé du champ — élément dominant */}
        {isSep ? (
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Ligne de séparation — aucune donnée enregistrée
          </span>
        ) : (
          <input
            type="text"
            value={field.label}
            onChange={e => onUpdate({ label: e.target.value })}
            placeholder="Intitulé du champ — ex : Localisation, Intensité…"
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: 14, fontWeight: 600, outline: 'none', color: 'var(--text)',
              padding: '2px 0',
            }}
          />
        )}

        {/* Badge déprécié (compact, toujours visible) */}
        {!isSep && field.status === 'deprecated' && (
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 10, flexShrink: 0, fontWeight: 700,
            background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.3)', color: 'var(--amber)',
          }}>⚠ Déprécié</span>
        )}

        {/* Bouton Paramètres (accordéon) */}
        {!isSep && (
          <button
            onClick={onToggleExpand}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', flexShrink: 0,
              border: `1px solid ${isExpanded ? color : 'var(--border)'}`,
              background: isExpanded ? color + '18' : 'transparent',
              color: isExpanded ? color : 'var(--text-muted)',
              fontWeight: isExpanded ? 700 : 400,
              transition: 'all .15s',
            }}
            title={isExpanded ? 'Fermer les paramètres' : 'Modifier les paramètres du champ'}
          >
            {isExpanded ? '▼ Fermer' : '⚙ Paramètres'}
          </button>
        )}

        {/* Supprimer */}
        <button className="btn btn-secondary btn-sm"
          style={{ color: 'var(--red)', flexShrink: 0, padding: '3px 8px' }}
          onClick={onRemove} title="Supprimer ce champ">✕</button>
      </div>

      {/* ── Module : badge spécialité (toujours visible) ── */}
      {isMod && modMeta && (
        <div style={{ padding: '2px 14px 10px', paddingLeft: 58 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
            background: color + '18', color: color, border: `1px solid ${color}44`,
          }}>
            Bloc {modMeta.specialty}
          </span>
          {field.type === 'mtc_aide_interrogatoire' ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
              Affichage seul · aucune donnée stockée
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
              Pleine largeur · données enregistrées dans la séance
            </span>
          )}
        </div>
      )}

      {/* ── Paramètres étendus (accordéon) ── */}
      {isExpanded && !isSep && (
        <div style={{
          padding: '14px 16px 16px', paddingLeft: 58,
          borderTop: '1px solid var(--border-soft)',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>

          {/* Clé de données (lecture seule) */}
          {field.dataKey && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>🔒</span>
              <span style={{ fontWeight: 600 }}>Clé :</span>
              <code style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--bg)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--border-soft)' }}>{field.dataKey}</code>
            </div>
          )}

          {!isMod && (<>
            {/* Mise en page */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.06em' }}>Mise en page</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {WIDTH_OPTIONS.map(w => {
                  const active = (field.width || 'full') === w.value
                  return (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => onUpdate({ width: w.value })}
                      title={w.cols === 1 ? '1 champ par ligne' : `${w.cols} champs côte à côte`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px',
                        border: `1.5px solid ${active ? color : 'var(--border)'}`,
                        borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: active ? 700 : 400,
                        background: active ? color + '15' : 'transparent',
                        color: active ? color : 'var(--text-muted)', transition: 'all .15s',
                      }}
                    >
                      <span style={{ display: 'inline-flex', gap: 2 }}>
                        {Array.from({ length: w.cols }).map((_, i) => (
                          <span key={i} style={{ display: 'inline-block', height: 8, width: w.cols === 1 ? 24 : w.cols === 2 ? 10 : 7, borderRadius: 2, background: active ? color : 'var(--border)' }} />
                        ))}
                      </span>
                      {w.label}
                    </button>
                  )
                })}
                {(field.width === 'half' || field.width === 'third') && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    ↳ {field.width === 'half' ? '2' : '3'} champs consécutifs côte à côte
                  </span>
                )}
              </div>
            </div>

            {/* Placeholder + Obligatoire */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {field.type !== 'checkbox' && (
                <input
                  type="text"
                  value={field.placeholder || ''}
                  onChange={e => onUpdate({ placeholder: e.target.value })}
                  placeholder="Texte dans le champ vide (optionnel)…"
                  style={{ flex: 1, minWidth: 180, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 6, padding: '5px 10px' }}
                />
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={field.required || false}
                  onChange={e => onUpdate({ required: e.target.checked || undefined })}
                  style={{ accentColor: color, width: 14, height: 14 }}
                />
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Obligatoire *</span>
              </label>
            </div>

            {/* Texte d'aide */}
            <input
              type="text"
              value={field.hint || ''}
              onChange={e => onUpdate({ hint: e.target.value || undefined })}
              placeholder="💬 Texte d'aide affiché sous le champ…"
              style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg)', border: '1.5px dashed var(--border)', borderRadius: 6, padding: '5px 10px', fontStyle: 'italic' }}
            />

            {/* Min / Max / Step */}
            {hasRange(field.type) && (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
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
                {(field.type === 'slider' || field.type === 'before_after') && (
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Pas (step)
                    <input type="number" value={field.step ?? 1} min={0.01}
                      onChange={e => onUpdate({ step: e.target.value === '' ? undefined : Number(e.target.value) })}
                      style={{ width: 68 }} />
                  </label>
                )}
              </div>
            )}

            {/* Options pour select / radio / checkboxgroup */}
            {hasOptions(field.type) && (
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border-soft)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
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

            {/* Condition d'affichage */}
            {allPluginFields.length > 0 && (
              <VisibleWhenEditor
                conditions={field.visibleWhen}
                allFields={allPluginFields}
                onChange={conds => onUpdate({ visibleWhen: conds })}
              />
            )}

            {/* Résumé et exports */}
            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
              <button
                type="button"
                onClick={() => setShowExportOpts(v => !v)}
                style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <span style={{ fontSize: 9, transition: 'transform .2s', display: 'inline-block', transform: showExportOpts ? 'rotate(90deg)' : 'none' }}>▶</span>
                <span style={{ fontWeight: 600 }}>Résumé et exports</span>
                {(field.summary?.include === false || field.export?.patientReport === false || field.export?.excel === false || field.export?.searchable === false) && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--amber)', color: '#fff', marginLeft: 2 }}>modifié</span>
                )}
              </button>
              {showExportOpts && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-soft)' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Résumé de séance</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', marginBottom: 6 }}>
                      <input type="checkbox" checked={field.summary?.include !== false}
                        onChange={e => onUpdate({ summary: { ...field.summary, include: e.target.checked ? undefined : false } })}
                        style={{ accentColor: color, width: 14, height: 14 }} />
                      <span>Afficher dans le résumé de séance</span>
                    </label>
                    {field.summary?.include !== false && (
                      <>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input type="text" value={field.summary?.label || ''}
                            onChange={e => onUpdate({ summary: { ...field.summary, label: e.target.value || undefined } })}
                            placeholder="Label alternatif (vide = même que le champ)"
                            style={{ fontSize: 12, flex: 1, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-muted)' }} />
                          <input type="number" value={field.summary?.priority ?? ''}
                            onChange={e => onUpdate({ summary: { ...field.summary, priority: e.target.value === '' ? undefined : Number(e.target.value) } })}
                            placeholder="Ordre" min={1}
                            style={{ fontSize: 12, width: 64, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-muted)', textAlign: 'center' }} />
                        </div>
                        <input type="text" value={field.summaryGroup || ''}
                          onChange={e => onUpdate({ summaryGroup: e.target.value || undefined })}
                          placeholder="Groupe dans le résumé (ex : Douleur, Bilan…)"
                          style={{ marginTop: 6, fontSize: 12, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-muted)' }} />
                      </>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>Exports</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        { key: 'patientReport', label: 'Inclure dans le rapport patient' },
                        { key: 'excel',         label: "Inclure dans l'export Excel" },
                        { key: 'searchable',    label: 'Indexer dans la recherche globale' },
                      ].map(({ key, label }) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                          <input type="checkbox" checked={(field.export as any)?.[key] !== false}
                            onChange={e => onUpdate({ export: { ...field.export, [key]: e.target.checked ? undefined : false } })}
                            style={{ accentColor: color, width: 14, height: 14 }} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions bas : Déprécier + Dupliquer */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
              {field.status === 'deprecated' ? (
                <button className="btn btn-secondary btn-sm" onClick={() => onUpdate({ status: undefined })}
                  style={{ color: 'var(--amber)', borderColor: 'var(--amber)', fontSize: 11 }}
                  title="Réactiver ce champ">↩ Réactiver</button>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={() => onUpdate({ status: 'deprecated' })}
                  style={{ color: 'var(--amber)', fontSize: 11 }}
                  title="Masquer dans les nouvelles séances (données conservées)">Déprécier</button>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn btn-secondary btn-sm" onClick={onDuplicate} style={{ fontSize: 11 }}>⧉ Dupliquer</button>
            </div>
          </>)}

        </div>
      )}
    </div>
  )
}
