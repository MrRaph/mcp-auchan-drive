/**
 * loyalty-history-parser.ts — Parse le HTML de GET /fidelite/ma-carte/historique
 * Même approche que loyalty-parser.ts : regex sur le HTML brut, pas de cheerio/jsdom.
 */

import type { LoyaltyTransaction } from '../types.js';
import { parsePrice } from './html-utils.js';

export type { LoyaltyTransaction };

export function parseLoyaltyHistoryPage(html: string): LoyaltyTransaction[] {
  const transactions: LoyaltyTransaction[] = [];

  // Parcourir chaque ligne <tr>...</tr> du tableau
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const row = trMatch[1];

    // Extraire les valeurs de chaque <td>
    const tdValues: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let tdMatch: RegExpExecArray | null;

    while ((tdMatch = tdRegex.exec(row)) !== null) {
      // Extraire les nœuds texte (séquences de caractères non-balise)
      const textNodes = tdMatch[1].match(/[^<>]+/g) ?? [];
      tdValues.push(textNodes.join(' ').replace(/\s+/g, ' ').trim());
    }

    // On attend exactement 4 colonnes : date, canal, magasin, montant
    if (tdValues.length !== 4) continue;

    const [date, channel, storeName, rawAmount] = tdValues;

    // Valider le format de date DD/MM/YYYY
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) continue;

    // Parser le montant signé (ex. "+0,53", "-2,00", "+0,53 €")
    const isNegative = rawAmount.startsWith('-');
    // Supprimer le signe et le symbole € éventuel pour obtenir la partie numérique
    const numPartRaw = rawAmount.replace(/^[+-]/, '').replace(/\s*€\s*$/, '').trim();
    const numPart = numPartRaw.replace(/[\s\u00A0]/g, '');

    // parsePrice ne gère que les montants avec 2 décimales : ignorer la ligne si ce n'est pas le cas.
    if (!/^\d+[,.]\d{2}$/.test(numPart)) continue;

    const absCents = parsePrice(numPart);
    const amountCents = isNegative ? -absCents : absCents;

    // Reconstruire le montant formaté normalisé avec signe, 2 décimales et €
    const sign = isNegative ? '-' : '+';
    const euros = Math.floor(absCents / 100);
    const cents = String(absCents % 100).padStart(2, '0');
    const amountFormatted = `${sign}${euros},${cents} €`;
    transactions.push({ date, channel, storeName, amountCents, amountFormatted });
  }

  return transactions;
}
