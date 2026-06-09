import { useEffect, useRef, useCallback } from 'react'

const INACTIVITY_MS = 20 * 60 * 1000  // 20 minutes

/**
 * Déclenche onLock après INACTIVITY_MS ms sans activité utilisateur.
 * Se réinitialise à chaque événement souris/clavier/tactile.
 * Ne s'active que si enabled === true.
 */
export function useInactivityLock(onLock: () => void, enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (!enabled) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onLock, INACTIVITY_MS)
  }, [onLock, enabled])

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    const events: (keyof DocumentEventMap)[] = [
      'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel',
    ]
    events.forEach(ev => document.addEventListener(ev, resetTimer, { passive: true }))
    resetTimer()  // démarre le timer immédiatement
    return () => {
      events.forEach(ev => document.removeEventListener(ev, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer, enabled])
}
