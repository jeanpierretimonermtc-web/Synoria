import React, { useEffect, useRef, useState, useContext } from 'react'
import type { ConsultationType, ExpenseConfig } from '../../shared/types'
import { ToastContext } from '../App'
import { showConfirm } from '../components/common/ConfirmDialog'

// ── Helpers mois ──────────────────────────────────────────────────

const MONTH_NAMES  = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const ALL_MONTH_NB = [1,2,3,4,5,6,7,8,9,10,11,12]

function parseMonths(m?: string | null): number[] {
  if (!m) return ALL_MONTH_NB
  return m.split(',').map(Number).filter(n => n >= 1 && n <= 12)
}

function formatMonths(arr: number[]): string | null {
  if (arr.length === 12) return null   // null = tous les mois
  return arr.slice().sort((a,b) => a-b).join(',')
}

function isAllMonths(m?: string | null): boolean {
  return !m || parseMonths(m).length === 12
}

function effectiveAmount(c: ExpenseConfig, month?: number): number {
  if (month !== undefined && !isAllMonths(c.months)) {
    if (!parseMonths(c.months).includes(month)) return 0
  }
  // is_shared=0 → non partagé (÷1)
  // is_shared=1 → rétrocompat ancien format "÷2"
  // is_shared=2..5 → divisé par N personnes
  const divisor = c.is_shared === 0 ? 1 : c.is_shared === 1 ? 2 : c.is_shared
  return c.monthly_amount / divisor
}

function shareLabel(is_shared: number): string {
  if (is_shared === 0) return '—'
  const n = is_shared === 1 ? 2 : is_shared
  return `÷${n}`
}

function newConfig(): ExpenseConfig {
  return {
    id:             `exp_${Date.now()}`,
    category:       'custom',
    label:          '',
    monthly_amount: 0,
    is_shared:      0,
    sort_order:     0,
    months:         null,
  }
}

// ── MODAL charge fixe ─────────────────────────────────────────────

interface ExpenseModalProps {
  config: ExpenseConfig
  onSave: (c: ExpenseConfig) => void
  onClose: () => void
}

