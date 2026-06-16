/**
 * loyalty-parser.ts — Parse le HTML de GET /fidelite/accueil
 * Même approche que parser.ts : regex sur le HTML brut, pas de cheerio/jsdom.
 */

import type { LoyaltyInfo } from '../types.js';
import { parsePrice } from './html-utils.js';

export type { LoyaltyInfo };

export function parseLoyaltyPage(html: string): LoyaltyInfo {
  // ── Carte ─────────────────────────────────────────────────────────────────
  const cardNumberM = html.match(/o-cardSelector__cardNumber[^>]*>N°\s*<strong>(\d+)<\/strong>/);
  const cardNumber = cardNumberM?.[1] ?? '';

  const cardNameM = html.match(/o-cardSelector__cardName[^>]*>([^<]+)<\/div>/);
  const cardHolder = cardNameM?.[1]?.trim() ?? '';

  // ── Cagnotte principale ───────────────────────────────────────────────────
  // On capture depuis le début de o-loyaltyMyCard__amount jusqu'à
  // o-loyaltyMyCard__row, puis on étend la fenêtre pour inclure le contenu
  // de la row (date + montant) qui suit immédiatement.
  const balanceSectionM = html.match(/o-loyaltyMyCard__amount[\s\S]{0,800}?o-loyaltyMyCard__row/);
  const balanceCtx = balanceSectionM
    ? html.slice(balanceSectionM.index!, balanceSectionM.index! + balanceSectionM[0].length + 500)
    : '';

  const expiryM = balanceCtx.match(/Ma cagnotte au (\d{2}\/\d{2}\/\d{4})/);
  const expiryDate = expiryM?.[1] ?? '';

  const balanceTagM = balanceCtx.match(/a-waaohTag--xlarge[^>]*>([^<]+)</);
  const balanceFormatted = balanceTagM?.[1]?.trim() ?? '0,00 €';
  const balanceCents = parsePrice(balanceFormatted);

  // ── Numéro de compte Waooh ───────────────────────────────────────────────
  const waoohM = html.match(/-waaohAccountID[^>]*>Mon numéro de compte Waooh\s*:\s*(\d+)/);
  const waoohAccountNumber = waoohM?.[1] ?? '';

  // ── Jour W! ───────────────────────────────────────────────────────────────
  const jourWActive = html.includes('jour W! est activé');

  const dayM = html.match(/Chaque <strong>([^<]+)<\/strong>/);
  const jourWDay = dayM?.[1];

  const benefitM = html.match(/vous bénéficiez de\s*<strong>([^<]+)<\/strong>/);
  const jourWBenefit = benefitM?.[1];

  // ── Défis Waaoh ──────────────────────────────────────────────────────────
  // Deadline : <strong>Jusqu'au 30 juin 2026</strong>
  // Supporte les deux variantes d'apostrophe : ASCII (U+0027) et typographique (U+2019).
  const challengeDeadlineM = html.match(/<strong>Jusqu(?:\u2019|')au ([^<]+)<\/strong>/);
  const challengeDeadline = challengeDeadlineM?.[1]?.trim();

  // Montant dans a-waaohChallengeTag__amount
  const challengeCagnotteM = html.match(
    /Cagnotte Défis Waaoh[\s\S]{0,200}?a-waaohChallengeTag__amount[^>]*>\s*([^<\s][^<]*?)\s*<\/span>/,
  );
  const challengeCagnotteFormatted = challengeCagnotteM?.[1]?.trim() ?? '0,00 €';
  const challengeCagnotteCents = parsePrice(challengeCagnotteFormatted);

  return {
    card: { number: cardNumber, holder: cardHolder },
    balance: {
      amountCents: balanceCents,
      amountFormatted: balanceFormatted,
      expiryDate,
    },
    waoohAccountNumber,
    jourW: {
      active: jourWActive,
      day: jourWDay,
      benefit: jourWBenefit,
    },
    challenges: {
      cagnotteCents: challengeCagnotteCents,
      cagnotteFormatted: challengeCagnotteFormatted,
      deadline: challengeDeadline,
    },
  };
}

