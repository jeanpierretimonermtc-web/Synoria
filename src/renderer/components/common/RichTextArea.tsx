import React, { useRef, useEffect, useCallback, CSSProperties } from 'react'

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
  const divRef = useRef<HTMLDivElement>(null)
  const internalHtml = useRef(value || '')

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
    </div>
  )
}
