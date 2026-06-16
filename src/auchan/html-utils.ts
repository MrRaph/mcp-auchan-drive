/** Convertit "2,98 €" ou "11,92" → centimes entiers (298, 1192). */
export function parsePrice(text: string): number {
  const m = text.match(/(\d+)[,.](\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
}

/** Table des entités HTML nommées courantes. */
const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/**
 * Décode les entités HTML (nommées + numériques décimales et hexadécimales).
 * Les entités nommées sont traitées en un seul passage pour éviter le double-décodage
 * (ex. "&amp;lt;" → "&lt;" et non "<").
 */
export function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => NAMED_ENTITIES[m] ?? m);
}
