import React, { useState, useEffect } from 'react'

interface ConfirmOpts {
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  alertOnly?: boolean
}

type Resolver = (value: boolean) => void
let pendingResolve: Resolver | null = null
const listeners: Array<(opts: ConfirmOpts | null) => void> = []

export function showConfirm(opts: ConfirmOpts | string): Promise<boolean> {
  const normalized: ConfirmOpts = typeof opts === 'string' ? { message: opts } : opts
  return new Promise<boolean>((resolve) => {
    pendingResolve = resolve
    listeners.forEach(fn => fn(normalized))
  })
}

export function ConfirmDialog() {
  const [state, setState] = useState<ConfirmOpts | null>(null)

  useEffect(() => {
    const handler = (opts: ConfirmOpts | null) => setState(opts)
    listeners.push(handler)
    return () => {
      const idx = listeners.indexOf(handler)
      if (idx >= 0) listeners.splice(idx, 1)
    }
  }, [])

  if (!state) return null

  const respond = (v: boolean) => {
    setState(null)
    pendingResolve?.(v)
    pendingResolve = null
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 999 }} onClick={() => respond(false)}>
      <div
        className="modal"
        style={{ maxWidth: 400, textAlign: 'center', padding: '2rem' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 40, marginBottom: 14, lineHeight: 1 }}>
          {state.danger ? '⚠️' : state.alertOnly ? 'ℹ️' : '❓'}
        </div>

        {state.title && (
          <div style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 18, fontWeight: 700,
            color: state.danger ? 'var(--red)' : 'var(--accent)',
            marginBottom: 10,
          }}>
            {state.title}
          </div>
        )}

        <p style={{
          color: 'var(--text-muted)', fontSize: 14,
          lineHeight: 1.7, margin: '0 0 24px',
          whiteSpace: 'pre-line',
        }}>
          {state.message}
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {!state.alertOnly && (
            <button className="btn btn-secondary" onClick={() => respond(false)}>
              {state.cancelLabel || 'Annuler'}
            </button>
          )}
          <button
            className="btn btn-primary"
            autoFocus
            onClick={() => respond(true)}
            style={state.danger ? { background: 'var(--red)', borderColor: 'var(--red)' } : undefined}
          >
            {state.confirmLabel || (state.alertOnly ? 'OK' : 'Confirmer')}
          </button>
        </div>
      </div>
    </div>
  )
}
