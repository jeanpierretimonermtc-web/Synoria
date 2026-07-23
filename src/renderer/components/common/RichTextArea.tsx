import React, { useRef, useEffect, useCallback, CSSProperties, useState } from 'react'

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
  const divRef          = useRef<HTMLDivElement>(null)
  const internalHtml    = useRef(value || '')
  const recognitionRef  = useRef<any>(null)
  const isListeningRef  = useRef(false)
  const [isListening, setIsListening] = useState(false)
  const isSupported = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  // Initialisation au montage
  useEffect(() => {
    if (divRef.current) {
      const safe = sanitizeHtml(value || '')
      divRef.current.innerHTML = safe
      internalHtml.current = safe
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Mise à jour externe (ex: chargement d'une séance existante)
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
    isListeningRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setIsListening(false)
  }, [])

  const startDictation = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.lang = 'fr-FR'
    recognition.interimResults = false
    recognition.continuous = true
    recognitionRef.current = recognition

    recognition.onresult = (e: any) => {
      const text = Array.from(e.results as any[])
        .slice(e.resultIndex)
        .filter((r: any) => r.isFinal)
        .map((r: any) => r[0].transcript)
        .join('')
      if (!text || !divRef.current) return
      divRef.current.focus()
      const rawText = divRef.current.innerText || ''
      const prefix = rawText && !/\s$/.test(rawText) ? ' ' : ''
      document.execCommand('insertText', false, prefix + text)
    }

    // Auto-restart si Chromium coupe après un silence (comportement normal du navigateur)
    recognition.onend = () => {
      if (isListeningRef.current && recognitionRef.current === recognition) {
        try { recognition.start() } catch { stopDictation() }
      } else {
        isListeningRef.current = false
        setIsListening(false)
      }
    }

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech') return
      stopDictation()
      const msg =
        e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Permission microphone refusée' :
        e.error === 'network'        ? 'Connexion internet requise pour la dictée' :
        e.error === 'audio-capture'  ? 'Microphone introuvable' :
        e.error === 'aborted'        ? null :
        `Erreur dictée : ${e.error}`
      if (msg) {
        const wrap = divRef.current?.closest('.richtextarea-wrap')
        if (wrap) {
          wrap.setAttribute('data-mic-error', msg)
          setTimeout(() => wrap.removeAttribute('data-mic-error'), 4000)
        }
      }
    }

    try {
      recognition.start()
      isListeningRef.current = true
      setIsListening(true)
      divRef.current?.focus()
    } catch {
      stopDictation()
    }
  }, [stopDictation])

  const toggleDictation = useCallback(() => {
    if (isListeningRef.current) stopDictation()
    else startDictation()
  }, [startDictation, stopDictation])

  useEffect(() => () => { stopDictation() }, [stopDictation])

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
      {isSupported && (
        <button
          type="button"
          className={`richtextarea-mic${isListening ? ' listening' : ''}`}
          onMouseDown={e => e.preventDefault()}
          onClick={toggleDictation}
          title={isListening ? 'Arrêter la dictée (clic)' : 'Dictée vocale'}
          aria-label={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée vocale'}
        >
          🎤
        </button>
      )}
    </div>
  )
}
