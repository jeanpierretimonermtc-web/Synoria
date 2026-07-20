// Logos importés via Vite : URL résolue au build, stable quelle que soit la route React Router.
import _logoLight from './logo-light.png'
import _logoDark  from './logo-dark.png'
import _textLight from './logo-text-light.png'
import _textDark  from './logo-text-dark.png'

export const logoLightSrc = _logoLight
export const logoDarkSrc  = _logoDark
export const textLightSrc = _textLight
export const textDarkSrc  = _textDark

export function getLogos(dark: boolean) {
  return { icon: dark ? _logoDark : _logoLight, text: dark ? _textDark : _textLight }
}
