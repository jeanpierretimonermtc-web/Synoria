import React, { useEffect, useState } from 'react'
import { logoLightSrc, logoDarkSrc, textLightSrc, textDarkSrc } from '../../assets/logoAssets'

interface SplashScreenProps {
  onDone: () => void
  theme?: 'light' | 'dark'
}

export default function SplashScreen({ onDone, theme = 'light' }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')
  const dark = theme === 'dark'

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 400)
    const t2 = setTimeout(() => setPhase('out'), 1900)
    const t3 = setTimeout(() => onDone(), 2400)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div className={`splash-overlay splash-${phase}`}>
      <div className="splash-content">
        <img src={dark ? logoDarkSrc : logoLightSrc} className="splash-logo" alt="Logo Synoria" />
        <img
          src={dark ? textDarkSrc : textLightSrc}
          className="splash-title-img"
          alt="SYNORIA"
        />
        <div className="splash-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  )
}
