/**
 * Auto-sauvegarde du brouillon de séance dans localStorage.
 * Toutes les 2 minutes, les champs texte principaux sont sauvegardés.
 * En cas de crash ou fermeture accidentelle, le praticien peut restaurer.
 */
import { useEffect, useCallback, useRef } from 'react'

export interface SessionDraftData {
  patientId:        string
  date:             string
  motif:            string
  evolution:        string
  evolutionTags:    string
  anamnese:         string
  observation:      string
  traitementNotes:  string
  reactions:        string
  diagnostic:       string
  cinqElements:     string
  causes:           string
  analyse:          string
  principes:        string
  points:           string
  ptsOreille:       string
  plantes:          string
  pluginData:       Record<string, unknown>
  savedAt:          string
}

const DRAFT_KEY = (patientId: string) => `synoria-session-draft-${patientId || 'new'}`
const DRAFT_INTERVAL = 2 * 60 * 1000  // 2 minutes

/** Sauvegarde automatique du brouillon toutes les 2 minutes */
export function useSessionDraftSave(data: SessionDraftData, enabled: boolean) {
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    if (!enabled) return
    const save = () => {
      try {
        const draft = { ...dataRef.current, savedAt: new Date().toISOString() }
        localStorage.setItem(DRAFT_KEY(draft.patientId), JSON.stringify(draft))
      } catch {}
    }
    const timer = setInterval(save, DRAFT_INTERVAL)
    return () => clearInterval(timer)
  }, [enabled])
}

/** Vérifie l'existence d'un brouillon pour ce patient */
export function getSessionDraft(patientId: string): SessionDraftData | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(patientId))
    if (!raw) return null
    const draft = JSON.parse(raw) as SessionDraftData
    // Brouillon expiré après 24h
    if (Date.now() - new Date(draft.savedAt).getTime() > 86400000) {
      localStorage.removeItem(DRAFT_KEY(patientId))
      return null
    }
    return draft
  } catch {
    return null
  }
}

/** Efface le brouillon après sauvegarde réussie */
export function clearSessionDraft(patientId: string) {
  try { localStorage.removeItem(DRAFT_KEY(patientId)) } catch {}
}
