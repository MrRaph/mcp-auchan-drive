/** Convertit "2,98 €" ou "11,92" → centimes entiers (298, 1192). */
export function parsePrice(text: string): number {
  const m = text.match(/(\d+)[,.](\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
}
