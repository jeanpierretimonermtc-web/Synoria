import React, { useRef, useEffect, useCallback, CSSProperties, useState } from 'react'

// ── Module-level speech bridge ──────────────────────────────────────────────
// Un seul jeu d'écouteurs IPC pour toutes les instances RichTextArea.
// Seule l'instance qui a démarré la dictée reçoit les résultats.
type SpeechHandlers = {
  onResult: (text: string) => void
  onError:  (msg: string) => void
  onStop:   () => void
}
let activeSpeech: SpeechHandlers | null = null
let speechBridgeReady = false

function ensureSpeechBridge() {
  if (speechBridgeReady || !window.mtcApi?.onSpeechResult) return
  speechBridgeReady = true
  window.mtcApi.onSpeechResult( (text) => activeSpeech?.onResult(text))
  window.mtcApi.onSpeechError(  (msg)  => { activeSpeech?.onError(msg);  activeSpeech = null })
  window.mtcApi.onSpeechStopped(()     => { activeSpeech?.onStop();       activeSpeech = null })
}

// ── Sanitisation HTML ────────────────────────────────────────────────────────
function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''
  const div = document.createElement('div')
  div.innerHTML = dirty
  for (const el of Array.from(div.querySelectorAll('*'))) {
    if (/^(script|iframe|object|embed|form|input|button|link|meta|style|base)$/i.test(el.tagName)) {
      el.remove()
      continue
    }
    for (const { name } of Array.from(el.attributes)) {
      if (/^on/i.test(name) || ['src', 'action', 'formaction', 'data', 'xlink:href'].includes(name.toLowerCase())) {
        el.removeAttribute(name)
      } else if (name.toLowerCase() === 'href') {
        const val = (el as HTMLElement).getAttribute('href') || ''
        if (/^javascript:/i.test(val.trim())) el.removeAttribute('href')
      }
    }
  }
  return div.innerHTML
}

interface RichTextAreaProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  style?: CSSProperties
  minHeight?: number
}

export default function RichTextArea({ value, onChange, placeholder, style, minHeight = 80 }: RichTextAreaProps) {
  const divRef       = useRef<HTMLDivElement>(null)
  const internalHtml = useRef(value || '')
  const [isListening, setIsListening] = useState(false)

  // Initialisation au montage
  useEffect(() => {
    if (divRef.current) {
      const safe = sanitizeHtml(value || '')
      divRef.current.innerHTML = safe
      internalHtml.current = safe
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Mise à jour externe (chargement d'une séance existante)
  useEffect(() => {
    if (divRef.current && value !== internalHtml.current) {
      const safe = sanitizeHtml(value || '')
      divRef.current.innerHTML = safe
      internalHtml.current = safe
    }
  }, [value])

  const handleInput = useCallback(() => {
    if (divRef.current) {
      const html = divRef.current.innerHTML
      const cleaned = html === '<br>' ? '' : html
      internalHtml.current = cleaned
      onChange(cleaned)
    }
  }, [onChange])

  const stopDictation = useCallback(() => {
    activeSpeech = null
    window.mtcApi?.speechStop?.()
    setIsListening(false)
  }, [])

  const showMicError = useCallback((msg: string) => {
    const wrap = divRef.current?.closest('.richtextarea-wrap')
    if (wrap) {
      wrap.setAttribute('data-mic-error', msg)
      setTimeout(() => wrap.removeAttribute('data-mic-error'), 4000)
    }
  }, [])

  const startDictation = useCallback(() => {
    ensureSpeechBridge()
    if (!window.mtcApi?.speechStart) return

    activeSpeech = {
      onResult: (text: string) => {
        if (!text.trim() || !divRef.current) return
        divRef.current.focus()
        const rawText = divRef.current.innerText || ''
        const prefix = rawText && !/\s$/.test(rawText) ? ' ' : ''
        document.execCommand('insertText', false, prefix + text)
      },
      onError: (msg: string) => {
        setIsListening(false)
        showMicError(msg || 'Erreur dictée')
      },
      onStop: () => setIsListening(false),
    }

    window.mtcApi.speechStart()
    setIsListening(true)
    divRef.current?.focus()
  }, [showMicError])

  const toggleDictation = useCallback(() => {
    if (isListening) stopDictation()
    else startDictation()
  }, [isListening, startDictation, stopDictation])

  // Nettoyage au démontage
  useEffect(() => () => {
    if (activeSpeech) stopDictation()
  }, [stopDictation])

  return (
    <div className="richtextarea-wrap" style={style}>
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="richtextarea-content"
        data-placeholder={placeholder}
        style={{ minHeight }}
      />
      {typeof window.mtcApi !== 'undefined' && (
        <button
          type="button"
          className={`richtextarea-mic${isListening ? ' listening' : ''}`}
          onMouseDown={e => e.preventDefault()}
          onClick={toggleDictation}
          title={isListening ? 'Arrêter la dictée (clic)' : 'Dictée vocale (hors-ligne)'}
          aria-label={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée vocale'}
        >
          🎤
        </button>
      )}
    </div>
  )
}
