import React, { useMemo, useState } from 'react'
import type {
  ImportParsedFile, PatientImportFieldKey, SessionImportFieldKey,
  PatientImportMapping, PatientImportResult,
} from '../../../shared/types'

interface Props {
  onClose: () => void
  onImported: () => void
}

type Step = 'pick' | 'mapping' | 'result'

const PATIENT_FIELDS: { key: PatientImportFieldKey; label: string; required?: boolean }[] = [
  { key: 'first_name',     label: 'Prénom', required: true },
  { key: 'last_name',      label: 'Nom', required: true },
  { key: 'birth_date',     label: 'Date de naissance' },
  { key: 'phone',          label: 'Téléphone' },
  { key: 'email',          label: 'Email' },
  { key: 'address',        label: 'Adresse' },
  { key: 'notes_general',  label: 'Notes' },
  { key: 'antecedents',    label: 'Antécédents' },
  { key: 'medications',    label: 'Médicaments' },
  { key: 'regular_doctor', label: 'Médecin traitant' },
]

const SESSION_FIELDS: { key: SessionImportFieldKey; label: string; hint?: string }[] = [
  { key: 'session_date', label: 'Date de séance', hint: 'Sert à l\'ordre chronologique si un patient a plusieurs lignes' },
  { key: 'motif',        label: 'Motif' },
  { key: 'anamnese',     label: 'Anamnèse / Notes de séance' },
]

// Devine la colonne correspondant à chaque champ à partir du nom d'en-tête.
const GUESS_SYNONYMS: Record<string, string[]> = {
  first_name:     ['prenom', 'prénom', 'first name', 'firstname'],
  last_name:      ['nom', 'last name', 'lastname', 'nom de famille'],
  birth_date:     ['date de naissance', 'naissance', 'birth date', 'birthdate', 'dob'],
  phone:          ['telephone', 'téléphone', 'tel', 'phone', 'mobile'],
  email:          ['email', 'mail', 'e-mail'],
  address:        ['adresse', 'address'],
  notes_general:  ['notes', 'remarques'],
  antecedents:    ['antecedents', 'antécédents', 'antecedents medicaux'],
  medications:    ['medicaments', 'médicaments', 'traitement'],
  regular_doctor: ['medecin traitant', 'médecin traitant', 'docteur', 'doctor'],
  session_date:   ['date de seance', 'date de séance', 'date visite', 'date consultation', 'visit date', 'session date'],
  motif:          ['motif', 'raison', 'reason'],
  anamnese:       ['anamnese', 'anamnèse', 'notes de seance', 'notes de séance', 'observations', 'notes visite'],
}

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function guessColumn(headers: string[], fieldKey: string): string {
  const synonyms = (GUESS_SYNONYMS[fieldKey] ?? []).map(normalize)
  const found = headers.find(h => synonyms.includes(normalize(h)))
  return found ?? ''
}

