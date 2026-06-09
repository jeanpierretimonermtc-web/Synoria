import React, { useEffect, useState } from 'react'

interface SplashScreenProps {
  onDone: () => void
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 400)
    const t2 = setTimeout(() => setPhase('out'), 1900)
    const t3 = setTimeout(() => onDone(), 2400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div className={`splash-overlay splash-${phase}`}>
      <div className="splash-content">
        <img src="./Synoria.png" className="splash-logo" alt="Logo Synoria" />
        <img src="./Text Synoria fond blanc.png" className="splash-title-img" alt="SYNORIA" />
        <div className="splash-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  )
}
