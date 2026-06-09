import React, { useRef, useEffect, useCallback, CSSProperties } from 'react'

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
      divRef.current.innerHTML = value || ''
      internalHtml.current = value || ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Mise à jour externe (ex: chargement d'une séance existante)
  useEffect(() => {
    if (divRef.current && value !== internalHtml.current) {
      divRef.current.innerHTML = value || ''
      internalHtml.current = value || ''
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
