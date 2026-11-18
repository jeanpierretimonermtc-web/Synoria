/**
 * Détection « ce texte contient-il vraiment du HTML produit par RichTextArea ? ».
 *
 * N'accepte que les balises que RichTextArea peut réellement produire
 * (voir ALLOWED_TAGS dans src/renderer/utils/sanitizeHtml.ts). Contrairement
 * à une détection générique « <lettre...> », ça évite de prendre du texte brut
 * contenant des chevrons littéraux (ex : "patient <anxieux> aujourd'hui") pour
 * une balise et de perdre le mot qu'ils entourent lors du nettoyage.
 */
const RICH_TEXT_TAG_RE = /<\/?(p|br|b|strong|i|em|u|ul|ol|li|span|div|font)(?:\s[^>]*)?\/?>/i
const RICH_TEXT_TAG_RE_G = /<\/?(p|br|b|strong|i|em|u|ul|ol|li|span|div|font)(?:\s[^>]*)?\/?>/gi

export function looksLikeRichTextHtml(value: string): boolean {
  return RICH_TEXT_TAG_RE.test(value)
}

/**
 * Retire uniquement les balises reconnues (ex : résidus <br> d'anciens champs),
 * sans toucher aux chevrons littéraux qui font partie du texte lui-même.
 */
export function stripKnownRichTags(value: string): string {
  return value.replace(RICH_TEXT_TAG_RE_G, ' ')
}