export default function ImportPatientsModal({ onClose, onImported }: Props) {
  const [step, setStep]           = useState<Step>('pick')
  const [loading, setLoading]     = useState(false)
  const [parsed, setParsed]       = useState<ImportParsedFile | null>(null)
  const [patientMap, setPatientMap] = useState<Partial<Record<PatientImportFieldKey, string>>>({})
  const [sessionMap, setSessionMap] = useState<Partial<Record<SessionImportFieldKey, string>>>({})
  const [result, setResult]       = useState<PatientImportResult | null>(null)
  const [error, setError]         = useState('')
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)

  const downloadTemplate = async () => {
    setError('')
    const path = await window.mtcApi.showSaveDialog({
      defaultPath: 'Modele_import_patients_Synoria.xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })
    if (!path) return
    setDownloadingTemplate(true)
    try {
      await window.mtcApi.writeImportTemplate(path)
      await window.mtcApi.openPath(path)
    } catch (e: any) {
      setError(`Impossible de créer le modèle : ${e?.message || e}`)
    }
    setDownloadingTemplate(false)
  }

  const headersInUse = useMemo(
    () => new Set([...Object.values(patientMap), ...Object.values(sessionMap)].filter(Boolean)),
    [patientMap, sessionMap],
  )

  const pickFile = async () => {
    setError('')
    const path = await window.mtcApi.showOpenDialog({
      filters: [{ name: 'Fichier patients', extensions: ['csv', 'xlsx', 'xls'] }],
    })
    if (!path) return
    setLoading(true)
    try {
      const file = await window.mtcApi.parseImportFile(path)
      if (file.rowCount === 0) {
        setError('Le fichier ne contient aucune ligne de données.')
        setLoading(false)
        return
      }
      setParsed(file)
      const pMap: Partial<Record<PatientImportFieldKey, string>> = {}
      for (const f of PATIENT_FIELDS) pMap[f.key] = guessColumn(file.headers, f.key)
      const sMap: Partial<Record<SessionImportFieldKey, string>> = {}
      for (const f of SESSION_FIELDS) sMap[f.key] = guessColumn(file.headers, f.key)
      setPatientMap(pMap)
      setSessionMap(sMap)
      setStep('mapping')
    } catch (e: any) {
      setError(`Impossible de lire ce fichier : ${e?.message || e}`)
    }
    setLoading(false)
  }

  const canConfirm = !!patientMap.first_name && !!patientMap.last_name

  const confirmImport = async () => {
    if (!parsed || !canConfirm) return
    setLoading(true)
    setError('')
    const mapping: PatientImportMapping = { patientFields: patientMap, sessionFields: sessionMap }
    try {
      const r = await window.mtcApi.importPatientsBatch(parsed.rows, mapping)
      setResult(r)
      setStep('result')
      onImported()
    } catch (e: any) {
      setError(`Échec de l'import : ${e?.message || e}`)
    }
    setLoading(false)
  }

  const renderFieldRow = (
    key: string, label: string, hint: string | undefined,
    value: string, onChange: (v: string) => void,
  ) => (
    <tr key={key}>
      <td style={{ padding: '6px 10px', fontSize: 13, fontWeight: 600 }}>
        {label}
        {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{hint}</div>}
      </td>
      <td style={{ padding: '6px 10px' }}>
        <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%' }}>
          <option value="">— Aucune —</option>
          {(parsed?.headers ?? []).map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </td>
    </tr>
  )

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span>📥</span>
          <span>Importer des patients</span>
        </h2>

        {error && (
          <div style={{ background: 'var(--red-light, #fdecec)', color: 'var(--red)', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {step === 'pick' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, lineHeight: 1.6 }}>
              Sélectionnez un fichier CSV ou Excel. La première ligne doit contenir les en-têtes de colonnes.
              Vous pourrez ensuite associer chaque colonne à un champ Synoria.
              <br /><br />
              Si un même patient apparaît sur plusieurs lignes (plusieurs visites), chaque ligne devient une
              séance, dans l'ordre chronologique des dates.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={pickFile} disabled={loading}>
                {loading ? '⏳ Lecture…' : '📂 Choisir un fichier'}
              </button>
              <button className="btn btn-secondary" onClick={downloadTemplate} disabled={downloadingTemplate}>
                {downloadingTemplate ? '⏳…' : '📄 Télécharger un modèle Excel'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
              Le modèle contient des exemples (dont un patient avec 2 séances) et un onglet d'instructions.
            </p>
          </div>
        )}

        {step === 'mapping' && parsed && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              {parsed.rowCount} ligne(s) détectée(s) dans le fichier. Toute colonne non associée ci-dessous sera
              tout de même conservée, ajoutée dans l'anamnèse de la séance correspondante.
            </p>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '14px 0 6px' }}>
              Champs patient
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
              <tbody>
                {PATIENT_FIELDS.map(f => renderFieldRow(
                  f.key, f.label + (f.required ? ' *' : ''), undefined,
                  patientMap[f.key] ?? '',
                  v => setPatientMap(m => ({ ...m, [f.key]: v })),
                ))}
              </tbody>
            </table>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '14px 0 6px' }}>
              Champs séance (optionnel)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
              <tbody>
                {SESSION_FIELDS.map(f => renderFieldRow(
                  f.key, f.label, f.hint,
                  sessionMap[f.key] ?? '',
                  v => setSessionMap(m => ({ ...m, [f.key]: v })),
                ))}
              </tbody>
            </table>

            {parsed.headers.some(h => !headersInUse.has(h)) && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                Colonnes non associées (ajoutées automatiquement à l'anamnèse) :{' '}
                {parsed.headers.filter(h => !headersInUse.has(h)).join(', ')}
              </p>
            )}

            {!canConfirm && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>
                ⚠️ Prénom et Nom doivent être associés à une colonne pour continuer.
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStep('pick')}>← Retour</button>
              <button className="btn btn-primary" onClick={confirmImport} disabled={!canConfirm || loading}>
                {loading ? '⏳ Import en cours…' : `Importer ${parsed.rowCount} ligne(s)`}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'var(--accent-light)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{result.patientsCreated}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Patients créés</div>
              </div>
              <div style={{ background: 'var(--blue-light, #ebf2f9)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>{result.sessionsCreated}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Séances importées</div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{result.duplicatesSkipped}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Doublons ignorés</div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{result.missingSessionDate}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Séances sans date (ordre du fichier utilisé)</div>
              </div>
            </div>

            {result.nameConflicts.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', marginBottom: 6 }}>
                  ⚠️ À vérifier manuellement ({result.nameConflicts.length})
                </div>
                <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 18, margin: 0 }}>
                  {result.nameConflicts.map((c, i) => <li key={i}><strong>{c.name}</strong> — {c.detail}</li>)}
                </ul>
              </div>
            )}

            {result.errors.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>
                  Erreurs ({result.errors.length})
                </div>
                <ul style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 18, margin: 0, maxHeight: 140, overflowY: 'auto' }}>
                  {result.errors.map((e, i) => <li key={i}>Ligne {e.row} — {e.message}</li>)}
                </ul>
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              💡 Les patients importés n'ont pas de consentement RGPD enregistré — pensez à le recueillir normalement
              lors de leur prochaine visite.
            </p>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>Terminer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
