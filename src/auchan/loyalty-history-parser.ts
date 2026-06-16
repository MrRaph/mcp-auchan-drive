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
      // Supprimer les balises HTML internes et normaliser les espaces
      tdValues.push(tdMatch[1].replace(/<[^>]+>/g, '').trim());
    }

    // On attend exactement 4 colonnes : date, canal, magasin, montant
    if (tdValues.length !== 4) continue;

    const [date, channel, storeName, rawAmount] = tdValues;

    // Valider le format de date DD/MM/YYYY
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) continue;

    // Parser le montant signé (ex. "+0,53", "-2,00", "+0,53 €")
    const isNegative = rawAmount.startsWith('-');
    const isPositive = rawAmount.startsWith('+');
    // Supprimer le signe et le symbole € éventuel pour obtenir la partie numérique
    const numPart = rawAmount.replace(/^[+-]/, '').replace(/\s*€\s*$/, '').trim();
    const absCents = parsePrice(numPart);
    const amountCents = isNegative ? -absCents : absCents;

    // Reconstruire le montant formaté avec signe et €
    const sign = isNegative ? '-' : (isPositive ? '+' : '');
    const amountFormatted = `${sign}${numPart} €`;

    transactions.push({ date, channel, storeName, amountCents, amountFormatted });
  }

  return transactions;
}
