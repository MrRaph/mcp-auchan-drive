/**
 * loyalty-parser.ts — Parse le HTML de GET /fidelite/accueil
 * Même approche que parser.ts : regex sur le HTML brut, pas de cheerio/jsdom.
 */

export interface LoyaltyInfo {
  card: {
    number: string;
    holder: string;
  };
  balance: {
    amountCents: number;
    amountFormatted: string;
    expiryDate: string;
  };
  waoohAccountNumber: string;
  jourW: {
    active: boolean;
    day?: string;
    benefit?: string;
  };
  challenges: {
    cagnotteCents: number;
    cagnotteFormatted: string;
    deadline?: string;
  };
}

/** Convertit "3,46 €" ou "0,00" → centimes (346, 0). */
function parsePrice(text: string): number {
  const m = text.match(/(\d+)[,.](\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
}

export function parseLoyaltyPage(html: string): LoyaltyInfo {
  // ── Carte ─────────────────────────────────────────────────────────────────
  const cardNumberM = html.match(/o-cardSelector__cardNumber[^>]*>N°\s*<strong>(\d+)<\/strong>/);
  const cardNumber = cardNumberM?.[1] ?? '';

  const cardNameM = html.match(/o-cardSelector__cardName[^>]*>([^<]+)<\/div>/);
  const cardHolder = cardNameM?.[1]?.trim() ?? '';

  // ── Cagnotte principale ───────────────────────────────────────────────────
  // Contexte : du début de o-loyaltyMyCard__amount jusqu'à 800 chars plus loin
  const balanceSectionM = html.match(/o-loyaltyMyCard__amount[\s\S]{0,800}?o-loyaltyMyCard__row/);
  const balanceCtx = balanceSectionM
    ? html.slice(balanceSectionM.index!, balanceSectionM.index! + 800)
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
  // Deadline : <strong>Jusqu’au 30 juin 2026</strong> (apostrophe ' ou U+2019)
  const challengeDeadlineM = html.match(/<strong>Jusqu(?:’|')au ([^<]+)<\/strong>/);
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