function ExpenseModal({ config, onSave, onClose }: ExpenseModalProps) {
  const labelRef                   = useRef<HTMLInputElement>(null)
  const [label,      setLabel]     = useState(config.label)
  const [amountStr,  setAmountStr] = useState(String(config.monthly_amount ?? 0))
  // shareCount : 1 = non partagé, 2..5 = N personnes
  const [shareCount, setShareCount] = useState<number>(() => {
    if (config.is_shared === 0) return 1
    if (config.is_shared === 1) return 2   // rétrocompat
    return Math.min(5, Math.max(2, config.is_shared))
  })
  const [selMonths,  setSelMonths] = useState<number[]>(parseMonths(config.months))
  const allSelected                = selMonths.length === 12

  // Focus explicite après montage — plus fiable qu'autoFocus dans Electron
  useEffect(() => {
    const t = setTimeout(() => labelRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])

  const amountNum = parseFloat(amountStr) || 0
  // Montant effectif par personne = montant total ÷ nombre de partages
  const eff = shareCount > 1 ? amountNum / shareCount : amountNum

  const toggleMonth = (m: number) =>
    setSelMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

  const toggleAll = () =>
    setSelMonths(allSelected ? [] : [...ALL_MONTH_NB])

  const handleSave = () => {
    if (!label.trim()) return
    onSave({
      ...config,
      label:          label.trim(),
      monthly_amount: amountNum,
      is_shared:      shareCount === 1 ? 0 : shareCount,
      months:         formatMonths(selMonths),
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span>📉</span>
          <span>{config.label ? 'Modifier la charge' : 'Nouvelle charge fixe'}</span>
        </h2>

        {/* Désignation */}
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="exp-label">Désignation *</label>
          <input
            id="exp-label"
            ref={labelRef}
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Ex : Loyer, Assurance, Logiciel…"
          />
        </div>

        {/* Montant + partage */}
        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="exp-amount">Montant total (€)</label>
            <input
              id="exp-amount"
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              style={{ textAlign: 'right' }}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="exp-share">Partage des frais</label>
            <select
              id="exp-share"
              value={shareCount}
              onChange={e => setShareCount(parseInt(e.target.value))}
            >
              <option value={1}>Non partagé</option>
              <option value={2}>2 personnes (÷2)</option>
              <option value={3}>3 personnes (÷3)</option>
              <option value={4}>4 personnes (÷4)</option>
              <option value={5}>5 personnes (÷5)</option>
            </select>
          </div>
        </div>

        {/* Aperçu montant effectif */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', background: 'var(--amber-light)',
          borderRadius: 8, marginBottom: 18, fontSize: 13,
        }}>
          {shareCount > 1 ? (
            <>
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>
                {amountNum.toFixed(2)} € ÷ {shareCount} personnes =
              </span>
              <strong style={{ color: 'var(--amber)', fontSize: 16 }}>{eff.toFixed(2)} € / pers.</strong>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--text-muted)', flex: 1 }}>Montant imputé par mois actif :</span>
              <strong style={{ color: 'var(--amber)', fontSize: 16 }}>{eff.toFixed(2)} €</strong>
            </>
          )}
        </div>

        {/* Sélection des mois */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
            Mois actifs
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: allSelected ? 'var(--accent)' : 'var(--text-muted)' }}>
              Tous les mois (charge annuelle permanente)
            </span>
          </label>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
            opacity: allSelected ? .4 : 1,
            pointerEvents: allSelected ? 'none' : 'auto',
          }}>
            {MONTH_NAMES.map((name, i) => {
              const m      = i + 1
              const active = selMonths.includes(m)
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMonth(m)}
                  style={{
                    padding: '8px 4px', borderRadius: 8,
                    border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent-light)' : 'var(--surface)',
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: active ? 700 : 400, fontSize: 13,
                    cursor: 'pointer', transition: 'all .12s',
                  }}
                >
                  {name}
                </button>
              )
            })}
          </div>

          {!allSelected && selMonths.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 8 }}>
              ⚠️ Aucun mois sélectionné — la charge ne sera jamais appliquée.
            </div>
          )}
          {!allSelected && selMonths.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 8 }}>
              ✓ Charge active sur {selMonths.length} mois ·
              Total annuel (votre part) : <strong>{(eff * selMonths.length).toFixed(2)} €</strong>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!label.trim() || selMonths.length === 0}
          >
            💾 {config.label ? 'Enregistrer les modifications' : 'Ajouter la charge'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────

export default function DepensesPage() {
  const showToast = useContext(ToastContext)
  const [types,   setTypes]   = useState<ConsultationType[]>([])
  const [configs, setConfigs] = useState<ExpenseConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  // Modal charge fixe
  const [modalConfig, setModalConfig] = useState<ExpenseConfig | null>(null)

  useEffect(() => {
    Promise.all([window.mtcApi.getConsultationTypes(), window.mtcApi.getExpenseConfig()])
      .then(([t, c]) => { setTypes(t); setConfigs(c) })
      .catch(() => showToast('Erreur chargement', 'error'))
      .finally(() => setLoading(false))
  }, [])

  const saveTypes = async (updated: ConsultationType[]) => {
    setSaving(true)
    try { await window.mtcApi.saveConsultationTypes(updated); showToast('Types enregistrés ✓', 'success') }
    catch { showToast('Erreur sauvegarde', 'error') }
    setSaving(false)
  }

  const saveConfigs = async (updated: ExpenseConfig[]) => {
    setSaving(true)
    try { await window.mtcApi.saveExpenseConfig(updated); showToast('Charges enregistrées ✓', 'success') }
    catch { showToast('Erreur sauvegarde', 'error') }
    setSaving(false)
  }

  const updateType = (idx: number, field: keyof ConsultationType, val: string | number) => {
    setTypes(prev => { const c = [...prev]; c[idx] = { ...c[idx], [field]: val }; return c })
  }

  const updateTypePrice = (id: string, rawStr: string) => {
    const num = parseFloat(rawStr.replace(',', '.'))
    setTypes(prev => prev.map(t => t.id === id ? { ...t, price: isNaN(num) ? 0 : num } : t))
  }

  const addType = () => {
    setTypes(prev => [...prev, { id: `type_${Date.now()}`, name: 'Nouveau type', price: 0, is_active: 1, sort_order: prev.length }])
  }

  const handleDeleteType = async (id: string, name: string) => {
    if (!await showConfirm({ message: `Supprimer le type "${name}" ?\n\nCette action ne supprime pas les séances existantes.`, title: 'Supprimer le type', confirmLabel: 'Supprimer', danger: true })) return
    const next = types.filter(t => t.id !== id)
    setTypes(next)
    await saveTypes(next)
  }

  // Ouvre le modal pour ajouter ou éditer
  const openAdd  = () => setModalConfig(newConfig())
  const openEdit = (c: ExpenseConfig) => setModalConfig({ ...c })

  const handleModalSave = async (updated: ExpenseConfig) => {
    const next = configs.some(c => c.id === updated.id)
      ? configs.map(c => c.id === updated.id ? updated : c)
      : [...configs, updated]
    setModalConfig(null)
    setConfigs(next)
    await saveConfigs(next)
  }

  const handleDelete = async (id: string) => {
    if (!await showConfirm({ message: 'Supprimer cette charge fixe ?', title: 'Supprimer la charge', confirmLabel: 'Supprimer', danger: true })) return
    const next = configs.filter(c => c.id !== id)
    setConfigs(next)
    await saveConfigs(next)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
      <div className="loading-dots"><span /><span /><span /></div>
    </div>
  )

  const currentMonth = new Date().getMonth() + 1
  const fixedThisMonth = configs.reduce((s, c) => s + effectiveAmount(c, currentMonth), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Types de consultation ── */}
      <div className="card">
        <div className="card-title">
          <span className="card-title-icon icon-green">💰</span>
          Types de consultation &amp; tarifs
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Ces types et tarifs sont utilisés dans le tableau comptable. Cochez la case pour les rendre actifs.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['Actif','Désignation','Tarif (€)',''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((t, idx) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                <td style={{ padding: '8px 10px' }}>
                  <input type="checkbox" checked={t.is_active === 1}
                    onChange={e => updateType(idx, 'is_active', e.target.checked ? 1 : 0)}
                    style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <input type="text" value={t.name} onChange={e => updateType(idx, 'name', e.target.value)}
                    style={{ width: '100%', fontSize: 13, padding: '4px 8px' }} />
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <input
                    type="text" inputMode="decimal"
                    defaultValue={String(t.price ?? 0)}
                    key={t.id + '-price'}
                    onBlur={e => updateTypePrice(t.id, e.target.value)}
                    style={{ width: 90, fontSize: 13, padding: '4px 8px', textAlign: 'right' }}
                  />
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--red)', borderColor: 'rgba(168,50,50,.3)' }}
                    onClick={() => handleDeleteType(t.id, t.name)}
                    title={`Supprimer "${t.name}"`}
                  >✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row-btns" style={{ marginTop: 14 }}>
          <button className="btn btn-secondary btn-sm" onClick={addType}>+ Ajouter un type</button>
          <button className="btn btn-primary btn-sm" onClick={() => saveTypes(types)} disabled={saving}>💾 Enregistrer</button>
        </div>
      </div>

      {/* ── Charges fixes ── */}
      <div className="card">
        <div className="card-title">
          <span className="card-title-icon icon-amber">📉</span>
          Charges fixes mensuelles
          <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
            Ce mois : {fixedThisMonth.toFixed(2)} €
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Chaque charge peut être limitée à certains mois (abonnement saisonnier, loyer temporaire…).
          Activez "Partagé ÷2" pour les charges partagées avec un collègue.
        </p>

        {configs.length === 0 ? (
          <div className="empty" style={{ marginBottom: 16 }}>Aucune charge fixe configurée.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Désignation','Montant total','Partage','Mois actifs','Votre part/mois actif',''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {configs.map(c => {
                const eff        = effectiveAmount(c)
                const months     = parseMonths(c.months)
                const allMths    = isAllMonths(c.months)
                const isCurrent  = months.includes(currentMonth)
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-soft)', opacity: isCurrent ? 1 : .6 }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{c.label}</td>
                    <td style={{ padding: '8px 10px' }}>{c.monthly_amount.toFixed(2)} €</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {c.is_shared > 0
                        ? <span style={{ color: 'var(--amber)', fontWeight: 700 }}>{shareLabel(c.is_shared)}</span>
                        : '—'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {allMths ? (
                        <span className="badge badge-green" style={{ fontSize: 10 }}>Tous les mois</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {months.map(m => (
                            <span key={m} style={{
                              padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                              background: m === currentMonth ? 'var(--accent)' : 'var(--accent-light)',
                              color:      m === currentMonth ? 'white' : 'var(--accent)',
                            }}>
                              {MONTH_NAMES[m - 1]}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: isCurrent ? 'var(--amber)' : 'var(--text-muted)', textAlign: 'right' }}>
                      {isCurrent ? `${eff.toFixed(2)} €` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-secondary btn-sm" style={{ marginRight: 4 }} onClick={() => openEdit(c)}>✏️</button>
                      <button className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }} onClick={() => handleDelete(c.id)}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <div className="row-btns" style={{ marginTop: 14 }}>
          <button className="btn btn-secondary btn-sm" onClick={openAdd}>+ Ajouter une charge</button>
        </div>

        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-muted)' }}>
          💡 <strong>Publicité, Logiciel, DASRI</strong> sont des dépenses variables à saisir mois par mois dans le tableau comptable.
          Le mois courant est mis en surbrillance dans la colonne "Mois actifs".
        </div>
      </div>

      {/* Modal */}
      {modalConfig && (
        <ExpenseModal
          config={modalConfig}
          onSave={handleModalSave}
          onClose={() => setModalConfig(null)}
        />
      )}

    </div>
  )
}
