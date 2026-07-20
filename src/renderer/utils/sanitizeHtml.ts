/**
 * Sanitise du HTML produit par RichTextArea avant injection via dangerouslySetInnerHTML.
 *
 * Approche : DOMParser (Chromium) — parsing spec-compliant, aucun regex fragile.
 * Usage : renderer uniquement (DOMParser n'existe pas dans Node.js).
 *
 * Tags autorisés  : p br b strong i em u ul ol li span div
 * Attrs autorisés : style sur span/div (props CSS limitées)
 * Tout le reste est supprimé ou "dépaquété" (le contenu texte est conservé).
 */

const ALLOWED_TAGS = new Set<string>([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'span', 'div',
])

const SAFE_STYLE_PROPS = new Set<string>([
  'color', 'font-weight', 'font-style', 'text-decoration', 'background-color',
])

function sanitizeStyleAttr(style: string): string {
  return style
    .split(';')
    .map(rule => {
      const colon = rule.indexOf(':')
      if (colon < 0) return ''
      const prop = rule.slice(0, colon).trim().toLowerCase()
      const val  = rule.slice(colon + 1).trim()
      if (!SAFE_STYLE_PROPS.has(prop)) return ''
      // Block CSS functions that can load/execute content
      if (/javascript:|expression\s*\(|url\s*\(/i.test(val)) return ''
      return `${prop}:${val}`
    })
    .filter(Boolean)
    .join(';')
}

function sanitizeNode(node: Node, doc: Document): Node | null {
  // Text nodes are safe by definition
  if (node.nodeType === Node.TEXT_NODE) {
    return doc.createTextNode(node.textContent || '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const el    = node as Element
  const tag   = el.tagName.toLowerCase()

  // <font color="X"> (produit par execCommand foreColor dans certaines versions de Chromium)
  // → convertir en <span style="color: X;"> pour conserver la couleur
  if (tag === 'font') {
    const colorVal = (el.getAttribute('color') || '').trim()
    const newSpan  = doc.createElement('span')
    if (colorVal && /^#[0-9a-fA-F]{3,8}$|^rgb\(/.test(colorVal)) {
      newSpan.setAttribute('style', `color:${colorVal}`)
    }
    for (const child of Array.from(el.childNodes)) {
      const safe = sanitizeNode(child, doc)
      if (safe) newSpan.appendChild(safe)
    }
    return newSpan
  }

  // Unknown / dangerous tag → unwrap: keep text children, discard the element itself
  if (!ALLOWED_TAGS.has(tag)) {
    const frag = doc.createDocumentFragment()
    for (const child of Array.from(el.childNodes)) {
      const safe = sanitizeNode(child, doc)
      if (safe) frag.appendChild(safe)
    }
    return frag
  }

  // Rebuild a clean element with no attributes
  const newEl = doc.createElement(tag)

  // Only span and div may carry a style, with a filtered property list
  if ((tag === 'span' || tag === 'div') && el.hasAttribute('style')) {
    const safeStyle = sanitizeStyleAttr(el.getAttribute('style') || '')
    if (safeStyle) newEl.setAttribute('style', safeStyle)
  }

  // Recurse into children
  for (const child of Array.from(el.childNodes)) {
    const safe = sanitizeNode(child, doc)
    if (safe) newEl.appendChild(safe)
  }

  return newEl
}

export function sanitizeRichTextHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''

  const parser = new DOMParser()
  const parsed = parser.parseFromString(html, 'text/html')
  const frag   = document.createDocumentFragment()

  for (const child of Array.from(parsed.body.childNodes)) {
    const safe = sanitizeNode(child, document)
    if (safe) frag.appendChild(safe)
  }

  const wrapper = document.createElement('div')
  wrapper.appendChild(frag)
  return wrapper.innerHTML
}
